import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ITEM_STYLES,resolveStyle,backgroundStyle,resolveBackground,PIN_OPTIONS,PIN_STYLES} from '../src/styleCatalog.ts'
import {seed,isBoard,createMemory,hasPin} from '../src/model.ts'
import {makeArchive,readArchive} from '../src/recordArchive.ts'

test('every registered item style resolves to its own definition and default size',()=>{
  for(const kind of Object.keys(ITEM_STYLES) as (keyof typeof ITEM_STYLES)[]){
    const styles=ITEM_STYLES[kind]
    assert.equal(new Set(styles.map(s=>s.id)).size,styles.length)
    for(const style of styles){
      assert.equal(resolveStyle(kind,style.id),style)
      const item=createMemory(kind,'test',style.id,'/images/mountain.jpg','A123')
      assert.equal(item.w,style.w);assert.equal(item.h,style.h)
      assert.ok(isBoard({title:'test',items:[item],threads:[]}))
    }
  }
  assert.deepEqual(PIN_STYLES,PIN_OPTIONS.map(s=>s.id))
})

test('legacy and unavailable styles fall back without altering saved content or layout',async()=>{
  const board=structuredClone(seed),before=structuredClone(board)
  assert.ok(isBoard(board))
  board.items.forEach(i=>resolveStyle(i.kind,i.variant))
  assert.deepEqual(board,before)
  const item={...seed.items[2],variant:'unavailable-photo-style',photoZoom:1.7,photoX:20}
  const saved={title:'test',items:[item],threads:[],backgroundStyle:'unavailable-background'}
  assert.equal(resolveStyle('photo',item.variant).id,'polaroid')
  assert.equal(resolveBackground(saved.backgroundStyle).id,'cork')
  const restored=readArchive(await makeArchive(saved,[]))
  assert.deepEqual(restored.board,saved)
  assert.equal(hasPin({...seed.items[5],variant:'paper'}),true)
  assert.equal(hasPin({...seed.items[5],variant:'yellow'}),false)
})

test('canvas and export backgrounds share texture and respect scale and world origin',()=>{
  const canvas=backgroundStyle(undefined,1,10,-20),exported=backgroundStyle('cork',2,20,-40)
  assert.equal(canvas.backgroundImage,exported.backgroundImage)
  assert.equal(canvas.backgroundColor,exported.backgroundColor)
  assert.equal(canvas.backgroundSize,'100% 100%, 220px 220px')
  assert.equal(exported.backgroundSize,'100% 100%, 440px 440px')
  assert.equal(exported.backgroundPosition,'0 0, 20px -40px')
  assert.equal(isBoard({...seed,backgroundStyle:{id:'cork'}}),false)
})
