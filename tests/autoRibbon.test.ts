import { test } from 'node:test'
import assert from 'node:assert/strict'
import { automaticRibbonMask } from '../src/items/medal/autoRibbon.ts'
import type { PixelImage } from '../src/items/medal/ribbonBrush.ts'

function fixture(){
  const width=100,height=120
  const original:PixelImage={width,height,data:Uint8ClampedArray.from({length:width*height*4},(_,i)=>i%4===3?255:220)}
  const model:PixelImage={width,height,data:new Uint8ClampedArray(width*height*4)}
  rect(original,30,65,70,100,[180,120,45,255]);rect(model,30,65,70,100,[180,120,45,255])
  return {original,model}
}
function rect(image:PixelImage,left:number,top:number,right:number,bottom:number,color:number[]){
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)image.data.set(color,(y*image.width+x)*4)
}

test('自动找回连到奖牌并延伸到图片边缘的绶带，排除独立杂物与浅阴影',()=>{
  const {original,model}=fixture()
  rect(original,42,0,58,65,[90,175,100,255])
  rect(original,85,0,100,12,[10,60,20,255])
  rect(original,70,65,85,105,[170,170,170,255])
  const before=original.data.slice(),mask=automaticRibbonMask(original,model)!
  assert.ok(mask);assert.equal(mask[20*100+50],255)
  assert.equal(mask[85*100+45],255);assert.equal(mask[5*100+90],0)
  assert.equal(mask[80*100+76],0);assert.equal(mask[10*100+15],0)
  assert.deepEqual(original.data,before)
})

test('自动保留红、蓝、黑色绶带，不依赖固定位置和绿色特征',()=>{
  for(const color of [[185,35,45,255],[30,70,190,255],[20,20,20,255]]){
    const {original,model}=fixture();rect(original,0,70,30,80,color)
    const mask=automaticRibbonMask(original,model)!
    assert.ok(mask);assert.equal(mask[75*100+10],255)
  }
})

test('保留绶带小字但不填满环形绶带中的大空洞',()=>{
  const {original,model}=fixture()
  rect(original,36,5,43,70,[90,175,100,255]);rect(original,57,5,64,70,[90,175,100,255])
  rect(original,36,5,64,12,[90,175,100,255]);rect(original,38,20,40,23,[220,220,220,255])
  const mask=automaticRibbonMask(original,model)!
  assert.equal(mask[21*100+39],255);assert.equal(mask[35*100+50],0)
})

test('绶带上延伸到图片顶边的浅色印字不会变成透明缺口',()=>{
  const {original,model}=fixture()
  rect(original,40,0,60,65,[90,175,100,255]);rect(original,48,0,52,14,[220,220,220,255])
  const mask=automaticRibbonMask(original,model)!
  assert.equal(mask[50],255);assert.equal(mask[8*100+50],255)
  assert.equal(mask[8*100+38],0)
})

test('复杂背景或缺少可信前景时不盲目扩展',()=>{
  const {original,model}=fixture()
  for(let i=0;i<original.width*original.height;i++)original.data.set(i%2?[220,0,0,255]:[0,0,220,255],i*4)
  assert.equal(automaticRibbonMask(original,model),null)
  const plain=fixture();plain.model.data.fill(0)
  assert.equal(automaticRibbonMask(plain.original,plain.model),null)
})

test('不把原图透明区域变为不透明，也不改写模型遮罩',()=>{
  const {original,model}=fixture();rect(original,42,0,58,65,[90,175,100,255])
  rect(original,45,20,50,25,[90,175,100,0]);const before=model.data.slice()
  const mask=automaticRibbonMask(original,model)!
  assert.equal(mask[22*100+47],0);assert.deepEqual(model.data,before)
})
