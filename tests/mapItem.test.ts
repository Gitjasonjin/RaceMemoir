import {MAP_SIZE_OPTIONS} from '../src/domain/mapSettings.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createMemory,isBoard,seed} from '../src/domain/model.ts'
import type {Board,Thread} from '../src/domain/model'
import type {CollectionRecord} from '../src/domain/records'
import {boardRaceRecords,groupRaceLocations} from '../src/race-map/raceMapGrouping.ts'
import {hasConnection,localToWorld,mapContentRect,racePointOnMap,resolveEndpoint,recordThreadReferences} from '../src/board/threadEndpoints.ts'
import {mapGeometry} from '../src/race-map/mapGeometry.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'
import {contentBounds} from '../src/board/canvas.ts'

const records:CollectionRecord[]=[
  {id:'race-a',kind:'medal',name:'赛事 A',date:'',note:'',source:'demo',cutout:'original',location:{name:'四姑娘山',lat:31,lng:102.8}},
  {id:'race-b',kind:'route',name:'赛事 B',note:'',source:'demo',trackPoints:[],archived:true,location:{name:'四姑娘山',lat:31,lng:102.8}},
  {id:'off-board',kind:'medal',name:'未上板',date:'',note:'',source:'demo',cutout:'original',location:{name:'香港',lat:22.3,lng:114.2}},
]
function fixture():Board{return {title:'地图物件',items:[
  {...createMemory('race-map','地图','paper','',''),id:'map',x:300,y:200,rotation:0},
  {...seed.items[0],id:'a',recordId:'race-a'}, {...seed.items[0],id:'a-copy',recordId:'race-a'},
  {...seed.items[4],id:'b',recordId:'race-b'},seed.items[2],
],threads:[]}}
test('map item defaults, validation and board-only grouping retain archived records in use',()=>{
  const board=fixture(),item=board.items[0]
  assert.equal(item.variant,'travel');assert(isBoard({...board,items:[{...item,mapView:{x:0,y:0,scale:10}}]}))
  for(const size of MAP_SIZE_OPTIONS)assert(isBoard({...board,items:[{...item,w:size.w,h:size.h}]}))
  assert.equal(item.w,700);assert.equal(item.h,520);assert(isBoard(board))
  assert.equal(boardRaceRecords(board,records).length,2)
  assert.equal(groupRaceLocations(boardRaceRecords(board,records),true)[0].races.length,2)
  for(const mapView of [{x:0,y:0,scale:11},{x:Infinity,y:0,scale:1},{x:400,y:0,scale:1}])assert(!isBoard({...board,items:[{...item,mapView}]}))
  assert(!isBoard({...board,items:[{...item,w:50}]}))
})
test('geographic endpoint uses the same crop, size and rotation as the SVG artwork',()=>{
  const board=fixture(),item={...board.items[0],rotation:90,mapView:{scale:1.5,x:-100,y:-100}}
  const p=mapGeometry.projection([102.8,31])!,r=mapContentRect(item)
  const lx=r.x+(p[0]*1.5-100)*r.width/1000,ly=r.y+(p[1]*1.5-100)*r.height/700
  const expected={x:item.x+item.w/2-(ly-item.h/2),y:item.y+item.h/2+(lx-item.w/2)}
  const actual=racePointOnMap(item,records[0])!
  assert(Math.abs(actual.x-expected.x)<1e-9&&Math.abs(actual.y-expected.y)<1e-9)
  assert.deepEqual(actual,localToWorld(item,{x:lx,y:ly}))
  const moved=racePointOnMap({...item,x:item.x+30,y:item.y-45},records[0])!
  assert(Math.abs(moved.x-actual.x-30)<1e-9&&Math.abs(moved.y-actual.y+45)<1e-9)
})
test('endpoint visibility follows board membership, location and crop without deleting thread metadata',()=>{
  const board=fixture(),endpoint={itemId:'map',raceId:'race-a'}
  assert(resolveEndpoint(board,records,endpoint))
  assert.equal(resolveEndpoint({...board,items:board.items.filter(i=>i.recordId!=='race-a')},records,endpoint),null)
  assert.equal(resolveEndpoint(board,[{...records[0],location:undefined} as CollectionRecord],endpoint),null)
  const cropped={...board,items:board.items.map(i=>i.id==='map'?{...i,mapView:{scale:6,x:0,y:0}}:i)}
  assert.equal(resolveEndpoint(cropped,records,endpoint),null)
  assert(resolveEndpoint(board,records,endpoint))
  assert.equal(resolveEndpoint(board,records,{itemId:'map',raceId:'off-board'}),null)
})
test('connections compare full endpoints and allow different places within one map',()=>{
  const board=fixture(),t:Thread={id:'line',from:'map',fromRaceId:'race-a',to:'map',toRaceId:'race-b'}
  board.threads=[t];assert(isBoard(board))
  const a={itemId:'map',raceId:'race-a'},b={itemId:'map',raceId:'race-b'}
  assert(hasConnection(board.threads,a,b));assert(hasConnection(board.threads,b,a))
  assert(!hasConnection(board.threads,a,{itemId:'map'}))
  assert(!isBoard({...board,threads:[{...t,toRaceId:'race-a'}]}))
  assert(!isBoard({...board,threads:[{...t,from:'a'}]}))
  assert.equal(recordThreadReferences(board,'race-a'),1)
  const bounds=contentBounds(board.items,60,board.threads,'classic',records)
  assert(Number.isFinite(bounds.width)&&bounds.width>0)
})
test('v5 backup remaps map endpoint record ids, restores crop and rejects dangling references',async()=>{
  const board=fixture();board.items[0].mapView={scale:2,x:-300,y:-400}
  board.threads=[{id:'line',from:'map',fromRaceId:'race-a',to:'map',toRaceId:'race-b'}]
  const result=await readBackup(await makeZipArchive(board,records))
  const thread=result.board.threads[0]
  assert.notEqual(thread.fromRaceId,'race-a');assert.equal(thread.fromRaceId,result.board.items[1].recordId)
  assert.equal(thread.toRaceId,result.board.items[3].recordId)
  assert.deepEqual(result.board.items[0].mapView,board.items[0].mapView)
  assert(resolveEndpoint(result.board,result.records,{itemId:'map',raceId:thread.fromRaceId}))
  await assert.rejects(makeZipArchive({...board,threads:[{...board.threads[0],fromRaceId:'missing'}]},records),/地点连线/)
})
