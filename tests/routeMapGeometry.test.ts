import {test} from 'node:test'
import assert from 'node:assert/strict'
import {routeMapGeometry,ROUTE_MAP_WIDTH,ROUTE_MAP_HEIGHT} from '../src/items/route/routeMapGeometry.ts'

test('route and tiles use matching Mercator coordinates',()=>{
 const g=routeMapGeometry([{lat:30,lon:120,segment:0},{lat:30.1,lon:120.1,segment:0}])
 assert.ok(g.tiles.length<=12)
 const first=g.tiles[0],match=first.url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/)!,world=first.size*2**Number(match[1])
 const left=Number(match[2])*first.size-first.x,top=Number(match[3])*first.size-first.y
 assert.ok(Math.abs(g.start!.x-((120+180)/360*world-left))<1e-6)
 assert.ok(Math.abs(g.start!.y-((1-Math.asinh(Math.tan(Math.PI/6))/Math.PI)/2*world-top))<1e-6)
 for(const point of g.path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)){
  assert.ok(Number(point[1])>=0&&Number(point[1])<=ROUTE_MAP_WIDTH)
  assert.ok(Number(point[2])>=0&&Number(point[2])<=ROUTE_MAP_HEIGHT)
 }
})

test('fits routes tightly without integer zoom gaps, leaving room for attribution',()=>{
 for(const span of [.007,.021,.053,.1,.3]){
  const g=routeMapGeometry([{lat:30,lon:120,segment:0},{lat:30+span,lon:120+span,segment:0}])
  const coords=Array.from(g.path.matchAll(/[ML]([\d.]+) ([\d.]+)/g),m=>[Number(m[1]),Number(m[2])])
  const width=Math.abs(coords[1][0]-coords[0][0]),height=Math.abs(coords[1][1]-coords[0][1])
  assert.ok(Math.abs(Math.max(width/360,height/216)-1)<.001)
  assert.ok(coords.every(([x,y])=>x>=11.99&&x<=372.01&&y>=11.99&&y<=228.01))
 }
})
test('wraps dateline tiles, separates segments and handles coincident/polar coordinates',()=>{
 const wrap=routeMapGeometry([{lat:0,lon:179.9,segment:0},{lat:.01,lon:-179.9,segment:1}])
 assert.equal((wrap.path.match(/M/g)||[]).length,2)
 assert.ok(wrap.tiles.every(t=>Number(t.url.split('/').at(-2))>=0))
 for(const lat of [0,90,-90]){
  const g=routeMapGeometry([{lat,lon:0,segment:0},{lat,lon:0,segment:0}])
  assert.ok(!/NaN|Infinity/.test(g.path));assert.ok(g.tiles.length<=6)
 }
 assert.equal(routeMapGeometry([]).path,'')
})
