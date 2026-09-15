import {test} from 'node:test'
import assert from 'node:assert/strict'
import {seed,isBoard} from '../src/domain/model.ts'
import {PHOTO_PAPERS,MEDAL_FRAMES,resolvePhotoPaper,resolveMedalFrame} from '../src/domain/styleCatalog.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'

test('paper and frame options round-trip independently of size, crop, medal material and other instances',async()=>{
  const photo=seed.items.find(i=>i.kind==='photo')!,medal=seed.items[0]
  const items=[...PHOTO_PAPERS.map(p=>({...photo,id:p.id,photoPaper:p.id,photoZoom:1.6,photoX:25})),...MEDAL_FRAMES.map(f=>({...medal,id:f.id,medalFrame:f.id,shadowDepth:85}))]
  const board={title:'材质备份',items,threads:[]}
  const restored=(await readBackup(await makeZipArchive(board,[]))).board
  assert.deepEqual(restored,board)
  assert.equal(photo.photoPaper,undefined)
  assert.equal(medal.medalFrame,undefined)
  assert.equal(resolvePhotoPaper(undefined,'landscape').caption,'overlay')
  assert.equal(resolvePhotoPaper(undefined,'portrait').caption,'footer')
  assert.equal(resolvePhotoPaper('future-paper','portrait').id,'polaroid')
  assert.equal(resolveMedalFrame('future-frame').id,'wood')
})

test('rejects invalid surface metadata and shadow depths while allowing shadow-free display',()=>{
  for(const value of [-1,101,NaN,Infinity,'50'])assert.equal(isBoard({title:'test',threads:[],items:[{...seed.items[0],shadowDepth:value}]}),false)
  for(const key of ['photoPaper','medalFrame'])assert.equal(isBoard({title:'test',threads:[],items:[{...seed.items[0],[key]:{id:'wood'}}]}),false)
  assert.equal(isBoard({...seed,items:seed.items.map(i=>({...i,shadowDepth:0}))}),true)
})
