import type { Memory } from '../../domain/model'
import { MEDAL_FRAMES, resolveMedalFrame } from '../../domain/styleCatalog'
export default function MedalSizing({item,aspect,onChange}:{item:Memory;aspect?:number;onChange:(change:Partial<Memory>)=>void}){
  const resize=(w:number,h:number)=>{
    const width=Math.round(Math.min(1440,Math.max(100,w))),height=Math.round(Math.min(900,Math.max(100,h)))
    onChange({w:width,h:height,x:item.x+(item.w-width)/2,y:item.y+(item.h-height)/2})
  }
  return <section className="medal-sizing"><h3>奖牌与展示框</h3>
    <fieldset className="surface-options"><legend>展示方式</legend><div>{MEDAL_FRAMES.map(frame=><button type="button" key={frame.id} aria-pressed={resolveMedalFrame(item.medalFrame).id===frame.id} onClick={()=>onChange({medalFrame:frame.id})}><span className={`frame-swatch frame-swatch-${frame.id}`} aria-hidden="true"/>{frame.label}</button>)}</div></fieldset>
    <label className="field-label">阴影深度 · {item.shadowDepth??50}%<input aria-label="阴影深度" type="range" min="0" max="100" step="5" value={item.shadowDepth??50} onChange={e=>onChange({shadowDepth:Number(e.target.value)})}/></label>
    <label className="field-label">框内奖牌大小 · {Math.round((item.medalScale??1)*100)}%<input aria-label="框内奖牌大小" type="range" min="40" max="180" step="5" value={(item.medalScale??1)*100} onChange={e=>onChange({medalScale:Number(e.target.value)/100})}/></label>
    <div className="record-actions"><button type="button" onClick={()=>onChange({medalScale:1})}>奖牌居中适配</button><button type="button" onClick={()=>{const f=Math.max(.8,100/item.w,100/item.h);resize(item.w*f,item.h*f)}}>缩小展示框</button><button type="button" onClick={()=>{const f=Math.min(1.25,1440/item.w,900/item.h);resize(item.w*f,item.h*f)}}>放大展示框</button><button type="button" disabled={!aspect} onClick={()=>{const innerW=item.w-44,innerH=innerW/aspect!;const f=Math.min(1,1396/innerW,856/innerH);const w=Math.max(100,Math.round(innerW*f+44)),h=Math.max(100,Math.round(innerH*f+44));onChange({w,h,x:item.x+(item.w-w)/2,y:item.y+(item.h-h)/2,medalScale:1})}}>框适配奖牌比例</button></div>

  </section>
}
