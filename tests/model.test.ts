import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, isBoard, pinPosition, createMemory, WIDTH, HEIGHT } from '../src/model.ts'

test('示例收藏板有效，藏品和连接引用完整', () => {
  assert.equal(isBoard(seed), true)
  for (const item of seed.items) {
    assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.w <= WIDTH && item.y + item.h <= HEIGHT)
  }
})
test('旋转后的图钉在藏品中心坐标系中正确变换', () => {
  const item = { ...seed.items[0], x: 100, y: 100, w: 200, h: 300, rotation: 0 }
  assert.deepEqual(pinPosition(item), { x: 200, y: 107 })
  const rotated = pinPosition({ ...item, rotation: 90 })
  assert.equal(rotated.x, 343)
  assert.equal(rotated.y, 250)
})
test('藏品平移后红线端点同步平移', () => {
  for (const item of seed.items) {
    const before = pinPosition(item), after = pinPosition({ ...item, x: item.x + 83, y: item.y - 21 })
    assert.ok(Math.abs(after.x - before.x - 83) < .00001)
    assert.ok(Math.abs(after.y - before.y + 21) < .00001)
  }
})
test('拒绝损坏数据、重复 ID、悬空连接和外部图片路径', () => {
  assert.equal(isBoard(null), false)
  assert.equal(isBoard({ ...seed, items: [null] }), false)
  assert.equal(isBoard({ ...seed, items: [seed.items[0], seed.items[0]] }), false)
  assert.equal(isBoard({ ...seed, items: [{ ...seed.items[0], x: NaN }] }), false)
  assert.equal(isBoard({ ...seed, items: [{ ...seed.items[0], x: WIDTH + 1 }], threads: [] }), true)
  assert.equal(isBoard({ ...seed, threads: [seed.threads[0], seed.threads[0]] }), false)
  assert.equal(isBoard({ ...seed, threads: [{ id: 'bad', from: 'missing', to: seed.items[0].id }] }), false)
  assert.equal(isBoard({ ...seed, items: [{ ...seed.items[2], image: 'https://example.com/track' }], threads: [] }), false)
})
test('各类新藏品具有唯一 ID，且可导入和导出', () => {
  const items = (['photo', 'medal', 'bib', 'note', 'map'] as const).map(kind => createMemory(kind, '新记忆', 'green', '/images/mountain.jpg', '1234'))
  assert.equal(new Set(items.map(i => i.id)).size, 5)
  assert.equal(isBoard(JSON.parse(JSON.stringify({ title: '收藏板', items, threads: [] }))), true)
})
