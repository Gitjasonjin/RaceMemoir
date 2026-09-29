import {AppError} from '../i18n/runtime.ts'
import {zip,unzip,strToU8,strFromU8} from 'fflate'
import type {AsyncZippable,Unzipped} from 'fflate'
import type {Board} from '../domain/model'
import {isBoard} from '../domain/model.ts'
import type {CollectionRecord} from '../domain/records'
import {validRecord} from '../domain/records.ts'
import {readArchive,restoreArchive} from './recordArchive.ts'

const LIMIT=80*1024*1024
const META_LIMIT=16*1024*1024
interface Asset {path:string;mime:string;size:number;sha256:string}
const types:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/gpx+xml':'gpx','application/xml':'xml','text/xml':'xml'}
async function checksum(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(b=>b.toString(16).padStart(2,'0')).join('')}

export async function makeZipArchive(board:Board,records:CollectionRecord[]):Promise<Blob>{
  // Validate all references before starting any expensive encoding.
  restoreArchive(board,records)
  const entries:AsyncZippable={},packed=[]
  let total=0
  const add=async(blob:Blob|undefined):Promise<Asset|undefined>=>{
    if(!blob)return undefined
    if(!types[blob.type])throw new AppError("zipArchive.012")
    const bytes=new Uint8Array(await blob.arrayBuffer()),hash=await checksum(bytes),path=`assets/${hash}.${types[blob.type]}`
    if(!entries[path]){total+=bytes.length;if(total>LIMIT)throw new AppError("zipArchive.011");entries[path]=[bytes,{level:blob.type.startsWith('image/')?0:6}]}
    return {path,mime:blob.type,size:bytes.length,sha256:hash}
  }
  for(const record of records){
    if(record.kind==='photo')packed.push({...record,image:await add(record.image)})
    else if((record.kind==='medal'||record.kind==='bib'||record.kind==='sticker'))packed.push({...record,image:await add(record.image),originalImage:await add(record.originalImage)})
    else packed.push({...record,gpx:await add(record.gpx)})
  }
  const metadata=strToU8(JSON.stringify({format:'racememoir',version:8,board,records:packed},null,2))
  if(metadata.length>META_LIMIT||total+metadata.length>LIMIT)throw new AppError("zipArchive.010")
  entries['manifest.json']=metadata
  const bytes=await new Promise<Uint8Array<ArrayBuffer>>((resolve,reject)=>zip(entries,{level:6},(error,data)=>error?reject(error):resolve(data)))
  if(bytes.length>LIMIT)throw new AppError("zipArchive.009")
  return new Blob([bytes],{type:'application/zip'})
}

export async function readBackup(file:Blob){
  if(file.size>LIMIT)throw new AppError("App.067")
  const bytes=new Uint8Array(await file.arrayBuffer())
  if(bytes[0]!==0x50||bytes[1]!==0x4b)return readArchive(new TextDecoder().decode(bytes))
  let total=0,count=0,invalid=false
  const entries=await new Promise<Unzipped>((resolve,reject)=>unzip(bytes,{filter:entry=>{
    total+=entry.originalSize;count++
    const allowed=entry.name==='manifest.json'||/^assets\/[a-f0-9]{64}\.(png|jpg|webp|gpx|xml)$/.test(entry.name)
    if(!allowed||count>10000||!Number.isFinite(entry.originalSize)||entry.originalSize>(entry.name==='manifest.json'?META_LIMIT:20*1024*1024)||total>LIMIT){invalid=true;return false}
    return true
  }},(error,result)=>error?reject(new AppError("zipArchive.008")):resolve(result)))
  if(invalid||!entries['manifest.json'])throw new AppError("zipArchive.007")
  const manifest=JSON.parse(strFromU8(entries['manifest.json']))
  if(!manifest||manifest.format!=='racememoir'||![3,4,5,6,7,8].includes(manifest.version)||!isBoard(manifest.board)||!Array.isArray(manifest.records)||manifest.records.length>10000)throw new AppError("zipArchive.006")
  const cache=new Map<string,Blob>()
  const read=async(value:unknown):Promise<Blob|undefined>=>{
    if(value===undefined)return undefined
    if(!value||typeof value!=='object')throw new AppError("zipArchive.005")
    const a=value as Asset
    if(typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256)||!types[a.mime]||a.path!==`assets/${a.sha256}.${types[a.mime]}`)throw new AppError("zipArchive.005")
    const data=entries[a.path]
    if(!data||data.length!==a.size)throw new AppError("zipArchive.004")
    const key=`${a.path}:${a.mime}`
    if(!cache.has(key)){
      if(await checksum(data)!==a.sha256)throw new AppError("zipArchive.003")
      cache.set(key,new Blob([new Uint8Array(data)],{type:a.mime}))
    }
    return cache.get(key)!
  }
  const records:CollectionRecord[]=[]
  for(const r of manifest.records){
    if(!r||typeof r!=='object')throw new AppError("zipArchive.002")
    const decoded=r.kind==='photo'?{...r,image:await read(r.image)}:(r.kind==='medal'||r.kind==='bib'||r.kind==='sticker')?{...r,image:await read(r.image),originalImage:await read(r.originalImage)}:{...r,gpx:await read(r.gpx)}
    if(!validRecord(decoded))throw new AppError("zipArchive.001")
    records.push(decoded)
  }
  return restoreArchive(manifest.board as Board,records)
}
