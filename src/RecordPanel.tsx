import PhotoCropPreview from './PhotoCropPreview'
import PhotoComposition from './PhotoComposition'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Archive, ArrowLeft, Check, ImagePlus, Medal, Plus, RotateCcw, Route, Trash2, X } from 'lucide-react'
import Artwork from './Artwork'
import RouteArtwork from './RouteArtwork'
import { createMemory } from './model'
import type { Memory } from './model'
import MedalSizing from './MedalSizing'
import { useMedalImage } from './useMedalImage'
import { IMAGE_TYPES } from './records'
import type { CollectionRecord, MedalRecord, RouteRecord } from './records'
import { parseGpx } from './gpx'
import { useBlobUrl } from './useBlobUrl'
import { useCutout } from './useCutout'
import RibbonRepair from './RibbonRepair.tsx'

export type RecordPanelMode = { mode: 'library' | 'medal' | 'photo' | 'route' | 'detail'; id?: string }
interface Props {
  styles?: ReactNode
  item?: Memory; onLayout?: (change: Partial<Memory>) => void
  mode: RecordPanelMode; records: CollectionRecord[]; references: (id: string) => number
  onMode: (mode: RecordPanelMode) => void; onClose: () => void
  onSave: (record: CollectionRecord, add: boolean, layout?: Partial<Memory>) => Promise<void>
  onAdd: (record: CollectionRecord) => void
  onDelete: (id: string) => Promise<void>
}

export default function RecordPanel(props: Props) {
  const [showHelp,setShowHelp]=useState(false)
  const record = props.records.find(r => r.id === props.mode.id)
  return <aside className={`record-panel ${showHelp?'show-editor-help':'hide-editor-help'}`} data-record-panel aria-label="收藏记录" onKeyDown={e => e.stopPropagation()}>
    <button className="editor-help-toggle" aria-expanded={showHelp} onClick={()=>setShowHelp(v=>!v)}>{showHelp?'隐藏说明':'使用说明'}</button>
    {props.mode.mode === 'library' ? <>
      <div className="record-heading"><div><small>YOUR TRAIL COLLECTION</small><h2>我的收藏库</h2></div><button onClick={props.onClose} aria-label="关闭收藏库"><X size={20}/></button></div>
      <p className="record-muted">保存一份记忆，随时放上画布。移除画布物件不会删除记录。</p>
      <div className="record-actions"><button onClick={() => props.onMode({mode:'medal'})}><Plus size={16}/>上传奖牌</button><button onClick={() => props.onMode({mode:'photo'})}><ImagePlus size={16}/>上传照片</button><button onClick={() => props.onMode({mode:'route'})}><Route size={16}/>导入 GPX</button></div>
      <LibraryRecords {...props}/>
    </> : props.mode.mode==='detail'&&!record ? <><div className="record-heading"><h2>记录暂不可用</h2><button onClick={props.onClose} aria-label="关闭详情"><X size={20}/></button></div><p>此物件关联的本地记录已丢失，可以导入完整备份恢复。</p><button onClick={() => props.onMode({mode:'library'})}>打开收藏库</button></> : <RecordEditor key={record?.id||props.mode.mode} {...props} record={record}/>}
  </aside>
}

