import {elevationArea} from './elevationArea'

export default function ElevationProfile({path,demo=false}:{path:string;demo?:boolean}){
  return <svg className="real-route-elevation" viewBox="0 0 240 80" preserveAspectRatio="none" aria-label={demo?'示例海拔面积图':'海拔面积图'}>
    <path d="M10 15H230M10 40H230M10 65H230" stroke="#153d31" strokeOpacity=".16" strokeWidth=".5"/>
    <path className="route-elevation-area" d={elevationArea(path)} fill="#537760" fillOpacity=".7"/>
    <path d={path} fill="none" stroke="#153d31" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
}
