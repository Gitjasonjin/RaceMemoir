import type {StickerRecord} from '../../domain/records'
import type {StickerStyle} from '../../domain/model'
import type {DerivedImage} from '../../persistence/derivedImageCache'
import {processImage,prepareDerivedImage} from '../../shared/imageProcessing'
import {sharedImageTask} from '../../shared/sharedImageTask'
import type {SharedImageTask} from '../../shared/sharedImageTask'

const cache=new WeakMap<Blob,Map<string,SharedImageTask<DerivedImage>>>()
export function stickerSource(record:StickerRecord){return record.imageMode==='cutout'?record.image!:record.originalImage}
export function inspectSticker(blob:Blob,signal?:AbortSignal){return processImage({type:'inspect',blob},signal)}
export function prepareSticker(blob:Blob,border=2,style:StickerStyle='contour',signal?:AbortSignal){
  let variants=cache.get(blob);if(!variants){variants=new Map();cache.set(blob,variants)}
  // Bump the version whenever the pixel algorithm changes, invalidating old prints.
  const key=`sticker-v1:${style}:${border}`
  const task=sharedImageTask(variants,key,sharedSignal=>prepareDerivedImage([blob],key,{type:'sticker',blob,border,style},sharedSignal),signal)
  while(variants.size>8)variants.delete(variants.keys().next().value!)
  return task
}
