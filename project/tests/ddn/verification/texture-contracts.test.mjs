import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/ddn');
const mod=async name=>import(pathToFileURL(path.join(build,'ddn/packages',name,'src/index.js')));
const {decodeSources,encodeDefinition,patchProperty,applySourcePatches}=await mod('language');
const {indexRecords}=await mod('profiles');
const {resolve,validateProperty,parseStylesheet}=await mod('defaults');
const sources=text=>({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});
const named=(decoded,name)=>indexRecords(decoded.normalized).find(r=>r.record.name===name);
const owners=['workarea','definition','appearance','view_definition','view_placement','document'];

test('texture contract is nullable, bounded and closed on each surface owner',()=>{
 for(const owner of owners){
  for(const value of [null,{},...['paper','linen','grid','dots'].map(kind=>({kind,color:'#abc8ff80',opacity:0,scale:4,seed:2147483647}))])assert.deepEqual(validateProperty(owner,'background.texture',value),[],owner);
  for(const value of ['paper',{kind:'noise'},{color:'url(https://example.com)'},{opacity:1.1},{scale:3},{scale:129},{seed:-1},{seed:1.5},{seed:2147483648},{source:'<svg/>'}])assert.ok(validateProperty(owner,'background.texture',value).length,owner+' '+JSON.stringify(value));
  assert.equal(resolve({},owner).values.background.texture,null);
 }
 assert.ok(validateProperty('publication','background.texture',{}).length);
});

test('texture settings roundtrip and dotted edits enable a disabled texture',()=>{
 const input=sources('element Idea as note\n    with\n        background.color "#fff2ab"\n        background.texture\n            kind paper\n            color "#9b7952"\n            scale 32\n            seed 42\nview Board as ddn@1\n    use Idea\n');
 const decoded=decodeSources(input);assert.deepEqual(decoded.diagnostics,[]);
 const idea=named(decoded,'Idea'),roundtrip=decodeSources(sources(encodeDefinition(idea.record)));
 assert.deepEqual(roundtrip.diagnostics,[]);assert.deepEqual(named(roundtrip,'Idea').record,idea.record);
 const off=decodeSources(applySourcePatches(input,patchProperty(decoded,idea.ref,'background.texture',null)));assert.deepEqual(off.diagnostics,[]);
 const offSources=applySourcePatches(input,patchProperty(decoded,idea.ref,'background.texture',null));
 const on=decodeSources(applySourcePatches(offSources,patchProperty(off,idea.ref,'background.texture.kind','linen')));
 assert.deepEqual(on.diagnostics,[]);assert.deepEqual(named(on,'Idea').record.background.texture,{kind:'linen'});
});

test('scoped CSS, file defaults, shared definitions and explicit null retain texture priority',()=>{
 const css=parseStylesheet('.method-ddn.subtype-discussion.role-note { --ddn-background-texture: {"kind":"paper","color":"#9b7952","seed":42}; }');assert.deepEqual(css.diagnostics,[]);
 const context={method:'ddn',subtype:['discussion'],role:'note',styles:css.rules};
 const styled=resolve({},'definition',context);assert.deepEqual(styled.diagnostics,[]);assert.deepEqual(styled.values.background.texture,{kind:'paper',color:'#9b7952',seed:42});
 const file=resolve({},'definition',{...context,fileDefaults:[{selector:{owner:'definition'},declarations:{'background.texture.scale':48}}]});assert.deepEqual(file.diagnostics,[]);assert.deepEqual(file.values.background.texture,{kind:'paper',color:'#9b7952',seed:42,scale:48});
 const occurrence=resolve({background:{texture:{color:'#112233'}}},'appearance',{...context,definition:{background:{texture:{kind:'linen',scale:64}}}});
 assert.deepEqual(occurrence.diagnostics,[]);assert.deepEqual(occurrence.values.background.texture,{kind:'linen',color:'#112233',seed:42,scale:64});
 assert.equal(resolve({background:{texture:null}},'appearance',{...context,definition:{background:{texture:{kind:'linen'}}}}).values.background.texture,null);
 assert.equal(resolve({},'definition',{...context,method:'chen'}).values.background.texture,null);
});
