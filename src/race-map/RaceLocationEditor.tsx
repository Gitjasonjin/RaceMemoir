import {t as tr,provinceName} from '../i18n/runtime.ts'
import {useState} from 'react'
import {MapPin,Trash2} from 'lucide-react'
import type {RaceLocation} from '../domain/raceLocation'
import {coarseCoordinate} from '../domain/raceLocation'
import {mapGeometry} from './mapGeometry'
import {clampTransform,INITIAL_TRANSFORM} from './raceMapProjection'
import RaceMapCanvas from './RaceMapSurface'

export default function RaceLocationEditor({value,onChange,disabled=false}: {
  value?:RaceLocation;onChange:(value:RaceLocation|undefined)=>void;disabled?:boolean
}){
  const [editing,setEditing]=useState(false),[query,setQuery]=useState('')
  const [view,setView]=useState(()=>{
    const p=value&&Number.isFinite(value.lng)&&Number.isFinite(value.lat)?mapGeometry.projection([value.lng,value.lat]):null
    return p?clampTransform({scale:3,x:500-p[0]*3,y:350-p[1]*3}):INITIAL_TRANSFORM
  })
  const patch=(fields:Partial<RaceLocation>)=>onChange({name:tr("RaceLocationEditor.016"),lat:NaN,lng:NaN,...value,...fields,precise:false})
  const matches=query.trim()?mapGeometry.provinces.filter(p=>(p.name.includes(query.trim())||provinceName(p.id,p.name).toLowerCase().includes(query.trim().toLowerCase()))).slice(0,6):[]
  return <fieldset className="race-location-editor" disabled={disabled}>
    <legend>{tr("RaceLocationEditor.015")}</legend>
    {!value&&!editing?<button className="race-location-pick" type="button" onClick={()=>setEditing(true)}><MapPin size={16}/>{tr("RaceLocationEditor.014")}</button>:<>
      <label className="field-label">{tr("RaceLocationEditor.013")}<input maxLength={80} value={value?.name??''} onChange={e=>patch({name:e.target.value})} placeholder={tr("RaceLocationEditor.012")}/></label>
      <label className="field-label">{tr("RaceLocationEditor.011")}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr("RaceLocationEditor.010")}/></label>
      {!!query.trim()&&<div className="race-location-results">{matches.map(p=><button type="button" key={p.id} onClick={()=>{setView(clampTransform({scale:3,x:500-p.center[0]*3,y:350-p.center[1]*3}));setQuery('')}}><MapPin size={13}/>{provinceName(p.id,p.name)}</button>)}{!matches.length&&<small>{tr("RaceLocationEditor.009")}</small>}</div>}
      <div className="race-map-editor-preview race-location-inline" inert={disabled}>
        <RaceMapCanvas value={view} onViewChange={setView} location={value} onPick={point=>{if(!disabled)patch({...point,lat:coarseCoordinate(point.lat),lng:coarseCoordinate(point.lng)})}}/>
      </div>
      <p className="race-location-note" aria-live="polite">{tr("RaceLocationEditor.008",{v1:value&&Number.isFinite(value.lat)&&Number.isFinite(value.lng)?tr("RaceLocationEditor.007"):tr("RaceLocationEditor.006")})}</p>
      <details className="race-location-manual"><summary>{tr("RaceLocationEditor.005")}</summary><div className="race-location-coordinates">
        <label className="field-label">{tr("RaceLocationEditor.004")}<input type="number" min={-90} max={90} step="any" value={value&&Number.isFinite(value.lat)?value.lat:''} onChange={e=>patch({lat:e.target.valueAsNumber})}/></label>
        <label className="field-label">{tr("RaceLocationEditor.003")}<input type="number" min={-180} max={180} step="any" value={value&&Number.isFinite(value.lng)?value.lng:''} onChange={e=>patch({lng:e.target.valueAsNumber})}/></label>
      </div></details>
      <button type="button" className="race-location-clear" onClick={()=>{onChange(undefined);setEditing(false);setQuery('');setView(INITIAL_TRANSFORM)}}><Trash2 size={14}/>{value?tr("RaceLocationEditor.002"):tr("RaceLocationEditor.001")}</button>
    </>}
  </fieldset>
}
