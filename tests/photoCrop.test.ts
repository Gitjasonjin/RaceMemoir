import {test} from 'node:test'
import assert from 'node:assert/strict'
import {panPhoto} from '../src/photoCrop.ts'

test('cover crop converts pixel drag to object position and clamps edges',()=>{
  // 400x200 source in a square: horizontal overflow 200, no vertical overflow.
  assert.deepEqual(panPhoto(1,50,50,50,50,200,200,400,200),{photoX:25,photoY:50})
  assert.deepEqual(panPhoto(1,50,50,1000,-1000,200,200,400,200),{photoX:0,photoY:50})
})
test('zoomed portrait can pan both axes without exposing background',()=>{
  assert.deepEqual(panPhoto(2,50,50,50,-150,200,200,200,400),{photoX:25,photoY:75})
  assert.deepEqual(panPhoto(2,50,50,-10000,10000,200,200,200,400),{photoX:100,photoY:0})
})
test('drag scales with preview dimensions; matching image at 100% stays centered',()=>{
  assert.deepEqual(panPhoto(1,50,50,20,20,200,200,200,200),{photoX:50,photoY:50})
  assert.deepEqual(panPhoto(2,40,60,10,15,100,150,200,300),panPhoto(2,40,60,20,30,200,300,200,300))
})
