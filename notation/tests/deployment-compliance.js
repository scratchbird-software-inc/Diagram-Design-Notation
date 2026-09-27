/* SPDX-License-Identifier: GPL-2.0-or-later. B1-058 (RFC-122): UML 2.5.1 deployment-diagram fixtures (uml.deployment@1). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.dep";

data m {
    object lb "Load balancer" { kind: "uml.device"; }
    object app "App server" { kind: "uml.device"; }
    object jvm "Tomcat 10" { kind: "uml.executionenv"; }
    object war "shop.war" { kind: "uml.artifact"; }
    object cart "Cart component" { kind: "uml.component"; }
    object db "DB node" { kind: "uml.node"; }
    object jar "persistence.jar" { kind: "uml.artifact"; }

    relation lan "https" @lb -> @app { kind: "uml.commpath"; x_endlabels: { source: { multiplicity: "1"; }; target: { multiplicity: "1..*"; }; }; }
    relation d1 "" @war -> @jvm { kind: "uml.deploy"; }
    relation d2 "" @cart -> @jvm { kind: "uml.deploy"; }
    relation d3 "" @jar -> @db { kind: "uml.deploy"; }
    relation mf "" @war -> @cart { kind: "uml.manifest"; }
    relation net "jdbc" @app -> @db { kind: "uml.commpath"; }
}

view v "Deployment" {
    data: [@m];
    projection { kind: graph; profile: "uml.deployment@1"; }
    frame box "App server" { scope: @m.app; members: [@m.jvm, @m.war, @m.cart]; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(changes={},view='v'){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('uml.deployment@1 renders node/device/executionenv 3D boxes and artifact documents with stereotypes',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'uml.deployment@1');
 assert.equal((r.svg.match(/data-shape="node3d"/g)||[]).length,4,'four node-kind 3D boxes expected');
 assert.equal((r.svg.match(/data-shape="artifact"/g)||[]).length,2,'two artifact documents expected');
 for(const s of ['«device»','«execution environment»','«artifact»'])assert.ok(r.svg.includes(s),'stereotype missing: '+s);
 const g0=r.svg.indexOf('data-shape="node3d"');assert.ok(g0>=0,'node3d group missing');
 assert.ok((r.svg.slice(g0,g0+900).match(/<path /g)||[]).length>=2,'3D depth faces missing');});
test('Communication path carries RFC-119 multiplicity end labels',()=>{const r=run();
 assert.ok(r.svg.includes('1..*'),'commpath multiplicity missing');
 assert.ok((r.svg.match(/ddn-endlabel-multiplicity/g)||[]).length>=2,'end labels missing');});
test('Deploy/manifest render as dashed «deploy»/«manifest» dependencies; nesting frame renders',()=>{const r=run();
 assert.ok(r.svg.includes('stroke-dasharray="7 5"'),'dashed deploy/manifest edge missing');
 assert.ok(r.svg.includes('ddn-frame'),'nesting frame missing');});

test('uml.deploy target must be a node kind (endpoint contract, DDN102)',()=>{
 throws(()=>run(edit('relation d1 "" @war -> @jvm','relation d1 "" @war -> @cart')),'DDN102');});
test('uml.manifest source must be an artifact (endpoint contract, DDN102)',()=>{
 throws(()=>run(edit('relation mf "" @war -> @cart','relation mf "" @cart -> @war')),'DDN102');});
test('Communication path carries no qualifiers (DDN-PJ164)',()=>{
 throws(()=>run(edit('x_endlabels: { source: { multiplicity: "1"; };','x_endlabels: { source: { multiplicity: "1"; qualifier: "vip"; };')),'DDN-PJ164');});
test('Deployment nesting frame must scope to a node kind (DDN-PJ164)',()=>{
 throws(()=>run(edit('frame box "App server" { scope: @m.app;','frame box "App server" { scope: @m.war;')),'DDN-PJ164');});
test('Endpoint contracts reject non-deployment kinds (DDN102)',()=>{
 throws(()=>run(edit('relation net "jdbc" @app -> @db','relation net "jdbc" @app -> @war')),'DDN102');});
test('x_endlabels on other relations stays DDN-PJ149',()=>{
 throws(()=>run(edit('relation d3 "" @jar -> @db { kind: "uml.deploy"; }','relation d3 "" @jar -> @db { kind: "uml.deploy"; x_endlabels: { source: { multiplicity: "1"; }; }; }')),'DDN-PJ149');});
test('Malformed commpath multiplicity is DDN-PJ149',()=>{
 throws(()=>run(edit('target: { multiplicity: "1..*"; }','target: { multiplicity: "lots"; }')),'DDN-PJ149');});

const failed=results.filter(r=>!r.pass);
console.log('deployment-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
