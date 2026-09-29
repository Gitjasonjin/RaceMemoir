import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'

test('GPX location is automatic, manual overrides survive replacement, medal editor hides location',async({page},info)=>{
 const tile=await seed(page)
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:tile}))
 await page.getByRole('button',{name:'添加奖牌',exact:true}).click()
 await expect(page.locator('.race-location-editor')).toHaveCount(0)
 await page.getByRole('button',{name:'关闭详情',exact:true}).click()
 await page.getByRole('button',{name:'添加路线',exact:true}).click()
 const gpx=(lat:number)=>({name:'route.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(`<gpx><trk><name>山野测试</name><trkseg><trkpt lat="${lat}" lon="120.23"/><trkpt lat="${lat+.01}" lon="120.25"/></trkseg></trk></gpx>`)})
 const upload=page.getByLabel('GPX 文件',{exact:true})
 await upload.setInputFiles(gpx(30.12))
 await expect(page.getByText('已从 GPX 自动定位',{exact:false})).toBeVisible()
 await expect(page.getByLabel('地点名称',{exact:true})).toBeHidden()
 await page.getByLabel('路线名称',{exact:true}).fill('重命名路线')
 await expect(page.locator('.route-location-settings')).toContainText('重命名路线')
 await page.getByText('修改位置',{exact:true}).click()
 await page.getByLabel('地点名称',{exact:true}).fill('手动会场')
 await upload.setInputFiles(gpx(31.5))
 await expect(page.getByLabel('地点名称',{exact:true})).toHaveValue('手动会场')
 await page.getByText('手动输入经纬度',{exact:true}).click()
 await expect(page.getByLabel('纬度',{exact:true})).toHaveValue('30.12')
 await page.getByRole('button',{name:'使用 GPX 起点',exact:true}).click()
 await expect(page.getByLabel('纬度',{exact:true})).toHaveValue('31.5')
 await expect(page.getByLabel('地点名称',{exact:true})).toHaveValue('重命名路线')
 await page.getByText('修改位置',{exact:true}).click()
 await page.screenshot({path:info.outputPath('route-location.png')})
 await page.getByRole('button',{name:'保存并放上画布',exact:true}).click()
 await expect(page.getByRole('button',{name:'关闭详情',exact:true})).toHaveCount(0)
 await page.reload()
 const saved=await page.evaluate(async()=>{
  const {readRecords}=await import('/src/persistence/recordStore.ts')
  const r=(await readRecords()).find(r=>r.name==='重命名路线')
  return r?.kind==='route'?r.location:null
 })
 expect(saved).toMatchObject({source:'gpx',name:'重命名路线',lat:31.5,lng:120.23})
})

async function seed(page:Page){
 await page.addInitScript(()=>{
  const staged=sessionStorage.getItem('basemap-board')
  if(staged){localStorage.setItem('racememoir-board-v1',staged);sessionStorage.removeItem('basemap-board')}
  else if(!localStorage.getItem('racememoir-board-v1'))localStorage.setItem('racememoir-board-v1',JSON.stringify({title:'地图验收',items:[],threads:[]}))
 })
 await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
 const tile=await page.evaluate(async()=>{
  const {putRecords}=await import('/src/persistence/recordStore.ts')
  const trackPoints=Array.from({length:60},(_,i)=>{const a=i/59*Math.PI*2;return {lat:30.35+.03*Math.sin(a),lon:119.42+.04*Math.cos(a),elevation:200+Math.round(700*Math.abs(Math.sin(a*2))),segment:0}})
  await putRecords([{id:'track',kind:'route',source:'upload',name:'天目山径',note:'每一步，都算数。',gpx:new Blob(['<gpx/>'],{type:'application/gpx+xml'}),trackPoints}])
  sessionStorage.setItem('basemap-board',JSON.stringify({title:'地图验收',items:[{id:'track-card',kind:'map',recordId:'track',title:'天目山径',variant:'blue',x:100,y:100,w:320,h:460,rotation:0}],threads:[]}))
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!
  c.fillStyle='#d8e2c5';c.fillRect(0,0,256,256);c.strokeStyle='#b0c9d5';c.lineWidth=12;c.beginPath();c.moveTo(0,180);c.bezierCurveTo(70,100,160,220,256,90);c.stroke()
  c.strokeStyle='#fffdf0';c.lineWidth=5;c.beginPath();c.moveTo(10,0);c.lineTo(180,256);c.stroke();c.fillStyle='#526650';c.font='14px sans-serif';c.fillText('TEST MAP',70,40)
  return canvas.toDataURL().split(',')[1]
 })
 return Buffer.from(tile,'base64')
}

test('basemap loads once, survives offline reload and exports with green elevation area',async({page},info)=>{
 const tile=await seed(page);let requests=0
 await page.route('https://tile.openstreetmap.org/**',r=>{requests++;return r.fulfill({contentType:'image/png',body:tile,headers:{'access-control-allow-origin':'*','cache-control':'max-age=604800'}})})
 await page.reload();const map=page.locator('.scene [data-route-map-state]')
 await expect(map).toHaveAttribute('data-route-map-state','ready')
 expect(requests).toBeGreaterThan(0);expect(requests).toBeLessThanOrEqual(12)
 await expect(page.locator('.route-elevation-area')).toHaveAttribute('d',/Z$/)
 await expect(page.locator('.route-elevation-area')).toHaveAttribute('fill','#537760')
 const before=requests
 await page.reload();await expect(map).toHaveAttribute('data-route-map-state','ready');expect(requests).toBe(before)
 await page.unroute('https://tile.openstreetmap.org/**');await page.route('https://tile.openstreetmap.org/**',r=>r.abort())
 await page.reload();await expect(map).toHaveAttribute('data-route-map-state','ready')
 await page.screenshot({path:info.outputPath('basemap.png')})
 await page.getByRole('button',{name:'分享',exact:true}).click();const pending=page.waitForEvent('download')
 await page.getByRole('button',{name:/导出高清图片/}).click();await(await pending).saveAs(info.outputPath('basemap-export.png'))
})

test('failed maps preserve track, block incomplete exports and can retry',async({page})=>{
 const tile=await seed(page);let fail=true
 await page.route('https://tile.openstreetmap.org/**',r=>fail?r.abort():r.fulfill({contentType:'image/png',body:tile,headers:{'access-control-allow-origin':'*','cache-control':'max-age=604800'}}))
 await page.reload();const map=page.locator('.scene [data-route-map-state]')
 await expect(map).toHaveAttribute('data-route-map-state','error')
 await expect(map.locator(':scope>path')).toHaveAttribute('d',/^M/)
 const error=await page.evaluate(async()=>{
  const {exportBoardImage}=await import('/src/persistence/exportImage.ts')
  try{await exportBoardImage(document.querySelector('.scene')!,JSON.parse(localStorage.getItem('racememoir-board-v1')!));return ''}catch(e){return (e as Error).message}
 })
 expect(error).toContain('底图加载失败')
 fail=false;await page.getByRole('button',{name:'重新加载地图背景'}).click()
 await expect(map).toHaveAttribute('data-route-map-state','ready')
})
