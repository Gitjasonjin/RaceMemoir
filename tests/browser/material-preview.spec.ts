import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3})

async function sample(page:Page){
  return page.locator('.share-preview .material-preview-layer').evaluate(layer=>{
    const canvas=layer.querySelector('canvas')!,context=canvas.getContext('2d')!
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data
    const colors=new Set<number>();let opaque=true
    for(let n=0;n<pixels.length;n+=100){colors.add(pixels[n]*65536+pixels[n+1]*256+pixels[n+2]);if(pixels[n+3]!==255)opaque=false}
    return {ready:layer.getAttribute('data-ready'),key:canvas.dataset.texture,colors:colors.size,opaque,width:canvas.width,height:canvas.height,background:getComputedStyle(layer).backgroundImage,transition:getComputedStyle(layer).transitionDuration,pixels:canvas.toDataURL()}
  })
}

for(const id of ['cork','dark-wood','kraft'])test(`${id}: first paint is complete, and repeated dialogs reuse the painted texture`,async({page},info)=>{
  let release!:()=>void,requests=0
  const delayed=new Promise<void>(resolve=>release=resolve)
  await page.route(`**/textures/${id}-photo.webp`,async route=>{requests++;await delayed;await route.continue()})
  await page.addInitScript(id=>localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'我的越野记忆',backgroundStyle:id,items:[],threads:[]})),id)
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'分享',exact:true}).tap()
  const layer=page.locator('.share-preview .material-preview-layer')
  await expect(layer).toHaveAttribute('data-ready','false')
  await expect(layer).toHaveCSS('visibility','hidden')
  release()
  await expect(layer).toHaveAttribute('data-ready','true')
  const first=await sample(page)
  expect(first.colors).toBeGreaterThan(100);expect(first.opaque).toBe(true)
  expect(first.background).toBe('none');expect(first.transition).toBe('0s')
  expect(first.key).toBe(`${id}:1`)
  await layer.screenshot({path:info.outputPath(`${id}.png`)})
  await page.getByRole('button',{name:'关闭',exact:true}).tap()
  const initialRequests=requests
  for(let n=0;n<3;n++){
    // Synchronous click + next frame catches a ready flag set before the actual canvas paint.
    const frame=await page.evaluate(async()=>{
      (document.querySelector('button[aria-label="分享"]') as HTMLButtonElement).click()
      await new Promise(requestAnimationFrame)
      const layer=document.querySelector('.share-preview .material-preview-layer')!
      return {ready:layer?.getAttribute('data-ready'),pixels:layer?.querySelector('canvas')?.toDataURL()}
    })
    expect(frame.ready).toBe('true');expect(frame.pixels).toBe(first.pixels)
    await page.getByRole('button',{name:'关闭',exact:true}).tap()
    await page.getByRole('button',{name:'装饰样式',exact:true}).tap()
    await expect(page.locator('.background-sample .material-preview-layer[data-ready=true]')).toHaveCount(4)
    expect(await page.locator(`.background-sample canvas[data-texture="${id}:0.55"]`).evaluate((canvas:HTMLCanvasElement)=>{
      const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data
      return new Set(Array.from(data).filter((_,i)=>i%4!==3)).size
    })).toBeGreaterThan(30)
    await page.getByRole('button',{name:'关闭装饰样式',exact:true}).tap()
  }
  expect(requests).toBe(initialRequests)
  await page.getByRole('button',{name:'分享',exact:true}).tap()
  await page.setViewportSize({width:430,height:900})
  await expect.poll(async()=>(await sample(page)).width).toBeGreaterThan(first.width)
  const resized=await sample(page);expect(resized.opaque).toBe(true);expect(resized.colors).toBeGreaterThan(100)
})
