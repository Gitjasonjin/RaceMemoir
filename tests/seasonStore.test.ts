import {test} from 'node:test'
import assert from 'node:assert/strict'
import {seed,STORAGE_KEY} from '../src/domain/model.ts'
import type {Board} from '../src/domain/model.ts'
import {i18n,t} from '../src/i18n/runtime.ts'
import {isSeasonView,isSeasonWorkspace,loadSeasonWorkspace,saveSeasonWorkspace,SEASON_STORAGE_KEY,SeasonBoardSession} from '../src/persistence/seasonStore.ts'
import type {SeasonStorage,SeasonWorkspace} from '../src/persistence/seasonStore.ts'

class MemoryStorage implements SeasonStorage{
  readonly values=new Map<string,string>()
  readonly writes:string[]=[]
  failKey=''
  getItem(key:string){return this.values.get(key)??null}
  setItem(key:string,value:string){
    if(key===this.failKey)throw new DOMException('Storage full','QuotaExceededError')
    this.writes.push(key);this.values.set(key,value)
  }
}
const blank=(title='Empty'):Board=>({title,items:[],threads:[]})
const fresh=(storage=new MemoryStorage(),board=structuredClone(seed))=>new SeasonBoardSession(loadSeasonWorkspace(()=>board,2026,storage),storage)
const saved=(storage:MemoryStorage)=>JSON.parse(storage.getItem(SEASON_STORAGE_KEY)!) as SeasonWorkspace

test('legacy board is kept whole in the current season; the prior season starts empty in the selected language',async context=>{
  context.after(()=>i18n.changeLanguage('zh-CN'))
  const storage=new MemoryStorage()
  const legacy={...structuredClone(seed),title:'User title',decorations:{pin:'clip' as const},backgroundStyle:'linen'}
  storage.values.set(STORAGE_KEY,JSON.stringify(legacy))
  await i18n.changeLanguage('en')
  let calls=0
  const workspace=loadSeasonWorkspace(()=>{calls++;return JSON.parse(storage.getItem(STORAGE_KEY)!) as Board},2026,storage)
  assert.equal(calls,1)
  assert.equal(workspace.activeYear,2026)
  assert.deepEqual(workspace.seasons[0],{year:2026,board:legacy})
  assert.deepEqual(workspace.seasons[1],{year:2025,board:blank(t('seed.title'))})
  assert.deepEqual(storage.writes,[])
})

test('an existing workspace controls both boards and active year even when the legacy mirror or calendar year changes',()=>{
  const storage=new MemoryStorage(),session=fresh(storage)
  session.setBoard(blank('Current board'))
  assert.equal(session.switchYear(2025,{x:12,y:-18,scale:.8}),true)
  session.setBoard(blank('Previous board'))
  assert.equal(session.flush({x:-80,y:140,scale:1.5}),true)
  storage.values.set(STORAGE_KEY,JSON.stringify(seed))
  const workspace=loadSeasonWorkspace(()=>{throw new Error('Must not reload the legacy board')},2027,storage)
  assert.deepEqual(workspace,saved(storage))
  assert.equal(workspace.activeYear,2025)
  assert.deepEqual(workspace.seasons.map(season=>season.board.title),['Current board','Previous board'])
  assert.deepEqual(workspace.seasons.map(season=>season.year),[2026,2025])
})

test('board edits remain in memory until a single workspace write persists both boards',()=>{
  const storage=new MemoryStorage(),session=fresh(storage,blank('Original'))
  session.setBoard(blank('During drag'))
  session.commit(blank('Finished'))
  assert.equal(session.allBoards[0],session.board)
  assert.deepEqual(storage.writes,[])
  assert.equal(session.flush(),true)
  assert.deepEqual(storage.writes,[SEASON_STORAGE_KEY,STORAGE_KEY])
  assert.equal(saved(storage).seasons[0].board.title,'Finished')
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)!),session.board)
})

