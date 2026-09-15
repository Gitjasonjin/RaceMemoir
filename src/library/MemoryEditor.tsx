import {useState} from 'react'
import type {Dispatch,SetStateAction,FormEvent,ReactNode} from 'react'
import {Check,Plus,X} from 'lucide-react'
import type {Kind,Memory} from '../domain/model'
import {ITEM_STYLES} from '../domain/styleCatalog'
import PhotoComposition from '../items/photo/PhotoComposition'
import PhotoCropPreview from '../items/photo/PhotoCropPreview'
import {samplePhotos} from '../domain/samplePhotos'
export interface MemoryDraft {title:string;variant:string;image:string;number:string;date:string}
interface Props {memoryPanel:'add'|'edit';kind:Kind;selectedItem?:Memory;draft:MemoryDraft;setDraft:Dispatch<SetStateAction<MemoryDraft>>;transformItem:(change:Partial<Memory>)=>void;itemStyles:ReactNode;submitMemory:(event:FormEvent)=>void;onClose:()=>void}
export default function MemoryEditor({memoryPanel,kind,selectedItem,draft,setDraft,transformItem,itemStyles,submitMemory,onClose}:Props){
  const [showMemoryHelp,setShowMemoryHelp]=useState(false)
  return <aside className={`record-panel memory-editor ${showMemoryHelp?'show-editor-help':'hide-editor-help'}`} data-record-panel aria-label="藏品编辑" onKeyDown={e=>e.stopPropagation()}><button className="editor-help-toggle" aria-expanded={showMemoryHelp} onClick={()=>setShowMemoryHelp(v=>!v)}>{showMemoryHelp?'隐藏说明':'使用说明'}</button><div className="record-heading"><div><small>A PIECE OF YOUR JOURNEY</small><h2>{memoryPanel==='edit'?'编辑':'添加'}{{photo:'照片',medal:'奖牌',bib:'号码布',note:'便签',map:'路线','race-map':'赛事地图'}[kind]}</h2></div><button onClick={onClose} aria-label="关闭详情"><X size={20}/></button></div>
      {kind==='photo'&&selectedItem?.kind==='photo'&&memoryPanel==='edit'&&<><PhotoCropPreview item={{...selectedItem,title:draft.title,subtitle:draft.date,image:draft.image}} onChange={transformItem}/><PhotoComposition item={selectedItem} onChange={change=>{transformItem(change);if(change.variant)setDraft(d=>({...d,variant:change.variant!}))}}/></>}<form onSubmit={submitMemory}>{kind==='photo' && <fieldset><legend>挑选一个山野瞬间</legend><div className="photo-options">{samplePhotos.map((photo,i)=><button key={photo} type="button" className={draft.image===photo?'chosen':''} onClick={()=>setDraft({...draft,image:photo})}><img src={photo} alt={['山巅云海','徒步山径','雪山晨光'][i]}/>{draft.image===photo&&<span><Check size={14}/></span>}</button>)}</div></fieldset>}
      <label className="field-label">{kind==='bib'||kind==='medal'?'赛事名称':kind==='note'?'写下你的记忆':'照片寄语'}{kind==='note'?<textarea autoFocus rows={3} maxLength={100} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="那天的风，那时的自己……"/>:<input autoFocus maxLength={kind==='medal'?20:60} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder={kind==='bib'||kind==='medal'?'RIDGE 50K':'山野，留下了答案'}/>}</label>
      {kind==='photo'&&<label className="field-label">拍摄日期<input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>}
      {kind==='bib' && <label className="field-label">参赛号码<input value={draft.number} maxLength={5} inputMode="text" pattern="[A-Za-z0-9]{1,5}" title="请输入 1–5 位英文字母或数字" autoCapitalize="off" spellCheck={false} required onChange={e=>setDraft({...draft,number:e.target.value.replace(/[^A-Za-z0-9]/g,'')})}/></label>}
      {(kind==='medal'||kind==='bib'||kind==='note') && <fieldset><legend>{kind==='medal'?'奖牌材质':'藏品颜色'}</legend><div className="variant-options">{ITEM_STYLES[kind].map(({id:value,label})=><button type="button" key={value} className={draft.variant===value?'chosen':''} onClick={()=>setDraft({...draft,variant:value})}><span className={`swatch ${value}`}/>{label}{draft.variant===value&&<Check size={14}/>}</button>)}</div></fieldset>}
      {memoryPanel==='edit'&&itemStyles}<div className="form-footer"><span>示例素材 · 仅保存在本地</span><button type="submit" className="primary-button">{memoryPanel==='edit'?<Check size={18}/>:<Plus size={18}/>} {memoryPanel==='edit'?'保存修改':'放上收藏板'}</button></div></form></aside>
}
