import {usePopover} from '../shared/usePopover'
import {Layers,ArrowUp,ArrowDown,ArrowUpToLine,ArrowDownToLine} from 'lucide-react'
import type {Memory} from '../domain/model'
import {lockedSelection} from './layout'
import {reorderItems} from './itemLayers'
import type {LayerAction,RelativeLayerAction} from './itemLayers'
const actions=[{id:'up',label:'上移一层',Icon:ArrowUp},{id:'down',label:'下移一层',Icon:ArrowDown},{id:'top',label:'置于顶层',Icon:ArrowUpToLine},{id:'bottom',label:'置于底层',Icon:ArrowDownToLine}] as const
export default function LayerMenu({items,ids,onChange,onTarget}:{items:Memory[];ids:string[];onChange:(action:LayerAction)=>void;onTarget:(action:RelativeLayerAction)=>void}){
  const {open,root,trigger,toggle,close}=usePopover()
  return <div className="layer-control" ref={root}>
    <button type="button" ref={trigger} aria-label="调整物件层级" aria-expanded={open} onClick={toggle}><Layers size={17}/></button>
    {open&&<div className="layer-popover layer-target-menu" role="group" aria-label="物件层级">{actions.map(({id,label,Icon})=>{
      const next=reorderItems(items,ids,id),disabled=lockedSelection(items,ids)||next.every((item,i)=>item===items[i])
      return <button type="button" key={id} disabled={disabled} onClick={()=>{onChange(id);close(true)}}><Icon size={16}/><span>{label}</span></button>
    })}<hr/>{(['above','below'] as const).map(action=><button type="button" key={action} disabled={lockedSelection(items,ids)||!items.some(i=>!ids.includes(i.id))} onClick={()=>{close();onTarget(action)}}>{action==='above'?<ArrowUp size={16}/>:<ArrowDown size={16}/>}<span>放到指定物件{action==='above'?'上方':'下方'}</span></button>)}</div>}
  </div>
}
