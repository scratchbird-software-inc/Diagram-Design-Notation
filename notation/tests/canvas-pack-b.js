/* SPDX-License-Identifier: GPL-2.0-or-later. Canvas pack B: canvas.pest@1 / canvas.pestle@1 / canvas.porter5@1 profiles. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),base={'32-canvas-pack-b.ddn':fs.readFileSync(dir+'/32-canvas-pack-b.ddn','utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view,changes={}){return workspace(changes).renderSync({entry:'32-canvas-pack-b.ddn',view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base['32-canvas-pack-b.ddn'].includes(before),'Mutation target missing');return{'32-canvas-pack-b.ddn':base['32-canvas-pack-b.ddn'].replace(before,after)};};
const PEST=[['political','POLITICAL',0,0,1,1],['economic','ECONOMIC',0,1,1,1],['social','SOCIAL',0,2,1,1],['technological','TECHNOLOGICAL',0,3,1,1]];
const PESTLE=[['political','POLITICAL',0,0,1,1],['economic','ECONOMIC',0,1,1,1],['social','SOCIAL',0,2,1,1],['technological','TECHNOLOGICAL',1,0,1,1],['legal','LEGAL',1,1,1,1],['environmental','ENVIRONMENTAL',1,2,1,1]];
const PORTER5=[['entrants','THREAT OF NEW ENTRANTS',0,1,1,1],['supplier','SUPPLIER POWER',1,0,1,1],['rivalry','COMPETITIVE RIVALRY',1,1,1,1],['buyer','BUYER POWER',1,2,1,1],['substitutes','THREAT OF SUBSTITUTES',2,1,1,1]];
const checkTemplate=(view,template)=>{const r=run(view);assert.match(r.svg,/<svg/);for(const [,title]of template)assert.ok(r.svg.includes(title),'SVG missing '+title);
 const plan=workspace().projectionPlan('32-canvas-pack-b.ddn',view);assert.equal(plan.panels.length,template.length);
 for(const [id,title,row,column,rowspan,colspan]of template){const v=plan.panels.find(v=>v.id===id);assert.ok(v,'plan missing panel '+id);assert.equal(v.title,title);assert.deepEqual([v.row,v.column,v.rowspan,v.colspan],[row,column,rowspan,colspan],'grid position for '+id);}};
test('PEST renders all four titles at fixed template positions',()=>checkTemplate('pest',PEST));
test('PESTLE renders all six titles at fixed template positions',()=>checkTemplate('pestle',PESTLE));
test('Porter five forces renders with rivalry centered',()=>{checkTemplate('porter5',PORTER5);const plan=workspace().projectionPlan('32-canvas-pack-b.ddn','porter5'),v=plan.panels.find(v=>v.id==='rivalry');assert.deepEqual([v.row,v.column],[1,1]);});
test('Missing PESTLE legal panel rejected as DDN-PJ081 naming it',()=>{const e=editFile('        {id:"legal",title:"LEGAL",row:1,column:1,rowspan:1,colspan:1,items:[@scan.pestle_legal]},\n','');throws(()=>run('pestle',e),'DDN-PJ081');assert.throws(()=>run('pestle',e),e=>e.message.includes('"legal"'));});
test('Missing porter5 rivalry panel rejected as DDN-PJ081 naming it',()=>{const e=editFile('{id:"rivalry",title:"COMPETITIVE RIVALRY",row:1,column:1','{id:"competition",title:"COMPETITIVE RIVALRY",row:1,column:1');throws(()=>run('porter5',e),'DDN-PJ081');assert.throws(()=>run('porter5',e),e=>e.message.includes('"rivalry"'));});
test('Missing PEST social panel rejected as DDN-PJ081',()=>{const e=editFile('        {id:"social",title:"SOCIAL",row:0,column:2,rowspan:1,colspan:1,items:[@scan.pest_social]},\n','');throws(()=>run('pest',e),'DDN-PJ081');assert.throws(()=>run('pest',e),e=>e.message.includes('"social"'));});
test('Empty items stay DDN-PJ009, not PJ081',()=>throws(()=>run('pest',editFile('items:[@scan.pest_economic]','items:[]')),'DDN-PJ009'));
test('Canvas profile on the wrong projection kind rejected',()=>throws(()=>run('pest',editFile('projection { kind:panels; profile:"canvas.pest@1"','projection { kind:matrix; profile:"canvas.pest@1"')),'DDN-PF002'));
test('Deterministic rerender of the porter5 view',()=>assert.equal(run('porter5').svg,run('porter5').svg));
const passed=results.filter(r=>r.pass).length;console.log(`Canvas pack B ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
