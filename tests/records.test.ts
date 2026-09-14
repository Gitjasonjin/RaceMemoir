import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { seed, isBoard } from '../src/model.ts'
import { migrateBoard, displayMemory, recordFor, validRecord } from '../src/records.ts'
import type { MedalRecord, RouteRecord } from '../src/records.ts'
import { deleteRecord, readRecords, putRecords } from '../src/recordStore.ts'
import { makeArchive, readArchive } from '../src/recordArchive.ts'

const original=new Blob(['original-image'],{type:'image/jpeg'})
const processed=new Blob(['transparent-png'],{type:'image/png'})
const medal:MedalRecord={id:'real-medal',kind:'medal',name:'山野五十公里',date:'2026-09-14',note:'完赛纪念',source:'upload',originalImage:original,image:processed,cutout:'done'}
const route:RouteRecord={id:'real-route',kind:'route',name:'山脊环线',note:'清晨出发',source:'upload',gpx:new Blob(['<gpx/>'],{type:'application/gpx+xml'}),trackPoints:[{lat:30,lon:120,elevation:100,segment:0},{lat:30.01,lon:120.01,elevation:110,segment:0}]}

test('彻底删除释放整条收藏及文件，重新读取不恢复且不影响其他记录',async()=>{
  const removed={...medal,id:'delete-medal',archived:true},kept={...route,id:'keep-route'}
  await putRecords([removed,kept])
  await deleteRecord(removed.id)
  await deleteRecord(removed.id)
  const records=await readRecords()
  assert.equal(records.some(r=>r.id===removed.id),false)
  const restored=records.find(r=>r.id===kept.id) as RouteRecord
  assert.equal(await restored.gpx!.text(),await kept.gpx!.text())
  assert.deepEqual(restored.trackPoints,kept.trackPoints)
})

test('上传照片通过本地存储和完整备份恢复原始字节及物件关联',async()=>{
  const photo={id:'uploaded-photo',kind:'photo' as const,name:'山野照片',note:'',source:'upload' as const,image:new Blob([new Uint8Array([1,2,3,255])],{type:'image/png'})}
  assert.ok(validRecord(photo))
  assert.equal(validRecord({...photo,image:new Blob([],{type:'image/png'})}),false)
  assert.equal(validRecord({...photo,image:new Blob(['x'],{type:'image/svg+xml'})}),false)
  await putRecords([photo])
  const stored=(await readRecords()).find(r=>r.id===photo.id)!
  assert.equal(stored.kind,'photo')
  const item={...seed.items.find(i=>i.kind==='photo')!,recordId:photo.id}
  const board={...seed,items:[item],threads:[]}
  assert.ok(isBoard(board))
  const restored=readArchive(await makeArchive(board,[stored]))
  const result=restored.records[0]
  assert.equal(result.kind,'photo')
  if(result.kind!=='photo')throw new Error('Expected photo')
  assert.deepEqual(new Uint8Array(await result.image.arrayBuffer()),new Uint8Array([1,2,3,255]))
  assert.notEqual(result.id,photo.id)
  assert.equal(recordFor(restored.board.items[0],restored.records),result)
})

test('旧画布迁移保留坐标、层级、连线和装饰，重复迁移不产生重复记录',()=>{
  const before=structuredClone(seed), result=migrateBoard(before,[])
  assert.equal(result.created.length,4)
  assert.deepEqual(result.board.threads,before.threads)
  assert.deepEqual(result.board.items.map(({recordId,...i})=>i),before.items)
  assert.equal(isBoard(result.board),true)
  assert.ok(result.created.every(validRecord))
  assert.ok(result.created.filter(r=>r.kind==='route').every(r=>r.trackPoints.length===0&&r.source==='demo'))
  assert.deepEqual(migrateBoard(before,result.created).created,[])
  assert.deepEqual(migrateBoard(result.board,result.created).board,result.board)
  assert.deepEqual(before,seed)
})

test('多物件引用同一记录时内容同步更新且不改动各自布局',()=>{
  const a={...seed.items[0],recordId:medal.id},b={...a,id:'copy',x:-800,rotation:15}
  const changed={...medal,name:'新的赛事名称'}
  assert.equal(displayMemory(a,recordFor(a,[changed])).title,changed.name)
  assert.equal(displayMemory(b,recordFor(b,[changed])).title,changed.name)
  assert.equal(displayMemory(b,changed).x,-800)
  assert.equal(displayMemory(b,changed).rotation,15)
  assert.equal(a.title,seed.items[0].title)
  assert.equal(recordFor(a,[route]),undefined)
})

