import {useNotice} from '../i18n/useNotice'
import {msg,errorNotice} from '../i18n/runtime.ts'
import { useEffect, useRef, useState } from 'react'
import type { Board } from '../domain/model'
import { migrateBoard } from '../domain/records'
import type { CollectionRecord } from '../domain/records'
import { deleteRecords, putRecords, readRecords } from '../persistence/recordStore'

export function useRecords(board:Board,onMigrate:(board:Board)=>void){
  const [savedAt,setSavedAt]=useState(0)
  const [saving,setSaving]=useState(0),[saveError,setSaveError]=useNotice('')
  const failed=useRef(new Map<string,CollectionRecord>()),queue=useRef(Promise.resolve())
  const initial=useRef({board,onMigrate})
  const [records,setRecords]=useState<CollectionRecord[]>([])
  const [ready,setReady]=useState(false),[error,setError]=useNotice(''),[attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true;setError('')
    void (async()=>{
      try{
        const stored=await readRecords(),migration=migrateBoard(initial.current.board,stored)
        if(migration.created.length)await putRecords(migration.created)
        if(!active)return
        setRecords([...stored,...migration.created]);initial.current.onMigrate(migration.board);setReady(true)
      }catch(e){if(active)setError(errorNotice(e,msg("useRecords.003")))}
    })()
    return ()=>{active=false}
  },[attempt])
  async function save(next:CollectionRecord[]){
    setSaving(n=>n+1)
    const operation=queue.current.then(async()=>{
      try{
        await putRecords(next)
        setSavedAt(Date.now())
        next.forEach(r=>failed.current.delete(r.id))
        setSaveError(failed.current.size?msg("useRecords.001"):'')
        setRecords(current=>{const map=new Map(current.map(r=>[r.id,r]));next.forEach(r=>map.set(r.id,r));return [...map.values()]})
      }catch(e){next.forEach(r=>failed.current.set(r.id,r));setSaveError(msg("useRecords.002"));throw e}
      finally{setSaving(n=>n-1)}
    })
    queue.current=operation.catch(()=>{})
    return operation
  }
  async function removeMany(ids:string[]){
    setSaving(n=>n+1)
    const operation=queue.current.then(async()=>{
      try{
        await deleteRecords(ids)
        ids.forEach(id=>failed.current.delete(id))
        setSaveError(failed.current.size?msg("useRecords.001"):'')
        setRecords(current=>current.filter(r=>!ids.includes(r.id)))
        setSavedAt(Date.now())
      }finally{setSaving(n=>n-1)}
    })
    queue.current=operation.catch(()=>{})
    return operation
  }
  return {records,ready,error,save,remove:(id:string)=>removeMany([id]),removeMany,savedAt,saving:saving>0,saveError,retry:()=>setAttempt(n=>n+1)}
}
