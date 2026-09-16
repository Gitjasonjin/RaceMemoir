import CanvasContextMenu from '../board/CanvasContextMenu'
import {useLayerTarget} from '../board/useLayerTarget'
import LayoutMenu from '../board/LayoutMenu'
import {expandGroups,lockedSelection,arrangeItems,snapMove} from '../board/layout'
import type {LayoutAction,Guide} from '../board/layout'
import LayerMenu from '../board/LayerMenu'
import {reorderItems} from '../board/itemLayers'
import type {LayerAction} from '../board/itemLayers'
import {loadBoard} from '../persistence/boardStore'
import Topbar from './Topbar'
import {useCanvasCamera} from '../board/useCanvasCamera'
import {useBoardHistory} from '../board/useBoardHistory'
import Clothespin from '../appearance/Clothespin'
import { hangPhotos } from '../board/photoLine'
import { threadCurve } from '../board/threadCurve'
import { useBoardSave } from '../persistence/useBoardSave'
import { resolveStyle, backgroundStyle, resolveBackground } from '../domain/styleCatalog'
import { selectionBounds, intersectsSelection } from '../board/selection'
import type { Bounds } from '../board/canvas'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { MousePointer2, ImagePlus, Medal, RectangleEllipsis, Spline, Plus, Minus, Maximize, Undo2, Redo2, StickyNote, X, Check, RotateCcw, RotateCw, Trash2, Move, Keyboard, Palette, Route, Map } from 'lucide-react'
import {exportBoardImage} from '../persistence/exportImage'
import {downloadBlob} from '../persistence/download'
import Artwork from '../items/Artwork'
import MountainLogo from '../shared/MountainLogo'
import { pinPosition, createMemory, getDecorations, hasPin, changeDecoration, setTapePin } from '../domain/model'
import type { Kind, Memory } from '../domain/model'
import DecorationPanel, { ThreadStroke } from '../appearance/DecorationPanel'
import { contentBounds, visibleBounds, unionBounds, screenToWorld } from '../board/canvas'
import { useRecords } from '../library/useRecords'
import { recordFor, displayMemory } from '../domain/records'
import type { CollectionRecord } from '../domain/records'
import { makeZipArchive, readBackup } from '../persistence/zipArchive'
import RecordPanel from '../library/RecordPanel'
import type { RecordPanelMode } from '../library/types'
import type {Gesture} from '../board/types'
import BoardDialog from './BoardDialog'
import type {BoardModal} from './BoardDialog'
import {samplePhotos} from '../domain/samplePhotos'
import MemoryEditor from '../library/MemoryEditor'
import RaceMapEditor from '../race-map/RaceMapEditor'
import {boardRaceRecords,groupRaceLocations} from '../race-map/raceMapGrouping'
import {resolveEndpoint,threadEndpoints,hasConnection,sameEndpoint,racePointOnMap,recordThreadReferences} from '../board/threadEndpoints'
import type {ThreadEndpoint} from '../board/threadEndpoints'

const kinds: {kind: Kind; label: string; icon: typeof ImagePlus}[] = [{kind:'photo',label:'照片',icon:ImagePlus},{kind:'medal',label:'奖牌',icon:Medal},{kind:'bib',label:'号码布',icon:RectangleEllipsis},{kind:'note',label:'便签',icon:StickyNote},{kind:'map',label:'路线',icon:Route}]

