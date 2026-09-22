import {test,expect} from '@playwright/test'
import type {Page,CDPSession} from '@playwright/test'

test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1})
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true})
const camera=(page:Page)=>page.locator('.scene').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {x:m.e,y:m.f,scale:m.a}})
const board=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-board-v1')!))
async function setup(page:Page){
  await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'触屏收藏板',items:[{id:'n1',kind:'note',title:'第一场赛事',variant:'yellow',x:70,y:190,w:130,h:120,rotation:0},{id:'n2',kind:'note',title:'下一座山',variant:'paper',x:260,y:300,w:120,h:120,rotation:0}],threads:[]}))})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  return page.context().newCDPSession(page)
}
const send=(cdp:CDPSession,type:string,points:{id:number;x:number;y:number}[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points})
async function drag(cdp:CDPSession,x:number,y:number,dx:number,dy:number){
  await send(cdp,'touchStart',[{id:1,x,y}]);for(let i=1;i<=8;i++)await send(cdp,'touchMove',[{id:1,x:x+dx*i/8,y:y+dy*i/8}]);await send(cdp,'touchEnd',[])
}

test('native two-finger pinch and pan cancel item movement without creating edits or undo steps',async({page})=>{
  const cdp=await setup(page),before=await camera(page),original=await board(page)
  const box=(await page.locator('[data-board-item=n1]').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2
  await send(cdp,'touchStart',[{id:1,x,y}]);await send(cdp,'touchMove',[{id:1,x:x+15,y:y+10}])
  await send(cdp,'touchStart',[{id:1,x:x+15,y:y+10},{id:2,x:x+75,y:y+10}])
  await send(cdp,'touchMove',[{id:1,x:x-5,y:y+30},{id:2,x:x+115,y:y+30}])
  await expect.poll(async()=>(await camera(page)).scale).toBeCloseTo(before.scale*2,2)
  const pinched=await camera(page)
  await send(cdp,'touchEnd',[{id:2,x:x+115,y:y+30}]);await send(cdp,'touchMove',[{id:2,x:x+130,y:y+50}]);await send(cdp,'touchEnd',[])
  await expect(page.locator('.record-panel')).toHaveCount(0)
  await expect(button(page,'撤销')).toBeDisabled()
  await expect.poll(async()=>(await board(page)).items).toEqual(original.items)
  expect((await camera(page)).scale).toBe(pinched.scale)
  await drag(cdp,25,215,30,40)
  await expect.poll(async()=>(await camera(page)).x).toBeCloseTo(pinched.x+30,1)
  await expect.poll(async()=>(await camera(page)).y).toBeCloseTo(pinched.y+40,1)
})

test('single touch selects without editing, explicit edit opens bottom sheet and long press enables multi-select',async({page},info)=>{
  const cdp=await setup(page),item=page.locator('[data-board-item=n1]'),before=(await board(page)).items[0],box=(await item.boundingBox())!
  await drag(cdp,box.x+box.width/2,box.y+box.height/2,30,24)
  await expect.poll(async()=>(await board(page)).items[0].x).not.toBe(before.x)
  await button(page,'撤销').tap();await expect.poll(async()=>(await board(page)).items[0].x).toBe(before.x)
  await item.tap();await expect(page.locator('.record-panel')).toHaveCount(0)
  await expect(item).toHaveAttribute('aria-pressed','true')
  await button(page,'编辑物件').tap();await expect(page.locator('.record-panel')).toBeVisible()
  const panel=(await page.locator('.record-panel').boundingBox())!
  expect(panel.x).toBe(0);expect(panel.width).toBe(390);expect(panel.y).toBeGreaterThan(150)
  expect(await page.locator('textarea').evaluate(el=>document.activeElement===el)).toBe(false)
  await page.screenshot({path:info.outputPath('mobile-editor.png')})
  await button(page,'关闭详情').tap()
  const fresh=(await item.boundingBox())!
  await send(cdp,'touchStart',[{id:1,x:fresh.x+fresh.width/2,y:fresh.y+fresh.height/2}]);await page.waitForTimeout(650)
  await item.dispatchEvent('contextmenu',{pointerType:'touch',clientX:fresh.x,clientY:fresh.y})
  await expect(page.getByRole('menu',{name:'画布菜单'})).toHaveCount(0)
  await send(cdp,'touchEnd',[])
  await expect(button(page,'结束多选')).toHaveAttribute('aria-pressed','true')
  await page.locator('[data-board-item=n2]').tap();await expect(page.locator('.memory.selected')).toHaveCount(2)
  await expect(page.locator('.record-panel')).toHaveCount(0)
  await button(page,'组合物件').tap();await expect.poll(async()=>(await board(page)).items[0].groupId).toBeTruthy()
  await button(page,'取消组合').tap();await button(page,'结束多选').tap()
  await expect(page.locator('.selection-bar')).toHaveCSS('flex-wrap','nowrap')
  await button(page,'调整物件层级').tap()
  const menu=page.getByRole('menu',{name:'调整物件层级'}),mb=(await menu.boundingBox())!
  expect(mb.x).toBeGreaterThanOrEqual(0);expect(mb.x+mb.width).toBeLessThanOrEqual(390)
  await expect(menu.getByRole('menuitem',{name:'上移一层'})).toBeInViewport()
  await button(page,'调整物件层级').tap()
  await page.screenshot({path:info.outputPath('mobile-board.png')})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
})

test('touch drag responds to a small initial movement and cancelling keeps undo clean',async({page})=>{
  const cdp=await setup(page),item=page.locator('[data-board-item=n1]'),before=(await item.boundingBox())!
  const x=before.x+before.width/2,y=before.y+before.height/2
  await send(cdp,'touchStart',[{id:1,x,y}]);await send(cdp,'touchMove',[{id:1,x:x+4,y}])
  await expect.poll(async()=>(await item.boundingBox())!.x-before.x).toBeCloseTo(4,0)
  await expect(item.locator('.memory-artwork')).toHaveCSS('filter','none')
  await send(cdp,'touchCancel',[])
  await expect.poll(async()=>(await item.boundingBox())!.x).toBeCloseTo(before.x,0)
  await expect(button(page,'撤销')).toBeDisabled();await expect(page.locator('.record-panel')).toHaveCount(0)
})

test('mobile hint icon is centered and decoration samples stay inside the scrolling body',async({page},info)=>{
  await setup(page)
  const text=(await page.locator('.bottom-hint>span').boundingBox())!,icon=(await button(page,'快捷键与帮助').locator('svg').boundingBox())!
  expect(Math.abs(text.y+text.height/2-icon.y-icon.height/2)).toBeLessThan(2)
  await button(page,'装饰样式').tap()
  const heading=page.locator('.decoration-panel>.decoration-heading'),scroll=page.locator('.decoration-panel>.decoration-scroll'),before=(await heading.boundingBox())!
  await scroll.evaluate(el=>{const pin=el.querySelector('.pin-sample')!;el.scrollTop+=pin.getBoundingClientRect().top-el.getBoundingClientRect().top+25})
  await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(200)
  expect(await heading.boundingBox()).toEqual(before)
  const body=(await scroll.boundingBox())!;expect(body.y).toBeGreaterThanOrEqual(before.y+before.height-1)
  expect(await heading.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+10))})).toBe(true)
  await page.screenshot({path:info.outputPath('mobile-decoration-scroll.png')})
  await button(page,'关闭装饰样式').tap();await expect(page.locator('.decoration-panel')).toHaveCount(0)
})

