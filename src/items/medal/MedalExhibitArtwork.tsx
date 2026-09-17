import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {displayMemory,recordFor} from '../../domain/records'
import {exhibitLayout} from '../../domain/medalExhibit'
import {MedalContent,MedalFrame} from './MedalArtwork'
import './exhibit.css'

export default function MedalExhibitArtwork({item,records}:{item:Memory;records:CollectionRecord[]}){
  const {rows,columns}=exhibitLayout(item.exhibit!.layout)
  return <MedalFrame item={{...item,medalFrame:item.medalFrame==='black'?'black':'wood'}}>
    <div className="medal-exhibit-grid" style={{gridTemplateColumns:`repeat(${columns},1fr)`,gridTemplateRows:`repeat(${rows},1fr)`}}>
      {Array.from({length:rows*columns},(_,index)=>{
        const medal=item.exhibit!.medals[index],record=medal?recordFor(medal,records):undefined
        return <div className={`medal-exhibit-cell ${medal?'':'is-empty'}`} key={medal?.id??index}>{medal&&<MedalContent item={displayMemory(medal,record)} record={record}/>}</div>
      })}
    </div>
  </MedalFrame>
}
