import {t as tr} from '../i18n/runtime.ts'
import {useEffect,useMemo} from 'react'
import {Menu} from '@base-ui/react/menu'
import {Check,Magnet,Trash2} from 'lucide-react'

/** Keep the canvas's existing mouse/long-press detection; Base UI owns the popup. */
export default function CanvasContextMenu({position,snapEnabled,onToggle,onClose,onClear,canClear}:{position:{x:number;y:number};snapEnabled:boolean;onToggle:()=>void;onClose:()=>void;onClear:()=>void;canClear:boolean}){
 const anchor=useMemo(()=>({getBoundingClientRect:()=>new DOMRect(position.x,position.y,0,0)}),[position.x,position.y])
 useEffect(()=>{
  const dismiss=(e:Event)=>{if(!(e.target instanceof Element)||!e.target.closest('.canvas-context-menu'))onClose()}
  document.addEventListener('wheel',dismiss,true);window.addEventListener('resize',onClose);window.addEventListener('blur',onClose)
  return()=>{document.removeEventListener('wheel',dismiss,true);window.removeEventListener('resize',onClose);window.removeEventListener('blur',onClose)}
 },[onClose])
 return <Menu.Root open modal={false} onOpenChange={open=>{if(!open)onClose()}}>
  <Menu.Portal><Menu.Positioner anchor={anchor} side="bottom" align="start" collisionPadding={8} positionMethod="fixed" className="ui-menu-positioner">
   <Menu.Popup className="canvas-context-menu ui-action-menu" aria-label={tr("CanvasContextMenu.003")} data-ui-overlay onContextMenu={e=>e.preventDefault()}>
    <Menu.CheckboxItem nativeButton render={<button type="button"/>} checked={snapEnabled} onCheckedChange={onToggle} closeOnClick aria-label={tr("CanvasContextMenu.002")}><Magnet size={17}/><span>{tr("CanvasContextMenu.002")}</span><Check size={16} className={snapEnabled?'':'unchecked'}/></Menu.CheckboxItem>
    <Menu.Separator className="canvas-menu-divider"/>
    <Menu.Item nativeButton render={<button type="button"/>} className="canvas-clear-action" disabled={!canClear} onClick={onClear}><Trash2 size={17}/><span>{tr("CanvasContextMenu.001")}</span></Menu.Item>
   </Menu.Popup>
  </Menu.Positioner></Menu.Portal>
 </Menu.Root>
}
