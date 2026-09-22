import {test,expect} from '@playwright/test'
const key='racememoir-board-v1'
test('layout alignment grouping locking snapping overlap and reload',async({page},info)=>{
 await page.addInitScript(({key})=>{localStorage.setItem('racememoir-snap-enabled','true');if(!sessionStorage.getItem('layout-fixture')){localStorage.setItem(key,JSON.stringify({title:'Layout',items:[
 {id:'a',kind:'note',title:'A',variant:'paper',x:200,y:150,w:100,h:100,rotation:0},
 {id:'b',kind:'note',title:'B',variant:'paper',x:380,y:230,w:100,h:100,rotation:0},
 {id:'c',kind:'note',title:'C',variant:'paper',x:580,y:300,w:100,h:100,rotation:0}],threads:[]}));sessionStorage.setItem('layout-fixture','1')}},{key})
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const button=(name:string)=>page.getByRole('button',{name,exact:true}),nodes=page.locator('.memory')
 const boxes=await nodes.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
 await page.keyboard.down('Control');await page.mouse.move(Math.min(...boxes.map(b=>b.x))-15,Math.min(...boxes.map(b=>b.y))-15);await page.mouse.down();await page.mouse.move(Math.max(...boxes.map(b=>b.right))+15,Math.max(...boxes.map(b=>b.bottom))+15,{steps:10});await page.mouse.up();await page.keyboard.up('Control')
 await expect(page.locator('.memory.selected')).toHaveCount(3)
 await button('对齐与分布').click();await page.screenshot({path:info.outputPath('layout-menu.png')});await page.getByRole('menuitem',{name:'顶部对齐',exact:true}).click()
 expect(new Set(await nodes.evaluateAll(els=>els.map(el=>(el as HTMLElement).style.top))).size).toBe(1)
 await button('对齐与分布').click();await page.getByRole('menuitem',{name:'水平等距分布',exact:true}).click()
 const xs=await nodes.evaluateAll(els=>els.map(el=>parseFloat((el as HTMLElement).style.left)));expect(xs[1]-xs[0]).toBeCloseTo(xs[2]-xs[1])
 await expect(button('取消组合')).toHaveCount(0)
 await button('组合物件').click();await expect(page.locator('.memory.is-grouped')).toHaveCount(3)
 await expect(button('组合物件')).toHaveCount(0);await expect(button('取消组合')).toHaveCount(1)
 const grouped=await nodes.evaluateAll(els=>els.map(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)})))
 const gr=(await button('便签：A').boundingBox())!
 await page.mouse.move(gr.x+30,gr.y+50);await page.mouse.down();await page.mouse.move(gr.x+75,gr.y+78,{steps:8});await page.mouse.up()
 const moved=await nodes.evaluateAll(els=>els.map(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)})))
 expect(moved[0].x).not.toBe(grouped[0].x)
 for(let i=1;i<3;i++){expect(moved[i].x-grouped[i].x).toBeCloseTo(moved[0].x-grouped[0].x);expect(moved[i].y-grouped[i].y).toBeCloseTo(moved[0].y-grouped[0].y)}
 await button('锁定物件').click();await expect(page.locator('.memory.is-locked')).toHaveCount(3)
 const before=await nodes.evaluateAll(els=>els.map(el=>el.getAttribute('style')))
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete')
 expect(await nodes.evaluateAll(els=>els.map(el=>el.getAttribute('style')))).toEqual(before)
 await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
 await button('便签：A').click();await expect(page.locator('.memory.selected')).toHaveCount(3)
 await button('解锁物件').click();await button('取消组合').click();await expect(button('取消组合')).toHaveCount(0);await expect(button('组合物件')).toHaveCount(1)
 await button('取消批量选择').click();await button('便签：A').click()
 await expect(button('对齐与分布')).toHaveCount(0);await expect(button('使用说明')).toHaveCount(0)
 await expect(page.locator('.memory-editor .record-heading small,.memory-editor .form-footer>span')).toHaveCount(0)
 const a=button('便签：A'),b=button('便签：B'),r=(await a.boundingBox())!,r2=(await b.boundingBox())!
 await page.mouse.move(r.x+40,r.y+50);await page.mouse.down();await page.mouse.move(r2.x+37,r2.y+50,{steps:10});await expect(page.locator('.snap-guide')).not.toHaveCount(0);await page.mouse.up()
 await expect(page.locator('.snap-guide')).toHaveCount(0)
 // Alt-click cycles through both overlapping notes without dragging either.
 await page.keyboard.down('Alt');await page.mouse.click(r2.x+40,r2.y+50);const one=await page.locator('.memory.selected').getAttribute('aria-label');await page.mouse.click(r2.x+40,r2.y+50);const two=await page.locator('.memory.selected').getAttribute('aria-label');await page.keyboard.up('Alt');expect(one).not.toBe(two)
 await button('撤销').click();expect(await a.getAttribute('style')).not.toBe(await b.getAttribute('style'))
})
