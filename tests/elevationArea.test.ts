import {test} from 'node:test'
import assert from 'node:assert/strict'
import {elevationArea} from '../src/items/route/elevationArea.ts'

test('area closes each elevation segment without filling data gaps',()=>{
  assert.equal(elevationArea('M10.00 60.00 L50.00 20.00 M90.00 30.00 L230.00 55.00 '),'M10.00 60.00 L50.00 20.00 L50.00 65 L10.00 65 Z M90.00 30.00 L230.00 55.00 L230.00 65 L90.00 65 Z')
  assert.equal(elevationArea(''),'')
  assert.equal(elevationArea('M10 20'),'')
})
