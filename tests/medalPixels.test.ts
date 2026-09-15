import { test } from 'node:test'
import assert from 'node:assert/strict'
import { medalBounds, restoreMedalPixels } from '../src/items/medal/medalPixels.ts'
import { seed, isBoard } from '../src/domain/model.ts'

test('cutout preserves sharp source RGB and applies only mask alpha', () => {
  const original={width:3,height:1,data:new Uint8ClampedArray([255,255,255,255,0,0,0,255,191,48,32,80])}
  const mask={width:3,height:1,data:new Uint8ClampedArray([120,120,120,255,110,110,110,130,0,0,0,255])}
  assert.deepEqual([...restoreMedalPixels(original,mask)],[255,255,255,255,0,0,0,130,191,48,32,80])
  assert.equal(original.data[7],255)
  assert.throws(()=>restoreMedalPixels(original,{...mask,width:2}))
})

test('visible bounds include thin ribbon and exclude asymmetric transparent margins', () => {
  const image={width:12,height:20,data:new Uint8ClampedArray(12*20*4)}
  for(let y=2;y<=12;y++)image.data[(y*12+7)*4+3]=255
  for(let y=12;y<=16;y++)for(let x=5;x<=9;x++)image.data[(y*12+x)*4+3]=255
  image.data[3]=8
  assert.deepEqual(medalBounds(image),{x:5,y:2,width:5,height:15})
  assert.deepEqual(medalBounds({width:2,height:3,data:new Uint8ClampedArray(24)}),{x:0,y:0,width:2,height:3})
})

test('medal sizing survives board serialization and rejects invalid scales', () => {
  const board=structuredClone(seed),item=board.items.find(i=>i.kind==='medal')!
  item.medalScale=1.35;item.w=400;item.h=600
  const restored=JSON.parse(JSON.stringify(board))
  assert.ok(isBoard(restored))
  assert.equal(restored.items.find((i:{id:string})=>i.id===item.id).medalScale,1.35)
  for(const scale of [NaN,Infinity,0,-1,1.81]){item.medalScale=scale;assert.equal(isBoard(board),false)}
  delete item.medalScale
  assert.ok(isBoard(board))
})