function LibraryRecords(props:Props){
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
      return <div className="record-entry" key={r.id}><div className="record-row">
        <button type="button" className="record-row-main" title={r.name} disabled={busy} onClick={()=>props.onMode({mode:'detail',id:r.id})}>{r.kind==='medal'?<Medal size={24}/>:r.kind==='photo'?<ImagePlus size={24}/>:<Route size={24}/>}<span><strong>{r.name}</strong><small>{r.source==='demo'?'示例 · ':''}{r.kind==='medal'?'奖牌':r.kind==='photo'?'照片':'路线'} · 画布上 {references} 件</small></span></button>
        {recycle?<button type="button" disabled={busy} onClick={()=>void run(()=>props.onSave({...r,archived:false},false))} aria-label={`恢复 ${r.name}`} title="恢复收藏"><RotateCcw size={17}/></button>:<button type="button" disabled={busy} onClick={()=>props.onAdd(r)} aria-label={`将 ${r.name} 放上画布`} title="放上画布"><Plus size={18}/></button>}
        <button type="button" className="record-delete" disabled={busy||(recycle&&references>0)} aria-label={`${recycle?'彻底删除':'删除'} ${r.name}`} title={recycle?(references?'请先移除画布上使用此收藏的物件':'彻底删除原始文件'):'移入回收站，画布物件保留'} onClick={()=>{if(recycle){setConfirmId(r.id);setError('')}else void run(()=>props.onSave({...r,archived:true},false))}}><Trash2 size={17}/></button>
      </div>{recycle&&references>0&&<p className="record-delete-hint">先移除画布上的 {references} 件物件，才能彻底删除。</p>}
      {confirmId===r.id&&<div className="record-delete-confirm" role="group" aria-label={`确认删除 ${r.name}`}><p>彻底删除这份收藏及原始文件？此操作无法撤销。</p><button type="button" disabled={busy} className="record-delete" onClick={()=>void run(()=>props.onDelete(r.id))}>确认彻底删除</button><button type="button" disabled={busy} onClick={()=>setConfirmId(null)}>取消</button></div>}
      </div>
    })}{!visible.length&&<p className="record-empty">{filter!=='all'?'此类别暂无收藏':recycle?'回收站是空的':'还没有收藏，上传第一份记忆吧。'}</p>}</div>
  </>
}

