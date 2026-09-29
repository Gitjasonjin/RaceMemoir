import {t as tr} from '../../i18n/runtime.ts'
import {useEffect,useMemo,useRef,useState} from 'react'
import type {TrackPoint} from '../../domain/records'
import {routeMapGeometry,ROUTE_MAP_HEIGHT,ROUTE_MAP_WIDTH} from './routeMapGeometry'
import {loadRouteTile} from './routeTileCache'

export default function RouteBasemap({points,name}:{points:TrackPoint[];name:string}){
  const geometry=useMemo(()=>routeMapGeometry(points),[points])
  const svg=useRef<SVGSVGElement>(null)
  const [attempt,setAttempt]=useState(0),[requested,setRequested]=useState(false)
  const [result,setResult]=useState<{geometry:typeof geometry;images?:string[];error?:boolean}|null>(null)
  const current=result?.geometry===geometry?result:null
  const state=current?.images?'ready':current?.error?'error':requested?'loading':'idle'
  useEffect(()=>{
    const element=svg.current!
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setRequested(true);observer.disconnect()}})
    observer.observe(element)
    const prepare=()=>setRequested(true)
    element.addEventListener('prepare-route-map',prepare)
    return()=>{observer.disconnect();element.removeEventListener('prepare-route-map',prepare)}
  },[])
  useEffect(()=>{
    if(!requested)return
    let active=true;setResult(null)
    void Promise.all(geometry.tiles.map(tile=>loadRouteTile(tile.url))).then(images=>{if(active)setResult({geometry,images})},()=>{if(active)setResult({geometry,error:true})})
    return()=>{active=false}
  },[geometry,requested,attempt])
  const retry=()=>{setResult(null);setAttempt(n=>n+1)}
  return <><svg ref={svg} className="real-route-map" data-route-map-state={state} viewBox={`0 0 ${ROUTE_MAP_WIDTH} ${ROUTE_MAP_HEIGHT}`} aria-label={tr("RouteBasemap.005",{v1:name})}>
    {current?.images&&<g className="route-basemap-tiles">{geometry.tiles.map((tile,i)=><image key={`${tile.x}:${tile.y}`} href={current.images![i]} x={tile.x} y={tile.y} width={tile.size} height={tile.size}/>)}</g>}
    <path d={geometry.path} fill="none" stroke="#d85d25" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" style={{filter:'drop-shadow(0 0 1px #fffdf5)'}}/>
    {geometry.start&&<circle cx={geometry.start.x} cy={geometry.start.y} r="4.5" fill="#153d31" stroke="#fff9ed" strokeWidth="2"/>}
    {!current?.images&&<g className="route-basemap-status" role={state==='error'?'button':undefined} tabIndex={state==='error'?0:undefined} aria-label={state==='error'?tr("RouteBasemap.004"):undefined} onPointerDown={e=>{if(state==='error')e.stopPropagation()}} onClick={e=>{if(state==='error'){e.stopPropagation();retry()}}} onKeyDown={e=>{if(state==='error'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();retry()}}}>
      <rect x="62" y="113" width="260" height="25" rx="3" fill="#f5f2e8ed"/>
      <text x="192" y="130" textAnchor="middle" fontSize="12" fill="#606454">{state==='error'?tr("RouteBasemap.003"):tr("RouteBasemap.002")}</text>
    </g>}
  </svg><span className="route-map-attribution" aria-label={tr("RouteBasemap.001")}>
    <span>© OpenStreetMap contributors</span>
    <small>openstreetmap.org/copyright</small>
  </span></>
}
