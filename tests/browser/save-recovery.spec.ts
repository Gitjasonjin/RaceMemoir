import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

const ORIGIN='http://127.0.0.1:5187'
const WORKSPACE='racememoir-season-workspace-v1',BOARD='racememoir-board-v1',RECOVERY='racememoir-save-recovery-v1'
const FALLBACK={title:'恢复测试备用收藏板',items:[],threads:[]}
type SourceKey=typeof WORKSPACE|typeof BOARD
interface Seed {key:SourceKey;raw:string;fault?:'quota'|'read'}
interface RecoveryEntry {key:SourceKey;raw:string;createdAt:number}
interface RecoveryLedger {version:1;entries:RecoveryEntry[]}
interface StorageProbe {read:(key:string)=>string|null;writes:{key:string;value:string}[];backupAttempts:number}
declare global {interface Window {__saveRecoveryTest:StorageProbe}}

test.use({baseURL:ORIGIN})

async function open(page:Page,seed:Seed){
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.addInitScript(({origin,workspace,board,recovery,fallback,seed})=>{
  if(location.origin!==origin)return
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem,marker='save-recovery-test-seeded',fault='save-recovery-test-fault'
  if(!get.call(sessionStorage,marker)){
   localStorage.removeItem(workspace);localStorage.removeItem(board);localStorage.removeItem(recovery)
   set.call(localStorage,'racememoir-language','zh-CN')
   set.call(localStorage,board,JSON.stringify(fallback))
   set.call(localStorage,seed.key,seed.raw)
   set.call(sessionStorage,marker,'true')
   if(seed.fault)set.call(sessionStorage,fault,seed.fault)
  }
  const probe:StorageProbe={read:key=>get.call(localStorage,key),writes:[],backupAttempts:0}
  window.__saveRecoveryTest=probe
  Storage.prototype.getItem=function(key){
   if(this===localStorage&&key===seed.key&&get.call(sessionStorage,fault)==='read')throw new DOMException('Injected save read failure','SecurityError')
   return get.call(this,key)
  }
  Storage.prototype.setItem=function(key,value){
   if(this===localStorage&&key===recovery){
    probe.backupAttempts++
    if(get.call(sessionStorage,fault)==='quota')throw new DOMException('Injected recovery backup failure','QuotaExceededError')
   }
   set.call(this,key,value)
   if(this===localStorage&&[workspace,board,recovery].includes(key))probe.writes.push({key,value})
  }
 },{origin:ORIGIN,workspace:WORKSPACE,board:BOARD,recovery:RECOVERY,fallback:FALLBACK,seed})
 await page.goto('/')
 await readyAfterAutosave(page)
}

async function readyAfterAutosave(page:Page){
 await expect(page).toHaveURL(new RegExp('^'+ORIGIN.replaceAll('.','\\.')))
 await expect(page.locator('.board-name .board-title')).toBeVisible()
 await page.locator('.records-loading').waitFor({state:'hidden'})
 // Exercise the actual 450 ms startup autosave, including a blocked first save.
 await page.waitForTimeout(500)
}

const banner=(page:Page)=>page.locator('.save-recovery-banner')
const readRaw=(page:Page,key:string)=>page.evaluate(key=>window.__saveRecoveryTest.read(key),key)
const readSources=(page:Page)=>page.evaluate(()=>({workspace:window.__saveRecoveryTest.read('racememoir-season-workspace-v1'),board:window.__saveRecoveryTest.read('racememoir-board-v1')}))
const readLedger=async(page:Page):Promise<RecoveryLedger|null>=>{
 const raw=await readRaw(page,RECOVERY)
 return raw?JSON.parse(raw):null
}
const retry=(page:Page)=>page.locator('.save-failure-banner').getByRole('button',{name:/^重试(?:画布)?保存$/}).click()

async function originalDownload(page:Page,label='下载原始存档'){
 const pending=page.waitForEvent('download')
 await banner(page).getByRole('button',{name:label,exact:true}).click()
 const download=await pending
 try{
  const stream=await download.createReadStream()
  expect(stream).not.toBeNull()
  const chunks:Buffer[]=[]
  for await(const chunk of stream!)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))
  expect(await download.failure()).toBeNull()
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
 }finally{await download.delete()}
}

