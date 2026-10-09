import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createVerifiedResourceFetch,ResourceIntegrityError} from '../src/shared/verifiedResourceFetch.ts'
import type {ResourcePins} from '../src/shared/verifiedResourceFetch.ts'

const origin='https://racememoir.test'
const base=new URL('/background-removal/1.7.0/',origin)
const code='export default function runtime() { return "verified" }'
const filename='runtime.mjs'
const resourceUrl=new URL(filename,base).href
const encode=(value:string)=>new TextEncoder().encode(value)
const pinsFor=(contents=code):ResourcePins=>({
  cacheName:'background-removal-test-v1',
  resources:{'/onnxruntime-web/ort-wasm-simd-threaded.mjs':{
    size:encode(contents).length,mime:'text/javascript',
    chunks:[{name:filename,offsets:[0,encode(contents).length]}],
  }},
  files:[{name:filename,size:encode(contents).length,sha256:createHash('sha256').update(contents).digest('hex')}],
})
const fetchMock=(handler:(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>)=>handler as typeof fetch
const noFetch=fetchMock(async()=>{throw new Error('Unexpected network request')})

function memoryCache(initial?:Response){
  let stored=initial,deleted=0,written=0
  const cache={
    async match(){return stored?.clone()},
    async delete(){stored=undefined;deleted++;return true},
    async put(_url:RequestInfo|URL,response:Response){stored=response.clone();written++},
  } as unknown as Cache
  return {
    storage:{open:async()=>cache},
    stats:()=>({deleted,written}),
    poison:(value:string)=>{stored=new Response(value)},
  }
}

test('resource manifest comes from repository pins without requesting the runtime CDN manifest',async()=>{
  const pins=pinsFor(),requests:unknown[]=[]
  const secureFetch=createVerifiedResourceFetch(base,origin,pins,fetchMock(async input=>{
    requests.push(input)
    return Response.json({'/onnxruntime-web/ort-wasm-simd-threaded.mjs':{
      size:4,mime:'text/javascript',chunks:[{name:'https://attacker.test/evil.mjs',offsets:[0,4]}],
    }})
  }))
  const response=await secureFetch(new URL('resources.json',base))
  assert.match(response.headers.get('content-type')??'',/application\/json/)
  assert.deepEqual(await response.json(),pins.resources)
  assert.deepEqual(requests,[])
  await assert.rejects(secureFetch('https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/resources.json'),ResourceIntegrityError)
  assert.deepEqual(requests,[])
})

test('only exact pinned resources are returned after SHA-256 verification',async()=>{
  const requests:string[]=[]
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async input=>{
    requests.push(String(input));return new Response(code)
  }))
  for(const input of [resourceUrl,new URL(resourceUrl),new Request(resourceUrl)])
    assert.equal(await (await secureFetch(input)).text(),code)
  assert.deepEqual(requests,[resourceUrl,resourceUrl,resourceUrl])
})

test('same-size malicious runtime bytes never reach the caller as an executable response',async()=>{
  const tampered=code.replace('verified','attacker')
  assert.equal(encode(tampered).length,encode(code).length)
  let delivered=false
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>new Response(tampered)))
  await assert.rejects(async()=>{
    await secureFetch(resourceUrl)
    delivered=true
  },/Resource digest mismatch/)
  assert.equal(delivered,false)
})

test('resource size checks reject truncated data and oversized declared responses',async()=>{
  const pins=pinsFor()
  const truncated=createVerifiedResourceFetch(base,origin,pins,fetchMock(async()=>new Response(code.slice(1))))
  await assert.rejects(truncated(resourceUrl),/Resource size mismatch/)
  let cancelled=false
  const oversized=createVerifiedResourceFetch(base,origin,pins,fetchMock(async()=>new Response(
    new ReadableStream<Uint8Array>({cancel(){cancelled=true}}),
    {headers:{'content-length':String(pins.files[0].size+1)}},
  )))
  await assert.rejects(oversized(resourceUrl),/Resource size mismatch/)
  assert.equal(cancelled,true)
})

test('streamed responses are cancelled as soon as they exceed the pinned byte limit',async()=>{
  let cancelled=false,pulls=0
  const stream=new ReadableStream<Uint8Array>({
    pull(controller){
      pulls++
      controller.enqueue(pulls===1?encode(code):new Uint8Array([0]))
    },
    cancel(){cancelled=true},
  })
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>new Response(stream)))
  await assert.rejects(secureFetch(resourceUrl),/Resource size mismatch/)
  assert.equal(cancelled,true)
  assert.ok(pulls<=3,'must stop consuming the response instead of buffering an unlimited stream')
})

test('foreign origins, queries, fragments, unpinned paths and non-GET requests are blocked without network access',async()=>{
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),noFetch)
  const blocked=[
    'https://attacker.test/runtime.mjs',
    `${resourceUrl}?version=1`,`${resourceUrl}#fragment`,
    new URL('unlisted.mjs',base).href,
    new URL('../runtime.mjs',base).href,
    `${origin}/elsewhere/${filename}`,
    new URL('resources.json?untrusted=1',base).href,
  ]
  for(const url of blocked)await assert.rejects(secureFetch(url),ResourceIntegrityError,url)
  await assert.rejects(secureFetch(resourceUrl,{method:'POST',body:'private image'}),ResourceIntegrityError)
  await assert.rejects(secureFetch(new Request(resourceUrl,{method:'POST',body:'private image'})),ResourceIntegrityError)
  await assert.rejects(secureFetch(new URL('resources.json',base),{method:'DELETE'}),ResourceIntegrityError)
})

