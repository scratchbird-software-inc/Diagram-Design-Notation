/* SPDX-License-Identifier: GPL-2.0-or-later. Fault/event trees: fault.tree@1/event.tree@1 AND/OR gates, two-input check (DDN-PJ126). */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../website/examples/basics'),FILE='53-fault-event-tree.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='fault',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const I2='    relation i2 "has input" @outage -> @switch_failed { kind: "tree.input"; }\n',I3='    relation i3 "has input" @outage -> @cable_cut { kind: "tree.input"; }\n',I1='    relation i1 "has input" @outage -> @power_cut { kind: "tree.input"; }\n';
test('Fault view renders top-down: OR and AND gate diamonds, five event circles, plain edges',()=>{const r=run();
 assert.equal((r.svg.match(/data-shape="diamond"/g)||[]).length,2,'two gate diamonds');
 assert.equal((r.svg.match(/data-shape="circle"/g)||[]).length,5,'five event circles');
 for(const s of ['OR outage','AND power_cut','UPS failed','Grid failed','Switch failed','Cable cut','Operator error'])assert.ok(r.svg.includes(s),'SVG missing '+s);
 assert.ok(!r.svg.includes('marker-end')&&!r.svg.includes('marker-start'),'edges render without arrowheads');});
test('Event view renders the same kinds under event.tree@1 with the tree layout',()=>{const r=run('event');
 assert.equal((r.svg.match(/data-shape="diamond"/g)||[]).length,1,'one gate diamond');
 assert.equal((r.svg.match(/data-shape="circle"/g)||[]).length,2,'two event circles');
 for(const s of ['OR alarm','Smoke detected','Sprinkler trip'])assert.ok(r.svg.includes(s),'SVG missing '+s);
 assert.ok(!r.svg.includes('marker-end'),'edges render without arrowheads');});
test('Gate with exactly one tree.input rejected as DDN-PJ126, count in message',()=>{const e=editFile(I2+I3,'');
 throws(()=>run('fault',e),'DDN-PJ126');
 assert.throws(()=>run('fault',e),e=>e.message.includes('outage')&&e.message.includes('1'),'message names the gate and its input count');});
test('Gate with zero inputs rejected as DDN-PJ126',()=>{const e=editFile(I1+I2+I3,'');
 throws(()=>run('fault',e),'DDN-PJ126');
 assert.throws(()=>run('fault',e),e=>e.message.includes('0'),'message carries the zero count');});
test('Gate without x_gate rejected as DDN-PJ126; x_gate type xor rejected as DDN105',()=>{
 throws(()=>run('fault',editFile('object outage "OR outage" { kind: "tree.gate"; x_gate: { type: "or" }; }','object outage "OR outage" { kind: "tree.gate"; }')),'DDN-PJ126');
 throws(()=>run('fault',editFile('object outage "OR outage" { kind: "tree.gate"; x_gate: { type: "or" }; }','object outage "OR outage" { kind: "tree.gate"; x_gate: { type: "xor" }; }')),'DDN105');});
test('tree.input with a tree.event source fails the endpoint contract as DDN102',()=>{
 const e=editFile(I1,I1+'    relation bad "has input" @ups_failed -> @grid_failed { kind: "tree.input"; }\n');
 throws(()=>run('fault',e),'DDN102');});
test('Repeated render of each view is byte-identical',()=>{
 assert.equal(run().svg,run().svg);
 assert.equal(run('event').svg,run('event').svg);});
const passed=results.filter(r=>r.pass).length;console.log(`Fault/event tree ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
