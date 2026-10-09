import {useNotice} from '../../i18n/useNotice'
import {msg} from '../../i18n/runtime.ts'
import {useEffect,useState} from 'react'
import {useBlobUrl} from '../../shared/useBlobUrl'
import type {MedalCrop} from './medalCrop'
import type {DerivedImage} from '../../persistence/derivedImageCache'
import {prepareDerivedImage} from '../../shared/imageProcessing'
import {sharedImageTask} from '../../shared/sharedImageTask'
import type {SharedImageTask} from '../../shared/sharedImageTask'

const cache=new WeakMap<Blob,WeakMap<Blob,Map<string,SharedImageTask<DerivedImage>>>>()
export function prepareMedal(original:Blob,image:Blob,crop?:MedalCrop,signal?:AbortSignal){
  let images=cache.get(original);if(!images){images=new WeakMap();cache.set(original,images)}
  let variants=images.get(image);if(!variants){variants=new Map();images.set(image,variants)}
  const key=crop?`${crop.x},${crop.y},${crop.width},${crop.height}`:'auto'
  // Bump medal-v1 when restoration or crop rendering changes.
  const task=sharedImageTask(variants,key,sharedSignal=>prepareDerivedImage([original,image],`medal-v1:${key}`,{type:'medal',original,image,crop},sharedSignal),signal)
  while(variants.size>8)variants.delete(variants.keys().next().value!)
  return task
}
export function useMedalImage(original?:Blob,image?:Blob,crop?:MedalCrop){
  const key=crop?`${crop.x},${crop.y},${crop.width},${crop.height}`:'auto'
  const [prepared,setPrepared]=useState<{source:Blob;original:Blob;key:string;blob:Blob;aspect:number}|null>(null)
  const [error,setError]=useNotice('')
  useEffect(()=>{
    const controller=new AbortController();setError('')
    if(!image)return
    const source=original||image
    void prepareMedal(source,image,crop,controller.signal).then(result=>{
      if(!controller.signal.aborted)setPrepared({...result,aspect:result.width/result.height,source:image,original:source,key})
    }).catch(()=>{if(!controller.signal.aborted)setError(msg('useMedalImage.001'))})
    return()=>controller.abort()
  },[original,image,key])
  const current=prepared?.source===image&&prepared?.original===(original||image)&&prepared?.key===key?prepared:null
  return {url:useBlobUrl(current?.blob||image),aspect:current?.aspect,ready:!!current,error}
}
