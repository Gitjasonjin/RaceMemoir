import type {ReactNode} from 'react'
import type {Memory} from '../domain/model'
import type {CollectionRecord} from '../domain/records'
import type {BatchPhoto} from '../items/photo/batchPhotos'

export type RecordPanelMode = { mode: 'library' | 'medal' | 'photo' | 'photo-batch' | 'bib' | 'route' | 'detail' | 'exhibit-add' | 'sticker'; id?: string; files?:File[]; exhibitId?:string; medalId?:string; exhibitSlot?:number }
export interface RecordPanelProps {
  onImportPhotos:(photos:BatchPhoto[])=>Promise<void>
  onBibTemplate?:()=>void
  onBack?:()=>void
  exhibitMedal?:boolean
  styles?: ReactNode
  item?: Memory; onLayout?: (change: Partial<Memory>) => void
  mode: RecordPanelMode; records: CollectionRecord[]; references: (id: string) => number
  threadReferences?: (id:string)=>number
  onMode: (mode: RecordPanelMode) => void; onClose: () => void
  onSave: (record: CollectionRecord, add: boolean, layout?: Partial<Memory>) => Promise<void>
  onAdd: (record: CollectionRecord) => void | Promise<void>
  onEmptyRecycle: (ids: string[]) => Promise<void>
  onDelete: (id: string) => Promise<void>
}
