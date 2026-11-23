import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBasController } from '../extension/bas-controller.js';
import { createController } from '../extension/controller.js';

function setup(options={}) {
  const calls=[];
  const data={version:1,club:'Testklubb',capturedAt:'2026-11-01T12:00:00Z',rows:[{area:'A',place:'12',firstName:'PRIVATE-A'},{area:'B',place:'12',firstName:'PRIVATE-B'}]};
  let clock=0;
  const browser={
    permissions:{contains:async()=>options.allowed!==false},
    tabs:{query:async ({url})=>url.includes('batunionen') ? (options.tabs??[{id:1,url:'https://bas.batunionen.se/BasK/Storage/StorageSearch'}]) : [{id:2,url:'https://ledkarlsson.github.io/projects/kartgenerator/'}],create:async arg=>calls.push(arg)},
    scripting:{executeScript:async config=>{
      calls.push(config);
      if(options.execute)return options.execute(config);
      return [{frameId:0,result:config.world==='ISOLATED'?{ok:true,data}:{ok:true}}];
    }},
    runtime:{id:'self',getURL:path=>`chrome-extension://self/${path}`}
  };
  return {controller:createBasController(browser,()=>clock),browser,calls,data,setTime:time=>clock=time};
}
test('preview is metadata only; send contains only the selected area and pings first',async()=>{
  const {controller,calls}=setup(); const preview=await controller.handle({action:'bas-read'});
  assert.equal(preview.ok,true);assert.equal(JSON.stringify(preview).includes('PRIVATE'),false);
  const sent=await controller.handle({action:'bas-send',snapshotId:preview.data.id,area:'A'});
  assert.equal(sent.ok,true);assert.equal(sent.data.count,1);
  assert.deepEqual(calls[1].args,[]);assert.equal(calls[2].args[0].rows.length,1);
  assert.equal(JSON.stringify(calls[2]).includes('PRIVATE-B'),false);
  assert.equal(calls[0].world,'ISOLATED');assert.equal(calls[2].world,'MAIN');
  assert.equal((await controller.handle({action:'bas-send',snapshotId:preview.data.id,area:'A'})).error.code,'BAS_EXPIRED');
});
test('no permission, wrong preview and expired preview prevent delivery',async()=>{
  const denied=setup({allowed:false});assert.equal((await denied.controller.handle({action:'bas-read'})).error.code,'BAS_PERMISSION');assert.equal(denied.calls.length,0);
  const env=setup();const preview=await env.controller.handle({action:'bas-read'});env.setTime(300001);
  assert.equal((await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,area:'A'})).error.code,'BAS_EXPIRED');assert.equal(env.calls.length,1);
});
test('ambiguous source tabs fail rather than picking a club arbitrarily',async()=>{
  const {controller}=setup({tabs:[{id:1,url:'https://bas.batunionen.se/BasK/Storage/StorageSearch'},{id:3,url:'https://bas.batunionen.se/BasK/Storage/StorageSearch'}]});
  assert.equal((await controller.handle({action:'bas-read'})).error.code,'BAS_MULTIPLE');
});
test('all-duplicate selection sends nothing and preserves the preview',async()=>{
  const env=setup();env.data.rows.push({...env.data.rows[0]});const preview=await env.controller.handle({action:'bas-read'});
  const result=await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,area:'A'});
  assert.equal(result.ok,true);assert.equal(result.data.count,0);assert.equal(result.data.skippedCount,2);assert.equal(env.calls.length,1);
  assert.equal((await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,area:'B'})).ok,true);
});
test('receiver absence stops data before transmission',async()=>{
  const env=setup();const preview=await env.controller.handle({action:'bas-read'});
  env.browser.scripting.executeScript=async config=>{env.calls.push(config);return [{frameId:0,result:{ok:false,code:'MAP_RECEIVER'}}]};
  assert.equal((await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,area:'A'})).error.code,'MAP_RECEIVER');assert.deepEqual(env.calls[1].args,[]);
});
test('website callers cannot use the BAS controller through runtime messaging',async()=>{
  const {browser,calls}=setup();const controller=createController(browser);
  assert.equal((await controller.handle({action:'bas-read'},{id:'self',url:'https://bas.batunionen.se/',tab:{id:1}})).error.code,'NOT_ALLOWED');assert.equal(calls.length,0);
});
test('errors redact arbitrary page text',async()=>{
  const {controller}=setup({execute:async()=>{throw new Error('PRIVATE-COOKIE');}});
  const result=await controller.handle({action:'bas-read'});assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('multiple areas preserve equal place numbers and deduplicate selected areas',async()=>{
  const {controller,calls}=setup(); const preview=await controller.handle({action:'bas-read'});
  const sent=await controller.handle({action:'bas-send',snapshotId:preview.data.id,areas:['A','B','A']});
  assert.equal(sent.ok,true); assert.equal(sent.data.count,2);
  assert.equal(calls[2].args[0].version,3);
  assert.deepEqual(calls[2].args[0].areas,['A','B']);
  assert.equal(calls[2].args[0].rows.length,2);
});
test('empty and unknown area selections cannot trigger delivery',async()=>{
  const {controller,calls}=setup(); const preview=await controller.handle({action:'bas-read'});
  for (const areas of [[],['C'],['A','C'],'A',[null]]) {
    assert.equal((await controller.handle({action:'bas-send',snapshotId:preview.data.id,areas})).error.code,'BAS_SELECTION');
  }
  assert.equal(calls.length,1);
});

for (const comment of [' 112 / annan kommentar','112(SSR)','112 (SSR/extra)','112/SSR (extra)']) test(`comments do not distinguish duplicate places: ${comment}`,async()=>{
  const env=setup();
  env.data.rows[0].place='112/SSR';
  env.data.rows.push({...env.data.rows[0],place:comment});
  const preview=await env.controller.handle({action:'bas-read'});
  const result=await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,areas:['A']});assert.equal(result.ok,true);assert.equal(result.data.count,0);assert.equal(result.data.skippedCount,2);
  assert.equal(env.calls.length,1);
});
test('slash comments remain in the transferred source and same numbers in different areas are allowed',async()=>{
  const env=setup();
  env.data.rows[0].place='112/SSR';env.data.rows[1].place='112/annan';
  const preview=await env.controller.handle({action:'bas-read'});
  assert.equal((await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,areas:['A','B']})).ok,true);
  assert.deepEqual(env.calls[2].args[0].rows.map(row=>row.place),['112/SSR','112/annan']);
});

