import {useEffect,useRef,useState} from 'react'
import {PanelsTopLeft, Ungroup,X,Check,ArrowUp,ArrowDown,Pencil} from 'lucide-react'
import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {EXHIBIT_LAYOUTS,exhibitSize} from '../../domain/medalExhibit'
import type {ExhibitLayout} from '../../domain/medalExhibit'
import MedalExhibitArtwork from './MedalExhibitArtwork'

function LayoutOptions({count,value,onChange}:{count:number;value?:ExhibitLayout;onChange:(layout:ExhibitLayout)=>void}){
  return <div className="exhibit-layouts" role="group" aria-label="展览框行列布局">{EXHIBIT_LAYOUTS.map(l=><button type="button" key={l.id} aria-label={`${l.label} 展览框`} aria-pressed={l.id===value} disabled={count>l.rows*l.columns} onClick={()=>onChange(l.id)}><span className="exhibit-layout-icon" style={{gridTemplateColumns:`repeat(${l.columns},1fr)`,gridTemplateRows:`repeat(${l.rows},1fr)`}}>{Array.from({length:l.rows*l.columns},(_,i)=><i key={i}/>)}</span>{l.label}</button>)}</div>
}
export function MedalMergeMenu({count,disabled,onMerge}:{count:number;disabled:boolean;onMerge:(layout:ExhibitLayout)=>void}){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false)}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key,true)}},[open])
  return <div className="layer-control" ref={root}><button type="button" aria-label="合并展览框" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(!open)}><PanelsTopLeft size={18}/></button>{open&&<div className="layer-popover" style={{width:260}}><LayoutOptions count={count} onChange={layout=>{onMerge(layout);setOpen(false)}}/></div>}</div>
}
export function MedalSplitButton({onSplit,disabled}:{onSplit:()=>void;disabled:boolean}){
  return <button type="button" aria-label="拆分展览框" disabled={disabled} onClick={onSplit}><Ungroup size={18}/></button>
}
export function MedalExhibitEditor({item,records,onChange,onClose,onSplit,onEdit}:{item:Memory;records:CollectionRecord[];onChange:(change:Partial<Memory>)=>void;onClose:()=>void;onSplit:()=>void;onEdit:(medal:Memory)=>void}){
  const exhibit=item.exhibit!
  const move=(index:number,direction:number)=>{
    const medals=[...exhibit.medals],next=index+direction
    ;[medals[index],medals[next]]=[medals[next],medals[index]]
    onChange({exhibit:{...exhibit,medals}})
  }
  return <aside className="record-panel" data-record-panel aria-label="奖牌展览框编辑" onKeyDown={e=>e.stopPropagation()}>
    <div className="record-heading"><div><h2>奖牌展览框</h2></div><button type="button" aria-label="关闭展览框编辑" onClick={onClose}><X size={20}/></button></div>
    <div className="record-scroll">
      <div className="exhibit-preview"><div style={{width:220*item.w/item.h,aspectRatio:`${item.w}/${item.h}`}}><MedalExhibitArtwork item={item} records={records}/></div></div>
      <label className="field-label">展览框名称<input maxLength={100} value={item.title} onChange={e=>onChange({title:e.target.value})}/></label>
      <h3>行 × 列</h3><LayoutOptions count={exhibit.medals.length} value={exhibit.layout} onChange={layout=>{const size=exhibitSize(layout);onChange({...size,x:item.x+(item.w-size.w)/2,y:item.y+(item.h-size.h)/2,exhibit:{...exhibit,layout}})}}/>
      <fieldset className="surface-options"><legend>展示框</legend><div>{[['wood','原木框'],['black','黑框']].map(([id,label])=><button type="button" key={id} aria-pressed={(item.medalFrame==='black'?'black':'wood')===id} onClick={()=>onChange({medalFrame:id})}><span className={`frame-swatch frame-swatch-${id}`}/>{label}</button>)}</div></fieldset>
      <label className="field-label">阴影深度<input type="range" min={0} max={100} step={5} value={item.shadowDepth??50} onChange={e=>onChange({shadowDepth:Number(e.target.value)})}/></label>
      <h3>框内奖牌 · {exhibit.medals.length}</h3>
      <ul className="exhibit-medals">{exhibit.medals.map((m,index)=><li key={m.id}><span>{index+1}. {records.find(r=>r.id===m.recordId)?.name||m.title}</span><button type="button" disabled={index===0} aria-label={`前移奖牌 ${index+1}`} onClick={()=>move(index,-1)}><ArrowUp size={15}/></button><button type="button" disabled={index===exhibit.medals.length-1} aria-label={`后移奖牌 ${index+1}`} onClick={()=>move(index,1)}><ArrowDown size={15}/></button><button type="button" disabled={!m.recordId} aria-label={`编辑奖牌 ${index+1}`} onClick={()=>m.recordId&&onEdit(m)}><Pencil size={15}/></button></li>)}</ul>
      <div className="record-actions"><button type="button" onClick={onSplit}><Ungroup size={16}/>拆分展览框</button></div>
      <button type="button" className="primary-button full-width" onClick={onClose}><Check size={17}/>保存修改</button>
    </div>
  </aside>
}
