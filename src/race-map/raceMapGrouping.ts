import type {CollectionRecord, MedalRecord, RouteRecord} from '../domain/records'
import {coarseCoordinate, validRaceLocation} from '../domain/raceLocation.ts'
import type {RaceLocation} from '../domain/raceLocation'
import type {Board} from '../domain/model'

export type RaceRecord = MedalRecord | RouteRecord
export interface RaceLocationGroup {
  key: string
  name: string
  lat: number
  lng: number
  races: RaceRecord[]
}
export function createLocationKey(location: RaceLocation) {
  return `${location.name.trim()}::${coarseCoordinate(location.lat).toFixed(2)}::${coarseCoordinate(location.lng).toFixed(2)}`
}
export function raceRecords(records: CollectionRecord[]): RaceRecord[] {
  return records.filter((r): r is RaceRecord => r.kind !== 'photo' && !r.archived)
}
export function boardRaceRecords(board:Board,records:CollectionRecord[]):RaceRecord[]{
  const ids=new Set(board.items.filter(i=>i.kind==='medal'||i.kind==='map').map(i=>i.recordId))
  return records.filter((r):r is RaceRecord=>r.kind!=='photo'&&ids.has(r.id))
}
export function groupRaceLocations(records: CollectionRecord[],includeArchived=false): RaceLocationGroup[] {
  const groups = new Map<string, RaceLocationGroup>()
  for (const race of includeArchived?records.filter((r):r is RaceRecord=>r.kind!=='photo'):raceRecords(records)) {
    const location = race.location
    if (!location) continue
    if (!validRaceLocation(location)) {
      console.warn('Skipped invalid race location', race.id)
      continue
    }
    const key = createLocationKey(location)
    if (!groups.has(key)) groups.set(key, {key, name: location.name.trim(),
      lat: coarseCoordinate(location.lat), lng: coarseCoordinate(location.lng), races: []})
    groups.get(key)!.races.push(race)
  }
  return [...groups.values()]
}
