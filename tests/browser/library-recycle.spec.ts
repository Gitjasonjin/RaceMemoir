import {test,expect} from '@playwright/test'

test('recycle bulk delete confirms across filters and preserves referenced records',async({page},info)=>{
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(async()=>{
    const {putRecords}=await import('/src/persistence/recordStore.ts')
    const photo=(id:string,archived:boolean)=>({id,kind:'photo',name:id,note:'',source:'upload',archived,image:new Blob(['photo'],{type:'image/png'})})
    await putRecords([photo('trash-photo',true),photo('protected-photo',true),photo('active-photo',false),{id:'trash-medal',kind:'medal',name:'trash-medal',date:'',note:'',source:'upload',archived:true,cutout:'original',originalImage:new Blob(['medal'],{type:'image/png'}),image:new Blob(['medal'],{type:'image/png'})}])
  })
  await page.addInitScript(()=>{
    if(sessionStorage.getItem('recycle-seeded'))return
    sessionStorage.setItem('recycle-seeded','1')
    localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Recycle',items:[{id:'protected',kind:'photo',recordId:'protected-photo',title:'protected',variant:'polaroid',x:200,y:200,w:200,h:240,rotation:0}],threads:[]}))
  })
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(()=>{
    document.body.dataset.operationSeen='false'
    new MutationObserver(records=>{if(records.some(r=>Array.from(r.addedNodes).some(n=>n instanceof Element&&(n.matches('.file-operation-floating')||n.querySelector('.file-operation-floating')))))document.body.dataset.operationSeen='true'}).observe(document.body,{childList:true,subtree:true})
  })
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await expect(page.locator('.record-actions')).toHaveCount(0)
  await expect(page.locator('.avatar')).toHaveCount(0)
  await page.getByRole('button',{name:/查看回收站/}).click()
  await page.getByRole('group',{name:'收藏类别'}).getByRole('button',{name:/照片/}).click()
  await page.getByRole('button',{name:'清空回收站',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'清空回收站？'})
  await expect(dialog).toContainText('2 份闲置收藏及原文件')
  await expect(dialog).toContainText('使用中的 1 份收藏保留')
  await expect(dialog.getByRole('button',{name:'取消'})).toBeFocused()
  await dialog.screenshot({path:info.outputPath('recycle-confirm.png')})
  await dialog.getByRole('button',{name:'取消'}).click()
  await expect(page.getByRole('button',{name:'查看 trash-photo',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'清空回收站',exact:true}).click()
  await dialog.getByRole('button',{name:'确认清空'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button',{name:'清空回收站',exact:true})).toBeDisabled()
  await expect(page.locator('body')).toHaveAttribute('data-operation-seen','false')
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  const ids=await page.evaluate(async()=>{const {readRecords}=await import('/src/persistence/recordStore.ts');return (await readRecords()).map((r:{id:string})=>r.id)})
  expect(ids).toContain('protected-photo');expect(ids).toContain('active-photo')
  expect(ids).not.toContain('trash-photo');expect(ids).not.toContain('trash-medal')
  await page.getByRole('button',{name:'快捷键与帮助'}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
