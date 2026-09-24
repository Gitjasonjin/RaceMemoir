import {test,expect} from '@playwright/test'

for(const mobile of [false,true])test(`preview upload and replacement are reachable without scrolling ${mobile?'mobile':'desktop'}`,async({browser},info)=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},hasTouch:mobile,isMobile:mobile})
  const page=await context.newPage()
  await page.goto('http://127.0.0.1:5187/');await page.locator('.records-loading').waitFor({state:'hidden'})
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const ctx=c.getContext('2d')!;ctx.fillStyle='#73855f';ctx.fillRect(40,30,320,240);return c.toDataURL().split(',')[1]})
  const file={name:'preview.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')}
  for(const kind of ['照片','奖牌','路线','贴纸','号码布']){
    const add=page.getByRole('button',{name:`添加${kind}`,exact:true})
    if(mobile)await add.tap();else await add.click()
    if(kind==='号码布')await page.getByRole('button',{name:'上传图片',exact:true}).click()
    const choose=page.locator('.asset-picker-empty'),scroll=page.locator('.record-scroll')
    await expect(choose).toBeInViewport();expect(await scroll.evaluate(el=>el.scrollTop)).toBe(0)
    await expect(page.locator('.record-upload input[type=file]')).toHaveCount(1)
    const picked=page.waitForEvent('filechooser');await choose.click();const chooser=await picked
    expect(chooser.isMultiple()).toBe(kind==='照片')
    if(kind==='奖牌'||kind==='路线')await chooser.setFiles([])
    else {
      await chooser.setFiles(file)
      const replace=page.locator('.asset-picker-replace')
      await expect(replace).toBeEnabled();await expect(replace).toBeInViewport()
      expect(await scroll.evaluate(el=>el.scrollTop)).toBe(0)
      if(kind==='照片'){
        await expect(page.locator('.photo-composition-preview img')).toBeVisible()
        await page.screenshot({path:info.outputPath('photo-picker.png')})
      }
      const replacing=page.waitForEvent('filechooser');await replace.click();await (await replacing).setFiles({...file,name:'replacement.png'})
      await expect(replace).toBeEnabled()
    }
    await page.locator('.record-heading button').last().click()
    await expect(page.locator('.record-panel')).toHaveCount(0)
  }
  await context.close()
})
