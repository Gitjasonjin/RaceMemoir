import type {Board,Memory} from './model'

export const EXHIBIT_LAYOUTS=[
  {id:'1x2',label:'1 × 2',rows:1,columns:2},
  {id:'1x4',label:'1 × 4',rows:1,columns:4},
  {id:'2x4',label:'2 × 4',rows:2,columns:4},
] as const
export type ExhibitLayout=typeof EXHIBIT_LAYOUTS[number]['id']
export interface MedalExhibit {layout:ExhibitLayout;medals:Memory[]}
export function exhibitLayout(id?:string){return EXHIBIT_LAYOUTS.find(l=>l.id===id)??EXHIBIT_LAYOUTS[0]}
export function exhibitSize(layout:ExhibitLayout){
  const {rows,columns}=exhibitLayout(layout)
  return {w:columns*220+44,h:rows*300+44}
}
/** Originals stay intact in the exhibit; all consumers share the same cell geometry. */
export function exhibitCells(item:Memory){
  if(!item.exhibit)return []
  const {rows,columns}=exhibitLayout(item.exhibit.layout),w=(item.w-44)/columns,h=(item.h-44)/rows
  return item.exhibit.medals.map((medal,index)=>({...medal,x:22+(index%columns)*w,y:22+Math.floor(index/columns)*h,w,h,rotation:0}))
}
export function exhibitWorldMedals(item:Memory){
  const angle=item.rotation*Math.PI/180
  return exhibitCells(item).map(m=>{
    const dx=m.x+m.w/2-item.w/2,dy=m.y+m.h/2-item.h/2
    return {...m,x:item.x+item.w/2+dx*Math.cos(angle)-dy*Math.sin(angle)-m.w/2,y:item.y+item.h/2+dx*Math.sin(angle)+dy*Math.cos(angle)-m.h/2,rotation:item.rotation}
  })
}
/** Includes containers for selection and members for records and connection endpoints. */
export function boardMembers(items:Memory[]):Memory[]{return items.flatMap(i=>[i,...(i.exhibit?.medals??[])])}
export function boardWorldItems(items:Memory[]):Memory[]{return items.flatMap(i=>[i,...exhibitWorldMedals(i)])}
export function ownerOf(items:Memory[],id:string){return items.find(i=>i.id===id||i.exhibit?.medals.some(m=>m.id===id))}
export function mergeMedals(board:Board,ids:string[],layout:ExhibitLayout):{board:Board;item:Memory}{
  const medals=board.items.filter(i=>ids.includes(i.id)),option=exhibitLayout(layout)
  if(medals.length<2||medals.some(i=>i.kind!=='medal'||i.exhibit||i.locked)||medals.length>option.rows*option.columns)throw new Error('请选择容量范围内的 2–8 块未锁定奖牌')
  if(medals.some(i=>i.groupId&&board.items.some(other=>other.groupId===i.groupId&&!ids.includes(other.id))))throw new Error('请先取消原有组合')
  const size=exhibitSize(layout),left=Math.min(...medals.map(i=>i.x)),right=Math.max(...medals.map(i=>i.x+i.w)),top=Math.min(...medals.map(i=>i.y)),bottom=Math.max(...medals.map(i=>i.y+i.h))
  const item:Memory={id:crypto.randomUUID(),kind:'medal',title:'奖牌展览框',x:(left+right-size.w)/2,y:(top+bottom-size.h)/2,...size,rotation:0,medalFrame:medals[0].medalFrame==='black'?'black':'wood',shadowDepth:medals[0].shadowDepth,exhibit:{layout,medals:medals.map(({groupId:_,...m})=>m)}}
  const last=medals.at(-1)!.id
  return {board:{...board,items:board.items.flatMap(i=>i.id===last?[item]:ids.includes(i.id)?[]:[i])},item}
}
export function splitMedals(board:Board,id:string):{board:Board;items:Memory[]}{
  const item=board.items.find(i=>i.id===id)
  if(!item?.exhibit||item.locked||item.groupId)throw new Error('请先解锁或取消展览框的组合')
  if(board.items.length-1+item.exhibit.medals.length>500)throw new Error('拆分后超过 500 件，请先移除部分物件')
  const world=exhibitWorldMedals(item)
  const items=item.exhibit.medals.map((m,index)=>({...m,x:world[index].x+(world[index].w-m.w)/2,y:world[index].y+(world[index].h-m.h)/2,rotation:m.rotation+item.rotation}))
  return {items,board:{...board,items:board.items.flatMap(i=>i.id===id?items:[i]),threads:board.threads.map(t=>({...t,from:t.from===id?items[0].id:t.from,to:t.to===id?items[0].id:t.to})).filter(t=>t.from!==t.to||t.fromRaceId!==t.toRaceId)}}
}
