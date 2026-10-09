import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

const workerUrl='**/imageProcessing.worker.ts*'

async function ready(page:Page){
  await page.addInitScript(()=>{
    if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'图片缓存验收',items:[],threads:[]}))
  })
  await page.goto('/')
  await page.locator('.records-loading').waitFor({state:'hidden'})
}

async function cacheCount(page:Page){
  return page.evaluate(()=>new Promise<number>((resolve,reject)=>{
    const open=indexedDB.open('racememoir-derived-images-v1')
    open.onerror=()=>reject(open.error)
    open.onsuccess=()=>{
      const db=open.result,request=db.transaction('images').objectStore('images').count()
      request.onsuccess=()=>{db.close();resolve(request.result)}
      request.onerror=()=>{db.close();reject(request.error)}
    }
  }))
}

test('sticker derived images survive reload and invalidate by source bytes, border and style',async({page})=>{
  let workerRequests=0
  await page.route(workerUrl,route=>{workerRequests++;return route.continue()})
  await ready(page)
  const first=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=320
    const ctx=canvas.getContext('2d')!
    ctx.fillStyle='#2c7a66';ctx.fillRect(100,80,200,160)
    const source=canvas.toDataURL();localStorage.setItem('derived-sticker-source',source)
    ctx.fillStyle='#b34936';ctx.fillRect(100,80,200,160)
    localStorage.setItem('derived-sticker-changed',canvas.toDataURL())
    const blob=await(await fetch(source)).blob(),bytes=Array.from(new Uint8Array(await blob.arrayBuffer()))
    const {prepareSticker}=await import('/src/items/sticker/stickerImage.ts')
    const result=await prepareSticker(blob,2,'contour'),bitmap=await createImageBitmap(result.blob)
    const output={width:result.width,height:result.height,png:result.blob.type,bitmap:[bitmap.width,bitmap.height],originalUnchanged:JSON.stringify(bytes)===JSON.stringify(Array.from(new Uint8Array(await blob.arrayBuffer())))}
    bitmap.close();return output
  })
  expect(workerRequests).toBe(1)
  expect(first.originalUnchanged).toBe(true)
  expect(first.png).toBe('image/png')
  expect(first.width).toBeGreaterThan(200);expect(first.height).toBeGreaterThan(160)
  expect(first.bitmap).toEqual([first.width,first.height])
  expect(await cacheCount(page)).toBe(1)

  await page.unroute(workerUrl)
  workerRequests=0
  await page.route(workerUrl,route=>{workerRequests++;return route.abort()})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  const cached=await page.evaluate(async()=>{
    const {prepareSticker}=await import('/src/items/sticker/stickerImage.ts')
    // New Blob objects and a fresh JS module cache still resolve by content.
    const source=await(await fetch(localStorage.getItem('derived-sticker-source')!)).blob()
    const clone=new Blob([await source.arrayBuffer()],{type:source.type})
    const result=await prepareSticker(clone,2,'contour')
    return {width:result.width,height:result.height,type:result.blob.type}
  })
  expect(cached).toEqual({width:first.width,height:first.height,type:'image/png'})
  expect(workerRequests).toBe(0)

  const invalidated=await page.evaluate(async()=>{
    const {prepareSticker}=await import('/src/items/sticker/stickerImage.ts')
    const original=await(await fetch(localStorage.getItem('derived-sticker-source')!)).blob()
    const changed=await(await fetch(localStorage.getItem('derived-sticker-changed')!)).blob()
    const results=await Promise.allSettled([
      prepareSticker(original,4,'contour'),prepareSticker(original,2,'torn'),prepareSticker(changed,2,'contour'),
    ])
    return results.map(result=>result.status)
  })
  expect(invalidated).toEqual(['rejected','rejected','rejected'])
  expect(workerRequests).toBeGreaterThan(0)
  expect(await cacheCount(page)).toBe(1)

  await page.unroute(workerUrl)
  const regenerated=await page.evaluate(async()=>{
    const {prepareSticker}=await import('/src/items/sticker/stickerImage.ts')
    const original=await(await fetch(localStorage.getItem('derived-sticker-source')!)).blob()
    const changed=await(await fetch(localStorage.getItem('derived-sticker-changed')!)).blob()
    const results=await Promise.all([
      prepareSticker(original,4,'contour'),prepareSticker(original,2,'torn'),prepareSticker(changed,2,'contour'),
    ])
    return results.map(result=>({width:result.width,height:result.height,type:result.blob.type}))
  })
  expect(regenerated.every(result=>result.type==='image/png')).toBe(true)
  expect(regenerated[0].width).toBeGreaterThan(first.width)
  expect(regenerated[2].width).toBe(first.width)
  expect(await cacheCount(page)).toBe(4)
})

