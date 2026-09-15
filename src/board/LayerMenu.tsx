import {useEffect,useRef,useState} from 'react'
import {Layers,ArrowUp,ArrowDown,ArrowUpToLine,ArrowDownToLine} from 'lucide-react'
import type {Memory} from '../domain/model'
import {reorderItems} from './itemLayers'
import type {LayerAction} from './itemLayers'
const actions=[{id:'up',label:'上移一层',Icon:ArrowUp},{id:'down',label:'下移一层',Icon:ArrowDown},{id:'top',label:'置于顶层',Icon:ArrowUpToLine},{id:'bottom',label:'置于底层',Icon:ArrowDownToLine}] as const
export default function LayerMenu({items,ids,onChange}:{items:Memory[];ids:string[];onChange:(action:LayerAction)=>void}){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
  useEffect(()=>{
    if(!open)return
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)}
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);trigger.current?.focus()}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true)}
  },[open])
  return <div className="layer-control" ref={root}>
    <button type="button" ref={trigger} title="调整物件层级" aria-label="调整物件层级" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Layers size={17}/></button>
    {open&&<div className="layer-popover" role="group" aria-label="物件层级">{actions.map(({id,label,Icon})=>{
      const next=reorderItems(items,ids,id),disabled=next.every((item,i)=>item===items[i])
      return <button type="button" key={id} disabled={disabled} onClick={()=>{onChange(id);setOpen(false);trigger.current?.focus()}}><Icon size={16}/><span>{label}</span></button>
    })}</div>}
  </div>
}
