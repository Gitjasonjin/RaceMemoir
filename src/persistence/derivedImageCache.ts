/** Disposable display assets; original uploads remain in the collection database. */
export interface DerivedImage {blob:Blob;width:number;height:number}

const DATABASE='racememoir-derived-images-v1',STORE='images'
const MAX_BYTES=64*1024*1024,MAX_ENTRY_BYTES=16*1024*1024,MAX_ENTRIES=64
interface CachedImage extends DerivedImage {key:string;accessedAt:number}
const hashes=new WeakMap<Blob,Promise<string>>()
const pending=new Map<string,Promise<DerivedImage>>()
let mutations:Promise<unknown>=Promise.resolve(),lastAccess=0

function validImage(value:unknown):value is DerivedImage {
  if(!value||typeof value!=='object')return false
  const image=value as DerivedImage
  return image.blob instanceof Blob&&image.blob.type==='image/png'&&image.blob.size>0&&Number.isSafeInteger(image.width)&&image.width>0&&image.width<=32768&&Number.isSafeInteger(image.height)&&image.height>0&&image.height<=32768&&image.width*image.height<=64*1024*1024
}
async function validPng(image:DerivedImage){
  try{
    const bytes=new Uint8Array(await image.blob.slice(0,33).arrayBuffer())
    if(bytes.length<33||![137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte))return false
    const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
    return header.getUint32(8)===13&&header.getUint32(12)===0x49484452&&header.getUint32(16)===image.width&&header.getUint32(20)===image.height
  }catch{return false}
}
function validEntry(value:unknown):value is CachedImage {
  const entry=value as CachedImage
  return validImage(value)&&typeof entry.key==='string'&&Number.isFinite(entry.accessedAt)&&entry.blob.size<=MAX_ENTRY_BYTES
}
function accessedAt(){return lastAccess=Math.max(Date.now(),lastAccess+1)}
function serialized<T>(operation:()=>Promise<T>):Promise<T>{
  const task=mutations.then(operation,operation)
  mutations=task.catch(()=>undefined)
  return task
}
function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1)
    let rejected=false
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'key'})
    request.onerror=()=>{rejected=true;reject(request.error||new Error('Derived cache unavailable'))}
    request.onblocked=()=>{rejected=true;reject(new Error('Derived cache blocked'))}
    request.onsuccess=()=>{
      const db=request.result
      if(rejected){db.close();return}
      db.onversionchange=()=>db.close()
      resolve(db)
    }
  })
}
async function transaction<T>(run:(store:IDBObjectStore,setResult:(value:T)=>void)=>void):Promise<T>{
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    let result:T,tx:IDBTransaction
    try{tx=db.transaction(STORE,'readwrite')}catch(error){db.close();reject(error);return}
    tx.oncomplete=()=>{db.close();resolve(result)}
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error('Derived cache unavailable'))}
    try{run(tx.objectStore(STORE),value=>{result=value})}catch(error){tx.abort();reject(error)}
  })
}
function read(key:string){
  return transaction<DerivedImage|undefined>((store,setResult)=>{
    const request=store.get(key)
    request.onsuccess=()=>{
      try{
        const entry:unknown=request.result
        if(!validEntry(entry)||entry.key!==key){if(entry!==undefined)store.delete(key);setResult(undefined);return}
        store.put({...entry,accessedAt:accessedAt()})
        setResult({blob:entry.blob,width:entry.width,height:entry.height})
      }catch{store.transaction.abort()}
    }
  })
}
function write(key:string,image:DerivedImage){
  return transaction<void>((store,setResult)=>{
    const request=store.getAll()
    request.onsuccess=()=>{
      try{
        const entries:CachedImage[]=[]
        for(const value of request.result){
          if(validEntry(value)){if(value.key!==key)entries.push(value)}
          else store.delete(value.key)
        }
        entries.sort((a,b)=>a.accessedAt-b.accessedAt)
        let bytes=image.blob.size+entries.reduce((total,entry)=>total+entry.blob.size,0)
        while(entries.length>=MAX_ENTRIES||bytes>MAX_BYTES){
          const oldest=entries.shift()!
          bytes-=oldest.blob.size;store.delete(oldest.key)
        }
        store.put({...image,key,accessedAt:accessedAt()})
        setResult(undefined)
      }catch{store.transaction.abort()}
    }
  })
}
async function digest(bytes:BufferSource){
  const hash=await crypto.subtle.digest('SHA-256',bytes)
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('')
}
function sourceHash(blob:Blob){
  let task=hashes.get(blob)
  if(!task){
    task=blob.arrayBuffer().then(digest)
    hashes.set(blob,task)
    void task.catch(()=>hashes.delete(blob))
  }
  return task
}

/** Hashing, storage denial and quota failures never prevent rendering. */
export async function cachedDerivedImage(sources:readonly Blob[],variant:string,create:()=>Promise<DerivedImage>):Promise<DerivedImage>{
  let key:string
  try{key=await digest(new TextEncoder().encode(JSON.stringify([variant,await Promise.all(sources.map(sourceHash))])))}
  catch{return create()}
  const existing=pending.get(key)
  if(existing)return existing
  const task=(async()=>{
    const stored=await serialized(()=>read(key)).catch(()=>undefined)
    if(stored&&await validPng(stored))return stored
    const image=await create()
    if(validImage(image)&&image.blob.size<=MAX_ENTRY_BYTES&&await validPng(image))await serialized(()=>write(key,image)).catch(()=>undefined)
    return image
  })()
  pending.set(key,task)
  void task.then(()=>pending.delete(key),()=>pending.delete(key))
  return task
}
