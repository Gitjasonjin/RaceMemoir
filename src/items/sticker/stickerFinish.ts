import {outlineAlpha} from './stickerGeometry.ts'

function noise(x:number,y:number){
  let hash=Math.imul(x+17,374761393)^Math.imul(y+53,668265263)
  hash=Math.imul(hash^(hash>>>13),1274126177)
  return (hash>>>0)/4294967295*2-1
}
function softNoise(x:number,y:number){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy)
  return (noise(ix,iy)*(1-sx)+noise(ix+1,iy)*sx)*(1-sy)+(noise(ix,iy+1)*(1-sx)+noise(ix+1,iy+1)*sx)*sy
}

/** Follow the subject with a confident stroke; slight pressure changes replace repetitive waves. */
export function sketchContour(alpha:Uint8Array,width:number,height:number,radius:number){
  const scale=Math.max(width,height),stroke=Math.min(radius*.6,Math.max(1.4,scale*.009))
  const offset=(x:number,y:number)=>radius*.61+radius*.035*softNoise(x/scale*9,y/scale*9)
  const pressure=(x:number,y:number)=>stroke*(1+.12*softNoise(x/scale*17+31,y/scale*17+47))
  const outer=outlineAlpha(alpha,width,height,radius,(x,y)=>offset(x,y)+pressure(x,y)/2)
  const inner=outlineAlpha(alpha,width,height,radius,(x,y)=>Math.max(0,offset(x,y)-pressure(x,y)/2))
  return Uint8ClampedArray.from(outer,(value,i)=>Math.max(0,value-inner[i]))
}

/** Warm translucent fibres affect only the derived print, never the source asset. */
export function applyWashiFinish(pixels:Uint8ClampedArray,width:number,height:number){
  const scale=Math.max(1,Math.max(width,height)/450)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;if(!pixels[i+3])continue
    const u=(x*.86+y*.51)/scale,v=(-x*.51+y*.86)/scale
    const pulp=softNoise(x/scale/9,y/scale/9)
    const fibreA=Math.max(0,softNoise(u/6,v/1.1)-.2)
    const fibreB=Math.max(0,softNoise((x*.35-y*.94)/scale/5,(x*.94+y*.35)/scale/1.2)-.2)
    const fibre=(fibreA*.65+fibreB*.55)*1.8
    const fleck=noise(Math.floor(x/scale),Math.floor(y/scale))
    const grain=pulp*8+fibre*17+fleck*4
    for(let c=0;c<3;c++)pixels[i+c]=pixels[i+c]*.84+[247,239,215][c]*.16+grain
    pixels[i+3]=Math.round(pixels[i+3]*Math.min(.97,.86+fibre*.065+pulp*.018))
  }
  return pixels
}
