// Keep ample room for an unbounded canvas while preserving usable numeric precision.
export const MAX_WORLD_COORDINATE=1_000_000_000
export const MAX_ROTATION=360_000
// Below any fit scale needed for the accepted world range, yet safe for division.
export const MIN_CAMERA_SCALE=1e-12
export function isSafeGeometry(item:{x:number;y:number;w:number;h:number;rotation:number}){
  return [item.x,item.y].every(value=>Number.isFinite(value)&&Math.abs(value)<=MAX_WORLD_COORDINATE)&&
    [item.w,item.h].every(value=>Number.isFinite(value)&&value>0&&value<=MAX_WORLD_COORDINATE)&&
    Number.isFinite(item.rotation)&&Math.abs(item.rotation)<=MAX_ROTATION
}
export function rotationRadians(degrees:number){return (degrees%360)*Math.PI/180}
