import {t as tr} from '../i18n/runtime.ts'
/** Stable ids are persisted in Memory.variant; never rename an existing id. */
export const PHOTO_STYLES = [
  {id:'polaroid',get label(){return tr("styleCatalog.040")},w:255,h:298,className:'polaroid',caption:'footer'},
  {id:'landscape',get label(){return tr("styleCatalog.039")},w:349,h:255,className:'landscape',caption:'overlay'},
  {id:'portrait',get label(){return tr("styleCatalog.038")},w:255,h:360,className:'polaroid',caption:'footer'},
  {id:'square',get label(){return tr("styleCatalog.037")},w:298,h:346,className:'polaroid',caption:'footer'},
] as const
export const NOTE_STYLES = [
  {id:'yellow',get label(){return tr("styleCatalog.036")},w:160,h:150,className:'yellow-note',pin:false,smiley:true},
  {id:'paper',get label(){return tr("styleCatalog.035")},w:160,h:150,className:'white-note paper',pin:true,smiley:false},
] as const
export const BIB_STYLES = [
  {id:'green',get label(){return tr("styleCatalog.034")},w:315,h:231,className:'',tagline:'MOUNTAINS MAKE A KINDER YOU'},
  {id:'blue',get label(){return tr("styleCatalog.033")},w:315,h:231,className:'blue',tagline:'SMALL STEPS, BIG MOUNTAINS'},
] as const
export const MEDAL_STYLES = [
  {id:'bronze',get label(){return tr("styleCatalog.032")},w:205,h:325,silver:false},
  {id:'silver',get label(){return tr("styleCatalog.031")},w:205,h:325,silver:true},
] as const
export const ROUTE_STYLES = [
  {id:'blue',get label(){return tr("styleCatalog.030")},w:245,h:365,compact:false},
  {id:'green',get label(){return tr("styleCatalog.029")},w:245,h:365,compact:true},
] as const
export const RACE_MAP_STYLES = [{id:'travel',get label(){return tr("styleCatalog.028")},w:700,h:520},{id:'survey',get label(){return tr("styleCatalog.027")},w:700,h:520},{id:'vintage',get label(){return tr("styleCatalog.026")},w:700,h:520}] as const
export const ITEM_STYLES = {sticker:[{id:"contour",get label(){return tr("styleCatalog.025")},w:240,h:240}] as const,photo:PHOTO_STYLES,note:NOTE_STYLES,bib:BIB_STYLES,medal:MEDAL_STYLES,map:ROUTE_STYLES,'race-map':RACE_MAP_STYLES}
export type StyledKind = keyof typeof ITEM_STYLES
export type ItemStyleId<K extends StyledKind> = (typeof ITEM_STYLES)[K][number]['id']

/** Unknown/legacy ids render using the default without rewriting saved data. */
export function resolveStyle<K extends StyledKind>(kind:K,id?:string):(typeof ITEM_STYLES)[K][number] {
  const options=ITEM_STYLES[kind]
  return (options.find(style=>style.id===id)??options[0]) as (typeof ITEM_STYLES)[K][number]
}

export const PIN_OPTIONS = [{id:'classic',get label(){return tr("styleCatalog.024")}},{id:'brass',get label(){return tr("styleCatalog.023")}},{id:'pearl',get label(){return tr("styleCatalog.022")}},{id:'forest',get label(){return tr("styleCatalog.021")}},{id:'spool',get label(){return tr("styleCatalog.020")}},{id:'clip',get label(){return tr("App.052")}}] as const
export const TAPE_OPTIONS = [{id:'classic',get label(){return tr("styleCatalog.019")}},{id:'kraft',get label(){return tr("styleCatalog.018")}},{id:'sage',get label(){return tr("styleCatalog.017")}},{id:'dots',get label(){return tr("styleCatalog.016")}}] as const
export const THREAD_OPTIONS = [{id:'classic',get label(){return tr("styleCatalog.015")}},{id:'fine',get label(){return tr("styleCatalog.014")}},{id:'cord',get label(){return tr("styleCatalog.013")}},{id:'dashed',get label(){return tr("styleCatalog.012")}},{id:'hemp',get label(){return tr("styleCatalog.011")}}] as const
export const PIN_STYLES=PIN_OPTIONS.map(s=>s.id)
export const TAPE_STYLES=TAPE_OPTIONS.map(s=>s.id)
export const THREAD_STYLES=THREAD_OPTIONS.map(s=>s.id)

