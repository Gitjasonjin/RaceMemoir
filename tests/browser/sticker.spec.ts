import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

async function ready(page:Page){
  await page.addInitScript(()=>{if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'贴纸验收',items:[],threads:[]}))})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
}
async function fixture(page:Page,transparent=true){
  const data=await page.evaluate(transparent=>{
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300
    const ctx=canvas.getContext('2d')!
    if(!transparent){ctx.fillStyle='#ead6b5';ctx.fillRect(0,0,400,300)}
    ctx.fillStyle='#2c7a66';ctx.beginPath();ctx.moveTo(100,240);ctx.lineTo(200,60);ctx.lineTo(300,240);ctx.closePath();ctx.fill()
    ctx.fillStyle='white';ctx.font='bold 24px sans-serif';ctx.fillText('TRAIL',166,208)
    return canvas.toDataURL().split(',')[1]
  },transparent)
  return {name:transparent?'trail.png':'opaque.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')}
}
async function upload(page:Page,transparent=true){
  await page.getByRole('button',{name:'添加贴纸',exact:true}).click()
  await page.getByLabel('贴纸图片',{exact:true}).setInputFiles(await fixture(page,transparent))
}
async function range(page:Page,label:string,value:string){
  await page.getByRole('slider',{name:label,exact:true}).fill(value)
}
const stored=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('racememoir-board-v1')!))
const workerResult=(delay=0,empty=false)=>`self.onmessage=async e=>{const source=await createImageBitmap(e.data.blob);const canvas=new OffscreenCanvas(source.width,source.height);const ctx=canvas.getContext('2d');${empty?'':"ctx.drawImage(source,0,0);ctx.globalCompositeOperation='destination-in';ctx.fillRect(100,60,200,180);"}source.close();const image=await canvas.convertToBlob({type:'image/png'});setTimeout(()=>self.postMessage({type:'done',image}),${delay})}`

test('torn collage changes instance style, keeps originals and survives undo, reload and ZIP/PNG export',async({page},info)=>{
  let workers=0
  await page.route('**/cutout.worker.ts*',route=>{workers++;return route.abort()})
  await ready(page);await upload(page)
  await page.getByRole('button',{name:'撕纸拼贴',exact:true}).click()
  await range(page,'贴纸撕边宽度','3');await range(page,'贴纸大小','360')
  await expect(page.locator('.sticker-preview .sticker-torn')).toHaveAttribute('data-sticker-state','ready')
  await page.screenshot({path:info.outputPath('torn-sticker-editor.png')})
  await page.setViewportSize({width:390,height:844})
  expect(await page.locator('.record-scroll').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1)
  await page.getByRole('button',{name:'撕纸拼贴',exact:true}).scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('torn-sticker-mobile.png')})
  await page.setViewportSize({width:1440,height:1000})
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items[0]?.stickerStyle).toBe('torn')
  const before=(await stored(page)).items[0]
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await page.getByRole('button',{name:'将 trail 放上画布',exact:true}).click()
  await page.getByRole('button',{name:'关闭收藏库',exact:true}).click()
  const items=page.locator('.scene>.memory-sticker');await expect(items).toHaveCount(2)
  await expect(items.last().locator('.sticker-contour')).toHaveAttribute('data-sticker-state','ready')
  await items.first().press('Enter');await page.getByRole('button',{name:'轮廓贴纸',exact:true}).click()
  await page.getByRole('button',{name:'保存修改',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items[0].stickerStyle).toBe('contour')
  const changed=(await stored(page)).items[0]
  expect(changed.x+changed.w/2).toBeCloseTo(before.x+before.w/2);expect(changed.y+changed.h/2).toBeCloseTo(before.y+before.h/2)
  expect(Math.max(changed.w,changed.h)).toBe(360)
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items[0].stickerStyle).toBe('torn')
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(items.first().locator('.sticker-torn')).toHaveAttribute('data-sticker-state','ready')
  const second=(await items.last().boundingBox())!,oldX=(await stored(page)).items[1].x
  await page.mouse.move(second.x+second.width/2,second.y+second.height/2);await page.mouse.down();await page.mouse.move(second.x+second.width/2+420,second.y+second.height/2,{steps:8});await page.mouse.up()
  await expect.poll(async()=>(await stored(page)).items[1].x).not.toBe(oldX)
  const result=await page.evaluate(async()=>{
    const {readRecords,putRecords}=await import('/src/persistence/recordStore.ts')
    const {makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts')
    const {prepareSticker}=await import('/src/items/sticker/stickerImage.ts')
    const {exportBoardImage}=await import('/src/persistence/exportImage.ts')
    const records=await readRecords(),board=JSON.parse(localStorage.getItem('racememoir-board-v1')!),r=records.find((r:any)=>r.kind==='sticker')
    const derived=await prepareSticker(r.originalImage,3,'torn'),bitmap=await createImageBitmap(derived.blob),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d')!
    ctx.drawImage(bitmap,0,0);bitmap.close()
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
    let transparent=0,paper=0;for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3])transparent++;if(pixels[i]>220&&pixels[i+1]>210&&pixels[i+2]>190&&pixels[i+3]>240)paper++}
    const restored=await readBackup(await makeZipArchive(board,records))
    await putRecords(restored.records);localStorage.setItem('sticker-restored',JSON.stringify(restored.board))
    const png=await exportBoardImage(document.querySelector('.scene')!,board,records)
    const base64=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve((reader.result as string).split(',')[1]);reader.readAsDataURL(png)})
    return {transparent,paper,total:pixels.length/4,style:restored.board.items[0].stickerStyle,adhesion:restored.board.items[0].stickerAdhesion,originalSize:r.originalImage.size,restoredSize:restored.records[0].originalImage.size,png:base64}
  })
  expect(result.style).toBe('torn');expect(result.transparent).toBeGreaterThan(result.total*.35);expect(result.paper).toBeGreaterThan(result.total*.03)
  expect(result.originalSize).toBe(result.restoredSize);expect(workers).toBe(0)
  const {writeFile}=await import('node:fs/promises');await writeFile(info.outputPath('torn-stickers.png'),Buffer.from(result.png,'base64'))
  await page.addInitScript(()=>{const board=localStorage.getItem('sticker-restored');if(board){localStorage.setItem('racememoir-board-v1',board);localStorage.removeItem('sticker-restored')}})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(items.first().locator('.sticker-torn')).toHaveAttribute('data-sticker-state','ready')
  await expect(items.last().locator('.sticker-contour')).toHaveAttribute('data-sticker-state','ready')
})

