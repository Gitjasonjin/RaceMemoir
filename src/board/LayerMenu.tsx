import {t as tr} from '../i18n/runtime.ts'
import {ActionMenu,ActionMenuItem} from '../shared/ui/ActionMenu'
import {Layers,ArrowUp,ArrowDown,ArrowUpToLine,ArrowDownToLine} from 'lucide-react'
import type {Memory} from '../domain/model'
import {lockedSelection} from './layout'
import {reorderItems} from './itemLayers'
import type {LayerAction,RelativeLayerAction} from './itemLayers'
const actions=[{id:'up',get label(){return tr("LayerMenu.006")},Icon:ArrowUp},{id:'down',get label(){return tr("LayerMenu.005")},Icon:ArrowDown},{id:'top',get label(){return tr("LayerMenu.004")},Icon:ArrowUpToLine},{id:'bottom',get label(){return tr("LayerMenu.003")},Icon:ArrowDownToLine}] as const
export default function LayerMenu({items,ids,onChange,onTarget}:{items:Memory[];ids:string[];onChange:(action:LayerAction)=>void;onTarget:(action:RelativeLayerAction)=>void}){
  return <ActionMenu label={tr("LayerMenu.002")} icon={<Layers size={17}/>} className="layer-target-menu">{actions.map(({id,label,Icon})=>{
      const next=reorderItems(items,ids,id),disabled=lockedSelection(items,ids)||next.every((item,i)=>item===items[i])
      return <ActionMenuItem key={id} disabled={disabled} onClick={()=>onChange(id)}><Icon size={16}/><span>{label}</span></ActionMenuItem>
    })}<hr/>{(['above','below'] as const).map(action=><ActionMenuItem key={action} disabled={lockedSelection(items,ids)||!items.some(i=>!ids.includes(i.id))} onClick={()=>onTarget(action)}>{action==='above'?<ArrowUp size={16}/>:<ArrowDown size={16}/>}<span>{tr("LayerMenu.001",{v1:action==='above'?tr("App.042"):tr("App.041")})}</span></ActionMenuItem>)}</ActionMenu>
}
