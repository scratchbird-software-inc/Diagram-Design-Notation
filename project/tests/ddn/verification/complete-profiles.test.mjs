import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/ddn');
const mod=async name=>import(pathToFileURL(path.join(build,'ddn/packages',name,'src/index.js')));
const profiles=await mod('profiles');
const {createCompletePack,createNativePack,completeProfileIds,getProfile,indexRecords,validateSchema,nativeProfileDiagnostics,completeProfileDiagnostics,analyzeDecision,evaluateDecision,evaluateFlatTrace,calculateCriticalPath}=profiles;
const {createVerifier}=await mod('verifier');
const {fingerprint}=await mod('execution');
const {resolve}=await mod('defaults');
const contracts=JSON.parse(readFileSync('standard/codex/profile-contracts.json','utf8'));
const ref=id=>({file:'main.ddn',id});
const node=(id,role,metadata={},rest={})=>({id,name:id,category:'element',role,metadata,...rest});
const edge=(id,role,from,to,metadata={},rest={})=>({id,name:id,category:'relation',role,endpoints:[{definition:ref(from)},{definition:ref(to)}],metadata,...rest});
function fixture(profile,definitions=[],options={},viewExtra={},data=[]){
 const view={id:'diagram',name:'Diagram',profile,...viewExtra,...(Object.keys(options).length?{projection:{options}}:{})};
 const normalized={version:'ddn-next-1',entry:'main.ddn',files:[{location:'main.ddn',document:{version:'ddn-next-1',workarea:{id:'work',method:'ddn',allow_foreign_views:true},views:[view],definitions,appearances:definitions.map((n,i)=>({id:'a'+i,parent:ref('diagram'),target:ref(n.id)})),...(data.length?{data}:{})}}]};
 const records=indexRecords(normalized);const selected=records.find(r=>r.owner==='view_definition');
 return {normalized,view:selected,records,check:(review=true)=>[...nativeProfileDiagnostics(normalized,selected,records,review),...completeProfileDiagnostics(selected,records,review)]};
}
const codes=report=>report.map(d=>d.code);
const errors=report=>report.filter(d=>d.severity==='error');
const valid=f=>assert.deepEqual(errors(f.check()),[]);
const has=(f,code)=>assert.ok(codes(f.check()).includes(code),JSON.stringify(f.check()));

