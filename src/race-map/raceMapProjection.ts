import {MAX_MAP_SCALE} from '../domain/mapSettings.ts'
import {geoMercator, geoPath} from 'd3-geo'
import type {FeatureCollection, Geometry} from 'geojson'

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 700
export type ProvinceMap = FeatureCollection<Geometry, {id: string; name: string}>
export interface MapTransform {x: number; y: number; scale: number}
export const INITIAL_TRANSFORM: MapTransform = {x: 0, y: 0, scale: 1}
const labelOffsets: Record<string, [number,number]> = {
  '北京':[0,-9], '天津':[16,5], '河北':[-15,2], '香港':[24,0], '澳门':[-18,13],
}

export function createMapProjection(data: ProvinceMap) {
  if (data.type !== 'FeatureCollection' || !data.features.length) throw new Error('地图资源加载失败')
  const projection = geoMercator().fitExtent([[65, 55], [MAP_WIDTH - 65, MAP_HEIGHT - 65]], data)
  const path = geoPath(projection)
  return {projection, provinces: data.features.map(feature => {
    const name=feature.properties.name
    const label=name.replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/,'')
    const center=path.centroid(feature),offset=labelOffsets[label] || [0,0]
    return {id:feature.properties.id,name,label,d:path(feature)||'',center:[center[0]+offset[0],center[1]+offset[1]]}
  })}
}
export function clampTransform(view: MapTransform): MapTransform {
  const scale = Math.min(MAX_MAP_SCALE, Math.max(1, view.scale))
  const bound = (n: number, size: number) => Math.min(size * .3, Math.max(size * (1 - scale) - size * .3, n))
  return {scale, x: bound(view.x, MAP_WIDTH), y: bound(view.y, MAP_HEIGHT)}
}
export function zoomMap(view: MapTransform, factor: number, x: number, y: number): MapTransform {
  const scale = Math.min(MAX_MAP_SCALE, Math.max(1, view.scale * factor))
  return clampTransform({scale, x: x - (x - view.x) * scale / view.scale, y: y - (y - view.y) * scale / view.scale})
}
