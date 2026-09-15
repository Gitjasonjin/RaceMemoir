import RaceMapArtwork from './race-map/RaceMapArtwork'
import type {RaceLocationGroup} from '../race-map/raceMapGrouping'
import type {Memory,TapeStyle} from '../domain/model'
import {displayMemory} from '../domain/records'
import type {CollectionRecord} from '../domain/records'
import {resolveStyle} from '../domain/styleCatalog'
import MedalArtwork from './medal/MedalArtwork'
import PhotoArtwork from './photo/PhotoArtwork'
import BibArtwork from './bib/BibArtwork'
import NoteArtwork from './note/NoteArtwork'
import RouteArtwork from './route/RouteArtwork'
import DemoRouteArtwork from './route/DemoRouteArtwork'

/** Dispatch only: each item owns its rendering and asset hooks. */
export default function Artwork({item:instance,tapeStyle='classic',record,raceGroups=[]}:{item:Memory;tapeStyle?:TapeStyle;record?:CollectionRecord;raceGroups?:RaceLocationGroup[]}){
  const item=displayMemory(instance,record)
  if(item.recordId&&!record)return <div className="missing-record paper"><strong>记录不可用</strong><span>请从收藏库重新添加，或导入完整备份。</span></div>
  switch(item.kind){
    case 'race-map':return <RaceMapArtwork item={item} groups={raceGroups}/>
    case 'medal':return <MedalArtwork item={item} record={record}/>
    case 'photo':return <PhotoArtwork item={item} record={record}/>
    case 'bib':return <BibArtwork item={item} tapeStyle={tapeStyle}/>
    case 'note':return <NoteArtwork item={item}/>
    case 'map':return record?.kind==='route'&&record.source==='upload'?<RouteArtwork record={record} compact={resolveStyle('map',item.variant).compact}/>:<DemoRouteArtwork item={item}/>
  }
}
