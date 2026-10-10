import {test} from 'node:test'
import assert from 'node:assert/strict'
import {zipSync,strToU8} from 'fflate'
import {AppError} from '../src/i18n/runtime.ts'
import type {MessageKey} from '../src/i18n/runtime.ts'
import {isBoard,pinPosition} from '../src/domain/model.ts'
import type {Board} from '../src/domain/model.ts'
import {MAX_ROTATION,MAX_WORLD_COORDINATE,MIN_CAMERA_SCALE} from '../src/domain/geometryLimits.ts'
import {MAX_POINTS,validRecord} from '../src/domain/records.ts'
import type {CollectionRecord} from '../src/domain/records.ts'
import {contentBounds,fitCamera,exportSize,screenToWorld,visibleBounds,unionBounds} from '../src/board/canvas.ts'
import {makeArchive,readArchive,restoreArchive} from '../src/persistence/recordArchive.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {hasArchiveBudget,MAX_ARCHIVE_POINTS,MAX_ARCHIVE_RECORDS} from '../src/persistence/archiveLimits.ts'
import {isSeasonView,isSeasonWorkspace,readSeasonWorkspace,SEASON_STORAGE_KEY} from '../src/persistence/seasonStore.ts'

const blank:Board={title:'Safety',items:[],threads:[]}
const note={id:'n',kind:'note' as const,x:0,y:0,w:100,h:100,rotation:0,title:'n'}
const route=(index:number):CollectionRecord=>({id:`r${index}`,kind:'route',name:'n',note:'',source:'demo',trackPoints:[]})
const isError=(key:MessageKey)=>(error:unknown)=>error instanceof AppError&&error.detail.key===key
const packedZip=(board:Board,records:unknown[])=>new Blob([zipSync({'manifest.json':strToU8(JSON.stringify({format:'racememoir',version:8,board,records}))},{level:0})])

test('tiny backups cannot inject overflowing rotation or coordinates through either format',async()=>{
  for(const change of [{rotation:1e308},{rotation:-1e308},{x:1e308},{y:-1e308},{x:MAX_WORLD_COORDINATE+1},{rotation:MAX_ROTATION+1}]){
    const board={...blank,items:[{...note,...change}]}
    assert.equal(isBoard(board),false)
    await assert.rejects(readArchive(JSON.stringify(board)),isError('recordArchive.007'))
    await assert.rejects(readBackup(packedZip(board,[])),isError('zipArchive.006'))
    await assert.rejects(makeZipArchive(board,[]),isError('recordArchive.004'))
  }
})

test('far negative coordinates and many legitimate rotations retain finite geometry and old backup compatibility',async()=>{
  const board={...blank,items:[{...note,x:-MAX_WORLD_COORDINATE,y:MAX_WORLD_COORDINATE,rotation:MAX_ROTATION}]}
  assert.equal(isBoard(board),true)
  const zeroRotation={...board.items[0],rotation:0}
  assert.deepEqual(contentBounds(board.items),contentBounds([zeroRotation]))
  assert.deepEqual(pinPosition(board.items[0]),pinPosition(zeroRotation))
  const bounds=contentBounds(board.items),camera=fitCamera(bounds,1440,900),size=exportSize(bounds)
  assert(Object.values(camera).every(Number.isFinite));assert(Object.values(size).every(Number.isFinite))
  assert.deepEqual((await readArchive(JSON.stringify(board))).board,board)
  assert.deepEqual((await readBackup(await makeZipArchive(board,[]))).board,board)
})

test('geometry entry points reject invalid results instead of propagating NaN or infinity',()=>{
  assert.throws(()=>contentBounds([{...note,rotation:1e308}]),isError('exportImage.001'))
  assert.throws(()=>contentBounds([note],Infinity),isError('exportImage.001'))
  for(const bounds of [{x:0,y:0,width:NaN,height:100},{x:Infinity,y:0,width:100,height:100},{x:0,y:0,width:0,height:100},{x:1e308,y:0,width:1e308,height:100}]){
    assert.throws(()=>fitCamera(bounds,1440,900),isError('exportImage.001'))
    assert.throws(()=>exportSize(bounds),isError('exportImage.001'))
  }
  assert.throws(()=>fitCamera({x:0,y:0,width:100,height:100},Infinity,900),isError('exportImage.001'))
  assert.throws(()=>screenToWorld(0,0,{x:0,y:0,scale:0}),isError('exportImage.001'))
  assert.throws(()=>visibleBounds({x:0,y:0,scale:1e-308},100,100),isError('exportImage.001'))
  assert.throws(()=>unionBounds({x:-1e308,y:0,width:100,height:100},{x:1e308,y:0,width:100,height:100}),isError('exportImage.001'))
  assert.deepEqual(visibleBounds({x:0,y:0,scale:1},0,0),{x:0,y:0,width:0,height:0})
})

