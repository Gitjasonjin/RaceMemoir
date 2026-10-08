import {deflateSync} from 'node:zlib'

export function pngChunk(type:string,data:Uint8Array){
  const result=Buffer.alloc(data.length+12)
  result.writeUInt32BE(data.length);result.write(type,4);result.set(data,8)
  let crc=0xffffffff
  for(const byte of result.subarray(4,-4)){
    crc^=byte
    for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)
  }
  result.writeUInt32BE((crc^0xffffffff)>>>0,result.length-4)
  return result
}

/** Real small PNG; patch its IHDR explicitly for hostile header / mocked decoder tests. */
export function pngBytes(width=1,height=1,color=0){
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6
  const pixels=Buffer.alloc((width*4+1)*height,color)
  for(let row=0;row<height;row++)pixels[row*(width*4+1)]=0
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(pixels)),pngChunk('IEND',new Uint8Array())])
}
export function pngBlob(width=1,height=1,color=0){return new Blob([pngBytes(width,height,color)],{type:'image/png'})}
export function headerPng(width:number,height:number){
  const bytes=pngBytes(),ihdr=Buffer.from(bytes.subarray(16,29))
  ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4)
  bytes.set(pngChunk('IHDR',ihdr),8)
  return new Blob([bytes],{type:'image/png'})
}
