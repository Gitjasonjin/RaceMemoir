import {t as tr} from '../../i18n/runtime.ts'
import {readImageSize} from '../../shared/readImageSize.ts'
import type {PhotoRecord} from '../../domain/records'
import {createMemory} from '../../domain/model.ts'
import {ImageImportBudget} from '../../shared/imageBudget.ts'

export const MAX_BATCH_PHOTOS=50
export interface BatchPhoto {record:PhotoRecord;width:number;height:number;preview?:Blob}

/** Keep original pixels; decode one image at a time to limit peak memory. */
export async function readBatchPhoto(file:File,options:{budget?:ImageImportBudget;preview?:boolean;signal?:AbortSignal}={}):Promise<BatchPhoto>{
  options.signal?.throwIfAborted()
  const release=await (options.budget??new ImageImportBudget()).reserve(file)
  try{
    options.signal?.throwIfAborted()
    const {width,height}=await readImageSize(file)
    options.signal?.throwIfAborted()
    let preview:Blob|undefined
    if(options.preview){
      const scale=Math.min(1,160/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale))
      const bitmap=await createImageBitmap(file,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'})
      try{
        options.signal?.throwIfAborted()
        const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d')!
        ctx.drawImage(bitmap,0,0,w,h)
        preview=await canvas.convertToBlob({type:'image/png'})
      }finally{bitmap.close()}
    }
    options.signal?.throwIfAborted()
    return {width,height,preview,record:{id:crypto.randomUUID(),kind:'photo',name:file.name.replace(/\.[^.]+$/,'').trim().slice(0,200)||tr("batchPhotos.001"),note:'',source:'upload',image:file}}
  }catch(error){release();throw error}
}

/** Uniform cells leave room for pins and captions; the final row is centered. */
export function layoutBatchPhotos(photos:BatchPhoto[],center:{x:number;y:number}){
  if(!photos.length)return []
  const columns=Math.min(4,Math.ceil(Math.sqrt(photos.length))),rows=Math.ceil(photos.length/columns)
  const cellW=385,cellH=396
  return photos.map(({record,width,height},index)=>{
    const ratio=width/height,variant=ratio>1.2?'landscape':ratio<.8?'portrait':'polaroid'
    const item=createMemory('photo',record.name,variant,'','')
    const row=Math.floor(index/columns),rowCount=Math.min(columns,photos.length-row*columns)
    return {...item,image:undefined,recordId:record.id,subtitle:'',rotation:0,photoZoom:1,photoX:50,photoY:50,
      x:center.x+(index%columns-(rowCount-1)/2)*cellW-item.w/2,
      y:center.y+(row-(rows-1)/2)*cellH-item.h/2}
  })
}
