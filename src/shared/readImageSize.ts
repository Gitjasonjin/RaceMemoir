import {MAX_UPLOAD_IMAGE_PIXELS,validImageBlob} from '../domain/imageRules.ts'

const sizes=new WeakMap<Blob,Promise<{width:number;height:number}>>()
async function decodeSize(file:Blob){
  let bitmap:ImageBitmap
  try{bitmap=await createImageBitmap(file)}catch{throw new Error('无法读取图片，文件可能已损坏')}
  try{return {width:bitmap.width,height:bitmap.height}}finally{bitmap.close()}
}

/** Check uploads consistently and release the decoded bitmap even on validation failure. */
export async function readImageSize(file:Blob,maxPixels=MAX_UPLOAD_IMAGE_PIXELS){
  if(!validImageBlob(file))throw new Error('请选择不超过 20 MB 的 PNG、JPG 或 WebP 图片')
  let task=sizes.get(file)
  if(!task){task=decodeSize(file);sizes.set(file,task);void task.catch(()=>sizes.delete(file))}
  const {width,height}=await task
  if(width*height>maxPixels)throw new Error(`图片分辨率超过 ${maxPixels/10_000} 万像素`)
  return {width,height}
}
