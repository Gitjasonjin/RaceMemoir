import {useNotice} from '../i18n/useNotice'
import {errorNotice,msg,AppError} from '../i18n/runtime.ts'
import {t as tr} from '../i18n/runtime.ts'
import AssetPicker from '../shared/AssetPicker'
import DatePicker from '../shared/ui/DatePicker'
import PhotoCropPreview from '../items/photo/PhotoCropPreview'
import PhotoComposition from '../items/photo/PhotoComposition'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Check, ImagePlus, Medal, Route, X } from 'lucide-react'
import Artwork from '../items/Artwork'
import RouteArtwork from '../items/route/RouteArtwork'
import { createMemory } from '../domain/model'
import type { Memory } from '../domain/model'
import MedalSizing from '../items/medal/MedalSizing'
import {MedalContent} from '../items/medal/MedalArtwork'
import { useMedalImage } from '../items/medal/useMedalImage'
import {readImageSize} from '../shared/readImageSize'
import ProcessingImageNotice from '../shared/ProcessingImageNotice'
import MedalScaleControl from '../items/medal/MedalScaleControl'
import type { CollectionRecord as AnyRecord, MedalRecord, RouteRecord } from '../domain/records'
import { parseGpx } from '../items/route/gpx'
import {gpxLocation,locationAfterGpxImport} from '../items/route/routeLocation'
import { useBlobUrl } from '../shared/useBlobUrl'
import { useCutout } from '../items/medal/useCutout'
import RibbonRepair from '../items/medal/RibbonRepair.tsx'
import MedalCropEditor from '../items/medal/MedalCropEditor'

type CollectionRecord=Exclude<AnyRecord,{kind:'bib'|'sticker'}>

import type {RecordPanelProps} from './types'
import RaceLocationEditor from '../race-map/RaceLocationEditor'
import {normalizeRaceLocation,validRaceLocation} from '../domain/raceLocation'

