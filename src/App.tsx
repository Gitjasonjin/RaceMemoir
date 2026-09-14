import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { MousePointer2, ImagePlus, Medal, RectangleEllipsis, Spline, Plus, Minus, Maximize, Share2, ChevronDown, CloudCheck, Undo2, Redo2, StickyNote, X, Check, Download, RotateCcw, RotateCw, Copy, Trash2, Pencil, Move, Keyboard, Upload, Image, ArrowUpRight, Palette } from 'lucide-react'
import { toPng } from 'html-to-image'
import Artwork, { MountainLogo } from './Artwork'
import { STORAGE_KEY, loadBoard, pinPosition, createMemory, isBoard, getDecorations, hasPin, changeDecoration, setTapePin } from './model'
import type { Board, Kind, Memory } from './model'
import DecorationPanel, { ThreadStroke } from './DecorationPanel'
import { contentBounds, fitCamera, visibleBounds, unionBounds, exportSize, screenToWorld } from './canvas'

type View = { x: number; y: number; scale: number }
type Gesture = { type: 'item' | 'pan'; id?: string; pointerId: number; startX: number; startY: number; x: number; y: number; cameraX: number; cameraY: number; before: Board; moved: boolean }
type Modal = 'add' | 'edit' | 'share' | 'help' | null
const kinds: {kind: Kind; label: string; icon: typeof ImagePlus}[] = [{kind:'photo',label:'照片',icon:ImagePlus},{kind:'medal',label:'奖牌',icon:Medal},{kind:'bib',label:'号码布',icon:RectangleEllipsis},{kind:'note',label:'便签',icon:StickyNote}]
const samplePhotos = ['/images/mountain.jpg', '/images/hiking.jpg', '/images/sunrise.jpg']
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function App() {
  const [board, setBoard] = useState<Board>(loadBoard)
  const boardRef = useRef(board); boardRef.current = board
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
    if (dragging) return
    setSaved('保存中…')
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); setSaved(new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})); setSaveError(false) } catch { setSaved('暂未保存'); setSaveError(true) } }, 450)
    return () => clearTimeout(timer)
  }, [board, dragging])
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
      if (e.target instanceof HTMLElement && (e.target.closest('input,textarea,select,[contenteditable]') || modal)) return
      if (e.code === 'Space' && !(e.target instanceof HTMLElement && e.target.closest('button,[data-decoration-panel]'))) { e.preventDefault(); setSpace(true) }
      if (e.key === 'Escape') { setConnecting(null); setTool('select'); setSelected(null); setSelectedThread(null); setMenu(false); setDecorationOpen(false) }
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
  }, [modal, undo, redo, removeSelected, fit, selected, commit])

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
    gesture.current=null; setDragging(false)
  }

  const openAdd = (nextKind: Kind = 'photo') => {setKind(nextKind);setDraft({title:'',variant:nextKind==='medal'?'bronze':nextKind==='note'?'yellow':'green',image:samplePhotos[0],number:'0826'});setModal('add');setMenu(false)}
  const openEdit = () => { if (!selectedItem) return; setKind(selectedItem.kind); setDraft({title:selectedItem.title,variant:selectedItem.variant||'',image:selectedItem.image||samplePhotos[0],number:selectedItem.number||'0826'}); setModal('edit') }
  const submitMemory = (e: FormEvent) => {
    e.preventDefault()
    const title=draft.title.trim() || {photo:'山野，留下了答案',medal:'RIDGE 50K',bib:'RIDGE 50K',note:'记住这一刻',map:'走过的每一段路'}[kind]
    if(modal==='edit' && selectedItem) commit({...board,items:board.items.map(i=>i.id===selected?{...i,title,variant:draft.variant,image:i.kind==='photo'?draft.image:i.image,number:draft.number}:i)})
    else {const item=createMemory(kind,title,draft.variant,draft.image,draft.number);const el=viewport.current;if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,view);item.x=center.x-item.w/2;item.y=center.y-item.h/2}commit({...board,items:[...board.items,item]});setSelected(item.id);setToast('新的记忆，已放上收藏板')}
    setTool('select');setConnecting(null);setModal(null)
  }
  const transformItem = (change: Partial<Memory>) => { if(selected) commit({...board,items:board.items.map(i=>i.id===selected?{...i,...change}:i)}) }
  const duplicate = () => {if(!selectedItem) return;const copy={...selectedItem,id:crypto.randomUUID(),x:selectedItem.x+30,y:selectedItem.y+30};commit({...board,items:[...board.items,copy]});setSelected(copy.id)}
  const download = (href:string,name:string) => {const a=document.createElement('a');a.href=href;a.download=name;a.click()}
  const exportJson = () => {const url=URL.createObjectURL(new Blob([JSON.stringify(board,null,2)],{type:'application/json'}));download(url,`${board.title}.json`);setTimeout(()=>URL.revokeObjectURL(url),1000);setToast('收藏板文件已导出')}
  const exportImage = async () => {
    if(!scene.current) return
    setExporting(true)
    setSelected(null);setSelectedThread(null);setConnecting(null)
    const wrapper=document.createElement('div')
    try {
      await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
      const bounds=contentBounds(boardRef.current.items), size=exportSize(bounds)
      Object.assign(wrapper.style,{position:'fixed',left:'-10000px',top:'0',width:`${size.width}px`,height:`${size.height}px`,overflow:'hidden',backgroundImage:`url('${location.origin}/cork.svg')`,backgroundSize:`${220*size.scale}px ${220*size.scale}px`,backgroundColor:'#b98d60'})
      wrapper.setAttribute('aria-hidden','true')
      const clone=scene.current.cloneNode(true) as HTMLDivElement
      clone.style.transform=`translate(${-bounds.x*size.scale}px,${-bounds.y*size.scale}px) scale(${size.scale})`
      clone.querySelectorAll('.selection-outline,.draft-thread,.connection-anchor,.empty-board').forEach(node=>node.remove())
      wrapper.append(clone);document.body.append(wrapper)
      const url=await toPng(wrapper,{pixelRatio:1,width:size.width,height:size.height,style:{position:'relative',left:'0',top:'0'}})
      download(url,`${board.title}.png`);setToast('已导出全部藏品，自动裁切画布范围')
    } catch {setToast('图片导出失败，请重试或导出收藏板文件')} finally {wrapper.remove();setExporting(false)}
  }
  const importJson = async (file?: File) => { if(!file)return;try {if(file.size>2_000_000)throw new Error();const data:unknown=JSON.parse(await file.text());if(!isBoard(data))throw new Error();commit(data);setSelected(null);setSelectedThread(null);setConnecting(null);fit();setToast('收藏板已导入')}catch{setToast('无法导入，请选择有效的收藏板 JSON 文件')}if(inputFile.current)inputFile.current.value='' }
  const startPin = board.items.find(i=>i.id===connecting)
  const visible=visibleBounds(view,viewportSize.width,viewportSize.height)
  const overview=unionBounds(contentBounds(board.items),visible)

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><MountainLogo/><span>山径线索板</span></div><span className="header-divider"/><div className="board-menu" ref={menuRef}><button className="board-title" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{board.title}<ChevronDown size={17}/></button>{menu && <div className="dropdown"><label>收藏板名称<input aria-label="收藏板名称" maxLength={28} defaultValue={board.title} onBlur={e=>{if(e.target.value.trim() && e.target.value.trim()!==board.title)commit({...board,title:e.target.value.trim()})}} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();setMenu(false)}}}/></label><button onClick={()=>{inputFile.current?.click();setMenu(false)}}><Upload size={16}/>导入收藏板</button><button onClick={()=>{exportJson();setMenu(false)}}><Download size={16}/>导出收藏板文件</button><div className="dropdown-foot">{board.items.length} 件藏品 · {board.threads.length} 段连接</div></div>}</div>
      <div className="header-actions"><span className={`save-status ${saveError?'error':''}`} title={saveError?'浏览器存储不可用，请导出收藏板文件':'编辑自动保存在此浏览器'}><CloudCheck size={18}/><span>{saved==='保存中…'||saveError?saved:`已保存 ${saved}`}</span></span><button className="primary-button" onClick={()=>openAdd()}><Plus size={19}/><span>添加藏品</span></button><button className="share-button" onClick={()=>setModal('share')}><Share2 size={17}/><span>分享</span></button><span className="header-divider"/><button className="avatar" onClick={()=>setModal('help')} aria-label="使用指南"><img src="/images/hiking.jpg" alt="山野旅人"/></button></div>
    </header>
    <button className={`decoration-toggle ${decorationOpen?'active':''}`} aria-label="装饰样式" aria-expanded={decorationOpen} onClick={()=>{setDecorationOpen(!decorationOpen);setDecorationScope('board')}}><Palette size={18}/><span>装饰样式</span></button>
    {decorationOpen && <DecorationPanel board={board} item={selectedItem} thread={board.threads.find(t=>t.id===selectedThread)} scope={decorationScope} onScope={setDecorationScope} onClose={()=>setDecorationOpen(false)} onPinToggle={enabled=>{if(selected)commit(setTapePin(board,selected,enabled))}} onChange={change=>{
      const target = decorationScope==='selection' ? (change.kind==='thread'?selectedThread:selected) : undefined
      if(decorationScope==='selection' && !target) return
      commit(changeDecoration(board,change,target??undefined))
    }}/>}
    <main className={`board-viewport ${space?'space-mode':''} ${dragging?'is-dragging':''} ${tool==='connect'?'connect-mode':''}`} ref={viewport} style={{backgroundPosition:`0 0, ${view.x}px ${view.y}px`,backgroundSize:`100% 100%, ${220*view.scale}px ${220*view.scale}px`}} onPointerDown={e=>startGesture(e)} onPointerMove={moveGesture} onPointerUp={()=>endGesture()} onPointerCancel={()=>endGesture(true)} onLostPointerCapture={()=>endGesture()}>
      <div className="scene cork" ref={scene} style={{width:1,height:1,transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}>
        {board.items.map(item=><div key={item.id} role="button" tabIndex={0} aria-label={`${item.kind==='medal'?'奖牌':item.kind==='photo'?'照片':item.kind==='bib'?'号码布':item.kind==='note'?'便签':'路线卡'}：${item.title}`} aria-pressed={selected===item.id} className={`memory memory-${item.kind} ${selected===item.id?'selected':''} ${connecting===item.id?'connection-source':''}`} style={{left:item.x,top:item.y,width:item.w,height:item.h,transform:`rotate(${item.rotation}deg)`}} onPointerDown={e=>startGesture(e,item)} onDoubleClick={()=>{setSelected(item.id);setKind(item.kind);setDraft({title:item.title,variant:item.variant||'',image:item.image||samplePhotos[0],number:item.number||'0826'});setModal('edit')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null)}}}}><Artwork item={item} tapeStyle={item.tapeStyle??decorations.tape}/><div className="selection-outline"/></div>)}
        <svg className="threads" width={1} height={1} aria-label="赛事记忆连接线">
          <defs><filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#4c281c" floodOpacity=".5"/></filter></defs>
          {board.threads.map(thread=>{const from=board.items.find(i=>i.id===thread.from),to=board.items.find(i=>i.id===thread.to);if(!from||!to)return null;const a=pinPosition(from),b=pinPosition(to);const d=`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2+3} ${b.x} ${b.y}`;return <g key={thread.id} role="button" tabIndex={0} aria-label={`记忆连线：${from.title} → ${to.title}`} aria-pressed={selectedThread===thread.id} onKeyDown={e=>{if(e.key==='Enter'){setSelectedThread(thread.id);setSelected(null)}}}><path className="thread-hit" d={d} onPointerDown={e=>{if(space)return;e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}/>{selectedThread===thread.id&&<path className="thread-selection selection-outline" d={d}/>}<ThreadStroke d={d} style={thread.style??decorations.thread} shadow/></g>})}
          {tool==='connect' && startPin && cursor && <path className="draft-thread" d={`M ${pinPosition(startPin).x} ${pinPosition(startPin).y} L ${cursor.x} ${cursor.y}`}/>}
        </svg>
        {board.items.filter(item=>hasPin(item)||tool==='connect').map(item=>{
          const p=pinPosition(item), pinned=hasPin(item)
          const mountClass=pinned?`pushpin pin-${item.pinStyle??decorations.pin}`:'connection-anchor'
          return <button key={item.id} className={`${mountClass} ${connecting===item.id?'pin-active':''}`} aria-label={`${pinned?'连接图钉':'连接点'}：${item.title}`} style={{left:p.x,top:p.y}} onPointerDown={e=>{if(space)startGesture(e);else if(tool==='connect'){e.stopPropagation();connectItem(item.id)}else startGesture(e,item)}} onClick={e=>{if(e.detail===0){if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null)}}}}/>
        })}
        {board.items.length===0 && <div className="empty-board" style={{left:visible.x+visible.width/2,top:visible.y+visible.height*.3,width:600}}><MountainLogo/><h1>每段旅程，都值得收藏</h1><p>从一张照片、一块奖牌开始，串起你的山野记忆。</p><button className="primary-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>openAdd()}><Plus size={18}/>添加第一件藏品</button></div>}
      </div>
    </main>
    <nav className="tool-palette" aria-label="收藏板工具"><button className={tool==='select'?'tool active':'tool'} onClick={()=>{setTool('select');setConnecting(null)}} title="选择 · V"><MousePointer2 size={26} fill={tool==='select'?'currentColor':'none'}/><span>选择</span></button><div className="tool-divider"/>{kinds.slice(0,3).map(({kind:k,label,icon:Icon})=><button key={k} className="tool" onClick={()=>openAdd(k)}><Icon size={25}/><span>添加{label}</span></button>)}<div className="tool-divider"/><button className={`tool connect-tool ${tool==='connect'?'active':''}`} onClick={()=>{setTool(tool==='connect'?'select':'connect');setConnecting(null);setSelected(null);setSelectedThread(null)}} title="添加连线 · C"><Spline size={28}/><span>添加连线</span></button><button className="tool note-tool" onClick={()=>openAdd('note')}><StickyNote size={23}/><span>添加便签</span></button></nav>
    <div className="history-controls" data-history={historyTick}><button title="撤销 · Ctrl+Z" aria-label="撤销" disabled={!undoStack.current.length || dragging} onClick={undo}><Undo2 size={17}/></button><span/><button title="重做 · Ctrl+Shift+Z" aria-label="重做" disabled={!redoStack.current.length || dragging} onClick={redo}><Redo2 size={17}/></button></div>
    {tool==='connect' && <div className="connection-hint"><span className="red-dot"/>{connecting?'选择下一件藏品，串联这段记忆':'点击藏品或连接点，开始连接记忆'}<button onClick={()=>{setTool('select');setConnecting(null)}} aria-label="结束连线"><X size={16}/></button></div>}
    {(selectedItem || selectedThread) && tool==='select' && <div className="selection-bar">{selectedItem ? <><span className="selection-label">{selectedItem.kind==='photo'?'照片':selectedItem.kind==='medal'?'奖牌':selectedItem.kind==='bib'?'号码布':selectedItem.kind==='note'?'便签':'路线卡'}</span><button onClick={openEdit} title="编辑藏品" aria-label="编辑藏品"><Pencil size={17}/></button><span className="bar-divider"/><button onClick={()=>transformItem({rotation:selectedItem.rotation-5})} title="向左旋转" aria-label="向左旋转"><RotateCcw size={17}/></button><button onClick={()=>transformItem({rotation:selectedItem.rotation+5})} title="向右旋转" aria-label="向右旋转"><RotateCw size={17}/></button><button onClick={duplicate} title="复制藏品" aria-label="复制藏品"><Copy size={17}/></button></> : <span className="selection-label">记忆连线</span>}<button onClick={()=>{setDecorationScope('selection');setDecorationOpen(true)}} title="更换装饰样式" aria-label="更换选中项装饰样式"><Palette size={17}/></button><button className="delete-button" onClick={removeSelected} title="删除 · Delete" aria-label="删除选中项"><Trash2 size={17}/></button><button onClick={()=>{setSelected(null);setSelectedThread(null)}} title="取消选择" aria-label="取消选择"><X size={16}/></button></div>}
    <div className="bottom-hint"><Move size={13}/><span>无限画布 · 拖动藏品<span className="hint-dot">·</span>滚轮缩放<span className="hint-dot">·</span>空格平移</span><button onClick={()=>setModal('help')} aria-label="快捷键与帮助"><Keyboard size={15}/></button></div>
    <div className="board-signature">每一步，都算数。<span>EVERY TRAIL TELLS A STORY</span></div>
    <div className="zoom-controls"><button aria-label="放大" onClick={()=>zoom(1.2)}><Plus size={21}/></button><button aria-label="缩小" onClick={()=>zoom(1/1.2)}><Minus size={21}/></button><span/><button aria-label="适应画布" title="适应画布 · 0" onClick={fit}><Maximize size={18}/></button><button className="zoom-value" title="恢复 100%" onClick={()=>{const el=viewport.current;if(el)zoomAt(1,el.clientWidth/2,el.clientHeight/2)}}>{Math.round(view.scale*100)}%</button></div>
    <button className="minimap" title="点击定位画布" aria-label="画布缩略图，点击定位" onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),el=viewport.current;if(el)setView(v=>({...v,x:el.clientWidth/2-(overview.x+(e.clientX-r.left)/r.width*overview.width)*v.scale,y:el.clientHeight/2-(overview.y+(e.clientY-r.top)/r.height*overview.height)*v.scale}))}}><svg viewBox={`${overview.x} ${overview.y} ${overview.width} ${overview.height}`} preserveAspectRatio="none">{board.items.map(i=><rect key={i.id} x={i.x} y={i.y} width={i.w} height={i.h} fill={i.kind==='note'?'#f1d989':i.kind==='medal'?'#676b50':'#f7e7d2'} opacity=".65"/>)}{board.threads.map(t=>{const a=board.items.find(i=>i.id===t.from),b=board.items.find(i=>i.id===t.to);if(!a||!b)return null;return <line key={t.id} x1={pinPosition(a).x} y1={pinPosition(a).y} x2={pinPosition(b).x} y2={pinPosition(b).y} stroke="#bc6050" strokeWidth={overview.width/180}/>})}<rect x={visible.x} y={visible.y} width={visible.width} height={visible.height} fill="#fff" fillOpacity=".09" stroke="#fff9ef" strokeWidth={overview.width/100}/></svg></button>
    <input ref={inputFile} type="file" accept=".json,application/json" hidden onChange={e=>void importJson(e.target.files?.[0])}/>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    <dialog ref={dialog} className="modal" onCancel={()=>setModal(null)} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="modal-content"><button className="modal-close" onClick={()=>setModal(null)} aria-label="关闭"><X size={21}/></button>
      {(modal==='add'||modal==='edit') && <><div className="eyebrow">A PIECE OF YOUR JOURNEY</div><h2>{modal==='edit'?'编辑这段记忆':'把记忆，留在这里'}</h2><p className="modal-description">{modal==='edit'?'给这件藏品，补上一点故事。':'山野里的每一个瞬间，都值得被珍藏。'}</p>
      {modal==='add' && <div className="kind-tabs">{kinds.map(({kind:k,label,icon:Icon})=><button key={k} className={kind===k?'chosen':''} onClick={()=>{setKind(k);setDraft({...draft,variant:k==='medal'?'bronze':k==='note'?'yellow':'green'})}}><Icon size={20}/>{label}</button>)}</div>}
      <form onSubmit={submitMemory}>{kind==='photo' && <fieldset><legend>挑选一个山野瞬间</legend><div className="photo-options">{samplePhotos.map((photo,i)=><button key={photo} type="button" className={draft.image===photo?'chosen':''} onClick={()=>setDraft({...draft,image:photo})}><img src={photo} alt={['山巅云海','徒步山径','雪山晨光'][i]}/>{draft.image===photo&&<span><Check size={14}/></span>}</button>)}</div></fieldset>}
      <label className="field-label">{kind==='bib'||kind==='medal'?'赛事名称':kind==='note'?'写下你的记忆':'照片寄语'}{kind==='note'?<textarea autoFocus rows={3} maxLength={100} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="那天的风，那时的自己……"/>:<input autoFocus maxLength={kind==='medal'?20:60} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder={kind==='bib'||kind==='medal'?'RIDGE 50K':'山野，留下了答案'}/>}</label>
      {kind==='bib' && <label className="field-label">参赛号码<input value={draft.number} maxLength={5} inputMode="numeric" pattern="[0-9]{1,5}" required onChange={e=>setDraft({...draft,number:e.target.value.replace(/\D/g,'')})}/></label>}
      {(kind==='medal'||kind==='bib'||kind==='note') && <fieldset><legend>{kind==='medal'?'奖牌材质':'藏品颜色'}</legend><div className="variant-options">{(kind==='medal'?[['bronze','古铜金'],['silver','山岩银']]:kind==='bib'?[['green','森林绿'],['blue','远山蓝']]:[['yellow','暖黄便签'],['paper','手写纸条']]).map(([value,label])=><button type="button" key={value} className={draft.variant===value?'chosen':''} onClick={()=>setDraft({...draft,variant:value})}><span className={`swatch ${value}`}/>{label}{draft.variant===value&&<Check size={14}/>}</button>)}</div></fieldset>}
      <div className="form-footer"><span>示例素材 · 仅保存在本地</span><button type="submit" className="primary-button">{modal==='edit'?<Check size={18}/>:<Plus size={18}/>} {modal==='edit'?'保存修改':'放上收藏板'}</button></div></form></>}
      {modal==='share' && <><div className="eyebrow">MEMORIES ARE BETTER SHARED</div><h2>带走这份山野记忆</h2><p className="modal-description">把走过的路，变成一张值得珍藏的图片。</p><div className="share-preview cork"><MountainLogo/><span>{board.title}</span><small>{board.items.length} 件藏品 · {board.threads.length} 段记忆连接</small></div><button className="export-option" onClick={()=>void exportImage()} disabled={exporting}><span className="export-icon"><Image size={23}/></span><span><strong>{exporting?'正在生成高清图片…':'导出高清图片'}</strong><small>全部藏品自动裁切 · 长边最高 4096 像素</small></span><ArrowUpRight size={18}/></button><button className="export-option" onClick={exportJson}><span className="export-icon"><Download size={23}/></span><span><strong>导出收藏板文件</strong><small>保留藏品位置和红线，可导入继续编辑</small></span><ArrowUpRight size={18}/></button><p className="local-footnote">当前为本地收藏板，分享通过导出文件完成。</p></>}
      {modal==='help' && <><div className="eyebrow">MAKE YOURSELF AT HOME</div><h2>你的山野记忆，由你摆放</h2><p className="modal-description">照片、奖牌和号码布，一根红线就能串起一段旅程。</p><div className="help-list">{[['拖动藏品','按住藏品拖拽，自由调整位置'],['串联记忆','选择「添加连线」，依次点击两件藏品'],['编辑藏品','双击藏品，或选中后点击编辑'],['平移画布','向任意方向拖动空白处，或按住空格拖动'],['缩放画布','滚动鼠标滚轮，按 0 回到全景'],['撤销 / 重做','Ctrl + Z / Ctrl + Shift + Z'],['微调 / 删除','方向键移动选中藏品，Delete 删除']].map(([title,description])=><div key={title}><strong>{title}</strong><span>{description}</span></div>)}</div><p className="local-footnote">所有内容均为演示素材。编辑自动保存在当前浏览器，也可以导出备份。</p><button className="primary-button full-width" onClick={()=>setModal(null)}>开始收藏我的记忆 <ArrowUpRight size={18}/></button></>}
      </div>
    </dialog>
  </div>
}
