import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,writeFile,rm,cp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {prepareResources,validateResourceLock,verifyChunk} from '../scripts/prepare-background-removal.mjs'

const lock=JSON.parse(await readFile(new URL('../resources/background-removal.lock.json',import.meta.url),'utf8'))
const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')

test('resource packaging rejects redirected sources, unsafe names, and discontinuous offsets',()=>{
  assert.equal(validateResourceLock(lock),lock)
  for(const change of [
    (copy:any)=>{copy.resources['/models/isnet_fp16'].source.baseUrl='https://attacker.invalid/'},
    (copy:any)=>{copy.resources['/models/isnet_fp16'].chunks[0].name='../outside'},
    (copy:any)=>{copy.resources['/models/isnet_fp16'].chunks[1].offsets[0]++},
    (copy:any)=>{copy.resources['/onnxruntime-web/ort-wasm-simd-threaded.mjs'].source.file='../../secret'},
  ]){
    const copy=structuredClone(lock);change(copy)
    assert.throws(()=>validateResourceLock(copy))
  }
})

test('chunk verification rejects same-size substitution and truncated content',()=>{
  const bytes=Buffer.from('trusted runtime'),hash=sha256(bytes),chunk={name:hash,sha256:hash,offsets:[0,bytes.length]}
  assert.doesNotThrow(()=>verifyChunk(bytes,chunk))
  assert.throws(()=>verifyChunk(Buffer.from('altered runtime'),chunk),/integrity mismatch/)
  assert.throws(()=>verifyChunk(bytes.subarray(1),chunk),/integrity mismatch/)
})

test('preparation reuses verified local assets offline; check catches corruption without downloading',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'racememoir-cutout-'))
  try{
    const fixture=structuredClone(lock),sources=new Map<string,Buffer>()
    for(const [key,resource] of Object.entries(fixture.resources) as [string,any][]){
      const bytes=Buffer.from(`trusted ${key}`),hash=sha256(bytes)
      resource.size=bytes.length;resource.sha256=hash;resource.chunks=[{name:hash,sha256:hash,offsets:[0,bytes.length]}]
      sources.set(key,bytes)
      if(resource.source.kind==='npm'){
        const path=resolve(root,'node_modules/onnxruntime-web',resource.source.file)
        await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,bytes)
      }
    }
    await mkdir(resolve(root,'resources'),{recursive:true})
    await cp(new URL('../resources/licenses',import.meta.url),resolve(root,'resources/licenses'),{recursive:true})
    await writeFile(resolve(root,'resources/background-removal.lock.json'),JSON.stringify(fixture))
    await writeFile(resolve(root,'node_modules/onnxruntime-web/package.json'),JSON.stringify({version:'1.21.0'}))
    await writeFile(resolve(root,'package-lock.json'),JSON.stringify({packages:{'node_modules/onnxruntime-web':{version:'1.21.0',integrity:fixture.resources['/onnxruntime-web/ort-wasm-simd-threaded.mjs'].source.integrity}}}))
    let requests=0
    await prepareResources({root,log:()=>{},fetchImpl:async(_url:URL,options:any)=>{
      requests++;assert.equal(options.redirect,'error')
      return new Response(sources.get('/models/isnet_fp16'))
    }})
    assert.equal(requests,1)
    const offline=async()=>{throw new Error('network must not be used')}
    await prepareResources({root,log:()=>{},fetchImpl:offline})
    await prepareResources({root,check:true,log:()=>{},fetchImpl:offline})
    const modelChunk=fixture.resources['/models/isnet_fp16'].chunks[0]
    await writeFile(resolve(root,`public${fixture.publicPath}`,modelChunk.name),Buffer.alloc(modelChunk.offsets[1]))
    await assert.rejects(prepareResources({root,check:true,log:()=>{},fetchImpl:offline}),/Missing or invalid/)
  }finally{await rm(root,{recursive:true,force:true})}
})
