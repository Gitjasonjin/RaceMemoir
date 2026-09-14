import {useEffect,useRef,useState} from 'react'
import Artwork from './Artwork'
import type {Memory} from './model'
import type {CollectionRecord} from './records'
import {panPhoto} from './photoCrop'

export default function PhotoCropPreview({item,record,onChange}:{item:Memory;record?:CollectionRecord;onChange?:(change:Partial<Memory>)=>void}){
  const root=useRef<HTMLDivElement>(null)
  const drag=useRef<{id:number;x:number;y:number;item:Memory;w:number;h:number;nw:number;nh:number}|null>(null)
  const [draft,setDraft]=useState<Partial<Memory>|null>(null)
  const pending=useRef<Partial<Memory>|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const callback=useRef(onChange);callback.current=onChange
  const current=useRef(item);current.current={...item,...draft}
  const finish=()=>{clearTimeout(timer.current);const value=pending.current;pending.current=null;if(value)callback.current?.(value);setDraft(null)}
  useEffect(()=>{
    const el=root.current!
    const wheel=(e:WheelEvent)=>{
      if(!callback.current||drag.current||!(e.target instanceof Element)||!e.target.closest('.photo-image'))return
      e.preventDefault();e.stopPropagation()
      const value={...pending.current,photoZoom:Math.max(1,Math.min(3,(current.current.photoZoom??1)*Math.exp(-e.deltaY*.0015)))}
      current.current={...current.current,...value};pending.current=value;setDraft(value)
      clearTimeout(timer.current);timer.current=setTimeout(finish,180)
    }
    el.addEventListener('wheel',wheel,{passive:false})
    return()=>{el.removeEventListener('wheel',wheel);clearTimeout(timer.current);if(pending.current&&!drag.current)callback.current?.(pending.current)}
  },[])
  return <div ref={root} className={`photo-composition-preview ${onChange?'crop-interactive':''}`} style={{width:item.w,height:item.h}} onPointerDown={e=>{
    if(!onChange||e.button!==0||!(e.target instanceof Element))return
    const area=e.target.closest('.photo-image'),img=area?.querySelector('img');if(!area||!img?.naturalWidth)return
    finish();e.preventDefault();const r=area.getBoundingClientRect()
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,item:current.current,w:r.width,h:r.height,nw:img.naturalWidth,nh:img.naturalHeight}
    e.currentTarget.setPointerCapture(e.pointerId)
  }} onPointerMove={e=>{
    const g=drag.current;if(!g||g.id!==e.pointerId)return
    const value=panPhoto(g.item.photoZoom??1,g.item.photoX??50,g.item.photoY??50,e.clientX-g.x,e.clientY-g.y,g.w,g.h,g.nw,g.nh)
    pending.current=value;setDraft(value)
  }} onPointerUp={()=>{drag.current=null;finish()}} onPointerCancel={()=>{drag.current=null;pending.current=null;setDraft(null)}} onLostPointerCapture={()=>{if(drag.current){drag.current=null;pending.current=null;setDraft(null)}}}>
    <Artwork item={{...item,...draft}} record={record}/>
  </div>
}
