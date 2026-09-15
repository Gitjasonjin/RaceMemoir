import {resolveStyle} from '../../domain/styleCatalog'
import type {Memory} from '../../domain/model'
import type {RaceLocationGroup} from '../../race-map/raceMapGrouping'
import {mapContentRect} from '../../board/threadEndpoints'
import RaceMapDrawing from '../../race-map/RaceMapDrawing'

export default function RaceMapArtwork({item,groups}:{item:Memory;groups:RaceLocationGroup[]}){
  const rect=mapContentRect(item)
  return <div className={`race-map-paper-item map-theme-${resolveStyle('race-map',item.variant).id}`}  data-map-ready="true">
    <svg className="race-map-item-svg" aria-label="赛事地图底图" viewBox="0 0 1000 700" style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}}>
      <RaceMapDrawing theme={item.variant} view={item.mapView??{x:0,y:0,scale:1}} groups={groups}/>
    </svg>
    <div className="race-map-item-footer"><span>Natural Earth · 纪念示意</span><span>{groups.length} 个地点 · {groups.reduce((n,g)=>n+g.races.length,0)} 场赛事</span></div>
  </div>
}
