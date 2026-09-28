import {test,expect} from '@playwright/test'
import type {Page,BrowserContext} from '@playwright/test'

async function ready(page:Page){
  await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'高分辨率验收',items:[],threads:[]}))})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
}
async function fixture(page:Page,transparent=false){
  const bytes=await page.evaluate(async transparent=>{
    const canvas=new OffscreenCanvas(8064,6048),ctx=canvas.getContext('2d')!
    if(!transparent){ctx.fillStyle='#ece4d5';ctx.fillRect(0,0,8064,6048)}
    ctx.fillStyle='#2c7a66';ctx.fillRect(2016,1512,4032,3024)
    const blob=await canvas.convertToBlob({type:'image/png'})
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  },transparent)
  return {name:transparent?'transparent-48mp.png':'original-48mp.png',mimeType:'image/png',buffer:Buffer.from(bytes)}
}
// Keep the actual resize worker and RGB restoration; replace only the downloaded model.
async function mockModel(context:BrowserContext){
  await context.route('**/@imgly_background-removal.js*',route=>route.fulfill({contentType:'application/javascript',body:`
    export async function removeBackground(blob){
      const bitmap=await createImageBitmap(blob);
      self.postMessage({type:'model-input',width:bitmap.width,height:bitmap.height});
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');
      ctx.fillStyle='red';ctx.fillRect(Math.floor(bitmap.width*.25),Math.floor(bitmap.height*.25),Math.floor(bitmap.width*.5),Math.floor(bitmap.height*.5));
      bitmap.close();return canvas.convertToBlob({type:'image/png'});
    }
  `}))
}

test('48MP photo keeps original bytes; processing copies and actual worker use 25MP and preserve RGB/alpha',async({page,context})=>{
  await mockModel(context);await ready(page)
  const file=await fixture(page)
  await page.getByRole('button',{name:'添加照片',exact:true}).click()
  await page.getByLabel('照片图片',{exact:true}).setInputFiles(file)
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect(page.locator('.memory-photo')).toHaveCount(1)
  const result=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const original=(await readRecords()).find((r:any)=>r.kind==='photo').image
    const {readBatchPhoto}=await import('/src/items/photo/batchPhotos.ts')
    const photo=await readBatchPhoto(new File([original],'batch.png',{type:'image/png'}))
    const originalBytes=Array.from(new Uint8Array(await original.arrayBuffer()))
    const worker=new Worker(new URL('/src/items/medal/cutout.worker.ts?worker_file&type=module',location.href),{type:'module'})
    let input:number[]=[]
    const image=await new Promise<Blob>((resolve,reject)=>{
      worker.onmessage=e=>{if(e.data.type==='model-input')input=[e.data.width,e.data.height];if(e.data.type==='done')resolve(e.data.image);if(e.data.type==='error')reject(new Error(e.data.message))}
      worker.onerror=e=>reject(new Error(e.message));worker.postMessage({blob:original,subject:'sticker'})
    }).finally(()=>worker.terminate())
    const bitmap=await createImageBitmap(image),c=new OffscreenCanvas(1,1),ctx=c.getContext('2d')!
    ctx.drawImage(bitmap,Math.floor(bitmap.width/2),Math.floor(bitmap.height/2),1,1,0,0,1,1)
    const pixel=Array.from(ctx.getImageData(0,0,1,1).data)
    ctx.clearRect(0,0,1,1);ctx.drawImage(bitmap,0,0,1,1,0,0,1,1)
    const alpha=ctx.getImageData(0,0,1,1).data[3],size=[bitmap.width,bitmap.height];bitmap.close()
    return {originalBytes,batch:[photo.width,photo.height],input,size,pixel,alpha}
  })
  expect(Buffer.from(result.originalBytes)).toEqual(file.buffer)
  expect(result.batch).toEqual([8064,6048])
  expect(result.input).toEqual([5773,4330]);expect(result.size).toEqual(result.input)
  expect(result.pixel).toEqual([44,122,102,255]);expect(result.alpha).toBe(0)
})

