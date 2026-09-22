import type {CSSProperties,ReactNode} from 'react'
import {pinPosition} from '../domain/model'
import type {Memory,PinStyle} from '../domain/model'

/** Animate only the artwork; canvas bounds and connection endpoints stay unchanged. */
export default function ItemMotion({item,pin,lifted,children}:{item:Memory;pin:PinStyle;lifted:boolean;children:ReactNode}){
 const anchor=pinPosition({...item,x:0,y:0,rotation:0},pin)
 const depth=item.kind==='medal'?12:item.kind==='sticker'?1:4,angle=item.rotation*Math.PI/180
 const style={transformOrigin:`${anchor.x}px ${anchor.y}px`,'--light-shadow-x':`${Math.sin(angle)*depth}px`,'--light-shadow-y':`${Math.cos(angle)*depth}px`,'--light-shadow-blur':`${item.kind==='medal'?6:2}px`} as CSSProperties
 return <div className={`memory-artwork ${lifted?'is-lifted':''}`} style={style}>{children}</div>
}
