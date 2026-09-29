import {t as tr} from '../i18n/runtime.ts'
import {LibraryBig,Palette} from 'lucide-react'
import './boardActions.css'

interface Props {decorationOpen:boolean;libraryOpen:boolean;onDecoration:()=>void;onLibrary:()=>void}

export default function BoardActions({decorationOpen,libraryOpen,onDecoration,onLibrary}:Props){
  return <nav className="board-actions" aria-label={tr("BoardActions.003")}>
    <button type="button" aria-label={tr("DecorationPanel.028")} aria-expanded={decorationOpen} onClick={onDecoration}>
      <span className="board-action-icon"><Palette size={18}/></span><span className="board-action-label" aria-hidden="true"><span>{tr("DecorationPanel.028")}</span></span>
    </button>
    <button type="button" aria-label={tr("BoardActions.002")} aria-expanded={libraryOpen} onClick={onLibrary}>
      <span className="board-action-icon"><LibraryBig size={18}/></span><span className="board-action-label" aria-hidden="true"><span>{tr("BoardActions.001")}</span></span>
    </button>
  </nav>
}
