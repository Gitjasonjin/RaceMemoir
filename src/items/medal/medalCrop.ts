export interface MedalCrop {x:number;y:number;width:number;height:number}
export const FULL_MEDAL_CROP:MedalCrop={x:0,y:0,width:1,height:1}
export function validMedalCrop(value:unknown):value is MedalCrop{
  if(!value||typeof value!=='object')return false
  const c=value as MedalCrop
  return [c.x,c.y,c.width,c.height].every(Number.isFinite)&&c.x>=0&&c.y>=0&&c.width>=.01-1e-9&&c.height>=.01-1e-9&&c.x+c.width<=1.000001&&c.y+c.height<=1.000001
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
export type CropHandle='move'|'nw'|'ne'|'sw'|'se'
export function dragMedalCrop(c:MedalCrop,handle:CropHandle,dx:number,dy:number):MedalCrop{
  if(handle==='move')return {...c,x:clamp(c.x+dx,0,1-c.width),y:clamp(c.y+dy,0,1-c.height)}
  let left=c.x,top=c.y,right=c.x+c.width,bottom=c.y+c.height
  if(handle.includes('w'))left=clamp(left+dx,0,right-.01)
  if(handle.includes('e'))right=clamp(right+dx,left+.01,1)
  if(handle.includes('n'))top=clamp(top+dy,0,bottom-.01)
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+.01,1)
  return {x:left,y:top,width:right-left,height:bottom-top}
}
