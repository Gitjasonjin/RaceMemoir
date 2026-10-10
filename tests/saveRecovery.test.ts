import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isBoard,seed,STORAGE_KEY} from '../src/domain/model.ts'
import type {Board} from '../src/domain/model.ts'
import {readBoard} from '../src/persistence/boardStore.ts'
import {isSeasonWorkspace,readSeasonWorkspace,saveSeasonWorkspace,SEASON_STORAGE_KEY,SeasonBoardSession} from '../src/persistence/seasonStore.ts'
import {protectSaved,readSaved,RECOVERY_STORAGE_KEY} from '../src/persistence/saveRecovery.ts'
import type {SaveStorage} from '../src/persistence/saveRecovery.ts'

class MemoryStorage implements SaveStorage{
  readonly values=new Map<string,string>()
  readonly writes:string[]=[]
  readonly failReads=new Set<string>()
  readonly failWrites=new Set<string>()
  getItem(key:string){
    if(this.failReads.has(key))throw new DOMException('Storage blocked','SecurityError')
    return this.values.get(key)??null
  }
  setItem(key:string,value:string){
    if(this.failWrites.has(key))throw new DOMException('Storage full','QuotaExceededError')
    this.writes.push(key);this.values.set(key,value)
  }
}
const blank=(title:string):Board=>({title,items:[],threads:[]})
const workspace=()=>readSeasonWorkspace(()=>blank('Original'),2026,new MemoryStorage()).workspace
const ledger=(storage:MemoryStorage)=>JSON.parse(storage.getItem(RECOVERY_STORAGE_KEY)!) as {version:number;entries:{key:string;raw:string;createdAt:number}[]}

test('saved reads distinguish absent, loaded, corrupt and unavailable values without writing',()=>{
  const storage=new MemoryStorage()
  assert.deepEqual(readSaved(STORAGE_KEY,isBoard,storage),{status:'missing'})
  storage.values.set(STORAGE_KEY,JSON.stringify(seed))
  assert.deepEqual(readSaved(STORAGE_KEY,isBoard,storage),{status:'loaded',value:seed})
  for(const raw of ['', 'null', '{bad JSON', '{}']){
    storage.values.set(STORAGE_KEY,raw)
    assert.deepEqual(readSaved(STORAGE_KEY,isBoard,storage),{status:'corrupt',raw})
  }
  storage.failReads.add(STORAGE_KEY)
  assert.deepEqual(readSaved(STORAGE_KEY,isBoard,storage),{status:'unavailable'})
  assert.deepEqual(storage.writes,[])
})

test('board fallback reports raw damage or unavailable storage while absent storage is normal',()=>{
  const storage=new MemoryStorage()
  assert.deepEqual(readBoard(storage),{board:seed,issues:[]})
  for(const raw of ['{bad JSON','{}']){
    storage.values.set(STORAGE_KEY,raw)
    assert.deepEqual(readBoard(storage),{board:seed,issues:[{key:STORAGE_KEY,status:'corrupt',raw}]})
  }
  storage.failReads.add(STORAGE_KEY)
  assert.deepEqual(readBoard(storage),{board:seed,issues:[{key:STORAGE_KEY,status:'unavailable'}]})
  assert.deepEqual(storage.writes,[])
})

test('damaged JSON, invalid schemas, empty strings and JSON null in both save keys are preserved before replacement',()=>{
  for(const raw of ['{bad JSON','{}','','null']){
    const storage=new MemoryStorage()
    storage.values.set(SEASON_STORAGE_KEY,raw);storage.values.set(STORAGE_KEY,raw)
    const loaded=readSeasonWorkspace(undefined,2026,storage)
    assert.deepEqual(loaded.issues,[{key:SEASON_STORAGE_KEY,status:'corrupt',raw},{key:STORAGE_KEY,status:'corrupt',raw}])
    assert.deepEqual(storage.writes,[])
    const session=new SeasonBoardSession(loaded.workspace,storage,loaded.issues)
    assert.equal(session.flush(),true)
    assert.deepEqual(ledger(storage).entries.map(entry=>({key:entry.key,raw:entry.raw})),[{key:SEASON_STORAGE_KEY,raw},{key:STORAGE_KEY,raw}])
    assert(ledger(storage).entries.every(entry=>Number.isSafeInteger(entry.createdAt)))
    assert.deepEqual(storage.writes,[RECOVERY_STORAGE_KEY,RECOVERY_STORAGE_KEY,SEASON_STORAGE_KEY,STORAGE_KEY])
    assert(isSeasonWorkspace(JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!)))
    assert(isBoard(JSON.parse(storage.getItem(STORAGE_KEY)!)))
    assert.equal('issues' in JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!),false)
  }
})

