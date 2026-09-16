import {validErasures} from './bibErasure'
import type {BibErasure} from './bibErasure'
import {outputSize,perspectiveTransform} from './bibGeometry'
import type {Quad} from './bibGeometry'

/** Always resample the original, never an earlier processed preview. */
export async function processBibImage(original:Blob,quad:Quad,signal:AbortSignal,erasures:BibErasure[]=[]){
 if(!validErasures(erasures))throw new Error('抹除区域无效')
 const bitmap=await createImageBitmap(original)
 try{
  const project=perspectiveTransform(quad),size=outputSize(quad,bitmap.width,bitmap.height)
  if(size.width<16||size.height<16||size.width*size.height>25_000_000)throw new Error('选区过小或分辨率超过 2500 万像素')
  const source=document.createElement('canvas');source.width=bitmap.width;source.height=bitmap.height
  const ctx=source.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(bitmap,0,0)
  for(const rect of erasures){ctx.fillStyle=rect.color;const x=Math.floor(rect.x*source.width),y=Math.floor(rect.y*source.height);ctx.fillRect(x,y,Math.ceil((rect.x+rect.width)*source.width)-x,Math.ceil((rect.y+rect.height)*source.height)-y)}
  const pixels=ctx.getImageData(0,0,source.width,source.height).data
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height
  const out=canvas.getContext('2d')!,result=out.createImageData(size.width,size.height)
  for(let y=0;y<size.height;y++){
   if(y%32===0){await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted()}
   for(let x=0;x<size.width;x++){
    const p=project((x+.5)/size.width,(y+.5)/size.height),sx=Math.max(0,Math.min(bitmap.width-1,p.x*bitmap.width-.5)),sy=Math.max(0,Math.min(bitmap.height-1,p.y*bitmap.height-.5))
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,bitmap.width-1),y1=Math.min(y0+1,bitmap.height-1),fx=sx-x0,fy=sy-y0
    const indices=[(y0*bitmap.width+x0)*4,(y0*bitmap.width+x1)*4,(y1*bitmap.width+x0)*4,(y1*bitmap.width+x1)*4],weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy]
    const alpha=indices.reduce((a,index,i)=>a+pixels[index+3]*weights[i],0),offset=(y*size.width+x)*4
    for(let c=0;c<3;c++)result.data[offset+c]=alpha?indices.reduce((a,index,i)=>a+pixels[index+c]*pixels[index+3]*weights[i],0)/alpha:0
    result.data[offset+3]=alpha
   }
  }
  out.putImageData(result,0,0)
  const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('无法生成号码布图片')),'image/png'))
  signal.throwIfAborted()
  if(image.size>20*1024*1024)throw new Error('处理后的图片超过 20 MB，请缩小选区')
  return {image,...size}
 }finally{bitmap.close()}
}
