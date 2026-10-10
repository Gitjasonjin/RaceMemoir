import {test,expect} from '@playwright/test'
import type {CDPSession,Page} from '@playwright/test'
import type {Board} from '../../src/domain/model'
import type {SeasonWorkspace} from '../../src/persistence/seasonStore'

const legacyBoard:Board={
  title:'观赏回归收藏板',backgroundStyle:'kraft',decorations:{pin:'brass',tape:'classic',thread:'classic'},
  items:[
    {id:'photo-a',kind:'photo',title:'云海照片',subtitle:'2024.10.26',image:'/images/mountain.jpg',variant:'landscape',x:80,y:80,w:260,h:180,rotation:0},
    {id:'photo-b',kind:'photo',title:'林间终点',subtitle:'2023.04.15',image:'/images/hiking.jpg',x:440,y:100,w:160,h:240,rotation:0},
    {id:'demo-medal',kind:'medal',title:'RIDGE 50K',subtitle:'2024.10.26',variant:'bronze',x:90,y:310,w:170,h:260,rotation:0},
    {id:'note',kind:'note',title:'清晨的山径记忆',variant:'paper',x:420,y:400,w:180,h:140,rotation:0},
  ],
  threads:[{id:'photo-note',from:'photo-a',to:'note',curvature:.12},{id:'medal-photo',from:'demo-medal',to:'photo-b'}],
}

const labels=[
  {language:'简体中文',locale:'zh-CN',enter:'进入观赏模式',exit:'退出观赏模式',close:'关闭预览'},
  {language:'English',locale:'en',enter:'View board',exit:'Exit viewing',close:'Close preview'},
  {language:'日本語',locale:'ja',enter:'ボードを鑑賞',exit:'鑑賞モードを終了',close:'プレビューを閉じる'},
] as const
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true})
const item=(page:Page,id:string)=>page.locator(`[data-board-item="${id}"]`)
const scene=(page:Page)=>page.locator('.scene')
const shell=(page:Page)=>page.locator('.app-shell')
const workspace=(page:Page):Promise<SeasonWorkspace>=>page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-season-workspace-v1')!))
const activeBoard=async(page:Page):Promise<Board>=>{
  const saved=await workspace(page)
  return saved.seasons.find(season=>season.year===saved.activeYear)!.board
}
const camera=(page:Page)=>scene(page).evaluate(el=>{
  const matrix=new DOMMatrix(getComputedStyle(el).transform)
  return {x:matrix.e,y:matrix.f,scale:matrix.a}
})
const itemGeometry=(page:Page)=>page.locator('[data-board-item]').evaluateAll(elements=>elements.map(el=>{
  const style=(el as HTMLElement).style
  return {id:el.getAttribute('data-board-item'),x:style.left,y:style.top,w:style.width,h:style.height,rotation:style.transform}
}))

