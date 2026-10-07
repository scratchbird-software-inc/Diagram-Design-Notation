/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 Chen profile completion
 * (0.9 closure, spec ch. 17 §17.5): chen.nary@3 — one diamond per n-ary
 * relationship with one labelled spoke per participant end; binary profiles
 * reject x_nary rather than flattening; weak/identifying/multivalued/derived
 * notation (chen.binary@2) re-pinned; cardinality annotations at every end. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,P=require('../runtime/ddn-projections.js').default;
require('../runtime/ddn-profile-quality.js');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const ENT=(id,extra='')=>'  object '+id+' "'+id+'" { kind: entity; fields { '+id+'_id { key: primary; } }\n'+extra+' }\n';
const NARY='data m {\n'+ENT('supplier')+ENT('part')+ENT('project')+' relation spj "supplies" @supplier -> @part { kind: assoc; x_nary: { ends: [{ element: @project, role: "for", multiplicity: "(1..N)" }] }; x_chen: { from: { min: 0, max: "many" }, to: { min: 0, max: "many" } }; }\n}\n';
const build=(body,profile)=>DDN.build({'m.ddn':'ddn "0.6";\nmodule "m";\n'+body+'\nview v { data: [@m]; projection { kind: chen; profile: "'+profile+'"; } publication { size: content; } }'},'m.ddn','v',reg).ir;

test('chen.nary@3: one diamond, one labelled spoke per end (min/max both binary ends + end annotation)',()=>{
 const out=P.render(build(NARY,'chen.nary@3'),reg);
 assert.equal(out.scene.projection.profile,'chen.nary@3');
 const occ=out.scene.projection.mapping.map(m=>m.occurrence);
 assert.ok(occ.includes('occ:nary:0:m::m.spj')&&occ.includes('occ:nary:2:m::m.spj'),'three spokes (from, to, project end)');
 assert.ok(/\(0\.\.N\)/.test(out.svg)&&/\(1\.\.N\)/.test(out.svg),'cardinality annotations at every end');
 assert.ok(out.scene.projection.mapping.some(m=>String(m.occurrence).includes('m.spj')&&String(m.source).includes('spj')),'association diamond keeps provenance');
});

test('binary profiles reject n-ary relationships rather than flattening them',()=>{
 assert.equal(code(()=>P.render(build(NARY,'chen.binary@2'),reg)),'DDN-PJ151','x_nary on assoc is a build error under binary@2');
 assert.equal(code(()=>P.render(build(NARY,'chen.basic@1'),reg)),'DDN-PJ151','same under basic@1');
});

test('n-ary validation: missing ends are coded errors',()=>{
 const thin=NARY.replace('ends: [{ element: @project, role: "for", multiplicity: "(1..N)" }]','ends: []');
 assert.ok(code(()=>P.render(build(thin,'chen.nary@3'),reg)),'empty ends rejected');
});

test('weak/identifying/multivalued/derived notation re-pinned under @2/@3',()=>{
 const body='data m {\n  object owner "Owner" { kind: entity; fields { oid { key: primary; } }\n  }\n  object weak_one "Dependent" { kind: entity; x_chen: { weak: true, owner: @owner }; fields { seq { x_chen: { partial_key: true }; } tags { shape: array; x_chen: { multivalued: true }; } label_line { x_chen: { derived: true }; } }\n  }\n  relation owns "owns" @owner -> @weak_one { kind: assoc; x_chen: { identifying: true, weak: @weak_one, owner: @owner, from: { min: 1, max: 1 }, to: { min: 0, max: "many" } }; }\n}\n';
 for(const profile of ['chen.binary@2','chen.nary@3']){
  const svg=P.render(build(body,profile),reg).svg;
  assert.ok(/stroke-dasharray="6 4"/.test(svg),'derived dashed under '+profile);
  assert.ok((svg.match(/<ellipse/g)||[]).length>=2,'multivalued double ellipse under '+profile);
 }
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' chen-nary tests passed');
