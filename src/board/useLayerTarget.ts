import {useEffect,useRef,useState} from 'react'
import type {PointerEvent as ReactPointerEvent,RefObject} from 'react'
import type {Board} from '../domain/model'
import {expandGroups,lockedSelection} from './layout'
import {intersectsSelection} from './selection'
import {screenToWorld} from './canvas'
import type {Camera} from './canvas'
import {placeItemsRelative} from './itemLayers'
import type {RelativeLayerAction} from './itemLayers'
export function useLayerTarget({board,selectedIds,viewport,view,commit,onBegin,onDone}:{board:Board;selectedIds:string[];viewport:RefObject<HTMLDivElement|null>;view:Camera;commit:(board:Board)=>void;onBegin:()=>void;onDone:()=>void}){
 const [mode,setMode]=useState<{action:RelativeLayerAction;ids:string[]}|null>(null),[target,setTarget]=useState<string|null>(null)
 const pointer=useRef<{x:number;y:number;ids:string[]}|null>(null)
 const cancel=()=>{setMode(null);setTarget(null);pointer.current=null}
 const begin=(action:RelativeLayerAction)=>{if(lockedSelection(board.items,selectedIds))return;onBegin();setMode({action,ids:expandGroups(board.items,selectedIds)});setTarget(null);pointer.current=null}
 const apply=(id:string)=>{if(!mode)return;const items=placeItemsRelative(board.items,mode.ids,id,mode.action);if(items.some((item,i)=>item!==board.items[i]))commit({...board,items});cancel();onDone()}
 useEffect(()=>{if(mode&&(mode.ids.some(id=>!board.items.some(i=>i.id===id))||lockedSelection(board.items,mode.ids)))cancel()},[board,mode])
 useEffect(()=>{
  if(!mode)return
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'||(e.key==='Enter'&&target)){e.preventDefault();e.stopPropagation();if(e.key==='Escape')cancel();else apply(target!)}
   else if(!((e.target as HTMLElement)?.closest?.('input,textarea,select'))&&['Delete','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','z','y','v','c'].includes(e.key.toLowerCase().length===1?e.key.toLowerCase():e.key)){e.preventDefault();e.stopPropagation()}
  }
  const outside=(e:PointerEvent)=>{if(!viewport.current?.contains(e.target as Node)&&!(e.target as Element).closest('[data-layer-target-hint]'))cancel()}
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside,true)
  return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside,true)}
 },[mode,target,board])
 const candidate=(clientX:number,clientY:number,cycle=false)=>{
  const el=viewport.current;if(!mode||!el)return null
  const rect=el.getBoundingClientRect(),point=screenToWorld(clientX-rect.left,clientY-rect.top,view),seen=new Set<string>()
  const ids=board.items.filter(i=>!mode.ids.includes(i.id)&&intersectsSelection(i,{...point,width:0,height:0})).reverse().filter(i=>{const key=i.groupId?`group:${i.groupId}`:i.id;if(seen.has(key))return false;seen.add(key);return true}).map(i=>i.id)
  const last=pointer.current,same=last&&Math.hypot(last.x-clientX,last.y-clientY)<5&&last.ids.join('|')===ids.join('|')
  const index=same&&target?ids.indexOf(target):-1
  const id=cycle?ids[(index+1)%ids.length]:same&&index>=0?target:ids[0]
  pointer.current={x:clientX,y:clientY,ids};setTarget(id??null);return id??null
 }
 const onMove=(e:ReactPointerEvent)=>{if(!mode)return;candidate(e.clientX,e.clientY);e.stopPropagation()}
 const onDown=(e:ReactPointerEvent)=>{if(!mode)return;e.preventDefault();e.stopPropagation();if(e.button!==0)return;const id=candidate(e.clientX,e.clientY,e.altKey);if(id&&!e.altKey)apply(id)}
 return {mode,target,highlightIds:target?expandGroups(board.items,[target]):[],begin,cancel,onMove,onDown,clearHover:()=>{setTarget(null);pointer.current=null}}
}
