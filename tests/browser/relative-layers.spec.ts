import {test,expect} from '@playwright/test'
test('target layer placement supports groups, overlap cycling, cancel, undo and reload',async({page},info)=>{
 await page.addInitScript(()=>{if(sessionStorage.getItem('relative-fixture'))return;sessionStorage.setItem('relative-fixture','1');localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Layers',items:[
 {id:'a',kind:'note',title:'A',variant:'paper',x:180,y:180,w:150,h:120,rotation:0},
 {id:'b',kind:'note',title:'B',variant:'paper',x:430,y:200,w:150,h:120,rotation:0},
 {id:'c',kind:'note',title:'C',variant:'paper',x:430,y:200,w:150,h:120,rotation:0},
 {id:'d',kind:'note',title:'D',variant:'paper',x:650,y:200,w:130,h:120,rotation:0,groupId:'g'},
 {id:'e',kind:'note',title:'E',variant:'paper',x:820,y:200,w:130,h:120,rotation:0,groupId:'g'}],threads:[]}))})
 const button=(name:string)=>page.getByRole('button',{name,exact:true}),node=(title:string)=>button(`便签：${title}`)
 const order=()=>page.locator('.scene>.memory').evaluateAll(els=>els.map(e=>e.getAttribute('aria-label')!.slice(3)).join(''))
 const begin=async(action:string)=>{await button('调整物件层级').click();await button(action).click()}
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const original=await page.locator('.memory').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.getAttribute('aria-label'),el.getAttribute('style')])))
 await node('A').click();await begin('放到指定物件下方');await node('C').hover()
 await expect(node('C')).toHaveClass(/layer-target-highlight/)
 const r=(await node('C').boundingBox())!;await page.keyboard.down('Alt');await page.mouse.click(r.x+60,r.y+70);await page.keyboard.up('Alt')
 await expect(node('B')).toHaveClass(/layer-target-highlight/);await expect(page.locator('[data-layer-target-hint]')).toContainText('B')
 await page.screenshot({path:info.outputPath('relative-layers.png')})
 await page.keyboard.press('Enter');expect(await order()).toBe('abcde'.toUpperCase())
 await begin('放到指定物件上方');await node('D').hover();await expect(page.locator('.layer-target-highlight')).toHaveCount(2);await node('D').click()
 expect(await order()).toBe('BCDEA');await expect(page.locator('[data-layer-target-hint]')).toHaveCount(0)
 const after=await page.locator('.memory').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.getAttribute('aria-label'),el.getAttribute('style')])));expect(after).toEqual(original)
 await button('撤销').click();expect(await order()).toBe('ABCDE');await button('重做').click();expect(await order()).toBe('BCDEA')
 await node('A').click();await begin('放到指定物件下方');await node('C').hover();await page.keyboard.press('Escape');expect(await order()).toBe('BCDEA');await expect(node('A')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.layer-target-highlight')).toHaveCount(0)
 await node('D').click();await begin('放到指定物件下方');await node('C').click();expect(await order()).toBe('BDECA')
 await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});expect(await order()).toBe('BDECA')
 await node('D').click();await button('锁定物件').click();await button('调整物件层级').click();await expect(button('放到指定物件下方')).toBeDisabled()
})
