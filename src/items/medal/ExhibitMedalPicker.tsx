import {useState} from 'react'
import {ArrowLeft,Medal,Plus,Upload,X} from 'lucide-react'
import type {RecordPanelProps} from '../../library/types'
import type {CollectionRecord} from '../../domain/records'

export default function ExhibitMedalPicker(props:RecordPanelProps){
  const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const medals=props.records.filter(r=>r.kind==='medal'&&!r.archived&&r.name.toLowerCase().includes(search.trim().toLowerCase()))
  const add=async(record:CollectionRecord)=>{
    if(busy)return
    setBusy(true);setError('')
    try{await props.onAdd(record);props.onClose()}catch(e){setError(e instanceof Error?e.message:'添加失败，请重试');setBusy(false)}
  }
  return <>
    <div className="record-heading"><button type="button" aria-label="返回展览框" disabled={busy} onClick={props.onBack}><ArrowLeft size={19}/></button><div><h2>添加奖牌到空位 {(props.mode.exhibitSlot??0)+1}</h2></div><button type="button" aria-label="关闭添加奖牌" disabled={busy} onClick={props.onClose}><X size={20}/></button></div>
    <div className="record-scroll">
      <div className="record-actions"><button type="button" disabled={busy} onClick={()=>props.onMode({...props.mode,mode:'medal'})}><Upload size={17}/>上传新奖牌</button></div>
      <label className="field-label">从收藏库选择<input type="search" placeholder="搜索奖牌名称" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <div className="exhibit-picker-list">{medals.map(record=><button type="button" key={record.id} disabled={busy} aria-label={`添加奖牌：${record.name}`} onClick={()=>void add(record)}><Medal size={22}/><span>{record.name}</span><Plus size={17}/></button>)}</div>
      {!medals.length&&<p className="record-muted">{search?'没有匹配的奖牌，请更换关键词或上传新奖牌。':'收藏库中还没有奖牌，可上传新奖牌并直接放入此空位。'}</p>}
      {error&&<p className="record-error" role="alert">{error}</p>}
    </div>
  </>
}
