import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'
import type {Board} from '../../src/domain/model'

const legacyBoard:Board={
  title:'Current season memories',backgroundStyle:'kraft',decorations:{pin:'brass',tape:'classic',thread:'classic'},
  items:[
    {id:'current-a',kind:'note',title:'Current trail A',variant:'paper',x:250,y:220,w:160,h:150,rotation:0},
    {id:'current-b',kind:'note',title:'Current trail B',variant:'paper',x:650,y:360,w:160,h:150,rotation:4,locked:true},
  ],
  threads:[{id:'current-thread',from:'current-a',to:'current-b',curvature:.12}],
}

async function ready(page:Page){
  await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.board-title')).toBeVisible()
}
async function openBoard(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(seed=>{
    if(!localStorage.getItem('racememoir-season-workspace-v1')&&!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify(seed))
  },legacyBoard)
  await page.goto('/');await ready(page)
  return page.evaluate(()=>new Date().getFullYear())
}
const activeBoard=(page:Page):Promise<Board>=>page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-board-v1')!))
const title=(page:Page)=>page.locator('.board-name .board-title')
const capsule=(page:Page)=>page.locator('.year-capsule')
const trigger=(page:Page)=>capsule(page).locator('.year-capsule-trigger')
const note=(page:Page,name:string)=>page.locator('[data-board-item]').getByText(name,{exact:true})
async function openYears(page:Page){
  if(!await capsule(page).isVisible())await page.locator('.board-actions > .board-action-calendar').click()
  await expect(capsule(page)).toBeVisible()
}
async function selectSeason(page:Page,year:number){
  await openYears(page);await trigger(page).click()
  await page.locator('.year-capsule-menu').getByRole('menuitemradio',{name:String(year),exact:true}).click()
  await expect(trigger(page)).toContainText(String(year))
  await expect(page.locator('.board-viewport')).not.toHaveAttribute('data-season-transition')
}
const previous=(page:Page)=>capsule(page).getByRole('button',{name:'上一年',exact:true}).click()
const next=(page:Page)=>capsule(page).getByRole('button',{name:'下一年',exact:true}).click()
async function rename(page:Page,name:string){
  await page.getByRole('button',{name:'修改收藏板名称',exact:true}).click()
  await page.getByRole('textbox',{name:'收藏板名称',exact:true}).fill(name)
  await page.getByRole('textbox',{name:'收藏板名称',exact:true}).press('Enter')
}
async function addNote(page:Page,name:string){
  await page.getByRole('button',{name:'添加便签',exact:true}).click()
  await page.getByRole('textbox',{name:'写下你的记忆',exact:true}).fill(name)
  await page.getByRole('button',{name:'放上收藏板',exact:true}).click()
}
async function chooseBackground(page:Page,label:string){
  await page.getByRole('button',{name:'装饰样式',exact:true}).click()
  await page.locator('[data-decoration-panel] .background-options').getByRole('button',{name:label,exact:true}).click()
  await page.getByRole('button',{name:'关闭装饰样式',exact:true}).click()
}

test('legacy board migrates intact into the current season and the previous season starts empty',async({page})=>{
  const year=await openBoard(page)
  await expect(title(page)).toHaveText(legacyBoard.title)
  await expect(page.locator('[data-board-item]')).toHaveCount(2)
  await expect(page.locator('[data-board-thread]')).toHaveCount(1)
  await expect.poll(()=>activeBoard(page)).toEqual(legacyBoard)
  await expect.poll(()=>page.evaluate(()=>!!localStorage.getItem('racememoir-season-workspace-v1'))).toBe(true)
  await selectSeason(page,year-1)
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await expect(page.locator('[data-board-thread]')).toHaveCount(0)
  await expect(page.locator('.empty-board')).toBeVisible()
  await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled()
  await expect.poll(async()=>(await activeBoard(page)).items).toEqual([])
  await selectSeason(page,year)
  await expect.poll(()=>activeBoard(page)).toEqual(legacyBoard)
  await expect(page.locator('[data-board-item=current-b]')).toHaveClass(/is-locked/)
})

