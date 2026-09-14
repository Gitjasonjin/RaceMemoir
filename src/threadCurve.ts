export const DEFAULT_CURVATURE = .06
export function threadCurve(a:{x:number;y:number},b:{x:number;y:number},curvature=DEFAULT_CURVATURE){
  const dx=b.x-a.x,dy=b.y-a.y
  // Choose a stable normal so positive curvature hangs down regardless of click order.
  const direction=dx<0?-1:dx>0?1:dy<0?-1:1
  const bend=curvature*direction
  const control={x:(a.x+b.x)/2-dy*bend*2,y:(a.y+b.y)/2+dx*bend*2}
  return {control,d:`M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`}
}
