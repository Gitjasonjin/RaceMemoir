import {useNotice} from '../../i18n/useNotice'
import {errorNotice,msg,AppError} from '../../i18n/runtime.ts'
import {t as tr} from '../../i18n/runtime.ts'
import AssetPicker from '../../shared/AssetPicker'
import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,Check,X} from 'lucide-react'
import type {StickerRecord} from '../../domain/records'
import type {StickerStyle} from '../../domain/model'
import type {RecordPanelProps} from '../../library/types'
import {readImageSize} from '../../shared/readImageSize'
import ProcessingImageNotice from '../../shared/ProcessingImageNotice'
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
  const [error,setError]=useNotice(''),[reading,setReading]=useState(false),[saving,setSaving]=useState(false),[accepted,setAccepted]=useState(!!record)
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
        if(!validImageBlob(image))throw new AppError("StickerEditor.036")
        const bounds=await inspectSticker(image)
        if(!mounted.current||token.current!==run)return
        setDraft(current=>({...base,name:current.name,image,imageMode:'cutout',width:bounds.width,height:bounds.height}));setAccepted(true)
      })().catch(e=>{if(mounted.current&&token.current===run)setError(errorNotice(e,msg("StickerEditor.035")))}).finally(()=>{if(mounted.current&&token.current===run)setReading(false)})
    },message=>{if(mounted.current&&token.current===run)setError(message)})
  }
  const upload=async(file?:File)=>{
    if(!file)return
    cancel();const run=token.current;setReading(true);setError('');setAccepted(false)
    try{
      await readImageSize(file);const bounds=await inspectSticker(file)
      if(!mounted.current||run!==token.current)return
      const next={...draft,originalImage:file,image:undefined,imageMode:'original' as const,width:bounds.width,height:bounds.height,name:draft.name||file.name.replace(/\.[^.]+$/,'').trim().slice(0,200)||tr("StickerEditor.034")}
      setDraft(next);setReading(false)
      if(bounds.transparent)setAccepted(true);else process(next)
    }catch(e){if(mounted.current&&run===token.current){setError(errorNotice(e,msg("StickerEditor.033")));setReading(false)}}
  }
  const mode=async(imageMode:'original'|'cutout')=>{
    cancel();const run=token.current;setError('');setReading(true);setAccepted(false)
    try{
      const image=imageMode==='original'?draft.originalImage:draft.image
      if(!image)throw new AppError("StickerEditor.032")
      const bounds=await inspectSticker(image)
      if(mounted.current&&run===token.current){setDraft(d=>({...d,imageMode,width:bounds.width,height:bounds.height}));setAccepted(true)}
    }catch(e){if(mounted.current&&run===token.current)setError(errorNotice(e,msg("StickerEditor.031")))}
    finally{if(mounted.current&&run===token.current)setReading(false)}
  }
  const save=async()=>{
    if(busy||!accepted)return
    if(!draft.name.trim()){setError(msg("StickerEditor.030"));return}
    setSaving(true);setError('')
    try{
      await prepareSticker(stickerSource(draft),border,style)
      await props.onSave({...draft,name:draft.name.trim()},!record,{...stickerSize(draft.width,draft.height,border,size,style),stickerBorder:border,stickerStyle:style})
      if(mounted.current)props.onClose()
    }catch(e){if(mounted.current)setError(errorNotice(e,msg("StickerEditor.029")))}
    finally{if(mounted.current)setSaving(false)}
  }
  return <>
    <div className="record-heading">{props.mode.origin!=='canvas'&&<button type="button" disabled={saving} aria-label={tr("BibEditor.024")} onClick={()=>{cancel();if(props.onBack)props.onBack();else props.onMode({mode:'library'})}}><ArrowLeft size={18}/></button>}<div><h2>{record?tr("StickerEditor.028"):tr("ToolPalette.012")}</h2></div><button type="button" disabled={saving} aria-label={tr("StickerEditor.027")} onClick={()=>{cancel();props.onClose()}}><X size={20}/></button></div>
    <div className="record-scroll">
      {repairing?<RibbonRepair subject="sticker" original={draft.originalImage} image={stickerSource(draft)} onClose={()=>setRepairing(false)} onApply={async image=>{
        const run=token.current
        const bounds=await inspectSticker(image)
        if(!mounted.current||run!==token.current)return
        setDraft(d=>({...d,image,imageMode:'cutout',width:bounds.width,height:bounds.height}))
        setAccepted(true);setError('');setRepairing(false)
      }}/>:<>
      <AssetPicker hasAsset={!!draft.originalImage.size} label={draft.originalImage.size?tr("StickerEditor.026"):tr("StickerEditor.025")} inputLabel={tr("StickerEditor.024")} accept="image/png,image/jpeg,image/webp" disabled={saving} onFiles={files=>void upload(files[0])}><div className="sticker-preview">{draft.originalImage.size?<div style={{width:preview.w*previewScale,height:preview.h*previewScale}}><StickerArtwork record={draft} border={border} style={style}/></div>:<span className="sticker-preview-empty">{tr("StickerEditor.023")}</span>}</div></AssetPicker>
      <fieldset className="sticker-style-options"><legend>{tr("StickerEditor.022")}</legend><div>{([{id:'contour',label:tr("styleCatalog.025"),detail:tr("StickerEditor.021")},{id:'torn',label:tr("StickerEditor.020"),detail:tr("StickerEditor.019")},{id:'sketch',label:tr("StickerEditor.018"),detail:tr("StickerEditor.017")},{id:'washi',label:tr("StickerEditor.016"),detail:tr("StickerEditor.015")}] as const).map(option=><button type="button" key={option.id} aria-pressed={style===option.id} aria-label={option.label} disabled={busy} onClick={()=>setStyle(option.id)}><span className={`sticker-style-sample sticker-style-${option.id}`} aria-hidden="true"><i/></span><strong>{option.label}</strong><small>{option.detail}</small>{style===option.id&&<Check size={14}/>}</button>)}</div></fieldset>

      <ProcessingImageNotice image={draft.originalImage}/>
      {cutout.progress&&<p className="record-progress" role="status">{cutout.progress}</p>}
      {reading&&<p className="record-progress" role="status">{tr("StickerEditor.014")}</p>}
      {!!draft.originalImage.size&&<><div className="sticker-modes" role="group" aria-label={tr("StickerEditor.013")}><button type="button" disabled={saving} aria-pressed={draft.imageMode==='original'} onClick={()=>void mode('original')}>{tr("StickerEditor.012")}</button><button type="button" disabled={saving||!draft.image} aria-pressed={draft.imageMode==='cutout'} onClick={()=>void mode('cutout')}>{tr("StickerEditor.011")}</button></div><div className="record-actions"><button type="button" disabled={saving} onClick={()=>process(draft)}>{tr("StickerEditor.010")}</button></div></>}
      <label className="field-label">{tr("StickerEditor.009")}<input aria-label={tr("StickerEditor.008")} value={draft.name} maxLength={200} disabled={saving} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label>
      {!!draft.originalImage.size&&<div className="record-actions"><button type="button" disabled={busy} onClick={()=>{cancel();setError('');setRepairing(true)}}>{tr("StickerEditor.007")}</button></div>}
      <label className="field-label">{style==='torn'?tr("StickerEditor.006"):tr("StickerEditor.005")} · {border}%<input aria-label={style==='torn'?tr("StickerEditor.004"):tr("StickerEditor.003")} type="range" min={0} max={5} step={.5} value={border} disabled={busy} onChange={e=>setBorder(Number(e.target.value))}/></label>
      <label className="field-label">{tr("StickerEditor.002")}{Math.round(size)}<input aria-label={tr("StickerEditor.001")} type="range" min={80} max={800} step={10} value={size} disabled={busy} onChange={e=>setSize(Number(e.target.value))}/></label>
      {error&&<p className="record-error" role="alert">{error}</p>}
      <button type="button" className="primary-button full-width" disabled={busy||!accepted} onClick={()=>void save()}><Check size={17}/>{saving?tr("BibEditor.003"):record?tr("BibEditor.002"):tr("BibEditor.001")}</button>
      </>}
    </div>
  </>
}
