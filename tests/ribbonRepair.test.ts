import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paintRibbonStroke } from '../src/ribbonBrush.ts'
import type { PixelImage } from '../src/ribbonBrush.ts'

const image=(width:number,height:number,alpha:number):PixelImage=>({width,height,data:Uint8ClampedArray.from({length:width*height*4},(_,i)=>i%4===3?alpha:[190,40,65][i%4])})
const alpha=(pixels:PixelImage,x:number,y:number)=>pixels.data[(y*pixels.width+x)*4+3]

test('从原图恢复被完全抠除的细绶带，不改动旁边背景或原图',()=>{
  const original=image(20,30,255),target=image(20,30,0),before=original.data.slice()
  paintRibbonStroke(target,original,{x:8.5,y:3.5},{x:8.5,y:25.5},1,'restore')
  for(let y=3;y<=25;y++)assert.equal(alpha(target,8,y),255)
  assert.equal(alpha(target,6,10),0);assert.equal(alpha(target,10,10),0)
  assert.deepEqual(target.data.slice((10*20+8)*4,(10*20+8)*4+3),original.data.slice((10*20+8)*4,(10*20+8)*4+3))
  assert.deepEqual(original.data,before)
})

test('快速斜向笔画连续，画笔外的奖牌像素保持不变',()=>{
  const original=image(40,40,255),target=image(40,40,0)
  target.data[(35*40+2)*4+3]=178
  paintRibbonStroke(target,original,{x:2.5,y:2.5},{x:35.5,y:35.5},2,'restore')
  for(let i=2;i<=35;i++)assert.equal(alpha(target,i,i),255)
  assert.equal(alpha(target,2,35),178)
})

test('擦除仅移除笔画范围，边缘羽化并保留原图的透明度',()=>{
  const original=image(20,20,128),target=image(20,20,0)
  paintRibbonStroke(target,original,{x:10.5,y:10.5},{x:10.5,y:10.5},3,'restore')
  assert.equal(alpha(target,10,10),128)
  assert.ok(alpha(target,12,11)>0&&alpha(target,12,11)<128)
  paintRibbonStroke(target,original,{x:10.5,y:10.5},{x:10.5,y:10.5},1,'erase')
  assert.equal(alpha(target,10,10),0)
  assert.equal(alpha(target,11,10),128)
})

test('画笔越界裁切到图片范围，不发生跨行写入',()=>{
  const original=image(10,10,255),target=image(10,10,0)
  const dirty=paintRibbonStroke(target,original,{x:-5,y:0},{x:2,y:0},3,'restore')
  assert.deepEqual(dirty,{x:0,y:0,width:5,height:3})
  assert.equal(alpha(target,9,9),0)
  assert.equal(target.data.length,400)
  assert.throws(()=>paintRibbonStroke(target,image(1,1,255),{x:0,y:0},{x:0,y:0},1,'restore'),/尺寸/)
})
