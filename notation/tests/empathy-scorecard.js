/* SPDX-License-Identifier: GPL-2.0-or-later. Empathy map and balanced scorecard: canvas.empathy@1 / canvas.scorecard@1 profiles. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../website/examples/basics'),base={'34-empathy-scorecard.ddn':fs.readFileSync(dir+'/34-empathy-scorecard.ddn','utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view,changes={}){return workspace(changes).renderSync({entry:'34-empathy-scorecard.ddn',view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base['34-empathy-scorecard.ddn'].includes(before),'Mutation target missing');return{'34-empathy-scorecard.ddn':base['34-empathy-scorecard.ddn'].replace(before,after)};};
const esc=t=>t.replace(/&/g,'&amp;');
const EMPATHY=[['says','SAYS',0,0,1,1],['thinks','THINKS',0,1,1,1],['persona','PERSONA',1,0,1,2],['does','DOES',2,0,1,1],['feels','FEELS',2,1,1,1]];
const SCORECARD=[['financial','FINANCIAL',0,0,1,1],['customer','CUSTOMER',0,1,1,1],['internal','INTERNAL PROCESS',1,0,1,1],['learning','LEARNING & GROWTH',1,1,1,1]];
test('Empathy map renders all five titles with persona band spanning both columns',()=>{const r=run('empathy');assert.match(r.svg,/<svg/);for(const [,title]of EMPATHY)assert.ok(r.svg.includes(title),'SVG missing '+title);
 const plan=workspace().projectionPlan('34-empathy-scorecard.ddn','empathy');assert.equal(plan.panels.length,5);
 for(const [id,title,row,column,rowspan,colspan]of EMPATHY){const v=plan.panels.find(v=>v.id===id);assert.ok(v,'plan missing panel '+id);assert.equal(v.title,title);assert.deepEqual([v.row,v.column,v.rowspan,v.colspan],[row,column,rowspan,colspan],'grid position for '+id);}});
test('Scorecard renders four perspectives, each listing at least two declared objectives',()=>{const r=run('scorecard');assert.match(r.svg,/<svg/);for(const [,title]of SCORECARD)assert.ok(r.svg.includes(esc(title)),'SVG missing '+title);
 const plan=workspace().projectionPlan('34-empathy-scorecard.ddn','scorecard');assert.equal(plan.panels.length,4);
 for(const [id,title,row,column,rowspan,colspan]of SCORECARD){const v=plan.panels.find(v=>v.id===id);assert.ok(v,'plan missing panel '+id);assert.equal(v.title,title);assert.deepEqual([v.row,v.column,v.rowspan,v.colspan],[row,column,rowspan,colspan],'grid position for '+id);assert.ok(v.items.length>=2,'perspective '+id+' needs at least two objective notes');
  for(const item of v.items)assert.ok(item.text.includes('Synthetic objective'),'item text is a declared objective note');}});
test('Missing feels quadrant rejected as DDN-PJ083 naming it',()=>{const e=editFile(',\n        {id:"feels",title:"FEELS",row:2,column:1,rowspan:1,colspan:1,items:[@research.feels]}','');throws(()=>run('empathy',e),'DDN-PJ083');assert.throws(()=>run('empathy',e),e=>e.message.includes('"feels"'));});
test('Missing persona band rejected as DDN-PJ083 naming it',()=>{const e=editFile('        {id:"persona",title:"PERSONA",row:1,column:0,rowspan:1,colspan:2,items:[@research.persona]},\n','');throws(()=>run('empathy',e),'DDN-PJ083');assert.throws(()=>run('empathy',e),e=>e.message.includes('"persona"'));});
test('Missing learning perspective rejected as DDN-PJ083 naming it',()=>{const e=editFile('{id:"learning",title:"LEARNING & GROWTH",row:1,column:1','{id:"growth",title:"LEARNING & GROWTH",row:1,column:1');throws(()=>run('scorecard',e),'DDN-PJ083');assert.throws(()=>run('scorecard',e),e=>e.message.includes('"learning"'));});
test('Empty items stay DDN-PJ009, not PJ083',()=>throws(()=>run('empathy',editFile('items:[@research.says_a, @research.says_b]','items:[]')),'DDN-PJ009'));
test('Canvas profile on the wrong projection kind rejected',()=>throws(()=>run('empathy',editFile('projection { kind:panels; profile:"canvas.empathy@1"','projection { kind:matrix; profile:"canvas.empathy@1"')),'DDN-PF002'));
test('Panel overlapping the persona span rejected as DDN-PJ021',()=>throws(()=>run('empathy',editFile('{id:"does",title:"DOES",row:2,column:0','{id:"does",title:"DOES",row:1,column:1')),'DDN-PJ021'));
test('Deterministic rerender of the empathy view',()=>assert.equal(run('empathy').svg,run('empathy').svg));
const passed=results.filter(r=>r.pass).length;console.log(`Empathy/scorecard ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
