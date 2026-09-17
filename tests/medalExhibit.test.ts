import {test} from 'node:test'
import assert from 'node:assert/strict'
import {seed,isBoard,pinPosition} from '../src/domain/model.ts'
import type {Board} from '../src/domain/model.ts'
import {EXHIBIT_LAYOUTS,mergeMedals,splitMedals,boardMembers,exhibitCells,exhibitWorldMedals} from '../src/domain/medalExhibit.ts'
import {migrateBoard} from '../src/domain/records.ts'
import {resolveEndpoint} from '../src/board/threadEndpoints.ts'
import {boardRaceRecords} from '../src/race-map/raceMapGrouping.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {restoreArchive} from '../src/persistence/recordArchive.ts'

const source:Board={title:'展览',items:[seed.items[0],seed.items[6],seed.items[1]],threads:[{id:'a',from:seed.items[0].id,to:seed.items[1].id},{id:'b',from:seed.items[0].id,to:seed.items[6].id}]}
const ids=source.items.slice(0,2).map(i=>i.id)
test('all exhibit layouts retain originals, record links, threads and immutable source data',()=>{
  const original=structuredClone(source)
  for(const layout of EXHIBIT_LAYOUTS){
    const {board,item}=mergeMedals(source,ids,layout.id)
    assert.ok(isBoard(board));assert.equal(board.items.length,2)
    assert.deepEqual(item.exhibit?.medals,source.items.slice(0,2))
    assert.deepEqual(board.threads,source.threads)
    assert.equal(exhibitCells(item).length,2)
    assert.equal(boardMembers(board.items).length,4)
    const split=splitMedals(board,item.id)
    assert.ok(isBoard(split.board));assert.deepEqual(split.board.threads,source.threads)
    split.items.forEach((m,i)=>{assert.equal(m.id,source.items[i].id);assert.equal(m.w,source.items[i].w);assert.equal(m.h,source.items[i].h);assert.equal(m.rotation,source.items[i].rotation)})
  }
  assert.deepEqual(source,original)
})
test('cell anchors rotate and translate with the case, also after reordering',()=>{
  const {board,item}=mergeMedals(source,ids,'1x2')
  item.x=100;item.y=200;item.rotation=90
  const [cell]=exhibitCells(item),point=resolveEndpoint(board,[],{itemId:ids[0]})!
  // Rotation around the exhibit centre, including the medal eyelet's -8px offset.
  const localX=cell.x+cell.w/2,localY=cell.y-8
  assert.ok(Math.abs(point.x-(item.x+item.w/2-(localY-item.h/2)))<1e-8)
  assert.ok(Math.abs(point.y-(item.y+item.h/2+(localX-item.w/2)))<1e-8)
  assert.deepEqual(point,pinPosition(exhibitWorldMedals(item)[0]))
  item.exhibit!.medals.reverse()
  assert.notDeepEqual(resolveEndpoint(board,[],{itemId:ids[0]}),point)
  item.x+=83
  const moved=resolveEndpoint(board,[],{itemId:ids[1]})!
  assert.ok(Math.abs(moved.x-point.x-83)<1e-8)
})
test('merge rejects mixed, locked and overcapacity selections; split respects board limit',()=>{
  assert.throws(()=>mergeMedals(source,source.items.map(i=>i.id),'1x4'))
  assert.throws(()=>mergeMedals({...source,items:source.items.map(i=>({...i,locked:true}))},ids,'1x2'))
  const many={...source,threads:[],items:Array.from({length:8},(_,i)=>({...source.items[0],id:`m${i}`}))}
  assert.throws(()=>mergeMedals(many,many.items.map(i=>i.id),'1x4'))
  const {board,item}=mergeMedals(many,many.items.map(i=>i.id),'2x4')
  assert.ok(isBoard(board));assert.equal(item.exhibit!.medals.length,8)
  assert.throws(()=>splitMedals({...board,items:[item,...Array.from({length:499},(_,i)=>({...seed.items[1],id:`b${i}`}))]},item.id),/500/)
})
test('validation rejects nested containers, duplicate member ids and missing thread targets',()=>{
  const {board,item}=mergeMedals(source,ids,'1x2')
  const bad=structuredClone(board),badItem=bad.items.find(i=>i.id===item.id)!
  badItem.exhibit!.medals[0].id=badItem.id
  assert.equal(isBoard(bad),false)
  badItem.exhibit!.medals[0].id=ids[0]
  badItem.exhibit!.medals[0].exhibit={layout:'1x2',medals:[]}
  assert.equal(isBoard(bad),false)
  assert.equal(isBoard({...board,threads:[{id:'bad',from:'missing',to:item.id}]}),false)
  assert.equal(isBoard({...board,items:[{...item,exhibit:{layout:'1x2',medals:[...item.exhibit!.medals,...item.exhibit!.medals]}}]}),false)
})
test('migration skips container and keeps nested races in map aggregation',()=>{
  const {board}=mergeMedals(source,ids,'1x2'),migrated=migrateBoard(board,[])
  assert.equal(migrated.created.length,2)
  assert.equal(migrated.board.items.find(i=>i.exhibit)?.recordId,undefined)
  assert.equal(boardRaceRecords(migrated.board,migrated.created).length,2)
  assert.equal(migrateBoard(migrated.board,migrated.created).created.length,0)
})
test('ZIP roundtrip remaps member records, preserves bytes and protects missing nested records',async()=>{
  const migrated=migrateBoard(source,[]),{board,item}=mergeMedals(migrated.board,ids,'2x4')
  const image=new Blob([new Uint8Array([1,2,3])],{type:'image/png'})
  const records=migrated.created.map(r=>r.kind==='medal'?{...r,source:'upload' as const,image,originalImage:image}:r)
  const result=await readBackup(await makeZipArchive(board,records)),restored=result.board.items.find(i=>i.id===item.id)!
  assert.ok(isBoard(result.board))
  assert.equal(restored.exhibit!.layout,'2x4')
  for(const medal of restored.exhibit!.medals){
    assert.ok(medal.recordId);assert.ok(!records.some(r=>r.id===medal.recordId))
    const record=result.records.find(r=>r.id===medal.recordId)!
    assert.equal(record.kind,'medal')
    if(record.kind==='medal')assert.deepEqual(await record.image!.arrayBuffer(),await image.arrayBuffer())
  }
  assert.deepEqual(result.board.threads,board.threads)
  assert.ok(isBoard(splitMedals(result.board,item.id).board))
  assert.throws(()=>restoreArchive(board,[]),/缺少/)
})
