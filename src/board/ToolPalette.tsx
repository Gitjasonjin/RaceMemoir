import {HintButton} from '../shared/ui/Hint'
import {Scan,Sticker,MousePointer2,ImagePlus,Medal,RectangleEllipsis,Route,Map,Spline,StickyNote} from 'lucide-react'
import type {Kind} from '../domain/model'

const additions=[{kind:'sticker',label:'添加贴纸',icon:Sticker},{kind:'photo',label:'添加照片',icon:ImagePlus},{kind:'medal',label:'添加奖牌',icon:Medal},{kind:'bib',label:'添加号码布',icon:RectangleEllipsis},{kind:'map',label:'添加路线',icon:Route},{kind:'race-map',label:'添加地图',icon:Map}] as const

export default function ToolPalette({tool,onSelect,onConnect,onAdd,multiSelect,onMultiSelect}:{multiSelect:boolean;onMultiSelect:()=>void;tool:'select'|'connect';onSelect:()=>void;onConnect:()=>void;onAdd:(kind:Kind)=>void}){
 const button=(label:string,Icon:typeof ImagePlus,action:()=>void,active?:boolean,shortcut?:string)=> <HintButton key={label} side="right" hint={shortcut?`${label} · ${shortcut}`:label} className={`tool ${active?'active':''} ${label==='添加连线'?'connect-tool':''}`} aria-label={label} aria-pressed={active} onClick={action}><Icon size={21}/></HintButton>
 return <>
  <nav className="tool-palette" aria-label="收藏板工具">
   {button('选择',MousePointer2,onSelect,tool==='select'&&!multiSelect,'V')}
   <div className="touch-multiselect">{button(multiSelect?'结束多选':'多选物件',Scan,onMultiSelect,multiSelect)}</div>
   <div className="tool-divider"/>
   {additions.map(({kind,label,icon})=>button(label,icon,()=>onAdd(kind)))}
   <div className="tool-divider"/>
   {button('添加连线',Spline,onConnect,tool==='connect','C')}
   {button('添加便签',StickyNote,()=>onAdd('note'))}
  </nav>
 </>
}
