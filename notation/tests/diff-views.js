/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 diff views (0.9 roadmap
 * item, spec ch. 55 §55.6): diff: [@viewA, @viewB] grammar and DDN-DF01–DF04
 * validation, local-id matching with DDN-DF04 ambiguity, union re-keying,
 * added/removed/changed/unchanged state paint (colour + dash/strike/token
 * channels, mono distinguishable), the diff key chrome, and no drift on
 * ordinary views. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const build=(body,view='c',version='0.6')=>DDN.build({'m.ddn':'ddn "'+version+'";\nmodule "m";\n'+body},'m.ddn',view,reg).ir;
const render=(body,view,version)=>Render.render(build(body,view,version),reg,defs);
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const BASE='data before {\n object keep "Same" { kind: cache; }\n object gone "Old one" { kind: queue; }\n object changed "Label v1" { kind: cache; fields { f1: string; } }\n relation r1 @keep -> @gone { kind: flow; }\n relation r2 @keep -> @changed { kind: flow; }\n}\ndata after {\n object keep "Same" { kind: cache; }\n object changed "Label v2" { kind: cache; fields { f1: string; f2: number; } }\n object added "New hotness" { kind: service; }\n relation r2 @keep -> @changed { kind: flow; }\n relation r3 @changed -> @added { kind: flow; }\n}\nview a { data: [@before]; }\nview b { data: [@after]; }\n';

test('matching by local id: all four states, counts, union re-keying, endpoints re-pointed',()=>{
 const ir=build(BASE+'view c { diff: [@a, @b]; }');
 assert.deepEqual(ir.view.diff.counts,{added:1,removed:1,changed:1,unchanged:1});
 const states=Object.fromEntries(ir.elements.map(e=>[e.local,e.diffState]));
 assert.deepEqual(states,{keep:'unchanged',gone:'removed',changed:'changed',added:'added'});
 const rstates=Object.fromEntries(ir.relations.map(r=>[r.ref.split('.').pop(),r.diffState]));
 assert.deepEqual(rstates,{r1:'removed',r2:'unchanged',r3:'added'},'a relation state reflects its own record; the endpoint change shows on the element');
 const elemIds=new Set(ir.elements.map(e=>e.id));
 for(const r of ir.relations){assert.ok(elemIds.has(r.from.element)&&elemIds.has(r.to.element),'endpoints re-pointed at union members for '+r.id);}
 assert.ok([...elemIds].every(id=>id.startsWith('m::c::')),'union members re-keyed to the diff view');
});

test('topologically identical operands are all unchanged (endpoint uid noise ignored)',()=>{
 const ir=build('data before { object keep "Same" { kind: cache; } object other "V1" { kind: cache; } relation r2 @keep -> @other { kind: flow; } }\ndata after { object keep "Same" { kind: cache; } object other "V1" { kind: cache; } relation r2 @keep -> @other { kind: flow; } }\nview a { data: [@before]; }\nview b { data: [@after]; }\nview c { diff: [@a, @b]; }');
 assert.deepEqual(ir.view.diff.counts,{added:0,removed:0,changed:0,unchanged:2});
 assert.ok(ir.relations.every(r=>r.diffState==='unchanged'));
});

test('validation: DDN-DF01..DF04 and the dialect gate',()=>{
 assert.equal(code(()=>build(BASE+'view c { diff: [@a]; }')),'DDN-DF01','one ref');
 assert.equal(code(()=>build(BASE+'view c { diff: [@a, @b, @a]; }')),'DDN-DF01','three refs');
 assert.equal(code(()=>build(BASE+'view c { data: [@before]; diff: [@a, @b]; }')),'DDN-DF01','diff + data');
 assert.equal(code(()=>build(BASE+'view c { diff: [@a, @nope]; }')),'DDN-DF02','unresolved');
 assert.equal(code(()=>build(BASE+'view c { diff: [@a, @before]; }')),'DDN-DF02','not a view');
 assert.equal(code(()=>build(BASE+'view c { diff: [@a, @a]; }')),'DDN-DF03','self pair');
 assert.equal(code(()=>build(BASE+'view c { diff: [@a, @c]; }')),'DDN-DF03','names itself');
 assert.equal(code(()=>build(BASE+'view d { diff: [@a, @b]; }\nview c { diff: [@a, @d]; }')),'DDN-DF03','diff-of-diff');
 assert.equal(code(()=>build(BASE+'view c { diff: [@a, @b]; }','c','0.5')),'DDN-V04','dialect gate');
 assert.equal(code(()=>build('data dup1 { object thing { kind: cache; } }\ndata dup2 { object thing { kind: queue; } }\nview a { data: [@dup1, @dup2]; }\nview b { data: [@dup1]; }\nview c { diff: [@a, @b]; }')),'DDN-DF04','ambiguous identity in an operand');
});

test('state paint: colour + non-colour channels, tokens, relation overlays, diff key',()=>{
 const svg=render(BASE+'view c "Before → after" { diff: [@a, @b]; publication { size: content; } }').svg;
 const overlays=svg.match(/class="ddn-diff ddn-diff-[a-z]*"/g)||[];
 assert.equal(overlays.length,5,'3 node + 2 relation overlays');
 for(const c of ['#1A7F37','#B42318','#B45309'])assert.ok(svg.includes(c),'state colour '+c);
 assert.ok(/stroke-dasharray="6 4"/.test(svg)&&/stroke-dasharray="2 4"/.test(svg),'dash channels');
 assert.ok((svg.match(/ddn-diff-token/g)||[]).length===3,'corner tokens on node states');
 const key=svg.match(/<g class="ddn-diff-key"[^>]*>/)[0];
 assert.ok(key.includes('data-a="m::a"')&&key.includes('data-b="m::b"'),'key names operands: '+key);
 assert.ok(/\+ added in b/.test(svg)&&/− removed from a/.test(svg)&&/~ changed/.test(svg),'key rows self-evident');
});

test('mono themes keep states distinguishable without colour',()=>{
 for(const theme of ['neutral','mono_print']){
  const svg=render(BASE+'view c { diff: [@a, @b]; publication { size: content; } '+(theme==='mono_print'?'theme: mono_print;':'style { theme: neutral; }')+' }').svg;
  assert.ok(!/#1A7F37|#B42318|#B45309/i.test(svg),'no state colours under '+theme);
  assert.ok((svg.match(/ddn-diff-token/g)||[]).length===3,'tokens still present under '+theme);
  assert.ok(/stroke-dasharray="6 4"/.test(svg)&&/stroke-dasharray="2 4"/.test(svg),'dash channels still present under '+theme);
 }
});

test('unchanged paints no overlay; ordinary views carry no diff artifacts',()=>{
 const svg=render(BASE+'view c { diff: [@a, @b]; }').svg;
 const keep=ir0=>0;
 assert.ok(!/data-diff="unchanged"/.test(svg),'unchanged has no overlay');
 const plain=render(BASE,'a').svg;
 assert.ok(!/ddn-diff/.test(plain),'operand view renders exactly as before');
});

test('layout: union is laid out by the normal pipeline; removed members occupy space',()=>{
 const res=render(BASE+'view c { diff: [@a, @b]; }');
 assert.equal(res.scene.nodes.length,4,'union of 4 members laid out');
 assert.ok(res.scene.nodes.some(n=>n.id.endsWith('::removed::gone')),'removed member placed');
 assert.ok(res.scene.nodes.every(n=>n.w>0&&n.h>0),'all members have real geometry');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' diff-views tests passed');
