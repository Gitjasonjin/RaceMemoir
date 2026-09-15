import {useCallback,useEffect,useRef,useState} from 'react'
import type {RefObject} from 'react'
import type {CollectionRecord} from '../domain/records'
import type {Board} from '../domain/model'
import {getDecorations} from '../domain/model'
import {contentBounds,fitCamera} from './canvas'
import type {Gesture,View} from './types'
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

export function useCanvasCamera(boardRef:RefObject<Board>,gesture:RefObject<Gesture|null>,records:CollectionRecord[]=[]){
  const recordsRef=useRef(records);recordsRef.current=records
  const [view,setView]=useState<View>({x:0,y:0,scale:1})
  const viewRef=useRef(view);viewRef.current=view
  const viewport=useRef<HTMLDivElement>(null)
  const [viewportSize,setViewportSize]=useState({width:1440,height:900})
  const fit = useCallback(() => { if (!viewport.current) return; const {width,height} = viewport.current.getBoundingClientRect(); setView(fitCamera(contentBounds(boardRef.current.items,60,boardRef.current.threads,getDecorations(boardRef.current).pin,recordsRef.current),width,height)) }, [])
  useEffect(() => {
    const el=viewport.current; if(!el)return
    let previous={width:el.clientWidth,height:el.clientHeight}
    setViewportSize(previous); fit()
    const observer = new ResizeObserver(()=>{
      const next={width:el.clientWidth,height:el.clientHeight}
      setView(v=>({...v,x:v.x+(next.width-previous.width)/2,y:v.y+(next.height-previous.height)/2}))
      previous=next;setViewportSize(next)
    })
    observer.observe(el);return ()=>observer.disconnect()
  }, [fit])
  const zoomAt = useCallback((scale: number, px: number, py: number) => { if(gesture.current)return;setView(v=>{ const next = clamp(scale,Math.min(.05,v.scale),4); return {scale:next,x:px-(px-v.x)*next/v.scale,y:py-(py-v.y)*next/v.scale} }) }, [])
  const zoom = (factor: number) => { const el=viewport.current; if(el) zoomAt(view.scale*factor,el.clientWidth/2,el.clientHeight/2) }
  useEffect(() => {
    const el = viewport.current; if(!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const rect=el.getBoundingClientRect(); zoomAt(viewRef.current.scale*Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top) }
    el.addEventListener('wheel',wheel,{passive:false}); return ()=>el.removeEventListener('wheel',wheel)
  }, [zoomAt])

  return {view,setView,viewRef,viewport,viewportSize,fit,zoom,zoomAt}
}
