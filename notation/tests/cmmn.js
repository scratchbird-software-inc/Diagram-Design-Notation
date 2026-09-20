/* SPDX-License-Identifier: GPL-2.0-or-later. CMMN-style case profile (cmmn.basic@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.cmmn";

data claim {
    object review "Review" { kind: "cmmn.stage"; }
    object gather_documents "Gather documents" { kind: "analysis.task"; }
    object assess_claim "Assess claim" { kind: "analysis.task"; }
    object docs_received "Docs received?" { kind: "cmmn.sentry"; x_sentry: { "on": "entry" }; }
    object claim_decided "Claim decided" { kind: "cmmn.milestone"; }
    relation order "order" @gather_documents -> @assess_claim { kind: "analysis.precedes"; }
    relation done "done" @assess_claim -> @claim_decided { kind: "assoc"; }
}

view case "Claim handling" {
    data: [@claim];
    projection { kind: graph; profile: "cmmn.basic@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    frame review_frame "Review" { scope: @claim.review; members: [@claim.gather_documents, @claim.assess_claim, @claim.docs_received]; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='case'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code,check)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);if(check)check(e);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('CMMN view renders: stage frame with both tasks, sentry diamond and milestone; scene nodes carry source ids',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'graph');assert.equal(r.profiles.projection.profile,'cmmn.basic@1');
 assert.equal((r.svg.match(/data-frame="/g)||[]).length,1,'expected exactly one stage frame box');
 for(const s of ['Review','Gather documents','Assess claim','Docs received?','Claim decided'])assert.ok(r.svg.includes(s),'label missing: '+s);
 const sentry=r.scene.nodes.find(n=>n.id.endsWith('.docs_received')),milestone=r.scene.nodes.find(n=>n.id.endsWith('.claim_decided'));
 assert.ok(sentry,'sentry scene node missing');assert.ok(milestone,'milestone scene node missing');
 const frame=r.scene.frames.find(f=>f.id.endsWith('.review_frame'));
 assert.ok(frame,'stage frame missing from scene');
 for(const id of ['gather_documents','assess_claim','docs_received'])assert.ok(frame.members.some(x=>x.endsWith('.'+id)),id+' not in stage frame members');});
test('An exit sentry inside the stage frame renders',()=>{
 const anchor='    object docs_received "Docs received?" { kind: "cmmn.sentry"; x_sentry: { "on": "entry" }; }';
 const files=edit(anchor,anchor+'\n    object review_complete "Review complete?" { kind: "cmmn.sentry"; x_sentry: { "on": "exit" }; }');
 files['main.ddn']=files['main.ddn'].replace('members: [@claim.gather_documents, @claim.assess_claim, @claim.docs_received];','members: [@claim.gather_documents, @claim.assess_claim, @claim.docs_received, @claim.review_complete];');
 const r=run(files);
 assert.ok(r.svg.includes('Review complete?'),'exit sentry label missing');
 assert.ok(r.scene.nodes.some(n=>n.id.endsWith('.review_complete')),'exit sentry scene node missing');});
test('A cmmn.sentry outside every stage frame is rejected as DDN-PJ120',()=>{
 const anchor='    object docs_received "Docs received?" { kind: "cmmn.sentry"; x_sentry: { "on": "entry" }; }';
 const files=edit(anchor,anchor+'\n    object stray "Stray sentry" { kind: "cmmn.sentry"; x_sentry: { "on": "entry" }; }');
 throws(()=>run(files),'DDN-PJ120',
  e=>assert.ok(e.message.includes('Stray sentry'),'message must name the sentry'));});
test('A cmmn.sentry member of a frame whose scope is NOT a cmmn.stage is rejected as DDN-PJ120',()=>{
 const anchor='    object claim_decided "Claim decided" { kind: "cmmn.milestone"; }';
 const files=edit(anchor,anchor+'\n    object plain "Plain object" { kind: "object"; }\n    object misplaced "Misplaced sentry" { kind: "cmmn.sentry"; x_sentry: { "on": "exit" }; }');
 files['main.ddn']=files['main.ddn'].replace('    frame review_frame "Review"','    frame plain_frame "Plain" { scope: @claim.plain; members: [@claim.misplaced]; }\n    frame review_frame "Review"');
 throws(()=>run(files),'DDN-PJ120',
  e=>assert.ok(e.message.includes('Misplaced sentry'),'message must name the sentry'));});
test('A cmmn.sentry without x_sentry is rejected as DDN-PJ120; x_sentry:{on:"during"} fails as DDN105',()=>{
 throws(()=>run(edit('; x_sentry: { "on": "entry" }; }','; }')),'DDN-PJ120',
  e=>assert.ok(e.message.includes('Docs received?'),'message must name the sentry'));
 throws(()=>run(edit('x_sentry: { "on": "entry" }','x_sentry: { "on": "during" }')),'DDN105');});
test('Repeated render is deterministic',()=>{assert.equal(sha(run().svg),sha(run().svg));});
test('Multi-view file: the same model renders under cmmn.basic@1 and under the plain graph profile',()=>{
 const plain=`view plain "Plain graph view" {
    data: [@claim];
    projection { kind: graph; profile: "ddn@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}`;
 const files={'main.ddn':SRC.replace(/view case[\s\S]*$/,SRC.match(/view case[\s\S]*$/)[0]+'\n'+plain+'\n')};
 const c=run(files,'case'),p=run(files,'plain');
 assert.equal(c.profiles.projection.profile,'cmmn.basic@1');
 assert.equal(p.profiles.projection.profile,'ddn@1');
 assert.ok(c.svg.includes('Review')&&c.svg.includes('Docs received?'),'case view labels missing');
 assert.ok(p.svg.includes('Gather documents'),'plain view label missing');});
let pass=0;for(const r of results){if(r.pass)pass++;else console.error('FAIL',r.name,r.code,r.message);}
console.log(`CMMN case profile ${pass}/${results.length}`);if(pass!==results.length)process.exitCode=1;