test('IndexedDB 原图、透明图片、GPX 和轨迹可跨连接恢复；失败保存不覆盖旧记录',async()=>{
  await putRecords([medal,route])
  const restored=await readRecords(),m=restored.find(r=>r.id===medal.id) as MedalRecord,r=restored.find(r=>r.id===route.id) as RouteRecord
  assert.equal(await m.originalImage!.text(),await original.text())
  assert.equal(await m.image!.text(),await processed.text())
  assert.deepEqual(r.trackPoints,route.trackPoints)
  assert.equal(await r.gpx!.text(),'<gpx/>')
  await assert.rejects(putRecords([{...medal,name:'替换'}, {...route,trackPoints:[{lat:99,lon:0,segment:0}]}]))
  assert.equal((await readRecords()).find(r=>r.id===medal.id)!.name,medal.name)
  const cannotClone={...route,unserializable:()=>null}
  await assert.rejects(putRecords([{...medal,name:'不能部分提交'},cannotClone]),/保存失败/)
  assert.equal((await readRecords()).find(r=>r.id===medal.id)!.name,medal.name)
  await putRecords([{...medal,archived:true}])
  const archived=(await readRecords()).find(r=>r.id===medal.id)!
  assert.equal(archived.archived,true)
  assert.ok(recordFor({...seed.items[0],recordId:medal.id},[archived]))
  await putRecords([{...medal,archived:false}])
  assert.equal((await readRecords()).find(r=>r.id===medal.id)!.archived,false)
})

test('完整备份恢复二进制文件，重分配记录 ID 且保留共享引用',async()=>{
  const item={...seed.items[0],recordId:medal.id},map={...seed.items[4],recordId:route.id}
  const board={title:'真实收藏',items:[item,{...item,id:'second',x:-999},map],threads:[{id:'line',from:item.id,to:map.id}]}
  const json=await makeArchive(board,[medal,route]),restored=readArchive(json)
  assert.equal(isBoard(restored.board),true)
  assert.notEqual(restored.board.items[0].recordId,medal.id)
  assert.equal(restored.board.items[0].recordId,restored.board.items[1].recordId)
  assert.equal(restored.board.items[1].x,-999)
  assert.deepEqual(restored.board.threads,board.threads)
  const m=restored.records.find(r=>r.kind==='medal') as MedalRecord,r=restored.records.find(r=>r.kind==='route') as RouteRecord
  assert.equal(m.image!.type,'image/png')
  assert.equal(await m.image!.text(),await processed.text())
  assert.equal(await m.originalImage!.text(),await original.text())
  assert.equal(await r.gpx!.text(),'<gpx/>')
  assert.deepEqual(r.trackPoints,route.trackPoints)
  assert.notEqual(readArchive(json).records[0].id,m.id)
})

test('兼容旧版备份，拒绝不完整引用、重复 ID、非法资产和未知版本',async()=>{
  const legacy=readArchive(JSON.stringify(seed))
  assert.equal(legacy.records.length,4)
  assert.deepEqual(legacy.board.threads,seed.threads)
  const valid=JSON.parse(await makeArchive(legacy.board,legacy.records))
  assert.throws(()=>readArchive(JSON.stringify({...valid,version:99})))
  assert.throws(()=>readArchive(JSON.stringify({...valid,records:[]})),/缺少/)
  assert.throws(()=>readArchive(JSON.stringify({...valid,records:[...valid.records,valid.records[0]]})),/重复/)
  assert.throws(()=>readArchive(JSON.stringify({...valid,records:valid.records.map((r:object,i:number)=>i===0?{...r,image:'data:text/html;base64,SGVsbG8='}:r)})),/格式/)
  await assert.rejects(makeArchive(legacy.board,[]),/丢失/)
})

test('记录校验拒绝不支持的图片类型、空文件、缺失原图和无效轨迹',()=>{
  assert.ok(validRecord(medal));assert.ok(validRecord(route))
  assert.equal(validRecord({...medal,originalImage:undefined}),false)
  assert.equal(validRecord({...medal,image:new Blob([],{type:'image/png'})}),false)
  assert.equal(validRecord({...medal,image:new Blob(['svg'],{type:'image/svg+xml'})}),false)
  assert.equal(validRecord({...route,gpx:undefined}),false)
  assert.equal(validRecord({...route,trackPoints:[{lat:0,lon:Infinity,segment:0},{lat:0,lon:0,segment:0}]}),false)
})