async function lifecycleFlushes(page:Page){
 await page.evaluate(()=>{
  window.dispatchEvent(new PageTransitionEvent('pagehide'))
  const previous=Object.getOwnPropertyDescriptor(document,'hidden')
  Object.defineProperty(document,'hidden',{configurable:true,value:true})
  try{document.dispatchEvent(new Event('visibilitychange'))}
  finally{if(previous)Object.defineProperty(document,'hidden',previous);else Reflect.deleteProperty(document,'hidden')}
 })
}

async function blockedSeasonSwitch(page:Page){
 const year=await page.locator('.app-shell').getAttribute('data-season')
 if(!await page.locator('.year-capsule').isVisible())await page.getByRole('button',{name:'赛季选择',exact:true}).click()
 // Keep the recovery alert visible while exercising the season action beneath it.
 await page.locator('.year-capsule').getByRole('button',{name:'上一年',exact:true}).press('Enter')
 await expect(page.locator('.app-shell')).toHaveAttribute('data-season',year!)
}

async function expectBlocked(page:Page,key:SourceKey,raw:string){
 await expect(banner(page)).toHaveAttribute('role','alert')
 await expect(banner(page)).toContainText(/原始存档|无法读取本机存档/)
 await expect(page.locator('.save-failure-banner')).toBeVisible()
 await expect(page.locator('.save-status')).not.toContainText('已保存到本机')
 expect(await readRaw(page,key)).toBe(raw)
}

const damaged:[string,Seed][]=[
 ['workspace malformed JSON',{key:WORKSPACE,raw:'{\n  "version": 1,\n  "activeYear": \n}'}],
 ['workspace invalid schema',{key:WORKSPACE,raw:JSON.stringify({version:1,activeYear:2040,seasons:[]})}],
 ['workspace extreme camera scale',{key:WORKSPACE,raw:JSON.stringify({version:1,activeYear:2040,seasons:[{year:2040,board:FALLBACK,view:{x:0,y:0,scale:1e-308}},{year:2039,board:FALLBACK}]})}],
 ['legacy board malformed JSON',{key:BOARD,raw:'{\n  "title": "尚未解析的原始收藏板",\n'}],
 ['legacy board invalid schema',{key:BOARD,raw:JSON.stringify({title:77,items:[],threads:[]})}],
]

for(const [name,seed] of damaged)test(`${name} is backed up before autosave and can be downloaded intact`,async({page})=>{
 await open(page,seed)
 await expect(banner(page)).toHaveAttribute('role','alert')
 await expect(banner(page)).toContainText('原始存档')
 await expect(banner(page).getByRole('button',{name:'重新加载',exact:true})).toBeVisible()
 await expect.poll(()=>readLedger(page)).toMatchObject({version:1,entries:[{key:seed.key,raw:seed.raw}]})
 const ledger=(await readLedger(page))!
 expect(ledger.entries).toHaveLength(1)
 expect(ledger.entries[0].createdAt).toBeGreaterThan(0)
 expect(await readRaw(page,seed.key)).not.toBe(seed.raw)
 const order=await page.evaluate(({recovery,key})=>{
  const writes=window.__saveRecoveryTest.writes
  return {backup:writes.findIndex(entry=>entry.key===recovery),replacement:writes.findIndex(entry=>entry.key===key)}
 },{recovery:RECOVERY,key:seed.key})
 expect(order.backup).toBeGreaterThanOrEqual(0)
 expect(order.replacement).toBeGreaterThan(order.backup)
 expect(await originalDownload(page)).toEqual({version:1,entries:[{key:seed.key,raw:seed.raw}]})
 await banner(page).getByRole('button',{name:/关闭/}).click()
 await expect(banner(page)).toBeHidden()
 expect((await readLedger(page))!.entries[0].raw).toBe(seed.raw)
})

