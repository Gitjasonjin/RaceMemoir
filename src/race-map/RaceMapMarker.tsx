interface Props {
  x: number; y: number; name: string; count: number; scale: number
  selected?: boolean; onClick?: () => void
}
export default function RaceMapMarker({x,y,name,count,scale,selected,onClick}: Props) {
  return <g className={`race-marker ${selected ? 'is-selected' : ''}`} transform={`translate(${x},${y}) scale(${1/scale})`}
    role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
    aria-label={`${name}，${count} 场赛事`} aria-pressed={onClick ? !!selected : undefined}
    onClick={e => {e.stopPropagation();onClick?.()}}
    onKeyDown={e => {if (onClick && (e.key === 'Enter' || e.key === ' ')) {e.preventDefault();e.stopPropagation();onClick()}}}>
    <title>{name} · {count} 场赛事</title>
    <ellipse className="race-circle-hit" rx="34" ry="27"/>
    <ellipse className="race-circle" rx="29" ry="20" transform="rotate(-9)"/>
    <ellipse className="race-circle race-circle-secondary" cx="1.5" cy="-1" rx="31" ry="18" transform="rotate(6)"/>
    <text className="race-map-label" x="38" y="5">{name.length>12 ? `${name.slice(0,12)}…` : name}{count>1 ? ` ×${count}` : ''}</text>
  </g>
}
