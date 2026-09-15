import { useEffect, useRef, useState } from 'react'
import type { Board } from '../domain/model'
import { migrateBoard } from '../domain/records'
import type { CollectionRecord } from '../domain/records'
import { deleteRecord, putRecords, readRecords } from '../persistence/recordStore'

export function useRecords(board:Board,onMigrate:(board:Board)=>void){
  const [savedAt,setSavedAt]=useState('')
  const [saving,setSaving]=useState(0),[saveError,setSaveError]=useState('')
  const failed=useRef(new Map<string,CollectionRecord>()),queue=useRef(Promise.resolve())
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
    setSaving(n=>n+1)
    const operation=queue.current.then(async()=>{
      try{
        await putRecords(next)
        setSavedAt(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
        next.forEach(r=>failed.current.delete(r.id))
        setSaveError(failed.current.size?'部分收藏尚未保存，请在编辑栏重试':'')
        setRecords(current=>{const map=new Map(current.map(r=>[r.id,r]));next.forEach(r=>map.set(r.id,r));return [...map.values()]})
      }catch(e){next.forEach(r=>failed.current.set(r.id,r));setSaveError('收藏文件保存失败，请在编辑栏重试');throw e}
      finally{setSaving(n=>n-1)}
    })
    queue.current=operation.catch(()=>{})
    return operation
  }
  async function remove(id:string){
    setSaving(n=>n+1)
    const operation=queue.current.then(async()=>{
      try{
        await deleteRecord(id)
        failed.current.delete(id)
        setSaveError(failed.current.size?'部分收藏尚未保存，请在编辑栏重试':'')
        setRecords(current=>current.filter(r=>r.id!==id))
        setSavedAt(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
      }finally{setSaving(n=>n-1)}
    })
    queue.current=operation.catch(()=>{})
    return operation
  }
  return {records,ready,error,save,remove,savedAt,saving:saving>0,saveError,retry:()=>setAttempt(n=>n+1)}
}
