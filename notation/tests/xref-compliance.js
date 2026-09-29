/* SPDX-License-Identifier: GPL-2.0-or-later. B1-090: cross-file addressing fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const BASE=`ddn "0.5";
module "retail.ops";
data ops {
    object deliver "Deliver order" { kind: "uaf.opactivity"; }
    object osvc "Order service" { kind: "uaf.servicespec"; }
    relation m1 "" @osvc -> @deliver { kind: "uaf.mapsto"; }
}
view ov "Operational" { data: [@ops]; projection { kind: graph; profile: "uaf.operational@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const MAIN=`ddn "0.5";
module "retail.strat";
architecture retail "Retail architecture" { files: ["ops.ddn"]; }
data strat {
    object fulfill "Order fulfillment" { kind: "uaf.capability"; }
    relation t1 "" @fulfill -> @retail.ops.ops.deliver { kind: "uaf.mapsto"; }
    relation t2 "" @fulfill -> @retail.ops.ops.osvc { kind: "uaf.mapsto"; x_link: { file: "gov.ddn", target: "retail.gov.gov.policy1" }; }
}
view sv "Strategic" { data: [@strat]; projection { kind: graph; profile: "uaf.strategic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const GOV=`ddn "0.5";
module "retail.gov";
data gov {
    object policy1 "Data protection policy" { kind: "uaf.standard"; }
}
view gv "Governance" { data: [@gov]; projection { kind: graph; profile: "uaf.standards@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const files=(main=MAIN,extra={})=>({'main.ddn':main,'ops.ddn':BASE,'gov.ddn':GOV,...extra});
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const run=(f=files())=>A.createWorkspace(f).renderSync({entry:'main.ddn',view:'sv'});
const edit=(before,after)=>{assert.ok(MAIN.includes(before),'Mutation target missing: '+before);return MAIN.replace(before,after);};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('module-qualified references into an architecture base resolve and render as off-page badges',()=>{
 const r=run();
 assert.ok(r.svg.includes('data-external="true"'),'dashed external edge missing');
 assert.ok(r.svg.includes('retail.ops::ops.deliver'),'badge names the module-qualified identity');});
test('x_link association renders its note and resolves through the base file',()=>{
 const r=run();
 assert.ok(r.svg.includes('ddn-xlink'),'x_link note missing');
 assert.ok(!r.svg.includes('data-unresolved'),'x_link must resolve when the file is present');});
test('bare ids never resolve cross-file (DDN031)',()=>{
 throws(()=>run(files(edit('@retail.ops.ops.deliver','@ops.deliver'))),'DDN031');});
test('unknown base file fails DDN-PJ216',()=>{
 throws(()=>run(files(edit('files: ["ops.ddn"];','files: ["nope.ddn"];'))),'DDN-PJ216');});
test('unknown module-qualified identity fails DDN031',()=>{
 throws(()=>run(files(edit('@retail.ops.ops.deliver','@retail.ops.ops.nope'))),'DDN031');});
test('unknown x_link target identity fails DDN-PJ216',()=>{
 throws(()=>run(files(edit('target: "retail.gov.gov.policy1"','target: "retail.gov.gov.nope"'))),'DDN-PJ216');});
test('identity collision across bases fails DDN-PJ216',()=>{
 const clash=`ddn "0.5";
module "retail.ops";
data ops {
    object deliver "Duplicate" { kind: "uaf.opactivity"; }
}
view ov "O" { data: [@ops]; projection { kind: graph; profile: "uaf.operational@1"; } publication { size: content; fit: none; } }
`;
 throws(()=>A.createWorkspace({'main.ddn':edit('files: ["ops.ddn"];','files: ["ops.ddn", "ops2.ddn"];'),'ops.ddn':BASE,'ops2.ddn':clash,'gov.ddn':GOV}).renderSync({entry:'main.ddn',view:'sv'}),'DDN-PJ216');});
test('cross-base relation without a container fails DDN-PJ217',()=>{
 /* gov.ddn still loads (as an x_link base) but no container covers it. */
 const noContainer=edit('architecture retail "Retail architecture" { files: ["ops.ddn"]; }\n','').replace('@retail.ops.ops.deliver','@retail.gov.gov.policy1').replace('relation t2 "" @fulfill -> @retail.ops.ops.osvc','relation t2 "" @fulfill -> @fulfill');
 throws(()=>run(files(noContainer)),'DDN-PJ217');});
test('x_link with an absent file warns (DDN-PJW07) and renders an unresolved note, never an error',()=>{
 const r=run({'main.ddn':MAIN,'ops.ddn':BASE});
 assert.ok(r.diagnostics.some(d=>d.code==='DDN-PJW07'),'warning missing');
 assert.ok(r.svg.includes('data-unresolved="true"'),'unresolved badge missing');});
test('single-file workspaces are unchanged (no container, no bases)',()=>{
 const only=`ddn "0.5";
module "solo";
data m {
    object a "A" { kind: "uaf.capability"; }
    object b "B" { kind: "uaf.capability"; }
    relation r1 "" @a -> @b { kind: "uaf.mapsto"; }
}
view v "V" { data: [@m]; projection { kind: graph; profile: "uaf.strategic@1"; } publication { size: content; fit: none; } }
`;
 const r=A.createWorkspace({'main.ddn':only}).renderSync({entry:'main.ddn',view:'v'});
 assert.ok(!r.svg.includes('data-external'),'no external rendering without bases');});

const failed=results.filter(r=>!r.pass);
console.log('xref-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
