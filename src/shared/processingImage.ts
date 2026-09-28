import {processingImageSize} from '../domain/imageRules.ts'
import {readImageSize} from './readImageSize.ts'

/** Caller owns this bitmap and must close it. Original blobs are never overwritten. */
export async function createProcessingBitmap(blob:Blob){
  const original=await readImageSize(blob)
  const size=processingImageSize(original.width,original.height)
  return size.scale===1?createImageBitmap(blob):createImageBitmap(blob,{
    resizeWidth:size.width,resizeHeight:size.height,resizeQuality:'high',
  })
}

/** Used inside the cancellable worker before the model sees any image data. */
export async function processingImage(blob:Blob){
  const original=await readImageSize(blob)
  if(processingImageSize(original.width,original.height).scale===1)return blob
  const bitmap=await createProcessingBitmap(blob)
  try{
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height)
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('无法创建图片处理副本')
    ctx.drawImage(bitmap,0,0)
    return await canvas.convertToBlob({type:'image/png'})
  }finally{bitmap.close()}
}
