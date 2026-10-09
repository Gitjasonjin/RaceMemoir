import lock from '../../resources/background-removal.lock.json'
import {createVerifiedResourceFetch} from './verifiedResourceFetch.ts'
import type {ResourceEntryPin,ResourceChunkPin} from './verifiedResourceFetch.ts'

export function secureBackgroundRemovalResources(origin:string,appBase:string,onIntegrityError?:()=>void){
  const resources:Record<string,ResourceEntryPin>={},files=new Map<string,ResourceChunkPin>()
  for(const [key,resource] of Object.entries(lock.resources)){
    resources[key]={size:resource.size,mime:resource.mime,chunks:resource.chunks.map(chunk=>{
      const pin={name:chunk.name,sha256:chunk.sha256,size:chunk.offsets[1]-chunk.offsets[0]}
      const previous=files.get(pin.name)
      if(previous&&(previous.size!==pin.size||previous.sha256!==pin.sha256))throw new Error('Conflicting resource lock')
      files.set(pin.name,pin)
      return {name:chunk.name,offsets:chunk.offsets as [number,number]}
    })}
  }
  const base=new URL(lock.publicPath.replace(/^\//,''),new URL(appBase,origin))
  const nativeFetch=globalThis.fetch.bind(globalThis)
  // This worker exists only for background removal. No unchecked network fallback.
  const verifiedFetch=createVerifiedResourceFetch(base,origin,{
    cacheName:lock.cacheName,
    resources,files:[...files.values()],
  },nativeFetch,typeof caches==='undefined'?undefined:caches)
  globalThis.fetch=async(...args)=>{
    try{return await verifiedFetch(...args)}
    catch(error){onIntegrityError?.();throw error}
  }
  return base.href
}
