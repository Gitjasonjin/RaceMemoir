import test from 'node:test'
import assert from 'node:assert/strict'
import {AppError} from '../src/i18n/runtime.ts'
import {parseImageHeader,readImageHeader} from '../src/shared/imageHeader.ts'
import {readImageSize} from '../src/shared/readImageSize.ts'
import {ImageImportBudget,MAX_IMPORT_IMAGE_PIXELS,MAX_IMPORT_IMAGE_BYTES} from '../src/shared/imageBudget.ts'
import {readBatchPhoto} from '../src/items/photo/batchPhotos.ts'
import {makeArchive,readArchive} from '../src/persistence/recordArchive.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import type {CollectionRecord} from '../src/domain/records.ts'
import {headerPng,pngBytes,pngChunk,pngBlob} from './helpers/imageFixture.ts'

const key=(name:string)=>(error:unknown)=>error instanceof AppError&&error.detail.key===name
function jpeg(width:number,height:number,marker=0xc0){
  return new Blob([new Uint8Array([255,216,255,marker,0,11,8,height>>8,height&255,width>>8,width&255,1,1,17,0,255,218,0,8,1,1,0,0,63,0,0,255,217])],{type:'image/jpeg'})
}
function webp(width:number,height:number,lossless=false,canvas?:[number,number],animation=false){
  const chunks:Buffer[]=[]
  const chunk=(type:string,payload:Buffer)=>{const b=Buffer.alloc(8+payload.length+payload.length%2);b.write(type);b.writeUInt32LE(payload.length,4);b.set(payload,8);return b}
  if(canvas){const p=Buffer.alloc(10);p[0]=animation?2:0;p.writeUIntLE(canvas[0]-1,4,3);p.writeUIntLE(canvas[1]-1,7,3);chunks.push(chunk('VP8X',p))}
  if(lossless){const p=Buffer.alloc(5);p[0]=47;p.writeUInt32LE(((width-1)|((height-1)<<14))>>>0,1);chunks.push(chunk('VP8L',p))}
  else{const p=Buffer.from([0,0,0,0x9d,1,0x2a,0,0,0,0]);p.writeUInt16LE(width,6);p.writeUInt16LE(height,8);chunks.push(chunk('VP8 ',p))}
  const bytes=Buffer.concat([Buffer.from('RIFF0000WEBP'),...chunks]);bytes.writeUInt32LE(bytes.length-8,4)
  return new Blob([bytes],{type:'image/webp'})
}
function decoder(t:test.TestContext,size?:{width:number;height:number}){
  let calls=0,closes=0
  t.mock.method(globalThis as typeof globalThis&{createImageBitmap:unknown},'createImageBitmap',async(file:Blob)=>{
    calls++;return {...(size??await readImageHeader(file)),close(){closes++}}
  })
  return {get calls(){return calls},get closes(){return closes}}
}
// Node has no image decoder. The spy deliberately returns dimensions only; browser tests use real codecs.
if(!globalThis.createImageBitmap)Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:()=>{throw Error('unexpected decode')}})

