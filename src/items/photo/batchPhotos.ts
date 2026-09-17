import {IMAGE_TYPES} from '../../domain/records.ts'
import type {PhotoRecord} from '../../domain/records'
import {createMemory} from '../../domain/model.ts'

export const MAX_BATCH_PHOTOS=50
export interface BatchPhoto {record:PhotoRecord;width:number;height:number}

/** Keep original pixels; decode one image at a time to limit peak memory. */
export async function readBatchPhoto(file:File):Promise<BatchPhoto>{
  if(!IMAGE_TYPES.includes(file.type)||!file.size||file.size>20*1024*1024)throw new Error('请选择不超过 20 MB 的 PNG、JPG 或 WebP 图片')
  let bitmap:ImageBitmap
  try{bitmap=await createImageBitmap(file)}catch{throw new Error('无法读取图片，文件可能已损坏')}
  const {width,height}=bitmap
  bitmap.close()
  if(width*height>25_000_000)throw new Error('图片分辨率超过 2500 万像素')
  return {width,height,record:{id:crypto.randomUUID(),kind:'photo',name:file.name.replace(/\.[^.]+$/,'').trim().slice(0,200)||'未命名照片',note:'',source:'upload',image:file}}
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
