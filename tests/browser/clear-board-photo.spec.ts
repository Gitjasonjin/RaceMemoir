import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function setup(page:Page){
  await page.addInitScript(()=>{
    if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'保留名称',backgroundStyle:'kraft',decorations:{pin:'brass'},items:[
      {id:'photo',recordId:'kept-photo',kind:'photo',title:'山野照片',subtitle:'2026-09-22',variant:'polaroid',x:200,y:150,w:255,h:298,rotation:0,photoZoom:1.5,photoX:35,photoY:65},
      {id:'note',kind:'note',title:'锁定便签',variant:'paper',x:550,y:240,w:160,h:150,rotation:0,locked:true},
    ],threads:[{id:'thread',from:'photo',to:'note'}]}))
  })
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(async()=>{
    const {putRecords}=await import('/src/persistence/recordStore.ts')
    await putRecords([{id:'kept-photo',kind:'photo',source:'upload',name:'山野照片',note:'保留素材',date:'2026-09-22',image:await (await fetch('/images/mountain.jpg')).blob()}])
  })
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
}
const board=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-board-v1')!))
const openClear=async(page:Page)=>{
  await page.locator('.board-viewport').click({button:'right',position:{x:15,y:160}})
  await page.getByRole('menuitem',{name:'清空画布',exact:true}).click()
}

test('clear requires confirmation, preserves records/settings, and undo restores locked items and threads',async({page},info)=>{
  await setup(page)
  const before=await board(page),dialog=page.getByRole('dialog',{name:'清空画布确认'})
  await openClear(page);await expect(dialog).toBeVisible()
  await page.screenshot({path:info.outputPath('clear-confirm.png')})
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
  expect(await board(page)).toEqual(before)
  await openClear(page);await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible()
  expect(await board(page)).toEqual(before)
  await openClear(page);await dialog.getByRole('button',{name:'确认清空',exact:true}).click()
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await expect(page.locator('[data-board-thread]')).toHaveCount(0)
  await expect.poll(()=>board(page)).toEqual({...before,items:[],threads:[]})
  expect(await page.evaluate(async()=>{const {readRecords}=await import('/src/persistence/recordStore.ts');const records=await readRecords();return records.map((r:any)=>({id:r.id,size:r.image.size,name:r.name}))})).toEqual([{id:'kept-photo',size:expect.any(Number),name:'山野照片'}])
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await expect.poll(()=>board(page)).toEqual(before)
  await page.getByRole('button',{name:'重做',exact:true}).click()
  await expect.poll(()=>board(page)).toEqual({...before,items:[],threads:[]})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await page.locator('.board-viewport').click({button:'right',position:{x:15,y:160}})
  await expect(page.getByRole('menuitem',{name:'清空画布',exact:true})).toBeDisabled()
})

test('borderless fills the photo, keeps crop and metadata, and survives undo, reload and ZIP',async({page},info)=>{
  await setup(page)
  const item=page.locator('[data-board-item=photo]'),before=(await board(page)).items[0]
  await item.click();await page.getByRole('button',{name:'无框照片',exact:true}).click()
  await expect(item.locator('.photo-paper-borderless')).toBeVisible()
  await expect(item.locator('.photo-footer,.photo-caption,.photo-date')).toHaveCount(0)
  const dimensions=await item.locator('.photo-paper-borderless').evaluate(el=>{
    const image=el.querySelector('.photo-image')!,a=el.getBoundingClientRect(),b=image.getBoundingClientRect()
    return {padding:getComputedStyle(el).padding,border:getComputedStyle(el).borderWidth,width:a.width-b.width,height:a.height-b.height}
  })
  expect(dimensions).toEqual({padding:'0px',border:'0px',width:0,height:0})
  await expect.poll(async()=>(await board(page)).items[0]).toEqual({...before,photoPaper:'borderless'})
  await page.screenshot({path:info.outputPath('borderless-editor.png')})
  await page.getByRole('button',{name:'Polaroid',exact:true}).click()
  await expect(item.locator('.photo-footer')).toContainText('2026-09-22')
  await page.getByRole('button',{name:'保存修改',exact:true}).click()
  await expect(page.locator('.record-panel')).toHaveCount(0)
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await expect(item.locator('.photo-paper-borderless')).toBeVisible()
  await expect.poll(async()=>(await board(page)).items[0].photoPaper).toBe('borderless')
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(item.locator('.photo-paper-borderless')).toBeVisible()
  expect(await page.evaluate(async()=>{
    const {makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts'),{readRecords}=await import('/src/persistence/recordStore.ts')
    const data=await readBackup(await makeZipArchive(JSON.parse(localStorage.getItem('racememoir-board-v1')!),await readRecords()))
    return data.board.items[0].photoPaper
  })).toBe('borderless')
})

test.describe('mobile clear',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  test('long-press opens the menu and clearing stays behind confirmation',async({page})=>{
    await setup(page)
    const cdp=await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:20,y:220}]})
    await expect(page.getByRole('menu',{name:'画布菜单'})).toBeVisible()
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await page.getByRole('menuitem',{name:'清空画布'}).tap()
    const dialog=page.getByRole('dialog',{name:'清空画布确认'})
    await expect(dialog).toBeVisible();await expect(page.locator('[data-board-item]')).toHaveCount(2)
    await dialog.getByRole('button',{name:'确认清空'}).tap()
    await expect(page.locator('[data-board-item]')).toHaveCount(0)
  })
})
