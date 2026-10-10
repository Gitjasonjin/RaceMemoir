import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {SetStateAction} from 'react'
import type {Board} from '../domain/model'
import {readSeasonWorkspace,SeasonBoardSession,SEASON_STORAGE_KEY} from '../persistence/seasonStore'
import {WorkspaceWriteAccess,createRecordWriteGuard} from '../persistence/workspaceWriteAccess'
import type {WorkspaceAccessState} from '../persistence/workspaceWriteAccess'
import type {RecordWriteGuard} from '../persistence/workspaceWriteAccess'
import type {View} from './types'

export function useSeasonBoards(initial?:()=>Board,currentYear=new Date().getFullYear()){
  const [session,setSession]=useState(()=>{
    const loaded=readSeasonWorkspace(initial,currentYear)
    return new SeasonBoardSession(loaded.workspace,undefined,loaded.issues)
  })
  const [board,setRenderedBoard]=useState(session.board)
  const boardRef=useRef(board)
  const [historyTick,setHistoryTick]=useState(0)
  const [saveTick,setSaveTick]=useState(0)
  const [access]=useState(()=>new WorkspaceWriteAccess())
  const [accessState,setAccessState]=useState<WorkspaceAccessState>('pending')
  const [conflicted,setConflicted]=useState(session.conflicted)
  const [claiming,setClaiming]=useState(false),claimingRef=useRef(false)
  useEffect(()=>{
    const unsubscribe=access.subscribe(setAccessState),release=access.retain()
    const changed=(event:StorageEvent)=>{
      if(event.key===SEASON_STORAGE_KEY||event.key===null){session.isCurrent();setConflicted(session.conflicted)}
    }
    window.addEventListener('storage',changed)
    return()=>{unsubscribe();release();window.removeEventListener('storage',changed)}
  },[access,session])
  const editable=()=>access.writable&&!session.conflicted&&!claimingRef.current
  const refresh=useCallback(()=>{
    boardRef.current=session.board;setRenderedBoard(session.board);setSaveTick(n=>n+1)
  },[session])
  const setBoard=useCallback((action:SetStateAction<Board>)=>{
    if(!editable()){boardRef.current=session.board;return}
    const next=typeof action==='function'?action(boardRef.current):action
    const changed=session.setBoard(next)
    boardRef.current=session.board
    if(changed)refresh()
  },[session,refresh])
  const remember=useCallback((previous:Board)=>{
    if(!editable())return
    session.remember(previous);setHistoryTick(n=>n+1)
  },[session])
  const commit=useCallback((next:Board)=>{
    if(!editable()){boardRef.current=session.board;return}
    session.setBoard(boardRef.current);session.commit(next);refresh();setHistoryTick(n=>n+1)
  },[session,refresh])
  const undo=useCallback(()=>{
    if(!editable())return false
    session.setBoard(boardRef.current)
    if(!session.undo())return false
    refresh();setHistoryTick(n=>n+1);return true
  },[session,refresh])
  const redo=useCallback(()=>{
    if(!editable())return false
    session.setBoard(boardRef.current)
    if(!session.redo())return false
    refresh();setHistoryTick(n=>n+1);return true
  },[session,refresh])
  const forgetRecord=useCallback((id:string)=>{
    session.forgetRecord(id);setHistoryTick(n=>n+1)
  },[session])
  const updateBoards=useCallback((transform:(board:Board)=>Board)=>{
    if(!editable())return
    session.setBoard(boardRef.current)
    if(session.updateBoards(transform)){refresh();setHistoryTick(n=>n+1)}
  },[session,refresh])
  const flush=useCallback((view?:View)=>{
    if(!access.writable||claimingRef.current)return false
    session.setBoard(boardRef.current)
    const saved=session.flush(view);setConflicted(session.conflicted);return saved
  },[session,access])
  const releaseEditing=useCallback(()=>{
    if(!editable()||!session.isCurrent())return false
    access.relinquish();return true
  },[access,session])
  const switchYear=useCallback((year:number,view?:View)=>{
    if(access.status==='read-only'&&!claimingRef.current){
      if(!session.previewYear(year,view))return false
      refresh();setHistoryTick(n=>n+1);return true
    }
    if(!editable())return false
    session.setBoard(boardRef.current)
    if(!session.switchYear(year,view))return false
    refresh();setHistoryTick(n=>n+1);return true
  },[session,refresh])
  const recordWrites=useMemo(()=>createRecordWriteGuard(access,session,()=>boardRef.current,()=>setConflicted(session.conflicted)),[access,session])
  const requestEditing=useCallback(async(load:(board:Board,writes:RecordWriteGuard)=>Promise<Board>)=>{
    if(claimingRef.current)return 'busy' as const
    // A writer with unsaved conflicting edits must keep its local snapshot for backup.
    if(access.writable){
      const current=session.isCurrent();setConflicted(session.conflicted)
      return current?'acquired' as const:session.conflicted?'conflict' as const:'reload-failed' as const
    }
    claimingRef.current=true;setClaiming(true)
    try{
      if(!await access.tryAcquire())return access.status==='unsupported'?'unsupported' as const:'busy' as const
      const loaded=readSeasonWorkspace(initial,currentYear)
      if(loaded.issues.length)throw new Error('The latest workspace is not readable')
      // Keep local undo history only while the shared snapshot is still unchanged.
      const fresh=session.isCurrent()?session:new SeasonBoardSession(loaded.workspace,undefined,loaded.issues)
      fresh.previewYear(session.year)
      const writes=createRecordWriteGuard(access,fresh,()=>fresh.board)
      const board=await load(fresh.board,writes)
      if(!fresh.isCurrent())throw new Error('The latest workspace changed while loading')
      fresh.setBoard(board);boardRef.current=board
      setSession(fresh);setRenderedBoard(board);setConflicted(false);setHistoryTick(n=>n+1);setSaveTick(n=>n+1)
      return 'acquired' as const
    }catch{
      access.relinquish()
      return 'reload-failed' as const
    }finally{claimingRef.current=false;setClaiming(false)}
  },[access,session,initial,currentYear])

  return {board,boardRef,setBoard,remember,commit,undo,redo,forgetRecord,historyTick,canUndo:session.canUndo,canRedo:session.canRedo,
    year:session.year,years:session.years,get allBoards(){return session.allBoards},switchYear,get restoreView(){return session.restoreView},flush,saveTick,updateBoards,recoveryIssues:session.recoveryIssues,
    writable:accessState==='writable'&&!conflicted&&!claiming,writeStatus:claiming||accessState==='read-only'?'read-only' as const:conflicted?'conflict' as const:accessState,recordWrites,releaseEditing,requestEditing,claiming}
}
