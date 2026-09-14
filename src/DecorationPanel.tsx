import { Check, Palette, RotateCcw, X } from 'lucide-react'
import { getDecorations, hasPin, hasTape } from './model'
import type { Board, DecorationChange, Memory, PinStyle, TapeStyle, Thread, ThreadStyle } from './model'

const pinOptions: {id: PinStyle; label: string}[] = [{id:'classic',label:'经典红钉'},{id:'brass',label:'复古黄铜'},{id:'pearl',label:'珍珠白钉'},{id:'forest',label:'森林绿钉'}]
const tapeOptions: {id: TapeStyle; label: string}[] = [{id:'classic',label:'原稿搭配'},{id:'kraft',label:'牛皮纸胶'},{id:'sage',label:'鼠尾草绿'},{id:'dots',label:'蓝色波点'}]
const threadOptions: {id: ThreadStyle; label: string}[] = [{id:'classic',label:'经典红线'},{id:'fine',label:'轻盈细线'},{id:'cord',label:'编织红绳'},{id:'dashed',label:'手缝虚线'}]

/** The canvas and style swatches share the same strokes, including the cord texture. */
export function ThreadStroke({d, style, shadow = false}: {d: string; style: ThreadStyle; shadow?: boolean}) {
  return <g className={`thread-art thread-${style}`}>
    <path className="red-thread" d={d} filter={shadow ? 'url(#thread-shadow)' : undefined}/>
    {style === 'cord' && <path className="thread-fiber" d={d}/>}
  </g>
}

interface Props {
  board: Board
  item?: Memory
  thread?: Thread
  scope: 'board' | 'selection'
  onScope: (scope: 'board' | 'selection') => void
  onChange: (change: DecorationChange) => void
  onPinToggle: (enabled: boolean) => void
  onClose: () => void
}
export default function DecorationPanel({board,item,thread,scope,onScope,onChange,onPinToggle,onClose}: Props) {
  const defaults = getDecorations(board)
  const all = scope === 'board'
  const pin = all ? defaults.pin : item?.pinStyle ?? defaults.pin
  const tape = all ? defaults.tape : item?.tapeStyle ?? defaults.tape
  const line = all ? defaults.thread : thread?.style ?? defaults.thread
  const canPin = all || (item && hasPin(item))
  const canTape = all || (item && hasTape(item))
  const canThread = all || !!thread
  return <aside className="decoration-panel" aria-labelledby="decoration-title" data-decoration-panel>
    <div className="decoration-heading"><span className="decoration-heading-icon"><Palette size={19}/></span><div><h2 id="decoration-title">装饰样式</h2><p>小小细节，也有你的个性</p></div><button onClick={onClose} aria-label="关闭装饰样式"><X size={19}/></button></div>
    <div className="decoration-scopes" aria-label="样式应用范围"><button aria-pressed={all} className={all?'chosen':''} onClick={()=>onScope('board')}>整块收藏板</button><button aria-pressed={!all} className={!all?'chosen':''} onClick={()=>onScope('selection')}>{thread?'当前连线':'当前藏品'}</button></div>
    <p className="decoration-caption">{all?'统一替换对应装饰，新藏品也会沿用。':item?`正在装饰「${item.title.replace(/\n/g,' ')}」`:thread?'只改变这一段连接，其他红线保持原样。':'在画布上选中一件藏品或一段红线。'}</p>
    {!all && item && hasTape(item) && <div className="pin-toggle-row"><div><strong id="extra-pin-label">同时使用大头钉</strong><p id="extra-pin-help">胶带固定之外，可加一枚图钉串起红线。</p></div><button type="button" role="switch" aria-checked={hasPin(item)} aria-labelledby="extra-pin-label" aria-describedby="extra-pin-help" className={`pin-toggle ${hasPin(item)?'enabled':''}`} onClick={()=>onPinToggle(!hasPin(item))}><span/></button></div>}
    {canPin && <fieldset className="decoration-section"><legend>大头钉<span>PIN</span></legend><div className="decoration-options">{pinOptions.map(option=><button key={option.id} aria-pressed={pin===option.id} className={pin===option.id?'chosen':''} onClick={()=>onChange({kind:'pin',style:option.id})}><span className="decoration-sample pin-sample"><i className={`pushpin pin-${option.id}`}/></span><span>{option.label}</span>{pin===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&item?.pinStyle&&<button className="inherit-style" onClick={()=>onChange({kind:'pin',style:undefined})}><RotateCcw size={12}/>跟随收藏板大头钉样式</button>}</fieldset>}
    {canTape && <fieldset className="decoration-section"><legend>胶带<span>TAPE</span></legend><div className="decoration-options">{tapeOptions.map(option=><button key={option.id} aria-pressed={tape===option.id} className={tape===option.id?'chosen':''} onClick={()=>onChange({kind:'tape',style:option.id})}><span className="decoration-sample tape-sample"><i className={`tape tape-${option.id}`}/></span><span>{option.label}</span>{tape===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&item?.tapeStyle&&<button className="inherit-style" onClick={()=>onChange({kind:'tape',style:undefined})}><RotateCcw size={12}/>跟随收藏板胶带样式</button>}</fieldset>}
    {canThread && <fieldset className="decoration-section"><legend>红线<span>THREAD</span></legend><div className="decoration-options">{threadOptions.map(option=><button key={option.id} aria-pressed={line===option.id} className={line===option.id?'chosen':''} onClick={()=>onChange({kind:'thread',style:option.id})}><span className="decoration-sample thread-sample"><svg viewBox="0 0 70 44" aria-hidden="true"><ThreadStroke d="M 8 31 Q 34 32 62 12" style={option.id}/><circle cx="8" cy="31" r="2.5"/><circle cx="62" cy="12" r="2.5"/></svg></span><span>{option.label}</span>{line===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&thread?.style&&<button className="inherit-style" onClick={()=>onChange({kind:'thread',style:undefined})}><RotateCcw size={12}/>跟随收藏板红线样式</button>}</fieldset>}
    {!canPin&&!canTape&&!canThread&&<div className="decoration-empty"><Palette size={30}/><p>{item?.kind==='medal'?'奖牌珍藏在木质展示框中。':item?'这张便签没有大头钉或胶带。':'先选中，再换一种样式。'}</p><span>{item?.kind==='medal'?'双击奖牌可编辑赛事名称与奖牌材质。':'照片和路线卡可换大头钉；号码布可自由搭配胶带与图钉。'}</span></div>}
    <div className="decoration-footer"><Check size={13}/><span>即时生效 · 自动保存 · 支持撤销</span></div>
  </aside>
}
