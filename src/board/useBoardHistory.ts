import {useCallback,useRef,useState} from 'react'
import type {Board} from '../domain/model'

export function useBoardHistory(initial:()=>Board){
  const [board,setBoard]=useState(initial)
  const boardRef=useRef(board);boardRef.current=board
  const undoStack=useRef<Board[]>([]),redoStack=useRef<Board[]>([])
  const [historyTick,setHistoryTick]=useState(0)
  const remember=useCallback((previous:Board)=>{
    undoStack.current=[...undoStack.current.slice(-49),structuredClone(previous)]
    redoStack.current=[];setHistoryTick(n=>n+1)
  },[])
  const commit=useCallback((next:Board)=>{remember(boardRef.current);boardRef.current=next;setBoard(next)},[remember])
  const undo=useCallback(()=>{
    const previous=undoStack.current.pop();if(!previous)return false
    redoStack.current.push(boardRef.current);boardRef.current=previous;setBoard(previous);setHistoryTick(n=>n+1);return true
  },[])
  const redo=useCallback(()=>{
    const next=redoStack.current.pop();if(!next)return false
    undoStack.current.push(boardRef.current);boardRef.current=next;setBoard(next);setHistoryTick(n=>n+1);return true
  },[])
  const forgetRecord=useCallback((id:string)=>{
    const keep=(snapshot:Board)=>!snapshot.items.some(item=>item.recordId===id)
    undoStack.current=undoStack.current.filter(keep);redoStack.current=redoStack.current.filter(keep);setHistoryTick(n=>n+1)
  },[])
  return {board,boardRef,setBoard,remember,commit,undo,redo,forgetRecord,historyTick,canUndo:undoStack.current.length>0,canRedo:redoStack.current.length>0}
}
