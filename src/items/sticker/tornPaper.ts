import {outlineAlpha} from './stickerGeometry.ts'

/** Roughen the expanded subject silhouette, never fill its rectangular bounding box. */
export function tornContourAlpha(alpha:Uint8Array,width:number,height:number,radius:number){
  if(radius<=0)return Uint8ClampedArray.from(alpha)
  const grain=Math.max(1,Math.max(width,height)/220),roughness=radius*.65
  const noise=(gx:number,gy:number)=>{
    let hash=Math.imul(gx+17,374761393)^Math.imul(gy+53,668265263)
    hash=Math.imul(hash^(hash>>>13),1274126177)
    return (hash>>>0)/4294967295*2-1
  }
  const smoothNoise=(u:number,v:number)=>{
    const gx=Math.floor(u),gy=Math.floor(v)
    const sx=(u-gx)**2*(3-2*(u-gx)),sy=(v-gy)**2*(3-2*(v-gy))
    return (noise(gx,gy)*(1-sx)+noise(gx+1,gy)*sx)*(1-sy)+(noise(gx,gy+1)*(1-sx)+noise(gx+1,gy+1)*sx)*sy
  }
  const result=outlineAlpha(alpha,width,height,radius,(x,y)=>{
    const coarse=smoothNoise(x/(grain*6),y/(grain*6))
    // Interpolate the fine fibres so abrupt cell boundaries cannot create tiny spikes.
    const fibre=smoothNoise(x/(grain*1.5),y/(grain*1.5))
    return radius+roughness*(coarse*.9+fibre*.12)
  })
  for(let i=0;i<result.length;i++)result[i]=Math.max(result[i],alpha[i])
  return result
}
