import {test} from 'node:test'
import assert from 'node:assert/strict'
import {dragMedalCrop,FULL_MEDAL_CROP,validMedalCrop} from '../src/items/medal/medalCrop.ts'
import {validRecord} from '../src/domain/records.ts'

test('crop handles and moves stay inside the image and cannot collapse or invert',()=>{
  const crop={x:.2,y:.3,width:.4,height:.5}
  assert.deepEqual(dragMedalCrop(crop,'move',-5,5),{...crop,x:0,y:.5})
  for(const handle of ['nw','ne','sw','se'] as const)for(const dx of [-5,0,5])for(const dy of [-5,0,5]){
    assert.ok(validMedalCrop(dragMedalCrop(crop,handle,dx,dy)))
  }
  assert.deepEqual(dragMedalCrop(FULL_MEDAL_CROP,'nw',.25,.25),{x:.25,y:.25,width:.75,height:.75})
})
test('medal records accept old records and valid crops but reject malformed imported crop metadata',()=>{
  const record={id:'medal',kind:'medal',name:'奖牌',note:'',source:'demo',date:'',cutout:'original'}
  assert.ok(validRecord(record));assert.ok(validRecord({...record,crop:FULL_MEDAL_CROP}))
  for(const crop of [null,{}, {...FULL_MEDAL_CROP,x:-.1},{...FULL_MEDAL_CROP,width:0},{...FULL_MEDAL_CROP,x:.1},{...FULL_MEDAL_CROP,height:Infinity}])assert.equal(validRecord({...record,crop}),false)
})
