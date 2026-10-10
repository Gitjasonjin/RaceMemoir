import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function openBoard(page:Page){
  await page.addInitScript(()=>{
    localStorage.setItem('racememoir-language','zh-CN')
    localStorage.setItem('racememoir-board-v1',JSON.stringify({
      title:'观赏动效验证',backgroundStyle:'kraft',items:[
        {id:'note',kind:'note',title:'山径记忆',x:200,y:160,w:180,h:140,rotation:0},
      ],threads:[],
    }))
  })
  await page.goto('/')
  await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.topbar').getByRole('button',{name:'进入观赏模式',exact:true})).toHaveCount(0)
}

async function openViewingMenu(page:Page){
  await page.locator('.board-viewport').click({button:'right',position:{x:12,y:180}})
  const entry=page.getByRole('menuitem',{name:'进入观赏模式',exact:true})
  await expect(entry).toBeEnabled()
  return entry
}

// Capture real intermediate frames, rather than just checking the final CSS rules.
async function transitionFrames(page:Page,entering:boolean){
  if(entering)await openViewingMenu(page)
  return page.evaluate(async entering=>{
    const scene=document.querySelector<HTMLElement>('.scene')!
    const header=document.querySelector<HTMLElement>('.topbar')!
    const palette=document.querySelector<HTMLElement>('.tool-palette')!
    const exit=document.querySelector<HTMLButtonElement>('.board-action-exit')!
    const trigger=document.querySelector<HTMLButtonElement>(entering?'.canvas-viewing-action[role="menuitem"]':'.board-action-exit')!
    const shell=document.querySelector<HTMLElement>('.app-shell')!
    const before=scene.style.cssText
    if(shell.classList.contains('is-viewing')===entering)throw new Error('Viewing transition must start in the opposite mode')
    // Exiting first awaits the writer-lease check. Anchor animation samples to
    // the committed class change, not to the click that starts that async check.
    const start=await new Promise<number>((resolve,reject)=>{
      const observer=new MutationObserver(()=>{
        if(shell.classList.contains('is-viewing')!==entering)return
        observer.disconnect();clearTimeout(timeout);resolve(performance.now())
      })
      const timeout=setTimeout(()=>{
        observer.disconnect();reject(new Error('Viewing mode did not change after the authorized action'))
      },5000)
      observer.observe(shell,{attributes:true,attributeFilter:['class']})
      trigger.click()
    })
    const samples=[]
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    for(const at of [0,80,160,360]){
      while(performance.now()-start<at)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
      const style=getComputedStyle(header)
      samples.push({
        header:Number(style.opacity),y:new DOMMatrix(style.transform).f,
        tools:Number(getComputedStyle(palette).opacity),exit:Number(getComputedStyle(exit).opacity),
        camera:scene.style.cssText,headerInert:header.inert,paletteInert:palette.inert,exitInert:exit.inert,
      })
    }
    return {before,samples}
  },entering)
}

test('viewing fades and lifts the chrome in both directions without moving the camera',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'})
  await openBoard(page)
  const entered=await transitionFrames(page,true)
  const middle=entered.samples[1],end=entered.samples.at(-1)!
  expect(middle.header).toBeGreaterThan(0);expect(middle.header).toBeLessThan(1)
  expect(middle.y).toBeLessThan(0);expect(middle.y).toBeGreaterThan(-24)
  expect(middle.tools).toBeGreaterThan(0);expect(middle.tools).toBeLessThan(1)
  expect(end.header).toBe(0);expect(end.tools).toBe(0);expect(end.exit).toBe(1)
  for(const sample of entered.samples){
    expect(sample.camera).toBe(entered.before)
    expect(sample.headerInert).toBe(true);expect(sample.paletteInert).toBe(true);expect(sample.exitInert).toBe(false)
  }
  await expect(page.locator('.board-action-exit')).toBeFocused()
  await expect(page.locator('.topbar')).toBeHidden()
  const exited=await transitionFrames(page,false)
  expect(exited.samples[1].header).toBeGreaterThan(0);expect(exited.samples[1].header).toBeLessThan(1)
  expect(exited.samples[1].y).toBeLessThan(0)
  for(const sample of exited.samples){expect(sample.camera).toBe(exited.before);expect(sample.exitInert).toBe(true)}
  expect(exited.samples.at(-1)!.header).toBe(1)
  await expect(page.locator('.board-viewport')).toBeFocused()
  await expect(page.locator('.board-action-exit')).toBeHidden()
})

test('rapid reversals settle correctly, and fading controls cannot steal focus',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'})
  await openBoard(page)
  const camera=await page.locator('.scene').getAttribute('style')
  await openViewingMenu(page)
  await page.evaluate(async()=>{
    const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
    document.querySelector<HTMLButtonElement>('.canvas-viewing-action[role="menuitem"]')!.click()
    await wait(80)
    document.querySelector<HTMLButtonElement>('.board-action-exit')!.click()
    await wait(70)
    const viewport=document.querySelector<HTMLElement>('.board-viewport')!,bounds=viewport.getBoundingClientRect()
    viewport.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:bounds.x+12,clientY:bounds.y+180}))
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
    document.querySelector<HTMLButtonElement>('.canvas-viewing-action[role="menuitem"]')!.click()
  })
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.locator('.tool-palette')).toBeHidden()
  await expect(page.locator('.board-action-exit')).toHaveCSS('opacity','1')
  await expect(page.locator('.scene')).toHaveAttribute('style',camera!)
  await page.evaluate(()=>{
    document.querySelector<HTMLButtonElement>('.share-button')!.focus()
    document.querySelector<HTMLButtonElement>('.board-action-editing')!.focus()
  })
  await expect(page.locator('.board-action-exit')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.topbar')).toHaveCSS('opacity','1')
  await expect(page.locator('.board-action-exit')).toBeHidden()
})

test('reduced motion switches immediately and retains the mobile layout and camera',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.emulateMedia({reducedMotion:'reduce'})
  await openBoard(page)
  const camera=await page.locator('.scene').getAttribute('style')
  await (await openViewingMenu(page)).click()
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.locator('.tool-palette')).toBeHidden()
  await expect(page.locator('.board-action-exit')).toHaveCSS('opacity','1')
  expect(await page.locator('.topbar').evaluate(el=>el.getAnimations().length)).toBe(0)
  await expect(page.locator('.board-actions > button:visible')).toHaveCount(2)
  await expect(page.locator('.board-action-exit')).toBeInViewport()
  await expect(page.locator('.scene')).toHaveAttribute('style',camera!)
  await page.getByRole('button',{name:'退出观赏模式',exact:true}).click()
  await expect(page.locator('.topbar')).toHaveCSS('opacity','1')
  await expect(page.locator('.scene')).toHaveAttribute('style',camera!)
  await expect(page.locator('.board-viewport')).toBeFocused()
})
