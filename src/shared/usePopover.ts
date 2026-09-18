import {useCallback,useEffect,useRef,useState} from 'react'

/** Shared outside-click, Escape and trigger-focus behaviour for toolbar popovers. */
export function usePopover(){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
  const close=useCallback((restoreFocus=false)=>{setOpen(false);if(restoreFocus)trigger.current?.focus()},[])
  const toggle=useCallback(()=>setOpen(value=>!value),[])
  useEffect(()=>{
    if(!open)return
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close()}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();close(true)}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true)}
  },[open,close])
  return {open,root,trigger,toggle,close}
}
