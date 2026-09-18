import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pinchCamera,touchPair} from '../src/board/touchNavigation.ts'

test('pinch preserves the world point under the moving two-finger midpoint',()=>{
  const view={x:20,y:-50,scale:.75},start=touchPair({x:100,y:150},{x:200,y:250}),next=touchPair({x:90,y:140},{x:290,y:340})
  const result=pinchCamera(view,start,next)
  assert.equal(result.scale,1.5)
  assert.equal((next.x-result.x)/result.scale,(start.x-view.x)/view.scale)
  assert.equal((next.y-result.y)/result.scale,(start.y-view.y)/view.scale)
})
test('equal-distance two-finger movement pans without zoom and clamps safely',()=>{
  const start=touchPair({x:10,y:20},{x:110,y:20}),next=touchPair({x:40,y:70},{x:140,y:70})
  assert.deepEqual(pinchCamera({x:0,y:0,scale:1},start,next),{x:30,y:50,scale:1})
  assert.equal(pinchCamera({x:0,y:0,scale:3},start,{...next,distance:200}).scale,4)
  assert.equal(pinchCamera({x:0,y:0,scale:.02},start,{...next,distance:1}).scale,.02)
  assert.ok(Object.values(pinchCamera({x:0,y:0,scale:1},touchPair({x:0,y:0},{x:0,y:0}),next)).every(Number.isFinite))
})
