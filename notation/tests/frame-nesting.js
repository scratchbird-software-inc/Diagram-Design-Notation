/* SPDX-License-Identifier: GPL-2.0-or-later. Explicit frame containment. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../runtime/ddn-core.js').default,R=require('../runtime/ddn-full.js').default;
const registry=require('../../standard/registry/catalogue.json');
const defs=fs.readFileSync(require.resolve('../../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const source=(frames,extra='',version='0.7')=>`ddn "${version}"; module "nest"; data m { object a "A" {kind:table;} } view main { data:[@m]; publication {size:content;fit:none;} ${extra} ${frames} }`;
const build=(s,reg=registry)=>D.build({'test.ddn':s},'test.ddn','main',reg).ir;
const render=s=>R.render(build(s),registry,defs);
const rejects=(s,code)=>assert.throws(()=>render(s),e=>e.code===code);
let total=0;function test(name,fn){try{fn();total++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e);process.exitCode=1;}}
const chain=n=>Array.from({length:n},(_,i)=>`frame f${i} "Level ${i+1}" { ${i?'within:@f'+(i-1)+';':''} ${i===n-1?'members:[@m.a];':''} }`).join('\n');
const encloses=(a,b)=>assert.ok(b.x>=a.x+20-.001&&b.y>=a.y+54-.001&&b.x+b.w<=a.x+a.w-20+.001&&b.y+b.h<=a.y+a.h-22+.001,JSON.stringify({a,b}));
test('four levels render deterministically and enclose all children',()=>{
 const s=source(chain(4)),r=render(s);assert.equal(r.svg,render(s).svg);
 const f=r.scene.frames;assert.equal(f.length,4);for(let i=1;i<4;i++)encloses(f[i-1],f[i]);encloses(f[3],r.scene.nodes[0]);
});
test('one level beyond limit is coded',()=>rejects(source(chain(5)),'DDN-FR03'));
test('self and two-frame cycles are coded',()=>{rejects(source('frame a {within:@a;}'),'DDN-FR02');rejects(source('frame a {within:@b;} frame b {within:@a;}'),'DDN-FR02');});
test('invalid parent values do not silently disappear',()=>{for(const within of ['@missing','@m.a','"a"','null','42','@other.a','@a#2'])assert.throws(()=>build(source(`frame a {} frame b {within:${within};}`)),e=>['DDN-FR01','DDN-OC01'].includes(e.code));});
test('forward parent references paint parent first',()=>{const r=render(source('frame child {within:@main.parent;members:[@m.a];} frame parent {}'));assert.match(r.scene.frames[0].id,/parent$/);encloses(r.scene.frames[0],r.scene.frames[1]);});
test('nesting is available in 0.6 and 0.7, rejects older source',()=>{render(source(chain(2),'','0.6'));rejects(source(chain(2),'','0.5'),'DDN-V04');});
test('registry can lower but cannot remove the safety cap',()=>{assert.throws(()=>build(source(chain(3)),{...registry,limits:{max_frame_depth:2}}),e=>e.code==='DDN-FR03');for(const n of [0,5,2.5,'4'])assert.throws(()=>build(source(chain(1)),{...registry,limits:{max_frame_depth:n}}),e=>e.code==='DDN-FR03');});
test('legacy registry defaults to four levels',()=>{const r={...registry};delete r.limits;build(source(chain(4)),r);});
test('explicit expanded parent grows left/up to include child',()=>{const r=render(source('frame p {at:[200px,200px];size:[100px,100px];} frame c {within:@p;at:[-200px,-100px];size:[100px,100px];}'));encloses(r.scene.frames[0],r.scene.frames[1]);});
test('confine reserves all ancestor padding for unpinned members',()=>{const r=render(source('frame p {at:[0px,0px];size:[1000px,800px];} frame c {within:@p;members:[@m.a];}','layout {algorithm:grid;frame_overflow:confine;}'));encloses(r.scene.frames[0],r.scene.frames[1]);encloses(r.scene.frames[1],r.scene.nodes[0]);});
test('confine rejects explicit child outside parent',()=>rejects(source('frame p {at:[0px,0px];size:[600px,400px];} frame c {within:@p;at:[-200px,0px];size:[100px,100px];}','layout {algorithm:grid;frame_overflow:confine;}'),'DDN-FR04'));
test('confine does not move pinned descendant outside ancestor',()=>rejects(source(chain(2).replace('frame f0 "Level 1" {','frame f0 "Level 1" {at:[0px,0px];size:[600px,400px];'),'layout {algorithm:grid;frame_overflow:confine;} place @m.a {at:[2000px,2000px];}'),'DDN-P004'));
test('independent appearances retain their frame membership',()=>{const r=render(source('frame p {} frame c {within:@p;members:[@m.a#2];}','select:[@m.a,@m.a#2]; place @m.a#2 {at:[1000px,0px];}'));encloses(r.scene.frames[1],r.scene.nodes.find(n=>n.id===D.occurrenceId('nest::main','nest::m.a',2)));});
test('empty nested frames still enclose and preserve title space',()=>{const r=render(source('frame p {} frame c {within:@p;}'));encloses(r.scene.frames[0],r.scene.frames[1]);});
test('depth violations remain hard errors in design previews',()=>{const result=D.buildDraft({'test.ddn':source(chain(5))},'test.ddn','main',registry);assert.equal(result.status,'invalid');assert.equal(result.ir,null);assert.ok(result.diagnostics.some(d=>d.code==='DDN-FR03'));});
test('distributed SDK renders nested frames and validates draft depth',()=>{const vm=require('node:vm'),context=vm.createContext({module:{exports:{}},console,performance,TextEncoder,TextDecoder,setTimeout,clearTimeout});vm.runInContext(fs.readFileSync(require.resolve('../dist/ddn.global.js'),'utf8'),context);const A=context.module.exports;const ws=A.createWorkspace({'test.ddn':source(chain(4))});assert.equal(ws.renderSync({entry:'test.ddn',view:'main'}).scene.frames.length,4);const bad=A.createWorkspace({'test.ddn':source(chain(5))});assert.equal(bad.validateDraft('test.ddn','main').status,'invalid');});
console.log(`Frame nesting: ${total}/16 passed`);
