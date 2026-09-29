import {t as tr} from '../i18n/runtime.ts'
import {MAP_SIZE_OPTIONS} from '../domain/mapSettings'
import {RACE_MAP_STYLES,resolveStyle} from '../domain/styleCatalog'
import RaceMapDrawing from './RaceMapDrawing'
import {useState} from 'react'
import {Check,Trash2,X} from 'lucide-react'
import type {Board,Memory,Thread} from '../domain/model'
import type {CollectionRecord} from '../domain/records'
import DecorationPanel from '../appearance/DecorationPanel'
import {boardRaceRecords} from './raceMapGrouping'
import type {RaceLocationGroup} from './raceMapGrouping'
import RaceMapCanvas from './RaceMapCanvas'

export default function RaceMapEditor({creating=false,item,board,records,groups,groupKey,choosing,hiddenThreads,onSave,onClose,onSelectGroup,onRace,onConnect,onRemoveThread}: {
  creating?:boolean;item:Memory;board:Board;records:CollectionRecord[];groups:RaceLocationGroup[];groupKey?:string;choosing:boolean;hiddenThreads:Thread[]
  onSave:(change:Partial<Memory>)=>void;onClose:()=>void;onSelectGroup:(key:string)=>void
  onRace:(id:string)=>void;onConnect:(id:string)=>void;onRemoveThread:(id:string)=>void
}){
  const [draft,setDraft]=useState<Pick<Memory,'w'|'h'|'mapView'|'pinStyle'|'variant'>>(()=>({variant:resolveStyle('race-map',item.variant).id,w:item.w,h:item.h,mapView:item.mapView??{x:0,y:0,scale:1},pinStyle:item.pinStyle??board.decorations?.pin??'classic'}))
  const group=groups.find(g=>g.key===groupKey)
  const races=group?.races??boardRaceRecords(board,records)
  return <aside className="record-panel race-map-editor" data-record-panel aria-label={tr("RaceMapEditor.016")}>
    <div className="record-heading"><div><h2>{creating?tr("RaceMapEditor.015"):tr("RaceMapEditor.014")}</h2></div><button type="button" aria-label={tr("RaceMapEditor.013")} onClick={onClose}><X size={20}/></button></div>
    <div className="record-scroll">
    <form onSubmit={e=>{e.preventDefault();onSave(draft);onClose()}}>
      <div className="race-map-editor-preview"><RaceMapCanvas theme={draft.variant} value={draft.mapView} onViewChange={mapView=>setDraft(d=>({...d,mapView}))} groups={groups} selected={groupKey} onSelect={onSelectGroup}/></div>
      <fieldset className="decoration-section"><legend>{tr("RaceMapEditor.012")}</legend><div className="map-size-options">{MAP_SIZE_OPTIONS.map(size=><button type="button" key={size.label} aria-pressed={draft.w===size.w&&draft.h===size.h} onClick={()=>setDraft(d=>({...d,w:size.w,h:size.h}))}><strong>{size.label}</strong><small>{size.w} × {size.h}</small></button>)}</div></fieldset>
      <p className="race-map-editor-help">{tr("RaceMapEditor.011")}</p>
      <fieldset className="decoration-section"><legend>{tr("RaceMapEditor.010")}</legend><div className="map-style-options">{RACE_MAP_STYLES.map(style=><button type="button" key={style.id} aria-pressed={draft.variant===style.id} className={draft.variant===style.id?'chosen':''} onClick={()=>setDraft(d=>({...d,variant:style.id}))}><svg viewBox="0 0 1000 700" aria-hidden="true"><RaceMapDrawing theme={style.id} view={{x:0,y:0,scale:1}}/></svg><span>{style.label}</span>{draft.variant===style.id&&<Check size={14}/>}</button>)}</div></fieldset>
      <DecorationPanel embedded board={board} item={{...item,...draft}} scope="selection" onChange={change=>{if(change.kind==='pin')setDraft(d=>({...d,pinStyle:change.style}))}} onPinToggle={()=>{}} onCurvature={()=>{}} onClose={()=>{}}/>
      <button type="submit" className="primary-button full-width"><Check size={17}/>{creating?tr("BibEditor.001"):tr("BibEditor.002")}</button>
    </form>
    <section className="race-map-editor-races"><div className="race-map-list-heading"><h3>{choosing?tr("RaceMapEditor.009"):group?.name??tr("RaceMapEditor.008")}</h3>{group&&!choosing&&<button type="button" onClick={()=>onSelectGroup('')}>{tr("LibraryRecords.030")}</button>}</div>
      {!groups.length&&<p className="race-map-editor-help">{tr("RaceMapEditor.007")}</p>}
      {!races.length&&<p className="race-map-editor-help">{tr("RaceMapEditor.006")}</p>}
      {races.map(r=><button type="button" className="race-map-race" key={r.id} onClick={()=>choosing?onConnect(r.id):onRace(r.id)}><span className="race-map-race-dot"/><span><strong>{r.name}</strong><small>{r.location?.name??tr("RaceLocationEditor.014")}</small></span></button>)}
    </section>
    {!!hiddenThreads.length&&<section className="race-map-hidden-threads"><h3>{tr("RaceMapEditor.005",{v1:hiddenThreads.length})}</h3><p className="race-map-editor-help">{tr("RaceMapEditor.004")}</p>{hiddenThreads.map(t=><div key={t.id}><span>{[t.fromRaceId,t.toRaceId].filter(Boolean).map(id=>records.find(r=>r.id===id)?.name??tr("RaceMapEditor.003")).join(' → ')||tr("RaceMapEditor.002")}</span><button type="button" aria-label={tr("RaceMapEditor.001")} onClick={()=>onRemoveThread(t.id)}><Trash2 size={16}/></button></div>)}</section>}
    </div>
  </aside>
}
