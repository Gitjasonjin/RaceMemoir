import {t as tr} from '../i18n/runtime.ts'
import {HintButton,HintGroup} from '../shared/ui/Hint'
import {Scan,Sticker,MousePointer2,ImagePlus,Medal,RectangleEllipsis,Route,Map,Spline,StickyNote} from 'lucide-react'
import type {Kind} from '../domain/model'

const additions=[{kind:'sticker',get label(){return tr("ToolPalette.012")},icon:Sticker},{kind:'photo',get label(){return tr("ToolPalette.011")},icon:ImagePlus},{kind:'medal',get label(){return tr("ToolPalette.010")},icon:Medal},{kind:'bib',get label(){return tr("ToolPalette.009")},icon:RectangleEllipsis},{kind:'map',get label(){return tr("ToolPalette.008")},icon:Route},{kind:'race-map',get label(){return tr("ToolPalette.007")},icon:Map}] as const

export default function ToolPalette({tool,onSelect,onConnect,onAdd,multiSelect,onMultiSelect}:{multiSelect:boolean;onMultiSelect:()=>void;tool:'select'|'connect';onSelect:()=>void;onConnect:()=>void;onAdd:(kind:Kind)=>void}){
 const button=(label:string,Icon:typeof ImagePlus,action:()=>void,active?:boolean,shortcut?:string)=> <HintButton key={label} side="right" hint={shortcut?`${label} · ${shortcut}`:label} className={`tool ${active?'active':''} ${label===tr("ToolPalette.002")?'connect-tool':''}`} aria-label={label} aria-pressed={active} onClick={action}><Icon size={21}/></HintButton>
 return <HintGroup>
  <nav className="tool-palette" aria-label={tr("ToolPalette.006")}>
   {button(tr("ToolPalette.005"),MousePointer2,onSelect,tool==='select'&&!multiSelect,'V')}
   <div className="touch-multiselect">{button(multiSelect?tr("ToolPalette.004"):tr("ToolPalette.003"),Scan,onMultiSelect,multiSelect)}</div>
   <div className="tool-divider"/>
   {additions.map(({kind,label,icon})=>button(label,icon,()=>onAdd(kind)))}
   <div className="tool-divider"/>
   {button(tr("ToolPalette.002"),Spline,onConnect,tool==='connect','C')}
   {button(tr("ToolPalette.001"),StickyNote,()=>onAdd('note'))}
  </nav>
 </HintGroup>
}
