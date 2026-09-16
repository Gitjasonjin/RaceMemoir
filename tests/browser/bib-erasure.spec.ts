import {test,expect} from '@playwright/test'

test('manual name erasure is reversible, survives correction and is baked into stored/exported pixels',async({page},info)=>{
 await page.addInitScript(()=>{if(sessionStorage.getItem('erasure-fixture'))return;sessionStorage.setItem('erasure-fixture','1');localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'姓名处理验收',items:[],threads:[]}))})
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const button=(name:string)=>page.getByRole('button',{name,exact:true})
 const base64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=480;const x=c.getContext('2d')!;x.fillStyle='#f3edda';x.fillRect(0,0,800,480);x.fillStyle='#244f47';x.font='bold 100px sans-serif';x.fillText('174',310,160);x.font='bold 70px sans-serif';x.fillText('NAME',285,300);return c.toDataURL('image/png').split(',')[1]})
 await button('添加号码布').click();await button('上传图片').click();await page.locator('.record-upload input').setInputFiles({name:'name.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')})
 await expect(page.getByAltText('号码布预览')).toBeVisible();await expect(page.getByLabel('备注',{exact:true})).toHaveCount(0)
 await button('姓名抹除').click();await expect(button('应用抹除')).toBeEnabled()
 const select=async()=>{const a=(await page.locator('.bib-erase-area').boundingBox())!;await page.mouse.move(a.x+a.width*.24,a.y+a.height*.42);await page.mouse.down();await page.mouse.move(a.x+a.width*.77,a.y+a.height*.70,{steps:8});await page.mouse.up()}
 await select();await expect(page.locator('.bib-erasure')).toHaveCount(1);await expect(page.getByLabel('姓名覆盖底色')).toHaveValue('#f3edda')
 await button('撤销上次抹除').click();await expect(page.locator('.bib-erasure')).toHaveCount(0);await select()
 await page.getByLabel('姓名覆盖底色').fill('#ffffff');await button('背景取色').click();const a=(await page.locator('.bib-erase-area').boundingBox())!;await page.mouse.click(a.x+10,a.y+10);await expect(page.getByLabel('姓名覆盖底色')).toHaveValue('#f3edda')
 await page.screenshot({path:info.outputPath('erasure-editor.png')})
 await button('应用抹除').click();await expect(page.locator('.bib-name-eraser')).toHaveCount(0);await button('保存并放上画布').click()
 const changed=await page.evaluate(async()=>{
  const {readRecords}=await import('/src/persistence/recordStore.ts');const record=(await readRecords()).find((r:{kind:string})=>r.kind==='bib')
  const read=async(blob:Blob)=>{const b=await createImageBitmap(blob),c=document.createElement('canvas');c.width=b.width;c.height=b.height;const x=c.getContext('2d')!;x.drawImage(b,0,0);b.close();return x.getImageData(0,0,c.width,c.height).data}
  const original=await read(record.originalImage),image=await read(record.image),r=record.erasures[0];let changedInside=0,changedOutside=0,darkInside=0
  const left=Math.floor(r.x*800),right=Math.ceil((r.x+r.width)*800),top=Math.floor(r.y*480),bottom=Math.ceil((r.y+r.height)*480)
  for(let y=0;y<480;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4,inside=x>=left&&x<right&&y>=top&&y<bottom;if(inside&&image[i]<200)darkInside++;if(original[i]!==image[i]||original[i+1]!==image[i+1]||original[i+2]!==image[i+2]){if(inside)changedInside++;else changedOutside++}}
  return {changedInside,changedOutside,darkInside}
 })
 expect(changed.changedInside).toBeGreaterThan(1000);expect(changed.changedOutside).toBe(0);expect(changed.darkInside).toBe(0)
 await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await button('号码布：name').click();await button('裁切 / 四角校正').click();await button('左上角').focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowDown');await button('应用调整').click();await expect(page.locator('.bib-adjustment')).toHaveCount(0);await button('保存修改').click()
 const correction=await page.evaluate(async()=>{const {readRecords}=await import('/src/persistence/recordStore.ts'),{makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts');const records=await readRecords(),r=records.find((r:{kind:string})=>r.kind==='bib'),b=await createImageBitmap(r.image),c=document.createElement('canvas');c.width=b.width;c.height=b.height;const x=c.getContext('2d')!;x.drawImage(b,0,0);b.close();const pixel=Array.from(x.getImageData(Math.floor(c.width*.49),Math.floor(c.height*.55),1,1).data);const imported=await readBackup(await makeZipArchive(JSON.parse(localStorage.getItem('racememoir-board-v1')!),records));return {pixel,count:r.erasures.length,restored:imported.records[0].erasures.length}})
 expect(correction).toEqual({pixel:[243,237,218,255],count:1,restored:1})
 await button('分享').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:/导出高清图片/}).click();await(await pending).saveAs(info.outputPath('erased-bib.png'));await button('关闭').click()
 await button('号码布：name').click();await button('姓名抹除').click();await expect(page.locator('.bib-erasure')).toHaveCount(1);await button('清除全部抹除').click();await button('应用抹除').click();await button('保存修改').click()
 await button('号码布：name').click();await button('恢复原图').click();await button('保存修改').click()
 const original=await page.evaluate(async()=>{const {readRecords}=await import('/src/persistence/recordStore.ts');const r=(await readRecords()).find((r:{kind:string})=>r.kind==='bib');return {same:await r.image.text()===await r.originalImage.text(),erased:r.erasures?.length||0,quad:!!r.quad}})
 expect(original).toEqual({same:true,erased:0,quad:false})
})
