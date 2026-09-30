import {useCallback,useEffect,useRef,useState} from 'react'
import type {RefObject} from 'react'
import './seasonTransition.css'

interface MotionRun {
  layer:HTMLDivElement
  host:HTMLElement
  snapshot:HTMLDivElement|null
  glow:HTMLDivElement|null
  canvases:HTMLCanvasElement[]
  animations:Animation[]
  frames:number[]
  timer:number|null
  background:string
}

/** Keep uploaded pixels alive when the old React board revokes its blob URLs. */
function freezePixels(source:HTMLImageElement|HTMLCanvasElement,target:HTMLElement,canvases:HTMLCanvasElement[]){
  const width=source instanceof HTMLImageElement?source.naturalWidth:source.width
  const height=source instanceof HTMLImageElement?source.naturalHeight:source.height
  if(!width||!height){target.style.visibility='hidden';return}
  const rect=source.getBoundingClientRect(),ratio=Math.min(1,1536/Math.max(width,height),Math.max(1,rect.width*2)/width,Math.max(1,rect.height*2)/height)
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio))
  const context=canvas.getContext('2d')
  if(!context)return
  try{context.drawImage(source,0,0,canvas.width,canvas.height)}catch{canvas.width=canvas.height=0;return}
  const computed=getComputedStyle(source)
  for(const property of computed)canvas.style.setProperty(property,computed.getPropertyValue(property))
  // The source may rely on img-only rules. Freeze their computed values instead.
  canvas.className=target.className
  canvas.setAttribute('aria-hidden','true')
  canvas.style.pointerEvents='none'
  target.replaceWith(canvas);canvases.push(canvas)
}

let snapshotId=0
function snapshotLayer(layer:HTMLDivElement):{snapshot:HTMLDivElement;canvases:HTMLCanvasElement[]}{
  const snapshot=layer.cloneNode(true) as HTMLDivElement,canvases:HTMLCanvasElement[]=[]
  snapshot.className='season-canvas-snapshot'
  snapshot.inert=true;snapshot.setAttribute('aria-hidden','true')
  const originals=[layer,...layer.querySelectorAll('*')],copies=[snapshot,...snapshot.querySelectorAll('*')]
  const prefix=`season-motion-${++snapshotId}-`,ids=new Map<string,string>()
  for(const node of copies){const id=node.getAttribute('id');if(id)ids.set(id,`${prefix}${id}`)}
  for(const [index,node] of copies.entries()){
    const source=originals[index]
    const id=node.getAttribute('id')
    if(id){if(node instanceof SVGElement)node.id=ids.get(id)!;else node.removeAttribute('id')}
    for(const attribute of Array.from(node.attributes)){
      if(attribute.name.startsWith('data-board-')||['data-map-id','data-map-group','data-owner-id','data-season-layer','data-season-motion','role','tabindex','aria-label','aria-pressed'].includes(attribute.name)){node.removeAttribute(attribute.name);continue}
      let value=attribute.value
      value=value.replace(/url\(["']?#([^\s)"']+)["']?\)/g,(_match,ref:string)=>`url(#${ids.get(ref)??ref})`)
      if((attribute.name==='href'||attribute.name==='xlink:href')&&value.startsWith('#'))value=`#${ids.get(value.slice(1))??value.slice(1)}`
      if(value!==attribute.value)node.setAttribute(attribute.name,value)
    }
    // Avoid exposing a second live scene or item to UI automation and selectors.
    if(node.classList.contains('scene'))node.classList.replace('scene','season-snapshot-scene')
    if(node.classList.contains('memory'))node.classList.replace('memory','season-snapshot-item')
    if(node.classList.contains('selection-outline'))(node as HTMLElement).style.display='none'
    if((source instanceof HTMLImageElement||source instanceof HTMLCanvasElement)&&node instanceof HTMLElement)freezePixels(source,node,canvases)
  }
  return {snapshot,canvases}
}

