import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { paintRibbonStroke } from './ribbonBrush'
import type { BrushPoint, RepairMode } from './ribbonBrush'
import { useBlobUrl } from '../../shared/useBlobUrl'

interface Props { original: Blob; image: Blob; onApply: (image: Blob) => void; onClose: () => void }
export default function RibbonRepair({original,image,onApply,onClose}:Props){
  const section=useRef<HTMLElement>(null)
  const canvas=useRef<HTMLCanvasElement>(null)
  const pixels=useRef<{original:ImageData;result:ImageData}|null>(null)
  const stroke=useRef<{pointerId:number;point:BrushPoint}|null>(null)
  const [mode,setMode]=useState<RepairMode>('restore'),[size,setSize]=useState(14),[zoom,setZoom]=useState(1)
  const [guide,setGuide]=useState(true),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0)
  const guideUrl=useBlobUrl(original),mounted=useRef(true)
  useEffect(()=>{mounted.current=true;section.current?.scrollIntoView({block:'start'});return()=>{mounted.current=false}},[])
  useEffect(()=>{
    let active=true;setReady(false);setError('');pixels.current=null;stroke.current=null
    void (async()=>{
      let source:ImageBitmap|undefined,processed:ImageBitmap|undefined
      try{
        source=await createImageBitmap(original);processed=await createImageBitmap(image)
        if(!active||!canvas.current)return
        if(source.width!==processed.width||source.height!==processed.height)throw new Error('原图与抠图尺寸不一致，请重新抠图后修复')
        const el=canvas.current;el.width=source.width;el.height=source.height
        const ctx=el.getContext('2d',{willReadFrequently:true})
        if(!ctx)throw new Error('当前浏览器无法打开修复画布')
        ctx.drawImage(source,0,0);const originalPixels=ctx.getImageData(0,0,el.width,el.height)
        ctx.clearRect(0,0,el.width,el.height);ctx.drawImage(processed,0,0)
        pixels.current={original:originalPixels,result:ctx.getImageData(0,0,el.width,el.height)};setReady(true)
      }catch(e){if(active)setError(e instanceof Error?e.message:'图片无法读取')}
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
    canvas.current.toBlob(blob=>{
      if(!mounted.current)return
      setBusy(false)
      if(!blob){setError('修复结果生成失败，请重试');return}
      if(blob.size>20*1024*1024){setError('修复后的图片超过 20 MB，请缩小原图后重试');return}
      onApply(blob)
    },'image/png')
  }
  return <section ref={section} className="ribbon-repair" aria-label="修复奖牌绶带">
    <h3>修复绶带</h3><p className="record-muted">沿原图中的绶带涂抹，将被误删的部分恢复。可放大后用小画笔修边。</p>
    <div className="record-actions" role="group" aria-label="修复工具"><button type="button" aria-pressed={mode==='restore'} disabled={busy} onClick={()=>setMode('restore')}>恢复绶带</button><button type="button" aria-pressed={mode==='erase'} disabled={busy} onClick={()=>setMode('erase')}>擦除背景</button><button type="button" disabled={!ready||busy} onClick={()=>setRevision(n=>n+1)}>重置修复</button></div>
    <label className="ribbon-range">画笔大小 <input type="range" min={2} max={50} value={size} disabled={busy} onChange={e=>setSize(Number(e.target.value))}/><span>{size}</span></label>
    <div className="ribbon-options"><label><input type="checkbox" checked={guide} onChange={e=>setGuide(e.target.checked)}/>显示原图参考</label><label>放大 <select aria-label="修复画布缩放" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label></div>
    {!ready&&!error&&<p className="record-muted" role="status">正在载入原图…</p>}
    <div className="ribbon-viewport medal-preview"><div className="ribbon-stage" style={{width:`${zoom*100}%`}}>
      <canvas ref={canvas} aria-label="沿绶带拖动画笔恢复，切换擦除工具移除多余背景" onPointerDown={e=>paint(e,true)} onPointerMove={e=>paint(e)} onPointerUp={e=>{paint(e);stroke.current=null}} onPointerCancel={()=>{stroke.current=null}} onLostPointerCapture={()=>{stroke.current=null}}/>
      {ready&&guide&&guideUrl&&<img src={guideUrl} alt="原图参考，半透明显示且不写入结果" draggable={false}/>}
    </div></div>
    <p className="record-muted">半透明原图仅供定位；关闭参考即可检查透明效果。</p>
    {error&&<p className="record-error" role="alert">{error}</p>}
    <div className="record-actions"><button type="button" disabled={!ready||busy} onClick={apply}>{busy?'正在应用…':'应用修复'}</button><button type="button" disabled={busy} onClick={onClose}>取消</button></div>
  </section>
}
