import {isBoard,seed,STORAGE_KEY} from '../domain/model'
import type {Board} from '../domain/model'

export function loadBoard(): Board {
  try { const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (isBoard(data)) return data } catch { /* A damaged save must not prevent opening the board. */ }
  return structuredClone(seed)
}
