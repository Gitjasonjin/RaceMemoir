import type {Camera} from './canvas'
export interface TouchPoint {x:number;y:number}
export function touchPair(a:TouchPoint,b:TouchPoint){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))}}
/** Keep the world point under the initial midpoint under the moving midpoint. */
export function pinchCamera(view:Camera,start:ReturnType<typeof touchPair>,next:ReturnType<typeof touchPair>,min=.05,max=4):Camera{
  const scale=Math.min(max,Math.max(Math.min(min,view.scale),view.scale*next.distance/start.distance))
  return {scale,x:next.x-(start.x-view.x)*scale/view.scale,y:next.y-(start.y-view.y)*scale/view.scale}
}
