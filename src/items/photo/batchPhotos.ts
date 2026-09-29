import {t as tr} from '../../i18n/runtime.ts'
import {readImageSize} from '../../shared/readImageSize.ts'
import type {PhotoRecord} from '../../domain/records'
import {createMemory} from '../../domain/model.ts'

export const MAX_BATCH_PHOTOS=50
export interface BatchPhoto {record:PhotoRecord;width:number;height:number}

/** Keep original pixels; decode one image at a time to limit peak memory. */
export async function readBatchPhoto(file:File):Promise<BatchPhoto>{
  const {width,height}=await readImageSize(file)
  return {width,height,record:{id:crypto.randomUUID(),kind:'photo',name:file.name.replace(/\.[^.]+$/,'').trim().slice(0,200)||tr("batchPhotos.001"),note:'',source:'upload',image:file}}
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
