import { PHOTO_STYLES as papers, resolveStyle } from './styleCatalog'
import type { Memory } from './model'

export default function PhotoComposition({item,onChange}:{item:Memory;onChange:(change:Partial<Memory>)=>void}){
  return <section className="photo-composition-controls"><label className="field-label">相纸类型<select aria-label="相纸类型" value={resolveStyle('photo',item.variant).id} onChange={e=>{const p=papers.find(p=>p.id===e.target.value)!;onChange({variant:p.id,w:p.w,h:p.h,x:item.x+(item.w-p.w)/2,y:item.y+(item.h-p.h)/2})}}>{papers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <label className="field-label">图片缩放 · {Math.round((item.photoZoom??1)*100)}%<input aria-label="图片缩放" type="range" min="100" max="300" value={(item.photoZoom??1)*100} onChange={e=>onChange({photoZoom:Number(e.target.value)/100})}/></label>
    {(['photoX','photoY'] as const).map((key,i)=><label className="field-label" key={key}>{i?'垂直位置':'水平位置'}<input aria-label={i?'图片垂直位置':'图片水平位置'} type="range" min="0" max="100" value={item[key]??50} onChange={e=>onChange({[key]:Number(e.target.value)})}/></label>)}
    <div className="record-actions"><button type="button" onClick={()=>onChange({photoZoom:1,photoX:50,photoY:50})}>铺满并居中</button></div><p className="record-muted">图片自动铺满显示区，超出部分裁切。放大后可调整取景，文字大小保持不变。</p>
  </section>
}
