import {useCallback,useEffect,useRef,useState} from 'react'
import type {Board} from './model'
import {STORAGE_KEY} from './model'

export function useBoardSave(board:Board,ready:boolean){
  const latest=useRef(board);latest.current=board
  const [result,setResult]=useState<{board?:Board;error:string;time:string}>({error:'',time:''})
  const flush=useCallback(()=>{
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(latest.current))
      setResult({board:latest.current,error:'',time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})})
      return true
    }catch{setResult(previous=>({...previous,error:'画布保存失败，请重试或导出备份'}));return false}
  },[])
  useEffect(()=>{
    if(!ready)return
    const timer=setTimeout(flush,450)
    const hide=()=>{if(document.hidden)flush()}
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hide)
    return()=>{clearTimeout(timer);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hide)}
  },[board,ready,flush])
  return {saving:ready&&result.board!==board,error:result.error,time:result.time,retry:flush}
}
