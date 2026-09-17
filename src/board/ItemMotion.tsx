import type {ReactNode} from 'react'
import {pinPosition} from '../domain/model'
import type {Memory,PinStyle} from '../domain/model'

/** Animate only the artwork; canvas bounds and connection endpoints stay unchanged. */
export default function ItemMotion({item,pin,lifted,children}:{item:Memory;pin:PinStyle;lifted:boolean;children:ReactNode}){
 const anchor=pinPosition({...item,x:0,y:0,rotation:0},pin)
 return <div className={`memory-artwork ${lifted?'is-lifted':''}`} style={{transformOrigin:`${anchor.x}px ${anchor.y}px`}}>{children}</div>
}
