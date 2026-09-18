/** Matte paper lighting on the derived image only; source pixels and transparency stay intact. */
export function applyPaperFinish(pixels:Uint8ClampedArray,width:number,height:number){
  const scale=Math.max(width,height)/600,edge=Math.max(1,Math.round(scale*.8))
  const alpha=(x:number,y:number)=>x<0||y<0||x>=width||y>=height?0:pixels[(y*width+x)*4+3]/255
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=(y*width+x)*4
    if(!pixels[index+3])continue
    // Stable sub-millimetre grain: no shimmering when moved, resized or exported.
    const gx=Math.floor(x/Math.max(1,scale)),gy=Math.floor(y/Math.max(1,scale))
    let hash=Math.imul(gx+17,374761393)^Math.imul(gy+53,668265263)
    hash=Math.imul(hash^(hash>>>13),1274126177)
    const grain=((hash>>>0)%1024/1023-.5)*3
    const fibre=Math.sin((x/Math.max(1,scale)+Math.sin(y/Math.max(1,scale)*.3)*2)*1.9)*.45
    const light=(1-x/width-y/height)*1.1
    const rim=(1-alpha(x-edge,y-edge))*6-(1-alpha(x+edge,y+edge))*10
    const tone=grain+fibre+light+rim
    for(let channel=0;channel<3;channel++)pixels[index+channel]=Math.max(0,Math.min(255,pixels[index+channel]+tone))
  }
  return pixels
}
