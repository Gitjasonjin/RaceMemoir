import {test} from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {unzipSync,strFromU8} from 'fflate'
import {fullQuad,validQuad,perspectiveTransform,outputSize,bibLayout} from '../src/items/bib/bibGeometry.ts'
import type {Quad} from '../src/items/bib/bibGeometry.ts'
import {validRecord,recordFor} from '../src/domain/records.ts'
import type {BibRecord} from '../src/domain/records.ts'
import {isBoard,createMemory} from '../src/domain/model.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {putRecords,readRecords,deleteRecord} from '../src/persistence/recordStore.ts'
import {validErasures,surroundingColor} from '../src/items/bib/bibErasure.ts'

const originalImage=new Blob(['original-pixels'],{type:'image/png'}),image=new Blob(['rectified-pixels'],{type:'image/png'})
const record:BibRecord={id:'bib1',kind:'bib',source:'upload',name:'测试号码布',number:'A174',note:'',originalImage,image,originalWidth:1600,originalHeight:1200,width:1000,height:600,quad:[{x:.1,y:.1},{x:.9,y:.2},{x:.8,y:.8},{x:.2,y:.9}],processing:'perspective'}

test('perspective maps rectangle corners exactly and rejects degenerate selections',()=>{
 const identity=perspectiveTransform(fullQuad());assert.deepEqual(identity(.3,.7),{x:.3,y:.7})
 const project=perspectiveTransform(record.quad!)
 fullQuad().forEach((p,i)=>{const actual=project(p.x,p.y);assert.ok(Math.abs(actual.x-record.quad![i].x)<1e-8);assert.ok(Math.abs(actual.y-record.quad![i].y)<1e-8)})
 const crop:Quad=[{x:.2,y:.1},{x:.8,y:.1},{x:.8,y:.9},{x:.2,y:.9}]
 assert.deepEqual(outputSize(crop,1000,500),{width:600,height:400})
 assert.ok(Math.abs(perspectiveTransform(crop)(.5,.5).x-.5)<1e-8)
 for(const q of [[fullQuad()[0],fullQuad()[2],fullQuad()[1],fullQuad()[3]],Array(4).fill({x:0,y:0}),[{x:-1,y:0},...fullQuad().slice(1)]]){assert.equal(validQuad(q),false);assert.throws(()=>perspectiveTransform(q as Quad))}
})
test('bib layout preserves portrait, landscape and extreme valid aspect ratios',()=>{
 for(const [w,h] of [[1418,945],[600,1400],[1000,100],[100,1000]])for(const target of [120,315,700]){
  const size=bibLayout(w,h,target);assert.ok(Math.abs(size.w/size.h-w/h)<1e-8);assert.ok(size.w>=30&&size.h>=30&&size.w<=700&&size.h<=700)
 }
})
test('bib validation protects images, dimensions and correction metadata',()=>{
 assert.equal(validRecord(record),true)
 for(const change of [{originalImage:undefined},{image:new Blob()},{width:NaN},{height:0},{width:25000,height:25000},{processing:'unknown'},{quad:[{x:0,y:0}]}])assert.equal(validRecord({...record,...change}),false)
 const item={...createMemory('bib','模板','green','','174'),recordId:record.id}
 assert.equal(recordFor(item,[record]),record);assert.equal(isBoard({title:'测试',items:[item],threads:[]}),true)
})
test('bib ZIP stores original and processed files separately and remaps shared references',async()=>{
 const item={...createMemory('bib','测试','green','','174'),recordId:record.id}
 const board={title:'真实号码布',items:[item,{...item,id:'second'}],threads:[]}
 const zip=await makeZipArchive(board,[record]),entries=unzipSync(new Uint8Array(await zip.arrayBuffer())),manifest=JSON.parse(strFromU8(entries['manifest.json']))
 assert.equal(manifest.version,8);assert.equal(Object.keys(entries).length,3);assert.notEqual(manifest.records[0].image.path,manifest.records[0].originalImage.path)
 const restored=await readBackup(zip),bib=restored.records[0] as BibRecord
 assert.deepEqual(await bib.image.text(),await image.text());assert.equal(await bib.originalImage.text(),await originalImage.text());assert.deepEqual(bib.quad,record.quad)
 assert.notEqual(bib.id,record.id);assert.ok(restored.board.items.every(i=>i.recordId===bib.id))
 await assert.rejects(makeZipArchive({...board,items:[{...item,kind:'photo'}]},[record]),/关联/)
})
test('local bib records preserve original bytes through recycle and restore',async()=>{
 await putRecords([record]);assert.equal((await readRecords()).find(r=>r.id===record.id)?.kind,'bib')
 await putRecords([{...record,archived:true}]);assert.equal((await readRecords())[0].archived,true)
 await putRecords([{...record,archived:false}]);assert.equal(await ((await readRecords())[0] as BibRecord).originalImage.text(),'original-pixels')
 await deleteRecord(record.id);assert.equal((await readRecords()).length,0)
})

test('erasure samples paper around lettering and validates normalized bounds and colours',()=>{
 const pixels=new Uint8ClampedArray(40*30*4)
 for(let i=0;i<pixels.length;i+=4)pixels.set([243,237,218,255],i)
 for(let y=10;y<20;y++)for(let x=12;x<28;x++)pixels.set([20,20,20,255],(y*40+x)*4)
 const rect={x:.25,y:.25,width:.5,height:.5,color:'#f3edda'}
 assert.equal(surroundingColor(pixels,40,30,rect),'#f3edda');assert.equal(validErasures([rect]),true)
 for(const change of [{x:-.1},{width:1},{height:NaN},{color:'transparent'},{color:'url(x)'},{width:0}])assert.equal(validErasures([{...rect,...change}]),false)
 assert.equal(validErasures(Array(51).fill(rect)),false)
 assert.equal(validRecord({...record,erasures:[{...rect,color:'invalid'}]}),false)
})

test('ZIP retains reversible erasure coordinates and original bytes',async()=>{
 const eras={x:.2,y:.6,width:.5,height:.1,color:'#f3edda'},bib={...record,erasures:[eras]}
 const board={title:'抹除',items:[{...createMemory('bib','测试','green','',''),recordId:bib.id}],threads:[]}
 const restored=(await readBackup(await makeZipArchive(board,[bib]))).records[0] as BibRecord
 assert.deepEqual(restored.erasures,[eras]);assert.equal(await restored.originalImage.text(),await record.originalImage.text())
})
