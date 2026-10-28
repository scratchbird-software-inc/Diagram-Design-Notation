import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {convertGraph,convertDefinitions,convertValue} from '../../../../tooling/website/migrate-graphs.mjs';
import {documentSource} from '../profiles/fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const language=await import(pathToFileURL(resolve(output,'ddn/packages/language/src/index.js')));
const {createRuntime,createCompleteRuntimeOptions}=await import(pathToFileURL(resolve(output,'ddn/packages/runtime/src/index.js')));
const sourceFor = doc => documentSource(doc,language) + (doc.publications ?? []).map(p => {const {name,...settings}=p;return '\npublication '+language.quoteText(name)+'\n    with\n'+language.serializeProperties(settings,'        ');}).join('');
const original={view:{id:'sample::overview',local:'overview',name:'Customer records',selected:['sample::sales.customer','sample::sales.order'],relations:['sample::sales.purchase'],profiles:{projection:{kind:'graph',profile:'ddn@1'},style:{look:'handDrawn'},display:{datatypes:'show'}}},elements:[
 {id:'sample::sales.customer',local:'customer',name:'Customer',kind:'table',properties:{},fields:[{id:'sample::sales.customer.id',name:'id',properties:{datatype:'integer',key:'primary'}}],ports:[{id:'sample::sales.customer.in',name:'input',properties:{direction:'in'}}]},
 {id:'sample::sales.order',local:'order',name:'Order',kind:'table',properties:{},fields:[{id:'sample::sales.order.customer',name:'customer',properties:{datatype:'integer'}}],ports:[]}],relations:[{id:'sample::sales.purchase',name:'placed by',kind:'ref',from:{element:'sample::sales.order',member:'sample::sales.order.customer'},to:{element:'sample::sales.customer',member:'sample::sales.customer.id'},properties:{source_mark:'zeromany',target_mark:'one'}}]};
