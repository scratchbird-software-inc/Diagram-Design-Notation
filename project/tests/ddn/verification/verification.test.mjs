import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/ddn');
const mod=async name=>import(pathToFileURL(path.join(build,'ddn/packages',name,'src/index.js')));
const {createVerifier}=await mod('verifier');
const {createNativePack,indexRecords,validateSchema}=await mod('profiles');
const {resolve,resolveProperties,validateProperty,parseStylesheet,allocateColumnPercentages}=await mod('defaults');
const {decodeSources}=await mod('language');
const {fingerprint}=await mod('execution');
const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{'ddn-native':'1.0.0'}};
const runtime=()=>({versions,packs:[createNativePack()]});
const options={scope:{kind:'workarea'},level:'review',purpose:'design'};
const source=(text,id='main.ddn')=>({id,text,revision:'r1',encoding:'utf-8',writable:true});
const sources=(text,files=[])=>({entry:'main.ddn',files:[source(text),...files]});
const simple='erd Sales\n    Customer\n    Order\n    connect Customer to Order\n';
function snapshot(input=sources(simple)) {const d=decodeSources(input);assert.equal(d.syntaxValid,true,JSON.stringify(d.diagnostics));return {contract:'ddn-next-1',rootFile:input.entry,revision:{model:'r1',sources:Object.fromEntries(input.files.map(f=>[f.id,f.revision])),data:{}},versions,normalized:d.normalized,semanticFingerprint:fingerprint(d.normalized),coverage:d.coverage};}
const refresh=s=>({...s,semanticFingerprint:fingerprint(s.normalized)});
const named=(s,name)=>indexRecords(s.normalized).find(r=>r.record.name===name);
const errors=r=>JSON.stringify(r.diagnostics);

