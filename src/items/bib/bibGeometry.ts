export interface Point {x:number;y:number}
export type Quad=[Point,Point,Point,Point]
export const fullQuad=():Quad=>[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]
export function validQuad(value:unknown):value is Quad{
 if(!Array.isArray(value)||value.length!==4||value.some(p=>!p||![p.x,p.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))return false
 // Clockwise on screen, convex and large enough to avoid singular transforms.
 return value.every((p,i)=>{const q=value[(i+1)%4],r=value[(i+2)%4];return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x)>.0001})
}
export function outputSize(quad:Quad,width:number,height:number){
 const distance=(a:Point,b:Point)=>Math.hypot((a.x-b.x)*width,(a.y-b.y)*height)
 return {width:Math.max(1,Math.round(Math.max(distance(quad[0],quad[1]),distance(quad[3],quad[2])))),height:Math.max(1,Math.round(Math.max(distance(quad[0],quad[3]),distance(quad[1],quad[2]))))}
}
/** Maps a unit output rectangle into the four selected source corners. */
export function perspectiveTransform(quad:Quad){
 if(!validQuad(quad))throw new Error('四角不能交叉或重叠，请按左上、右上、右下、左下调整')
 const matrix:number[][]=[]
 fullQuad().forEach(({x:u,y:v},i)=>{const {x,y}=quad[i];matrix.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y])})
 for(let col=0;col<8;col++){
  let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row
  ;[matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]]
  const factor=matrix[col][col];if(Math.abs(factor)<1e-10)throw new Error('选区过窄，请重新调整四角')
  for(let j=col;j<9;j++)matrix[col][j]/=factor
  for(let row=0;row<8;row++){if(row===col)continue;const f=matrix[row][col];for(let j=col;j<9;j++)matrix[row][j]-=f*matrix[col][j]}
 }
 const h=matrix.map(row=>row[8])
 return (u:number,v:number)=>{const d=h[6]*u+h[7]*v+1;return {x:(h[0]*u+h[1]*v+h[2])/d,y:(h[3]*u+h[4]*v+h[5])/d}}
}
export function bibLayout(width:number,height:number,preferredWidth=315){
 const ratio=width/height,w=Math.max(30,30*ratio,Math.min(preferredWidth,700,700*ratio))
 return {w:Math.max(30,w),h:Math.max(30,w/ratio)}
}
