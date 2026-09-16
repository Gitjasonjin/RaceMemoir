import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'
import {readFile} from 'node:fs/promises'

async function prepare(page:Page){
  await page.addInitScript(()=>{const next=sessionStorage.getItem('next-test-board');if(next){localStorage.setItem('racememoir-board-v1',next);sessionStorage.removeItem('next-test-board')}})
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.evaluate(async()=>{
    localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'地图物件验收',items:[
      {id:'ma',recordId:'a',kind:'medal',title:'赛事 A',variant:'bronze',x:80,y:80,w:160,h:260,rotation:0},
      {id:'rb',recordId:'b',kind:'map',title:'赛事 B',variant:'green',x:1300,y:60,w:200,h:170,rotation:0},
      {id:'mc',recordId:'c',kind:'medal',title:'赛事 C',variant:'silver',x:1320,y:590,w:160,h:250,rotation:0},
      {id:'p',kind:'photo',title:'测试照片',variant:'polaroid',image:'/images/mountain.jpg',x:80,y:570,w:230,h:270,rotation:0},
    ],threads:[]}))
    sessionStorage.setItem('next-test-board',localStorage.getItem('racememoir-board-v1')!)
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('racememoir-records-v1',1)
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite'),s=tx.objectStore('records');s.clear()
        s.put({id:'a',kind:'medal',name:'赛事 A',date:'',note:'',source:'demo',cutout:'original',location:{name:'四姑娘山',lat:31,lng:102.8}})
        s.put({id:'b',kind:'route',name:'赛事 B',note:'',source:'demo',trackPoints:[],location:{name:'崇礼',lat:40.9,lng:115.3}})
        s.put({id:'c',kind:'medal',name:'赛事 C',date:'',note:'',source:'demo',cutout:'original',archived:true,location:{name:'四姑娘山',lat:31,lng:102.8}})
        tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)
      }
    })
  })
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
}
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true})
async function save(page:Page){await button(page,'保存修改').click();await expect(page.locator('.record-panel')).toHaveCount(0)}
async function addMap(page:Page){await button(page,'添加地图').click();await expect(page.locator('.race-map-editor')).toBeVisible();await expect(button(page,'使用说明')).toHaveCount(0);await save(page)}
async function editor(page:Page){await page.locator('.memory-race-map').first().focus();await page.keyboard.press('Enter');await expect(page.locator('.race-map-editor')).toBeVisible()}
async function connect(page:Page){
  await button(page,'添加连线').click();await button(page,'地点钉子：四姑娘山，2 场赛事').click()
  await expect(page.getByText('选择连线对应的赛事',{exact:true})).toBeVisible()
  await page.locator('.race-map-editor').getByRole('button',{name:/赛事 A/}).click()
  await button(page,'地点钉子：崇礼，1 场赛事').click();await button(page,'结束连线').click()
  await expect(page.locator('.threads > g[role=button]')).toHaveCount(1)
}
test('map object: grouping, drag, rotation, framing, multiple maps, PNG and clean ZIP restore',async({page,context},info)=>{
  const errors:string[]=[],outside:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.protocol.startsWith('http')&&u.hostname!=='127.0.0.1'){outside.push(u.href);return r.abort()}return r.continue()})
  await prepare(page);await expect(button(page,'打开赛事地图')).toHaveCount(0);await addMap(page)
  await expect(page.locator('.map-place-pin')).toHaveCount(2);await connect(page)
  await button(page,'添加连线').click();await button(page,'地点钉子：四姑娘山，2 场赛事').click()
  await page.locator('.race-map-editor').getByRole('button',{name:/赛事 A/}).click()
  await button(page,'照片：测试照片').click();await button(page,'地点钉子：崇礼，1 场赛事').click()
  await button(page,'照片：测试照片').click();await button(page,'结束连线').click()
  await expect(page.locator('.threads > g[role=button]')).toHaveCount(3)
  const line=page.locator('.threads .red-thread').first(),map=page.locator('.memory-race-map')
  const aligned=async()=>{
    const pins=await Promise.all(['地点钉子：四姑娘山，2 场赛事','地点钉子：崇礼，1 场赛事'].map(name=>button(page,name).evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}))))
    const p=(await line.getAttribute('d'))!.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    expect(Math.hypot(p[0]-pins[0].x,p[1]-pins[0].y)).toBeLessThan(1)
    expect(Math.hypot(p[4]-pins[1].x,p[5]-pins[1].y)).toBeLessThan(1)
  }
  await aligned();const before=await map.getAttribute('style'),beforeLine=await line.getAttribute('d'),r=await map.boundingBox()
  await page.mouse.move(r!.x+60,r!.y+50);await page.mouse.down();await page.mouse.move(r!.x+100,r!.y+75,{steps:8});await page.mouse.up()
  await expect(map).not.toHaveAttribute('style',before!);await aligned()
  await button(page,'撤销').click();await expect(line).toHaveAttribute('d',beforeLine!)
  await button(page,'重做').click();await aligned();await editor(page);await button(page,'关闭地图编辑').click()
  await button(page,'向右旋转').click();await aligned();await editor(page)
  await expect(page.getByLabel('地图标题',{exact:true})).toHaveCount(0);await page.locator('.race-map-editor').getByRole('button',{name:'工字钉',exact:true}).click();await expect(page.locator('.race-map-editor')).toBeVisible();await page.getByRole('button',{name:'大 980 × 728',exact:true}).click()
  await button(page,'放大地图').click();await save(page);await aligned()
  await expect(map.locator('.race-map-item-heading')).toHaveCount(0)
  await page.screenshot({path:info.outputPath('map-object.png')})
  await button(page,'分享').click()
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:/导出高清图片/}).click()
  const png=info.outputPath('board.png');await (await downloading).saveAs(png)
  const pixels=await page.evaluate(async(base64)=>{
    const b=await (await fetch(`data:image/png;base64,${base64}`)).blob(),im=await createImageBitmap(b),c=document.createElement('canvas');c.width=im.width;c.height=im.height
    const ctx=c.getContext('2d')!;ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data
    let opaque=0,red=0;for(let i=0;i<p.length;i+=4){if(p[i+3]===255)opaque++;if(p[i]>100&&p[i]>p[i+1]*1.5&&p[i+3]>100)red++}im.close();return {total:c.width*c.height,opaque,red}
  },(await readFile(png)).toString('base64'))
  expect(pixels.opaque).toBe(pixels.total);expect(pixels.red).toBeGreaterThan(200)
  const zipping=page.waitForEvent('download');await page.getByRole('button',{name:/导出收藏板文件/}).click()
  const zip=info.outputPath('board.zip');await (await zipping).saveAs(zip);await button(page,'关闭').click()
  await page.evaluate(async()=>{localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'空',items:[],threads:[]}));sessionStorage.setItem('next-test-board',localStorage.getItem('racememoir-board-v1')!);await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('racememoir-records-v1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})})
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await page.locator('input[type=file][accept*=".zip"]').setInputFiles(zip)
  await expect(page.getByText('收藏板及关联文件已导入',{exact:true})).toBeVisible()
  await expect(map).toHaveCount(1);await expect(page.locator('.map-place-pin')).toHaveCount(2)
  await aligned();await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await aligned()
  await context.setOffline(true);await editor(page);await expect(page.locator('.race-map-editor-preview .race-province')).toHaveCount(34);await context.setOffline(false)
  await button(page,'关闭地图编辑').click();await addMap(page);await expect(map).toHaveCount(2);await expect(page.locator('.map-place-pin')).toHaveCount(4)
  await button(page,'撤销').click();await button(page,'撤销').click();await expect(map).toHaveCount(1)
  await button(page,'适应画布').click();const vp=await page.locator('.board-viewport').boundingBox()
  await page.keyboard.down('Control');await page.mouse.move(vp!.x+90,vp!.y+25);await page.mouse.down();await page.mouse.move(vp!.x+vp!.width-60,vp!.y+vp!.height-50,{steps:8});await page.mouse.up();await page.keyboard.up('Control')
  expect(await page.locator('.memory.selected').count()).toBeGreaterThan(1)
  expect(errors).toEqual([]);expect(outside).toEqual([])
})

