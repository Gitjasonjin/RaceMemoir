export function panPhoto(zoom:number,x:number,y:number,dx:number,dy:number,width:number,height:number,naturalWidth:number,naturalHeight:number){
  const cover=Math.max(width/naturalWidth,height/naturalHeight)*zoom
  const excessX=naturalWidth*cover-width,excessY=naturalHeight*cover-height
  const clamp=(n:number)=>Math.max(0,Math.min(100,n))
  return {photoX:excessX>0?clamp(x-dx/excessX*100):x,photoY:excessY>0?clamp(y-dy/excessY*100):y}
}