test('rename, add and drag followed by an immediate season switch keep the latest changes',async({page})=>{
  const year=await openBoard(page);await openYears(page)
  await page.getByRole('button',{name:'修改收藏板名称',exact:true}).click()
  await page.getByRole('textbox',{name:'收藏板名称',exact:true}).fill('Just renamed current')
  // Clicking the arrow commits the input blur and changes season in the same interaction.
  await previous(page);await expect(trigger(page)).toContainText(String(year-1))
  await next(page);await expect(title(page)).toHaveText('Just renamed current')
  await addNote(page,'Just added current')
  // Deliberately do not wait for the debounced board save before leaving.
  await previous(page);await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await next(page);await expect(note(page,'Just added current')).toBeVisible()
  // Physical dragging starts after the visual switch releases the canvas.
  await expect(page.locator('.board-viewport')).not.toHaveAttribute('data-season-transition')
  const item=page.locator('[data-board-item=current-a]'),before=await item.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}))
  const box=(await item.boundingBox())!
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
  await page.mouse.down();await page.mouse.move(box.x+box.width/2+96,box.y+box.height/2+58,{steps:8});await page.mouse.up()
  await previous(page);await next(page)
  const after=await item.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}))
  expect(after.x-before.x).toBeGreaterThan(20);expect(after.y-before.y).toBeGreaterThan(10)
  await expect(title(page)).toHaveText('Just renamed current');await expect(note(page,'Just added current')).toBeVisible()
  await expect.poll(async()=>(await activeBoard(page)).items.find(i=>i.id==='current-a')).toMatchObject(after)
})

test('each season retains its own undo and redo history when switching back and forth',async({page})=>{
  const year=await openBoard(page);await openYears(page)
  await addNote(page,'Current undo note');await previous(page)
  const undo=page.getByRole('button',{name:'撤销',exact:true}),redo=page.getByRole('button',{name:'重做',exact:true})
  await expect(undo).toBeDisabled();await expect(redo).toBeDisabled()
  await addNote(page,'Previous undo note');await next(page)
  await expect(note(page,'Current undo note')).toBeVisible();await expect(note(page,'Previous undo note')).toHaveCount(0)
  await expect(undo).toBeEnabled();await undo.click()
  await expect(page.locator('[data-board-item]')).toHaveCount(2)
  await expect(page.locator('[data-board-thread]')).toHaveCount(1)
  await expect(undo).toBeDisabled();await expect(redo).toBeEnabled()
  await previous(page);await expect(trigger(page)).toContainText(String(year-1))
  await expect(note(page,'Previous undo note')).toBeVisible();await expect(undo).toBeEnabled();await expect(redo).toBeDisabled()
  await undo.click();await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await expect(undo).toBeDisabled();await expect(redo).toBeEnabled()
  await redo.click();await expect(note(page,'Previous undo note')).toBeVisible()
  await next(page);await expect(undo).toBeDisabled();await expect(redo).toBeEnabled()
  await redo.click();await expect(note(page,'Current undo note')).toBeVisible()
  await expect(note(page,'Previous undo note')).toHaveCount(0)
})

test('previous-season title, material, objects and threads are independent and reload restores the last season',async({page},info)=>{
  const year=await openBoard(page);await selectSeason(page,year-1)
  await rename(page,'Previous season board');await chooseBackground(page,'黑板')
  await addNote(page,'Previous trail A');await addNote(page,'Previous trail B')
  await page.getByRole('button',{name:'添加连线',exact:true}).click()
  // Keyboard activation targets the exact objects even when two new notes overlap.
  await page.getByRole('button',{name:'便签：Previous trail A',exact:true}).press('Enter')
  await page.getByRole('button',{name:'便签：Previous trail B',exact:true}).press('Enter')
  await page.getByRole('button',{name:'选择',exact:true}).click()
  await expect(page.locator('[data-board-thread]')).toHaveCount(1)
  await expect.poll(async()=>{
    const board=await activeBoard(page)
    return {title:board.title,background:board.backgroundStyle,items:board.items.map(i=>i.title),threads:board.threads.length}
  }).toEqual({title:'Previous season board',background:'chalkboard',items:['Previous trail A','Previous trail B'],threads:1})
  const savedPrevious=await activeBoard(page)
  await selectSeason(page,year);await expect.poll(()=>activeBoard(page)).toEqual(legacyBoard)
  await expect(note(page,'Previous trail A')).toHaveCount(0)
  await selectSeason(page,year-1);await expect.poll(()=>activeBoard(page)).toEqual(savedPrevious)
  await page.reload();await ready(page)
  await expect(title(page)).toHaveText('Previous season board')
  await expect.poll(()=>activeBoard(page)).toEqual(savedPrevious)
  await openYears(page);await expect(trigger(page)).toContainText(String(year-1))
  await trigger(page).click();await expect(page.getByRole('menuitemradio',{name:String(year-1),exact:true})).toHaveAttribute('aria-checked','true')
  await page.keyboard.press('Escape')
  await page.screenshot({path:info.outputPath('previous-season-restored.png')})
  await selectSeason(page,year);await expect.poll(()=>activeBoard(page)).toEqual(legacyBoard)
})

