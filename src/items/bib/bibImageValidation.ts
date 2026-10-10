import {AppError} from '../../i18n/runtime.ts'
import {MAX_IMAGE_PIXELS} from '../../domain/imageRules.ts'
import {checkImagePixels,readImageHeader} from '../../shared/imageHeader.ts'
import type {ImageSize} from '../../shared/imageHeader.ts'

/** Headers are read before orientation; EXIF may exchange axes, but never dimensions. */
export function checkBibImageDimensions(size:ImageSize,expected?:ImageSize){
  checkImagePixels(size,MAX_IMAGE_PIXELS)
  if(expected&&!((size.width===expected.width&&size.height===expected.height)||(size.width===expected.height&&size.height===expected.width)))throw new AppError('readImageSize.003')
  return size
}

/** Reject oversized originals before an image element, bitmap or RGBA buffer can decode them. */
export async function readBibImageHeader(blob:Blob,expected?:ImageSize){
  return checkBibImageDimensions(await readImageHeader(blob,MAX_IMAGE_PIXELS),expected)
}
