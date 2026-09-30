import {Menu} from '@base-ui/react/menu'
import {Check,ChevronDown,ChevronLeft,ChevronRight,ChevronUp} from 'lucide-react'
import {useLayoutEffect,useRef,useState} from 'react'
import type {RefObject} from 'react'
import {useTranslation} from 'react-i18next'
import {t as tr} from '../i18n/runtime'
import {HintButton,HintGroup} from '../shared/ui/Hint'
import './yearCapsule.css'

interface Props {expanded:boolean;onCollapse:()=>void;launcherRef:RefObject<HTMLButtonElement|null>;lighting:boolean;year:number;years:readonly number[];onYearChange:(year:number)=>void;disabled?:boolean}

export default function YearCapsule({expanded,onCollapse,launcherRef,lighting,year,years,onYearChange,disabled=false}:Props){
  useTranslation()
  const [open,setOpen]=useState(false),[present,setPresent]=useState(expanded)
  const trigger=useRef<HTMLButtonElement>(null),previousExpanded=useRef(expanded)
  const expandedRef=useRef(expanded)
  expandedRef.current=expanded

  useLayoutEffect(()=>{
    if(expanded){setPresent(true);return}
    setOpen(false)
    if(!present)return
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(media.matches){setPresent(false);return}
    const onReduce=()=>{if(media.matches)setPresent(false)}
    // Finish even if CSS animations are disabled or their end event is interrupted.
    const timeout=window.setTimeout(()=>setPresent(false),350)
    media.addEventListener('change',onReduce)
    return()=>{window.clearTimeout(timeout);media.removeEventListener('change',onReduce)}
  },[expanded,present])

  useLayoutEffect(()=>{
    if(previousExpanded.current===expanded)return
    previousExpanded.current=expanded
    if(!expanded)setOpen(false)
    ;(expanded?trigger.current:launcherRef.current)?.focus({preventScroll:true})
  },[expanded,launcherRef])

  const collapse=()=>{setOpen(false);onCollapse()}
  const choose=(next:number)=>{setOpen(false);if(!disabled&&next!==year)onYearChange(next)}
  const index=years.indexOf(year)

  return <Menu.Root modal={false} open={expanded&&open} onOpenChange={setOpen}>
    {(expanded||present)&&<div className="year-capsule-stage" data-lighting={lighting||undefined} data-exiting={!expanded||undefined} inert={!expanded} aria-hidden={!expanded||undefined}>
      <HintGroup><nav id="board-year-selector" className="year-capsule" data-ui-overlay aria-label={tr('yearCapsule.label')} onAnimationEnd={event=>{if(event.target===event.currentTarget&&event.animationName==='year-capsule-dismiss'&&!expandedRef.current)setPresent(false)}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'&&!open){event.preventDefault();collapse()}}}>
        <div className="year-capsule-content">
          <HintButton className="year-capsule-arrow" aria-label={tr('yearCapsule.previous')} disabled={disabled||index===years.length-1} onClick={()=>choose(years[index+1])}><ChevronLeft size={17}/></HintButton>
          <Menu.Trigger ref={trigger} className="year-capsule-trigger" aria-label={tr('yearCapsule.choose')} disabled={disabled}><span>{year}</span><ChevronDown size={12}/></Menu.Trigger>
          <HintButton className="year-capsule-arrow" aria-label={tr('yearCapsule.next')} disabled={disabled||index<=0} onClick={()=>choose(years[index-1])}><ChevronRight size={17}/></HintButton>
          <span className="year-capsule-divider" aria-hidden="true"/>
          <HintButton className="year-capsule-collapse" aria-label={tr('yearCapsule.collapse')} onClick={collapse}><ChevronUp size={16}/></HintButton>
        </div>
      </nav></HintGroup>
    </div>}
    <Menu.Portal><Menu.Positioner sideOffset={8} align="center" collisionPadding={8} className="year-capsule-positioner"><Menu.Popup className="year-capsule-menu" aria-label={tr('yearCapsule.choose')} data-ui-overlay finalFocus={()=>(expandedRef.current?trigger.current:launcherRef.current)??false}>
      <Menu.RadioGroup value={String(year)} onValueChange={value=>choose(Number(value))}>
        {years.map(value=><Menu.RadioItem key={value} value={String(value)} disabled={disabled} closeOnClick className="year-capsule-option"><span>{value}</span><Menu.RadioItemIndicator><Check size={15}/></Menu.RadioItemIndicator></Menu.RadioItem>)}
      </Menu.RadioGroup>
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.Root>
}
