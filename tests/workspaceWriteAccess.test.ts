import {test} from 'node:test'
import assert from 'node:assert/strict'
import {IDBFactory} from 'fake-indexeddb'
import {AppError} from '../src/i18n/runtime.ts'
import {WorkspaceWriteAccess,createRecordWriteGuard} from '../src/persistence/workspaceWriteAccess.ts'
import {readSeasonWorkspace,SeasonBoardSession,SEASON_STORAGE_KEY} from '../src/persistence/seasonStore.ts'
import {deleteRecords,putRecords,readRecords} from '../src/persistence/recordStore.ts'
import type {Board} from '../src/domain/model.ts'
import type {SeasonStorage} from '../src/persistence/seasonStore.ts'

type Request=NonNullable<ConstructorParameters<typeof WorkspaceWriteAccess>[0]>
class Locks{
  held=false
  request:Request=async(_name,_options,callback)=>{
    if(this.held)return callback(null)
    this.held=true
    try{return await callback({})}finally{this.held=false}
  }
}
class Storage implements SeasonStorage{
  values=new Map<string,string>()
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){this.values.set(key,value)}
}
const blank=(title='Board'):Board=>({title,items:[],threads:[]})
const session=(storage:Storage)=>new SeasonBoardSession(readSeasonWorkspace(()=>blank(),2026,storage).workspace,storage)
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve))
const errorKey=(key:string)=>(error:unknown)=>error instanceof AppError&&error.detail.key===key

test('only one page owns the writer lease; a refreshed page can acquire it after close',async context=>{
  const locks=new Locks(),a=new WorkspaceWriteAccess(locks.request),b=new WorkspaceWriteAccess(locks.request)
  const releaseA=a.retain(),releaseB=b.retain();context.after(releaseB)
  await Promise.all([a.ready,b.ready])
  assert.equal(a.writable,true);assert.equal(b.status,'read-only')
  let writes=0
  await assert.rejects(b.run(async()=>{writes++}),errorKey('saveConflict.readOnly'))
  assert.equal(writes,0)
  releaseA();await turn()
  const fresh=new WorkspaceWriteAccess(locks.request),release=fresh.retain();context.after(release)
  await fresh.ready;assert.equal(fresh.writable,true)
})

test('StrictMode effect cleanup and immediate reattachment retain the same lease',async context=>{
  const locks=new Locks(),access=new WorkspaceWriteAccess(locks.request)
  const first=access.retain();first()
  const second=access.retain();context.after(second)
  await turn();await access.ready
  assert.equal(access.writable,true);assert.equal(locks.held,true)
})

test('an explicit exit can retry a busy lease and acquire it in place after the writer closes',async context=>{
  const locks=new Locks(),writer=new WorkspaceWriteAccess(locks.request),reader=new WorkspaceWriteAccess(locks.request)
  const releaseWriter=writer.retain(),releaseReader=reader.retain();context.after(releaseReader)
  await Promise.all([writer.ready,reader.ready])
  assert.equal(await reader.tryAcquire(),false);assert.equal(reader.status,'read-only')
  releaseWriter();await turn()
  const first=reader.tryAcquire(),second=reader.tryAcquire()
  assert.equal(await first,true);assert.equal(await second,true)
  assert.equal(reader.writable,true);assert.equal(locks.held,true)
  const third=new WorkspaceWriteAccess(locks.request),releaseThird=third.retain();context.after(releaseThird)
  await third.ready;assert.equal(third.writable,false)
})

test('entering viewing releases a mounted page lease and its final preview can save after reacquisition',async context=>{
  const locks=new Locks(),writer=new WorkspaceWriteAccess(locks.request),reader=new WorkspaceWriteAccess(locks.request)
  const releaseWriter=writer.retain(),releaseReader=reader.retain();context.after(releaseWriter);context.after(releaseReader)
  await Promise.all([writer.ready,reader.ready])
  const storage=new Storage(),current=session(storage)
  assert.equal(current.flush(),true)
  const original=storage.getItem(SEASON_STORAGE_KEY)
  writer.relinquish();await turn()
  assert.equal(writer.status,'read-only');assert.equal(locks.held,false)
  assert.equal(await reader.tryAcquire(),true)
  let writes=0
  await assert.rejects(writer.run(async()=>{writes++}),errorKey('saveConflict.readOnly'))
  assert.equal(writes,0)
  assert.equal(current.previewYear(2025),true)
  assert.equal(storage.getItem(SEASON_STORAGE_KEY),original)
  assert.equal(current.isCurrent(),true)
  reader.relinquish();await turn()
  assert.equal(await writer.tryAcquire(),true)
  assert.equal(writer.writable,true);assert.equal(reader.writable,false)
  assert.equal(await writer.run(async()=>{writes++;return current.flush()}),true)
  assert.equal(writes,1)
  assert.equal(JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!).activeYear,2025)
})

test('failed takeover can relinquish its lease and safely retry without releasing active writes',async context=>{
  const locks=new Locks(),access=new WorkspaceWriteAccess(locks.request),release=access.retain();context.after(release)
  await access.ready
  let finish!:()=>void,started!:()=>void
  const began=new Promise<void>(resolve=>{started=resolve})
  const pending=access.run(async()=>{started();await new Promise<void>(resolve=>{finish=resolve})})
  await began;access.relinquish()
  assert.equal(access.writable,false);assert.equal(locks.held,true)
  assert.equal(await access.tryAcquire(),false)
  finish();await pending;await turn()
  assert.equal(locks.held,false)
  assert.equal(await access.tryAcquire(),true);assert.equal(access.writable,true)
})