test('PNG, baseline/progressive JPEG and all static WebP headers parse without decoding',async()=>{
  for(const blob of [headerPng(800,600),jpeg(800,600),jpeg(800,600,0xc2),webp(800,600),webp(800,600,true),webp(800,600,false,[800,600])]){
    assert.deepEqual(await readImageHeader(blob),{width:800,height:600})
  }
})
test('extreme and zero dimensions, tighter caller limits, and forged MIME fail before decoder entry',async t=>{
  const spy=decoder(t)
  for(const blob of [headerPng(10000,5001),jpeg(65535,65535),webp(16000,16000),webp(16000,16000,true)])await assert.rejects(readImageSize(blob),key('image.resolutionLimit'))
  await assert.rejects(readImageSize(headerPng(0,1)))
  await assert.rejects(readImageSize(headerPng(8064,6048),25_000_000),key('image.resolutionLimit'))
  await assert.rejects(readImageSize(new Blob([pngBytes()],{type:'image/jpeg'})))
  assert.equal(spy.calls,0)
})
test('truncated chunks, inconsistent WebP canvas and animated containers fail closed',async t=>{
  const spy=decoder(t),bytes=pngBytes()
  for(let length=0;length<bytes.length;length++)await assert.rejects(readImageSize(new Blob([bytes.subarray(0,length)],{type:'image/png'})))
  const apng=new Blob([bytes.subarray(0,33),pngChunk('acTL',new Uint8Array(8)),bytes.subarray(33)],{type:'image/png'})
  await assert.rejects(readImageSize(apng),key('image.animationUnsupported'))
  await assert.rejects(readImageSize(webp(20,10,false,[10,10])))
  await assert.rejects(readImageSize(webp(10,10,false,[10,10],true)),key('image.animationUnsupported'))
  const bad=Buffer.from(bytes);bad.writeUInt32BE(0xffffffff,33)
  await assert.rejects(readImageSize(new Blob([bad],{type:'image/png'})))
  assert.equal(spy.calls,0)
})
test('decoder dimensions are cross-checked and bitmaps close even on mismatch',async t=>{
  const spy=decoder(t,{width:100,height:100})
  await assert.rejects(readImageSize(pngBlob()),key('readImageSize.003'))
  assert.equal(spy.calls,1);assert.equal(spy.closes,1)
})
test('EXIF axis swaps preserve valid image dimensions',async t=>{
  decoder(t,{width:10,height:20})
  assert.deepEqual(await readImageSize(headerPng(20,10)),{width:10,height:20})
})
test('batch charges aggregate pixels before decoding, including repeated references',async t=>{
  const spy=decoder(t),budget=new ImageImportBudget(),file=new File([headerPng(10000,5000)],'photo.png',{type:'image/png'})
  await readBatchPhoto(file,{budget});await readBatchPhoto(new File([file],'second.png',{type:'image/png'}),{budget})
  await assert.rejects(readBatchPhoto(new File([file],'third.png',{type:'image/png'}),{budget}),key('image.importBudget'))
  assert.equal(MAX_IMPORT_IMAGE_PIXELS,100_000_000);assert.equal(spy.calls,2)
  const repeated=new ImageImportBudget()
  await repeated.reserve(file);await repeated.reserve(file)
  await assert.rejects(repeated.reserve(file),key('image.importBudget'))
})
test('failed decodes release the batch reservation, cancelled work never decodes',async t=>{
  const budget=new ImageImportBudget(),file=new File([headerPng(10000,5000)],'photo.png',{type:'image/png'})
  const spy=decoder(t,{width:1,height:1})
  for(let i=0;i<3;i++)await assert.rejects(readBatchPhoto(file,{budget}),key('readImageSize.003'))
  const controller=new AbortController();controller.abort()
  await assert.rejects(readBatchPhoto(file,{budget,signal:controller.signal}),{name:'AbortError'})
  assert.equal(spy.calls,1)
  // A released reservation is reusable and release is idempotent.
  const release=await budget.reserve(file);release();release();await budget.reserve(file);await budget.reserve(file)
})
test('encoded-byte budget bounds tiny-pixel inputs with large metadata',async()=>{
  const bytes=pngBytes(),metadata=pngChunk('tEXt',new Uint8Array(17*1024*1024))
  const file=new Blob([bytes.subarray(0,33),metadata,bytes.subarray(33)],{type:'image/png'}),budget=new ImageImportBudget()
  assert.equal(MAX_IMPORT_IMAGE_BYTES,80*1024*1024)
  for(let i=0;i<4;i++)await budget.reserve(file)
  await assert.rejects(budget.reserve(file),key('image.importBudget'))
})
test('JSON and ZIP restore validate image contents and aggregate all original/processed references',async t=>{
  const spy=decoder(t),board={title:'security',items:[],threads:[]}
  const record=(id:string,image:Blob):CollectionRecord=>({id,kind:'photo',name:id,note:'',source:'upload',image})
  const large=headerPng(10000,5000)
  for(const records of [
    [record('bad',headerPng(10000,5001))],
    [record('bad',new Blob(['not an image'],{type:'image/png'}))],
    [record('a',large),record('b',large),record('c',large)],
    [{id:'medal',kind:'medal',name:'m',note:'',date:'',source:'upload',cutout:'done',image:large,originalImage:large},record('a',pngBlob())] as CollectionRecord[],
  ]){
    await assert.rejects(readArchive(await makeArchive(board,records)))
    await assert.rejects(readBackup(await makeZipArchive(board,records)))
  }
  const valid=[record('a',pngBlob())]
  assert.equal((await readArchive(await makeArchive(board,valid))).records.length,1)
  assert.equal((await readBackup(await makeZipArchive(board,valid))).records.length,1)
  assert.equal(spy.calls,0)
})
test('header parser rejects unknown formats and duplicate PNG dimensions',()=>{
  const bytes=pngBytes()
  assert.throws(()=>parseImageHeader(bytes,'image/gif'))
  assert.throws(()=>parseImageHeader(Buffer.concat([bytes.subarray(0,33),bytes.subarray(8)]),'image/png'))
})
