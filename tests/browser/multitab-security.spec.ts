import {test,expect} from '@playwright/test'
import type {Locator,Page,Route} from '@playwright/test'
import {strFromU8,unzipSync} from 'fflate'
import type {Board} from '../../src/domain/model'
import type {SeasonWorkspace} from '../../src/persistence/seasonStore'
import zh from '../../src/i18n/locales/zh-CN.json' with {type:'json'}
import en from '../../src/i18n/locales/en.json' with {type:'json'}
import ja from '../../src/i18n/locales/ja.json' with {type:'json'}

const ORIGIN='http://127.0.0.1:5187'
const WORKSPACE='racememoir-season-workspace-v1',BOARD='racememoir-board-v1'
const YEAR=2042,MEDAL='multitab-demo-medal',TRASH='multitab-archived-medal'
const MEDAL_NAME='双标签测试奖牌',TRASH_NAME='双标签回收站奖牌'
const seedBoard:Board={
 title:'双标签合成收藏板',backgroundStyle:'kraft',
 items:[{id:'multitab-seed-note',kind:'note',title:'合成初始便签',variant:'paper',x:300,y:240,w:160,h:150,rotation:0}],
 threads:[],
}
const seedWorkspace:SeasonWorkspace={version:1,activeYear:YEAR,revision:'multitab-fixture',seasons:[
 {year:YEAR,board:seedBoard},
 {year:YEAR-1,board:{title:'合成上一赛季',items:[],threads:[]}},
]}

test.use({baseURL:ORIGIN})

async function ready(page:Page){
 await expect(page).toHaveURL(new RegExp('^'+ORIGIN.replaceAll('.','\\.')+'/'))
 await expect(page.locator('.app-shell')).toBeVisible()
 await page.locator('.records-loading').waitFor({state:'hidden'})
 await expect(page.locator('[data-board-item=multitab-seed-note]')).toBeVisible()
 // Include the real startup debounce before comparing the shared storage sources.
 await page.waitForTimeout(500)
}

async function openSeed(page:Page){
 await page.emulateMedia({reducedMotion:'reduce'})
 // Start with an inert document so IndexedDB and both save sources exist before
 // App acquires its writer lease. This context contains only synthetic fixtures.
 const shell=(route:Route)=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Multitab synthetic fixture</title>'})
 await page.route(`${ORIGIN}/`,shell)
 await page.goto(`${ORIGIN}/`)
 await page.evaluate(async({origin,workspaceKey,boardKey,workspace,board,medalId,trashId,medalName,trashName})=>{
  if(location.origin!==origin)throw new Error('Refusing to seed a non-test origin')
  localStorage.setItem('racememoir-language','zh-CN')
  localStorage.setItem(workspaceKey,JSON.stringify(workspace))
  localStorage.setItem(boardKey,JSON.stringify(board))
  const {putRecords}=await import('/src/persistence/recordStore.ts')
  await putRecords([
   {id:medalId,kind:'medal',name:medalName,date:'2042-05-01',note:'合成素材原备注',source:'demo',cutout:'original',variant:'bronze'},
   {id:trashId,kind:'medal',name:trashName,date:'2041-04-01',note:'合成回收站原备注',source:'demo',cutout:'original',variant:'silver',archived:true},
  ])
 },{origin:ORIGIN,workspaceKey:WORKSPACE,boardKey:BOARD,workspace:seedWorkspace,board:seedBoard,medalId:MEDAL,trashId:TRASH,medalName:MEDAL_NAME,trashName:TRASH_NAME})
 await page.unroute(`${ORIGIN}/`,shell)
 await page.reload();await ready(page)
 await expect(page.locator('.save-status')).toContainText('已保存到本机')
}

const banner=(page:Page)=>page.locator('.save-conflict-banner')
const shell=(page:Page)=>page.locator('.app-shell')
const scene=(page:Page)=>page.locator('.scene')
const toast=(page:Page)=>page.locator('.toast')
const title=(page:Page)=>page.locator('.board-name .board-title')
const note=(page:Page,name:string)=>page.locator('[data-board-item]').getByText(name,{exact:true})
const sources=(page:Page)=>page.evaluate(({workspace,board})=>({workspace:localStorage.getItem(workspace),board:localStorage.getItem(board)}),{workspace:WORKSPACE,board:BOARD})
const activeBoard=(page:Page):Promise<Board>=>page.evaluate(key=>{
 const workspace=JSON.parse(localStorage.getItem(key)!)
 return workspace.seasons.find((season:{year:number})=>season.year===workspace.activeYear).board
},WORKSPACE)
const records=(page:Page)=>page.evaluate(async()=>{
 const {readRecords}=await import('/src/persistence/recordStore.ts')
 return (await readRecords()).map(record=>({id:record.id,kind:record.kind,name:record.name,note:record.note,source:record.source,archived:!!record.archived})).sort((a,b)=>a.id.localeCompare(b.id))
})

