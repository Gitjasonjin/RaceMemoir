import {resolveStyle} from '../domain/styleCatalog'
import {useId} from 'react'
import terrain from '../assets/maps/china-terrain.webp?inline'
import {mapGeometry} from './mapGeometry'
import {MAP_WIDTH,MAP_HEIGHT} from './raceMapProjection'
import type {MapView} from '../domain/model'
import type {RaceLocation} from '../domain/raceLocation'
import type {RaceLocationGroup} from './raceMapGrouping'
import RaceMapMarker from './RaceMapMarker'

/** SVG content only: no pan/zoom handlers or toolbar in board artwork. */
export default function RaceMapDrawing({theme,view,groups=[],selected,onSelect,location}: {
  theme?:string;view:MapView;groups?:RaceLocationGroup[];selected?:string;onSelect?:(key:string)=>void;location?:RaceLocation
}){
  const terrainClip=`terrain-${useId().replace(/:/g,'')}`
  const picked=location&&Number.isFinite(location.lng)&&Number.isFinite(location.lat)?mapGeometry.projection([location.lng,location.lat]):null
  const style=resolveStyle('race-map',theme).id
  return <g className={`map-drawing map-theme-${style}`}>
    <rect className="race-map-paper" width={MAP_WIDTH} height={MAP_HEIGHT}/>
    <g className="race-map-geography" transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
      {mapGeometry.provinces.map(p=><path className="race-province" key={p.id} d={p.d}><title>{p.name}</title></path>)}
      <defs><clipPath id={terrainClip}>{mapGeometry.provinces.map(p=><path key={p.id} d={p.d}/>)}</clipPath></defs>
      {(style==='vintage')&&<image className="race-map-terrain" href={terrain} width={MAP_WIDTH} height={MAP_HEIGHT} clipPath={`url(#${terrainClip})`} preserveAspectRatio="none"/>}
      <g className="race-map-terrain-borders" fill="none" stroke="#fafbfccc" strokeWidth={1.1}>{mapGeometry.provinces.map(p=><path key={p.id} d={p.d}/>)}</g>
      <g className="map-graticule" fill="none" strokeWidth={.7/view.scale}>
        {Array.from({length:15},(_,i)=>70+i*5).map(lng=>{const a=mapGeometry.projection([lng,15])!,b=mapGeometry.projection([lng,60])!;return <path key={lng} d={`M${a[0]},${a[1]}L${b[0]},${b[1]}`}/>})}
        {Array.from({length:10},(_,i)=>15+i*5).map(lat=>{const a=mapGeometry.projection([65,lat])!,b=mapGeometry.projection([140,lat])!;return <path key={lat} d={`M${a[0]},${a[1]}L${b[0]},${b[1]}`}/>})}
      </g>
      {mapGeometry.provinces.map(p=><text className="race-province-name" key={p.id} x={p.center[0]} y={p.center[1]}>{p.label}</text>)}
      {groups.map(group=>{
        const p=mapGeometry.projection([group.lng,group.lat])
        if(!p||!p.every(Number.isFinite))return null
        const x=p[0]*view.scale+view.x,y=p[1]*view.scale+view.y
        if(x<0||x>MAP_WIDTH||y<0||y>MAP_HEIGHT)return null
        return <RaceMapMarker key={group.key} groupKey={group.key} x={p[0]} y={p[1]} name={group.name} count={group.races.length} scale={view.scale} selected={group.key===selected} onClick={onSelect?()=>onSelect(group.key):undefined}/>
      })}
      {picked&&picked.every(Number.isFinite)&&<RaceMapMarker x={picked[0]} y={picked[1]} name={location?.name||'待命名地点'} count={1} scale={view.scale} selected/>}
    </g>
    <g className="map-marginalia" pointerEvents="none">
      <rect x="8" y="8" width="984" height="684" fill="none" strokeWidth="1"/>
      {Array.from({length:15},(_,i)=>70+i*5).map(lng=>{const p=mapGeometry.projection([lng,30])!,x=p[0]*view.scale+view.x;return x>35&&x<940?<text key={lng} x={x} y={23} textAnchor="middle">{lng}°E</text>:null})}
      {Array.from({length:10},(_,i)=>15+i*5).map(lat=>{const p=mapGeometry.projection([100,lat])!,y=p[1]*view.scale+view.y;return y>45&&y<670?<text key={lat} x={17} y={y}>{lat}°N</text>:null})}
      <g transform="translate(948 64)"><path d="M0 -20L-7 9L0 5L7 9Z" strokeWidth="1"/><text x="0" y="-28" textAnchor="middle">N</text></g>
    </g>
  </g>
}
