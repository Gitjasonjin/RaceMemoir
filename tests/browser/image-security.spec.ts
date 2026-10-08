import {test,expect} from '@playwright/test'

test('real PNG, JPEG and WebP codecs agree with header dimensions and bounded previews',async({page})=>{
  await page.goto('/')
  const results=await page.evaluate(async()=>{
    const {readImageSize}=await import('/src/shared/readImageSize.ts')
    const {readBatchPhoto}=await import('/src/items/photo/batchPhotos.ts')
    const canvas=new OffscreenCanvas(480,320),ctx=canvas.getContext('2d')!
    ctx.fillStyle='#2c7a66';ctx.fillRect(0,0,480,320)
    const results=[]
    for(const type of ['image/png','image/jpeg','image/webp']){
      const blob=await canvas.convertToBlob({type}),size=await readImageSize(blob)
      const photo=await readBatchPhoto(new File([blob],'photo',{type}),{preview:true})
      const thumbnail=await createImageBitmap(photo.preview!)
      results.push({type:blob.type,size,thumbnail:[thumbnail.width,thumbnail.height],original:await photo.record.image.arrayBuffer().then(b=>b.byteLength===blob.size)})
      thumbnail.close()
    }
    return results
  })
  for(const result of results){
    expect(result.size).toEqual({width:480,height:320})
    expect(result.thumbnail).toEqual([160,107]);expect(result.original).toBe(true)
  }
})

test('50-photo batch renders only bounded thumbnail sources and cancel keeps storage empty',async({page})=>{
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  const image=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600
    canvas.getContext('2d')!.fillRect(0,0,800,600)
    return canvas.toDataURL().split(',')[1]
  })
  await page.getByRole('button',{name:'添加照片',exact:true}).click()
  await page.locator('.record-upload input').setInputFiles(Array.from({length:50},(_,i)=>({name:`photo-${i}.png`,mimeType:'image/png',buffer:Buffer.from(image,'base64')})))
  const thumbnails=page.locator('.batch-photo-row img')
  await expect(thumbnails).toHaveCount(50)
  await expect.poll(()=>thumbnails.evaluateAll(imgs=>imgs.every(img=>img instanceof HTMLImageElement&&img.complete&&img.naturalWidth===160&&img.naturalHeight===120))).toBe(true)
  await page.getByRole('button',{name:'关闭批量导入',exact:true}).click()
  const count=await page.evaluate(async()=>{
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    return (await readRecords()).filter((r:{kind:string})=>r.kind==='photo').length
  })
  expect(count).toBe(0)
})

test('hostile headers are rejected before browser decode or backup persistence',async({page})=>{
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  const result=await page.evaluate(async()=>{
    const {readImageSize}=await import('/src/shared/readImageSize.ts')
    const {readBackup,makeZipArchive}=await import('/src/persistence/zipArchive.ts')
    const {makeArchive}=await import('/src/persistence/recordArchive.ts')
    const {readRecords}=await import('/src/persistence/recordStore.ts')
    const canvas=new OffscreenCanvas(1,1);canvas.getContext('2d')
    const blob=await canvas.convertToBlob()
    const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer)
    view.setUint32(16,100000);view.setUint32(20,100000)
    const hostile=new Blob([bytes],{type:'image/png'})
    const original=createImageBitmap;let decodes=0,rejected=0
    window.createImageBitmap=(...args:Parameters<typeof createImageBitmap>)=>{decodes++;return original(...args)}
    const board={title:'security',items:[],threads:[]},records=[{id:'hostile',kind:'photo',name:'hostile',note:'',source:'upload',image:hostile}]
    try{
      const backups=[new Blob([await makeArchive(board,records)]),await makeZipArchive(board,records)]
      for(const task of [()=>readImageSize(hostile),...backups.map(b=>()=>readBackup(b))]){
        try{await task()}catch{rejected++}
      }
    }finally{window.createImageBitmap=original}
    return {decodes,rejected,stored:(await readRecords()).filter((r:{kind:string})=>r.kind==='photo').length}
  })
  expect(result).toEqual({decodes:0,rejected:3,stored:0})
})
