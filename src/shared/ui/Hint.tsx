import {Tooltip} from '@base-ui/react/tooltip'
import type {ComponentPropsWithRef,ReactElement} from 'react'

export function Hint({label,children,side='top',disabled=false}:{label:string;children:ReactElement;side?:'top'|'right';disabled?:boolean}){
  return <Tooltip.Root disabled={disabled}>
    <Tooltip.Trigger render={children} delay={350}/>
    <Tooltip.Portal><Tooltip.Positioner side={side} sideOffset={10} collisionPadding={8} className="ui-tooltip-positioner">
      <Tooltip.Popup role="tooltip" className="tool-tooltip selection-tooltip">{label}</Tooltip.Popup>
    </Tooltip.Positioner></Tooltip.Portal>
  </Tooltip.Root>
}

export function HintButton({hint,side,...props}:ComponentPropsWithRef<'button'>&{hint?:string;side?:'top'|'right';'data-tooltip'?:string}){
  const label=hint||props['data-tooltip']||props['aria-label']
  const button=<button type="button" {...props}/>
  return label?<Hint label={label} side={side} disabled={props.disabled||props['aria-expanded']===true}>{button}</Hint>:button
}
