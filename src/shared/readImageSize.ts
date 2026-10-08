import {AppError} from '../i18n/runtime.ts'
import {MAX_UPLOAD_IMAGE_PIXELS} from '../domain/imageRules.ts'
import {readImageHeader} from './imageHeader.ts'

const sizes=new WeakMap<Blob,Promise<{width:number;height:number}>>()
async function decodeSize(file:Blob){
  let bitmap:ImageBitmap
  try{bitmap=await createImageBitmap(file)}catch{throw new AppError("readImageSize.003")}
  try{return {width:bitmap.width,height:bitmap.height}}finally{bitmap.close()}
}

/** Enforce the caller's limit before any decoder allocation, including cached reads. */
export async function readImageSize(file:Blob,maxPixels=MAX_UPLOAD_IMAGE_PIXELS){
  const header=await readImageHeader(file,maxPixels)
  let task=sizes.get(file)
  if(!task){task=decodeSize(file);sizes.set(file,task);void task.catch(()=>sizes.delete(file))}
  const {width,height}=await task
  // EXIF orientation can swap axes; it cannot change either dimension or pixel count.
  if(!((width===header.width&&height===header.height)||(width===header.height&&height===header.width)))throw new AppError('readImageSize.003')
  return {width,height}
}
