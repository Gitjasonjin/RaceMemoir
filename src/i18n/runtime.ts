import {createInstance} from 'i18next'
import zh from './locales/zh-CN.json' with {type:'json'}
import en from './locales/en.json' with {type:'json'}
import ja from './locales/ja.json' with {type:'json'}

export type Locale='zh-CN'|'en'|'ja'
export type MessageKey=keyof typeof zh
export type MessageValues=Record<string,unknown>
export interface Message {key:MessageKey;values?:MessageValues}
export type Notice=string|Message
export const LANGUAGE_KEY='racememoir-language'
export const i18n=createInstance()
// Synchronous, bundled resources keep both the first frame and offline switching predictable.
void i18n.init({lng:'zh-CN',fallbackLng:'zh-CN',supportedLngs:['zh-CN','en','ja'],initAsync:false,keySeparator:false,interpolation:{escapeValue:false},resources:{'zh-CN':{translation:zh},en:{translation:en},ja:{translation:ja}}})
export function t(key:MessageKey,values:MessageValues={}):string{
  const resolved=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v&&typeof v==='object'&&'key' in v?messageText(v as Message):v===null||v===undefined||v===false?'':v]))
  return String(i18n.t(key,resolved))
}
export function msg(key:MessageKey,values?:MessageValues):Message{return {key,values}}
export function messageText(value:Notice):string{return typeof value==='string'?value:t(value.key,value.values)}
export class AppError extends Error{
  readonly detail:Message
  constructor(key:MessageKey,values?:MessageValues){super(t(key,values));this.name='AppError';this.detail=msg(key,values)}
}
export function errorNotice(error:unknown,fallback:Notice):Notice{return error instanceof AppError?error.detail:error instanceof Error?error.message:fallback}
export function resolveLocale(saved:string|null,languages:readonly string[]):Locale{
  if(saved==='zh-CN'||saved==='en'||saved==='ja')return saved
  for(const language of languages){const base=language.toLowerCase().split('-')[0];if(base==='zh')return 'zh-CN';if(base==='en'||base==='ja')return base}
  return 'zh-CN'
}
export function locale():Locale{return i18n.language==='en'||i18n.language==='ja'?i18n.language:'zh-CN'}
export function initializeLanguage(){
  let saved:string|null=null;try{saved=localStorage.getItem(LANGUAGE_KEY)}catch{/* Storage can be unavailable in private mode. */}
  void i18n.changeLanguage(resolveLocale(saved,navigator.languages))
  document.documentElement.lang=locale()
}
export function changeLanguage(value:Locale){
  try{localStorage.setItem(LANGUAGE_KEY,value)}catch{/* Keep the choice for this session. */}
  void i18n.changeLanguage(value)
  document.documentElement.lang=value
}
export function formatNumber(value:number,options:Intl.NumberFormatOptions={}){return new Intl.NumberFormat(locale(),options).format(value)}
export function formatTime(value:number){return value?new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(value):''}
export function formatDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value
  return new Intl.DateTimeFormat(locale(),{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(`${value}T12:00:00`))
}
export function provinceName(id:string,fallback:string){const key=`province.${id}`;return locale()!=='zh-CN'&&key in zh?t(key as MessageKey):fallback}
