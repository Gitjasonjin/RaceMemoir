import {createHash} from 'node:crypto'
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

const MODEL='/models/isnet_fp16'
const MJS='/onnxruntime-web/ort-wasm-simd-threaded.mjs'
const WASM='/onnxruntime-web/ort-wasm-simd-threaded.wasm'
const KEYS=[MODEL,MJS,WASM]
const HASH=/^[a-f0-9]{64}$/
const CHUNK_LIMIT=4*1024*1024
const LICENSE_FILES=['onnxruntime-MIT.txt','ISNET-LICENSE.txt','background-removal-NOTICE.txt']
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')

/** The lock is reviewed source, never refreshed from a remote manifest by this script. */
export function validateResourceLock(lock){
  if(lock?.version!=='1.7.0'||lock.publicPath!=='/background-removal/1.7.0/'||
    Object.keys(lock.resources??{}).sort().join('|')!==[...KEYS].sort().join('|'))throw new Error('Unexpected background-removal resource lock')
  let total=0
  for(const [key,resource] of Object.entries(lock.resources)){
    if(!Number.isSafeInteger(resource.size)||resource.size<1||!Array.isArray(resource.chunks)||!resource.chunks.length)throw new Error(`Invalid resource: ${key}`)
    if(resource.mime!==(key===MJS?'text/javascript':key===WASM?'application/wasm':'application/octet-stream'))throw new Error(`Invalid MIME: ${key}`)
    let offset=0
    for(const chunk of resource.chunks){
      if(!HASH.test(chunk.name)||chunk.name!==chunk.sha256||!Array.isArray(chunk.offsets)||chunk.offsets.length!==2||
        !chunk.offsets.every(Number.isSafeInteger)||chunk.offsets[0]!==offset||chunk.offsets[1]<=offset||
        chunk.offsets[1]-offset>CHUNK_LIMIT)throw new Error(`Invalid chunk: ${key}`)
      offset=chunk.offsets[1]
    }
    if(offset!==resource.size)throw new Error(`Invalid resource size: ${key}`)
    if(key===MODEL){
      if(resource.source?.kind!=='https'||resource.source.baseUrl!=='https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/')throw new Error('Unexpected model source')
    }else if(resource.source?.kind!=='npm'||resource.source.package!=='onnxruntime-web'||resource.source.version!=='1.21.0'||
      resource.source.file!==`dist/${key.split('/').at(-1)}`||!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(resource.source.integrity)||!HASH.test(resource.sha256))throw new Error(`Unexpected runtime source: ${key}`)
    total+=resource.size
  }
  if(total>128*1024*1024)throw new Error('Background-removal resource budget exceeded')
  return lock
}

export function verifyChunk(bytes,chunk){
  if(bytes.byteLength!==chunk.offsets[1]-chunk.offsets[0]||sha256(bytes)!==chunk.sha256)throw new Error(`Background-removal resource integrity mismatch: ${chunk.name}`)
}

async function readVerified(path,chunk){
  try{const bytes=await readFile(path);verifyChunk(bytes,chunk);return bytes}catch{return undefined}
}

async function downloadChunk(url,chunk,fetchImpl){
  // Redirects cannot silently move the trusted download to another origin.
  const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(120_000)})
  if(!response.ok||!response.body)throw new Error(`Resource download failed: ${response.status}`)
  const expected=chunk.offsets[1]-chunk.offsets[0],reader=response.body.getReader(),parts=[]
  let size=0
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break
      size+=value.byteLength
      if(size>expected)throw new Error(`Oversized background-removal resource: ${chunk.name}`)
      parts.push(value)
    }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=Buffer.concat(parts,size);verifyChunk(bytes,chunk);return bytes
}

export async function prepareResources({root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),check=false,fetchImpl=fetch,log=console.log}={}){
  const lock=validateResourceLock(JSON.parse(await readFile(resolve(root,'resources/background-removal.lock.json'),'utf8')))
  const destination=resolve(root,`public${lock.publicPath}`)
  if(!check)await mkdir(destination,{recursive:true})
  for(const [key,resource] of Object.entries(lock.resources)){
    let source
    for(const chunk of resource.chunks){
      const path=resolve(destination,chunk.name)
      if(await readVerified(path,chunk))continue
      if(check)throw new Error(`Missing or invalid background-removal resource: ${chunk.name}. Run npm run prepare:cutout.`)
      let bytes
      if(resource.source.kind==='npm'){
        if(!source){
          const installed=JSON.parse(await readFile(resolve(root,'node_modules/onnxruntime-web/package.json'),'utf8'))
          const packageLock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8')).packages['node_modules/onnxruntime-web']
          if(installed.version!==resource.source.version||packageLock?.version!==resource.source.version||packageLock.integrity!==resource.source.integrity)throw new Error('onnxruntime-web differs from reviewed resource lock; run npm ci')
          source=await readFile(resolve(root,'node_modules/onnxruntime-web',resource.source.file))
          if(source.length!==resource.size||sha256(source)!==resource.sha256)throw new Error(`Installed runtime integrity mismatch: ${key}`)
        }
        bytes=source.subarray(...chunk.offsets);verifyChunk(bytes,chunk)
      }else{
        log(`Preparing background-removal model chunk ${chunk.name.slice(0,12)}…`)
        bytes=await downloadChunk(new URL(chunk.name,resource.source.baseUrl),chunk,fetchImpl)
      }
      const partial=`${path}.partial`
      try{await writeFile(partial,bytes);await rename(partial,path)}finally{await rm(partial,{force:true})}
    }
  }
  for(const name of LICENSE_FILES){
    const expected=await readFile(resolve(root,'resources/licenses',name)),path=resolve(destination,name)
    if(check){
      const actual=await readFile(path).catch(()=>undefined)
      if(!actual?.equals(expected))throw new Error(`Missing or invalid background-removal license notice: ${name}`)
    }else await writeFile(path,expected)
  }
  log(`Background-removal resources verified (${Object.values(lock.resources).reduce((sum,r)=>sum+r.chunks.length,0)} chunks, ${(Object.values(lock.resources).reduce((sum,r)=>sum+r.size,0)/1024/1024).toFixed(1)} MiB).`)
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.slice(2).some(argument=>argument!=='--check'))throw new Error('Usage: node scripts/prepare-background-removal.mjs [--check]')
  await prepareResources({check:process.argv.includes('--check')})
}
