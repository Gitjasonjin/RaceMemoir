import type {ReactNode} from 'react'
import type {Memory} from '../domain/model'
import type {CollectionRecord} from '../domain/records'

export type RecordPanelMode = { mode: 'library' | 'medal' | 'photo' | 'route' | 'detail'; id?: string }
export interface RecordPanelProps {
  styles?: ReactNode
  item?: Memory; onLayout?: (change: Partial<Memory>) => void
  mode: RecordPanelMode; records: CollectionRecord[]; references: (id: string) => number
  onMode: (mode: RecordPanelMode) => void; onClose: () => void
  onSave: (record: CollectionRecord, add: boolean, layout?: Partial<Memory>) => Promise<void>
  onAdd: (record: CollectionRecord) => void
  onDelete: (id: string) => Promise<void>
}
