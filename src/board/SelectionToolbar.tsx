import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react'
import type {ReactNode} from 'react'
import {createPortal} from 'react-dom'

/** Uses the palette's tooltip surface, placed above the bottom toolbar. */
export default function SelectionToolbar({children}:{children:ReactNode}){
  const id=useId(),popup=useRef<HTMLDivElement>(null)
  const [tip,setTip]=useState<{button:HTMLButtonElement;text:string}|null>(null)
  const [position,setPosition]=useState({left:0,top:0})
  const show=(target:EventTarget|null)=>{
    const button=target instanceof Element?target.closest('button'):null
    if(!button||button.closest('.layer-popover')||button.getAttribute('aria-expanded')==='true'){setTip(null);return}
    const text=button.dataset.tooltip||button.getAttribute('aria-label')
    setTip(current=>text?current?.button===button&&current.text===text?current:{button,text}:null)
  }
  useLayoutEffect(()=>{
    if(!tip||!popup.current)return
    const anchor=tip.button.getBoundingClientRect(),box=popup.current.getBoundingClientRect()
    setPosition({left:Math.max(8,Math.min(anchor.left+(anchor.width-box.width)/2,window.innerWidth-box.width-8)),top:Math.max(8,anchor.top-box.height-10)})
    const previous=tip.button.getAttribute('aria-describedby')
    tip.button.setAttribute('aria-describedby',previous?`${previous} ${id}`:id)
    return()=>{if(previous)tip.button.setAttribute('aria-describedby',previous);else tip.button.removeAttribute('aria-describedby')}
  },[tip,id])
  useEffect(()=>{
    if(!tip)return
    const hide=()=>setTip(null)
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();hide()}}
    window.addEventListener('resize',hide);window.addEventListener('scroll',hide,true);window.addEventListener('blur',hide);window.addEventListener('keydown',key,true)
    return()=>{window.removeEventListener('resize',hide);window.removeEventListener('scroll',hide,true);window.removeEventListener('blur',hide);window.removeEventListener('keydown',key,true)}
  },[tip])
  return <>
    <div className="selection-bar" onPointerOver={e=>{if(e.pointerType!=='touch')show(e.target)}} onPointerLeave={()=>setTip(null)} onFocus={e=>show(e.target)} onBlur={()=>setTip(null)} onClickCapture={()=>setTip(null)}>{children}</div>
    {tip&&createPortal(<div ref={popup} id={id} role="tooltip" className="tool-tooltip selection-tooltip" style={position}>{tip.text}</div>,document.body)}
  </>
}
