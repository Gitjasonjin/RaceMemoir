import {test,expect} from '@playwright/test'
test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true})

test('mobile toolbars and canvas editor return preserve library navigation',async({page},info)=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'移动收藏板',items:[{id:'medal',kind:'medal',title:'测试奖牌',variant:'bronze',x:70,y:190,w:160,h:260,rotation:0}],threads:[]}))})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  const undo=page.getByRole('button',{name:'撤销',exact:true}),ub=(await undo.boundingBox())!,icon=(await undo.locator('svg').boundingBox())!
  expect(Math.abs(ub.x+ub.width/2-icon.x-icon.width/2)).toBeLessThan(1)
  expect(Math.abs(ub.y+ub.height/2-icon.y-icon.height/2)).toBeLessThan(1)
  await page.locator('[data-board-item=medal]').tap()
  const toolbar=page.locator('.selection-bar'),bounds=(await toolbar.boundingBox())!
  expect(bounds.width).toBeLessThan(374);expect(Math.abs(bounds.x+bounds.width/2-195)).toBeLessThan(1)
  expect(await toolbar.evaluate(el=>getComputedStyle(el).backgroundImage)).toBe(await page.locator('.tool-palette').evaluate(el=>getComputedStyle(el).backgroundImage))
  await expect(page.getByRole('button',{name:'取消选择'})).toHaveCount(0)
  await page.screenshot({path:info.outputPath('toolbars.png')})
  await page.getByRole('button',{name:'编辑物件'}).tap()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.getByRole('button',{name:'返回画布'}).tap();await expect(page.locator('.record-panel')).toHaveCount(0)
  await page.getByRole('button',{name:'打开收藏库',exact:true}).tap()
  await page.locator('.record-row-main').filter({hasText:'测试奖牌'}).tap()
  await page.getByRole('button',{name:'返回收藏库'}).tap()
  await expect(page.getByRole('heading',{name:'我的收藏库'})).toBeVisible()
})

test('material previews wait for decoding and reopen from cache',async({page},info)=>{
  let release!:()=>void
  const delayed=new Promise<void>(resolve=>release=resolve)
  await page.route('**/textures/kraft-photo.webp',async route=>{await delayed;await route.continue()})
  await page.addInitScript(()=>localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'我的越野记忆',backgroundStyle:'kraft',items:[],threads:[]})))
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'分享',exact:true}).tap()
  const preview=page.locator('.share-preview .material-preview-layer')
  await expect(preview).toHaveAttribute('data-ready','false');await expect(preview).toHaveCSS('visibility','hidden')
  release();await expect(preview).toHaveAttribute('data-ready','true');await expect(preview).toHaveCSS('opacity','1')
  await page.screenshot({path:info.outputPath('share.png')})
  await page.getByRole('button',{name:'关闭',exact:true}).tap()
  await page.getByRole('button',{name:'分享',exact:true}).tap();await expect(preview).toHaveAttribute('data-ready','true')
  await page.getByRole('button',{name:'关闭',exact:true}).tap()
  await page.getByRole('button',{name:'装饰样式',exact:true}).tap()
  await expect(page.locator('.background-sample .material-preview-layer[data-ready=true]')).toHaveCount(4)
  await page.screenshot({path:info.outputPath('backgrounds.png')})
})
