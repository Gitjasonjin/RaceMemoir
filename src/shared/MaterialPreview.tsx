import {t as tr} from '../i18n/runtime.ts'
import {useLayoutEffect,useRef,useState} from 'react'
import type {ReactNode} from 'react'
import {resolveBackground} from '../domain/styleCatalog'
import {loadMaterialTexture} from './materialTexture'
export {preloadBackgroundTextures} from './materialTexture'
import './materialPreview.css'

/** Paint the actual preview before revealing it; cached previews paint before the first frame. */
export default function MaterialPreview({id,scale,className,children}:{id?:string;scale:number;className:string;children?:ReactNode}){
  const material=resolveBackground(id)
  const canvas=useRef<HTMLCanvasElement>(null)
  const [painted,setPainted]=useState('')
  const [failed,setFailed]=useState(false)
  const key=`${material.id}:${scale}`
  useLayoutEffect(()=>{
    let active=true;setFailed(false)
    const element=canvas.current!,host=element.parentElement!
    const texture=loadMaterialTexture(material.id)
    const draw=(tile:HTMLCanvasElement)=>{
      if(!active)return
      const width=host.clientWidth,height=host.clientHeight
      if(!width||!height)return
      const dpr=Math.min(window.devicePixelRatio||1,2)
      const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr)
      // The observer's initial notification must not clear an already painted canvas.
      if(element.width===pixelWidth&&element.height===pixelHeight&&element.dataset.texture===key)return
      element.width=pixelWidth;element.height=pixelHeight
      const context=element.getContext('2d',{alpha:false})
      if(!context){setFailed(true);return}
      context.scale(dpr,dpr)
      const tw=material.tileSize*scale,th=('tileHeight' in material?material.tileHeight:material.tileSize)*scale
      for(let y=0;y<height;y+=th)for(let x=0;x<width;x+=tw)context.drawImage(tile,x,y,tw,th)
      element.dataset.texture=key
      setPainted(key)
    }
    if(texture.tile)draw(texture.tile)
    else void texture.promise.then(tile=>{if(active){if(tile)draw(tile);else setFailed(true)}})
    const observer=new ResizeObserver(()=>{if(texture.tile)draw(texture.tile)})
    observer.observe(host)
    return ()=>{active=false;observer.disconnect()}
  },[material,key,scale])
  const ready=painted===key
  return <span className={`material-preview ${className}`} style={{backgroundColor:material.color}} aria-busy={!ready&&!failed}>
    <span className="material-preview-layer" data-ready={ready} style={{color:material.ink}}>
      <canvas ref={canvas} className="material-preview-texture" aria-hidden="true"/>
      <span className="material-preview-light" style={{backgroundImage:material.light}} aria-hidden="true"/>
      <span className="material-preview-content">{children}</span>
    </span>
    {failed&&<span className="material-preview-error">{tr("MaterialPreview.001")}</span>}
  </span>
}
