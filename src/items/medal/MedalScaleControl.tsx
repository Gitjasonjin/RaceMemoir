import {t as tr} from '../../i18n/runtime.ts'
import type {ReactNode} from 'react'

export default function MedalScaleControl({value=1,onChange,disabled=false,label=tr("MedalScaleControl.001"),resetLabel=tr("MedalScaleControl.002"),children}:{value?:number;onChange:(scale:number)=>void;disabled?:boolean;label?:string;resetLabel?:string;children?:ReactNode}){
  return <>
    <label className="field-label">{label} · {Math.round(value*100)}%<input aria-label={tr("MedalScaleControl.001")} type="range" min={40} max={180} step={5} value={value*100} disabled={disabled} onChange={e=>onChange(Number(e.target.value)/100)}/></label>
    <div className="record-actions"><button type="button" disabled={disabled} onClick={()=>onChange(1)}>{resetLabel}</button>{children}</div>
  </>
}
