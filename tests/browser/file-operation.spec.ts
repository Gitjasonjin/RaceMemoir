import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function seed(page:Page){
  await page.addInitScript(()=>localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Operation test',items:[{id:'note',kind:'note',title:'Trail memories',variant:'yellow',x:0,y:0,w:180,h:160,rotation:0}],threads:[]})))
}
async function slowModule(page:Page,path:string,functions:string[]){
  await page.route(`**/src/persistence/${path}.ts`,async route=>{
    const response=await route.fetch();let body=await response.text()
    for(const name of functions){
      const pattern=new RegExp(`async function ${name}\\([^)]*\\)\\s*\\{`)
      expect(body).toMatch(pattern)
      body=body.replace(pattern,match=>`${match}\n await new Promise(resolve=>setTimeout(resolve,1200));`)
    }
    await route.fulfill({response,body})
  })
}

test('ZIP export/import show their own progress, completion and recoverable error',async({page},info)=>{
  await seed(page);await slowModule(page,'zipArchive',['makeZipArchive','readBackup'])
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.locator('.share-button').click()
  // Wide layouts used to leave the backdrop at 66px below a 72px header.
  for(const width of [1440,1920,2560]){
    await page.setViewportSize({width,height:1000})
    const edges=await page.evaluate(()=>['.topbar','.board-viewport','.ui-dialog-backdrop[data-board-share]'].map(selector=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
    expect(edges[1].top).toBeCloseTo(edges[0].bottom,1)
    expect(edges[2].top).toBeCloseTo(edges[0].bottom,1)
  }
  const shareBackdrop=await page.locator('.ui-dialog-backdrop[data-board-share]').evaluate(el=>{const style=getComputedStyle(el);return {top:el.getBoundingClientRect().top,color:style.backgroundColor,blur:style.backdropFilter}})
  const shareHeader=(await page.locator('.topbar').boundingBox())!
  expect(shareBackdrop.top).toBeCloseTo(shareHeader.y+shareHeader.height,1)
  await page.screenshot({path:info.outputPath('share-desktop.png')})
  const download=page.waitForEvent('download')
  await page.locator('.export-option').nth(1).click()
  const loader=page.locator('.file-operation-floating'),lattice=loader.locator('.lattice-loader')
  await expect(lattice).toHaveAttribute('data-status','working')
  await expect(loader).toContainText('正在导出收藏板')
  await expect(page.locator('.modal')).toBeHidden()
  await expect(loader).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
  await expect(loader).toHaveCSS('box-shadow','none')
  await page.keyboard.press('Escape');await expect(loader).toBeVisible()
  await expect(loader).toHaveCSS('opacity','1')
  const row=await loader.evaluate(el=>['.lattice-loader-grid','.lattice-loader-copy strong','.lattice-loader-timer'].map(selector=>{const r=el.querySelector(selector)!.getBoundingClientRect();return {x:r.x,center:r.y+r.height/2}}))
  expect(Math.max(...row.map(r=>r.center))-Math.min(...row.map(r=>r.center))).toBeLessThan(1)
  expect(row[0].x).toBeLessThan(row[1].x);expect(row[1].x).toBeLessThan(row[2].x)
  const header=(await page.locator('.topbar').boundingBox())!,backdrop=(await page.locator('.file-operation-backdrop').boundingBox())!
  expect(backdrop.y).toBeCloseTo(header.y+header.height,1)
  await expect(page.locator('.file-operation-backdrop')).toHaveCSS('background-color',shareBackdrop.color)
  await expect(page.locator('.file-operation-backdrop')).toHaveCSS('backdrop-filter',shareBackdrop.blur)

  expect(await loader.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
  await page.screenshot({path:info.outputPath('export.png')})
  const zip=info.outputPath('board.zip');await(await download).saveAs(zip)
  await expect(lattice).toHaveAttribute('data-status','done')
  await expect(loader).toContainText('收藏板备份已生成')
  await expect(loader).toBeHidden()
  await page.locator('input[accept^=".zip"]').setInputFiles(zip)
  await expect(loader).toContainText('正在导入收藏板')
  await expect(lattice).toHaveAttribute('data-status','working')
  await expect(loader).toHaveCSS('opacity','1')
  await page.screenshot({path:info.outputPath('import.png')})
  await expect(lattice).toHaveAttribute('data-status','done')
  await expect(loader).toContainText('收藏板已导入')
  await expect(loader).toBeHidden()
  const board=await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))
  await page.locator('input[accept^=".zip"]').setInputFiles({name:'broken.zip',mimeType:'application/zip',buffer:Buffer.from('invalid')})
  await expect(loader).toContainText('正在导入收藏板')
  await expect(lattice).toHaveAttribute('data-status','error')
  await expect(loader).toContainText('收藏板导入失败')
  await expect(loader).toBeHidden()
  expect(await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))).toBe(board)
  // The file input and operation lock must permit retrying after failure.
  await page.locator('input[accept^=".zip"]').setInputFiles(zip)
  await expect(loader).toContainText('正在导入收藏板')
  await expect(lattice).toHaveAttribute('data-status','done')
  await expect(loader).toBeHidden()
})

