import {test,expect} from '@playwright/test'

test('manual medal crop supports drag, cancel, restore, persistence and backup without changing source pixels',async({page},info)=>{
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(async()=>{
    const {putRecords}=await import('/src/persistence/recordStore.ts')
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=600
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ecd7a5';ctx.fillRect(0,0,400,600);ctx.fillStyle='#285e5a';ctx.fillRect(100,0,200,300);ctx.fillStyle='#b48236';ctx.beginPath();ctx.arc(200,420,130,0,Math.PI*2);ctx.fill()
    const image=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'))
    await putRecords([{id:'crop-medal',kind:'medal',source:'upload',name:'裁剪测试',note:'',date:'',cutout:'done',originalImage:image,image}])
    sessionStorage.setItem('crop-fixture-board',JSON.stringify({title:'裁剪验收',items:[{id:'m',kind:'medal',recordId:'crop-medal',title:'裁剪测试',variant:'bronze',x:300,y:200,w:180,h:270,rotation:0}],threads:[]}))
  })
  await page.addInitScript(()=>{const board=sessionStorage.getItem('crop-fixture-board');if(board){localStorage.setItem('racememoir-board-v1',board);sessionStorage.removeItem('crop-fixture-board')}})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  const button=(name:string)=>page.getByRole('button',{name,exact:true})
  await page.locator('.scene>.memory-medal').press('Enter');await button('手动裁剪').click();await expect(button('应用裁剪')).toBeEnabled()
  await button('裁剪左上角').focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowDown')
  await button('取消裁剪').click();await expect(button('恢复裁剪前区域')).toHaveCount(0)
  await button('手动裁剪').click();await expect(button('应用裁剪')).toBeEnabled()
  const area=(await page.locator('.medal-crop-area').boundingBox())!,corner=(await button('裁剪左上角').boundingBox())!
  await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);await page.mouse.down();await page.mouse.move(area.x+area.width*.25,area.y+area.height*.25,{steps:10});await page.mouse.up()
  await expect(page.locator('.medal-crop-selection')).toHaveCSS('width',`${area.width*.75}px`)
  await button('移动奖牌裁剪框').focus();await page.keyboard.press('Shift+ArrowLeft')
  await page.screenshot({path:info.outputPath('medal-crop-editor.png')})
  await button('应用裁剪').click()
  await expect.poll(()=>page.locator('.medal-layout-preview .real-medal').evaluate((img:HTMLImageElement)=>[img.naturalWidth,img.naturalHeight])).toEqual([300,450])
  await button('保存修改').click()
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect.poll(()=>page.locator('.scene .real-medal').evaluate((img:HTMLImageElement)=>[img.naturalWidth,img.naturalHeight])).toEqual([300,450])
  const stored=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts'),{makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts')
    const records=await readRecords(),r=records.find((r:{id:string})=>r.id==='crop-medal'),source=await createImageBitmap(r.originalImage)
    const backup=await readBackup(await makeZipArchive(JSON.parse(localStorage.getItem('racememoir-board-v1')!),records))
    const result={crop:r.crop,backupCrop:backup.records.find((r:{name:string})=>r.name==='裁剪测试').crop,originalSize:[source.width,source.height]};source.close();return result
  })
  expect(stored.crop.x).toBeCloseTo(.2);expect(stored.crop.y).toBeCloseTo(.25);expect(stored.crop.width).toBeCloseTo(.75);expect(stored.backupCrop).toEqual(stored.crop);expect(stored.originalSize).toEqual([400,600])
  await page.locator('.scene>.memory-medal').press('Enter');await button('手动裁剪').click();await expect(button('应用裁剪')).toBeEnabled()
  await page.setViewportSize({width:390,height:740});expect(await page.locator('.record-scroll').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1)
  await button('重置选区').click();await expect(page.locator('.medal-crop-selection')).toHaveCSS('left','0px');await button('取消裁剪').click()
  await button('恢复裁剪前区域').click();await button('保存修改').click()
  await expect.poll(()=>page.locator('.scene .real-medal').evaluate((img:HTMLImageElement)=>[img.naturalWidth,img.naturalHeight])).toEqual([400,600])
})
