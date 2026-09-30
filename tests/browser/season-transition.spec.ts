import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function openBoard(page:Page){
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.addInitScript(()=>{
    // An obsolete preview preference must not select a removed effect.
    localStorage.setItem('racememoir-season-transition-v1','slide')
    if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Motion board',backgroundStyle:'dark-wood',items:[
      {id:'note',kind:'note',title:'Keep this memory',variant:'yellow',x:160,y:240,w:180,h:160,rotation:0},
      {id:'photo',kind:'photo',title:'Trail photo',variant:'polaroid',image:'/images/mountain.jpg',x:500,y:180,w:280,h:320,rotation:3},
    ],threads:[{id:'line',from:'note',to:'photo'}]}))
  })
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect.poll(()=>page.evaluate(()=>!!localStorage.getItem('racememoir-season-workspace-v1'))).toBe(true)
  await page.locator('.scene img').evaluateAll(images=>Promise.all(images.map(img=>(img as HTMLImageElement).decode())))
  await page.locator('.board-action-calendar').click()
  await expect.poll(()=>page.locator('.year-capsule').evaluate(el=>el.getAnimations().every(a=>a.playState!=='running'))).toBe(true)
}
const layer=(page:Page)=>page.locator('.season-canvas-layer')
const host=(page:Page)=>page.locator('.board-viewport')
async function complete(page:Page){
  await expect(host(page)).not.toHaveAttribute('data-season-transition')
  await expect(page.locator('.season-canvas-snapshot,.season-transition-glow')).toHaveCount(0)
  await expect(layer(page)).not.toHaveAttribute('inert')
}

test('season switches dim and reveal the canvas while preserving frozen images, SVG references and fixed UI',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await openBoard(page)
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-season-workspace-v1')!).seasons[0].board)
  const camera=await page.locator('.scene').getAttribute('style'),top=(await page.locator('.topbar').boundingBox())!
  const background=await host(page).evaluate(el=>(el as HTMLElement).style.backgroundColor)
  await expect(page.getByRole('button',{name:'切换动效',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'上一年',exact:true}).click()
  await expect(host(page)).toHaveAttribute('data-season-transition','light')
  await expect(layer(page)).toHaveAttribute('inert')
  await expect(page.locator('.season-canvas-snapshot canvas')).not.toHaveCount(0)
  await expect(page.locator('.scene')).toHaveCount(1)
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
  await expect.poll(()=>layer(page).evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0)
  const mid=await host(page).evaluate(el=>{
    const incoming=el.querySelector('.season-canvas-layer')!,old=el.querySelector('.season-canvas-snapshot')!
    for(const animation of el.getAnimations({subtree:true})){animation.pause();animation.currentTime=Number(animation.effect!.getComputedTiming().duration)*.35}
    const canvas=old.querySelector('canvas')!
    const refs=Array.from(old.querySelectorAll('[id]')).map(node=>node.id)
    return {filter:getComputedStyle(old).filter,frames:(incoming.getAnimations()[0].effect as KeyframeEffect).getKeyframes(),pixels:canvas.width*canvas.height,allIdsUnique:refs.every(id=>document.querySelectorAll(`[id="${id}"]`).length===1),background:getComputedStyle(el).backgroundColor}
  })
  const brightness=Number(mid.filter.match(/brightness\(([\d.]+)\)/)?.[1])
  expect(brightness).toBeGreaterThanOrEqual(.65);expect(brightness).toBeLessThan(.75)
  expect(mid.frames.every(frame=>!frame.transform)).toBe(true)
  expect(mid.pixels).toBeGreaterThan(0);expect(mid.allIdsUnique).toBe(true)
  expect(mid.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(await page.locator('.topbar').boundingBox()).toEqual(top)
  await page.screenshot({path:info.outputPath('light-transition-mid.png')})
  await host(page).evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.play()))
  await complete(page)
  expect(await host(page).evaluate(el=>(el as HTMLElement).style.backgroundColor)).toBe(background)
  await page.getByRole('button',{name:'下一年',exact:true}).click();await complete(page)
  await expect(page.locator('[data-board-item]')).toHaveCount(2)
  await expect(page.locator('[data-board-thread]')).toHaveCount(1)
  await expect(page.locator('.scene img')).toBeVisible()
  expect(await page.locator('.scene').getAttribute('style')).toBe(camera)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-season-workspace-v1')!).seasons[0].board)).toEqual(before)
  expect(errors).toEqual([])
})

test('rapid switches keep the latest season and cleanup restores canvas interaction',async({page})=>{
  await openBoard(page)
  const year=await page.evaluate(()=>new Date().getFullYear())
  await page.getByRole('button',{name:'上一年',exact:true}).click()
  await expect(host(page)).toHaveAttribute('data-season-transition','light')
  await page.getByRole('button',{name:'下一年',exact:true}).click()
  await page.getByRole('button',{name:'上一年',exact:true}).click();await complete(page)
  await expect(page.locator('.app-shell')).toHaveAttribute('data-season',String(year-1))
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-season-workspace-v1')!).activeYear)).toBe(year-1)
  const camera=await page.locator('.scene').getAttribute('style')
  const rect=(await host(page).boundingBox())!,x=rect.x+rect.width*.6,y=rect.y+rect.height*.65
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+60,y+45,{steps:6});await page.mouse.up()
  await expect(page.locator('.scene')).not.toHaveAttribute('style',camera!)
  await page.getByRole('button',{name:'下一年',exact:true}).click();await complete(page)
  await expect(page.locator('[data-board-item]')).toHaveCount(2)
})

test('reduced motion, resizing and camera controls cancel transitions without leaving overlays',async({page})=>{
  await openBoard(page);await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:'上一年',exact:true}).click()
  await expect.poll(()=>layer(page).evaluate(el=>el.getAnimations().map(a=>(a.effect as KeyframeEffect).getKeyframes()).flat().every(frame=>!frame.transform&&!frame.filter))).toBe(true)
  await complete(page)
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.getByRole('button',{name:'下一年',exact:true}).click()
  await expect(host(page)).toHaveAttribute('data-season-transition','light')
  await page.setViewportSize({width:1100,height:800});await complete(page)
  await page.getByRole('button',{name:'上一年',exact:true}).click()
  await page.getByRole('button',{name:'放大',exact:true}).click();await complete(page)
})
