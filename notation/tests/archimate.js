/* SPDX-License-Identifier: GPL-2.0-or-later. ArchiMate-style layered profile (archimate.basic@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.archimate";

data m {
    object service_agent "Service agent" { kind: "archi.business_actor"; }
    object order_desk "Order desk" { kind: "archi.business_role"; }
    object order_handling "Order handling" { kind: "archi.business_process"; }
    object order_api "Order API" { kind: "archi.application_component"; }
    object order_service "Order service" { kind: "archi.application_service"; }
    object db_node "Database node" { kind: "archi.technology_node"; }
    object db_service "Database service" { kind: "archi.technology_service"; }

    relation staffing "staffs" @service_agent -> @order_desk { kind: "archi.rel"; }
    relation handling "runs" @order_desk -> @order_handling { kind: "archi.rel"; }
    relation serving_process "serves" @order_service -> @order_handling { kind: "archi.rel"; }
    relation exposed_on "realised by" @order_service -> @order_api { kind: "archi.rel"; }
    relation serving_app "serves" @db_service -> @order_api { kind: "archi.rel"; }
    relation hosted_on "hosted on" @db_service -> @db_node { kind: "archi.rel"; }
}

view landscape "Order platform landscape" {
    data: [@m];
    projection { kind: graph; profile: "archimate.basic@1"; }
    layout { algorithm: layered; direction: up; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}

view business_viewpoint "Order platform business viewpoint" {
    data: [@m];
    projection { kind: graph; profile: "archimate.basic@1"; }
    layout { algorithm: layered; direction: right; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    select: [@m.service_agent, @m.order_desk, @m.order_handling];
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='landscape'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code,check)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);if(check)check(e);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
// Registered family palette: business=governance, application=interface, technology=deployment.
const FAMILY={business:{colour:'#526525',fill:'#F2F5E9'},application:{colour:'#6D4C91',fill:'#F3EFF8'},technology:{colour:'#7A5535',fill:'#F6F0E9'}};
const relationGroup=(svg,id)=>{const m=svg.match(new RegExp('<g class="ddn-relation"[^>]*data-id="[^"]*'+id.replace(/\./g,'\\.')+'"[\\s\\S]*?(?=<g class="ddn-relation"|<g class="ddn-node"|$)'));return m?m[0]:'';};
test('landscape renders: the three layers carry their distinct registered family colours; all seven nodes render',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'archimate.basic@1');
 for(const s of ['Service agent','Order desk','Order handling','Order API','Order service','Database node','Database service'])assert.ok(r.svg.includes(s),'label missing: '+s);
 for(const l of Object.keys(FAMILY)){assert.ok(r.svg.includes(FAMILY[l].colour),l+' family colour '+FAMILY[l].colour+' missing from node SVG');assert.ok(r.svg.includes(FAMILY[l].fill),l+' family fill '+FAMILY[l].fill+' missing from node SVG');}
 assert.equal(r.scene.nodes.length,7,'expected exactly the seven archi nodes');});
test('archi.rel links render with open arrowheads',()=>{const r=run();
 for(const id of ['staffing','handling','serving_process','exposed_on','serving_app','hosted_on']){
  const g=relationGroup(r.svg,id);
  assert.ok(g,'relation group missing: '+id);
  assert.ok(g.includes('M-10 -5L0 0L-10 5'),'open arrowhead path missing for '+id);
  assert.ok(!g.includes('data-port-square'),'no port machinery expected for '+id);}});
test('legality table positives: same-layer, technology->application and application->business links all pass validation',()=>{
 const same=run(edit('    relation exposed_on "realised by" @order_service -> @order_api { kind: "archi.rel"; }','    relation exposed_on "realised by" @order_service -> @order_api { kind: "archi.rel"; }\n    relation same_layer "peers" @order_desk -> @order_handling { kind: "archi.rel"; }'));
 assert.ok(same.svg.includes('peers'),'same-layer link did not render');
 assert.ok(run().svg.includes('serves'),'application->business and technology->application serving links render in the base model');
 const tech2biz=run(edit('    relation hosted_on "hosted on" @db_service -> @db_node { kind: "archi.rel"; }','    relation hosted_on "hosted on" @db_service -> @db_node { kind: "archi.rel"; }\n    relation deep_serve "serves" @db_service -> @order_handling { kind: "archi.rel"; }'));
 assert.ok(tech2biz.svg.includes('deep_serve'),'technology->business upward link must be allowed');});
test('archi.rel business->application (downward) is rejected as DDN-PJ123',()=>{
 throws(()=>run(edit('@order_service -> @order_handling','@order_handling -> @order_service')),'DDN-PJ123',
  e=>{assert.ok(e.message.includes('business -> application'),'message must name both endpoint layers');assert.ok(e.message.includes('serving_process'),'message must name the relation');});});
test('archi.rel business->technology (downward, skipping a layer) is rejected as DDN-PJ123',()=>{
 throws(()=>run(edit('    relation hosted_on "hosted on" @db_service -> @db_node { kind: "archi.rel"; }','    relation hosted_on "hosted on" @db_service -> @db_node { kind: "archi.rel"; }\n    relation bad "bad" @order_handling -> @db_node { kind: "archi.rel"; }')),'DDN-PJ123',
  e=>assert.ok(e.message.includes('business -> technology'),'message must name both endpoint layers'));});
test('archi.rel application->technology (downward) is rejected as DDN-PJ123',()=>{
 throws(()=>run(edit('@db_service -> @order_api','@order_api -> @db_service')),'DDN-PJ123',
  e=>assert.ok(e.message.includes('application -> technology'),'message must name both endpoint layers'));});
test('archi.rel with a non-archi endpoint kind (analysis.task) is rejected as DDN-PJ123',()=>{
 const files=edit('    relation staffing "staffs"','    object impostor "Impostor" { kind: "analysis.task"; }\n    relation staffing "staffs"');
 files['main.ddn']=files['main.ddn'].replace('@service_agent -> @order_desk','@impostor -> @order_desk');
 throws(()=>run(files),'DDN-PJ123',
  e=>{assert.ok(e.message.includes('analysis.task'),'message must name the offending endpoint kind');assert.ok(e.message.includes('outside the nine registered archi.* kinds'),'message must state the rule');});});
test('business_viewpoint: a second view selecting only archi.business_* objects renders as a business viewpoint',()=>{
 const r=run({},'business_viewpoint');
 assert.equal(r.profiles.projection.profile,'archimate.basic@1');
 assert.deepEqual(r.scene.nodes.map(n=>n.id.split('.').pop()).sort(),['order_desk','order_handling','service_agent'],'viewpoint must contain exactly the business-layer objects');
 for(const s of ['Service agent','Order desk','Order handling'])assert.ok(r.svg.includes(s),'label missing: '+s);
 assert.ok(!r.svg.includes('Order API'),'application layer must not appear in the business viewpoint');
 assert.ok(r.svg.includes(FAMILY.business.colour),'business family colour missing');
 assert.ok(!r.svg.includes(FAMILY.technology.colour),'technology family colour must not appear');});
test('Repeated renders of each view are byte-identical',()=>{
 for(const view of ['landscape','business_viewpoint'])assert.equal(sha(run({},view).svg),sha(run({},view).svg),view+' render not deterministic');});
test('The shipped example examples/basics/51-archimate.ddn renders both views',()=>{
 const dir=path.resolve(__dirname,'../../examples/basics');
 const w=A.createWorkspace({'main.ddn':fs.readFileSync(path.join(dir,'51-archimate.ddn'),'utf8'),'shared.ddn':fs.readFileSync(path.join(dir,'shared.ddn'),'utf8')});
 for(const view of ['landscape','business_viewpoint']){const r=w.renderSync({entry:'main.ddn',view});assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'archimate.basic@1');}});
let pass=0;for(const r of results){if(r.pass)pass++;else console.error('FAIL',r.name,r.code,r.message);}
console.log(`ArchiMate layered profile ${pass}/${results.length}`);if(pass!==results.length)process.exitCode=1;
