import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function open(page:Page){
  await page.addInitScript(()=>localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Interaction',items:[
    {id:'a',kind:'note',title:'A',variant:'paper',x:200,y:150,w:140,h:130,rotation:0},
    {id:'b',kind:'note',title:'B',variant:'paper',x:500,y:300,w:140,h:130,rotation:0}
  ],threads:[]})))
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
}

test('menu arrows do not move canvas objects; Escape returns focus and Enter executes once',async({page},info)=>{
  await open(page)
  const item=page.locator('[data-board-item=a]')
  await item.click()
  const before=await item.getAttribute('style'),trigger=page.getByRole('button',{name:'调整物件层级'})
  await trigger.focus();await page.keyboard.press('ArrowDown')
  const menu=page.getByRole('menu',{name:'调整物件层级'})
  await expect(menu).toBeVisible()
  await expect(page.getByRole('menuitem',{name:'上移一层'})).toBeFocused()
  await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'放到指定物件下方'})).toBeFocused()
  await page.keyboard.press('Home');await expect(page.getByRole('menuitem',{name:'上移一层'})).toBeFocused()
  expect(await item.getAttribute('style')).toBe(before)
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused()
  await expect(item).toHaveAttribute('aria-pressed','true')
  await trigger.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'上移一层'})).toBeFocused();await page.keyboard.press('Home');await page.keyboard.press('Enter')
  await expect(page.locator('.scene>.memory').last()).toHaveAttribute('data-board-item','a')
  expect(await item.getAttribute('style')).toBe(before)
  await trigger.click();await expect(menu).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath('keyboard-menu.png')})
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await expect(page.locator('.scene>.memory').first()).toHaveAttribute('data-board-item','a')
})

test('tooltips share styling, stay on screen and Escape only dismisses the hint',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'添加照片',exact:true}).hover()
  const hint=page.getByRole('tooltip')
  await expect(hint).toContainText('添加照片')
  const color=await hint.evaluate(el=>getComputedStyle(el).backgroundColor)
  await page.locator('[data-board-item=a]').click()
  await page.getByRole('button',{name:'向左旋转'}).hover()
  await expect(hint).toContainText('向左旋转')
  await expect(hint).toHaveCSS('background-color',color)
  const r=(await hint.boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0)
  await page.keyboard.press('Escape');await expect(hint).toHaveCount(0)
  await expect(page.locator('[data-board-item=a]')).toHaveAttribute('aria-pressed','true')
})

test('dialog traps focus, restores its trigger and clear confirmation starts on cancel',async({page},info)=>{
  await open(page)
  const share=page.getByRole('button',{name:'分享',exact:true})
  await share.click()
  const dialog=page.getByRole('dialog',{name:'带走这份山野记忆'})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button',{name:'关闭',exact:true})).toBeFocused()
  for(let i=0;i<8;i++){
    await page.keyboard.press('Tab')
    await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true)
  }
  await page.screenshot({path:info.outputPath('share-dialog.png')})
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(share).toBeFocused()
  await share.click();await page.locator('.ui-dialog-viewport').click({position:{x:5,y:5}})
  await expect(dialog).toHaveCount(0)
  await page.locator('.board-viewport').click({button:'right',position:{x:10,y:180}})
  await page.getByRole('menuitem',{name:'清空画布',exact:true}).click()
  const clear=page.getByRole('dialog',{name:'清空当前画布？'})
  await expect(clear.getByRole('button',{name:'取消',exact:true})).toBeFocused()
  await page.keyboard.press('Escape');await expect(page.locator('[data-board-item]')).toHaveCount(2)
})
