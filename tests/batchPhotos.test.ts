import {test} from 'node:test'
import assert from 'node:assert/strict'
import {layoutBatchPhotos,readBatchPhoto} from '../src/items/photo/batchPhotos.ts'
import type {BatchPhoto} from '../src/items/photo/batchPhotos'
import {isBoard} from '../src/domain/model.ts'

test('batch layout uses image orientation, centers rows and keeps every photo separate',()=>{
  const photos:BatchPhoto[]=Array.from({length:7},(_,index)=>({
    record:{id:`photo-${index}`,kind:'photo',name:`Photo ${index}`,note:'',source:'upload',image:new Blob(['x'],{type:'image/png'})},
    width:[1200,600,800][index%3],height:800,
  }))
  const items=layoutBatchPhotos(photos,{x:-1000,y:2000})
  assert.equal(new Set(items.map(item=>item.id)).size,7)
  assert.deepEqual(items.slice(0,3).map(item=>item.variant),['landscape','portrait','polaroid'])
  assert.deepEqual(items.map(item=>item.recordId),photos.map(photo=>photo.record.id))
  assert.equal(items[6].x+items[6].w/2,-1000)
  assert.ok(isBoard({title:'batch',items,threads:[]}))
  for(const a of items)for(const b of items){
    if(a===b)continue
    assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y)
  }
  assert.ok(items.every(item=>!item.subtitle&&item.rotation===0))
  assert.ok(items.every(item=>item.photoZoom===1&&item.photoX===50&&item.photoY===50))
  assert.deepEqual(layoutBatchPhotos([],{x:0,y:0}),[])
})

test('batch rejects unsupported and oversized inputs before decoding',async()=>{
  await assert.rejects(readBatchPhoto(new File(['text'],'note.txt',{type:'text/plain'})),/PNG/)
  await assert.rejects(readBatchPhoto(new File([],'empty.png',{type:'image/png'})),/20 MB/)
  await assert.rejects(readBatchPhoto(new File([new Uint8Array(20*1024*1024+1)],'large.png',{type:'image/png'})),/20 MB/)
})
