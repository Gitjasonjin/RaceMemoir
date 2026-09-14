export type Kind = 'photo' | 'medal' | 'bib' | 'note' | 'map'
export const PIN_STYLES = ['classic', 'brass', 'pearl', 'forest'] as const
export const TAPE_STYLES = ['classic', 'kraft', 'sage', 'dots'] as const
export const THREAD_STYLES = ['classic', 'fine', 'cord', 'dashed'] as const
export type PinStyle = typeof PIN_STYLES[number]
export type TapeStyle = typeof TAPE_STYLES[number]
export type ThreadStyle = typeof THREAD_STYLES[number]
export interface Decorations { pin: PinStyle; tape: TapeStyle; thread: ThreadStyle }
export type DecorationChange = { kind: 'pin'; style: PinStyle | undefined } | { kind: 'tape'; style: TapeStyle | undefined } | { kind: 'thread'; style: ThreadStyle | undefined }
export interface Memory { id: string; kind: Kind; x: number; y: number; w: number; h: number; rotation: number; title: string; subtitle?: string; image?: string; variant?: string; number?: string; pinStyle?: PinStyle; tapeStyle?: TapeStyle; pinEnabled?: boolean; recordId?: string; medalScale?: number; photoZoom?: number; photoX?: number; photoY?: number }
export interface Thread { id: string; from: string; to: string; style?: ThreadStyle }
export interface Board { title: string; items: Memory[]; threads: Thread[]; decorations?: Partial<Decorations> }
export const DEFAULT_DECORATIONS: Decorations = { pin: 'classic', tape: 'classic', thread: 'classic' }
export function getDecorations(board: Board): Decorations {
  return { pin: board.decorations?.pin ?? DEFAULT_DECORATIONS.pin, tape: board.decorations?.tape ?? DEFAULT_DECORATIONS.tape, thread: board.decorations?.thread ?? DEFAULT_DECORATIONS.thread }
}
export function hasTape(item: Memory): boolean { return item.kind === 'bib' }
export function hasPin(item: Memory): boolean {
  if (item.kind === 'medal') return false
  if (hasTape(item)) return item.pinEnabled === true
  return item.kind !== 'note' || item.variant === 'paper'
}
export function setTapePin(board: Board, id: string, enabled: boolean): Board {
  return { ...board, items: board.items.map(item => item.id === id && hasTape(item) ? { ...item, pinEnabled: enabled } : item) }
}
/** Without a target, replace this decoration across the board and set its future default. */
export function changeDecoration(board: Board, change: DecorationChange, targetId?: string): Board {
  const next = { ...board }
  if (!targetId) next.decorations = { ...getDecorations(board), [change.kind]: change.style ?? DEFAULT_DECORATIONS[change.kind] }
  if (change.kind === 'thread') {
    next.threads = board.threads.map(thread => !targetId || thread.id === targetId ? { ...thread, style: targetId ? change.style : undefined } : thread)
  } else {
    next.items = board.items.map(item => {
      if (targetId && item.id !== targetId) return item
      if (change.kind === 'pin' && (hasPin(item) || hasTape(item))) return { ...item, pinStyle: targetId ? change.style : undefined }
      if (change.kind === 'tape' && hasTape(item)) return { ...item, tapeStyle: targetId ? change.style : undefined }
      return item
    })
  }
  return next
}
export const WIDTH = 1440
export const HEIGHT = 900
export const STORAGE_KEY = 'racememoir-board-v1'
export const seed: Board = {
  title: '我的越野记忆',
  items: [
    { id: 'ridge-medal', kind: 'medal', x: 217, y: 42, w: 226, h: 357, rotation: 2, title: 'RIDGE 50K', variant: 'bronze' },
    { id: 'ridge-bib', kind: 'bib', x: 470, y: 92, w: 354, h: 266, rotation: 5, title: 'RIDGE 50K', number: '0826', variant: 'green' },
    { id: 'cloud-photo', kind: 'photo', x: 113, y: 383, w: 349, h: 255, rotation: 7, title: '在更高处，\n遇见更好的自己', image: '/images/mountain.jpg', variant: 'landscape' },
    { id: 'hike-photo', kind: 'photo', x: 459, y: 448, w: 199, h: 275, rotation: -6, title: '终点，不止于此', subtitle: '2024.10.26', image: '/images/hiking.jpg' },
    { id: 'ridge-map', kind: 'map', x: 652, y: 459, w: 245, h: 365, rotation: -5, title: '山会记得\n你走过的每一段路', subtitle: '2024.10.26', variant: 'blue' },
    { id: 'cloud-note', kind: 'note', x: 227, y: 624, w: 134, h: 122, rotation: -3, title: '第一次\n跑进云海', variant: 'yellow' },
    { id: 'pine-medal', kind: 'medal', x: 967, y: 50, w: 167, h: 274, rotation: -3, title: 'PINE TRAIL', variant: 'silver' },
    { id: 'pine-bib', kind: 'bib', x: 1137, y: 89, w: 253, h: 180, rotation: -8, title: 'PINE TRAIL 30K', number: '1058', variant: 'blue' },
    { id: 'sunrise-photo', kind: 'photo', x: 1030, y: 306, w: 349, h: 242, rotation: -4, title: '每一个清晨\n都是新的出发', image: '/images/sunrise.jpg', variant: 'landscape' },
    { id: 'sunrise-note', kind: 'note', x: 1320, y: 403, w: 112, h: 111, rotation: -9, title: '下一座山', variant: 'yellow' },
    { id: 'finish-photo', kind: 'photo', x: 960, y: 619, w: 191, h: 246, rotation: -5, title: '向山而行', subtitle: '2023.04.15', image: '/images/hiking.jpg' },
    { id: 'pine-map', kind: 'map', x: 1176, y: 697, w: 198, h: 158, rotation: -4, title: '32 km / +1,950 m', variant: 'green' },
    { id: 'race-note', kind: 'note', x: 1167, y: 598, w: 149, h: 113, rotation: -4, title: '2023.04.15\n雨中完赛\n32 km / +1,950 m', variant: 'paper' },
  ],
  threads: [ ['ridge-medal', 'ridge-bib'], ['ridge-medal', 'cloud-photo'], ['ridge-medal', 'hike-photo'], ['hike-photo', 'ridge-map'], ['pine-medal', 'pine-bib'], ['pine-medal', 'sunrise-photo'], ['finish-photo', 'race-note'], ['finish-photo', 'pine-map'] ].map(([from, to], i) => ({ id: `thread-${i}`, from, to })),
}
export function isBoard(value: unknown): value is Board {
  if (!value || typeof value !== 'object') return false
  const b = value as Board
  if (typeof b.title !== 'string' || !Array.isArray(b.items) || !Array.isArray(b.threads) || b.items.length > 500 || b.threads.length > 2000) return false
  const validStyle = (value: unknown, options: readonly string[]) => value === undefined || (typeof value === 'string' && options.includes(value))
  if (b.decorations !== undefined) {
    if (!b.decorations || typeof b.decorations !== 'object' || Array.isArray(b.decorations)) return false
    if (!validStyle(b.decorations.pin, PIN_STYLES) || !validStyle(b.decorations.tape, TAPE_STYLES) || !validStyle(b.decorations.thread, THREAD_STYLES)) return false
  }
  const ids = new Set<string>()
  for (const item of b.items) {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || !['photo', 'medal', 'bib', 'note', 'map'].includes(item.kind) || typeof item.title !== 'string') return false
    if (![item.x, item.y, item.w, item.h, item.rotation].every(Number.isFinite) || item.w < 30 || item.h < 30 || item.w > WIDTH || item.h > HEIGHT) return false
    if (['subtitle', 'image', 'variant', 'number'].some(key => item[key as keyof Memory] !== undefined && typeof item[key as keyof Memory] !== 'string')) return false
    if (item.image && !['/images/mountain.jpg', '/images/hiking.jpg', '/images/sunrise.jpg'].includes(item.image)) return false
    if (!validStyle(item.pinStyle, PIN_STYLES) || !validStyle(item.tapeStyle, TAPE_STYLES)) return false
    if (item.pinEnabled !== undefined && typeof item.pinEnabled !== 'boolean') return false
    if (item.recordId !== undefined && (typeof item.recordId !== 'string' || !item.recordId || !['medal','map','photo'].includes(item.kind))) return false
    if (item.medalScale !== undefined && (!Number.isFinite(item.medalScale) || item.medalScale < .4 || item.medalScale > 1.8)) return false
    if(item.photoZoom!==undefined&&(!Number.isFinite(item.photoZoom)||item.photoZoom<1||item.photoZoom>3))return false
    if([item.photoX,item.photoY].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0||v>100)))return false
    ids.add(item.id)
  }
  const threadIds = new Set<string>()
  return b.threads.every(t => {
    if (!t || typeof t.id !== 'string' || threadIds.has(t.id) || !ids.has(t.from) || !ids.has(t.to) || t.from === t.to) return false
    if (!validStyle(t.style, THREAD_STYLES)) return false
    threadIds.add(t.id)
    return true
  })
}
export function loadBoard(): Board {
  try { const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (isBoard(data)) return data } catch { /* A damaged save must not prevent opening the board. */ }
  return structuredClone(seed)
}
export function pinPosition(item: Memory) {
  const px = hasTape(item) ? (hasPin(item) ? item.w * .65 : item.w - 25) : item.w * (item.kind === 'medal' ? .5 : .35)
  const py = item.kind === 'medal' ? 7 : 13
  const angle = item.rotation * Math.PI / 180
  const dx = px - item.w / 2, dy = py - item.h / 2
  return { x: item.x + item.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle), y: item.y + item.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) }
}
export function createMemory(kind: Kind, title: string, variant: string, image: string, number: string): Memory {
  const size = { photo: [255, 298], medal: [205, 325], bib: [315, 231], note: [160, 150], map: [245, 365] }[kind]
  return { id: crypto.randomUUID(), kind, title, variant, image: kind === 'photo' ? image : undefined, number, x: 580, y: 320, w: size[0], h: size[1], rotation: -4 + Math.random() * 8, subtitle: '2024.10.26' }
}
