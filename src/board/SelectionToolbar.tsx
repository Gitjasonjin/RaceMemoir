import type {ReactNode} from 'react'

export default function SelectionToolbar({children}:{children:ReactNode}){
  return <div className="selection-bar">{children}</div>
}
