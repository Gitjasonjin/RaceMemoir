import {test} from 'node:test'
import assert from 'node:assert/strict'
import {rangeIncludesText} from '../src/persistence/exportFonts.ts'

test('font subsets include only ranges needed by actual multilingual text',()=>{
  assert.equal(rangeIncludesText('U+0000-00FF','Trail memories'),true)
  assert.equal(rangeIncludesText('U+3040-309F,U+30A0-30FF','おもいで'),true)
  assert.equal(rangeIncludesText('U+3040-309F,U+30A0-30FF','Trail memories'),false)
  assert.equal(rangeIncludesText('U+65E5','日本語'),true)
  assert.equal(rangeIncludesText('U+4E??','一'),true)
  assert.equal(rangeIncludesText('U+4E??','日'),false)
  assert.equal(rangeIncludesText('U+1F300-1FAFF','🌲'),true)
  assert.equal(rangeIncludesText('','中文 English 日本語'),true)
})
