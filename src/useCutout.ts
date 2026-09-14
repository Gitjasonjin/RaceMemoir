import { useEffect, useRef, useState } from 'react'

export function useCutout() {
  const active = useRef<{ worker: Worker; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [progress, setProgress] = useState('')
  const stop = () => {
    if (active.current) { active.current.worker.terminate(); clearTimeout(active.current.timer); active.current = null }
  }
  useEffect(() => () => stop(), [])
  const cancel = () => { stop(); setProgress('') }
  const run = (blob: Blob, done: (image: Blob) => void, failed: (message: string) => void) => {
    cancel(); setProgress('自动抠取奖牌和绶带，首次使用需要下载模型…')
    try {
      const worker = new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' })
      const fail = () => { stop(); setProgress(''); failed('自动抠图未完成，已保留原图。可重试，或直接使用原图。') }
      const timer = setTimeout(fail, 180_000)
      active.current = { worker, timer }
      worker.onerror = fail
      worker.onmessage = (event: MessageEvent) => {
        if (active.current?.worker !== worker) return
        const data = event.data
        if (data.type === 'done') { stop(); setProgress(''); done(data.image) }
        else if (data.type === 'error') fail()
        else if (data.type === 'progress') setProgress(data.key==='compute:ribbon'?'正在自动补全绶带并清理背景…':data.key.startsWith('fetch:') ? `下载抠图模型 ${data.total ? Math.round(data.current / data.total * 100) : 0}%` : '正在本机分离奖牌与背景…')
      }
    } catch { setProgress(''); failed('当前浏览器无法启动抠图，已保留原图。') }
    active.current?.worker.postMessage(blob)
  }
  return { progress, run, cancel }
}
