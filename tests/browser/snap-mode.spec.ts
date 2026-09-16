import {test,expect} from '@playwright/test'

test('context menu toggles snapping and guides, remembers preference and stays within screen',async({page})=>{
 await page.addInitScript(()=>{
  if(sessionStorage.getItem('snap-fixture'))return
  localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Snap',items:[
   {id:'a',kind:'note',title:'A',variant:'paper',x:200,y:150,w:100,h:100,rotation:0},
   {id:'b',kind:'note',title:'B',variant:'paper',x:500,y:300,w:100,h:100,rotation:0}],threads:[]}))
  sessionStorage.setItem('snap-fixture','1')
 })
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const menu=page.getByRole('menu',{name:'画布菜单'}),toggle=page.getByRole('menuitemcheckbox',{name:'吸附模式'})
 const a=page.getByRole('button',{name:'便签：A',exact:true}),b=page.getByRole('button',{name:'便签：B',exact:true})
 await a.click({button:'right'});await expect(toggle).toHaveAttribute('aria-checked','false')
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0)
 const drag=async(enabled:boolean,alt=false)=>{
  const r=(await a.boundingBox())!,target=(await b.boundingBox())!
  await page.mouse.move(r.x+40,r.y+50);await page.mouse.down()
  if(alt)await page.keyboard.down('Alt')
  await page.mouse.move(r.x+70,target.y+53,{steps:8})
  if(enabled&&!alt)await expect(page.locator('.snap-guide')).not.toHaveCount(0)
  else await expect(page.locator('.snap-guide')).toHaveCount(0)
  const moved=(await a.boundingBox())!
  expect(moved.y-target.y).toBeCloseTo(enabled&&!alt?0:3,0)
  await page.mouse.up();if(alt)await page.keyboard.up('Alt')
  await expect(page.locator('.snap-guide')).toHaveCount(0)
 }
 await drag(false)
 await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
 await a.click({button:'right'});await expect(toggle).toHaveAttribute('aria-checked','false')
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0)
 await page.mouse.click(1434,840,{button:'right'});await expect(menu).toBeVisible()
 const bounds=(await menu.boundingBox())!;expect(bounds.x+bounds.width).toBeLessThanOrEqual(1440)
 await toggle.click();await drag(true);await drag(true,true)
 await a.click({button:'right'});await expect(toggle).toHaveAttribute('aria-checked','true')
 await page.mouse.click(1000,800);await expect(menu).toHaveCount(0)
})
