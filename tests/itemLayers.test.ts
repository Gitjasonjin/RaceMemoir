import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reorderItems,placeItemsRelative} from '../src/board/itemLayers.ts'
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

test('relative layers preserve source order and use the whole target group',()=>{
 const grouped=items.map(i=>i.id==='b'||i.id==='d'?{...i,groupId:'target'}:i)
 const names=(next:Memory[])=>next.map(i=>i.id).join('')
 assert.equal(names(placeItemsRelative(items,['e'],'b','below')),'aebcd')
 assert.equal(names(placeItemsRelative(items,['a'],'d','above')),'bcdae')
 assert.equal(names(placeItemsRelative(grouped,['e','a'],'d','below')),'aebcd')
 assert.equal(names(placeItemsRelative(grouped,['a','e'],'b','above')),'bcdae')
 const source=items.map(i=>i.id==='a'||i.id==='e'?{...i,groupId:'source'}:i)
 assert.equal(names(placeItemsRelative(source,['e'],'c','above')),'bcaed')
 assert(placeItemsRelative(source,['a'],'e','above')===source)
 assert(placeItemsRelative(items,['a'],'missing','below')===items)
 const locked=items.map(i=>i.id==='a'?{...i,locked:true}:i)
 assert(placeItemsRelative(locked,['a'],'c','above')===locked)
 for(const i of placeItemsRelative(items,['e'],'b','below'))assert.equal(i,items.find(o=>o.id===i.id))
})
