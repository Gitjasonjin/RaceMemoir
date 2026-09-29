import {AppError} from '../i18n/runtime.ts'
import type {Board,Memory,Thread} from '../domain/model.ts'
import {pinPosition} from '../domain/model.ts'

/** Arrange only the selected photos, leaving their files, crops and sizes intact. */
export function hangPhotos(board:Board,ids:readonly string[]):Board{
  const selected=new Set(ids)
  const photos=board.items.filter(i=>selected.has(i.id)&&i.kind==='photo').sort((a,b)=>(a.x+a.w/2)-(b.x+b.w/2))
  if(photos.length<2)return board
  const gap=48,total=photos.reduce((sum,p)=>sum+p.w,0)+gap*(photos.length-1)
  const center=(Math.min(...photos.map(p=>p.x))+Math.max(...photos.map(p=>p.x+p.w)))/2
  const baseline=Math.min(...photos.map(p=>pinPosition(p).y))
  const sag=Math.min(100,total*.07)
  const arranged=new Map<string,Memory>()
  let left=center-total/2
  photos.forEach((photo,index)=>{
    const item={...photo,x:left,pinStyle:'clip' as const,rotation:index%2===0?-3:3}
    const anchor=pinPosition(item),t=index/(photos.length-1)
    item.y+=baseline+4*sag*t*(1-t)-anchor.y
    arranged.set(item.id,item);left+=photo.w+gap
  })
  const threads=[...board.threads]
  for(let i=1;i<photos.length;i++){
    const from=photos[i-1].id,to=photos[i].id
    const index=threads.findIndex(t=>(t.from===from&&t.to===to)||(t.from===to&&t.to===from))
    const thread:Thread={id:index>=0?threads[index].id:crypto.randomUUID(),from,to,style:'hemp',curvature:.025}
    if(index>=0)threads[index]=thread;else threads.push(thread)
  }
  if(threads.length>2000)throw new AppError("photoLine.001")
  return {...board,items:board.items.map(i=>arranged.get(i.id)??i),threads}
}
