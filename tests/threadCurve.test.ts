import {test} from 'node:test'
import assert from 'node:assert/strict'
import {threadCurve} from '../src/board/threadCurve.ts'
import {seed,isBoard,pinPosition} from '../src/domain/model.ts'
import {contentBounds} from '../src/board/canvas.ts'
test('curvature supports straight lines and signed perpendicular bending',()=>{
  assert.deepEqual(threadCurve({x:0,y:0},{x:100,y:0},0).control,{x:50,y:0})
  assert.deepEqual(threadCurve({x:0,y:0},{x:100,y:0},.2).control,{x:50,y:40})
  assert.deepEqual(threadCurve({x:0,y:0},{x:0,y:100},-.2).control,{x:40,y:50})
})
test('natural curve hangs down and stays identical when endpoints are reversed',()=>{
  for(const [a,b] of [[{x:500,y:40},{x:0,y:20}],[{x:0,y:500},{x:200,y:0}],[{x:20,y:100},{x:20,y:0}]]){
    const forward=threadCurve(a,b),reverse=threadCurve(b,a)
    assert.deepEqual(forward.control,reverse.control)
    assert.ok(forward.control.y>=(a.y+b.y)/2)
  }
})
test('curvature survives serialization and invalid curvature is rejected',()=>{
  const board=structuredClone(seed)
  board.threads[0].curvature=-.25
  assert.ok(isBoard(JSON.parse(JSON.stringify(board))))
  for(const value of [NaN,Infinity,.36,-.36]){board.threads[0].curvature=value;assert.equal(isBoard(board),false)}
})
test('export bounds contain curved line extending beyond objects',()=>{
  const a={...seed.items[0],x:0,y:0,w:100,h:100,rotation:0},b={...a,id:'other',x:2000}
  const thread={id:'curve',from:a.id,to:b.id,curvature:.35}
  const bounds=contentBounds([a,b],0,[thread]),start=pinPosition(a),end=pinPosition(b),{control}=threadCurve(start,end,.35)
  const midY=(start.y+2*control.y+end.y)/4
  assert.ok(bounds.y+bounds.height>=midY+6)
})
