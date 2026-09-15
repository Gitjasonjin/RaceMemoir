import type {Memory} from '../../domain/model'
import {resolveStyle} from '../../domain/styleCatalog'
import DemoRouteMap from './DemoRouteMap'

export default function DemoRouteArtwork({item}:{item:Memory}){
  const route=resolveStyle('map',item.variant)
  return <div className={`map-paper paper ${route.compact ? 'compact' : ''}`}>
    {!route.compact && <div className="map-heading handwritten">50 km / +2,800 m</div>}<div className="map-content"><DemoRouteMap compact={route.compact}/>{!route.compact && <div className="map-stats">最高海拔<strong>3,082 m</strong><br/>最低海拔<strong>482 m</strong></div>}{route.compact && <span className="gpx">GPX</span>}</div>
    {!route.compact && <svg className="elevation" viewBox="0 0 220 65"><defs><linearGradient id="altitude" x2="0" y2="1"><stop stopColor="#5678c5" stopOpacity=".35"/><stop offset="1" stopColor="#5678c5" stopOpacity="0"/></linearGradient></defs><path d="m0 53 11-4 6 1 12-11 6 3 12-18 8 12 8-4 8 9 6-5 10 2 12-29 7 5 7-11 7 11 6-3 10 21 8-4 13 12 10-5 12 13 8-3 8 5 8-8 5 5 10-1v15H0Z" fill="url(#altitude)" stroke="#4164a3" strokeWidth="1.3"/><path d="M0 10V58H220M0 39H220M0 20H220" stroke="#a7a89e" opacity=".5" strokeWidth=".5"/></svg>}
    <div className="map-caption handwritten">{item.title}<small>{!route.compact && `— ${item.subtitle}`}</small></div>
  </div>
}
