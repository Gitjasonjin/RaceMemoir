import {Inflate} from 'fflate'
import type {Unzipped} from 'fflate'

export const ZIP_LIMIT=80*1024*1024
export const ZIP_TIMEOUT_MS=15_000
const META_LIMIT=16*1024*1024,ASSET_LIMIT=20*1024*1024
const INPUT_CHUNK=1024,RATIO=200,RATIO_SLACK=64*1024
const invalid=():never=>{throw new Error('Invalid or oversized ZIP')}

// ZIP32 only: exports fit well below ZIP64 limits. Read the directory ourselves
// so neither allocation nor inflation trusts originalSize as an output hint.
export function extractBoundedZip(bytes:Uint8Array):Unzipped{
  const deadline=performance.now()+ZIP_TIMEOUT_MS
  const checkTime=()=>{if(performance.now()>deadline)invalid()}
  if(bytes.length>ZIP_LIMIT||bytes.length<22)invalid()
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const range=(offset:number,length:number)=>{if(offset<0||offset+length>bytes.length)invalid()}
  const u16=(offset:number)=>{range(offset,2);return view.getUint16(offset,true)}
  const u32=(offset:number)=>{range(offset,4);return view.getUint32(offset,true)}
  let end=bytes.length-22
  while(end>=Math.max(0,bytes.length-65557)){
    if(u32(end)===0x06054b50&&end+22+u16(end+20)===bytes.length)break
    end--
  }
  if(end<Math.max(0,bytes.length-65557)||u16(end+4)||u16(end+6))invalid()
  const count=u16(end+10),directory=u32(end+16),directorySize=u32(end+12)
  if(!count||count>10000||u16(end+8)!==count||directory+directorySize!==end)invalid()
  const entries:{name:string;start:number;stop:number;offset:number;method:number;size:number;crc:number;compressed:number}[]=[]
  const names=new Set<string>(),decoder=new TextDecoder('utf-8',{fatal:true})
  let cursor=directory,declaredTotal=0,compressedTotal=0
  for(let i=0;i<count;i++){
    checkTime()
    if(u32(cursor)!==0x02014b50)invalid()
    const flags=u16(cursor+8),method=u16(cursor+10),crc=u32(cursor+16)
    const compressed=u32(cursor+20),size=u32(cursor+24),nameLength=u16(cursor+28)
    const next=cursor+46+nameLength+u16(cursor+30)+u16(cursor+32),offset=u32(cursor+42)
    if(next>end||u16(cursor+34)||flags&~0x080e||!(method===0||method===8))invalid()
    range(cursor+46,nameLength)
    const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength))
    if(!(name==='manifest.json'||/^assets\/[a-f0-9]{64}\.(png|jpg|webp|gpx|xml)$/.test(name))||names.has(name))invalid()
    names.add(name)
    declaredTotal+=size;compressedTotal+=compressed
    if(size>(name==='manifest.json'?META_LIMIT:ASSET_LIMIT)||declaredTotal>ZIP_LIMIT)invalid()
    if(u32(offset)!==0x04034b50||u16(offset+6)!==flags||u16(offset+8)!==method)invalid()
    const localNameLength=u16(offset+26),start=offset+30+localNameLength+u16(offset+28)
    if(offset>=directory||start+compressed>directory||localNameLength!==nameLength)invalid()
    if(decoder.decode(bytes.subarray(offset+30,offset+30+localNameLength))!==name)invalid()
    if(!(flags&8)&&(u32(offset+14)!==crc||u32(offset+18)!==compressed||u32(offset+22)!==size))invalid()
    let stop=start+compressed
    if(flags&8){
      const descriptor=stop+(u32(stop)===0x08074b50?4:0)
      if(u32(descriptor)!==crc||u32(descriptor+4)!==compressed||u32(descriptor+8)!==size)invalid()
      stop=descriptor+12
    }
    if(stop>directory)invalid()
    entries.push({name,start,stop,offset,method,size,crc,compressed})
    cursor=next
  }
  if(cursor!==end||!names.has('manifest.json'))invalid()
  // Reject overlapping entries (including local headers and data descriptors).
  let previousEnd=0
  for(const entry of [...entries].sort((a,b)=>a.offset-b.offset)){
    if(entry.offset<previousEnd)invalid()
    previousEnd=entry.stop
  }
  const result:Unzipped=Object.create(null)
  let total=0
  for(const entry of entries){
    const chunks:Uint8Array[]=[],inputLength=entry.compressed,payloadEnd=entry.start+inputLength
    let actual=0,crc=0xffffffff,finished=false
    const emit=(chunk:Uint8Array,final:boolean)=>{
      checkTime()
      actual+=chunk.length;total+=chunk.length
      if(actual>entry.size||actual>(entry.name==='manifest.json'?META_LIMIT:ASSET_LIMIT)||total>ZIP_LIMIT||actual>inputLength*RATIO+RATIO_SLACK||total>compressedTotal*RATIO+RATIO_SLACK)invalid()
      for(const byte of chunk)crc=crcTable[(crc^byte)&255]^(crc>>>8)
      chunks.push(chunk);finished=final
    }
    if(entry.method===0){
      for(let p=entry.start;p<payloadEnd;p+=INPUT_CHUNK)emit(bytes.slice(p,Math.min(p+INPUT_CHUNK,payloadEnd)),p+INPUT_CHUNK>=payloadEnd)
      if(!inputLength)emit(new Uint8Array(),true)
    }else{
      const inflater=new Inflate(emit)
      // Each push is bounded: even maximal DEFLATE expansion of 1 KiB input
      // produces roughly 1 MiB before the actual-byte guard runs. Never push
      // an entire attacker-controlled stream in one call.
      for(let p=entry.start;p<payloadEnd;p+=INPUT_CHUNK){
        checkTime()
        inflater.push(bytes.subarray(p,Math.min(p+INPUT_CHUNK,payloadEnd)),p+INPUT_CHUNK>=payloadEnd)
      }
    }
    if(!finished||actual!==entry.size||((crc^0xffffffff)>>>0)!==entry.crc)invalid()
    const output=new Uint8Array(actual)
    let offset=0
    for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}
    result[entry.name]=output
  }
  return result
}

const crcTable=Uint32Array.from({length:256},(_,n)=>{
  for(let bit=0;bit<8;bit++)n=n&1?0xedb88320^(n>>>1):n>>>1
  return n>>>0
})
