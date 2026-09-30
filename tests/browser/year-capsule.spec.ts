import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function openBoard(page:Page){
  await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Year placement',backgroundStyle:'dark-wood',items:[{id:'note',kind:'note',title:'Keep this memory',variant:'yellow',x:160,y:240,w:180,h:160,rotation:0}],threads:[]}))})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
}

const calendar=(page:Page)=>page.locator('.board-actions > .board-action-calendar')
const capsule=(page:Page)=>page.locator('.year-capsule')
async function settled(page:Page){
  await expect.poll(()=>capsule(page).evaluate(el=>el.getAnimations().every(animation=>animation.playState!=='running'))).toBe(true)
}
async function expectCentered(page:Page){
  await settled(page)
  const control=(await capsule(page).boundingBox())!,canvas=(await page.locator('.board-viewport').boundingBox())!
  expect(control.x+control.width/2).toBeCloseTo(canvas.x+canvas.width/2,1)
}
async function chooseBackground(page:Page,id:string,label:string){
  await page.getByRole('button',{name:'装饰样式',exact:true}).click()
  const panel=page.locator('[data-decoration-panel]'),option=panel.locator('.background-options').getByRole('button',{name:label,exact:true})
  await option.click();await expect(option).toHaveAttribute('aria-pressed','true')
  await panel.getByRole('button',{name:'关闭装饰样式',exact:true}).click();await expect(panel).toHaveCount(0)
  const texture=page.locator('.board-material-texture')
  await expect.poll(()=>texture.evaluate((el,id)=>getComputedStyle(el).backgroundImage.includes(`/textures/${id}-photo.webp`),id)).toBe(true)
  const loaded=await texture.evaluate(async el=>{
    const src=getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)/)![1],image=new Image()
    image.src=src;await image.decode();await new Promise(requestAnimationFrame)
    return {src,complete:image.complete,width:image.naturalWidth}
  })
  expect(loaded.src).toContain(`/textures/${id}-photo.webp`);expect(loaded.complete).toBe(true);expect(loaded.width).toBeGreaterThan(0)
}

test('desktop starts with an icon below the library and opens a fixed centered selector',async({page},info)=>{
  await page.addInitScript(()=>{localStorage.setItem('racememoir-year-capsule-position',JSON.stringify({x:980,y:620}));localStorage.setItem('racememoir-year-capsule-collapsed','false')})
  await openBoard(page)
  const buttons=page.locator('.board-actions > button'),icon=calendar(page)
  await expect(buttons).toHaveCount(3)
  await expect(buttons.nth(2)).toHaveClass(/board-action-calendar/)
  await expect(icon).toHaveAttribute('aria-label','赛季选择')
  await expect(icon).toHaveAttribute('aria-expanded','false')
  await expect(icon.locator('svg')).toHaveCount(1);await expect(icon.locator('.board-action-label')).toHaveCSS('opacity','0')
  await expect(capsule(page)).toBeHidden()
  const library=(await buttons.nth(1).boundingBox())!,calendarBox=(await icon.boundingBox())!
  expect(calendarBox.width).toBeCloseTo(44,1);expect(calendarBox.height).toBeCloseTo(44,1)
  expect(calendarBox.width).toBeCloseTo(library.width,1);expect(calendarBox.height).toBeCloseTo(library.height,1)
  expect(calendarBox.y).toBeGreaterThanOrEqual(library.y+library.height)
  expect(calendarBox.x+calendarBox.width).toBeCloseTo(library.x+library.width,1)
  await icon.hover();await expect(icon.locator('.board-action-label')).toHaveCSS('opacity','1')
  await expect(icon.locator('.board-action-label')).toHaveText('赛季选择')
  await expect.poll(async()=>((await icon.boundingBox())?.width??0)>calendarBox.width+40).toBe(true)
  const hovered=(await icon.boundingBox())!
  expect(hovered.x).toBeLessThan(calendarBox.x);expect(hovered.x+hovered.width).toBeCloseTo(calendarBox.x+calendarBox.width,1)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.mouse.move(700,500);await expect(icon).toHaveCSS('width','44px')
  const camera=await page.locator('.scene').getAttribute('style'),board=await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))
  await page.screenshot({path:info.outputPath('year-calendar-default.png')})
  await icon.click();await expect(capsule(page)).toBeVisible();await expect(capsule(page).locator('.year-capsule-trigger')).toBeFocused()
  await expect(icon).toHaveAttribute('aria-label','赛季选择');await expect(icon).toHaveAttribute('aria-expanded','true')
  await expectCentered(page)
  const original=(await capsule(page).boundingBox())!,header=(await page.locator('.topbar').boundingBox())!,gap=original.y-header.y-header.height
  expect(gap).toBeGreaterThanOrEqual(18);expect(gap).toBeLessThanOrEqual(22)
  await expect(capsule(page).locator('.year-capsule-grip,.year-capsule-calendar')).toHaveCount(0)
  await page.mouse.move(original.x+original.width/2,original.y+original.height-3)
  await page.mouse.down();await page.mouse.move(original.x+original.width/2+180,original.y+original.height+120,{steps:8});await page.mouse.up()
  const after=(await capsule(page).boundingBox())!
  expect(after.x).toBeCloseTo(original.x,1);expect(after.y).toBeCloseTo(original.y,1)
  expect(await page.locator('.scene').getAttribute('style')).toBe(camera)
  expect(await page.evaluate(()=>localStorage.getItem('racememoir-board-v1'))).toBe(board)
  await icon.click();await expect(capsule(page)).toBeHidden();await expect(icon).toBeFocused()
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(calendar(page)).toBeVisible();await expect(capsule(page)).toBeHidden()
  await icon.focus();await page.keyboard.press('Enter')
  const trigger=capsule(page).locator('.year-capsule-trigger')
  await expect(trigger).toBeFocused();await settled(page)
  await page.keyboard.press('Enter');await expect(page.locator('.year-capsule-menu')).toBeVisible()
  await page.keyboard.press('Escape');await expect(page.locator('.year-capsule-menu')).toBeHidden()
  await expect(trigger).toBeFocused();await expect(capsule(page)).toBeVisible()
  await page.keyboard.press('Escape');await expect(capsule(page)).toBeHidden();await expect(icon).toBeFocused()
  const point={x:original.x+original.width/2,y:original.y+original.height/2}
  expect(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.board-viewport'),point)).toBe(true)
  const beforePan=await page.locator('.scene').getAttribute('style')
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+45,point.y+30,{steps:6});await page.mouse.up()
  await expect(page.locator('.scene')).not.toHaveAttribute('style',beforePan!)
})