export function useSeasonTransition(layerRef:RefObject<HTMLDivElement|null>){
  const [busy,setBusy]=useState(false)
  const runRef=useRef<MotionRun|null>(null),activeRef=useRef(false),mounted=useRef(true)

  const cancel=useCallback(()=>{
    const run=runRef.current
    runRef.current=null;activeRef.current=false
    if(run){
      for(const frame of run.frames)cancelAnimationFrame(frame)
      if(run.timer!==null)clearTimeout(run.timer)
      for(const animation of run.animations)animation.cancel()
      run.snapshot?.remove();run.glow?.remove()
      for(const canvas of run.canvases)canvas.width=canvas.height=0
      run.layer.inert=false
      run.host.classList.remove('season-transition-running')
      run.host.style.backgroundColor=run.background
      delete run.host.dataset.seasonTransition
      delete run.layer.dataset.seasonMotion
    }
    if(mounted.current)setBusy(false)
  },[])

  /** Call before React replaces the old board; invoke the returned function after scheduling the new board. */
  const beforeSwitch=useCallback(()=>{
    cancel()
    const layer=layerRef.current,host=layer?.parentElement
    if(!layer||!host)return()=>{}
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const captured=reduced?{snapshot:null,canvases:[]}:snapshotLayer(layer)
    const run:MotionRun={layer,host,...captured,glow:null,animations:[],frames:[],timer:null,background:host.style.backgroundColor}
    runRef.current=run;activeRef.current=true;setBusy(true)
    layer.inert=true;host.classList.add('season-transition-running');host.dataset.seasonTransition='light'
    layer.dataset.seasonMotion='light'
    const material=layer.querySelector('.board-material')
    if(material)host.style.backgroundColor=getComputedStyle(material).backgroundColor
    if(run.snapshot){
      run.snapshot.style.width=`${layer.clientWidth}px`;run.snapshot.style.height=`${layer.clientHeight}px`
      host.append(run.snapshot)
    }
    // The snapshot covers the React commit. Two frames include the new board's layout and image effects.
    return()=>{
      if(runRef.current!==run)return
      const first=requestAnimationFrame(()=>{
        const second=requestAnimationFrame(()=>{
          if(runRef.current!==run)return
          if(typeof layer.animate!=='function'){cancel();return}
          const time=reduced?90:420
          const options:KeyframeAnimationOptions={duration:time,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'}
          let entering:Keyframe[]=[],leaving:Keyframe[]=[]
          if(reduced){entering=[{opacity:.8},{opacity:1}]}
          else{
            entering=[{opacity:0,filter:'brightness(.7)'},{opacity:.15,filter:'brightness(.75)',offset:.35},{opacity:1,filter:'brightness(1)'}]
            leaving=[{opacity:1,filter:'brightness(1)'},{opacity:.9,filter:'brightness(.7)',offset:.35},{opacity:0,filter:'brightness(.65)'}]
            const glow=document.createElement('div');glow.className='season-transition-glow';glow.setAttribute('aria-hidden','true');host.append(glow);run.glow=glow
            run.animations.push(glow.animate([{opacity:0},{opacity:.7,offset:.48},{opacity:0}],options))
          }
          run.animations.push(layer.animate(entering,options))
          if(run.snapshot)run.animations.push(run.snapshot.animate(leaving,options))
          Promise.all(run.animations.map(animation=>animation.finished)).then(()=>{if(runRef.current===run)cancel()}).catch(()=>{/* Cancellation is expected during rapid switching. */})
          if(run.timer!==null)clearTimeout(run.timer)
          run.timer=window.setTimeout(()=>{if(runRef.current===run)cancel()},time+120)
        })
        run.frames.push(second)
      })
      run.frames.push(first)
      // Avoid stranding a snapshot if rendering is interrupted before animations can start.
      run.timer=window.setTimeout(()=>{if(runRef.current===run)cancel()},1200)
    }
  },[cancel,layerRef])

  useEffect(()=>{
    mounted.current=true
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    window.addEventListener('resize',cancel);media.addEventListener('change',cancel)
    return()=>{mounted.current=false;cancel();window.removeEventListener('resize',cancel);media.removeEventListener('change',cancel)}
  },[cancel])

  return {beforeSwitch,cancel,busy,activeRef}
}
