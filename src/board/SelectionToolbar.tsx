import type {ReactNode} from 'react'
import {HintGroup} from '../shared/ui/Hint'

export default function SelectionToolbar({children}:{children:ReactNode}){
  return <HintGroup><div className="selection-bar">{children}</div></HintGroup>
}
