// SPDX-License-Identifier: GPL-2.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const built=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=name=>import(pathToFileURL(resolve(built,'ddn/packages',name,'src/index.js')));
const {decodeSources}=await load('language'),{resolveProperties}=await load('defaults'),{freeze}=await load('execution');
function fixture(){const decoded=decodeSources({entry:'main.ddn',files:[{id:'main.ddn',revision:'1',encoding:'utf-8',writable:true,text:'erd Main\n    Customer\n        notes Detail : Notes\n            Full description\n    Order\n    connect Customer to Order\n'}]});return {contract:'ddn-next-1',rootFile:'main.ddn',versions:{api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{}},revision:{model:'1',sources:{'main.ddn':'1'},data:{}},semanticFingerprint:'fixture',coverage:decoded.coverage,normalized:structuredClone(decoded.normalized)};}
const documentOf=s=>s.normalized.files[0].document;
const ref=(id,name)=>({file:'main.ddn',...(id?{id}:{}),...(name?{name}:{})});
test('immutable indexed defaults equal fresh resolution for definitions, occurrences and notes',()=>{
 const snapshot=fixture(),document=documentOf(snapshot),immutable=freeze(structuredClone(snapshot));
 for(const record of [...document.definitions,...document.appearances,...document.views,...document.placements,document.definitions[0].notes[0]]){
  const target=ref(record.id);assert.deepEqual(resolveProperties(immutable,target),resolveProperties(structuredClone(snapshot),target));
 }
});
for(const shallow of [false,true])test(`mutable nested model remains observable under ${shallow?'shallow frozen':'mutable'} envelope`,()=>{
 const snapshot=fixture();if(shallow)Object.freeze(snapshot);const document=documentOf(snapshot),customer=document.definitions.find(r=>r.name==='Customer'),target=ref(customer.id,'Customer');
 assert.ok(!resolveProperties(snapshot,target).diagnostics.length);
 customer.name='Renamed';assert.equal(resolveProperties(snapshot,target).diagnostics[0].code,'DDN-REFERENCE');
 assert.ok(!resolveProperties(snapshot,ref(customer.id,'Renamed')).diagnostics.length);
 document.definitions=[...document.definitions,{id:'new',name:'New',role:'entity',category:'element'}];
 assert.ok(!resolveProperties(snapshot,ref('new')).diagnostics.length);
});
test('indexed resolution preserves exact ambiguity and id/name intersection behavior',()=>{
 const snapshot=fixture(),document=documentOf(snapshot),original=document.definitions.find(r=>r.name==='Customer');
 document.definitions.push({...original,name:'Distinct'},{...original,id:'another'});freeze(snapshot);
 assert.equal(resolveProperties(snapshot,ref(original.id)).diagnostics[0].code,'DDN-REFERENCE');
 assert.equal(resolveProperties(snapshot,ref(undefined,'Customer')).diagnostics[0].code,'DDN-REFERENCE');
 assert.ok(!resolveProperties(snapshot,ref(original.id,'Customer')).diagnostics.length);
 assert.equal(resolveProperties(snapshot,ref('another','Distinct')).diagnostics[0].code,'DDN-REFERENCE');
});
test('indexes do not retain resolved CSS paint values',()=>{
 const snapshot=freeze(fixture()),target=ref(documentOf(snapshot).definitions[0].id);
 const styles=colour=>[{selector:{owner:'definition'},declarations:{'text.color':colour}}];
 assert.equal(resolveProperties(snapshot,target,{styles:styles('#ff0000')}).values.text.color,'#ff0000');
 assert.equal(resolveProperties(snapshot,target,{styles:styles('#0000ff')}).values.text.color,'#0000ff');
});
test('frozen accessors cannot qualify mutable lookups for reuse',()=>{
 const snapshot=fixture(),record=documentOf(snapshot).definitions[0];let name=record.name;
 Object.defineProperty(record,'name',{get:()=>name,enumerable:true});freeze(snapshot);
 assert.ok(!resolveProperties(snapshot,ref(record.id,name)).diagnostics.length);
 name='Renamed';assert.ok(!resolveProperties(snapshot,ref(record.id,name)).diagnostics.length);
 assert.equal(resolveProperties(snapshot,ref(record.id,'Customer')).diagnostics[0].code,'DDN-REFERENCE');
 let normalized=fixture().normalized;const envelope=Object.freeze({...fixture(),get normalized(){return normalized;}});
 assert.ok(!resolveProperties(envelope,ref(undefined,'Customer')).diagnostics.length);
 normalized=structuredClone(normalized);normalized.files[0].document.definitions[0].name='Replacement';freeze(normalized);
 assert.ok(!resolveProperties(envelope,ref(undefined,'Replacement')).diagnostics.length);
});
