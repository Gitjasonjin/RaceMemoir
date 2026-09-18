import {MAX_IMAGE_PIXELS,validImageBlob} from '../domain/imageRules.ts'

/** Check uploads consistently and release the decoded bitmap even on validation failure. */
export async function readImageSize(file:Blob){
  if(!validImageBlob(file))throw new Error('请选择不超过 20 MB 的 PNG、JPG 或 WebP 图片')
  let bitmap:ImageBitmap
  try{bitmap=await createImageBitmap(file)}catch{throw new Error('无法读取图片，文件可能已损坏')}
  try{
    const {width,height}=bitmap
    if(width*height>MAX_IMAGE_PIXELS)throw new Error('图片分辨率超过 2500 万像素')
    return {width,height}
  }finally{bitmap.close()}
}
