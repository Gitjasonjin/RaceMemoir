import {t as tr} from '../i18n/runtime.ts'
import MaterialPreview from '../shared/MaterialPreview'
import ToggleSwitch from '../shared/ui/ToggleSwitch'
import {useRef,useState} from 'react'
import {Dialog} from '@base-ui/react/dialog'
import {PendantLamp} from '../board/lighting/BoardLighting'
import Clothespin from './Clothespin'
import { DEFAULT_CURVATURE } from '../board/threadCurve'
import { PIN_OPTIONS as pinOptions, TAPE_OPTIONS as tapeOptions, THREAD_OPTIONS as threadOptions } from '../domain/styleCatalog'
import { BACKGROUND_STYLES, resolveBackground } from '../domain/styleCatalog'
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
  const [confirmPinId,setConfirmPinId]=useState<string|null>(null)
  const cancelPinRef=useRef<HTMLButtonElement>(null)
  const linkedThreads=item?board.threads.filter(t=>t.from===item.id||t.to===item.id):[]
  const togglePin=(enabled:boolean)=>{
    if(!enabled&&item?.kind==='bib'&&hasPin(item)&&linkedThreads.length){setConfirmPinId(item.id);return}
    onPinToggle(enabled)
  }
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
  return <Container className={embedded?'embedded-decoration':'decoration-panel'} aria-label={tr("DecorationPanel.028")} data-decoration-panel>
    <Dialog.Root open={!!item&&confirmPinId===item.id} onOpenChange={open=>{if(!open)setConfirmPinId(null)}}>
      <Dialog.Portal><Dialog.Backdrop className="ui-dialog-backdrop"/><Dialog.Viewport className="ui-dialog-viewport"><Dialog.Popup className="modal recycle-confirm-modal" data-ui-overlay initialFocus={cancelPinRef}>
        <div className="modal-scroll"><div className="modal-content"><Dialog.Title render={<h2/>}>{tr("DecorationPanel.031")}</Dialog.Title><Dialog.Description className="modal-description">{tr("DecorationPanel.030",{v1:linkedThreads.length})}</Dialog.Description><div className="clear-board-actions"><button type="button" ref={cancelPinRef} onClick={()=>setConfirmPinId(null)}>{tr("BoardDialog.042")}</button><button type="button" className="clear-board-confirm" onClick={()=>{setConfirmPinId(null);onPinToggle(false)}}>{tr("DecorationPanel.029")}</button></div></div></div>
      </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
    </Dialog.Root>
    {embedded&&<h3>{tr("DecorationPanel.028")}</h3>}
    {!embedded&&<>
    <div className="decoration-heading"><span className="decoration-heading-icon"><Palette size={19}/></span><div><h2 id="decoration-title">{tr("DecorationPanel.028")}</h2><p>{tr("DecorationPanel.027")}</p></div><button type="button" onClick={onClose} aria-label={tr("DecorationPanel.026")}><X size={19}/></button></div>
    </>}
    <div className={embedded?'decoration-content':'decoration-scroll'}>
    {!embedded&&<>
    <p className="decoration-caption">{all?tr("DecorationPanel.025"):item?tr("DecorationPanel.024",{v1:item.title.replace(/\n/g,' ')}):thread?tr("DecorationPanel.023"):tr("DecorationPanel.022")}</p>
    </>}
    {all&&lighting&&<fieldset className="decoration-section"><legend>{tr("DecorationPanel.021")}<span>LIGHTING</span></legend>
      <div className="lighting-preview" aria-hidden="true"><PendantLamp/></div>
      <div className="pin-toggle-row"><strong id="board-light-label">{tr("DecorationPanel.020")}</strong><ToggleSwitch labelledBy="board-light-label" checked={lighting.enabled} onChange={lighting.toggle}/></div>
    </fieldset>}
    {all&&onBackground&&<fieldset className="decoration-section"><legend>{tr("DecorationPanel.019")}<span>BACKGROUND</span></legend><div className="decoration-options background-options">{BACKGROUND_STYLES.map(option=><button type="button" key={option.id} aria-pressed={resolveBackground(board.backgroundStyle).id===option.id} className={resolveBackground(board.backgroundStyle).id===option.id?'chosen':''} onClick={()=>onBackground(option.id)}><MaterialPreview className="background-sample" id={option.id} scale={.55}/><span>{option.label}</span>{resolveBackground(board.backgroundStyle).id===option.id&&<Check className="style-check" size={12}/>}</button>)}</div></fieldset>}
    {!all && item && hasTape(item) && <div className="pin-toggle-row"><div><strong id="extra-pin-label">{tr("DecorationPanel.018")}</strong></div><ToggleSwitch labelledBy="extra-pin-label" checked={hasPin(item)} onChange={togglePin}/></div>}
    {canPin && <fieldset className="decoration-section"><legend>{tr("DecorationPanel.017")}<span>PIN & CLIP</span></legend><div className="decoration-options">{pinOptions.map(option=><button type="button" key={option.id} aria-pressed={pin===option.id} className={pin===option.id?'chosen':''} onClick={()=>onChange({kind:'pin',style:option.id})}><span className="decoration-sample pin-sample"><i className={`pushpin pin-${option.id}`}>{option.id==='clip'&&<Clothespin/>}</i></span><span>{option.label}</span>{pin===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&item?.pinStyle&&<button type="button" className="inherit-style" onClick={()=>onChange({kind:'pin',style:undefined})}><RotateCcw size={12}/>{tr("DecorationPanel.016")}</button>}</fieldset>}
    {canTape && <fieldset className="decoration-section"><legend>{tr("DecorationPanel.015")}<span>TAPE</span></legend><div className="decoration-options">{tapeOptions.map(option=><button type="button" key={option.id} aria-pressed={tape===option.id} className={tape===option.id?'chosen':''} onClick={()=>onChange({kind:'tape',style:option.id})}><span className="decoration-sample tape-sample"><i className={`tape tape-${option.id}`}/></span><span>{option.label}</span>{tape===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&item?.tapeStyle&&<button type="button" className="inherit-style" onClick={()=>onChange({kind:'tape',style:undefined})}><RotateCcw size={12}/>{tr("DecorationPanel.014")}</button>}</fieldset>}
    {canThread && <fieldset className="decoration-section"><legend>{tr("DecorationPanel.013")}<span>THREAD</span></legend><div className="decoration-options">{threadOptions.map(option=><button type="button" key={option.id} aria-pressed={line===option.id} className={line===option.id?'chosen':''} onClick={()=>onChange({kind:'thread',style:option.id})}><span className="decoration-sample thread-sample"><svg viewBox="0 0 70 44" aria-hidden="true"><ThreadStroke d="M 8 31 Q 34 32 62 12" style={option.id}/><circle cx="8" cy="31" r="2.5"/><circle cx="62" cy="12" r="2.5"/></svg></span><span>{option.label}</span>{line===option.id&&<Check className="style-check" size={12}/>}</button>)}</div>{!all&&thread?.style&&<button type="button" className="inherit-style" onClick={()=>onChange({kind:'thread',style:undefined})}><RotateCcw size={12}/>{tr("DecorationPanel.012")}</button>}</fieldset>}
    {!all&&thread&&<fieldset className="decoration-section"><legend>{tr("DecorationPanel.011",{v1:Math.round((thread.curvature??DEFAULT_CURVATURE)*100)})}</legend><input style={{width:'100%',accentColor:'#a83c46'}} aria-label={tr("DecorationPanel.010")} type="range" min="-35" max="35" step="1" value={Math.round((thread.curvature??DEFAULT_CURVATURE)*100)} onChange={e=>onCurvature(Number(e.target.value)/100)}/><p className="record-muted">{tr("DecorationPanel.009")}</p><div className="record-actions"><button type="button" onClick={()=>onCurvature(0)}>{tr("DecorationPanel.008")}</button><button type="button" onClick={()=>onCurvature(DEFAULT_CURVATURE)}>{tr("DecorationPanel.007")}</button></div></fieldset>}
    {!canPin&&!canTape&&!canThread&&<div className="decoration-empty"><Palette size={30}/><p>{item?.kind==='medal'?tr("DecorationPanel.006"):item?tr("DecorationPanel.005"):tr("DecorationPanel.004")}</p><span>{item?.kind==='medal'?tr("DecorationPanel.003"):tr("DecorationPanel.002")}</span></div>}
    {!embedded&&<div className="decoration-footer"><Check size={13}/><span>{tr("DecorationPanel.001")}</span></div>}
    </div>
  </Container>
}
