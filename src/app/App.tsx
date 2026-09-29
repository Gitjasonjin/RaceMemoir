import {useNotice} from '../i18n/useNotice'
import {msg,errorNotice,AppError} from '../i18n/runtime.ts'
import {t as tr,formatTime} from '../i18n/runtime.ts'
import {useTranslation} from 'react-i18next'
import BoardActions from '../board/BoardActions'
import {preloadBackgroundTextures} from '../shared/MaterialPreview'
import Minimap from '../board/Minimap'
import {HintButton,HintGroup} from '../shared/ui/Hint'
import BoardLighting,{BoardLightWash,useBoardLight} from '../board/lighting/BoardLighting'
import CanvasBackground from '../board/CanvasBackground'
import {useCanvasTouch} from '../board/useCanvasTouch'
import {useTouchLayout} from '../shared/useTouchLayout'
import {canConnect} from '../domain/model'
import {resizeSticker,stickerSize} from '../items/sticker/stickerGeometry'
import SelectionToolbar from '../board/SelectionToolbar'
import {boardMembers,boardWorldItems,ownerOf,mergeMedals,splitMedals,exhibitCells,availableExhibitSlot,addMedalToExhibit} from '../domain/medalExhibit'
import type {ExhibitLayout} from '../domain/medalExhibit'
import {MedalMergeMenu,MedalSplitButton,MedalExhibitEditor} from '../items/medal/MedalExhibitControls'
import {layoutBatchPhotos,MAX_BATCH_PHOTOS} from '../items/photo/batchPhotos'
import type {BatchPhoto} from '../items/photo/batchPhotos'
import ItemMotion from '../board/ItemMotion'
import {bibLayout} from '../items/bib/bibGeometry'
import ToolPalette from '../board/ToolPalette'
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
import { resolveStyle, resolveBackground } from '../domain/styleCatalog'
import { selectionBounds, intersectsSelection } from '../board/selection'
import type { Bounds } from '../board/canvas'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Spline, Plus, Minus, Maximize, Undo2, Redo2, X, Check, RotateCcw, RotateCw, Trash2, Move, Keyboard, Palette, Pencil } from 'lucide-react'
import {exportBoardImage} from '../persistence/exportImage'
import {useFileOperation} from '../persistence/useFileOperation'
import FileOperationOverlay from '../persistence/FileOperationOverlay'
import {downloadBlob} from '../persistence/download'
import Artwork from '../items/Artwork'
import MountainLogo from '../shared/MountainLogo'
import { pinPosition, createMemory, getDecorations, hasPin, changeDecoration, setTapePin } from '../domain/model'
import type { Kind, Memory } from '../domain/model'
import DecorationPanel, { ThreadStroke } from '../appearance/DecorationPanel'
import { contentBounds, fitCamera, visibleBounds, screenToWorld } from '../board/canvas'
import { useRecords } from '../library/useRecords'
import { recordFor, displayMemory } from '../domain/records'
import type { CollectionRecord } from '../domain/records'
import { makeZipArchive, readBackup } from '../persistence/zipArchive'
import RecordPanel from '../library/RecordPanel'
import {useEditorPanel} from './useEditorPanel'
import type {Gesture} from '../board/types'
import BoardDialog from './BoardDialog'
import type {BoardModal} from './BoardDialog'
import {samplePhotos} from '../domain/samplePhotos'
import MemoryEditor from '../library/MemoryEditor'
import RaceMapEditor from '../race-map/RaceMapEditor'
import {boardRaceRecords,groupRaceLocations} from '../race-map/raceMapGrouping'
import {resolveEndpoint,threadEndpoints,hasConnection,sameEndpoint,racePointOnMap,recordThreadReferences} from '../board/threadEndpoints'
import type {ThreadEndpoint} from '../board/threadEndpoints'


