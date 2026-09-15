export interface PixelImage { width: number; height: number; data: Uint8ClampedArray }
export interface BrushPoint { x: number; y: number }
export type RepairMode = 'restore' | 'erase'

/** Paint a continuous capsule, restoring original pixels rather than inventing ribbon colors. */
export function paintRibbonStroke(target: PixelImage, original: PixelImage, from: BrushPoint, to: BrushPoint, radius: number, mode: RepairMode) {
  if(target.width!==original.width||target.height!==original.height)throw new Error('原图与抠图尺寸不一致')
  if(![from.x,from.y,to.x,to.y,radius].every(Number.isFinite)||radius<=0)throw new Error('画笔参数无效')
  const left=Math.max(0,Math.floor(Math.min(from.x,to.x)-radius)),top=Math.max(0,Math.floor(Math.min(from.y,to.y)-radius))
  const right=Math.min(target.width,Math.ceil(Math.max(from.x,to.x)+radius)),bottom=Math.min(target.height,Math.ceil(Math.max(from.y,to.y)+radius))
  const dx=to.x-from.x,dy=to.y-from.y,lengthSquared=dx*dx+dy*dy
  const feather=Math.min(radius,Math.max(1,radius*.08))
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const t=lengthSquared?Math.max(0,Math.min(1,((x+.5-from.x)*dx+(y+.5-from.y)*dy)/lengthSquared)):0
    const distance=Math.hypot(x+.5-from.x-t*dx,y+.5-from.y-t*dy)
    const coverage=Math.min(1,Math.max(0,(radius-distance)/feather))
    if(!coverage)continue
    const i=(y*target.width+x)*4
    if(mode==='restore'){
      target.data[i]=original.data[i];target.data[i+1]=original.data[i+1];target.data[i+2]=original.data[i+2]
      target.data[i+3]+= (original.data[i+3]-target.data[i+3])*coverage
    }else target.data[i+3]*=1-coverage
  }
  return {x:left,y:top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)}
}
