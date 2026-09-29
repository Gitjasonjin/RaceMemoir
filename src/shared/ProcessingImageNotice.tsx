import {t as tr} from '../i18n/runtime.ts'
import {useEffect,useState} from 'react'
import {processingImageSize} from '../domain/imageRules'
import {readImageSize} from './readImageSize'

export default function ProcessingImageNotice({image}:{image?:Blob}){
  const [info,setInfo]=useState<{image:Blob;width:number;height:number}|null>(null)
  useEffect(()=>{
    let active=true
    if(image?.size)void readImageSize(image).then(size=>{if(active)setInfo({image,...size})}).catch(()=>{})
    return()=>{active=false}
  },[image])
  if(!info||info.image!==image)return null
  const size=processingImageSize(info.width,info.height)
  if(size.scale===1)return null
  return <p className="record-notice" role="status">{tr("ProcessingImageNotice.001",{v1:info.width,v2:info.height,v3:size.width,v4:size.height,v5:Math.round(size.scale*100)})}</p>
}
