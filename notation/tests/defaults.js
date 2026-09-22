/* SPDX-License-Identifier: GPL-2.0-or-later. B1-002 registry-driven element defaults. */
'use strict';
const A=require('../dist/ddn.global.js'),Defaults=require('../runtime/ddn-defaults.js').default,DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const profileReg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/profiles/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}

test('Every kind in both catalogues carries a defaults object and forKind resolves it without throwing',()=>{
 assert.equal(reg.kinds.length,152);assert.equal(profileReg.kinds.length,77);
 for(const k of [...reg.kinds,...profileReg.kinds]){
  assert.ok(k.defaults&&typeof k.defaults==='object'&&!Array.isArray(k.defaults),'defaults missing on '+k.keyword);
  const d=Defaults.forKind(k.keyword,reg.kinds.includes(k)?reg:profileReg);
  assert.deepEqual(d,k.defaults,'forKind mismatch for '+k.keyword);
 }
});

test('forKind returns a deep copy: mutating the result never pollutes the registry',()=>{
 const before=JSON.stringify(reg.kinds.find(k=>k.keyword==='cache').defaults);
 const d=Defaults.forKind('cache',reg);
 assert.deepEqual(d,{role:'cache'});
 d.role='MUTATED';d.extra={nested:[1]};
 assert.equal(JSON.stringify(reg.kinds.find(k=>k.keyword==='cache').defaults),before);
 const again=Defaults.forKind('cache',reg);
 assert.deepEqual(again,{role:'cache'});
});

test('forKind returns {} for unknown kinds and accepts kind ids as well as keywords',()=>{
 assert.deepEqual(Defaults.forKind('no.such.kind',reg),{});
 assert.deepEqual(Defaults.forKind('object',reg),{});
 const byId=Defaults.forKind(reg.kinds.find(k=>k.keyword==='cache').id,reg);
 assert.deepEqual(byId,{role:'cache'});
});

test('Public API exposes defaults.forKind over the profile-merged registry',()=>{
 assert.equal(typeof A.defaults.forKind,'function');
 assert.deepEqual(A.defaults.forKind('cache'),{role:'cache'});
 assert.deepEqual(A.defaults.forKind('object'),{});
 assert.deepEqual(A.defaults.forKind('c4.person'),{},'profile kinds resolve through the public API');
 assert.equal(A.defaults.placement,'source','presentation defaults object is preserved');
 const d=A.defaults.forKind('snapshot');d.temporal='MUTATED';
 assert.deepEqual(A.defaults.forKind('snapshot'),{temporal:'snapshot'});
});

test('A declared element with no properties renders with the defaults implicit (renderer never applies them)',()=>{
 const files={'m.ddn':'ddn "0.5";\nmodule "m";\ndata m {\n    object bare "Bare" { kind: cache; }\n}\nview v "V" {\n    data: [@m];\n}\n'};
 const {ir}=DDN.build(files,'m.ddn','v',reg);
 const bare=ir.elements.find(e=>e.local==='bare');
 assert.deepEqual(bare.properties,{kind:'cache'},'no silent default injection into resolved properties');
 const a=Render.render(ir,reg,defs),b=Render.render(ir,reg,defs);
 assert.equal(a.svg,b.svg,'nondeterministic render');
 assert.ok(!a.svg.includes('>cache<')||a.svg.includes('CAC'),'no role badge without an explicit property');
});

test('Explicit property beats the registry default',()=>{
 const files={'m.ddn':'ddn "0.5";\nmodule "m";\ndata m {\n    object x "X" { kind: cache; role: primary; }\n}\nview v "V" {\n    data: [@m];\n}\n'};
 const {ir}=DDN.build(files,'m.ddn','v',reg);
 assert.equal(ir.elements.find(e=>e.local==='x').properties.role,'primary');
});

test('D5: pre-existing use-case renders stay byte-identical to their committed goldens',()=>{
 const uc=path.join(root,'../website/examples/use-cases'),man=JSON.parse(fs.readFileSync(path.join(uc,'manifest.json'),'utf8'));
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const files={};for(const r of man.results)for(const f in r.sourceHashes)files[f]=fs.readFileSync(path.join(uc,f.replace(/^use-cases\//,'')),'utf8');
 for(const r of man.results){
  const {ir}=DDN.build(files,r.entry,r.view,reg);
  const a=Render.render(ir,reg,defs);
  assert.equal(hash(a.svg),r.svgHash,'golden drift '+r.svg);
  assert.equal(hash(JSON.stringify(DDN.semanticJSON(ir))),r.semanticHash,'semantic drift '+r.svg);
 }
});

test('Example 57 declares a bare and an overriding element of one kind and renders both',()=>{
 const entry='57-element-defaults.ddn',base=fs.readFileSync(path.join(root,'../website/examples/basics',entry),'utf8');
 const shared=fs.readFileSync(path.join(root,'../website/examples/basics/shared.ddn'),'utf8');
 const ws=A.createWorkspace({[entry]:base,'shared.ddn':shared});
 const ir=ws.resolve(entry,'defaults');
 const bare=ir.elements.find(e=>e.local==='bare'),explicit=ir.elements.find(e=>e.local==='explicit');
 assert.deepEqual(bare.properties,{kind:'cache'});
 assert.equal(explicit.properties.role,'primary','explicit override wins over the registry default');
 assert.deepEqual(A.defaults.forKind(bare.kind),{role:'cache'},'the bare element default is the registry value');
 const out=ws.renderSync({entry,view:'defaults'});
 assert.ok(out.svg.includes('<svg'));
 ws.destroy();
});

const pass=results.filter(r=>r.pass).length;
console.log(`Element defaults ${pass}/${results.length}`);
if(pass!==results.length)process.exitCode=1;
