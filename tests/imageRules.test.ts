import test from 'node:test'
import assert from 'node:assert/strict'
import {MAX_IMAGE_PIXELS,MAX_UPLOAD_IMAGE_PIXELS,processingImageSize} from '../src/domain/imageRules.ts'
import {readImageSize} from '../src/shared/readImageSize.ts'
import {readBatchPhoto} from '../src/items/photo/batchPhotos.ts'
import {AppError} from '../src/i18n/runtime.ts'

test('processing budget preserves small images and fits high resolution photos proportionally',()=>{
  assert.deepEqual(processingImageSize(6000,4000),{width:6000,height:4000,scale:1})
  assert.deepEqual(processingImageSize(5000,5000),{width:5000,height:5000,scale:1})
  for(const [width,height] of [[8064,6048],[6048,8064],[10000,5000],[12000,8000]]){
    const result=processingImageSize(width,height)
    assert.ok(result.width*result.height<=MAX_IMAGE_PIXELS)
    assert.ok(result.width<=width&&result.height<=height)
    assert.equal(result.scale,Math.sqrt(MAX_IMAGE_PIXELS/(width*height)))
    assert.ok(Math.abs(result.width-width*result.scale)<1)
    assert.ok(Math.abs(result.height-height*result.scale)<1)
  }
  assert.equal(MAX_UPLOAD_IMAGE_PIXELS,50_000_000)
  for(const size of [[0,10],[-1,10],[NaN,10],[1.5,10]])assert.throws(()=>processingImageSize(size[0],size[1]))
})

test('uploads accept 48MP originals, batch preserves bytes, bib keeps its old limit and bitmaps close',async t=>{
  let closes=0,decodes=0
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap')
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'createImageBitmap',descriptor);else Reflect.deleteProperty(globalThis,'createImageBitmap')})
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async(file:Blob)=>{
    decodes++
    const [width,height]=JSON.parse(await file.text())
    return {width,height,close(){closes++}}
  }})
  const file=new File(['[8064,6048]'],'48mp.png',{type:'image/png'})
  assert.deepEqual(await readImageSize(file),{width:8064,height:6048})
  await assert.rejects(readImageSize(file,MAX_IMAGE_PIXELS),e=>e instanceof AppError&&e.detail.key==='image.resolutionLimit'&&e.detail.values?.pixels==='25,000,000')
  const photo=await readBatchPhoto(file)
  assert.equal(photo.record.image,file)
  assert.equal(await photo.record.image.text(),'[8064,6048]')
  assert.equal(decodes,1)
  assert.equal(closes,1)
  assert.deepEqual(await readImageSize(new Blob(['[10000,5000]'],{type:'image/png'})),{width:10000,height:5000})
  await assert.rejects(readImageSize(new Blob(['[10000,5001]'],{type:'image/png'})),e=>e instanceof AppError&&e.detail.key==='image.resolutionLimit'&&e.detail.values?.pixels==='50,000,000')
  assert.equal(closes,3)
})
