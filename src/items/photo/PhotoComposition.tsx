import ChoiceSelect from '../../shared/ui/ChoiceSelect'
import { PHOTO_STYLES as papers, PHOTO_PAPERS, resolvePhotoPaper, resolveStyle } from '../../domain/styleCatalog'
import type { Memory } from '../../domain/model'

export default function PhotoComposition({item,onChange}:{item:Memory;onChange:(change:Partial<Memory>)=>void}){
  return <section className="photo-composition-controls"><fieldset className="surface-options"><legend>相纸样式</legend><div>{PHOTO_PAPERS.map(p=><button type="button" key={p.id} aria-pressed={resolvePhotoPaper(item.photoPaper,item.variant).id===p.id} onClick={()=>onChange({photoPaper:p.id})}><span className={`paper-swatch paper-swatch-${p.id}`} aria-hidden="true"/>{p.label}</button>)}</div></fieldset><ChoiceSelect label="照片版式" value={resolveStyle('photo',item.variant).id} options={papers.map(p=>({value:p.id,label:p.id==='polaroid'?'经典比例':p.label}))} onChange={value=>{const p=papers.find(p=>p.id===value)!;onChange({variant:p.id,photoPaper:resolvePhotoPaper(item.photoPaper,item.variant).id,w:p.w,h:p.h,x:item.x+(item.w-p.w)/2,y:item.y+(item.h-p.h)/2})}}/>
    <div className="record-actions"><button type="button" onClick={()=>onChange({photoZoom:1,photoX:50,photoY:50})}>铺满并居中</button></div>
  </section>
}
