import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function open(page:Page){await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})}
test('one switch controls lamp and light, defaults off and remembers changes',async({page},info)=>{
  await page.addInitScript(()=>{localStorage.setItem('racememoir-light-enabled','true')})
  await open(page)
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))).not.toBeNull()
  const snapshot=await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))
  await expect(page.locator('.board-light-fixtures,.pull-switch')).toHaveCount(0)
  await expect(page.locator('.app-shell')).toHaveAttribute('data-light','off')
  await page.getByRole('button',{name:'装饰样式',exact:true}).click()
  const light=page.getByRole('switch',{name:'开启灯具与光照'})
  await expect(light).toHaveAttribute('aria-checked','false')
  await expect(page.getByRole('switch',{name:'显示顶部灯具'})).toHaveCount(0)
  await light.click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-light','on')
  await expect(page.locator('.board-light-fixtures')).toBeVisible()
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.app-shell')).toHaveAttribute('data-light','on')
  const lamp=(await page.locator('.board-light-fixtures .pendant-lamp').boundingBox())!,viewport=(await page.locator('.board-viewport').boundingBox())!
  expect(Math.abs(lamp.y-viewport.y)).toBeLessThan(1)
  expect(lamp.width/lamp.height).toBeGreaterThan(10)
  await page.screenshot({path:info.outputPath('top-mounted-lamp.png'),animations:'disabled'})
  await page.getByRole('button',{name:'装饰样式',exact:true}).click()
  await light.focus();await page.keyboard.press('Space')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-light','off')
  await expect(page.locator('.board-light-fixtures')).toHaveCount(0)
  expect(await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))).toBe(snapshot)
})

test.describe('touch lighting',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
  test('panel switches work on touch without panning or overflow',async({page},info)=>{
    await open(page)
    const before=await page.locator('.scene').getAttribute('style')
    await page.getByRole('button',{name:'装饰样式',exact:true}).tap()
    await page.getByRole('switch',{name:'开启灯具与光照'}).tap()
    await expect(page.locator('.app-shell')).toHaveAttribute('data-light','on')
    await expect(page.locator('.board-light-fixtures')).toBeVisible()
    expect(await page.locator('.scene').getAttribute('style')).toBe(before)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
    await page.getByRole('button',{name:'关闭装饰样式',exact:true}).tap()
    const lamp=(await page.locator('.board-light-fixtures .pendant-lamp').boundingBox())!,viewport=(await page.locator('.board-viewport').boundingBox())!
    expect(Math.abs(lamp.y-viewport.y)).toBeLessThan(1)
    await page.screenshot({path:info.outputPath('lighting-mobile.png'),animations:'disabled'})
  })
})

for(const fixture of [false,true])
test(`PNG export keeps light and shadows with fixture ${fixture}`, async({page},info)=>{
  await open(page)
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))).not.toBeNull()
  await page.evaluate(()=>{
    (window as any).exportShadows=[]
    new MutationObserver(entries=>{for(const entry of entries)for(const node of entry.addedNodes){
      if(node instanceof HTMLElement&&['on','off'].includes(node.dataset.light??'')&&node.getAttribute('aria-hidden')==='true'){
        (window as any).exportLampCount=node.querySelectorAll('.pendant-lamp').length;
        (window as any).exportShadows=Array.from(node.querySelectorAll<HTMLElement>('.memory-artwork')).map(el=>getComputedStyle(el).filter)
      }
    }}).observe(document.body,{childList:true})
  })
  if(fixture){
    await page.getByRole('button',{name:'装饰样式',exact:true}).click()
    await page.getByRole('switch',{name:'开启灯具与光照'}).click()
    await page.getByRole('button',{name:'关闭装饰样式',exact:true}).click()
  }
  await page.getByRole('button',{name:'分享',exact:true}).click()
  const output=page.waitForEvent('download')
  await page.getByRole('button',{name:/导出高清图片/}).click()
  const download=await output
  await download.saveAs(info.outputPath('lit-export.png'))
  const {readFile}=await import('node:fs/promises')
  const bytes=await readFile(info.outputPath('lit-export.png'))
  const stats=await page.evaluate(async(base64)=>{
    const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode()
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0)
    const brightness=(x:number,y:number)=>{
      const d=ctx.getImageData(Math.floor(x*image.width),Math.floor(y*image.height),10,10).data
      let sum=0;for(let i=0;i<d.length;i+=4)sum+=(d[i]+d[i+1]+d[i+2])/3
      return sum/100
    }
    return {width:image.width,height:image.height,center:brightness(.5,.12),edge:brightness(.015,.12),lampCount:(window as any).exportLampCount,shadows:(window as any).exportShadows}
  },bytes.toString('base64'))
  expect(stats.width).toBeGreaterThan(1000);expect(stats.height).toBeGreaterThan(1000)
  if(fixture)expect(stats.center-stats.edge).toBeGreaterThan(25)
  expect(stats.lampCount).toBe(fixture?1:0)
  expect(stats.shadows.length).toBeGreaterThan(0)
  expect(stats.shadows.every((s:string)=>fixture?s.includes('drop-shadow'):s==='none')).toBe(true)
})
