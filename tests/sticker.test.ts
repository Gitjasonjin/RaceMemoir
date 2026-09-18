import {test} from 'node:test'
import assert from 'node:assert/strict'
import {unzipSync,strFromU8} from 'fflate'
import {alphaBounds,transparentBackground,borderPadding,outlineAlpha,stickerSize,resizeSticker} from '../src/items/sticker/stickerGeometry.ts'
import {createMemory,isBoard,canConnect,hasPin} from '../src/domain/model.ts'
import {validRecord,recordFor} from '../src/domain/records.ts'
import type {StickerRecord} from '../src/domain/records'
import {resolveEndpoint} from '../src/board/threadEndpoints.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {restoreMedalPixels} from '../src/items/medal/medalPixels.ts'
import {applyPaperFinish} from '../src/items/sticker/paperFinish.ts'
import {tornContourAlpha} from '../src/items/sticker/tornPaper.ts'

import {sketchContour,applyWashiFinish} from '../src/items/sticker/stickerFinish.ts'

const image=new Blob(['original'],{type:'image/png'}),cutout=new Blob(['alpha'],{type:'image/png'})
const record:StickerRecord={id:'sticker-record',kind:'sticker',source:'upload',name:'山野',note:'',originalImage:image,image:cutout,imageMode:'cutout',width:150,height:300}
const item={...createMemory('sticker','山野','','',''),recordId:record.id,stickerBorder:2}

test('sticker records require a visible image source, valid dimensions and a real cutout in cutout mode',()=>{
  assert.equal(validRecord(record),true)
  assert.equal(validRecord({...record,image:undefined}),false)
  assert.equal(validRecord({...record,image:undefined,imageMode:'original'}),true)
  for(const change of [{originalImage:new Blob()},{width:0},{height:NaN},{width:25_000_001},{imageMode:'unknown'}])assert.equal(validRecord({...record,...change}),false)
  assert.equal(recordFor(item,[record]),record)
})
test('transparent bounds remove empty margins and detect empty or already transparent images by pixels',()=>{
  const pixels=new Uint8ClampedArray(10*8*4)
  assert.equal(alphaBounds(pixels,10,8),null)
  for(let y=2;y<=5;y++)for(let x=3;x<=7;x++)pixels[(y*10+x)*4+3]=255
  assert.deepEqual(alphaBounds(pixels,10,8),{x:3,y:2,width:5,height:4})
  assert.equal(transparentBackground(pixels,10,8),true)
  pixels.fill(255);assert.equal(transparentBackground(pixels,10,8),false)
})
test('contour expands outward, preserves empty corners and reserves enough padding',()=>{
  const alpha=new Uint8Array(9*9);alpha[4*9+4]=255
  const result=outlineAlpha(alpha,9,9,2)
  assert.equal(result[4*9+4],255)
  assert.equal(result[4*9+6],128)
  assert.equal(result[0],0)
  assert.equal(result[4*9+1],0)
  assert.equal(borderPadding(100,200,0),0)
  assert.ok(borderPadding(100,200,5)>10)
})
test('sticker size keeps the padded ratio and center across source changes',()=>{
  const plain=stickerSize(100,200,0,240)
  assert.deepEqual(plain,{w:120,h:240})
  const framed=stickerSize(100,200,2,240)
  assert.equal(framed.h,240);assert.ok(framed.w>120)
  const resized=resizeSticker({...item,x:20,y:30,w:120,h:240},300,100,0)
  assert.equal(resized.w,240);assert.equal(resized.h,80)
  assert.equal(resized.x+resized.w/2,80);assert.equal(resized.y+resized.h/2,150)
})
test('cutout mask keeps original RGB and never restores source transparency',()=>{
  const original={width:2,height:1,data:new Uint8ClampedArray([10,20,30,255,70,80,90,0])}
  const mask={width:2,height:1,data:new Uint8ClampedArray([200,200,200,128,255,255,255,255])}
  assert.deepEqual([...restoreMedalPixels(original,mask)],[10,20,30,128,70,80,90,0])
})
test('paper finish is deterministic, preserves cutout alpha and keeps print detail',()=>{
  const source=new Uint8ClampedArray(12*12*4)
  for(let y=2;y<10;y++)for(let x=2;x<10;x++){const i=(y*12+x)*4;source.set([44,122,102,255],i)}
  const output=applyPaperFinish(source.slice(),12,12)
  assert.deepEqual(output,applyPaperFinish(source.slice(),12,12))
  for(let i=3;i<source.length;i+=4)assert.equal(output[i],source[i])
  const center=(6*12+6)*4
  for(let channel=0;channel<3;channel++)assert.ok(Math.abs(output[center+channel]-source[center+channel])<=4)
  assert.notDeepEqual(output,source)
})
test('stickers have no mounts or endpoints and invalid backup links are rejected',()=>{
  const second={...item,id:'other'}
  const board={title:'贴纸',items:[item,second],threads:[]}
  assert.equal(isBoard(board),true);assert.equal(canConnect(item),false);assert.equal(hasPin(item),false)
  assert.equal(resolveEndpoint(board,[record],{itemId:item.id}),null)
  assert.equal(isBoard({...board,threads:[{id:'t',from:item.id,to:second.id}]}),false)
  assert.equal(isBoard({...board,items:[{...item,stickerBorder:6}]}),false)
  assert.equal(isBoard({...board,items:[{...item,stickerStyle:'torn'}]}),true)
  assert.equal(isBoard({...board,items:[{...item,stickerStyle:'stamp'}]}),false)
})