test('offline conversion retains human labels, values and endpoint identities through new source',async()=>{
 const doc=convertGraph({resolved:original});assert.equal(doc.views[0].style.look,'handdrawn');assert.equal(doc.definitions.find(d=>d.id==='sample::sales.customer').title,'Customer');
 assert.deepEqual(doc.definitions.find(d=>d.id==='sample::sales.customer').data.rows,[['id','integer',null,null,'primary',null]]);
 const runtime=createRuntime(createCompleteRuntimeOptions());try{const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:sourceFor(doc),revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));const records=opened.snapshot.normalized.files[0].document.definitions;const customer=records.find(d=>d.id==='sample::sales.customer');assert.equal(customer.members.length,2,'authored field and port both retained');assert.equal(records.filter(d=>d.role==='field').length,2,'rows reuse authored members');assert.equal(records.find(d=>d.role==='core::Port').content.direction,'input');}finally{runtime.destroy();}
});
test('core port retained metadata roundtrips and is validated',async()=>{
 const doc=convertGraph({resolved:structuredClone(original)});const port=doc.definitions.find(d=>d.role==='core::Port');port.metadata={x_pin:{streaming:true},x_port:{type:'proxy'}};port.properties={side:'east',fraction:.5};
 const decoded=language.decodeSources({entry:'main.ddn',files:[{id:'main.ddn',text:sourceFor(doc),revision:'1',encoding:'utf-8',writable:true}]});assert.deepEqual(decoded.diagnostics.filter(d=>d.severity==='error'),[]);assert.deepEqual(decoded.normalized.files[0].document.definitions.find(d=>d.role==='core::Port').metadata,port.metadata);
});
test('structured guard alternatives accept comparison keys without assuming the first union branch',()=>{
 const doc=convertGraph({resolved:structuredClone(original)});const activity={id:'workflow',name:'Workflow',role:'activity',category:'element',metadata:{x_workflow:{states:['pending','accepted'],initial:'pending',terminal:['accepted'],transitions:[{id:'ok',from:'pending',to:'accepted',event:'approve',guard:{field:'approved',op:'eq',value:true}}]}}};doc.definitions.push(activity);
 const decoded=language.decodeSources({entry:'main.ddn',files:[{id:'main.ddn',text:sourceFor(doc),revision:'1',encoding:'utf-8',writable:true}]});assert.equal(decoded.syntaxValid,true,JSON.stringify(decoded.diagnostics));assert.deepEqual(decoded.normalized.files[0].document.definitions.find(d=>d.id==='workflow').metadata.x_workflow.transitions[0].guard,{field:'approved',op:'eq',value:true});
});
test('conversion preserves source facts with no registered equivalent as readable notes',()=>{
 const sample=structuredClone(original);sample.elements[0].properties={role:'team-specific role'};const item=convertDefinitions(sample).find(d=>d.id==='sample::sales.customer');assert.equal(item.properties,undefined);assert.match(item.notes[0].text,/team-specific role/);
 assert.deepEqual(convertValue({$ref:'sample::sales.customer'},{file:'demo.ddn'}),{file:'demo.ddn',id:'sample::sales.customer'});
});
test('decision output list alternatives preserve quoted names and explicit references',()=>{
 const text=`element Out as domain\nview Names as decision.rules@1\n    with\n        projection.options.outputs\n            item "route"\n            item "fee"\n            item "flag"\nview Refs as decision.rules@1\n    with\n        projection.options.outputs\n            item\n                name Out\n`;
 const decoded=language.decodeSources({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});assert.deepEqual(decoded.diagnostics.filter(d=>d.severity==='error'),[]);
 const doc=decoded.normalized.files[0].document;assert.deepEqual(doc.views[0].projection.options.outputs,['route','fee','flag']);assert.equal(doc.views[1].projection.options.outputs[0].id,doc.definitions[0].id);
});
test('BPMN migration preserves authored connections so the verifier can report pool violations',()=>{
 const input={view:{id:'sample::process',local:'process',selected:['A','B'],relations:['sequence','message'],profiles:{projection:{profile:'bpmn.process@1'}},frames:[{id:'pool',name:'Pool',x_pool:true,members:['A','B']}]},elements:['A','B'].map(id=>({id,name:id,kind:'flow.process',properties:{}})),relations:[{id:'sequence',kind:'uml.flow',from:{element:'A'},to:{element:'B'},properties:{}},{id:'message',kind:'bpmn.messageflow',from:{element:'A'},to:{element:'B'},properties:{}}]};
 const one=convertGraph({resolved:input});assert.ok(one.definitions.some(d=>d.id==='message'));assert.ok(one.views[0].selection.include.some(r=>r.id==='sequence'));assert.ok(one.views[0].selection.include.some(r=>r.id==='message'));assert.equal(one.views[0].selection.exclude,undefined);
 input.view.frames=[{id:'poolA',x_pool:true,members:['A']},{id:'poolB',x_pool:true,members:['B']}];const two=convertGraph({resolved:input});assert.ok(two.definitions.some(d=>d.id==='sequence'));assert.equal(two.views[0].selection.exclude,undefined);assert.ok(two.views[0].selection.include.some(r=>r.id==='sequence'));assert.ok(two.views[0].selection.include.some(r=>r.id==='message'));
});
test('a SoaML service interface may expose its service port while request ports retain participant ownership',async()=>{
 const {indexRecords,completeProfileDiagnostics}=await import(pathToFileURL(resolve(output,'ddn/packages/profiles/src/index.js')));
 const text=`element Billing as soaml.serviceinterface\n    with\n        members\n            item Api\nelement Api as core::Port\n    with\n        content.owner Billing\n        metadata.x_service.kind service\nview Main as soaml.services@1\n    use Billing\n`;
 const decoded=language.decodeSources({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});assert.deepEqual(decoded.diagnostics.filter(d=>d.severity==='error'),[]);const records=indexRecords(decoded.normalized),view=records.find(r=>r.owner==='view_definition');assert.equal(completeProfileDiagnostics(view,records).some(d=>d.code==='DDN-SERVICE-PORT'),false);records.find(r=>r.record.role==='core::Port').record.metadata.x_service.kind='request';assert.equal(completeProfileDiagnostics(view,records).some(d=>d.code==='DDN-SERVICE-PORT'),true);
});
test('semantic selection exclusions override authored appearances consistently',async()=>{
 const {indexRecords,completeProfileDiagnostics,nativeProfileDiagnostics}=await import(pathToFileURL(resolve(output,'ddn/packages/profiles/src/index.js')));
 const text=`element A as flow.process\nelement B as flow.process\nrelation Message as bpmn.messageflow\n    with\n        endpoints\n            item\n                definition A\n            item\n                definition B\nview Main as bpmn.process@1\n    with\n        selection.exclude\n            item Message\n        regions\n            item\n                id Pool\n                members\n                    item A\n                    item B\n    use A\n    use B\n    use Message\n`;
 const decoded=language.decodeSources({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});assert.deepEqual(decoded.diagnostics.filter(d=>d.severity==='error'),[]);const records=indexRecords(decoded.normalized),view=records.find(r=>r.owner==='view_definition');assert.deepEqual([...nativeProfileDiagnostics(decoded.normalized,view,records),...completeProfileDiagnostics(view,records)].filter(d=>d.severity==='error'),[]);
});

