import {test} from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate'
import {normalizeRaceLocation,validRaceLocation} from '../src/domain/raceLocation.ts'
import {createLocationKey,groupRaceLocations} from '../src/race-map/raceMapGrouping.ts'
import type {MedalRecord} from '../src/domain/records'
import {validRecord} from '../src/domain/records.ts'
import {putRecords,readRecords,deleteRecord} from '../src/persistence/recordStore.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {seed} from '../src/domain/model.ts'

const location={name:' 四姑娘山 ',lat:31.00001,lng:102.80001}
const race:MedalRecord={id:'race-map-test',name:'四姑娘山越野赛',kind:'medal',date:'',note:'',source:'demo',cutout:'original',location}
test('location keys trim names and use coarse coordinates; edits do not retain precise coordinates',()=>{
  assert.equal(createLocationKey(location),'四姑娘山::31.00::102.80')
  assert.deepEqual(normalizeRaceLocation(location),{name:'四姑娘山',lat:31,lng:102.8,precise:false,region:undefined})
  for(const bad of [{...location,lat:91},{...location,lng:-181},{...location,lat:NaN},{...location,name:''},{...location,precise:'true'}])assert.equal(validRaceLocation(bad),false)
})
test('three races at the same named area share one marker; missing, archived and invalid locations are skipped',()=>{
  const records=[race,{...race,id:'2025'},{...race,id:'2026',location:{...location,lat:31}},
    {...race,id:'missing',location:undefined},{...race,id:'archived',archived:true},
    {...race,id:'invalid',location:{...location,lat:Infinity}}]
  const groups=groupRaceLocations(records)
  assert.equal(groups.length,1);assert.equal(groups[0].races.length,3)
  assert.equal(groupRaceLocations([{...race,location:{...location,name:'香港'}},race]).length,2)
  assert.equal(groupRaceLocations(Array.from({length:1000},(_,i)=>({...race,id:String(i)})))[0].races.length,1000)
})
test('legacy records remain valid; local records and ZIP preserve location and remapped canvas references',async()=>{
  assert.equal(validRecord({...race,location:undefined}),true)
  assert.equal(validRecord({...race,location:{...location,lng:200}}),false)
  const saved={...race,location:normalizeRaceLocation(location)}
  await putRecords([saved])
  assert.deepEqual((await readRecords()).find(r=>r.id===race.id),saved)
  const board={title:'地图备份',items:[{...seed.items[0],recordId:race.id}],threads:[]}
  const blob=await makeZipArchive(board,[saved])
  await deleteRecord(race.id)
  const restored=await readBackup(blob)
  await putRecords(restored.records)
  assert.equal(restored.board.items[0].recordId,restored.records[0].id)
  assert.notEqual(restored.records[0].id,race.id)
  assert.equal(groupRaceLocations(await readRecords())[0].races[0].id,restored.records[0].id)
  assert.deepEqual(groupRaceLocations(restored.records)[0].lat,31)
  await deleteRecord(restored.records[0].id)
  const entries=unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const manifest=JSON.parse(strFromU8(entries['manifest.json']))
  assert.equal(manifest.version,5)
  manifest.version=3;delete manifest.records[0].location
  entries['manifest.json']=strToU8(JSON.stringify(manifest))
  assert.equal(groupRaceLocations((await readBackup(new Blob([zipSync(entries)]))).records).length,0)
  manifest.version=4;manifest.records[0].location={...location,lat:-91}
  entries['manifest.json']=strToU8(JSON.stringify(manifest))
  await assert.rejects(readBackup(new Blob([zipSync(entries)])),/无效/)
})
