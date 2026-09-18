export const IMAGE_TYPES = ['image/png','image/jpeg','image/webp']
export const MAX_IMAGE_BYTES = 20*1024*1024
export const MAX_IMAGE_PIXELS = 25_000_000
export function validImageBlob(value:unknown):value is Blob{
  return value instanceof Blob&&IMAGE_TYPES.includes(value.type)&&value.size>0&&value.size<=MAX_IMAGE_BYTES
}
