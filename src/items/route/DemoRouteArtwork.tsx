import type {Memory} from '../../domain/model'
import {resolveStyle} from '../../domain/styleCatalog'
import DemoRouteMap from './DemoRouteMap'
import RouteTicket from './RouteTicket'
import ElevationProfile from './ElevationProfile'

export default function DemoRouteArtwork({item}:{item:Memory}){
  const {compact}=resolveStyle('map',item.variant)
  // Older compact samples store their demo statistics in the title.
  const stats=item.title.match(/^([\d.]+)\s*km\s*\/\s*\+([\d,]+)\s*m$/i)
  return <RouteTicket title={stats?'山野路线':item.title} date={item.subtitle} compact={compact} demo
    distance={stats?Number(stats[1]).toFixed(1):'50.0'} ascent={stats?stats[2]:'2,800'} altitude="482–3,082 m"
    map={<DemoRouteMap compact={compact}/>}
    elevation={<ElevationProfile demo path="M10 58 L21 54 L28 55 L39 44 L46 47 L58 29 L66 41 L74 37 L82 46 L88 41 L98 43 L110 14 L117 19 L124 8 L131 19 L137 16 L147 37 L155 33 L168 45 L178 40 L190 53 L198 50 L206 55 L214 47 L220 52 L230 51"/>}/>
}