export const BACKGROUND_STYLES = [
  {id:'cork',get label(){return tr("styleCatalog.010")},color:'#bc9267',texture:'/textures/cork-photo.webp',tileSize:384,tileHeight:256,light:'radial-gradient(ellipse at 35% 20%,#fff4df38,#fff4df26 75%)',ink:'#493c2c'},
  {id:'dark-wood',get label(){return tr("styleCatalog.009")},color:'#392b22',texture:'/textures/dark-wood-photo.webp',tileSize:768,light:'radial-gradient(ellipse at 35% 20%,#e9c59a12,transparent 75%)',ink:'#e6d7bf'},
  {id:'kraft',get label(){return tr("styleCatalog.008")},color:'#c5a477',texture:'/textures/kraft-photo.webp',tileSize:576,light:'radial-gradient(ellipse at 35% 20%,#fff4d51a,transparent 75%)',ink:'#493c2c'},
  {id:'chalkboard',get label(){return tr("styleCatalog.007")},color:'#293531',texture:'/textures/chalkboard-photo.webp',tileSize:640,light:'radial-gradient(ellipse at 35% 20%,#d5e1dd0c,transparent 75%)',ink:'#e3e8db'},
] as const
export const PHOTO_PAPERS = [
  {id:'polaroid',label:'Polaroid',caption:'footer'},
  {id:'print',get label(){return tr("styleCatalog.006")},caption:'overlay'},
  {id:'torn',get label(){return tr("styleCatalog.005")},caption:'footer'},
  {id:'borderless',get label(){return tr("styleCatalog.004")},caption:'none'},
] as const
export const MEDAL_FRAMES = [
  {id:'wood',get label(){return tr("styleCatalog.003")}}, {id:'black',get label(){return tr("styleCatalog.002")}}, {id:'hook',get label(){return tr("styleCatalog.001")}},
] as const
export function resolvePhotoPaper(id?:string,variant?:string){return PHOTO_PAPERS.find(s=>s.id===id)??PHOTO_PAPERS[variant==='landscape'?1:0]}
export function resolveMedalFrame(id?:string){return MEDAL_FRAMES.find(s=>s.id===id)??MEDAL_FRAMES[0]}
export type BackgroundStyleId=typeof BACKGROUND_STYLES[number]['id']
// Old saved boards and imported backups keep their material after SVG retirement.
const LEGACY_BACKGROUNDS:Readonly<Record<string,string>>={'cork-svg':'cork','dark-wood-svg':'dark-wood','kraft-svg':'kraft','chalkboard-svg':'chalkboard'}
export function resolveBackground(id?:string){const current=LEGACY_BACKGROUNDS[id??'']??id;return BACKGROUND_STYLES.find(s=>s.id===current)??BACKGROUND_STYLES[0]}

/** Both live canvas and PNG export use the same world-aligned texture. */
export function backgroundStyle(id:string|undefined,scale:number,x=0,y=0){
  const style=resolveBackground(id)
  // Photographic tiles retain their aspect ratio in the canvas, swatches and exports.
  const height='tileHeight' in style?style.tileHeight:style.tileSize
  return {backgroundColor:style.color,backgroundImage:`${style.light},url("${style.texture}")`,backgroundSize:`100% 100%, ${style.tileSize*scale}px ${height*scale}px`,backgroundPosition:`0 0, ${x}px ${y}px`}
}