test('pinned requests prohibit redirects and credentials instead of accepting caller fetch options',async()=>{
  const requests:{input:RequestInfo|URL;init?:RequestInit}[]=[]
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async(input,init)=>{
    requests.push({input,init});return new Response(code)
  }))
  assert.equal(await (await secureFetch(resourceUrl,{
    credentials:'include',redirect:'follow',cache:'force-cache',headers:{authorization:'secret'},
  })).text(),code)
  assert.deepEqual(requests,[{input:resourceUrl,init:{redirect:'error',credentials:'omit',cache:'no-cache'}}])
})

test('failed, opaque and already-redirected responses are rejected even with correct bytes',async()=>{
  const opaque=new Response(code),redirected=new Response(code)
  Object.defineProperty(opaque,'type',{value:'opaque'})
  Object.defineProperty(redirected,'redirected',{value:true})
  for(const response of [new Response(code,{status:503}),opaque,redirected]){
    const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>response))
    await assert.rejects(secureFetch(resourceUrl),/resource unavailable/)
  }
})

test('poisoned cache entries are discarded and replaced only with reverified network bytes',async()=>{
  const cache=memoryCache(new Response(code.replace('verified','attacker')))
  let requests=0
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>{
    requests++;return new Response(code)
  }),cache.storage)
  assert.equal(await (await secureFetch(resourceUrl)).text(),code)
  assert.equal(requests,1)
  assert.deepEqual(cache.stats(),{deleted:1,written:1})
  assert.equal(await (await secureFetch(resourceUrl)).text(),code)
  assert.equal(requests,1)
  cache.poison(code.replace('verified','attacker'))
  assert.equal(await (await secureFetch(resourceUrl)).text(),code)
  assert.equal(requests,2,'previously cached bytes must be checked again on a later read')
  assert.deepEqual(cache.stats(),{deleted:2,written:2})
})

test('a poisoned cache cannot make a matching malicious network response trusted',async()=>{
  const tampered=code.replace('verified','attacker'),cache=memoryCache(new Response(tampered))
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>new Response(tampered)),cache.storage)
  await assert.rejects(secureFetch(resourceUrl),/Resource digest mismatch/)
  assert.deepEqual(cache.stats(),{deleted:1,written:0})
})

test('unavailable or full Cache Storage falls back to verified network responses',async()=>{
  const unavailable={open:async()=>{throw new Error('Storage blocked')}}
  const failingOperations={open:async()=>({
    match:async()=>{throw new Error('Read blocked')},
    put:async()=>{throw new Error('Quota exceeded')},
  }) as unknown as Cache}
  for(const storage of [unavailable,failingOperations]){
    const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>new Response(code)),storage)
    assert.equal(await (await secureFetch(resourceUrl)).text(),code)
  }
})

test('concurrent reads reuse one verification job but return independently consumable responses',async()=>{
  let resolveFetch!:(response:Response)=>void,requests=0
  const firstFetch=new Promise<Response>(resolve=>{resolveFetch=resolve})
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>{
    requests++;return requests===1?firstFetch:new Response(code)
  }))
  const first=secureFetch(resourceUrl),second=secureFetch(resourceUrl)
  await new Promise<void>(resolve=>queueMicrotask(resolve))
  assert.equal(requests,1)
  resolveFetch(new Response(code))
  const responses=await Promise.all([first,second])
  assert.notEqual(responses[0],responses[1])
  assert.deepEqual(await Promise.all(responses.map(response=>response.text())),[code,code])
  assert.equal(await (await secureFetch(resourceUrl)).text(),code)
  assert.equal(requests,2,'finished in-flight entries must not become an unchecked permanent memory cache')
})

test('failed in-flight verification is cleared so a later valid response can be retried',async()=>{
  let requests=0
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async()=>{
    requests++;return new Response(requests===1?code.replace('verified','attacker'):code)
  }))
  await assert.rejects(secureFetch(resourceUrl),/Resource digest mismatch/)
  assert.equal(await (await secureFetch(resourceUrl)).text(),code)
  assert.equal(requests,2)
})

test('invalid resource roots or repository pins fail before making any request',()=>{
  for(const root of [new URL('https://attacker.test/background-removal/'),new URL('/background-removal',origin),new URL('file:///background-removal/')])
    assert.throws(()=>createVerifiedResourceFetch(root,origin,pinsFor(),noFetch),ResourceIntegrityError)
  for(const file of [
    {...pinsFor().files[0],sha256:'untrusted'},
    {...pinsFor().files[0],name:'../runtime.mjs'},
    {...pinsFor().files[0],size:0},
    {...pinsFor().files[0],size:Number.POSITIVE_INFINITY},
  ])assert.throws(()=>createVerifiedResourceFetch(base,origin,{...pinsFor(),files:[file]},noFetch),ResourceIntegrityError)
})

test('only same-origin WASM Blob fetches can pass through, while foreign blobs and POSTs are blocked',async()=>{
  const requests:unknown[]=[]
  const secureFetch=createVerifiedResourceFetch(base,origin,pinsFor(),fetchMock(async(input,init)=>{
    requests.push({input,init});return new Response('verified WASM Blob')
  }))
  const local=`blob:${origin}/verified-id`
  assert.equal(await (await secureFetch(local)).text(),'verified WASM Blob')
  await assert.rejects(secureFetch('blob:https://attacker.test/untrusted-id'),ResourceIntegrityError)
  await assert.rejects(secureFetch(local,{method:'POST'}),ResourceIntegrityError)
  assert.deepEqual(requests,[{input:local,init:undefined}])
})