test('complete pack contains exact adopted152descriptors and preserves native edition isolation',()=>{
 assert.equal(completeProfileIds.length,152); assert.deepEqual(completeProfileIds,Object.keys(contracts));
 assert.equal(createCompletePack().manifest.id,'ddn-complete');assert.equal(createNativePack().manifest.profiles.length,4);
 const pack=createCompletePack();assert.equal(pack.registrations.rules.length,152);
 for(const id of completeProfileIds){
  const p=getProfile(id),c=contracts[id],context=contracts[c.external_context_profile],relations=contracts[c.external_relation_profile];
  const contextRoles=context?[...new Set([...c.context_roles,...context.primary_palette,...context.context_roles])].filter(role=>!c.primary_palette.includes(role)):c.context_roles;
  const relationRoles=relations?[...new Set([...c.relation_roles,...relations.relation_roles])]:c.relation_roles;
  assert.deepEqual(p.primary_palette,c.primary_palette,id);assert.deepEqual(p.context_roles,contextRoles,id);assert.deepEqual(p.relation_roles,relationRoles,id);assert.deepEqual(p.defaults,c.defaults,id);assert.equal(p.scope,c.scope,id);assert.equal(p.bounded_analysis,c.bounded_analysis,id);assert.deepEqual(p.rules,c.profile_rules,id);assert.deepEqual(p.metadata_editor_fields,c.metadata_editor_fields,id);
 }
});
for(const id of Object.keys(contracts))test(id+' enforces its nonempty palette, registered endpoints and exact projection shape',()=>{
 const c=contracts[id],first=c.primary_palette[0],definitions=[node('first',first)];
 if(c.relation_endpoint_contracts.length){const contract=c.relation_endpoint_contracts[0],from=contract.source_roles[0],to=contract.target_roles[0];if(from&&to)definitions.push(node('source',from),node('target',to),edge('link',contract.role,'source','target'));}
 const f=fixture(id,definitions);const membership=nativeProfileDiagnostics(f.normalized,f.view,f.records);
 assert.ok(!membership.some(d=>['DDN-PROFILE-ROLE','DDN-PROFILE-RELATION','DDN-RELATION-ENDPOINT'].includes(d.code)),JSON.stringify(membership));
 f.records.find(r=>r.record.id==='first').record.role='unregistered.illegal';assert.ok(nativeProfileDiagnostics(f.normalized,f.view,f.records).some(d=>d.code==='DDN-PROFILE-ROLE'));
 assert.ok(validateSchema('view_definition',{id:'diagram',profile:id,projection:{options:{definitely_unknown:true}}}).length,id);
 assert.ok(!validateSchema(c.projection_schema,{}).length,id);
});
test('flow reachability, decision labels and legal cycles are substantive',()=>{
 const nodes=[node('start','flow.start'),node('task','flow.process'),node('decision','flow.decision'),node('end','flow.end')];
 const edges=[edge('one','flow.next','start','task'),edge('two','flow.next','task','decision'),edge('yes','flow.next','decision','end',{x_diagram:{branch:'yes'}}),edge('no','flow.next','decision','task',{x_diagram:{branch:'no'}})];
 valid(fixture('flow.basic@1',[...nodes,...edges]));has(fixture('flow.basic@1',[...nodes,...edges.filter(e=>e.id!=='yes')]),'DDN-FLOW-BRANCH');has(fixture('flow.basic@1',[...nodes,...edges,node('isolated','flow.process')]),'DDN-FLOW-REACHABILITY');
});
test('DFD requires process numbers and prohibits store/external bypass',()=>{
 valid(fixture('dfd.gane_sarson@1',[node('actor','dfd.external'),node('process','dfd.process',{x_diagram:{number:'1'}}),node('store','dfd.store'),edge('in','dfd.data','actor','process'),edge('out','dfd.data','process','store')]));
 has(fixture('dfd.yourdon@1',[node('actor','dfd.external'),node('store','dfd.store'),edge('bad','dfd.data','actor','store')]),'DDN-DFD-BYPASS');
});
test('tree and family structures enforce their distinct parent limits',()=>{
 const f=fixture('org.tree@1',[node('manager','person'),node('report','person'),edge('manages','assoc','manager','report')]);
 assert.ok(!codes(f.check()).includes('DDN-TREE-CYCLE'));
 const cyclic=fixture('family.tree@1',[node('a','family.person'),node('b','family.person'),edge('ab','family.parent','a','b'),edge('ba','family.parent','b','a')]);has(cyclic,'DDN-FAMILY-CYCLE');
});
test('Petri arcs validate bipartite endpoints and metadata ownership',()=>{
 const f=fixture('petri.basic@1',[node('p','petri.place',{x_petri:{tokens:2}}),node('t','petri.transition'),edge('e','petri.arc','p','t',{x_petri:{weight:2}})]);valid(f);
 has(fixture('petri.basic@1',[node('t','petri.transition',{x_petri:{tokens:1}})]),'DDN-PETRI-OWNER');
 assert.ok(validateSchema('definition',node('p','petri.place',{x_petri:{tokens:-1}})).length);
});
test('profile defaults apply only to applicable semantic owners',()=>{
 assert.equal(resolve({role:'petri.place'},'definition',{profile:'petri.basic@1'}).values.metadata.x_petri.tokens,0);
 assert.equal(resolve({role:'petri.transition'},'definition',{profile:'petri.basic@1'}).values.metadata?.x_petri,undefined);
 assert.equal(resolve({role:'ladder.contact'},'definition',{profile:'ladder.basic@1'}).values.metadata.x_contact.form,'no');
 assert.equal(resolve({role:'ladder.contact',metadata:{x_contact:{form:'nc'}}},'definition',{profile:'ladder.basic@1'}).values.metadata.x_contact.form,'nc');
});
test('critical path forward and backward passes distinguish slack and reject cycles',()=>{
 const tasks=[{id:'a',duration:2},{id:'b',duration:3},{id:'c',duration:1},{id:'d',duration:2}],links=[{id:'ab',from:'a',to:'b'},{id:'ac',from:'a',to:'c'},{id:'bd',from:'b',to:'d'},{id:'cd',from:'c',to:'d'}];
 const result=calculateCriticalPath(tasks,links);assert.equal(result.duration,7);assert.equal(result.tasks.find(t=>t.id==='c').slack,2);assert.deepEqual(result.criticalEdges,['ab','bd']);assert.throws(()=>calculateCriticalPath(tasks,[...links,{id:'da',from:'d',to:'a'}]),/acyclic/);
});
test('bounded decision partition detects overlap, gaps and budget exhaustion without author code',()=>{
 const domains=[{name:'amount',type:'number',min:0,max:10}],rules=[{id:'low',inputs:{amount:{op:'interval',min:0,max:5}},outputs:{result:'low'}},{id:'high',inputs:{amount:{op:'interval',min:5,max:10,include_min:false}},outputs:{result:'high'}}];
 assert.equal(analyzeDecision(domains,rules,{hitPolicy:'unique',coverage:'error'}).outcome,'valid');
 assert.equal(analyzeDecision(domains,[rules[0],{...rules[1],inputs:{amount:{op:'interval',min:5,max:10}}}],{hitPolicy:'unique'}).outcome,'invalid');
 assert.equal(analyzeDecision(domains,[rules[0]],{coverage:'error'}).outcome,'invalid');
 assert.equal(analyzeDecision(domains,rules,{hitPolicy:'unique',budget:1}).outcome,'budget_exceeded');
 assert.deepEqual(evaluateDecision(rules,{amount:7}).matches,['high']);
});
test('flat trace reports actions without invoking them and detects ambiguity',()=>{
 const transitions=[{id:'start',from:'initial',to:'ready'},{id:'next',from:'ready',to:'done',event:'go',actions:[{id:'external-action'}]}];
 const result=evaluateFlatTrace('initial',transitions,[{event:'go'}]);assert.equal(result.state,'done');assert.deepEqual(result.steps[1].actions,[{id:'external-action'}]);assert.equal(evaluateFlatTrace('ready',[...transitions,{id:'duplicate',from:'ready',to:'other',event:'go'}],[{event:'go'}]).outcome,'ambiguous');
});
test('BPMN distinguishes pool-crossing message flow from sequence flow',()=>{
 const definitions=[node('a','flow.process'),node('b','flow.process'),edge('message','bpmn.messageflow','a','b')];
 const regions=[{id:'pool',members:[ref('a'),ref('b')]}];has(fixture('bpmn.basic@1',definitions,{}, {regions}),'DDN-BPMN-MESSAGE-POOL');
 const two=[{id:'one',members:[ref('a')]},{id:'two',members:[ref('b')]}];assert.ok(!codes(fixture('bpmn.basic@1',definitions,{}, {regions:two}).check()).includes('DDN-BPMN-MESSAGE-POOL'));
});
test('timing, sequence anchors and fragment membership preserve declared order',()=>{
 const f=fixture('uml.timing@2',[node('a','object',{x_states:[{at:1,state:'ready'},{at:1,state:'done'}]})]);has(f,'DDN-TIMING-ORDER');
 const s=fixture('uml.sequence@2',[node('a','object',{x_activation:[{from:ref('missing'),to:ref('missing')}]}),node('b','object'),edge('m','uml.message','a','b')]);has(s,'DDN-SEQUENCE-ACTIVATION');
});
test('matrix RACI checks row accountability independently of display',()=>{
 const definitions=[node('task','analysis.task'),node('owner','analysis.role'),node('worker','analysis.role'),edge('a','analysis.assignment','task','owner',{x_assignment:{code:'A'}}),edge('r','analysis.assignment','task','worker',{x_assignment:{code:'R'}})];
 const opts={rows:[ref('task')],columns:[ref('owner'),ref('worker')],relation:'analysis.assignment'};valid(fixture('matrix.raci@1',definitions,opts));
 has(fixture('matrix.raci@1',definitions.filter(d=>d.id!=='r'),opts),'DDN-RACI-ACCOUNTABILITY');
});
test('panels preserve source inclusion identities and reject overlapping cells',()=>{
 const definitions=[node('one','object',{x_record:{row:0,column:0}}),node('two','object',{x_record:{row:0,column:1}})],options={columns:2,panels:[{target:ref('one'),kind:'text'},{target:ref('two'),kind:'text'}]};
 valid(fixture('panels.basic@1',definitions,options));definitions[1].metadata.x_record.column=0;has(fixture('panels.basic@1',definitions,options),'DDN-PANEL-OVERLAP');
});
function chart(profile,rows,options={}) { const columns=[...new Set(rows.flatMap(Object.keys))].map(id=>({id}));return fixture(profile,[],{records:ref('data'),x:'x',y:'y',...options},{},[{id:'data',name:'Data',columns,rows:rows.map(row=>columns.map(column=>row[column.id]??null))}]); }
test('charts reject coercion and mark-specific invalid inputs',()=>{
 valid(chart('chart.basic@1',[{x:'A',y:1},{x:'B',y:2}],{mark:'bar'}));has(chart('chart.basic@1',[{x:'A',y:'2'}]),'DDN-CHART-NUMBER');has(chart('chart.gauge@1',[{x:'A',y:105}],{target:0}),'DDN-GAUGE-RANGE');has(chart('chart.candlestick@1',[{x:'A',open:3,high:2,low:1,close:1}],{open:'open',high:'high',low:'low',close:'close'}),'DDN-CANDLESTICK-OHLC');
 has(chart('chart.calendar@1',[{x:'2026-10-23',y:1},{x:'2026-10-23',y:2}]),'DDN-CALENDAR-DAY');
 has(chart('chart.sankey@1',[{x:'A',y:1,target:'B'},{x:'B',y:1,target:'A'}]),'DDN-SANKEY-CYCLE');
});
test('distribution unknowns and geographic bounds cannot report complete review',()=>{
 has(chart('chart.density@1',[{x:1},{x:1}],{y:undefined}),'DDN-DENSITY-UNKNOWN');has(chart('geo.symbols@1',[{x:181,y:0}],{geography:'map'}),'DDN-GEO-COORDINATE');
});
test('complete verifier executes non-native semantic rules through adopted ABI',async()=>{
 const f=fixture('petri.basic@1',[node('p','petri.place'),node('t','petri.transition'),edge('arc','petri.arc','p','t')]);
 const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{'ddn-complete':'1.0.0'}},scope={kind:'workarea'},snapshot={contract:'ddn-next-1',rootFile:'main.ddn',revision:{model:'r1',sources:{'main.ddn':'r1'},data:{}},versions,normalized:f.normalized,semanticFingerprint:fingerprint(f.normalized),coverage:{scope,complete:true,checked:[],unavailable:[]}};
 const verifier=createVerifier({versions,packs:[createCompletePack()]});const report=await verifier.verifyModel(snapshot,{scope,level:'review',purpose:'design'});assert.equal(report.outcome,'valid',JSON.stringify(report.diagnostics));assert.equal(report.reviewEligible,true);assert.ok(report.ruleVersions['ddn.profile.petri.basic@1']);
 f.normalized.files[0].document.definitions[1].metadata={x_petri:{tokens:2}};const invalid=await verifier.verifyModel({...snapshot,semanticFingerprint:fingerprint(f.normalized)},{scope,level:'review',purpose:'design'});assert.equal(invalid.outcome,'invalid');assert.equal(invalid.reviewEligible,false);
});