test('native conceptual name-only ERD is valid and source/model checks agree',async()=>{
 const v=createVerifier(runtime());const input=sources(simple);const a=await v.verifySources(input,options),b=await v.verifyModel(snapshot(input),options);
 assert.equal(a.outcome,'valid',errors(a));assert.equal(a.reviewEligible,true);assert.deepEqual(a.diagnostics,b.diagnostics);assert.equal(a.dependencyFingerprint,b.dependencyFingerprint);
 assert.ok(a.ruleVersions['ddn.native.ddn@1']);assert.ok(a.coverage.checked.length>=7);
});
test('draft body and incomplete work can pass structure but block review',async()=>{
 const v=createVerifier(runtime());const s=snapshot(sources('erd Draft\n    Idea\n        draft fields\n            identifier to discuss\n'));
 const structure=await v.verifyModel(s,{...options,level:'structural'});assert.equal(structure.outcome,'valid',errors(structure));assert.equal(structure.reviewEligible,false);
 const review=await v.verifyModel(s,options);assert.equal(review.outcome,'incomplete',errors(review));assert.equal(review.reviewEligible,false);assert.ok(review.missing.some(x=>x.startsWith('draft:')));
});
test('schema rejects unknown properties, invalid enums and non-finite values',async()=>{
 const v=createVerifier(runtime());
 for(const mutate of [r=>r.unknown=true,r=>r.design={state:'certified'},r=>r.style={font_size:-1},r=>r.style={font_size:Infinity}]){
  const s=snapshot();mutate(named(s,'Customer').record);let candidate;try{candidate=refresh(s);}catch{candidate=s;}
  const r=await v.verifyModel(candidate,options);assert.equal(r.outcome,'invalid',errors(r));assert.equal(r.reviewEligible,false);
 }
 assert.ok(validateProperty('definition','style.font_size',-1).length);assert.ok(validateProperty('definition','unknown',true).length);
});
test('file CSS standard precedence preserves invalid explicit values',()=>{
 const css=parseStylesheet('.method-ddn.subtype-erd.role-entity { --ddn-style-font: mono !important; }');assert.deepEqual(css.diagnostics,[]);
 const context={method:'ddn',subtype:['erd'],role:'entity',styles:css.rules,fileDefaults:[{selector:{owner:'definition',role:'entity'},declarations:{'style.font':'serif'}}]};
 assert.equal(resolve({},'definition',context).values.style.font,'serif');assert.equal(resolve({},'definition',{...context,fileDefaults:[]}).values.style.font,'mono');
 const explicit=resolve({style:{font:'sans',font_size:-1}},'definition',context);assert.equal(explicit.values.style.font,'sans');assert.equal(explicit.values.style.font_size,-1);assert.ok(explicit.diagnostics.length);
 const wrong=resolve({},'definition',{...context,fileDefaults:[],subtype:['chen']});assert.notEqual(wrong.values.style.font,'mono');
});
test('typed filters outrank unfiltered defaults and semantic CSS is rejected',()=>{
 const resolved=resolve({},'definition',{role:'entity',fileDefaults:[{selector:{owner:'definition',role:'entity'},declarations:{'style.font':'serif'}},{selector:{owner:'definition'},declarations:{'style.font':'mono'}}],styles:[{selector:{},declarations:{'design.state':'accepted'}}]});
 assert.equal(resolved.values.style.font,'serif');assert.equal(resolved.values.design.state,'draft');assert.ok(resolved.diagnostics.some(d=>d.code==='DDN-DEFAULT-INELIGIBLE'));
});
test('definition style and view role defaults reach an occurrence without mutating source',()=>{
 const s=snapshot(sources('defaults element as entity\n    font serif\nerd Sales\n    defaults element as entity\n        font mono\n    Customer\n'));const before=JSON.stringify(s.normalized);const occurrence=indexRecords(s.normalized).find(r=>r.owner==='appearance');
 const r=resolveProperties(s,occurrence.ref);assert.equal(r.values.style.font,'mono',errors(r));assert.equal(r.values.body,'title');assert.equal(JSON.stringify(s.normalized),before);
});
test('column percentages use equal auto shares and progressive largest-group capping',()=>{
 assert.deepEqual(allocateColumnPercentages([undefined,undefined]),[50,50]);assert.deepEqual(allocateColumnPercentages([25,null,null]),[25,37.5,37.5]);assert.deepEqual(allocateColumnPercentages([20,20]),[20,80]);assert.deepEqual(allocateColumnPercentages([80,80,20]),[40,40,20]);assert.ok(allocateColumnPercentages([200,100,50]).every(n=>Math.abs(n-100/3)<1e-10));assert.throws(()=>allocateColumnPercentages([-1]),RangeError);
});
test('file-qualified duplicate names work through cyclic includes',async()=>{
 const input=sources('include "sub/other.ddn"\nerd Main\n    Customer\n    connect Customer to "sub/other.ddn"::Customer\n',[source('include "../main.ddn"\nelement Customer as entity\n','sub/other.ddn')]);
 const r=await createVerifier(runtime()).verifySources(input,options);assert.equal(r.outcome,'valid',errors(r));
});
test('scope isolation keeps an unrelated invalid draft out of a view review',async()=>{
 const s=snapshot(sources('erd One\n    First\nerd Two\n    Second\n'));named(s,'Second').record.unknown=true;const updated=refresh(s);const v=createVerifier(runtime());
 const local=await v.verifyModel(updated,{...options,scope:{kind:'view',target:named(s,'One').ref}});assert.equal(local.outcome,'valid',errors(local));assert.ok(local.coverage.checked.some(r=>r.id===named(s,'One').ref.id));assert.ok(local.coverage.checked.some(r=>r.id===named(s,'First').ref.id));assert.ok(!local.coverage.checked.some(r=>r.id===named(s,'Second').ref.id));
 assert.equal((await v.verifyModel(updated,options)).outcome,'invalid');
});
test('native relation endpoints enforce role compatibility and member ownership',async()=>{
 const s=snapshot();const edge=indexRecords(s.normalized).find(r=>r.record.category==='relation');edge.record.endpoints[0].member=named(s,'Order').ref;
 const r=await createVerifier(runtime()).verifyModel(refresh(s),options);assert.equal(r.outcome,'invalid');assert.ok(r.diagnostics.some(d=>d.code==='DDN-MEMBER-ENDPOINT'));
});
test('mindmap cycles are checked even when verifying one node',async()=>{
 const s=snapshot(sources('mindmap Map\n    Root\n        Child\n'));const records=indexRecords(s.normalized),view=named(s,'Map'),root=named(s,'Root'),child=named(s,'Child');const doc=s.normalized.files[0].document;
 const edge={id:'cycle',category:'relation',role:'assoc',endpoints:[{definition:child.ref},{definition:root.ref}]};doc.definitions.push(edge);doc.appearances.push({id:'cycle-appearance',target:{file:'main.ddn',id:'cycle'},parent:view.ref});
 const r=await createVerifier(runtime()).verifyModel(refresh(s),{...options,scope:{kind:'item',target:child.ref}});assert.equal(r.outcome,'invalid',errors(r));assert.ok(r.diagnostics.some(d=>d.code==='DDN-MINDMAP-CYCLE'));
});
test('missing profile packs and unknown purposes remain unsupported',async()=>{
 const s=snapshot();named(s,'Sales').record.profile='chen.basic@1';const v=createVerifier(runtime());const r=await v.verifyModel(refresh(s),options);assert.equal(r.outcome,'unsupported',errors(r));assert.ok(r.missing.includes('profile:chen.basic@1'));
 const purpose=await v.verifyModel(snapshot(),{...options,purpose:'regulated-release-certification'});assert.equal(purpose.outcome,'unsupported');assert.equal(purpose.reviewEligible,false);
});
test('trusted installed rule callbacks contribute failure and coverage',async()=>{
 const opts=runtime();let invoked=false;opts.packs.push({manifest:{id:'check',version:'1',api:'1.0',hash:'test',languages:['ddn-next-1'],defaults:['ddn-next-1'],profiles:[],dependencies:['ddn-native'],capabilities:[]},registrations:{rules:[{id:'example-rule',version:'1',profiles:['ddn@1'],levels:['review'],purposes:['design'],readPaths:['name'],globalScope:false,async evaluate(input,o){invoked=true;return {outcome:'incomplete',diagnostics:[],dependencies:[],coverage:{scope:o.scope,complete:false,checked:[],unavailable:['external-evidence']}};}}]}});
 const r=await createVerifier(opts).verifyModel(snapshot(),options);assert.equal(invoked,true);assert.equal(r.outcome,'incomplete');assert.ok(r.missing.includes('external-evidence'));
});
test('lifecycle transition matrix requires current evidence and explicit grants',async()=>{
 const s=snapshot();named(s,'Customer').record.design={state:'in-progress'};const current=refresh(s),v=createVerifier(runtime()),target=named(s,'Customer').ref;const report=await v.verifyModel(current,{...options,scope:{kind:'item',target}});
 assert.equal(report.reviewEligible,true,errors(report));assert.equal((await v.checkTransition(current,{target,from:'in-progress',to:'in-review',report,grants:['lifecycle.review']})).allowed,true);
 assert.equal((await v.checkTransition(current,{target,from:'in-progress',to:'in-review',report,grants:[]})).allowed,false);
 assert.equal((await v.checkTransition(current,{target,from:'in-progress',to:'accepted',report,grants:['lifecycle.accept'],acceptance:{user:'owner',timestamp:'2026-10-23T12:30:00Z',authorityContext:'local'}})).allowed,false);
 const stale={...report,dependencyFingerprint:'old'};assert.equal((await v.checkTransition(current,{target,from:'in-progress',to:'in-review',report:stale,grants:['lifecycle.review']})).allowed,false);
});
test('acceptance attribution rejects malformed dates and reopening requires authority',async()=>{
 const s=snapshot();const target=named(s,'Customer').ref;named(s,'Customer').record.design={state:'in-review'};const current=refresh(s),v=createVerifier(runtime()),report=await v.verifyModel(current,{...options,scope:{kind:'item',target}});
 const transition={target,from:'in-review',to:'accepted',report,grants:['lifecycle.accept'],acceptance:{user:'owner',timestamp:'2026-10-23T12:30:00Z',authorityContext:'local'}};
 assert.equal((await v.checkTransition(current,transition)).allowed,true);assert.equal((await v.checkTransition(current,{...transition,acceptance:{...transition.acceptance,timestamp:'2026-02-30T12:30:00Z'}})).allowed,false);
 named(s,'Customer').record.design.state='accepted';named(s,'Customer').record.acceptance={at:'2026-10-23T12:30:00Z',by:{id:'owner'}};const accepted=refresh(s);assert.equal((await v.checkTransition(accepted,{target,from:'accepted',to:'in-progress',grants:[]})).allowed,false);assert.equal((await v.checkTransition(accepted,{target,from:'accepted',to:'in-progress',grants:['lifecycle.reopen']})).allowed,true);
});
test('cancel budgets disposed handles and stale measurements never authorize review',async()=>{
 const v=createVerifier(runtime()),s=snapshot();
 assert.equal((await v.verifyModel(s,{...options,cancel:{aborted:true,onAbort:()=>()=>{}}})).outcome,'cancelled');
 assert.equal((await v.verifyModel(s,{...options,budget:{elapsedMs:1000,workUnits:1,memoryBytes:1e7}})).outcome,'budget-exceeded');
 assert.equal((await v.verifyModel(s,{...options,budget:{elapsedMs:1000,workUnits:1e9,memoryBytes:1}})).outcome,'budget-exceeded');
 const measurement={revision:{...s.revision,model:'old'},versions:s.versions,coverage:s.coverage,metrics:[]};const stale=await v.verifyModel(s,{...options,level:'publication',measurement});assert.equal(stale.outcome,'stale',errors(stale));assert.equal(stale.reviewEligible,false);
 v.destroy();assert.equal((await v.verifyModel(s,options)).outcome,'cancelled');
});
test('cached reports retain scope/version and semantic fingerprints must match',async()=>{
 const v=createVerifier(runtime()),s=snapshot();await v.verifyModel(s,options);const cached=await v.verifyModel(s,options);assert.equal(cached.stats.cacheHits,1);
 assert.equal((await v.verifyModel({...s,semanticFingerprint:'old'},options)).outcome,'invalid');assert.equal((await v.verifyModel({...s,versions:{...versions,defaults:'future'}},options)).outcome,'unsupported');
});