test('two season controls preserve selection and close menus with correct focus in three languages',async({page},info)=>{
  await openBoard(page)
  const year=new Date().getFullYear()
  for(const [language,choose,previous,next,all,allYears,collapse,launcher] of [
    ['简体中文','选择年份','上一年','下一年','全部','全部年份','收起赛季选择器','赛季选择'],
    ['English','Choose year','Previous year','Next year','All','All years','Collapse season selector','Select season'],
    ['日本語','年を選択','前年','翌年','すべて','すべての年','シーズン選択を閉じる','シーズン選択'],
  ]){
    await page.getByRole('button',{name:'Language / 语言 / 言語',exact:true}).click()
    await page.getByRole('menuitemradio',{name:language,exact:true}).click()
    const icon=calendar(page),trigger=capsule(page).getByRole('button',{name:choose,exact:true})
    await expect(icon).toHaveAttribute('aria-label',launcher)
    await icon.click();await expect(trigger).toBeFocused();await settled(page)
    await expect(icon).toHaveAttribute('aria-label',launcher);await expect(icon).toHaveAttribute('aria-expanded','true')
    await expect(capsule(page).locator('.year-capsule-all')).toHaveCount(0)
    await expect(capsule(page).getByRole('button',{name:all,exact:true})).toHaveCount(0)
    await trigger.click()
    const options=page.locator('.year-capsule-menu').getByRole('menuitemradio')
    await expect(options).toHaveCount(2);await expect(options).toHaveText([String(year),String(year-1)])
    await expect(page.getByRole('menuitemradio',{name:allYears,exact:true})).toHaveCount(0)
    await page.getByRole('menuitemradio',{name:String(year),exact:true}).click()
    await expect(capsule(page).getByRole('button',{name:next,exact:true})).toBeDisabled()
    await expect(page.locator('[data-board-item=note]')).toBeVisible()
    await capsule(page).getByRole('button',{name:previous,exact:true}).click();await expect(trigger).toContainText(String(year-1))
    await expect(capsule(page).getByRole('button',{name:previous,exact:true})).toBeDisabled()
    await expect(page.locator('[data-board-item]')).toHaveCount(0)
    await capsule(page).getByRole('button',{name:next,exact:true}).click();await expect(trigger).toContainText(String(year))
    await expect(page.locator('[data-board-item=note]')).toBeVisible()
    await trigger.click();await expect(page.getByRole('menuitemradio',{name:String(year),exact:true})).toHaveAttribute('aria-checked','true')
    const menu=(await page.locator('.year-capsule-menu').boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0);expect(menu.y+menu.height).toBeLessThanOrEqual(1000)
    await capsule(page).getByRole('button',{name:collapse,exact:true}).click()
    await expect(capsule(page)).toBeHidden();await expect(page.locator('.year-capsule-menu')).toBeHidden();await expect(icon).toBeFocused()
    await expect(icon).toHaveAttribute('aria-label',launcher);await expect(icon).toHaveAttribute('aria-expanded','false')
    await icon.click();await expect(trigger).toBeFocused()
    await expect(trigger).toContainText(String(year))
    await settled(page);await trigger.click();await page.getByRole('menuitemradio',{name:String(year-1),exact:true}).click()
    await trigger.click();await icon.click()
    await expect(page.locator('.year-capsule-menu')).toBeHidden();await expect(capsule(page)).toBeHidden();await expect(icon).toBeFocused()
    await icon.click();await expect(trigger).toBeFocused();await expect(trigger).toContainText(String(year-1))
    await expectCentered(page)
    await page.screenshot({path:info.outputPath(`year-selector-${language}.png`)})
    await icon.click()
  }
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(capsule(page)).toBeHidden()
  await calendar(page).click();await expect(capsule(page).locator('.year-capsule-trigger')).toBeFocused()
  await expect(capsule(page).locator('.year-capsule-trigger')).toContainText(String(year-1))
  await expect(page.locator('[data-board-item]')).toHaveCount(0)
})