test('large transparent sticker skips model, repairs at processing size, switches modes and restores original ZIP bytes',async({page},info)=>{
  let workers=0
  await page.route('**/cutout.worker.ts*',route=>{workers++;return route.abort()})
  await ready(page);const file=await fixture(page,true)
  await page.getByRole('button',{name:'添加贴纸',exact:true}).click()
  await page.getByLabel('贴纸图片',{exact:true}).setInputFiles(file)
  await expect(page.locator('.record-notice')).toContainText('5773 × 4330')
  await expect(page.locator('.sticker-preview [data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  await page.getByRole('button',{name:'手动调整抠图',exact:true}).click()
  await expect(page.getByRole('button',{name:'应用修复',exact:true})).toBeEnabled()
  expect(await page.locator('.ribbon-stage canvas').evaluate((c:HTMLCanvasElement)=>[c.width,c.height])).toEqual([5773,4330])
  await page.getByRole('button',{name:'应用修复',exact:true}).click()
  await expect(page.getByRole('button',{name:'使用抠图',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'使用原图',exact:true}).click()
  await page.getByRole('slider',{name:'贴纸白边粗细',exact:true}).fill('1')
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect(page.locator('.scene [data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.scene [data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  const result=await page.evaluate(async()=>{
    const {readRecords,putRecords}=await import('/src/persistence/recordStore.ts'),{makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts')
    const records=await readRecords(),record=records.find((r:any)=>r.kind==='sticker'),board=JSON.parse(localStorage.getItem('racememoir-board-v1')!)
    const restored=await readBackup(await makeZipArchive(board,records)),r=restored.records.find((r:any)=>r.kind==='sticker')
    const bytes=Array.from(new Uint8Array(await r.originalImage.arrayBuffer()))
    await putRecords(restored.records);localStorage.setItem('racememoir-board-v1',JSON.stringify(restored.board))
    return {bytes,dimensions:[r.width,r.height],idChanged:r.id!==record.id,image:!!r.image,mode:r.imageMode}
  })
  expect(Buffer.from(result.bytes)).toEqual(file.buffer);expect(result.idChanged).toBe(true);expect(result.image).toBe(true);expect(result.mode).toBe('original')
  expect(result.dimensions[0]*result.dimensions[1]).toBeLessThanOrEqual(25_000_000)
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.scene [data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  await page.getByRole('button',{name:'分享',exact:true}).click()
  const download=page.waitForEvent('download')
  await page.getByRole('button',{name:/导出高清图片/}).click()
  await(await download).saveAs(info.outputPath('high-resolution-sticker.png'))
  expect(workers).toBe(0)
})

test('large medal cutout preview, crop and repair share reduced dimensions while original is kept',async({page,context})=>{
  await mockModel(context);await ready(page);const file=await fixture(page)
  await page.getByRole('button',{name:'添加奖牌',exact:true}).click()
  await page.getByLabel('奖牌图片',{exact:true}).setInputFiles(file)
  await expect(page.locator('.record-notice').filter({hasText:'原图 8064'})).toContainText('5773 × 4330')
  await expect(page.getByRole('button',{name:'手动微调',exact:true})).toBeVisible({timeout:60000})
  await page.getByRole('button',{name:'手动微调',exact:true}).click()
  await expect(page.getByRole('button',{name:'应用修复',exact:true})).toBeEnabled()
  expect(await page.locator('.ribbon-stage canvas').evaluate((c:HTMLCanvasElement)=>[c.width,c.height])).toEqual([5773,4330])
  await page.getByRole('button',{name:'取消',exact:true}).click()
  await page.getByRole('button',{name:'手动裁剪',exact:true}).click()
  await expect(page.getByRole('button',{name:'应用裁剪',exact:true})).toBeEnabled()
  expect(await page.locator('.medal-crop-area>img').evaluate((img:HTMLImageElement)=>[img.naturalWidth,img.naturalHeight])).toEqual([5773,4330])
  await page.getByRole('button',{name:'取消裁剪',exact:true}).click()
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect(page.locator('.memory-medal')).toHaveCount(1)
  const bytes=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const r=(await readRecords()).find((r:any)=>r.kind==='medal')
    return Array.from(new Uint8Array(await r.originalImage.arrayBuffer()))
  })
  expect(Buffer.from(bytes)).toEqual(file.buffer)
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect.poll(()=>page.locator('.scene .real-medal').evaluate((img:HTMLImageElement)=>img.naturalWidth*img.naturalHeight)).toBeGreaterThan(0)
})
