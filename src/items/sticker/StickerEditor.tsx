import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Check,X} from 'lucide-react'
import type {StickerRecord} from '../../domain/records'
import type {StickerStyle} from '../../domain/model'
import type {RecordPanelProps} from '../../library/types'
import {readImageSize} from '../../shared/readImageSize'
import {validImageBlob} from '../../domain/imageRules'
import {useBackgroundRemoval} from '../../shared/useBackgroundRemoval'
import {inspectSticker,prepareSticker,stickerSource} from './stickerImage'
import {stickerSize} from './stickerGeometry'
import StickerArtwork from './StickerArtwork'
import RibbonRepair from '../medal/RibbonRepair'

export default function StickerEditor(props:RecordPanelProps&{record?:StickerRecord}){
  const {record}=props
  const [draft,setDraft]=useState<StickerRecord>(()=>record??{id:crypto.randomUUID(),kind:'sticker',name:'',note:'',source:'upload',originalImage:new Blob(),imageMode:'original',width:1,height:1})
  const [border,setBorder]=useState(props.item?.stickerBorder??2),[size,setSize]=useState(props.item?Math.max(props.item.w,props.item.h):240)
  const [style,setStyle]=useState<StickerStyle>(props.item?.stickerStyle??'contour')
  const [repairing,setRepairing]=useState(false)
  const [error,setError]=useState(''),[reading,setReading]=useState(false),[saving,setSaving]=useState(false),[accepted,setAccepted]=useState(!!record)
  const cutout=useBackgroundRemoval('sticker'),token=useRef(0),mounted=useRef(true)
  const busy=reading||saving||!!cutout.progress||repairing
  const preview=stickerSize(draft.width,draft.height,border,size,style),previewScale=Math.min(.8,260/preview.w,230/preview.h)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;token.current++}},[])
  const cancel=()=>{token.current++;cutout.cancel();setReading(false)}
  const process=(base:StickerRecord)=>{
    cancel();const run=token.current;setError('');setAccepted(false)
    cutout.run(base.originalImage,image=>{
      setReading(true)
      void (async()=>{
        if(!validImageBlob(image))throw new Error('抠图结果超过 20 MB，请使用较小的图片')
        const bounds=await inspectSticker(image)
        if(!mounted.current||token.current!==run)return
        setDraft(current=>({...base,name:current.name,image,imageMode:'cutout',width:bounds.width,height:bounds.height}));setAccepted(true)
      })().catch(e=>{if(mounted.current&&token.current===run)setError(e instanceof Error?e.message:'无法读取抠图结果')}).finally(()=>{if(mounted.current&&token.current===run)setReading(false)})
    },message=>{if(mounted.current&&token.current===run)setError(message)})
  }
  const upload=async(file?:File)=>{
    if(!file)return
    cancel();const run=token.current;setReading(true);setError('');setAccepted(false)
    try{
      await readImageSize(file);const bounds=await inspectSticker(file)
      if(!mounted.current||run!==token.current)return
      const next={...draft,originalImage:file,image:undefined,imageMode:'original' as const,width:bounds.width,height:bounds.height,name:draft.name||file.name.replace(/\.[^.]+$/,'').trim().slice(0,200)||'未命名贴纸'}
      setDraft(next);setReading(false)
      if(bounds.transparent)setAccepted(true);else process(next)
    }catch(e){if(mounted.current&&run===token.current){setError(e instanceof Error?e.message:'无法读取图片');setReading(false)}}
  }
  const mode=async(imageMode:'original'|'cutout')=>{
    cancel();const run=token.current;setError('');setReading(true);setAccepted(false)
    try{
      const image=imageMode==='original'?draft.originalImage:draft.image
      if(!image)throw new Error('请先完成自动抠图')
      const bounds=await inspectSticker(image)
      if(mounted.current&&run===token.current){setDraft(d=>({...d,imageMode,width:bounds.width,height:bounds.height}));setAccepted(true)}
    }catch(e){if(mounted.current&&run===token.current)setError(e instanceof Error?e.message:'图片不可用')}
    finally{if(mounted.current&&run===token.current)setReading(false)}
  }
  const save=async()=>{
    if(busy||!accepted)return
    if(!draft.name.trim()){setError('请填写贴纸名称');return}
    setSaving(true);setError('')
    try{
      await prepareSticker(stickerSource(draft),border,style)
      await props.onSave({...draft,name:draft.name.trim()},!record,{...stickerSize(draft.width,draft.height,border,size,style),stickerBorder:border,stickerStyle:style})
      if(mounted.current)props.onClose()
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'保存失败，请重试')}
    finally{if(mounted.current)setSaving(false)}
  }
  return <>
    <div className="record-heading"><button type="button" disabled={saving} aria-label={props.backLabel??'返回收藏库'} onClick={()=>{cancel();if(props.onBack)props.onBack();else props.onMode({mode:'library'})}}><ArrowLeft size={18}/></button><div><h2>{record?'编辑贴纸':'添加贴纸'}</h2></div><button type="button" disabled={saving} aria-label="关闭贴纸编辑" onClick={()=>{cancel();props.onClose()}}><X size={20}/></button></div>
    <div className="record-scroll">
      {repairing?<RibbonRepair subject="sticker" original={draft.originalImage} image={stickerSource(draft)} onClose={()=>setRepairing(false)} onApply={async image=>{
        const run=token.current
        const bounds=await inspectSticker(image)
        if(!mounted.current||run!==token.current)return
        setDraft(d=>({...d,image,imageMode:'cutout',width:bounds.width,height:bounds.height}))
        setAccepted(true);setError('');setRepairing(false)
      }}/>:<>
      <div className="sticker-preview">{draft.originalImage.size?<div style={{width:preview.w*previewScale,height:preview.h*previewScale}}><StickerArtwork record={draft} border={border} style={style}/></div>:<span className="sticker-preview-empty">上传图片，制作你的贴纸</span>}</div>
      <fieldset className="sticker-style-options"><legend>贴纸风格</legend><div>{([{id:'contour',label:'轮廓贴纸',detail:'沿主体留白'},{id:'torn',label:'撕纸拼贴',detail:'不规则纤维毛边'},{id:'sketch',label:'手绘描边',detail:'随手勾勒的线条'},{id:'washi',label:'和纸贴纸',detail:'半透纸感 · 细纤维'}] as const).map(option=><button type="button" key={option.id} aria-pressed={style===option.id} aria-label={option.label} disabled={busy} onClick={()=>setStyle(option.id)}><span className={`sticker-style-sample sticker-style-${option.id}`} aria-hidden="true"><i/></span><strong>{option.label}</strong><small>{option.detail}</small>{style===option.id&&<Check size={14}/>}</button>)}</div></fieldset>
      <label className="record-upload">{draft.originalImage.size?'更换贴纸图片':'选择贴纸图片'}<input type="file" aria-label="贴纸图片" disabled={saving} accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void upload(file)}}/></label>
      {cutout.progress&&<p className="record-progress" role="status">{cutout.progress}</p>}
      {reading&&<p className="record-progress" role="status">正在读取图片…</p>}
      {!!draft.originalImage.size&&<><div className="sticker-modes" role="group" aria-label="贴纸图片模式"><button type="button" disabled={saving} aria-pressed={draft.imageMode==='original'} onClick={()=>void mode('original')}>使用原图</button><button type="button" disabled={saving||!draft.image} aria-pressed={draft.imageMode==='cutout'} onClick={()=>void mode('cutout')}>使用抠图</button></div><div className="record-actions"><button type="button" disabled={saving} onClick={()=>process(draft)}>重新抠图</button></div></>}
      <label className="field-label">名称<input aria-label="贴纸名称" value={draft.name} maxLength={200} disabled={saving} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label>
      {!!draft.originalImage.size&&<div className="record-actions"><button type="button" disabled={busy} onClick={()=>{cancel();setError('');setRepairing(true)}}>手动调整抠图</button></div>}
      <label className="field-label">{style==='torn'?'撕边宽度':'白边粗细'} · {border}%<input aria-label={style==='torn'?'贴纸撕边宽度':'贴纸白边粗细'} type="range" min={0} max={5} step={.5} value={border} disabled={busy} onChange={e=>setBorder(Number(e.target.value))}/></label>
      <label className="field-label">大小 · {Math.round(size)}<input aria-label="贴纸大小" type="range" min={80} max={800} step={10} value={size} disabled={busy} onChange={e=>setSize(Number(e.target.value))}/></label>
      {error&&<p className="record-error" role="alert">{error}</p>}
      <button type="button" className="primary-button full-width" disabled={busy||!accepted} onClick={()=>void save()}><Check size={17}/>{saving?'正在保存…':record?'保存修改':'保存并放上画布'}</button>
      </>}
    </div>
  </>
}
