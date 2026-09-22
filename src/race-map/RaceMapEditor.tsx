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

export default function RaceMapEditor({item,board,records,groups,groupKey,choosing,hiddenThreads,onSave,onClose,onSelectGroup,onRace,onConnect,onRemoveThread}: {
  item:Memory;board:Board;records:CollectionRecord[];groups:RaceLocationGroup[];groupKey?:string;choosing:boolean;hiddenThreads:Thread[]
  onSave:(change:Partial<Memory>)=>void;onClose:()=>void;onSelectGroup:(key:string)=>void
  onRace:(id:string)=>void;onConnect:(id:string)=>void;onRemoveThread:(id:string)=>void
}){
  const [draft,setDraft]=useState<Pick<Memory,'w'|'h'|'mapView'|'pinStyle'|'variant'>>(()=>({variant:resolveStyle('race-map',item.variant).id,w:item.w,h:item.h,mapView:item.mapView??{x:0,y:0,scale:1},pinStyle:item.pinStyle??board.decorations?.pin??'classic'}))
  const group=groups.find(g=>g.key===groupKey)
  const races=group?.races??boardRaceRecords(board,records)
  return <aside className="record-panel race-map-editor" data-record-panel aria-label="赛事地图编辑">
    <div className="record-heading"><div><h2>编辑赛事地图</h2></div><button type="button" aria-label="关闭地图编辑" onClick={onClose}><X size={20}/></button></div>
    <div className="record-scroll">
    <form onSubmit={e=>{e.preventDefault();onSave(draft);onClose()}}>
      <div className="race-map-editor-preview"><RaceMapCanvas theme={draft.variant} value={draft.mapView} onViewChange={mapView=>setDraft(d=>({...d,mapView}))} groups={groups} selected={groupKey} onSelect={onSelectGroup}/></div>
      <fieldset className="decoration-section"><legend>地图尺寸</legend><div className="map-size-options">{MAP_SIZE_OPTIONS.map(size=><button type="button" key={size.label} aria-pressed={draft.w===size.w&&draft.h===size.h} onClick={()=>setDraft(d=>({...d,w:size.w,h:size.h}))}><strong>{size.label}</strong><small>{size.w} × {size.h}</small></button>)}</div></fieldset>
      <p className="race-map-editor-help">拖动平移 · 双指或 Ctrl / ⌘ + 滚轮缩放 · 修改后点击保存</p>
      <fieldset className="decoration-section"><legend>地图样式</legend><div className="map-style-options">{RACE_MAP_STYLES.map(style=><button type="button" key={style.id} aria-pressed={draft.variant===style.id} className={draft.variant===style.id?'chosen':''} onClick={()=>setDraft(d=>({...d,variant:style.id}))}><svg viewBox="0 0 1000 700" aria-hidden="true"><RaceMapDrawing theme={style.id} view={{x:0,y:0,scale:1}}/></svg><span>{style.label}</span>{draft.variant===style.id&&<Check size={14}/>}</button>)}</div></fieldset>
      <DecorationPanel embedded board={board} item={{...item,...draft}} scope="selection" onChange={change=>{if(change.kind==='pin')setDraft(d=>({...d,pinStyle:change.style}))}} onPinToggle={()=>{}} onCurvature={()=>{}} onClose={()=>{}}/>
      <button type="submit" className="primary-button full-width"><Check size={17}/>保存修改</button>
    </form>
    <section className="race-map-editor-races"><div className="race-map-list-heading"><h3>{choosing?'选择连线对应的赛事':group?.name??'本板赛事'}</h3>{group&&!choosing&&<button type="button" onClick={()=>onSelectGroup('')}>全部</button>}</div>
      {!groups.length&&<p className="race-map-editor-help">为本板奖牌或路线添加赛事地点，即可在地图上留下红圈。</p>}
      {!races.length&&<p className="race-map-editor-help">先将奖牌或路线放到收藏板上。</p>}
      {races.map(r=><button type="button" className="race-map-race" key={r.id} onClick={()=>choosing?onConnect(r.id):onRace(r.id)}><span className="race-map-race-dot"/><span><strong>{r.name}</strong><small>{r.location?.name??'添加赛事地点'}</small></span></button>)}
    </section>
    {!!hiddenThreads.length&&<section className="race-map-hidden-threads"><h3>暂未显示的连线 · {hiddenThreads.length}</h3><p className="race-map-editor-help">赛事离开本板、缺少地点或在取景范围外；恢复后连线会重新出现。</p>{hiddenThreads.map(t=><div key={t.id}><span>{[t.fromRaceId,t.toRaceId].filter(Boolean).map(id=>records.find(r=>r.id===id)?.name??'赛事').join(' → ')||'地点连线'}</span><button type="button" aria-label="删除暂未显示的连线" onClick={()=>onRemoveThread(t.id)}><Trash2 size={16}/></button></div>)}</section>}
    </div>
  </aside>
}
