/* SPDX-License-Identifier: GPL-2.0-or-later. Customer journey map: panels.journey@1 phase/lane grid and emotion polyline. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='35-journey-map.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='returns',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const gridlines=svg=>[...svg.matchAll(/<path d="M8 ([\d.]+)L[\d.]+ \1" stroke="[^"]+" stroke-width="1" fill="none"\/>/g)].map(m=>Number(m[1])).sort((a,b)=>a-b);
const valueLabels=svg=>[...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" font-size="12" fill="[^"]+" font-weight="700" text-anchor="middle" >(\d)<\/text>/g)].map(m=>({x:Number(m[1]),y:Number(m[2]),v:Number(m[3])}));
test('Journey map renders phase titles, lane titles and a 3-segment polyline',()=>{const r=run();assert.match(r.svg,/<svg/);
 for(const t of ['RECEIVE','INSPECT','DECIDE','REFUND','ACTIONS','TOUCHPOINTS','OPPORTUNITIES','EMOTIONS (1..5)'])assert.ok(r.svg.includes(t),'SVG missing '+t);
 const paths=[...r.svg.matchAll(/<path d="(M[^"]*)" stroke="[^"]+" stroke-width="2\.5" fill="none"\/>/g)];
 assert.equal(paths.length,1,'exactly one emotion polyline path');
 assert.equal((paths[0][1].match(/L/g)||[]).length,3,'four emotion points give three straight L segments');});
test('Emotion point labels show the declared values 2, 3, 4, 5 inside the emotions band',()=>{const r=run(),grid=gridlines(r.svg),labels=valueLabels(r.svg);
 assert.deepEqual(labels.map(l=>l.v).sort(),[2,3,4,5],'one numeric label per declared emotion value');
 const top=Math.min(...grid),bottom=Math.max(...grid);
 for(const l of labels)assert.ok(l.y>=top-40&&l.y<=bottom,'label '+l.v+' y='+l.y+' stays inside the emotions band y-range');});
test('Plan carries phases in column order and ascending emotion points',()=>{const plan=workspace().projectionPlan(FILE,'returns');
 assert.deepEqual(plan.phases,['receive','inspect','decide','refund']);
 const em=plan.panels.find(v=>v.id==='emotions');assert.ok(em,'emotions panel present');assert.equal(em.emotionPoints.length,4);
 assert.deepEqual(em.emotionPoints.map(p=>p.col),[0,1,2,3],'emotion points ascend by phase column');
 assert.deepEqual(em.emotionPoints.map(p=>p.value),[2,3,4,5]);});
test('Geometry: the value-5 point sits at py(5), the top of the emotions content area',()=>{const r=run(),grid=gridlines(r.svg);
 assert.equal(grid.length,5,'five 1..5 gridlines');
 const py5=grid[0],py1=grid[4];
 const circles=[...r.svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="5"/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
 assert.equal(circles.length,4,'one circle per emotion point');
 const top5=circles.reduce((a,b)=>b.y<a.y?b:a);
 assert.ok(Math.abs(top5.y-py5)<=0.5,'value-5 point cy='+top5.y+' matches computed py(5)='+py5);
 const labels=valueLabels(r.svg),spacing=(py1-py5)/4;
 for(const l of labels){const expected=py5+(5-l.v)*spacing;const c=circles.find(c=>Math.abs(c.x-l.x)<1);assert.ok(c&&Math.abs(c.y-expected)<=0.5,'value '+l.v+' point at computed py('+l.v+')='+expected);}});
test('Emotion value 6 rejected as DDN-PJ084',()=>{throws(()=>run('returns',editFile('"value": 2','"value": 6')),'DDN-PJ084');
 assert.throws(()=>run('returns',editFile('"value": 2','"value": 6')),e=>e.message.includes('1..5'));});
test('String emotion value rejected as DDN-PJ084',()=>throws(()=>run('returns',editFile('"value": 3','"value": "high"')),'DDN-PJ084'));
test('Unknown emotion phase rejected as DDN-PJ085 naming it',()=>{throws(()=>run('returns',editFile('"phase": "receive"','"phase": "checkout"')),'DDN-PJ085');
 assert.throws(()=>run('returns',editFile('"phase": "receive"','"phase": "checkout"')),e=>e.message.includes('unknown phase "checkout"'));});
test('Out-of-order emotion items rejected as DDN-PJ085',()=>{throws(()=>run('returns',editFile('items:[@journey.em_receive, @journey.em_inspect,','items:[@journey.em_inspect, @journey.em_receive,')),'DDN-PJ085');
 assert.throws(()=>run('returns',editFile('items:[@journey.em_receive, @journey.em_inspect,','items:[@journey.em_inspect, @journey.em_receive,')),e=>e.message.includes('phase order'));});
test('Missing actions lane panel rejected as DDN-PJ085',()=>{const e=editFile('        {id:"actions-inspect",title:"ACTIONS",row:1,column:1,rowspan:1,colspan:1,items:[@journey.act_inspect]},\n','');throws(()=>run('returns',e),'DDN-PJ085');
 assert.throws(()=>run('returns',e),e=>e.message.includes('"actions-inspect"'));});
test('Missing phase header rejected as DDN-PJ085',()=>{const e=editFile('        {id:"phase-decide",title:"DECIDE",row:0,column:2,rowspan:1,colspan:1,items:[@journey.ph_decide]},\n','');throws(()=>run('returns',e),'DDN-PJ085');
 assert.throws(()=>run('returns',e),e=>e.message.includes('phase'));});
// columns:5 with four declared phases: the profile grid check (DDN-PJ085) fires — the generic
// 1..12 grid bounds (DDN-PJ020) accept 5 columns and no overlap arises, so PJ085 is asserted.
test('Column count mismatch with declared phases rejected as DDN-PJ085',()=>throws(()=>run('returns',editFile('columns:4','columns:5')),'DDN-PJ085'));
test('Journey profile on the wrong projection kind rejected as DDN-PF002',()=>throws(()=>run('returns',editFile('projection { kind:panels; profile:"panels.journey@1"','projection { kind:matrix; profile:"panels.journey@1"')),'DDN-PF002'));
test('Deterministic rerender of the returns view',()=>assert.equal(run().svg,run().svg));
const passed=results.filter(r=>r.pass).length;console.log(`Journey map ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
