import {parentPort,workerData} from 'node:worker_threads'

// Execute the production worker entry point using Node's real worker threads.
Object.assign(globalThis,{
  self:globalThis,
  postMessage:(data:unknown,options:{transfer:Transferable[]})=>parentPort!.postMessage(data,options?.transfer??[]),
})
await import(workerData.url)
parentPort!.on('message',data=>globalThis.onmessage!(new MessageEvent('message',{data})))
