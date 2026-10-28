import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/language');
const {decodeSources,applySourcePatches,patchProperty}=await import(pathToFileURL(path.join(build,'ddn/packages/language/src/index.js')));
const {listRecords}=await import(pathToFileURL(path.join(build,'ddn/packages/model/src/index.js')));
const input=text=>({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'one',encoding:'utf-8',writable:true}]});
const byName=(decoded,name)=>listRecords(decoded.normalized).find(r=>r.record.name===name);
const appearance=(decoded,target,parent)=>listRecords(decoded.normalized).find(r=>r.kind==='appearance'&&r.record.target.id===target.id&&(!parent||r.record.parent.id===parent.id));
function decode(source,previous){const result=decodeSources(source,{previous});assert.equal(result.syntaxValid,true,JSON.stringify(result.diagnostics));assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'),[]);return result;}
function edit(source,decoded,target,path,value){const next=applySourcePatches(source,patchProperty(decoded,target,path,value));return[next,decode(next,decoded)];}

test('compact relation presentation belongs to its view appearance and preserves omitted defaults',()=>{
 const source=input('erd Sales\n    Customer\n    Order\n    connect Customer to Order named Purchases\n        with\n            title "Places order"\n            label.visible false\n            label.mode numbers\n            legend.include true\nerd Elsewhere\n    use Customer\n    use Order\n    use Purchases\n');
 const decoded=decode(source),edge=byName(decoded,'Purchases'),first=appearance(decoded,edge.ref,byName(decoded,'Sales').ref),second=appearance(decoded,edge.ref,byName(decoded,'Elsewhere').ref);
 assert.equal(edge.record.title,'Places order');assert.equal(edge.record.label,undefined);assert.equal(edge.record.legend,undefined);
 assert.deepEqual(first.record.label,{visible:false,mode:'numbers'});assert.deepEqual(first.record.legend,{include:true});
 assert.equal(second.record.label,undefined);assert.equal(second.record.legend,undefined);
});

test('patching implicit relation labels preserves identities, CRLF, comments and unrelated source',()=>{
 const original='\ufeff// retain comment\r\nerd Sales\r\n    Customer\r\n    Order\r\n    connect Customer to Order named Purchases\r\n        with\r\n            label\r\n                visible false\r\n                mode numbers\r\n            legend.include true\r\n            title "Places order"\r\n// trailing comment\r\n';
 let source=input(original),decoded=decode(source);const edge=byName(decoded,'Purchases'),target=appearance(decoded,edge.ref).ref;
 [source,decoded]=edit(source,decoded,target,'label.visible',true);
 assert.equal(source.files[0].text,original.replace('visible false','visible true'));
 assert.deepEqual(byName(decoded,'Purchases').ref,edge.ref);assert.deepEqual(appearance(decoded,edge.ref).ref,target);
 [source,decoded]=edit(source,decoded,target,'label.mode','text');assert.deepEqual(appearance(decoded,edge.ref).record.label,{visible:true,mode:'text'});
 [source,decoded]=edit(source,decoded,target,'legend.include',false);assert.deepEqual(appearance(decoded,edge.ref).record.legend,{include:false});
 [source,decoded]=edit(source,decoded,target,'label',undefined);assert.equal(appearance(decoded,edge.ref).record.label,undefined);
 assert.equal(byName(decoded,'Purchases').record.title,'Places order');assert.deepEqual(appearance(decoded,edge.ref).record.legend,{include:false});
 assert.ok(source.files[0].text.startsWith('\ufeff// retain comment\r\n'));assert.ok(source.files[0].text.endsWith('// trailing comment\r\n'));
 assert.doesNotMatch(source.files[0].text,/(?<!\r)\n/);
});

test('an implicit relation can acquire its first presentation override and reset it without changing semantics',()=>{
 let source=input('erd Sales\n    Customer\n    Order\n    connect Customer to Order named Purchases\n'),decoded=decode(source);
 const edge=byName(decoded,'Purchases'),target=appearance(decoded,edge.ref).ref,semantic=structuredClone(edge.record);
 for(const [path,value] of [['label.visible',false],['label.mode','numbers'],['legend.include',true]])[source,decoded]=edit(source,decoded,target,path,value);
 assert.deepEqual(byName(decoded,'Purchases').record,semantic);
 assert.deepEqual(appearance(decoded,edge.ref).record.label,{visible:false,mode:'numbers'});
 for(const path of ['label.visible','label.mode','legend.include'])[source,decoded]=edit(source,decoded,target,path,undefined);
 assert.equal(appearance(decoded,edge.ref).record.label?.visible,undefined);assert.equal(appearance(decoded,edge.ref).record.label?.mode,undefined);assert.equal(appearance(decoded,edge.ref).record.legend?.include,undefined);
 assert.deepEqual(byName(decoded,'Purchases').record,semantic);
});

test('explicit relation occurrences retain independent label and legend settings',()=>{
 let source=input('element Customer as entity\nelement Order as entity\nconnect Customer to Order as assoc named Purchases\nerd Sales\n    use Customer\n    use Order\n    use Purchases named Detailed\n        with\n            label.visible true\n            label.mode text\n            legend.include false\nerd Summary\n    use Customer\n    use Order\n    use Purchases named Numbered\n        with\n            label.mode numbers\n            legend.include true\n'),decoded=decode(source);
 const target=byName(decoded,'Detailed').ref,before=structuredClone(byName(decoded,'Numbered').record);
 [source,decoded]=edit(source,decoded,target,'label.visible',false);
 assert.equal(byName(decoded,'Detailed').record.label.visible,false);assert.deepEqual(byName(decoded,'Numbered').record,before);
 assert.equal(byName(decoded,'Purchases').record.label,undefined);
});

test('long relation declarations route presentation settings to the local occurrence',()=>{
 const decoded=decode(input('erd Sales\n    Customer\n    Order\n    Invoice\n    relation Transaction as assoc\n        endpoint Customer\n        endpoint Order\n        endpoint Invoice\n        with\n            label.visible false\n            label.mode numbers\n            legend.include true\n'));
 const edge=byName(decoded,'Transaction'),local=appearance(decoded,edge.ref);
 assert.equal(edge.record.endpoints.length,3);assert.equal(edge.record.label,undefined);assert.equal(edge.record.legend,undefined);
 assert.deepEqual(local.record.label,{visible:false,mode:'numbers'});assert.deepEqual(local.record.legend,{include:true});
});
