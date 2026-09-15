import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, isBoard } from '../src/domain/model.ts'

test('photo composition persists per instance and rejects invalid crop values',()=>{
  const board=structuredClone(seed),photo=board.items.find(i=>i.kind==='photo')!
  Object.assign(photo,{variant:'portrait',w:255,h:360,photoZoom:2,photoX:25,photoY:75})
  const restored=JSON.parse(JSON.stringify(board))
  assert.ok(isBoard(restored))
  assert.deepEqual(restored.items.find((i:{id:string})=>i.id===photo.id),photo)
  for(const key of ['photoZoom','photoX','photoY'] as const){
    const old=photo[key]
    for(const invalid of [NaN,Infinity,-1,301]){photo[key]=invalid;assert.equal(isBoard(board),false)}
    photo[key]=old
  }
  assert.ok(isBoard(board))
})