test('a single-board ZIP replaces only the selected season and leaves the other season intact',async({page},info)=>{
  const year=await openBoard(page);await selectSeason(page,year-1)
  await rename(page,'ZIP previous board');await addNote(page,'ZIP previous note')
  await expect.poll(async()=>(await activeBoard(page)).items.map(i=>i.title)).toEqual(['ZIP previous note'])
  const exportedPrevious=await activeBoard(page)
  await page.locator('.share-button').click()
  const download=page.waitForEvent('download');await page.locator('.export-option').nth(1).click()
  const zip=info.outputPath('single-season.zip');await(await download).saveAs(zip)
  await expect(page.locator('.file-operation-floating')).toBeHidden()
  await selectSeason(page,year);await addNote(page,'Replaced current note')
  await page.locator('input[accept^=".zip"]').setInputFiles(zip)
  await expect(title(page)).toHaveText('ZIP previous board')
  await expect(page.locator('.file-operation-floating')).toBeHidden()
  await expect(trigger(page)).toContainText(String(year))
  await expect.poll(()=>activeBoard(page)).toEqual(exportedPrevious)
  await expect(note(page,'Replaced current note')).toHaveCount(0)
  await selectSeason(page,year-1);await expect.poll(()=>activeBoard(page)).toEqual(exportedPrevious)
  await addNote(page,'Other season still editable');await selectSeason(page,year)
  await expect.poll(()=>activeBoard(page)).toEqual(exportedPrevious)
  await page.reload();await ready(page);await openYears(page)
  await expect(trigger(page)).toContainText(String(year));await expect.poll(()=>activeBoard(page)).toEqual(exportedPrevious)
})

test('shared records can be reused across seasons and recycle deletion protects references in the inactive season',async({page})=>{
  const year=await openBoard(page)
  await page.evaluate(async()=>{
    const {putRecords}=await import('/src/persistence/recordStore.ts')
    const image=await(await fetch('/images/mountain.jpg')).blob()
    await putRecords([
      {id:'shared-season-photo',kind:'photo',name:'Shared season photo',note:'',source:'upload',image},
      {id:'unused-season-photo',kind:'photo',name:'Unused season photo',note:'',source:'upload',archived:true,image},
    ])
  })
  await page.reload();await ready(page);await openYears(page)
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await page.getByRole('button',{name:'将 Shared season photo 放上画布',exact:true}).click()
  await expect.poll(async()=>(await activeBoard(page)).items.filter(i=>i.recordId==='shared-season-photo').length).toBe(1)
  await selectSeason(page,year-1)
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await page.getByRole('button',{name:'将 Shared season photo 放上画布',exact:true}).click()
  await expect.poll(async()=>(await activeBoard(page)).items.map(i=>i.recordId)).toEqual(['shared-season-photo'])
  await expect(page.getByRole('button',{name:'查看 Shared season photo',exact:true})).toContainText('画布上 2 件')
  await selectSeason(page,year)
  const photo=page.getByRole('button',{name:'照片：Shared season photo',exact:true})
  await photo.press('Enter');await photo.press('Delete');await expect(photo).toHaveCount(0)
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await page.getByRole('button',{name:'删除 Shared season photo',exact:true}).click()
  await page.getByRole('button',{name:/查看回收站/}).click()
  await expect(page.getByRole('button',{name:'彻底删除 Shared season photo',exact:true})).toBeDisabled()
  await expect(page.getByRole('button',{name:'查看 Shared season photo',exact:true})).toContainText('画布上 1 件')
  await page.getByRole('button',{name:'清空回收站',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'清空回收站？'})
  await expect(dialog).toContainText('1 份闲置收藏及原文件')
  await expect(dialog).toContainText('使用中的 1 份收藏保留')
  await dialog.getByRole('button',{name:'确认清空',exact:true}).click()
  await expect(page.getByRole('button',{name:'查看 Unused season photo',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'彻底删除 Shared season photo',exact:true})).toBeDisabled()
  expect(await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    return (await readRecords()).map((r:{id:string})=>r.id)
  })).toEqual(['shared-season-photo'])
  await selectSeason(page,year-1);await expect(page.getByRole('button',{name:'照片：Shared season photo',exact:true})).toBeVisible()
  await page.reload();await ready(page);await openYears(page)
  await expect(trigger(page)).toContainText(String(year-1))
  await expect.poll(async()=>(await activeBoard(page)).items.map(i=>i.recordId)).toEqual(['shared-season-photo'])
})

