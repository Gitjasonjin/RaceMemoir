const CACHE='racememoir-route-tiles-v1',WEEK=7*24*60*60*1000
const pending=new Map<string,Promise<string>>()
const memory=new Map<string,{image:string;expires:number}>()
let active=0
const queue:Array<()=>void>=[]
async function limited<T>(run:()=>Promise<T>):Promise<T>{
  if(active>=3)await new Promise<void>(resolve=>queue.push(resolve))
  else active++
  try{return await run()}finally{const next=queue.shift();if(next)next();else active--}
}
function expires(response:Response){
  if(/no-store|no-cache/i.test(response.headers.get('cache-control')||''))return 0
  const saved=Number(response.headers.get('x-racememoir-cached-at'))||Date.now()
  const age=response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]
  const until=Date.parse(response.headers.get('expires')||'')
  return age?saved+Number(age)*1000:Number.isFinite(until)?until:saved+WEEK
}
function dataUrl(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(new Error('底图读取失败'));reader.readAsDataURL(blob)})
}
async function load(url:string){
  let cache:Cache|undefined,cached:Response|undefined
  try{cache=await caches.open(CACHE);cached=await cache.match(url)}catch{/* Storage-disabled browsers can still display the map. */}
  let response=cached
  if(!cached||expires(cached)<=Date.now()){
    try{
      response=await limited(async()=>{
        const fetched=await fetch(url,{signal:AbortSignal.timeout(15000),referrerPolicy:'strict-origin-when-cross-origin'})
        if(!fetched.ok||!fetched.headers.get('content-type')?.startsWith('image/'))throw new Error('底图暂不可用')
        const blob=await fetched.blob(),bitmap=await createImageBitmap(blob);bitmap.close()
        const headers=new Headers(fetched.headers)
        headers.set('x-racememoir-cached-at',String(Date.now()-Number(headers.get('age')||0)*1000))
        return new Response(blob,{headers})
      })
      try{
        if(!/no-store|no-cache/i.test(response.headers.get('cache-control')||''))await cache?.put(url,response.clone())
        else await cache?.delete(url)
      }catch{/* Quota errors do not discard the downloaded image. */}
    }catch(error){if(!cached)throw error;response=cached}
  }
  const blob=await response!.blob()
  try{const bitmap=await createImageBitmap(blob);bitmap.close()}
  catch(error){try{await cache?.delete(url)}catch{/* Retry can use the network. */}throw error}
  const image=await dataUrl(blob)
  if(memory.size>=64)memory.delete(memory.keys().next().value!)
  memory.set(url,{image,expires:expires(response!)})
  return image
}
/** Only request tiles for a displayed card or an explicitly requested board export. */
export function loadRouteTile(url:string):Promise<string>{
  const value=memory.get(url)
  if(value&&value.expires>Date.now())return Promise.resolve(value.image)
  let request=pending.get(url)
  if(!request){request=load(url).finally(()=>pending.delete(url));pending.set(url,request)}
  return request
}
