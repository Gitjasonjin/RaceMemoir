import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectionBounds,intersectsSelection} from '../src/board/selection.ts'
import {seed} from '../src/domain/model.ts'

test('marquee normalizes reverse drags and selects partial intersections',()=>{
  assert.deepEqual(selectionBounds(100,80,-20,-40),{x:-20,y:-40,width:120,height:120})
  const item={...seed.items[0],x:0,y:0,w:100,h:100,rotation:0}
  assert.ok(intersectsSelection(item,{x:90,y:90,width:20,height:20}))
  assert.equal(intersectsSelection(item,{x:101,y:101,width:20,height:20}),false)
})

test('rotated selection rejects empty corners of bounding box',()=>{
  const item={...seed.items[0],x:0,y:0,w:100,h:100,rotation:45}
  assert.equal(intersectsSelection(item,{x:-20,y:-20,width:5,height:5}),false)
  assert.ok(intersectsSelection(item,{x:45,y:-15,width:10,height:10}))
})
