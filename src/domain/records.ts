import {validErasures} from '../items/bib/bibErasure.ts'
import type {BibErasure} from '../items/bib/bibErasure'
import {validQuad} from '../items/bib/bibGeometry.ts'
import type {Quad} from '../items/bib/bibGeometry'
import type { Board, Memory } from './model'
import {validRaceLocation} from './raceLocation.ts'
import type {RaceLocation} from './raceLocation'
import {boardMembers} from './medalExhibit.ts'

export interface TrackPoint { lat: number; lon: number; elevation?: number; time?: string; segment: number }
interface RecordBase { id: string; name: string; note: string; source: 'upload' | 'demo'; archived?: boolean }
export interface MedalRecord extends RecordBase { kind: 'medal'; date: string; originalImage?: Blob; image?: Blob; cutout: 'original' | 'done'; variant?: string; location?: RaceLocation }
export interface RouteRecord extends RecordBase { kind: 'route'; trackPoints: TrackPoint[]; gpx?: Blob; date?: string; location?: RaceLocation }
export interface PhotoRecord extends RecordBase { kind: 'photo'; image: Blob; date?: string }
export interface BibRecord extends RecordBase {kind:'bib';erasures?:BibErasure[];originalImage:Blob;image:Blob;originalWidth:number;originalHeight:number;width:number;height:number;number?:string;quad?:Quad;processing?:'crop'|'perspective';date?:string}
export type CollectionRecord = MedalRecord | RouteRecord | PhotoRecord | BibRecord
export const IMAGE_TYPES = ['image/png','image/jpeg','image/webp']
export const MAX_POINTS = 100_000
export function validRecord(value: unknown): value is CollectionRecord {
  if(!value || typeof value!=='object')return false
  const r=value as CollectionRecord
  if(typeof r.id!=='string'||!r.id||typeof r.name!=='string'||!r.name.trim()||r.name.length>200||typeof r.note!=='string'||r.note.length>5000||!['upload','demo'].includes(r.source))return false
  if(r.archived!==undefined&&typeof r.archived!=='boolean')return false
  if((r.kind==='medal'||r.kind==='route')&&r.location!==undefined&&!validRaceLocation(r.location))return false
  if(r.kind==='bib')return (r.erasures===undefined||validErasures(r.erasures))&&r.source==='upload'&&[r.image,r.originalImage].every(b=>b instanceof Blob&&IMAGE_TYPES.includes(b.type)&&b.size>0&&b.size<=20*1024*1024)&&[r.width,r.height,r.originalWidth,r.originalHeight].every(n=>Number.isInteger(n)&&n>=16&&n<=25000)&&r.width*r.height<=25_000_000&&r.width/r.height<=10&&r.height/r.width<=10&&r.originalWidth/r.originalHeight<=10&&r.originalHeight/r.originalWidth<=10&&r.originalWidth*r.originalHeight<=25_000_000&&(r.number===undefined||(typeof r.number==='string'&&r.number.length<=30))&&(r.quad===undefined||validQuad(r.quad))&&(r.processing===undefined||['crop','perspective'].includes(r.processing))&&(r.date===undefined||typeof r.date==='string')
  if(r.kind==='photo')return r.source==='upload'&&r.image instanceof Blob&&IMAGE_TYPES.includes(r.image.type)&&r.image.size>0&&r.image.size<=20*1024*1024&&(r.date===undefined||typeof r.date==='string')
  if(r.kind==='medal')return typeof r.date==='string'&&r.date.length<=30&&['original','done'].includes(r.cutout)&&[r.image,r.originalImage].every(b=>b===undefined||(b instanceof Blob&&IMAGE_TYPES.includes(b.type)&&b.size>0&&b.size<=20*1024*1024))&&(r.source==='demo'||(r.image instanceof Blob&&r.originalImage instanceof Blob))&&(r.variant===undefined||typeof r.variant==='string')
  if(r.kind!=='route'||!Array.isArray(r.trackPoints)||r.trackPoints.length>MAX_POINTS||(r.source==='upload'&&r.trackPoints.length<2))return false
  if(r.gpx!==undefined&&(!(r.gpx instanceof Blob)||!['application/gpx+xml','application/xml','text/xml'].includes(r.gpx.type)||r.gpx.size>15*1024*1024||!r.gpx.size))return false
  if(r.source==='upload'&&!r.gpx)return false
  if(r.date!==undefined&&typeof r.date!=='string')return false
  return r.trackPoints.every(p=>p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180&&Number.isInteger(p.segment)&&p.segment>=0&&(p.elevation===undefined||Number.isFinite(p.elevation))&&(p.time===undefined||(typeof p.time==='string'&&Number.isFinite(Date.parse(p.time)))))
}
export function migrateBoard(board: Board, existing: CollectionRecord[]) {
  const available=new Map(existing.map(r=>[r.id,r]))
  const created: CollectionRecord[]=[]
  const migrated=new Map(boardMembers(board.items).map(item=>{
    if(item.exhibit)return [item.id,item] as const
    if(!['medal','map'].includes(item.kind)||item.recordId)return [item.id,item] as const
    // Stable ids make retries and StrictMode initialization idempotent.
    const id=`legacy-${item.kind}-${item.id}`
    if(!available.has(id)){
      const base={id,name:item.title||'未命名记忆',note:item.kind==='map'?item.title:'',source:'demo' as const}
      const record:CollectionRecord=item.kind==='medal'?{...base,kind:'medal',date:item.subtitle||'',cutout:'original',variant:item.variant}:{...base,kind:'route',trackPoints:[],date:item.subtitle}
      available.set(id,record);created.push(record)
    }
    return [item.id,{...item,recordId:id}] as const
  }))
  const items=board.items.map(item=>item.exhibit?{...item,exhibit:{...item.exhibit,medals:item.exhibit.medals.map(m=>migrated.get(m.id)!)}}:migrated.get(item.id)!)
  return {board:{...board,items},created}
}
export function recordFor(item: Memory, records: CollectionRecord[]) {
  return records.find(r=>r.id===item.recordId&&((item.kind==='medal'&&r.kind==='medal')||(item.kind==='map'&&r.kind==='route')||(item.kind==='photo'&&r.kind==='photo')||(item.kind==='bib'&&r.kind==='bib')))
}
export function displayMemory(item: Memory, record?: CollectionRecord): Memory {
  if(!record)return item
  return {...item,title:record.name,...(record.kind==='bib'?{number:record.number}:{}),subtitle:record.date||'',variant:record.kind==='medal'?record.variant:item.variant}
}