test('switching persists source edits and views and restores each season after refresh',()=>{
  const storage=new MemoryStorage(),session=fresh(storage,blank('2026 source'))
  const currentView={x:-20,y:15,scale:.7},previousView={x:160,y:-300,scale:2}
  session.commit({...structuredClone(seed),title:'2026 edited'})
  const current=session.board
  assert.equal(session.switchYear(2025,currentView),true)
  assert.equal(session.restoreView,undefined)
  assert.equal(session.board.items.length,0)
  session.commit(blank('2025 edited'))
  assert.equal(session.switchYear(2026,previousView),true)
  assert.equal(session.board,current)
  assert.deepEqual(session.restoreView,currentView)
  assert.equal(session.switchYear(2025,currentView),true)
  assert.deepEqual(session.restoreView,previousView)
  const restored=new SeasonBoardSession(loadSeasonWorkspace(()=>seed,2026,storage),storage)
  assert.equal(restored.year,2025)
  assert.deepEqual(restored.restoreView,previousView)
  assert.deepEqual(restored.allBoards,session.allBoards)
  assert.equal(restored.canUndo,false)
  assert.equal(restored.canRedo,false)
})

test('seasons have independent undo and redo stacks and switching creates no history entry',()=>{
  const storage=new MemoryStorage(),session=fresh(storage,blank('Current original'))
  session.commit(blank('Current edit'))
  assert.equal(session.switchYear(2025),true)
  assert.equal(session.canUndo,false)
  assert.equal(session.canRedo,false)
  session.commit(blank('Previous edit'))
  assert.equal(session.undo(),true)
  assert.equal(session.board.title,t('seed.title'))
  assert.equal(session.canRedo,true)
  assert.equal(session.switchYear(2026),true)
  assert.equal(session.canRedo,false)
  assert.equal(session.undo(),true)
  assert.equal(session.board.title,'Current original')
  assert.equal(session.redo(),true)
  assert.equal(session.board.title,'Current edit')
  assert.equal(session.switchYear(2025),true)
  assert.equal(session.canUndo,false)
  assert.equal(session.redo(),true)
  assert.equal(session.board.title,'Previous edit')
})

test('a failed workspace write does not change the active pointer, source board, view or histories',()=>{
  const storage=new MemoryStorage(),session=fresh(storage,blank('Original'))
  const initialView={x:1,y:2,scale:1}
  assert.equal(session.flush(initialView),true)
  const lastSaved=storage.getItem(SEASON_STORAGE_KEY),lastMirror=storage.getItem(STORAGE_KEY)
  session.commit(blank('Unsaved source'))
  const source=session.board
  storage.failKey=SEASON_STORAGE_KEY
  assert.equal(session.switchYear(2025,{x:30,y:40,scale:2}),false)
  assert.equal(session.year,2026)
  assert.equal(session.board,source)
  assert.deepEqual(session.restoreView,initialView)
  assert.equal(session.canUndo,true)
  assert.equal(storage.getItem(SEASON_STORAGE_KEY),lastSaved)
  assert.equal(storage.getItem(STORAGE_KEY),lastMirror)
  storage.failKey=''
  assert.equal(session.switchYear(2025,{x:30,y:40,scale:2}),true)
  assert.equal(saved(storage).seasons[0].board.title,'Unsaved source')
  assert.deepEqual(saved(storage).seasons[0].view,{x:30,y:40,scale:2})
})

test('a failed compatibility mirror leaves the successfully saved workspace authoritative',()=>{
  const storage=new MemoryStorage(),session=fresh(storage,blank('Current'))
  assert.equal(session.flush(),true)
  storage.failKey=STORAGE_KEY
  assert.equal(session.switchYear(2025),true)
  session.setBoard(blank('Previous edit'))
  assert.equal(session.flush(),true)
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).title,'Current')
  const restored=loadSeasonWorkspace(()=>{throw new Error('Stale mirror must not load')},2026,storage)
  assert.equal(restored.activeYear,2025)
  assert.equal(restored.seasons[1].board.title,'Previous edit')
})

test('invalid view values are rejected on load and save without advancing the active year',()=>{
  for(const view of [null,[],{}, {x:0,y:0,scale:0},{x:0,y:0,scale:-1},{x:0,y:0,scale:4.01},{x:Infinity,y:0,scale:1},{x:0,y:NaN,scale:1}])assert.equal(isSeasonView(view),false)
  assert.equal(isSeasonView({x:-5000,y:2000,scale:.001}),true)
  const storage=new MemoryStorage(),session=fresh(storage)
  const invalid={x:0,y:0,scale:Infinity}
  assert.equal(session.flush(invalid),false)
  assert.equal(session.switchYear(2025,invalid),false)
  assert.equal(session.year,2026)
  assert.equal(session.restoreView,undefined)
  assert.deepEqual(storage.writes,[])
  const invalidSaved={...session.workspace,seasons:session.workspace.seasons.map(season=>({...season,view:{x:0,y:0,scale:0}}))}
  storage.values.set(SEASON_STORAGE_KEY,JSON.stringify(invalidSaved))
  const recovered=loadSeasonWorkspace(()=>blank('Legacy fallback'),2026,storage)
  assert.equal(recovered.activeYear,2026)
  assert.equal(recovered.seasons[0].board.title,'Legacy fallback')
  assert.equal(recovered.seasons[0].view,undefined)
})

