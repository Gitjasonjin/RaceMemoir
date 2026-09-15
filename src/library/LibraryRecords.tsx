import {useRef,useState} from 'react'
import {Archive,ImagePlus,Medal,Plus,RotateCcw,Route,Trash2} from 'lucide-react'
import type {CollectionRecord} from '../domain/records'
import type {RecordPanelProps} from './types'

export default function LibraryRecords(props:RecordPanelProps){
  const [recycle,setRecycle]=useState(false)
  const [filter,setFilter]=useState<'all'|CollectionRecord['kind']>('all')
  const [confirmId,setConfirmId]=useState<string|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const pending=useRef(false)
  const kinds=[{id:'all',label:'全部'},{id:'medal',label:'奖牌'},{id:'photo',label:'照片'},{id:'route',label:'路线'}] as const
  const records=props.records.filter(r=>!!r.archived===recycle)
  const visible=records.filter(r=>filter==='all'||r.kind===filter)
  const run=async(action:()=>Promise<void>)=>{
    if(pending.current)return
    pending.current=true;setBusy(true);setError('')
    try{await action();setConfirmId(null)}catch(e){setError(e instanceof Error?e.message:'操作失败，请重试')}
    finally{pending.current=false;setBusy(false)}
  }
  return <>
    <div className="record-filters" role="group" aria-label="收藏类别">{kinds.map(k=><button type="button" key={k.id} aria-pressed={filter===k.id} disabled={busy} onClick={()=>{setFilter(k.id);setConfirmId(null);setError('')}}>{k.label}<span>{k.id==='all'?records.length:records.filter(r=>r.kind===k.id).length}</span></button>)}</div>
    <button type="button" className="record-recycle" disabled={busy} onClick={()=>{setRecycle(!recycle);setConfirmId(null);setError('')}}><Archive size={14}/>{recycle?'返回收藏库':'查看回收站'}{!recycle&&`（${props.records.filter(r=>r.archived).length}）`}</button>
    {error&&<p className="record-error" role="alert">{error}</p>}
    <div className="record-list">{visible.map(r=>{
      const references=props.references(r.id)
      const threadReferences=props.threadReferences?.(r.id)??0
      return <div className="record-entry" key={r.id}><div className="record-row">
        <button type="button" className="record-row-main" title={r.name} disabled={busy} onClick={()=>props.onMode({mode:'detail',id:r.id})}>{r.kind==='medal'?<Medal size={24}/>:r.kind==='photo'?<ImagePlus size={24}/>:<Route size={24}/>}<span><strong>{r.name}</strong><small>{r.source==='demo'?'示例 · ':''}{r.kind==='medal'?'奖牌':r.kind==='photo'?'照片':'路线'} · 画布上 {references} 件</small></span></button>
        {recycle?<button type="button" disabled={busy} onClick={()=>void run(()=>props.onSave({...r,archived:false},false))} aria-label={`恢复 ${r.name}`} title="恢复收藏"><RotateCcw size={17}/></button>:<button type="button" disabled={busy} onClick={()=>props.onAdd(r)} aria-label={`将 ${r.name} 放上画布`} title="放上画布"><Plus size={18}/></button>}
        <button type="button" className="record-delete" disabled={busy||(recycle&&(references>0||threadReferences>0))} aria-label={`${recycle?'彻底删除':'删除'} ${r.name}`} title={recycle?(threadReferences?'请先移除地图上的地点连线':references?'请先移除画布上使用此收藏的物件':'彻底删除原始文件'):'移入回收站，画布物件保留'} onClick={()=>{if(recycle){setConfirmId(r.id);setError('')}else void run(()=>props.onSave({...r,archived:true},false))}}><Trash2 size={17}/></button>
      </div>{recycle&&references>0&&<p className="record-delete-hint">先移除画布上的 {references} 件物件，才能彻底删除。</p>}
      {recycle&&threadReferences>0&&<p className="record-delete-hint">请先在地图编辑栏移除 {threadReferences} 条地点连线，再彻底删除收藏。</p>}
      {confirmId===r.id&&<div className="record-delete-confirm" role="group" aria-label={`确认删除 ${r.name}`}><p>彻底删除这份收藏及原始文件？此操作无法撤销。</p><button type="button" disabled={busy} className="record-delete" onClick={()=>void run(()=>props.onDelete(r.id))}>确认彻底删除</button><button type="button" disabled={busy} onClick={()=>setConfirmId(null)}>取消</button></div>}
      </div>
    })}{!visible.length&&<p className="record-empty">{filter!=='all'?'此类别暂无收藏':recycle?'回收站是空的':'还没有收藏，上传第一份记忆吧。'}</p>}</div>
  </>
}
