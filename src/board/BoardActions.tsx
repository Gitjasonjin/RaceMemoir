import {LibraryBig,Palette} from 'lucide-react'
import './boardActions.css'

interface Props {decorationOpen:boolean;libraryOpen:boolean;onDecoration:()=>void;onLibrary:()=>void}

export default function BoardActions({decorationOpen,libraryOpen,onDecoration,onLibrary}:Props){
  return <nav className="board-actions" aria-label="收藏板设置与收藏库">
    <button type="button" aria-label="装饰样式" aria-expanded={decorationOpen} onClick={onDecoration}>
      <span className="board-action-icon"><Palette size={18}/></span><span className="board-action-label" aria-hidden="true"><span>装饰样式</span></span>
    </button>
    <button type="button" aria-label="打开收藏库" aria-expanded={libraryOpen} onClick={onLibrary}>
      <span className="board-action-icon"><LibraryBig size={18}/></span><span className="board-action-label" aria-hidden="true"><span>收藏库</span></span>
    </button>
  </nav>
}