test('malformed workspaces and boards cannot be used as persisted season state',()=>{
  const storage=new MemoryStorage(),valid=loadSeasonWorkspace(()=>seed,2026,storage)
  assert.equal(isSeasonWorkspace(valid),true)
  const invalid=[null,{}, {...valid,version:2},{...valid,activeYear:2024},{...valid,seasons:valid.seasons.slice(0,1)},
    {...valid,seasons:[valid.seasons[0],valid.seasons[0]]},
    {...valid,seasons:[{...valid.seasons[0],year:2026.5},valid.seasons[1]]},
    {...valid,seasons:[{...valid.seasons[0],board:{title:'broken',items:[],threads:[{id:'dangling',from:'a',to:'b'}]}},valid.seasons[1]]}]
  for(const value of invalid){
    assert.equal(isSeasonWorkspace(value),false)
    assert.equal(saveSeasonWorkspace(value as SeasonWorkspace,storage),false)
  }
  storage.values.set(SEASON_STORAGE_KEY,'{bad json')
  assert.equal(loadSeasonWorkspace(()=>blank('Recovery'),2026,storage).seasons[0].board.title,'Recovery')
  assert.deepEqual(storage.writes,[])
})

test('forgetRecord removes matching undo and redo snapshots from every season',()=>{
  const storage=new MemoryStorage()
  const withRecord:Board={title:'With record',items:[{...structuredClone(seed.items[2]),recordId:'deleted-record'}],threads:[]}
  const session=fresh(storage,withRecord)
  session.commit(blank('Current without record'))
  assert.equal(session.switchYear(2025),true)
  session.commit(withRecord)
  assert.equal(session.undo(),true)
  assert.equal(session.canRedo,true)
  session.forgetRecord('deleted-record')
  assert.equal(session.canRedo,false)
  assert.equal(session.redo(),false)
  assert.equal(session.switchYear(2026),true)
  assert.equal(session.canUndo,false)
  assert.equal(session.undo(),false)
  assert.equal(session.board.title,'Current without record')
})

test('global material updates change hidden seasons and remember only boards that changed',()=>{
  const storage=new MemoryStorage(),session=fresh(storage,blank('Current unchanged'))
  assert.equal(session.switchYear(2025),true)
  const photo={...structuredClone(seed.items[2]),recordId:'shared-photo'}
  session.setBoard({title:'Previous',items:[photo],threads:[]})
  assert.equal(session.switchYear(2026),true)
  const before=storage.getItem(SEASON_STORAGE_KEY),current=session.board
  assert.equal(session.updateBoards(board=>board.items.some(item=>item.recordId==='shared-photo')?{...board,items:board.items.map(item=>({...item,w:400,h:300}))}:board),true)
  assert.equal(session.board,current)
  assert.equal(session.allBoards[1].items[0].w,400)
  assert.equal(session.canUndo,false)
  assert.equal(storage.getItem(SEASON_STORAGE_KEY),before)
  assert.equal(session.updateBoards(board=>board),false)
  assert.equal(session.flush(),true)
  assert.equal(saved(storage).seasons[1].board.items[0].w,400)
  assert.equal(session.switchYear(2025),true)
  assert.equal(session.canUndo,true)
  assert.equal(session.undo(),true)
  assert.equal(session.board.items[0].w,photo.w)
})

test('an unavailable storage and unknown target year keep the session usable',()=>{
  const unavailable:SeasonStorage={getItem(){throw new Error('Blocked')},setItem(){throw new Error('Blocked')}}
  const session=new SeasonBoardSession(loadSeasonWorkspace(()=>blank('Local board'),2026,unavailable),unavailable)
  session.commit(blank('Local edit'))
  assert.equal(session.flush(),false)
  assert.equal(session.switchYear(2025),false)
  assert.equal(session.switchYear(2024),false)
  assert.equal(session.year,2026)
  assert.equal(session.board.title,'Local edit')
  assert.equal(session.undo(),true)
  assert.equal(session.board.title,'Local board')
})
