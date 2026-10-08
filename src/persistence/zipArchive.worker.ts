import {extractBoundedZip} from './boundedZip.ts'

self.onmessage=(event:MessageEvent<Uint8Array>)=>{
  try{
    const entries=extractBoundedZip(event.data)
    self.postMessage({entries},{transfer:Object.values(entries).map(bytes=>bytes.buffer)})
  }catch{
    self.postMessage({error:true})
  }
}
