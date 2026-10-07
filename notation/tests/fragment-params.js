/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 parameterized model
 * fragments + nested use: (0.9 roadmap item, spec ch. 01 amendment): token-
 * level substitution (declaration ids, whole @references, whole property
 * values, ${name} string interpolation), DDN-FG01–FG06 validation, cycle and
 * depth guards, version gating, and IR-equivalence fixtures against the
 * handwritten expansion (the deferral's equivalence gate, DDN-GAPS.md). */
'use strict';
const DDN=require('../runtime/ddn-core.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const build=(body,version='0.6',file='m.ddn')=>DDN.build({[file]:'ddn "'+version+'";\nmodule "m";\n'+body},file,'v',reg).ir;
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const strip=x=>JSON.stringify(x,(k,v)=>['source','presetOrigin'].includes(k)?undefined:v);
const irEqual=(a,b)=>strip(a.elements)===strip(b.elements)&&strip(a.relations)===strip(b.relations);

test('equivalence: parameterized use expands to the IR of the handwritten model',()=>{
 const frag='fragment staged(name, verb) { object name "Stage: ${name}" { kind: service; fields { verb: string; } } relation out @name -> @audit { kind: flow; } object audit "Audit ${name}" { kind: cache; } }';
 const used=build(frag+'\ndata m { use: @staged(ingest, payload); }\nview v { data: [@m]; }');
 const hand=build('data m { object ingest "Stage: ingest" { kind: service; fields { payload: string; } } relation out @ingest -> @audit { kind: flow; } object audit "Audit ingest" { kind: cache; } }\nview v { data: [@m]; }','0.6','h.ddn');
 assert.ok(irEqual(used,hand),'expanded IR === handwritten IR');
});

test('equivalence: nested pass-through re-binds parameters at application (labels included)',()=>{
 const defs='fragment staged(name, lnk) { object name "Stage: ${name}" { kind: service; } relation lnk @name -> @audit { kind: flow; } }\nfragment pipeline(first, second) { use: @staged(first, first_out); use: @staged(second, second_out); relation chain @first -> @second { kind: flow; } }';
 const used=build(defs+'\ndata m { object audit { kind: database; } use: @pipeline(ingest, reconcile); }\nview v { data: [@m]; }');
 const hand=build('data m { object audit { kind: database; } object ingest "Stage: ingest" { kind: service; } relation first_out @ingest -> @audit { kind: flow; } object reconcile "Stage: reconcile" { kind: service; } relation second_out @reconcile -> @audit { kind: flow; } relation chain @ingest -> @reconcile { kind: flow; } }\nview v { data: [@m]; }','0.6','h.ddn');
 assert.ok(irEqual(used,hand),'pass-through expansion IR === handwritten IR (labels re-bound, not baked)');
});

test('equivalence: nested parameterized fragments expand identically too',()=>{
 const defs='fragment base(x) { object x { kind: cache; } }\nfragment wrap(y) { use: @base(y); relation out @y -> @extra { kind: flow; } object extra { kind: queue; } }';
 const used=build(defs+'\ndata m { use: @wrap(core); }\nview v { data: [@m]; }');
 const hand=build('data m { object core { kind: cache; } relation out @core -> @extra { kind: flow; } object extra { kind: queue; } }\nview v { data: [@m]; }','0.6','h.ddn');
 assert.ok(irEqual(used,hand),'nested expansion IR === handwritten IR');
});

test('substitution positions: whole prop values, interpolation, $${ escape, dotted refs',()=>{
 const defs='fragment f(id, target, bound, note) { object id "${note}" { kind: service; max_width: bound; description: "refs @${id} links to ${target} (literal $${id} here)"; } relation out @id -> @target { kind: flow; } }';
 const ir=build(defs+'\ndata m { object audit_trail { kind: database; } use: @f(ingest, audit_trail, 200px, "Ingest stage"); }\nview v { data: [@m]; }');
 const el=ir.elements.find(e=>e.local==='ingest');
 assert.equal(el.name,'Ingest stage');
 assert.deepEqual(el.properties.max_width,{$quantity:200,unit:'px'},'quantity arg substituted whole');
 assert.equal(el.properties.description,'refs @ingest links to audit_trail (literal ${id} here)','interpolation + dotted arg + $${ escape');
 assert.equal(ir.relations[0].to.element,ir.elements.find(e=>e.local==='audit_trail').id,'reference arg bound');
});

test('DDN-FG01: arity mismatch and args on a parameterless definition',()=>{
 assert.equal(code(()=>build('fragment f(a, b) { object x {} }\ndata m { use: @f(1); }\nview v { data: [@m]; }')),'DDN-FG01');
 assert.equal(code(()=>build('fragment f { object x {} }\ndata m { use: @f(1); }\nview v { data: [@m]; }')),'DDN-FG01');
});

test('DDN-FG02/FG03/FG06: unknown ${param}, illegal identifier substitution, duplicate params',()=>{
 assert.equal(code(()=>build('fragment f(a) { object x "${b}" {} }\ndata m { use: @f(1); }\nview v { data: [@m]; }')),'DDN-FG02');
 assert.equal(code(()=>build('fragment f(a) { object a {} }\ndata m { use: @f(42); }\nview v { data: [@m]; }')),'DDN-FG03','number into declaration id');
 assert.equal(code(()=>build('fragment f(a) { object a {} }\ndata m { use: @f("not an id"); }\nview v { data: [@m]; }')),'DDN-FG03','spacey string into declaration id');
 assert.equal(code(()=>build('fragment f(a, a) { object a {} }\ndata m { object x {} }\nview v { data: [@m]; }')),'DDN-FG06','duplicate parameter');
});

test('DDN-FG04/FG05: use cycles and the depth cap of 8',()=>{
 assert.equal(code(()=>build('fragment a { use: @b; object x {} }\nfragment b { use: @a; object y {} }\ndata m { use: @a; }\nview v { data: [@m]; }')),'DDN-FG04','direct cycle');
 assert.equal(code(()=>build('fragment a { use: @a; object x {} }\ndata m { use: @a; }\nview v { data: [@m]; }')),'DDN-FG04','self cycle');
 let chain='';
 for(let i=0;i<9;i++)chain+='fragment f'+i+' { use: @f'+(i+1)+'; }\n';
 chain+='fragment f9 { object leaf {} }\n';
 assert.equal(code(()=>build(chain+'data m { use: @f0; }\nview v { data: [@m]; }')),'DDN-FG05','forward chain past the cap');
 let ok='fragment g0 { object leaf {} }\n';
 for(let i=1;i<=9;i++)ok+='fragment g'+i+' { use: @g'+(i-1)+'; }\n';
 assert.equal(code(()=>build(ok+'data m { use: @g9; }\nview v { data: [@m]; }')),null,'backward chain inside the cap expands');
});

test('nested use with presets and member groups, plus local-override precedence',()=>{
 const defs='preset tracked { temporal: daily; owner: "data-team"; }\nfragment entry(name) { object name { kind: service; use: @tracked; owner: "local-team"; } }';
 const ir=build(defs+'\ndata m { use: @entry(ingest); }\nview v { data: [@m]; }');
 const el=ir.elements.find(e=>e.local==='ingest');
 assert.equal(el.properties.temporal,'daily','preset applied inside the fragment');
 assert.equal(el.properties.owner,'local-team','local property wins over the preset');
});

test('version gates: params, args and nested use below ddn "0.6"',()=>{
 assert.equal(code(()=>build('fragment f(a) { object a {} }\ndata m { use: @f(z); }\nview v { data: [@m]; }','0.5')),'DDN-V04','params gated');
 assert.equal(code(()=>build('fragment a { object x {} }\nfragment b { use: @a; object y {} }\ndata m { use: @b; }\nview v { data: [@m]; }','0.5')),'DDN-E017','nested use stays E017 below 0.6');
 assert.equal(code(()=>build('fragment a { object x {} }\ndata m { use: @a; }\nview v { data: [@m]; }','0.5')),null,'unparameterized flat use unchanged below 0.6');
});

test('old sources unaffected: unparameterized fragments and presets expand as before',()=>{
 const defs='fragment pair { object log_a {} object log_b {} }\npreset common { temporal: daily; }';
 const ir=build(defs+'\ndata m { use: @pair; object solo { kind: cache; use: @common; } }\nview v { data: [@m]; }');
 assert.deepEqual(ir.elements.map(e=>e.local).sort(),['log_a','log_b','solo']);
 assert.equal(ir.elements.find(e=>e.local==='solo').properties.temporal,'daily');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' fragment-params tests passed');
