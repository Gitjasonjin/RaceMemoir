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
  return <p className="record-notice" role="status">原图 {info.width} × {info.height} 已保留；处理副本 {size.width} × {size.height}（宽高约 {Math.round(size.scale*100)}%）。</p>
}
