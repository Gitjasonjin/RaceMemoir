import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Check,ImagePlus,Trash2,X} from 'lucide-react'
import {useBlobUrl} from '../shared/useBlobUrl'
import {MAX_BATCH_PHOTOS,readBatchPhoto} from '../items/photo/batchPhotos'
import type {BatchPhoto} from '../items/photo/batchPhotos'

function PhotoRow({photo,onRename,onRemove,disabled}:{photo:BatchPhoto;onRename:(name:string)=>void;onRemove:()=>void;disabled:boolean}){
  const url=useBlobUrl(photo.record.image)
  return <li className="batch-photo-row"><img src={url||undefined} alt={photo.record.name}/>
    <div><label className="batch-photo-name">照片名称<input type="text" value={photo.record.name} maxLength={200} required pattern={'.*\\S.*'} title="请输入照片名称，不能全部为空格" disabled={disabled} onChange={e=>onRename(e.currentTarget.value)}/></label><small>{photo.width} × {photo.height}</small></div>
    <button type="button" disabled={disabled} aria-label={`移除 ${photo.record.name}`} onClick={onRemove}><Trash2 size={16}/></button>
  </li>
}

export default function BatchPhotoImport({initialFiles,onBack,onClose,onImport}:{initialFiles?:File[];onBack:()=>void;onClose:()=>void;onImport:(photos:BatchPhoto[])=>Promise<void>}){
  const [photos,setPhotos]=useState<BatchPhoto[]>([]),[issues,setIssues]=useState<string[]>([])
  const [progress,setProgress]=useState<{done:number;total:number}|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const token=useRef(0),active=useRef(true),initial=useRef(initialFiles),busy=!!progress||saving
  const list=useRef<HTMLUListElement>(null)
  const read=async(files:File[])=>{
    if(!files.length)return
    const run=++token.current
    setPhotos([]);setError('');setIssues([]);setProgress({done:0,total:files.length})
    if(files.length>MAX_BATCH_PHOTOS){setIssues([`每批最多选择 ${MAX_BATCH_PHOTOS} 张图片，请重新选择。`]);setProgress(null);return}
    const accepted:BatchPhoto[]=[],failed:string[]=[]
    for(const [index,file] of files.entries()){
      try{accepted.push(await readBatchPhoto(file))}catch(e){failed.push(`${file.name}：${e instanceof Error?e.message:'读取失败'}`)}
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
    if(invalid){setError('请为每张照片填写名称。');invalid.reportValidity();invalid.focus();return}
    setSaving(true);setError('')
    try{await onImport(photos.map(photo=>({...photo,record:{...photo.record,name:photo.record.name.trim()}})));if(active.current)onClose()}
    catch(e){if(active.current)setError(e instanceof Error?e.message:'导入失败，请重试')}
    finally{if(active.current)setSaving(false)}
  }
  return <>
    <div className="record-heading"><button type="button" disabled={saving} onClick={onBack} aria-label="返回照片添加"><ArrowLeft size={19}/></button><div><h2>批量导入图片</h2></div><button type="button" disabled={saving} onClick={onClose} aria-label="关闭批量导入"><X size={20}/></button></div>
    <div className="record-scroll">
      <label className="record-upload"><ImagePlus size={20}/> {photos.length?'重新选择图片':'选择多张图片'}<input type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="批量选择图片" disabled={busy} onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void read(files)}}/></label>
      <p className="record-muted">每批最多 50 张，每张不超过 20 MB。按图片方向匹配相纸，保存到收藏库并排列到画布。</p>
      {progress&&<p className="record-progress" role="status"><span className="record-spinner"/>正在读取 {progress.done} / {progress.total}</p>}
      {!!issues.length&&<div className="record-error" role="alert"><strong>以下图片未加入</strong><ul>{issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul></div>}
      {!!photos.length&&<><p className="record-muted">待导入 {photos.length} 张 · 可直接修改照片名称</p><ul ref={list} className="batch-photo-list">{photos.map(photo=><PhotoRow key={photo.record.id} photo={photo} disabled={busy} onRename={name=>{setError('');setPhotos(current=>current.map(p=>p.record.id===photo.record.id?{...p,record:{...p.record,name}}:p))}} onRemove={()=>setPhotos(current=>current.filter(p=>p.record.id!==photo.record.id))}/>)}</ul></>}
      {error&&<p className="record-error" role="alert">{error}</p>}
      <button type="button" className="primary-button full-width" disabled={busy||!photos.length} onClick={()=>void save()}><Check size={17}/>{saving?'正在保存…':`导入并放上画布${photos.length?`（${photos.length}）`:''}`}</button>
    </div>
  </>
}
