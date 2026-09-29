import {test,expect} from '@playwright/test'

test('local fonts follow language and exports embed only required Japanese subsets',async({page},info)=>{
  const fontRequests:string[]=[],fontFailures:string[]=[]
  page.on('request',request=>{if(/\.(woff2|ttf)(\?|$)/.test(request.url()))fontRequests.push(request.url())})
  page.on('response',response=>{if(/\.(woff2|ttf)(\?|$)/.test(response.url())&&!response.ok())fontFailures.push(response.url())})
  await page.addInitScript(()=>localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'User title の記憶',items:[
    {id:'note',kind:'note',title:'山の思い出\nTrail memories',variant:'yellow',x:0,y:0,w:245,h:200,rotation:0},
    {id:'route',kind:'map',title:'Trail memories',variant:'blue',x:280,y:0,w:245,h:365,rotation:0},
  ],threads:[]})))
  await page.goto('/')
  for(const [label,language,ui,hand] of [
    ['English','en','Inter','Caveat'],['日本語','ja','Noto Sans JP','Klee One'],['简体中文','zh-CN','Segoe UI','Ma Shan Zheng'],
  ]){
    await page.getByRole('button',{name:'Language / 语言 / 言語',exact:true}).click()
    await page.getByRole('menuitemradio',{name:label,exact:true}).click()
    await expect(page.locator('html')).toHaveAttribute('lang',language)
    await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await document.fonts.ready})
    const metrics=await page.evaluate(()=>{
      const note=document.querySelector('.note .handwritten')!,route=document.querySelector('.route-note')!,stub=document.querySelector('.route-ticket-stub')!
      return {
        ui:getComputedStyle(document.body).fontFamily,hand:getComputedStyle(note).fontFamily,
        loaded:Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family.replaceAll('"','')),
        bottom:route.getBoundingClientRect().bottom<=stub.getBoundingClientRect().bottom,
      }
    })
    expect(metrics.ui).toContain(ui);expect(metrics.hand).toContain(hand)
    expect(metrics.loaded).toContain(hand);expect(metrics.bottom).toBe(true)
    if(language==='ja'){
      const css=await page.evaluate(async()=>{
        // @ts-expect-error Vite serves this source module in browser tests.
        const {exportFontCSS}=await import('/src/persistence/exportFonts.ts')
        return exportFontCSS(document.querySelector('.scene'))
      })
      expect(css).toContain('Klee One');expect(css).toContain('Noto Sans JP')
      expect(css).toContain('data:');expect(css).not.toContain('https://')
      expect((css.match(/@font-face/g)??[]).length).toBeLessThan(124)
    }
    await page.screenshot({path:info.outputPath(`board-${language}.png`)})
  }
  expect(fontRequests.length).toBeGreaterThan(0)
  expect(fontRequests.every(url=>new URL(url).hostname==='127.0.0.1')).toBe(true)
  expect(fontFailures).toEqual([])
})
