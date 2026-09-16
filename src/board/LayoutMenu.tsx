import {useState,useRef,useEffect} from 'react'
import {AlignHorizontalJustifyStart,Group,Ungroup,Lock,Unlock} from 'lucide-react'
import type {Memory} from '../domain/model'
import {layoutUnits,lockedSelection} from './layout'
import type {LayoutAction} from './layout'
const options:[LayoutAction,string][]=[['left','左对齐'],['centerX','水平居中'],['right','右对齐'],['top','顶部对齐'],['centerY','垂直居中'],['bottom','底部对齐'],['distributeX','水平等距分布'],['distributeY','垂直等距分布']]
export default function LayoutMenu({items,ids,onArrange,onGroup,onLock}:{items:Memory[];ids:string[];onArrange:(a:LayoutAction)=>void;onGroup:(ungroup:boolean)=>void;onLock:()=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),locked=lockedSelection(items,ids),units=layoutUnits(items,ids),grouped=items.some(i=>ids.includes(i.id)&&i.groupId)
 useEffect(()=>{if(!open)return;const click=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',click);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',click);document.removeEventListener('keydown',key,true)}},[open])
 return <>{ids.length>1&&<div className="layer-control" ref={root}><button type="button" ref={trigger} aria-label="对齐与分布" title="对齐与分布" aria-expanded={open} onClick={()=>setOpen(!open)}><AlignHorizontalJustifyStart size={17}/></button>{open&&<div className="layer-popover layout-popover" role="group" aria-label="排版操作">{options.map(([a,label])=><button type="button" key={a} disabled={locked||units.length<(a.startsWith('distribute')?3:2)} onClick={()=>{onArrange(a);setOpen(false);trigger.current?.focus()}}>{label}</button>)}</div>}</div>}
 {(ids.length>1||grouped)&&<button type="button" aria-label={grouped?'取消组合':'组合物件'} title={grouped?'取消组合':'组合物件'} disabled={locked||(!grouped&&units.length<2)} onClick={()=>onGroup(grouped)}>{grouped?<Ungroup size={17}/>:<Group size={17}/>}</button>}
 <button type="button" aria-label={locked?'解锁物件':'锁定物件'} title={locked?'解锁物件':'锁定物件'} onClick={onLock}>{locked?<Unlock size={17}/>:<Lock size={17}/>}</button></>
}
