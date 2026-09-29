import {t as tr} from '../i18n/runtime.ts'
import {useEffect,useId,useMemo,useState} from 'react'
import type {ReactElement} from 'react'
import {PreviewCard} from '@base-ui/react/preview-card'
import type {CollectionRecord} from '../domain/records'
import {createMemory} from '../domain/model'
import {useBlobUrl} from '../shared/useBlobUrl'
import Artwork from '../items/Artwork'
import RouteArtwork from '../items/route/RouteArtwork'
import './recordPreview.css'

function PreviewImage({image,name}:{image:Blob;name:string}){
  const url=useBlobUrl(image),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false)
  return <>{!loaded&&!failed&&<span className="record-preview-message" role="status">{tr("StickerEditor.014")}</span>}{failed?<span className="record-preview-message">{tr("RecordHoverPreview.005")}</span>:url&&<img src={url} alt={name} draggable={false} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>}</>
}

function PreviewContent({record}:{record:CollectionRecord}){
  const image=record.kind==='photo'||record.kind==='bib'?record.image:record.kind==='medal'?record.image??record.originalImage:record.kind==='sticker'?record.imageMode==='cutout'?record.image:record.originalImage:undefined
  const demo=useMemo(()=>createMemory('medal',record.name,record.kind==='medal'?record.variant??'bronze':'bronze','',''),[record])
  const date='date' in record?record.date:undefined
  return <>
    <div className={`record-hover-media ${record.kind==='route'?'record-hover-route':''}`}>
      {image?<PreviewImage image={image} name={record.name}/>:record.kind==='route'?record.trackPoints.length?<RouteArtwork record={record} compact/>:<span className="record-preview-message">{tr("RecordHoverPreview.004")}</span>:record.kind==='medal'&&record.source==='demo'?<div className="record-hover-medal"><Artwork item={demo} record={record}/></div>:<span className="record-preview-message">{tr("RecordHoverPreview.003")}</span>}
    </div>
    <div className="record-hover-caption"><strong>{record.name}</strong>{date&&<span>{date}</span>}{record.kind==='bib'&&record.number&&<span>{tr("RecordHoverPreview.002",{v1:record.number})}</span>}{record.note&&<p>{record.note}</p>}</div>
  </>
}

/** The portal escapes the scrolling sidebar; artwork only mounts while its preview is open. */
export default function RecordHoverPreview({record,disabled,children}:{record:CollectionRecord;disabled:boolean;children:ReactElement}){
  const [open,setOpen]=useState(false),id=useId()
  useEffect(()=>{if(disabled)setOpen(false)},[disabled])
  useEffect(()=>{
    if(!open)return
    const close=()=>setOpen(false)
    document.addEventListener('scroll',close,true)
    return()=>document.removeEventListener('scroll',close,true)
  },[open])
  if(disabled)return children
  return <PreviewCard.Root open={open} triggerId={open?id:null} onOpenChange={setOpen}>
    <PreviewCard.Trigger id={id} render={children} delay={350} closeDelay={120} onClick={()=>setOpen(false)}/>
    <PreviewCard.Portal><PreviewCard.Positioner side="left" align="center" sideOffset={12} collisionPadding={12} positionMethod="fixed" className="record-preview-positioner">
      <PreviewCard.Popup className="record-hover-preview" role="tooltip" aria-label={tr("RecordHoverPreview.001",{v1:record.name})} data-ui-overlay onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false)}}}>
        {open&&<PreviewContent record={record}/>}
      </PreviewCard.Popup>
    </PreviewCard.Positioner></PreviewCard.Portal>
  </PreviewCard.Root>
}
