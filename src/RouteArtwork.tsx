import { useMemo } from 'react'
import type { RouteRecord } from './records'
import { routeGeometry } from './gpx'

export default function RouteArtwork({record,compact=false}: {record:RouteRecord;compact?:boolean}){
  const g=useMemo(()=>routeGeometry(record.trackPoints),[record.trackPoints])
  return <div className={`real-route paper ${compact?'route-compact':''}`}>
    <div className="real-route-title handwritten">{record.name}</div>
    <svg className="real-route-map" viewBox="0 0 240 240" aria-label={`${record.name}真实轨迹图`}>
      <path d={g.path} fill="none" stroke="#486960" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>
      {g.start&&<circle cx={g.start.x} cy={g.start.y} r="4" fill="#be4140" stroke="#fff9ed" strokeWidth="2"/>}
      <text x="16" y="22" fontSize="9" fill="#77836f">N ↑</text>
    </svg>
    <div className="real-route-stats"><strong>{(g.distance/1000).toFixed(2)} km</strong>{g.minElevation!==undefined&&<span>↑ {Math.round(g.ascent)} m</span>}</div>
    {!compact&&g.elevationPath&&<><svg className="real-route-elevation" viewBox="0 0 240 80" aria-label="海拔曲线"><path d="M10 15H230M10 40H230M10 65H230" stroke="#bcc3b2" strokeWidth=".5"/><path d={g.elevationPath} fill="none" stroke="#61769c" strokeWidth="1.5"/></svg><small className="route-altitude">海拔 {Math.round(g.minElevation!)}–{Math.round(g.maxElevation!)} m</small></>}
    {!compact&&record.note&&<div className="route-note handwritten">{record.note}</div>}
  </div>
}
