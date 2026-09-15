/** Stable ids are persisted in Memory.variant; never rename an existing id. */
export const PHOTO_STYLES = [
  {id:'polaroid',label:'经典拍立得',w:255,h:298,className:'polaroid',caption:'footer'},
  {id:'landscape',label:'横向相纸',w:349,h:255,className:'landscape',caption:'overlay'},
  {id:'portrait',label:'竖向相纸',w:255,h:360,className:'polaroid',caption:'footer'},
  {id:'square',label:'方形相纸',w:298,h:346,className:'polaroid',caption:'footer'},
] as const
export const NOTE_STYLES = [
  {id:'yellow',label:'暖黄便签',w:160,h:150,className:'yellow-note',pin:false,smiley:true},
  {id:'paper',label:'手写纸条',w:160,h:150,className:'white-note paper',pin:true,smiley:false},
] as const
export const BIB_STYLES = [
  {id:'green',label:'森林绿',w:315,h:231,className:'',tagline:'MOUNTAINS MAKE A KINDER YOU'},
  {id:'blue',label:'远山蓝',w:315,h:231,className:'blue',tagline:'SMALL STEPS, BIG MOUNTAINS'},
] as const
export const MEDAL_STYLES = [
  {id:'bronze',label:'古铜金',w:205,h:325,silver:false},
  {id:'silver',label:'山岩银',w:205,h:325,silver:true},
] as const
export const ROUTE_STYLES = [
  {id:'blue',label:'完整路线卡',w:245,h:365,compact:false},
  {id:'green',label:'简洁路线卡',w:245,h:365,compact:true},
] as const
export const RACE_MAP_STYLES = [{id:'travel',label:'旅行折叠图',w:700,h:520},{id:'survey',label:'测绘蓝图',w:700,h:520},{id:'vintage',label:'复古地图',w:700,h:520}] as const
export const ITEM_STYLES = {photo:PHOTO_STYLES,note:NOTE_STYLES,bib:BIB_STYLES,medal:MEDAL_STYLES,map:ROUTE_STYLES,'race-map':RACE_MAP_STYLES}
export type StyledKind = keyof typeof ITEM_STYLES
export type ItemStyleId<K extends StyledKind> = (typeof ITEM_STYLES)[K][number]['id']

/** Unknown/legacy ids render using the default without rewriting saved data. */
export function resolveStyle<K extends StyledKind>(kind:K,id?:string):(typeof ITEM_STYLES)[K][number] {
  const options=ITEM_STYLES[kind]
  return (options.find(style=>style.id===id)??options[0]) as (typeof ITEM_STYLES)[K][number]
}

export const PIN_OPTIONS = [{id:'classic',label:'经典红钉'},{id:'brass',label:'复古黄铜'},{id:'pearl',label:'珍珠白钉'},{id:'forest',label:'森林绿钉'},{id:'spool',label:'工字钉'},{id:'clip',label:'木夹子'}] as const
export const TAPE_OPTIONS = [{id:'classic',label:'原稿搭配'},{id:'kraft',label:'牛皮纸胶'},{id:'sage',label:'鼠尾草绿'},{id:'dots',label:'蓝色波点'}] as const
export const THREAD_OPTIONS = [{id:'classic',label:'经典红线'},{id:'fine',label:'轻盈细线'},{id:'cord',label:'编织红绳'},{id:'dashed',label:'手缝虚线'},{id:'hemp',label:'自然麻绳'}] as const
export const PIN_STYLES=PIN_OPTIONS.map(s=>s.id)
export const TAPE_STYLES=TAPE_OPTIONS.map(s=>s.id)
export const THREAD_STYLES=THREAD_OPTIONS.map(s=>s.id)

export const BACKGROUND_STYLES = [
  {id:'cork',label:'软木板',color:'#b98d60',texture:'/cork.svg',tileSize:220,light:'radial-gradient(ellipse at 42% 33%,#f9d4a33d,transparent 80%)',ink:'#493c2c'},
  {id:'dark-wood',label:'深色木板',color:'#352923',texture:'/dark-wood.svg',tileSize:480,light:'radial-gradient(ellipse at 42% 33%,#b98a5426,transparent 80%)',ink:'#e6d7bf'},
  {id:'kraft',label:'牛皮纸',color:'#c5a477',texture:'/kraft.svg',tileSize:320,light:'radial-gradient(ellipse at 42% 33%,#fff2cd29,transparent 80%)',ink:'#493c2c'},
  {id:'chalkboard',label:'黑板',color:'#28332f',texture:'/chalkboard.svg',tileSize:400,light:'radial-gradient(ellipse at 42% 33%,#c5d3c514,transparent 80%)',ink:'#e3e8db'},
] as const
export const PHOTO_PAPERS = [
  {id:'polaroid',label:'Polaroid',caption:'footer'},
  {id:'print',label:'冲印照片',caption:'overlay'},
  {id:'torn',label:'撕边相纸',caption:'footer'},
] as const
export const MEDAL_FRAMES = [
  {id:'wood',label:'原木框'}, {id:'black',label:'黑框'}, {id:'hook',label:'挂钩'},
] as const
export function resolvePhotoPaper(id?:string,variant?:string){return PHOTO_PAPERS.find(s=>s.id===id)??PHOTO_PAPERS[variant==='landscape'?1:0]}
export function resolveMedalFrame(id?:string){return MEDAL_FRAMES.find(s=>s.id===id)??MEDAL_FRAMES[0]}
export type BackgroundStyleId=typeof BACKGROUND_STYLES[number]['id']
export function resolveBackground(id?:string){return BACKGROUND_STYLES.find(s=>s.id===id)??BACKGROUND_STYLES[0]}

/** Both live canvas and PNG export use the same world-aligned texture. */
export function backgroundStyle(id:string|undefined,scale:number,x=0,y=0){
  const style=resolveBackground(id)
  return {backgroundColor:style.color,backgroundImage:`${style.light},url("${style.texture}")`,backgroundSize:`100% 100%, ${style.tileSize*scale}px ${style.tileSize*scale}px`,backgroundPosition:`0 0, ${x}px ${y}px`}
}