export default function App() {
  const history=useBoardHistory(loadBoard)
  const {board,boardRef,setBoard,remember,commit,historyTick}=history
  const library = useRecords(board, next => {boardRef.current=next;setBoard(next)})
  const [recordPanel,setRecordPanel] = useState<RecordPanelMode|null>(null)
  const [memoryPanel,setMemoryPanel] = useState<'add'|'edit'|null>(null)
  const memoryEditingId = useRef<string|null>(null)
  const fileOperation = useRef(false)
  const gesture = useRef<Gesture | null>(null)
  const {view,setView,viewRef,viewport,viewportSize,fit,zoom,zoomAt}=useCanvasCamera(boardRef,gesture,library.records)
  const scene = useRef<HTMLDivElement>(null)
  const pointer = useRef({x:0,y:0})
  const [guides,setGuides]=useState<Guide[]>([])
  const [snapEnabled,setSnapEnabled]=useState(()=>{try{return localStorage.getItem('racememoir-snap-enabled')==='true'}catch{return false}})
  const [canvasMenu,setCanvasMenu]=useState<{x:number;y:number}|null>(null)
  const closeCanvasMenu=useCallback(()=>setCanvasMenu(null),[])
  const toggleSnap=()=>{const enabled=!snapEnabled;setSnapEnabled(enabled);setGuides([]);closeCanvasMenu();try{localStorage.setItem('racememoir-snap-enabled',String(enabled))}catch{/* Preference remains available for this session. */}}
  const overlap=useRef<{x:number;y:number;id:string}|null>(null)
  const [marquee,setMarquee]=useState<Bounds|null>(null)
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const selected=selectedIds.length===1?selectedIds[0]:null
  const setSelected=useCallback((id:string|null)=>setSelectedIds(id?expandGroups(boardRef.current.items,[id]):[]),[boardRef])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [decorationOpen, setDecorationOpen] = useState(false)
  const [decorationScope, setDecorationScope] = useState<'board' | 'selection'>('board')
  const [tool, setTool] = useState<'select'|'connect'>('select')
  const [connecting, setConnecting] = useState<ThreadEndpoint | null>(null)
  const [cursor, setCursor] = useState<{x:number;y:number}|null>(null)
  const [space, setSpace] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [modal, setModal] = useState<BoardModal>(null)
  const [mapPanel,setMapPanel]=useState<{id:string;groupKey?:string;choosing?:boolean}|null>(null)
  const [kind, setKind] = useState<Kind>('photo')
  const [draft, setDraft] = useState({title:'',variant:'',image:samplePhotos[0],number:'0826',date:''})
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState('')
  const boardSave=useBoardSave(board,library.ready&&!dragging)
  const saveError=library.error||library.saveError||boardSave.error
  const saved=!library.ready?'正在读取收藏…':saveError?'保存失败':library.saving||boardSave.saving||dragging?'保存中…':`已保存到本机 ${[boardSave.time,library.savedAt].sort().at(-1)}`
  const layerTarget=useLayerTarget({board,selectedIds,viewport,view,commit,onBegin:()=>{setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);setDecorationOpen(false);setSelectedThread(null);setTool('select');setConnecting(null)},onDone:()=>setToast('物件层级已调整')})
  const [exporting, setExporting] = useState(false)
  const inputFile = useRef<HTMLInputElement>(null)
  const selectedPhotos=board.items.filter(item=>selectedIds.includes(item.id)&&item.kind==='photo')
  const selectedItem = board.items.find(item => item.id === selected)
  const decorations = getDecorations(board)
  const mapRaces=useMemo(()=>boardRaceRecords(board,library.records),[board.items,library.records])
  const mapGroups=useMemo(()=>groupRaceLocations(mapRaces,true),[mapRaces])
  const mapItem=mapPanel?board.items.find(i=>i.id===mapPanel.id&&i.kind==='race-map'):undefined
  const pointFor=(endpoint:ThreadEndpoint)=>resolveEndpoint(board,library.records,endpoint,decorations.pin)
  const hiddenMapThreads=mapItem?board.threads.filter(t=>(t.from===mapItem.id||t.to===mapItem.id)&&threadEndpoints(t).some(ep=>!pointFor(ep))):[]
  useEffect(()=>{
    const focused=document.activeElement
    if(focused instanceof SVGElement && focused.matches('.threads [role=button]') && focused.getAttribute('aria-pressed')!=='true')focused.blur()
  },[selectedThread])

  const undo = useCallback(() => {if(history.undo()){setSelected(null);setSelectedThread(null)}},[history.undo,setSelected])
  const redo = useCallback(() => {if(history.redo()){setSelected(null);setSelectedThread(null)}},[history.redo,setSelected])
  useEffect(() => { if (!toast) return; const timer = setTimeout(()=>setToast(''),3200); return () => clearTimeout(timer) }, [toast])

  const removeSelected = useCallback(() => {
    const current = boardRef.current
    if(lockedSelection(current.items,selectedIds)){setToast('请先解锁物件');return}
    if (selectedIds.length) commit({...current,items:current.items.filter(i=>!selectedIds.includes(i.id)),threads:current.threads.filter(t=>!selectedIds.includes(t.from)&&!selectedIds.includes(t.to))})
    else if (selectedThread) commit({...current,threads:current.threads.filter(t=>t.id!==selectedThread)})
    setSelected(null); setSelectedThread(null);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null)
  }, [commit, selectedIds, selectedThread])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!library.ready || fileOperation.current || (e.target instanceof HTMLElement && (e.target.closest('input,textarea,select,[contenteditable],[data-record-panel]') || modal))) return
      if (e.code === 'Space' && !(e.target instanceof HTMLElement && e.target.closest('button,[data-decoration-panel]'))) { e.preventDefault(); setSpace(true) }
      if (e.key === 'Escape') { if(gesture.current?.type==='marquee'){gesture.current=null;setMarquee(null)} setConnecting(null); setTool('select'); setSelected(null); setSelectedThread(null); setMenu(false); setDecorationOpen(false);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if(e.shiftKey) redo(); else undo() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected() }
      if (e.key.toLowerCase() === 'v') { setTool('select'); setConnecting(null) }
      if (e.key.toLowerCase() === 'c') { setTool('connect'); setSelected(null); setSelectedThread(null) }
      if (e.key === '0') fit()
      if (selectedIds.length && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();if(lockedSelection(boardRef.current.items,selectedIds))return; const d = e.shiftKey ? 10 : 2
        commit({...boardRef.current,items:boardRef.current.items.map(i=>selectedIds.includes(i.id)?{...i,x:i.x+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),y:i.y+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0)}:i)})
      }
    }
    const up = (e: KeyboardEvent) => { if(e.code === 'Space') setSpace(false) }
    const blur = () => {
      setSpace(false)
      const g=gesture.current
      if(g?.type==='item' && g.moved)setBoard(g.before)
      if(g?.type==='marquee'){setSelectedIds(g.ids||[]);setMarquee(null)}
      gesture.current=null;setDragging(false);setGuides([])
    }
    window.addEventListener('keydown',down); window.addEventListener('keyup',up); window.addEventListener('blur',blur)
    return () => {window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}
  }, [modal, undo, redo, removeSelected, fit, selectedIds, commit, library.ready])

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
        setGuides([])
        const v={...viewRef.current,x:viewRef.current.x+dx,y:viewRef.current.y+dy}
        viewRef.current=v;setView(v)
        setBoard(b=>({...b,items:b.items.map(i=>g.ids?.includes(i.id)?{...i,x:g.before.items.find(o=>o.id===i.id)!.x+(p.x-g.startX+g.cameraX-v.x)/v.scale,y:g.before.items.find(o=>o.id===i.id)!.y+(p.y-g.startY+g.cameraY-v.y)/v.scale}:i)}))
      }
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame)
  },[dragging])

  const connectEndpoint = (endpoint:ThreadEndpoint) => {
    if(!pointFor(endpoint)){setToast('这个地点暂时不在地图取景内');return}
    setSelected(null);setSelectedThread(null);setMapPanel(null)
    if(!connecting){setConnecting(endpoint);return}
    if(sameEndpoint(connecting,endpoint)){setConnecting(null);return}
    if(!pointFor(connecting)){setConnecting(endpoint);return}
    if(hasConnection(board.threads,connecting,endpoint)){setToast('这两个连接点已经连在一起了');return}
    commit({...board,threads:[...board.threads,{id:crypto.randomUUID(),from:connecting.itemId,to:endpoint.itemId,fromRaceId:connecting.raceId,toRaceId:endpoint.raceId}]})
    setConnecting(endpoint);setToast('红线已连接，继续选择下一段记忆')
  }
  const connectItem=(id:string)=>connectEndpoint({itemId:id})
  const openMapEditor=(item:Memory,groupKey?:string,choosing=false)=>{
    if(!choosing&&(item.locked||item.groupId)){setSelected(item.id);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);return}
    setSelected(item.id);setSelectedThread(null);setMemoryPanel(null);setMapPanel(null);setRecordPanel(null);setDecorationOpen(false)
    setMapPanel({id:item.id,groupKey,choosing})
  }
  const startGesture = (e: ReactPointerEvent, item?: Memory) => {
    if (e.button !== 0 && e.button !== 1) return
    if (gesture.current) return
    if(e.altKey&&e.button===0&&tool==='select'&&!space){
      e.stopPropagation();e.preventDefault()
      const r=viewport.current!.getBoundingClientRect(),p=screenToWorld(e.clientX-r.left,e.clientY-r.top,viewRef.current)
      const hits=boardRef.current.items.filter(i=>intersectsSelection(i,{x:p.x,y:p.y,width:0,height:0})).reverse()
      if(hits.length){const previous=overlap.current,repeat=previous&&Math.hypot(p.x-previous.x,p.y-previous.y)<5/view.scale,index=repeat?hits.findIndex(i=>i.id===previous.id):-1,target=hits[(index+1)%hits.length];overlap.current={...p,id:target.id};setSelected(target.id);setSelectedThread(null);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);if(!target.groupId&&!target.locked)editItem(target);setToast(`已选择：${target.title.replaceAll('\n',' ')} · Alt 单击切换重叠物件`)}return
    }
    if(e.ctrlKey&&e.button===0&&tool==='select'&&!space){
      e.stopPropagation();e.preventDefault()
      const rect=viewport.current!.getBoundingClientRect(),point=screenToWorld(e.clientX-rect.left,e.clientY-rect.top,viewRef.current)
      gesture.current={type:'marquee',ids:selectedIds,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:point.x,y:point.y,cameraX:view.x,cameraY:view.y,before:boardRef.current,moved:false}
      setMarquee({x:point.x,y:point.y,width:0,height:0});setSelected(null);setSelectedThread(null);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);setDecorationOpen(false)
      viewport.current?.setPointerCapture(e.pointerId);return
    }
    if (tool === 'connect' && item && !space) {e.stopPropagation(); connectItem(item.id); return}
    e.stopPropagation(); e.preventDefault()
    const isPan = !item || space || e.button === 1
    const gestureIds=item?(selectedIds.includes(item.id)?selectedIds:expandGroups(boardRef.current.items,[item.id])):[]
    if (!isPan && item) {if(!selectedIds.includes(item.id))setSelected(item.id); setSelectedThread(null);if(gestureIds.length>1||lockedSelection(boardRef.current.items,gestureIds)){setRecordPanel(null);setMemoryPanel(null);setMapPanel(null)}if(lockedSelection(boardRef.current.items,gestureIds)){setToast('物件已锁定，可在底部工具栏解锁');return}}
    else if(!space) {setSelected(null); setSelectedThread(null)}
    pointer.current={x:e.clientX,y:e.clientY}
    gesture.current = {type:isPan?'pan':'item',id:item?.id,ids:gestureIds,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:isPan?view.x:item!.x,y:isPan?view.y:item!.y,cameraX:view.x,cameraY:view.y,before:structuredClone(board),moved:false}
    viewport.current?.setPointerCapture(e.pointerId)
  }
  const moveGesture = (e: ReactPointerEvent) => {
    pointer.current={x:e.clientX,y:e.clientY}
    const rect=viewport.current!.getBoundingClientRect()
    if(tool==='connect') setCursor({x:(e.clientX-rect.left-view.x)/view.scale,y:(e.clientY-rect.top-view.y)/view.scale})
    const g=gesture.current; if(!g || g.pointerId!==e.pointerId) return
    const dx=e.clientX-g.startX,dy=e.clientY-g.startY
    if(!g.moved && Math.hypot(dx,dy)<3) return
    if(g.type==='marquee'){
      g.moved=true
      const point=screenToWorld(e.clientX-rect.left,e.clientY-rect.top,viewRef.current),box=selectionBounds(g.x,g.y,point.x,point.y)
      setMarquee(box);setSelectedIds(expandGroups(boardRef.current.items,boardRef.current.items.filter(i=>intersectsSelection(i,box)).map(i=>i.id)));return
    }
    g.moved=true; setDragging(true);if(g.type==='item'){setRecordPanel(null);setMemoryPanel(null);setMapPanel(null)}
    if(g.type==='pan') setView(v=>({...v,x:g.x+dx,y:g.y+dy}))
    else {const v=viewRef.current,dxWorld=(dx+g.cameraX-v.x)/v.scale,dyWorld=(dy+g.cameraY-v.y)/v.scale
      const snap=!snapEnabled||e.altKey?{dx:dxWorld,dy:dyWorld,guides:[]}:snapMove(g.before.items,g.ids??[],dxWorld,dyWorld,6/v.scale)
      setGuides(snap.guides);setBoard(b=>({...b,items:b.items.map(i=>g.ids?.includes(i.id)?{...i,x:g.before.items.find(o=>o.id===i.id)!.x+snap.dx,y:g.before.items.find(o=>o.id===i.id)!.y+snap.dy}:i)}))}
  }
  const endGesture = (cancel = false) => {
    const g=gesture.current; if(!g) return
    if(g.type==='marquee'){if(cancel)setSelectedIds(g.ids||[]);setMarquee(null)}
    if(g.type==='item' && g.moved) {if(cancel) setBoard(g.before); else remember(g.before)}
    if(g.type==='item' && !g.moved && !cancel && g.ids?.length===1) {
      const item=boardRef.current.items.find(i=>i.id===g.id)
      if(item){if(g.mapGroupKey)openMapEditor(item,g.mapGroupKey);else editItem(item)}
    }
    if(g.type==='pan'&&!g.moved&&!cancel){setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);setDecorationOpen(false)}
    gesture.current=null; setDragging(false);setGuides([])
  }

  const openAdd = (nextKind: Kind) => {
    setMenu(false);setModal(null);setMemoryPanel(null);setMapPanel(null);setRecordPanel(null);setDecorationOpen(false)
    if(nextKind==='race-map'){
      if(board.items.length>=500){setToast('每块收藏板最多放置 500 件藏品');return}
      const item=createMemory('race-map','我的赛事地图','paper','',''),el=viewport.current
      item.rotation=0;item.pinStyle='classic'
      if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,viewRef.current);item.x=center.x-item.w/2;item.y=center.y-item.h/2}
      commit({...board,items:[...board.items,item]});setTool('select');setConnecting(null);openMapEditor(item);return
    }
    if(nextKind==='medal'||nextKind==='map'||nextKind==='photo'){setModal(null);setDecorationOpen(false);setRecordPanel({mode:nextKind==='map'?'route':nextKind==='photo'?'photo':'medal'});return}
    setKind(nextKind);setDraft({title:'',variant:resolveStyle(nextKind).id,image:samplePhotos[0],number:'0826',date:''});setMemoryPanel('add')
  }
  const editItem = (item: Memory) => {
    if(item.groupId||item.locked){setSelected(item.id);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);return}
    if(item.kind==='race-map'){openMapEditor(item);return}
    if((item.recordId&&recordPanel?.mode==='detail'&&recordPanel.id===item.recordId)||(!item.recordId&&memoryPanel==='edit'&&memoryEditingId.current===item.id))return
    setSelected(item.id);memoryEditingId.current=item.id;setMemoryPanel(null);setMapPanel(null);setRecordPanel(null);setDecorationOpen(false)
    if(item.recordId){setRecordPanel({mode:'detail',id:item.recordId});setDecorationOpen(false);return}
    setKind(item.kind);setDraft({title:item.title,variant:item.variant||'',image:item.image||samplePhotos[0],number:item.number||'0826',date:(item.subtitle||'').replaceAll('.','-')});setMemoryPanel('edit')
  }
  const arrangePhotoLine=()=>{if(lockedSelection(boardRef.current.items,selectedIds))return;try{const next=hangPhotos(boardRef.current,selectedIds);if(next===boardRef.current)return;commit(next);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);setDecorationOpen(false);fit();setToast('照片已挂成绳串，可拖动照片继续调整')}catch(e){setToast(e instanceof Error?e.message:'照片绳创建失败')}}
  const changeLayer = (action:LayerAction) => {
    if(lockedSelection(boardRef.current.items,selectedIds))return
    const current=boardRef.current,items=reorderItems(current.items,selectedIds,action)
    if(items.some((item,i)=>item!==current.items[i]))commit({...current,items})
  }
  const arrangeSelection=(action:LayoutAction)=>{const current=boardRef.current,items=arrangeItems(current.items,selectedIds,action);if(items.some((i,n)=>i!==current.items[n]))commit({...current,items})}
  const groupSelection=(ungroup:boolean)=>{const current=boardRef.current;if(lockedSelection(current.items,selectedIds))return;const groupId=ungroup?undefined:crypto.randomUUID();commit({...current,items:current.items.map(i=>selectedIds.includes(i.id)?{...i,groupId}:i)});setRecordPanel(null);setMemoryPanel(null);setMapPanel(null)}
  const lockSelection=()=>{const current=boardRef.current,locked=!lockedSelection(current.items,selectedIds);commit({...current,items:current.items.map(i=>selectedIds.includes(i.id)?{...i,locked}:i)});setRecordPanel(null);setMemoryPanel(null);setMapPanel(null)}
  const layoutControls=<LayoutMenu key={'layout:'+selectedIds.join(',')} items={board.items} ids={selectedIds} onArrange={arrangeSelection} onGroup={groupSelection} onLock={lockSelection}/>
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
  const deleteRecord = async (id:string) => {
    if(fileOperation.current)throw new Error('请等待当前操作完成')
    if(recordThreadReferences(boardRef.current,id))throw new Error('请先在地图编辑栏移除引用此赛事的连线')
    if(boardRef.current.items.some(item=>item.recordId===id))throw new Error('请先移除画布上使用此收藏的物件')
    fileOperation.current=true;setExporting(true)
    try{
      // Persist removal from the canvas before releasing the original files.
      if(!boardSave.retry())throw new Error('请先解决画布保存失败，再彻底删除收藏')
      await library.remove(id)
      // Undo must never restore an item whose source files were permanently deleted.
      history.forgetRecord(id);setToast('收藏及原始文件已彻底删除')
    }finally{fileOperation.current=false;setExporting(false)}
  }
  const submitMemory = (e: FormEvent) => {
    e.preventDefault()
    const title=draft.title.trim() || {photo:'山野，留下了答案',medal:'RIDGE 50K',bib:'RIDGE 50K',note:'记住这一刻',map:'走过的每一段路','race-map':'我的赛事地图'}[kind]
    if(memoryPanel==='edit') {
      const current=boardRef.current
      if(!current.items.some(i=>i.id===memoryEditingId.current)){setToast('该藏品已被移除');setMemoryPanel(null);setMapPanel(null);return}
      commit({...current,items:current.items.map(i=>i.id===memoryEditingId.current?{...i,title,variant:draft.variant,image:i.kind==='photo'?draft.image:i.image,number:draft.number,subtitle:i.kind==='photo'?draft.date:i.subtitle}:i)})
      setToast('藏品已保存')
    }
    else {const item=createMemory(kind,title,draft.variant,draft.image,draft.number);if(kind==='photo')item.subtitle=draft.date;const el=viewport.current;if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,view);item.x=center.x-item.w/2;item.y=center.y-item.h/2}commit({...board,items:[...board.items,item]});setSelected(item.id);setToast('新的记忆，已放上收藏板')}
    setTool('select');setConnecting(null);setMemoryPanel(null);setMapPanel(null)
  }
  const transformItem = (change: Partial<Memory>) => { if(selected&&!selectedItem?.locked) commit({...board,items:board.items.map(i=>i.id===selected?{...i,...change}:i)}) }

  const exportJson = async () => {
    if(fileOperation.current)return
    fileOperation.current=true;setExporting(true)
    try{const blob=await makeZipArchive(boardRef.current,library.records);downloadBlob(blob,`${board.title}.zip`);setToast('已导出布局、收藏记录及原始文件')}
    catch(e){setToast(e instanceof Error?e.message:'备份导出失败')}
    finally{fileOperation.current=false;setExporting(false)}
  }
  const exportImage = async () => {
    if(!scene.current || fileOperation.current) return
    fileOperation.current=true;setExporting(true)
    setSelected(null);setSelectedThread(null);setConnecting(null)
    try {
      const blob=await exportBoardImage(scene.current,boardRef.current,library.records)
      downloadBlob(blob,`${board.title}.png`);setToast('已导出全部藏品，自动裁切画布范围')
    } catch {setToast('图片导出失败，请重试或导出收藏板文件')} finally {fileOperation.current=false;setExporting(false)}
  }
  const importJson = async (file?: File) => {
    if(!file||fileOperation.current)return
    fileOperation.current=true;setExporting(true)
    try{
      if(file.size>80*1024*1024)throw new Error('备份文件不能超过 80 MB')
      const data=await readBackup(file);await library.save(data.records)
      commit(data.board);setSelected(null);setSelectedThread(null);setConnecting(null);setRecordPanel(null);setMemoryPanel(null);setMapPanel(null);fit();setToast('收藏板及关联文件已导入')
    }catch(e){setToast(e instanceof Error?e.message:'无法导入，请选择有效的收藏板文件')}
    finally{fileOperation.current=false;setExporting(false);if(inputFile.current)inputFile.current.value=''}
  }
  const startPin = connecting?pointFor(connecting):null
  const visible=visibleBounds(view,viewportSize.width,viewportSize.height)
  const overview=unionBounds(contentBounds(board.items,60,board.threads,decorations.pin,library.records),visible)

  const itemStyles=selectedItem?<DecorationPanel embedded board={board} item={selectedItem} scope="selection" onScope={()=>{}} onClose={()=>{}} onCurvature={()=>{}} onPinToggle={enabled=>commit(setTapePin(boardRef.current,selectedItem.id,enabled))} onChange={change=>commit(changeDecoration(boardRef.current,change,selectedItem.id))}/>:null
  return <div className="app-shell">
    {(!library.ready||exporting)&&<div className="records-loading" role="status"><div><h2>{exporting?'正在处理收藏板文件…':library.error?'收藏库暂不可用':'正在载入你的收藏…'}</h2>{library.error&&<><p>{library.error}</p><button className="primary-button" onClick={library.retry}>重试</button></>}</div></div>}
    {saveError&&<div className="save-failure-banner" role="alert">{saveError}。当前修改仍在此页面中，请勿刷新。{boardSave.error&&<button onClick={boardSave.retry}>重试画布保存</button>}<button onClick={()=>setModal('share')}>导出已提交内容</button></div>}
    {library.ready&&recordPanel&&<RecordPanel styles={recordPanel.mode==='detail'&&selectedItem?.recordId===recordPanel.id?itemStyles:undefined} item={recordPanel.mode==='detail'&&selectedItem&&selectedItem.recordId===recordPanel.id?selectedItem:undefined} onLayout={transformItem} mode={recordPanel} records={library.records} references={id=>board.items.filter(i=>i.recordId===id).length} threadReferences={id=>recordThreadReferences(board,id)} onMode={setRecordPanel} onClose={()=>setRecordPanel(null)} onSave={saveRecord} onDelete={deleteRecord} onAdd={record=>{void addRecord(record).catch(()=>setToast('照片读取失败，请重新上传'))}}/>}
    {memoryPanel&&<MemoryEditor memoryPanel={memoryPanel} kind={kind} selectedItem={selectedItem} draft={draft} setDraft={setDraft} transformItem={transformItem} itemStyles={itemStyles} submitMemory={submitMemory} onClose={()=>{setMemoryPanel(null);setMapPanel(null)}}/>}
    {mapItem&&mapPanel&&<RaceMapEditor key={mapItem.id} item={mapItem} board={board} records={library.records} groups={mapGroups} groupKey={mapPanel.groupKey} choosing={!!mapPanel.choosing&&tool==='connect'} hiddenThreads={hiddenMapThreads} onClose={()=>setMapPanel(null)} onSelectGroup={groupKey=>setMapPanel({...mapPanel,groupKey,choosing:false})} onConnect={raceId=>connectEndpoint({itemId:mapItem.id,raceId})} onRemoveThread={id=>commit({...board,threads:board.threads.filter(t=>t.id!==id)})} onSave={change=>commit({...board,items:board.items.map(i=>i.id===mapItem.id?{...i,...change,x:i.x+(i.w-(change.w??i.w))/2,y:i.y+(i.h-(change.h??i.h))/2}:i)})} onRace={id=>{
      setMapPanel(null)
      const item=board.items.find(i=>i.recordId===id)
      if(item){const el=viewport.current;if(el)setView(v=>({...v,x:el.clientWidth/2-(item.x+item.w/2)*v.scale,y:el.clientHeight/2-(item.y+item.h/2)*v.scale}));editItem(item)}else{setSelected(null);setRecordPanel({mode:'detail',id})}
    }}/>}
    <Topbar board={board} menu={menu} setMenu={setMenu} saved={saved} saveError={saveError} saveFailed={!!boardSave.error} onRetry={boardSave.retry} onRename={title=>commit({...board,title})} onImport={()=>inputFile.current?.click()} onExport={()=>void exportJson()} onLibrary={()=>{setMemoryPanel(null);setMapPanel(null);setRecordPanel({mode:'library'});setDecorationOpen(false)}} onShare={()=>setModal('share')} onHelp={()=>setModal('help')}/>
    <button className={`decoration-toggle ${decorationOpen?'active':''}`} aria-label="装饰样式" aria-expanded={decorationOpen} onClick={()=>{setMemoryPanel(null);setMapPanel(null);setRecordPanel(null);setDecorationOpen(!decorationOpen);setDecorationScope('board')}}><Palette size={18}/><span>装饰样式</span></button>
    {decorationOpen && <DecorationPanel onBackground={id=>{if(resolveBackground(boardRef.current.backgroundStyle).id!==id)commit({...boardRef.current,backgroundStyle:id})}} onCurvature={curvature=>{const current=boardRef.current;commit({...current,threads:current.threads.map(t=>t.id===selectedThread?{...t,curvature}:t)})}} board={board} thread={board.threads.find(t=>t.id===selectedThread)} scope={decorationScope} onScope={setDecorationScope} onClose={()=>setDecorationOpen(false)} onPinToggle={enabled=>{if(selected)commit(setTapePin(board,selected,enabled))}} onChange={change=>{
      const target = decorationScope==='selection' ? (change.kind==='thread'?selectedThread:selected) : undefined
      if(decorationScope==='selection' && !target) return
      commit(changeDecoration(board,change,target??undefined))
    }}/>}
    <main onContextMenu={e=>{e.preventDefault();if(gesture.current)return;layerTarget.cancel();setCanvasMenu({x:e.clientX,y:e.clientY})}} className={`board-viewport ${space?'space-mode':''} ${dragging?'is-dragging':''} ${tool==='connect'?'connect-mode':''} ${layerTarget.mode?'layer-target-mode':''}`} ref={viewport} onDoubleClickCapture={e=>{if(tool==='connect'){e.preventDefault();e.stopPropagation();setTool('select');setConnecting(null);setToast('已结束连线')}}} style={backgroundStyle(board.backgroundStyle,view.scale,view.x,view.y)} onPointerMoveCapture={layerTarget.onMove} onPointerLeave={()=>{if(layerTarget.mode)layerTarget.clearHover()}} onPointerDownCapture={e=>{if(e.button===2){e.stopPropagation();return}if(layerTarget.mode){layerTarget.onDown(e);return}if(e.ctrlKey&&e.button===0&&tool==='select'&&!space)startGesture(e)}} onPointerDown={e=>startGesture(e)} onPointerMove={moveGesture} onPointerUp={()=>endGesture()} onPointerCancel={()=>endGesture(true)} onLostPointerCapture={()=>endGesture()}>
      <div className="scene cork" ref={scene} style={{width:1,height:1,transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}>
        {board.items.map(item=><div key={item.id} role="button" tabIndex={0} aria-label={`${item.kind==='medal'?'奖牌':item.kind==='photo'?'照片':item.kind==='bib'?'号码布':item.kind==='note'?'便签':item.kind==='race-map'?'赛事地图':'路线卡'}：${displayMemory(item,recordFor(item,library.records)).title}`} aria-pressed={selectedIds.includes(item.id)} className={`memory memory-${item.kind} ${selectedIds.includes(item.id)?'selected':''} ${item.locked?'is-locked':''} ${item.groupId?'is-grouped':''} ${layerTarget.highlightIds.includes(item.id)?'layer-target-highlight':''} ${connecting?.itemId===item.id?'connection-source':''}`} style={{left:item.x,top:item.y,width:item.w,height:item.h,transform:`rotate(${item.rotation}deg)`}} onPointerDown={e=>startGesture(e,item)} onDoubleClick={e=>{if(tool!=='connect'&&!e.ctrlKey&&selectedIds.length<2)editItem(item)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null);editItem(item)}}}}><Artwork raceGroups={mapGroups} item={item} record={recordFor(item,library.records)} tapeStyle={item.tapeStyle??decorations.tape}/><div className="selection-outline"/></div>)}
        <svg className="threads" width={1} height={1} aria-label="赛事记忆连接线">
          <defs><filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#4c281c" floodOpacity=".5"/></filter></defs>
          {board.threads.map(thread=>{const from=board.items.find(i=>i.id===thread.from),to=board.items.find(i=>i.id===thread.to);if(!from||!to)return null;const [a,b]=threadEndpoints(thread).map(pointFor);if(!a||!b)return null;const d=threadCurve(a,b,thread.curvature).d;return <g key={thread.id} role="button" tabIndex={0} aria-label={`记忆连线：${from.title} → ${to.title}`} aria-pressed={selectedThread===thread.id} onFocus={()=>{setSelectedThread(thread.id);setSelected(null)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}}><path className="thread-hit" d={d} onPointerDown={e=>{if(space)return;e.preventDefault();e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}/>{selectedThread===thread.id&&<path className="thread-selection" d={d}/>}<ThreadStroke d={d} style={thread.style??decorations.thread} shadow/></g>})}
          {tool==='connect' && startPin && cursor && <path className="draft-thread" d={threadCurve(startPin,cursor).d}/>}
        </svg>
        {board.items.filter(item=>hasPin(item)||tool==='connect'||(item.kind==='medal'&&board.threads.some(t=>t.from===item.id||t.to===item.id))).map(item=>{
          const p=pinPosition(item,decorations.pin), pinned=hasPin(item)
          const mountClass=item.kind==='medal'?'medal-thread-eyelet':pinned?`pushpin pin-${item.pinStyle??decorations.pin}`:'connection-anchor'
          return <button key={item.id} className={`${mountClass} ${connecting?.itemId===item.id?'pin-active':''}`} aria-label={`${item.kind==='medal'?'奖牌连接环':pinned?(item.pinStyle??decorations.pin)==='clip'?'木夹子':'连接图钉':'连接点'}：${displayMemory(item,recordFor(item,library.records)).title}`} style={{left:p.x,top:p.y,...((item.pinStyle??decorations.pin)==='clip'||item.kind==='medal'?{transform:`translate(-50%,-50%) rotate(${item.rotation}deg)`}:{})}} onPointerDown={e=>{if(space)startGesture(e);else if(tool==='connect'){e.stopPropagation();connectItem(item.id)}else startGesture(e,item)}} onClick={e=>{if(e.detail===0){if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null);editItem(item)}}}}>{pinned&&(item.pinStyle??decorations.pin)==='clip'&&<Clothespin/>}</button>
        })}
        {board.items.filter(i=>i.kind==='race-map').flatMap(item=>mapGroups.map(group=>{
          const p=racePointOnMap(item,group.races[0]);if(!p)return null
          const pin=item.pinStyle??decorations.pin
          const active=connecting?.itemId===item.id&&group.races.some(r=>r.id===connecting.raceId)
          const activate=()=>{if(tool==='connect'){if(group.races.length===1)connectEndpoint({itemId:item.id,raceId:group.races[0].id});else openMapEditor(item,group.key,true)}else openMapEditor(item,group.key)}
          return <button key={`${item.id}:${group.key}`} className={`pushpin map-place-pin pin-${pin} ${active?'pin-active':''}`} aria-label={`地点钉子：${group.name}，${group.races.length} 场赛事`} style={{left:p.x,top:p.y,...(pin==='clip'?{transform:`translate(-50%,-50%) rotate(${item.rotation}deg)`}:{})}} onPointerDown={e=>{
            if(tool==='connect'&&!space){e.stopPropagation();activate();return}
            startGesture(e,item);if(gesture.current?.type==='item')gesture.current.mapGroupKey=group.key
          }} onClick={e=>{if(e.detail===0)activate()}}>{pin==='clip'&&<Clothespin/>}</button>
        }))}
        {snapEnabled&&guides.map((g,index)=><div key={index} className="snap-guide" style={g.axis==='x'?{left:g.value,top:g.start,width:1/view.scale,height:g.end-g.start}:{left:g.start,top:g.value,width:g.end-g.start,height:1/view.scale}}/>)}
        {marquee&&<div className="marquee-selection" style={{left:marquee.x,top:marquee.y,width:marquee.width,height:marquee.height,borderWidth:1.5/view.scale}}/>}
        {board.items.length===0 && <div className="empty-board" style={{left:visible.x+visible.width/2,top:visible.y+visible.height*.3,width:600}}><MountainLogo/><h1>每段旅程，都值得收藏</h1><p>从一张照片、一块奖牌开始，串起你的山野记忆。</p><button className="primary-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>openAdd('photo')}><Plus size={18}/>添加第一张照片</button></div>}
      </div>
    </main>
    {canvasMenu&&<CanvasContextMenu position={canvasMenu} snapEnabled={snapEnabled} onToggle={toggleSnap} onClose={closeCanvasMenu}/>}
    <nav className="tool-palette" aria-label="收藏板工具"><button className={tool==='select'?'tool active':'tool'} onClick={()=>{setTool('select');setConnecting(null)}} title="选择 · V"><MousePointer2 size={26} fill={tool==='select'?'currentColor':'none'}/><span>选择</span></button><div className="tool-divider"/>{kinds.slice(0,3).map(({kind:k,label,icon:Icon})=><button key={k} className="tool" onClick={()=>openAdd(k)}><Icon size={25}/><span>添加{label}</span></button>)}<button className="tool" onClick={()=>openAdd("map")}><Route size={25}/><span>添加路线</span></button><button className="tool" onClick={()=>openAdd('race-map')}><Map size={25}/><span>添加地图</span></button><div className="tool-divider"/><button className={`tool connect-tool ${tool==='connect'?'active':''}`} onClick={()=>{setTool(tool==='connect'?'select':'connect');setConnecting(null);setSelected(null);setSelectedThread(null)}} title="添加连线 · C"><Spline size={28}/><span>添加连线</span></button><button className="tool note-tool" onClick={()=>openAdd('note')}><StickyNote size={23}/><span>添加便签</span></button></nav>
    {layerTarget.mode&&<div className="connection-hint layer-target-hint" data-layer-target-hint role="status"><span>{layerTarget.target?`放到「${board.items.find(i=>i.id===layerTarget.target)?.title.replaceAll('\n',' ')||'物件'}」${layerTarget.mode.action==='above'?'上方':'下方'}`:`点击目标物件，放到它的${layerTarget.mode.action==='above'?'上方':'下方'}`}<small>Alt 单击切换重叠目标 · 点击或 Enter 确认 · Esc 取消</small></span><button type="button" onClick={layerTarget.cancel} aria-label="取消指定层级"><X size={16}/></button></div>}
    <div className="history-controls" data-history={historyTick}><button title="撤销 · Ctrl+Z" aria-label="撤销" disabled={!history.canUndo || dragging} onClick={undo}><Undo2 size={17}/></button><span/><button title="重做 · Ctrl+Shift+Z" aria-label="重做" disabled={!history.canRedo || dragging} onClick={redo}><Redo2 size={17}/></button></div>
    {tool==='connect' && <div className="connection-hint"><span className="red-dot"/>{connecting?'选择下一件藏品，串联这段记忆 · 双击结束':'点击藏品或连接点，开始连接记忆 · 双击结束'}<button onClick={()=>{setTool('select');setConnecting(null)}} aria-label="结束连线"><X size={16}/></button></div>}
    {!layerTarget.mode&&selectedIds.length>1&&tool==='select'&&<div className="selection-bar"><span className="selection-label">已选中 {selectedIds.length} 件藏品 · {lockedSelection(board.items,selectedIds)?'已锁定':'拖动可一起移动'}</span>{layoutControls}<LayerMenu key={selectedIds.join(',')} items={board.items} ids={selectedIds} onChange={changeLayer} onTarget={layerTarget.begin}/><button className="photo-line-action" onClick={arrangePhotoLine} disabled={selectedPhotos.length<2||lockedSelection(board.items,selectedIds)} title="将选中的照片横向排列，用木夹子和麻绳连接" aria-label="挂成照片绳"><Spline size={17}/><span>挂成照片绳</span></button><button disabled={lockedSelection(board.items,selectedIds)} className="delete-button" onClick={removeSelected} aria-label="删除选中藏品"><Trash2 size={17}/></button><button onClick={()=>setSelected(null)} aria-label="取消批量选择"><X size={16}/></button></div>}
    {!layerTarget.mode&&(selectedItem || selectedThread) && tool==='select' && <div className="selection-bar">{selectedItem ? <><span className="selection-label">{selectedItem.kind==='photo'?'照片':selectedItem.kind==='medal'?'奖牌':selectedItem.kind==='bib'?'号码布':selectedItem.kind==='note'?'便签':selectedItem.kind==='race-map'?'赛事地图':'路线卡'}</span>{layoutControls}<LayerMenu key={selectedItem.id} items={board.items} ids={selectedIds} onChange={changeLayer} onTarget={layerTarget.begin}/><span className="bar-divider"/><button disabled={!!selectedItem.locked} onClick={()=>transformItem({rotation:selectedItem.rotation-5})} title="向左旋转" aria-label="向左旋转"><RotateCcw size={17}/></button><button disabled={!!selectedItem.locked} onClick={()=>transformItem({rotation:selectedItem.rotation+5})} title="向右旋转" aria-label="向右旋转"><RotateCw size={17}/></button></> : <span className="selection-label">记忆连线</span>}{!selectedItem&&<button onClick={()=>{setMemoryPanel(null);setMapPanel(null);setRecordPanel(null);setDecorationScope('selection');setDecorationOpen(true)}} title="更换连线样式" aria-label="更换连线样式"><Palette size={17}/></button>}<button disabled={lockedSelection(board.items,selectedIds)} className="delete-button" onClick={removeSelected} title="删除 · Delete" aria-label="删除选中项"><Trash2 size={17}/></button><button onClick={()=>{setSelected(null);setSelectedThread(null)}} title="取消选择" aria-label="取消选择"><X size={16}/></button></div>}
    <div className="bottom-hint"><Move size={13}/><span>无限画布 · 拖动藏品<span className="hint-dot">·</span>滚轮缩放<span className="hint-dot">·</span>空格平移</span><button onClick={()=>setModal('help')} aria-label="快捷键与帮助"><Keyboard size={15}/></button></div>
    <div className="board-signature" style={{color:resolveBackground(board.backgroundStyle).ink}}>每一步，都算数。<span>EVERY TRAIL TELLS A STORY</span></div>
    <div className="zoom-controls"><button aria-label="放大" onClick={()=>zoom(1.2)}><Plus size={21}/></button><button aria-label="缩小" onClick={()=>zoom(1/1.2)}><Minus size={21}/></button><span/><button aria-label="适应画布" title="适应画布 · 0" onClick={fit}><Maximize size={18}/></button><button className="zoom-value" title="恢复 100%" onClick={()=>{const el=viewport.current;if(el)zoomAt(1,el.clientWidth/2,el.clientHeight/2)}}>{Math.round(view.scale*100)}%</button></div>
    <button className="minimap" title="点击定位画布" aria-label="画布缩略图，点击定位" onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),el=viewport.current;if(el)setView(v=>({...v,x:el.clientWidth/2-(overview.x+(e.clientX-r.left)/r.width*overview.width)*v.scale,y:el.clientHeight/2-(overview.y+(e.clientY-r.top)/r.height*overview.height)*v.scale}))}}><svg viewBox={`${overview.x} ${overview.y} ${overview.width} ${overview.height}`} preserveAspectRatio="none">{board.items.map(i=><rect key={i.id} x={i.x} y={i.y} width={i.w} height={i.h} fill={i.kind==='note'?'#f1d989':i.kind==='medal'?'#676b50':'#f7e7d2'} opacity=".65"/>)}{board.threads.map(t=>{const [a,b]=threadEndpoints(t).map(pointFor);if(!a||!b)return null;return <line key={t.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#bc6050" strokeWidth={overview.width/180}/>})}<rect x={visible.x} y={visible.y} width={visible.width} height={visible.height} fill="#fff" fillOpacity=".09" stroke="#fff9ef" strokeWidth={overview.width/100}/></svg></button>
    <input ref={inputFile} type="file" accept=".zip,application/zip,.json,application/json" hidden onChange={e=>void importJson(e.target.files?.[0])}/>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    <BoardDialog modal={modal} board={board} exporting={exporting} exportImage={exportImage} exportJson={exportJson} onClose={()=>setModal(null)}/>
  </div>
}
