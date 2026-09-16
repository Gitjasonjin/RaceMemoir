import {ImagePlus,Plus,Route,X} from 'lucide-react'
import LibraryRecords from './LibraryRecords'
import RecordEditor from './RecordEditor'
import type {RecordPanelProps} from './types'

export default function RecordPanel(props: RecordPanelProps) {
  const record = props.records.find(r => r.id === props.mode.id)
  return <aside className="record-panel" data-record-panel aria-label="收藏记录" onKeyDown={e => e.stopPropagation()}>
    {props.mode.mode === 'library' ? <>
      <div className="record-heading"><div><h2>我的收藏库</h2></div><button onClick={props.onClose} aria-label="关闭收藏库"><X size={20}/></button></div>
      <div className="record-actions"><button onClick={() => props.onMode({mode:'medal'})}><Plus size={16}/>上传奖牌</button><button onClick={() => props.onMode({mode:'photo'})}><ImagePlus size={16}/>上传照片</button><button onClick={() => props.onMode({mode:'route'})}><Route size={16}/>导入 GPX</button></div>
      <LibraryRecords {...props}/>
    </> : props.mode.mode==='detail'&&!record ? <><div className="record-heading"><h2>记录暂不可用</h2><button onClick={props.onClose} aria-label="关闭详情"><X size={20}/></button></div><p>此物件关联的本地记录已丢失，可以导入完整备份恢复。</p><button onClick={() => props.onMode({mode:'library'})}>打开收藏库</button></> : <RecordEditor key={record?.id||props.mode.mode} {...props} record={record}/>}
  </aside>
}
