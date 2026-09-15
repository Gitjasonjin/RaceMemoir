import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DOMParser as XmlParser } from '@xmldom/xmldom'
import { parseGpx, routeGeometry } from '../src/items/route/gpx.ts'

const parser=new XmlParser({onError:()=>{throw new Error('invalid XML')}}) as unknown as Pick<DOMParser,'parseFromString'>
const parse=(text:string)=>parseGpx(text,parser)
const xml=(body:string)=>`<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">${body}</gpx>`

test('解析带命名空间的 GPX，保留名称、坐标、可选海拔和时间',()=>{
  const r=parse(xml('<metadata><name>山野环线</name></metadata><trk><trkseg><trkpt lat="30" lon="120"><ele>100</ele><time>2026-09-14T00:00:00Z</time></trkpt><trkpt lat="30.01" lon="120.01"><ele>115</ele></trkpt></trkseg></trk>'))
  assert.equal(r.name,'山野环线');assert.equal(r.points.length,2)
  assert.deepEqual(r.points[0],{lat:30,lon:120,elevation:100,time:'2026-09-14T00:00:00.000Z',segment:0})
  const g=routeGeometry(r.points)
  assert.ok(g.distance>1400&&g.distance<1500)
  assert.equal(g.ascent,15);assert.equal(g.minElevation,100);assert.equal(g.maxElevation,115)
  assert.ok(g.path.startsWith('M'));assert.ok(g.elevationPath.startsWith('M'))
})

test('缺少海拔、时间的轨迹仍可导入，不生成虚构海拔',()=>{
  const {points}=parse(xml('<rte><rtept lat="0" lon="0"/><rtept lat="0" lon="1"/></rte>'))
  const g=routeGeometry(points)
  assert.ok(Math.abs(g.distance-111194.927)<1)
  assert.equal(g.minElevation,undefined);assert.equal(g.elevationPath,'');assert.equal(g.ascent,0)
})

test('多轨迹段不跨段累计距离、爬升或绘制连接',()=>{
  const {points}=parse(xml('<trk><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon="0.01"><ele>10</ele></trkpt></trkseg><trkseg><trkpt lat="50" lon="100"><ele>500</ele></trkpt><trkpt lat="50" lon="100.01"><ele>520</ele></trkpt></trkseg></trk>'))
  const g=routeGeometry(points)
  assert.equal(points[2].segment,1)
  assert.ok(g.distance>1800&&g.distance<1900)
  assert.equal(g.ascent,30)
  assert.equal(g.path.match(/M/g)?.length,2)
  assert.equal(g.elevationPath.match(/M/g)?.length,2)
})

test('国际日期变更线取短距离，重合点不会产生 NaN',()=>{
  const g=routeGeometry([{lat:0,lon:179.99,segment:0},{lat:0,lon:-179.99,segment:0}])
  assert.ok(g.distance>2200&&g.distance<2300)
  assert.ok(!/NaN|Infinity/.test(g.path))
  const same=routeGeometry([{lat:90,lon:0,elevation:5,segment:0},{lat:90,lon:0,elevation:5,segment:0}])
  assert.equal(same.distance,0);assert.ok(!/NaN|Infinity/.test(same.path+same.elevationPath))
})

test('拒绝非 GPX、损坏 XML、外部实体、无效坐标和不足两个点',()=>{
  assert.throws(()=>parse('<html/>'))
  assert.throws(()=>parse('<gpx><trk></gpx>'))
  assert.throws(()=>parse('<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///anything">]><gpx/>'))
  assert.throws(()=>parse(xml('<trk><trkseg><trkpt lat="91" lon="120"/><trkpt lat="30" lon="120"/></trkseg></trk>')),/经纬度/)
  assert.throws(()=>parse(xml('<trk><trkseg><trkpt lon="120"/><trkpt lat="30" lon="120"/></trkseg></trk>')),/经纬度/)
  assert.throws(()=>parse(xml('<trk><trkseg><trkpt lat="30" lon="120"/></trkseg></trk>')),/两个/)
  assert.throws(()=>parse('x'.repeat(15*1024*1024+1)),/15 MB/)
})

test('大轨迹抽样仅用于绘图，距离统计仍使用全部点',()=>{
  const points=Array.from({length:10000},(_,i)=>({lat:30+Math.sin(i)*.0001,lon:120+i*.000001,segment:0}))
  const g=routeGeometry(points)
  assert.ok((g.path.match(/[ML]/g)?.length||0)<=2502)
  assert.ok(g.distance>50000)
})