test('help close stays compact and background pan keeps the buffered texture aligned',async({page},info)=>{
  const cdp=await setup(page)
  await button(page,'快捷键与帮助').tap()
  const close=page.getByRole('dialog',{name:'你的山野记忆，由你摆放'}).getByRole('button',{name:'关闭',exact:true})
  await expect(close).toHaveCSS('width','32px');await expect(close).toHaveCSS('height','32px')
  await expect(close.locator('svg')).toHaveCSS('width','18px')
  await page.screenshot({path:info.outputPath('mobile-help.png')});await close.tap()
  const texture=page.locator('.board-material-texture')
  const start=(await camera(page)),position=await texture.evaluate(el=>(el as HTMLElement).style.backgroundPosition)
  await drag(cdp,15,195,20,20)
  // Small pans reuse painted pixels, rather than changing CSS background-position.
  expect(await texture.evaluate(el=>(el as HTMLElement).style.backgroundPosition)).toBe(position)
  await expect.poll(async()=>(await camera(page)).x).toBeCloseTo(start.x+20,1)
  for(let i=0;i<4;i++)await drag(cdp,15,195,90,30)
  const view=await camera(page),phase=await texture.evaluate(el=>{
    const s=getComputedStyle(el),m=new DOMMatrix(s.transform),p=s.backgroundPosition.split(' ').map(parseFloat),r=el.getBoundingClientRect()
    return {x:p[0]+m.e+parseFloat(s.left),y:p[1]+m.f+parseFloat(s.top),width:r.width,height:r.height}
  })
  expect(phase.x).toBeCloseTo(view.x,1);expect(phase.y).toBeCloseTo(view.y,1)
  expect(phase.width).toBe(390+512);expect(phase.height).toBeLessThanOrEqual(844+512)
  await expect(button(page,'撤销')).toBeDisabled()
  await page.screenshot({path:info.outputPath('mobile-background-pan.png')})
})

