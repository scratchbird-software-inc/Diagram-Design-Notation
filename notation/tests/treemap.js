/* SPDX-License-Identifier: GPL-2.0-or-later. Treemap chart mark (chart.treemap@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const SRC=`ddn "0.5";
module "test.treemap";

data storage {
    object r1 "analytics.events" { kind: record; x_record: {"path": "analytics.events", "value": 55, "unit": "GB"}; }
    object r2 "analytics.sessions" { kind: record; x_record: {"path": "analytics.sessions", "value": 25, "unit": "GB"}; }
    object r3 "core.orders" { kind: record; x_record: {"path": "core.orders", "value": 40, "unit": "GB"}; }
    object r4 "core.customers" { kind: record; x_record: {"path": "core.customers", "value": 20, "unit": "GB"}; }
    object r5 "ops.logs" { kind: record; x_record: {"path": "ops.logs", "value": 30, "unit": "GB"}; }
    object r6 "ops.metrics" { kind: record; x_record: {"path": "ops.metrics", "value": 10, "unit": "GB"}; }
}

view treemap "Synthetic storage by domain and table / treemap" {
    data: [@storage];
    projection { kind:chart; profile:"chart.treemap@1"; records:[@storage.r1, @storage.r2, @storage.r3, @storage.r4, @storage.r5, @storage.r6]; mark:treemap; x:"x_record.path"; y:"x_record.value"; unit:"GB"; width:1120px; height:620px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const VALUES={'analytics.events':55,'analytics.sessions':25,'core.orders':40,'core.customers':20,'ops.logs':30,'ops.metrics':10};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'treemap',overrides});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const groupRects=svg=>[...svg.matchAll(/<rect class="ddn-treemap-group" data-path="([^"]+)" x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)].map(m=>({path:m[1],x:+m[2],y:+m[3],w:+m[4],h:+m[5]}));

test('Treemap renders 6 leaf tile marks carrying path and value, plus 3 group headers',()=>{
 const r=run();
 assert.equal(r.scene.marks.length,6,'scene.marks.length');
 for(const m of r.scene.marks){assert.ok(typeof m.path==='string'&&m.path.includes('.'),'mark path');assert.equal(m.value,VALUES[m.path],'mark value for '+m.path);}
 const headers=[...r.svg.matchAll(/<rect class="ddn-treemap-header" data-path="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(headers,['analytics','core','ops'],'3 group headers');
 for(const g of ['analytics · 80 GB','core · 60 GB','ops · 40 GB'])assert.ok(r.svg.includes('>'+g+'<'),'header label '+g);
});

test('Area proportionality: leaf mark areas match value ratios within ±0.02 for every pair',()=>{
 const r=run(),ms=r.scene.marks;
 for(const a of ms)for(const b of ms){
  const ratio=(a.w*a.h)/(b.w*b.h),expected=a.value/b.value;
  assert.ok(Math.abs(ratio-expected)<=0.02,`${a.path} vs ${b.path}: area ratio ${ratio} vs value ratio ${expected}`);
 }
 const big=ms.find(m=>m.path==='analytics.events'),small=ms.find(m=>m.path==='ops.metrics');
 assert.ok(Math.abs((big.w*big.h)/(small.w*small.h)-55/10)<=0.02,'largest/smallest pair');
});

test('Hierarchy: leaf tiles lie inside their top-level group outline rectangle',()=>{
 const r=run(),groups=groupRects(r.svg);
 assert.equal(groups.length,3);
 for(const m of r.scene.marks){
  const g=groups.find(g=>g.path===m.path.split('.')[0]);
  assert.ok(m.x>=g.x-0.5&&m.y>=g.y-0.5&&m.x+m.w<=g.x+g.w+0.5&&m.y+m.h<=g.y+g.h+0.5,m.path+' contained in '+g.path);
 }
});

test('Split direction alternates: top-level group widths differ while inner leaf heights differ',()=>{
 const r=run(),by=p=>r.scene.marks.find(m=>m.path===p);
 const events=by('analytics.events'),sessions=by('analytics.sessions'),orders=by('core.orders');
 assert.ok(Math.abs(events.w-sessions.w)<=0.5,'depth-1 horizontal cut keeps leaf width inside a group');
 assert.ok(Math.abs(events.h-sessions.h)>10,'leaf heights differ by value');
 assert.ok(Math.abs(events.w-orders.w)>10,'top-level vertical cut gives differing group widths');
});

test('Declaration order: top-level groups appear left to right as analytics, core, ops',()=>{
 const r=run(),headers=[...r.svg.matchAll(/<rect class="ddn-treemap-header" data-path="([^"]+)" x="([-\d.]+)"/g)].map(m=>({path:m[1],x:+m[2]}));
 assert.deepEqual(headers.map(h=>h.path),['analytics','core','ops'],'not sorted by value (analytics 80, core 60, ops 40 already declaration order)');
 assert.ok(headers[0].x<headers[1].x&&headers[1].x<headers[2].x,'x-order');
});

test('Negative or missing tile value rejected as DDN-PJ078 / DDN-PJ032',()=>{
 throws(()=>run(edit('"value": 55,','"value": -5,')),'DDN-PJ078');
 throws(()=>run(edit('"value": 55,','"size": 55,')),'DDN-PJ032');
});

test('Duplicate path, deep path, aggregation and series rejected',()=>{
 throws(()=>run(edit('"path": "ops.metrics"','"path": "ops.logs"')),'DDN-PJ036');
 throws(()=>run(edit('"path": "ops.metrics"','"path": "a.b.c.d"')),'DDN-PJ030');
 throws(()=>run(edit('mark:treemap;','mark:treemap; aggregate:sum;')),'DDN-PJ031');
 throws(()=>run(edit('mark:treemap;','mark:treemap; series:"x_record.path";')),'DDN-PJ030');
});

test('Vega-Lite adapter rejects treemap explicitly',()=>throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'treemap'}),'DDN-PJ070'));

test('Deterministic rerender',()=>assert.equal(run().svg,run().svg));

test('Profile registered in the published catalogue',()=>{
 assert.ok(A.profileCatalogue.profiles.some(x=>x.id==='chart.treemap@1'));
});

const report={runtime:A.VERSION,scope:'Treemap chart mark chart.treemap@1; dotted-path hierarchy, slice-and-dice layout, area encodes one value; negative and determinism fixtures.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tests/validation/treemap-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Treemap',report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
