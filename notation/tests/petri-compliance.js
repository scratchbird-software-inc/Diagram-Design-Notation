/* SPDX-License-Identifier: GPL-2.0-or-later. B1-079: Petri nets (ISO/IEC 15909) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.petri";
data m {
    object idle "Idle" { kind: "petri.place"; x_petri: { tokens: 3 }; }
    object produce "Produce" { kind: "petri.transition"; }
    object buf "Buffer" { kind: "petri.place"; x_petri: { tokens: 1 }; }
    object consume "Consume" { kind: "petri.transition"; }
    object done "Done" { kind: "petri.place"; x_petri: { tokens: 7 }; }
    relation a1 "" @idle -> @produce { kind: "petri.arc"; }
    relation a2 "" @produce -> @buf { kind: "petri.arc"; x_petri: { weight: 2 }; }
    relation a3 "" @buf -> @consume { kind: "petri.arc"; }
    relation a4 "" @consume -> @done { kind: "petri.arc"; }
    relation inh "" @buf -> @produce { kind: "petri.inhibitor"; }
    relation rd "" @idle -> @consume { kind: "petri.testarc"; }
}
view net "Net" { data: [@m]; projection { kind: graph; profile: "petri.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='net',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('places (circles) and transitions (bars) render',()=>{const r=run();
 assert.ok(r.svg.includes('data-shape="circle"'),'place silhouette missing');
 assert.ok(r.svg.includes('data-shape="forkbar"'),'transition bar missing');});
test('markings render: dots up to 5, count text above',()=>{const r=run();
 assert.equal((r.svg.match(/data-token/g)||[]).length,4,'expected 4 token dots (3+1)');
 assert.ok(r.svg.includes('>7<'),'count text for 7 tokens missing');});
test('arc weight prints near the target end',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-petri-weight')&&r.svg.includes('>2<'),'weight missing');});
test('inhibitor arc ends with an open circle; test arc is dashed',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-verb-petriinhib'),'inhibitor relation missing');
 assert.ok(r.svg.includes('stroke-dasharray="5 4"'),'test arc dash missing');});
test('bipartite: place-to-place arc rejected (DDN-PJ202)',()=>{
 throws(()=>run('net',edit('relation a1 "" @idle -> @produce','relation a1 "" @idle -> @buf')),'DDN-PJ202');});
test('bipartite: transition-to-transition arc rejected (DDN-PJ202)',()=>{
 throws(()=>run('net',edit('relation a2 "" @produce -> @buf','relation a2 "" @produce -> @consume')),'DDN-PJ202');});
test('inhibitor must start at a place (DDN-PJ202)',()=>{
 throws(()=>run('net',edit('relation inh "" @buf -> @produce','relation inh "" @produce -> @buf')),'DDN102');});
test('weights/tokens are contract-enforced nonnegative integers (DDN105)',()=>{
 throws(()=>run('net',edit('x_petri: { weight: 2 }','x_petri: { weight: 0 }')),'DDN105');
 throws(()=>run('net',edit('x_petri: { tokens: 3 }','x_petri: { tokens: -1 }')),'DDN105');});
test('x_petri.tokens on a non-place (DDN-PJ203)',()=>{
 throws(()=>run('net',edit('object produce "Produce" { kind: "petri.transition"; }','object produce "Produce" { kind: "petri.transition"; x_petri: { tokens: 1 }; }')),'DDN-PJ203');});
test('x_petri.weight on a non-arc (DDN-PJ203)',()=>{
 throws(()=>run('net',edit('relation inh "" @buf -> @produce { kind: "petri.inhibitor"; }','relation inh "" @buf -> @produce { kind: "petri.inhibitor"; x_petri: { weight: 2 }; }')),'DDN-PJ203');});

const failed=results.filter(r=>!r.pass);
console.log('petri-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
