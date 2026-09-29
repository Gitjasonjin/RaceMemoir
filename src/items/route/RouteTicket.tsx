import type {ReactNode} from 'react'

interface Props {
  title:string;note?:string;date?:string;compact?:boolean;demo?:boolean
  distance:string;ascent?:string;altitude?:string;map:ReactNode;elevation?:ReactNode
}

/** Shared hard-card surface; the route data and sample map stay independent. */
export default function RouteTicket({title,note,date,compact=false,demo=false,distance,ascent,altitude,map,elevation}:Props){
  return <div className={`route-ticket real-route ${compact?'route-compact':''}`}>
    <div className="route-ticket-surface">
      <header className="route-ticket-header">
        <span className="route-ticket-kicker">TRAIL ARCHIVE <span>{demo?'示例路线':'GPX'}</span></span>
        <strong className="real-route-title">{title}</strong>
        <svg className="route-ticket-mountains" viewBox="0 0 110 42" aria-hidden="true"><path d="M0 42 28 10 41 25 61 0 110 42Z" fill="currentColor"/><path d="m18 23 10-13 13 15-12-6-4 6m25-11L61 0l21 18-17-9-6 8" fill="#ed702e"/></svg>
      </header>
      <div className="route-ticket-body">
        <div className="route-ticket-map">{map}</div>
        <div className="real-route-stats">
          <div><small>赛道距离</small><strong>{distance}<em>km</em></strong></div>
          {ascent!==undefined&&<div><small>累计爬升</small><strong>+{ascent}<em>m</em></strong></div>}
        </div>
        {!compact&&elevation&&<div className="route-ticket-profile">{elevation}{altitude&&<small className="route-altitude">海拔 {altitude}</small>}</div>}
      </div>
      <footer className="route-ticket-stub"><span>RACE MEMOIR{date&&<time>{date}</time>}</span><div className="route-note handwritten">{note||'每一步，都算数。'}</div></footer>
      <div className="route-ticket-grain" aria-hidden="true"/>
    </div>
  </div>
}
