/* SPDX-License-Identifier: GPL-2.0-or-later. PERT/CPM critical path: pert.cpm@1 forward/backward pass, zero-slack accent. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../website/examples/basics'),FILE='52-pert-cpm.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='plan',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const getPlan=(changes={})=>workspace(changes).projectionPlan(FILE,'plan');
const M='ddn.examples.pertcpm::m.';
test('Critical chain edges carry the accent overlay; task names show estimate/slack',()=>{const r=run();assert.match(r.svg,/<svg/);
 assert.equal((r.svg.match(/data-critical-path="true"/g)||[]).length,4,'four critical relations accented');
 assert.ok((r.svg.match(/stroke="#244CB4" stroke-width="3"/g)||[]).length>=4,'accent-stroked overlay pieces present');
 for(const s of ['Design (3d, slack 0d)','Build API (4d, slack 1d)','Build UI (5d, slack 0d)','Integrate (2d, slack 0d)','Test (2d, slack 0d)','Ship (1d, slack 0d)'])assert.ok(r.svg.includes(s),'SVG missing '+s);});
test('Plan computes ES/EF/LS/LF, duration and exact critical sets',()=>{const cpm=getPlan().cpm;
 assert.equal(cpm.duration,13);
 const want={
  design:{es:0,ef:3,ls:0,lf:3,slack:0,estimate:3},
  build_api:{es:3,ef:7,ls:4,lf:8,slack:1,estimate:4},
  build_ui:{es:3,ef:8,ls:3,lf:8,slack:0,estimate:5},
  integrate:{es:8,ef:10,ls:8,lf:10,slack:0,estimate:2},
  test:{es:10,ef:12,ls:10,lf:12,slack:0,estimate:2},
  ship:{es:12,ef:13,ls:12,lf:13,slack:0,estimate:1}};
 for(const[id,w]of Object.entries(want))assert.deepEqual(cpm.tasks[M+id],w,'schedule for '+id);
 assert.deepEqual(cpm.criticalTasks,['design','build_ui','integrate','test','ship'].map(id=>M+id));
 assert.deepEqual(cpm.criticalRelations,['d_ui','ui_int','int_test','test_ship'].map(id=>M+id));});
test('Slack task is not critical and its edges are not accented',()=>{const cpm=getPlan().cpm;
 assert.ok(cpm.tasks[M+'build_api'].slack>0);
 assert.ok(!cpm.criticalTasks.includes(M+'build_api'));
 for(const id of ['d_api','api_int'])assert.ok(!cpm.criticalRelations.includes(M+id),id+' must not be critical');});
test('Dependency cycle rejected as DDN-PJ124',()=>{const e=editFile('relation test_ship "before" @test -> @ship { kind: "analysis.precedes"; }','relation test_ship "before" @test -> @ship { kind: "analysis.precedes"; }\n    relation back "before" @ship -> @design { kind: "analysis.precedes"; }');
 throws(()=>run('plan',e),'DDN-PJ124');
 assert.throws(()=>run('plan',e),e=>/cycle/i.test(e.message));});
test('Missing x_estimate rejected as DDN-PJ125',()=>{const e=editFile('object design "Design" { kind: "analysis.task"; x_estimate: 3; }','object design "Design" { kind: "analysis.task"; }');
 throws(()=>run('plan',e),'DDN-PJ125');
 assert.throws(()=>run('plan',e),e=>e.message.includes('design'));});
test('Negative x_estimate rejected as DDN-PJ125',()=>throws(()=>run('plan',editFile('x_estimate: 3; }','x_estimate: -1; }')),'DDN-PJ125'));
test('Lifecycle traces on this profile rejected as DDN-Q005',()=>throws(()=>run('plan',editFile('profile: "pert.cpm@1"; }','profile: "pert.cpm@1"; traces:[{events:[],expected:"x"}]; }')),'DDN-Q005'));
test('Capabilities bookkeeping: clause removed, remainder kept, implemented line added',()=>{const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../standard/registry/capabilities.json'),'utf8'));
 assert.ok(!c.unsupported.includes('critical-path scheduling, arbitrary/DMN-FEEL rule execution and engineering solvers'),'old combined line must be gone');
 assert.ok(c.unsupported.includes('arbitrary/DMN-FEEL rule execution and engineering solvers'),'DMN-FEEL/solver remainder stays');
 assert.ok(c.implemented.some(x=>x.includes('pert.cpm@1')),'implemented mentions pert.cpm@1');
 const tl=c.installedProfiles.find(p=>p.id==='timeline.basic@1');
 assert.ok(tl.unsupported.includes('critical-path computation'),'timeline.basic@1 unsupported list immutable');});
test('Deterministic rerender of the plan view',()=>assert.equal(run().svg,run().svg));
const passed=results.filter(r=>r.pass).length;console.log(`PERT/CPM ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
