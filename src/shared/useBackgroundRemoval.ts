import { useEffect, useRef, useState } from 'react'

export function useBackgroundRemoval(subject:'medal'|'sticker'='medal') {
  const active = useRef<{ worker: Worker; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [progress, setProgress] = useState('')
  const stop = () => {
    if (active.current) { active.current.worker.terminate(); clearTimeout(active.current.timer); active.current = null }
  }
  useEffect(() => () => stop(), [])
  const cancel = () => { stop(); setProgress('') }
  const run = (blob: Blob, done: (image: Blob) => void, failed: (message: string) => void) => {
    cancel(); setProgress(subject==='medal'?'自动抠取奖牌和绶带，首次使用需要下载模型…':'正在自动抠取主体，首次使用需要下载模型…')
    try {
      const worker = new Worker(new URL('../items/medal/cutout.worker.ts', import.meta.url), { type: 'module' })
      const fail = () => { if(active.current?.worker!==worker)return;stop(); setProgress(''); failed('自动抠图未完成，已保留原图。可重试，或直接使用原图。') }
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
          setProgress(data.key==='compute:ribbon'?'正在自动补全绶带并清理背景…':data.key.startsWith('fetch:') ? `下载抠图模型 ${data.total ? Math.round(data.current / data.total * 100) : 0}%` : '正在本机分离主体与背景…')
        }
      }
      worker.postMessage({blob,subject})
    } catch { stop();setProgress(''); failed('当前浏览器无法启动抠图，已保留原图。') }
  }
  return { progress, run, cancel }
}