test('fabricated public reports cannot authorize incomplete content',async()=>{
 const s=snapshot(sources('erd Draft\n    Idea\n        draft fields\n            TBD\n'));const target=named(s,'Idea').ref;named(s,'Idea').record.design={state:'in-progress'};const current=refresh(s),v=createVerifier(runtime());
 const report={requestId:'fabricated',outcome:'valid',revision:current.revision,versions,dependencyFingerprint:current.semanticFingerprint,scope:{kind:'item',target},purpose:'review',level:'review',coverage:{scope:{kind:'item',target},complete:true,checked:[target],unavailable:[]},diagnostics:[],missing:[],ruleVersions:{},reviewEligible:true,stats:{elapsedMs:0,workUnits:0,cacheHits:0}};
 assert.equal((await v.checkTransition(current,{target,from:'in-progress',to:'in-review',report,grants:['lifecycle.review']})).allowed,false);
});
test('record table accepts explicit header-only data and rejects missing or non-scalar cells',async()=>{
 const base=snapshot();const view=named(base,'Sales');view.record.profile='table.records@1';view.record.selection={include:[]};base.normalized.files[0].document.appearances=[];view.record.projection={options:{columns:[{id:'name'}],records:[]}};const v=createVerifier(runtime());
 const header=await v.verifyModel(refresh(base),options);assert.equal(header.outcome,'valid',errors(header));
 const data={id:'rows',name:'Data',columns:[{id:'other'}],rows:[[3]]};base.normalized.files[0].document.data=[data];view.record.projection.options.records={file:'main.ddn',id:'rows'};let result=await v.verifyModel(refresh(base),options);assert.equal(result.outcome,'invalid');assert.ok(result.diagnostics.some(d=>d.code==='DDN-TABLE-MISSING'));
 data.columns=[{id:'name'}];data.rows=[[{nested:true}]];result=await v.verifyModel(refresh(base),options);assert.equal(result.outcome,'invalid');assert.ok(result.diagnostics.some(d=>d.code==='DDN-TABLE-SCALAR'));
 data.rows=[[null]];assert.equal((await v.verifyModel(refresh(base),options)).outcome,'valid');
});

