export const IMAGE_TYPES = ['image/png','image/jpeg','image/webp']
export const MAX_IMAGE_BYTES = 20*1024*1024
export const MAX_IMAGE_PIXELS = 25_000_000
export const MAX_UPLOAD_IMAGE_PIXELS = 50_000_000

/** Bound processing cost without enlarging small images or changing their aspect ratio. */
export function processingImageSize(width:number,height:number){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0)throw new Error('图片尺寸无效')
  const scale=Math.min(1,Math.sqrt(MAX_IMAGE_PIXELS/(width*height)))
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale}
}
export function validImageBlob(value:unknown):value is Blob{
  return value instanceof Blob&&IMAGE_TYPES.includes(value.type)&&value.size>0&&value.size<=MAX_IMAGE_BYTES
}
