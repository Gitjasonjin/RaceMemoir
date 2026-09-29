import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'
import zh from '../../src/i18n/locales/zh-CN.json' with {type:'json'}
import en from '../../src/i18n/locales/en.json' with {type:'json'}
import ja from '../../src/i18n/locales/ja.json' with {type:'json'}

const languageButton='Language / 语言 / 言語'
async function change(page:Page,name:string){await page.getByRole('button',{name:languageButton,exact:true}).click();await page.getByRole('menuitemradio',{name,exact:true}).click()}
async function empty(page:Page){await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'用户的越野记忆',items:[],threads:[]}))})}

test('switching preserves open editor, unsaved input, errors and board data',async({page})=>{
 await empty(page);await page.goto('/')
 await page.getByRole('button',{name:'添加照片',exact:true}).click()
 const name=page.locator('.record-scroll form input[maxlength="200"]')
 await name.fill('用户输入のPhoto')
 await page.getByLabel('照片图片',{exact:true}).setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('broken')})
 await expect(page.locator('.record-error')).toContainText('无法读取图片')
 await expect.poll(()=>page.evaluate(()=>!!localStorage.getItem('racememoir-board-v1'))).toBe(true)
 const before=await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))
 for(const [label,lang] of [['English','en'],['日本語','ja'],['简体中文','zh-CN']]){
  await change(page,label)
  await expect(page.locator('html')).toHaveAttribute('lang',lang)
  await expect(name).toHaveValue('用户输入のPhoto')
  await expect(page.locator('.record-panel')).toBeVisible()
  expect(await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))).toBe(before)
  if(lang==='en')await expect(page.locator('.record-error')).not.toContainText('无法读取')
  if(lang==='ja')await expect(page.locator('.record-error')).not.toContainText('无法读取')
 }
 await change(page,'English');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en')
 await expect(page.locator('.board-title')).toHaveText('用户的越野记忆')
})

test('all languages render calendar, style catalogs and mobile menus without horizontal overflow',async({page},info)=>{
 await empty(page);await page.setViewportSize({width:390,height:844});await page.goto('/')
 for(const [label,lang] of [['English','en'],['日本語','ja'],['简体中文','zh-CN']]){
  await change(page,label)
  const add=page.locator('.tool-palette button').filter({has:page.locator('svg.lucide-image-plus')})
  await add.click()
  await page.locator('.date-picker-trigger').click()
  await expect(page.locator('.date-picker-popup')).toBeVisible()
  await page.locator('.calendar-select-trigger').last().click()
  await expect(page.locator('.calendar-select-popup')).toBeVisible()
  await page.keyboard.press('Escape');await page.keyboard.press('Escape')
  const text=await page.locator('.record-panel').innerText()
  expect(text).not.toContain('[object Object]')
  if(lang==='en')expect(text).not.toMatch(/[\u4e00-\u9fff]/)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:info.outputPath(`mobile-${lang}.png`)})
  await page.locator('.record-heading>button').last().click()
  await page.locator('.board-actions button').first().click()
  await expect(page.locator('[data-decoration-panel]')).toBeVisible()
  if(lang==='en')expect(await page.locator('[data-decoration-panel]').innerText()).not.toMatch(/[\u4e00-\u9fff]/)
  await page.locator('[data-decoration-panel] .decoration-heading button').last().click()
 }
})

test('fresh browser locale uses translated defaults; stored preference wins',async({browser})=>{
 const context=await browser.newContext({locale:'ja-JP'}),page=await context.newPage()
 await page.goto('http://127.0.0.1:5187/');await expect(page.locator('html')).toHaveAttribute('lang','ja')
 await expect(page.locator('.board-title')).not.toHaveText('我的越野记忆')
 const title=await page.locator('.board-title').innerText()
 await change(page,'English');await page.reload()
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('.board-title')).toHaveText(title)
 await context.close()
})

