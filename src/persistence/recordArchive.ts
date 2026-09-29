import {AppError} from '../i18n/runtime.ts'
import { isBoard } from '../domain/model.ts'
import type { Board } from '../domain/model.ts'
import { migrateBoard, validRecord } from '../domain/records.ts'
import type { CollectionRecord } from '../domain/records.ts'
import {boardMembers} from '../domain/medalExhibit.ts'

async function encodeBlob(blob:Blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary=''
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768))
  return `data:${blob.type};base64,${btoa(binary)}`
}
function decodeBlob(value:unknown):Blob|undefined{
  if(value===undefined)return undefined
  if(typeof value!=='string'||value.length>29*1024*1024)throw new AppError("recordArchive.012")
  const match=/^data:(image\/(?:png|jpeg|webp)|application\/gpx\+xml|application\/xml|text\/xml);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value)
  if(!match)throw new AppError("recordArchive.011")
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
  return new Blob([bytes],{type:match[1]})
}
export async function makeArchive(board:Board,records:CollectionRecord[]){
  if(!isBoard(board)||records.some(r=>!validRecord(r)))throw new AppError("recordArchive.010")
  const ids=new Set(records.map(r=>r.id))
  if(boardMembers(board.items).some(i=>i.recordId&&!ids.has(i.recordId)))throw new AppError("recordArchive.009")
  const packed=[]
  for(const r of records){
    if(r.kind==='photo')packed.push({...r,image:await encodeBlob(r.image)})
    else if((r.kind==='medal'||r.kind==='bib'||r.kind==='sticker'))packed.push({...r,image:r.image?await encodeBlob(r.image):undefined,originalImage:r.originalImage?await encodeBlob(r.originalImage):undefined})
    else packed.push({...r,gpx:r.gpx?await encodeBlob(r.gpx):undefined})
  }
  const json=JSON.stringify({format:'racememoir',version:2,board,records:packed})
  if(new Blob([json]).size>80*1024*1024)throw new AppError("recordArchive.008")
  return json
}
export function readArchive(text:string):{board:Board;records:CollectionRecord[]}{
  if(text.length>80*1024*1024)throw new AppError("App.067")
  const raw:unknown=JSON.parse(text)
  let board:Board, records:CollectionRecord[]
  if(isBoard(raw)){
    const migrated=migrateBoard(raw,[]);board=migrated.board;records=migrated.created
  }else{
    const a=raw as {format?:unknown;version?:unknown;board?:unknown;records?:unknown}
    if(!a||a.format!=='racememoir'||a.version!==2||!isBoard(a.board)||!Array.isArray(a.records))throw new AppError("recordArchive.007")
    board=a.board
    records=a.records.map(value=>{
      if(!value||typeof value!=='object')throw new AppError("recordArchive.006")
      const r=value as Record<string,unknown>
      const decoded=r.kind==='photo'?{...r,image:decodeBlob(r.image)}:(r.kind==='medal'||r.kind==='bib'||r.kind==='sticker')?{...r,image:decodeBlob(r.image),originalImage:decodeBlob(r.originalImage)}:{...r,gpx:decodeBlob(r.gpx)}
      if(!validRecord(decoded))throw new AppError("recordArchive.005")
      return decoded
    })
  }
  return restoreArchive(board,records)
}
export function restoreArchive(board:Board,records:CollectionRecord[]){
  if(!isBoard(board)||records.some(r=>!validRecord(r)))throw new AppError("recordArchive.004")
  const ids=new Map(records.map(r=>[r.id,r]))
  if(ids.size!==records.length)throw new AppError("recordArchive.003")
  for(const item of boardMembers(board.items)){
    if(item.recordId){const r=ids.get(item.recordId);if(!r||(item.kind==='medal'?r.kind!=='medal':item.kind==='photo'?r.kind!=='photo':item.kind==='bib'?r.kind!=='bib':item.kind==='sticker'?r.kind!=='sticker':r.kind!=='route'))throw new AppError("recordArchive.002")}
  }
  for(const t of board.threads)for(const id of [t.fromRaceId,t.toRaceId]){if(id!==undefined&&(!ids.has(id)||!['medal','route'].includes(ids.get(id)!.kind)))throw new AppError("recordArchive.001")}
  // Import always allocates new ids; it must not overwrite records used elsewhere.
  const remap=new Map(records.map(r=>[r.id,crypto.randomUUID()]))
  const remapItem=(i:Board['items'][number])=>i.recordId?{...i,recordId:remap.get(i.recordId)!}:i
  return {board:{...board,items:board.items.map(i=>i.exhibit?{...i,exhibit:{...i.exhibit,medals:i.exhibit.medals.map(remapItem)}}:remapItem(i)),threads:board.threads.map(t=>({...t,...(t.fromRaceId?{fromRaceId:remap.get(t.fromRaceId)!}:{}),...(t.toRaceId?{toRaceId:remap.get(t.toRaceId)!}:{})}))},records:records.map(r=>({...r,id:remap.get(r.id)!}))}
}