test('transparent sticker retains pixels, adjusts outline and size, reuses assets and round-trips PNG/ZIP',async({page},info)=>{
  let workers=0
  await page.route('**/cutout.worker.ts*',route=>{workers++;return route.abort()})
  await ready(page);await upload(page)
  await expect(page.getByRole('button',{name:'保存并放上画布',exact:true})).toBeEnabled()
  expect(workers).toBe(0)
  await page.getByLabel('贴纸名称',{exact:true}).fill('山野贴纸')
  await range(page,'贴纸白边粗细','4');await range(page,'贴纸大小','320')
  await expect(page.locator('.sticker-preview [data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  await page.screenshot({path:info.outputPath('sticker-editor.png')})
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  const sticker=page.locator('.scene>.memory-sticker')
  await expect(sticker).toHaveCount(1);await expect(page.locator('.record-panel')).toHaveCount(0)
  await expect.poll(async()=>(await stored(page)).items[0]?.stickerBorder).toBe(4)
  expect((await stored(page)).items[0].w).toBe(320)
  await page.getByRole('button',{name:'添加连线',exact:true}).click();await sticker.press('Enter')
  await expect(page.locator('.scene .connection-anchor,.scene .pushpin')).toHaveCount(0)
  expect((await stored(page)).threads).toEqual([])
  await page.getByRole('button',{name:'选择',exact:true}).click()
  const before=(await stored(page)).items[0],box=(await sticker.boundingBox())!
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+65,box.y+box.height/2+30,{steps:8});await page.mouse.up()
  await expect.poll(async()=>(await stored(page)).items[0].x).not.toBe(before.x)
  await page.keyboard.press('Control+z');await expect.poll(async()=>(await stored(page)).items[0].x).toBe(before.x)
  await page.keyboard.press('Control+Shift+z');await expect.poll(async()=>(await stored(page)).items[0].x).not.toBe(before.x)
  await page.getByRole('button',{name:'打开收藏库',exact:true}).click()
  await page.getByRole('group',{name:'收藏类别'}).getByRole('button',{name:/^贴纸/}).click()
  await page.getByRole('button',{name:'将 山野贴纸 放上画布',exact:true}).click()
  await expect(sticker).toHaveCount(2)
  await page.getByRole('button',{name:'关闭收藏库',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items.length).toBe(2)
  await sticker.last().press('Enter');await expect(page.getByRole('slider',{name:'贴纸白边粗细',exact:true})).toHaveValue('2')
  await sticker.first().press('Enter');await expect(page.getByRole('slider',{name:'贴纸白边粗细',exact:true})).toHaveValue('4')
  await sticker.last().press('Enter');await range(page,'贴纸白边粗细','0');await page.getByRole('button',{name:'保存修改',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items[1].stickerBorder).toBe(0)
  expect((await stored(page)).items[0].stickerBorder).toBe(4)
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await expect(page.locator('.scene [data-sticker-state=ready]')).toHaveCount(2)
  const boxes=await sticker.all();const rects=await Promise.all(boxes.map(el=>el.boundingBox()))
  const left=Math.min(...rects.map(r=>r!.x))-18,top=Math.min(...rects.map(r=>r!.y))-18,right=Math.max(...rects.map(r=>r!.x+r!.width))+18,bottom=Math.max(...rects.map(r=>r!.y+r!.height))+18
  await page.keyboard.down('Control');await page.mouse.move(left,top);await page.mouse.down();await page.mouse.move(right,bottom,{steps:10});await page.mouse.up();await page.keyboard.up('Control')
  await expect(page.locator('.memory-sticker.selected')).toHaveCount(2)
  await page.getByRole('button',{name:'组合物件',exact:true}).click();await expect.poll(async()=>(await stored(page)).items[0].groupId).toBeTruthy()
  await page.getByRole('button',{name:'取消组合',exact:true}).click();await expect.poll(async()=>(await stored(page)).items[0].groupId).toBeUndefined()
  await sticker.first().press('Enter');await page.setViewportSize({width:390,height:740})
  expect(await page.locator('.record-scroll').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1)
  await page.getByRole('button',{name:'关闭贴纸编辑',exact:true}).click();await page.setViewportSize({width:1440,height:1000})
  const result=await page.evaluate(async()=>{
    const {readRecords,putRecords}=await import('/src/persistence/recordStore.ts')
    const {makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts')
    const {exportBoardImage}=await import('/src/persistence/exportImage.ts')
    const records=await readRecords(),board=JSON.parse(localStorage.getItem('racememoir-board-v1')!)
    const archive=await makeZipArchive(board,records),restored=await readBackup(archive)
    const png=await exportBoardImage(document.querySelector('.scene')!,board,records)
    const rendered=await createImageBitmap(png),r=records.find((r:{kind:string})=>r.kind==='sticker')
    const source=await createImageBitmap(r.originalImage),canvas=new OffscreenCanvas(source.width,source.height),ctx=canvas.getContext('2d')!
    ctx.drawImage(source,0,0);const pixel=[...ctx.getImageData(200,120,1,1).data];source.close()
    const bytes=await png.arrayBuffer();let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte)
    await putRecords(restored.records);localStorage.setItem('sticker-restored',JSON.stringify(restored.board))
    const size=[rendered.width,rendered.height];rendered.close()
    return {pixel,png:btoa(binary),size,records:records.length,ids:restored.board.items.map((i:{recordId:string})=>i.recordId),sourceId:r.id}
  })
  expect(result.pixel).toEqual([44,122,102,255]);expect(result.records).toBe(1);expect(result.ids[0]).toBe(result.ids[1]);expect(result.ids[0]).not.toBe(result.sourceId);expect(result.size[0]).toBeGreaterThan(300)
  const {writeFile}=await import('node:fs/promises');await writeFile(info.outputPath('stickers.png'),Buffer.from(result.png,'base64'))
  await page.addInitScript(()=>{const board=localStorage.getItem('sticker-restored');if(board){localStorage.setItem('racememoir-board-v1',board);localStorage.removeItem('sticker-restored')}})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await expect(page.locator('.scene [data-sticker-state=ready]')).toHaveCount(2)
})

test('opaque upload runs automatic cutout and mode changes keep each instance centered and sized',async({page})=>{
  let workers=0
  await page.route('**/cutout.worker.ts*',route=>{workers++;return route.fulfill({contentType:'application/javascript',body:workerResult(150)})})
  await ready(page);await upload(page,false)
  await expect(page.getByRole('button',{name:'使用抠图',exact:true})).toHaveAttribute('aria-pressed','true')
  expect(workers).toBe(1)
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items.length).toBe(1)
  const before=(await stored(page)).items[0]
  await page.locator('.memory-sticker').press('Enter')
  await page.getByRole('button',{name:'使用原图',exact:true}).click();await page.getByRole('button',{name:'保存修改',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items[0].h).not.toBe(before.h)
  const after=(await stored(page)).items[0]
  expect(Math.max(after.w,after.h)).toBe(Math.max(before.w,before.h));expect(after.x+after.w/2).toBeCloseTo(before.x+before.w/2);expect(after.y+after.h/2).toBeCloseTo(before.y+before.h/2)
  await page.locator('.memory-sticker').press('Enter');await page.getByRole('button',{name:'使用抠图',exact:true}).click()
  await page.getByRole('button',{name:'保存修改',exact:true}).click();expect(workers).toBe(1)
  await expect.poll(async()=>(await stored(page)).items[0].h).toBe(before.h)
})

test('failed and cancelled cutouts preserve originals, reject empty output and cannot save stale results',async({page})=>{
  let response='fail'
  await page.route('**/cutout.worker.ts*',route=>response==='fail'?route.abort():route.fulfill({contentType:'application/javascript',body:workerResult(response==='slow'?2000:0,response==='empty')}))
  await ready(page);await upload(page,false)
  await expect(page.getByRole('alert')).toContainText('自动抠图未完成')
  await expect(page.getByRole('button',{name:'保存并放上画布',exact:true})).toBeDisabled()
  response='empty';await page.getByRole('button',{name:'重新抠图',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('没有可见主体')
  await page.getByRole('button',{name:'使用原图',exact:true}).click();await expect(page.getByRole('button',{name:'保存并放上画布',exact:true})).toBeEnabled()
  response='slow';await page.getByRole('button',{name:'重新抠图',exact:true}).click();await page.getByLabel('贴纸图片',{exact:true}).setInputFiles(await fixture(page,true))
  await expect(page.getByRole('button',{name:'保存并放上画布',exact:true})).toBeEnabled()
  await page.waitForTimeout(2200)
  await expect(page.getByRole('button',{name:'使用原图',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'使用抠图',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'重新抠图',exact:true}).click();await page.getByRole('button',{name:'关闭贴纸编辑',exact:true}).click()
  await page.waitForTimeout(2200);await expect(page.locator('.memory-sticker')).toHaveCount(0)
  expect(await page.evaluate(async()=>{const {readRecords}=await import('/src/persistence/recordStore.ts');return (await readRecords()).length})).toBe(0)
})

test('sketch and washi apply to cutouts, persist independently and export all four styles',async({page},info)=>{
  await ready(page);await upload(page)
  await expect(page.getByRole('group',{name:'粘贴状态',exact:true})).toHaveCount(0)
  for(const [label,style] of [['手绘描边','sketch'],['和纸贴纸','washi']]){
    await page.getByRole('button',{name:label,exact:true}).click()
    await expect(page.locator(`.sticker-preview .sticker-${style}`)).toHaveAttribute('data-sticker-state','ready')
    await page.locator('.record-scroll').evaluate(el=>el.scrollTop=0)
    await page.screenshot({path:info.outputPath(`${style}-editor.png`)})
  }
  await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
  await expect.poll(async()=>(await stored(page)).items[0]?.stickerStyle).toBe('washi')
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.scene .sticker-washi')).toHaveAttribute('data-sticker-state','ready')
  const result=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const {prepareSticker}=await import('/src/items/sticker/stickerImage.ts')
    const {makeZipArchive,readBackup}=await import('/src/persistence/zipArchive.ts')
    const {exportBoardImage}=await import('/src/persistence/exportImage.ts')
    const records=await readRecords(),record=records.find((r:any)=>r.kind==='sticker'),board=JSON.parse(localStorage.getItem('racememoir-board-v1')!)
    const canvas=new OffscreenCanvas(1200,360),ctx=canvas.getContext('2d')!
    ctx.fillStyle='#cfbc93';ctx.fillRect(0,0,1200,360)
    const styles=['contour','torn','sketch','washi'],stats=[]
    for(const [index,style] of styles.entries()){
      const derived=await prepareSticker(record.originalImage,3,style),bitmap=await createImageBitmap(derived.blob)
      const test=new OffscreenCanvas(bitmap.width,bitmap.height),pixels=test.getContext('2d')!;pixels.drawImage(bitmap,0,0)
      const data=pixels.getImageData(0,0,bitmap.width,bitmap.height).data
      stats.push({corner:data[3],center:data[(Math.floor(bitmap.height/2)*bitmap.width+Math.floor(bitmap.width/2))*4+3]})
      ctx.drawImage(bitmap,index*300+20,45,260,260*bitmap.height/bitmap.width);bitmap.close()
      ctx.fillStyle='#332f27';ctx.font='18px sans-serif';ctx.fillText(style,index*300+20,330)
    }
    const encode=(blob:Blob)=>new Promise<string>(resolve=>{const r=new FileReader();r.onload=()=>resolve((r.result as string).split(',')[1]);r.readAsDataURL(blob)})
    const restored=await readBackup(await makeZipArchive(board,records))
    return {stats,style:restored.board.items[0].stickerStyle,comparison:await encode(await canvas.convertToBlob()),png:await encode(await exportBoardImage(document.querySelector('.scene')!,board,records))}
  })
  expect(result.style).toBe('washi');expect(result.stats.every(s=>s.corner===0)).toBe(true)
  expect(result.stats[0].center).toBe(255);expect(result.stats[3].center).toBeLessThan(255)
  const {writeFile}=await import('node:fs/promises')
  await writeFile(info.outputPath('style-comparison.png'),Buffer.from(result.comparison,'base64'))
  await writeFile(info.outputPath('washi-export.png'),Buffer.from(result.png,'base64'))
})