test('hidden connections restore after crop/location/membership changes and guard record deletion',async({page})=>{
  await prepare(page);await addMap(page);await connect(page);await editor(page)
  for(let i=0;i<8;i++)await button(page,'放大地图').click()
  const r=await page.locator('.race-map-editor .race-map-canvas>svg').boundingBox()
  await page.mouse.move(r!.x+20,r!.y+20);await page.mouse.down();await page.mouse.move(r!.x+700,r!.y+600,{steps:8});await page.mouse.up();await save(page)
  await expect(page.locator('.threads > g[role=button]')).toHaveCount(0)
  await editor(page);await expect(page.getByText('暂未显示的连线 · 1')).toBeVisible();await button(page,'重置地图').click();await save(page)
  await expect(page.locator('.threads > g[role=button]')).toHaveCount(1)
  await button(page,'奖牌：赛事 A').focus();await page.keyboard.press('Enter')
  await button(page,'清除地点').click();await save(page)
  await expect(page.locator('.threads > g[role=button]')).toHaveCount(0)
  await button(page,'奖牌：赛事 A').focus();await page.keyboard.press('Enter')
  await button(page,'添加赛事地点').click();await page.getByText('手动输入经纬度',{exact:true}).click();await page.getByLabel('地点名称',{exact:true}).fill('香港');await page.getByLabel('纬度',{exact:true}).fill('22.3');await page.getByLabel('经度',{exact:true}).fill('114.2');await save(page)
  await expect(page.locator('.map-place-pin')).toHaveCount(3);await expect(page.locator('.threads > g[role=button]')).toHaveCount(1)
  await button(page,'删除选中项').click();await expect(page.locator('.threads > g[role=button]')).toHaveCount(0)
  await button(page,'撤销').click();await expect(page.locator('.threads > g[role=button]')).toHaveCount(1);await button(page,'重做').click()
  await button(page,'打开收藏库').click();await button(page,'删除 赛事 A').click();await page.getByRole('button',{name:/查看回收站/}).click();await expect(button(page,'彻底删除 赛事 A')).toBeDisabled()
  await button(page,'关闭收藏库').click();await editor(page);await button(page,'删除暂未显示的连线').click();await button(page,'关闭地图编辑').click()
  await button(page,'打开收藏库').click();await page.getByRole('button',{name:/查看回收站/}).click();await button(page,'彻底删除 赛事 A').click();await button(page,'确认彻底删除').click();await expect(button(page,'彻底删除 赛事 A')).toHaveCount(0)
})

