import {useRef} from 'react'
import type {ReactNode} from 'react'
import {Plus,Camera,FileUp} from 'lucide-react'
import './assetPicker.css'

/** The empty preview or its corner action opens one accessible file input. */
export default function AssetPicker({children,hasAsset,label,inputLabel,accept,multiple=false,disabled=false,onFiles}:{children:ReactNode;hasAsset:boolean;label:string;inputLabel:string;accept:string;multiple?:boolean;disabled?:boolean;onFiles:(files:File[])=>void}){
  const input=useRef<HTMLInputElement>(null)
  const choose=()=>{if(!disabled)input.current?.click()}
  const isRoute=accept==='.gpx'
  const actionLabel=label.startsWith('更换')?(isRoute?'更换 GPX':'更换'):label
  return <div className={`record-upload asset-picker ${hasAsset?'has-asset':'is-empty'}`}>
    <input ref={input} hidden type="file" aria-label={inputLabel} accept={accept} multiple={multiple} disabled={disabled} onChange={event=>{
      const files=Array.from(event.currentTarget.files??[])
      event.currentTarget.value=''
      if(files.length)onFiles(files)
    }}/>
    <div className="asset-picker-preview">
      {children}
      {hasAsset?<button type="button" className="asset-picker-replace" aria-label={label} disabled={disabled} onClick={choose}>{isRoute?<FileUp size={15}/>:<Camera size={15}/>}<span>{actionLabel}</span></button>
        :<button type="button" className="asset-picker-empty" disabled={disabled} onClick={choose}><Plus size={26}/><span>{label}</span></button>}
    </div>
  </div>
}
