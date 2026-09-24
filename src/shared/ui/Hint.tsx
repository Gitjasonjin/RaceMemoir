import {Tooltip} from '@base-ui/react/tooltip'
import {createContext,useContext,useEffect,useMemo,useRef,useState} from 'react'
import type {ComponentPropsWithRef,ReactElement,ReactNode} from 'react'

type HintPayload={label:string;side:'top'|'right'}
const HintContext=createContext<Tooltip.Handle<HintPayload>|null>(null)

function HintPopup({label,side}:HintPayload){
  const [text,shortcut]=label.split(' · ')
  return <Tooltip.Portal><Tooltip.Positioner side={side} sideOffset={10} collisionPadding={8} positionMethod="fixed" className="ui-tooltip-positioner">
    <Tooltip.Popup role="tooltip" className="tool-tooltip selection-tooltip">
      <Tooltip.Arrow className="hint-arrow"/>
      <Tooltip.Viewport className="hint-viewport"><span className="hint-content"><span>{text}</span>{shortcut&&<kbd>{shortcut}</kbd>}</span></Tooltip.Viewport>
    </Tooltip.Popup>
  </Tooltip.Positioner></Tooltip.Portal>
}

/** One travelling tooltip per toolbar; Base UI retains focus, dismissal and touch handling. */
export function HintGroup({children}:{children:ReactNode}){
  const [handle]=useState(()=>Tooltip.createHandle<HintPayload>())
  return <Tooltip.Provider delay={400} closeDelay={80} timeout={300}>
    <HintContext.Provider value={handle}>
      {children}
      <Tooltip.Root handle={handle} disableHoverablePopup>
        {({payload})=><HintPopup label={payload?.label??''} side={payload?.side??'top'}/>}
      </Tooltip.Root>
    </HintContext.Provider>
  </Tooltip.Provider>
}

export function Hint({label,children,side='top',disabled=false}:{label:string;children:ReactElement;side?:'top'|'right';disabled?:boolean}){
  const handle=useContext(HintContext),trigger=useRef<HTMLButtonElement>(null)
  const payload=useMemo(()=>({label,side}),[label,side])
  useEffect(()=>{
    if(disabled&&trigger.current?.hasAttribute('data-popup-open'))handle?.close()
  },[disabled,handle])
  if(handle)return <Tooltip.Trigger ref={trigger} handle={handle} payload={payload} disabled={disabled} render={children}/>
  return <Tooltip.Root disabled={disabled} disableHoverablePopup>
    <Tooltip.Trigger render={children} delay={400}/>
    <HintPopup label={label} side={side}/>
  </Tooltip.Root>
}

export function HintButton({hint,side,...props}:ComponentPropsWithRef<'button'>&{hint?:string;side?:'top'|'right';'data-tooltip'?:string}){
  const label=hint||props['data-tooltip']||props['aria-label']
  const button=<button type="button" {...props}/>
  return label?<Hint label={label} side={side} disabled={props.disabled||props['aria-expanded']===true}>{button}</Hint>:button
}
