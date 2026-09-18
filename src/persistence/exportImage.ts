import {toBlob} from 'html-to-image'
import type {CollectionRecord} from '../domain/records'
import type {Board} from '../domain/model'
import {getDecorations} from '../domain/model'
import {backgroundStyle} from '../domain/styleCatalog'
import {contentBounds,exportSize} from '../board/canvas'
import {prepareSticker,stickerSource} from '../items/sticker/stickerImage'

/** Render a detached snapshot; export fixes stay shared across every item type. */
export async function exportBoardImage(scene:HTMLDivElement,board:Board,records:CollectionRecord[]=[]):Promise<Blob>{
  const wrapper=document.createElement('div')
  try{
    await Promise.all(board.items.filter(i=>i.kind==='sticker').map(item=>{
      const record=records.find(r=>r.id===item.recordId)
      if(record?.kind!=='sticker')throw new Error('贴纸记录丢失，无法导出')
      return prepareSticker(stickerSource(record),item.stickerBorder??2)
    }))
    const deadline=performance.now()+10000
    while(scene.querySelector('[data-sticker-state="loading"]')){
      if(performance.now()>deadline)throw new Error('贴纸尚未生成，请稍后重试导出')
      await new Promise<void>(resolve=>setTimeout(resolve,30))
    }
    if(scene.querySelector('[data-sticker-state="error"]'))throw new Error('贴纸图片不可用，请重新上传后再导出')
    await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    await Promise.all(Array.from(scene.querySelectorAll('img')).map(img=>img.decode()))
    const bounds=contentBounds(board.items,60,board.threads,getDecorations(board).pin,records), size=exportSize(bounds)
    Object.assign(wrapper.style,{position:'fixed',left:'-10000px',top:'0',width:`${size.width}px`,height:`${size.height}px`,overflow:'hidden',...backgroundStyle(board.backgroundStyle,size.scale,-bounds.x*size.scale,-bounds.y*size.scale)})
    wrapper.setAttribute('aria-hidden','true')
    // Pseudo-element image URLs are not embedded by html-to-image.
    if(scene.querySelector('.pin-spool')){
      const response=await fetch('/spool-pin.svg')
      if(!response.ok)throw new Error('工字钉图片读取失败')
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
    clone.querySelectorAll<HTMLElement>('.memory-artwork').forEach(el=>{el.classList.remove('is-lifted');Object.assign(el.style,{transform:'none',filter:'none',transition:'none'})})
    clone.style.transform=`translate(${-bounds.x*size.scale}px,${-bounds.y*size.scale}px) scale(${size.scale})`
    clone.querySelectorAll('.snap-guide,.thread-hit,.marquee-selection,.photo-resize-handle,.selection-outline,.thread-selection,.draft-thread,.connection-anchor,.empty-board').forEach(node=>node.remove())
    wrapper.append(clone);document.body.append(wrapper)
    const blob=await toBlob(wrapper,{pixelRatio:1,width:size.width,height:size.height,style:{position:'relative',inset:'auto',insetInline:'auto',insetBlock:'auto',left:'0',top:'0'}})
    if(!blob||!blob.size)throw new Error('无法生成 PNG 图片')
    const bitmap=await createImageBitmap(blob);if(bitmap.width!==size.width||bitmap.height!==size.height){bitmap.close();throw new Error('图片尺寸异常')}bitmap.close()
    return blob
  }finally{wrapper.remove()}
}
