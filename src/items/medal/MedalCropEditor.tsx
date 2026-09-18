import {useEffect,useRef,useState} from 'react'
import type {KeyboardEvent,PointerEvent} from 'react'
import {useMedalImage} from './useMedalImage'
import {dragMedalCrop,FULL_MEDAL_CROP} from './medalCrop'
import type {CropHandle,MedalCrop} from './medalCrop'

interface Props {original?:Blob;image:Blob;initial?:MedalCrop;onApply:(crop:MedalCrop)=>void;onClose:()=>void}
const handles=[['nw','左上角'],['ne','右上角'],['sw','左下角'],['se','右下角']] as const
export default function MedalCropEditor({original,image,initial,onApply,onClose}:Props){
  const [crop,setCrop]=useState<MedalCrop>(()=>initial||{...FULL_MEDAL_CROP})
  const section=useRef<HTMLElement>(null),area=useRef<HTMLDivElement>(null)
  const drag=useRef<{id:number;x:number;y:number;width:number;height:number;crop:MedalCrop;handle:CropHandle}|null>(null)
  const {url,aspect,ready,error}=useMedalImage(original,image,FULL_MEDAL_CROP)
  useEffect(()=>{section.current?.scrollIntoView({block:'start'})},[])
  const start=(e:PointerEvent<HTMLElement>,handle:CropHandle)=>{
    if(!ready||e.button!==0||drag.current||!area.current)return
    e.preventDefault();e.stopPropagation();e.currentTarget.focus()
    const rect=area.current.getBoundingClientRect()
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,width:rect.width,height:rect.height,crop,handle}
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move=(e:PointerEvent<HTMLElement>)=>{
    const d=drag.current;if(!d||d.id!==e.pointerId)return
    setCrop(dragMedalCrop(d.crop,d.handle,(e.clientX-d.x)/d.width,(e.clientY-d.y)/d.height))
  }
  const keyboard=(e:KeyboardEvent<HTMLElement>,handle:CropHandle)=>{
    if(!ready||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return
    e.preventDefault();e.stopPropagation();const step=e.shiftKey?.05:.005
    setCrop(c=>dragMedalCrop(c,handle,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0))
  }
  const previewAspect=(aspect||1)*crop.width/crop.height
  return <section ref={section} className="medal-crop-editor" aria-label="手动裁剪奖牌">
    <h3>手动裁剪奖牌</h3>
    <p className="record-muted">拖动虚线框移动选区，拖动四角调整大小。也可选中边框或角点后用方向键微调，按住 Shift 加快调整。</p>
    {!ready&&!error&&<p role="status" className="record-muted">正在载入奖牌…</p>}
    {error&&<p role="alert" className="record-error">{error}</p>}
    {ready&&<>
      <div className="medal-crop-workspace medal-preview">
        <div ref={area} className="medal-crop-area" style={{width:Math.min(300,360*(aspect||1)),aspectRatio:aspect}} onPointerMove={move} onPointerUp={e=>{move(e);drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}>
          <img src={url} alt="奖牌裁剪原始范围" draggable={false}/>
          <div className="medal-crop-selection" style={{left:`${crop.x*100}%`,top:`${crop.y*100}%`,width:`${crop.width*100}%`,height:`${crop.height*100}%`}}>
            <button type="button" className="medal-crop-move" aria-label="移动奖牌裁剪框" onPointerDown={e=>start(e,'move')} onKeyDown={e=>keyboard(e,'move')}/>
            {handles.map(([handle,label])=><button key={handle} type="button" className={`medal-crop-handle medal-crop-${handle}`} aria-label={`裁剪${label}`} onPointerDown={e=>start(e,handle)} onKeyDown={e=>keyboard(e,handle)}/>)}
          </div>
        </div>
      </div>
      <p className="record-muted">裁剪预览</p>
      <div className="medal-crop-result medal-preview" style={{width:Math.min(260,160*previewAspect),aspectRatio:previewAspect}}>
        <img src={url} alt="奖牌裁剪结果预览" draggable={false} style={{width:`${100/crop.width}%`,height:`${100/crop.height}%`,left:`${-crop.x/crop.width*100}%`,top:`${-crop.y/crop.height*100}%`}}/>
      </div>
    </>}
    <div className="record-actions"><button type="button" disabled={!ready} onClick={()=>onApply(crop)}>应用裁剪</button><button type="button" disabled={!ready} onClick={()=>setCrop({...FULL_MEDAL_CROP})}>重置选区</button><button type="button" onClick={onClose}>取消裁剪</button></div>
  </section>
}
