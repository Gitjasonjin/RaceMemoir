import {useNotice} from '../i18n/useNotice'
import type {Notice} from '../i18n/runtime'
import {errorNotice,msg,messageText} from '../i18n/runtime.ts'
import {t as tr} from '../i18n/runtime.ts'
import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Check,ImagePlus,Trash2,X} from 'lucide-react'
import {useBlobUrl} from '../shared/useBlobUrl'
import {MAX_BATCH_PHOTOS,readBatchPhoto} from '../items/photo/batchPhotos'
import type {BatchPhoto} from '../items/photo/batchPhotos'

function PhotoRow({photo,onRename,onRemove,disabled}:{photo:BatchPhoto;onRename:(name:string)=>void;onRemove:()=>void;disabled:boolean}){
  const url=useBlobUrl(photo.record.image)
  return <li className="batch-photo-row"><img src={url||undefined} alt={photo.record.name}/>
    <div><label className="batch-photo-name">{tr("BatchPhotoImport.018")}<input type="text" value={photo.record.name} maxLength={200} required pattern={'.*\\S.*'} title={tr("BatchPhotoImport.017")} disabled={disabled} onChange={e=>onRename(e.currentTarget.value)}/></label><small>{photo.width} × {photo.height}</small></div>
    <button type="button" disabled={disabled} aria-label={tr("BatchPhotoImport.016",{v1:photo.record.name})} onClick={onRemove}><Trash2 size={16}/></button>
  </li>
}

export default function BatchPhotoImport({initialFiles,onBack,onClose,onImport}:{initialFiles?:File[];onBack:()=>void;onClose:()=>void;onImport:(photos:BatchPhoto[])=>Promise<void>}){
  const [photos,setPhotos]=useState<BatchPhoto[]>([]),[issues,setIssues]=useState<{file?:string;reason:Notice}[]>([])
  const [progress,setProgress]=useState<{done:number;total:number}|null>(null),[saving,setSaving]=useState(false),[error,setError]=useNotice('')
  const token=useRef(0),active=useRef(true),initial=useRef(initialFiles),busy=!!progress||saving
  const list=useRef<HTMLUListElement>(null)
  const read=async(files:File[])=>{
    if(!files.length)return
    const run=++token.current
    setPhotos([]);setError('');setIssues([]);setProgress({done:0,total:files.length})
    if(files.length>MAX_BATCH_PHOTOS){setIssues([{reason:msg("BatchPhotoImport.015",{v1:MAX_BATCH_PHOTOS})}]);setProgress(null);return}
    const accepted:BatchPhoto[]=[],failed:{file?:string;reason:Notice}[]=[]
    for(const [index,file] of files.entries()){
      try{accepted.push(await readBatchPhoto(file))}catch(e){failed.push({file:file.name,reason:errorNotice(e,msg("BatchPhotoImport.014"))})}
      if(!active.current||run!==token.current)return
      setProgress({done:index+1,total:files.length})
    }
    setPhotos(accepted);setIssues(failed);setProgress(null)
  }
  useEffect(()=>{
    active.current=true
    if(initial.current?.length)void read(initial.current)
    return()=>{active.current=false;token.current++}
  },[])
  const save=async()=>{
    if(busy||!photos.length)return
    const invalid=list.current?.querySelector<HTMLInputElement>('input:invalid')
    if(invalid){setError(msg("BatchPhotoImport.013"));invalid.reportValidity();invalid.focus();return}
    setSaving(true);setError('')
    try{await onImport(photos.map(photo=>({...photo,record:{...photo.record,name:photo.record.name.trim()}})));if(active.current)onClose()}
    catch(e){if(active.current)setError(errorNotice(e,msg("BatchPhotoImport.012")))}
    finally{if(active.current)setSaving(false)}
  }
  return <>
    <div className="record-heading"><button type="button" disabled={saving} onClick={onBack} aria-label={tr("BatchPhotoImport.011")}><ArrowLeft size={19}/></button><div><h2>{tr("BatchPhotoImport.010")}</h2></div><button type="button" disabled={saving} onClick={onClose} aria-label={tr("BatchPhotoImport.009")}><X size={20}/></button></div>
    <div className="record-scroll">
      <label className="record-upload"><ImagePlus size={20}/> {photos.length?tr("BatchPhotoImport.008"):tr("BatchPhotoImport.007")}<input type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label={tr("BatchPhotoImport.006")} disabled={busy} onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void read(files)}}/></label>
      <p className="record-muted">{tr("BatchPhotoImport.005")}</p>
      {progress&&<p className="record-progress" role="status"><span className="record-spinner"/>{tr("BatchPhotoImport.004")}{progress.done} / {progress.total}</p>}
      {!!issues.length&&<div className="record-error" role="alert"><strong>{tr("BatchPhotoImport.003")}</strong><ul>{issues.map((issue,index)=><li key={index}>{issue.file&&`${issue.file}: `}{messageText(issue.reason)}</li>)}</ul></div>}
      {!!photos.length&&<><p className="record-muted">{tr("BatchPhotoImport.002",{v1:photos.length})}</p><ul ref={list} className="batch-photo-list">{photos.map(photo=><PhotoRow key={photo.record.id} photo={photo} disabled={busy} onRename={name=>{setError('');setPhotos(current=>current.map(p=>p.record.id===photo.record.id?{...p,record:{...p.record,name}}:p))}} onRemove={()=>setPhotos(current=>current.filter(p=>p.record.id!==photo.record.id))}/>)}</ul></>}
      {error&&<p className="record-error" role="alert">{error}</p>}
      <button type="button" className="primary-button full-width" disabled={busy||!photos.length} onClick={()=>void save()}><Check size={17}/>{saving?tr("BibEditor.003"):tr("BatchPhotoImport.001",{v1:photos.length?`（${photos.length}）`:''})}</button>
    </div>
  </>
}
