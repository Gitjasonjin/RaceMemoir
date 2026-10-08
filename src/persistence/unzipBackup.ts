import type {Unzipped} from 'fflate'
import {AppError} from '../i18n/runtime.ts'
import {ZIP_TIMEOUT_MS} from './boundedZip.ts'

export function unzipBackup(bytes:Uint8Array,signal?:AbortSignal):Promise<Unzipped>{
  signal?.throwIfAborted()
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./zipArchive.worker.ts',import.meta.url),{type:'module'})
    let settled=false
    const finish=(error?:unknown,entries?:Unzipped)=>{
      if(settled)return
      settled=true
      clearTimeout(timer)
      signal?.removeEventListener('abort',abort)
      worker.terminate()
      if(error)reject(error)
      else resolve(entries!)
    }
    const abort=()=>finish(signal?.reason??new DOMException('Aborted','AbortError'))
    // A main-thread timer can terminate even a worker stuck inside the inflater.
    const timer=setTimeout(()=>finish(new AppError('zipArchive.007')),ZIP_TIMEOUT_MS)
    signal?.addEventListener('abort',abort,{once:true})
    worker.onmessage=event=>event.data.error?finish(new AppError('zipArchive.007')):finish(undefined,event.data.entries)
    worker.onerror=()=>finish(new AppError('zipArchive.008'))
    worker.onmessageerror=()=>finish(new AppError('zipArchive.008'))
    try{worker.postMessage(bytes,[bytes.buffer])}catch(error){finish(error)}
  })
}