test('uploaded medal cache preserves original RGB, exact crop and source bytes after reload',async({page})=>{
  let workerRequests=0
  await page.route(workerUrl,route=>{workerRequests++;return route.continue()})
  await ready(page)
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=320
    const ctx=canvas.getContext('2d')!
    ctx.fillStyle='#123456';ctx.fillRect(0,0,400,320)
    const originalImage=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'))
    localStorage.setItem('derived-medal-source',canvas.toDataURL())
    ctx.clearRect(0,0,400,320);ctx.fillStyle='#e4c817';ctx.fillRect(100,80,200,160)
    const image=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'))
    const {putRecords}=await import('/src/persistence/recordStore.ts')
    await putRecords([{id:'cache-medal-record',kind:'medal',name:'奖牌缓存验收',note:'',source:'upload',date:'',cutout:'done',originalImage,image,crop:{x:.25,y:.25,width:.5,height:.5}}])
    sessionStorage.setItem('derived-medal-board',JSON.stringify({title:'奖牌缓存验收',items:[{id:'cache-medal',kind:'medal',recordId:'cache-medal-record',title:'奖牌缓存验收',x:500,y:250,w:226,h:357,rotation:0}],threads:[]}))
  })
  await page.addInitScript(()=>{
    const board=sessionStorage.getItem('derived-medal-board')
    if(board){localStorage.setItem('racememoir-board-v1',board);localStorage.removeItem('racememoir-season-workspace-v1');sessionStorage.removeItem('derived-medal-board')}
  })
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  const medal=page.locator('.scene .real-medal')
  await expect(medal).toHaveAttribute('data-medal-state','ready')
  expect(workerRequests).toBeGreaterThan(0)
  const result=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const {prepareMedal}=await import('/src/items/medal/useMedalImage.ts')
    const record=(await readRecords()).find((record:any)=>record.id==='cache-medal-record')
    const result=await prepareMedal(record.originalImage,record.image,record.crop)
    const bitmap=await createImageBitmap(result.blob),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d')!
    ctx.drawImage(bitmap,0,0);bitmap.close()
    const source=await(await fetch(localStorage.getItem('derived-medal-source')!)).blob()
    return {size:[result.width,result.height],center:Array.from(ctx.getImageData(100,80,1,1).data),corner:Array.from(ctx.getImageData(0,0,1,1).data),originalUnchanged:JSON.stringify(Array.from(new Uint8Array(await source.arrayBuffer())))===JSON.stringify(Array.from(new Uint8Array(await record.originalImage.arrayBuffer())))}
  })
  expect(result.size).toEqual([200,160])
  expect(result.center).toEqual([18,52,86,255]);expect(result.corner).toEqual([18,52,86,255])
  expect(result.originalUnchanged).toBe(true)
  expect(await cacheCount(page)).toBe(1)

  await page.unroute(workerUrl);workerRequests=0
  await page.route(workerUrl,route=>{workerRequests++;return route.abort()})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(medal).toHaveAttribute('data-medal-state','ready')
  await expect.poll(()=>medal.evaluate(image=>[(image as HTMLImageElement).naturalWidth,(image as HTMLImageElement).naturalHeight])).toEqual([200,160])
  expect(workerRequests).toBe(0)
  const changedCrop=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const {prepareMedal}=await import('/src/items/medal/useMedalImage.ts')
    const record=(await readRecords()).find((record:any)=>record.id==='cache-medal-record')
    try{await prepareMedal(record.originalImage,record.image,{x:0,y:0,width:1,height:1});return 'unexpected cache hit'}
    catch{return 'regeneration required'}
  })
  expect(changedCrop).toBe('regeneration required')
  expect(workerRequests).toBeGreaterThan(0)
  await page.unroute(workerUrl)
  const retried=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const {prepareMedal}=await import('/src/items/medal/useMedalImage.ts')
    const record=(await readRecords()).find((record:any)=>record.id==='cache-medal-record')
    const result=await prepareMedal(record.originalImage,record.image,{x:0,y:0,width:1,height:1})
    return [result.width,result.height]
  })
  expect(retried).toEqual([400,320])
  expect(await cacheCount(page)).toBe(2)
})

test('worker queue cancels a waiting job without interrupting another task',async({page})=>{
  let workers=0
  await page.route(workerUrl,route=>{
    workers++
    return route.fulfill({contentType:'application/javascript',body:`let active=0;self.onmessage=async event=>{const {id,request}=event.data;if(++active>1){self.postMessage({id,error:{message:'Concurrent image jobs'}});active--;return}await new Promise(resolve=>setTimeout(resolve,120));const bitmap=await createImageBitmap(request.blob);const result={width:bitmap.width,height:bitmap.height,transparent:true};bitmap.close();active--;self.postMessage({id,result})}`})
  })
  await ready(page)
  const results=await page.evaluate(async()=>{
    const {processImage}=await import('/src/shared/imageProcessing.ts')
    const canvas=new OffscreenCanvas(240,160)
    canvas.getContext('2d')!.fillRect(0,0,240,160)
    const blob=await canvas.convertToBlob({type:'image/png'})
    const controller=new AbortController()
    const first=processImage({type:'inspect',blob})
    const cancelled=processImage({type:'inspect',blob},controller.signal).then(()=>false,error=>error.name==='AbortError')
    const last=processImage({type:'inspect',blob})
    controller.abort()
    return {first:await first,cancelled:await cancelled,last:await last}
  })
  expect(results.cancelled).toBe(true)
  expect(results.first).toEqual({width:240,height:160,transparent:true})
  expect(results.last).toEqual(results.first)
  expect(workers).toBe(1)
})
