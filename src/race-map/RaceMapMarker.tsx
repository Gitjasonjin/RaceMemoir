import {t as tr} from '../i18n/runtime.ts'
interface Props {
  x: number; y: number; name: string; count: number; scale: number
  groupKey?:string; selected?: boolean; onClick?: () => void
}
export default function RaceMapMarker({x,y,name,count,scale,selected,onClick,groupKey}: Props) {
  return <g data-map-group={groupKey} className={`race-marker ${selected ? 'is-selected' : ''}`} transform={`translate(${x},${y}) scale(${1/scale})`}
    role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
    aria-label={tr("RaceMapMarker.002",{v1:name,v2:count})} aria-pressed={onClick ? !!selected : undefined}
    onClick={e => {e.stopPropagation();onClick?.()}}
    onKeyDown={e => {if (onClick && (e.key === 'Enter' || e.key === ' ')) {e.preventDefault();e.stopPropagation();onClick()}}}>
    <title>{tr("RaceMapMarker.001",{v1:name,v2:count})}</title>
    <ellipse className="race-circle-hit" rx="34" ry="27"/>
    <ellipse className="race-circle" rx="29" ry="20" transform="rotate(-9)"/>
    <ellipse className="race-circle race-circle-secondary" cx="1.5" cy="-1" rx="31" ry="18" transform="rotate(6)"/>
    <text className="race-map-label" x="38" y="5">{name.length>12 ? `${name.slice(0,12)}…` : name}{count>1 ? ` ×${count}` : ''}</text>
  </g>
}