test('camera views keep separate zoom and pan for each season across switches and reload',async({page},info)=>{
  const year=await openBoard(page);await openYears(page)
  const scene=page.locator('.scene')
  const changeView=async(zoom:'放大'|'缩小',dx:number,dy:number)=>{
    const before=await scene.getAttribute('style')
    await page.getByRole('button',{name:zoom,exact:true}).click()
    const box=(await page.locator('.board-viewport').boundingBox())!
    const x=box.x+box.width*.6,y=box.y+box.height*.65
    await page.mouse.move(x,y);await page.mouse.down({button:'middle'})
    await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up({button:'middle'})
    await expect(scene).not.toHaveAttribute('style',before!)
    return (await scene.getAttribute('style'))!
  }
  const currentView=await changeView('放大',87,43)
  await previous(page)
  const previousView=await changeView('缩小',-64,81)
  expect(previousView).not.toBe(currentView)
  await next(page);await expect(scene).toHaveAttribute('style',currentView)
  await previous(page);await expect(scene).toHaveAttribute('style',previousView)
  await page.reload();await ready(page);await openYears(page)
  await expect(trigger(page)).toContainText(String(year-1));await expect(scene).toHaveAttribute('style',previousView)
  await page.screenshot({path:info.outputPath('previous-season-camera-restored.png')})
  await next(page);await expect(scene).toHaveAttribute('style',currentView)
  await page.reload();await ready(page);await openYears(page)
  await expect(trigger(page)).toContainText(String(year));await expect(scene).toHaveAttribute('style',currentView)
})

test('unsaved note draft and failed workspace writes keep the active season until saving is possible',async({page},info)=>{
  const year=await openBoard(page);await openYears(page)
  await page.locator('[data-board-item=current-a]').press('Enter')
  const draft=page.getByRole('textbox',{name:'写下你的记忆',exact:true})
  await draft.fill('Draft kept before switching')
  await previous(page)
  await expect(trigger(page)).toContainText(String(year))
  await expect(page.locator('.app-shell')).toHaveAttribute('data-season',String(year))
  await expect(draft).toHaveValue('Draft kept before switching')
  await expect(page.locator('.toast')).toHaveText('请先保存或关闭编辑栏，再切换赛季。')
  await expect(note(page,'Current trail A')).toBeVisible()
  await page.screenshot({path:info.outputPath('unsaved-draft-stays-in-season.png')})
  await page.getByRole('button',{name:'保存修改',exact:true}).click()
  await previous(page);await expect(trigger(page)).toContainText(String(year-1))
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await next(page);await expect(note(page,'Draft kept before switching')).toBeVisible()
  const beforeFailure=await page.evaluate(()=>localStorage.getItem('racememoir-season-workspace-v1'))
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem
    Storage.prototype.setItem=function(key:string,value:string){
      if(key==='racememoir-season-workspace-v1'&&document.documentElement.dataset.seasonStorageFault==='true')throw new DOMException('Injected season write failure','QuotaExceededError')
      return original.call(this,key,value)
    }
    document.documentElement.dataset.seasonStorageFault='true'
  })
  await previous(page)
  await expect(trigger(page)).toContainText(String(year))
  await expect(page.locator('.app-shell')).toHaveAttribute('data-season',String(year))
  await expect(note(page,'Draft kept before switching')).toBeVisible()
  await expect(page.locator('.toast')).toHaveText('当前赛季保存失败，未切换画布。请重试保存。')
  expect(await page.evaluate(()=>localStorage.getItem('racememoir-season-workspace-v1'))).toBe(beforeFailure)
  await page.screenshot({path:info.outputPath('failed-season-save-stays-in-season.png')})
  await page.evaluate(()=>{delete document.documentElement.dataset.seasonStorageFault})
  await previous(page);await expect(trigger(page)).toContainText(String(year-1))
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await next(page);await expect(note(page,'Draft kept before switching')).toBeVisible()
  await page.reload();await ready(page);await openYears(page)
  await expect(trigger(page)).toContainText(String(year));await expect(note(page,'Draft kept before switching')).toBeVisible()
})
