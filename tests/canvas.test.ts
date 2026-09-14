import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentBounds, fitCamera, screenToWorld, visibleBounds, unionBounds, exportSize } from '../src/canvas.ts'
import { seed, isBoard, pinPosition } from '../src/model.ts'

test('无限画布的负坐标和远距离藏品可保存并重新导入',()=>{
  const items=seed.items.map((i,index)=>({...i,x:index%2?-20000:35000,y:index%2?16000:-24000}))
  const data=JSON.parse(JSON.stringify({...seed,items}))
  assert.equal(isBoard(data),true)
  assert.deepEqual(data.items,items)
  const bounds=contentBounds(items)
  for(const item of items){const p=pinPosition(item);assert.ok(p.x>bounds.x&&p.y>bounds.y&&p.x<bounds.x+bounds.width&&p.y<bounds.y+bounds.height)}
})
test('旋转物件和伸出边缘的装饰均纳入全景范围',()=>{
  const item={...seed.items[0],x:-700,y:-600,w:200,h:300,rotation:90}
  const bounds=contentBounds([item],0)
  assert.ok(Math.abs(bounds.width-364)<.0001)
  assert.ok(Math.abs(bounds.height-264)<.0001)
  assert.equal(bounds.x,-782)
  assert.equal(bounds.y,-582)
})
test('全景适应覆盖全部藏品，且不会受旧画布范围或缩放下限限制',()=>{
  const bounds={x:-300000,y:-200000,width:900000,height:700000}
  const camera=fitCamera(bounds,1200,800)
  const visible=visibleBounds(camera,1200,800)
  assert.ok(camera.scale<.05)
  assert.ok(visible.x<=bounds.x&&visible.y<=bounds.y)
  assert.ok(visible.x+visible.width>=bounds.x+bounds.width)
  assert.ok(visible.y+visible.height>=bounds.y+bounds.height)
  const center=screenToWorld(600,400,camera)
  assert.ok(Math.abs(center.x-(bounds.x+bounds.width/2))<.001)
})
test('缩略图同时包含内容与远处的可视区域',()=>{
  const a={x:-100,y:-200,width:500,height:400},b={x:3000,y:2000,width:1000,height:600}
  assert.deepEqual(unionBounds(a,b),{x:-100,y:-200,width:4100,height:2800})
})
test('大范围导出限制像素尺寸，同时保持长宽比',()=>{
  const size=exportSize({x:-9000,y:1200,width:16000,height:8000})
  assert.deepEqual(size,{scale:.256,width:4096,height:2048})
  assert.deepEqual(exportSize({x:0,y:0,width:1000,height:600}),{scale:2,width:2000,height:1200})
  assert.ok(contentBounds([]).width>0)
})
