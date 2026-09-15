import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hangPhotos} from '../src/board/photoLine.ts'
import {seed,isBoard,pinPosition} from '../src/domain/model.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'

test('photo line arranges photos left-to-right with clips, preserves content and unrelated objects',async()=>{
  const board=structuredClone(seed),photos=board.items.filter(i=>i.kind==='photo')
  const next=hangPhotos(board,[...photos.map(i=>i.id),'ridge-medal'])
  assert.ok(isBoard(next))
  assert.deepEqual(board,seed)
  for(const original of board.items){
    const item=next.items.find(i=>i.id===original.id)!
    if(original.kind!=='photo'){assert.deepEqual(item,original);continue}
    assert.equal(item.pinStyle,'clip')
    for(const key of ['recordId','image','title','w','h','variant','photoZoom','photoX','photoY'] as const)assert.equal(item[key],original[key])
  }
  assert.equal(next.threads.filter(t=>t.style==='hemp').length,photos.length-1)
  board.threads.forEach(t=>assert.deepEqual(next.threads.find(n=>n.id===t.id),t))
  const ordered=next.items.filter(i=>i.kind==='photo').sort((a,b)=>a.x-b.x)
  assert.ok(pinPosition(ordered[1]).y>pinPosition(ordered[0]).y)
  const repeated=hangPhotos(next,photos.map(i=>i.id))
  assert.equal(repeated.threads.length,next.threads.length)
  repeated.items.forEach((item,i)=>{assert.ok(Math.abs(item.x-next.items[i].x)<1e-8);assert.ok(Math.abs(item.y-next.items[i].y)<1e-8)})
  const restore=(await readBackup(await makeZipArchive(next,[]))).board
  assert.deepEqual(restore,next)
})

test('reuses an existing connection, safely ignores non-photo selections and keeps rotated clips attached',()=>{
  const photos=seed.items.filter(i=>i.kind==='photo').slice(0,2)
  const board={title:'绳串',items:photos,threads:[{id:'existing',from:photos[1].id,to:photos[0].id}]}
  assert.equal(hangPhotos(board,[photos[0].id,'missing']),board)
  const next=hangPhotos(board,photos.map(i=>i.id))
  assert.equal(next.threads.length,1);assert.equal(next.threads[0].id,'existing');assert.equal(next.threads[0].style,'hemp')
  const item={...photos[0],rotation:0,pinStyle:'clip' as const}
  assert.deepEqual(pinPosition(item),{x:item.x+item.w/2,y:item.y-2})
  assert.deepEqual(pinPosition({...item,rotation:90}),{x:item.x+item.w/2+item.h/2+2,y:item.y+item.h/2})
  assert.deepEqual(pinPosition({...item,pinStyle:undefined},'clip'),pinPosition(item))
})
