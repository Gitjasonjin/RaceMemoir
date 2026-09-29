import {AppError} from '../../i18n/runtime.ts'
export interface Pixels { width:number; height:number; data:Uint8ClampedArray }
export function restoreMedalPixels(original:Pixels,mask:Pixels){
  if(original.width!==mask.width||original.height!==mask.height)throw new AppError("medalPixels.001")
  const data=original.data.slice()
  for(let i=3;i<data.length;i+=4)data[i]=Math.min(original.data[i],mask.data[i])
  return data
}
export function medalBounds(image:Pixels){
  let left=image.width,top=image.height,right=-1,bottom=-1
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
  if(right<left)return {x:0,y:0,width:image.width,height:image.height}
  return {x:left,y:top,width:right-left+1,height:bottom-top+1}
}