async function rename(page:Page,name:string){
 await page.getByRole('button',{name:'修改收藏板名称',exact:true}).click()
 const input=page.getByRole('textbox',{name:'收藏板名称',exact:true})
 await input.fill(name);await input.press('Enter')
 await expect(title(page)).toHaveText(name)
}
async function addNote(page:Page,name:string){
 await page.getByRole('button',{name:'添加便签',exact:true}).click()
 await page.getByRole('textbox',{name:'写下你的记忆',exact:true}).fill(name)
 await page.getByRole('button',{name:'放上收藏板',exact:true}).click()
 await expect(note(page,name)).toBeVisible()
}
async function openLibrary(page:Page){await page.getByRole('button',{name:'打开收藏库',exact:true}).click()}
async function closeLibrary(page:Page){await page.locator('.record-heading > button').last().click()}

async function enterViewing(page:Page){
 await page.locator('.board-viewport').click({button:'right',position:{x:12,y:180}})
 await page.getByRole('menuitem',{name:zh['viewing.enter'],exact:true}).click()
 await assertReaderViewing(page)
}

async function assertReaderViewing(page:Page,exitName:string=zh['viewing.exit']){
 await expect(shell(page)).toHaveClass(/\bis-viewing\b/)
 for(const selector of ['.topbar','.tool-palette','.history-controls','.selection-bar','.bottom-hint','[data-record-panel]','[data-decoration-panel]'])await expect(page.locator(selector)).toBeHidden()
 await expect(page.getByRole('button',{name:exitName,exact:true})).toBeInViewport()
 await expect(banner(page)).toBeHidden()
}

async function editMedalName(page:Page,name:string){
 await openLibrary(page)
 await page.getByRole('button',{name:`查看 ${MEDAL_NAME}`,exact:true}).click()
 await page.locator('.record-scroll form input[maxlength="200"]').fill(name)
 await page.getByRole('button',{name:'保存修改',exact:true}).click()
 await expect.poll(()=>records(page)).toEqual(expect.arrayContaining([expect.objectContaining({id:MEDAL,name})]))
 if(await page.locator('[data-record-panel]').isVisible())await closeLibrary(page)
}

async function rejectOrDisable(page:Page,action:Locator){
 await expect(action).toBeVisible()
 if(await action.isDisabled()){await expect(action).toBeDisabled();return}
 await action.click()
 await expect(page.locator('.record-error').first()).toBeVisible()
}
async function attemptPermanentDelete(page:Page){
 const remove=page.getByRole('button',{name:`彻底删除 ${TRASH_NAME}`,exact:true})
 await expect(remove).toBeVisible()
 if(await remove.isDisabled()){await expect(remove).toBeDisabled();return}
 await remove.click()
 await rejectOrDisable(page,page.locator('.record-delete-confirm').getByRole('button',{name:'确认彻底删除',exact:true}))
}
async function lifecycleFlushes(page:Page){
 await page.evaluate(()=>{
  window.dispatchEvent(new PageTransitionEvent('pagehide'))
  const original=Object.getOwnPropertyDescriptor(document,'hidden')
  Object.defineProperty(document,'hidden',{configurable:true,value:true})
  try{document.dispatchEvent(new Event('visibilitychange'))}
  finally{if(original)Object.defineProperty(document,'hidden',original);else Reflect.deleteProperty(document,'hidden')}
 })
}

