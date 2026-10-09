import {AppError} from '../../i18n/runtime.ts'
import type {StickerStyle} from '../../domain/model'
import {alphaBounds,stickerPadding,outlineAlpha,transparentBackground} from './stickerGeometry.ts'
import {applyPaperFinish} from './paperFinish.ts'
import {tornContourAlpha} from './tornPaper.ts'
import {sketchContour,applyWashiFinish} from './stickerFinish.ts'
import {createProcessingBitmap} from '../../shared/processingImage.ts'

/** Worker-only pixel routines. Keep the source resolution and original print colours. */
export async function inspectStickerPixels(blob:Blob){
  const bitmap=await createProcessingBitmap(blob)
  try{
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(bitmap,0,0)
    const pixels=ctx.getImageData(0,0,bitmap.width,bitmap.height),bounds=alphaBounds(pixels.data,bitmap.width,bitmap.height)
    if(!bounds)throw new AppError('stickerImage.002')
    return {width:bounds.width,height:bounds.height,transparent:transparentBackground(pixels.data,bitmap.width,bitmap.height)}
  }finally{bitmap.close()}
}
export async function renderSticker(blob:Blob,border:number,style:StickerStyle){
  const bitmap=await createProcessingBitmap(blob)
  try{
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(bitmap,0,0)
    const source=ctx.getImageData(0,0,bitmap.width,bitmap.height),bounds=alphaBounds(source.data,bitmap.width,bitmap.height)
    if(!bounds)throw new AppError('stickerImage.001')
    const padding=stickerPadding(bounds.width,bounds.height,border,style),width=bounds.width+2*padding,height=bounds.height+2*padding
    canvas.width=width;canvas.height=height
    if(border>0){
      const alpha=new Uint8Array(width*height)
      for(let y=0;y<bounds.height;y++)for(let x=0;x<bounds.width;x++)alpha[(y+padding)*width+x+padding]=source.data[((y+bounds.y)*bitmap.width+x+bounds.x)*4+3]
      const expanded=(style==='torn'?tornContourAlpha:outlineAlpha)(alpha,width,height,Math.max(bounds.width,bounds.height)*border/100),pixels=ctx.createImageData(width,height)
      for(let i=0;i<expanded.length;i++){pixels.data[i*4]=251;pixels.data[i*4+1]=250;pixels.data[i*4+2]=246;pixels.data[i*4+3]=expanded[i]}
      if(style==='sketch'){
        const ink=sketchContour(alpha,width,height,Math.max(bounds.width,bounds.height)*border/100)
        for(let i=0;i<ink.length;i++){
          const opacity=ink[i]/255*.85
          for(let c=0;c<3;c++)pixels.data[i*4+c]=pixels.data[i*4+c]*(1-opacity)+[62,67,56][c]*opacity
        }
      }
      ctx.putImageData(pixels,0,0)
    }
    ctx.drawImage(bitmap,bounds.x,bounds.y,bounds.width,bounds.height,padding,padding,bounds.width,bounds.height)
    const finished=ctx.getImageData(0,0,width,height)
    applyPaperFinish(finished.data,width,height)
    if(style==='washi')applyWashiFinish(finished.data,width,height)
    ctx.putImageData(finished,0,0)
    return {blob:await canvas.convertToBlob({type:'image/png'}),width,height}
  }finally{bitmap.close()}
}
