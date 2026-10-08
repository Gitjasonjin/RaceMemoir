import {Worker} from 'node:worker_threads'

class BrowserWorker{
  private worker:Worker
  onmessage:((event:{data:unknown})=>void)|null=null
  onerror:((error:Error)=>void)|null=null
  onmessageerror:((error:Error)=>void)|null=null
  constructor(url:URL){
    this.worker=new Worker(new URL('./zipWorkerThread.ts',import.meta.url),{workerData:{url:url.href},execArgv:['--experimental-strip-types']})
    this.worker.on('message',data=>this.onmessage?.({data}))
    this.worker.on('error',error=>this.onerror?.(error))
    this.worker.on('messageerror',error=>this.onmessageerror?.(error))
  }
  postMessage(data:unknown,transfer:Transferable[]){this.worker.postMessage(data,transfer)}
  terminate(){void this.worker.terminate()}
}
Object.assign(globalThis,{Worker:BrowserWorker})
