import {AppError} from '../i18n/runtime.ts'
/** Event area selected manually or derived from a route's GPX start. */
export interface RaceLocation {
  name: string
  lng: number
  lat: number
  region?: string
  precise?: boolean
  source?: 'gpx' | 'manual'
}

export function validRaceLocation(value: unknown): value is RaceLocation {
  if (!value || typeof value !== 'object') return false
  const p = value as RaceLocation
  return typeof p.name === 'string' && !!p.name.trim() && p.name.length <= 80 &&
    Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90 &&
    Number.isFinite(p.lng) && p.lng >= -180 && p.lng <= 180 &&
    (p.region === undefined || (typeof p.region === 'string' && p.region.length <= 80)) &&
    (p.precise === undefined || typeof p.precise === 'boolean') &&
    (p.source === undefined || p.source === 'gpx' || p.source === 'manual')
}

export function coarseCoordinate(value: number) { return Number(value.toFixed(2)) }

export function normalizeRaceLocation(location: RaceLocation): RaceLocation {
  if (!validRaceLocation(location)) throw new AppError("raceLocation.001")
  return {...location, name: location.name.trim(), region: location.region?.trim(),
    lat: coarseCoordinate(location.lat), lng: coarseCoordinate(location.lng), precise: false}
}