test('generated field content uses its exact role schema',async()=>{
 const input=sources('erd Sales\n    Customer\n        Key.int..primary\n        name.varchar(25)\n');const r=await createVerifier(runtime()).verifySources(input,options);assert.equal(r.outcome,'valid',errors(r));
 assert.deepEqual(validateProperty('definition','content.parent',{file:'main.ddn',id:'owner'},{role:'field'}),[]);assert.ok(validateProperty('definition','content.ordinal',-1,{role:'field'}).length);
});

test('source budgets account decoding and source cancellation returns typed reports',async()=>{
 const v=createVerifier(runtime());assert.equal((await v.verifySources(sources(simple),{...options,budget:{elapsedMs:1000,workUnits:1,memoryBytes:1e7}})).outcome,'budget-exceeded');assert.equal((await v.verifySources(sources(simple),{...options,cancel:{aborted:true,onAbort:()=>()=>{}}})).outcome,'cancelled');assert.equal((await v.verifySources(sources(simple),{...options,budget:{elapsedMs:-1,workUnits:1,memoryBytes:1}})).outcome,'invalid');v.destroy();assert.equal((await v.verifySources(sources(simple),options)).outcome,'cancelled');
});

test('record tables derive a positive column limit from dataset headers',async()=>{
 const base=snapshot();const view=named(base,'Sales');view.record.profile='table.records@1';view.record.selection={include:[]};base.normalized.files[0].document.appearances=[];base.normalized.files[0].document.data=[{id:'rows',name:'Rows',columns:[{id:'a'},{id:'b'}],rows:[[1,2]]}];view.record.projection={options:{columns:1,records:{file:'main.ddn',id:'rows'}}};
 const result=await createVerifier(runtime()).verifyModel(refresh(base),options);assert.equal(result.outcome,'valid',errors(result));assert.ok(result.coverage.checked.some(r=>r.id==='rows'));
});