test('recovery appends different originals, preserves existing entries and deduplicates by key and raw',()=>{
  const storage=new MemoryStorage(),previous={key:STORAGE_KEY,raw:'first original',createdAt:1}
  storage.values.set(RECOVERY_STORAGE_KEY,JSON.stringify({version:1,entries:[previous]}))
  storage.values.set(STORAGE_KEY,'second original')
  assert.equal(protectSaved(STORAGE_KEY,isBoard,storage),true)
  assert.deepEqual(ledger(storage).entries[0],previous)
  assert.equal(ledger(storage).entries[1].raw,'second original')
  assert.equal(protectSaved(STORAGE_KEY,isBoard,storage),true)
  assert.equal(ledger(storage).entries.length,2)
  assert.deepEqual(storage.writes,[RECOVERY_STORAGE_KEY])
  storage.values.set(SEASON_STORAGE_KEY,'second original')
  assert.equal(protectSaved(SEASON_STORAGE_KEY,isSeasonWorkspace,storage),true)
  assert.equal(ledger(storage).entries.length,3)
})

test('failed backup reads or writes and damaged recovery ledgers cannot replace a corrupt authoritative save',()=>{
  for(const failure of ['invalid-json','invalid-schema','unavailable','write-failure']){
    const storage=new MemoryStorage(),raw='{original damage'
    storage.values.set(SEASON_STORAGE_KEY,raw)
    if(failure==='invalid-json')storage.values.set(RECOVERY_STORAGE_KEY,'{damaged ledger')
    if(failure==='invalid-schema')storage.values.set(RECOVERY_STORAGE_KEY,JSON.stringify({version:1,entries:[{key:'old',raw:'old'}]}))
    if(failure==='unavailable')storage.failReads.add(RECOVERY_STORAGE_KEY)
    if(failure==='write-failure')storage.failWrites.add(RECOVERY_STORAGE_KEY)
    const previousLedger=storage.values.get(RECOVERY_STORAGE_KEY)
    assert.equal(saveSeasonWorkspace(workspace(),storage),false)
    assert.equal(storage.getItem(SEASON_STORAGE_KEY),raw)
    assert.equal(storage.values.get(RECOVERY_STORAGE_KEY),previousLedger)
    assert.deepEqual(storage.writes,[])
  }
})

test('a preserved original survives a failed authoritative write and retry does not duplicate its recovery entry',()=>{
  const storage=new MemoryStorage(),raw='{original damage'
  storage.values.set(SEASON_STORAGE_KEY,raw);storage.failWrites.add(SEASON_STORAGE_KEY)
  assert.equal(saveSeasonWorkspace(workspace(),storage),false)
  assert.equal(storage.getItem(SEASON_STORAGE_KEY),raw)
  assert.equal(ledger(storage).entries.length,1)
  storage.failWrites.clear()
  assert.equal(saveSeasonWorkspace(workspace(),storage),true)
  assert.equal(ledger(storage).entries.length,1)
})

test('a session that could not read a save stays blocked after permissions return until a fresh load',()=>{
  for(const unreadableKey of [SEASON_STORAGE_KEY,STORAGE_KEY]){
    const storage=new MemoryStorage(),original=workspace()
    if(unreadableKey===SEASON_STORAGE_KEY)storage.values.set(SEASON_STORAGE_KEY,JSON.stringify(original))
    storage.values.set(STORAGE_KEY,JSON.stringify(blank('Protected legacy')))
    storage.failReads.add(unreadableKey)
    const loaded=readSeasonWorkspace(undefined,2026,storage)
    assert(loaded.issues.some(issue=>issue.key===unreadableKey&&issue.status==='unavailable'))
    const session=new SeasonBoardSession(loaded.workspace,storage,loaded.issues)
    const untouched=new Map(storage.values)
    storage.failReads.clear();session.setBoard(blank('Fallback edits'))
    assert.equal(session.flush(),false)
    assert.equal(session.switchYear(2025),false)
    assert.equal(session.year,2026)
    assert.deepEqual(session.recoveryIssues,loaded.issues)
    assert.deepEqual(storage.values,untouched)
    assert.deepEqual(storage.writes,[])
    const reloaded=readSeasonWorkspace(undefined,2026,storage)
    assert.deepEqual(reloaded.issues,[])
    assert.equal(reloaded.workspace.seasons[0].board.title,unreadableKey===SEASON_STORAGE_KEY?'Original':'Protected legacy')
    assert.equal(new SeasonBoardSession(reloaded.workspace,storage,reloaded.issues).flush(),true)
  }
})

