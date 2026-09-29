/** Close each absolute M/L profile segment independently; missing elevations stay gaps. */
export function elevationArea(path:string,baseline=65):string{
  return path.split(/(?=M)/).filter(Boolean).map(segment=>{
    const points=[...segment.matchAll(/[ML](-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    if(points.length<2)return ''
    return `${segment.trim()} L${points.at(-1)![1]} ${baseline} L${points[0][1]} ${baseline} Z`
  }).filter(Boolean).join(' ')
}
