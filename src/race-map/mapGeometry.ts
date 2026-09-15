import china from '../assets/maps/china-provinces.simplified.json' with {type:'json'}
import {createMapProjection} from './raceMapProjection.ts'
import type {ProvinceMap} from './raceMapProjection'

// Shared by artwork, editor and every connection endpoint; computed once.
export const mapGeometry=createMapProjection(china as ProvinceMap)
