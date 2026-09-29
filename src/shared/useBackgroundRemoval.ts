import {useNotice} from '../i18n/useNotice'
import {msg} from '../i18n/runtime.ts'
import { useEffect, useRef } from 'react'
import type {Notice} from '../i18n/runtime'

export function useBackgroundRemoval(subject:'medal'|'sticker'='medal') {
  const active = useRef<{ worker: Worker; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [progress, setProgress]=useNotice('')
  const stop = () => {
    if (active.current) { active.current.worker.terminate(); clearTimeout(active.current.timer); active.current = null }
  }
  useEffect(() => () => stop(), [])
  const cancel = () => { stop(); setProgress('') }
  const run = (blob: Blob, done: (image: Blob) => void, failed: (message: Notice) => void) => {
    cancel(); setProgress(subject==='medal'?msg("useBackgroundRemoval.008"):msg("useBackgroundRemoval.007"))
    try {
      const worker = new Worker(new URL('../items/medal/cutout.worker.ts', import.meta.url), { type: 'module' })
      const fail = () => { if(active.current?.worker!==worker)return;stop(); setProgress(''); failed(msg("useBackgroundRemoval.006")) }
      const deadline=Date.now()+600_000
      const timer = setTimeout(fail, 180_000)
      active.current = { worker, timer }
      worker.onerror = fail
      worker.onmessage = (event: MessageEvent) => {
        if (active.current?.worker !== worker) return
        const data = event.data
        if (data.type === 'done') { stop(); setProgress(''); done(data.image) }
        else if (data.type === 'error') fail()
        else if (data.type === 'progress') {
          // A first-time model download can take minutes while still making progress.
          clearTimeout(active.current.timer)
          active.current.timer=setTimeout(fail,Math.max(0,Math.min(180_000,deadline-Date.now())))
          setProgress(data.key==='compute:resize'?msg("useBackgroundRemoval.005"):data.key==='compute:ribbon'?msg("useBackgroundRemoval.004"):data.key.startsWith('fetch:') ? msg("useBackgroundRemoval.003",{v1:data.total ? Math.round(data.current / data.total * 100) : 0}) : msg("useBackgroundRemoval.002"))
        }
      }
      worker.postMessage({blob,subject})
    } catch { stop();setProgress(''); failed(msg("useBackgroundRemoval.001")) }
  }
  return { progress, run, cancel }
}
