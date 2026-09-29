import type {TrackPoint} from '../../domain/records'
import type {RaceLocation} from '../../domain/raceLocation'
import {normalizeRaceLocation} from '../../domain/raceLocation.ts'

export function gpxLocation(points:TrackPoint[],name:string):RaceLocation|undefined{
  const start=points.find(p=>Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180)
  return start?normalizeRaceLocation({name:name.trim().slice(0,80)||'路线起点',lat:start.lat,lng:start.lon,source:'gpx'}):undefined
}

/** Legacy locations without source metadata are also user-owned. */
export function locationAfterGpxImport(current:RaceLocation|undefined,points:TrackPoint[],name:string){
  return current&&current.source!=='gpx'?current:gpxLocation(points,name)
}
