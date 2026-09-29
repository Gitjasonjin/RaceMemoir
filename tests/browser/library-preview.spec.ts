import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function seed(page:Page){
  await page.addInitScript(()=>{
    const staged=sessionStorage.getItem('library-preview-board')
    if(staged){localStorage.setItem('racememoir-board-v1',staged);sessionStorage.removeItem('library-preview-board')}
    else if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'收藏预览',items:[],threads:[]}))
  })
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(async()=>{
    const {putRecords}=await import('/src/persistence/recordStore.ts'),{createMemory}=await import('/src/domain/model.ts')
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=180
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#247b63';ctx.fillRect(35,30,170,120);ctx.fillStyle='white';ctx.font='bold 28px sans-serif';ctx.fillText('TRAIL',70,100)
    const image=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'))
    const base={source:'upload',note:'山风吹过终点，记住这一刻。'}
    const records=[
      {...base,id:'photo',kind:'photo',name:'山野照片',image,date:'2026-09-28'},
      {...base,id:'medal',kind:'medal',name:'完赛奖牌',image,originalImage:image,date:'',cutout:'done'},
      {...base,id:'sticker',kind:'sticker',name:'山野贴纸',image,originalImage:image,imageMode:'cutout',width:170,height:120},
      {...base,id:'bib',kind:'bib',name:'赛事号码布',image,originalImage:image,width:240,height:180,originalWidth:240,originalHeight:180,number:'A123'},
      {...base,id:'route',kind:'route',name:'山脊路线',trackPoints:[{lat:30,lon:104,segment:0,elevation:100},{lat:30.02,lon:104.05,segment:0,elevation:240},{lat:30.06,lon:104.07,segment:0,elevation:160}],gpx:new Blob(['<gpx/>'],{type:'application/gpx+xml'})},
    ]
    await putRecords(records)
    const items=records.map((r,index)=>({...createMemory(r.kind==='route'?'map':r.kind,r.name,r.kind==='photo'?'polaroid':r.kind==='medal'?'bronze':'','',''),id:`${r.id}-item`,recordId:r.id,x:100+index%3*300,y:100+Math.floor(index/3)*350,rotation:0}))
    sessionStorage.setItem('library-preview-board',JSON.stringify({title:'收藏预览',items,threads:[]}))
  })
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
}

test('desktop canvas editors return directly to the board; library editors still return to the library',async({page})=>{
  await seed(page)
  for(const id of ['photo','medal','sticker','bib','route']){
    await page.locator(`[data-board-item="${id}-item"]`).press('Enter')
    await expect(page.locator('[data-record-panel]').getByRole('button',{name:/返回/})).toHaveCount(0)
    await page.getByRole('button',{name:id==='sticker'?'关闭贴纸编辑':'关闭详情',exact:true}).click()
    await expect(page.locator('[data-record-panel]')).toHaveCount(0)
    await expect(page.getByRole('heading',{name:'我的收藏库'})).toHaveCount(0)
  }
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await page.getByRole('button',{name:'查看 山野照片',exact:true}).click()
  await page.getByRole('button',{name:'返回收藏库',exact:true}).click()
  await expect(page.getByRole('heading',{name:'我的收藏库'})).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-board-v1')!).items.length)).toBe(5)
})

test('library hover previews show assets and routes, release URLs and dismiss on scroll, Escape and editing',async({page},info)=>{
  await seed(page)
  await page.evaluate(()=>{const revoke=URL.revokeObjectURL.bind(URL);(window as any).revoked=[];URL.revokeObjectURL=url=>{(window as any).revoked.push(url);revoke(url)}})
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  const preview=page.locator('.record-hover-preview')
  for(const name of ['山野照片','完赛奖牌','山野贴纸','赛事号码布','山脊路线']){
    const row=page.getByRole('button',{name:`查看 ${name}`,exact:true})
    await row.hover()
    await expect(preview).toBeVisible()
    await expect(preview.locator('.record-hover-caption>strong')).toHaveText(name)
    if(name==='山脊路线')await expect(preview.locator('.real-route-map>path')).toHaveAttribute('d',/^M/)
    else await expect.poll(()=>preview.locator('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(240)
    const rect=(await preview.boundingBox())!,trigger=(await row.boundingBox())!
    expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(trigger.x)
    await expect(preview).toContainText('山风吹过终点')
    if(name==='山野照片'){
      await expect(preview).toContainText('2026-09-28')
      await page.screenshot({path:info.outputPath('library-photo-preview.png')})
    }
  }
  await page.screenshot({path:info.outputPath('library-route-preview.png')})
  await page.getByRole('button',{name:'将 山脊路线 放上画布',exact:true}).hover()
  await expect(preview).toHaveCount(0)
  const photo=page.getByRole('button',{name:'查看 山野照片',exact:true})
  await page.getByRole('button',{name:'删除 完赛奖牌',exact:true}).focus()
  await page.keyboard.press('Tab');await expect(photo).toBeFocused();await expect(preview).toBeVisible()
  const url=await preview.locator('img').getAttribute('src')
  await photo.press('Escape');await expect(preview).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'我的收藏库'})).toBeVisible()
  await expect.poll(()=>page.evaluate(url=>(window as any).revoked.includes(url),url)).toBe(true)
  await page.setViewportSize({width:1100,height:560})
  await photo.blur();await photo.hover();await expect(preview).toBeVisible()
  await page.locator('.record-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight})
  await expect(preview).toHaveCount(0)
  await photo.click();await expect(preview).toHaveCount(0)
  await expect(page.getByRole('button',{name:'返回收藏库',exact:true})).toBeVisible()
})

test('touch opens the editor directly without a hover popup',async({browser})=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5187',viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  const page=await context.newPage();await seed(page)
  await page.getByRole('button',{name:'打开收藏库',exact:true}).tap()
  await page.getByRole('button',{name:'查看 山野照片',exact:true}).tap()
  await expect(page.locator('.record-hover-preview')).toHaveCount(0)
  await page.getByRole('button',{name:'返回收藏库',exact:true}).tap()
  await expect(page.getByRole('heading',{name:'我的收藏库'})).toBeVisible()
  expect(await page.locator('.record-scroll').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1)
  await context.close()
})
