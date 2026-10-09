import {AppError} from '../i18n/runtime.ts'
import {cachedDerivedImage} from '../persistence/derivedImageCache'
import type {DerivedImage} from '../persistence/derivedImageCache'
import type {ImageTask,ImageResponse,ImageInspection,InspectImageTask,RenderImageTask} from './imageProcessingTypes'

interface Job {id:number;request:ImageTask;resolve:(result:DerivedImage|ImageInspection)=>void;reject:(error:unknown)=>void;cleanup:()=>void}
const queue:Job[]=[]
let worker:Worker|undefined,running:Job|undefined,nextId=0
let deadline:ReturnType<typeof setTimeout>|undefined,idle:ReturnType<typeof setTimeout>|undefined
function dispose(){worker?.terminate();worker=undefined;clearTimeout(deadline);clearTimeout(idle)}
function finish(error?:unknown,result?:DerivedImage|ImageInspection){
  const job=running;if(!job)return
  running=undefined;clearTimeout(deadline);job.cleanup()
  if(error)job.reject(error);else job.resolve(result!)
  pump()
}
function pump(){
  if(running)return
  clearTimeout(idle)
  const job=queue.shift()
  if(!job){idle=setTimeout(dispose,30_000);return}
  running=job
  try{
    if(!worker){
      const created=new Worker(new URL('./imageProcessing.worker.ts',import.meta.url),{type:'module'})
      worker=created
      created.onmessage=(event:MessageEvent<ImageResponse>)=>{
        if(worker!==created)return
        const data=event.data
        if(data.id!==running?.id)return
        if(data.error)finish(new AppError(data.error.key??'imageProcessing.001'))
        else if(data.result)finish(undefined,data.result)
        else{dispose();finish(new AppError('imageProcessing.001'))}
      }
      created.onerror=created.onmessageerror=()=>{if(worker===created){dispose();finish(new AppError('imageProcessing.001'))}}
    }
    // One job at a time bounds decoded bitmaps, RGBA buffers and PNG encoders.
    deadline=setTimeout(()=>{dispose();finish(new AppError('imageProcessing.002'))},180_000)
    worker.postMessage({id:job.id,request:job.request})
  }catch{dispose();finish(new AppError('imageProcessing.001'))}
}
export function processImage(request:InspectImageTask,signal?:AbortSignal):Promise<ImageInspection>
export function processImage(request:RenderImageTask,signal?:AbortSignal):Promise<DerivedImage>
export function processImage(request:ImageTask,signal?:AbortSignal):Promise<DerivedImage|ImageInspection>{
  if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'))
  return new Promise((resolve,reject)=>{
    const abort=()=>{
      if(running===job){dispose();finish(new DOMException('Aborted','AbortError'))}
      else{
        const index=queue.indexOf(job)
        if(index>=0){queue.splice(index,1);job.cleanup();reject(new DOMException('Aborted','AbortError'))}
      }
    }
    const job:Job={id:++nextId,request,resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)}
    signal?.addEventListener('abort',abort,{once:true})
    queue.push(job);pump()
  })
}

export async function prepareDerivedImage(sources:readonly Blob[],variant:string,request:RenderImageTask,signal:AbortSignal){
  const load=()=>cachedDerivedImage(sources,variant,()=>processImage(request,signal))
  let result:DerivedImage
  try{result=await load()}catch(error){
    // Equivalent cloned Blobs can share a persistent-cache lookup whose first owner left.
    if(!(error instanceof Error&&error.name==='AbortError')||signal.aborted)throw error
    result=await load()
  }
  signal.throwIfAborted();return result
}
