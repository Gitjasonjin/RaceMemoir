import type {Board,Memory,PinStyle,Thread} from '../domain/model'
import {pinPosition} from '../domain/model.ts'
import type {CollectionRecord} from '../domain/records'
import {coarseCoordinate,validRaceLocation} from '../domain/raceLocation.ts'
import {mapGeometry} from '../race-map/mapGeometry.ts'

export interface ThreadEndpoint {itemId:string;raceId?:string}
export interface Point {x:number;y:number}
export function mapContentRect(item:Memory){
  const scale=Math.min((item.w-36)/1000,(item.h-76)/700)
  return {x:(item.w-1000*scale)/2,y:40+(item.h-76-700*scale)/2,width:1000*scale,height:700*scale}
}
export function localToWorld(item:Memory,p:Point):Point{
  const a=item.rotation*Math.PI/180,dx=p.x-item.w/2,dy=p.y-item.h/2
  return {x:item.x+item.w/2+dx*Math.cos(a)-dy*Math.sin(a),y:item.y+item.h/2+dx*Math.sin(a)+dy*Math.cos(a)}
}
export function racePointOnMap(item:Memory,record:CollectionRecord):Point|null{
  if(item.kind!=='race-map'||(record.kind!=='medal'&&record.kind!=='route')||!validRaceLocation(record.location))return null
  const projected=mapGeometry.projection([coarseCoordinate(record.location.lng),coarseCoordinate(record.location.lat)])
  if(!projected||!projected.every(Number.isFinite))return null
  const view=item.mapView??{x:0,y:0,scale:1},x=projected[0]*view.scale+view.x,y=projected[1]*view.scale+view.y
  if(x<0||x>1000||y<0||y>700)return null
  const rect=mapContentRect(item)
  return localToWorld(item,{x:rect.x+x*rect.width/1000,y:rect.y+y*rect.height/700})
}
export function resolveEndpoint(board:Board,records:CollectionRecord[],endpoint:ThreadEndpoint,pin:PinStyle='classic'):Point|null{
  const item=board.items.find(i=>i.id===endpoint.itemId)
  if(!item)return null
  if(!endpoint.raceId)return pinPosition(item,pin)
  if(!board.items.some(i=>(i.kind==='medal'||i.kind==='map')&&i.recordId===endpoint.raceId))return null
  const record=records.find(r=>r.id===endpoint.raceId)
  return record?racePointOnMap(item,record):null
}
export function threadEndpoints(thread:Thread):[ThreadEndpoint,ThreadEndpoint]{
  return [{itemId:thread.from,raceId:thread.fromRaceId},{itemId:thread.to,raceId:thread.toRaceId}]
}
export function sameEndpoint(a:ThreadEndpoint,b:ThreadEndpoint){return a.itemId===b.itemId&&a.raceId===b.raceId}
export function hasConnection(threads:Thread[],a:ThreadEndpoint,b:ThreadEndpoint){
  return threads.some(t=>{const [from,to]=threadEndpoints(t);return (sameEndpoint(from,a)&&sameEndpoint(to,b))||(sameEndpoint(from,b)&&sameEndpoint(to,a))})
}
export function recordThreadReferences(board:Board,id:string){return board.threads.filter(t=>t.fromRaceId===id||t.toRaceId===id).length}
