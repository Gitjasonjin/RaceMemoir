import {useRef,useState} from 'react'
import {CloudCheck,Library,Pencil,Share2} from 'lucide-react'
import type {Board} from '../domain/model'
import MountainLogo from '../shared/MountainLogo'
interface Props {board:Board;saved:string;saveError:string;saveFailed:boolean;onRetry:()=>void;onRename:(title:string)=>void;onLibrary:()=>void;onShare:()=>void;onHelp:()=>void}
export default function Topbar({board,saved,saveError,saveFailed,onRetry,onRename,onLibrary,onShare,onHelp}:Props){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(board.title),cancelled=useRef(false)
  const finish=()=>{
    const title=draft.trim()
    if(!cancelled.current&&title&&title!==board.title)onRename(title)
    cancelled.current=false;setEditing(false)
  }
  return <header className="topbar"><div className="brand"><MountainLogo/><span>山径线索板</span></div><span className="header-divider"/>
      <div className="board-name">{editing?<input autoFocus className="board-title board-title-input" aria-label="收藏板名称" maxLength={28} value={draft} onFocus={e=>e.currentTarget.select()} onChange={e=>setDraft(e.target.value)} onBlur={finish} onKeyDown={e=>{
        e.stopPropagation()
        if(e.nativeEvent.isComposing)return
        if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}
        if(e.key==='Escape'){e.preventDefault();cancelled.current=true;e.currentTarget.blur()}
      }}/>:<><span className="board-title">{board.title}</span><button type="button" className="board-name-edit" aria-label="修改收藏板名称" title="修改收藏板名称" onClick={()=>{cancelled.current=false;setDraft(board.title);setEditing(true)}}><Pencil size={15}/></button></>}</div>
      <div className="header-actions"><button className="share-button library-button" aria-label="打开收藏库" onClick={onLibrary}><Library size={18}/><span>收藏库</span></button><span className={`save-status ${saveError?'error':''}`} role="status" aria-live="polite" title={saveError||'画布和已提交的收藏文件保存在此浏览器；侧栏内容需点击保存'}><CloudCheck size={18}/><span>{saved}</span>{saveFailed&&<button onClick={onRetry}>重试</button>}</span><button className="share-button" aria-label="分享" onClick={onShare}><Share2 size={17}/><span>分享</span></button><span className="header-divider"/><button className="avatar" onClick={onHelp} aria-label="使用指南"><img src="/images/hiking.jpg" alt="山野旅人"/></button></div>
    </header>
}
