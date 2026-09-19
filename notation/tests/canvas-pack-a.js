/* SPDX-License-Identifier: GPL-2.0-or-later. Canvas pack A: canvas.bmc@1 / canvas.lean@1 profiles. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),base={'31-canvas-pack-a.ddn':fs.readFileSync(dir+'/31-canvas-pack-a.ddn','utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view,changes={}){return workspace(changes).renderSync({entry:'31-canvas-pack-a.ddn',view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base['31-canvas-pack-a.ddn'].includes(before),'Mutation target missing');return{'31-canvas-pack-a.ddn':base['31-canvas-pack-a.ddn'].replace(before,after)};};
const BMC=[['kp','KEY PARTNERS',0,0,2,2],['ka','KEY ACTIVITIES',0,2,1,2],['kr','KEY RESOURCES',1,2,1,2],['vp','VALUE PROPOSITIONS',0,4,2,2],['cr','CUSTOMER RELATIONSHIPS',0,6,1,2],['ch','CHANNELS',1,6,1,2],['cs','CUSTOMER SEGMENTS',0,8,2,2],['cost','COST STRUCTURE',2,0,1,5],['rev','REVENUE STREAMS',2,5,1,5]];
const LEAN=[['problem','PROBLEM',0,0,2,2],['solution','SOLUTION',0,2,1,2],['keymetrics','KEY METRICS',1,2,1,2],['uvp','UNIQUE VALUE PROPOSITION',0,4,2,2],['unfair','UNFAIR ADVANTAGE',0,6,1,2],['channels','CHANNELS',1,6,1,2],['segments','CUSTOMER SEGMENTS',0,8,2,2],['cost','COST STRUCTURE',2,0,1,5],['revenue','REVENUE STREAMS',2,5,1,5]];
test('BMC renders all nine block titles and fixed grid positions',()=>{const r=run('bmc');assert.match(r.svg,/<svg/);for(const [,title]of BMC)assert.ok(r.svg.includes(title),'SVG missing '+title);
 const plan=workspace().projectionPlan('31-canvas-pack-a.ddn','bmc');assert.equal(plan.panels.length,9);
 for(const [id,title,row,column,rowspan,colspan]of BMC){const v=plan.panels.find(v=>v.id===id);assert.ok(v,'plan missing panel '+id);assert.equal(v.title,title);assert.deepEqual([v.row,v.column,v.rowspan,v.colspan],[row,column,rowspan,colspan],'grid position for '+id);}});
test('Lean canvas renders all nine block titles and fixed grid positions',()=>{const r=run('lean');assert.match(r.svg,/<svg/);for(const [,title]of LEAN)assert.ok(r.svg.includes(title),'SVG missing '+title);
 const plan=workspace().projectionPlan('31-canvas-pack-a.ddn','lean');assert.equal(plan.panels.length,9);
 for(const [id,title,row,column,rowspan,colspan]of LEAN){const v=plan.panels.find(v=>v.id===id);assert.ok(v,'plan missing panel '+id);assert.equal(v.title,title);assert.deepEqual([v.row,v.column,v.rowspan,v.colspan],[row,column,rowspan,colspan],'grid position for '+id);}});
test('Missing BMC vp panel rejected naming the block',()=>{const e=editFile('        {id:"vp",title:"VALUE PROPOSITIONS",row:0,column:4,rowspan:2,colspan:2,items:[@canvas.bmc_vp]},\n','');throws(()=>run('bmc',e),'DDN-PJ080');assert.throws(()=>run('bmc',e),e=>e.message.includes('"vp"'));});
test('Renamed Lean cost panel id rejected naming the block',()=>{const e=editFile('{id:"cost",title:"COST STRUCTURE",row:2,column:0,rowspan:1,colspan:5,items:[@canvas.lean_cost]}','{id:"costs",title:"COST STRUCTURE",row:2,column:0,rowspan:1,colspan:5,items:[@canvas.lean_cost]}');throws(()=>run('lean',e),'DDN-PJ080');assert.throws(()=>run('lean',e),e=>e.message.includes('"cost"'));});
test('Empty items stay DDN-PJ009, not PJ080',()=>throws(()=>run('bmc',editFile('items:[@canvas.bmc_ka]','items:[]')),'DDN-PJ009'));
test('Overlapping canvas spans stay DDN-PJ021',()=>throws(()=>run('bmc',editFile('{id:"ka",title:"KEY ACTIVITIES",row:0,column:2','{id:"ka",title:"KEY ACTIVITIES",row:0,column:0')),'DDN-PJ021'));
test('Canvas profile on the wrong projection kind rejected',()=>throws(()=>run('bmc',editFile('projection { kind:panels; profile:"canvas.bmc@1"','projection { kind:matrix; profile:"canvas.bmc@1"')),'DDN-PF002'));
test('Generic panels.basic@1 views render without PJ080',()=>{const pdir=path.resolve(__dirname,'../../examples/projections'),files=Object.fromEntries(['model.ddn','views.ddn','formats.ddn'].map(f=>[f,fs.readFileSync(path.join(pdir,f),'utf8')]));const r=A.createWorkspace(files).renderSync({entry:'views.ddn',view:'swot'});assert.match(r.svg,/STRENGTHS/);});
test('Deterministic rerender of the BMC view',()=>assert.equal(run('bmc').svg,run('bmc').svg));
const passed=results.filter(r=>r.pass).length;console.log(`Canvas pack A ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