test('selector drops into place, clears the lamp and stays centered with reduced motion and resize',async({page},info)=>{
  await openBoard(page);await page.emulateMedia({reducedMotion:'no-preference'})
  await calendar(page).click()
  await expect(capsule(page)).toHaveCSS('animation-name','year-capsule-drop')
  const motion=await capsule(page).evaluate(el=>{
    const animation=el.getAnimations().find(animation=>animation instanceof CSSAnimation&&animation.animationName==='year-capsule-drop')!
    return {duration:parseFloat(getComputedStyle(el).animationDuration),frames:(animation.effect as KeyframeEffect).getKeyframes().map(frame=>String(frame.transform??''))}
  })
  expect(motion.duration).toBeGreaterThanOrEqual(.6);expect(motion.duration).toBeLessThanOrEqual(.64)
  expect(motion.frames.some(transform=>/rotate\(/.test(transform)&&!/rotate\(0(?:deg)?\)/.test(transform))).toBe(true)
  await capsule(page).evaluate(el=>{const animation=el.getAnimations()[0];animation.pause();animation.currentTime=322})
  await page.screenshot({path:info.outputPath('year-selector-impact.png')})
  await capsule(page).evaluate(el=>{const animation=el.getAnimations()[0];animation.currentTime=434})
  await page.screenshot({path:info.outputPath('year-selector-rebound.png')})
  await capsule(page).evaluate(el=>el.getAnimations()[0].play())
  await expectCentered(page)
  expect(await capsule(page).evaluate(el=>Math.abs(new DOMMatrix(getComputedStyle(el).transform).b))).toBeLessThan(.001)
  await page.getByRole('button',{name:'装饰样式',exact:true}).click()
  await page.getByRole('switch',{name:'开启灯具与光照',exact:true}).click()
  await page.getByRole('button',{name:'关闭装饰样式',exact:true}).click()
  await expect(page.locator('.app-shell')).toHaveAttribute('data-light','on')
  await expect.poll(async()=>{const control=(await capsule(page).boundingBox())!,lamp=(await page.locator('.board-light-fixtures .pendant-lamp').boundingBox())!;return control.y-lamp.y-lamp.height}).toBeGreaterThanOrEqual(12)
  await expectCentered(page)
  await page.screenshot({path:info.outputPath('year-selector-below-lamp.png')})
  await page.setViewportSize({width:620,height:300});await expectCentered(page)
  const small=(await capsule(page).boundingBox())!
  expect(small.x).toBeGreaterThanOrEqual(0);expect(small.x+small.width).toBeLessThanOrEqual(620);expect(small.y+small.height).toBeLessThanOrEqual(300)
  await calendar(page).click();await expect(capsule(page)).toBeHidden()
  await page.emulateMedia({reducedMotion:'reduce'});await calendar(page).click()
  await expect(capsule(page)).toHaveCSS('animation-name','none')
  await expect(capsule(page).locator('.year-capsule-trigger')).toBeFocused();await expectCentered(page)
})

test('selector fades upward without blocking the board and supports reopening during exit',async({page},info)=>{
  await openBoard(page);await page.emulateMedia({reducedMotion:'no-preference'})
  const icon=calendar(page),stage=page.locator('.year-capsule-stage')
  await icon.click();await expectCentered(page)
  const initial=(await capsule(page).boundingBox())!
  await capsule(page).getByRole('button',{name:'收起赛季选择器',exact:true}).click()
  await expect(stage).toHaveAttribute('data-exiting')
  const exit=await stage.evaluate((el,initial)=>{
    const animation=el.getAnimations({subtree:true}).find(animation=>animation instanceof CSSAnimation)!
    animation.pause()
    const duration=Number(animation.effect!.getComputedTiming().duration)
    animation.currentTime=duration*.7
    const nav=el.querySelector('.year-capsule')!,point={x:initial.x+initial.width/2,y:initial.y+initial.height/2}
    const result={duration,frames:(animation.effect as KeyframeEffect).getKeyframes().map(frame=>({opacity:Number(frame.opacity),transform:String(frame.transform??'')})),
      y:nav.getBoundingClientRect().y,pointerEvents:getComputedStyle(nav).pointerEvents,inert:el.hasAttribute('inert'),
      boardReceivesPointer:!!document.elementFromPoint(point.x,point.y)?.closest('.board-viewport')}
    animation.play()
    return result
  },initial)
  expect(exit.duration).toBeGreaterThan(0)
  expect(exit.frames.at(-1)!.opacity).toBe(0)
  expect(exit.frames.some(frame=>/translateY\(-/.test(frame.transform))).toBe(true)
  expect(exit.y).toBeLessThan(initial.y);expect(exit.pointerEvents).toBe('none');expect(exit.inert).toBe(true)
  expect(exit.boardReceivesPointer).toBe(true)
  await expect(icon).toBeFocused();await expect(icon).toHaveAttribute('aria-expanded','false')
  await expect(stage).toHaveCount(0)

  await icon.click();await expectCentered(page)
  await icon.click();await expect(stage).toHaveAttribute('data-exiting')
  await stage.evaluate(el=>el.getAnimations({subtree:true}).forEach(animation=>animation.pause()))
  await icon.click();await expect(stage).not.toHaveAttribute('data-exiting')
  await expect(capsule(page).locator('.year-capsule-trigger')).toBeFocused();await expectCentered(page)
  await capsule(page).evaluate(el=>el.dispatchEvent(new AnimationEvent('animationend',{animationName:'year-capsule-dismiss',bubbles:true})))
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,400)))
  await expect(capsule(page)).toBeVisible();await expect(icon).toHaveAttribute('aria-expanded','true')
  await page.screenshot({path:info.outputPath('race-selector-reopened.png')})

  await page.emulateMedia({reducedMotion:'reduce'})
  await icon.click();await expect(stage).toHaveCount(0)
  await expect(icon).toBeFocused()
})

