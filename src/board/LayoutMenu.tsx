import {t as tr} from '../i18n/runtime.ts'
import {ActionMenu,ActionMenuItem} from '../shared/ui/ActionMenu'
import {HintButton} from '../shared/ui/Hint'
import {AlignHorizontalJustifyStart,Group,Ungroup,Lock,Unlock} from 'lucide-react'
import type {Memory} from '../domain/model'
import {layoutUnits,lockedSelection} from './layout'
import type {LayoutAction} from './layout'
export default function LayoutMenu({items,ids,onArrange,onGroup,onLock}:{items:Memory[];ids:string[];onArrange:(a:LayoutAction)=>void;onGroup:(ungroup:boolean)=>void;onLock:()=>void}){
  const options:[LayoutAction,string][]=[['left',tr("LayoutMenu.013")],['centerX',tr("LayoutMenu.012")],['right',tr("LayoutMenu.011")],['top',tr("LayoutMenu.010")],['centerY',tr("LayoutMenu.009")],['bottom',tr("LayoutMenu.008")],['distributeX',tr("LayoutMenu.007")],['distributeY',tr("LayoutMenu.006")]]
 const locked=lockedSelection(items,ids),units=layoutUnits(items,ids),grouped=items.some(i=>ids.includes(i.id)&&i.groupId)
 return <>{ids.length>1&&<ActionMenu label={tr("LayoutMenu.005")} icon={<AlignHorizontalJustifyStart size={17}/>} className="layout-popover">{options.map(([a,label])=><ActionMenuItem key={a} disabled={locked||units.length<(a.startsWith('distribute')?3:2)} onClick={()=>onArrange(a)}>{label}</ActionMenuItem>)}</ActionMenu>}

 {(ids.length>1||grouped)&&<HintButton type="button" aria-label={grouped?tr("LayoutMenu.004"):tr("LayoutMenu.003")} disabled={locked||(!grouped&&units.length<2)} onClick={()=>onGroup(grouped)}>{grouped?<Ungroup size={17}/>:<Group size={17}/>}</HintButton>}
 <HintButton type="button" aria-label={locked?tr("LayoutMenu.002"):tr("LayoutMenu.001")} onClick={onLock}>{locked?<Unlock size={17}/>:<Lock size={17}/>}</HintButton></>
}
