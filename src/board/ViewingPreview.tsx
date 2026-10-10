import {useId,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {Dialog} from '@base-ui/react/dialog'
import {X} from 'lucide-react'
import {useTranslation} from 'react-i18next'
import {t as tr} from '../i18n/runtime'
import {hasPin,pinPosition} from '../domain/model'
import type {Memory,PinStyle,TapeStyle} from '../domain/model'
import {displayMemory,recordFor} from '../domain/records'
import type {CollectionRecord} from '../domain/records'
import type {RaceLocationGroup} from '../race-map/raceMapGrouping'
import Artwork from '../items/Artwork'
import Clothespin from '../appearance/Clothespin'
import {racePointOnMap} from './threadEndpoints'
import './viewingPreview.css'

interface ViewingPreviewProps {
  item:Memory|null
  records:CollectionRecord[]
  raceGroups:RaceLocationGroup[]
  pinStyle?:PinStyle
  tapeStyle?:TapeStyle
  onClose:()=>void
}

function kindLabel(item:Memory){
  if(item.exhibit)return tr('App.027')
  return tr(({sticker:'App.026',photo:'App.025',medal:'App.024',bib:'App.023',note:'App.022','race-map':'App.021',map:'App.020'} as const)[item.kind])
}

/** Keep the original proportions and physical finishes while fitting the available space. */
function PreviewArtwork({item,records,raceGroups,title,pinStyle,tapeStyle}:{item:Memory;records:CollectionRecord[];raceGroups:RaceLocationGroup[];title:string;pinStyle:PinStyle;tapeStyle:TapeStyle}){
  const stage=useRef<HTMLDivElement>(null),uid=useId().replace(/[^a-zA-Z0-9_-]/g,'')
  const [space,setSpace]=useState({width:0,height:0})
  const preview=useMemo(()=>({
    ...item,id:`viewing-${uid}-${item.id}`,x:0,y:0,rotation:0,
    ...(item.exhibit?{exhibit:{...item.exhibit,medals:item.exhibit.medals.map(medal=>({...medal,id:`viewing-${uid}-${medal.id}`,rotation:0}))}}:{}),
  }),[item,uid])
  const local={...item,x:0,y:0,rotation:0}
  const pin=item.pinStyle??pinStyle,pinned=hasPin(item),anchor=pinPosition(local,pinStyle)
  // Clothespins extend above the paper; include them in the fitted bounds.
  const topOutset=pinned?(pin==='clip'?34:pin==='spool'?12:0):0
  useLayoutEffect(()=>{
    const element=stage.current
    if(!element)return
    const measure=()=>{
      const style=getComputedStyle(element)
      const width=Math.max(0,element.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight))
      const height=Math.max(0,element.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom))
      setSpace(previous=>previous.width===width&&previous.height===height?previous:{width,height})
    }
    measure()
    if(typeof ResizeObserver!=='undefined'){
      const observer=new ResizeObserver(measure)
      observer.observe(element)
      return()=>observer.disconnect()
    }
    window.addEventListener('resize',measure)
    return()=>window.removeEventListener('resize',measure)
  },[])
  const ready=space.width>0&&space.height>0
  const scale=ready?Math.min(space.width/item.w,space.height/(item.h+topOutset)):1
  return <div ref={stage} className="viewing-preview-stage">
    <div className="viewing-preview-fit" role="img" aria-label={title} style={{width:item.w*scale,height:(item.h+topOutset)*scale,visibility:ready?'visible':'hidden'}}>
      <div className={`viewing-preview-artwork memory-${item.kind} ${item.exhibit?'memory-exhibit':''}`} inert aria-hidden="true" style={{width:item.w,height:item.h,top:topOutset*scale,transform:`scale(${scale})`}}>
        {/* Outside data-board-item, deferred artwork activates immediately. Each SVG renderer owns its useId namespace. */}
        <Artwork item={preview} record={recordFor(item,records)} records={records} raceGroups={raceGroups} tapeStyle={item.tapeStyle??tapeStyle}/>
        {pinned&&<i className={`pushpin viewing-preview-pin pin-${pin}`} style={{left:anchor.x,top:anchor.y}}>{pin==='clip'&&<Clothespin/>}</i>}
        {item.kind==='race-map'&&raceGroups.map(group=>{
          const race=group.races[0],point=race?racePointOnMap(local,race):null
          return point?<i key={group.key} className={`pushpin map-place-pin viewing-preview-pin pin-${pin}`} style={{left:point.x,top:point.y}}>{pin==='clip'&&<Clothespin/>}</i>:null
        })}
      </div>
    </div>
  </div>
}

export default function ViewingPreview({item,records,raceGroups,pinStyle='classic',tapeStyle='classic',onClose}:ViewingPreviewProps){
  useTranslation()
  const close=useRef<HTMLButtonElement>(null)
  const record=item?recordFor(item,records):undefined
  const kind=item?kindLabel(item):''
  const title=item?(record?.name||displayMemory(item,record).title||kind):tr('viewing.previewTitle')
  return <Dialog.Root open={item!==null} onOpenChange={open=>{if(!open)onClose()}}>
    <Dialog.Portal>
      <Dialog.Backdrop className="ui-dialog-backdrop viewing-preview-backdrop" data-board-share/>
      <Dialog.Viewport className="ui-dialog-viewport viewing-preview-viewport" data-board-share>
        <Dialog.Popup className="modal viewing-preview-modal" data-ui-overlay initialFocus={close}>
          <div className="viewing-preview-header">
            <div className="viewing-preview-heading">
              <div className="viewing-preview-eyebrow">{tr('viewing.previewTitle')}{kind&&<span>{kind}</span>}</div>
              <Dialog.Title render={<h2/>}>{title}</Dialog.Title>
            </div>
            <Dialog.Close ref={close} className="viewing-preview-close" aria-label={tr('viewing.closePreview')}><X size={20}/></Dialog.Close>
          </div>
          {item&&<PreviewArtwork key={item.id} item={item} records={records} raceGroups={raceGroups} title={title} pinStyle={pinStyle} tapeStyle={tapeStyle}/>}
          <Dialog.Description className="viewing-preview-hint">{tr('viewing.previewHint')}</Dialog.Description>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}
