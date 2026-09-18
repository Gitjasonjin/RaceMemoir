export function panPhoto(zoom:number,x:number,y:number,dx:number,dy:number,width:number,height:number,naturalWidth:number,naturalHeight:number){
  const cover=Math.max(width/naturalWidth,height/naturalHeight)*zoom
  const excessX=naturalWidth*cover-width,excessY=naturalHeight*cover-height
  const clamp=(n:number)=>Math.max(0,Math.min(100,n))
  return {photoX:excessX>0?clamp(x-dx/excessX*100):x,photoY:excessY>0?clamp(y-dy/excessY*100):y}
}
export interface PhotoGeometry {width:number;height:number;naturalWidth:number;naturalHeight:number}
export function photoCamera(zoom:number,x:number,y:number,g:PhotoGeometry){
  const cover=Math.max(g.width/g.naturalWidth,g.height/g.naturalHeight)*zoom
  return {scale:zoom,x:-(g.naturalWidth*cover-g.width)*x/100,y:-(g.naturalHeight*cover-g.height)*y/100}
}
export function cameraPhoto(camera:{scale:number;x:number;y:number},g:PhotoGeometry){
  const zoom=Math.max(1,Math.min(3,camera.scale)),cover=Math.max(g.width/g.naturalWidth,g.height/g.naturalHeight)*zoom
  const excessX=g.naturalWidth*cover-g.width,excessY=g.naturalHeight*cover-g.height,clamp=(n:number)=>Math.max(0,Math.min(100,n))
  return {photoZoom:zoom,photoX:excessX>0?clamp(-camera.x/excessX*100):50,photoY:excessY>0?clamp(-camera.y/excessY*100):50}
}
