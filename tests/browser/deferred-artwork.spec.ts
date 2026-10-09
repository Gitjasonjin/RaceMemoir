import {test,expect} from '@playwright/test'

test('unseen artwork defers processing, exports completely, then latches after entering the viewport',async({page})=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'Deferred artwork',items:[],threads:[]}))
  })
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(async()=>{
    const {putRecords}=await import('/src/persistence/recordStore.ts')
    const image=async(color:string)=>{
      const canvas=document.createElement('canvas');canvas.width=180;canvas.height=240
      const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(30,30,120,180)
      return new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'))
    }
    const [red,blue,green]=await Promise.all(['#e22424','#2444e2','#24b244'].map(image))
    await putRecords([
      {id:'near-source',kind:'sticker',source:'upload',name:'Near sticker',note:'',originalImage:red,imageMode:'original',width:180,height:240},
      {id:'far-source',kind:'sticker',source:'upload',name:'Far sticker',note:'',originalImage:blue,imageMode:'original',width:180,height:240},
      {id:'medal-source',kind:'medal',source:'upload',name:'Far medal',note:'',date:'',originalImage:green,image:green,cutout:'done'},
    ])
    const board={title:'Deferred artwork',items:[
      {id:'near',kind:'sticker',recordId:'near-source',title:'Near sticker',x:240,y:180,w:180,h:240,rotation:0},
      {id:'far',kind:'sticker',recordId:'far-source',title:'Far sticker',x:2600,y:180,w:180,h:240,rotation:0},
      {id:'medal',kind:'medal',recordId:'medal-source',title:'Far medal',x:2900,y:180,w:180,h:270,rotation:0},
    ],threads:[]},year=new Date().getFullYear()
    sessionStorage.setItem('deferred-artwork-workspace',JSON.stringify({version:1,activeYear:year,seasons:[{year,board,view:{x:0,y:0,scale:1}},{year:year-1,board:{title:'Empty',items:[],threads:[]}}]}))
  })
  // Install after the old page's unload autosave, before the next App mounts.
  await page.addInitScript(()=>{
    const workspace=sessionStorage.getItem('deferred-artwork-workspace')
    if(workspace){localStorage.setItem('racememoir-season-workspace-v1',workspace);sessionStorage.removeItem('deferred-artwork-workspace')}
  })
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  const near=page.locator('[data-board-item=near]'),far=page.locator('[data-board-item=far]'),medal=page.locator('[data-board-item=medal]')
  await expect(near.locator('[data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  await expect(far.locator('[data-artwork-state]')).toHaveAttribute('data-artwork-state','deferred')
  await expect(medal.locator('[data-artwork-state]')).toHaveAttribute('data-artwork-state','deferred')
  await expect(far.locator('img')).toHaveCount(0);await expect(medal.locator('img')).toHaveCount(0)
  expect(await far.evaluate(el=>({width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight}))).toEqual({width:180,height:240})

  const exported=await page.evaluate(async()=>{
    const {exportBoardImage}=await import('/src/persistence/exportImage.ts'),{readRecords}=await import('/src/persistence/recordStore.ts')
    const workspace=JSON.parse(localStorage.getItem('racememoir-season-workspace-v1')!)
    const board=workspace.seasons.find((season:{year:number})=>season.year===workspace.activeYear).board,records=await readRecords()
    const png=await exportBoardImage(document.querySelector('.scene')!,board,records),bitmap=await createImageBitmap(png)
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d')!
    ctx.drawImage(bitmap,0,0);bitmap.close()
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data
    let blue=0,green=0
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i+2]>pixels[i]*2&&pixels[i+2]>pixels[i+1]*2)blue++
      if(pixels[i+1]>pixels[i]*2&&pixels[i+1]>pixels[i+2]*2)green++
    }
    return {bytes:png.size,blue,green}
  })
  expect(exported.bytes).toBeGreaterThan(1000);expect(exported.blue).toBeGreaterThan(1000);expect(exported.green).toBeGreaterThan(1000)
  await expect(far.locator('[data-artwork-state]')).toHaveAttribute('data-artwork-state','deferred')
  await expect(medal.locator('[data-artwork-state]')).toHaveAttribute('data-artwork-state','deferred')

  // Panning uses real canvas gestures. Once seen, moving away does not remount assets.
  await page.keyboard.down('Space')
  for(let i=0;i<2;i++){
    await page.mouse.move(1250,800);await page.mouse.down();await page.mouse.move(250,800,{steps:8});await page.mouse.up()
  }
  await page.keyboard.up('Space')
  await expect(far.locator('[data-sticker-state]')).toHaveAttribute('data-sticker-state','ready')
  await expect(medal.locator('[data-medal-state]')).toHaveAttribute('data-medal-state','ready')
  await page.keyboard.down('Space')
  for(let i=0;i<2;i++){
    await page.mouse.move(250,800);await page.mouse.down();await page.mouse.move(1250,800,{steps:8});await page.mouse.up()
  }
  await page.keyboard.up('Space')
  await expect(far.locator('[data-artwork-state]')).toHaveAttribute('data-artwork-state','active')
  await expect(medal.locator('[data-artwork-state]')).toHaveAttribute('data-artwork-state','active')
})
