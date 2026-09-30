import {t as tr} from '../i18n/runtime.ts'
import {useCallback,useEffect,useRef,useState} from 'react'
import type {Board} from '../domain/model'
import {STORAGE_KEY} from '../domain/model'

export function useBoardSave(board:Board,ready:boolean,persist?:()=>boolean,revision=0){
  const latest=useRef(board);latest.current=board
  const writer=useRef(persist);writer.current=persist
  const [result,setResult]=useState<{board?:Board;error:boolean;time:number}>({error:false,time:0})
  const flush=useCallback(()=>{
    try{
      if(writer.current){if(!writer.current())throw new Error('Save failed')}
      else localStorage.setItem(STORAGE_KEY,JSON.stringify(latest.current))
      setResult({board:latest.current,error:false,time:Date.now()})
      return true
    }catch{setResult(previous=>({...previous,error:true}));return false}
  },[])
  useEffect(()=>{
    if(!ready)return
    const timer=setTimeout(flush,450)
    const hide=()=>{if(document.hidden)flush()}
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hide)
    return()=>{clearTimeout(timer);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hide)}
  },[board,ready,revision,flush])
  return {saving:ready&&result.board!==board,error:result.error?tr("useBoardSave.001"):'',time:result.time,retry:flush}
}
