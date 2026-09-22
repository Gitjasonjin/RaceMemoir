import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {Check,Magnet,Trash2} from 'lucide-react'

export default function CanvasContextMenu({position,snapEnabled,onToggle,onClose,onClear,canClear}:{position:{x:number;y:number};snapEnabled:boolean;onToggle:()=>void;onClose:()=>void;onClear:()=>void;canClear:boolean}){
 const root=useRef<HTMLDivElement>(null)
 const [point,setPoint]=useState(position)
 useLayoutEffect(()=>{
  const rect=root.current!.getBoundingClientRect()
  setPoint({x:Math.max(8,Math.min(position.x,window.innerWidth-rect.width-8)),y:Math.max(8,Math.min(position.y,window.innerHeight-rect.height-8))})
  root.current!.querySelector('button')?.focus()
 },[position])
 useEffect(()=>{
  const dismiss=(e:Event)=>{if(!root.current?.contains(e.target as Node))onClose()}
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose()}else if(e.key==='Tab')onClose()}
  document.addEventListener('pointerdown',dismiss,true);document.addEventListener('wheel',dismiss,true);document.addEventListener('keydown',key,true)
  window.addEventListener('resize',onClose);window.addEventListener('blur',onClose)
  return()=>{document.removeEventListener('pointerdown',dismiss,true);document.removeEventListener('wheel',dismiss,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',onClose);window.removeEventListener('blur',onClose)}
 },[onClose])
 return <div ref={root} className="canvas-context-menu" role="menu" aria-label="画布菜单" style={{left:point.x,top:point.y}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>e.stopPropagation()}>
  <button type="button" role="menuitemcheckbox" aria-checked={snapEnabled} aria-label="吸附模式" onClick={onToggle}><Magnet size={17}/><span>吸附模式</span><Check size={16} className={snapEnabled?'':'unchecked'}/></button>
  <div className="canvas-menu-divider" role="separator"/>
  <button type="button" role="menuitem" className="canvas-clear-action" disabled={!canClear} onClick={onClear}><Trash2 size={17}/><span>清空画布</span></button>
 </div>
}
