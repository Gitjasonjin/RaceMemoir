import {useCanvasTouch} from '../board/useCanvasTouch'
import type {PointerEvent as ReactPointerEvent} from 'react'
import {MAX_MAP_SCALE} from '../domain/mapSettings'
import {useEffect,useRef,useState} from 'react'
import type {RefObject} from 'react'
import {Plus,Minus,Maximize} from 'lucide-react'
import {mapGeometry as geography} from './mapGeometry'
import RaceMapDrawing from './RaceMapDrawing'
import {validRaceLocation,coarseCoordinate} from '../domain/raceLocation'
import type {RaceLocation} from '../domain/raceLocation'
import {INITIAL_TRANSFORM,MAP_WIDTH,MAP_HEIGHT,clampTransform,zoomMap} from './raceMapProjection'
import type {MapTransform} from './raceMapProjection'
import type {RaceLocationGroup} from './raceMapGrouping'

export interface RaceMapCanvasProps {
  theme?:string;groups?: RaceLocationGroup[]; selected?: string; onSelect?: (key: string) => void
  onPick?: (point: {lat: number; lng: number}) => void; location?: RaceLocation
  svgRef?: RefObject<SVGSVGElement | null>
  value?:MapTransform;onViewChange?:(view:MapTransform)=>void
}
export default function RaceMapCanvas({theme,groups=[],selected,onSelect,onPick,location,svgRef,value,onViewChange}: RaceMapCanvasProps) {
  const localSvg=useRef<SVGSVGElement>(null), svg=svgRef || localSvg
  const [localView,setLocalView]=useState<MapTransform>(INITIAL_TRANSFORM)
  const view=value??localView,viewRef=useRef(view);viewRef.current=view
  const changeRef=useRef(onViewChange);changeRef.current=onViewChange
  const setView=(next:MapTransform|((view:MapTransform)=>MapTransform))=>{const v=typeof next==='function'?next(viewRef.current):next;viewRef.current=v;if(changeRef.current)changeRef.current(v);else setLocalView(v)}
  const drag=useRef<{id:number;x:number;y:number;view:MapTransform;moved:boolean}|null>(null)
  const toPoint=(x:number,y:number) => {
    const el=svg.current, matrix=el?.getScreenCTM()
    if(!el || !matrix)return null
    const point=el.createSVGPoint();point.x=x;point.y=y
    return point.matrixTransform(matrix.inverse())
  }
  const pick=(event:ReactPointerEvent)=>{
    const marker=(event.target as Element).closest<SVGElement>('[data-map-group]')?.dataset.mapGroup
    if(marker){onSelect?.(marker);return}
    if(!onPick)return
    const p=toPoint(event.clientX,event.clientY),v=viewRef.current
    const point=p?geography.projection.invert?.([(p.x-v.x)/v.scale,(p.y-v.y)/v.scale]):null
    if(point&&validRaceLocation({name:'地点',lng:point[0],lat:point[1]}))onPick({lng:coarseCoordinate(point[0]),lat:coarseCoordinate(point[1])})
  }
  const start=(e:ReactPointerEvent)=>{const p=toPoint(e.clientX,e.clientY);if(p)drag.current={id:e.pointerId,x:p.x,y:p.y,view:{...viewRef.current},moved:false}}
  const move=(e:ReactPointerEvent)=>{
    const g=drag.current;if(!g||e.pointerId!==g.id)return
    const p=toPoint(e.clientX,e.clientY);if(!p)return
    if(Math.hypot(p.x-g.x,p.y-g.y)>4)g.moved=true
    if(g.moved)setView(clampTransform({...g.view,x:g.view.x+p.x-g.x,y:g.view.y+p.y-g.y}))
  }
  const touch=useCanvasTouch({viewport:svg,view:viewRef,setView,toLocal:e=>toPoint(e.clientX,e.clientY)??{x:0,y:0},minScale:1,maxScale:MAX_MAP_SCALE,normalizeView:clampTransform,onTap:pick,onDragStart:start,onDragMove:move,onDragEnd:cancel=>{if(cancel&&drag.current)setView(drag.current.view);drag.current=null}})
  useEffect(()=>{
    const el=svg.current;if(!el)return
    const wheel=(e:WheelEvent)=>{
      e.stopPropagation()
      // Ordinary scrolling belongs to the sidebar; modifier/pinch zoom stays in the map.
      if(!e.ctrlKey&&!e.metaKey)return
      e.preventDefault();if(drag.current)return
      const p=toPoint(e.clientX,e.clientY)
      if(p)setView(v=>zoomMap(v,Math.exp(-e.deltaY*.0015),p.x,p.y))
    }
    el.addEventListener('wheel',wheel,{passive:false})
    return()=>el.removeEventListener('wheel',wheel)
  },[svg])
  return <div className={`race-map-canvas ${onPick?'is-picking':''}`}>
    <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-label={onPick?'点选赛事地点':'中国赛事地图'}
      onPointerDownCapture={e=>touch.down(e)} onPointerMoveCapture={e=>touch.move(e)} onPointerUpCapture={e=>touch.up(e)} onPointerCancelCapture={e=>touch.up(e,true)} onLostPointerCaptureCapture={e=>touch.lost(e)}
      onPointerDown={e=>{
        if(e.button!==0||(e.target as Element).closest('.race-marker[role=button]')||drag.current)return
        e.preventDefault();start(e);e.currentTarget.setPointerCapture(e.pointerId)
      }} onPointerMove={move} onPointerUp={e=>{
        const g=drag.current;drag.current=null
        if(g&&g.id===e.pointerId&&!g.moved)pick(e)
      }} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}>
      <RaceMapDrawing theme={theme} view={view} groups={groups} selected={selected} onSelect={onSelect} location={location}/>
    </svg>
    <div className="race-map-tools" role="group" aria-label="地图缩放">
      <button type="button" aria-label="放大地图" disabled={view.scale>=MAX_MAP_SCALE} onClick={()=>setView(v=>zoomMap(v,1.25,MAP_WIDTH/2,MAP_HEIGHT/2))}><Plus size={18}/></button>
      <span aria-live="polite">{Math.round(view.scale*100)}%</span>
      <button type="button" aria-label="缩小地图" disabled={view.scale<=1} onClick={()=>setView(v=>zoomMap(v,.8,MAP_WIDTH/2,MAP_HEIGHT/2))}><Minus size={18}/></button>
      <button type="button" aria-label="重置地图" onClick={()=>setView(INITIAL_TRANSFORM)}><Maximize size={17}/></button>
    </div>
    <p className="race-map-gesture-hint">{onPick?'点击大致区域选点 · ':''}{window.matchMedia('(pointer: coarse)').matches?'单指平移 · 双指缩放':'拖动平移 · Ctrl / ⌘ + 滚轮缩放'}</p>
  </div>
}
