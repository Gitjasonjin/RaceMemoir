import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sharedImageTask} from '../src/shared/sharedImageTask.ts'
import type {SharedImageTask} from '../src/shared/sharedImageTask.ts'

test('shared consumers keep processing alive when one editor closes',async()=>{
  const cache=new Map<string,SharedImageTask<number>>()
  let complete!:(value:number)=>void,workerSignal!:AbortSignal,calls=0
  const create=(signal:AbortSignal)=>{calls++;workerSignal=signal;return new Promise<number>(resolve=>{complete=resolve})}
  const first=new AbortController(),second=new AbortController()
  const a=sharedImageTask(cache,'image',create,first.signal),b=sharedImageTask(cache,'image',create,second.signal)
  const rejected=assert.rejects(a,{name:'AbortError'})
  await Promise.resolve();first.abort();await rejected
  assert.equal(workerSignal.aborted,false);assert.equal(calls,1)
  complete(42);assert.equal(await b,42)
  assert.equal(await sharedImageTask(cache,'image',create),42);assert.equal(calls,1)
})

test('unused queued work is cancelled, while immediate StrictMode resubscribe reuses it',async()=>{
  const cache=new Map<string,SharedImageTask<number>>()
  let workerSignal!:AbortSignal,complete!:(value:number)=>void,calls=0
  const create=(signal:AbortSignal)=>{calls++;workerSignal=signal;return new Promise<number>((resolve,reject)=>{
    complete=resolve;signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})
  })}
  const first=new AbortController(),a=sharedImageTask(cache,'image',create,first.signal)
  const rejected=assert.rejects(a,{name:'AbortError'})
  first.abort()
  const next=new AbortController(),b=sharedImageTask(cache,'image',create,next.signal)
  await rejected;await Promise.resolve()
  assert.equal(workerSignal.aborted,false);assert.equal(calls,1)
  const cancelled=assert.rejects(b,{name:'AbortError'});next.abort();await cancelled;await Promise.resolve()
  assert.equal(workerSignal.aborted,true);assert.equal(cache.has('image'),false)
  const c=sharedImageTask(cache,'image',create)
  await Promise.resolve();complete(9);assert.equal(await c,9);assert.equal(calls,2)
})

test('failed work is retryable and stale completion cannot replace a newer entry',async()=>{
  const cache=new Map<string,SharedImageTask<number>>()
  await assert.rejects(sharedImageTask(cache,'image',async()=>{throw new Error('decode failed')}),/decode failed/)
  assert.equal(await sharedImageTask(cache,'image',async()=>7),7)
  const aborted=new AbortController();aborted.abort()
  await assert.rejects(sharedImageTask(cache,'other',async()=>1,aborted.signal),{name:'AbortError'})
  assert.equal(cache.has('other'),false)
})
