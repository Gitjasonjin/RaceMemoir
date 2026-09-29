import type {TrackPoint} from '../../domain/records'

export const ROUTE_MAP_WIDTH=384,ROUTE_MAP_HEIGHT=256
const LAT_LIMIT=85.05112878
export interface RouteTile {url:string;x:number;y:number;size:number}
export function routeMapGeometry(points:TrackPoint[]){
  if(!points.length)return {path:'',tiles:[] as RouteTile[],start:undefined as {x:number;y:number}|undefined}
  let previous=points[0].lon,longitude=previous
  const projected=points.map(p=>{
    let delta=p.lon-previous
    if(delta>180)delta-=360;if(delta< -180)delta+=360
    longitude+=delta;previous=p.lon
    const lat=Math.max(-LAT_LIMIT,Math.min(LAT_LIMIT,p.lat))*Math.PI/180
    return {x:(longitude+180)/360,y:(1-Math.asinh(Math.tan(lat))/Math.PI)/2}
  })
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  for(const p of projected){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}
  // Fit continuously instead of rounding down a zoom level. Reserve the footer for attribution.
  const padding=12,footer=16,contentHeight=ROUTE_MAP_HEIGHT-footer
  const fitZoom=Math.max(0,Math.min(17,Math.log2(Math.min((ROUTE_MAP_WIDTH-padding*2)/(256*Math.max(maxX-minX,1e-9)),(contentHeight-padding*2)/(256*Math.max(maxY-minY,1e-9))))))
  const zoom=Math.ceil(fitZoom),count=2**zoom,world=256*2**fitZoom,size=world/count
  const left=(minX+maxX)/2*world-ROUTE_MAP_WIDTH/2
  const top=Math.max(0,Math.min(world-ROUTE_MAP_HEIGHT,(minY+maxY)/2*world-contentHeight/2))
  const tiles:RouteTile[]=[]
  for(let y=Math.max(0,Math.floor(top/size));y<=Math.min(count-1,Math.ceil((top+ROUTE_MAP_HEIGHT)/size)-1);y++){
    for(let x=Math.floor(left/size);x<=Math.ceil((left+ROUTE_MAP_WIDTH)/size)-1;x++){
      const wrapped=((x%count)+count)%count
      tiles.push({url:`https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`,x:x*size-left,y:y*size-top,size})
    }
  }
  const stride=Math.max(1,Math.ceil(points.length/2500));let path=''
  projected.forEach((p,i)=>{
    const first=i===0||points[i].segment!==points[i-1].segment,last=i===points.length-1||points[i].segment!==points[i+1].segment
    if(first||last||i%stride===0)path+=`${first?'M':'L'}${(p.x*world-left).toFixed(2)} ${(p.y*world-top).toFixed(2)} `
  })
  return {path,tiles,start:{x:projected[0].x*world-left,y:projected[0].y*world-top}}
}
