import {test} from 'node:test'
import assert from 'node:assert/strict'
import {arrangeItems,expandGroups,snapMove,itemBounds} from '../src/board/layout.ts'
import {isBoard} from '../src/domain/model.ts'
import type {Memory} from '../src/domain/model'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
const item=(id:string,x:number,y:number,w=100):Memory=>({id,kind:'note',title:id,x,y,w,h:100,rotation:0})
test('alignment uses rotated bounds and preserves grouped geometry',()=>{
 const items=[{...item('a',0,0),groupId:'g'},{...item('b',120,20),groupId:'g'},{...item('c',400,80),rotation:45}]
 assert.deepEqual(expandGroups(items,['b']),['a','b'])
 const next=arrangeItems(items,['a','b','c'],'bottom')
 assert.equal(next[1].x-next[0].x,120);assert.equal(next[1].y-next[0].y,20)
 assert(Math.abs(itemBounds(next[1]).y+100-(itemBounds(next[2]).y+itemBounds(next[2]).h))<1e-7)
 assert.equal(items[0].y,0)
})
test('distribution spaces edges equally and locked selections remain unchanged',()=>{
 const items=[item('a',0,0,100),item('b',150,20,50),item('c',500,40,200)]
 const next=arrangeItems(items,['a','b','c'],'distributeX')
 assert.equal(next[1].x,275);assert.equal(next[0].x,0);assert.equal(next[2].x,500)
 const locked=items.map(i=>({...i,locked:i.id==='b'}));assert.equal(arrangeItems(locked,['a','b','c'],'top'),locked)
})
test('snapping is bounded and excludes selected objects',()=>{
 const items=[item('a',0,0),item('b',200,300)]
 const snap=snapMove(items,['a'],97,198,6);assert.equal(snap.dx,100);assert.equal(snap.dy,200);assert.equal(snap.guides.length,2)
 assert.equal(snapMove(items,['a','b'],17,29,6).guides.length,0)
})
test('group and lock metadata validates and survives ZIP restore',async()=>{
 const board={title:'layout',items:[{...item('a',0,0),groupId:'g',locked:true},{...item('b',100,0),groupId:'g',locked:true}],threads:[]}
 assert(isBoard(board));assert(!isBoard({...board,items:[{...board.items[0],locked:'yes'}]}))
 assert(!isBoard({...board,items:[{...board.items[0],groupId:''}]}))
 const restored=await readBackup(await makeZipArchive(board,[]));assert.equal(restored.board.items[0].groupId,restored.board.items[1].groupId);assert.equal(restored.board.items[0].locked,true)
})