export default function RecordEditor(props: RecordPanelProps & { record?: CollectionRecord }) {
  const {record} = props
  const [photoLayout,setPhotoLayout]=useState(()=>createMemory('photo','','polaroid','',''))
  const [medalLayout,setMedalLayout]=useState(()=>createMemory('medal','','bronze','',''))
  const medalItem=props.item?.kind==='medal'?props.item:medalLayout
  const changeMedal=(change:Partial<Memory>)=>{if(props.item?.kind==='medal'&&props.onLayout)props.onLayout(change);else setMedalLayout(i=>({...i,...change}))}
  const photoItem=props.item?.kind==='photo'?props.item:photoLayout
  const changePhoto=(change:Partial<Memory>)=>{if(props.item?.kind==='photo'&&props.onLayout)props.onLayout(change);else setPhotoLayout(i=>({...i,...change}))}
  const [draft, setDraft] = useState<CollectionRecord>(() => record || (props.mode.mode==='photo'
    ? {id:crypto.randomUUID(),kind:'photo',name:'',note:'',source:'upload',image:new Blob()} : props.mode.mode==='medal'
    ? {id:crypto.randomUUID(),kind:'medal',name:'',date:'',note:'',source:'upload',cutout:'original'}
    : {id:crypto.randomUUID(),kind:'route',name:'',note:'',source:'upload',trackPoints:[]}))
  const [error, setError]=useNotice(''), [notice, setNotice]=useNotice(''), [saving, setSaving] = useState(false), [reading, setReading] = useState(false)
  const pending = useRef(0), mounted = useRef(true)
  useEffect(() => { mounted.current=true;return () => {mounted.current=false;pending.current++} }, [])
  const cutout = useCutout()
  const photoImage=useBlobUrl(draft.kind==='photo'&&draft.image.size?draft.image:undefined)
  const {url:medalImage,aspect} = useMedalImage(draft.kind==='medal'?draft.originalImage:undefined,draft.kind==='medal'?draft.image:undefined,draft.kind==='medal'?draft.crop:undefined)
  const image=draft.kind==='photo'?photoImage:medalImage
  const original = useBlobUrl(draft.kind==='medal'?draft.originalImage:undefined)
  const [showOriginal, setShowOriginal] = useState(false)
  const preview=useRef<HTMLDivElement>(null)
  const [repairing, setRepairing] = useState(false)
  const [cropping,setCropping]=useState(false)
  const busy = saving || reading || !!cutout.progress || repairing || cropping
  const patch = (fields: Partial<CollectionRecord>) => setDraft(d => ({...d,...fields} as CollectionRecord))
  const processImage = (blob: Blob) => {
    setNotice(''); setShowOriginal(false);setRepairing(false)
    patch({image:blob,cutout:'original'})
    cutout.run(blob, result => {
      patch({image:result,cutout:'done'});setNotice(msg("RecordEditor.045"))
      requestAnimationFrame(()=>preview.current?.closest('.asset-picker')?.scrollIntoView({block:'start',behavior:'smooth'}))
    }, setNotice)
  }
  const upload = async (file?: File) => {
    if(!file)return
    const token=++pending.current; cutout.cancel();setError('');setNotice('');setReading(true)
    try {
      if(draft.kind!=='route') {
        await readImageSize(file)
        if(token!==pending.current)return
        if(draft.kind==='photo'){patch({image:file,...(!draft.name?{name:file.name.replace(/\.[^.]+$/,'').slice(0,200)}:{})});return}
        patch({originalImage:file,image:file,crop:undefined,cutout:'original',source:'upload',...(!draft.name?{name:file.name.replace(/\.[^.]+$/,'').slice(0,200)}:{})})
        processImage(file)
      } else {
        if(!file.name.toLowerCase().endsWith('.gpx')||file.size>15*1024*1024)throw new AppError("RecordEditor.044")
        const text=await file.text(), parsed=parseGpx(text)
        if(token!==pending.current)return
        setDraft(current=>{
          if(current.kind!=='route')return current
          const name=!current.name||current.source==='demo'?parsed.name:current.name
          return {...current,name,trackPoints:parsed.points,gpx:new Blob([text],{type:'application/gpx+xml'}),source:'upload',location:locationAfterGpxImport(current.location,parsed.points,name)}
        })
      }
    } catch(e) { if(token===pending.current)setError(errorNotice(e,msg("RecordEditor.043"))) }
    finally {if(token===pending.current)setReading(false)}
  }
  const save = async (event?: FormEvent) => {
    event?.preventDefault(); if(busy)return
    if(!draft.name.trim()){setError(msg("RecordEditor.042"));return}
    if(draft.kind!=='photo'&&draft.location&&!validRaceLocation(draft.location)){setError(msg("raceLocation.001"));return}
    if(draft.source==='upload'&&(draft.kind!=='route'?!draft.image?.size:draft.trackPoints.length<2)){setError(draft.kind!=='route'?msg("RecordEditor.041"):msg("RecordEditor.040"));return}
    setSaving(true);setError('')
    try {await props.onSave({...draft,name:draft.name.trim(),...(draft.kind!=='photo'&&draft.location?{location:normalizeRaceLocation(draft.location)}:{})},!record,draft.kind==='photo'?{w:photoItem.w,h:photoItem.h,variant:photoItem.variant,photoPaper:photoItem.photoPaper,photoZoom:photoItem.photoZoom,photoX:photoItem.photoX,photoY:photoItem.photoY}:draft.kind==='medal'?{w:medalItem.w,h:medalItem.h,medalScale:medalItem.medalScale,medalFrame:medalItem.medalFrame,shadowDepth:medalItem.shadowDepth}:undefined);if(mounted.current)props.onClose()}
    catch(e){if(mounted.current)setError(errorNotice(e,msg("StickerEditor.029")))}
    finally{if(mounted.current)setSaving(false)}
  }
  const kindLabel=draft.kind==='medal'?tr("App.024"):draft.kind==='photo'?tr("App.025"):tr("LibraryRecords.019")
  const demoItem=createMemory(draft.kind==='medal'?'medal':'map',draft.name,draft.kind==='medal'?(draft.variant||'bronze'):'blue','','')
  return <>
    <div className="record-heading">{props.mode.origin!=='canvas'&&<button disabled={saving} onClick={() => props.onBack?props.onBack():props.onMode({mode:'library'})} aria-label={props.onBack?(props.mode.exhibitSlot!==undefined?tr("RecordEditor.039"):tr("ExhibitMedalPicker.009")):tr("BibEditor.024")}><ArrowLeft size={19}/></button>}<div><h2>{tr(record?'editor.editKind':'editor.addKind',{kind:kindLabel})}</h2></div><button onClick={props.onClose} aria-label={tr("BibEditor.020")}><X size={20}/></button></div>
    <div className="record-scroll">
    {!repairing&&!cropping&&<AssetPicker hasAsset={draft.kind==='route'?!!draft.trackPoints.length:draft.source==='demo'||!!draft.image?.size} label={reading?tr("RecordEditor.038"):draft.kind==='photo'&&!record&&!draft.image.size?tr("RecordEditor.037"):draft.kind==='route'?(draft.trackPoints.length?tr("RecordEditor.036"):tr("RecordEditor.035")):tr("RecordEditor.034",{v1:draft.image?.size||draft.source==='demo'?tr("RecordEditor.033"):tr("ToolPalette.005"),v2:kindLabel})} inputLabel={draft.kind==='route'?tr("RecordEditor.032"):tr("RecordEditor.031",{v1:kindLabel})} accept={draft.kind==='route'?'.gpx':'image/png,image/jpeg,image/webp'} multiple={draft.kind==='photo'&&!record} disabled={saving||reading||repairing||cropping} onFiles={files=>{if(draft.kind==='photo'&&!record&&files.length>1)props.onMode({mode:'photo-batch',files});else void upload(files[0])}}><div ref={preview} className={`record-preview ${draft.kind==='medal'?'medal-preview':''}`}>
      {draft.kind==='photo'&&image?<PhotoCropPreview key={image} item={photoItem} record={draft} onChange={!busy&&(!record||props.item?.kind==='photo')?changePhoto:undefined}/>:draft.kind!=='route' ? image ? <img src={showOriginal?original:image} alt={tr("RecordEditor.030",{v1:draft.name||kindLabel})}/> : draft.source==='demo'? <div className="demo-record-preview"><Artwork item={demoItem} record={draft}/></div>:<div className="upload-placeholder">{draft.kind==='photo'?<ImagePlus size={42}/>:<Medal size={42}/>}<span>{draft.kind==='photo'?tr("RecordEditor.029"):tr("RecordEditor.028")}</span></div>
        : draft.trackPoints.length ? <RouteArtwork record={draft as RouteRecord}/> : <div className="upload-placeholder"><Route size={42}/><span>{draft.source==='demo'?tr("RecordEditor.027"):tr("RecordEditor.026")}</span></div>}
    </div></AssetPicker>}
    {draft.kind==='photo'&&(!record||props.item?.kind==='photo')&&<PhotoComposition item={photoItem} onChange={changePhoto}/>}
    {draft.kind==='medal'&&(!record||props.item?.kind==='medal')&&!repairing&&!cropping&&<>
      <div className="medal-layout-preview"><div style={{width:medalItem.w,height:medalItem.h,transform:`scale(${Math.min(260/medalItem.w,300/medalItem.h)})`}}><>{props.exhibitMedal?<div className="frame-backing"><MedalContent item={medalItem} record={draft}/></div>:<Artwork item={medalItem} record={draft}/>}</></div></div>
      {props.exhibitMedal?<section className="medal-sizing"><h3>{tr("MedalScaleControl.001")}</h3><MedalScaleControl value={medalItem.medalScale} disabled={busy} label={tr("RecordEditor.025")} resetLabel={tr("RecordEditor.024")} onChange={medalScale=>changeMedal({medalScale})}/></section>:<MedalSizing item={medalItem} aspect={aspect} onChange={changeMedal}/>}
    </>}
    {cropping&&draft.kind==='medal'&&draft.image&&<MedalCropEditor original={draft.originalImage} image={draft.image} initial={draft.crop} onApply={crop=>{patch({crop});setCropping(false);setShowOriginal(false);setNotice(msg("RecordEditor.023",{v1:record?msg("BibEditor.002"):props.mode.exhibitSlot!==undefined?msg("RecordEditor.002"):msg("BibEditor.001")}))}} onClose={()=>setCropping(false)}/>}
    {draft.kind==='medal'&&draft.image&&!repairing&&!cropping&&<div className="record-actions"><button type="button" disabled={busy} onClick={()=>{setCropping(true);setNotice('')}}>{tr("RecordEditor.022")}</button>{draft.crop&&<button type="button" disabled={busy} onClick={()=>{patch({crop:undefined});setShowOriginal(false);setNotice(msg("RecordEditor.020"))}}>{tr("RecordEditor.021")}</button>}</div>}
    {repairing&&draft.kind==='medal'&&draft.originalImage&&draft.image&&<RibbonRepair original={draft.originalImage} image={draft.image} onApply={image=>{patch({image,cutout:'done'});setRepairing(false);setShowOriginal(false);setNotice(msg("RecordEditor.019",{v1:record?msg("BibEditor.002"):props.mode.exhibitSlot!==undefined?msg("RecordEditor.002"):msg("BibEditor.001")}))}} onClose={()=>setRepairing(false)}/>}
    <form onSubmit={e=>void save(e)}>
      {draft.kind==='medal'&&<ProcessingImageNotice image={draft.originalImage}/>}
      {cutout.progress&&<div className="record-progress" role="status"><span className="record-spinner"/>{cutout.progress}<button type="button" onClick={()=>{cutout.cancel();setNotice(msg("RecordEditor.017"))}}>{tr("RecordEditor.018")}</button></div>}
      {draft.kind==='medal'&&draft.originalImage&&!cutout.progress&&!repairing&&!cropping&&<div className="record-actions"><button type="button" disabled={busy} onClick={()=>processImage((draft as MedalRecord).originalImage!)}>{tr("RecordEditor.016")}</button>{draft.cutout==='done'&&<><button type="button" disabled={busy} onClick={()=>{setRepairing(true);setNotice('')}}>{tr("RecordEditor.015")}</button><button type="button" onClick={()=>setShowOriginal(!showOriginal)}>{showOriginal?tr("RecordEditor.014"):tr("RecordEditor.013")}</button><button type="button" disabled={saving} onClick={()=>{patch({image:draft.originalImage,cutout:'original'});setShowOriginal(false)}}>{tr("StickerEditor.012")}</button></>}</div>}
      <label className="field-label">{tr('editor.nameKind',{kind:kindLabel})}<input required maxLength={200} value={draft.name} disabled={saving} onChange={e=>{const name=e.target.value;patch({name,...(draft.kind==='route'&&draft.location?.source==='gpx'?{location:gpxLocation(draft.trackPoints,name)}:{})})}} placeholder={draft.kind==='medal'?tr("RecordEditor.012"):tr("RecordEditor.011")}/></label>
      {draft.kind==='photo'&&<DatePicker value={draft.date||''} disabled={saving} onChange={date=>patch({date})}/>}
      {draft.kind!=='photo'&&<label className="field-label">{tr("RecordEditor.010")}<textarea rows={3} maxLength={5000} value={draft.note} disabled={saving} onChange={e=>patch({note:e.target.value})} placeholder={tr("RecordEditor.009")}/></label>}
      {draft.kind==='route'&&<section className="route-location-settings">
        <p className="record-muted" aria-live="polite">{draft.location?.source==='gpx'?tr("RecordEditor.008"):draft.location?tr("RecordEditor.007"):draft.trackPoints.length?tr("RecordEditor.006"):tr("RecordEditor.005")}{draft.location&&<span> · {draft.location.name}</span>}</p>
        <details className="race-location-manual"><summary>{tr("RecordEditor.004")}</summary>
          <RaceLocationEditor value={draft.location} onChange={location=>patch({location:location?{...location,source:'manual'}:undefined})} disabled={busy}/>
          {draft.trackPoints.length>0&&draft.location?.source!=='gpx'&&<button className="race-location-pick" type="button" disabled={busy} onClick={()=>patch({location:gpxLocation(draft.trackPoints,draft.name)})}>{tr("RecordEditor.003")}</button>}
        </details>
      </section>}
      {error&&<p className="record-error" role="alert">{error}</p>}{notice&&<p className="record-notice" role="status">{notice}</p>}
      {props.styles}
      <button className="primary-button full-width" type="submit" disabled={busy}><Check size={17}/>{saving?tr("BibEditor.003"):record?tr("BibEditor.002"):props.mode.exhibitSlot!==undefined?tr("RecordEditor.002"):tr("BibEditor.001")}</button>
    </form>
    {record?.archived&&<div className="record-footer"><button type="button" disabled={busy} onClick={async()=>{setSaving(true);setError('');try{await props.onSave({...draft,archived:false},false);if(mounted.current)props.onClose()}catch(e){if(mounted.current){setError(errorNotice(e,msg("RecordEditor.001")));setSaving(false)}}}}>{tr("LibraryRecords.016")}</button></div>}
    </div>
  </>
}
