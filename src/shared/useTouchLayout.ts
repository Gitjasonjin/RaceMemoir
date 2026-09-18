import {useEffect,useState} from 'react'

export function useTouchLayout(){
  const [touch,setTouch]=useState(()=>window.matchMedia('(pointer: coarse)').matches)
  useEffect(()=>{
    const media=window.matchMedia('(pointer: coarse)'),change=()=>setTouch(media.matches)
    media.addEventListener('change',change)
    const viewport=window.visualViewport
    const resize=()=>{document.documentElement.style.setProperty('--visual-height',`${viewport?.height??window.innerHeight}px`);document.documentElement.style.setProperty('--visual-top',`${viewport?.offsetTop??0}px`)}
    resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize)
    return()=>{media.removeEventListener('change',change);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize)}
  },[])
  return touch
}
