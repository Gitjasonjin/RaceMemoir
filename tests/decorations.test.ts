import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, getDecorations, DEFAULT_DECORATIONS, changeDecoration, isBoard, pinPosition } from '../src/model.ts'

test('旧收藏板无需迁移即可使用原稿样式', () => {
  const legacy = JSON.parse(JSON.stringify(seed))
  assert.equal(isBoard(legacy), true)
  assert.deepEqual(getDecorations(legacy), DEFAULT_DECORATIONS)
})

test('单件样式与整板默认值独立，且不改变坐标、连接或原始数据', () => {
  const before = structuredClone(seed)
  const global = changeDecoration(seed, {kind:'pin',style:'brass'})
  const local = changeDecoration(global, {kind:'pin',style:'forest'}, 'ridge-bib')
  assert.equal(getDecorations(local).pin, 'brass')
  assert.equal(local.items.find(i=>i.id==='ridge-bib')?.pinStyle, 'forest')
  assert.equal(local.items.find(i=>i.id==='ridge-medal')?.pinStyle, undefined)
  assert.deepEqual(local.items.map(pinPosition), seed.items.map(pinPosition))
  assert.deepEqual(local.threads, seed.threads)
  assert.deepEqual(seed, before)
  assert.equal(isBoard(local), true)
})

test('整板替换清除对应局部样式，同时保留其他种类的选择', () => {
  let board = changeDecoration(seed, {kind:'pin',style:'forest'}, 'ridge-bib')
  board = changeDecoration(board, {kind:'tape',style:'sage'}, 'ridge-bib')
  board = changeDecoration(board, {kind:'pin',style:'pearl'})
  assert.equal(board.items.find(i=>i.id==='ridge-bib')?.pinStyle, undefined)
  assert.equal(board.items.find(i=>i.id==='ridge-bib')?.tapeStyle, 'sage')
  assert.equal(getDecorations(board).pin, 'pearl')
  board = changeDecoration(board, {kind:'tape',style:undefined}, 'ridge-bib')
  assert.equal(board.items.find(i=>i.id==='ridge-bib')?.tapeStyle, undefined)
  assert.equal(getDecorations(board).tape, 'classic')
})

test('导出后重新导入保留整板样式、局部胶带和单独的红线样式', () => {
  let board = changeDecoration(seed, {kind:'thread',style:'cord'})
  board = changeDecoration(board, {kind:'thread',style:'dashed'}, 'thread-0')
  board = changeDecoration(board, {kind:'tape',style:'dots'}, 'pine-bib')
  const imported = JSON.parse(JSON.stringify(board))
  assert.equal(isBoard(imported), true)
  assert.equal(getDecorations(imported).thread, 'cord')
  assert.equal(imported.threads[0].style, 'dashed')
  assert.equal(imported.threads[1].style, undefined)
  assert.equal(imported.items.find((i:{id:string})=>i.id==='pine-bib').tapeStyle, 'dots')
})

test('拒绝无效装饰配置，避免损坏数据覆盖当前收藏板', () => {
  for (const decorations of [null, [], 'brass', {pin:'unknown'}, {tape:12}, {thread:'url(unsafe)'}]) {
    assert.equal(isBoard({...seed,decorations}), false)
  }
  assert.equal(isBoard({...seed,items:seed.items.map(i=>({...i,pinStyle:'unknown'}))}), false)
  assert.equal(isBoard({...seed,items:seed.items.map(i=>({...i,tapeStyle:{}}))}), false)
  assert.equal(isBoard({...seed,threads:seed.threads.map(t=>({...t,style:'unknown'}))}), false)
})
