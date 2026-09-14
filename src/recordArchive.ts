import { isBoard } from './model.ts'
import type { Board } from './model.ts'
import { migrateBoard, validRecord } from './records.ts'
import type { CollectionRecord } from './records.ts'

async function encodeBlob(blob:Blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary=''
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768))
  return `data:${blob.type};base64,${btoa(binary)}`
}
function decodeBlob(value:unknown):Blob|undefined{
  if(value===undefined)return undefined
  if(typeof value!=='string'||value.length>29*1024*1024)throw new Error('备份中的文件无效或过大')
  const match=/^data:(image\/(?:png|jpeg|webp)|application\/gpx\+xml|application\/xml|text\/xml);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value)
  if(!match)throw new Error('备份包含不支持的文件格式')
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
  return new Blob([bytes],{type:match[1]})
}
export async function makeArchive(board:Board,records:CollectionRecord[]){
  if(!isBoard(board)||records.some(r=>!validRecord(r)))throw new Error('收藏板或记录无效，无法生成完整备份')
  const ids=new Set(records.map(r=>r.id))
  if(board.items.some(i=>i.recordId&&!ids.has(i.recordId)))throw new Error('存在丢失的收藏记录，请先恢复记录或移除对应物件再备份')
  const packed=[]
  for(const r of records){
    if(r.kind==='photo')packed.push({...r,image:await encodeBlob(r.image)})
    else if(r.kind==='medal')packed.push({...r,image:r.image?await encodeBlob(r.image):undefined,originalImage:r.originalImage?await encodeBlob(r.originalImage):undefined})
    else packed.push({...r,gpx:r.gpx?await encodeBlob(r.gpx):undefined})
  }
  const json=JSON.stringify({format:'racememoir',version:2,board,records:packed})
  if(new Blob([json]).size>80*1024*1024)throw new Error('完整备份超过 80 MB，请缩小奖牌图片后重试')
  return json
}
export function readArchive(text:string):{board:Board;records:CollectionRecord[]}{
  if(text.length>80*1024*1024)throw new Error('备份文件不能超过 80 MB')
  const raw:unknown=JSON.parse(text)
  let board:Board, records:CollectionRecord[]
  if(isBoard(raw)){
    const migrated=migrateBoard(raw,[]);board=migrated.board;records=migrated.created
  }else{
    const a=raw as {format?:unknown;version?:unknown;board?:unknown;records?:unknown}
    if(!a||a.format!=='racememoir'||a.version!==2||!isBoard(a.board)||!Array.isArray(a.records))throw new Error('不支持的收藏板备份格式')
    board=a.board
    records=a.records.map(value=>{
      if(!value||typeof value!=='object')throw new Error('记录格式无效')
      const r=value as Record<string,unknown>
      const decoded=r.kind==='photo'?{...r,image:decodeBlob(r.image)}:r.kind==='medal'?{...r,image:decodeBlob(r.image),originalImage:decodeBlob(r.originalImage)}:{...r,gpx:decodeBlob(r.gpx)}
      if(!validRecord(decoded))throw new Error('备份中的奖牌或路线数据无效')
      return decoded
    })
  }
  const ids=new Map(records.map(r=>[r.id,r]))
  if(ids.size!==records.length)throw new Error('备份存在重复记录 ID')
  for(const item of board.items){
    if(item.recordId){const r=ids.get(item.recordId);if(!r||(item.kind==='medal'?r.kind!=='medal':item.kind==='photo'?r.kind!=='photo':r.kind!=='route'))throw new Error('备份缺少物件关联的记录')}
  }
  // Import always allocates new ids; it must not overwrite records used elsewhere.
  const remap=new Map(records.map(r=>[r.id,crypto.randomUUID()]))
  return {board:{...board,items:board.items.map(i=>i.recordId?{...i,recordId:remap.get(i.recordId)!}:i)},records:records.map(r=>({...r,id:remap.get(r.id)!}))}
}
