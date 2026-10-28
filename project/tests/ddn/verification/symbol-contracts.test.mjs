import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/ddn');
const mod=async name=>import(pathToFileURL(path.join(build,'ddn/packages',name,'src/index.js')));
const {decodeSources,encodeDefinition}=await mod('language');
const {indexRecords}=await mod('profiles');
const {resolve,validateProperty,parseStylesheet}=await mod('defaults');
const sources=text=>({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});
const labels=['auto','none','inside','top','bottom','left','right','top-left','top-right','bottom-left','bottom-right'];
test('symbol settings have closed types and omitted presentation remains auto',()=>{
 for(const owner of ['definition','appearance']) {
  assert.deepEqual(resolve({},owner).values.symbol.mode,'auto');
  assert.equal(resolve({},owner).values.symbol.image,null);
  assert.equal(resolve({},owner).values.symbol.label_gap,6);
  for(const mode of ['auto','card','image','text'])assert.deepEqual(validateProperty(owner,'symbol.mode',mode),[]);
  for(const label of labels)assert.deepEqual(validateProperty(owner,'symbol.label',label),[]);
  for(const asset of [null,{id:'image'},{file:'assets.ddn',id:'image'}])assert.deepEqual(validateProperty(owner,'symbol.image',asset),[]);
  for(const [key,value] of [['mode','electrical'],['label','northeast'],['image','https://example.com/image.svg'],['label_gap',-1]])assert.ok(validateProperty(owner,'symbol.'+key,value).length);
 }
 assert.ok(validateProperty('workarea','symbol.mode','image').length);
});
test('symbol artwork uses existing reference notation and roundtrips without adding defaults',()=>{
 const input=sources('asset Icon as resource from "icon.svg"\n    with\n        media_type "image/svg+xml"\nelement Device as object\n    with\n        symbol.image Icon\n        symbol.label top-right\nview Board as ddn@1\n    use Device\n');
 const decoded=decodeSources(input);assert.deepEqual(decoded.diagnostics,[]);
 const device=indexRecords(decoded.normalized).find(r=>r.record.name==='Device');assert.ok(device.record.symbol.image.id);assert.equal(device.record.symbol.mode,undefined);
 const serialized=encodeDefinition(device.record);assert.match(serialized,/symbol/);assert.doesNotMatch(serialized,/label_gap/);
 const check=decodeSources(sources(serialized));assert.equal(check.syntaxValid,true);
});
test('symbol cascade honors profile CSS, file defaults, shared and occurrence overrides including null',()=>{
 const css=parseStylesheet('.method-ddn.role-object { --ddn-symbol-mode: image; --ddn-symbol-image: {"id":"css-image"}; --ddn-symbol-label: left; --ddn-symbol-label-gap: 9; }');assert.deepEqual(css.diagnostics,[]);
 const context={method:'ddn',role:'object',styles:css.rules};
 const styled=resolve({},'definition',context);assert.deepEqual(styled.diagnostics,[]);assert.equal(styled.values.symbol.label,'left');
 const defaults=resolve({},'appearance',{...context,definition:{defaults:[{selector:{owner:'appearance'},declarations:{'symbol.label':'right','symbol.image':{id:'default-image'}}}]}});assert.deepEqual(defaults.diagnostics,[]);assert.equal(defaults.values.symbol.label,'right');assert.equal(defaults.values.symbol.image.id,'default-image');
 const shared={symbol:{image:{id:'file-image'},label:'bottom'}};
 const inherited=resolve({},'appearance',{...context,definition:shared});assert.equal(inherited.values.symbol.image.id,'file-image');assert.equal(inherited.values.symbol.label,'bottom');
 const own=resolve({symbol:{image:null,label:'none'}},'appearance',{...context,definition:shared});assert.equal(own.values.symbol.image,null);assert.equal(own.values.symbol.label,'none');assert.equal(own.properties.find(p=>p.path==='symbol.image').origin,'file:occurrence');
 assert.equal(resolve({},'appearance').properties.find(p=>p.path==='symbol.image').origin,'standard:appearance');
});
