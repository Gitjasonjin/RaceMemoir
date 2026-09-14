import { useId } from 'react'
import type { Memory, TapeStyle } from './model'

export function MountainLogo({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 44" fill="currentColor" aria-hidden="true"><path d="M0 42 25 6l10 14L43 8l21 34H0Z"/><path fill="#f6f3e9" d="m16 28 9-13 10 15-8-5-4 6-4-6Zm23-3 4-7 7 12-7-5-3 4Z"/></svg>
}
function Trees({ color = 'currentColor' }: { color?: string }) {
  return <svg viewBox="0 0 100 58" fill={color} aria-hidden="true"><path d="m13 5-8 16h5L0 37h10v14h6V37h10L16 21h5ZM40 0 30 21h6L24 41h12v16h7V41h14L44 21h6ZM71 17 65 29h4L60 44h9v11h5V44h9L74 29h4ZM91 28l-5 11h3l-7 12h7v7h5v-7h6l-7-12h3Z"/></svg>
}
function Medal({ item }: { item: Memory }) {
  const uid = useId().replace(/:/g, '')
  const silver = item.variant === 'silver'
  const light = silver ? '#e3e5df' : '#e5bc7b', mid = silver ? '#898d8b' : '#9b713c', dark = silver ? '#454a4a' : '#4b3725'
  return <div className={`medal-art ${silver ? 'silver' : ''}`}><div className="ribbon"><MountainLogo/><span>{silver ? 'PINE TRAIL' : 'INTO THE WILD'}</span></div><svg className="medal-svg" viewBox="0 0 240 254" aria-label={item.title}>
    <defs><linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={light}/><stop offset=".28" stopColor={dark}/><stop offset=".48" stopColor={mid}/><stop offset=".7" stopColor={dark}/><stop offset="1" stopColor={light}/></linearGradient><linearGradient id={`${uid}-edge`} x2=".9" y2="1"><stop stopColor={light}/><stop offset=".5" stopColor={mid}/><stop offset="1" stopColor={light}/></linearGradient><filter id={`${uid}-grain`}><feTurbulence baseFrequency=".4" numOctaves="3" seed="3" result="noise"/><feComposite in="noise" in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>
    <rect x="92" y="2" width="56" height="21" rx="5" fill={dark} stroke={mid} strokeWidth="5"/><rect x="99" y="1" width="42" height="10" rx="2" fill="#252d28"/>
    <path d={silver ? 'M120 18C180 18 224 67 224 131S183 239 120 239 16 196 16 132 60 18 120 18Z' : 'm120 18 23 11 21-4 15 20 24 7 7 25 18 19-6 28 9 21-17 22-6 25-26 9-18 22-26-1-18 18-24-14-24 2-19-21-26-8-5-24-18-20 8-26-6-25 20-17 8-25 26-6 15-18 22 3Z'} fill={`url(#${uid}-metal)`} stroke={`url(#${uid}-edge)`} strokeWidth="5" filter={`url(#${uid}-grain)`}/>
    {silver && <><circle cx="120" cy="129" r="95" fill="none" stroke={light} strokeWidth="2"/><circle cx="120" cy="129" r="88" fill="none" stroke={mid} strokeWidth="2"/></>}
    <path d="m30 126 37-45 14 13 36-56 27 34 10-10 50 66-29-16-19-29-6 18-25-45-11 38-13-8-30 33-10-18-19 25Z" fill={dark} stroke={light} strokeWidth="2"/>
    <path d="m117 42-5 32-13 15 5 12-15 24m34-71 3 41 17 17-8-25m-68-1-5 28-15 16m108-65 5 31 18 22" fill="none" stroke={mid} strokeWidth="3"/>
    {[40,59,79,156,177,194].map((x,i)=><g key={x} transform={`translate(${x},${111 - i%3*5}) scale(.65)`}><path d="m0-18-9 15h5L-14 9h9L-18 24h15v10h6V24h15L5 9h9L4-3h5Z" fill={dark} stroke={mid} strokeWidth="1.5"/></g>)}
    <path d="M42 145q78 18 156 0" fill="none" stroke={mid} strokeWidth="2"/>
    <text x="120" y="172" textAnchor="middle" fill={light} fontFamily="Georgia,serif" fontWeight="bold" fontSize={silver ? 21 : 27}>{item.title}</text><text x="120" y="194" textAnchor="middle" fill={light} fontSize="14" letterSpacing="4">{silver ? '30K · FINISHER' : 'FINISHER'}</text><text x="120" y="211" textAnchor="middle" fill={mid} fontSize="7" letterSpacing="2">THE TRAIL NEVER ENDS</text>
  </svg></div>
}
function RouteMap({ compact = false }: { compact?: boolean }) {
  return <svg className="route-map" viewBox="0 0 240 245" preserveAspectRatio={compact ? 'xMidYMid slice' : 'xMidYMid meet'} aria-label="模拟越野路线地图">
    <rect width="240" height="245" fill={compact ? '#c1cfb7' : '#e4e5d7'}/>
    {Array.from({length:32},(_,i)=><path key={i} d={`M${-60+i*12} -20Q${135+i*3} ${47+i*2} ${40+i*9} 105T${-10+i*11} 265`} fill="none" stroke={compact ? '#98b098' : '#c2cab7'} strokeWidth={i%4===0 ? 1.4 : .65}/>)}
    {Array.from({length:19},(_,i)=><path key={i} d={`M-10 ${i*16}Q${54+i*2} ${i*16-40} 130 ${i*14}T270 ${i*12}`} fill="none" stroke="#f6f1dd" strokeWidth="1"/>)}
    <path d="M-10 74Q70 30 110 116T250 177" stroke="#a9c7cb" strokeWidth="4" fill="none"/><path d="m20 220 15-60 45-47 10-90m-70 137 120 15 80-90" stroke="#f9f0d7" strokeWidth="6" fill="none"/><path d="m20 220 15-60 45-47 10-90m-70 137 120 15 80-90" stroke="#c7bda2" strokeWidth=".8" strokeDasharray="3 3" fill="none"/>
    <path d="m93 38 12 8 2 17 15 6 9-10 13 17-3 21 19 6-2 21 15 9-6 23 18 14-4 20-26-3-12-15-19 4-10-13-17 18-23-5-9-20-16-6 5-24-11-14 17-20-4-18 16-12 4-13 13-2Z" fill="none" stroke={compact ? '#b84140' : '#365fbb'} strokeWidth="2.6" strokeLinejoin="round"/>
    <circle cx="93" cy="38" r="4" fill={compact ? '#bd4944' : '#406abd'} stroke="white" strokeWidth="2"/><text x="16" y="22" fontSize="8" fill="#606e61">N</text><path d="m19 27-4 13 4-3 4 3Z" fill="#526c5b"/>
  </svg>
}
export default function Artwork({ item, tapeStyle = 'classic' }: { item: Memory; tapeStyle?: TapeStyle }) {
  if (item.kind === 'medal') return <div className="medal-frame"><div className="frame-mat"><div className="frame-backing"><Medal item={item}/></div></div><span className="frame-glass" aria-hidden="true"/></div>
  if (item.kind === 'photo') return <div className={`photo paper ${item.variant === 'landscape' ? 'landscape' : 'polaroid'}`}><div className="photo-image"><img src={item.image} alt={item.title} draggable={false}/>{item.variant === 'landscape' && <div className="photo-caption handwritten">{item.title}</div>}</div>{item.variant !== 'landscape' && <div className="photo-footer handwritten"><span>{item.title}</span><small>{item.subtitle}</small></div>}</div>
  if (item.kind === 'bib') return <div className={`bib paper ${item.variant === 'blue' ? 'blue' : ''}`}><i className={`tape tape-left tape-${tapeStyle}`}/><i className={`tape tape-right tape-${tapeStyle}`}/><div className="bib-brand"><MountainLogo/><strong>{item.title}</strong><span>RUN<br/>HIGHER<br/>FURTHER</span></div><div className="bib-number">{item.number}</div><div className="bib-tagline">{item.variant === 'blue' ? 'SMALL STEPS, BIG MOUNTAINS' : 'MOUNTAINS MAKE A KINDER YOU'}</div><div className="bib-trees"><Trees/><MountainLogo/><Trees/></div></div>
  if (item.kind === 'note') return <div className={`note ${item.variant === 'paper' ? 'white-note paper' : 'yellow-note'}`}><div className="handwritten">{item.title}</div>{item.variant !== 'paper' && <span className="smiley">◡</span>}</div>
  return <div className={`map-paper paper ${item.variant === 'green' ? 'compact' : ''}`}>
    {item.variant !== 'green' && <div className="map-heading handwritten">50 km / +2,800 m</div>}<div className="map-content"><RouteMap compact={item.variant === 'green'}/>{item.variant !== 'green' && <div className="map-stats">最高海拔<strong>3,082 m</strong><br/>最低海拔<strong>482 m</strong></div>}{item.variant === 'green' && <span className="gpx">GPX</span>}</div>
    {item.variant !== 'green' && <svg className="elevation" viewBox="0 0 220 65"><defs><linearGradient id="altitude" x2="0" y2="1"><stop stopColor="#5678c5" stopOpacity=".35"/><stop offset="1" stopColor="#5678c5" stopOpacity="0"/></linearGradient></defs><path d="m0 53 11-4 6 1 12-11 6 3 12-18 8 12 8-4 8 9 6-5 10 2 12-29 7 5 7-11 7 11 6-3 10 21 8-4 13 12 10-5 12 13 8-3 8 5 8-8 5 5 10-1v15H0Z" fill="url(#altitude)" stroke="#4164a3" strokeWidth="1.3"/><path d="M0 10V58H220M0 39H220M0 20H220" stroke="#a7a89e" opacity=".5" strokeWidth=".5"/></svg>}
    <div className="map-caption handwritten">{item.title}<small>{item.variant !== 'green' && `— ${item.subtitle}`}</small></div>
  </div>
}