test('a second page enters viewing and can claim editing with fresh board and materials after the writer closes',async({page,context})=>{
 await openSeed(page)
 await rename(page,'主页面保存的收藏板');await addNote(page,'主页面保存的便签')
 await expect.poll(()=>activeBoard(page)).toMatchObject({title:'主页面保存的收藏板',items:expect.arrayContaining([expect.objectContaining({title:'主页面保存的便签'})])})
 const reader=await context.newPage()
 await reader.emulateMedia({reducedMotion:'reduce'});await reader.goto(`${ORIGIN}/`);await ready(reader)
 await assertReaderViewing(reader)
 await expect(toast(reader)).toHaveText(zh['saveConflict.viewOnly'])
 const savedSources=await sources(page),savedRecords=await records(page)
 // Viewing is also protected from keyboard deletion and stale lifecycle saves.
 const initialNote=reader.locator('[data-board-item=multitab-seed-note]')
 await initialNote.press('Enter');await initialNote.press('Delete')
 await reader.getByRole('button',{name:zh['viewing.closePreview'],exact:true}).click()
 await expect(note(reader,'合成初始便签')).toBeVisible()
 await reader.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(toast(reader)).toHaveText(zh['saveConflict.busy'])
 await assertReaderViewing(reader)
 await reader.locator('.board-viewport').focus();await reader.keyboard.press('Escape')
 await expect(toast(reader)).toHaveText(zh['saveConflict.busy'])
 await assertReaderViewing(reader)
 await lifecycleFlushes(reader)
 expect(await sources(reader)).toEqual(savedSources)
 expect(await records(reader)).toEqual(savedRecords)
 await expect(title(page)).toHaveText('主页面保存的收藏板')
 await expect(note(page,'主页面保存的便签')).toBeVisible()
 await expect(banner(page)).toBeHidden()
 // Rejected claims must not revoke the writer's lease. Its later changes must
 // replace the reader's stale board and IndexedDB snapshot on takeover.
 await rename(page,'主页面仍能继续保存')
 await addNote(page,'只读页面打开后新增的便签')
 const latestMedalName='只读页面打开后修改的奖牌名称'
 await editMedalName(page,latestMedalName)
 await expect.poll(async()=>(await activeBoard(page)).title).toBe('主页面仍能继续保存')
 const latestRecords=await records(page)
 const initialCamera=(await scene(reader).getAttribute('style'))!
 await reader.getByRole('button',{name:'放大',exact:true}).click()
 const claimedCamera=(await scene(reader).getAttribute('style'))!
 expect(claimedCamera).not.toBe(initialCamera)
 const documentId=await reader.evaluate(()=>{
  const marker=crypto.randomUUID();document.documentElement.dataset.multitabDocument=marker;return marker
 })
 await page.close()
 await reader.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(shell(reader)).not.toHaveClass(/\bis-viewing\b/)
 await expect(toast(reader)).toHaveText(zh['saveConflict.acquired'])
 expect(await reader.locator('html').getAttribute('data-multitab-document')).toBe(documentId)
 await expect(scene(reader)).toHaveAttribute('style',claimedCamera)
 await expect(banner(reader)).toBeHidden()
 await expect(title(reader)).toHaveText('主页面仍能继续保存')
 await expect(note(reader,'只读页面打开后新增的便签')).toBeVisible()
 await openLibrary(reader)
 await expect(reader.getByRole('button',{name:`查看 ${latestMedalName}`,exact:true})).toBeVisible()
 await expect(reader.getByRole('button',{name:`查看 ${MEDAL_NAME}`,exact:true})).toHaveCount(0)
 await closeLibrary(reader)
 await expect(reader.getByRole('button',{name:'修改收藏板名称',exact:true})).toBeEnabled()
 await rename(reader,'移交后保存的收藏板');await addNote(reader,'移交后保存的便签')
 await expect.poll(()=>activeBoard(reader)).toMatchObject({title:'移交后保存的收藏板',items:expect.arrayContaining([expect.objectContaining({title:'移交后保存的便签'})])})
 await expect(reader.locator('.save-status')).toContainText('已保存到本机')
 expect(await records(reader)).toEqual(latestRecords)
})

