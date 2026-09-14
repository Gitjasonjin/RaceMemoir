import type { Memory, Thread } from './model'
import { pinPosition } from './model.ts'
import { threadCurve } from './threadCurve.ts'

export interface Bounds { x: number; y: number; width: number; height: number }
export interface Camera { x: number; y: number; scale: number }
export function contentBounds(items: Memory[], padding = 60, threads:Thread[] = []): Bounds {
  if (!items.length) return { x: 0, y: 0, width: 1440, height: 900 }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const item of items) {
    const angle = item.rotation * Math.PI / 180
    // Include protruding tape, pins and shadows in the rotated rectangle.
    const w = item.w + 64, h = item.h + 64
    const halfW = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2
    const halfH = (Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h) / 2
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2
    left = Math.min(left, cx-halfW); right = Math.max(right, cx+halfW)
    top = Math.min(top, cy-halfH); bottom = Math.max(bottom, cy+halfH)
  }
  for(const thread of threads){
    const from=items.find(i=>i.id===thread.from),to=items.find(i=>i.id===thread.to)
    if(!from||!to)continue
    const a=pinPosition(from),b=pinPosition(to),{control}=threadCurve(a,b,thread.curvature)
    // Quadratic Bezier extrema, including the endpoints.
    const points=[a,b]
    for(const key of ['x','y'] as const){const denominator=a[key]-2*control[key]+b[key];const t=denominator?(a[key]-control[key])/denominator:0;if(t>0&&t<1)points.push({x:(1-t)**2*a.x+2*(1-t)*t*control.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*control.y+t*t*b.y})}
    for(const p of points){left=Math.min(left,p.x-6);right=Math.max(right,p.x+6);top=Math.min(top,p.y-6);bottom=Math.max(bottom,p.y+6)}
  }
  return { x: left-padding, y: top-padding, width: right-left+padding*2, height: bottom-top+padding*2 }
}
export function fitCamera(bounds: Bounds, width: number, height: number): Camera {
  const scale = Math.min(Math.max(1,width-100)/bounds.width, Math.max(1,height-80)/bounds.height, 1)
  return {scale,x:width/2-(bounds.x+bounds.width/2)*scale,y:height/2-(bounds.y+bounds.height/2)*scale}
}
export function screenToWorld(x: number, y: number, camera: Camera) {
  return { x: (x-camera.x)/camera.scale, y: (y-camera.y)/camera.scale }
}
export function visibleBounds(camera: Camera, width: number, height: number): Bounds {
  return { ...screenToWorld(0,0,camera), width:width/camera.scale, height:height/camera.scale }
}
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y)
  return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y}
}
export function exportSize(bounds: Bounds) {
  const scale=Math.min(2,4096/bounds.width,4096/bounds.height)
  return {scale,width:Math.max(1,Math.ceil(bounds.width*scale)),height:Math.max(1,Math.ceil(bounds.height*scale))}
}
