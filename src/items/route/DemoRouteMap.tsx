export default function DemoRouteMap({ compact = false }: { compact?: boolean }) {
  return <svg className="route-map" viewBox="0 0 240 245" preserveAspectRatio={compact ? 'xMidYMid slice' : 'xMidYMid meet'} aria-label="模拟越野路线地图">
    <rect width="240" height="245" fill={compact ? '#c1cfb7' : '#e4e5d7'}/>
    {Array.from({length:32},(_,i)=><path key={i} d={`M${-60+i*12} -20Q${135+i*3} ${47+i*2} ${40+i*9} 105T${-10+i*11} 265`} fill="none" stroke={compact ? '#98b098' : '#c2cab7'} strokeWidth={i%4===0 ? 1.4 : .65}/>)}
    {Array.from({length:19},(_,i)=><path key={i} d={`M-10 ${i*16}Q${54+i*2} ${i*16-40} 130 ${i*14}T270 ${i*12}`} fill="none" stroke="#f6f1dd" strokeWidth="1"/>)}
    <path d="M-10 74Q70 30 110 116T250 177" stroke="#a9c7cb" strokeWidth="4" fill="none"/><path d="m20 220 15-60 45-47 10-90m-70 137 120 15 80-90" stroke="#f9f0d7" strokeWidth="6" fill="none"/><path d="m20 220 15-60 45-47 10-90m-70 137 120 15 80-90" stroke="#c7bda2" strokeWidth=".8" strokeDasharray="3 3" fill="none"/>
    <path d="m93 38 12 8 2 17 15 6 9-10 13 17-3 21 19 6-2 21 15 9-6 23 18 14-4 20-26-3-12-15-19 4-10-13-17 18-23-5-9-20-16-6 5-24-11-14 17-20-4-18 16-12 4-13 13-2Z" fill="none" stroke={compact ? '#b84140' : '#365fbb'} strokeWidth="2.6" strokeLinejoin="round"/>
    <circle cx="93" cy="38" r="4" fill={compact ? '#bd4944' : '#406abd'} stroke="white" strokeWidth="2"/><text x="16" y="22" fontSize="8" fill="#606e61">N</text><path d="m19 27-4 13 4-3 4 3Z" fill="#526c5b"/>
  </svg>
}