test('unmount rejects new writes but holds the lease until an active mutation finishes',async()=>{
  const locks=new Locks(),access=new WorkspaceWriteAccess(locks.request),release=access.retain()
  await access.ready
  let finish!:()=>void,started!:()=>void
  const began=new Promise<void>(resolve=>{started=resolve})
  const operation=access.run(async()=>{started();await new Promise<void>(resolve=>{finish=resolve})})
  await began;release();await turn()
  assert.equal(locks.held,true)
  await assert.rejects(access.run(async()=>{}),errorKey('saveConflict.readOnly'))
  finish();await operation;await turn()
  assert.equal(locks.held,false)
})

test('lock acquisition failure never falls back to uncoordinated writes',async context=>{
  const access=new WorkspaceWriteAccess(async()=>{throw new Error('Locks denied')}),release=access.retain();context.after(release)
  await access.ready
  assert.equal(access.status,'unsupported')
  await assert.rejects(access.run(async()=>{}),errorKey('saveConflict.unsupported'))
})

test('stale board snapshots cannot overwrite saves or switch seasons, even without a storage event',()=>{
  const storage=new Storage(),a=session(storage),b=session(storage)
  a.setBoard(blank('A saved'));assert.equal(a.flush(),true)
  const original=storage.getItem(SEASON_STORAGE_KEY)
  b.setBoard(blank('B local edits'))
  assert.equal(b.flush(),false);assert.equal(b.switchYear(2025),false)
  assert.equal(b.conflicted,true);assert.equal(b.board.title,'B local edits')
  assert.equal(storage.getItem(SEASON_STORAGE_KEY),original)
  // A stale snapshot supplied after another page's save must not become a valid baseline.
  const stale=new SeasonBoardSession(b.workspace,storage)
  assert.equal(stale.flush(),false)
  const refreshed=session(storage);refreshed.setBoard(blank('Refreshed edit'))
  assert.equal(refreshed.flush(),true)
})

test('shared material updates invalidate older workspace snapshots without changing board geometry',async context=>{
  const storage=new Storage(),a=session(storage),b=session(storage),access=new WorkspaceWriteAccess(new Locks().request)
  const release=access.retain();context.after(release)
  const guard=createRecordWriteGuard(access,a,()=>a.board)
  let writes=0;await guard.run(async()=>{writes++})
  assert.equal(writes,1);assert.ok(a.workspace.revision)
  assert.equal(b.flush(),false)
})

test('initial inline-material migration leaves a damaged original save untouched until recovery succeeds',async context=>{
  const storage=new Storage(),raw='{ damaged original'
  storage.setItem(SEASON_STORAGE_KEY,raw)
  const current=session(storage),access=new WorkspaceWriteAccess(new Locks().request)
  const release=access.retain();context.after(release)
  let initialized=0
  await createRecordWriteGuard(access,current,()=>current.board).initialize(async()=>{initialized++})
  assert.equal(initialized,1);assert.equal(storage.getItem(SEASON_STORAGE_KEY),raw)
  storage.setItem(SEASON_STORAGE_KEY,'external replacement')
  await assert.rejects(createRecordWriteGuard(access,current,()=>current.board).initialize(async()=>{initialized++}),errorKey('saveConflict.changed'))
  assert.equal(initialized,1)
})

test('a stale page cannot delete a material newly referenced in another page',async context=>{
  const previous=globalThis.indexedDB
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,writable:true,value:new IDBFactory()})
  context.after(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,writable:true,value:previous}))
  const record={id:'shared-medal',kind:'medal' as const,source:'demo' as const,name:'Medal',note:'',date:'',cutout:'original' as const,archived:true}
  await putRecords([record])
  const storage=new Storage(),a=session(storage),b=session(storage)
  b.setBoard({...b.board,items:[{id:'medal',kind:'medal',title:'Medal',recordId:record.id,x:0,y:0,w:200,h:300,rotation:0}]})
  assert.equal(b.flush(),true)
  const current=storage.getItem(SEASON_STORAGE_KEY),access=new WorkspaceWriteAccess(new Locks().request)
  const release=access.retain();context.after(release)
  await assert.rejects(createRecordWriteGuard(access,a,()=>a.board).run(()=>deleteRecords([record.id]),[record.id]),errorKey('saveConflict.changed'))
  assert.equal((await readRecords()).length,1);assert.equal(storage.getItem(SEASON_STORAGE_KEY),current)
})

test('the deletion guard protects references in hidden seasons and allows an unreferenced record',async context=>{
  const storage=new Storage(),current=session(storage),access=new WorkspaceWriteAccess(new Locks().request)
  const release=access.retain();context.after(release)
  current.switchYear(2025)
  current.setBoard({...current.board,items:[{id:'m',kind:'medal',title:'M',recordId:'used',x:0,y:0,w:200,h:300,rotation:0}]})
  current.switchYear(2026)
  const guard=createRecordWriteGuard(access,current,()=>current.board)
  let deletes=0
  await assert.rejects(guard.run(async()=>{deletes++},['used']),errorKey('App.086'))
  assert.equal(deletes,0)
  await guard.run(async()=>{deletes++},['unused']);assert.equal(deletes,1)
})
