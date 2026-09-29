import {test} from 'node:test'
import assert from 'node:assert/strict'
import {gpxLocation,locationAfterGpxImport} from '../src/items/route/routeLocation.ts'
import {validRaceLocation} from '../src/domain/raceLocation.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import type {RouteRecord} from '../src/domain/records'

const points=[{lat:30.12345,lon:120.23456,segment:0},{lat:31,lon:121,segment:0}]
test('uses first valid GPX point and trimmed name, preserving coarse event coordinates',()=>{
 const location=gpxLocation([{lat:NaN,lon:0,segment:0},...points],' 山野路线 ')!
 assert.equal(location.source,'gpx');assert.equal(location.name,'山野路线')
 assert.equal(location.lat,30.12);assert.equal(location.lng,120.23)
 assert.ok(validRaceLocation(location));assert.equal(gpxLocation([],'路线'),undefined)
 assert.equal(gpxLocation(points,'x'.repeat(200))!.name.length,80)
 assert.equal(validRaceLocation({...location,source:'unknown'}),false)
})
test('replacement GPX updates automatic locations but preserves manual and legacy locations',()=>{
 const manual={name:'比赛会场',lat:32,lng:122}
 assert.equal(locationAfterGpxImport(manual,points,'新路线'),manual)
 const explicit={...manual,source:'manual' as const}
 assert.equal(locationAfterGpxImport(explicit,points,'新路线'),explicit)
 assert.deepEqual(locationAfterGpxImport({...manual,source:'gpx'},points,'新路线'),gpxLocation(points,'新路线'))
 assert.deepEqual(locationAfterGpxImport(undefined,points,'新路线'),gpxLocation(points,'新路线'))
})
test('ZIP restores automatic location provenance with remapped record IDs',async()=>{
 const record:RouteRecord={id:'route',kind:'route',name:'山野路线',note:'',source:'upload',gpx:new Blob(['<gpx/>'],{type:'application/gpx+xml'}),trackPoints:points,location:gpxLocation(points,'山野路线')}
 const result=await readBackup(await makeZipArchive({title:'测试',items:[],threads:[]},[record]))
 assert.notEqual(result.records[0].id,record.id)
 assert.equal(result.records[0].kind,'route')
 if(result.records[0].kind==='route')assert.deepEqual(result.records[0].location,JSON.parse(JSON.stringify(record.location)))
})
