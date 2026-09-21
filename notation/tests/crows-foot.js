/* SPDX-License-Identifier: GPL-2.0-or-later. erd.crowfoot@1 profile: obligatory crow's-foot cardinality endpoint marks. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='37-crows-foot-erd.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='erd',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const CROWFOOT='M-13 0L0 -7M-13 0L0 7M-13 0L0 0',BAR='M-4 -7V7',ENDMARK=/<g transform="translate\([^)]*\) rotate\([^)]*\)" stroke="#[0-9a-f]+" stroke-width="1.7" fill="none">/g;
const inline=(body,options='projection { kind:graph; profile:"erd.crowfoot@1"; }')=>A.createWorkspace({'mini.ddn':`ddn "0.3";\nmodule "test.crowfoot";\ndata m {\n${body}\n}\nview erd { data:[@m]; ${options} publication {size: content; fit: none; overflow: error;} }\n`}).renderSync({entry:'mini.ddn',view:'erd'});
const CARD='object a "A" {kind:table; fields { field id { key: primary; } }}\nobject b "B" {kind:table; fields { field id { key: primary; } }}\nrelation r @a -> @b { kind: ref; source_mark: one; target_mark: zeromany; }';
test('Crow\'s-foot ERD renders: crowfoot tines, single bar and optionality circle all present',()=>{const svg=run().svg;
 assert.ok(svg.includes(CROWFOOT),'crowfoot tine path missing');
 assert.ok(svg.includes(BAR),'single bar path missing');
 assert.ok(svg.includes('cx="-20"'),'optionality circle missing');
 assert.ok(svg.includes('purchase customer'),'relation label missing');});
test('Four relations, each with exactly two endpoint mark groups',()=>{const svg=run().svg;
 const relations=svg.match(/<g class="ddn-relation /g)||[];
 assert.equal(relations.length,4,'expected 4 ddn-relation groups');
 const marks=svg.match(ENDMARK)||[];
 assert.equal(marks.length,8,'expected 8 endpoint mark groups (4 relations × 2 ends)');});
test('Same model under default ddn@1 profile renders the same marks (obligation, not geometry)',()=>{const e=editFile('profile:"erd.crowfoot@1";','profile:"ddn@1";');
 const svg=run('erd',e).svg;
 assert.ok(svg.includes(CROWFOOT),'crowfoot path missing under ddn@1');
 assert.ok(svg.includes(BAR)&&svg.includes('cx="-20"'),'other marks missing under ddn@1');});
test('Missing target_mark under erd.crowfoot@1 rejected as DDN-PJ087 naming relation and target_mark',()=>{const e=editFile('source_mark: one;\n        target_mark: many;','source_mark: one;');
 throws(()=>run('erd',e),'DDN-PJ087');
 assert.throws(()=>run('erd',e),e=>e.message.includes('lists')&&e.message.includes('target_mark'));});
test('target_mark: filled (non-cardinality mark) under erd.crowfoot@1 rejected as DDN-PJ087',()=>throws(()=>run('erd',editFile('target_mark: many;','target_mark: filled;')),'DDN-PJ087'));
test('flow relation under erd.crowfoot@1 rejected as DDN-PJ087; a mark on it fails earlier as DDN114',()=>{
 const add='\n    relation r_flow @customer -> @invoice { kind: flow; }';
 throws(()=>run('erd',editFile('}\n\nview erd',add+'\n}\n\nview erd')),'DDN-PJ087');
 const addMarked='\n    relation r_flow @customer -> @invoice { kind: flow; source_mark: one; target_mark: zeromany; }';
 throws(()=>run('erd',editFile('}\n\nview erd',addMarked+'\n}\n\nview erd')),'DDN114');});
test('Unknown mark string target_mark: lots rejected as DDN114 under any profile',()=>{
 throws(()=>run('erd',editFile('target_mark: many;','target_mark: lots;')),'DDN114');
 const e=editFile('target_mark: many;','target_mark: lots;');e[FILE]=e[FILE].replace('profile:"erd.crowfoot@1";','profile:"ddn@1";');
 throws(()=>run('erd',e),'DDN114');});
test('profile erd.crowfoot@1 with kind:matrix rejected as DDN-PF002',()=>throws(()=>inline(CARD,'projection { kind:matrix; profile:"erd.crowfoot@1"; }'),'DDN-PF002'));
test('Inline minimal model passes erd.crowfoot@1 with one+zeromany marks',()=>{const svg=inline(CARD).svg;assert.ok(svg.includes(CROWFOOT)&&svg.includes(BAR));});
test('Deterministic rerender of the erd view',()=>assert.equal(run().svg,run().svg));
const passed=results.filter(r=>r.pass).length;console.log(`Crows-foot ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
