import {useNotice} from '../i18n/useNotice'
import {errorNotice,msg} from '../i18n/runtime.ts'
import {t as tr} from '../i18n/runtime.ts'
import {useEffect,useRef,useState} from 'react'
import {Dialog} from '@base-ui/react/dialog'
import {Sticker,RectangleEllipsis,Archive,ImagePlus,Medal,Plus,RotateCcw,Route,Trash2} from 'lucide-react'
import type {CollectionRecord} from '../domain/records'
import type {RecordPanelProps} from './types'
import RecordHoverPreview from './RecordHoverPreview'

export default function LibraryRecords(props:RecordPanelProps){
  const [canPreview,setCanPreview]=useState(()=>window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  useEffect(()=>{const media=window.matchMedia('(hover: hover) and (pointer: fine)'),change=()=>setCanPreview(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  const [recycle,setRecycle]=useState(false)
  const [filter,setFilter]=useState<'all'|CollectionRecord['kind']>('all')
  const [confirmId,setConfirmId]=useState<string|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useNotice('')
  const pending=useRef(false)
  const [emptyOpen,setEmptyOpen]=useState(false)
  const cancelRef=useRef<HTMLButtonElement>(null)
  const archived=props.records.filter(r=>r.archived)
  const eligible=archived.filter(r=>!props.references(r.id)&&!props.threadReferences?.(r.id))
  const kinds=[{id:'all',label:tr("LibraryRecords.030")},{id:'sticker',label:tr("App.026")},{id:'medal',label:tr("App.024")},{id:'photo',label:tr("App.025")},{id:'bib',label:tr("App.023")},{id:'route',label:tr("LibraryRecords.019")}] as const
  const records=props.records.filter(r=>!!r.archived===recycle)
  const visible=records.filter(r=>filter==='all'||r.kind===filter)
  const run=async(action:()=>Promise<void>)=>{
    if(pending.current)return
    pending.current=true;setBusy(true);setError('')
    try{await action();setConfirmId(null);setEmptyOpen(false)}catch(e){setError(errorNotice(e,msg("LibraryRecords.029")))}
    finally{pending.current=false;setBusy(false)}
  }
  return <>
    <div className="record-filters" role="group" aria-label={tr("LibraryRecords.028")}>{kinds.map(k=><button type="button" key={k.id} aria-pressed={filter===k.id} disabled={busy} onClick={()=>{setFilter(k.id);setConfirmId(null);setError('')}}>{k.label}<span>{k.id==='all'?records.length:records.filter(r=>r.kind===k.id).length}</span></button>)}</div>
    <div className="record-recycle-actions"><button type="button" className="record-recycle" disabled={busy} onClick={()=>{setRecycle(!recycle);setConfirmId(null);setError('')}}><Archive size={14}/>{recycle?tr("BibEditor.024"):tr("LibraryRecords.027")}{!recycle&&`（${archived.length}）`}</button>
    {recycle&&<button type="button" className="record-empty-trash" disabled={busy||!eligible.length} onClick={()=>{setError('');setEmptyOpen(true)}}><Trash2 size={14}/>{tr("LibraryRecords.026")}</button>}</div>
    <Dialog.Root open={emptyOpen} onOpenChange={open=>{if(!pending.current)setEmptyOpen(open)}}>
      <Dialog.Portal><Dialog.Backdrop className="ui-dialog-backdrop"/><Dialog.Viewport className="ui-dialog-viewport">
        <Dialog.Popup className="modal recycle-confirm-modal" data-ui-overlay initialFocus={cancelRef}>
          <div className="modal-scroll"><div className="modal-content">
            <Dialog.Title render={<h2/>}>{tr("LibraryRecords.025")}</Dialog.Title>
            <Dialog.Description className="modal-description">{tr("LibraryRecords.024",{v1:eligible.length,v2:archived.length>eligible.length&&tr("LibraryRecords.023",{count:archived.length-eligible.length})})}</Dialog.Description>
            {error&&<p className="record-error" role="alert">{error}</p>}
            <div className="clear-board-actions"><button ref={cancelRef} type="button" disabled={busy} onClick={()=>setEmptyOpen(false)}>{tr("BoardDialog.042")}</button><button type="button" className="clear-board-confirm" disabled={busy||!eligible.length} onClick={()=>void run(()=>props.onEmptyRecycle(eligible.map(r=>r.id)))}>{busy?tr("LibraryRecords.022"):tr("BoardDialog.041")}</button></div>
          </div></div>
        </Dialog.Popup>
      </Dialog.Viewport></Dialog.Portal>
    </Dialog.Root>
    {error&&<p className="record-error" role="alert">{error}</p>}
    <div className="record-list">{visible.map(r=>{
      const references=props.references(r.id)
      const threadReferences=props.threadReferences?.(r.id)??0
      return <div className="record-entry" key={r.id}><div className="record-row">
        <RecordHoverPreview record={r} disabled={busy||!canPreview}><button type="button" className="record-row-main" aria-label={tr("LibraryRecords.021",{v1:r.name})} disabled={busy} onClick={()=>props.onMode({mode:'detail',id:r.id})}>{r.kind==='sticker'?<Sticker size={24}/>:r.kind==='medal'?<Medal size={24}/>:r.kind==='photo'?<ImagePlus size={24}/>:r.kind==='bib'?<RectangleEllipsis size={24}/>:<Route size={24}/>}<span><strong>{r.name}</strong><small>{tr("LibraryRecords.020",{v1:r.source==='demo'?tr("LibraryRecords.018"):'',v2:r.kind==='sticker'?tr("App.026"):r.kind==='medal'?tr("App.024"):r.kind==='photo'?tr("App.025"):r.kind==='bib'?tr("App.023"):tr("LibraryRecords.019"),v3:references})}</small></span></button></RecordHoverPreview>
        {recycle?<button type="button" disabled={busy} onClick={()=>void run(()=>props.onSave({...r,archived:false},false))} aria-label={tr("LibraryRecords.017",{v1:r.name})} title={tr("LibraryRecords.016")}><RotateCcw size={17}/></button>:<button type="button" disabled={busy} onClick={()=>props.onAdd(r)} aria-label={tr("LibraryRecords.015",{v1:r.name})} title={tr("LibraryRecords.014")}><Plus size={18}/></button>}
        <button type="button" className="record-delete" disabled={busy||(recycle&&(references>0||threadReferences>0))} aria-label={`${recycle?tr("LibraryRecords.013"):tr("LibraryRecords.012")} ${r.name}`} title={recycle?(threadReferences?tr("LibraryRecords.011"):references?tr("App.086"):tr("LibraryRecords.010")):tr("LibraryRecords.009")} onClick={()=>{if(recycle){setConfirmId(r.id);setError('')}else void run(()=>props.onSave({...r,archived:true},false))}}><Trash2 size={17}/></button>
      </div>{recycle&&references>0&&<p className="record-delete-hint">{tr("LibraryRecords.008",{v1:references})}</p>}
      {recycle&&threadReferences>0&&<p className="record-delete-hint">{tr("LibraryRecords.007",{v1:threadReferences})}</p>}
      {confirmId===r.id&&<div className="record-delete-confirm" role="group" aria-label={tr("LibraryRecords.006",{v1:r.name})}><p>{tr("LibraryRecords.005")}</p><button type="button" disabled={busy} className="record-delete" onClick={()=>void run(()=>props.onDelete(r.id))}>{tr("LibraryRecords.004")}</button><button type="button" disabled={busy} onClick={()=>setConfirmId(null)}>{tr("BoardDialog.042")}</button></div>}
      </div>
    })}{!visible.length&&<p className="record-empty">{filter!=='all'?tr("LibraryRecords.003"):recycle?tr("LibraryRecords.002"):tr("LibraryRecords.001")}</p>}</div>
  </>
}