test('entering viewing saves pending edits and hands the lease between two pages that remain open',async({page,context})=>{
 await openSeed(page)
 const reader=await context.newPage();await reader.emulateMedia({reducedMotion:'reduce'})
 await reader.goto(`${ORIGIN}/`);await ready(reader);await assertReaderViewing(reader)
 const firstNote='原编辑页进入观赏前的便签'
 await rename(page,'原编辑页移交前的收藏板')
 await addNote(page,firstNote)
 const writerCamera=(await scene(page).getAttribute('style'))!
 // Do not wait for the debounce or a saved-status update: entering viewing must
 // flush the current board before it releases the writer lease.
 await enterViewing(page)
 await expect(scene(page)).toHaveAttribute('style',writerCamera)
 expect(await activeBoard(page)).toMatchObject({title:'原编辑页移交前的收藏板',items:expect.arrayContaining([expect.objectContaining({title:firstNote})])})
 await reader.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(shell(reader)).not.toHaveClass(/\bis-viewing\b/)
 await expect(toast(reader)).toHaveText(zh['saveConflict.acquired'])
 await expect(title(reader)).toHaveText('原编辑页移交前的收藏板')
 await expect(note(reader,firstNote)).toBeVisible()
 const readerNote='接管页面新增的便签'
 await rename(reader,'接管页面最新收藏板')
 await addNote(reader,readerNote)
 await expect.poll(()=>activeBoard(reader)).toMatchObject({title:'接管页面最新收藏板',items:expect.arrayContaining([expect.objectContaining({title:firstNote}),expect.objectContaining({title:readerNote})])})
 const latestSources=await sources(reader),latestRecords=await records(reader)
 // The original page stays open and has a stale local board. A rejected exit
 // must neither overwrite the current writer nor silently turn editing on.
 await page.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(toast(page)).toHaveText(zh['saveConflict.busy'])
 await assertReaderViewing(page)
 await lifecycleFlushes(page)
 expect(await sources(page)).toEqual(latestSources)
 expect(await records(page)).toEqual(latestRecords)
 await page.getByRole('button',{name:'放大',exact:true}).click()
 const reclaimCamera=(await scene(page).getAttribute('style'))!
 const finalNote='第二次移交前立即添加的便签'
 await addNote(reader,finalNote)
 await enterViewing(reader)
 await page.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
 await expect(toast(page)).toHaveText(zh['saveConflict.acquired'])
 await expect(scene(page)).toHaveAttribute('style',reclaimCamera)
 await expect(title(page)).toHaveText('接管页面最新收藏板')
 for(const text of [firstNote,readerNote,finalNote])await expect(note(page,text)).toBeVisible()
 await rename(page,'原页面重新获得编辑权')
 await expect.poll(async()=>(await activeBoard(page)).title).toBe('原页面重新获得编辑权')
 await assertReaderViewing(reader)
 expect(await records(page)).toEqual(latestRecords)
})

test('a failed save before entering viewing keeps the editor and its writer lease',async({page,context})=>{
 await openSeed(page)
 const reader=await context.newPage();await reader.emulateMedia({reducedMotion:'reduce'})
 await reader.goto(`${ORIGIN}/`);await ready(reader);await assertReaderViewing(reader)
 const savedSources=await sources(page),savedRecords=await records(page)
 await page.evaluate(key=>{
  const set=Storage.prototype.setItem
  document.documentElement.dataset.multitabSaveFault='true'
  Storage.prototype.setItem=function(name,value){
   if(this===localStorage&&name===key&&document.documentElement.dataset.multitabSaveFault==='true')throw new DOMException('Injected viewing handoff save failure','QuotaExceededError')
   return set.call(this,name,value)
  }
 },WORKSPACE)
 const localNote='进入观赏保存失败时保留的便签'
 await addNote(page,localNote)
 await page.locator('.board-viewport').click({button:'right',position:{x:12,y:180}})
 await page.getByRole('menuitem',{name:zh['viewing.enter'],exact:true}).click()
 await expect(shell(page)).not.toHaveClass(/\bis-viewing\b/)
 await expect(page.locator('.topbar')).toBeVisible()
 await expect(page.locator('.tool-palette')).toBeVisible()
 await expect(page.locator('.save-failure-banner')).toBeVisible()
 await expect(note(page,localNote)).toBeVisible()
 expect(await sources(page)).toEqual(savedSources)
 expect(await records(page)).toEqual(savedRecords)
 await reader.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(toast(reader)).toHaveText(zh['saveConflict.busy'])
 await assertReaderViewing(reader)
 // Removing the fault lets the same local edits be saved and handed over; the
 // reader then sees them, rather than the snapshot from before the failed save.
 await page.evaluate(()=>{delete document.documentElement.dataset.multitabSaveFault})
 await enterViewing(page)
 await reader.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(shell(reader)).not.toHaveClass(/\bis-viewing\b/)
 await expect(note(reader,localNote)).toBeVisible()
 expect((await activeBoard(reader)).items).toEqual(expect.arrayContaining([expect.objectContaining({title:localNote})]))
 expect(await records(reader)).toEqual(savedRecords)
})