test('map preview pinch and pan stay independent of board camera and sidebar scrolling',async({page},info)=>{
  const cdp=await setup(page)
  await button(page,'添加地图').scrollIntoViewIfNeeded();await button(page,'添加地图').tap()
  const before=await camera(page),svg=page.locator('.race-map-editor-preview .race-map-canvas>svg'),r=(await svg.boundingBox())!
  const x=r.x+r.width/2,y=r.y+r.height/2
  await send(cdp,'touchStart',[{id:1,x:x-25,y}]);await send(cdp,'touchStart',[{id:1,x:x-25,y},{id:2,x:x+25,y}])
  await send(cdp,'touchMove',[{id:1,x:x-50,y},{id:2,x:x+50,y}]);await send(cdp,'touchEnd',[])
  await expect(page.locator('.race-map-tools')).toContainText('200%')
  await drag(cdp,x,y,15,10)
  expect(await camera(page)).toEqual(before)
  const scroll=page.locator('.race-map-editor .record-scroll')
  await drag(cdp,365,r.y+r.height+110,0,-100)
  await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(20)
  await page.screenshot({path:info.outputPath('mobile-map.png')})
  await button(page,'保存修改').scrollIntoViewIfNeeded();await button(page,'保存修改').tap()
  await expect.poll(async()=>(await board(page)).items.find((i:any)=>i.kind==='race-map')?.mapView?.scale).toBeCloseTo(2,1)
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  expect((await board(page)).items.find((i:any)=>i.kind==='race-map').mapView.scale).toBeCloseTo(2,1)
})

