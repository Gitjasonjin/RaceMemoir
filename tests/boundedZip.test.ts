import {test} from 'node:test'
import assert from 'node:assert/strict'
import {zipSync,Zip,ZipDeflate,strToU8} from 'fflate'
import {extractBoundedZip} from '../src/persistence/boundedZip.ts'
import {unzipBackup} from '../src/persistence/unzipBackup.ts'

function changeSize(zip:Uint8Array,size:number,local=true){
  const copy=zip.slice(),view=new DataView(copy.buffer)
  if(local)view.setUint32(22,size,true)
  const directory=view.getUint32(copy.length-6,true)
  view.setUint32(directory+24,size,true)
  return copy
}

test('rejects forged sizes while streaming actual output, including stored entries',()=>{
  for(const level of [0,6] as const){
    const bytes=zipSync({'manifest.json':new Uint8Array(2*1024*1024)},{level})
    assert.throws(()=>extractBoundedZip(changeSize(bytes,1)))
    assert.throws(()=>extractBoundedZip(changeSize(bytes,1,false)))
  }
  const bytes=zipSync({'manifest.json':strToU8('{}')})
  assert.throws(()=>extractBoundedZip(changeSize(bytes,1024)))
})

test('enforces actual compression ratio before returning metadata',()=>{
  const bytes=zipSync({'manifest.json':new Uint8Array(2*1024*1024)})
  assert.throws(()=>extractBoundedZip(bytes))
})

test('enforces per-entry and aggregate limits before inflation',()=>{
  const manifest=zipSync({'manifest.json':strToU8('{}')})
  assert.throws(()=>extractBoundedZip(changeSize(manifest,16*1024*1024+1)))
  const entries:Record<string,Uint8Array>={'manifest.json':strToU8('{}')}
  for(let i=0;i<5;i++)entries[`assets/${String(i).padStart(64,'0')}.gpx`]=new Uint8Array()
  const bytes=zipSync(entries),view=new DataView(bytes.buffer)
  let cursor=view.getUint32(bytes.length-6,true)
  for(let i=0;i<6;i++){
    const size=i?20*1024*1024:2,local=view.getUint32(cursor+42,true)
    view.setUint32(cursor+24,size,true);view.setUint32(local+22,size,true)
    cursor+=46+view.getUint16(cursor+28,true)+view.getUint16(cursor+30,true)+view.getUint16(cursor+32,true)
  }
  assert.throws(()=>extractBoundedZip(bytes))
})

test('accepts stored/deflated entries and streaming ZIP data descriptors',()=>{
  const data=strToU8('{"format":"racememoir"}')
  for(const level of [0,6] as const)assert.deepEqual(extractBoundedZip(zipSync({'manifest.json':data},{level}))['manifest.json'],data)
  const chunks:Uint8Array[]=[]
  const zip=new Zip((error,chunk)=>{if(error)throw error;chunks.push(chunk)})
  const entry=new ZipDeflate('manifest.json');zip.add(entry);entry.push(data,true);zip.end()
  assert.deepEqual(extractBoundedZip(new Uint8Array(Buffer.concat(chunks)))['manifest.json'],data)
})

test('rejects duplicate names, damaged CRC, truncated streams and unsafe paths',()=>{
  const chunks:Uint8Array[]=[]
  const zip=new Zip((error,chunk)=>{if(error)throw error;chunks.push(chunk)})
  for(let i=0;i<2;i++){const entry=new ZipDeflate('manifest.json');zip.add(entry);entry.push(strToU8('{}'),true)}
  zip.end()
  assert.throws(()=>extractBoundedZip(new Uint8Array(Buffer.concat(chunks))))
  const bytes=zipSync({'manifest.json':strToU8('{}')},{level:0})
  bytes[30+'manifest.json'.length]^=1
  assert.throws(()=>extractBoundedZip(bytes))
  assert.throws(()=>extractBoundedZip(bytes.subarray(0,bytes.length-1)))
  assert.throws(()=>extractBoundedZip(zipSync({'manifest.json':strToU8('{}'),'../bad':new Uint8Array()})))
})

test('worker rejects hostile archives and supports cancellation',async()=>{
  await assert.rejects(unzipBackup(changeSize(zipSync({'manifest.json':new Uint8Array(2*1024*1024)}),1)))
  const controller=new AbortController()
  const pending=unzipBackup(zipSync({'manifest.json':strToU8('{}')}),controller.signal)
  controller.abort()
  await assert.rejects(pending,{name:'AbortError'})
  assert.throws(()=>unzipBackup(new Uint8Array(),controller.signal),{name:'AbortError'})
})

test('main thread deadline terminates an unresponsive worker',async t=>{
  const original=globalThis.Worker
  let terminated=false
  class StuckWorker{
    postMessage(){}
    terminate(){terminated=true}
  }
  Object.assign(globalThis,{Worker:StuckWorker})
  t.mock.timers.enable({apis:['setTimeout']})
  try{
    const pending=unzipBackup(new Uint8Array())
    const rejected=assert.rejects(pending)
    t.mock.timers.tick(15001)
    await rejected
    assert.equal(terminated,true)
  }finally{globalThis.Worker=original;t.mock.timers.reset()}
})
