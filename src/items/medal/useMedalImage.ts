import { useEffect,useState } from 'react'
import { medalBounds,restoreMedalPixels } from './medalPixels'
import { useBlobUrl } from '../../shared/useBlobUrl'
import type {MedalCrop} from './medalCrop'

const cache=new WeakMap<Blob,WeakMap<Blob,Map<string,Promise<{blob:Blob;aspect:number}>>>>()
async function prepare(original:Blob,image:Blob,crop?:MedalCrop){
  const source=await createImageBitmap(original)
  let mask:ImageBitmap|undefined
  try{
    mask=await createImageBitmap(image)
    const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(mask,0,0,canvas.width,canvas.height)
    const alpha=ctx.getImageData(0,0,canvas.width,canvas.height)
    const result=new ImageData(restoreMedalPixels(pixels,alpha),canvas.width,canvas.height)
    const x=crop?Math.min(source.width-1,Math.floor(crop.x*source.width)):0
    const y=crop?Math.min(source.height-1,Math.floor(crop.y*source.height)):0
    const bounds=crop?{x,y,width:Math.max(1,Math.min(source.width,Math.ceil((crop.x+crop.width)*source.width))-x),height:Math.max(1,Math.min(source.height,Math.ceil((crop.y+crop.height)*source.height))-y)}:medalBounds(result)
    canvas.width=bounds.width;canvas.height=bounds.height
    ctx.putImageData(result,-bounds.x,-bounds.y)
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('无法生成奖牌预览')),'image/png'))
    return {blob,aspect:bounds.width/bounds.height}
  }finally{source.close();mask?.close()}
}
export function useMedalImage(original?:Blob,image?:Blob,crop?:MedalCrop){
  const key=crop?`${crop.x},${crop.y},${crop.width},${crop.height}`:'auto'
  const [prepared,setPrepared]=useState<{source:Blob;original:Blob;key:string;blob:Blob;aspect:number}|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    let active=true;setError('')
    if(!image)return
    const source=original||image
    let images=cache.get(source);if(!images){images=new WeakMap();cache.set(source,images)}
    let variants=images.get(image);if(!variants){variants=new Map();images.set(image,variants)}
    let task=variants.get(key)
    if(!task){task=prepare(source,image,crop);variants.set(key,task);void task.catch(()=>variants!.delete(key))}
    void task.then(result=>{if(active)setPrepared({...result,source:image,original:source,key})}).catch(()=>{if(active)setError('奖牌图片无法读取，请重新选择图片')})
    return()=>{active=false}
  },[original,image,key])
  const current=prepared?.source===image&&prepared?.original===(original||image)&&prepared?.key===key?prepared:null
  return {url:useBlobUrl(current?.blob||image),aspect:current?.aspect,ready:!!current,error}
}
