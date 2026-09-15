import {useId} from 'react'
import type {Memory} from '../../domain/model'
import {resolveStyle} from '../../domain/styleCatalog'
import MountainLogo from '../../shared/MountainLogo'

export default function DemoMedal({ item }: { item: Memory }) {
  const uid = useId().replace(/:/g, '')
  const silver = resolveStyle('medal',item.variant).silver
  const light = silver ? '#e3e5df' : '#e5bc7b', mid = silver ? '#898d8b' : '#9b713c', dark = silver ? '#454a4a' : '#4b3725'
  return <div style={{transform:`scale(${item.medalScale??1})`}} className={`medal-art ${silver ? 'silver' : ''}`}><div className="ribbon"><MountainLogo/><span>{silver ? 'PINE TRAIL' : 'INTO THE WILD'}</span></div><svg className="medal-svg" viewBox="0 0 240 254" aria-label={item.title}>
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
