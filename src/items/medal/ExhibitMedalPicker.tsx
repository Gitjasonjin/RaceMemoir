import {useNotice} from '../../i18n/useNotice'
import {errorNotice,msg} from '../../i18n/runtime.ts'
import {t as tr} from '../../i18n/runtime.ts'
import {useState} from 'react'
import {ArrowLeft,Medal,Plus,Upload,X} from 'lucide-react'
import type {RecordPanelProps} from '../../library/types'
import type {CollectionRecord} from '../../domain/records'

export default function ExhibitMedalPicker(props:RecordPanelProps){
  const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useNotice('')
  const medals=props.records.filter(r=>r.kind==='medal'&&!r.archived&&r.name.toLowerCase().includes(search.trim().toLowerCase()))
  const add=async(record:CollectionRecord)=>{
    if(busy)return
    setBusy(true);setError('')
    try{await props.onAdd(record);props.onClose()}catch(e){setError(errorNotice(e,msg("ExhibitMedalPicker.010")));setBusy(false)}
  }
  return <>
    <div className="record-heading"><button type="button" aria-label={tr("ExhibitMedalPicker.009")} disabled={busy} onClick={props.onBack}><ArrowLeft size={19}/></button><div><h2>{tr("ExhibitMedalPicker.008",{v1:(props.mode.exhibitSlot??0)+1})}</h2></div><button type="button" aria-label={tr("ExhibitMedalPicker.007")} disabled={busy} onClick={props.onClose}><X size={20}/></button></div>
    <div className="record-scroll">
      <div className="record-actions"><button type="button" disabled={busy} onClick={()=>props.onMode({...props.mode,mode:'medal'})}><Upload size={17}/>{tr("ExhibitMedalPicker.006")}</button></div>
      <label className="field-label">{tr("ExhibitMedalPicker.005")}<input type="search" placeholder={tr("ExhibitMedalPicker.004")} value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <div className="exhibit-picker-list">{medals.map(record=><button type="button" key={record.id} disabled={busy} aria-label={tr("ExhibitMedalPicker.003",{v1:record.name})} onClick={()=>void add(record)}><Medal size={22}/><span>{record.name}</span><Plus size={17}/></button>)}</div>
      {!medals.length&&<p className="record-muted">{search?tr("ExhibitMedalPicker.002"):tr("ExhibitMedalPicker.001")}</p>}
      {error&&<p className="record-error" role="alert">{error}</p>}
    </div>
  </>
}
