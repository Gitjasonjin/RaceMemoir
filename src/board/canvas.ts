import type { Memory, Thread, PinStyle } from '../domain/model'
import {resolveEndpoint,threadEndpoints} from './threadEndpoints.ts'
import type {CollectionRecord} from '../domain/records'
import { threadCurve } from './threadCurve.ts'
import {AppError} from '../i18n/runtime.ts'
import {isSafeGeometry,MAX_WORLD_COORDINATE,MIN_CAMERA_SCALE,rotationRadians} from '../domain/geometryLimits.ts'

export interface Bounds { x: number; y: number; width: number; height: number }
export interface Camera { x: number; y: number; scale: number }
const invalidGeometry=():never=>{throw new AppError('exportImage.001')}
function checkBounds(bounds:Bounds,allowEmpty=false){
  if(![bounds.x,bounds.y,bounds.width,bounds.height,bounds.x+bounds.width,bounds.y+bounds.height].every(Number.isFinite)||bounds.width<0||bounds.height<0||(!allowEmpty&&(bounds.width===0||bounds.height===0)))invalidGeometry()
  return bounds
}
function checkCamera(camera:Camera){
  if(![camera.x,camera.y,camera.scale].every(Number.isFinite)||camera.scale<MIN_CAMERA_SCALE)invalidGeometry()
  return camera
}
function checkViewport(width:number,height:number){
  if(![width,height].every(Number.isFinite)||width<0||height<0)invalidGeometry()
}
export function contentBounds(items: Memory[], padding = 60, threads:Thread[] = [],defaultPin:PinStyle='classic',records:CollectionRecord[]=[]): Bounds {
  if(!Number.isFinite(padding)||padding<0||padding>MAX_WORLD_COORDINATE)invalidGeometry()
  if (!items.length) return { x: 0, y: 0, width: 1440, height: 900 }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const item of items) {
    if(!isSafeGeometry(item))invalidGeometry()
    const angle = rotationRadians(item.rotation)
    // Include protruding tape, pins and shadows in the rotated rectangle.
    const w = item.w + 64, h = item.h + 64
    const halfW = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2
    const halfH = (Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h) / 2
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2
    left = Math.min(left, cx-halfW); right = Math.max(right, cx+halfW)
    top = Math.min(top, cy-halfH); bottom = Math.max(bottom, cy+halfH)
  }
  for(const thread of threads){
    const board={title:'',items,threads},[from,to]=threadEndpoints(thread)
    const a=resolveEndpoint(board,records,from,defaultPin),b=resolveEndpoint(board,records,to,defaultPin)
    if(!a||!b)continue
    const {control}=threadCurve(a,b,thread.curvature)
    // Quadratic Bezier extrema, including the endpoints.
    const points=[a,b]
    for(const key of ['x','y'] as const){const denominator=a[key]-2*control[key]+b[key];const t=denominator?(a[key]-control[key])/denominator:0;if(t>0&&t<1)points.push({x:(1-t)**2*a.x+2*(1-t)*t*control.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*control.y+t*t*b.y})}
    for(const p of points){left=Math.min(left,p.x-6);right=Math.max(right,p.x+6);top=Math.min(top,p.y-6);bottom=Math.max(bottom,p.y+6)}
  }
  return checkBounds({ x: left-padding, y: top-padding, width: right-left+padding*2, height: bottom-top+padding*2 })
}
export function fitCamera(bounds: Bounds, width: number, height: number): Camera {
  checkBounds(bounds);checkViewport(width,height)
  const scale = Math.min(Math.max(1,width-100)/bounds.width, Math.max(1,height-80)/bounds.height, 1)
  return checkCamera({scale,x:width/2-(bounds.x+bounds.width/2)*scale,y:height/2-(bounds.y+bounds.height/2)*scale})
}
export function screenToWorld(x: number, y: number, camera: Camera) {
  checkCamera(camera)
  const point={ x: (x-camera.x)/camera.scale, y: (y-camera.y)/camera.scale }
  if(![point.x,point.y].every(Number.isFinite))invalidGeometry()
  return point
}
export function visibleBounds(camera: Camera, width: number, height: number): Bounds {
  checkViewport(width,height)
  return checkBounds({ ...screenToWorld(0,0,camera), width:width/camera.scale, height:height/camera.scale },true)
}
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  checkBounds(a,true);checkBounds(b,true)
  const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y)
  return checkBounds({x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y},true)
}
export function exportSize(bounds: Bounds) {
  checkBounds(bounds)
  const scale=Math.min(2,4096/bounds.width,4096/bounds.height)
  const size={scale,width:Math.max(1,Math.ceil(bounds.width*scale)),height:Math.max(1,Math.ceil(bounds.height*scale))}
  if(![size.scale,size.width,size.height].every(Number.isFinite)||size.scale<=0)invalidGeometry()
  return size
}
