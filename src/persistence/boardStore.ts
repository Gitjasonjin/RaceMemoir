import {t,locale} from '../i18n/runtime.ts'
import type {MessageKey} from '../i18n/runtime'
import seedLabels from '../i18n/locales/zh-CN.json' with {type:'json'}
import {isBoard,seed,STORAGE_KEY} from '../domain/model'
import type {Board} from '../domain/model'

export function loadBoard(): Board {
  try { const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (isBoard(data)) return data } catch { /* A damaged save must not prevent opening the board. */ }
  const fresh=structuredClone(seed)
  if(locale()!=='zh-CN'){fresh.title=t('seed.title');fresh.items=fresh.items.map(item=>{const key=`seed.${item.id}` as MessageKey;return {...item,title:key in seedLabels?t(key):item.title}})}
  return fresh
}
