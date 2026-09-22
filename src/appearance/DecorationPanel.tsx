import ToggleSwitch from '../shared/ui/ToggleSwitch'
import {PendantLamp} from '../board/lighting/BoardLighting'
import Clothespin from './Clothespin'
import { DEFAULT_CURVATURE } from '../board/threadCurve'
import { PIN_OPTIONS as pinOptions, TAPE_OPTIONS as tapeOptions, THREAD_OPTIONS as threadOptions } from '../domain/styleCatalog'
import { BACKGROUND_STYLES, backgroundStyle, resolveBackground } from '../domain/styleCatalog'
import type { BackgroundStyleId } from '../domain/styleCatalog'
import { Check, Palette, RotateCcw, X } from 'lucide-react'
import { getDecorations, hasPin, hasTape } from '../domain/model'
import type { Board, DecorationChange, Memory, Thread, ThreadStyle } from '../domain/model'

/** The canvas and style swatches share the same strokes, including the cord texture. */
export function ThreadStroke({d, style, shadow = false}: {d: string; style: ThreadStyle; shadow?: boolean}) {
  return <g className={`thread-art thread-${style}`}>
    <path className="red-thread" d={d} filter={shadow ? 'url(#thread-shadow)' : undefined}/>
    {(style === 'cord'||style==='hemp') && <path className="thread-fiber" d={d}/>}
  </g>
}

