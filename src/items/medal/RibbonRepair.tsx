import {useNotice} from '../../i18n/useNotice'
import {errorNotice,msg,AppError} from '../../i18n/runtime.ts'
import {t as tr} from '../../i18n/runtime.ts'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { paintRibbonStroke } from './ribbonBrush'
import type { BrushPoint, RepairMode } from './ribbonBrush'
import { useBlobUrl } from '../../shared/useBlobUrl'
import {createProcessingBitmap} from '../../shared/processingImage'

interface Props { original: Blob; image: Blob; onApply: (image: Blob) => void | Promise<void>; onClose: () => void; subject?: 'medal'|'sticker' }
export default function RibbonRepair({original,image,onApply,onClose,subject='medal'}:Props){
  const sticker=subject==='sticker'
  const section=useRef<HTMLElement>(null)
  const canvas=useRef<HTMLCanvasElement>(null)
  const pixels=useRef<{original:ImageData;result:ImageData}|null>(null)
  const stroke=useRef<{pointerId:number;point:BrushPoint}|null>(null)
  const [mode,setMode]=useState<RepairMode>('restore'),[size,setSize]=useState(14),[zoom,setZoom]=useState(1)
  const [guide,setGuide]=useState(true),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useNotice(''),[revision,setRevision]=useState(0)
  const guideUrl=useBlobUrl(original),mounted=useRef(true)
  useEffect(()=>{mounted.current=true;section.current?.scrollIntoView({block:'start'});return()=>{mounted.current=false}},[])
  useEffect(()=>{
    let active=true;setReady(false);setError('');pixels.current=null;stroke.current=null
    void (async()=>{
      let source:ImageBitmap|undefined,processed:ImageBitmap|undefined
      try{
        source=await createProcessingBitmap(original);processed=await createProcessingBitmap(image)
        if(!active||!canvas.current)return
        if(source.width!==processed.width||source.height!==processed.height)throw new AppError("RibbonRepair.024")
        const el=canvas.current;el.width=source.width;el.height=source.height
        const ctx=el.getContext('2d',{willReadFrequently:true})
        if(!ctx)throw new AppError("RibbonRepair.023")
        ctx.drawImage(source,0,0);const originalPixels=ctx.getImageData(0,0,el.width,el.height)
        ctx.clearRect(0,0,el.width,el.height);ctx.drawImage(processed,0,0)
        pixels.current={original:originalPixels,result:ctx.getImageData(0,0,el.width,el.height)};setReady(true)
      }catch(e){if(active)setError(errorNotice(e,msg("RibbonRepair.022")))}
      finally{source?.close();processed?.close()}
    })()
    return()=>{active=false;pixels.current=null}
  },[original,image,revision])
  const point=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
    const rect=e.currentTarget.getBoundingClientRect()
    return {x:(e.clientX-rect.left)*e.currentTarget.width/rect.width,y:(e.clientY-rect.top)*e.currentTarget.height/rect.height}
  }
  const paint=(e:ReactPointerEvent<HTMLCanvasElement>,start=false)=>{
    if(!ready||busy||!pixels.current)return
    if(start){if(e.button!==0||stroke.current)return;e.currentTarget.setPointerCapture(e.pointerId);stroke.current={pointerId:e.pointerId,point:point(e)}}
    const current=stroke.current;if(!current||current.pointerId!==e.pointerId)return
    e.preventDefault()
    const next=point(e),radius=size/2*e.currentTarget.width/e.currentTarget.getBoundingClientRect().width
    const dirty=paintRibbonStroke(pixels.current.result,pixels.current.original,current.point,next,radius,mode)
    if(dirty.width&&dirty.height)e.currentTarget.getContext('2d')!.putImageData(pixels.current.result,0,0,dirty.x,dirty.y,dirty.width,dirty.height)
    current.point=next
  }
  const apply=()=>{
    if(!ready||busy||!canvas.current)return
    setBusy(true);setError('')
    canvas.current.toBlob(async blob=>{
      if(!mounted.current)return
      try{
        if(!blob)throw new AppError("RibbonRepair.021")
        if(blob.size>20*1024*1024)throw new AppError("RibbonRepair.020")
        await onApply(blob)
      }catch(e){if(mounted.current)setError(errorNotice(e,msg("RibbonRepair.019")))}
      finally{if(mounted.current)setBusy(false)}
    },'image/png')
  }
  return <section ref={section} className="ribbon-repair" aria-label={sticker?tr("RibbonRepair.017"):tr("RibbonRepair.018")}>
    <h3>{sticker?tr("RibbonRepair.017"):tr("RibbonRepair.016")}</h3>
    <div className="record-actions" role="group" aria-label={tr("RibbonRepair.015")}><button type="button" aria-pressed={mode==='restore'} disabled={busy} onClick={()=>setMode('restore')}>{sticker?tr("RibbonRepair.014"):tr("RibbonRepair.013")}</button><button type="button" aria-pressed={mode==='erase'} disabled={busy} onClick={()=>setMode('erase')}>{tr("RibbonRepair.012")}</button><button type="button" disabled={!ready||busy} onClick={()=>setRevision(n=>n+1)}>{tr("RibbonRepair.011")}</button></div>
    <label className="ribbon-range">{tr("RibbonRepair.010")}<input type="range" min={2} max={50} value={size} disabled={busy} onChange={e=>setSize(Number(e.target.value))}/><span>{size}</span></label>
    <div className="ribbon-options"><label><input type="checkbox" checked={guide} onChange={e=>setGuide(e.target.checked)}/>{tr("RibbonRepair.009")}</label><label>{tr("RibbonRepair.008")}<select aria-label={tr("RibbonRepair.007")} value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label></div>
    {!ready&&!error&&<p className="record-muted" role="status">{tr("RibbonRepair.006")}</p>}
    <div className="ribbon-viewport medal-preview"><div className="ribbon-stage" style={{width:`${zoom*100}%`}}>
      <canvas ref={canvas} aria-label={sticker?tr("RibbonRepair.005"):tr("RibbonRepair.004")} onPointerDown={e=>paint(e,true)} onPointerMove={e=>paint(e)} onPointerUp={e=>{paint(e);stroke.current=null}} onPointerCancel={()=>{stroke.current=null}} onLostPointerCapture={()=>{stroke.current=null}}/>
      {ready&&guide&&guideUrl&&<img src={guideUrl} alt={tr("RibbonRepair.003")} draggable={false}/>}
    </div></div>

    {error&&<p className="record-error" role="alert">{error}</p>}
    <div className="record-actions"><button type="button" disabled={!ready||busy} onClick={apply}>{busy?tr("RibbonRepair.002"):tr("RibbonRepair.001")}</button><button type="button" disabled={busy} onClick={onClose}>{tr("BoardDialog.042")}</button></div>
  </section>
}