test('an external snapshot change preserves local contents for export and prevents deleting newly referenced files',async({page,context})=>{
 await openSeed(page)
 const other=await context.newPage();await other.goto(`${ORIGIN}/`);await ready(other)
 await assertReaderViewing(other)
 // Hold a real local board change in memory without winning a timing race against
 // the 450 ms autosave. The injection affects only the writer's JavaScript realm.
 await page.evaluate(key=>{
  const set=Storage.prototype.setItem
  document.documentElement.dataset.multitabSaveFault='true'
  Storage.prototype.setItem=function(name,value){
   if(this===localStorage&&name===key&&document.documentElement.dataset.multitabSaveFault==='true')throw new DOMException('Injected multitab save failure','QuotaExceededError')
   return set.call(this,name,value)
  }
 },WORKSPACE)
 const localNote='尚未保存但可导出的本地便签'
 await addNote(page,localNote)
 await expect(page.locator('.save-failure-banner')).toBeVisible()
 expect((await activeBoard(page)).items.some(item=>item.title===localNote)).toBe(false)
 const originalRecords=await records(page)
 await openLibrary(page);await page.getByRole('button',{name:/查看回收站/}).click()
 const oldDelete=page.getByRole('button',{name:`彻底删除 ${TRASH_NAME}`,exact:true})
 await expect(oldDelete).toBeEnabled()
 const external=await other.evaluate(({workspaceKey,boardKey,trashId,trashName})=>{
  const raw=localStorage.getItem(workspaceKey)!,workspace=JSON.parse(raw)
  const active=workspace.seasons.find((season:{year:number})=>season.year===workspace.activeYear)
  active.board.title='外部页面保存的收藏板'
  active.board.items.push({id:'external-protected-medal',kind:'medal',recordId:trashId,title:trashName,variant:'silver',x:680,y:280,w:230,h:280,rotation:0})
  workspace.seasons.find((season:{year:number})=>season.year!==workspace.activeYear).board.title='外部页面保存的上一赛季'
  // Preserve revision deliberately: exact snapshot comparison must still detect
  // an uncooperative writer that does not follow the revision convention.
  const next=JSON.stringify(workspace),board=JSON.stringify(active.board)
  localStorage.setItem(workspaceKey,next);localStorage.setItem(boardKey,board)
  return {workspace:next,board}
 },{workspaceKey:WORKSPACE,boardKey:BOARD,trashId:TRASH,trashName:TRASH_NAME})
 await expect(banner(page).locator('p')).toHaveText(zh['saveConflict.changed'])
 await expect(title(page)).toHaveText(seedBoard.title)
 await expect(note(page,localNote)).toBeVisible()
 await page.evaluate(()=>{delete document.documentElement.dataset.multitabSaveFault})
 await attemptPermanentDelete(page)
 expect(await records(page)).toEqual(originalRecords)
 await lifecycleFlushes(page)
 await page.waitForTimeout(500)
 expect(await sources(page)).toEqual(external)
 await expect(note(page,localNote)).toBeVisible()
 // The conflict notice exposes a usable backup of the preserved in-memory board.
 const exportButton=banner(page).getByRole('button',{name:zh['App.058'],exact:true})
 await expect(exportButton).toBeEnabled();await exportButton.click()
 const pending=page.waitForEvent('download')
 await page.locator('.export-option').nth(1).click()
 const download=await pending
 try{
  const stream=await download.createReadStream();expect(stream).not.toBeNull()
  const chunks:Buffer[]=[]
  for await(const chunk of stream!)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))
  expect(await download.failure()).toBeNull()
  const entries=unzipSync(Buffer.concat(chunks)),manifest=JSON.parse(strFromU8(entries['manifest.json']))
  expect(manifest.board.title).toBe(seedBoard.title)
  expect(manifest.board.items).toEqual(expect.arrayContaining([expect.objectContaining({title:localNote})]))
 }finally{await download.delete()}
 await expect(page.locator('.file-operation-floating')).toBeHidden()
 expect(await sources(page)).toEqual(external)
 expect(await records(page)).toEqual(originalRecords)
})

