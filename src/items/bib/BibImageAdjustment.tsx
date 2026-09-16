import {useRef,useState} from 'react'
import {useBlobUrl} from '../../shared/useBlobUrl'
import {fullQuad,validQuad} from './bibGeometry'
import type {Quad,Point} from './bibGeometry'
import type {BibRecord} from '../../domain/records'

export default function BibImageAdjustment({record,busy,onApply,onCancel}:{record:BibRecord;busy:boolean;onApply:(quad:Quad,mode:'crop'|'perspective')=>void;onCancel:()=>void}){
 const url=useBlobUrl(record.originalImage),area=useRef<HTMLDivElement>(null)
 const [mode,setMode]=useState<'crop'|'perspective'>(record.processing||'crop'),[quad,setQuad]=useState<Quad>(record.quad||fullQuad())
 const drag=useRef<{index:number;pointerId:number}|null>(null)
 const labels=['左上','右上','右下','左下']
 const change=(index:number,point:Point)=>setQuad(previous=>{
  const p={x:Math.max(0,Math.min(1,point.x)),y:Math.max(0,Math.min(1,point.y))}
  if(mode==='perspective')return previous.map((q,i)=>i===index?p:q) as Quad
  const opposite=previous[(index+2)%4],left=index===0||index===3,top=index<2
  p.x=left?Math.min(p.x,opposite.x-.02):Math.max(p.x,opposite.x+.02)
  p.y=top?Math.min(p.y,opposite.y-.02):Math.max(p.y,opposite.y+.02)
  const x0=left?p.x:opposite.x,x1=left?opposite.x:p.x,y0=top?p.y:opposite.y,y1=top?opposite.y:p.y
  return [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}]
 })
 return <section className="bib-adjustment" aria-label="号码布图片调整">
  <div className="bib-source-tabs" role="group" aria-label="图片处理方式">{(['crop','perspective'] as const).map(value=><button type="button" key={value} disabled={busy} aria-pressed={mode===value} onClick={()=>{setMode(value);if(value==='crop')setQuad(fullQuad())}}>{value==='crop'?'裁切':'四角校正'}</button>)}</div>
  <p className="record-muted">{mode==='crop'?'拖动四角裁掉留白或背景。':'按左上、右上、右下、左下，拖动四角贴合实物边缘。'}</p>
  <div ref={area} className="bib-adjust-area" style={{width:`min(calc(100% - 24px), ${320*record.originalWidth/record.originalHeight}px)`,aspectRatio:`${record.originalWidth}/${record.originalHeight}`}}>
   {url&&<img src={url} alt="原始号码布" draggable={false}/>}
   <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path d={`M0 0H1V1H0Z M${quad.map(p=>`${p.x} ${p.y}`).join('L')}Z`} fillRule="evenodd" fill="#17291c88"/><polygon points={quad.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#faffb0" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>
   {quad.map((p,index)=><button key={index} type="button" className="bib-corner" disabled={busy} aria-label={`${labels[index]}角`} style={{left:`${p.x*100}%`,top:`${p.y*100}%`}} onPointerDown={e=>{e.preventDefault();e.currentTarget.focus();drag.current={index,pointerId:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(drag.current?.pointerId!==e.pointerId||drag.current.index!==index)return;const r=area.current!.getBoundingClientRect();change(index,{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height})}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} onLostPointerCapture={()=>drag.current=null} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?.02:.005;change(index,{x:p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:p.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)})}}>{index+1}</button>)}
  </div>
  {!validQuad(quad)&&<p className="record-error" role="alert">四角不能交叉或重叠，请重新调整。</p>}
  <div className="record-actions"><button type="button" disabled={busy} onClick={()=>setQuad(fullQuad())}>重置选区</button><button type="button" disabled={busy||!validQuad(quad)} onClick={()=>onApply(quad,mode)}>{busy?'正在处理…':'应用调整'}</button><button type="button" onClick={onCancel}>{busy?'取消处理':'取消'}</button></div>
 </section>
}
