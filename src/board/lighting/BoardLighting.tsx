import {useId,useState} from 'react'
import './lighting.css'

const STORAGE_KEY='racememoir-lamp-enabled'
export function useBoardLight(){
  const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(STORAGE_KEY)==='true'}catch{return false}})
  const toggle=()=>setEnabled(current=>{
    const next=!current
    try{localStorage.setItem(STORAGE_KEY,String(next))}catch{/* Keep the switch usable when storage is unavailable. */}
    return next
  })
  return {enabled,toggle}
}

export function PendantLamp(){
  const id=useId().replaceAll(':','')
  return <svg className="pendant-lamp" viewBox="0 0 600 54" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#575b5d"/><stop offset=".12" stopColor="#303437"/><stop offset=".44" stopColor="#1c2022"/><stop offset=".8" stopColor="#0d1012"/><stop offset="1" stopColor="#24282a"/></linearGradient>
      <linearGradient id={`${id}-cap`}><stop stopColor="#141719"/><stop offset=".5" stopColor="#393e41"/><stop offset="1" stopColor="#121517"/></linearGradient>
      <linearGradient id={`${id}-edge`}><stop stopColor="#a2a9ac00"/><stop offset=".24" stopColor="#a2a9ac66"/><stop offset=".66" stopColor="#a2a9ac26"/><stop offset="1" stopColor="#a2a9ac00"/></linearGradient>
      <linearGradient id={`${id}-diffuser`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b0a687"/><stop offset=".3" stopColor="#fff6d5"/><stop offset=".65" stopColor="#fffbe8"/><stop offset="1" stopColor="#c9b483"/></linearGradient>
      <filter id={`${id}-glow`} x="-10%" y="-150%" width="120%" height="400%"><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    <path d="M103 0h27v20h-27ZM470 0h27v20h-27Z" fill={`url(#${id}-cap)`}/>
    <path d="M106 1v16M473 1v16" stroke="#7b808366" strokeWidth="1"/>
    <path d="M101 0h31M468 0h31" stroke="#0a0d0e" strokeWidth="3"/>
    <path d="M13 12H587Q593 12 593 18V32Q593 36 589 38L579 41H21L11 38Q7 36 7 32V18Q7 12 13 12Z" fill={`url(#${id}-body)`}/>
    <path d="M20 13H580" stroke={`url(#${id}-edge)`} strokeWidth=".8"/>
    <path d="M17 32H583L574 41H26Z" fill="#0c1011"/>
    <path d="M25 34H575L570 38H30Z" fill="#7e7b6b"/>
    <path className="lamp-reflector" d="M25 34H575L570 38H30Z" fill={`url(#${id}-diffuser)`}/>
    <path className="lamp-bulb" d="M31 38H569" stroke="#fff0c0" strokeWidth="2" filter={`url(#${id}-glow)`}/>
    <path d="M26 41H574" stroke="#55564b" strokeWidth=".6"/>
    <path d="M15 17v14M585 17v14" stroke="#05080940" strokeWidth=".5"/>

  </svg>
}

export function BoardLightWash(){return <div className="board-light-wash" aria-hidden="true"><div className="board-light-ambient"/><div className="board-light-pool"/></div>}

export default function BoardLighting(){
  return <div className="board-light-fixtures"><PendantLamp/></div>
}