test('torn edges follow the subject including holes, preserve alpha and keep its center',()=>{
  const alpha=new Uint8Array(100*100)
  for(let y=20;y<80;y++)for(let x=20;x<80;x++)if(x<30||x>=70||y<30||y>=70)alpha[y*100+x]=255
  const result=tornContourAlpha(alpha,100,100,5)
  assert.deepEqual(result,tornContourAlpha(alpha,100,100,5))
  assert.notDeepEqual(result,outlineAlpha(alpha,100,100,5))
  assert.equal(result[0],0);assert.equal(result[50*100+50],0)
  for(let i=0;i<alpha.length;i++)assert.ok(result[i]>=alpha[i])
  assert.deepEqual(tornContourAlpha(alpha,100,100,0),Uint8ClampedArray.from(alpha))
  const original={...item,x:10,y:20,w:120,h:240},next=resizeSticker(original,100,200,2,240,'torn')
  assert.equal(next.stickerStyle,'torn');assert.ok(Math.abs(next.h-240)<1e-8);assert.ok(next.w>120)
  assert.equal(next.x+next.w/2,original.x+original.w/2);assert.equal(next.y+next.h/2,original.y+original.h/2)
})
test('sketch ink follows the outer contour and washi keeps empty areas transparent',()=>{
  const alpha=new Uint8Array(100*100),source=new Uint8ClampedArray(100*100*4)
  for(let y=20;y<80;y++)for(let x=20;x<80;x++){alpha[y*100+x]=255;source.set([110,150,120,255],(y*100+x)*4)}
  const ink=sketchContour(alpha,100,100,6)
  assert.equal(ink[0],0);assert.equal(ink[50*100+50],0);assert.ok(ink.some(v=>v>0))
  assert.deepEqual(ink,sketchContour(alpha,100,100,6))
  const washi=applyWashiFinish(source.slice(),100,100)
  assert.deepEqual(washi,applyWashiFinish(source.slice(),100,100))
  for(let i=0;i<source.length;i+=4){
    if(!source[i+3])assert.deepEqual(washi.slice(i,i+4),source.slice(i,i+4))
    else {assert.ok(washi[i+3]>200&&washi[i+3]<255);assert.ok(washi[i]>source[i])}
  }
  for(const style of ['contour','torn','sketch','washi'])assert.equal(isBoard({title:'test',items:[{...item,stickerStyle:style}],threads:[]}),true)
})
test('v8 ZIP keeps both originals and cutouts as separate assets and remaps reusable records',async()=>{
  const board={title:'贴纸备份',items:[item,{...item,id:'another',stickerBorder:0,stickerStyle:'torn' as const,stickerAdhesion:'wrinkled' as const},{...item,id:'sketch',stickerStyle:'sketch' as const},{...item,id:'washi',stickerStyle:'washi' as const}],threads:[]}
  const zip=await makeZipArchive(board,[record]),entries=unzipSync(new Uint8Array(await zip.arrayBuffer()))
  const json=strFromU8(entries['manifest.json']),manifest=JSON.parse(json)
  assert.equal(manifest.version,8);assert.ok(!json.includes('base64'))
  assert.notEqual(manifest.records[0].originalImage.path,manifest.records[0].image.path)
  const restored=await readBackup(zip),next=restored.records[0] as StickerRecord
  assert.notEqual(next.id,record.id);assert.equal(restored.board.items[0].recordId,next.id);assert.equal(restored.board.items[1].recordId,next.id)
  assert.equal(await next.originalImage.text(),'original');assert.equal(await next.image!.text(),'alpha')
  assert.equal(next.imageMode,'cutout');assert.equal(restored.board.items[1].stickerBorder,0)
  assert.equal(restored.board.items[1].stickerAdhesion,'wrinkled');assert.equal(restored.board.items[0].stickerAdhesion,undefined)
  assert.equal(restored.board.items[2].stickerStyle,'sketch');assert.equal(restored.board.items[3].stickerStyle,'washi')
  assert.equal(restored.board.items[1].stickerStyle,'torn');assert.equal(restored.board.items[0].stickerStyle,undefined)
})
