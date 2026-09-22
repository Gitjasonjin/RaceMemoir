import {ActionMenu,ActionMenuItem} from '../shared/ui/ActionMenu'
import {HintButton} from '../shared/ui/Hint'
import {AlignHorizontalJustifyStart,Group,Ungroup,Lock,Unlock} from 'lucide-react'
import type {Memory} from '../domain/model'
import {layoutUnits,lockedSelection} from './layout'
import type {LayoutAction} from './layout'
const options:[LayoutAction,string][]=[['left','左对齐'],['centerX','水平居中'],['right','右对齐'],['top','顶部对齐'],['centerY','垂直居中'],['bottom','底部对齐'],['distributeX','水平等距分布'],['distributeY','垂直等距分布']]
export default function LayoutMenu({items,ids,onArrange,onGroup,onLock}:{items:Memory[];ids:string[];onArrange:(a:LayoutAction)=>void;onGroup:(ungroup:boolean)=>void;onLock:()=>void}){
 const locked=lockedSelection(items,ids),units=layoutUnits(items,ids),grouped=items.some(i=>ids.includes(i.id)&&i.groupId)
 return <>{ids.length>1&&<ActionMenu label="对齐与分布" icon={<AlignHorizontalJustifyStart size={17}/>} className="layout-popover">{options.map(([a,label])=><ActionMenuItem key={a} disabled={locked||units.length<(a.startsWith('distribute')?3:2)} onClick={()=>onArrange(a)}>{label}</ActionMenuItem>)}</ActionMenu>}

 {(ids.length>1||grouped)&&<HintButton type="button" aria-label={grouped?'取消组合':'组合物件'} disabled={locked||(!grouped&&units.length<2)} onClick={()=>onGroup(grouped)}>{grouped?<Ungroup size={17}/>:<Group size={17}/>}</HintButton>}
 <HintButton type="button" aria-label={locked?'解锁物件':'锁定物件'} onClick={onLock}>{locked?<Unlock size={17}/>:<Lock size={17}/>}</HintButton></>
}
