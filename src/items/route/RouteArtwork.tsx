import {useMemo} from 'react'
import type {RouteRecord} from '../../domain/records'
import {routeGeometry} from './gpx'
import RouteTicket from './RouteTicket'
import ElevationProfile from './ElevationProfile'
import RouteBasemap from './RouteBasemap'

export default function RouteArtwork({record,compact=false}:{record:RouteRecord;compact?:boolean}){
  const g=useMemo(()=>routeGeometry(record.trackPoints),[record.trackPoints])
  return <RouteTicket title={record.name} note={record.note} date={record.date} compact={compact}
    distance={(g.distance/1000).toFixed(2)} ascent={g.minElevation!==undefined?Math.round(g.ascent).toLocaleString('en-US'):undefined}
    altitude={g.minElevation!==undefined?`${Math.round(g.minElevation)}–${Math.round(g.maxElevation!)} m`:undefined}
    map={<RouteBasemap points={record.trackPoints} name={record.name}/>}
    elevation={g.elevationPath?<ElevationProfile path={g.elevationPath}/>:undefined}/>
}
