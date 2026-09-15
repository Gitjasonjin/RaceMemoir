import { removeBackground } from '@imgly/background-removal'
import { automaticRibbonMask } from './autoRibbon'
import { restoreMedalPixels } from './medalPixels'

async function keepRibbon(original:Blob,cutout:Blob){
  const source=await createImageBitmap(original)
  let result:ImageBitmap|undefined
  try{
    result=await createImageBitmap(cutout)
    if(source.width!==result.width||source.height!==result.height)return cutout
    const scale=Math.min(1,1024/Math.max(source.width,source.height)),w=Math.max(1,Math.round(source.width*scale)),h=Math.max(1,Math.round(source.height*scale))
    const sample=new OffscreenCanvas(w,h),ctx=sample.getContext('2d',{willReadFrequently:true})!
    ctx.drawImage(source,0,0,w,h);const originalPixels=ctx.getImageData(0,0,w,h)
    ctx.clearRect(0,0,w,h);ctx.drawImage(result,0,0,w,h)
    const alpha=automaticRibbonMask(originalPixels,ctx.getImageData(0,0,w,h))

    const mask=ctx.createImageData(w,h)
    if(alpha)for(let i=0;i<alpha.length;i++)mask.data[i*4+3]=alpha[i]
    ctx.putImageData(mask,0,0)
    const output=new OffscreenCanvas(source.width,source.height),out=output.getContext('2d',{willReadFrequently:true})!
    out.drawImage(source,0,0);const rgb=out.getImageData(0,0,source.width,source.height)
    out.clearRect(0,0,source.width,source.height);out.drawImage(result,0,0)
    const model=out.getImageData(0,0,source.width,source.height)
    if(alpha){
      out.clearRect(0,0,source.width,source.height);out.drawImage(sample,0,0,source.width,source.height)
      const ribbon=out.getImageData(0,0,source.width,source.height)
      for(let i=3;i<model.data.length;i+=4)model.data[i]=Math.max(model.data[i],ribbon.data[i])
    }
    out.putImageData(new ImageData(restoreMedalPixels(rgb,model),source.width,source.height),0,0)
    return await output.convertToBlob({type:'image/png'})
  }finally{source.close();result?.close()}
}

self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    const cutout = await removeBackground(event.data, {
      // Keep the higher precision model for fine foreground details such as ribbons.
      device: 'cpu', model: 'isnet_fp16', proxyToWorker: false,
      progress: (key, current, total) => self.postMessage({ type: 'progress', key, current, total }),
      output: { format: 'image/png', quality: 1 },
    })
    self.postMessage({type:'progress',key:'compute:ribbon',current:0,total:1})
    // If refinement is unavailable, preserve the successful model result.
    const image=await keepRibbon(event.data,cutout).catch(()=>cutout)
    self.postMessage({ type: 'done', image })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : '无法完成抠图' })
  }
}
