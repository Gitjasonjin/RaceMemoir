import {test,expect} from '@playwright/test'

for(const zoomSteps of [0,4,8])test(`minimap drag remains usable without jumping at zoom step ${zoomSteps}`,async({page})=>{
  await page.goto('/')
  await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'恢复 100%',exact:true}).click()
  for(let i=0;i<zoomSteps;i++)await page.getByRole('button',{name:'放大',exact:true}).click()
  const map=page.locator('.minimap svg'),windowRect=page.locator('[data-minimap-viewport]')
  const camera=()=>page.locator('.scene').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {x:m.e,y:m.f,scale:m.a}})
  const svgBox=(await map.boundingBox())!,box=(await windowRect.boundingBox())!
  const start={x:Math.max(svgBox.x+2,Math.min(svgBox.x+svgBox.width-2,box.x+box.width/2)),y:Math.max(svgBox.y+2,Math.min(svgBox.y+svgBox.height-2,box.y+box.height/2))}
  const initial=await camera(),viewBox=(await map.getAttribute('viewBox'))!
  const [, ,worldWidth,worldHeight]=viewBox.split(' ').map(Number)
  const gain=Math.min(2*Math.max(1,initial.scale),worldWidth/svgBox.width*initial.scale,worldHeight/svgBox.height*initial.scale)
  await page.mouse.move(start.x,start.y);await page.mouse.down()
  expect(await camera()).toEqual(initial)
  for(const dx of [10,20,40]){
    await page.mouse.move(start.x+dx,start.y,{steps:4})
    await expect.poll(async()=>(await camera()).x).toBeCloseTo(initial.x-dx*gain,2)
    // Zooming in must not reduce the distance covered on the board for the same gesture.
    expect((initial.x-(await camera()).x)/initial.scale).toBeCloseTo(dx*2,2)
    await expect(map).toHaveAttribute('viewBox',viewBox)
    expect((await camera()).scale).toBe(initial.scale)
  }
  const beforeRelease=await camera();await page.mouse.up()
  expect(await camera()).toEqual(beforeRelease)
  // Captured dragging continues outside the miniature instead of leaving navigation stuck.
  await page.mouse.move(svgBox.x+svgBox.width/2,svgBox.y+svgBox.height/2);await page.mouse.down()
  await page.mouse.move(svgBox.x-50,svgBox.y-50,{steps:6});await page.mouse.up()
  await expect(page.locator('.minimap')).toHaveCSS('cursor','grab')
})
