import {useEffect,useId,useState} from 'react'
import {createPortal} from 'react-dom'
import {MousePointer2,ImagePlus,Medal,RectangleEllipsis,Route,Map,Spline,StickyNote} from 'lucide-react'
import type {Kind} from '../domain/model'

const additions=[{kind:'photo',label:'添加照片',icon:ImagePlus},{kind:'medal',label:'添加奖牌',icon:Medal},{kind:'bib',label:'添加号码布',icon:RectangleEllipsis},{kind:'map',label:'添加路线',icon:Route},{kind:'race-map',label:'添加地图',icon:Map}] as const

export default function ToolPalette({tool,onSelect,onConnect,onAdd}:{tool:'select'|'connect';onSelect:()=>void;onConnect:()=>void;onAdd:(kind:Kind)=>void}){
 const id=useId()
 const [tip,setTip]=useState<{label:string;text:string;x:number;y:number}|null>(null)
 const show=(button:HTMLButtonElement,label:string,shortcut?:string)=>{
  const rect=button.getBoundingClientRect(),horizontal=window.innerHeight<=600
  setTip({label,text:shortcut?`${label} · ${shortcut}`:label,x:Math.max(8,Math.min(horizontal?rect.left:rect.right+14,window.innerWidth-140)),y:Math.max(8,Math.min(horizontal?rect.bottom+12:rect.top+3,window.innerHeight-42))})
 }
 useEffect(()=>{
  if(!tip)return
  const hide=()=>setTip(null)
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();hide()}}
  window.addEventListener('resize',hide);window.addEventListener('scroll',hide,true);window.addEventListener('keydown',key,true);window.addEventListener('blur',hide)
  return()=>{window.removeEventListener('resize',hide);window.removeEventListener('scroll',hide,true);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',hide)}
 },[tip])
 const button=(label:string,Icon:typeof ImagePlus,action:()=>void,active?:boolean,shortcut?:string)=> <button key={label} type="button" className={`tool ${active?'active':''} ${label==='添加连线'?'connect-tool':''}`} aria-label={label} aria-pressed={active} aria-describedby={tip?.label===label?id:undefined} onPointerEnter={e=>{if(e.pointerType!=='touch')show(e.currentTarget,label,shortcut)}} onPointerLeave={()=>setTip(null)} onFocus={e=>show(e.currentTarget,label,shortcut)} onBlur={()=>setTip(null)} onClick={()=>{setTip(null);action()}}><Icon size={21}/></button>
 return <>
  <nav className="tool-palette" aria-label="收藏板工具">
   {button('选择',MousePointer2,onSelect,tool==='select','V')}
   <div className="tool-divider"/>
   {additions.map(({kind,label,icon})=>button(label,icon,()=>onAdd(kind)))}
   <div className="tool-divider"/>
   {button('添加连线',Spline,onConnect,tool==='connect','C')}
   {button('添加便签',StickyNote,()=>onAdd('note'))}
  </nav>
  {tip&&createPortal(<div id={id} role="tooltip" className="tool-tooltip" style={{left:tip.x,top:tip.y}}>{tip.text}</div>,document.body)}
 </>
}