export default function App() {
  const {i18n}=useTranslation()
  useEffect(()=>{document.title=tr("app.documentTitle");document.documentElement.lang=i18n.language},[i18n.language])
  const touchLayout=useTouchLayout()
  const light=useBoardLight()
  const [multiSelect,setMultiSelect]=useState(false)
  const history=useBoardHistory(loadBoard)
  const {board,boardRef,setBoard,remember,commit,historyTick}=history
  const library = useRecords(board, next => {boardRef.current=next;setBoard(next)})
  useEffect(()=>{preloadBackgroundTextures()},[])
  const {recordPanel,memoryPanel,mapPanel,exhibitPanel,decorationOpen,decorationScope,closePanel,openRecord,openMemory,openMap,openExhibit,openDecoration}=useEditorPanel()
  const memoryEditingId = useRef<string|null>(null)
  const {active:fileOperation,state:operation,run:runFileOperation,busy:exporting}=useFileOperation()
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
  const [tool, setTool] = useState<'select'|'connect'>('select')
  const [connecting, setConnecting] = useState<ThreadEndpoint | null>(null)
  const [cursor, setCursor] = useState<{x:number;y:number}|null>(null)
  const [space, setSpace] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [modal, setModal] = useState<BoardModal>(null)
  const [kind, setKind] = useState<Kind>('photo')
  const [draft, setDraft] = useState({title:'',variant:'',image:samplePhotos[0],number:'0826',date:''})
  const [toast, setToast]=useNotice('')
  const boardSave=useBoardSave(board,library.ready&&!dragging)
  const saveError=library.error||library.saveError||boardSave.error
  const saved=!library.ready?tr("App.114"):saveError?tr("App.113"):library.saving||boardSave.saving||dragging?tr("App.112"):tr("App.111",{v1:formatTime(Math.max(boardSave.time,library.savedAt))})
  const layerTarget=useLayerTarget({board,selectedIds,viewport,view,commit,onBegin:()=>{closePanel();setSelectedThread(null);setTool('select');setConnecting(null)},onDone:()=>setToast(msg("App.110"))})
  const inputFile = useRef<HTMLInputElement>(null)
  const selectedPhotos=board.items.filter(item=>selectedIds.includes(item.id)&&item.kind==='photo')
  const selectedItem = board.items.find(item => item.id === selected)
  const worldItems=useMemo(()=>boardWorldItems(board.items),[board.items])
  const selectedMedals=board.items.filter(i=>selectedIds.includes(i.id)&&i.kind==='medal'&&!i.exhibit)
  const decorations = getDecorations(board)
  const mapRaces=useMemo(()=>boardRaceRecords(board,library.records),[board.items,library.records])
  const mapGroups=useMemo(()=>groupRaceLocations(mapRaces,true),[mapRaces])
  const mapItem=mapPanel?(mapPanel.draft??board.items.find(i=>i.id===mapPanel.id&&i.kind==='race-map')):undefined
  const pointFor=(endpoint:ThreadEndpoint)=>resolveEndpoint(board,library.records,endpoint,decorations.pin)
  const hiddenMapThreads=mapItem?board.threads.filter(t=>(t.from===mapItem.id||t.to===mapItem.id)&&threadEndpoints(t).some(ep=>!pointFor(ep))):[]
  useEffect(()=>{
    const focused=document.activeElement
    if(focused instanceof SVGElement && focused.matches('.threads [role=button]') && focused.getAttribute('aria-pressed')!=='true')focused.blur()
  },[selectedThread])

  const undo = useCallback(() => {if(history.undo()){setSelected(null);setSelectedThread(null)}},[history.undo,setSelected])
  const redo = useCallback(() => {if(history.redo()){setSelected(null);setSelectedThread(null)}},[history.redo,setSelected])
  useEffect(() => { if (!toast) return; const timer = setTimeout(()=>setToast(''),3200); return () => clearTimeout(timer) }, [toast])

  const canClear=library.ready&&!exporting&&!library.saving&&(board.items.length>0||board.threads.length>0)
  const clearBoard=()=>{
    const current=boardRef.current
    if(!canClear||fileOperation.current||gesture.current||touchGestures.active())return
    commit({...current,items:[],threads:[]})
    setSelected(null);setSelectedThread(null);setConnecting(null);setCursor(null);setTool('select');setMultiSelect(false)
    setGuides([]);setMarquee(null);layerTarget.cancel();closePanel();closeCanvasMenu();setModal(null)
    setToast(msg("App.109"))
  }

  const removeSelected = useCallback(() => {
    const current = boardRef.current
    if(lockedSelection(current.items,selectedIds)){setToast(msg("App.108"));return}
    if (selectedIds.length) {const removed=new Set(boardMembers(current.items.filter(i=>selectedIds.includes(i.id))).map(i=>i.id));commit({...current,items:current.items.filter(i=>!selectedIds.includes(i.id)),threads:current.threads.filter(t=>!removed.has(t.from)&&!removed.has(t.to))})}
    else if (selectedThread) commit({...current,threads:current.threads.filter(t=>t.id!==selectedThread)})
    setSelected(null); setSelectedThread(null);closePanel()
  }, [commit, selectedIds, selectedThread, closePanel])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !library.ready || fileOperation.current || (e.target instanceof HTMLElement && (e.target.closest('input,textarea,select,[contenteditable],[data-record-panel],[data-decoration-panel],[data-ui-overlay]') || modal))) return
      if (e.code === 'Space' && !(e.target instanceof HTMLElement && e.target.closest('button,[data-decoration-panel]'))) { e.preventDefault(); setSpace(true) }
      if (e.key === 'Escape') { if(gesture.current?.type==='marquee'){gesture.current=null;setMarquee(null)} setConnecting(null); setTool('select'); setSelected(null); setSelectedThread(null);  closePanel() }
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
    if(!pointFor(endpoint)){setToast(msg("App.107"));return}
    setSelected(null);setSelectedThread(null);closePanel()
    if(!connecting){setConnecting(endpoint);return}
    if(sameEndpoint(connecting,endpoint)){setConnecting(null);return}
    if(!pointFor(connecting)){setConnecting(endpoint);return}
    if(hasConnection(board.threads,connecting,endpoint)){setToast(msg("App.106"));return}
    commit({...board,threads:[...board.threads,{id:crypto.randomUUID(),from:connecting.itemId,to:endpoint.itemId,fromRaceId:connecting.raceId,toRaceId:endpoint.raceId}]})
    setConnecting(endpoint);setToast(msg("App.105"))
  }
  const connectItem=(id:string)=>{const item=boardMembers(board.items).find(i=>i.id===id);if(item&&canConnect(item))connectEndpoint({itemId:item.exhibit?.medals[0].id??id})}
  const openMapEditor=(item:Memory,groupKey?:string,choosing=false)=>{
    if(!choosing&&(item.locked||item.groupId)){setSelected(item.id);closePanel();return}
    setSelected(item.id);setSelectedThread(null);closePanel()
    openMap({id:item.id,groupKey,choosing})
  }
  const startGesture = (e: ReactPointerEvent, item?: Memory) => {
    if (e.button !== 0 && e.button !== 1) return
    if (gesture.current) return
    if(e.altKey&&e.button===0&&tool==='select'&&!space){
      e.stopPropagation();e.preventDefault()
      const r=viewport.current!.getBoundingClientRect(),p=screenToWorld(e.clientX-r.left,e.clientY-r.top,viewRef.current)
      const hits=boardRef.current.items.filter(i=>intersectsSelection(i,{x:p.x,y:p.y,width:0,height:0})).reverse()
      if(hits.length){const previous=overlap.current,repeat=previous&&Math.hypot(p.x-previous.x,p.y-previous.y)<5/view.scale,index=repeat?hits.findIndex(i=>i.id===previous.id):-1,target=hits[(index+1)%hits.length];overlap.current={...p,id:target.id};setSelected(target.id);setSelectedThread(null);closePanel();if(!target.groupId&&!target.locked)editItem(target);setToast(msg("App.104",{v1:target.title.replaceAll('\n',' ')}))}return
    }
    if((e.ctrlKey||multiSelect)&&e.button===0&&tool==='select'&&!space){
      e.stopPropagation();e.preventDefault()
      const rect=viewport.current!.getBoundingClientRect(),point=screenToWorld(e.clientX-rect.left,e.clientY-rect.top,viewRef.current)
      gesture.current={type:'marquee',ids:selectedIds,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:point.x,y:point.y,cameraX:view.x,cameraY:view.y,before:boardRef.current,moved:false}
      setMarquee({x:point.x,y:point.y,width:0,height:0});setSelected(null);setSelectedThread(null);closePanel()
      viewport.current?.setPointerCapture(e.pointerId);return
    }
    if (tool === 'connect' && item && !space) {e.stopPropagation(); connectItem(item.id); return}
    e.stopPropagation(); e.preventDefault()
    const isPan = !item || space || e.button === 1
    const gestureIds=item?(selectedIds.includes(item.id)?selectedIds:expandGroups(boardRef.current.items,[item.id])):[]
    if (!isPan && item) {if(!selectedIds.includes(item.id))setSelected(item.id); setSelectedThread(null);if(gestureIds.length>1||lockedSelection(boardRef.current.items,gestureIds)){closePanel()}if(lockedSelection(boardRef.current.items,gestureIds)){setToast(msg("App.103"));return}}
    else if(!space) {setSelected(null); setSelectedThread(null)}
    pointer.current={x:e.clientX,y:e.clientY}
    // Drag updates are immutable; keep the old board and clone only when committing history.
    gesture.current = {type:isPan?'pan':'item',id:item?.id,ids:gestureIds,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:isPan?view.x:item!.x,y:isPan?view.y:item!.y,cameraX:view.x,cameraY:view.y,before:boardRef.current,moved:false}
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
    g.moved=true; setDragging(true);if(g.type==='item'){closePanel()}
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
    if(g.type==='pan'&&!g.moved&&!cancel){closePanel()}
    gesture.current=null; setDragging(false);setGuides([])
  }

  const touchTarget=(event:ReactPointerEvent)=>{
    const el=event.target as Element,map=el.closest<HTMLElement>('[data-map-id]'),anchor=el.closest<HTMLElement>('[data-board-anchor]')
    const id=map?.dataset.mapId??anchor?.dataset.ownerId??el.closest<HTMLElement>('[data-board-item]')?.dataset.boardItem
    return {item:boardRef.current.items.find(i=>i.id===id),anchor:anchor?.dataset.boardAnchor,groupKey:map?.dataset.mapGroup,thread:el.closest<SVGElement>('[data-board-thread]')?.dataset.boardThread}
  }
  const toggleTouchSelection=(item:Memory)=>{
    const ids=expandGroups(boardRef.current.items,[item.id])
    setSelectedIds(current=>ids.every(id=>current.includes(id))?current.filter(id=>!ids.includes(id)):[...new Set([...current,...ids])]);setSelectedThread(null);closePanel()
  }
  const touchGestures=useCanvasTouch({viewport,view:viewRef,setView,
    onTap:event=>{
      if(layerTarget.mode){layerTarget.onDown(event);return}
      const target=touchTarget(event),item=target.item
      if(multiSelect){if(item)toggleTouchSelection(item);else setSelected(null);return}
      if(tool==='connect'){
        if(item&&target.groupKey){const group=mapGroups.find(g=>g.key===target.groupKey);if(group?.races.length===1)connectEndpoint({itemId:item.id,raceId:group.races[0].id});else if(group)openMapEditor(item,group.key,true)}
        else if(target.anchor||item)connectItem(target.anchor??item!.id)
        return
      }
      if(item){setSelected(item.id);setSelectedThread(null);if(touchLayout)closePanel();else if(target.groupKey)openMapEditor(item,target.groupKey);else editItem(item)}
      else if(target.thread){setSelected(null);setSelectedThread(target.thread);closePanel()}
      else{setSelected(null);setSelectedThread(null);closePanel()}
    },
    onDragStart:event=>{const {item}=touchTarget(event);startGesture(event,tool==='select'&&!layerTarget.mode&&!item?.locked?item:undefined)},
    onDragMove:moveGesture,onDragEnd:endGesture,
    onLongPress:event=>{
      const {item}=touchTarget(event)
      if(item&&tool==='select'){setMultiSelect(true);setSelectedIds(current=>[...new Set([...current,...expandGroups(boardRef.current.items,[item.id])])]);setSelectedThread(null);closePanel();setToast(msg("App.102"))}
      else if(!item){layerTarget.cancel();setCanvasMenu({x:event.clientX,y:event.clientY})}
    },
  })

  const openAdd = (nextKind: Kind) => {
    setMultiSelect(false)
    setModal(null);closePanel()
    if(nextKind==='race-map'){
      if(board.items.length>=500){setToast(msg("App.091"));return}
      const item=createMemory('race-map',tr("App.075"),'paper','',''),el=viewport.current
      item.rotation=0;item.pinStyle='classic'
      if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,viewRef.current);item.x=center.x-item.w/2;item.y=center.y-item.h/2}
      setTool('select');setConnecting(null);setSelected(null);setSelectedThread(null);openMap({id:item.id,draft:item});return
    }
    if(nextKind==='medal'||nextKind==='map'||nextKind==='photo'||nextKind==='sticker'){setModal(null);openRecord({mode:nextKind==='map'?'route':nextKind==='photo'?'photo':nextKind==='sticker'?'sticker':'medal'});return}
    setKind(nextKind);setDraft({title:'',variant:resolveStyle(nextKind).id,image:samplePhotos[0],number:'0826',date:''});openMemory('add')
  }
  const editItem = (item: Memory) => {
    if(item.groupId||item.locked){setSelected(item.id);closePanel();return}
    if(item.kind==='race-map'){openMapEditor(item);return}
    if((item.recordId&&recordPanel?.mode==='detail'&&recordPanel.id===item.recordId)||(!item.recordId&&memoryPanel==='edit'&&memoryEditingId.current===item.id))return
    setSelected(item.id);memoryEditingId.current=item.id;closePanel()
    if(item.exhibit){openExhibit(item.id);return}
    if(item.recordId){openRecord({mode:'detail',id:item.recordId,origin:'canvas'});return}
    setKind(item.kind);setDraft({title:item.title,variant:item.variant||'',image:item.image||samplePhotos[0],number:item.number||'0826',date:(item.subtitle||'').replaceAll('.','-')});openMemory('edit')
  }
  const arrangePhotoLine=()=>{if(lockedSelection(boardRef.current.items,selectedIds))return;try{const next=hangPhotos(boardRef.current,selectedIds);if(next===boardRef.current)return;commit(next);closePanel();fit();setToast(msg("App.101"))}catch(e){setToast(errorNotice(e,msg("App.100")))}}
  const mergeSelection=(layout:ExhibitLayout)=>{
    try{
      const result=mergeMedals(boardRef.current,selectedIds,layout)
      commit(result.board);setSelectedIds([result.item.id]);setSelectedThread(null);setConnecting(null);openExhibit(result.item.id)
      setToast(msg("App.099",{count:result.item.exhibit!.medals.length}))
    }catch(e){setToast(errorNotice(e,msg("App.098")))}
  }
  const splitSelection=()=>{
    if(!selected)return
    try{const result=splitMedals(boardRef.current,selected);commit(result.board);setSelectedIds(result.items.map(i=>i.id));setConnecting(null);closePanel();setToast(msg("App.097"))}catch(e){setToast(errorNotice(e,msg("App.096")))}
  }
  const openExhibitSlot=(item:Memory,slot:number)=>{
    try{
      availableExhibitSlot(boardRef.current,item.id,slot)
      setSelected(item.id);setSelectedThread(null);setTool('select');setConnecting(null);closePanel()
      openRecord({mode:'exhibit-add',exhibitId:item.id,exhibitSlot:slot})
    }catch(e){setToast(errorNotice(e,msg("App.095")))}
  }
  const changeLayer = (action:LayerAction) => {
    if(lockedSelection(boardRef.current.items,selectedIds))return
    const current=boardRef.current,items=reorderItems(current.items,selectedIds,action)
    if(items.some((item,i)=>item!==current.items[i]))commit({...current,items})
  }
  const arrangeSelection=(action:LayoutAction)=>{const current=boardRef.current,items=arrangeItems(current.items,selectedIds,action);if(items.some((i,n)=>i!==current.items[n]))commit({...current,items})}
  const groupSelection=(ungroup:boolean)=>{const current=boardRef.current;if(lockedSelection(current.items,selectedIds))return;const groupId=ungroup?undefined:crypto.randomUUID();commit({...current,items:current.items.map(i=>selectedIds.includes(i.id)?{...i,groupId}:i)});closePanel()}
  const lockSelection=()=>{const current=boardRef.current,locked=!lockedSelection(current.items,selectedIds);commit({...current,items:current.items.map(i=>selectedIds.includes(i.id)?{...i,locked}:i)});closePanel()}
  const layoutControls=<LayoutMenu key={'layout:'+selectedIds.join(',')} items={board.items} ids={selectedIds} onArrange={arrangeSelection} onGroup={groupSelection} onLock={lockSelection}/>
  const addRecord = async (record: CollectionRecord,layout?:Partial<Memory>) => {
    const current=boardRef.current
    if(recordPanel?.exhibitId&&recordPanel.exhibitSlot!==undefined){
      if(record.kind!=='medal')throw new AppError("App.094")
      const medal={...createMemory('medal',record.name,record.variant||'bronze','',''),...layout,recordId:record.id}
      commit(addMedalToExhibit(current,recordPanel.exhibitId,recordPanel.exhibitSlot,medal))
      setSelected(recordPanel.exhibitId);setSelectedThread(null);setTool('select');setConnecting(null);setToast(msg("App.093",{v1:recordPanel.exhibitSlot+1}))
      return
    }
    if(current.items.length>=500){setToast(msg("App.091"));return}
    const item=createMemory(record.kind==='medal'?'medal':record.kind==='photo'?'photo':record.kind==='bib'?'bib':record.kind==='sticker'?'sticker':'map',record.name,record.kind==='medal'?(record.variant||'bronze'):'blue','','')
    item.recordId=record.id
    if(record.kind==='bib')Object.assign(item,bibLayout(record.width,record.height))
    if(record.kind==='sticker')Object.assign(item,stickerSize(record.width,record.height),{stickerBorder:2,rotation:0})
    if(layout)Object.assign(item,layout)
    const el=viewport.current
    if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,viewRef.current);item.x=center.x-item.w/2;item.y=center.y-item.h/2}
    commit({...current,items:[...current.items,item]});setSelected(item.id);setSelectedThread(null);setTool('select');setConnecting(null);setToast(msg("App.092"))
  }
  const saveRecord = async (record:CollectionRecord,add:boolean,layout?:Partial<Memory>) => {
    if(add&&recordPanel?.exhibitId&&recordPanel.exhibitSlot!==undefined)availableExhibitSlot(boardRef.current,recordPanel.exhibitId,recordPanel.exhibitSlot)
    if(add&&!(recordPanel?.exhibitId&&recordPanel.exhibitSlot!==undefined)&&boardRef.current.items.length>=500)throw new AppError("App.091")
    await library.save([record])
    if(add)await addRecord(record,layout)
    else if(record.kind==='sticker'){
      const current=boardRef.current
      const items=current.items.map(item=>{
        if(item.recordId!==record.id)return item
        const change=resizeSticker(item,record.width,record.height,item.id===selected?layout?.stickerBorder??item.stickerBorder??2:item.stickerBorder??2,item.id===selected&&layout?.w&&layout?.h?Math.max(layout.w,layout.h):Math.max(item.w,item.h),item.id===selected?layout?.stickerStyle??item.stickerStyle:item.stickerStyle)
        return change.w===item.w&&change.h===item.h&&change.stickerBorder===(item.stickerBorder??2)&&change.stickerStyle===(item.stickerStyle??'contour')?item:{...item,...change}
      })
      if(items.some((item,index)=>item!==current.items[index]))commit({...current,items})
    }
    else if(record.kind==='bib'){
      const current=boardRef.current
      const items=current.items.map(item=>{if(item.recordId!==record.id)return item;const size=bibLayout(record.width,record.height,item.id===selected?layout?.w??item.w:item.w);return size.w===item.w&&size.h===item.h?item:{...item,...size,x:item.x+(item.w-size.w)/2,y:item.y+(item.h-size.h)/2}})
      if(items.some((item,index)=>item!==current.items[index]))commit({...current,items})
    }
  }
  const importPhotos=async(photos:BatchPhoto[])=>{
    if(fileOperation.current)throw new AppError("App.084")
    if(!photos.length||photos.length>MAX_BATCH_PHOTOS)throw new AppError("App.090",{v1:MAX_BATCH_PHOTOS})
    const current=boardRef.current
    if(current.items.length+photos.length>500)throw new AppError("App.089",{v1:Math.max(0,500-current.items.length)})
    const el=viewport.current
    const center=el?screenToWorld(el.clientWidth/2,el.clientHeight/2,viewRef.current):{x:0,y:0}
    const items=layoutBatchPhotos(photos,center)
    await runFileOperation(null,async()=>{
      // Persist all originals in one transaction before one undoable canvas change.
      await library.save(photos.map(photo=>photo.record))
      commit({...boardRef.current,items:[...boardRef.current.items,...items]})
      setSelectedIds(items.map(item=>item.id));setSelectedThread(null);setConnecting(null);setTool('select')
      closePanel()
      if(el)setView(fitCamera(contentBounds(items,60),el.clientWidth,el.clientHeight))
      setToast(msg("App.088",{count:items.length}))
    })
  }
  const deleteRecord = async (id:string) => {
    if(fileOperation.current)throw new AppError("App.084")
    if(recordThreadReferences(boardRef.current,id))throw new AppError("App.087")
    if(boardMembers(boardRef.current.items).some(item=>item.recordId===id))throw new AppError("App.086")
    await runFileOperation(null,async()=>{
      // Persist removal from the canvas before releasing the original files.
      if(!boardSave.retry())throw new AppError("App.081")
      await library.remove(id)
      // Undo must never restore an item whose source files were permanently deleted.
      history.forgetRecord(id);setToast(msg("App.085"))
    })
  }
  const emptyRecycle = async (ids:string[]) => {
    if(fileOperation.current)throw new AppError("App.084")
    if(ids.some(id=>!library.records.find(r=>r.id===id)?.archived))throw new AppError("App.083")
    if(ids.some(id=>recordThreadReferences(boardRef.current,id)||boardMembers(boardRef.current.items).some(item=>item.recordId===id)))throw new AppError("App.082")
    await runFileOperation(null,async()=>{
      if(!boardSave.retry())throw new AppError("App.081")
      await library.removeMany(ids)
      ids.forEach(id=>history.forgetRecord(id))
      setToast(msg("App.080",{count:ids.length}))
    })
  }
  const submitMemory = (e: FormEvent) => {
    e.preventDefault()
    const title=draft.title.trim() || {sticker:tr("App.079"),photo:tr("App.078"),medal:'RIDGE 50K',bib:'RIDGE 50K',note:tr("App.077"),map:tr("App.076"),'race-map':tr("App.075")}[kind]
    if(memoryPanel==='edit') {
      const current=boardRef.current
      if(!current.items.some(i=>i.id===memoryEditingId.current)){setToast(msg("App.074"));closePanel();return}
      commit({...current,items:current.items.map(i=>i.id===memoryEditingId.current?{...i,title,variant:draft.variant,image:i.kind==='photo'?draft.image:i.image,number:draft.number,subtitle:i.kind==='photo'?draft.date:i.subtitle}:i)})
      setToast(msg("App.073"))
    }
    else {const item=createMemory(kind,title,draft.variant,draft.image,draft.number);if(kind==='photo')item.subtitle=draft.date;const el=viewport.current;if(el){const center=screenToWorld(el.clientWidth/2,el.clientHeight/2,view);item.x=center.x-item.w/2;item.y=center.y-item.h/2}commit({...board,items:[...board.items,item]});setSelected(item.id);setToast(msg("App.072"))}
    setTool('select');setConnecting(null);closePanel()
  }
  const transformItem = (change: Partial<Memory>) => { if(selected&&!selectedItem?.locked) commit({...board,items:board.items.map(i=>i.id===selected?{...i,...change}:i)}) }
  const editingExhibit=recordPanel?.mode==='detail'&&selectedItem&&selectedItem.id===recordPanel.exhibitId&&!selectedItem.locked&&!selectedItem.groupId?selectedItem:undefined
  const editingExhibitMedal=editingExhibit?exhibitCells(editingExhibit).find(m=>m.id===recordPanel?.medalId&&m.recordId===recordPanel.id):undefined
  const addingExhibitMedal=!!recordPanel?.exhibitId&&recordPanel.exhibitSlot!==undefined
  const returnToExhibit=()=>{
    closePanel()
    const item=boardRef.current.items.find(i=>i.id===recordPanel?.exhibitId)
    if(item?.exhibit&&!item.locked&&!item.groupId){setSelected(item.id);openExhibit(item.id)}
  }
  const transformExhibitMedal=(change:Partial<Memory>)=>{
    if(!editingExhibitMedal||!editingExhibit||change.medalScale===undefined||!Number.isFinite(change.medalScale))return
    const medalScale=Math.min(1.8,Math.max(.4,change.medalScale)),current=boardRef.current
    commit({...current,items:current.items.map(i=>i.id===editingExhibit.id&&i.exhibit&&!i.locked&&!i.groupId?{...i,exhibit:{...i.exhibit,medals:i.exhibit.medals.map(m=>m.id===editingExhibitMedal.id?{...m,medalScale}:m)}}:i)})
  }

  const exportJson = async () => {
    if(fileOperation.current)return
    setModal(null)
    try{await runFileOperation('backup',async()=>{
      const blob=await makeZipArchive(boardRef.current,library.records)
      downloadBlob(blob,`${board.title}.zip`);setToast(msg("App.071"))
    })}catch(e){setToast(errorNotice(e,msg("App.070")))}
  }
  const exportImage = async () => {
    const element=scene.current
    if(!element || fileOperation.current) return
    setModal(null)
    setSelected(null);setSelectedThread(null);setConnecting(null)
    try {await runFileOperation('image',async()=>{
      const blob=await exportBoardImage(element,boardRef.current,library.records,light.enabled)
      downloadBlob(blob,`${board.title}.png`);setToast(msg("App.069"))
    })}catch{setToast(msg("App.068"))}
  }
  const importJson = async (file?: File) => {
    if(!file||fileOperation.current)return
    setModal(null)
    try{await runFileOperation('restore',async()=>{
      if(file.size>80*1024*1024)throw new AppError("App.067")
      const data=await readBackup(file);await library.save(data.records)
      commit(data.board);setSelected(null);setSelectedThread(null);setConnecting(null);closePanel();setModal(null);fit();setToast(msg("App.066"))
    })}catch(e){setToast(errorNotice(e,msg("App.065")))}
    finally{if(inputFile.current)inputFile.current.value=''}
  }
  const startPin = connecting?pointFor(connecting):null
  const visible=visibleBounds(view,viewportSize.width,viewportSize.height)
  const boardBounds=useMemo(()=>contentBounds(board.items,60,board.threads,decorations.pin,library.records),[board.items,board.threads,decorations.pin,library.records])

  const itemStyles=selectedItem?<DecorationPanel embedded board={board} item={selectedItem} scope="selection" onClose={()=>{}} onCurvature={()=>{}} onPinToggle={enabled=>commit(setTapePin(boardRef.current,selectedItem.id,enabled))} onChange={change=>commit(changeDecoration(boardRef.current,change,selectedItem.id))}/>:null
  return <div data-light={light.enabled?'on':'off'} className={`app-shell ${touchLayout?'is-touch':''} ${recordPanel||memoryPanel||mapPanel||exhibitPanel||decorationOpen?'has-editor':''}`}>
    {selectedItem?.exhibit&&exhibitPanel===selectedItem.id&&!selectedItem.locked&&!selectedItem.groupId&&<MedalExhibitEditor item={selectedItem} records={library.records} onAdd={slot=>openExhibitSlot(selectedItem,slot)} onChange={transformItem} onClose={()=>closePanel()} onSplit={splitSelection} onEdit={medal=>{openRecord({mode:'detail',id:medal.recordId,exhibitId:selectedItem.id,medalId:medal.id})}}/>}
    {!library.ready&&<div className="records-loading" role="status"><div><h2>{library.error?tr("App.063"):tr("App.062")}</h2>{library.error&&<><p>{library.error}</p><button className="primary-button" onClick={library.retry}>{tr("App.061")}</button></>}</div></div>}
    <FileOperationOverlay operation={operation}/>
    {saveError&&<div className="save-failure-banner" role="alert"><span>{saveError}</span><span>{tr("App.060")}</span>{boardSave.error&&<button onClick={boardSave.retry}>{tr("App.059")}</button>}<button onClick={()=>setModal('share')}>{tr("App.058")}</button></div>}
    {library.ready&&recordPanel&&<RecordPanel exhibitMedal={!!editingExhibitMedal||addingExhibitMedal} onBack={addingExhibitMedal?(recordPanel.mode==='medal'?()=>openRecord({...recordPanel,mode:'exhibit-add'}):returnToExhibit):editingExhibitMedal?returnToExhibit:undefined} onImportPhotos={importPhotos} onBibTemplate={()=>openAdd('bib')} styles={recordPanel.mode==='detail'&&selectedItem?.recordId===recordPanel.id?itemStyles:undefined} item={editingExhibitMedal??(recordPanel.mode==='detail'&&selectedItem&&selectedItem.recordId===recordPanel.id?selectedItem:undefined)} onLayout={editingExhibitMedal?transformExhibitMedal:transformItem} mode={recordPanel} records={library.records} references={id=>boardMembers(board.items).filter(i=>i.recordId===id).length} threadReferences={id=>recordThreadReferences(board,id)} onMode={openRecord} onClose={addingExhibitMedal?returnToExhibit:()=>closePanel()} onSave={saveRecord} onDelete={deleteRecord} onEmptyRecycle={emptyRecycle} onAdd={addingExhibitMedal?record=>addRecord(record):record=>{void addRecord(record).catch(()=>setToast(msg("App.057")))}}/>}
    {memoryPanel&&<MemoryEditor onBibUpload={()=>{openRecord({mode:'bib'})}} memoryPanel={memoryPanel} kind={kind} selectedItem={selectedItem} draft={draft} setDraft={setDraft} transformItem={transformItem} itemStyles={itemStyles} submitMemory={submitMemory} onClose={()=>{closePanel()}}/>}
    {mapItem&&mapPanel&&<RaceMapEditor creating={!!mapPanel.draft} key={mapItem.id} item={mapItem} board={board} records={library.records} groups={mapGroups} groupKey={mapPanel.groupKey} choosing={!!mapPanel.choosing&&tool==='connect'} hiddenThreads={hiddenMapThreads} onClose={()=>{closePanel()}} onSelectGroup={groupKey=>openMap({...mapPanel,groupKey,choosing:false})} onConnect={raceId=>connectEndpoint({itemId:mapItem.id,raceId})} onRemoveThread={id=>commit({...board,threads:board.threads.filter(t=>t.id!==id)})} onSave={change=>{const current=boardRef.current;const next={...mapItem,...change,x:mapItem.x+(mapItem.w-(change.w??mapItem.w))/2,y:mapItem.y+(mapItem.h-(change.h??mapItem.h))/2};if(mapPanel.draft){if(current.items.length>=500)return;commit({...current,items:[...current.items,next]});setSelected(next.id)}else commit({...current,items:current.items.map(i=>i.id===next.id?next:i)})}} onRace={id=>{
      closePanel()
      const member=boardMembers(board.items).find(i=>i.recordId===id),item=member?ownerOf(board.items,member.id):undefined
      if(item){const el=viewport.current;if(el)setView(v=>({...v,x:el.clientWidth/2-(item.x+item.w/2)*v.scale,y:el.clientHeight/2-(item.y+item.h/2)*v.scale}));editItem(item)}else{setSelected(null);openRecord({mode:'detail',id,origin:'canvas'})}
    }}/>}
    <Topbar board={board} saved={saved} saveError={saveError} saveFailed={!!boardSave.error} onRetry={boardSave.retry} onRename={title=>commit({...board,title})} onShare={()=>setModal('share')}/>
    {light.enabled&&<BoardLighting/>}
    <BoardActions decorationOpen={decorationOpen} libraryOpen={recordPanel?.mode==='library'} onDecoration={()=>decorationOpen?closePanel():openDecoration('board')} onLibrary={()=>openRecord({mode:'library'})}/>
    {decorationOpen && <DecorationPanel lighting={light} onBackground={id=>{if(resolveBackground(boardRef.current.backgroundStyle).id!==id)commit({...boardRef.current,backgroundStyle:id})}} onCurvature={curvature=>{const current=boardRef.current;commit({...current,threads:current.threads.map(t=>t.id===selectedThread?{...t,curvature}:t)})}} board={board} thread={board.threads.find(t=>t.id===selectedThread)} scope={decorationScope} onClose={()=>closePanel()} onPinToggle={enabled=>{if(selected)commit(setTapePin(board,selected,enabled))}} onChange={change=>{
      const target = decorationScope==='selection' ? (change.kind==='thread'?selectedThread:selected) : undefined
      if(decorationScope==='selection' && !target) return
      commit(changeDecoration(board,change,target??undefined))
    }}/>}
    <main onContextMenu={e=>{e.preventDefault();if(gesture.current||touchGestures.active()||(e.nativeEvent as PointerEvent).pointerType==='touch')return;layerTarget.cancel();setCanvasMenu({x:e.clientX,y:e.clientY})}} className={`board-viewport ${space?'space-mode':''} ${dragging?'is-dragging':''} ${tool==='connect'?'connect-mode':''} ${layerTarget.mode?'layer-target-mode':''}`} ref={viewport} onDoubleClickCapture={e=>{if(tool==='connect'){e.preventDefault();e.stopPropagation();setTool('select');setConnecting(null);setToast(msg("App.056"))}}}  onPointerMoveCapture={e=>{if(!touchGestures.move(e))layerTarget.onMove(e)}} onPointerUpCapture={e=>touchGestures.up(e)} onPointerCancelCapture={e=>touchGestures.up(e,true)} onLostPointerCaptureCapture={e=>touchGestures.lost(e)} onPointerLeave={()=>{if(layerTarget.mode)layerTarget.clearHover()}} onPointerDownCapture={e=>{if(touchGestures.down(e))return;if(e.button===2){e.stopPropagation();return}if(layerTarget.mode){layerTarget.onDown(e);return}if(e.ctrlKey&&e.button===0&&tool==='select'&&!space)startGesture(e)}} onPointerDown={e=>startGesture(e)} onPointerMove={moveGesture} onPointerUp={()=>endGesture()} onPointerCancel={()=>endGesture(true)} onLostPointerCapture={()=>endGesture()}>
      <CanvasBackground id={board.backgroundStyle} view={view}/>
      <BoardLightWash/>
      <div className="scene cork" ref={scene} style={{width:1,height:1,transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}>
        {board.items.map(item=><div key={item.id} data-board-item={item.id} role="button" tabIndex={0} aria-label={`${item.exhibit?tr("App.027"):item.kind==='sticker'?tr("App.026"):item.kind==='medal'?tr("App.024"):item.kind==='photo'?tr("App.025"):item.kind==='bib'?tr("App.023"):item.kind==='note'?tr("App.022"):item.kind==='race-map'?tr("App.021"):tr("App.020")}：${displayMemory(item,recordFor(item,library.records)).title}`} aria-pressed={selectedIds.includes(item.id)} className={`memory memory-${item.kind} ${item.exhibit?'memory-exhibit':''} ${selectedIds.includes(item.id)?'selected':''} ${item.locked?'is-locked':''} ${item.groupId?'is-grouped':''} ${layerTarget.highlightIds.includes(item.id)?'layer-target-highlight':''} ${connecting?.itemId===item.id?'connection-source':''}`} style={{left:item.x,top:item.y,width:item.w,height:item.h,transform:`rotate(${item.rotation}deg)`}} onPointerDown={e=>startGesture(e,item)} onDoubleClick={e=>{if(!touchLayout&&tool!=='connect'&&!e.ctrlKey&&selectedIds.length<2)editItem(item)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(tool==='connect')connectItem(item.id);else{setSelected(item.id);setSelectedThread(null);editItem(item)}}}}><ItemMotion item={item} pin={decorations.pin} lifted={dragging&&gesture.current?.type==='item'&&!!gesture.current.ids?.includes(item.id)}><Artwork records={library.records} raceGroups={mapGroups} item={item} record={recordFor(item,library.records)} tapeStyle={item.tapeStyle??decorations.tape}/></ItemMotion><div className="selection-outline"/></div>)}
        <svg className="threads" width={1} height={1} aria-label={tr("App.055")}>
          <defs><filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#4c281c" floodOpacity=".5"/></filter></defs>
          {board.threads.map(thread=>{const from=worldItems.find(i=>i.id===thread.from),to=worldItems.find(i=>i.id===thread.to);if(!from||!to)return null;const [a,b]=threadEndpoints(thread).map(pointFor);if(!a||!b)return null;const d=threadCurve(a,b,thread.curvature).d;return <g key={thread.id} data-board-thread={thread.id} role="button" tabIndex={0} aria-label={tr("App.054",{v1:from.title,v2:to.title})} aria-pressed={selectedThread===thread.id} onFocus={()=>{setSelectedThread(thread.id);setSelected(null)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}}><path className="thread-hit" d={d} onPointerDown={e=>{if(space)return;e.preventDefault();e.stopPropagation();setSelectedThread(thread.id);setSelected(null)}}/>{selectedThread===thread.id&&<path className="thread-selection" d={d}/>}<ThreadStroke d={d} style={thread.style??decorations.thread} shadow/></g>})}
          {tool==='connect' && startPin && cursor && <path className="draft-thread" d={threadCurve(startPin,cursor).d}/>}
        </svg>
        {worldItems.filter(item=>canConnect(item)&&(!item.exhibit||board.threads.some(t=>t.from===item.id||t.to===item.id))&&(hasPin(item)||tool==='connect'||(item.kind==='medal'&&board.threads.some(t=>t.from===item.id||t.to===item.id)))).map(item=>{
          const p=pinPosition(item,decorations.pin), pinned=hasPin(item),owner=ownerOf(board.items,item.id)!
          const mountClass=item.kind==='medal'?'medal-thread-eyelet':pinned?`pushpin pin-${item.pinStyle??decorations.pin}`:'connection-anchor'
          return <button key={item.id} data-board-anchor={item.id} data-owner-id={owner.id} className={`${mountClass} ${connecting?.itemId===item.id?'pin-active':''}`} aria-label={`${item.kind==='medal'?tr("App.053"):pinned?(item.pinStyle??decorations.pin)==='clip'?tr("App.052"):tr("App.051"):tr("App.050")}：${displayMemory(item,recordFor(item,library.records)).title}`} style={{left:p.x,top:p.y,...((item.pinStyle??decorations.pin)==='clip'||item.kind==='medal'?{transform:`translate(-50%,-50%) rotate(${item.rotation}deg)`}:{})}} onPointerDown={e=>{if(space)startGesture(e);else if(tool==='connect'){e.stopPropagation();connectItem(item.id)}else startGesture(e,owner)}} onClick={e=>{if(e.detail===0){if(tool==='connect')connectItem(item.id);else{setSelected(owner.id);setSelectedThread(null);editItem(owner)}}}}>{pinned&&(item.pinStyle??decorations.pin)==='clip'&&<Clothespin/>}</button>
        })}
        {board.items.filter(i=>i.kind==='race-map').flatMap(item=>mapGroups.map(group=>{
          const p=racePointOnMap(item,group.races[0]);if(!p)return null
          const pin=item.pinStyle??decorations.pin
          const active=connecting?.itemId===item.id&&group.races.some(r=>r.id===connecting.raceId)
          const activate=()=>{if(tool==='connect'){if(group.races.length===1)connectEndpoint({itemId:item.id,raceId:group.races[0].id});else openMapEditor(item,group.key,true)}else openMapEditor(item,group.key)}
          return <button key={`${item.id}:${group.key}`} data-map-id={item.id} data-map-group={group.key} className={`pushpin map-place-pin pin-${pin} ${active?'pin-active':''}`} aria-label={tr("App.049",{v1:group.name,v2:group.races.length})} style={{left:p.x,top:p.y,...(pin==='clip'?{transform:`translate(-50%,-50%) rotate(${item.rotation}deg)`}:{})}} onPointerDown={e=>{
            if(tool==='connect'&&!space){e.stopPropagation();activate();return}
            startGesture(e,item);if(gesture.current?.type==='item')gesture.current.mapGroupKey=group.key
          }} onClick={e=>{if(e.detail===0)activate()}}>{pin==='clip'&&<Clothespin/>}</button>
        }))}
        {snapEnabled&&guides.map((g,index)=><div key={index} className="snap-guide" style={g.axis==='x'?{left:g.value,top:g.start,width:1/view.scale,height:g.end-g.start}:{left:g.start,top:g.value,width:g.end-g.start,height:1/view.scale}}/>)}
        {marquee&&<div className="marquee-selection" style={{left:marquee.x,top:marquee.y,width:marquee.width,height:marquee.height,borderWidth:1.5/view.scale}}/>}
        {board.items.length===0 && <div className="empty-board" style={{left:visible.x+visible.width/2,top:visible.y+visible.height*.3,width:600}}><MountainLogo/><h1>{tr("App.048")}</h1><p>{tr("App.047")}</p><button className="primary-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>openAdd('photo')}><Plus size={18}/>{tr("App.046")}</button></div>}
      </div>
    </main>
    {canvasMenu&&<CanvasContextMenu position={canvasMenu} snapEnabled={snapEnabled} onToggle={toggleSnap} onClose={closeCanvasMenu} canClear={canClear} onClear={()=>{closeCanvasMenu();setModal('clear')}}/>}
    <ToolPalette multiSelect={multiSelect} onMultiSelect={()=>{setMultiSelect(value=>!value);setTool('select');setConnecting(null);closePanel()}} tool={tool} onSelect={()=>{setMultiSelect(false);setTool('select');setConnecting(null)}} onConnect={()=>{setMultiSelect(false);setTool(tool==='connect'?'select':'connect');setConnecting(null);setSelected(null);setSelectedThread(null)}} onAdd={openAdd}/>
    {layerTarget.mode&&<div className="connection-hint layer-target-hint" data-layer-target-hint role="status"><span>{layerTarget.target?tr("App.045",{v1:board.items.find(i=>i.id===layerTarget.target)?.title.replaceAll('\n',' ')||tr("App.044"),v2:layerTarget.mode.action==='above'?tr("App.042"):tr("App.041")}):tr("App.043",{v1:layerTarget.mode.action==='above'?tr("App.042"):tr("App.041")})}<small>{tr("App.040")}</small></span><button type="button" onClick={layerTarget.cancel} aria-label={tr("App.039")}><X size={16}/></button></div>}
    <HintGroup><div className="history-controls" data-history={historyTick}><HintButton hint={tr("App.038")} aria-label={tr("App.037")} disabled={!history.canUndo || dragging} onClick={undo}><Undo2 size={17}/></HintButton><span/><HintButton hint={tr("App.036")} aria-label={tr("App.035")} disabled={!history.canRedo || dragging} onClick={redo}><Redo2 size={17}/></HintButton></div></HintGroup>
    {tool==='connect' && <div className="connection-hint"><span className="red-dot"/>{connecting?tr("App.034"):tr("App.033")}<button onClick={()=>{setTool('select');setConnecting(null)}} aria-label={tr("App.032")}><X size={16}/></button></div>}
    {!layerTarget.mode&&selectedIds.length>1&&tool==='select'&&<SelectionToolbar>{selectedMedals.length===selectedIds.length&&<MedalMergeMenu count={selectedMedals.length} disabled={selectedMedals.length>8||lockedSelection(board.items,selectedIds)} onMerge={mergeSelection}/>} {layoutControls}<LayerMenu key={selectedIds.join(',')} items={board.items} ids={selectedIds} onChange={changeLayer} onTarget={layerTarget.begin}/><HintButton className="photo-line-action" onClick={arrangePhotoLine} disabled={selectedPhotos.length<2||lockedSelection(board.items,selectedIds)} aria-label={tr("App.031")}><Spline size={17}/><span>{tr("App.031")}</span></HintButton><HintButton disabled={lockedSelection(board.items,selectedIds)} className="delete-button" onClick={removeSelected} aria-label={tr("App.030")} data-tooltip={tr("App.014")}><Trash2 size={17}/></HintButton>{!touchLayout&&<HintButton onClick={()=>setSelected(null)} aria-label={tr("App.029")}><X size={16}/></HintButton>}</SelectionToolbar>}
    {!layerTarget.mode&&(selectedItem || selectedThread) && tool==='select' && <SelectionToolbar>{selectedItem ? <>{touchLayout&&<HintButton aria-label={tr("App.028")} disabled={!!selectedItem.locked||!!selectedItem.groupId} onClick={()=>editItem(selectedItem)}><Pencil size={17}/></HintButton>}<span className="selection-label">{selectedItem.exhibit?tr("App.027"):selectedItem.kind==='sticker'?tr("App.026"):selectedItem.kind==='photo'?tr("App.025"):selectedItem.kind==='medal'?tr("App.024"):selectedItem.kind==='bib'?tr("App.023"):selectedItem.kind==='note'?tr("App.022"):selectedItem.kind==='race-map'?tr("App.021"):tr("App.020")}</span>{selectedItem.exhibit&&<MedalSplitButton disabled={!!selectedItem.locked||!!selectedItem.groupId} onSplit={splitSelection}/>} {layoutControls}<LayerMenu key={selectedItem.id} items={board.items} ids={selectedIds} onChange={changeLayer} onTarget={layerTarget.begin}/><span className="bar-divider"/><HintButton disabled={!!selectedItem.locked} onClick={()=>transformItem({rotation:selectedItem.rotation-5})} aria-label={tr("App.019")}><RotateCcw size={17}/></HintButton><HintButton disabled={!!selectedItem.locked} onClick={()=>transformItem({rotation:selectedItem.rotation+5})} aria-label={tr("App.018")}><RotateCw size={17}/></HintButton></> : <span className="selection-label">{tr("App.017")}</span>}{!selectedItem&&<HintButton onClick={()=>{openDecoration('selection')}} aria-label={tr("App.016")}><Palette size={17}/></HintButton>}<HintButton disabled={lockedSelection(board.items,selectedIds)} className="delete-button" onClick={removeSelected} aria-label={tr("App.015")} data-tooltip={tr("App.014")}><Trash2 size={17}/></HintButton>{!touchLayout&&<HintButton onClick={()=>{setSelected(null);setSelectedThread(null)}} aria-label={tr("App.013")}><X size={16}/></HintButton>}</SelectionToolbar>}
    <div className="bottom-hint"><Move size={13}/><span>{touchLayout?(multiSelect?tr("App.012"):tr("App.011")):<>{tr("App.010")}<span className="hint-dot">·</span>{tr("App.009")}<span className="hint-dot">·</span>{tr("App.008")}</>}</span><button onClick={()=>setModal('help')} aria-label={tr("App.007")}><Keyboard size={15}/></button></div>
    <div className="board-signature" style={{color:resolveBackground(board.backgroundStyle).ink}}>{tr("App.006")}<span>EVERY TRAIL TELLS A STORY</span></div>
    <HintGroup><div className="zoom-controls"><HintButton aria-label={tr("App.005")} onClick={()=>zoom(1.2)}><Plus size={21}/></HintButton><HintButton aria-label={tr("App.004")} onClick={()=>zoom(1/1.2)}><Minus size={21}/></HintButton><span/><HintButton aria-label={tr("App.003")} hint={tr("App.002")} onClick={fit}><Maximize size={18}/></HintButton><HintButton className="zoom-value" aria-label={tr("App.001")} onClick={()=>{const el=viewport.current;if(el)zoomAt(1,el.clientWidth/2,el.clientHeight/2)}}>{Math.round(view.scale*100)}%</HintButton></div></HintGroup>
    <Minimap board={board} records={library.records} pin={decorations.pin} bounds={boardBounds} view={view} width={viewportSize.width} height={viewportSize.height} onChange={setView}/>
    <input ref={inputFile} type="file" accept=".zip,application/zip,.json,application/json" hidden onChange={e=>void importJson(e.target.files?.[0])}/>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    <BoardDialog onClear={clearBoard} canClear={canClear} modal={modal} board={board} exporting={exporting} exportImage={exportImage} exportJson={exportJson} onImport={()=>inputFile.current?.click()} onClose={()=>setModal(null)}/>
  </div>
}
