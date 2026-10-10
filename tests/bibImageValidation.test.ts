import test from 'node:test'
import assert from 'node:assert/strict'
import {AppError} from '../src/i18n/runtime.ts'
import type {BibRecord,CollectionRecord} from '../src/domain/records.ts'
import {validRecord} from '../src/domain/records.ts'
import {validateArchiveImages} from '../src/persistence/archiveImageBudget.ts'
import {makeArchive,readArchive} from '../src/persistence/recordArchive.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {readImageHeader} from '../src/shared/imageHeader.ts'
import {checkBibImageDimensions,readBibImageHeader} from '../src/items/bib/bibImageValidation.ts'
import {processBibImage} from '../src/items/bib/processBibImage.ts'
import {fullQuad} from '../src/items/bib/bibGeometry.ts'
import {headerPng,pngBlob} from './helpers/imageFixture.ts'

const board={title:'bib image security',items:[],threads:[]}
const key=(name:string)=>(error:unknown)=>error instanceof AppError&&error.detail.key===name
const record=():BibRecord=>({id:'bib',kind:'bib',source:'upload',name:'bib',note:'',image:pngBlob(40,20),originalImage:pngBlob(80,40),width:40,height:20,originalWidth:80,originalHeight:40})
const restore=[
  async(bib:BibRecord)=>readArchive(await makeArchive(board,[bib])),
  async(bib:BibRecord)=>readBackup(await makeZipArchive(board,[bib])),
]

// Header tests do not allocate the declared pixels. Browser codecs are covered by the existing editor tests.
if(!globalThis.createImageBitmap)Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:()=>{throw Error('unexpected decode')}})

test('JSON and ZIP reject forged processed and original bib dimensions',async()=>{
  for(const change of [{width:41},{originalWidth:81}]){
    const bib={...record(),...change}
    assert.equal(validRecord(bib),true)
    for(const read of restore)await assert.rejects(read(bib),key('readImageSize.003'))
  }
})

test('JSON and ZIP reject bib images over 25M pixels despite small declared dimensions',async()=>{
  for(const field of ['image','originalImage'] as const){
    const bib={...record(),[field]:headerPng(6000,5000)}
    assert.equal(validRecord(bib),true)
    for(const read of restore)await assert.rejects(read(bib),key('image.resolutionLimit'))
  }
})

test('both bib images accept an EXIF-compatible exchange of axes without decoding',async t=>{
  let decodes=0
  t.mock.method(globalThis,'createImageBitmap',async()=>{decodes++;throw Error('unexpected decode')})
  const bib={...record(),width:20,height:40,originalWidth:40,originalHeight:80}
  for(const read of restore){
    const restored=(await read(bib)).records[0] as BibRecord
    assert.equal(restored.width,20);assert.equal(restored.originalHeight,80)
  }
  assert.equal(decodes,0)
})

test('25M bib boundary is accepted; a cached general header cannot bypass the tighter limit',async()=>{
  const image=headerPng(5000,5000)
  await validateArchiveImages([{...record(),image,originalImage:image,width:5000,height:5000,originalWidth:5000,originalHeight:5000}])
  const oversized=headerPng(5000,5001)
  await readImageHeader(oversized)
  await assert.rejects(readBibImageHeader(oversized),key('image.resolutionLimit'))
})

test('photo and medal originals keep their existing 50M pixel compatibility',async()=>{
  const image=headerPng(10000,5000)
  const photo:CollectionRecord={id:'photo',kind:'photo',name:'photo',note:'',source:'upload',image}
  const medal:CollectionRecord={id:'medal',kind:'medal',name:'medal',note:'',date:'',source:'upload',cutout:'original',image,originalImage:image}
  await validateArchiveImages([photo]);await validateArchiveImages([medal])
})

test('processing rejects oversized input before decode and closes mismatched decoded bitmaps',async t=>{
  let decodes=0,closes=0
  t.mock.method(globalThis,'createImageBitmap',async()=>{
    decodes++;return {width:81,height:40,close(){closes++}} as ImageBitmap
  })
  await assert.rejects(processBibImage(headerPng(6000,5000),fullQuad(),new AbortController().signal),key('image.resolutionLimit'))
  assert.equal(decodes,0)
  await assert.rejects(processBibImage(pngBlob(80,40),fullQuad(),new AbortController().signal),key('readImageSize.003'))
  assert.equal(decodes,1);assert.equal(closes,1)
})

test('processing cancellation stops before canvas allocation and permits oriented decoder axes',async t=>{
  let decodes=0,closes=0
  const controller=new AbortController()
  t.mock.method(globalThis,'createImageBitmap',async()=>{
    decodes++;controller.abort();return {width:40,height:80,close(){closes++}} as ImageBitmap
  })
  const aborted=new AbortController();aborted.abort()
  await assert.rejects(processBibImage(pngBlob(80,40),fullQuad(),aborted.signal),{name:'AbortError'})
  assert.equal(decodes,0)
  await assert.rejects(processBibImage(pngBlob(80,40),fullQuad(),controller.signal),{name:'AbortError'})
  assert.equal(decodes,1);assert.equal(closes,1)
})

test('eraser natural dimensions must remain within the validated header and pixel limit',()=>{
  assert.deepEqual(checkBibImageDimensions({width:40,height:80},{width:80,height:40}),{width:40,height:80})
  assert.throws(()=>checkBibImageDimensions({width:80,height:41},{width:80,height:40}),key('readImageSize.003'))
  assert.throws(()=>checkBibImageDimensions({width:5000,height:5001}),key('image.resolutionLimit'))
})
