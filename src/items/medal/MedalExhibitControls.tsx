import {useState} from 'react'
import {Popover} from '@base-ui/react/popover'
import {Hint,HintButton} from '../../shared/ui/Hint'
import {PanelsTopLeft, Ungroup,X,Check,ArrowUp,ArrowDown,Pencil} from 'lucide-react'
import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {EXHIBIT_LAYOUTS,exhibitSize,exhibitSlots,exhibitLayout} from '../../domain/medalExhibit'
import type {ExhibitLayout} from '../../domain/medalExhibit'
import MedalExhibitArtwork from './MedalExhibitArtwork'

function LayoutOptions({count,value,onChange}:{count:number;value?:ExhibitLayout;onChange:(layout:ExhibitLayout)=>void}){
  return <div className="exhibit-layouts" role="group" aria-label="展览框行列布局">{EXHIBIT_LAYOUTS.map(l=><button type="button" key={l.id} aria-label={`${l.label} 展览框`} aria-pressed={l.id===value} disabled={count>l.rows*l.columns} onClick={()=>onChange(l.id)}><span className="exhibit-layout-icon" style={{gridTemplateColumns:`repeat(${l.columns},1fr)`,gridTemplateRows:`repeat(${l.rows},1fr)`}}>{Array.from({length:l.rows*l.columns},(_,i)=><i key={i}/>)}</span>{l.label}</button>)}</div>
}
export function MedalMergeMenu({count,disabled,onMerge}:{count:number;disabled:boolean;onMerge:(layout:ExhibitLayout)=>void}){
  const [open,setOpen]=useState(false)
  return <div className="layer-control"><Popover.Root open={open} onOpenChange={setOpen}>
    <Hint label="合并展览框" disabled={disabled||open}><Popover.Trigger aria-label="合并展览框" disabled={disabled}><PanelsTopLeft size={18}/></Popover.Trigger></Hint>
    <Popover.Portal><Popover.Positioner side="top" sideOffset={14} collisionPadding={8} className="ui-menu-positioner"><Popover.Popup className="layer-popover ui-action-menu" style={{width:260}} aria-label="展览框行列布局" data-ui-overlay>
      <LayoutOptions count={count} onChange={layout=>{setOpen(false);onMerge(layout)}}/>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root></div>
}

export function MedalSplitButton({onSplit,disabled}:{onSplit:()=>void;disabled:boolean}){
  return <HintButton aria-label="拆分展览框" disabled={disabled} onClick={onSplit}><Ungroup size={18}/></HintButton>
}
export function MedalExhibitEditor({item,records,onChange,onClose,onSplit,onEdit,onAdd}:{item:Memory;records:CollectionRecord[];onChange:(change:Partial<Memory>)=>void;onClose:()=>void;onSplit:()=>void;onEdit:(medal:Memory)=>void;onAdd:(slot:number)=>void}){
  const exhibit=item.exhibit!,slots=exhibitSlots(exhibit)
  const move=(index:number,direction:number)=>{
    const medals=[...exhibit.medals],next=index+direction
    ;[medals[index],medals[next]]=[medals[next],medals[index]]
    onChange({exhibit:{...exhibit,medals}})
  }
  return <aside className="record-panel" data-record-panel aria-label="奖牌展览框编辑">
    <div className="record-heading"><div><h2>奖牌展览框</h2></div><button type="button" aria-label="关闭展览框编辑" onClick={onClose}><X size={20}/></button></div>
    <div className="record-scroll">
      <div className="exhibit-preview"><div style={{width:220*item.w/item.h,aspectRatio:`${item.w}/${item.h}`}}><MedalExhibitArtwork item={item} records={records} onAdd={onAdd}/></div></div>
      <label className="field-label">展览框名称<input maxLength={100} value={item.title} onChange={e=>onChange({title:e.target.value})}/></label>
      <h3>行 × 列</h3><LayoutOptions count={exhibit.medals.length} value={exhibit.layout} onChange={layout=>{const size=exhibitSize(layout),option=exhibitLayout(layout);onChange({...size,x:item.x+(item.w-size.w)/2,y:item.y+(item.h-size.h)/2,exhibit:{...exhibit,layout,slots:exhibitSlots(exhibit).some(slot=>slot>=option.rows*option.columns)?undefined:exhibit.slots}})}}/>
      <fieldset className="surface-options"><legend>展示框</legend><div>{[['wood','原木框'],['black','黑框']].map(([id,label])=><button type="button" key={id} aria-pressed={(item.medalFrame==='black'?'black':'wood')===id} onClick={()=>onChange({medalFrame:id})}><span className={`frame-swatch frame-swatch-${id}`}/>{label}</button>)}</div></fieldset>
      <label className="field-label">阴影深度<input type="range" min={0} max={100} step={5} value={item.shadowDepth??50} onChange={e=>onChange({shadowDepth:Number(e.target.value)})}/></label>
      <h3>框内奖牌 · {exhibit.medals.length}</h3>
      <ul className="exhibit-medals">{exhibit.medals.map((m,index)=><li key={m.id}><span>{slots[index]+1}. {records.find(r=>r.id===m.recordId)?.name||m.title}</span><button type="button" disabled={index===0} aria-label={`前移奖牌 ${slots[index]+1}`} onClick={()=>move(index,-1)}><ArrowUp size={15}/></button><button type="button" disabled={index===exhibit.medals.length-1} aria-label={`后移奖牌 ${slots[index]+1}`} onClick={()=>move(index,1)}><ArrowDown size={15}/></button><button type="button" disabled={!m.recordId} aria-label={`编辑奖牌 ${slots[index]+1}`} onClick={()=>m.recordId&&onEdit(m)}><Pencil size={15}/></button></li>)}</ul>
      <div className="record-actions"><button type="button" onClick={onSplit}><Ungroup size={16}/>拆分展览框</button></div>
      <button type="button" className="primary-button full-width" onClick={onClose}><Check size={17}/>保存修改</button>
    </div>
  </aside>
}
