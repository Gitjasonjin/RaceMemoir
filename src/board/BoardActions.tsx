import {t as tr} from '../i18n/runtime.ts'
import {CalendarDays,LibraryBig,Palette} from 'lucide-react'
import type {RefObject} from 'react'
import './boardActions.css'

interface Props {decorationOpen:boolean;libraryOpen:boolean;onDecoration:()=>void;onLibrary:()=>void;yearControl?:{expanded:boolean;onToggle:()=>void;buttonRef:RefObject<HTMLButtonElement|null>}}

export default function BoardActions({decorationOpen,libraryOpen,onDecoration,onLibrary,yearControl}:Props){
  return <nav className="board-actions" aria-label={tr("BoardActions.003")} data-ui-overlay>
    <button type="button" aria-label={tr("DecorationPanel.028")} aria-expanded={decorationOpen} onClick={onDecoration}>
      <span className="board-action-icon"><Palette size={18}/></span><span className="board-action-label" aria-hidden="true"><span>{tr("DecorationPanel.028")}</span></span>
    </button>
    <button type="button" aria-label={tr("BoardActions.002")} aria-expanded={libraryOpen} onClick={onLibrary}>
      <span className="board-action-icon"><LibraryBig size={18}/></span><span className="board-action-label" aria-hidden="true"><span>{tr("BoardActions.001")}</span></span>
    </button>
    {yearControl&&<button type="button" ref={yearControl.buttonRef} className="board-action-calendar" aria-label={tr('yearCapsule.launcher')} aria-expanded={yearControl.expanded} aria-controls="board-year-selector" onClick={yearControl.onToggle}>
      <span className="board-action-icon"><CalendarDays size={19}/></span><span className="board-action-label" aria-hidden="true"><span>{tr('yearCapsule.launcher')}</span></span>
    </button>}
  </nav>
}
