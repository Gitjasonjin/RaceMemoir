import {AppError} from '../i18n/runtime.ts'
import {formatNumber} from '../i18n/runtime.ts'
import {MAX_UPLOAD_IMAGE_PIXELS,validImageBlob} from '../domain/imageRules.ts'

const sizes=new WeakMap<Blob,Promise<{width:number;height:number}>>()
async function decodeSize(file:Blob){
  let bitmap:ImageBitmap
  try{bitmap=await createImageBitmap(file)}catch{throw new AppError("readImageSize.003")}
  try{return {width:bitmap.width,height:bitmap.height}}finally{bitmap.close()}
}

/** Check uploads consistently and release the decoded bitmap even on validation failure. */
export async function readImageSize(file:Blob,maxPixels=MAX_UPLOAD_IMAGE_PIXELS){
  if(!validImageBlob(file))throw new AppError("readImageSize.002")
  let task=sizes.get(file)
  if(!task){task=decodeSize(file);sizes.set(file,task);void task.catch(()=>sizes.delete(file))}
  const {width,height}=await task
  if(width*height>maxPixels)throw new AppError("image.resolutionLimit",{pixels:formatNumber(maxPixels)})
  return {width,height}
}
