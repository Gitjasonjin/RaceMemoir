import type { PixelImage } from './ribbonBrush'

const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]
const luminance=(r:number,g:number,b:number)=>(r+g+b)/3

/** Recover connected foreground missed by a saliency model on a relatively plain backdrop.
 * Chroma carries more weight than brightness so cast shadows do not become a ribbon.
 * Uncertain/background-heavy inputs keep the model's mask unchanged.
 */
export function automaticRibbonMask(original:PixelImage,model:PixelImage):Uint8ClampedArray|null{
  const {width:w,height:h,data:source}=original,n=w*h
  if(w!==model.width||h!==model.height||w<8||h<8)return null
  const border:number[]=[],stride=Math.max(1,Math.floor(Math.max(w,h)/200))
  const add=(x:number,y:number)=>{const i=y*w+x;if(source[i*4+3]>240&&model.data[i*4+3]<32)border.push(i)}
  for(let x=0;x<w;x+=stride){add(x,0);add(x,h-1)}
  for(let y=1;y<h-1;y+=stride){add(0,y);add(w-1,y)}
  if(border.length<16)return null
  const rg=median(border.map(i=>source[i*4]-source[i*4+1])),bg=median(border.map(i=>source[i*4+2]-source[i*4+1]))
  const inliers=border.filter(i=>Math.abs(source[i*4]-source[i*4+1]-rg)<14&&Math.abs(source[i*4+2]-source[i*4+1]-bg)<14)
  if(inliers.length<border.length*.65)return null
  const lights=inliers.map(i=>luminance(source[i*4],source[i*4+1],source[i*4+2])).sort((a,b)=>a-b)
  if(lights[Math.floor(lights.length*.9)]-lights[Math.floor(lights.length*.1)]>70)return null
  const light=lights[Math.floor(lights.length/2)]
  const difference=new Float32Array(n),candidate=new Uint8Array(n),connected=new Uint8Array(n),queue=new Int32Array(n)
  let tail=0,head=0,seedCount=0
  for(let i=0;i<n;i++){
    const p=i*4,r=source[p],g=source[p+1],b=source[p+2]
    const d=Math.max(Math.abs(r-g-rg),Math.abs(b-g-bg),Math.abs(luminance(r,g,b)-light)*.22)
    difference[i]=d
    if(source[p+3]>8&&(d>16||model.data[p+3]>96))candidate[i]=1
    if(source[p+3]>8&&model.data[p+3]>224){connected[i]=1;queue[tail++]=i;seedCount++}
  }
  if(seedCount<n*.001)return null
  while(head<tail){
    const i=queue[head++],x=i%w,y=Math.floor(i/w)
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue
      const next=ny*w+nx
      if(candidate[next]&&!connected[next]){connected[next]=1;queue[tail++]=next}
    }
  }
  // Refuse expansions that probably reached textured surroundings or a large background.
  if(tail>n*.82||tail-seedCount>n*.5)return null
  const alpha=new Uint8ClampedArray(n)
  for(let i=0;i<n;i++)if(connected[i]){
    const opacity=Math.max(model.data[i*4+3],Math.min(255,Math.max(0,(difference[i]-16)/12)*255))
    alpha[i]=Math.min(source[i*4+3],opacity)
  }
  // Pale printed lettering can meet the image edge and is not an enclosed hole.
  // Bridge only narrow gaps bounded by foreground on the same row, never wide loop interiors.
  for(let y=0;y<h;y++){
    const row=y*w
    let left=0,right=w-1
    while(left<w&&!connected[row+left])left++
    while(right>left&&!connected[row+right])right--
    const limit=Math.min(w*.08,(right-left+1)*.3)
    for(let x=left;x<right;x++){
      if(connected[row+x])continue
      const start=x;while(x<right&&!connected[row+x])x++
      if(x-start<=limit)for(let j=start;j<x;j++)alpha[row+j]=source[(row+j)*4+3]
    }
  }
  // Recover small lettering inside the ribbon, while leaving large loop openings transparent.
  const visited=new Uint8Array(n),maxHole=Math.max(12,Math.floor(n*.0006))
  for(let start=0;start<n;start++){
    if(connected[start]||visited[start])continue
    head=0;tail=1;queue[0]=start;visited[start]=1;let edge=false
    while(head<tail){
      const i=queue[head++],x=i%w,y=Math.floor(i/w)
      if(x===0||y===0||x===w-1||y===h-1)edge=true
      for(const next of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){
        if(next>=0&&!visited[next]&&!connected[next]){visited[next]=1;queue[tail++]=next}
      }
    }
    if(!edge&&tail<=maxHole)for(let j=0;j<tail;j++)alpha[queue[j]]=source[queue[j]*4+3]
  }
  return alpha
}
