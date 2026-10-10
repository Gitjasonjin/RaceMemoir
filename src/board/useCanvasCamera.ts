import {useCallback,useEffect,useRef,useState} from 'react'
import type {RefObject} from 'react'
import type {CollectionRecord} from '../domain/records'
import type {Board} from '../domain/model'
import {getDecorations} from '../domain/model'
import {contentBounds,fitCamera} from './canvas'
import {MIN_CAMERA_SCALE} from '../domain/geometryLimits'
import type {Gesture,View} from './types'
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

export function useCanvasCamera(boardRef:RefObject<Board>,gesture:RefObject<Gesture|null>,records:CollectionRecord[]=[],initialView?:View){
  const initial=useRef(initialView)
  const recordsRef=useRef(records);recordsRef.current=records
  const [view,setView]=useState<View>(initialView??{x:0,y:0,scale:1})
  const viewRef=useRef(view);viewRef.current=view
  const viewport=useRef<HTMLDivElement>(null)
  const previousSize=useRef({width:1440,height:900})
  const [viewportSize,setViewportSize]=useState({width:1440,height:900})
  // Rebase after intentional chrome changes so ResizeObserver keeps the current camera unchanged.
  const rebaseViewport=useCallback(()=>{const el=viewport.current;if(!el)return;const next={width:el.clientWidth,height:el.clientHeight};previousSize.current=next;setViewportSize(next)},[])
  const fit = useCallback(() => { if (!viewport.current) return; const {width,height} = viewport.current.getBoundingClientRect(); setView(fitCamera(contentBounds(boardRef.current.items,60,boardRef.current.threads,getDecorations(boardRef.current).pin,recordsRef.current),width,height)) }, [])
  useEffect(() => {
    const el=viewport.current; if(!el)return
    rebaseViewport();if(initial.current)setView(initial.current);else fit()
    const observer = new ResizeObserver(()=>{
      const next={width:el.clientWidth,height:el.clientHeight}
      const previous=previousSize.current
      setView(v=>({...v,x:v.x+(next.width-previous.width)/2,y:v.y+(next.height-previous.height)/2}))
      previousSize.current=next;setViewportSize(next)
    })
    observer.observe(el);return ()=>observer.disconnect()
  }, [fit,rebaseViewport])
  const zoomAt = useCallback((scale: number, px: number, py: number) => { if(gesture.current)return;setView(v=>{ const next = clamp(scale,Math.max(MIN_CAMERA_SCALE,Math.min(.05,v.scale)),4); return {scale:next,x:px-(px-v.x)*next/v.scale,y:py-(py-v.y)*next/v.scale} }) }, [])
  const zoom = (factor: number) => { const el=viewport.current; if(el) zoomAt(view.scale*factor,el.clientWidth/2,el.clientHeight/2) }
  useEffect(() => {
    const el = viewport.current; if(!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const rect=el.getBoundingClientRect(); zoomAt(viewRef.current.scale*Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top) }
    el.addEventListener('wheel',wheel,{passive:false}); return ()=>el.removeEventListener('wheel',wheel)
  }, [zoomAt])

  return {view,setView,viewRef,viewport,viewportSize,fit,zoom,zoomAt,rebaseViewport}
}