test('location editor: inline province search and point selection',async({page},info)=>{
  await prepare(page);await button(page,'奖牌：赛事 A').focus();await page.keyboard.press('Enter')
  await button(page,'清除地点').click();await button(page,'添加赛事地点').click()
  await page.getByLabel('定位省区',{exact:true}).fill('四川');await button(page,'四川省').click()
  await expect(page.locator('.race-location-inline .race-map-tools')).toContainText('300%')
  await page.getByLabel('点选赛事地点',{exact:true}).click({position:{x:140,y:100}})
  await page.getByLabel('地点名称',{exact:true}).fill('山间起点')
  await expect(page.getByText('已选位置 · 可再次点击地图调整',{exact:false})).toBeVisible()
  await page.screenshot({path:info.outputPath('location-editor.png')});await save(page)
  await button(page,'奖牌：赛事 A').focus();await page.keyboard.press('Enter')
  await expect(page.getByLabel('地点名称',{exact:true})).toHaveValue('山间起点')
  await page.getByText('手动输入经纬度',{exact:true}).click()
  expect(Number(await page.getByLabel('纬度',{exact:true}).inputValue())).toBeGreaterThan(20)
  expect(Number(await page.getByLabel('经度',{exact:true}).inputValue())).toBeGreaterThan(90)
})

test('map themes preview, save independently and survive reload',async({page},info)=>{
  await prepare(page);await addMap(page);await editor(page)
  for(const [label,id] of [['旅行折叠图','travel'],['测绘蓝图','survey'],['复古地图','vintage']]){
    await button(page,label).click();await expect(button(page,label)).toHaveAttribute('aria-pressed','true')
    await expect(page.locator(`.race-map-editor-preview .map-drawing.map-theme-${id}`)).toHaveCount(1)
  }
  await page.locator('.map-style-options').scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('map-themes.png')})
  await button(page,'测绘蓝图').click();await save(page)
  await expect(page.locator('.race-map-paper-item.map-theme-survey')).toHaveCount(1)
  await addMap(page);await expect(page.locator('.race-map-paper-item.map-theme-travel')).toHaveCount(1)
  await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'})
  await expect(page.locator('.race-map-paper-item.map-theme-survey')).toHaveCount(1)
  await expect(page.locator('.race-map-paper-item.map-theme-travel')).toHaveCount(1)
})

test('map size presets and scroll do not conflict with 1000 percent zoom',async({page})=>{
  await prepare(page);await addMap(page);await editor(page)
  await expect(button(page,'地形图')).toHaveCount(0)
  const panel=page.locator('.race-map-editor'),preview=panel.locator('.race-map-editor-preview'),zoom=preview.locator('.race-map-tools span')
  await preview.hover();await page.mouse.wheel(0,260)
  await expect.poll(()=>panel.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
  await expect(zoom).toHaveText('100%')
  await preview.scrollIntoViewIfNeeded();await preview.hover()
  const scroll=await panel.evaluate(el=>el.scrollTop)
  await page.keyboard.down('Control');await page.mouse.wheel(0,-2000);await page.keyboard.up('Control')
  await expect(zoom).toHaveText('1000%');expect(await panel.evaluate(el=>el.scrollTop)).toBe(scroll)
  await expect(preview.getByRole('button',{name:'放大地图',exact:true})).toBeDisabled()
  for(const name of ['小 490 × 364','中 700 × 520','大 980 × 728','特大 1260 × 936']){
    await button(page,name).click();await expect(button(page,name)).toHaveAttribute('aria-pressed','true')
  }
  await save(page);await page.reload();await page.locator('.records-loading').waitFor({state:'hidden'});await editor(page)
  await expect(zoom).toHaveText('1000%');await expect(button(page,'特大 1260 × 936')).toHaveAttribute('aria-pressed','true')
})