test('saved camera scales reject underflow while retaining the full accepted world range',()=>{
  const view={x:0,y:0,scale:1e-308},workspace={version:1,activeYear:2026,seasons:[{year:2026,board:blank,view},{year:2025,board:blank}]}
  assert.equal(isSeasonView(view),false);assert.equal(isSeasonWorkspace(workspace),false)
  const raw=JSON.stringify(workspace),storage={getItem:(key:string)=>key===SEASON_STORAGE_KEY?raw:null,setItem:()=>{throw new Error('Reading must not overwrite a damaged save')}}
  const loaded=readSeasonWorkspace(()=>blank,2026,storage)
  assert.equal(loaded.issues[0]?.status,'corrupt');assert.equal(loaded.workspace.seasons[0].view,undefined)
  const limitView={x:0,y:0,scale:MIN_CAMERA_SCALE}
  assert.equal(isSeasonView(limitView),true);assert(Object.values(visibleBounds(limitView,1440,900)).every(Number.isFinite))
  const camera=fitCamera(contentBounds([{...note,x:-MAX_WORLD_COORDINATE},{...note,id:'far',x:MAX_WORLD_COORDINATE}]),0,0)
  assert(camera.scale>=MIN_CAMERA_SCALE);assert.equal(isSeasonView(camera),true)
})

test('JSON and ZIP reject excessive collections before decoding the first invalid asset or generating ids',async t=>{
  t.mock.method(crypto,'randomUUID',()=>{throw new Error('Over-budget input must not allocate ids')})
  const records=[{id:'bad',kind:'photo',name:'bad',note:'',source:'upload',image:'invalid'},...Array.from({length:MAX_ARCHIVE_RECORDS},(_,index)=>route(index))]
  await assert.rejects(readArchive(JSON.stringify({format:'racememoir',version:2,board:blank,records})),isError('recordArchive.007'))
  await assert.rejects(readBackup(packedZip(blank,records)),isError('zipArchive.006'))
  const validRecords=Array.from({length:MAX_ARCHIVE_RECORDS+1},(_,index)=>route(index))
  await assert.rejects(makeArchive(blank,validRecords),isError('recordArchive.010'))
  await assert.rejects(makeZipArchive(blank,validRecords),isError('recordArchive.004'))
  assert.throws(()=>restoreArchive(blank,validRecords),isError('recordArchive.004'))
})

test('both archive formats still roundtrip collections at the shared 10000-record boundary',async()=>{
  const records=Array.from({length:MAX_ARCHIVE_RECORDS},(_,index)=>route(index))
  assert.equal((await readArchive(await makeArchive(blank,records))).records.length,MAX_ARCHIVE_RECORDS)
  assert.equal((await readBackup(await makeZipArchive(blank,records))).records.length,MAX_ARCHIVE_RECORDS)
})

test('total track work is bounded even when every route meets its own point limit',async()=>{
  const trackPoints=Array.from({length:MAX_POINTS},()=>({lat:0,lon:0,segment:0}))
  const within=Array.from({length:MAX_ARCHIVE_POINTS/MAX_POINTS},(_,index)=>({...route(index),kind:'route' as const,trackPoints}))
  assert.equal(validRecord(within[0]),true)
  assert.equal(hasArchiveBudget(within),true)
  const excessive=[...within,{...route(within.length),kind:'route' as const,trackPoints:[{lat:0,lon:0,segment:0}]}]
  assert.equal(hasArchiveBudget(excessive),false)
  await assert.rejects(makeArchive(blank,excessive),isError('recordArchive.010'))
  await assert.rejects(makeZipArchive(blank,excessive),isError('recordArchive.004'))
})