test('approved public projection materializes only allowlisted fields and keeps safe endpoint relations',()=>{
 const input=structuredClone(original);input.elements[0].properties.description='PRIVATE-CANARY';input.elements[0].fields.push({id:'salary',name:'salary',properties:{classification:'restricted'}});
 input.view.profiles.export={mode:'redacted',title:'Approved directory',elements:input.elements.map(e=>({$ref:e.id})),fields:[{$ref:'sample::sales.customer.id'},{$ref:'sample::sales.order.customer'}],properties:['kind'],identifier_mode:'opaque'};
 const doc=convertGraph({resolved:input}),encoded=JSON.stringify(doc);
 assert.doesNotMatch(encoded,/PRIVATE-CANARY|salary|sample::sales.customer|sample::sales.order/);
 assert.equal(doc.definitions.filter(d=>d.role==='field').length,2);assert.equal(doc.definitions.filter(d=>d.category==='relation').length,1);assert.equal(doc.views[0].title,'Approved directory');
 assert.equal(input.elements[0].fields.length,2,'private input remains intact');
});
test('collapsed legacy depth becomes title-only appearances and auto layouts remain explicit',()=>{
 const input=structuredClone(original);input.view.profiles.display={fields:'names',depth:0};input.view.profiles.layout={algorithm:'auto',direction:'down'};
 const doc=convertGraph({resolved:input});assert.equal(doc.views[0].layout.algorithm,'auto');assert.equal(doc.views[0].layout.direction,'down');
 assert.ok(doc.appearances.filter(a=>doc.definitions.find(d=>d.id===a.target.id)?.category==='element').every(a=>a.body==='title'));
});

test('decoding a projected field table preserves explicit nested field ownership',async()=>{
 const input=structuredClone(original),customer=input.elements[0],address=customer.id+'.address',street=address+'.street';customer.fields.push({id:address,name:'address',properties:{shape:'object'}},{id:street,name:'street',parent:address,properties:{datatype:'text'}});
 const runtime=createRuntime(createCompleteRuntimeOptions());try{
  const opened=await runtime.open({entry:'main.ddn',files:[{id:'main.ddn',text:sourceFor(convertGraph({resolved:input})),revision:'1',encoding:'utf-8',writable:true}]});assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const field=opened.snapshot.normalized.files[0].document.definitions.find(d=>d.id===street);assert.equal(field.content.parent.id,address);
 }finally{runtime.destroy();}
});
