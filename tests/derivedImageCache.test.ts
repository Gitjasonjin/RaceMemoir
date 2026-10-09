import {beforeEach,test} from 'node:test'
import assert from 'node:assert/strict'
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb'
import {cachedDerivedImage} from '../src/persistence/derivedImageCache.ts'
import type {DerivedImage} from '../src/persistence/derivedImageCache.ts'
import {pngBlob,pngBytes} from './helpers/imageFixture.ts'

const DATABASE='racememoir-derived-images-v1'
beforeEach(()=>{globalThis.indexedDB=new IDBFactory()})
const source=(value='source')=>new Blob([value],{type:'image/png'})
const derived=():DerivedImage=>({blob:pngBlob(2,3,50),width:2,height:3})
async function inspect(update?:(rows:any[],store:IDBObjectStore)=>void):Promise<any[]>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1)
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)
  })
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('images',update?'readwrite':'readonly'),store=tx.objectStore('images'),request=store.getAll()
    request.onsuccess=()=>update?.(request.result,store)
    tx.oncomplete=()=>{db.close();resolve(request.result)}
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error)}
  })
}

test('derived image persists by content across cloned Blobs, retaining original bytes and dimensions',async()=>{
  let calls=0
  const original=source(),render=async()=>{calls++;return derived()}
  const first=await cachedDerivedImage([original],'sticker:contour:2:v1',render)
  const clone=new Blob([await original.arrayBuffer()],{type:original.type})
  const second=await cachedDerivedImage([clone],'sticker:contour:2:v1',render)
  assert.equal(calls,1)
  assert.deepEqual([second.width,second.height],[2,3])
  assert.deepEqual(await second.blob.arrayBuffer(),await first.blob.arrayBuffer())
  assert.equal(await original.text(),'source')
  assert.equal((await inspect()).length,1)
})

test('style, processing version, source content, order and source boundaries invalidate independently',async()=>{
  let calls=0
  const render=async()=>{calls++;return derived()},a=source('a'),b=source('b')
  await cachedDerivedImage([a,b],'style:2:v1',render)
  await cachedDerivedImage([a,b],'style:3:v1',render)
  await cachedDerivedImage([a,b],'style:2:v2',render)
  await cachedDerivedImage([a,source('c')],'style:2:v1',render)
  await cachedDerivedImage([b,a],'style:2:v1',render)
  await cachedDerivedImage([source('ab')],'style:2:v1',render)
  assert.equal(calls,6)
})

test('equivalent concurrent requests share rendering; rejected creation is retried',async()=>{
  let calls=0
  const render=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return derived()}
  const results=await Promise.all(Array.from({length:8},()=>cachedDerivedImage([source()],'concurrent',render)))
  assert.equal(calls,1)
  assert.ok(results.every(result=>result===results[0]))
  await assert.rejects(cachedDerivedImage([source()],'retry',async()=>{throw new Error('render failed')}),/render failed/)
  assert.equal((await cachedDerivedImage([source()],'retry',render)).width,2)
  assert.equal(calls,2)
})

test('storage denial and quota failures still return rendered images and permit later persistence',async()=>{
  const available=indexedDB
  Object.defineProperty(globalThis,'indexedDB',{value:undefined,writable:true,configurable:true})
  try{assert.equal((await cachedDerivedImage([source()],'disabled',async()=>derived())).height,3)}
  finally{globalThis.indexedDB=available}
  const put=IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put=function(){throw new DOMException('quota','QuotaExceededError')}
  try{assert.equal((await cachedDerivedImage([source()],'quota',async()=>derived())).width,2)}
  finally{IDBObjectStore.prototype.put=put}
  await cachedDerivedImage([source()],'quota',async()=>derived())
  assert.equal((await inspect()).length,1)
})

test('hashing unavailability falls back without hiding creation errors',async()=>{
  const digest=crypto.subtle.digest
  crypto.subtle.digest=async()=>{throw new Error('Unavailable')}
  try{
    assert.equal((await cachedDerivedImage([source('no-crypto')],'fallback',async()=>derived())).width,2)
    await assert.rejects(cachedDerivedImage([source('no-crypto')],'failure',async()=>{throw new Error('creation failed')}),/creation failed/)
  }finally{crypto.subtle.digest=digest}
})

test('invalid cached dimensions and empty Blobs are replaced rather than displayed',async()=>{
  let calls=0
  const render=async()=>{calls++;return derived()}
  await cachedDerivedImage([source()],'corrupt',render)
  await inspect((rows,store)=>store.put({...rows[0],width:0}))
  await cachedDerivedImage([source()],'corrupt',render)
  await inspect((rows,store)=>store.put({...rows[0],blob:new Blob([])}))
  await cachedDerivedImage([source()],'corrupt',render)
  assert.equal(calls,3)
  assert.ok((await inspect())[0].blob.size>0)
})

test('corrupt PNG bytes, mismatched headers, MIME and unsafe dimensions are bypassed',async()=>{
  let calls=0
  const render=async()=>{calls++;return derived()}
  await cachedDerivedImage([source()],'png-validation',render)
  for(const replacement of [
    {blob:new Blob(['not a PNG'],{type:'image/png'})},
    {blob:pngBlob(4,3)},
    {blob:new Blob([await pngBlob(2,3).arrayBuffer()],{type:'image/jpeg'})},
    {width:Number.MAX_SAFE_INTEGER,height:3},
  ]){
    await inspect((rows,store)=>store.put({...rows[0],...replacement}))
    await cachedDerivedImage([source()],'png-validation',render)
  }
  assert.equal(calls,5)
})

test('cache uses least recent access to evict and serializes concurrent writes to the entry bound',async()=>{
  const render=async()=>derived()
  for(let index=0;index<64;index++)await cachedDerivedImage([source()],`entry:${index}`,render)
  await cachedDerivedImage([source()],'entry:0',async()=>{throw new Error('must be a hit')})
  await cachedDerivedImage([source()],'entry:64',render)
  let recreated=0
  await cachedDerivedImage([source()],'entry:0',async()=>{throw new Error('recent entry evicted')})
  await cachedDerivedImage([source()],'entry:1',async()=>{recreated++;return derived()})
  assert.equal(recreated,1)
  await Promise.all(Array.from({length:16},(_,index)=>cachedDerivedImage([source()],`concurrent-write:${index}`,render)))
  assert.equal((await inspect()).length,64)
})

test('cache enforces the byte bound and skips results larger than the per-entry bound',async()=>{
  const bytes=pngBytes(2,3)
  const large=():DerivedImage=>({blob:new Blob([bytes,new Uint8Array(16*1024*1024-bytes.length)],{type:'image/png'}),width:2,height:3})
  for(let index=0;index<5;index++)await cachedDerivedImage([source()],`large:${index}`,async()=>large())
  const rows=await inspect()
  assert.equal(rows.length,4)
  assert.equal(rows.reduce((total,row)=>total+row.blob.size,0),64*1024*1024)
  let calls=0
  for(let index=0;index<2;index++)await cachedDerivedImage([source()],'too-large',async()=>{
    calls++;return {...large(),blob:new Blob([new Uint8Array(16*1024*1024+1)],{type:'image/png'})}
  })
  assert.equal(calls,2)
  assert.equal((await inspect()).length,4)
})
