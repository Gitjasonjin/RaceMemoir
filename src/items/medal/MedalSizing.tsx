import {t as tr} from '../../i18n/runtime.ts'
import MedalScaleControl from './MedalScaleControl'
import type { Memory } from '../../domain/model'
import { MEDAL_FRAMES, resolveMedalFrame } from '../../domain/styleCatalog'
export default function MedalSizing({item,aspect,onChange}:{item:Memory;aspect?:number;onChange:(change:Partial<Memory>)=>void}){
  const resize=(w:number,h:number)=>{
    const width=Math.round(Math.min(1440,Math.max(100,w))),height=Math.round(Math.min(900,Math.max(100,h)))
    onChange({w:width,h:height,x:item.x+(item.w-width)/2,y:item.y+(item.h-height)/2})
  }
  return <section className="medal-sizing"><h3>{tr("MedalSizing.006")}</h3>
    <fieldset className="surface-options"><legend>{tr("MedalSizing.005")}</legend><div>{MEDAL_FRAMES.map(frame=><button type="button" key={frame.id} aria-pressed={resolveMedalFrame(item.medalFrame).id===frame.id} onClick={()=>onChange({medalFrame:frame.id})}><span className={`frame-swatch frame-swatch-${frame.id}`} aria-hidden="true"/>{frame.label}</button>)}</div></fieldset>
    <label className="field-label">{tr("MedalSizing.004")}{item.shadowDepth??50}%<input aria-label={tr("MedalExhibitControls.006")} type="range" min="0" max="100" step="5" value={item.shadowDepth??50} onChange={e=>onChange({shadowDepth:Number(e.target.value)})}/></label>
    <MedalScaleControl value={item.medalScale} onChange={medalScale=>onChange({medalScale})}><button type="button" onClick={()=>{const f=Math.max(.8,100/item.w,100/item.h);resize(item.w*f,item.h*f)}}>{tr("MedalSizing.003")}</button><button type="button" onClick={()=>{const f=Math.min(1.25,1440/item.w,900/item.h);resize(item.w*f,item.h*f)}}>{tr("MedalSizing.002")}</button><button type="button" disabled={!aspect} onClick={()=>{const innerW=item.w-44,innerH=innerW/aspect!;const f=Math.min(1,1396/innerW,856/innerH);const w=Math.max(100,Math.round(innerW*f+44)),h=Math.max(100,Math.round(innerH*f+44));onChange({w,h,x:item.x+(item.w-w)/2,y:item.y+(item.h-h)/2,medalScale:1})}}>{tr("MedalSizing.001")}</button></MedalScaleControl>

  </section>
}