test('mobile PNG progress uses translated copy and respects reduced motion',async({page},info)=>{
  await seed(page);await slowModule(page,'exportImage',['exportBoardImage'])
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  for(const [label,working,done] of [['English','Rendering image','Image ready'],['日本語','画像を書き出しています','画像の準備ができました']]){
    await page.getByRole('button',{name:'Language / 语言 / 言語',exact:true}).click()
    await page.getByRole('menuitemradio',{name:label,exact:true}).click()
    await page.locator('.share-button').click()
    const share=(await page.locator('.ui-dialog-backdrop[data-board-share]').boundingBox())!,topbar=(await page.locator('.topbar').boundingBox())!,dialog=(await page.locator('.modal').boundingBox())!
    expect(share.y).toBeCloseTo(topbar.y+topbar.height,1)
    expect(dialog.y).toBeGreaterThanOrEqual(share.y)
    await page.screenshot({path:info.outputPath(`share-mobile-${label}.png`)})
    const download=page.waitForEvent('download');await page.locator('.export-option').first().click()
    const loader=page.locator('.file-operation-floating')
    await expect(loader).toContainText(working)
    await expect(page.locator('.modal')).toBeHidden()
    if(label==='English')expect(await loader.innerText()).not.toMatch(/[\u3400-\u9fff]/)
    await expect(loader).toHaveCSS('opacity','1')
    const header=(await page.locator('.topbar').boundingBox())!,backdrop=(await page.locator('.file-operation-backdrop').boundingBox())!
    expect(backdrop.y).toBeCloseTo(header.y+header.height,1)

    await expect(loader.locator('.lattice-loader-run>span').first()).toHaveCSS('animation-name','none')
    expect(await loader.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`mobile-${label}.png`)})
    await(await download).saveAs(info.outputPath(`${label}.png`))
    await expect(loader).toContainText(done);await expect(loader).toBeHidden()
    await expect(page.locator('.modal')).toBeHidden()
  }
})

test('minimap uses the shared tooltip and dismisses it during navigation',async({page},info)=>{
  await seed(page);await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  const map=page.locator('.minimap'),tooltip=page.getByRole('tooltip')
  await expect(map).not.toHaveAttribute('title')
  await map.hover();await expect(tooltip).toBeVisible()
  await expect(tooltip).toHaveClass(/tool-tooltip/)
  await page.screenshot({path:info.outputPath('minimap-tooltip.png')})
  await page.mouse.down();await expect(tooltip).toBeHidden();await page.mouse.up()
  await page.mouse.move(300,200);await map.focus()
  await expect(tooltip).toBeVisible()
  await page.keyboard.press('Escape');await expect(tooltip).toBeHidden()
})

test('saved English preference translates all backup/import states and closes share on import',async({page},info)=>{
  await seed(page);await page.addInitScript(()=>localStorage.setItem('racememoir-language','en'))
  await slowModule(page,'zipArchive',['makeZipArchive','readBackup'])
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  const loader=page.locator('.file-operation-floating')
  await page.locator('.share-button').click()
  const download=page.waitForEvent('download');await page.locator('.export-option').nth(1).click()
  await expect(loader).toContainText('Exporting board')
  await expect(loader).toContainText('Elapsed:')
  await expect(loader).toContainText('Packing your layout')
  expect(await loader.innerText()).not.toMatch(/[\u3400-\u9fff]/)
  await expect(loader).toHaveCSS('opacity','1')
  await page.screenshot({path:info.outputPath('english-floating.png')})
  const zip=info.outputPath('en.zip');await(await download).saveAs(zip)
  await expect(loader).toContainText('Backup ready');await expect(loader).toBeHidden()
  await page.locator('.share-button').click()
  const picker=page.waitForEvent('filechooser');await page.locator('.export-option').nth(2).click()
  await(await picker).setFiles(zip)
  await expect(loader).toContainText('Importing board')
  await expect(page.locator('.modal')).toBeHidden()
  expect(await loader.innerText()).not.toMatch(/[\u3400-\u9fff]/)
  await expect(loader).toContainText('Board imported');await expect(loader).toBeHidden()
  await page.locator('.share-button').click()
  await page.locator('input[accept^=".zip"]').setInputFiles({name:'bad.zip',mimeType:'application/zip',buffer:Buffer.from('invalid')})
  await expect(loader).toContainText('Board import failed')
  expect(await loader.innerText()).not.toMatch(/[\u3400-\u9fff]/)
  await expect(page.locator('.modal')).toBeHidden()
  await expect(loader).toBeHidden()
})

test('share button keeps its size, position and icon alignment across languages',async({page})=>{
  await seed(page);await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  for(const width of [1440,820,390]){
    await page.setViewportSize({width,height:900})
    const positions=[]
    for(const label of ['简体中文','English','日本語']){
      await page.getByRole('button',{name:'Language / 语言 / 言語',exact:true}).click()
      await page.getByRole('menuitemradio',{name:label,exact:true}).click()
      await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await document.fonts.ready})
      positions.push(await page.locator('.share-button').evaluate(el=>{
        const r=el.getBoundingClientRect(),icon=el.querySelector('svg')!.getBoundingClientRect()
        return {x:r.x,y:r.y,w:r.width,h:r.height,iconX:icon.x,iconY:icon.y}
      }))
    }
    for(const position of positions.slice(1))for(const key of Object.keys(position) as (keyof typeof position)[])expect(position[key]).toBeCloseTo(positions[0][key],1)
  }
})
