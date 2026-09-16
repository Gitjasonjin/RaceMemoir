import {expandGroups,lockedSelection} from './layout.ts'
import type {Memory} from '../domain/model'
export type LayerAction = 'up'|'down'|'top'|'bottom'
/** Array order is back-to-front; preserve relative order within a selection. */
export function reorderItems(items:Memory[],ids:string[],action:LayerAction):Memory[]{
  const selected=new Set(ids),next=[...items]
  if(action==='top'||action==='bottom'){
    const picked=items.filter(i=>selected.has(i.id)),rest=items.filter(i=>!selected.has(i.id))
    return action==='top'?[...rest,...picked]:[...picked,...rest]
  }
  if(action==='up'){
    for(let i=next.length-2;i>=0;i--)if(selected.has(next[i].id)&&!selected.has(next[i+1].id))[next[i],next[i+1]]=[next[i+1],next[i]]
  }else{
    for(let i=1;i<next.length;i++)if(selected.has(next[i].id)&&!selected.has(next[i-1].id))[next[i],next[i-1]]=[next[i-1],next[i]]
  }
  return next
}

export type RelativeLayerAction='above'|'below'
/** Insert the whole selection next to the target group without moving any coordinates. */
export function placeItemsRelative(items:Memory[],ids:string[],targetId:string,action:RelativeLayerAction):Memory[]{
  const source=new Set(expandGroups(items,ids)),target=new Set(expandGroups(items,[targetId]))
  if(!source.size||!target.size||[...target].some(id=>source.has(id))||lockedSelection(items,[...source]))return items
  const picked=items.filter(i=>source.has(i.id)),rest=items.filter(i=>!source.has(i.id))
  const indices=rest.flatMap((i,index)=>target.has(i.id)?[index]:[])
  const at=action==='above'?Math.max(...indices)+1:Math.min(...indices)
  return [...rest.slice(0,at),...picked,...rest.slice(at)]
}
