import {useEffect,useRef} from 'react'
import type {PointerEvent as ReactPointerEvent,RefObject} from 'react'
import type {Camera} from './canvas'
import {pinchCamera,touchPair} from './touchNavigation'

interface Options {
  viewport:RefObject<Element|null>;view:RefObject<Camera>;setView:(view:Camera)=>void
  onTap:(event:ReactPointerEvent)=>void;onDragStart:(event:ReactPointerEvent)=>void
  onDragMove:(event:ReactPointerEvent)=>void;onDragEnd:(cancel:boolean)=>void
  onLongPress?:(event:ReactPointerEvent)=>void
  toLocal?:(event:ReactPointerEvent)=>{x:number;y:number}
  minScale?:number;maxScale?:number;normalizeView?:(view:Camera)=>Camera
  onPinchStart?:()=>void;onPinchEnd?:(cancel:boolean)=>void
}
/** Touch ownership is decided before child controls can move items or create connections. */
export function useCanvasTouch(options:Options){
  const latest=useRef(options);latest.current=options
  const points=useRef(new Map<number,{x:number;y:number}>())
  const single=useRef<{event:ReactPointerEvent;dragging:boolean;held:boolean}|null>(null)
  const pinch=useRef<{view:Camera;pair:ReturnType<typeof touchPair>;ids:number[]}|null>(null)
  const multi=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const clearTimer=()=>{clearTimeout(timer.current);timer.current=undefined}
  const cancel=()=>{clearTimer();if(single.current?.dragging)latest.current.onDragEnd(true);if(multi.current)latest.current.onPinchEnd?.(true);points.current.clear();single.current=null;pinch.current=null;multi.current=false}
  useEffect(()=>{const hide=()=>{if(document.hidden)cancel()};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hide);return()=>{clearTimer();window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hide)}},[])
  const local=(event:ReactPointerEvent)=>{if(latest.current.toLocal)return latest.current.toLocal(event);const rect=latest.current.viewport.current!.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top}}
  const own=(event:ReactPointerEvent)=>{event.preventDefault();event.stopPropagation()}
  const rebase=()=>{
    const entries=[...points.current.entries()]
    if(entries.length>=2)pinch.current={view:{...latest.current.view.current},pair:touchPair(entries[0][1],entries[1][1]),ids:[entries[0][0],entries[1][0]]}
    else pinch.current=null
  }
  return {
    active:()=>points.current.size>0,
    down(event:ReactPointerEvent){
      if(event.pointerType!=='touch'||(event.target as Element).closest('.empty-board'))return false
      own(event);points.current.set(event.pointerId,local(event));latest.current.viewport.current?.setPointerCapture(event.pointerId)
      if(points.current.size===1){
        single.current={event,dragging:false,held:false};multi.current=false
        if(latest.current.onLongPress)timer.current=setTimeout(()=>{if(single.current&&!single.current.dragging&&!multi.current){single.current.held=true;latest.current.onLongPress?.(single.current.event)}},550)
      }else{
        clearTimer();if(single.current?.dragging)latest.current.onDragEnd(true)
        single.current=null;if(!multi.current)latest.current.onPinchStart?.();multi.current=true;rebase()
      }
      return true
    },
    move(event:ReactPointerEvent){
      if(event.pointerType!=='touch'||!points.current.has(event.pointerId))return false
      own(event)
      points.current.set(event.pointerId,local(event))
      const p=pinch.current
      if(p){
        const a=points.current.get(p.ids[0]),b=points.current.get(p.ids[1]);if(a&&b){const config=latest.current,value=pinchCamera(p.view,p.pair,touchPair(a,b),config.minScale,config.maxScale),next=config.normalizeView?.(value)??value;config.view.current=next;config.setView(next)}
      }else if(!multi.current&&single.current&&!single.current.held){
        const g=single.current
        if(!g.dragging&&Math.hypot(event.clientX-g.event.clientX,event.clientY-g.event.clientY)>=8){clearTimer();g.dragging=true;latest.current.onDragStart(g.event)}
        if(g.dragging)latest.current.onDragMove(event)
      }
      return true
    },
    up(event:ReactPointerEvent,cancelled=false){
      if(event.pointerType!=='touch'||!points.current.has(event.pointerId))return false
      own(event)
      clearTimer()
      if(!multi.current&&single.current){const g=single.current;single.current=null;if(g.dragging)latest.current.onDragEnd(cancelled);else if(!cancelled&&!g.held)latest.current.onTap(g.event)}
      points.current.delete(event.pointerId)
      if(latest.current.viewport.current?.hasPointerCapture(event.pointerId))latest.current.viewport.current.releasePointerCapture(event.pointerId)
      if(cancelled){cancel();return true}
      if(!points.current.size){if(multi.current)latest.current.onPinchEnd?.(false);single.current=null;pinch.current=null;multi.current=false}else if(multi.current)rebase()
      return true
    },
    lost(event:ReactPointerEvent){if(event.pointerType!=='touch')return false;event.stopPropagation();if(points.current.has(event.pointerId))cancel();return true},
  }
}
