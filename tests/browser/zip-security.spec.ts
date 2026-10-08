import {test,expect} from '@playwright/test'

test('ZIP restore uses a real worker, keeps the UI responsive and can be cancelled',async({page})=>{
  await page.goto('/')
  const result=await page.evaluate(async()=>{
    const {makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts')
    const {unzipBackup}=await import('/src/persistence/unzipBackup.ts')
    const {zipSync}=await import('/node_modules/.vite/deps/fflate.js')
    const original=window.Worker
    let workers=0,terminated=0,ticks=0
    class TrackedWorker extends original{
      constructor(url:URL,options:WorkerOptions){super(url,options);workers++}
      terminate(){terminated++;super.terminate()}
    }
    window.Worker=TrackedWorker
    const timer=setInterval(()=>ticks++,0)
    try{
      const board={title:'worker round trip',items:[],threads:[]}
      const restored=await readBackup(await makeZipArchive(board,[]))
      const bomb=zipSync({'manifest.json':new Uint8Array(4*1024*1024)})
      const view=new DataView(bomb.buffer),directory=view.getUint32(bomb.length-6,true)
      view.setUint32(22,1,true);view.setUint32(directory+24,1,true)
      let rejected=false,cancelled=false
      try{await readBackup(new Blob([bomb]))}catch{rejected=true}
      const controller=new AbortController()
      const pending=unzipBackup(zipSync({'manifest.json':new Uint8Array(4*1024*1024)}),controller.signal)
      controller.abort()
      try{await pending}catch(error){cancelled=error instanceof DOMException&&error.name==='AbortError'}
      return {title:restored.board.title,rejected,cancelled,workers,terminated,ticks}
    }finally{clearInterval(timer);window.Worker=original}
  })
  expect(result.title).toBe('worker round trip')
  expect(result.rejected).toBe(true)
  expect(result.cancelled).toBe(true)
  expect(result.workers).toBe(3)
  expect(result.terminated).toBe(3)
  expect(result.ticks).toBeGreaterThan(0)
})