for(const key of [WORKSPACE,BOARD] as const)test(`${key} backup quota failure preserves every source until a successful retry`,async({page})=>{
 const raw=key===WORKSPACE?'{ "version": 1, "activeYear": "原始赛季", "seasons": [] }':'{ "title": 77, "items": [], "threads": [] }'
 const unchanged={workspace:key===WORKSPACE?raw:null,board:key===BOARD?raw:JSON.stringify(FALLBACK)}
 await open(page,{key,raw,fault:'quota'})
 await expectBlocked(page,key,raw)
 expect(await readSources(page)).toEqual(unchanged)
 expect(await readLedger(page)).toBeNull()
 expect(await originalDownload(page)).toEqual({version:1,entries:[{key,raw}]})
 await lifecycleFlushes(page)
 await retry(page)
 await blockedSeasonSwitch(page)
 await expectBlocked(page,key,raw)
 expect(await readSources(page)).toEqual(unchanged)
 expect(await readLedger(page)).toBeNull()
 expect(await page.evaluate(()=>window.__saveRecoveryTest.writes.filter(entry=>['racememoir-season-workspace-v1','racememoir-board-v1'].includes(entry.key)))).toEqual([])
 await page.evaluate(()=>sessionStorage.removeItem('save-recovery-test-fault'))
 await retry(page)
 await expect.poll(()=>readLedger(page)).toMatchObject({version:1,entries:[{key,raw}]})
 await expect(page.locator('.save-failure-banner')).toBeHidden()
 await expect(page.locator('.save-status')).toContainText('已保存到本机')
 expect(await readRaw(page,key)).not.toBe(raw)
 expect(await readRaw(page,WORKSPACE)).not.toBeNull()
 expect((await readLedger(page))!.entries).toHaveLength(1)
 expect(await originalDownload(page)).toEqual({version:1,entries:[{key,raw}]})
})

test('a startup read denial blocks the session even after permissions recover until reload',async({page})=>{
 const year=2041,originalTitle='读取权限恢复后的原始收藏板'
 const raw=JSON.stringify({version:1,activeYear:year,seasons:[{year,board:{title:originalTitle,items:[],threads:[]}},{year:year-1,board:{title:'上一赛季原文',items:[],threads:[]}}]})
 await open(page,{key:WORKSPACE,raw,fault:'read'})
 await expectBlocked(page,WORKSPACE,raw)
 await expect(banner(page).getByRole('button',{name:'下载原始存档',exact:true})).toHaveCount(0)
 await page.evaluate(()=>sessionStorage.removeItem('save-recovery-test-fault'))
 await lifecycleFlushes(page)
 await retry(page)
 await blockedSeasonSwitch(page)
 await expectBlocked(page,WORKSPACE,raw)
 expect(await page.evaluate(()=>window.__saveRecoveryTest.writes.filter(entry=>['racememoir-season-workspace-v1','racememoir-board-v1'].includes(entry.key)))).toEqual([])
 await Promise.all([page.waitForEvent('load'),banner(page).getByRole('button',{name:'重新加载',exact:true}).click()])
 await readyAfterAutosave(page)
 await expect(page.locator('.board-name .board-title')).toHaveText(originalTitle)
 await expect(page.locator('.app-shell')).toHaveAttribute('data-season',String(year))
 await expect(banner(page)).toBeHidden()
 await expect(page.locator('.save-failure-banner')).toBeHidden()
 await expect(page.locator('.save-status')).toContainText('已保存到本机')
})

test('mobile recovery notice fits all three languages and downloads leave recovery data intact',async({page},info)=>{
 await page.setViewportSize({width:370,height:780})
 const raw='{\n "version": 1, "activeYear": "需要保留的原文", "seasons": []\n}'
 await open(page,{key:WORKSPACE,raw})
 await expect.poll(()=>readLedger(page)).toMatchObject({version:1,entries:[{key:WORKSPACE,raw}]})
 const originalSources=await readSources(page),originalLedger=await readRaw(page,RECOVERY)
 for(const [language,locale,download] of [
  ['English','en','Download original save'],
  ['日本語','ja','元の保存データをダウンロード'],
  ['简体中文','zh-CN','下载原始存档'],
 ]){
  await page.getByRole('button',{name:'Language / 语言 / 言語',exact:true}).click()
  await page.getByRole('menuitemradio',{name:language,exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('lang',locale)
  await expect(banner(page).getByRole('button',{name:download,exact:true})).toBeVisible()
  const dimensions=await banner(page).evaluate(element=>{
   const box=element.getBoundingClientRect()
   return {left:box.left,right:box.right,width:innerWidth,scroll:element.scrollWidth,client:element.clientWidth,document:document.documentElement.scrollWidth}
  })
  expect(dimensions.left).toBeGreaterThanOrEqual(0)
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width)
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1)
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.width)
  expect(await originalDownload(page,download)).toEqual({version:1,entries:[{key:WORKSPACE,raw}]})
  expect(await readSources(page)).toEqual(originalSources)
  expect(await readRaw(page,RECOVERY)).toBe(originalLedger)
  await page.screenshot({path:info.outputPath(`save-recovery-${locale}.png`)})
 }
})
