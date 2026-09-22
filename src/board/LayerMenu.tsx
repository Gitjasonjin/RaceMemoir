import {ActionMenu,ActionMenuItem} from '../shared/ui/ActionMenu'
import {Layers,ArrowUp,ArrowDown,ArrowUpToLine,ArrowDownToLine} from 'lucide-react'
import type {Memory} from '../domain/model'
import {lockedSelection} from './layout'
import {reorderItems} from './itemLayers'
import type {LayerAction,RelativeLayerAction} from './itemLayers'
const actions=[{id:'up',label:'上移一层',Icon:ArrowUp},{id:'down',label:'下移一层',Icon:ArrowDown},{id:'top',label:'置于顶层',Icon:ArrowUpToLine},{id:'bottom',label:'置于底层',Icon:ArrowDownToLine}] as const
export default function LayerMenu({items,ids,onChange,onTarget}:{items:Memory[];ids:string[];onChange:(action:LayerAction)=>void;onTarget:(action:RelativeLayerAction)=>void}){
  return <ActionMenu label="调整物件层级" icon={<Layers size={17}/>} className="layer-target-menu">{actions.map(({id,label,Icon})=>{
      const next=reorderItems(items,ids,id),disabled=lockedSelection(items,ids)||next.every((item,i)=>item===items[i])
      return <ActionMenuItem key={id} disabled={disabled} onClick={()=>onChange(id)}><Icon size={16}/><span>{label}</span></ActionMenuItem>
    })}<hr/>{(['above','below'] as const).map(action=><ActionMenuItem key={action} disabled={lockedSelection(items,ids)||!items.some(i=>!ids.includes(i.id))} onClick={()=>onTarget(action)}>{action==='above'?<ArrowUp size={16}/>:<ArrowDown size={16}/>}<span>放到指定物件{action==='above'?'上方':'下方'}</span></ActionMenuItem>)}</ActionMenu>
}
