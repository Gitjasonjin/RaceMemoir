import type { TrackPoint } from '../../domain/records.ts'
import { MAX_POINTS } from '../../domain/records.ts'

export function parseGpx(xml:string, parser:Pick<DOMParser,'parseFromString'>=new DOMParser()) {
  if(xml.length>15*1024*1024)throw new Error('GPX 文件不能超过 15 MB')
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('不支持包含外部实体的 GPX 文件')
  let doc:Document
  try{doc=parser.parseFromString(xml,'application/xml')}catch{throw new Error('GPX XML 格式无效')}
  if(doc.getElementsByTagName('parsererror').length||doc.documentElement?.localName!=='gpx')throw new Error('请选择有效的 GPX 文件')
  const points:TrackPoint[]=[]
  const segments=Array.from(doc.getElementsByTagNameNS('*','trkseg'))
  // GPX routes are also accepted; do not connect separate segments across gaps.
  const groups=segments.length?segments:Array.from(doc.getElementsByTagNameNS('*','rte'))
  const tag=segments.length?'trkpt':'rtept'
  groups.forEach((group,segment)=>{
    for(const node of Array.from(group.getElementsByTagNameNS('*',tag))){
      const latText=node.getAttribute('lat'),lonText=node.getAttribute('lon')
      const lat=Number(latText),lon=Number(lonText)
      if(!latText?.trim()||!lonText?.trim()||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw new Error('GPX 中存在无效的经纬度')
      const elevationText=node.getElementsByTagNameNS('*','ele')[0]?.textContent?.trim()
      const timeText=node.getElementsByTagNameNS('*','time')[0]?.textContent?.trim()
      const elevation=elevationText?Number(elevationText):undefined
      points.push({lat,lon,segment,...(elevation!==undefined&&Number.isFinite(elevation)?{elevation}:{}),...(timeText&&Number.isFinite(Date.parse(timeText))?{time:new Date(timeText).toISOString()}:{})})
      if(points.length>MAX_POINTS)throw new Error('轨迹点超过 100,000 个，请先简化 GPX')
    }
  })
  if(points.length<2)throw new Error('GPX 至少需要两个有效轨迹点')
  const name=doc.getElementsByTagNameNS('*','name')[0]?.textContent?.trim().slice(0,200)||'我的山野路线'
  return {name,points}
}
export function routeGeometry(points:TrackPoint[]){
  if(!points.length)return {path:'',elevationPath:'',distance:0,ascent:0,minElevation:undefined as number|undefined,maxElevation:undefined as number|undefined,start:undefined as {x:number;y:number}|undefined}
  const rad=Math.PI/180, lat0=points.reduce((n,p)=>n+p.lat,0)/points.length*rad
  let unwrapped=points[0].lon, previous=points[0],distance=0,ascent=0
  const distances:number[]=[], elevations:number[]=[]
  const projected=points.map((p,index)=>{
    let delta=p.lon-previous.lon
    if(delta>180)delta-=360;if(delta<-180)delta+=360
    if(index)unwrapped+=delta
    if(index&&p.segment===previous.segment){
      const a=Math.sin((p.lat-previous.lat)*rad/2)**2+Math.cos(previous.lat*rad)*Math.cos(p.lat*rad)*Math.sin(delta*rad/2)**2
      distance+=6371000*2*Math.asin(Math.min(1,Math.sqrt(a)))
      if(p.elevation!==undefined&&previous.elevation!==undefined)ascent+=Math.max(0,p.elevation-previous.elevation)
    }
    distances.push(distance);if(p.elevation!==undefined)elevations.push(p.elevation)
    previous=p;return {x:unwrapped*Math.cos(lat0),y:-p.lat}
  })
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  projected.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)})
  const scale=200/Math.max(maxX-minX,maxY-minY,.000001)
  const mapped=projected.map(p=>({x:120+(p.x-(minX+maxX)/2)*scale,y:120+(p.y-(minY+maxY)/2)*scale}))
  const stride=Math.max(1,Math.ceil(points.length/2500))
  let path='',elevationPath='',minElevation:number|undefined,maxElevation:number|undefined
  if(elevations.length){minElevation=Infinity;maxElevation=-Infinity;elevations.forEach(e=>{minElevation=Math.min(minElevation!,e);maxElevation=Math.max(maxElevation!,e)})}
  let elevationGap=true
  points.forEach((p,i)=>{
    const boundary=i===0||p.segment!==points[i-1].segment
    const end=i===points.length-1||p.segment!==points[i+1].segment
    if(i%stride===0||boundary||end){const m=mapped[i];path+=`${boundary?'M':'L'}${m.x.toFixed(2)} ${m.y.toFixed(2)} `}
    if(p.elevation===undefined){elevationGap=true;return}
    if(i%stride===0||boundary||end||elevationGap){
      const x=10+(distance?distances[i]/distance:i/Math.max(1,points.length-1))*220
      const y=65-(p.elevation-minElevation!)/Math.max(1,maxElevation!-minElevation!)*50
      elevationPath+=`${boundary||elevationGap?'M':'L'}${x.toFixed(2)} ${y.toFixed(2)} `;elevationGap=false
    }
  })
  return {path,elevationPath:elevations.length>1?elevationPath:'',distance,ascent,minElevation,maxElevation,start:mapped[0]}
}
