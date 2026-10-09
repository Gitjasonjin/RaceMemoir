import {t as tr} from '../i18n/runtime.ts'
import {memo} from 'react'
import {useDeferredArtwork} from '../shared/useDeferredArtwork'
import {useTranslation} from 'react-i18next'
import StickerArtwork from './sticker/StickerArtwork'
import RaceMapArtwork from './race-map/RaceMapArtwork'
import type {RaceLocationGroup} from '../race-map/raceMapGrouping'
import type {Memory,TapeStyle} from '../domain/model'
import {displayMemory} from '../domain/records'
import type {CollectionRecord} from '../domain/records'
import {resolveStyle} from '../domain/styleCatalog'
import MedalArtwork from './medal/MedalArtwork'
import MedalExhibitArtwork from './medal/MedalExhibitArtwork'
import PhotoArtwork from './photo/PhotoArtwork'
import BibArtwork from './bib/BibArtwork'
import NoteArtwork from './note/NoteArtwork'
import RouteArtwork from './route/RouteArtwork'
import DemoRouteArtwork from './route/DemoRouteArtwork'

/** Dispatch only: each item owns its rendering and asset hooks. */
interface ArtworkProps {item:Memory;tapeStyle?:TapeStyle;record?:CollectionRecord;records?:CollectionRecord[];raceGroups?:RaceLocationGroup[]}
function ArtworkContent({item:instance,tapeStyle='classic',record,records=[],raceGroups=[]}:ArtworkProps){
  useTranslation()
  const item=displayMemory(instance,record)
  if(item.exhibit)return <MedalExhibitArtwork item={item} records={records}/>
  if(item.recordId&&!record)return <div className="missing-record paper"><strong>{tr("Artwork.002")}</strong><span>{tr("Artwork.001")}</span></div>
  switch(item.kind){
    case 'sticker':return record?.kind==='sticker'?<StickerArtwork record={record} border={item.stickerBorder} style={item.stickerStyle}/>:null
    case 'race-map':return <RaceMapArtwork item={item} groups={raceGroups}/>
    case 'medal':return <MedalArtwork item={item} record={record}/>
    case 'photo':return <PhotoArtwork item={item} record={record}/>
    case 'bib':return <BibArtwork item={item} tapeStyle={tapeStyle} record={record?.kind==='bib'?record:undefined}/>
    case 'note':return <NoteArtwork item={item}/>
    case 'map':return record?.kind==='route'&&record.source==='upload'?<RouteArtwork record={record} compact={resolveStyle('map',item.variant).compact}/>:<DemoRouteArtwork item={item}/>
  }
}
function Artwork(props:ArtworkProps){
  const {marker,active}=useDeferredArtwork()
  // The hidden marker adds no box: item bounds, pins and selection remain in the canvas.
  return <><span ref={marker} hidden aria-hidden="true" data-artwork-state={active?'active':'deferred'}/>{active&&<ArtworkContent {...props}/>}</>
}
// Camera movement changes the parent transform, not the contents of each keepsake.
export default memo(Artwork)
