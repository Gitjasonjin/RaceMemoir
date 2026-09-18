import {useState} from 'react'
import {resolveBackground} from '../domain/styleCatalog'
import type {Camera} from './canvas'

const BUFFER=256
/** Pan a prepainted, bounded texture layer. Rebase outside the buffer without changing its world phase. */
export default function CanvasBackground({id,view}:{id?:string;view:Camera}){
  const material=resolveBackground(id)
  const [origin,setOrigin]=useState(view)
  let base=origin
  if(origin.scale!==view.scale||Math.abs(view.x-origin.x)>BUFFER||Math.abs(view.y-origin.y)>BUFFER){base=view;setOrigin(view)}
  const height='tileHeight' in material?material.tileHeight:material.tileSize
  return <div className="board-material" aria-hidden="true" style={{backgroundColor:material.color}}>
    <div className="board-material-texture" style={{inset:-BUFFER,backgroundImage:`url("${material.texture}")`,backgroundSize:`${material.tileSize*view.scale}px ${height*view.scale}px`,backgroundPosition:`${base.x+BUFFER}px ${base.y+BUFFER}px`,transform:`translate3d(${view.x-base.x}px,${view.y-base.y}px,0)`}}/>
    <div className="board-material-light" style={{backgroundImage:material.light}}/>
  </div>
}
