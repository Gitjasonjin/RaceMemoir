import {AppError} from '../i18n/runtime.ts'
import {toBlob} from 'html-to-image'
import type {CollectionRecord} from '../domain/records'
import type {Board} from '../domain/model'
import {getDecorations} from '../domain/model'
import {backgroundStyle} from '../domain/styleCatalog'
import {contentBounds,exportSize} from '../board/canvas'
import {prepareSticker,stickerSource} from '../items/sticker/stickerImage'
import {exportFontCSS} from './exportFonts'

/** Render a detached snapshot; export fixes stay shared across every item type. */
export async function exportBoardImage(scene:HTMLDivElement,board:Board,records:CollectionRecord[]=[],lighting=false):Promise<Blob>{
  const wrapper=document.createElement('div')
  try{
    await Promise.all(board.items.filter(i=>i.kind==='sticker').map(item=>{
      const record=records.find(r=>r.id===item.recordId)
      if(record?.kind!=='sticker')throw new AppError("exportImage.009")
      return prepareSticker(stickerSource(record),item.stickerBorder??2,item.stickerStyle)
    }))
    const routeMaps=Array.from(scene.querySelectorAll<SVGSVGElement>('[data-route-map-state]'))
    routeMaps.forEach(map=>map.dispatchEvent(new Event('prepare-route-map')))
    const mapDeadline=performance.now()+45000
    while(routeMaps.some(map=>map.dataset.routeMapState==='idle'||map.dataset.routeMapState==='loading')){
      if(performance.now()>mapDeadline)throw new AppError("exportImage.008")
      await new Promise<void>(resolve=>setTimeout(resolve,50))
    }
    if(routeMaps.some(map=>map.dataset.routeMapState==='error'))throw new AppError("exportImage.007")
    const deadline=performance.now()+10000
    while(scene.querySelector('[data-sticker-state="loading"]')){
      if(performance.now()>deadline)throw new AppError("exportImage.006")
      await new Promise<void>(resolve=>setTimeout(resolve,30))
    }
    if(scene.querySelector('[data-sticker-state="error"]'))throw new AppError("exportImage.005")
    await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    await Promise.all(Array.from(scene.querySelectorAll('img')).map(img=>img.decode()))
    const bounds=contentBounds(board.items,60,board.threads,getDecorations(board).pin,records)
    // Reserve headroom for the lamp when exporting the entire lit collection.
    if(lighting){bounds.y-=50;bounds.height+=50}
    const size=exportSize(bounds)
    Object.assign(wrapper.style,{position:'fixed',left:'-10000px',top:'0',width:`${size.width}px`,height:`${size.height}px`,overflow:'hidden',...backgroundStyle(board.backgroundStyle,size.scale,-bounds.x*size.scale,-bounds.y*size.scale)})
    wrapper.setAttribute('aria-hidden','true')
    wrapper.dataset.light=lighting?'on':'off'
    // Pseudo-element image URLs are not embedded by html-to-image.
    if(scene.querySelector('.pin-spool')){
      const response=await fetch('/spool-pin.svg')
      if(!response.ok)throw new AppError("exportImage.004")
      wrapper.style.setProperty('--spool-pin-image',`url("data:image/svg+xml,${encodeURIComponent(await response.text())}")`)
    }
    const clone=scene.cloneNode(true) as HTMLDivElement
    // html-to-image deep-clones SVG without inlining descendant CSS.
    // Preserve presentation styles before its standalone SVG loses our stylesheet.
    const originalSvg=scene.querySelectorAll<SVGElement>('svg *')
    const clonedSvg=clone.querySelectorAll<SVGElement>('svg *')
    const svgProperties=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','font-family','font-size','font-weight','letter-spacing','text-anchor','dominant-baseline','visibility','display','paint-order']
    originalSvg.forEach((element,index)=>{
      const computed=getComputedStyle(element)
      for(const property of svgProperties){
        const value=computed.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)'" ]+)["']?\)/g,'url(#$1)')
        clonedSvg[index].style.setProperty(property,value)
      }
    })
    // A snapshot must not capture a lift or a settling animation.
    clone.querySelectorAll<HTMLElement>('.memory-artwork').forEach(el=>{
      el.classList.remove('is-lifted')
      Object.assign(el.style,{transform:'none',filter:lighting?'drop-shadow(var(--light-shadow-x,0px) var(--light-shadow-y,5px) var(--light-shadow-blur,3px) #271d146b)':'none',transition:'none'})
    })
    clone.style.transform=`translate(${-bounds.x*size.scale}px,${-bounds.y*size.scale}px) scale(${size.scale})`
    clone.querySelectorAll('.snap-guide,.thread-hit,.marquee-selection,.photo-resize-handle,.selection-outline,.thread-selection,.draft-thread,.connection-anchor,.empty-board').forEach(node=>node.remove())
    wrapper.append(clone)
    if(lighting){
      const shell=scene.closest('.app-shell'),sourceWash=shell?.querySelector('.board-light-wash'),sourceLamp=shell?.querySelector('.board-light-fixtures .pendant-lamp')
      if(!sourceWash||!sourceLamp)throw new AppError("exportImage.003")
      const wash=sourceWash.cloneNode(true) as HTMLElement
      wash.style.setProperty('--light-origin-y',`${34*size.scale}px`)
      wash.querySelectorAll<HTMLElement>('div').forEach(el=>{el.style.transition='none';el.style.opacity='1'})
      wrapper.append(wash)
      if(sourceLamp){
      const lamp=sourceLamp.cloneNode(true) as SVGElement
      Object.assign(lamp.style,{position:'absolute',top:'0',left:'50%',width:`${Math.min(600,bounds.width*.6)*size.scale}px`,height:'auto',transform:'translateX(-50%)',zIndex:'18'})
      lamp.querySelectorAll<SVGElement>('.lamp-reflector,.lamp-bulb').forEach(el=>{el.style.opacity='1';el.style.transition='none'})
      wrapper.append(lamp)
      }
    }
    document.body.append(wrapper)
    // Layout the snapshot before waiting, so newly visible glyphs also load.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    await document.fonts.ready
    const fontEmbedCSS=await exportFontCSS(wrapper)
    const blob=await toBlob(wrapper,{fontEmbedCSS,pixelRatio:1,width:size.width,height:size.height,style:{position:'relative',inset:'auto',insetInline:'auto',insetBlock:'auto',left:'0',top:'0'}})
    if(!blob||!blob.size)throw new AppError("exportImage.002")
    const bitmap=await createImageBitmap(blob);if(bitmap.width!==size.width||bitmap.height!==size.height){bitmap.close();throw new AppError("exportImage.001")}bitmap.close()
    return blob
  }finally{wrapper.remove()}
}
