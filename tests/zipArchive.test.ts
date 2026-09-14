import {test} from 'node:test'
import assert from 'node:assert/strict'
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'
import {seed} from '../src/model.ts'
import {makeZipArchive,readBackup} from '../src/zipArchive.ts'
import {makeArchive} from '../src/recordArchive.ts'
import type {CollectionRecord} from '../src/records.ts'

const image=new Blob([new Uint8Array([1,2,3,4,5])],{type:'image/png'})
const records:CollectionRecord[]=[
  {id:'photo',kind:'photo',name:'照片',note:'',date:'2026-09-14',source:'upload',image},
  {id:'medal',kind:'medal',name:'奖牌',note:'',date:'',source:'upload',image,originalImage:image,cutout:'done'},
  {id:'route',kind:'route',name:'路线',note:'',source:'upload',gpx:new Blob(['<gpx/>'],{type:'application/gpx+xml'}),trackPoints:[{lat:1,lon:1,segment:0},{lat:2,lon:2,segment:0}]},
]
const board={title:'备份测试',items:[{...seed.items[2],recordId:'photo'},{...seed.items[0],recordId:'medal'},{...seed.items[4],recordId:'route'}],threads:[]}

test('ZIP metadata references separate assets, deduplicates bytes and restores all content',async()=>{
  const blob=await makeZipArchive(board,records)
  const entries=unzipSync(new Uint8Array(await blob.arrayBuffer()))
  assert.equal(Object.keys(entries).length,3)
  const json=strFromU8(entries['manifest.json']),manifest=JSON.parse(json)
  assert.equal(json.includes('base64'),false)
  assert.equal(manifest.records[0].image.path,manifest.records[1].image.path)
  const result=await readBackup(blob)
  assert.notEqual(result.records[0].id,records[0].id)
  assert.equal(result.board.items[0].recordId,result.records[0].id)
  const photo=result.records[0];assert.equal(photo.kind,'photo')
  if(photo.kind==='photo')assert.deepEqual(await photo.image.arrayBuffer(),await image.arrayBuffer())
  assert.equal(result.records[0].date,'2026-09-14')
  assert.equal(result.board.items[0].x,board.items[0].x)
})
test('ZIP rejects missing assets, corrupted content and unsafe references before importing',async()=>{
  const original=unzipSync(new Uint8Array(await (await makeZipArchive(board,records)).arrayBuffer()))
  const manifest=JSON.parse(strFromU8(original['manifest.json'])),path=manifest.records[0].image.path
  const missing={...original};delete missing[path]
  await assert.rejects(readBackup(new Blob([zipSync(missing)])),/缺少/)
  await assert.rejects(readBackup(new Blob([zipSync({...original,[path]:new Uint8Array([5,4,3,2,1])})])),/校验/)
  manifest.records[0].image.path='../outside.png'
  await assert.rejects(readBackup(new Blob([zipSync({...original,'manifest.json':strToU8(JSON.stringify(manifest))})])),/引用/)
  await assert.rejects(readBackup(new Blob([zipSync({...original,'../bad':new Uint8Array([1])})])),/内容无效/)
})
test('new import accepts legacy JSON archives and bare boards',async()=>{
  const restored=await readBackup(new Blob([await makeArchive(board,records)]))
  assert.equal(restored.records.length,3)
  assert.equal((await readBackup(new Blob([JSON.stringify(seed)]))).board.items.length,seed.items.length)
})