async function ready(page:Page){
  await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.board-title')).toHaveText(legacyBoard.title)
  await expect.poll(()=>page.evaluate(()=>!!localStorage.getItem('racememoir-season-workspace-v1'))).toBe(true)
  await expect.poll(async()=>{
    const saved=await workspace(page)
    return saved.seasons.find(season=>season.year===saved.activeYear)?.board.items.find(memory=>memory.id==='demo-medal')?.recordId
  }).toBe('legacy-medal-demo-medal')
}
async function openBoard(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(seed=>{
    localStorage.setItem('racememoir-language','zh-CN')
    // The season workspace becomes authoritative after migration. Never replace it on reload.
    if(!localStorage.getItem('racememoir-season-workspace-v1')&&!localStorage.getItem('racememoir-board-v1')){
      localStorage.setItem('racememoir-board-v1',JSON.stringify(seed))
    }
  },legacyBoard)
  await page.goto('/')
  await ready(page)
  await expect(page.locator('.topbar').getByRole('button',{name:'进入观赏模式',exact:true})).toHaveCount(0)
}
async function openViewingMenu(page:Page,name:string='进入观赏模式',touch=false){
  const point=await page.locator('.board-viewport').evaluate(viewport=>{
    const bounds=viewport.getBoundingClientRect()
    for(const y of [180,bounds.height*.35,bounds.height*.6])for(const x of [12,bounds.width*.8,bounds.width*.5]){
      const point={x:bounds.x+Math.min(x,bounds.width-12),y:bounds.y+Math.min(y,bounds.height-12)},target=document.elementFromPoint(point.x,point.y)
      if(target&&viewport.contains(target)&&!target.closest('[data-board-item],[data-board-anchor],[data-board-thread],button,[data-ui-overlay],.empty-board'))return point
    }
    throw new Error('No blank canvas point is available for the viewing menu')
  })
  if(touch){
    const cdp=await page.context().newCDPSession(page)
    await sendTouch(cdp,'touchStart',[{id:1,...point}]);await page.waitForTimeout(600);await sendTouch(cdp,'touchEnd',[])
    await cdp.detach()
  }else await page.mouse.click(point.x,point.y,{button:'right'})
  const entry=page.getByRole('menuitem',{name,exact:true})
  await expect(entry).toBeVisible()
  return entry
}
async function enter(page:Page,name:string='进入观赏模式'){
  const before=(await scene(page).getAttribute('style'))!
  await (await openViewingMenu(page,name)).click()
  await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
  await expect(page.locator('.canvas-context-menu')).toHaveCount(0)
  await assertViewingLayout(page,labels.find(label=>label.enter===name)!.exit)
  await expect(button(page,labels.find(label=>label.enter===name)!.exit)).toBeFocused()
  await expect(scene(page)).toHaveAttribute('style',before)
}
async function exit(page:Page,name:string='退出观赏模式'){
  const before=(await scene(page).getAttribute('style'))!
  await button(page,name).click()
  await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
  await expect(page.locator('.topbar')).toBeVisible()
  await expect(page.locator('.board-viewport')).toHaveAttribute('tabindex','-1')
  await expect(page.locator('.board-viewport')).toBeFocused()
  await expect(scene(page)).toHaveAttribute('style',before)
}
async function changeLanguage(page:Page,name:string){
  await button(page,'Language / 语言 / 言語').click()
  await page.getByRole('menuitemradio',{name,exact:true}).click()
}
async function mouseDrag(page:Page,id:string,dx:number,dy:number){
  const box=(await item(page,id).boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2
  await page.mouse.move(x,y);await page.mouse.down()
  await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up()
}
async function openYears(page:Page){
  if(!await page.locator('.year-capsule').isVisible())await page.locator('.board-action-calendar').click()
  await expect(page.locator('.year-capsule')).toBeVisible()
}
async function assertViewingLayout(page:Page,exitLabel:string='退出观赏模式'){
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(button(page,'Language / 语言 / 言語')).toBeHidden()
  await expect(page.locator('.share-button')).toBeHidden()
  await expect.poll(()=>page.locator('.board-viewport').evaluate(el=>el.getBoundingClientRect().top)).toBe(0)
  await expect.poll(()=>page.locator('.board-viewport').evaluate(el=>el.getBoundingClientRect().height-innerHeight)).toBe(0)
  const actions=page.locator('.board-actions'),exitControl=actions.getByRole('button',{name:exitLabel,exact:true})
  await page.mouse.move(5,page.viewportSize()!.height-5)
  await expect(actions.locator(':scope > button:visible')).toHaveCount(2)
  await expect(actions.locator(':scope > button:visible').first()).toHaveClass(/board-action-calendar/)
  await expect(actions.locator(':scope > button:visible').last()).toHaveAttribute('aria-label',exitLabel)
  await expect(exitControl).toHaveCSS('width','44px');await expect(exitControl).toHaveCSS('height','44px')
  await expect(exitControl).toBeInViewport()
  const season=(await actions.locator('.board-action-calendar').boundingBox())!,exitBounds=(await exitControl.boundingBox())!
  const gap=await actions.evaluate(el=>parseFloat(getComputedStyle(el).rowGap))
  expect(exitBounds.x).toBeCloseTo(season.x,1)
  expect(exitBounds.y).toBeCloseTo(season.y+season.height+gap,1)
  if(await shell(page).getAttribute('data-light')==='on'){
    await expect.poll(()=>page.locator('.board-light-fixtures').evaluate(el=>el.getBoundingClientRect().top)).toBe(0)
  }
}
async function assertReadOnlyChrome(page:Page){
  for(const selector of ['.tool-palette','.history-controls','.selection-bar','.bottom-hint','[data-record-panel]','[data-decoration-panel]','.race-map-editor','.medal-exhibit-editor']){
    await expect(page.locator(selector)).toBeHidden()
  }
  await expect(button(page,'装饰样式')).toBeHidden()
  await expect(button(page,'打开收藏库')).toBeHidden()
  await expect(button(page,'修改收藏板名称')).toBeHidden()
  await expect(page.locator('.zoom-controls')).toBeVisible()
}

test('viewing hides editing controls, blocks editing shortcuts and preserves the existing undo history',async({page})=>{
  await openBoard(page)
  await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
  const original=await activeBoard(page)
  await item(page,'photo-a').click()
  await button(page,'向右旋转').click()
  await expect.poll(async()=>(await activeBoard(page)).items.find(memory=>memory.id==='photo-a')?.rotation).toBe(5)
  const edited=await activeBoard(page),geometry=await itemGeometry(page)
  await expect(button(page,'撤销')).toBeEnabled()
  await button(page,'关闭详情').click()
  await button(page,'打开收藏库').click()
  await expect(page.locator('[data-record-panel]')).toBeVisible()
  await enter(page);await assertReadOnlyChrome(page)
  await expect(page.locator('.memory.selected')).toHaveCount(0)
  await item(page,'photo-a').focus()
  for(const key of ['Delete','Backspace','c','ArrowUp','ArrowRight','Control+z','Control+Shift+z','Control+y'])await page.keyboard.press(key)
  await expect(page.locator('.board-viewport')).not.toHaveClass(/connect-mode/)
  await expect(page.locator('[data-board-item]')).toHaveCount(4)
  await expect(page.locator('[data-board-thread]')).toHaveCount(2)
  expect(await itemGeometry(page)).toEqual(geometry)
  expect(await activeBoard(page)).toEqual(edited)
  await page.locator('.board-viewport').click({button:'right',position:{x:12,y:180}})
  await expect(page.getByRole('menu',{name:'画布菜单'})).toHaveCount(0)
  await exit(page)
  await expect(button(page,'撤销')).toBeEnabled();await expect(button(page,'重做')).toBeDisabled()
  await button(page,'撤销').click()
  await expect.poll(()=>activeBoard(page)).toEqual(original)
  await expect(button(page,'撤销')).toBeDisabled();await expect(button(page,'重做')).toBeEnabled()
  await button(page,'重做').click()
  await expect.poll(()=>activeBoard(page)).toEqual(edited)
})

test('photo, demo medal and note previews are read-only dialogs; Escape closes the preview before leaving viewing',async({page})=>{
  await openBoard(page)
  const before=await activeBoard(page),editCamera=(await scene(page).getAttribute('style'))!
  await button(page,'装饰样式').click();await expect(page.locator('[data-decoration-panel]')).toBeVisible()
  await page.getByRole('switch',{name:'开启灯具与光照',exact:true}).click()
  await expect(shell(page)).toHaveAttribute('data-light','on')
  await enter(page);await assertReadOnlyChrome(page)
  for(const [id,title] of [['photo-a','云海照片'],['demo-medal','RIDGE 50K'],['note','清晨的山径记忆']]){
    await item(page,id).click()
    const preview=page.getByRole('dialog')
    await expect(preview).toBeVisible();await expect(preview).toContainText(title)
    await expect(preview.locator('input,textarea,select,[contenteditable="true"]')).toHaveCount(0)
    const close=preview.getByRole('button',{name:'关闭预览',exact:true})
    await expect(close).toBeVisible()
    for(let i=0;i<4;i++){
      await page.keyboard.press('Tab')
      await expect.poll(()=>preview.evaluate(el=>el.contains(document.activeElement))).toBe(true)
    }
    await close.click();await expect(preview).toHaveCount(0)
    await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
  }
  await item(page,'photo-b').focus();await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toContainText('林间终点')
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
  await expect(item(page,'photo-b')).toBeFocused()
  expect(await activeBoard(page)).toEqual(before)
  await page.keyboard.press('Escape');await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
  await expect(page.locator('.topbar')).toBeVisible()
  await expect(scene(page)).toHaveAttribute('style',editCamera)
  await expect(page.locator('.board-viewport')).toBeFocused()
  await expect(page.locator('[data-record-panel],[data-decoration-panel]')).toHaveCount(0)
})

test('enter and exit keep the current camera while viewing object drags and zoom stay usable',async({page},info)=>{
  await openBoard(page)
  await button(page,'放大').click()
  const viewport=(await page.locator('.board-viewport').boundingBox())!,x=viewport.x+viewport.width*.8,y=viewport.y+viewport.height*.65
  await page.mouse.move(x,y);await page.mouse.down({button:'middle'})
  await page.mouse.move(x-72,y+38,{steps:8});await page.mouse.up({button:'middle'})
  const editCamera=(await scene(page).getAttribute('style'))!,before=await activeBoard(page),geometry=await itemGeometry(page)
  await enter(page)
  await page.locator('.scene img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())))
  await page.screenshot({path:info.outputPath('desktop-viewing.png')})
  const initial=await camera(page)
  await mouseDrag(page,'photo-a',64,43)
  await expect.poll(async()=>(await camera(page)).x).toBeCloseTo(initial.x+64,1)
  await expect.poll(async()=>(await camera(page)).y).toBeCloseTo(initial.y+43,1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await itemGeometry(page)).toEqual(geometry)
  await button(page,'放大').click()
  await expect.poll(async()=>(await camera(page)).scale).toBeCloseTo(initial.scale*1.2,4)
  await button(page,'缩小').click()
  await expect.poll(async()=>(await camera(page)).scale).toBeCloseTo(initial.scale,4)
  expect(await activeBoard(page)).toEqual(before)
  const exitCamera=(await scene(page).getAttribute('style'))!
  expect(exitCamera).not.toBe(editCamera)
  await exit(page);await expect(scene(page)).toHaveAttribute('style',exitCamera)
  await expect(button(page,'撤销')).toBeDisabled()
})

test('season switching stays available in viewing and reload returns to editing without persisting viewing state',async({page},info)=>{
  await openBoard(page);await openYears(page)
  const before=await workspace(page),year=before.activeYear
  await enter(page)
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.setViewportSize({width:1280,height:720});await assertViewingLayout(page)
  await page.setViewportSize({width:844,height:390});await assertViewingLayout(page)
  await page.locator('.scene img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())))
  await page.screenshot({path:info.outputPath('desktop-viewing-compact.png')})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.setViewportSize({width:1440,height:1000});await assertViewingLayout(page)
  await openYears(page)
  await button(page,'上一年').click()
  await expect(shell(page)).toHaveAttribute('data-season',String(year-1))
  await expect(page.locator('.board-viewport')).not.toHaveAttribute('data-season-transition')
  await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await expect(page.locator('.empty-board .primary-button')).toBeHidden()
  await button(page,'下一年').click()
  await expect(shell(page)).toHaveAttribute('data-season',String(year))
  await expect(page.locator('.board-viewport')).not.toHaveAttribute('data-season-transition')
  await expect(page.locator('[data-board-item]')).toHaveCount(4)
  const saved=await workspace(page)
  expect(saved.seasons.map(season=>season.board)).toEqual(before.seasons.map(season=>season.board))
  expect(Object.keys(saved).sort()).toEqual(['activeYear','seasons','version'])
  for(const season of saved.seasons)expect(Object.keys(season).sort()).toEqual(season.view?['board','view','year']:['board','year'])
  await page.reload();await ready(page)
  await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
  await expect(await openViewingMenu(page)).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.locator('.tool-palette')).toBeVisible()
  expect(await activeBoard(page)).toEqual(before.seasons.find(season=>season.year===year)!.board)
})

test('unsaved editing blocks entering viewing and keeps the draft until it is saved',async({page})=>{
  await openBoard(page)
  const before=await activeBoard(page)
  await item(page,'note').press('Enter')
  const draft=page.getByRole('textbox',{name:'写下你的记忆',exact:true})
  await draft.fill('进入观赏之前保留的草稿')
  await (await openViewingMenu(page)).click()
  await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
  await expect(draft).toHaveValue('进入观赏之前保留的草稿')
  await expect(page.locator('.toast')).toContainText('请先保存或关闭编辑栏')
  expect(await activeBoard(page)).toEqual(before)
  await button(page,'保存修改').click()
  await expect.poll(async()=>(await activeBoard(page)).items.find(memory=>memory.id==='note')?.title).toBe('进入观赏之前保留的草稿')
  await enter(page);await item(page,'note').click()
  await expect(page.getByRole('dialog')).toContainText('进入观赏之前保留的草稿')
})

test('an edit drag prevents opening the viewing menu until the drag ends',async({page})=>{
  await openBoard(page)
  const box=(await item(page,'note').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+22,y+18,{steps:4})
  await page.locator('.board-viewport').dispatchEvent('contextmenu',{button:2,clientX:x+22,clientY:y+18})
  await expect(page.locator('.canvas-context-menu')).toHaveCount(0)
  await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
  await page.mouse.up()
  await expect(await openViewingMenu(page)).toBeEnabled()
})

test('canvas keyboard menu shortcuts enter viewing and restore canvas focus on exit',async({page})=>{
  await openBoard(page)
  for(const key of ['ContextMenu','Shift+F10']){
    await page.locator('.board-viewport').focus()
    await page.keyboard.press(key)
    const entry=page.getByRole('menuitem',{name:'进入观赏模式',exact:true})
    await expect(entry).toBeVisible();await entry.click()
    await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
    await expect(button(page,'退出观赏模式')).toBeFocused()
    await exit(page)
  }
})

test('all three languages translate viewing controls and previews without changing board content',async({page})=>{
  await openBoard(page)
  const before=await activeBoard(page)
  for(const label of labels){
    await changeLanguage(page,label.language)
    await expect(page.locator('html')).toHaveAttribute('lang',label.locale)
    await enter(page,label.enter)
    await expect(button(page,label.exit)).toBeVisible()
    await item(page,'photo-a').click()
    const preview=page.getByRole('dialog')
    await expect(preview).toContainText('云海照片')
    await preview.getByRole('button',{name:label.close,exact:true}).click()
    await exit(page,label.exit)
  }
  expect(await activeBoard(page)).toEqual(before)
})

const sendTouch=(cdp:CDPSession,type:string,points:{id:number;x:number;y:number}[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points})
async function touchDrag(cdp:CDPSession,x:number,y:number,dx:number,dy:number){
  await sendTouch(cdp,'touchStart',[{id:1,x,y}])
  for(let step=1;step<=8;step++)await sendTouch(cdp,'touchMove',[{id:1,x:x+dx*step/8,y:y+dy*step/8}])
  await sendTouch(cdp,'touchEnd',[])
}

test.describe('phone viewing',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1})
  for(const label of labels){
    test(`${label.locale}: tap previews, an object touch drag pans and narrow controls stay within the screen`,async({page,browserName},info)=>{
      test.skip(browserName!=='chromium','Native touch dispatch uses the same Chromium CDP path as mobile-gestures.spec.ts.')
      await openBoard(page);await changeLanguage(page,label.language)
      const before=await activeBoard(page),geometry=await itemGeometry(page),editCamera=(await scene(page).getAttribute('style'))!
      await (await openViewingMenu(page,label.enter,true)).tap();await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
      await expect(page.locator('.canvas-context-menu')).toHaveCount(0)
      await assertViewingLayout(page,label.exit)
      await expect(scene(page)).toHaveAttribute('style',editCamera)
      await openYears(page)
      const years=(await page.locator('.year-capsule').boundingBox())!,zoom=(await page.locator('.zoom-controls').boundingBox())!
      expect(years.y).toBeGreaterThanOrEqual(zoom.y+zoom.height+6)
      await expect(scene(page)).toHaveAttribute('style',editCamera)
      if(label.locale==='zh-CN')await page.screenshot({path:info.outputPath('mobile-viewing-season.png')})
      await page.locator('.year-capsule-collapse').tap();await expect(page.locator('.year-capsule')).toBeHidden()
      await expect(scene(page)).toHaveAttribute('style',editCamera)
      for(const selector of ['.tool-palette','.history-controls','.selection-bar','.bottom-hint'])await expect(page.locator(selector)).toBeHidden()
      await expect(button(page,label.exit)).toBeInViewport()
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
      await item(page,'photo-a').tap()
      const preview=page.getByRole('dialog')
      await expect(preview).toContainText('云海照片')
      await preview.locator('img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())))
      if(label.locale==='zh-CN')await page.screenshot({path:info.outputPath('mobile-viewing-preview.png')})
      const previewBounds=(await preview.boundingBox())!
      expect(previewBounds.x).toBeGreaterThanOrEqual(0)
      expect(previewBounds.x+previewBounds.width).toBeLessThanOrEqual(390)
      expect(previewBounds.y).toBeGreaterThanOrEqual(0)
      expect(previewBounds.y+previewBounds.height).toBeLessThanOrEqual(844)
      await preview.getByRole('button',{name:label.close,exact:true}).tap()
      await expect(preview).toHaveCount(0)
      const cdp=await page.context().newCDPSession(page),initial=await camera(page),box=(await item(page,'photo-a').boundingBox())!
      await touchDrag(cdp,box.x+box.width/2,box.y+box.height/2,35,28)
      await expect.poll(async()=>(await camera(page)).x).toBeCloseTo(initial.x+35,1)
      await expect.poll(async()=>(await camera(page)).y).toBeCloseTo(initial.y+28,1)
      await expect(preview).toHaveCount(0)
      expect(await itemGeometry(page)).toEqual(geometry)
      expect(await activeBoard(page)).toEqual(before)
      await page.setViewportSize({width:320,height:568})
      await assertViewingLayout(page,label.exit)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
      await item(page,'photo-a').tap();await expect(preview).toBeVisible()
      const compactBounds=(await preview.boundingBox())!
      expect(compactBounds.x).toBeGreaterThanOrEqual(0);expect(compactBounds.x+compactBounds.width).toBeLessThanOrEqual(320)
      expect(compactBounds.y).toBeGreaterThanOrEqual(0);expect(compactBounds.y+compactBounds.height).toBeLessThanOrEqual(568)
      await preview.getByRole('button',{name:label.close,exact:true}).tap()
      const exitCamera=(await scene(page).getAttribute('style'))!
      await button(page,label.exit).tap();await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
      await expect(page.locator('.topbar')).toBeVisible()
      await expect(page.locator('.board-viewport')).toBeFocused()
      await expect(scene(page)).toHaveAttribute('style',exitCamera)
      await cdp.detach()
    })
  }
})
