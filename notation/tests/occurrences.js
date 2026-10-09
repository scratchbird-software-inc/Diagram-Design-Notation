/* SPDX-License-Identifier: GPL-2.0-or-later. Versioned graph occurrences:
 * semantic identity, source edits, geometry, exports and compatibility. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../runtime/ddn-core.js').default,R=require('../runtime/ddn-full.js').default;
const reg=require('../../standard/registry/catalogue.json');
const defs=fs.readFileSync(__dirname+'/../../standard/registry/glyph-library.svg','utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const data='data m { object a "Alpha" {kind: table;fields { id {key:primary;} }} object b "Beta" {kind: table;fields { id {key:primary;} }} relation r @a.id -> @b.id {kind:ref;} }';
const source=(body='',version='0.6')=>`ddn "${version}"; module "occ"; ${data} view v {data:[@m];publication {size:content;} ${body}}`;
const build=(body,version)=>D.build({'m.ddn':source(body,version)},'m.ddn','v',reg).ir;
const render=ir=>R.render(ir,reg,defs);
const a='occ::m.a',b='occ::m.b',r='occ::m.r',view='occ::v',a2=D.occurrenceId(view,a,2),r2=D.occurrenceId(view,r,2);
const copies='select:[@m.a,@m.a#2,@m.b];';
let passed=0,total=0;function test(name,fn){total++;try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
function rejects(body,code,version){assert.throws(()=>build(body,version),e=>e.code===code);}
test('legacy duplicate select entries still mean one appearance with unchanged bytes',()=>{
 const x=build('select:[@m.a,@m.b];'),y=build('select:[@m.a,@m.a,@m.b];');assert.equal(x.view.occurrences,undefined);assert.equal(render(x).svg,render(y).svg);
});
test('qualified selection preserves semantic records and fingerprint inputs',()=>{
 const x=build(copies);assert.equal(x.elements.length,2);assert.equal(x.relations.length,1);assert.deepEqual(D.semanticJSON(x),D.semanticJSON(build()));
 assert.deepEqual(x.view.occurrences.elements.map(o=>o.id),[a,a2,b]);assert.deepEqual(render(x).scene.nodes.map(n=>n.id),[a,a2,b]);assert.equal(render(x).scene.routes.length,1);
});
test('each appearance pins independently and retains coordinates when another is added',()=>{
 const x=render(build(copies+'place @m.a {at:[0px,0px];} place @m.a#2 {at:[400px,300px];}'));
 assert.deepEqual(x.scene.nodes.filter(n=>[a,a2].includes(n.id)).map(n=>[n.x,n.y]),[[0,0],[400,300]]);
});
test('explicit relation copies target exact occurrences and preserve field endpoints',()=>{
 const ir=build(copies+'show:[@m.r#2];route @m.r#2 {from:@m.a#2;to:@m.b;}'),x=D.expandOccurrences(ir);
 assert.equal(x.relations.find(x=>x.id===r2).from.element,a2);assert.equal(x.relations.find(x=>x.id===r2).from.member,D.occurrenceId(view,a+'.id',2));
 assert.equal(x.relations.find(x=>x.id===r).from.element,a);assert.equal(render(ir).scene.routes.length,2);
});
test('only a nondefault appearance is legal; default relation picks the lowest visible ordinal',()=>{
 const ir=build('select:[@m.a#3,@m.a#2,@m.b];');assert.equal(ir.view.occurrences.relations[0].from,a2);assert.equal(render(ir).scene.nodes.length,3);
});
test('qualified exclude hides one appearance; bare exclude hides the whole model element',()=>{
 assert.deepEqual(build(copies+'exclude:[@m.a#2];').view.occurrences.elements.map(x=>x.id),[a,b]);
 assert.deepEqual(build(copies+'exclude:[@m.a];').view.occurrences.elements.map(x=>x.id),[b]);
});
test('show/hide control relation appearances without removing semantic relations',()=>{
 const ir=build(copies+'show:[@m.r#2];hide:[@m.r#1];');assert.deepEqual(ir.view.occurrences.relations.map(o=>o.id),[r2]);assert.equal(ir.relations.length,1);
 assert.equal(render(build(copies+'show:[@m.r#2];hide:[@m.r];')).scene.routes.length,0);
});
test('occurrence presentation overrides paint and text without touching the definition',()=>{
 const ir=build(copies+'place @m.a#2 {fill:"#abc";opacity:0.4;max_width:150px;text {weight:700;}stroke {color:"#123";}}');
 const x=D.expandOccurrences(ir);assert.equal(x.elements.find(e=>e.id===a).properties.fill,undefined);assert.equal(x.elements.find(e=>e.id===a2).properties.fill,'#abc');assert.deepEqual(D.semanticJSON(ir),D.semanticJSON(build()));assert.match(render(ir).svg,/opacity="0.4"/);
});
test('nested occurrence text and stroke overrides inherit unspecified definition properties',()=>{
 const code=source(copies+'place @m.a#2 {text {italic:true;}stroke {color:"#123";}}').replace('kind: table;fields','kind: table;text {weight:800;}stroke {weight:3px;}fields');
 const ir=D.build({'m.ddn':code},'m.ddn','v',reg).ir,copy=D.expandOccurrences(ir).elements.find(e=>e.id===a2);assert.equal(copy.properties.text.weight,800);assert.equal(copy.properties.text.italic,true);assert.equal(copy.properties.stroke.weight,3);
});
test('visual annotation references follow the visible appearance of their shared target',()=>{
 const code='ddn "0.6";module "anno";data m {object a {kind:"uml.class";}object b {kind:"uml.class";}object c {kind:"uml.class";}relation r @a -> @b {kind:"uml.association";x_association_class:{class:@c};}}view v {data:[@m];select:[@m.a,@m.b,@m.c#2];publication {size:content;}}';
 const ir=D.build({'m.ddn':code},'m.ddn','v',reg).ir,x=D.expandOccurrences(ir),cid=D.occurrenceId('anno::v','anno::m.c',2);assert.equal(x.relations[0].properties.x_association_class.class.$ref,cid);assert.match(render(ir).svg,/ddn-association-class/);assert.equal(ir.relations[0].properties.x_association_class.class.$ref,'anno::m.c');
});
test('frames can contain an explicitly addressed appearance',()=>{
 const ir=build(copies+'frame f {members:[@m.a#2];}');assert.deepEqual(ir.view.frames[0].members,[a2]);assert.equal(render(ir).scene.frames.length,1);
});
test('ordinal validation rejects zero, negative, fractional and unsafe numbers',()=>{for(const n of ['0','-1','1.5','9007199254740992'])rejects('select:[@m.a#'+n+'];','DDN-OC01');});
test('qualified references are dialect gated and cannot alter semantic endpoints',()=>{
 rejects(copies,'DDN-V04','0.5');assert.throws(()=>D.build({'m.ddn':source().replace('@a.id ->','@a.id#2 ->')},'m.ddn','v',reg),e=>e.code==='DDN-OC01');rejects('data:[@m#2];','DDN011');
});
test('wrong or invisible endpoint targets fail rather than reconnect the model',()=>{
 rejects(copies+'route @m.r {from:@m.b#1;}','DDN-OC03');rejects(copies+'route @m.r {from:@m.a#3;}','DDN-OC03');rejects('select:[@m.a];show:[@m.r];','DDN-OC03');
});
test('duplicate hints, absent occurrences and undeclared connector runs are rejected',()=>{
 rejects(copies+'place @m.a#2 {at:[0,0];}place @m.a#2 {at:[1,1];}','DDN-OC02');rejects('place @m.a#2 {at:[0,0];}','DDN062');rejects(copies+'route @m.r#2 {}','DDN063');
});
test('occurrence identity is stable across selection reordering and distinct across views',()=>{
 assert.equal(build('select:[@m.b,@m.a#2,@m.a];').view.occurrences.elements[1].id,a2);assert.notEqual(D.occurrenceId('other::v',a,2),a2);
});
test('isometric graphs accept explicit appearances without changing model selection',()=>{
 const ir=build(copies+'projection {kind:graph;iso:true;}');assert.ok(ir.view.occurrences.elements.some(o=>o.number===2));assert.equal(D.expandOccurrences(D.expandOccurrences(ir)).view.selected.length,D.expandOccurrences(ir).view.selected.length);const out=require('../runtime/ddn-iso.js').default.renderGraph(ir,reg,defs);assert.equal(out.scene.nodes.length,3);assert.ok(out.scene.nodes.some(n=>n.id===a2));assert.ok(out.svg.includes(a2.replaceAll('"','&quot;')));
});
test('qualified sources survive import bundling and preserve view identity',()=>{
 const files={'d.ddn':'ddn "0.6";\nmodule "shared";\n'+data,'v.ddn':'ddn "0.6";\nmodule "views";\nimport "d.ddn" as d;\nview v {data:[@d.m];select:[@d.m.a,@d.m.a#2,@d.m.b];publication {size:content;}}'};
 const before=D.build(files,'v.ddn','v',reg).ir,packed=D.bundle(files,'v.ddn');const after=D.build({'packed.ddn':packed.text},'packed.ddn','v',reg).ir;
 assert.equal(render(before).svg,render(after).svg);
});
test('redaction retains only allowlisted appearances and no private identity in SVG or scene',()=>{
 const ir=build(copies+'show:[@m.r#2];route @m.r#2 {from:@m.a#2;}export {mode:redacted;elements:[@m.a];fields:[];}');
 const out=render(ir);assert.equal(out.scene.nodes.length,2);assert.equal(out.scene.routes.length,0);assert.ok(!JSON.stringify([out.scene,out.svg,out._ir]).includes('occ::'));
});
test('diff operands compare model meaning rather than duplicate appearance count',()=>{
 const code=source(copies)+' view plain {data:[@m];publication {size:content;}} view changes {diff:[@plain,@v];publication {size:content;}}';
 const ir=D.build({'m.ddn':code},'m.ddn','changes',reg).ir;assert.ok(ir.elements.every(e=>e.diffState==='unchanged'));assert.equal(ir.elements.length,2);
});
test('model preset qualification cannot be silently discarded',()=>{
 const code='ddn "0.6";module "p";preset common {description:"test";}data m {object a {use:@common#2;}}view v {data:[@m];}';assert.throws(()=>D.build({'m.ddn':code},'m.ddn','v',reg),e=>e.code==='DDN-OC01');
});
const A=require('../dist/ddn.global.js');const newWS=()=>A.createWorkspace({'m.ddn':source()});const draw=w=>w.renderSync({entry:'m.ddn',view:'v'});
test('SDK add, pin, label edit and undo preserve one imported/shared definition',()=>{
 const w=newWS(),before=w.getFiles(),fp=draw(w).modelFingerprint;
 const added=A.authoring.addOccurrence(w,'m.ddn','v',a);assert.equal(added.occurrenceId,a2);assert.equal(draw(w).modelFingerprint,fp);
 A.authoring.pin(w,'m.ddn','v',a2,400,300);assert.match(w.getFiles()['m.ddn'],/place @m.a#2/);assert.equal(draw(w).sourceMap[a2].sourceId,a);
 A.authoring.setLabel(w,'m.ddn','v',a2,'Renamed');assert.equal(w.resolve('m.ddn','v').elements[0].name,'Renamed');assert.equal((draw(w).svg.match(/aria-label="Renamed"/g)||[]).length,2);
 w.undo();w.undo();w.undo();assert.deepEqual(w.getFiles(),before);w.destroy();
});
test('SDK relation appearance and hide are atomic, leaving the other run intact',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);A.authoring.addRelationOccurrence(w,'m.ddn','v',r,{from:a2,to:b});A.authoring.pin(w,'m.ddn','v',a2,500,300);
 const before=w.getFiles(),fp=draw(w).modelFingerprint;A.authoring.hide(w,'m.ddn','v',a2);assert.equal(draw(w).scene.nodes.length,2);assert.equal(draw(w).scene.routes.length,1);assert.equal(draw(w).modelFingerprint,fp);w.undo();assert.deepEqual(w.getFiles(),before);w.destroy();
});
test('SDK rejects bad endpoint targeting with no partial source mutation',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);const before=w.getFiles(),rev=w.revision;assert.throws(()=>A.authoring.addRelationOccurrence(w,'m.ddn','v',r,{from:b,to:a2}),e=>e.code==='DDN-OC03');assert.deepEqual(w.getFiles(),before);assert.equal(w.revision,rev);w.destroy();
});
test('SDK presentation, pinAll and unpin retain other occurrence properties',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);const fp=draw(w).modelFingerprint;A.authoring.setOccurrencePresentation(w,'m.ddn','v',a2,{fill:'#abcdef',text:{italic:true}});A.authoring.pinAll(w,'m.ddn','v',{[a]:{x:0,y:0},[a2]:{x:500,y:300}});A.authoring.unpin(w,'m.ddn','v',a2);assert.match(w.getFiles()['m.ddn'],/italic: true/);assert.equal(draw(w).modelFingerprint,fp);assert.equal(w.resolve('m.ddn','v').view.placements[a2].at,undefined);w.destroy();
});
test('SDK snapshot and source-map member identity survive round trip',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);const rendered=draw(w);assert.equal(rendered.sourceMap[D.occurrenceId(view,a+'.id',2)].sourceId,a+'.id');const snap=w.snapshot('m.ddn','v'),restored=A.fromSnapshot(snap).workspace;assert.equal(draw(restored).svg,rendered.svg);restored.destroy();w.destroy();
});
test('SDK frame edits preserve qualified members and hide cleans them atomically',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);A.authoring.addFrame(w,'m.ddn','v',{id:'f',memberUids:[a2]});assert.deepEqual(w.resolve('m.ddn','v').view.frames[0].members,[a2]);const before=w.getFiles();A.authoring.hide(w,'m.ddn','v',a2);assert.deepEqual(w.resolve('m.ddn','v').view.frames[0].members,[]);assert.equal(draw(w).scene.nodes.length,2);w.undo();assert.deepEqual(w.getFiles(),before);w.destroy();
});
test('adding a copy of an excluded definition does not unhide the default occurrence',()=>{
 const w=A.createWorkspace({'m.ddn':source('exclude:[@m.a];')});A.authoring.addOccurrence(w,'m.ddn','v',a);assert.deepEqual(w.resolve('m.ddn','v').view.occurrences.elements.map(e=>e.id),[b,a2]);w.destroy();
});
test('new model relation drawn from a copy retains its chosen visual endpoint',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);A.authoring.addRelation(w,'m.ddn','v',{id:'second',from:a2,to:b});const ir=w.resolve('m.ddn','v');const rel=ir.relations.find(r=>r.id.endsWith('.second'));assert.equal(rel.from.element,a);assert.equal(ir.view.occurrences.relations.find(o=>o.source===rel.id).from,a2);w.destroy();
});
test('per-occurrence routing previews and saved routes target only the selected run',()=>{
 const w=newWS();A.authoring.addOccurrence(w,'m.ddn','v',a);A.authoring.addRelationOccurrence(w,'m.ddn','v',r,{from:a2,to:b});const files=w.getFiles();const out=w.renderSync({entry:'m.ddn',view:'v',overrides:{relationRouting:{[r2]:'straight'}}});assert.equal(out.scene.routes.find(r=>r.id===r2).routing,'straight');assert.deepEqual(w.getFiles(),files);A.authoring.setViewProfile(w,'m.ddn','v',{}, {routes:{[r2]:{routing:'straight'}}});assert.equal(w.resolve('m.ddn','v').view.routes[r]?.routing,undefined);assert.equal(w.resolve('m.ddn','v').view.routes[r2].routing,'straight');w.destroy();
});
test('adding a connector copy restores only that run when the relationship was hidden',()=>{
 const w=A.createWorkspace({'m.ddn':source(copies+'hide:[@m.r];')});A.authoring.addRelationOccurrence(w,'m.ddn','v',r,{from:a2,to:b});assert.deepEqual(w.resolve('m.ddn','v').view.occurrences.relations.map(o=>o.id),[r2]);w.destroy();
});
test('live limits count visual appearances, not just shared model definitions',()=>{
 const refs=Array.from({length:129},(_,i)=>'@m.a#'+(i+1)).join(',');const w=A.createWorkspace({'m.ddn':source('select:['+refs+'];')});assert.throws(()=>w.resolve('m.ddn','v'),e=>e.code==='LIVE013');w.destroy();
});
test('imported copies edit the shared file and leave the other view occurrence count unchanged',()=>{
 const files={'d.ddn':'ddn "0.6";\nmodule "shared";\n'+data,'v.ddn':'ddn "0.6";\nmodule "views";\nimport "d.ddn" as d;\nview first {data:[@d.m];publication {size:content;}} view second {data:[@d.m];publication {size:content;}}'};
 const w=A.createWorkspace(files),a='shared::m.a',before=w.renderSync({entry:'v.ddn',view:'first'}).modelFingerprint,added=A.authoring.addOccurrence(w,'v.ddn','first',a);
 assert.equal(w.getFiles()['d.ddn'],files['d.ddn']);assert.equal(w.renderSync({entry:'v.ddn',view:'first'}).modelFingerprint,before);assert.equal(w.renderSync({entry:'v.ddn',view:'second'}).scene.nodes.length,2);
 A.authoring.setLabel(w,'v.ddn','first',added.occurrenceId,'Updated shared');assert.match(w.getFiles()['d.ddn'],/Updated shared/);assert.match(w.renderSync({entry:'v.ddn',view:'second'}).svg,/Updated shared/);w.undo();w.undo();assert.deepEqual(w.getFiles(),files);w.destroy();
});
test('the normative occurrence example builds and renders',()=>{
 const text=fs.readFileSync(__dirname+'/../../standard/specification/03-views-and-reuse.md','utf8').match(/```ddn-0\.8\n([\s\S]*?)```/)[1];
 const ir=D.build({'m.ddn':'ddn "0.6";module "normative";\n'+text},'m.ddn','overview',reg).ir;assert.equal(render(ir).scene.nodes.length,3);assert.equal(render(ir).scene.routes.length,2);
});
console.log(`occurrences ${passed}/${total}`);
