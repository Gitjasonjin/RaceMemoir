import {useCallback,useState} from 'react'
import type {RecordPanelMode} from '../library/types'

export interface MapPanel {id:string;groupKey?:string;choosing?:boolean}
export type EditorPanel =
  | {kind:'record';value:RecordPanelMode}
  | {kind:'memory';mode:'add'|'edit'}
  | {kind:'map';value:MapPanel}
  | {kind:'exhibit';id:string}
  | {kind:'decoration';scope:'board'|'selection'}
  | null

/** A single active editor prevents overlapping sidebars and stale return destinations. */
export function useEditorPanel(){
  const [panel,setPanel]=useState<EditorPanel>(null)
  const closePanel=useCallback(()=>setPanel(null),[])
  const openRecord=useCallback((value:RecordPanelMode)=>setPanel({kind:'record',value}),[])
  const openMemory=useCallback((mode:'add'|'edit')=>setPanel({kind:'memory',mode}),[])
  const openMap=useCallback((value:MapPanel)=>setPanel({kind:'map',value}),[])
  const openExhibit=useCallback((id:string)=>setPanel({kind:'exhibit',id}),[])
  const openDecoration=useCallback((scope:'board'|'selection')=>setPanel({kind:'decoration',scope}),[])
  return {closePanel,openRecord,openMemory,openMap,openExhibit,openDecoration,
    recordPanel:panel?.kind==='record'?panel.value:null,
    memoryPanel:panel?.kind==='memory'?panel.mode:null,
    mapPanel:panel?.kind==='map'?panel.value:null,
    exhibitPanel:panel?.kind==='exhibit'?panel.id:null,
    decorationOpen:panel?.kind==='decoration',
    decorationScope:panel?.kind==='decoration'?panel.scope:'board' as const,
  }
}
