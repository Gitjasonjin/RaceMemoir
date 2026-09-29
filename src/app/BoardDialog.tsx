import {t as tr} from '../i18n/runtime.ts'
import {useRef} from 'react'
import {Dialog} from '@base-ui/react/dialog'
import {ArrowUpRight,Download,Image,Upload,X} from 'lucide-react'
import type {Board} from '../domain/model'
import MaterialPreview from '../shared/MaterialPreview'
import MountainLogo from '../shared/MountainLogo'
export type BoardModal='share'|'help'|'clear'|null
interface Props {modal:BoardModal;board:Board;exporting:boolean;exportImage:()=>Promise<void>;exportJson:()=>Promise<void>;onImport:()=>void;onClose:()=>void;onClear:()=>void;canClear:boolean}
export default function BoardDialog({modal,board,exporting,exportImage,exportJson,onImport,onClose,onClear,canClear}:Props){
  const cancel=useRef<HTMLButtonElement>(null)
  return <Dialog.Root open={modal!==null} onOpenChange={open=>{if(!open)onClose()}}>
    <Dialog.Portal><Dialog.Backdrop className="ui-dialog-backdrop"/><Dialog.Viewport className="ui-dialog-viewport">
    <Dialog.Popup className="modal" data-ui-overlay initialFocus={modal==='clear'?cancel:undefined}>
      <div className="modal-controls"><Dialog.Close className="modal-close" aria-label={tr("BoardDialog.045")}><X size={21}/></Dialog.Close></div>
      <div className="modal-scroll"><div className="modal-content">
      {modal==='clear'&&<><Dialog.Title render={<h2/>}>{tr("BoardDialog.044")}</Dialog.Title><Dialog.Description className="modal-description">{tr("BoardDialog.043",{v1:board.items.length,v2:board.threads.length})}</Dialog.Description><div className="clear-board-actions"><button type="button" ref={cancel} onClick={onClose}>{tr("BoardDialog.042")}</button><button type="button" className="clear-board-confirm" disabled={!canClear||exporting} onClick={onClear}>{tr("BoardDialog.041")}</button></div></>}
      {modal==='share' && <>
        <div className="eyebrow">MEMORIES ARE BETTER SHARED</div><Dialog.Title render={<h2/>}>{tr("BoardDialog.040")}</Dialog.Title>
        <Dialog.Description className="modal-description">{tr("BoardDialog.039")}</Dialog.Description>
        <MaterialPreview className="share-preview" id={board.backgroundStyle} scale={1}><MountainLogo/><span>{board.title}</span><small>{tr("BoardDialog.038",{v1:board.items.length,v2:board.threads.length})}</small></MaterialPreview>
        <button className="export-option" onClick={()=>void exportImage()} disabled={exporting}><span className="export-icon"><Image size={23}/></span><span><strong>{exporting?tr("BoardDialog.037"):tr("BoardDialog.036")}</strong><small>{tr("BoardDialog.035")}</small></span><ArrowUpRight size={18}/></button>
        <button className="export-option" onClick={()=>void exportJson()} disabled={exporting}><span className="export-icon"><Download size={23}/></span><span><strong>{tr("BoardDialog.034")}</strong><small>{tr("BoardDialog.033")}</small></span><ArrowUpRight size={18}/></button>
        <button className="export-option" onClick={onImport} disabled={exporting}><span className="export-icon"><Upload size={23}/></span><span><strong>{tr("BoardDialog.032")}</strong><small>{tr("BoardDialog.031")}</small></span><ArrowUpRight size={18}/></button>
        <p className="local-footnote">{tr("BoardDialog.030")}</p>
      </>}
      {modal==='help' && <><div className="eyebrow">MAKE YOURSELF AT HOME</div><Dialog.Title render={<h2/>}>{tr("BoardDialog.029")}</Dialog.Title><Dialog.Description className="modal-description">{tr("BoardDialog.028")}</Dialog.Description><div className="help-list">{[[tr("BoardDialog.027"),tr("BoardDialog.026")],[tr("BoardDialog.025"),tr("BoardDialog.024")],[tr("BoardDialog.023"),tr("BoardDialog.022")],[tr("BoardDialog.021"),tr("BoardDialog.020")],[tr("BoardDialog.019"),tr("BoardDialog.018")],[tr("BoardDialog.017"),tr("BoardDialog.016")],[tr("BoardDialog.015"),tr("BoardDialog.014")],[tr("BoardDialog.013"),tr("BoardDialog.012")],[tr("BoardDialog.011"),tr("BoardDialog.010")],[tr("BoardDialog.009"),tr("BoardDialog.008")],[tr("BoardDialog.007"),tr("BoardDialog.006")],[tr("BoardDialog.005"),'Ctrl + Z / Ctrl + Shift + Z'],[tr("BoardDialog.004"),tr("BoardDialog.003")]].map(([title,description])=><div key={title}><strong>{title}</strong><span>{description}</span></div>)}</div><p className="local-footnote">{tr("BoardDialog.002")}</p><button className="primary-button full-width" onClick={()=>onClose()}>{tr("BoardDialog.001")}<ArrowUpRight size={18}/></button></>}
      </div></div>
    </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
    </Dialog.Root>
}
