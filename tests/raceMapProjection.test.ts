import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createMapProjection,zoomMap,clampTransform,INITIAL_TRANSFORM,MAP_WIDTH,MAP_HEIGHT} from '../src/race-map/raceMapProjection.ts'
import type {ProvinceMap} from '../src/race-map/raceMapProjection'

const data=JSON.parse(readFileSync(new URL('../src/assets/maps/china-provinces.simplified.json',import.meta.url),'utf8')) as ProvinceMap
test('local map contains 34 regions with finite paths; projection and inverse preserve race locations',()=>{
  const {projection,provinces}=createMapProjection(data)
  assert.equal(provinces.length,34)
  assert(provinces.every(p=>p.d.length>0&&!p.d.includes('NaN')))
  for(const [lng,lat] of [[102.8,31],[114.2,22.3],[121,24],[115.3,40.9]]){
    const p=projection([lng,lat])!;assert(p[0]>0&&p[0]<MAP_WIDTH&&p[1]>0&&p[1]<MAP_HEIGHT)
    const q=projection.invert!(p)!;assert(Math.abs(q[0]-lng)<1e-8&&Math.abs(q[1]-lat)<1e-8)
  }
  assert.throws(()=>createMapProjection({type:'FeatureCollection',features:[]}),/加载失败/)
})
test('zoom anchors the cursor, stays within 1–10, and panning remains recoverable',()=>{
  const v=zoomMap(INITIAL_TRANSFORM,2,500,350)
  assert.deepEqual(v,{scale:2,x:-500,y:-350})
  assert.equal(zoomMap(v,10,500,350).scale,10)
  assert.equal(zoomMap(v,.01,500,350).scale,1)
  const pan=clampTransform({x:1e9,y:-1e9,scale:2})
  assert.equal(pan.x,300);assert.equal(pan.y,-910)
})