test('photo preview pinch changes crop only, cancel rolls back and saved crop survives reload',async({page},info)=>{
  const cdp=await setup(page)
  await button(page,'添加照片').tap()
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d')!;ctx.fillStyle='#508699';ctx.fillRect(0,0,600,400);ctx.fillStyle='white';ctx.font='40px sans-serif';ctx.fillText('Touch photo',100,180);return c.toDataURL().split(',')[1]})
  await page.locator('.record-upload input').setInputFiles({name:'Touch.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
  const area=page.locator('.photo-composition-preview .photo-image'),im=area.locator('img'),frame=page.locator('.photo-composition-preview')
  await expect(im).toBeVisible();const before=await frame.boundingBox(),r=(await area.boundingBox())!,x=r.x+r.width/2,y=r.y+r.height/2
  const pinch=async(cancel=false)=>{await send(cdp,'touchStart',[{id:1,x:x-25,y}]);await send(cdp,'touchStart',[{id:1,x:x-25,y},{id:2,x:x+25,y}]);await send(cdp,'touchMove',[{id:1,x:x-50,y},{id:2,x:x+50,y}]);await send(cdp,cancel?'touchCancel':'touchEnd',[])}
  await pinch(true);await expect(im).toHaveCSS('width',`${r.width}px`)
  await pinch();expect(await frame.boundingBox()).toEqual(before)
  await expect.poll(()=>im.evaluate(el=>el.getBoundingClientRect().width)).toBeCloseTo(r.width*2,0)
  await drag(cdp,x,y,25,15)
  await page.screenshot({path:info.outputPath('mobile-photo.png')})
  await button(page,'保存并放上画布').scrollIntoViewIfNeeded();await button(page,'保存并放上画布').tap()
  await expect(page.locator('.record-panel')).toHaveCount(0)
  await expect.poll(async()=>(await board(page)).items.find((i:any)=>i.kind==='photo')?.photoZoom).toBeCloseTo(2,1)
  const saved=(await board(page)).items.find((i:any)=>i.kind==='photo');expect(saved.photoX).toBeLessThan(50);expect(saved.photoY).toBeLessThan(50)
  await button(page,'撤销').tap();await expect(page.locator('.memory-photo')).toHaveCount(0)
  await button(page,'重做').tap();await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  expect((await board(page)).items.find((i:any)=>i.kind==='photo')).toEqual(saved)
})

test('phone landscape and keyboard-sized viewport keep tools and editors reachable',async({page},info)=>{
  await setup(page);await page.setViewportSize({width:844,height:390})
  await expect.poll(()=>page.locator('.app-shell').evaluate(el=>el.getBoundingClientRect().height)).toBe(390)
  await expect(button(page,'添加照片')).toBeInViewport()
  for(const label of await page.locator('.share-button span').all())await expect(label).toBeHidden();await expect(page.locator('.minimap')).toBeHidden()
  await page.screenshot({path:info.outputPath('mobile-landscape.png')})
  await button(page,'添加便签').tap();await expect(page.locator('.record-panel')).toBeInViewport()
  let p=(await page.locator('.record-panel').boundingBox())!;expect(p.y+p.height).toBeLessThanOrEqual(391)
  await page.setViewportSize({width:320,height:420})
  await page.locator('textarea').fill('手机编辑')
  const save=button(page,'放上收藏板');await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport()
  p=(await page.locator('.record-panel').boundingBox())!;expect(p.y+p.height).toBeLessThanOrEqual(421)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0)
  await page.screenshot({path:info.outputPath('mobile-compact.png')})
})

test('touch marquee, blank long press menu and pinch while connecting do not create accidental links',async({page})=>{
  const cdp=await setup(page)
  await button(page,'多选物件').tap()
  const a=(await page.locator('[data-board-item=n1]').boundingBox())!,b=(await page.locator('[data-board-item=n2]').boundingBox())!
  await drag(cdp,a.x-8,a.y-8,b.x+b.width-a.x+16,b.y+b.height-a.y+16)
  await expect(page.locator('.memory.selected')).toHaveCount(2)
  await button(page,'结束多选').tap()
  await send(cdp,'touchStart',[{id:1,x:20,y:210}]);await page.waitForTimeout(650);await send(cdp,'touchEnd',[])
  await expect(page.getByRole('menu',{name:'画布菜单'})).toBeVisible();await page.getByRole('menuitemcheckbox',{name:'吸附模式'}).tap()
  await button(page,'添加连线').scrollIntoViewIfNeeded();await button(page,'添加连线').tap()
  const first={id:1,x:a.x+a.width/2,y:a.y+a.height/2},second={id:2,x:first.x+60,y:first.y}
  await send(cdp,'touchStart',[first]);await send(cdp,'touchStart',[first,second]);await send(cdp,'touchMove',[{...first,x:first.x-15},{...second,x:second.x+15}]);await send(cdp,'touchEnd',[])
  await expect.poll(async()=>(await board(page)).threads).toEqual([])
  await expect(page.locator('.pin-active')).toHaveCount(0)
})
