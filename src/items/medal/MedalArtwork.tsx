import type {CSSProperties} from 'react'
import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {resolveMedalFrame} from '../../domain/styleCatalog'
import {useMedalImage} from './useMedalImage'
import DemoMedal from './DemoMedal'

export default function MedalArtwork({item,record}:{item:Memory;record?:CollectionRecord}){
  const {url:imageUrl}=useMedalImage(record?.kind==='medal'?record.originalImage:undefined,record?.kind==='medal'?record.image:undefined)
    const frame=resolveMedalFrame(item.medalFrame).id,depth=(item.shadowDepth??50)/50
    const shadow={'--frame-shadow':`${4*depth}px ${9*depth}px ${12*depth}px #35251f66`,'--medal-shadow':`drop-shadow(${2*depth}px ${4*depth}px ${3*depth}px rgb(0 0 0 / ${depth===0?0:.55}))`} as CSSProperties
    return <div className={`medal-frame medal-frame-${frame}`} style={shadow}><div className="frame-mat"><div className="frame-backing">{record?.source==='upload'?<img className="real-medal" style={{transform:`scale(${item.medalScale??1})`}} src={imageUrl||undefined} alt={record.name} draggable={false}/>:<DemoMedal item={item}/>}</div></div>{frame==='hook'&&<svg className="medal-hook" viewBox="0 0 32 52" aria-hidden="true"><rect x="8" y="1" width="16" height="25" rx="7" fill="#a5aaa6" stroke="#525c57"/><circle cx="16" cy="8" r="2.5" fill="#4d5550"/><path d="M16 16v21c0 12 13 12 13 1v-5" fill="none" stroke="#4d5550" strokeWidth="6" strokeLinecap="round"/><path d="M15 16v21c0 10 12 11 12 0v-4" fill="none" stroke="#d9dcd4" strokeWidth="3" strokeLinecap="round"/></svg>}{frame!=='hook'&&<span className="frame-glass" aria-hidden="true"/>}</div>
}
