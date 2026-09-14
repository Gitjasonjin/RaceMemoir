import { useEffect,useState } from 'react'
import { medalBounds,restoreMedalPixels } from './medalPixels'
import { useBlobUrl } from './useBlobUrl'

const cache=new WeakMap<Blob,WeakMap<Blob,Promise<{blob:Blob;aspect:number}>>>()
async function prepare(original:Blob,image:Blob){
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
    const bounds=medalBounds(result)
    canvas.width=bounds.width;canvas.height=bounds.height
    ctx.putImageData(result,-bounds.x,-bounds.y)
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('无法生成奖牌预览')),'image/png'))
    return {blob,aspect:bounds.width/bounds.height}
  }finally{source.close();mask?.close()}
}
export function useMedalImage(original?:Blob,image?:Blob){
  const [prepared,setPrepared]=useState<{source:Blob;blob:Blob;aspect:number}|null>(null)
  useEffect(()=>{
    let active=true
    if(!image)return
    const source=original||image
    let images=cache.get(source);if(!images){images=new WeakMap();cache.set(source,images)}
    let task=images.get(image)
    if(!task){task=prepare(source,image);images.set(image,task);void task.catch(()=>images!.delete(image))}
    void task.then(result=>{if(active)setPrepared({...result,source:image})}).catch(()=>{})
    return()=>{active=false}
  },[original,image])
  const current=prepared?.source===image?prepared:null
  return {url:useBlobUrl(current?.blob||image),aspect:current?.aspect}
}
