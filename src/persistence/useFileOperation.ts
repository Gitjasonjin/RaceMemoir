import {useCallback,useEffect,useRef,useState} from 'react'
import {AppError} from '../i18n/runtime'
import type {LatticeStatus} from '../shared/ui/LatticeLoader'

export type FileOperationKind='image'|'backup'|'restore'
export interface FileOperationState {kind:FileOperationKind;status:LatticeStatus;startedAt:number;endedAt?:number}

export function useFileOperation(){
  const active=useRef(false),mounted=useRef(true)
  const [state,setState]=useState<FileOperationState|null>(null)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current=false}},[])
  useEffect(()=>{
    if(!state||state.status==='working')return
    const timer=window.setTimeout(()=>{active.current=false;setBusy(false);setState(null)},state.status==='done'?650:1200)
    return()=>window.clearTimeout(timer)
  },[state])
  const run=useCallback(async(kind:FileOperationKind|null,task:()=>Promise<void>)=>{
    if(active.current)throw new AppError('App.084')
    active.current=true
    setBusy(true)
    const startedAt=performance.now()
    if(kind)setState({kind,status:'working',startedAt})
    // Yield before ZIP parsing/encoding so the operation feedback can paint first.
    if(kind)await new Promise<void>(resolve=>{
      if(document.hidden)setTimeout(resolve,0)
      else requestAnimationFrame(()=>setTimeout(resolve,0))
    })
    try{
      await task()
      if(kind&&mounted.current)setState({kind,status:'done',startedAt,endedAt:performance.now()})
    }catch(error){
      if(kind&&mounted.current)setState({kind,status:'error',startedAt,endedAt:performance.now()})
      throw error
    }finally{
      // Library actions keep their own inline feedback and release the lock immediately.
      if(!kind){active.current=false;if(mounted.current)setBusy(false)}
    }
  },[])
  return {active,state,run,busy}
}
