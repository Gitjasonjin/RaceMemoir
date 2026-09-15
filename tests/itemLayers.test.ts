import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reorderItems} from '../src/board/itemLayers.ts'
import type {Memory} from '../src/domain/model'
const items='abcde'.split('').map(id=>({id,kind:'photo',title:id,x:0,y:0,w:200,h:200,rotation:0}) as Memory)
const order=(ids:string[],action:Parameters<typeof reorderItems>[2])=>reorderItems(items,ids,action).map(i=>i.id).join('')
test('layer moves preserve batch order and move one adjacent layer at a time',()=>{
  assert.equal(order(['b','c'],'up'),'adbce');assert.equal(order(['b','c'],'down'),'bcade')
  assert.equal(order(['b','d'],'up'),'acbed');assert.equal(order(['b','d'],'down'),'badce')
  assert.equal(order(['d','b'],'top'),'acebd');assert.equal(order(['d','b'],'bottom'),'bdace')
  assert.equal(items.map(i=>i.id).join(''),'abcde')
})
test('boundary and missing selections do not reorder or replace items',()=>{
  for(const [ids,action] of [[['e'],'up'],[['a'],'down'],[['a','b','c','d','e'],'top'],[['missing'],'bottom']] as const){
    const next=reorderItems(items,[...ids],action);assert(next.every((item,i)=>item===items[i]))
  }
})
