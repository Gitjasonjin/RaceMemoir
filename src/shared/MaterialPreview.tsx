import {useEffect,useState} from 'react'
import type {ReactNode} from 'react'
import {BACKGROUND_STYLES,backgroundStyle,resolveBackground} from '../domain/styleCatalog'
import './materialPreview.css'

const textures=new Map<string,{image:HTMLImageElement;ready:boolean;promise:Promise<boolean>}>()
function loadTexture(url:string){
  const cached=textures.get(url);if(cached)return cached
  const image=new Image()
  const entry={image,ready:false,promise:Promise.resolve(false)}
  image.src=url
  entry.promise=image.decode().then(()=>{entry.ready=true;return true},()=>{textures.delete(url);return false})
  textures.set(url,entry)
  return entry
}
export function preloadBackgroundTextures(){BACKGROUND_STYLES.forEach(style=>loadTexture(style.texture))}

/** Reveal the texture and its contents together only after the bitmap is decoded. */
export default function MaterialPreview({id,scale,className,children}:{id?:string;scale:number;className:string;children?:ReactNode}){
  const material=resolveBackground(id)
  const [loaded,setLoaded]=useState(()=>textures.get(material.texture)?.ready?material.texture:'')
  const [failed,setFailed]=useState(false)
  useEffect(()=>{
    let active=true;setFailed(false)
    void loadTexture(material.texture).promise.then(ok=>{if(active){setLoaded(ok?material.texture:'');setFailed(!ok)}})
    return ()=>{active=false}
  },[material.texture])
  const ready=loaded===material.texture||textures.get(material.texture)?.ready
  return <span className={`material-preview ${className}`} aria-busy={!ready&&!failed}>
    <span className="material-preview-layer" data-ready={!!ready} style={{...(ready?backgroundStyle(id,scale):{}),color:material.ink}}>{children}</span>
    {failed&&<span className="material-preview-error">材质暂不可用</span>}
  </span>
}
