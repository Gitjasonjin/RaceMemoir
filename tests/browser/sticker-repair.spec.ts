import {test,expect} from '@playwright/test'

test('sticker brush erases, restores, cancels and persists the applied mask',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'修补测试',items:[],threads:[]})))
  await page.goto('/')
  await page.locator('.records-loading').waitFor({state:'hidden'})
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=200;c.height=200
    const ctx=c.getContext('2d')!;ctx.fillStyle='#428060';ctx.fillRect(40,40,120,120)
    return c.toDataURL().split(',')[1]
  })
  await page.getByRole('button',{name:'添加贴纸',exact:true}).click()
  await page.getByLabel('贴纸图片',{exact:true}).setInputFiles({name:'repair.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
  const open=page.getByRole('button',{name:'手动调整抠图',exact:true})
  await open.click()
  const canvas=page.locator('.ribbon-stage canvas')
  const alpha=()=>canvas.evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(100,100,1,1).data[3])
  const paint=async()=>{await expect(page.getByRole('button',{name:'应用修复',exact:true})).toBeEnabled();await canvas.click({position:{x:(await canvas.boundingBox())!.width/2,y:(await canvas.boundingBox())!.height/2}})}
  await page.getByRole('button',{name:'擦除背景',exact:true}).click();await paint()
  expect(await alpha()).toBe(0)
  await page.getByRole('button',{name:'恢复主体',exact:true}).click();await paint()
  expect(await alpha()).toBe(255)
  await page.getByRole('button',{name:'擦除背景',exact:true}).click();await paint()
  await page.getByRole('button',{name:'取消',exact:true}).click();await open.click()
  await expect.poll(alpha).toBe(255)
  await page.getByRole('button',{name:'擦除背景',exact:true}).click();await paint()
  await page.getByRole('button',{name:'应用修复',exact:true}).click()
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect(page.locator('.memory-sticker')).toHaveCount(1)
  const pixels=await page.evaluate(async()=>{
    // @ts-expect-error Vite serves this module in the browser.
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const record=(await readRecords()).find((r:{kind:string})=>r.kind==='sticker')
    const sample=async(blob:Blob)=>{const b=await createImageBitmap(blob);const c=new OffscreenCanvas(b.width,b.height);const ctx=c.getContext('2d')!;ctx.drawImage(b,0,0);b.close();return ctx.getImageData(100,100,1,1).data[3]}
    return {original:await sample(record.originalImage),result:await sample(record.image),mode:record.imageMode}
  })
  expect(pixels).toEqual({original:255,result:0,mode:'cutout'})
})
