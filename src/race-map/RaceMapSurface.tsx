import {Component} from 'react'
import type {ReactNode} from 'react'
import type {RaceMapCanvasProps} from './RaceMapCanvas'

import Canvas from './RaceMapCanvas'
class MapBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed
    ? <div className="race-map-error" role="alert">地图资源加载失败，请刷新重试。</div>
    : this.props.children}
}
export default function RaceMapSurface(props:RaceMapCanvasProps){
  return <MapBoundary><Canvas {...props}/></MapBoundary>
}