test('duplicates are listed and all their rows are excluded while unique rows are transferred',async()=>{
  const env=setup();
  env.data.rows=[
    {area:'Brygga A',place:'112/SSR',firstName:'PRIVATE-MEMBER'},
    {area:'Brygga A',place:'112 (annan kommentar)',lastName:'PRIVATE-MEMBER'},
    {area:'Brygga A',place:'112',boat:'PRIVATE-BOAT'},
    {area:'Brygga B',place:'7'}, {area:'Brygga B',place:'7'},
    {area:'Brygga B',place:'112/ensam'},
    {area:'Ej vald',place:'999/PRIVATE-UNSELECTED'}, {area:'Ej vald',place:'999'},
  ];
  const preview=await env.controller.handle({action:'bas-read'});
  const result=await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,areas:['Brygga A','Brygga B']});
  assert.equal(result.ok,true);assert.equal(result.data.count,1);assert.equal(result.data.skippedCount,5);
  assert.ok(result.data.warning.includes('• Brygga A – plats 112 (3 rader): "112/SSR", "112 (annan kommentar)", "112"'));
  assert.ok(result.data.warning.includes('• Brygga B – plats 7 (2 rader): "7", "7"'));
  assert.equal(result.data.warning.includes('112/ensam'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  assert.equal(env.calls.length,3);
  const payload=env.calls[2].args[0];
  assert.deepEqual(payload.rows,[{area:'Brygga B',place:'112/ensam'}]);
  assert.deepEqual(payload.areas,['Brygga A','Brygga B']);
  assert.deepEqual(payload.skippedPlaces,[{area:'Brygga A',place:'112'},{area:'Brygga B',place:'7'}]);
  assert.equal(JSON.stringify(payload).includes('PRIVATE'),false);
});

test('duplicate details escape embedded newlines and quotes in source names',async()=>{
  const env=setup();
  env.data.rows=[{area:'A',place:'112/"rad"\nextra'},{area:'A',place:'112 (annat)'}];
  const preview=await env.controller.handle({action:'bas-read'});
  const result=await env.controller.handle({action:'bas-send',snapshotId:preview.data.id,areas:['A']});
  assert.ok(result.data.warning.includes(JSON.stringify(env.data.rows[0].place)));
  assert.equal(result.data.warning.split('\n').length,3);
});
