import {medalBounds,restoreMedalPixels} from './medalPixels.ts'
import type {MedalCrop} from './medalCrop'
import {createProcessingBitmap} from '../../shared/processingImage.ts'

export async function renderMedal(original:Blob,image:Blob,crop?:MedalCrop){
  const source=await createProcessingBitmap(original)
  let mask:ImageBitmap|undefined
  try{
    mask=await createProcessingBitmap(image)
    const canvas=new OffscreenCanvas(source.width,source.height),ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(mask,0,0,canvas.width,canvas.height)
    const alpha=ctx.getImageData(0,0,canvas.width,canvas.height)
    const result=new ImageData(restoreMedalPixels(pixels,alpha),canvas.width,canvas.height)
    const x=crop?Math.min(source.width-1,Math.floor(crop.x*source.width)):0
    const y=crop?Math.min(source.height-1,Math.floor(crop.y*source.height)):0
    const bounds=crop?{x,y,width:Math.max(1,Math.min(source.width,Math.ceil((crop.x+crop.width)*source.width))-x),height:Math.max(1,Math.min(source.height,Math.ceil((crop.y+crop.height)*source.height))-y)}:medalBounds(result)
    canvas.width=bounds.width;canvas.height=bounds.height
    ctx.putImageData(result,-bounds.x,-bounds.y)
    return {blob:await canvas.convertToBlob({type:'image/png'}),width:bounds.width,height:bounds.height}
  }finally{source.close();mask?.close()}
}
