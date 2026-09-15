import type { Board, Memory } from './model'
import {validRaceLocation} from './raceLocation.ts'
import type {RaceLocation} from './raceLocation'

export interface TrackPoint { lat: number; lon: number; elevation?: number; time?: string; segment: number }
interface RecordBase { id: string; name: string; note: string; source: 'upload' | 'demo'; archived?: boolean }
export interface MedalRecord extends RecordBase { kind: 'medal'; date: string; originalImage?: Blob; image?: Blob; cutout: 'original' | 'done'; variant?: string; location?: RaceLocation }
export interface RouteRecord extends RecordBase { kind: 'route'; trackPoints: TrackPoint[]; gpx?: Blob; date?: string; location?: RaceLocation }
export interface PhotoRecord extends RecordBase { kind: 'photo'; image: Blob; date?: string }
export type CollectionRecord = MedalRecord | RouteRecord | PhotoRecord
export const IMAGE_TYPES = ['image/png','image/jpeg','image/webp']
export const MAX_POINTS = 100_000
export function validRecord(value: unknown): value is CollectionRecord {
  if(!value || typeof value!=='object')return false
  const r=value as CollectionRecord
  if(typeof r.id!=='string'||!r.id||typeof r.name!=='string'||!r.name.trim()||r.name.length>200||typeof r.note!=='string'||r.note.length>5000||!['upload','demo'].includes(r.source))return false
  if(r.archived!==undefined&&typeof r.archived!=='boolean')return false
  if(r.kind!=='photo'&&r.location!==undefined&&!validRaceLocation(r.location))return false
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
  const items=board.items.map(item=>{
    if(!['medal','map'].includes(item.kind)||item.recordId)return item
    // Stable ids make retries and StrictMode initialization idempotent.
    const id=`legacy-${item.kind}-${item.id}`
    if(!available.has(id)){
      const base={id,name:item.title||'未命名记忆',note:item.kind==='map'?item.title:'',source:'demo' as const}
      const record:CollectionRecord=item.kind==='medal'?{...base,kind:'medal',date:item.subtitle||'',cutout:'original',variant:item.variant}:{...base,kind:'route',trackPoints:[],date:item.subtitle}
      available.set(id,record);created.push(record)
    }
    return {...item,recordId:id}
  })
  return {board:{...board,items},created}
}
export function recordFor(item: Memory, records: CollectionRecord[]) {
  return records.find(r=>r.id===item.recordId&&((item.kind==='medal'&&r.kind==='medal')||(item.kind==='map'&&r.kind==='route')||(item.kind==='photo'&&r.kind==='photo')))
}
export function displayMemory(item: Memory, record?: CollectionRecord): Memory {
  if(!record)return item
  return {...item,title:record.name,subtitle:record.date||'',variant:record.kind==='medal'?record.variant:item.variant}
}
