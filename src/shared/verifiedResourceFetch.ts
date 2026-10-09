export interface ResourceChunkPin {name:string;size:number;sha256:string}
export interface ResourceEntryPin {
  size:number;mime:string;chunks:({name:string;offsets:[number,number]})[]
}
export interface ResourcePins {
  cacheName:string
  resources:Record<string,ResourceEntryPin>
  files:ResourceChunkPin[]
}

export class ResourceIntegrityError extends Error {
  constructor(message:string){super(message);this.name='ResourceIntegrityError'}
}

async function verifiedBytes(response:Response,pin:ResourceChunkPin){
  if(!response.ok||response.type==='opaque'||response.redirected)
    throw new ResourceIntegrityError(`Background-removal resource unavailable: ${pin.name}`)
  // Bound streamed responses too; Content-Length alone is not trustworthy.
  const reader=response.body?.getReader(),parts:Uint8Array[]=[],length=Number(response.headers.get('content-length'))
  if(length>pin.size){await reader?.cancel();throw new ResourceIntegrityError(`Resource size mismatch: ${pin.name}`)}
  let size=0
  if(reader){
    try{
      for(;;){
        const {done,value}=await reader.read();if(done)break
        size+=value.length
        if(size>pin.size)throw new ResourceIntegrityError(`Resource size mismatch: ${pin.name}`)
        parts.push(value)
      }
    }catch(error){await reader.cancel().catch(()=>{});throw error}
    finally{reader.releaseLock()}
  }
  if(size!==pin.size)throw new ResourceIntegrityError(`Resource size mismatch: ${pin.name}`)
  const bytes=new Uint8Array(size);let offset=0
  for(const part of parts){bytes.set(part,offset);offset+=part.length}
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  const hex=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
  if(hex!==pin.sha256)throw new ResourceIntegrityError(`Resource digest mismatch: ${pin.name}`)
  return bytes
}

/** Only verified bytes reach IMG.LY's Blob URLs and subsequent dynamic import. */
export function createVerifiedResourceFetch(
  base:URL,origin:string,pins:ResourcePins,nativeFetch:typeof fetch,
  cacheStorage?:Pick<CacheStorage,'open'>,
):typeof fetch {
  if(base.origin!==origin||!['http:','https:'].includes(base.protocol)||!base.pathname.endsWith('/'))
    throw new ResourceIntegrityError('Background-removal resources must be same-origin')
  const files=new Map(pins.files.map(pin=>{
    if(!/^[a-f0-9]{64}$/.test(pin.sha256)||!Number.isSafeInteger(pin.size)||pin.size<=0||
      !/^[a-zA-Z0-9._-]+$/.test(pin.name)||pin.name==='.'||pin.name==='..')throw new ResourceIntegrityError('Invalid resource lock')
    return [new URL(pin.name,base).href,pin] as const
  }))
  const manifest=JSON.stringify(pins.resources),manifestUrl=new URL('resources.json',base).href
  const pending=new Map<string,Promise<Uint8Array<ArrayBuffer>>>()
  const cache=cacheStorage?Promise.resolve().then(()=>cacheStorage.open(pins.cacheName)).catch(()=>undefined):undefined
  const read=async(url:string,pin:ResourceChunkPin)=>{
    const store=await cache
    try{
      const cached=await store?.match(url)
      if(cached){
        try{return await verifiedBytes(cached,pin)}
        catch{await store?.delete(url)} // Never execute unverified cache contents.
      }
    }catch{/* Cache Storage may be unavailable in private browsing. */}
    const response=await nativeFetch(url,{redirect:'error',credentials:'omit',cache:'no-cache'})
    const bytes=await verifiedBytes(response,pin)
    try{await store?.put(url,new Response(bytes))}catch{/* A full cache must not prevent processing. */}
    return bytes
  }
  return async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,base)
    const method=init?.method??(input instanceof Request?input.method:'GET')
    if(method!=='GET')throw new ResourceIntegrityError('Unexpected background-removal request')
    // ONNX fetches the WASM Blob assembled from the verified resource chunks.
    if(url.protocol==='blob:'&&url.origin===origin)return nativeFetch(input,init)
    if(url.href===manifestUrl)return new Response(manifest,{headers:{'content-type':'application/json'}})
    const pin=files.get(url.href)
    if(!pin)throw new ResourceIntegrityError('Unpinned background-removal resource blocked')
    let task=pending.get(url.href)
    if(!task){
      task=read(url.href,pin);pending.set(url.href,task)
      void task.finally(()=>pending.delete(url.href)).catch(()=>{})
    }
    return new Response(await task)
  }
}
