import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'

test('upload bib, correct corners, restore original, reuse, recycle and round-trip ZIP/PNG',async({page},info)=>{
 await page.addInitScript(()=>{if(sessionStorage.getItem('bib-fixture'))return;sessionStorage.setItem('bib-fixture','1');localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'号码布验收',items:[],threads:[]}))})
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const button=(name:string)=>page.getByRole('button',{name,exact:true})
 const readBib=()=>page.evaluate(async()=>{const {readRecords}=await import('/src/persistence/recordStore.ts');const r=(await readRecords()).find((r:{kind:string})=>r.kind==='bib');return r?{id:r.id,width:r.width,height:r.height,quad:r.quad,number:r.number,originalSize:r.originalImage.size,imageSize:r.image.size,same:await r.image.text()===await r.originalImage.text()}:null})
 const base64=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;const c=canvas.getContext('2d')!;c.fillStyle='#f3edda';c.fillRect(0,0,1200,800);c.fillStyle='#244f47';c.fillRect(0,0,1200,100);c.fillRect(0,720,1200,80);c.fillStyle='#d69e36';c.fillRect(50,130,1100,8);c.fillStyle='#244f47';c.textAlign='center';c.font='bold 300px sans-serif';c.fillText('174',600,490);c.font='40px sans-serif';c.fillText('TRAIL RUN 2026',600,620);return canvas.toDataURL('image/png').split(',')[1]})
 await button('添加号码布').click();await expect(button('模板制作')).toHaveAttribute('aria-pressed','true')
 await button('上传图片').click()
 await page.locator('.record-upload input').setInputFiles({name:'race-bib.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')})
 await expect(page.getByAltText('号码布预览')).toBeVisible();await page.getByLabel('赛事名称',{exact:true}).fill('真实号码布');await page.getByLabel('参赛号码',{exact:true}).fill('A174')
 await button('裁切 / 四角校正').click();await button('四角校正').click()
 const area=(await page.locator('.bib-adjust-area').boundingBox())!
 const move=async(name:string,x:number,y:number)=>{const box=(await button(name).boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(area.x+area.width*x,area.y+area.height*y,{steps:6});await page.mouse.up()}
 await move('左上角',.08,.12);await move('右上角',.9,.04);await move('右下角',.96,.9);await move('左下角',.04,.95)
 await page.screenshot({path:info.outputPath('bib-corners.png')})
 await button('应用调整').click();await expect(page.locator('.bib-adjustment')).toHaveCount(0)
 await page.getByRole('slider',{name:'号码布展示尺寸'}).fill('420')
 await button('保存并放上画布').click();await expect(page.locator('.bib-upload>img')).toHaveCount(1)
 await expect(page.locator('.bib-brand,.bib-number,.bib-trees')).toHaveCount(0)
 const corrected=(await readBib())!;expect(corrected.quad).toHaveLength(4);expect(corrected.same).toBe(false);expect(corrected.number).toBe('A174')
 const node=button('号码布：真实号码布');await node.click()
 await expect(button('恢复原图')).toBeEnabled();await button('恢复原图').click();await button('保存修改').click()
 const restored=(await readBib())!;expect(restored.same).toBe(true);expect(restored.width).toBe(1200);expect(restored.height).toBe(800)
 await node.click();await button('裁切 / 四角校正').click();await button('左上角').focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowDown');await button('应用调整').click();await expect(page.locator('.bib-adjustment')).toHaveCount(0);await button('保存修改').click()
 await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await expect(page.locator('.bib-upload>img')).toHaveCount(1);expect((await readBib())!.quad).toHaveLength(4)
 await button('打开收藏库').click();await page.getByRole('group',{name:'收藏类别'}).getByRole('button',{name:/号码布/}).click()
 await button('将 真实号码布 放上画布').click();await expect(page.locator('.bib-upload>img')).toHaveCount(2)
 await button('删除 真实号码布').click();await expect(page.locator('.bib-upload>img')).toHaveCount(2)
 await page.getByRole('button',{name:/查看回收站/}).click();await expect(button('彻底删除 真实号码布')).toBeDisabled();await button('恢复 真实号码布').click()
 await button('关闭收藏库').click()
 // Move the second instance so both artwork and connections can be checked in export.
 const last=page.locator('.memory-bib').last(),rect=(await last.boundingBox())!
 await page.mouse.move(rect.x+80,rect.y+80);await page.mouse.down();await page.mouse.move(rect.x+80+420,rect.y+80+200,{steps:10});await page.mouse.up()
 await button('添加连线').click();await page.locator('.memory-bib').first().click();await last.click();await button('结束连线').click();await expect(page.locator('.thread-hit')).toHaveCount(1)
 await button('适应画布').click();await page.screenshot({path:info.outputPath('bib-board.png')})
 await button('分享').click()
 const zipDownload=page.waitForEvent('download');await page.getByRole('button',{name:/导出收藏板文件/}).click();const zip=await zipDownload;const zipPath=info.outputPath('bib.zip');await zip.saveAs(zipPath)
 const pngDownload=page.waitForEvent('download');await page.getByRole('button',{name:/导出高清图片/}).click();const png=await pngDownload;const pngPath=info.outputPath('bib.png');await png.saveAs(pngPath)
 const bytes=await readFile(pngPath);expect(bytes.length).toBeGreaterThan(50_000)
 const pngPixels=await page.evaluate(async encoded=>{const blob=await(await fetch('data:image/png;base64,'+encoded)).blob(),bitmap=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let green=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<80&&pixels[i+1]>50&&pixels[i+1]<120&&pixels[i+2]>40&&pixels[i+3]>200)green++;bitmap.close();return green},bytes.toString('base64'));expect(pngPixels).toBeGreaterThan(5000)
 await button('关闭').click();await page.locator('input[accept*=".zip"]').setInputFiles(zipPath);await expect(page.locator('.toast')).toContainText('收藏板及关联文件已导入');await expect(page.locator('.bib-upload>img')).toHaveCount(2)
 await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await expect(page.locator('.bib-upload>img')).toHaveCount(2);await expect(page.locator('.thread-hit')).toHaveCount(1)
})

test('rectification samples original pixels at full resolution and supports cancellation',async({page})=>{
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const result=await page.evaluate(async()=>{
  const {processBibImage}=await import('/src/items/bib/processBibImage.ts')
  const c=document.createElement('canvas');c.width=400;c.height=200;const ctx=c.getContext('2d')!;ctx.fillStyle='#ff0000';ctx.fillRect(0,0,400,200);ctx.fillStyle='#00ff00';ctx.fillRect(100,50,200,100)
  const blob=await new Promise<Blob>(resolve=>c.toBlob(b=>resolve(b!),'image/png'))
  const crop=[{x:.25,y:.25},{x:.75,y:.25},{x:.75,y:.75},{x:.25,y:.75}]
  const output=await processBibImage(blob,crop,new AbortController().signal),bitmap=await createImageBitmap(output.image);c.width=bitmap.width;c.height=bitmap.height;ctx.drawImage(bitmap,0,0);const pixel=Array.from(ctx.getImageData(0,0,1,1).data);bitmap.close()
  const controller=new AbortController();controller.abort();let cancelled=false;try{await processBibImage(blob,crop,controller.signal)}catch{cancelled=true}
  return {width:output.width,height:output.height,pixel,cancelled}
 })
 expect(result).toEqual({width:200,height:100,pixel:[0,255,0,255],cancelled:true})
})
