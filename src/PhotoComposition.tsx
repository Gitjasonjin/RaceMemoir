import { PHOTO_STYLES as papers, resolveStyle } from './styleCatalog'
import type { Memory } from './model'

export default function PhotoComposition({item,onChange}:{item:Memory;onChange:(change:Partial<Memory>)=>void}){
  return <section className="photo-composition-controls"><label className="field-label">相纸类型<select aria-label="相纸类型" value={resolveStyle('photo',item.variant).id} onChange={e=>{const p=papers.find(p=>p.id===e.target.value)!;onChange({variant:p.id,w:p.w,h:p.h,x:item.x+(item.w-p.w)/2,y:item.y+(item.h-p.h)/2})}}>{papers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <div className="record-actions"><button type="button" onClick={()=>onChange({photoZoom:1,photoX:50,photoY:50})}>铺满并居中</button></div><p className="record-muted">在预览图片上拖动取景，滚轮缩放。图片始终铺满，文字大小保持不变。</p>
  </section>
}
