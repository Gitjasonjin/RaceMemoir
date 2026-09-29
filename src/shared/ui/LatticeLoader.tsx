import {useEffect,useState} from 'react'
import type {CSSProperties} from 'react'
import './latticeLoader.css'

export type LatticeStatus='working'|'done'|'error'
// Orbit and pixel marks adapted from the supplied React Bits LatticeLoader reference.
const orbit=[0,1,2,7,null,3,6,5,4]
const marks={done:[2,3,5,7],error:[0,2,4,6,8]}

export default function LatticeLoader({status,label,startedAt,endedAt,timerLabel}:{
  status:LatticeStatus;label:string;startedAt:number;endedAt?:number;timerLabel:(seconds:number)=>string
}){
  const [now,setNow]=useState(startedAt)
  useEffect(()=>{
    if(status!=='working')return
    const timer=window.setInterval(()=>setNow(performance.now()),100)
    return()=>window.clearInterval(timer)
  },[status,startedAt])
  const elapsed=Math.max(0,((endedAt??now)-startedAt)/1000)
  return <div className="lattice-loader" data-status={status}>
    <span className="lattice-loader-grid" aria-hidden="true">
      <span className="lattice-loader-run">{orbit.map((step,i)=><span key={i} data-hole={step===null||undefined} style={{'--cell-delay':`${(step??0)*108}ms`} as CSSProperties}/>)}</span>
      <span className="lattice-loader-mark">{orbit.map((_,i)=><span key={i} data-on={status!=='working'&&marks[status].includes(i)||undefined}/>)}</span>
    </span>
    <div className="lattice-loader-copy">
      <strong role="status" aria-live="polite" aria-atomic="true">{label}</strong>
      <span className="lattice-loader-timer" aria-live="off">{timerLabel(elapsed)}</span>
    </div>
  </div>
}
