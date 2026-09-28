import AssetPicker from '../../shared/AssetPicker'
import BibNameEraser from './BibNameEraser'
import type {BibErasure} from './bibErasure'
import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Check,ImagePlus,X} from 'lucide-react'
import type {BibRecord} from '../../domain/records'
import {readImageSize} from '../../shared/readImageSize'
import {MAX_IMAGE_PIXELS} from '../../domain/imageRules'
import type {RecordPanelProps} from '../../library/types'
import {useBlobUrl} from '../../shared/useBlobUrl'
import {bibLayout,fullQuad} from './bibGeometry'
import type {Quad} from './bibGeometry'
import {processBibImage} from './processBibImage'
import BibImageAdjustment from './BibImageAdjustment'

export default function BibEditor(props:RecordPanelProps&{record?:BibRecord}){
 const {record}=props
 const [draft,setDraft]=useState<BibRecord>(()=>record||{id:crypto.randomUUID(),kind:'bib',source:'upload',name:'',note:'',number:'',image:new Blob(),originalImage:new Blob(),width:315,height:231,originalWidth:315,originalHeight:231})
 const [width,setWidth]=useState(props.item?.w||315),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adjusting,setAdjusting]=useState(false),[saving,setSaving]=useState(false),[erasing,setErasing]=useState(false)
 const pending=useRef<AbortController|null>(null),mounted=useRef(true)
 const url=useBlobUrl(draft.image.size?draft.image:undefined)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pending.current?.abort()}},[])
 const patch=(change:Partial<BibRecord>)=>setDraft(d=>({...d,...change}))
 const run=async(action:(signal:AbortSignal)=>Promise<void>)=>{
  pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);setError('')
  try{await action(controller.signal)}catch(e){if(!controller.signal.aborted&&mounted.current)setError(e instanceof Error?e.message:'图片处理失败')}
  finally{if(mounted.current&&pending.current===controller)setBusy(false)}
 }
 const upload=(file?:File)=>{if(!file)return;void run(async signal=>{
  const {width:w,height:h}=await readImageSize(file,MAX_IMAGE_PIXELS);signal.throwIfAborted()
  if(w<16||h<16||w/h>10||h/w>10)throw new Error('图片需在 2500 万像素以内，长宽比不超过 10:1')
  patch({image:file,originalImage:file,width:w,height:h,originalWidth:w,originalHeight:h,quad:undefined,processing:undefined,erasures:undefined,...(!draft.name?{name:file.name.replace(/\.[^.]+$/,'').slice(0,200)}:{})});setAdjusting(false)
 })}
 const apply=(quad:Quad,mode:'crop'|'perspective')=>void run(async signal=>{const result=await processBibImage(draft.originalImage,quad,signal,draft.erasures);if(result.width/result.height>10||result.height/result.width>10)throw new Error('选区长宽比不能超过 10:1');patch({...result,quad,processing:mode});setAdjusting(false)})
 const erase=(erasures:BibErasure[])=>void run(async signal=>{
  const result=!erasures.length&&!draft.quad?{image:draft.originalImage,width:draft.originalWidth,height:draft.originalHeight}:await processBibImage(draft.originalImage,draft.quad||fullQuad(),signal,erasures)
  patch({...result,erasures:erasures.length?erasures:undefined});setErasing(false)
 })
 const layout=bibLayout(draft.width,draft.height,width)
 const save=async()=>{
  if(busy||saving)return
  if(!draft.image.size){setError('请先上传号码布图片');return}
  setSaving(true);setError('')
  try{await props.onSave({...draft,name:draft.name.trim()||'我的号码布'},!record,!record||props.item?.kind==='bib'?layout:undefined);if(mounted.current)props.onClose()}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'保存失败')}
  finally{if(mounted.current)setSaving(false)}
 }
 return <>
  <div className="record-heading">{props.mode.origin!=='canvas'&&<button type="button" disabled={saving||busy} onClick={()=>props.onBack?props.onBack():props.onMode({mode:'library'})} aria-label="返回收藏库"><ArrowLeft size={19}/></button>}<div><h2>{record?'编辑':'添加'}号码布</h2></div><button type="button" onClick={props.onClose} aria-label="关闭详情"><X size={20}/></button></div>
    <div className="record-scroll">
  {!record&&props.onBibTemplate&&<div className="bib-source-tabs" role="group" aria-label="号码布来源"><button type="button" disabled={busy||saving} onClick={props.onBibTemplate}>模板制作</button><button type="button" aria-pressed="true">上传图片</button></div>}
  {erasing?<BibNameEraser record={draft} busy={busy} onApply={erase} onCancel={()=>{pending.current?.abort();setBusy(false);setErasing(false)}}/>:adjusting?<BibImageAdjustment record={draft} busy={busy} onApply={apply} onCancel={()=>{pending.current?.abort();setBusy(false);setAdjusting(false)}}/>:<AssetPicker hasAsset={!!draft.image.size} label={busy?'正在处理图片…':draft.image.size?'更换号码布图片':'选择号码布图片'} inputLabel="号码布图片" accept="image/png,image/jpeg,image/webp" disabled={busy||saving||adjusting||erasing} onFiles={files=>upload(files[0])}><div className="record-preview bib-image-preview">{url?<img src={url} alt="号码布预览"/>:<div className="upload-placeholder"><ImagePlus size={42}/><span>上传电子号码布或实物照片</span></div>}</div></AssetPicker>}
  <form onSubmit={e=>{e.preventDefault();void save()}}>

   {!!draft.image.size&&!adjusting&&!erasing&&<div className="record-actions"><button type="button" disabled={busy||saving} onClick={()=>setAdjusting(true)}>裁切 / 四角校正</button><button type="button" disabled={busy||saving} onClick={()=>setErasing(true)}>姓名抹除</button><button type="button" disabled={busy||saving||(!draft.quad&&!draft.erasures?.length)} onClick={()=>patch({image:draft.originalImage,width:draft.originalWidth,height:draft.originalHeight,quad:undefined,processing:undefined,erasures:undefined})}>恢复原图</button></div>}
   <label className="field-label">赛事名称<input maxLength={200} value={draft.name} disabled={busy||saving} onChange={e=>patch({name:e.target.value})} placeholder="可选，用于收藏库展示"/></label>
   {(!record||props.item?.kind==='bib')&&<label className="field-label">展示尺寸 · {Math.round(layout.w)} × {Math.round(layout.h)}<input type="range" aria-label="号码布展示尺寸" min="120" max="700" step="10" value={width} disabled={busy||saving} onChange={e=>setWidth(Number(e.target.value))}/></label>}
   {error&&<p className="record-error" role="alert">{error}</p>}
   {props.styles}
   <button type="submit" className="primary-button full-width" disabled={busy||saving||adjusting||erasing}><Check size={17}/>{saving?'正在保存…':record?'保存修改':'保存并放上画布'}</button>
  </form>
    </div>
 </>
}