test('centered selector and right calendar stay legible on four actual board backgrounds',async({page},info)=>{
  await openBoard(page);await page.emulateMedia({reducedMotion:'reduce'})
  for(const [background,label] of [['cork','软木板'],['dark-wood','深色木板'],['kraft','牛皮纸'],['chalkboard','黑板']]){
    await chooseBackground(page,background,label)
    await expect(calendar(page)).toBeVisible();await expect(calendar(page).locator('.board-action-label')).toHaveCSS('opacity','0')
    await calendar(page).click();await expect(capsule(page)).toBeVisible();await expectCentered(page)
    await page.mouse.move(700,500)
    await page.screenshot({path:info.outputPath(`year-selector-${background}.png`)})
    await calendar(page).click();await expect(capsule(page)).toBeHidden()
  }
})

test('phone and larger touch screens retain their existing two board actions without year controls',async({browser},info)=>{
  for(const mobile of [true,false]){
    const context=await browser.newContext({baseURL:info.project.use.baseURL,hasTouch:true,isMobile:mobile,viewport:mobile?{width:390,height:844}:{width:1440,height:1000},locale:'zh-CN'})
    const page=await context.newPage()
    try{
      await openBoard(page)
      await expect(page.locator('.board-actions > button')).toHaveCount(2)
      await expect(calendar(page)).toHaveCount(0)
      await expect(capsule(page)).toHaveCount(0)
    }finally{await context.close()}
  }
})
