import {AppError} from '../i18n/runtime.ts'
import {renderSticker,inspectStickerPixels} from '../items/sticker/renderSticker.ts'
import {renderMedal} from '../items/medal/renderMedal.ts'
import type {ImageTask,ImageResponse} from './imageProcessingTypes'

const scope=self as unknown as {onmessage:((event:MessageEvent<{id:number;request:ImageTask}>)=>void)|null;postMessage:(response:ImageResponse)=>void}
scope.onmessage=async({data:{id,request}})=>{
  try{
    const result=request.type==='inspect'?await inspectStickerPixels(request.blob):request.type==='sticker'?await renderSticker(request.blob,request.border,request.style):await renderMedal(request.original,request.image,request.crop)
    scope.postMessage({id,result})
  }catch(error){scope.postMessage({id,error:{key:error instanceof AppError?error.detail.key:undefined,message:error instanceof Error?error.message:'Image processing failed'}})}
}
