import {t,locale} from '../i18n/runtime.ts'
import type {MessageKey} from '../i18n/runtime'
import seedLabels from '../i18n/locales/zh-CN.json' with {type:'json'}
import {isBoard,seed,STORAGE_KEY} from '../domain/model.ts'
import type {Board} from '../domain/model'
import {readSaved} from './saveRecovery.ts'
import type {SaveReadIssue,SaveStorage} from './saveRecovery'

export function readBoard(storage?:SaveStorage):{board:Board;issues:SaveReadIssue[]}{
  const saved=readSaved(STORAGE_KEY,isBoard,storage)
  if(saved.status==='loaded')return {board:saved.value,issues:[]}
  const issues:SaveReadIssue[]=saved.status==='missing'?[]:[{key:STORAGE_KEY,...saved}]
  const fresh=structuredClone(seed)
  if(locale()!=='zh-CN'){fresh.title=t('seed.title');fresh.items=fresh.items.map(item=>{const key=`seed.${item.id}` as MessageKey;return {...item,title:key in seedLabels?t(key):item.title}})}
  return {board:fresh,issues}
}
export function loadBoard():Board{return readBoard().board}
