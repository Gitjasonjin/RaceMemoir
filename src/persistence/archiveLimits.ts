import {MAX_POINTS} from '../domain/records.ts'

export const MAX_ARCHIVE_RECORDS=10_000
export const MAX_ARCHIVE_POINTS=1_000_000

/** Check collection-wide work before decoding assets or walking individual points. */
export function hasArchiveBudget(value:unknown):value is unknown[]{
  if(!Array.isArray(value)||value.length>MAX_ARCHIVE_RECORDS)return false
  let points=0
  for(const record of value){
    if(record&&record.kind==='route'&&Array.isArray(record.trackPoints)){
      if(record.trackPoints.length>MAX_POINTS)return false
      points+=record.trackPoints.length
      if(points>MAX_ARCHIVE_POINTS)return false
    }
  }
  return true
}
