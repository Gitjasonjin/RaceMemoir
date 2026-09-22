import {test,expect} from '@playwright/test'

test('turning off a connected bib pin requires confirmation and undo restores both',async({page})=>{
  await page.addInitScript(()=>{if(sessionStorage.getItem('bib-seeded'))return;sessionStorage.setItem('bib-seeded','1');localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Pin',items:[
    {id:'bib',kind:'bib',title:'号码布',number:'A123',variant:'green',pinEnabled:true,x:150,y:150,w:354,h:266,rotation:0},
    {id:'note',kind:'note',title:'记忆',variant:'paper',x:600,y:180,w:160,h:150,rotation:0}
  ],threads:[{id:'line',from:'bib',to:'note'}]}))})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.locator('[data-board-item=bib]').click()
  const toggle=page.getByRole('switch',{name:'同时使用大头钉'})
  await expect(toggle).toBeChecked();await toggle.click()
  const dialog=page.getByRole('dialog',{name:'关闭大头钉？'})
  await expect(dialog).toContainText('1 条连线')
  await dialog.getByRole('button',{name:'取消',exact:true}).click()
  await expect(toggle).toBeChecked();await expect(page.locator('.threads>g[role=button]')).toHaveCount(1)
  await toggle.click();await dialog.getByRole('button',{name:'关闭并移除连线'}).click()
  await expect(toggle).not.toBeChecked();await expect(page.locator('.threads>g[role=button]')).toHaveCount(0)
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await expect(page.locator('.threads>g[role=button]')).toHaveCount(1)
  await page.locator('[data-board-item=bib]').click();await expect(toggle).toBeChecked()
  await toggle.click();await dialog.getByRole('button',{name:'关闭并移除连线'}).click()
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.threads>g[role=button]')).toHaveCount(0)
})

test('photo layout uses themed select and photo editor omits notes',async({page},info)=>{
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'添加照片',exact:true}).click()
  await expect(page.getByText('备注',{exact:true})).toHaveCount(0)
  const select=page.getByRole('combobox',{name:'照片版式',exact:true})
  await select.click();await page.getByRole('option',{name:'横向相纸',exact:true}).click()
  await expect(select).toHaveText('横向相纸')
  await select.click();await page.screenshot({path:info.outputPath('photo-layout.png')})
  await page.keyboard.press('Escape');await expect(select).toBeFocused()
  await expect(page.locator('.record-panel')).toBeVisible()
})
