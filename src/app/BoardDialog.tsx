import {useEffect,useRef} from 'react'
import {ArrowUpRight,Download,Image,Upload,X} from 'lucide-react'
import type {Board} from '../domain/model'
import {backgroundStyle,resolveBackground} from '../domain/styleCatalog'
import MountainLogo from '../shared/MountainLogo'
export type BoardModal='share'|'help'|'clear'|null
interface Props {modal:BoardModal;board:Board;exporting:boolean;exportImage:()=>Promise<void>;exportJson:()=>Promise<void>;onImport:()=>void;onClose:()=>void;onClear:()=>void;canClear:boolean}
export default function BoardDialog({modal,board,exporting,exportImage,exportJson,onImport,onClose,onClear,canClear}:Props){
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{if(modal)dialog.current?.showModal();else dialog.current?.close()},[modal])
  return     <dialog ref={dialog} className="modal" aria-label={modal==='clear'?'清空画布确认':modal==='share'?'分享与备份':'使用指南'} onCancel={()=>onClose()} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-controls"><button className="modal-close" onClick={()=>onClose()} aria-label="关闭"><X size={21}/></button></div>
      <div className="modal-scroll"><div className="modal-content">
      {modal==='clear'&&<><h2>清空当前画布？</h2><p className="modal-description">将移除画布上的 {board.items.length} 件物件和 {board.threads.length} 条连线，包括已锁定的物件。收藏库素材、收藏板名称与背景保留，可通过撤销恢复。</p><div className="clear-board-actions"><button type="button" autoFocus onClick={onClose}>取消</button><button type="button" className="clear-board-confirm" disabled={!canClear||exporting} onClick={onClear}>确认清空</button></div></>}
      {modal==='share' && <>
        <div className="eyebrow">MEMORIES ARE BETTER SHARED</div><h2>带走这份山野记忆</h2>
        <p className="modal-description">导出图片分享回忆，或用收藏板文件备份与恢复。</p>
        <div className="share-preview" style={{...backgroundStyle(board.backgroundStyle,1),color:resolveBackground(board.backgroundStyle).ink}}><MountainLogo/><span>{board.title}</span><small>{board.items.length} 件藏品 · {board.threads.length} 段记忆连接</small></div>
        <button className="export-option" onClick={()=>void exportImage()} disabled={exporting}><span className="export-icon"><Image size={23}/></span><span><strong>{exporting?'正在处理文件…':'导出高清图片'}</strong><small>全部藏品自动裁切 · 长边最高 4096 像素</small></span><ArrowUpRight size={18}/></button>
        <button className="export-option" onClick={()=>void exportJson()} disabled={exporting}><span className="export-icon"><Download size={23}/></span><span><strong>导出收藏板文件</strong><small>ZIP 压缩包 · 元数据与图片、GPX 分开保存</small></span><ArrowUpRight size={18}/></button>
        <button className="export-option" onClick={onImport} disabled={exporting}><span className="export-icon"><Upload size={23}/></span><span><strong>导入收藏板文件</strong><small>支持 ZIP 与旧版 JSON · 将替换当前收藏板</small></span><ArrowUpRight size={18}/></button>
        <p className="local-footnote">当前为本地收藏板，分享通过导出文件完成。</p>
      </>}
      {modal==='help' && <><div className="eyebrow">MAKE YOURSELF AT HOME</div><h2>你的山野记忆，由你摆放</h2><p className="modal-description">照片、奖牌和号码布，一根红线就能串起一段旅程。</p><div className="help-list">{[['手机手势','单指拖动藏品或空白处；双指缩放与平移画布'],['手机多选','长按物件或点多选按钮，点选或拖框选择；再次点击按钮退出'],['手机菜单','长按空白处开关吸附；编辑栏内单独滚动'],['拖动藏品','按住藏品拖拽，自由调整位置'],['串联记忆','选择「添加连线」，依次点击两件藏品'],['编辑藏品','手机点选后点击工具栏铅笔；电脑单击打开侧栏。组合需先取消组合，锁定需先解锁'],['批量排版','Ctrl + 拖动画框，底部可分组、对齐、分布和锁定'],['辅助线','在画布菜单开启吸附；拖动时按 Alt 暂停吸附'],['重叠选择','Alt + 单击，在重叠物件间循环选择'],['平移画布','向任意方向拖动空白处，或按住空格拖动'],['缩放画布','滚动鼠标滚轮，按 0 回到全景'],['撤销 / 重做','Ctrl + Z / Ctrl + Shift + Z'],['微调 / 删除','方向键移动选中藏品，Delete 删除']].map(([title,description])=><div key={title}><strong>{title}</strong><span>{description}</span></div>)}</div><p className="local-footnote">奖牌与 GPX 可从收藏库上传。编辑自动保存在当前浏览器，导出收藏板文件可备份完整记录。</p><button className="primary-button full-width" onClick={()=>onClose()}>开始收藏我的记忆 <ArrowUpRight size={18}/></button></>}
      </div></div>
    </dialog>
}