test('an authoritative workspace bypasses an unreadable legacy mirror and initial fallback',()=>{
  const storage=new MemoryStorage(),original=workspace()
  storage.values.set(SEASON_STORAGE_KEY,JSON.stringify(original));storage.failReads.add(STORAGE_KEY)
  const result=readSeasonWorkspace(()=>{throw new Error('Fallback must not run')},2027,storage)
  assert.deepEqual(result,{workspace:original,issues:[]})
  assert.deepEqual(storage.writes,[])
})

test('an explicit initial board keeps the existing stub semantics without reading the legacy key',()=>{
  const storage=new MemoryStorage(),initial=blank('Provided initial')
  storage.failReads.add(STORAGE_KEY)
  let calls=0
  const result=readSeasonWorkspace(()=>{calls++;return initial},2026,storage)
  assert.equal(calls,1)
  assert.equal(result.workspace.seasons[0].board,initial)
  assert.deepEqual(result.issues,[])
})

test('unreadable authoritative storage prevents writes even without a session',()=>{
  const storage=new MemoryStorage()
  storage.failReads.add(SEASON_STORAGE_KEY)
  assert.equal(saveSeasonWorkspace(workspace(),storage),false)
  assert.deepEqual(storage.writes,[])
})

test('failed recovery protection or unreadable legacy mirrors leave the successful workspace authoritative',()=>{
  for(const failure of ['backup-write','mirror-read','mirror-write']){
    const storage=new MemoryStorage(),raw='{damaged mirror'
    storage.values.set(STORAGE_KEY,raw)
    if(failure==='backup-write')storage.failWrites.add(RECOVERY_STORAGE_KEY)
    if(failure==='mirror-read')storage.failReads.add(STORAGE_KEY)
    if(failure==='mirror-write')storage.failWrites.add(STORAGE_KEY)
    const next=workspace()
    assert.equal(saveSeasonWorkspace(next,storage),true)
    assert.deepEqual(JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!),next)
    assert.equal(storage.values.get(STORAGE_KEY),raw)
    assert.deepEqual(readSeasonWorkspace(undefined,2026,storage),{workspace:next,issues:[]})
  }
})

test('a corrupt legacy fallback must be backed up before the session can create or replace the authoritative workspace',()=>{
  for(const seasonRaw of [undefined,'{damaged workspace']){
    const storage=new MemoryStorage(),legacyRaw='{damaged legacy source'
    if(seasonRaw!==undefined)storage.values.set(SEASON_STORAGE_KEY,seasonRaw)
    storage.values.set(STORAGE_KEY,legacyRaw);storage.failWrites.add(RECOVERY_STORAGE_KEY)
    const loaded=readSeasonWorkspace(undefined,2026,storage)
    const session=new SeasonBoardSession(loaded.workspace,storage,loaded.issues)
    assert.equal(session.flush(),false)
    assert.equal(session.switchYear(2025),false)
    assert.equal(session.year,2026)
    assert.equal(storage.values.get(SEASON_STORAGE_KEY),seasonRaw)
    assert.equal(storage.getItem(STORAGE_KEY),legacyRaw)
    assert.deepEqual(storage.writes,[])
    storage.failWrites.clear()
    assert.equal(session.flush(),true)
    assert(ledger(storage).entries.some(entry=>entry.key===STORAGE_KEY&&entry.raw===legacyRaw))
    if(seasonRaw!==undefined)assert(ledger(storage).entries.some(entry=>entry.key===SEASON_STORAGE_KEY&&entry.raw===seasonRaw))
    assert(isSeasonWorkspace(JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!)))
    storage.failReads.add(STORAGE_KEY);session.setBoard(blank('Later edit'))
    assert.equal(session.flush(),true)
    assert.equal(JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!).seasons[0].board.title,'Later edit')
  }
})