interface Props {
  lighting?: {enabled:boolean;toggle:()=>void}
  embedded?: boolean
  board: Board
  item?: Memory
  thread?: Thread
  scope: 'board' | 'selection'
  onChange: (change: DecorationChange) => void
  onPinToggle: (enabled: boolean) => void
  onCurvature: (curvature:number) => void
  onClose: () => void
  onBackground?: (id:BackgroundStyleId) => void
}
export default function DecorationPanel({board,item,thread,scope,onChange,onPinToggle,onClose,onCurvature,onBackground,lighting,embedded=false}: Props) {
  const defaults = getDecorations(board)
  const all = scope === 'board'
  const pin = all ? defaults.pin : item?.pinStyle ?? defaults.pin
  const tape = all ? defaults.tape : item?.tapeStyle ?? defaults.tape
  const line = all ? defaults.thread : thread?.style ?? defaults.thread
  const canPin = all || (item && hasPin(item))
  const canTape = all || (item && hasTape(item))
  const canThread = all || !!thread
  const Container=embedded?'section':'aside'
  if(embedded&&!canPin&&!canTape&&!canThread&&!item?.pinEnabled&&!(item&&hasTape(item)))return null
  return <Container className={embedded?'embedded-decoration':'decoration-panel'} aria-label="装饰样式" data-decoration-panel>
    {embedded&&<h3>装饰样式</h3>}
    {!embedded&&<>
    <div className="decoration-heading"><span className="decoration-heading-icon"><Palette size={19}/></span><div><h2 id="decoration-title">装饰样式</h2><p>小小细节，也有你的个性</p></div><button type="button" onClick={onClose} aria-label="关闭装饰样式"><X size={19}/></button></div>
    </>}
    <div className={embedded?'decoration-content':'decoration-scroll'}>
    {!embedded&&<>
    <p className="decoration-caption">{all?'统一替换对应装饰，新藏品也会沿用。':item?`正在装饰「${item.title.replace(/\n/g,' ')}」`:thread?'只改变这一段连接，其他红线保持原样。':'在画布上选中一件藏品或一段红线。'}</p>
    </>}
    {all&&lighting&&<fieldset className="decoration-section"><legend>灯光<span>LIGHTING</span></legend>
      <div className="lighting-preview" aria-hidden="true"><PendantLamp/></div>
      <div className="pin-toggle-row"><strong id="board-light-label">开启灯具与光照</strong><ToggleSwitch labelledBy="board-light-label" checked={lighting.enabled} onChange={lighting.toggle}/></div>
    </fieldset>}
    {all&&onBackground&&<fieldset className="decoration-section"><legend>收藏板背景<span>BACKGROUND</span></legend><div className="decoration-options background-options">{BACKGROUND_STYLES.map(option=><button type="button" key={option.id} aria-pressed={resolveBackground(board.backgroundStyle).id===option.id} className={resolveBackground(board.backgroundStyle).id===option.id?'chosen':''} onClick={()=>onBackground(option.id)}><span className="background-sample" style={backgroundStyle(option.id,.55)}/><span>{option.label}</span>{resolveBackground(board.backgroundStyle).id===option.id&&<Check className="style-check" size={12}/>}</button>)}</div></fieldset>}
    {!all && item && hasTape(item) && <div className="pin-toggle-row"><div><strong id="extra-pin-label">同时使用大头钉</strong></div><ToggleSwitch labelledBy="extra-pin-label" checked={hasPin(item)} onChange={onPinToggle}/></div>}
    {canPin && <fieldset className="decoration-section"><legend>固定装饰<span>PIN & CLIP</span></legend><div className="decoration-options">{pinOptions.map(option=><button type="button" key={option.id} aria-pressed={pin===option.id} className={pin===option.id?'chosen':''} onClick={()=>onChange({kind:'pin',style:option.id})}><span className="decoration-sample pin-sample"><i className={`pushpin pin-${option.id}`}>{option.id==='clip'&&<Clothespin/>}</i></span><span>{option.label}</span>{pin===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&item?.pinStyle&&<button type="button" className="inherit-style" onClick={()=>onChange({kind:'pin',style:undefined})}><RotateCcw size={12}/>跟随收藏板大头钉样式</button>}</fieldset>}
    {canTape && <fieldset className="decoration-section"><legend>胶带<span>TAPE</span></legend><div className="decoration-options">{tapeOptions.map(option=><button type="button" key={option.id} aria-pressed={tape===option.id} className={tape===option.id?'chosen':''} onClick={()=>onChange({kind:'tape',style:option.id})}><span className="decoration-sample tape-sample"><i className={`tape tape-${option.id}`}/></span><span>{option.label}</span>{tape===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&item?.tapeStyle&&<button type="button" className="inherit-style" onClick={()=>onChange({kind:'tape',style:undefined})}><RotateCcw size={12}/>跟随收藏板胶带样式</button>}</fieldset>}
    {canThread && <fieldset className="decoration-section"><legend>连接绳<span>THREAD</span></legend><div className="decoration-options">{threadOptions.map(option=><button type="button" key={option.id} aria-pressed={line===option.id} className={line===option.id?'chosen':''} onClick={()=>onChange({kind:'thread',style:option.id})}><span className="decoration-sample thread-sample"><svg viewBox="0 0 70 44" aria-hidden="true"><ThreadStroke d="M 8 31 Q 34 32 62 12" style={option.id}/><circle cx="8" cy="31" r="2.5"/><circle cx="62" cy="12" r="2.5"/></svg></span><span>{option.label}</span>{line===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&thread?.style&&<button type="button" className="inherit-style" onClick={()=>onChange({kind:'thread',style:undefined})}><RotateCcw size={12}/>跟随收藏板红线样式</button>}</fieldset>}
    {!all&&thread&&<fieldset className="decoration-section"><legend>弯曲度 · {Math.round((thread.curvature??DEFAULT_CURVATURE)*100)}%</legend><input style={{width:'100%',accentColor:'#a83c46'}} aria-label="连线弯曲度" type="range" min="-35" max="35" step="1" value={Math.round((thread.curvature??DEFAULT_CURVATURE)*100)} onChange={e=>onCurvature(Number(e.target.value)/100)}/><p className="record-muted">正值向下垂，负值向上弯，0% 为直线。</p><div className="record-actions"><button type="button" onClick={()=>onCurvature(0)}>拉直</button><button type="button" onClick={()=>onCurvature(DEFAULT_CURVATURE)}>自然弧度</button></div></fieldset>}
    {!canPin&&!canTape&&!canThread&&<div className="decoration-empty"><Palette size={30}/><p>{item?.kind==='medal'?'奖牌珍藏在木质展示框中。':item?'这张便签没有大头钉或胶带。':'先选中，再换一种样式。'}</p><span>{item?.kind==='medal'?'双击奖牌可编辑赛事名称与奖牌材质。':'照片和路线卡可换大头钉；号码布可自由搭配胶带与图钉。'}</span></div>}
    {!embedded&&<div className="decoration-footer"><Check size={13}/><span>即时生效 · 自动保存 · 支持撤销</span></div>}
    </div>
  </Container>
}
