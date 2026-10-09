import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'

const lock=JSON.parse(await readFile(new URL('../../resources/background-removal.lock.json',import.meta.url),'utf8'))
const runtime=lock.resources['/onnxruntime-web/ort-wasm-simd-threaded.mjs']

test('tampered executable resource is rejected before any module code can run',async({page,context})=>{
  const requests:string[]=[]
  context.on('request',request=>requests.push(request.url()))
  for(const chunk of runtime.chunks){
    const malicious=`self.postMessage({type:'executed'});export default()=>{};`
    await context.route(`**${lock.publicPath}${chunk.name}`,route=>route.fulfill({
      contentType:'application/octet-stream',body:malicious.padEnd(chunk.offsets[1]-chunk.offsets[0],' '),
    }))
  }
  await page.goto('/')
  const messages=await page.evaluate(async()=>{
    const script=`
      import {secureBackgroundRemovalResources} from '${location.origin}/src/shared/backgroundRemovalResources.ts';
      const base=secureBackgroundRemovalResources(self.location.origin,'/');
      try{
        const manifest=await (await fetch(new URL('resources.json',base))).json();
        const entry=manifest['/onnxruntime-web/ort-wasm-simd-threaded.mjs'];
        const parts=await Promise.all(entry.chunks.map(async chunk=>(await fetch(new URL(chunk.name,base))).blob()));
        await import(URL.createObjectURL(new Blob(parts,{type:entry.mime})));
        postMessage({type:'accepted'});
      }catch(error){postMessage({type:'rejected',name:error.name})}
    `
    const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}))
    const worker=new Worker(url,{type:'module'}),messages:{type:string;name?:string}[]=[]
    try{return await new Promise<typeof messages>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Security worker timed out')),15000)
      worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message))}
      worker.onmessage=e=>{messages.push(e.data);if(e.data.type==='rejected'||e.data.type==='accepted'){clearTimeout(timer);resolve(messages)}}
    })}finally{worker.terminate();URL.revokeObjectURL(url)}
  })
  expect(messages).toEqual([{type:'rejected',name:'ResourceIntegrityError'}])
  expect(requests.some(url=>url.includes('staticimgly.com'))).toBe(false)
  expect(requests.some(url=>url.endsWith('/resources.json'))).toBe(false)
})

test('real cutout worker blocks tampered runtime and keeps the uploaded original available',async({page,context})=>{
  for(const chunk of runtime.chunks)await context.route(`**${lock.publicPath}${chunk.name}`,route=>route.fulfill({
    contentType:'application/octet-stream',body:' '.repeat(chunk.offsets[1]-chunk.offsets[0]),
  }))
  await page.goto('/');await page.locator('.records-loading').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'添加贴纸',exact:true}).click()
  await page.getByLabel('贴纸图片',{exact:true}).setInputFiles({name:'hiking.jpg',mimeType:'image/jpeg',buffer:await readFile(new URL('../../public/images/hiking.jpg',import.meta.url))})
  await expect(page.getByRole('alert')).toContainText('抠图资源校验失败',{timeout:30000})
  await expect(page.getByRole('button',{name:'保存并放上画布',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'使用原图',exact:true}).click()
  await expect(page.getByRole('button',{name:'保存并放上画布',exact:true})).toBeEnabled()
})

for(const isolated of [false,true])test(`real local CPU cutout succeeds with cross-origin isolation ${isolated}`,async({page,context},info)=>{
  test.setTimeout(240_000)
  if(isolated){
    const isolate=async(route:import('@playwright/test').Route)=>{
      const response=await route.fetch()
      await route.fulfill({response,headers:{...response.headers(),'cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'}})
    }
    await context.route('http://127.0.0.1:5187/',isolate)
    await context.route('**/src/items/medal/cutout.worker.ts',isolate)
  }
  const requests:string[]=[]
  context.on('request',request=>requests.push(request.url()))
  await page.goto('/')
  await page.locator('.records-loading').waitFor({state:'hidden'})
  expect(await page.evaluate(()=>crossOriginIsolated)).toBe(isolated)
  const result=await page.evaluate(async()=>{
    const original=await (await fetch('/images/hiking.jpg')).blob()
    const worker=new Worker('/src/items/medal/cutout.worker.ts',{type:'module'})
    try{
      const image=await new Promise<Blob>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Local model timed out')),200000)
        worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message))}
        worker.onmessage=e=>{
          if(e.data.type==='done'){clearTimeout(timer);resolve(e.data.image)}
          else if(e.data.type==='error'){clearTimeout(timer);reject(new Error(JSON.stringify(e.data)))}
        }
        worker.postMessage({blob:original,subject:'sticker'})
      })
      const source=await createImageBitmap(original),output=await createImageBitmap(image)
      const canvas=new OffscreenCanvas(output.width,output.height),ctx=canvas.getContext('2d')!
      ctx.drawImage(source,0,0);const rgb=ctx.getImageData(0,0,output.width,output.height).data
      ctx.clearRect(0,0,output.width,output.height);ctx.drawImage(output,0,0)
      const data=ctx.getImageData(0,0,output.width,output.height).data
      let visible=0,transparent=0,preserved=0,maxColorDifference=0
      for(let i=0;i<data.length;i+=4){
        if(data[i+3]===0)transparent++
        if(data[i+3]>=250){
          visible++
          const difference=Math.max(Math.abs(data[i]-rgb[i]),Math.abs(data[i+1]-rgb[i+1]),Math.abs(data[i+2]-rgb[i+2]))
          maxColorDifference=Math.max(maxColorDifference,difference)
          if(difference<=1)preserved++
        }
      }
      const dimensions=[output.width,output.height];source.close();output.close()
      const base64=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve((reader.result as string).split(',')[1]);reader.readAsDataURL(image)})
      return {dimensions,visible,transparent,preserved,maxColorDifference,size:image.size,cacheKeys:await caches.keys(),base64}
    }finally{worker.terminate()}
  })
  const {writeFile}=await import('node:fs/promises')
  await writeFile(info.outputPath('local-cutout.png'),Buffer.from(result.base64,'base64'))
  expect(result.dimensions).toEqual([900,601])
  expect(result.visible).toBeGreaterThan(1000);expect(result.transparent).toBeGreaterThan(1000)
  // Canvas premultiplication can round a nearly opaque RGB channel by 1–2 levels.
  expect(result.preserved/result.visible).toBeGreaterThan(.999)
  expect(result.maxColorDifference).toBeLessThanOrEqual(2)
  expect(result.size).toBeGreaterThan(10000)
  expect(result.cacheKeys).toContain(lock.cacheName)
  const resources=requests.filter(url=>url.includes('/background-removal/'))
  expect(resources.length).toBeGreaterThan(2)
  expect(resources.every(url=>url.startsWith(`http://127.0.0.1:5187${lock.publicPath}`))).toBe(true)
  expect(requests.some(url=>url.includes('staticimgly.com'))).toBe(false)
})
