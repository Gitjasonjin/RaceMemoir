import { validRecord } from './records.ts'
import type { CollectionRecord } from './records.ts'

const DATABASE='racememoir-records-v1'
function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1)
    request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'})
    request.onerror=()=>reject(new Error('无法打开本地收藏库，请检查浏览器存储权限'))
    request.onblocked=()=>reject(new Error('收藏库被另一个页面占用，请关闭其他页面后重试'))
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)}
  })
}
export async function readRecords():Promise<CollectionRecord[]>{
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readonly'),request=tx.objectStore('records').getAll()
    tx.oncomplete=()=>{db.close();resolve((request.result as unknown[]).filter(validRecord))}
    tx.onabort=tx.onerror=()=>{db.close();reject(new Error('读取收藏库失败，请重试'))}
  })
}
export async function putRecords(records:CollectionRecord[]):Promise<void>{
  if(records.some(r=>!validRecord(r)))throw new Error('记录数据不完整，无法保存')
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite')
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onabort=tx.onerror=()=>{db.close();reject(new Error('保存失败，浏览器存储空间可能不足；原有数据未被覆盖'))}
    try { records.forEach(r=>tx.objectStore('records').put(r)) }
    catch { tx.abort() }
  })
}
export async function deleteRecord(id:string):Promise<void>{
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite')
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onabort=tx.onerror=()=>{db.close();reject(new Error('删除收藏失败，请重试'))}
    tx.objectStore('records').delete(id)
  })
}
