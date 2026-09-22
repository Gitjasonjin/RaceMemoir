import StickerEditor from '../items/sticker/StickerEditor'
import BibEditor from '../items/bib/BibEditor'
import {X} from 'lucide-react'
import LibraryRecords from './LibraryRecords'
import RecordEditor from './RecordEditor'
import BatchPhotoImport from './BatchPhotoImport'
import type {RecordPanelProps} from './types'
import ExhibitMedalPicker from '../items/medal/ExhibitMedalPicker'

export default function RecordPanel(props: RecordPanelProps) {
  const record = props.records.find(r => r.id === props.mode.id)
  return <aside className="record-panel" data-record-panel aria-label="收藏记录">
    {props.mode.mode==='exhibit-add'?<ExhibitMedalPicker key={`${props.mode.exhibitId}:${props.mode.exhibitSlot}`} {...props}/>:props.mode.mode==='photo-batch'?<BatchPhotoImport initialFiles={props.mode.files} onImport={props.onImportPhotos} onBack={()=>props.onMode({mode:'photo'})} onClose={props.onClose}/>:props.mode.mode === 'library' ? <>
      <div className="record-heading"><div><h2>我的收藏库</h2></div><button onClick={props.onClose} aria-label="关闭收藏库"><X size={20}/></button></div>
      <div className="record-scroll">
      <LibraryRecords {...props}/>
      </div>
    </> : props.mode.mode==='detail'&&!record ? <><div className="record-heading"><h2>记录暂不可用</h2><button onClick={props.onClose} aria-label="关闭详情"><X size={20}/></button></div><div className="record-scroll"><p>此物件关联的本地记录已丢失，可以导入完整备份恢复。</p><button onClick={() => props.onMode({mode:'library'})}>打开收藏库</button></div></> : (props.mode.mode==='sticker'||record?.kind==='sticker')?<StickerEditor key={`${record?.id||'sticker'}:${props.item?.id||'library'}`} {...props} record={record?.kind==='sticker'?record:undefined}/>: (props.mode.mode==='bib'||record?.kind==='bib')?<BibEditor key={record?.id||'bib'} {...props} record={record?.kind==='bib'?record:undefined}/>: <RecordEditor key={record?.id||props.mode.mode} {...props} record={record}/>}
  </aside>
}
