export interface BibErasure {x:number;y:number;width:number;height:number;color:string}
export function validErasures(value:unknown):value is BibErasure[]{
 return Array.isArray(value)&&value.length<=50&&value.every(r=>r&&[r.x,r.y,r.width,r.height].every(n=>typeof n==='number'&&Number.isFinite(n))&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=1.000001&&r.y+r.height<=1.000001&&/^#[0-9a-f]{6}$/i.test(r.color))
}
/** The dominant perimeter colour avoids averaging dark lettering into light paper. */
export function surroundingColor(pixels:Uint8ClampedArray,width:number,height:number,rect:Omit<BibErasure,'color'>){
 const left=Math.floor(rect.x*width),right=Math.ceil((rect.x+rect.width)*width),top=Math.floor(rect.y*height),bottom=Math.ceil((rect.y+rect.height)*height)
 const buckets=new Map<number,{count:number;r:number;g:number;b:number}>()
 const sample=(x:number,y:number)=>{
  if(x<0||y<0||x>=width||y>=height)return
  const i=(y*width+x)*4;if(pixels[i+3]<128)return
  const r=pixels[i],g=pixels[i+1],b=pixels[i+2],key=(r>>4)*256+(g>>4)*16+(b>>4),bucket=buckets.get(key)||{count:0,r:0,g:0,b:0}
  bucket.count++;bucket.r+=r;bucket.g+=g;bucket.b+=b;buckets.set(key,bucket)
 }
 const step=Math.max(1,Math.floor(Math.max(right-left,bottom-top)/300))
 for(let d=1;d<=4;d++){
  for(let x=left;x<right;x+=step){sample(x,top-d);sample(x,bottom+d-1)}
  for(let y=top;y<bottom;y+=step){sample(left-d,y);sample(right+d-1,y)}
 }
 const best=[...buckets.values()].sort((a,b)=>b.count-a.count)[0]
 return best?'#'+[best.r,best.g,best.b].map(v=>Math.round(v/best.count).toString(16).padStart(2,'0')).join(''):'#f3edda'
}