test('a failed material reload keeps viewing, releases the lease and allows a later Escape retry',async({page,context})=>{
 await openSeed(page)
 const reader=await context.newPage();await reader.emulateMedia({reducedMotion:'reduce'})
 await reader.goto(`${ORIGIN}/`);await ready(reader);await assertReaderViewing(reader)
 const savedSources=await sources(page),savedRecords=await records(page)
 await reader.evaluate(()=>{
  const open=IDBFactory.prototype.open
  let pending=true
  IDBFactory.prototype.open=function(name,version){
   if(pending&&name==='racememoir-records-v1'){
    pending=false
    throw new DOMException('Injected takeover read failure','UnknownError')
   }
   return open.call(this,name,version)
  }
 })
 await page.close()
 await reader.getByRole('button',{name:zh['viewing.exit'],exact:true}).click()
 await expect(toast(reader)).toHaveText(zh['saveConflict.reloadFailed'])
 await assertReaderViewing(reader)
 await lifecycleFlushes(reader)
 expect(await sources(reader)).toEqual(savedSources)
 expect(await records(reader)).toEqual(savedRecords)
 // Failure must release the newly acquired lease, not leave an invisible writer.
 const contender=await context.newPage();await contender.goto(`${ORIGIN}/`);await ready(contender)
 await expect(shell(contender)).not.toHaveClass(/\bis-viewing\b/)
 await expect(contender.getByRole('button',{name:'修改收藏板名称',exact:true})).toBeEnabled()
 await contender.close()
 await reader.locator('.board-viewport').focus();await reader.keyboard.press('Escape')
 await expect(shell(reader)).not.toHaveClass(/\bis-viewing\b/)
 await expect(toast(reader)).toHaveText(zh['saveConflict.acquired'])
 await rename(reader,'重新接管成功的收藏板')
 await expect.poll(async()=>(await activeBoard(reader)).title).toBe('重新接管成功的收藏板')
})

test.describe('phone read-only viewing',()=>{
test.use({viewport:{width:370,height:780},hasTouch:true,isMobile:true,deviceScaleFactor:1})
test('phone reader notices and denied Escape exit follow all three languages without changing shared saves',async({page,context},info)=>{
 await openSeed(page)
 const reader=await context.newPage();await reader.setViewportSize({width:370,height:780})
 await reader.emulateMedia({reducedMotion:'reduce'});await reader.goto(`${ORIGIN}/`);await ready(reader)
 await assertReaderViewing(reader)
 const savedSources=await sources(page),savedRecords=await records(page)
 for(const [locale,dict] of [['en',en],['ja',ja],['zh-CN',zh]] as const){
  // The reader's topbar is hidden in viewing. Set the normal language preference
  // before reloading instead of adding a test-only language control to viewing.
  await page.evaluate(locale=>localStorage.setItem('racememoir-language',locale),locale)
  await reader.reload();await ready(reader)
  await expect(reader.locator('html')).toHaveAttribute('lang',locale)
  await assertReaderViewing(reader,dict['viewing.exit'])
  await expect(toast(reader)).toHaveText(dict['saveConflict.viewOnly'])
  await reader.getByRole('button',{name:dict['viewing.exit'],exact:true}).click()
  await expect(toast(reader)).toHaveText(dict['saveConflict.busy'])
  await assertReaderViewing(reader,dict['viewing.exit'])
  await reader.locator('.board-viewport').focus();await reader.keyboard.press('Escape')
  await expect(toast(reader)).toHaveText(dict['saveConflict.busy'])
  await assertReaderViewing(reader,dict['viewing.exit'])
  const dimensions=await toast(reader).evaluate(element=>{
   const box=element.getBoundingClientRect()
   return {left:box.left,right:box.right,width:innerWidth,scroll:element.scrollWidth,client:element.clientWidth,document:document.documentElement.scrollWidth}
  })
  expect(dimensions.left).toBeGreaterThanOrEqual(0)
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width)
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1)
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.width)
  expect(await sources(reader)).toEqual(savedSources)
  expect(await records(reader)).toEqual(savedRecords)
  await reader.screenshot({path:info.outputPath(`multitab-reader-viewing-${locale}.png`)})
 }
 await expect(banner(page)).toBeHidden()
 await expect(title(page)).toHaveText(seedBoard.title)
})
})