test('PNG renders fixed labels in current language and keeps user names',async({page},info)=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'原名',items:[{id:'route',kind:'map',title:'用户路线',variant:'blue',x:0,y:0,w:320,h:460,rotation:0}],threads:[]}))})
 await page.goto('/');await expect(page.locator('.route-ticket')).toBeVisible()
 for(const [label,lang] of [['English','en'],['日本語','ja'],['简体中文','zh-CN']]){
  await change(page,label);await expect(page.locator('.route-ticket .real-route-title')).toHaveText('用户路线')
  const card=await page.locator('.route-ticket').innerText()
  expect(card).not.toContain('[object Object]');if(lang==='en')expect(card.replace('用户路线','')).not.toMatch(/[\u4e00-\u9fff]/)
  await page.locator('.share-button').click()
  const pending=page.waitForEvent('download');await page.locator('.export-option').first().click()
  await(await pending).saveAs(info.outputPath(`export-${lang}.png`))
  await expect(page.locator('.file-operation-floating')).toBeHidden()
  await expect(page.locator('.modal')).toBeHidden()
 }
})

test('switching during background removal updates progress without restarting the worker',async({page})=>{
 await empty(page);let workers=0
 await page.route('**/cutout.worker.ts*',route=>{
  workers++
  return route.fulfill({contentType:'application/javascript',body:`self.onmessage=async e=>{self.postMessage({type:'progress',key:'fetch:model',current:1,total:2});const image=e.data.blob;setTimeout(()=>self.postMessage({type:'done',image}),5000)}`})
 })
 await page.goto('/');await page.getByRole('button',{name:'添加奖牌',exact:true}).click()
 const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=160;const x=c.getContext('2d')!;x.fillStyle='gold';x.fillRect(25,20,50,120);return c.toDataURL().split(',')[1]})
 await page.getByLabel('奖牌图片',{exact:true}).setInputFiles({name:'medal.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')})
 await expect(page.locator('.record-progress')).toContainText('50%')
 await change(page,'English');await expect(page.locator('.record-progress')).toContainText('50%')
 await expect(page.locator('.record-progress')).not.toContainText('下载抠图模型')
 await change(page,'日本語');await expect(page.locator('.record-progress')).toContainText('50%')
 expect(workers).toBe(1)
 await expect(page.locator('.record-notice')).toBeVisible({timeout:15000})
 await expect(page.locator('.record-preview img')).toBeVisible()
})

test('unavailable preference storage still allows switching for the current session',async({page})=>{
 await empty(page)
 await page.addInitScript(()=>{
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem
  Storage.prototype.getItem=function(key){if(key==='racememoir-language')throw new DOMException('Blocked','SecurityError');return get.call(this,key)}
  Storage.prototype.setItem=function(key,value){if(key==='racememoir-language')throw new DOMException('Blocked','QuotaExceededError');return set.call(this,key,value)}
 })
 await page.goto('/');await change(page,'日本語');await expect(page.locator('html')).toHaveAttribute('lang','ja')
 await change(page,'English');await expect(page.locator('html')).toHaveAttribute('lang','en')
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','zh-CN')
})

test('all editors, local map labels and destructive confirmation adapt to each language',async({page})=>{
 await empty(page);await page.goto('/')
 for(const [label,dict] of [['English',en],['日本語',ja],['简体中文',zh]] as const){
  await change(page,label)
  for(const key of ['ToolPalette.012','ToolPalette.010','ToolPalette.009','ToolPalette.008','ToolPalette.007'] as const){
   await page.getByRole('button',{name:dict[key],exact:true}).click()
   const panel=page.locator('.record-panel')
   await expect(panel).toBeVisible()
   const text=await panel.innerText()
   expect(text).not.toContain('[object Object]')
   if(label==='English')expect(text).not.toMatch(/[\u4e00-\u9fff]/)
   expect(await panel.locator('.record-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
   if(key==='ToolPalette.007')await expect(panel.locator('.race-map-editor-preview .race-province-name').filter({hasText:dict['province.17']})).toHaveCount(1)
   await panel.locator('.record-heading>button').last().click()
  }
  await page.getByRole('button',{name:dict['ToolPalette.001'],exact:true}).click()
  await page.locator('.record-panel textarea').fill('用户保留のnote')
  await page.locator('.record-panel button[type=submit]').click()
  await page.locator('.board-viewport').click({position:{x:15,y:30},button:'right'})
  await page.getByRole('menuitem',{name:dict['CanvasContextMenu.001'],exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toContainText(dict['BoardDialog.044'])
  await dialog.getByRole('button',{name:dict['BoardDialog.042'],exact:true}).click()
  await expect(page.locator('.memory-note').last()).toContainText('用户保留のnote')
 }
})
