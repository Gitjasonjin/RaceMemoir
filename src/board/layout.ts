import type {Memory} from '../domain/model'
export type LayoutAction='left'|'centerX'|'right'|'top'|'centerY'|'bottom'|'distributeX'|'distributeY'
export function expandGroups(items:Memory[],ids:string[]){
  const selected=new Set(ids),groups=new Set(items.filter(i=>selected.has(i.id)&&i.groupId).map(i=>i.groupId))
  return items.filter(i=>selected.has(i.id)||(i.groupId&&groups.has(i.groupId))).map(i=>i.id)
}
export function lockedSelection(items:Memory[],ids:string[]){return items.some(i=>ids.includes(i.id)&&i.locked)}
export function itemBounds(i:Memory){const a=i.rotation*Math.PI/180,w=Math.abs(Math.cos(a))*i.w+Math.abs(Math.sin(a))*i.h,h=Math.abs(Math.sin(a))*i.w+Math.abs(Math.cos(a))*i.h;return {x:i.x+i.w/2-w/2,y:i.y+i.h/2-h/2,w,h}}
export function bounds(items:Memory[]){const boxes=items.map(itemBounds),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y}}
export function layoutUnits(items:Memory[],ids:string[]){
  const groups=new Map<string,Memory[]>()
  for(const i of items.filter(i=>ids.includes(i.id))){const key=i.groupId?`group:${i.groupId}`:`item:${i.id}`;groups.set(key,[...(groups.get(key)??[]),i])}
  return [...groups.values()].map(members=>({members,...bounds(members)}))
}
export function arrangeItems(items:Memory[],ids:string[],action:LayoutAction){
  if(lockedSelection(items,ids))return items
  const units=layoutUnits(items,ids);if(units.length<2)return items
  const whole=bounds(items.filter(i=>ids.includes(i.id))),offset=new Map<string,{x:number;y:number}>()
  const horizontal=['left','centerX','right','distributeX'].includes(action),axis=horizontal?'x':'y',size=horizontal?'w':'h'
  if(action.startsWith('distribute')){
    if(units.length<3)return items
    units.sort((a,b)=>a[axis]-b[axis]);const first=units[0],last=units.at(-1)!
    const gap=(last[axis]+last[size]-first[axis]-units.reduce((sum,u)=>sum+u[size],0))/(units.length-1)
    let cursor=first[axis];for(const unit of units){for(const i of unit.members)offset.set(i.id,{x:horizontal?cursor-unit.x:0,y:horizontal?0:cursor-unit.y});cursor+=unit[size]+gap}
  }else{
    const factor=action.startsWith('center')?.5:['right','bottom'].includes(action)?1:0
    for(const unit of units){const d=whole[axis]+whole[size]*factor-unit[axis]-unit[size]*factor;for(const i of unit.members)offset.set(i.id,{x:horizontal?d:0,y:horizontal?0:d})}
  }
  return items.map(i=>{const d=offset.get(i.id);return d&&(Math.abs(d.x)>1e-8||Math.abs(d.y)>1e-8)?{...i,x:i.x+d.x,y:i.y+d.y}:i})
}
export interface Guide{axis:'x'|'y';value:number;start:number;end:number}
export function snapMove(items:Memory[],ids:string[],dx:number,dy:number,tolerance:number){
  const picked=items.filter(i=>ids.includes(i.id)),others=items.filter(i=>!ids.includes(i.id));if(!picked.length)return {dx,dy,guides:[] as Guide[]}
  const b=bounds(picked),moving={...b,x:b.x+dx,y:b.y+dy},guides:Guide[]=[]
  for(const axis of ['x','y'] as const){const size=axis==='x'?'w':'h',cross=axis==='x'?'y':'x',span=axis==='x'?'h':'w';let best=tolerance,match:{delta:number;target:number;other:ReturnType<typeof itemBounds>}|undefined
    for(const item of others){const other=itemBounds(item);for(const f of [0,.5,1])for(const g of [0,.5,1]){const target=other[axis]+other[size]*g,delta=target-moving[axis]-moving[size]*f;if(Math.abs(delta)<best){best=Math.abs(delta);match={delta,target,other}}}}
    if(match){if(axis==='x')dx+=match.delta;else dy+=match.delta;guides.push({axis,value:match.target,start:Math.min(moving[cross],match.other[cross])-20,end:Math.max(moving[cross]+moving[span],match.other[cross]+match.other[span])+20})}
  }
  return {dx,dy,guides}
}
