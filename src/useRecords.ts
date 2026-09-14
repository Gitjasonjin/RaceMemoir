import { useEffect, useRef, useState } from 'react'
import type { Board } from './model'
import { migrateBoard } from './records'
import type { CollectionRecord } from './records'
import { putRecords, readRecords } from './recordStore'

export function useRecords(board:Board,onMigrate:(board:Board)=>void){
  const initial=useRef({board,onMigrate})
  const [records,setRecords]=useState<CollectionRecord[]>([])
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true;setError('')
    void (async()=>{
      try{
        const stored=await readRecords(),migration=migrateBoard(initial.current.board,stored)
        if(migration.created.length)await putRecords(migration.created)
        if(!active)return
        setRecords([...stored,...migration.created]);initial.current.onMigrate(migration.board);setReady(true)
      }catch(e){if(active)setError(e instanceof Error?e.message:'无法载入收藏库')}
    })()
    return ()=>{active=false}
  },[attempt])
  async function save(next:CollectionRecord[]){
    await putRecords(next)
    setRecords(current=>{const map=new Map(current.map(r=>[r.id,r]));next.forEach(r=>map.set(r.id,r));return [...map.values()]})
  }
  return {records,ready,error,save,retry:()=>setAttempt(n=>n+1)}
}
