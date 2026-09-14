import PhotoComposition from './PhotoComposition'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { MousePointer2, ImagePlus, Medal, RectangleEllipsis, Spline, Plus, Minus, Maximize, Share2, ChevronDown, CloudCheck, Undo2, Redo2, StickyNote, X, Check, Download, RotateCcw, RotateCw, Copy, Trash2, Pencil, Move, Keyboard, Upload, Image, ArrowUpRight, Palette } from 'lucide-react'
import { toPng } from 'html-to-image'
import Artwork, { MountainLogo } from './Artwork'
import { STORAGE_KEY, loadBoard, pinPosition, createMemory, getDecorations, hasPin, changeDecoration, setTapePin } from './model'
import type { Board, Kind, Memory } from './model'
import DecorationPanel, { ThreadStroke } from './DecorationPanel'
import { contentBounds, fitCamera, visibleBounds, unionBounds, exportSize, screenToWorld } from './canvas'
import { useRecords } from './useRecords'
import { recordFor, displayMemory } from './records'
import type { CollectionRecord } from './records'
import { makeArchive, readArchive } from './recordArchive'
import RecordPanel from './RecordPanel'
import type { RecordPanelMode } from './RecordPanel'
import { Library, Route } from 'lucide-react'

type View = { x: number; y: number; scale: number }
type Gesture = { type: 'item' | 'pan'; id?: string; pointerId: number; startX: number; startY: number; x: number; y: number; cameraX: number; cameraY: number; before: Board; moved: boolean }
type Modal = 'share' | 'help' | null
const kinds: {kind: Kind; label: string; icon: typeof ImagePlus}[] = [{kind:'photo',label:'照片',icon:ImagePlus},{kind:'medal',label:'奖牌',icon:Medal},{kind:'bib',label:'号码布',icon:RectangleEllipsis},{kind:'note',label:'便签',icon:StickyNote},{kind:'map',label:'路线',icon:Route}]
const samplePhotos = ['/images/mountain.jpg', '/images/hiking.jpg', '/images/sunrise.jpg']
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function App() {
  const [board, setBoard] = useState<Board>(loadBoard)
  const boardRef = useRef(board); boardRef.current = board
  const library = useRecords(board, next => {boardRef.current=next;setBoard(next)})
  const [recordPanel,setRecordPanel] = useState<RecordPanelMode|null>(null)
  const [memoryPanel,setMemoryPanel] = useState<'add'|'edit'|null>(null)
  const memoryEditingId = useRef<string|null>(null)
  const fileOperation = useRef(false)
  const [view, setView] = useState<View>({x:0,y:0,scale:1})
  const viewRef = useRef(view); viewRef.current = view
  const viewport = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({width:1440,height:900})
  const scene = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const pointer = useRef({x:0,y:0})
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [decorationOpen, setDecorationOpen] = useState(false)
  const [decorationScope, setDecorationScope] = useState<'board' | 'selection'>('board')
  const [tool, setTool] = useState<'select'|'connect'>('select')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{x:number;y:number}|null>(null)
  const [space, setSpace] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<Kind>('photo')
  const [draft, setDraft] = useState({title:'',variant:'',image:samplePhotos[0],number:'0826'})
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState('')
  const [saved, setSaved] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [historyTick, setHistoryTick] = useState(0)
  const undoStack = useRef<Board[]>([]), redoStack = useRef<Board[]>([])
  const inputFile = useRef<HTMLInputElement>(null)
  const selectedItem = board.items.find(item => item.id === selected)
  const decorations = getDecorations(board)
  useEffect(()=>{
    const focused=document.activeElement
    if(focused instanceof SVGElement && focused.matches('.threads [role=button]') && focused.getAttribute('aria-pressed')!=='true')focused.blur()
  },[selectedThread])

  const remember = useCallback((previous: Board) => { undoStack.current = [...undoStack.current.slice(-49), structuredClone(previous)]; redoStack.current = []; setHistoryTick(n => n + 1) }, [])
  const commit = useCallback((next: Board) => { remember(boardRef.current); boardRef.current = next; setBoard(next) }, [remember])
  const undo = useCallback(() => { const previous = undoStack.current.pop(); if (previous) { redoStack.current.push(boardRef.current); boardRef.current = previous; setBoard(previous); setSelected(null); setSelectedThread(null); setHistoryTick(n=>n+1) } }, [])
  const redo = useCallback(() => { const next = redoStack.current.pop(); if (next) { undoStack.current.push(boardRef.current); boardRef.current = next; setBoard(next); setSelected(null); setSelectedThread(null); setHistoryTick(n=>n+1) } }, [])
  const fit = useCallback(() => { if (!viewport.current) return; const {width,height} = viewport.current.getBoundingClientRect(); setView(fitCamera(contentBounds(boardRef.current.items),width,height)) }, [])
  useEffect(() => {
    const el=viewport.current; if(!el)return
    let previous={width:el.clientWidth,height:el.clientHeight}
    setViewportSize(previous); fit()
    const observer = new ResizeObserver(()=>{
      const next={width:el.clientWidth,height:el.clientHeight}
      setView(v=>({...v,x:v.x+(next.width-previous.width)/2,y:v.y+(next.height-previous.height)/2}))
      previous=next;setViewportSize(next)
    })
    observer.observe(el);return ()=>observer.disconnect()
  }, [fit])
  useEffect(() => {
    if (dragging || !library.ready) return
    setSaved('保存中…')
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); setSaved(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})); setSaveError(false) } catch { setSaved('暂未保存'); setSaveError(true) } }, 450)
    return () => clearTimeout(timer)
  }, [board, dragging, library.ready])
  useEffect(() => { if (!toast) return; const timer = setTimeout(()=>setToast(''),3200); return () => clearTimeout(timer) }, [toast])
  useEffect(() => { if(modal) dialog.current?.showModal(); else dialog.current?.close() }, [modal])
  useEffect(() => { if (!menu) return; const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }; window.addEventListener('pointerdown',close); return () => window.removeEventListener('pointerdown',close) }, [menu])

  const removeSelected = useCallback(() => {
    const current = boardRef.current
    if (selected) commit({...current,items:current.items.filter(i=>i.id!==selected),threads:current.threads.filter(t=>t.from!==selected && t.to!==selected)})
    else if (selectedThread) commit({...current,threads:current.threads.filter(t=>t.id!==selectedThread)})
    setSelected(null); setSelectedThread(null)
  }, [commit, selected, selectedThread])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!library.ready || fileOperation.current || (e.target instanceof HTMLElement && (e.target.closest('input,textarea,select,[contenteditable],[data-record-panel]') || modal))) return
      if (e.code === 'Space' && !(e.target instanceof HTMLElement && e.target.closest('button,[data-decoration-panel]'))) { e.preventDefault(); setSpace(true) }
      if (e.key === 'Escape') { setConnecting(null); setTool('select'); setSelected(null); setSelectedThread(null); setMenu(false); setDecorationOpen(false);setRecordPanel(null);setMemoryPanel(null) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if(e.shiftKey) redo(); else undo() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected() }
      if (e.key.toLowerCase() === 'v') { setTool('select'); setConnecting(null) }
      if (e.key.toLowerCase() === 'c') { setTool('connect'); setSelected(null); setSelectedThread(null) }
      if (e.key === '0') fit()
      if (selected && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault(); const d = e.shiftKey ? 10 : 2
        commit({...boardRef.current,items:boardRef.current.items.map(i=>i.id===selected?{...i,x:i.x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),y:i.y+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0)}:i)})
      }
    }
    const up = (e: KeyboardEvent) => { if(e.code === 'Space') setSpace(false) }
    const blur = () => {
      setSpace(false)
      const g=gesture.current
      if(g?.type==='item' && g.moved)setBoard(g.before)
      gesture.current=null;setDragging(false)
    }
    window.addEventListener('keydown',down); window.addEventListener('keyup',up); window.addEventListener('blur',blur)
    return () => {window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}
  }, [modal, undo, redo, removeSelected, fit, selected, commit, library.ready])

  const zoomAt = useCallback((scale: number, px: number, py: number) => { if(gesture.current)return;setView(v=>{ const next = clamp(scale,Math.min(.05,v.scale),4); return {scale:next,x:px-(px-v.x)*next/v.scale,y:py-(py-v.y)*next/v.scale} }) }, [])
  const zoom = (factor: number) => { const el=viewport.current; if(el) zoomAt(view.scale*factor,el.clientWidth/2,el.clientHeight/2) }
  useEffect(() => {
    const el = viewport.current; if(!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const rect=el.getBoundingClientRect(); zoomAt(viewRef.current.scale*Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top) }
    el.addEventListener('wheel',wheel,{passive:false}); return ()=>el.removeEventListener('wheel',wheel)
  }, [zoomAt])

  useEffect(()=>{
    if(!dragging || gesture.current?.type!=='item')return
    let frame=0, previous=performance.now()
    const tick=(time:number)=>{
      const g=gesture.current, el=viewport.current
      if(!g || g.type!=='item' || !el)return
      const rect=el.getBoundingClientRect(), p=pointer.current
      const dt=Math.min((time-previous)/1000,.04);previous=time
      const edgeSpeed=(position:number,size:number)=>position<48?Math.min(1,(48-position)/48)*650:position>size-48?-Math.min(1,(position-size+48)/48)*650:0
      const dx=edgeSpeed(p.x-rect.left,rect.width)*dt,dy=edgeSpeed(p.y-rect.top,rect.height)*dt
      if(dx||dy){
        const v={...viewRef.current,x:viewRef.current.x+dx,y:viewRef.current.y+dy}
        viewRef.current=v;setView(v)
        setBoard(b=>({...b,items:b.items.map(i=>i.id===g.id?{...i,x:g.x+(p.x-g.startX+g.cameraX-v.x)/v.scale,y:g.y+(p.y-g.startY+g.cameraY-v.y)/v.scale}:i)}))
      }
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame)
  },[dragging])

  const connectItem = (id: string) => {
    setSelected(null); setSelectedThread(null)
    if (!connecting) {setConnecting(id); return}
    if (connecting === id) {setConnecting(null); return}
    if (board.threads.some(t=>(t.from===connecting && t.to===id)||(t.to===connecting && t.from===id))) {setToast('这两段记忆已经连在一起了'); return}
    commit({...board,threads:[...board.threads,{id:crypto.randomUUID(),from:connecting,to:id}]}); setConnecting(id); setToast('红线已连接，继续选择下一段记忆')
  }
  const startGesture = (e: ReactPointerEvent, item?: Memory) => {
    if (e.button !== 0 && e.button !== 1) return
    if (gesture.current) return
    if (tool === 'connect' && item && !space) {e.stopPropagation(); connectItem(item.id); return}
    e.stopPropagation(); e.preventDefault()
    const isPan = !item || space || e.button === 1
    if (!isPan && item) {setSelected(item.id); setSelectedThread(null)}
    else if(!space) {setSelected(null); setSelectedThread(null)}
    pointer.current={x:e.clientX,y:e.clientY}
    gesture.current = {type:isPan?'pan':'item',id:item?.id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:isPan?view.x:item!.x,y:isPan?view.y:item!.y,cameraX:view.x,cameraY:view.y,before:structuredClone(board),moved:false}
    viewport.current?.setPointerCapture(e.pointerId)
  }
  const moveGesture = (e: ReactPointerEvent) => {
    pointer.current={x:e.clientX,y:e.clientY}
    const rect=viewport.current!.getBoundingClientRect()
    if(tool==='connect') setCursor({x:(e.clientX-rect.left-view.x)/view.scale,y:(e.clientY-rect.top-view.y)/view.scale})
    const g=gesture.current; if(!g || g.pointerId!==e.pointerId) return
    const dx=e.clientX-g.startX,dy=e.clientY-g.startY
    if(!g.moved && Math.hypot(dx,dy)<3) return
    g.moved=true; setDragging(true)
    if(g.type==='pan') setView(v=>({...v,x:g.x+dx,y:g.y+dy}))
    else {const v=viewRef.current;setBoard(b=>({...b,items:b.items.map(i=>i.id===g.id?{...i,x:g.x+(dx+g.cameraX-v.x)/v.scale,y:g.y+(dy+g.cameraY-v.y)/v.scale}:i)}))}
  }
  const endGesture = (cancel = false) => {
    const g=gesture.current; if(!g) return
    if(g.type==='item' && g.moved) {if(cancel) setBoard(g.before); else remember(g.before)}
    if(g.type==='item' && !g.moved && !cancel) {
      const item=boardRef.current.items.find(i=>i.id===g.id)
      if(item?.recordId){setMemoryPanel(null);setRecordPanel({mode:'detail',id:item.recordId});setDecorationOpen(false)}
    }
    if(g.type==='pan'&&!g.moved&&!cancel){setRecordPanel(null);setMemoryPanel(null);setDecorationOpen(false)}
    gesture.current=null; setDragging(false)
  }

  const openAdd = (nextKind: Kind) => {
    setMenu(false);setModal(null);setMemoryPanel(null);setRecordPanel(null);setDecorationOpen(false)
    if(nextKind==='medal'||nextKind==='map'||nextKind==='photo'){setModal(null);setDecorationOpen(false);setRecordPanel({mode:nextKind==='map'?'route':nextKind==='photo'?'photo':'medal'});return}
    setKind(nextKind);setDraft({title:'',variant:nextKind==='note'?'yellow':'green',image:samplePhotos[0],number:'0826'});setMemoryPanel('add')
  }
  const editItem = (item: Memory) => {
    setSelected(item.id);memoryEditingId.current=item.id;setMemoryPanel(null);setRecordPanel(null);setDecorationOpen(false)
    if(item.recordId){setRecordPanel({mode:'detail',id:item.recordId});setDecorationOpen(false);return}
    setKind(item.kind);setDraft({title:item.title,variant:item.variant||'',image:item.image||samplePhotos[0],number:item.number||'0826'});setMemoryPanel('edit')
  }
  const openEdit = () => {if(selectedItem)editItem(selectedItem)}
  const addRecord = async (record: CollectionRecord,layout?:Partial<Memory>) => {
    const current=boardRef.current
    if(current.items.length>=500){setToast('每块收藏板最多放置 500 件藏品');return}
    const item=createMemory(record.kind==='medal'?'medal':record.kind==='photo'?'photo':'map',record.name,record.kind==='medal'?(record.variant||'bronze'):'blue','','')
    item.recordId=record.id
    if(layout)Object.assign(item,layout)
    const el=viewport.current
    if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,viewRef.current);item.x=center.x-item.w/2;item.y=center.y-item.h/2}
    commit({...current,items:[...current.items,item]});setSelected(item.id);setSelectedThread(null);setTool('select');setConnecting(null);setToast('收藏已放上画布')
  }
  const saveRecord = async (record:CollectionRecord,add:boolean,layout?:Partial<Memory>) => {
    await library.save([record])
    if(add)await addRecord(record,layout)
  }
  const submitMemory = (e: FormEvent) => {
    e.preventDefault()
    const title=draft.title.trim() || {photo:'山野，留下了答案',medal:'RIDGE 50K',bib:'RIDGE 50K',note:'记住这一刻',map:'走过的每一段路'}[kind]
    if(memoryPanel==='edit') {
      const current=boardRef.current
      if(!current.items.some(i=>i.id===memoryEditingId.current)){setToast('该藏品已被移除');setMemoryPanel(null);return}
      commit({...current,items:current.items.map(i=>i.id===memoryEditingId.current?{...i,title,variant:draft.variant,image:i.kind==='photo'?draft.image:i.image,number:draft.number}:i)})
      setToast('藏品已保存')
    }
    else {const item=createMemory(kind,title,draft.variant,draft.image,draft.number);const el=viewport.current;if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,view);item.x=center.x-item.w/2;item.y=center.y-item.h/2}commit({...board,items:[...board.items,item]});setSelected(item.id);setToast('新的记忆，已放上收藏板')}
    setTool('select');setConnecting(null);setMemoryPanel(null)
  }
  const transformItem = (change: Partial<Memory>) => { if(selected) commit({...board,items:board.items.map(i=>i.id===selected?{...i,...change}:i)}) }
  const duplicate = () => {if(!selectedItem) return;const copy={...selectedItem,id:crypto.randomUUID(),x:selectedItem.x+30,y:selectedItem.y+30};commit({...board,items:[...board.items,copy]});setSelected(copy.id)}
  const download = (href:string,name:string) => {const a=document.createElement('a');a.href=href;a.download=name;a.click()}
  const exportJson = async () => {
    if(fileOperation.current)return
    fileOperation.current=true;setExporting(true)
    try{const json=await makeArchive(boardRef.current,library.records);const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));download(url,`${board.title}.json`);setTimeout(()=>URL.revokeObjectURL(url),1000);setToast('已导出布局、收藏记录及原始文件')}
    catch(e){setToast(e instanceof Error?e.message:'备份导出失败')}
    finally{fileOperation.current=false;setExporting(false)}
  }
  const exportImage = async () => {
    if(!scene.current || fileOperation.current) return
    fileOperation.current=true;setExporting(true)
    setSelected(null);setSelectedThread(null);setConnecting(null)
    const wrapper=document.createElement('div')
    try {
      await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
      await Promise.all(Array.from(scene.current.querySelectorAll('img')).map(img=>img.decode()))
      const bounds=contentBounds(boardRef.current.items), size=exportSize(bounds)
      Object.assign(wrapper.style,{position:'fixed',left:'-10000px',top:'0',width:`${size.width}px`,height:`${size.height}px`,overflow:'hidden',backgroundImage:`url('${location.origin}/cork.svg')`,backgroundSize:`${220*size.scale}px ${220*size.scale}px`,backgroundColor:'#b98d60'})
      wrapper.setAttribute('aria-hidden','true')
      const clone=scene.current.cloneNode(true) as HTMLDivElement
      clone.style.transform=`translate(${-bounds.x*size.scale}px,${-bounds.y*size.scale}px) scale(${size.scale})`
      clone.querySelectorAll('.photo-resize-handle,.selection-outline,.thread-selection,.draft-thread,.connection-anchor,.empty-board').forEach(node=>node.remove())
      wrapper.append(clone);document.body.append(wrapper)
      const url=await toPng(wrapper,{pixelRatio:1,width:size.width,height:size.height,style:{position:'relative',left:'0',top:'0'}})
      download(url,`${board.title}.png`);setToast('已导出全部藏品，自动裁切画布范围')
    } catch {setToast('图片导出失败，请重试或导出收藏板文件')} finally {wrapper.remove();fileOperation.current=false;setExporting(false)}
  }
  const importJson = async (file?: File) => {
    if(!file||fileOperation.current)return
    fileOperation.current=true;setExporting(true)
    try{
      if(file.size>80*1024*1024)throw new Error('备份文件不能超过 80 MB')
      const data=readArchive(await file.text());await library.save(data.records)
      commit(data.board);setSelected(null);setSelectedThread(null);setConnecting(null);setRecordPanel(null);setMemoryPanel(null);fit();setToast('收藏板及关联文件已导入')
    }catch(e){setToast(e instanceof Error?e.message:'无法导入，请选择有效的收藏板文件')}
    finally{fileOperation.current=false;setExporting(false);if(inputFile.current)inputFile.current.value=''}
  }
  const startPin = board.items.find(i=>i.id===connecting)
  const visible=visibleBounds(view,viewportSize.width,viewportSize.height)
  const overview=unionBounds(contentBounds(board.items),visible)

  return <div className="app-shell">
    {(!library.ready||exporting)&&<div className="records-loading" role="status"><div><h2>{exporting?'正在处理收藏板文件…':library.error?'收藏库暂不可用':'正在载入你的收藏…'}</h2>{library.error&&<><p>{library.error}</p><button className="primary-button" onClick={library.retry}>重试</button></>}</div></div>}
    {library.ready&&recordPanel&&<RecordPanel item={recordPanel.mode==='detail'&&(selectedItem?.kind==='medal'||selectedItem?.kind==='photo')&&selectedItem.recordId===recordPanel.id?selectedItem:undefined} onLayout={transformItem} mode={recordPanel} records={library.records} references={id=>board.items.filter(i=>i.recordId===id).length} onMode={setRecordPanel} onClose={()=>setRecordPanel(null)} onSave={saveRecord} onAdd={record=>{void addRecord(record).catch(()=>setToast('照片读取失败，请重新上传'))}}/>}
      {memoryPanel && <aside className="record-panel memory-editor" data-record-panel aria-label="藏品编辑" onKeyDown={e=>e.stopPropagation()}><div className="record-heading"><div><small>A PIECE OF YOUR JOURNEY</small><h2>{memoryPanel==='edit'?'编辑':'添加'}{kinds.find(k=>k.kind===kind)?.label}</h2></div><button onClick={()=>setMemoryPanel(null)} aria-label="关闭详情"><X size={20}/></button></div>
      {kind==='photo'&&selectedItem?.kind==='photo'&&memoryPanel==='edit'&&<PhotoComposition item={selectedItem} onChange={change=>{transformItem(change);if(change.variant)setDraft(d=>({...d,variant:change.variant!}))}}/>}<form onSubmit={submitMemory}>{kind==='photo' && <fieldset><legend>挑选一个山野瞬间</legend><div className="photo-options">{samplePhotos.map((photo,i)=><button key={photo} type="button" className={draft.image===photo?'chosen':''} onClick={()=>setDraft({...draft,image:photo})}><img src={photo} alt={['山巅云海','徒步山径','雪山晨光'][i]}/>{draft.image===photo&&<span><Check size={14}/></span>}</button>)}</div></fieldset>}
      <label className="field-label">{kind==='bib'||kind==='medal'?'赛事名称':kind==='note'?'写下你的记忆':'照片寄语'}{kind==='note'?<textarea autoFocus rows={3} maxLength={100} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="那天的风，那时的自己……"/>:<input autoFocus maxLength={kind==='medal'?20:60} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder={kind==='bib'||kind==='medal'?'RIDGE 50K':'山野，留下了答案'}/>}</label>
      {kind==='bib' && <label className="field-label">参赛号码<input value={draft.number} maxLength={5} inputMode="text" pattern="[A-Za-z0-9]{1,5}" title="请输入 1–5 位英文字母或数字" autoCapitalize="off" spellCheck={false} required onChange={e=>setDraft({...draft,number:e.target.value.replace(/[^A-Za-z0-9]/g,'')})}/></label>}
      {(kind==='medal'||kind==='bib'||kind==='note') && <fieldset><legend>{kind==='medal'?'奖牌材质':'藏品颜色'}</legend><div className="variant-options">{(kind==='medal'?[['bronze','古铜金'],['silver','山岩银']]:kind==='bib'?[['green','森林绿'],['blue','远山蓝']]:[['yellow','暖黄便签'],['paper','手写纸条']]).map(([value,label])=><button type="button" key={value} className={draft.variant===value?'chosen':''} onClick={()=>setDraft({...draft,variant:value})}><span className={`swatch ${value}`}/>{label}{draft.variant===value&&<Check size={14}/>}</button>)}</div></fieldset>}
      <div className="form-footer"><span>示例素材 · 仅保存在本地</span><button type="submit" className="primary-button">{memoryPanel==='edit'?<Check size={18}/>:<Plus size={18}/>} {memoryPanel==='edit'?'保存修改':'放上收藏板'}</button></div></form></aside>}
    <header className="topbar"><div className="brand"><MountainLogo/><span>山径线索板</span></div><span className="header-divider"/><div className="board-menu" ref={menuRef}><button className="board-title" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{board.title}<ChevronDown size={17}/></button>{menu && <div className="dropdown"><label>收藏板名称<input aria-label="收藏板名称" maxLength={28} defaultValue={board.title} onBlur={e=>{if(e.target.value.trim() && e.target.value.trim()!==board.title)commit({...board,title:e.target.value.trim()})}} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();setMenu(false)}}}/></label><button onClick={()=>{inputFile.current?.click();setMenu(false)}}><Upload size={16}/>导入收藏板</button><button onClick={()=>{exportJson();setMenu(false)}}><Download size={16}/>导出收藏板文件</button><div className="dropdown-foot">{board.items.length} 件藏品 · {board.threads.length} 段连接</div></div>}</div>
      <div className="header-actions"><button className="share-button library-button" aria-label="打开收藏库" onClick={()=>{setMemoryPanel(null);setRecordPanel({mode:"library"});setDecorationOpen(false)}}><Library size={18}/><span>收藏库</span></button><span className={`save-status ${saveError?'error':''}`} title={saveError?'浏览器存储不可用，请导出收藏板文件':'编辑自动保存在此浏览器'}><CloudCheck size={18}/><span>{saved==='保存中…'||saveError?saved:`已保存 ${saved}`}</span></span><button className="share-button" onClick={()=>setModal('share')}><Share2 size={17}/><span>分享</span></button><span className="header-divider"/><button className="avatar" onClick={()=>setModal('help')} aria-label="使用指南"><img src="/images/hiking.jpg" alt="山野旅人"/></button></div>
    </header>
    <button className={`decoration-toggle ${decorationOpen?'active':''}`} aria-label="装饰样式" aria-expanded={decorationOpen} onClick={()=>{setMemoryPanel(null);setRecordPanel(null);setDecorationOpen(!decorationOpen);setDecorationScope('board')}}><Palette size={18}/><span>装饰样式</span></button>
    {decorationOpen && <DecorationPanel board={board} item={selectedItem} thread={board.threads.find(t=>t.id===selectedThread)} scope={decorationScope} onScope={setDecorationScope} onClose={()=>setDecorationOpen(false)} onPinToggle={enabled=>{if(selected)commit(setTapePin(board,selected,enabled))}} onChange={change=>{
      const target = decorationScope==='selection' ? (change.kind==='thread'?selectedThread:selected) : undefined
      if(decorationScope==='selection' && !target) return
      commit(changeDecoration(board,change,target??undefined))
    }}/>}
    <main className={`board-viewport ${space?'space-mode':''} ${dragging?'is-dragging':''} ${tool==='connect'?'connect-mode':''}`} ref={viewport} onDoubleClickCapture={e=>{if(tool==='connect'){e.preventDefault();e.stopPropagation();setTool('select');setConnecting(null);setToast('已结束连线')}}} style={{backgroundPosition:`0 0, ${view.x}px ${view.y}px`,backgroundSize:`100% 100%, ${220*view.scale}px ${220*view.scale}px`}} onPointerDown={e=>startGesture(e)} onPointerMove={moveGesture} onPointerUp={()=>endGesture()} onPointerCancel={()=>endGesture(true)} onLostPointerCapture={()=>endGesture()}>
      <div className="scene cork" ref={scene} style={{width:1,height:1,transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}>
        {board.items.map(item=><div key={item.id} role="button" tabIndex={0} aria-label={`${item.kind==='medal'?'奖牌':item.kind==='photo'?'照片':item.kind==='bib'?'号码布':item.kind==='note'?'便签':'路线卡'}：${displayMemory(item,recordFor(item,library.records)).title}`} aria-pressed={selected===item.id} className={`memory memory-${item.kind} ${selected===item.id?'selected':''} ${connecting===item.id?'connection-source':''}`} style={{left:item.x,top:item.y,width:item.w,height:item.h,transform:`rotate(${item.rotation}deg)`}} onPointerDown={e=>startGesture(e,item)} onDoubleClick={()=>{if(tool!=='connect')editItem(item)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null);if(item.recordId)editItem(item)}}}}><Artwork item={item} record={recordFor(item,library.records)} tapeStyle={item.tapeStyle??decorations.tape}/><div className="selection-outline"/></div>)}
        <svg className="threads" width={1} height={1} aria-label="赛事记忆连接线">
          <defs><filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#4c281c" floodOpacity=".5"/></filter></defs>
          {board.threads.map(thread=>{const from=board.items.find(i=>i.id===thread.from),to=board.items.find(i=>i.id===thread.to);if(!from||!to)return null;const a=pinPosition(from),b=pinPosition(to);const d=`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2+3} ${b.x} ${b.y}`;return <g key={thread.id} role="button" tabIndex={0} aria-label={`记忆连线：${from.title} → ${to.title}`} aria-pressed={selectedThread===thread.id} onFocus={()=>{setSelectedThread(thread.id);setSelected(null)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}}><path className="thread-hit" d={d} onPointerDown={e=>{if(space)return;e.preventDefault();e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}/>{selectedThread===thread.id&&<path className="thread-selection" d={d}/>}<ThreadStroke d={d} style={thread.style??decorations.thread} shadow/></g>})}
          {tool==='connect' && startPin && cursor && <path className="draft-thread" d={`M ${pinPosition(startPin).x} ${pinPosition(startPin).y} L ${cursor.x} ${cursor.y}`}/>}
        </svg>
        {board.items.filter(item=>hasPin(item)||tool==='connect').map(item=>{
          const p=pinPosition(item), pinned=hasPin(item)
          const mountClass=pinned?`pushpin pin-${item.pinStyle??decorations.pin}`:'connection-anchor'
          return <button key={item.id} className={`${mountClass} ${connecting===item.id?'pin-active':''}`} aria-label={`${pinned?'连接图钉':'连接点'}：${displayMemory(item,recordFor(item,library.records)).title}`} style={{left:p.x,top:p.y}} onPointerDown={e=>{if(space)startGesture(e);else if(tool==='connect'){e.stopPropagation();connectItem(item.id)}else startGesture(e,item)}} onClick={e=>{if(e.detail===0){if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null)}}}}/>
        })}
        {board.items.length===0 && <div className="empty-board" style={{left:visible.x+visible.width/2,top:visible.y+visible.height*.3,width:600}}><MountainLogo/><h1>每段旅程，都值得收藏</h1><p>从一张照片、一块奖牌开始，串起你的山野记忆。</p><button className="primary-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>openAdd('photo')}><Plus size={18}/>添加第一张照片</button></div>}
      </div>
    </main>
    <nav className="tool-palette" aria-label="收藏板工具"><button className={tool==='select'?'tool active':'tool'} onClick={()=>{setTool('select');setConnecting(null)}} title="选择 · V"><MousePointer2 size={26} fill={tool==='select'?'currentColor':'none'}/><span>选择</span></button><div className="tool-divider"/>{kinds.slice(0,3).map(({kind:k,label,icon:Icon})=><button key={k} className="tool" onClick={()=>openAdd(k)}><Icon size={25}/><span>添加{label}</span></button>)}<button className="tool" onClick={()=>openAdd("map")}><Route size={25}/><span>添加路线</span></button><div className="tool-divider"/><button className={`tool connect-tool ${tool==='connect'?'active':''}`} onClick={()=>{setTool(tool==='connect'?'select':'connect');setConnecting(null);setSelected(null);setSelectedThread(null)}} title="添加连线 · C"><Spline size={28}/><span>添加连线</span></button><button className="tool note-tool" onClick={()=>openAdd('note')}><StickyNote size={23}/><span>添加便签</span></button></nav>
    <div className="history-controls" data-history={historyTick}><button title="撤销 · Ctrl+Z" aria-label="撤销" disabled={!undoStack.current.length || dragging} onClick={undo}><Undo2 size={17}/></button><span/><button title="重做 · Ctrl+Shift+Z" aria-label="重做" disabled={!redoStack.current.length || dragging} onClick={redo}><Redo2 size={17}/></button></div>
    {tool==='connect' && <div className="connection-hint"><span className="red-dot"/>{connecting?'选择下一件藏品，串联这段记忆 · 双击结束':'点击藏品或连接点，开始连接记忆 · 双击结束'}<button onClick={()=>{setTool('select');setConnecting(null)}} aria-label="结束连线"><X size={16}/></button></div>}
    {(selectedItem || selectedThread) && tool==='select' && <div className="selection-bar">{selectedItem ? <><span className="selection-label">{selectedItem.kind==='photo'?'照片':selectedItem.kind==='medal'?'奖牌':selectedItem.kind==='bib'?'号码布':selectedItem.kind==='note'?'便签':'路线卡'}</span><button onClick={openEdit} title="编辑藏品" aria-label="编辑藏品"><Pencil size={17}/></button><span className="bar-divider"/><button onClick={()=>transformItem({rotation:selectedItem.rotation-5})} title="向左旋转" aria-label="向左旋转"><RotateCcw size={17}/></button><button onClick={()=>transformItem({rotation:selectedItem.rotation+5})} title="向右旋转" aria-label="向右旋转"><RotateCw size={17}/></button><button onClick={duplicate} title="复制藏品" aria-label="复制藏品"><Copy size={17}/></button></> : <span className="selection-label">记忆连线</span>}<button onClick={()=>{setMemoryPanel(null);setRecordPanel(null);setDecorationScope('selection');setDecorationOpen(true)}} title="更换装饰样式" aria-label="更换选中项装饰样式"><Palette size={17}/></button><button className="delete-button" onClick={removeSelected} title="删除 · Delete" aria-label="删除选中项"><Trash2 size={17}/></button><button onClick={()=>{setSelected(null);setSelectedThread(null)}} title="取消选择" aria-label="取消选择"><X size={16}/></button></div>}
    <div className="bottom-hint"><Move size={13}/><span>无限画布 · 拖动藏品<span className="hint-dot">·</span>滚轮缩放<span className="hint-dot">·</span>空格平移</span><button onClick={()=>setModal('help')} aria-label="快捷键与帮助"><Keyboard size={15}/></button></div>
    <div className="board-signature">每一步，都算数。<span>EVERY TRAIL TELLS A STORY</span></div>
    <div className="zoom-controls"><button aria-label="放大" onClick={()=>zoom(1.2)}><Plus size={21}/></button><button aria-label="缩小" onClick={()=>zoom(1/1.2)}><Minus size={21}/></button><span/><button aria-label="适应画布" title="适应画布 · 0" onClick={fit}><Maximize size={18}/></button><button className="zoom-value" title="恢复 100%" onClick={()=>{const el=viewport.current;if(el)zoomAt(1,el.clientWidth/2,el.clientHeight/2)}}>{Math.round(view.scale*100)}%</button></div>
    <button className="minimap" title="点击定位画布" aria-label="画布缩略图，点击定位" onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),el=viewport.current;if(el)setView(v=>({...v,x:el.clientWidth/2-(overview.x+(e.clientX-r.left)/r.width*overview.width)*v.scale,y:el.clientHeight/2-(overview.y+(e.clientY-r.top)/r.height*overview.height)*v.scale}))}}><svg viewBox={`${overview.x} ${overview.y} ${overview.width} ${overview.height}`} preserveAspectRatio="none">{board.items.map(i=><rect key={i.id} x={i.x} y={i.y} width={i.w} height={i.h} fill={i.kind==='note'?'#f1d989':i.kind==='medal'?'#676b50':'#f7e7d2'} opacity=".65"/>)}{board.threads.map(t=>{const a=board.items.find(i=>i.id===t.from),b=board.items.find(i=>i.id===t.to);if(!a||!b)return null;return <line key={t.id} x1={pinPosition(a).x} y1={pinPosition(a).y} x2={pinPosition(b).x} y2={pinPosition(b).y} stroke="#bc6050" strokeWidth={overview.width/180}/>})}<rect x={visible.x} y={visible.y} width={visible.width} height={visible.height} fill="#fff" fillOpacity=".09" stroke="#fff9ef" strokeWidth={overview.width/100}/></svg></button>
    <input ref={inputFile} type="file" accept=".json,application/json" hidden onChange={e=>void importJson(e.target.files?.[0])}/>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    <dialog ref={dialog} className="modal" onCancel={()=>setModal(null)} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="modal-content"><button className="modal-close" onClick={()=>setModal(null)} aria-label="关闭"><X size={21}/></button>
      {modal==='share' && <><div className="eyebrow">MEMORIES ARE BETTER SHARED</div><h2>带走这份山野记忆</h2><p className="modal-description">把走过的路，变成一张值得珍藏的图片。</p><div className="share-preview cork"><MountainLogo/><span>{board.title}</span><small>{board.items.length} 件藏品 · {board.threads.length} 段记忆连接</small></div><button className="export-option" onClick={()=>void exportImage()} disabled={exporting}><span className="export-icon"><Image size={23}/></span><span><strong>{exporting?'正在生成高清图片…':'导出高清图片'}</strong><small>全部藏品自动裁切 · 长边最高 4096 像素</small></span><ArrowUpRight size={18}/></button><button className="export-option" onClick={exportJson}><span className="export-icon"><Download size={23}/></span><span><strong>导出收藏板文件</strong><small>包含布局、收藏记录、奖牌图片与 GPX</small></span><ArrowUpRight size={18}/></button><p className="local-footnote">当前为本地收藏板，分享通过导出文件完成。</p></>}
      {modal==='help' && <><div className="eyebrow">MAKE YOURSELF AT HOME</div><h2>你的山野记忆，由你摆放</h2><p className="modal-description">照片、奖牌和号码布，一根红线就能串起一段旅程。</p><div className="help-list">{[['拖动藏品','按住藏品拖拽，自由调整位置'],['串联记忆','选择「添加连线」，依次点击两件藏品'],['编辑藏品','双击藏品，或选中后点击编辑'],['平移画布','向任意方向拖动空白处，或按住空格拖动'],['缩放画布','滚动鼠标滚轮，按 0 回到全景'],['撤销 / 重做','Ctrl + Z / Ctrl + Shift + Z'],['微调 / 删除','方向键移动选中藏品，Delete 删除']].map(([title,description])=><div key={title}><strong>{title}</strong><span>{description}</span></div>)}</div><p className="local-footnote">奖牌与 GPX 可从收藏库上传。编辑自动保存在当前浏览器，导出收藏板文件可备份完整记录。</p><button className="primary-button full-width" onClick={()=>setModal(null)}>开始收藏我的记忆 <ArrowUpRight size={18}/></button></>}
      </div>
    </dialog>
  </div>
}
