import {t as tr} from '../../i18n/runtime.ts'
import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {displayMemory,recordFor} from '../../domain/records'
import {exhibitLayout,exhibitSlots} from '../../domain/medalExhibit'
import {Plus} from 'lucide-react'
import {MedalContent,MedalFrame} from './MedalArtwork'
import './exhibit.css'

export default function MedalExhibitArtwork({item,records,onAdd}:{item:Memory;records:CollectionRecord[];onAdd?:(slot:number)=>void}){
  const {rows,columns}=exhibitLayout(item.exhibit!.layout)
  const slots=exhibitSlots(item.exhibit!)
  return <MedalFrame item={{...item,medalFrame:item.medalFrame==='black'?'black':'wood'}}>
    <div className="medal-exhibit-grid" style={{gridTemplateColumns:`repeat(${columns},1fr)`,gridTemplateRows:`repeat(${rows},1fr)`}}>
      {Array.from({length:rows*columns},(_,index)=>{
        const medal=item.exhibit!.medals[slots.indexOf(index)],record=medal?recordFor(medal,records):undefined
        return <div className={`medal-exhibit-cell ${medal?'':'is-empty'}`} key={index}>{medal?<MedalContent item={displayMemory(medal,record)} record={record}/>:onAdd&&<button type="button" className="exhibit-add-slot" aria-label={tr("MedalExhibitArtwork.001",{v1:index+1})} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onAdd(index)}}><Plus aria-hidden="true"/><span>{tr("ToolPalette.010")}</span></button>}</div>
      })}
    </div>
  </MedalFrame>
}