function RecordEditor(props: Props & { record?: CollectionRecord }) {
  const {record} = props
  const [photoLayout,setPhotoLayout]=useState(()=>createMemory('photo','','polaroid','',''))
  const photoItem=props.item?.kind==='photo'?props.item:photoLayout
  const changePhoto=(change:Partial<Memory>)=>{if(props.item?.kind==='photo'&&props.onLayout)props.onLayout(change);else setPhotoLayout(i=>({...i,...change}))}
  const [draft, setDraft] = useState<CollectionRecord>(() => record || (props.mode.mode==='photo'
    ? {id:crypto.randomUUID(),kind:'photo',name:'',note:'',source:'upload',image:new Blob()} : props.mode.mode==='medal'
    ? {id:crypto.randomUUID(),kind:'medal',name:'',date:'',note:'',source:'upload',cutout:'original'}
    : {id:crypto.randomUUID(),kind:'route',name:'',note:'',source:'upload',trackPoints:[]}))
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [reading, setReading] = useState(false)
  const pending = useRef(0), mounted = useRef(true)
  useEffect(() => { mounted.current=true;return () => {mounted.current=false;pending.current++} }, [])
  const cutout = useCutout()
  const photoImage=useBlobUrl(draft.kind==='photo'&&draft.image.size?draft.image:undefined)
  const {url:medalImage,aspect} = useMedalImage(draft.kind==='medal'?draft.originalImage:undefined,draft.kind==='medal'?draft.image:undefined)
  const image=draft.kind==='photo'?photoImage:medalImage
  const original = useBlobUrl(draft.kind==='medal'?draft.originalImage:undefined)
  const [showOriginal, setShowOriginal] = useState(false)
  const preview=useRef<HTMLDivElement>(null)
  const [repairing, setRepairing] = useState(false)
  const busy = saving || reading || !!cutout.progress || repairing
  const patch = (fields: Partial<CollectionRecord>) => setDraft(d => ({...d,...fields} as CollectionRecord))
  const processImage = (blob: Blob) => {
    setNotice(''); setShowOriginal(false);setRepairing(false)
    patch({image:blob,cutout:'original'})
    cutout.run(blob, result => {
      patch({image:result,cutout:'done'});setNotice('自动抠图已完成，请检查奖牌和绶带，满意后保存。')
      requestAnimationFrame(()=>preview.current?.scrollIntoView({block:'start',behavior:'smooth'}))
    }, setNotice)
  }
  const upload = async (file?: File) => {
    if(!file)return
    const token=++pending.current; cutout.cancel();setError('');setNotice('');setReading(true)
    try {
      if(draft.kind!=='route') {
        if(!IMAGE_TYPES.includes(file.type)||file.size>20*1024*1024||!file.size)throw new Error('请选择不超过 20 MB 的 PNG、JPG 或 WebP 图片')
        const bitmap=await createImageBitmap(file)
        const width=bitmap.width,height=bitmap.height;bitmap.close()
        if(width*height>25_000_000)throw new Error('图片分辨率过大，请先缩小至 2500 万像素以内')
        if(token!==pending.current)return
        if(draft.kind==='photo'){patch({image:file,...(!draft.name?{name:file.name.replace(/\.[^.]+$/,'').slice(0,200)}:{})});return}
        patch({originalImage:file,image:file,cutout:'original',source:'upload',...(!draft.name?{name:file.name.replace(/\.[^.]+$/,'').slice(0,200)}:{})})
        processImage(file)
      } else {
        if(!file.name.toLowerCase().endsWith('.gpx')||file.size>15*1024*1024)throw new Error('请选择不超过 15 MB 的 GPX 文件')
        const text=await file.text(), parsed=parseGpx(text)
        if(token!==pending.current)return
        patch({trackPoints:parsed.points,gpx:new Blob([text],{type:'application/gpx+xml'}),source:'upload',...(!draft.name||draft.source==='demo'?{name:parsed.name}:{})})
      }
    } catch(e) { if(token===pending.current)setError(e instanceof Error?e.message:'文件读取失败，请重试') }
    finally {if(token===pending.current)setReading(false)}
  }
  const save = async (event?: FormEvent) => {
    event?.preventDefault(); if(busy)return
    if(!draft.name.trim()){setError('请填写收藏名称');return}
    if(draft.source==='upload'&&(draft.kind!=='route'?!draft.image?.size:draft.trackPoints.length<2)){setError(draft.kind!=='route'?'请先上传图片':'请先导入 GPX 文件');return}
    setSaving(true);setError('')
    try {await props.onSave({...draft,name:draft.name.trim()},!record,draft.kind==='photo'?{w:photoItem.w,h:photoItem.h,variant:photoItem.variant,photoZoom:photoItem.photoZoom,photoX:photoItem.photoX,photoY:photoItem.photoY}:undefined);if(mounted.current)props.onClose()}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'保存失败，请重试')}
    finally{if(mounted.current)setSaving(false)}
  }
  const kindLabel=draft.kind==='medal'?'奖牌':draft.kind==='photo'?'照片':'路线'
  const demoItem=createMemory(draft.kind==='medal'?'medal':'map',draft.name,draft.kind==='medal'?(draft.variant||'bronze'):'blue','','')
  return <>
    <div className="record-heading"><button disabled={saving} onClick={() => props.onMode({mode:'library'})} aria-label="返回收藏库"><ArrowLeft size={19}/></button><div><small>A MEMORY WORTH KEEPING</small><h2>{record?'编辑':'添加'}{kindLabel}</h2></div><button onClick={props.onClose} aria-label="关闭详情"><X size={20}/></button></div>
    {draft.source==='demo'&&<p className="record-notice editor-explanation">示例记录 · 上传{draft.kind==='medal'?'真实奖牌照片':'GPX'}后，画布上的关联物件会一同替换。</p>}
    {!repairing&&<div ref={preview} className={`record-preview ${draft.kind==='medal'?'medal-preview':''}`}>
      {draft.kind==='photo'&&image?<PhotoCropPreview key={image} item={photoItem} record={draft} onChange={!busy&&(!record||props.item?.kind==='photo')?changePhoto:undefined}/>:draft.kind!=='route' ? image ? <img src={showOriginal?original:image} alt={`${draft.name||kindLabel}预览`}/> : draft.source==='demo'? <div className="demo-record-preview"><Artwork item={demoItem} record={draft}/></div>:<div className="upload-placeholder">{draft.kind==='photo'?<ImagePlus size={42}/>:<Medal size={42}/>}<span>{draft.kind==='photo'?'上传照片，留下你的山野瞬间':'让这块奖牌，成为你的收藏'}</span></div>
        : draft.trackPoints.length ? <RouteArtwork record={draft as RouteRecord}/> : <div className="upload-placeholder"><Route size={42}/><span>{draft.source==='demo'?'示例路线 · 尚无真实轨迹':'导入走过的路'}</span></div>}
    </div>}
    {draft.kind==='photo'&&(!record||props.item?.kind==='photo')&&<PhotoComposition item={photoItem} onChange={changePhoto}/>}
    {draft.kind==='medal'&&props.item&&props.onLayout&&!repairing&&<>
      <div className="medal-layout-preview"><div style={{width:props.item.w,height:props.item.h,transform:`scale(${Math.min(260/props.item.w,300/props.item.h)})`}}><Artwork item={props.item} record={draft}/></div></div>
      <MedalSizing item={props.item} aspect={aspect} onChange={props.onLayout}/>
    </>}
    {repairing&&draft.kind==='medal'&&draft.originalImage&&draft.image&&<RibbonRepair original={draft.originalImage} image={draft.image} onApply={image=>{patch({image,cutout:'done'});setRepairing(false);setShowOriginal(false);setNotice(`绶带修复已应用，点击「${record?'保存修改':'保存并放上画布'}」保存到收藏记录。`)}} onClose={()=>setRepairing(false)}/>}
    <form onSubmit={e=>void save(e)}><p className="record-muted">名称、日期和上传文件需点击下方保存；已放上画布的构图调整会自动保存。</p>
      <label className="record-upload">{reading?'正在读取文件…':draft.kind!=='route'?`选择 / 更换${kindLabel}图片`:'选择 / 更换 GPX 文件'}<input type="file" disabled={saving||reading||repairing} accept={draft.kind!=='route'?'image/png,image/jpeg,image/webp':'.gpx'} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value=''}}/></label>
      <p className="record-muted">{draft.kind==='photo'?'PNG / JPG / WebP，最大 20 MB。保留原图并存入本机收藏库。':draft.kind==='medal'?'PNG / JPG / WebP，最大 20 MB。上传后自动抠取奖牌并补全绶带，首次需下载模型。':'最大 15 MB / 10 万轨迹点；按 GPX 计算里程与爬升，不加载地图底图。'}</p>
      {cutout.progress&&<div className="record-progress" role="status"><span className="record-spinner"/>{cutout.progress}<button type="button" onClick={()=>{cutout.cancel();setNotice('已取消抠图，使用原图。')}}>取消抠图</button></div>}
      {draft.kind==='medal'&&draft.originalImage&&!cutout.progress&&!repairing&&<div className="record-actions"><button type="button" disabled={busy} onClick={()=>processImage((draft as MedalRecord).originalImage!)}>自动抠图（含绶带）</button>{draft.cutout==='done'&&<><button type="button" disabled={busy} onClick={()=>{setRepairing(true);setNotice('')}}>手动微调</button><button type="button" onClick={()=>setShowOriginal(!showOriginal)}>{showOriginal?'查看抠图':'对比原图'}</button><button type="button" disabled={saving} onClick={()=>{patch({image:draft.originalImage,cutout:'original'});setShowOriginal(false)}}>使用原图</button></>}</div>}
      <label className="field-label">{kindLabel}名称<input required maxLength={200} value={draft.name} disabled={saving} onChange={e=>patch({name:e.target.value})} placeholder={draft.kind==='medal'?'我的第一场越野赛':'山野环线'}/></label>
      {draft.kind==='photo'&&<label className="field-label">拍摄日期<input type="date" value={draft.date||''} disabled={saving} onChange={e=>patch({date:e.target.value})}/></label>}
      <label className="field-label">备注<textarea rows={3} maxLength={5000} value={draft.note} disabled={saving} onChange={e=>patch({note:e.target.value})} placeholder="记下这段旅程的故事…"/></label>
      {error&&<p className="record-error" role="alert">{error}</p>}{notice&&<p className="record-notice" role="status">{notice}</p>}
      {props.styles}
      <button className="primary-button full-width" type="submit" disabled={busy}><Check size={17}/>{saving?'正在保存…':record?'保存修改':'保存并放上画布'}</button>
    </form>
    {record?.archived&&<div className="record-footer"><button type="button" disabled={busy} onClick={async()=>{setSaving(true);setError('');try{await props.onSave({...draft,archived:false},false);if(mounted.current)props.onClose()}catch(e){if(mounted.current){setError(e instanceof Error?e.message:'恢复失败');setSaving(false)}}}}>恢复收藏</button></div>}
  </>
}
