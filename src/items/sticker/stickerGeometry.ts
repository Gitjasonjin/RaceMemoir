import type {Memory} from '../../domain/model'

export interface AlphaBounds {x:number;y:number;width:number;height:number}
export function alphaBounds(data:Uint8ClampedArray,width:number,height:number):AlphaBounds|null {
  let left=width,top=height,right=-1,bottom=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  return right<left?null:{x:left,y:top,width:right-left+1,height:bottom-top+1}
}
export function transparentBackground(data:Uint8ClampedArray,width:number,height:number){
  let transparent=0,total=0
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x===0||y===0||x===width-1||y===height-1){total++;if(data[(y*width+x)*4+3]<16)transparent++}
  return transparent>total*.05
}
export function borderPadding(width:number,height:number,border=2){
  return border>0?Math.ceil(Math.max(width,height)*border/100/(1-2*border/100))+1:0
}
export function stickerSize(width:number,height:number,border=2,longEdge=240){
  const padding=borderPadding(width,height,border),w=width+2*padding,h=height+2*padding
  const scale=longEdge/Math.max(w,h)
  return {w:Math.max(30,w*scale),h:Math.max(30,h*scale)}
}
export function resizeSticker(item:Memory,width:number,height:number,border=item.stickerBorder??2,longEdge=Math.max(item.w,item.h)){
  const size=stickerSize(width,height,border,longEdge)
  return {...size,stickerBorder:border,x:item.x+(item.w-size.w)/2,y:item.y+(item.h-size.h)/2}
}
/** Linear-time chamfer distance creates a rounded, antialiased outer contour. */
export function outlineAlpha(alpha:Uint8Array,width:number,height:number,radius:number){
  const distance=new Float32Array(alpha.length),diagonal=Math.SQRT2
  for(let i=0;i<alpha.length;i++)distance[i]=alpha[i]>16?0:1e6
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x
    if(x)distance[i]=Math.min(distance[i],distance[i-1]+1)
    if(y){distance[i]=Math.min(distance[i],distance[i-width]+1);if(x)distance[i]=Math.min(distance[i],distance[i-width-1]+diagonal);if(x+1<width)distance[i]=Math.min(distance[i],distance[i-width+1]+diagonal)}
  }
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x
    if(x+1<width)distance[i]=Math.min(distance[i],distance[i+1]+1)
    if(y+1<height){distance[i]=Math.min(distance[i],distance[i+width]+1);if(x)distance[i]=Math.min(distance[i],distance[i+width-1]+diagonal);if(x+1<width)distance[i]=Math.min(distance[i],distance[i+width+1]+diagonal)}
  }
  return Uint8ClampedArray.from(distance,d=>Math.max(0,Math.min(255,(radius+.5-d)*255)))
}
