import {useLayoutEffect,useRef,useState} from 'react'

const PREPARE_EVENT='prepare-artwork'
interface Preparation {token:object;active:boolean}
interface ViewportObserver {observer:IntersectionObserver;targets:Map<Element,Set<()=>void>>}
const observers=new WeakMap<Element,ViewportObserver>()

/** Share one observer per viewport and keep artwork mounted once the user sees it. */
function observeOnce(target:Element,viewport:Element,onVisible:()=>void){
  let entry=observers.get(viewport)
  if(!entry){
    const targets=new Map<Element,Set<()=>void>>()
    const observer=new IntersectionObserver(entries=>{
      for(const result of entries){
        if(!result.isIntersecting)continue
        const callbacks=targets.get(result.target)
        targets.delete(result.target);observer.unobserve(result.target)
        callbacks?.forEach(callback=>callback())
      }
      if(!targets.size){observer.disconnect();observers.delete(viewport)}
    },{root:viewport,rootMargin:'300px'})
    entry={observer,targets};observers.set(viewport,entry)
  }
  let callbacks=entry.targets.get(target)
  if(!callbacks){callbacks=new Set();entry.targets.set(target,callbacks);entry.observer.observe(target)}
  callbacks.add(onVisible)
  const current=entry
  return()=>{
    const callbacks=current.targets.get(target)
    callbacks?.delete(onVisible)
    if(!callbacks?.size){current.targets.delete(target);current.observer.unobserve(target)}
    if(!current.targets.size){current.observer.disconnect();if(observers.get(viewport)===current)observers.delete(viewport)}
  }
}

export function useDeferredArtwork(){
  const marker=useRef<HTMLSpanElement>(null)
  const [visible,setVisible]=useState(false),[forced,setForced]=useState(false)
  useLayoutEffect(()=>{
    const element=marker.current
    if(!element)return
    const tokens=new Set<object>()
    const prepare=(event:Event)=>{
      const {token,active}=(event as CustomEvent<Preparation>).detail
      if(active)tokens.add(token);else tokens.delete(token)
      setForced(tokens.size>0)
    }
    element.addEventListener(PREPARE_EVENT,prepare)
    const target=element.closest('[data-board-item]'),viewport=target?.closest('.board-viewport')
    const stop=target&&viewport&&typeof IntersectionObserver!=='undefined'
      ?observeOnce(target,viewport,()=>setVisible(true))
      :undefined
    // Artwork outside the canvas (editors, collection previews) is always immediate.
    if(!stop)setVisible(true)
    return()=>{stop?.();element.removeEventListener(PREPARE_EVENT,prepare)}
  },[])
  return {marker,active:visible||forced}
}

/** Export temporarily mounts unseen artwork without changing the viewing latch. */
export function forceBoardArtwork(scene:Element){
  const token={},markers=Array.from(scene.querySelectorAll('[data-artwork-state]'))
  const dispatch=(active:boolean)=>markers.forEach(marker=>marker.dispatchEvent(new CustomEvent<Preparation>(PREPARE_EVENT,{detail:{token,active}})))
  dispatch(true)
  return()=>dispatch(false)
}
