import {useEffect,useState} from 'react'
import type {StickerRecord} from '../../domain/records'
import {prepareSticker,stickerSource} from './stickerImage'

export default function StickerArtwork({record,border=2}:{record:StickerRecord;border?:number}){
  const source=stickerSource(record)
  const [result,setResult]=useState<{source:Blob;border:number;url?:string;error?:string}>()
  useEffect(()=>{
    let active=true,url=''
    void prepareSticker(source,border).then(({blob})=>{if(active){url=URL.createObjectURL(blob);setResult({source,border,url})}}).catch(()=>{if(active)setResult({source,border,error:'贴纸读取失败，请重新上传'})})
    return()=>{active=false;if(url)URL.revokeObjectURL(url)}
  },[source,border])
  const current=result?.source===source&&result.border===border?result:undefined
  return <div className="sticker-artwork" data-sticker-state={current?.error?'error':current?.url?'ready':'loading'}>{current?.error?<span role="alert">{current.error}</span>:current?.url?<img src={current.url} alt={record.name} draggable={false}/>:<span role="status">正在生成贴纸…</span>}</div>
}
