import {Menu} from '@base-ui/react/menu'
import {useState} from 'react'
import type {ReactNode} from 'react'
import {Hint} from './Hint'

export function ActionMenu({label,icon,children,className=''}:{label:string;icon:ReactNode;children:ReactNode;className?:string}){
  const [open,setOpen]=useState(false)
  return <div className="layer-control"><Menu.Root modal={false} open={open} onOpenChange={setOpen}>
    <Hint label={label} disabled={open}><Menu.Trigger aria-label={label}>{icon}</Menu.Trigger></Hint>
    <Menu.Portal><Menu.Positioner side="top" sideOffset={14} collisionPadding={8} className="ui-menu-positioner">
      <Menu.Popup className={`layer-popover ui-action-menu ${className}`} aria-label={label} data-ui-overlay>{children}</Menu.Popup>
    </Menu.Positioner></Menu.Portal>
  </Menu.Root></div>
}

export function ActionMenuItem({children,...props}:Omit<Menu.Item.Props,'render'|'nativeButton'>){
  return <Menu.Item {...props} nativeButton render={<button type="button"/>}>{children}</Menu.Item>
}
