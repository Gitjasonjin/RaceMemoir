import {AppError} from '../i18n/runtime.ts'
import { validRecord } from '../domain/records.ts'
import type { CollectionRecord } from '../domain/records.ts'

const DATABASE='racememoir-records-v1'
function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1)
    request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'})
    request.onerror=()=>reject(new AppError("recordStore.006"))
    request.onblocked=()=>reject(new AppError("recordStore.005"))
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)}
  })
}
export async function readRecords():Promise<CollectionRecord[]>{
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly'),request=tx.objectStore('records').getAll()
    tx.oncomplete=()=>{db.close();resolve((request.result as unknown[]).filter(validRecord))}
    tx.onabort=tx.onerror=()=>{db.close();reject(new AppError("recordStore.004"))}
  })
}
export async function putRecords(records:CollectionRecord[]):Promise<void>{
  if(records.some(r=>!validRecord(r)))throw new AppError("recordStore.003")
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite')
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onabort=tx.onerror=()=>{db.close();reject(new AppError("recordStore.002"))}
    try { records.forEach(r=>tx.objectStore('records').put(r)) }
    catch { tx.abort() }
  })
}
export async function deleteRecord(id:string):Promise<void>{
  return deleteRecords([id])
}
export async function deleteRecords(ids:string[]):Promise<void>{
  if(!ids.length)return
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite')
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onabort=tx.onerror=()=>{db.close();reject(new AppError("recordStore.001"))}
    try { ids.forEach(id=>tx.objectStore('records').delete(id)) }
    catch { tx.abort() }
  })
}
