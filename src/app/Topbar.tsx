import {t as tr} from '../i18n/runtime.ts'
import {useRef,useState} from 'react'
import {CloudCheck,Pencil,Share2} from 'lucide-react'
import type {Board} from '../domain/model'
import MountainLogo from '../shared/MountainLogo'
import LanguageMenu from '../i18n/LanguageMenu'
interface Props {board:Board;saved:string;saveError:string;saveFailed:boolean;onRetry:()=>void;onRename:(title:string)=>void;onShare:()=>void}
export default function Topbar({board,saved,saveError,saveFailed,onRetry,onRename,onShare}:Props){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(board.title),cancelled=useRef(false)
  const finish=()=>{
    const title=draft.trim()
    if(!cancelled.current&&title&&title!==board.title)onRename(title)
    cancelled.current=false;setEditing(false)
  }
  return <header className="topbar"><div className="brand"><MountainLogo/><span>{tr("Topbar.005")}</span></div><span className="header-divider"/>
      <div className="board-name">{editing?<input autoFocus className="board-title board-title-input" aria-label={tr("Topbar.004")} maxLength={28} value={draft} onFocus={e=>e.currentTarget.select()} onChange={e=>setDraft(e.target.value)} onBlur={finish} onKeyDown={e=>{
        e.stopPropagation()
        if(e.nativeEvent.isComposing)return
        if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}
        if(e.key==='Escape'){e.preventDefault();cancelled.current=true;e.currentTarget.blur()}
      }}/>:<><span className="board-title">{board.title}</span><button type="button" className="board-name-edit" aria-label={tr("Topbar.003")} title={tr("Topbar.003")} onClick={()=>{cancelled.current=false;setDraft(board.title);setEditing(true)}}><Pencil size={15}/></button></>}</div>
      <div className="header-actions"><span className={`save-status ${saveError?'error':''}`} role="status" aria-live="polite" title={saveError||tr("Topbar.002")}><CloudCheck size={18}/><span>{saved}</span>{saveFailed&&<button onClick={onRetry}>{tr("App.061")}</button>}</span><LanguageMenu/><button className="share-button" aria-label={tr("Topbar.001")} onClick={onShare}><Share2 size={17}/><span>{tr("Topbar.001")}</span></button></div>
    </header>
}
