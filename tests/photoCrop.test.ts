import {test} from 'node:test'
import assert from 'node:assert/strict'
import {panPhoto,photoCamera,cameraPhoto} from '../src/items/photo/photoCrop.ts'

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
test('touch crop camera preserves composition and constrains zoom and image edges',()=>{
  const g={width:200,height:200,naturalWidth:400,naturalHeight:200}
  assert.deepEqual(cameraPhoto(photoCamera(2,25,75,g),g),{photoZoom:2,photoX:25,photoY:75})
  assert.deepEqual(cameraPhoto({scale:10,x:1000,y:-10000},g),{photoZoom:3,photoX:0,photoY:100})
  assert.deepEqual(cameraPhoto({scale:.5,x:0,y:100},g),{photoZoom:1,photoX:0,photoY:50})
})
