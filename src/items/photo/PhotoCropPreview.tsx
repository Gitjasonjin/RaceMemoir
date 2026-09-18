import {useCanvasTouch} from '../../board/useCanvasTouch'
import type {PointerEvent as ReactPointerEvent} from 'react'
import {useEffect,useRef,useState} from 'react'
import PhotoArtwork from './PhotoArtwork'
import {displayMemory} from '../../domain/records'
import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {panPhoto,photoCamera,cameraPhoto} from './photoCrop'

export default function PhotoCropPreview({item,record,onChange}:{item:Memory;record?:CollectionRecord;onChange?:(change:Partial<Memory>)=>void}){
  const root=useRef<HTMLDivElement>(null)
  const drag=useRef<{id:number;x:number;y:number;item:Memory;w:number;h:number;nw:number;nh:number}|null>(null)
  const [draft,setDraft]=useState<Partial<Memory>|null>(null)
  const pending=useRef<Partial<Memory>|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const callback=useRef(onChange);callback.current=onChange
  const current=useRef(item);current.current={...item,...draft}
  const finish=()=>{clearTimeout(timer.current);const value=pending.current;pending.current=null;if(value)callback.current?.(value);setDraft(null)}
  const touchView=useRef({x:0,y:0,scale:1}),pinchBefore=useRef<Memory|null>(null)
  const geometry=()=>{
    const area=root.current?.querySelector('.photo-image'),img=area?.querySelector('img')
    if(!area||!img?.naturalWidth)return null
    const rect=area.getBoundingClientRect()
    return {rect,width:rect.width,height:rect.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}
  }
  const syncCamera=()=>{const g=geometry(),i=current.current;if(g)touchView.current=photoCamera(i.photoZoom??1,i.photoX??50,i.photoY??50,g)}
  const start=(e:ReactPointerEvent)=>{
    const g=geometry();if(!g)return
    finish();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,item:current.current,w:g.width,h:g.height,nw:g.naturalWidth,nh:g.naturalHeight}
  }
  const move=(e:ReactPointerEvent)=>{
    const g=drag.current;if(!g||g.id!==e.pointerId)return
    const value=panPhoto(g.item.photoZoom??1,g.item.photoX??50,g.item.photoY??50,e.clientX-g.x,e.clientY-g.y,g.w,g.h,g.nw,g.nh)
    current.current={...current.current,...value};pending.current=value;setDraft(value)
  }
  const stop=(cancel:boolean)=>{
    if(cancel){pending.current=null;current.current=drag.current?.item??pinchBefore.current??item;setDraft(null);syncCamera()}
    else finish()
    drag.current=null;pinchBefore.current=null
  }
  const touch=useCanvasTouch({viewport:root,view:touchView,minScale:1,maxScale:3,
    toLocal:e=>{const g=geometry();return {x:e.clientX-(g?.rect.left??0),y:e.clientY-(g?.rect.top??0)}},
    normalizeView:v=>{const g=geometry();if(!g)return v;const p=cameraPhoto(v,g);return photoCamera(p.photoZoom,p.photoX,p.photoY,g)},
    setView:v=>{const g=geometry();if(g){const value=cameraPhoto(v,g);current.current={...current.current,...value};pending.current=value;setDraft(value)}},
    onTap:()=>{},onDragStart:start,onDragMove:move,onDragEnd:stop,
    onPinchStart:()=>{pinchBefore.current={...current.current};syncCamera()},onPinchEnd:stop,
  })
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
  return <div ref={root} className={`photo-composition-preview ${onChange?'crop-interactive':''}`} style={{width:item.w,height:item.h}} onPointerDownCapture={e=>{if(onChange&&(e.target as Element).closest('.photo-image')){syncCamera();touch.down(e)}}} onPointerMoveCapture={e=>touch.move(e)} onPointerUpCapture={e=>touch.up(e)} onPointerCancelCapture={e=>touch.up(e,true)} onLostPointerCaptureCapture={e=>touch.lost(e)} onPointerDown={e=>{
    if(!onChange||e.button!==0||!(e.target as Element).closest('.photo-image'))return
    e.preventDefault();start(e);e.currentTarget.setPointerCapture(e.pointerId)
  }} onPointerMove={move} onPointerUp={()=>stop(false)} onPointerCancel={()=>stop(true)} onLostPointerCapture={()=>{if(drag.current)stop(true)}}>
    <PhotoArtwork item={displayMemory({...item,...draft},record)} record={record}/>
  </div>
}
