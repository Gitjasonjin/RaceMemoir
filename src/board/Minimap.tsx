import {useEffect,useRef,useState} from 'react'
import type {Board,PinStyle} from '../domain/model'
import type {CollectionRecord} from '../domain/records'
import {unionBounds,visibleBounds} from './canvas'
import type {Bounds,Camera} from './canvas'
import {resolveEndpoint,threadEndpoints} from './threadEndpoints'

interface Props {
  board:Board;records:CollectionRecord[];pin:PinStyle;bounds:Bounds;view:Camera
  width:number;height:number;onChange:(view:Camera)=>void
}
export default function Minimap(props:Props){
  const {board,records,pin,bounds,view,width,height}=props
  const visible=visibleBounds(view,width,height)
  const [fixed,setFixed]=useState<Bounds|null>(null)
  const overview=fixed??unionBounds(bounds,visible)
  const svg=useRef<SVGSVGElement>(null),latest=useRef(props);latest.current=props
  const drag=useRef<{id:number;rect:DOMRect;bounds:Bounds;camera:Camera;startX:number;startY:number;gain:number;moved:boolean;inside:boolean}|null>(null)
  const frame=useRef<number|null>(null),pending=useRef<Camera|null>(null)
  const flush=()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;const next=pending.current;pending.current=null;if(next)latest.current.onChange(next)}
  useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current)},[])
  const move=(x:number,y:number)=>{
    const d=drag.current;if(!d)return
    const dx=x-d.startX,dy=y-d.startY
    if(!d.moved&&Math.hypot(dx,dy)<3)return
    d.moved=true
    // Relative navigation: cap speed independently of distant items, but keep world-space travel usable when zoomed in.
    pending.current={...d.camera,x:d.camera.x-dx*d.gain,y:d.camera.y-dy*d.gain}
    if(frame.current===null)frame.current=requestAnimationFrame(flush)
  }
  const end=()=>{flush();drag.current=null;setFixed(null)}
  return <button className="minimap" title="点击或拖动定位画布" aria-label="画布缩略图，点击或拖动定位" style={{touchAction:'none',cursor:fixed?'grabbing':'grab'}}
    onPointerDown={e=>{
      if(e.button!==0||drag.current||!svg.current)return
      const rect=svg.current.getBoundingClientRect();if(!rect.width||!rect.height)return
      e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)
      const x=overview.x+(e.clientX-rect.left)/rect.width*overview.width,y=overview.y+(e.clientY-rect.top)/rect.height*overview.height
      const inside=x>=visible.x&&x<=visible.x+visible.width&&y>=visible.y&&y<=visible.y+visible.height
      drag.current={id:e.pointerId,rect,bounds:overview,camera:view,startX:e.clientX,startY:e.clientY,gain:Math.min(2*Math.max(1,view.scale),overview.width/rect.width*view.scale,overview.height/rect.height*view.scale),moved:false,inside}
      setFixed(overview)
    }}
    onPointerMove={e=>{if(drag.current?.id===e.pointerId)move(e.clientX,e.clientY)}}
    onPointerUp={e=>{
      const d=drag.current;if(d?.id!==e.pointerId)return
      move(e.clientX,e.clientY)
      if(!d.moved&&!d.inside){
        const x=d.bounds.x+(d.startX-d.rect.left)/d.rect.width*d.bounds.width,y=d.bounds.y+(d.startY-d.rect.top)/d.rect.height*d.bounds.height
        pending.current={scale:d.camera.scale,x:latest.current.width/2-x*d.camera.scale,y:latest.current.height/2-y*d.camera.scale}
      }
      end();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
    }}
    onPointerCancel={end} onLostPointerCapture={()=>{if(drag.current)end()}}
    onClick={e=>{if(e.detail===0)props.onChange({...view,x:width/2-(bounds.x+bounds.width/2)*view.scale,y:height/2-(bounds.y+bounds.height/2)*view.scale})}}>
    <svg ref={svg} viewBox={`${overview.x} ${overview.y} ${overview.width} ${overview.height}`} preserveAspectRatio="none" aria-hidden="true">
      {board.items.map(i=><rect key={i.id} x={i.x} y={i.y} width={i.w} height={i.h} fill={i.kind==='note'?'#f1d989':i.kind==='medal'?'#676b50':'#f7e7d2'} opacity=".65"/>)}
      {board.threads.map(t=>{const [a,b]=threadEndpoints(t).map(e=>resolveEndpoint(board,records,e,pin));return a&&b?<line key={t.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#bc6050" strokeWidth={overview.width/180}/>:null})}
      <rect data-minimap-viewport x={visible.x} y={visible.y} width={visible.width} height={visible.height} fill="#fff" fillOpacity=".09" stroke="#fff9ef" strokeWidth={overview.width/100}/>
    </svg>
  </button>
}