test('identified embedded notes participate in file identity and scoped coverage',async()=>{
 const input=sources('erd Main\n    Customer\n        notes Detail : ##Detail\n            explanation\n');const s=snapshot(input),v=createVerifier(runtime()),note=named(s,'Detail');assert.ok(note);const local=await v.verifyModel(s,{...options,scope:{kind:'item',target:note.ref}});assert.equal(local.outcome,'valid',errors(local));assert.ok(local.coverage.checked.some(r=>r.id===note.ref.id));
 const customer=named(s,'Customer');customer.record.notes.push({...note.record,id:'second-note'});const duplicate=await v.verifyModel(refresh(s),options);assert.equal(duplicate.outcome,'invalid');assert.ok(duplicate.diagnostics.some(d=>d.code==='DDN-NAME-DUPLICATE'));
});

test('physical-schema completeness reads declared row types without requiring them in conceptual design',async()=>{
 const v=createVerifier(runtime());const complete=await v.verifySources(sources('erd Sales\n    Customer\n        id.int\n        name.varchar(25)\n'),{...options,purpose:'physical-schema'});assert.equal(complete.outcome,'valid',errors(complete));
 const incomplete=await v.verifySources(sources('erd Sales\n    Customer\n        id\n'),{...options,purpose:'physical-schema'});assert.equal(incomplete.outcome,'incomplete');assert.equal((await v.verifySources(sources('erd Sales\n    Customer\n        id\n'),options)).outcome,'valid');
});

test('publication does not claim an unavailable document adapter from metrics alone',async()=>{
 const s=snapshot(sources('erd Main\n    Customer\ndocument Report as pdf\n    use Main\n'));const target=named(s,'Report').ref;const measurement={fingerprint:'measured',revision:s.revision,versions:s.versions,fontGeneration:'1',coverage:s.coverage,measurements:{}};const v=createVerifier(runtime());
 const result=await v.verifyModel(s,{scope:{kind:'document',target},level:'publication',purpose:'design',measurement});assert.equal(result.outcome,'unsupported',errors(result));assert.ok(result.missing.includes('output:pdf'));assert.equal(result.reviewEligible,false);
 const native=snapshot();const absent=await v.verifyModel(native,{...options,level:'publication',measurement:{...measurement,revision:native.revision,coverage:native.coverage}});assert.equal(absent.outcome,'incomplete');assert.ok(absent.missing.includes('publication-output-format'));
});

test('retained draft text does not block converted structured data or depend on body display',async()=>{
 const input=sources('erd Design\n    Customer\n        draft fields\n            id\n            name\n        data\n            field.type\n            id.int\n            name.varchar(25)\n');const s=snapshot(input),v=createVerifier(runtime()),customer=named(s,'Customer');
 const occurrence=indexRecords(s.normalized).find(r=>r.owner==='appearance'&&r.record.target.id===customer.ref.id);occurrence.record.body='draft';
 const converted=await v.verifyModel(refresh(s),{...options,scope:{kind:'item',target:customer.ref}});assert.equal(converted.outcome,'valid',errors(converted));assert.equal(converted.reviewEligible,true);assert.ok(converted.coverage.checked.some(r=>r.id===customer.ref.id));assert.equal(customer.record.draft.text,'id\nname');
 customer.record.incomplete=[{path:'draft',raw:'',reason:'Draft editing is pending'}];occurrence.record.body='columns';const pending=await v.verifyModel(refresh(s),{...options,scope:{kind:'item',target:customer.ref}});assert.equal(pending.outcome,'incomplete',errors(pending));assert.equal(pending.reviewEligible,false);assert.ok(pending.missing.some(value=>value.startsWith('content:')));
 delete customer.record.incomplete;const completed=await v.verifyModel(refresh(s),{...options,scope:{kind:'item',target:customer.ref}});assert.equal(completed.outcome,'valid',errors(completed));assert.equal(completed.reviewEligible,true);
});
