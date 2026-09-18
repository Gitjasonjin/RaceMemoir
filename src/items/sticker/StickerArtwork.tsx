import {useEffect,useState} from 'react'
import type {StickerRecord} from '../../domain/records'
import type {StickerStyle} from '../../domain/model'
import {prepareSticker,stickerSource} from './stickerImage'

export default function StickerArtwork({record,border=2,style='contour'}:{record:StickerRecord;border?:number;style?:StickerStyle}){
  const source=stickerSource(record)
  const [result,setResult]=useState<{source:Blob;border:number;style:StickerStyle;url?:string;error?:string}>()
  useEffect(()=>{
    let active=true,url=''
    void prepareSticker(source,border,style).then(({blob})=>{if(active){url=URL.createObjectURL(blob);setResult({source,border,style,url})}}).catch(()=>{if(active)setResult({source,border,style,error:'贴纸读取失败，请重新上传'})})
    return()=>{active=false;if(url)URL.revokeObjectURL(url)}
  },[source,border,style])
  const current=result?.source===source&&result.border===border&&result.style===style?result:undefined
  return <div className={`sticker-artwork sticker-${style}`} data-sticker-style={style} data-sticker-state={current?.error?'error':current?.url?'ready':'loading'}>{current?.error?<span role="alert">{current.error}</span>:current?.url?<img src={current.url} alt={record.name} draggable={false}/>:<span role="status">正在生成贴纸…</span>}</div>
}
