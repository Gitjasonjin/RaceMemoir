import type {StickerRecord} from '../../domain/records'
import {alphaBounds,borderPadding,outlineAlpha,transparentBackground} from './stickerGeometry.ts'
import {applyPaperFinish} from './paperFinish.ts'

const cache=new WeakMap<Blob,Map<number,Promise<{blob:Blob;width:number;height:number}>>>()
export function stickerSource(record:StickerRecord){return record.imageMode==='cutout'?record.image!:record.originalImage}
export async function inspectSticker(blob:Blob){
  const bitmap=await createImageBitmap(blob)
  try{
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(bitmap,0,0)
    const pixels=ctx.getImageData(0,0,bitmap.width,bitmap.height),bounds=alphaBounds(pixels.data,bitmap.width,bitmap.height)
    if(!bounds)throw new Error('图片中没有可见主体，请重试抠图或使用原图')
    return {width:bounds.width,height:bounds.height,transparent:transparentBackground(pixels.data,bitmap.width,bitmap.height)}
  }finally{bitmap.close()}
}
async function render(blob:Blob,border:number){
  const bitmap=await createImageBitmap(blob)
  try{
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(bitmap,0,0)
    const source=ctx.getImageData(0,0,bitmap.width,bitmap.height),bounds=alphaBounds(source.data,bitmap.width,bitmap.height)
    if(!bounds)throw new Error('贴纸没有可见主体')
    const padding=borderPadding(bounds.width,bounds.height,border),width=bounds.width+2*padding,height=bounds.height+2*padding
    canvas.width=width;canvas.height=height
    if(border>0){
      const alpha=new Uint8Array(width*height)
      for(let y=0;y<bounds.height;y++)for(let x=0;x<bounds.width;x++)alpha[(y+padding)*width+x+padding]=source.data[((y+bounds.y)*bitmap.width+x+bounds.x)*4+3]
      const expanded=outlineAlpha(alpha,width,height,Math.max(width,height)*border/100),pixels=ctx.createImageData(width,height)
      for(let i=0;i<expanded.length;i++){pixels.data[i*4]=251;pixels.data[i*4+1]=250;pixels.data[i*4+2]=246;pixels.data[i*4+3]=expanded[i]}
      ctx.putImageData(pixels,0,0)
    }
    ctx.drawImage(bitmap,bounds.x,bounds.y,bounds.width,bounds.height,padding,padding,bounds.width,bounds.height)
    const finished=ctx.getImageData(0,0,width,height)
    applyPaperFinish(finished.data,width,height)
    ctx.putImageData(finished,0,0)
    return {blob:await canvas.convertToBlob({type:'image/png'}),width,height}
  }finally{bitmap.close()}
}
export function prepareSticker(blob:Blob,border=2){
  let variants=cache.get(blob);if(!variants){variants=new Map();cache.set(blob,variants)}
  let task=variants.get(border)
  if(!task){task=render(blob,border);variants.set(border,task);void task.catch(()=>variants!.delete(border))}
  // Bound the cache while dragging the border slider; source blobs remain weakly held.
  while(variants.size>8)variants.delete(variants.keys().next().value!)
  return task
}