test('all152 profile omission defaults remain schema-valid including derived auto bins',()=>{for(const id of completeProfileIds){const values=resolve({id:'view',profile:id},'view_definition',{profile:id}).values;assert.deepEqual(validateSchema('view_definition',values),[],id);}assert.equal(resolve({id:'view',profile:'chart.histogram@1'},'view_definition',{profile:'chart.histogram@1'}).values.projection.options.bin_count,'auto');});

test('all152 empty views permit progressive draft editing',()=>{for(const id of completeProfileIds){const f=fixture(id);assert.deepEqual(errors(f.check(false)),[],id);}});
test('chart gap and skip policies exclude null measurements without coercing them',()=>{for(const missing of ['gap','skip'])valid(chart('chart.basic@1',[{x:'A',y:2.5},{x:'B',y:null},{x:'',y:0}],{mark:'bar',missing}));});

test('typed guard partitions include comparison boundaries and unknown policies are explicit',()=>{
 const domains=[{name:'n',type:'number',min:0,max:10}];
 const rules=[{id:'low',inputs:{},guard:{field:'n',op:'lt',value:5},outputs:{result:'low'}},{id:'high',inputs:{},guard:{field:'n',op:'gte',value:5},outputs:{result:'high'}}];
 assert.equal(analyzeDecision(domains,rules,{hitPolicy:'unique',coverage:'error'}).outcome,'valid');
 const unsupported=evaluateDecision(rules,{n:7},'priority');assert.equal(unsupported.policyEvaluated,false);assert.equal(unsupported.outcome,'unsupported-policy');assert.deepEqual(unsupported.matches,['high']);assert.deepEqual(unsupported.outputs,[]);
 assert.equal(analyzeDecision(domains,[{id:'bad',inputs:{n:{op:'eq',value:20}},outputs:{result:true}}]).outcome,'invalid');
});
test('trace limits, domain facts and expected state are enforced without executing actions',()=>{
 const transitions=[{id:'start',from:'initial',to:'ready'},{id:'finish',from:'ready',to:'done',event:'go',guard:{field:'allowed',op:'eq',value:true},actions:[{id:'declared-action'}]}];
 const options={domains:[{name:'allowed',type:'boolean'}],expectedFinalState:'done'};
 const good=evaluateFlatTrace('initial',transitions,[{event:'go',values:{allowed:true}}],4096,options);assert.equal(good.outcome,'valid');assert.equal(good.expectedMatched,true);assert.equal(good.actionsExecuted,false);
 assert.equal(evaluateFlatTrace('initial',transitions,[{event:'go',values:{allowed:'yes'}}],4096,options).outcome,'invalid-input');
 assert.equal(evaluateFlatTrace('initial',transitions,[{event:'go',values:{allowed:true}}],4096,{...options,expectedFinalState:'ready'}).outcome,'unexpected-final-state');
 assert.equal(evaluateFlatTrace('initial',transitions,Array.from({length:1001},()=>({event:'go'}))).outcome,'limit-exceeded');
});
test('profile analysis exposes declared trace results and verifier rejects wrong expected state',async()=>{
 const f=fixture('state.flat@1',[node('initial','state.initial'),node('ready','state.state'),node('done','state.final'),edge('start','state.transition','initial','ready'),edge('finish','state.transition','ready','done',{x_transition:{event:'go'}})],{traces:[ref('trace')]});
 f.normalized.files[0].document.definitions.push(node('trace','core::Trace',{x_record:{expected:ref('done')}},{content:{events:[ref('event')]}}),node('event','core::Event',{}, {content:{payload:{event:'go',values:{}}}}));
 const result=profiles.analyzeProfile(f.normalized,ref('diagram'));assert.equal(result.kind,'flat-state');assert.equal(result.outcome,'valid');assert.equal(result.actionsExecuted,false);assert.equal(result.results[0].expectedMatched,true);
 f.normalized.files[0].document.definitions.find(n=>n.id==='trace').metadata.x_record.expected=ref('ready');
 const records=indexRecords(f.normalized),view=records.find(r=>r.owner==='view_definition');assert.ok(completeProfileDiagnostics(view,records,true).some(d=>d.code==='DDN-STATE-TRACE'));
});
test('item-level port verification checks its owning profile and connected ports',async()=>{
 const definitions=[node('a','fbd.block',{}, {members:[ref('p')]}),node('b','fbd.block',{}, {members:[ref('q')]}),edge('wire','fbd.wire','a','b',{}, {endpoints:[{definition:ref('a'),member:ref('p')},{definition:ref('b'),member:ref('q')}]})];
 const f=fixture('fbd.basic@1',definitions);f.normalized.files[0].document.definitions.push(node('p','core::Port',{x_fbd:{type:'INT',negated:true}},{content:{owner:ref('a')}}),node('q','core::Port',{x_fbd:{type:'INT'}},{content:{owner:ref('b')}}));
 const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{'ddn-complete':'1.0.0'}},scope={kind:'item',target:ref('p')};
 const snapshot={contract:'ddn-next-1',rootFile:'main.ddn',revision:{model:'r1',sources:{'main.ddn':'r1'},data:{}},versions,normalized:f.normalized,semanticFingerprint:fingerprint(f.normalized),coverage:{scope:{kind:'workarea'},complete:true,checked:[],unavailable:[]}};
 const result=await createVerifier({versions,packs:[createCompletePack()]}).verifyModel(snapshot,{scope,level:'review',purpose:'design'});assert.equal(result.outcome,'invalid');assert.ok(result.diagnostics.some(d=>d.code==='DDN-FBD-NEGATION'),JSON.stringify(result.diagnostics));
});
test('composition markers enforce one composite owner and prevent cycles',()=>{
 const definitions=[node('a','uml.class'),node('b','uml.class'),node('c','uml.class'),edge('ab','uml.association','a','b',{}, {qualifiers:{source:{mark:'filled-diamond'}}}),edge('cb','uml.association','c','b',{}, {qualifiers:{source:{mark:'filled-diamond'}}})];has(fixture('uml.structure@2',definitions),'DDN-COMPOSITION-OWNER');
 definitions[4]=edge('ba','uml.association','b','a',{}, {qualifiers:{source:{mark:'filled-diamond'}}});has(fixture('uml.structure@2',definitions),'DDN-COMPOSITION-CYCLE');
});
test('crows-foot marks use reconciled relation properties',()=>{
 valid(fixture('erd.crowfoot@1',[node('a','entity'),node('b','entity'),edge('ab','assoc','a','b',{}, {properties:{source_mark:'one',target_mark:'zeromany'}})]));
});
test('decision datasets and read-only analysis preserve rule matching identities',()=>{
 const f=fixture('decision.rules@1',[],{inputs:['flag'],records:ref('rules')},{},[{id:'rules',columns:[{id:'inputs'},{id:'outputs'}],rows:[[{flag:true},{answer:'yes'}],[{flag:false},{answer:'no'}]]}]);
 f.normalized.files[0].document.definitions.push(node('flag','domain',{}, {content:{allowed_values:{type:'boolean'}}}));
 const result=profiles.analyzeProfile(f.normalized,ref('diagram'),{flag:false});assert.equal(result.kind,'decision');assert.equal(result.outcome,'valid');assert.deepEqual(result.matching.outputs,[{answer:'no'}]);assert.ok(result.matching.matches[0].endsWith('#1'));
 assert.equal(result.inputs[0].name,'flag');assert.equal(result.inputs[0].type,'boolean');
 for(const values of [{flag:'false'},{flag:null},{},{flag:true,undeclared:2}]){const invalid=profiles.analyzeProfile(f.normalized,ref('diagram'),values);assert.equal(invalid.matching.outcome,'invalid-input');assert.equal(invalid.matching.policyEvaluated,false);assert.deepEqual(invalid.matching.outputs,[]);}
});
test('SysML parametric binding count follows its selected version and actual admitted relations',()=>{
 const nodes=[node('constraint','sysml.constraint'),node('a','sysml.block'),node('b','sysml.block'),node('c','sysml.block')];
 const one=[...nodes,edge('bind_a','assoc','constraint','a')],two=[...one,edge('bind_b','assoc','constraint','b')],three=[...two,edge('bind_c','sysml.flow','constraint','c')];
 assert.ok(!codes(fixture('sysml.parametric@1',two).check()).includes('DDN-PROFILE-INCOMPLETE'));
 has(fixture('sysml.parametric@1',one),'DDN-PROFILE-INCOMPLETE');has(fixture('sysml.parametric@1',three),'DDN-PARAMETRIC-BINDINGS');
 assert.deepEqual(errors(fixture('sysml.parametric@1',one).check(false)),[]);valid(fixture('sysml.parametric@2',one));valid(fixture('sysml.parametric@2',three));
});
test('ORM fact role members and player endpoint ownership are verified',()=>{
 const f=fixture('orm.basic@1',[node('fact','orm.facttype',{x_derive:{text:'derived assertion'}},{members:[ref('role')]}),node('player','orm.entitytype'),edge('plays','orm.plays','fact','player',{}, {endpoints:[{definition:ref('fact'),member:ref('role')},{definition:ref('player')}]})]);
 f.normalized.files[0].document.definitions.push(node('role','field'));
 const records=indexRecords(f.normalized),view=records.find(r=>r.owner==='view_definition');assert.deepEqual(completeProfileDiagnostics(view,records,true),[]);
 has(fixture('orm.basic@1',[node('empty','orm.facttype')]),'DDN-PROFILE-INCOMPLETE');
 const plays=records.find(r=>r.ref.id==='plays');plays.record.endpoints[0].member=ref('player');assert.ok(completeProfileDiagnostics(view,records,true).some(d=>d.code==='DDN-ORM-ROLE-ENDPOINT'));
});
test('generalization sets share their general classifier and enumeration members remain literal',()=>{
 const definitions=[node('a','uml.class'),node('b','uml.class'),node('base','uml.class'),node('other','uml.class'),edge('a_base','uml.generalization','a','base',{x_genset:{name:'types',disjoint:true}}),edge('b_base','uml.generalization','b','base',{x_genset:{name:'types',disjoint:true}})];
 valid(fixture('uml.structure@2',definitions));definitions[5].endpoints[1].definition=ref('other');has(fixture('uml.structure@2',definitions),'DDN-GENERALIZATION-SET');
 const f=fixture('uml.structure@2',[node('enum','uml.enumeration',{}, {members:[ref('literal')]})]);f.normalized.files[0].document.definitions.push(node('literal','field',{x_member:{kind:'operation'}}));const records=indexRecords(f.normalized);assert.ok(completeProfileDiagnostics(records.find(r=>r.owner==='view_definition'),records,true).some(d=>d.code==='DDN-ENUMERATION-MEMBER'));
});
test('direct boxplot methods reject alternate calculation semantics',()=>{
 valid(chart('chart.boxplot@1',[{x:'A',y:1},{x:'A',y:2},{x:'A',y:3}],{quartiles:'linear',whiskers:'iqr'}));has(chart('chart.boxplot@1',[{x:'A',y:1}],{quartiles:'exclusive'}),'DDN-BOXPLOT-METHOD');has(chart('chart.boxplot@1',[{x:'A',y:1}],{whiskers:2}),'DDN-BOXPLOT-METHOD');
});
test('journey grids enforce exact phase rows and bounded emotion records',()=>{
 const definitions=[],panels=[];for(const [column,slug] of ['discover','purchase'].entries())for(const [row,prefix] of ['phase','actions','touchpoints','opportunities'].entries()){const id=prefix+'-'+slug;definitions.push(node(id,'object',{x_record:{row,column}}));panels.push({target:ref(id),kind:'text'});}
 definitions.push(node('emotion','object',{x_record:{phase:'discover',value:4}}),node('emotions','object',{x_record:{row:4,column:0,colspan:2,items:[ref('emotion')]}}));panels.push({target:ref('emotions'),kind:'text'});
 valid(fixture('panels.journey@1',definitions,{columns:2,panels}));definitions.find(n=>n.id==='emotion').metadata.x_record.value=6;has(fixture('panels.journey@1',definitions,{columns:2,panels}),'DDN-JOURNEY-EMOTION');definitions[0].metadata.x_record.row=6;has(fixture('panels.journey@1',definitions,{columns:2,panels}),'DDN-JOURNEY-LAYOUT');
});
test('Venn declared sets match actual shared member references',()=>{
 const definitions=[node('one','object',{x_record:{row:0,column:0,items:[ref('member')]}}),node('two','object',{x_record:{row:0,column:1,items:[ref('member')]}}),node('member','object',{x_sets:['one','two']})],options={columns:2,panels:[{target:ref('one'),kind:'text'},{target:ref('two'),kind:'text'}]};
 valid(fixture('panels.venn@1',definitions,options));definitions[2].metadata.x_sets=['one'];has(fixture('panels.venn@1',definitions,options),'DDN-VENN-MEMBERSHIP');
});
test('matrix heatmap uses explicit or derived domains and rejects out-of-range contributions',()=>{
 const definitions=[node('row','object'),node('column','object'),edge('value','assoc','row','column',{x_record:{value:7}})],options={rows:[ref('row')],columns:[ref('column')],relation:'assoc',value:'metadata.x_record.value',encoding:{mode:'numeric'}};
 valid(fixture('matrix.heatmap@1',definitions,options));has(fixture('matrix.heatmap@1',definitions,{...options,encoding:{mode:'numeric',domain:{min:0,max:5}}}),'DDN-MATRIX-VALUE');has(fixture('matrix.heatmap@1',definitions,{...options,encoding:{mode:'threshold',range:{min:5,max:2}}}),'DDN-MATRIX-THRESHOLD');
});
test('chart applicability follows the effective mark across profile defaults',()=>{
 assert.deepEqual(profiles.chartOptionErrors('chart.histogram@1',{mark:'line',x:'x',y:'y',trend:{method:'linear'}}),[]);
 assert.deepEqual(profiles.chartOptionErrors('chart.basic@1',{mark:'histogram',x:'x',bins:{count:5}}),[]);
 assert.match(profiles.chartOptionErrors('chart.gauge@1',{target:50,trend:{method:'linear'}})[0],/trend/);
 has(chart('chart.basic@1',[{x:'A',y:1}],{mark:'bar',target:2}),'DDN-CHART-OPTION');
});
test('chart completeness and unknown numerical results prevent false review proofs',()=>{
 has(chart('chart.radar@1',[{x:'A',y:1,s:'one'},{x:'B',y:2,s:'one'},{x:'C',y:3,s:'one'},{x:'A',y:2,s:'two'}],{series:'s'}),'DDN-CHART-SERIES-INCOMPLETE');
 has(chart('chart.qq@1',[{x:2},{x:2}],{y:undefined}),'DDN-QQ-UNKNOWN');
 has(chart('chart.densityheatmap@1',[{x:2,y:2},{x:2,y:3}],{x_type:'number'}),'DDN-DENSITYHEATMAP-UNKNOWN');
 has(chart('chart.treemap@1',[{x:'Root',y:2},{x:'Root.Child',y:3}]),'DDN-HIERARCHY-LEAF');
 has(chart('chart.histogram@1',[{x:1},{x:5}],{y:undefined,bins:{min:2,max:4,count:2}}),'DDN-HISTOGRAM-OUTSIDE');
});
test('single flat transitions reject executable text, unresolved actions and invalid typed guards',()=>{
 const definitions=[node('initial','state.initial'),node('ready','state.state'),node('done','state.final'),edge('start','state.transition','initial','ready'),edge('finish','state.transition','ready','done',{x_transition:{event:'go',guard:'run()'}})];
 has(fixture('state.flat@1',definitions),'DDN-STATE-EXECUTABLE-TEXT');definitions[4].metadata.x_transition={event:'go',actions:[ref('missing')]};has(fixture('state.flat@1',definitions),'DDN-STATE-ACTION');
 definitions[4].metadata.x_transition={event:'go',guard:{field:'flag',op:'eq',value:'yes'}};const f=fixture('state.flat@1',definitions,{inputs:['flag']});f.normalized.files[0].document.definitions.push(node('flag','domain',{}, {content:{allowed_values:{type:'boolean'}}}));const records=indexRecords(f.normalized);assert.ok(completeProfileDiagnostics(records.find(r=>r.owner==='view_definition'),records,true).some(d=>d.code==='DDN-STATE-GUARD'));
});
test('retained quality transform schema and defaults are reconciled without aliases',()=>{
 for(const [transform,extra] of [['histogram',{bins:[0,5,10],normalize:'probability',outside:'drop'}],['pareto',{}],['waterfall',{step:'stage',baseline:-2}],['boxplot',{whiskers:'minmax'}]]){
  const source={id:'diagram',profile:'chart.quality@1',projection:{options:{transform,x:'x',y:'y',...extra}}};assert.deepEqual(validateSchema('view_definition',source),[],transform);
  const resolved=resolve(source,'view_definition',{profile:source.profile}).values;
  assert.deepEqual(validateSchema('view_definition',resolved),[],transform);assert.equal(resolved.projection.options.aggregate,undefined);assert.equal(resolved.projection.options.arrangement,undefined);assert.equal(resolved.projection.options.series_missing,undefined);assert.equal(resolved.projection.options.mark,transform==='boxplot'?'boxplot':'bar');
 }
 assert.ok(validateSchema('view_definition',{id:'diagram',profile:'chart.quality@1',projection:{options:{transform:'histogram',outside:'exclude'}}}).length);
});
test('quality histogram boundaries, range handling and authored aggregate are enforced',()=>{
 valid(chart('chart.quality@1',[{y:0},{y:5},{y:10}],{x:undefined,transform:'histogram',bins:[0,5,10]}));
 has(chart('chart.quality@1',[{y:5}],{x:undefined,transform:'histogram',bins:[0,5,5]}),'DDN-TRANSFORM-BINS');
 has(chart('chart.quality@1',[{y:20}],{x:undefined,transform:'histogram',bins:[0,10],outside:'drop'}),'DDN-HISTOGRAM-EMPTY');
 has(chart('chart.quality@1',[{y:5}],{x:undefined,transform:'histogram',bins:[0,10],aggregate:'none'}),'DDN-CHART-OPTION');
});
test('quality Pareto and waterfall enforce totals while preserving negative baselines',()=>{
 valid(chart('chart.quality@1',[{x:'A',y:2},{x:'B',y:3}],{transform:'pareto'}));has(chart('chart.quality@1',[{x:'A',y:-1}],{transform:'pareto'}),'DDN-PARETO-TOTAL');
 const rows=[{x:'First',y:3,stage:'delta'},{x:'Subtotal',y:1,stage:'subtotal'},{x:'Second',y:2,stage:'delta'},{x:'Total',y:3,stage:'total'}];
 valid(chart('chart.quality@1',rows,{transform:'waterfall',step:'stage',baseline:-2}));rows[3].y=4;has(chart('chart.quality@1',rows,{transform:'waterfall',step:'stage',baseline:-2}),'DDN-WATERFALL-TOTAL');
});
test('quality boxplot transform admits minmax while direct boxplot keeps Tukey bounds',()=>{
 valid(chart('chart.quality@1',[{x:'A',y:1},{x:'A',y:10}],{transform:'boxplot',mark:'boxplot',whiskers:'minmax'}));
 has(chart('chart.quality@1',[{x:'A',y:1}],{transform:'boxplot',mark:'boxplot',series:'group'}),'DDN-CHART-OPTION');
 assert.deepEqual(profiles.chartOptionErrors('chart.quality@1',{mark:'line',arrangement:'overlay'}),[]);
});
test('matrix explicit category and band domains cover the complete retained bounds',()=>{
 const definitions=[node('row','object'),node('column','object'),edge('value','assoc','row','column',{x_record:{value:7}})],base={rows:[ref('row')],columns:[ref('column')],relation:'assoc',value:'metadata.x_record.value'};
 valid(fixture('matrix.heatmap@1',definitions,{...base,encoding:{mode:'threshold',boundaries:[0,3,6,9,12],scale:'diverging'}}));
 has(fixture('matrix.heatmap@1',definitions,{...base,encoding:{mode:'threshold',boundaries:[0,8,7]}}),'DDN-MATRIX-THRESHOLD');has(fixture('matrix.heatmap@1',definitions,{...base,encoding:{mode:'threshold',boundaries:[0,5]}}),'DDN-MATRIX-VALUE');
 valid(fixture('matrix.heatmap@1',definitions,{...base,encoding:{mode:'categorical',labels:[7,8,9]}}));has(fixture('matrix.heatmap@1',definitions,{...base,encoding:{mode:'categorical',labels:[1,2]}}),'DDN-MATRIX-CATEGORIES');
 assert.ok(validateSchema('view_definition',{id:'view',profile:'matrix.heatmap@1',projection:{options:{encoding:{labels:['A','A']}}}}).length);
});
test('link target bindings remain distinct from numeric gauge targets',()=>{
 const f=chart('chart.sankey@1',[{x:'A',y:3,peer:'B'}],{target:'peer'});valid(f);assert.deepEqual(validateSchema('bundle',f.normalized),[]);has(chart('chart.sankey@1',[{x:'A',y:3,peer:'B'}],{target:50}),'DDN-CHART-LINK');has(chart('chart.gauge@1',[{x:'A',y:50}],{target:'peer'}),'DDN-GAUGE-RANGE');
 assert.deepEqual(validateSchema('view_definition',{id:'view',profile:'geo.outline@1',projection:{options:{method:'equalEarth'}}}),[]);
});
test('timeline holidays, impossible calendar dates, dependency identities and span bounds are verified',()=>{
 const definitions=[node('event','object',{x_record:{start:'2026-10-23',end:'2026-10-26'}})],options={records:[ref('event')],start:'start',end:'end',calendar:'business',timezone:'America/Toronto'};
 const f=fixture('timeline.basic@1',definitions,options,{calendar:{holidays:['2026-10-23']}});valid(f);assert.deepEqual(validateSchema('view_definition',f.view.record),[]);
 has(fixture('timeline.basic@1',definitions,options,{calendar:{holidays:['2026-02-30']}}),'DDN-TIMELINE-HOLIDAYS');
 has(fixture('timeline.basic@1',definitions,{...options,dependencies:[ref('event')]}),'DDN-TIMELINE-DEPENDENCY');
 definitions[0].metadata.x_record.start='2026-02-30T12:00:00Z';has(fixture('timeline.basic@1',definitions,options),'DDN-TIMELINE-DATE');definitions[0].metadata.x_record={start:'1000-01-01',end:'3000-01-01'};has(fixture('timeline.basic@1',definitions,options),'DDN-TIMELINE-RANGE');
 assert.ok(validateSchema('view_definition',{id:'view',profile:'timeline.basic@1',calendar:{holidays:['2026-10-23','2026-10-23']}}).length);
});
test('direct histogram step and cross-profile layers have effective-operation admission',()=>{
 valid(chart('chart.histogram@1',[{x:0},{x:10}],{y:undefined,step:2}));has(chart('chart.histogram@1',[{x:0},{x:10}],{y:undefined,step:3}),'DDN-HISTOGRAM-BINS');has(chart('chart.histogram@1',[{x:0},{x:10}],{y:undefined,bins:[0,5,10]}),'DDN-HISTOGRAM-BINS');
 assert.deepEqual(profiles.chartOptionErrors('chart.basic@1',{mark:'bar',layers:[{mark:'point'}],size:'size',trend:{method:'linear'}}),[]);
});
test('geographic verification follows the effective mark rather than its default profile',()=>{
 has(chart('geo.outline@1',[{x:181,y:20}],{mark:'symbol',geography:'map'}),'DDN-GEO-COORDINATE');
 valid(fixture('geo.symbols@1',[],{mark:'outline',geography:'map'}));
});
test('invalid or unresolved declared decision domains cannot disappear from analysis',()=>{
 const f=fixture('decision.rules@1',[node('row','rule.row',{x_rule:{inputs:{},outputs:{result:true}}})],{inputs:['flag','missing']});f.normalized.files[0].document.definitions.push(node('flag','domain',{}, {content:{allowed_values:{type:'boolean'}}}));
 const result=profiles.analyzeProfile(f.normalized,ref('diagram'));assert.equal(result.outcome,'invalid');assert.equal(result.inputs.length,2);
});
test('declared decision output keys constrain matching and cannot be silently renamed',()=>{
 const f=fixture('decision.rules@1',[node('row','rule.row',{x_rule:{inputs:{},outputs:{wrong:true}}})],{inputs:['flag'],outputs:['answer']});f.normalized.files[0].document.definitions.push(node('flag','domain',{}, {content:{allowed_values:{type:'boolean'}}}));
 const result=profiles.analyzeProfile(f.normalized,ref('diagram'),{flag:true});assert.equal(result.outcome,'invalid');assert.equal(result.matching.outcome,'invalid-contract');assert.deepEqual(result.matching.outputs,[]);
});
test('typed core Port notation uses its payload schema and core render defaults',async()=>{
 const {decodeSources}=await mod('language'),{validateProperty,resolveProperties}=await mod('defaults');
 const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{'ddn-complete':'1.0.0'}};
 for(const [profile,role] of [['uml.composite@1','uml.component'],['soaml.services@1','soaml.participant']]){
  const text=`workarea Workspace as ddn\nview Ports as ${profile}\n    element Device as ${role}\n        with\n            members\n                item Output\nelement Output as core::Port\n    with\n        content.owner Device\n        content.direction output\n`;
  const input={entry:'main.ddn',files:[{id:'main.ddn',text,revision:'r1',encoding:'utf-8',writable:true}]},decoded=decodeSources(input);assert.equal(decoded.syntaxValid,true,JSON.stringify(decoded.diagnostics));
  const port=indexRecords(decoded.normalized).find(record=>record.record.name==='Output');assert.equal(port.record.content.direction,'output');assert.deepEqual(validateProperty('definition','content',port.record.content,{role:'core::Port'}),[]);assert.ok(validateProperty('definition','content.direction','sideways',{role:'core::Port'}).length);
  const report=await createVerifier({versions,packs:[createCompletePack()]}).verifySources(input,{scope:{kind:'workarea'},level:'review',purpose:'design'});assert.equal(report.outcome,'valid',JSON.stringify(report.diagnostics));assert.equal(report.reviewEligible,true);
  const defaults=resolve(port.record,'definition',{profile});assert.deepEqual(defaults.diagnostics,[]);
  const rendered=resolve({},'appearance',{role:'core::Port'}).values;assert.equal(rendered.symbol.color,profiles.coreDescriptor('EL11').render.stroke);
 }
});
test('core type review checks the adopted completion schema',async()=>{
 const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{'ddn-complete':'1.0.0'}},text='erd Surface\nelement Notice as core::Event\n';
 const report=await createVerifier({versions,packs:[createCompletePack()]}).verifySources({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'r1',encoding:'utf-8',writable:true}]},{scope:{kind:'workarea'},level:'review',purpose:'design'});
 assert.equal(report.outcome,'incomplete');assert.equal(report.reviewEligible,false);assert.ok(report.diagnostics.some(d=>d.code==='DDN-COMPLETENESS'&&d.message.includes('form')));
});
