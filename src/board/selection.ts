import type { Memory } from '../domain/model'
import type { Bounds } from './canvas'

export function selectionBounds(x:number,y:number,endX:number,endY:number):Bounds {
  return {x:Math.min(x,endX),y:Math.min(y,endY),width:Math.abs(endX-x),height:Math.abs(endY-y)}
}

/** Rectangle intersection using separating axes, including rotated objects. */
export function intersectsSelection(item:Memory,box:Bounds){
  const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a)
  const dx=item.x+item.w/2-box.x-box.width/2,dy=item.y+item.h/2-box.y-box.height/2
  return [[1,0],[0,1],[c,s],[-s,c]].every(([x,y])=>
    Math.abs(dx*x+dy*y)<=box.width/2*Math.abs(x)+box.height/2*Math.abs(y)+item.w/2*Math.abs(c*x+s*y)+item.h/2*Math.abs(-s*x+c*y))
}
