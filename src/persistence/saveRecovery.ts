export type SaveStorage=Pick<Storage,'getItem'|'setItem'>
export const RECOVERY_STORAGE_KEY='racememoir-save-recovery-v1'
export interface SaveReadIssue {key:string;status:'corrupt'|'unavailable';raw?:string}
export type SaveReadResult<T>={status:'loaded';value:T}|{status:'missing'}|{status:'corrupt';raw:string}|{status:'unavailable'}

export function readSaved<T>(key:string,validator:(value:unknown)=>value is T,storage?:SaveStorage):SaveReadResult<T>{
  let raw:string|null
  try{raw=(storage??localStorage).getItem(key)}catch{return {status:'unavailable'}}
  if(raw===null)return {status:'missing'}
  try{
    const value:unknown=JSON.parse(raw)
    if(validator(value))return {status:'loaded',value}
  }catch{return {status:'corrupt',raw}}
  return {status:'corrupt',raw}
}

interface RecoveryEntry {key:string;raw:string;createdAt:number}
interface RecoveryLedger {version:1;entries:RecoveryEntry[]}
function isRecoveryLedger(value:unknown):value is RecoveryLedger{
  if(!value||typeof value!=='object')return false
  const ledger=value as RecoveryLedger
  return ledger.version===1&&Array.isArray(ledger.entries)&&ledger.entries.every(entry=>entry&&typeof entry.key==='string'&&typeof entry.raw==='string'&&Number.isSafeInteger(entry.createdAt)&&entry.createdAt>=0)
}

/** Preserve an unreadable save before its key can be replaced. */
export function protectSaved<T>(key:string,validator:(value:unknown)=>value is T,storage:SaveStorage):boolean{
  const saved=readSaved(key,validator,storage)
  if(saved.status==='unavailable')return false
  if(saved.status!=='corrupt')return true
  const recovery=readSaved(RECOVERY_STORAGE_KEY,isRecoveryLedger,storage)
  if(recovery.status==='corrupt'||recovery.status==='unavailable')return false
  const entries=recovery.status==='loaded'?recovery.value.entries:[]
  if(entries.some(entry=>entry.key===key&&entry.raw===saved.raw))return true
  try{
    storage.setItem(RECOVERY_STORAGE_KEY,JSON.stringify({version:1,entries:[...entries,{key,raw:saved.raw,createdAt:Date.now()}]}))
    return true
  }catch{return false}
}
