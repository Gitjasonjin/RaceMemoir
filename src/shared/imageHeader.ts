import {AppError,formatNumber} from '../i18n/runtime.ts'
import {MAX_UPLOAD_IMAGE_PIXELS,validImageBlob} from '../domain/imageRules.ts'

export interface ImageSize {width:number;height:number}
const headers=new WeakMap<Blob,Promise<ImageSize>>()
const invalid=():never=>{throw new AppError('readImageSize.003')}

export function checkImagePixels(size:ImageSize,maxPixels:number){
  if(!Number.isSafeInteger(size.width)||!Number.isSafeInteger(size.height)||size.width<=0||size.height<=0)invalid()
  if(size.width>maxPixels/size.height)throw new AppError('image.resolutionLimit',{pixels:formatNumber(maxPixels)})
}

/** Parse only bounded encoded bytes, never pixels. Reject animation and ambiguous dimensions.
 * PNG: https://www.w3.org/TR/png-3/ ; WebP: https://www.rfc-editor.org/rfc/rfc9649.html
 */
export function parseImageHeader(bytes:Uint8Array,mime:string):ImageSize{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const need=(offset:number,length:number)=>{if(offset<0||offset+length>bytes.length)invalid()}
  const tag=(offset:number)=>{need(offset,4);return String.fromCharCode(...bytes.subarray(offset,offset+4))}
  let size:ImageSize|undefined
  if(mime==='image/png'){
    need(0,8)
    if(![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))invalid()
    let imageData=false
    for(let offset=8;offset<bytes.length;){
      need(offset,12)
      const length=view.getUint32(offset),kind=tag(offset+4),data=offset+8
      need(data,length+4)
      if(!size&&kind!=='IHDR')invalid()
      if(kind==='IHDR'){
        if(size||length!==13)invalid()
        size={width:view.getUint32(data),height:view.getUint32(data+4)}
        if(size.width>0x7fffffff||size.height>0x7fffffff||bytes[data+10]!==0||bytes[data+11]!==0||bytes[data+12]>1)invalid()
        const depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}
        if(!depths[bytes[data+9]]?.includes(bytes[data+8]))invalid()
      }
      if(['acTL','fcTL','fdAT'].includes(kind))throw new AppError('image.animationUnsupported')
      if(kind==='IDAT')imageData=true
      offset=data+length+4
      if(kind==='IEND'){
        if(length!==0||!imageData||offset!==bytes.length)invalid()
        return checked(size)
      }
    }
  }else if(mime==='image/jpeg'){
    need(0,2)
    if(bytes[0]!==0xff||bytes[1]!==0xd8)invalid()
    let offset=2,scan=false,sawScan=false
    while(offset<bytes.length){
      if(scan){
        while(offset<bytes.length&&bytes[offset]!==0xff)offset++
      }
      need(offset,2)
      if(bytes[offset++]!==0xff)invalid()
      while(bytes[offset]===0xff)offset++
      need(offset,1)
      const marker=bytes[offset++]
      if(scan&&(marker===0||(marker>=0xd0&&marker<=0xd7)))continue
      scan=false
      if(marker===0xd9){if(!sawScan)invalid();return checked(size)}
      // No DNL (late height), hierarchical images or second frames.
      if(marker===0||marker===0xd8||marker===0xdc||marker===0xde||marker===0xdf||marker===1||(marker>=0xd0&&marker<=0xd7))invalid()
      need(offset,2)
      const length=view.getUint16(offset)
      if(length<2)invalid()
      need(offset,length)
      if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker)){
        if(size||![0xc0,0xc1,0xc2].includes(marker)||length<8)invalid()
        if(bytes[offset+2]!==8||length!==8+3*bytes[offset+7])invalid()
        size={height:view.getUint16(offset+3),width:view.getUint16(offset+5)}
        checked(size)
      }
      if(marker===0xda){if(!size||length<6)invalid();scan=true;sawScan=true}
      offset+=length
    }
  }else if(mime==='image/webp'){
    need(0,12)
    if(tag(0)!=='RIFF'||tag(8)!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)invalid()
    let canvas:ImageSize|undefined
    const u24=(o:number)=>bytes[o]+bytes[o+1]*256+bytes[o+2]*65536
    for(let offset=12;offset<bytes.length;){
      need(offset,8)
      const kind=tag(offset),length=view.getUint32(offset+4,true),data=offset+8
      need(data,length+(length%2))
      if(kind==='ANIM'||kind==='ANMF')throw new AppError('image.animationUnsupported')
      if(kind==='VP8X'){
        if(offset!==12||length!==10)invalid()
        if(bytes[data]&2)throw new AppError('image.animationUnsupported')
        if((bytes[data]&0xc1)||bytes[data+1]||bytes[data+2]||bytes[data+3])invalid()
        canvas={width:u24(data+4)+1,height:u24(data+7)+1}
      }else if(kind==='VP8 '){
        if(size||length<10||(bytes[data]&1)||bytes[data+3]!==0x9d||bytes[data+4]!==1||bytes[data+5]!==0x2a)invalid()
        size={width:view.getUint16(data+6,true)&0x3fff,height:view.getUint16(data+8,true)&0x3fff}
      }else if(kind==='VP8L'){
        if(size||length<5||bytes[data]!==0x2f||(bytes[data+4]&0xe0))invalid()
        const bits=view.getUint32(data+1,true)
        size={width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1}
      }
      if(length%2&&bytes[data+length]!==0)invalid()
      offset=data+length+(length%2)
    }
    if(canvas&&(!size||canvas.width!==size.width||canvas.height!==size.height))invalid()
    return checked(size)
  }
  return invalid()
}

function checked(size:ImageSize|undefined){
  if(!size)return invalid()
  checkImagePixels(size,MAX_UPLOAD_IMAGE_PIXELS)
  return size
}

export async function readImageHeader(file:Blob,maxPixels=MAX_UPLOAD_IMAGE_PIXELS){
  if(!validImageBlob(file))throw new AppError('readImageSize.002')
  let task=headers.get(file)
  if(!task){
    task=file.arrayBuffer().then(buffer=>parseImageHeader(new Uint8Array(buffer),file.type))
    headers.set(file,task);void task.catch(()=>headers.delete(file))
  }
  const size=await task
  checkImagePixels(size,maxPixels)
  return size
}
