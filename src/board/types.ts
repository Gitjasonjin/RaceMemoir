import type {Board} from '../domain/model'
export type View = { x: number; y: number; scale: number }
export type Gesture = { type: 'item' | 'pan' | 'marquee'; mapGroupKey?:string; id?: string; ids?: string[]; pointerId: number; startX: number; startY: number; x: number; y: number; cameraX: number; cameraY: number; before: Board; moved: boolean }
