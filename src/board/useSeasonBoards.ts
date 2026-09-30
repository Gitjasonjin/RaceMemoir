import {useCallback,useRef,useState} from 'react'
import type {SetStateAction} from 'react'
import type {Board} from '../domain/model'
import {loadBoard} from '../persistence/boardStore'
import {loadSeasonWorkspace,SeasonBoardSession} from '../persistence/seasonStore'
import type {View} from './types'

export function useSeasonBoards(initial:()=>Board=loadBoard,currentYear=new Date().getFullYear()){
  const [session]=useState(()=>new SeasonBoardSession(loadSeasonWorkspace(initial,currentYear)))
  const [board,setRenderedBoard]=useState(session.board)
  const boardRef=useRef(board)
  const [historyTick,setHistoryTick]=useState(0)
  const [saveTick,setSaveTick]=useState(0)
  const refresh=useCallback(()=>{
    boardRef.current=session.board;setRenderedBoard(session.board);setSaveTick(n=>n+1)
  },[session])
  const setBoard=useCallback((action:SetStateAction<Board>)=>{
    const next=typeof action==='function'?action(boardRef.current):action
    const changed=session.setBoard(next)
    boardRef.current=session.board
    if(changed)refresh()
  },[session,refresh])
  const remember=useCallback((previous:Board)=>{
    session.remember(previous);setHistoryTick(n=>n+1)
  },[session])
  const commit=useCallback((next:Board)=>{
    session.setBoard(boardRef.current);session.commit(next);refresh();setHistoryTick(n=>n+1)
  },[session,refresh])
  const undo=useCallback(()=>{
    session.setBoard(boardRef.current)
    if(!session.undo())return false
    refresh();setHistoryTick(n=>n+1);return true
  },[session,refresh])
  const redo=useCallback(()=>{
    session.setBoard(boardRef.current)
    if(!session.redo())return false
    refresh();setHistoryTick(n=>n+1);return true
  },[session,refresh])
  const forgetRecord=useCallback((id:string)=>{
    session.forgetRecord(id);setHistoryTick(n=>n+1)
  },[session])
  const updateBoards=useCallback((transform:(board:Board)=>Board)=>{
    session.setBoard(boardRef.current)
    if(session.updateBoards(transform)){refresh();setHistoryTick(n=>n+1)}
  },[session,refresh])
  const flush=useCallback((view?:View)=>{
    session.setBoard(boardRef.current);return session.flush(view)
  },[session])
  const switchYear=useCallback((year:number,view?:View)=>{
    session.setBoard(boardRef.current)
    if(!session.switchYear(year,view))return false
    refresh();setHistoryTick(n=>n+1);return true
  },[session,refresh])

  return {board,boardRef,setBoard,remember,commit,undo,redo,forgetRecord,historyTick,canUndo:session.canUndo,canRedo:session.canRedo,
    year:session.year,years:session.years,get allBoards(){return session.allBoards},switchYear,get restoreView(){return session.restoreView},flush,saveTick,updateBoards}
}
