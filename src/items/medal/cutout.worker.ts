import {removeBackground} from '@imgly/background-removal'
import {keepRibbon} from './keepRibbon'
import {restoreMedalPixels} from './medalPixels'
import {processingImage} from '../../shared/processingImage'

async function keepOriginalPixels(original:Blob,mask:Blob){
 const source=await createImageBitmap(original);let result:ImageBitmap|undefined
 try{
  result=await createImageBitmap(mask)
  const canvas=new OffscreenCanvas(source.width,source.height),ctx=canvas.getContext('2d',{willReadFrequently:true})!
  ctx.drawImage(source,0,0);const rgb=ctx.getImageData(0,0,source.width,source.height)
  ctx.clearRect(0,0,source.width,source.height);ctx.drawImage(result,0,0,source.width,source.height)
  ctx.putImageData(new ImageData(restoreMedalPixels(rgb,ctx.getImageData(0,0,source.width,source.height)),source.width,source.height),0,0)
  return await canvas.convertToBlob({type:'image/png'})
 }finally{source.close();result?.close()}
}


self.onmessage = async (event: MessageEvent<{blob:Blob;subject:'medal'|'sticker'}>) => {
  try {
    self.postMessage({type:'progress',key:'compute:resize',current:0,total:1})
    const input=await processingImage(event.data.blob)
    const cutout = await removeBackground(input, {
      // Keep the higher precision model for fine foreground details such as ribbons.
      device: 'cpu', model: 'isnet_fp16', proxyToWorker: false,
      progress: (key, current, total) => self.postMessage({ type: 'progress', key, current, total }),
      output: { format: 'image/png', quality: 1 },
    })
    if(event.data.subject==='medal')self.postMessage({type:'progress',key:'compute:ribbon',current:0,total:1})
    // If refinement is unavailable, preserve the successful model result.
    const image=event.data.subject==='medal'?await keepRibbon(input,cutout).catch(()=>cutout):await keepOriginalPixels(input,cutout)
    self.postMessage({ type: 'done', image })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : '无法完成抠图' })
  }
}
