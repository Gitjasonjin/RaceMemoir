import {useRef,useState} from 'react'
import {useBlobUrl} from '../../shared/useBlobUrl'
import type {BibRecord} from '../../domain/records'
import {surroundingColor} from './bibErasure'
import type {BibErasure} from './bibErasure'

export default function BibNameEraser({record,busy,onApply,onCancel}:{record:BibRecord;busy:boolean;onApply:(areas:BibErasure[])=>void;onCancel:()=>void}){
 const url=useBlobUrl(record.originalImage),area=useRef<HTMLDivElement>(null)
 const pixels=useRef<{data:Uint8ClampedArray;width:number;height:number}|null>(null),start=useRef<{x:number;y:number}|null>(null)
 const history=useRef<BibErasure[][]>([])
 const [areas,setAreas]=useState(record.erasures||[]),[selected,setSelected]=useState(Math.max(0,(record.erasures?.length||1)-1)),[box,setBox]=useState<Omit<BibErasure,'color'>|null>(null),[picking,setPicking]=useState(false),[ready,setReady]=useState(false)
 const change=(next:BibErasure[])=>{history.current.push(areas);setAreas(next)}
 const color=(value:string)=>{if(areas[selected])change(areas.map((r,i)=>i===selected?{...r,color:value}:r))}
 const point=(x:number,y:number)=>{const r=area.current!.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(x-r.left)/r.width)),y:Math.max(0,Math.min(1,(y-r.top)/r.height))}}
 const rectangle=(p:{x:number;y:number})=>({x:Math.min(start.current!.x,p.x),y:Math.min(start.current!.y,p.y),width:Math.abs(p.x-start.current!.x),height:Math.abs(p.y-start.current!.y)})
 return <section className="bib-name-eraser" aria-label="姓名抹除">
  <p className="record-muted">在原图上框选姓名，自动匹配周围底色；可手动取色。抹除会应用到画布与图片导出，原图仍保留。</p>
  <div ref={area} className={`bib-adjust-area bib-erase-area ${picking?'is-picking':''}`} style={{width:`min(calc(100% - 24px), ${360*record.originalWidth/record.originalHeight}px)`,aspectRatio:`${record.originalWidth}/${record.originalHeight}`}}
   onPointerDown={e=>{
    if(e.button!==0||busy||!ready)return
    e.preventDefault();const p=point(e.clientX,e.clientY)
    if(picking){const image=pixels.current!,x=Math.min(image.width-1,Math.floor(p.x*image.width)),y=Math.min(image.height-1,Math.floor(p.y*image.height)),i=(y*image.width+x)*4;color('#'+Array.from(image.data.slice(i,i+3)).map(v=>v.toString(16).padStart(2,'0')).join(''));setPicking(false);return}
    if(areas.length>=50)return
    start.current=p;setBox(null);e.currentTarget.setPointerCapture(e.pointerId)
   }} onPointerMove={e=>{if(start.current)setBox(rectangle(point(e.clientX,e.clientY)))}}
   onPointerUp={e=>{if(!start.current)return;const rect=rectangle(point(e.clientX,e.clientY));start.current=null;setBox(null);const image=pixels.current!;if(rect.width*image.width<2||rect.height*image.height<2)return;change([...areas,{...rect,color:surroundingColor(image.data,image.width,image.height,rect)}]);setSelected(areas.length)}}
   onPointerCancel={()=>{start.current=null;setBox(null)}} onLostPointerCapture={()=>{start.current=null;setBox(null)}}>
   {url&&<img src={url} alt="框选姓名的原图" draggable={false} onLoad={e=>{const image=e.currentTarget,canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);pixels.current={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};setReady(true)}}/>}
   {areas.map((r,i)=><div key={i} className={`bib-erasure ${i===selected?'selected':''}`} style={{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`,background:r.color}}/>)}
   {box&&<div className="bib-erase-selection" style={{left:`${box.x*100}%`,top:`${box.y*100}%`,width:`${box.width*100}%`,height:`${box.height*100}%`}}/>}
  </div>
  {!!areas.length&&<><div className="bib-erase-regions" role="group" aria-label="抹除区域">{areas.map((_,i)=><button type="button" key={i} disabled={busy} aria-label={`抹除区域 ${i+1}`} aria-pressed={selected===i} onClick={()=>{setSelected(i);setPicking(false)}}>{i+1}</button>)}</div><label className="bib-erase-color">覆盖底色<input type="color" aria-label="姓名覆盖底色" disabled={busy} value={areas[selected]?.color||'#f3edda'} onChange={e=>color(e.target.value)}/></label></>}
  <div className="record-actions"><button type="button" disabled={busy||!areas.length} aria-pressed={picking} onClick={()=>setPicking(!picking)}>{picking?'点击图片取色':'背景取色'}</button><button type="button" disabled={busy||!areas.length} onClick={()=>{change(areas.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1));setPicking(false)}}>删除选中区域</button><button type="button" disabled={busy||!history.current.length} onClick={()=>{const previous=history.current.pop()!;setAreas(previous);setSelected(Math.max(0,previous.length-1));setPicking(false)}}>撤销上次抹除</button><button type="button" disabled={busy||!areas.length} onClick={()=>{change([]);setSelected(0);setPicking(false)}}>清除全部抹除</button></div>
  {areas.length>=50&&<p className="record-muted">最多保留 50 个区域，可清除或撤销后重新框选。</p>}
  <div className="record-actions"><button type="button" disabled={busy||!ready} onClick={()=>onApply(areas)}>{busy?'正在处理…':'应用抹除'}</button><button type="button" onClick={onCancel}>{busy?'取消处理':'取消'}</button></div>
 </section>
}
