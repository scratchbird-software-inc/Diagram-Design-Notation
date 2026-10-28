import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGraphFixture } from './graph-profiles.fixtures.mjs';
const output=process.env.DDN_BUILD_ROOT??resolve('.work/builds/ddn');
const load=file=>import(pathToFileURL(resolve(output,'ddn/packages',file)));
const {records}=await load('presentation/src/model.js');
const {projectGraphProfile}=await load('presentation/src/graph-profiles.js');
const {graphLayout}=await load('presentation/src/graph-layouts.js');
const {nodeGlyph}=await load('presentation/src/graph-glyphs.js');
const {isometricGraph}=await load('presentation/src/graph-isometric.js');
const {roleDescriptor}=await load('profiles/src/index.js');
const texts=entry=>entry.item.primitives.filter(p=>p.kind==='text').flatMap(p=>p.runs.map(r=>r.text));
const allTexts=result=>result.entries.flatMap(texts);
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function render(fixture,options={}){
 const all=records(fixture.snapshot),view=all.find(r=>r.owner==='view'&&r.ref.id===fixture.view.id),selected=new Set(fixture.view.selection.include.map(r=>r.id));
 const entries=all.filter(r=>r.owner==='definition'&&selected.has(r.ref.id)).map((definition,index)=>{
  const appearance=all.find(r=>r.owner==='appearance'&&r.record.target?.id===definition.ref.id),position=appearance?.record.position??{},size=appearance?.record.size??{},bounds={x:position.x??32+index%3*300,y:position.y??64+Math.floor(index/3)*220,width:size.width??248,height:size.height??72},occurrence='review:'+definition.ref.id;
  return {definition,view,...(appearance?{appearance}:{}),effective:{...definition.record,...options.effective},...(options.propertyOrigins?{propertyOrigins:options.propertyOrigins}:{}),item:{occurrence,target:definition.ref,view:view.ref,layer:definition.record.category==='relation'?'relations':'content',bounds,transform:[1,0,0,1,0,0],primitives:[],hitTargets:[{id:occurrence,target:definition.ref,bounds}],accessible:{role:'graphics-symbol',label:definition.record.name},evidence:'current'}};
 });
 return projectGraphProfile(fixture.snapshot,view,entries,{bounds:{x:0,y:0,width:960,height:680},...options});
}
function custom(profile,nodes,edges=[]){const f=createGraphFixture(profile==='ddn@1'?'uml.structure@2':profile);f.view.profile=profile;f.definitions.splice(0,f.definitions.length,...nodes,...edges);f.view.selection.include=f.definitions.map(d=>({id:d.id}));return f;}
const node=(id,role='uml.class',extra={})=>({id,name:id,category:'element',role,...extra});
const edge=(id,from,to,role='uml.association',extra={})=>({id,name:id,category:'relation',role,endpoints:[{definition:{id:from}},{definition:{id:to}}],...extra});

test('hierarchies preserve parent direction, contiguous child subtrees, and centre each parent',()=>{
 const nodes=['root','left','right','l1','l2','r1'].map(id=>({id,bounds:{x:0,y:0,width:200,height:80}})),links=[['root','left'],['root','right'],['left','l1'],['left','l2'],['right','r1']].map(([from,to])=>({from,to}));
 const p=graphLayout(nodes,links,{algorithm:'tree',direction:'down'});
 assert.ok(p.get('root').y<p.get('left').y);assert.ok(p.get('left').y<p.get('l1').y);
 assert.ok(p.get('l2').x<p.get('r1').x);assert.equal(p.get('left').x,(p.get('l1').x+p.get('l2').x)/2);
 for(const direction of ['right','left','up']){const q=graphLayout(nodes,links,{algorithm:'tree',direction});assert.ok(direction==='right'?q.get('root').x<q.get('left').x:direction==='left'?q.get('root').x>q.get('left').x:q.get('root').y>q.get('left').y);}
 for(const profile of ['org.tree@1','fault.tree@1']){const f=custom(profile,[node('parent',profile.startsWith('org')?'org.position':'tree.gate'),node('child',profile.startsWith('org')?'org.position':'tree.event')],[edge('rel','parent','child')]);const rendered=render(f).entries;assert.ok(rendered.find(e=>e.definition.ref.id==='parent').item.bounds.y<rendered.find(e=>e.definition.ref.id==='child').item.bounds.y);}
});
test('mind map keeps first branch on the right and centres both branch sets independently',()=>{
 const p=graphLayout(['root','first','second','third'].map(id=>({id,bounds:{x:0,y:0,width:200,height:80}})),['first','second','third'].map(to=>({from:'root',to})),{algorithm:'mindmap'});
 assert.ok(p.get('first').x>p.get('root').x);assert.ok(p.get('second').x<p.get('root').x);assert.equal(p.get('second').y,p.get('root').y);assert.equal((p.get('first').y+p.get('third').y)/2,p.get('root').y);
});
test('method graph layout respects authored direction and reserves expanded compartments',()=>{
 const f=custom('uml.structure@2',[node('a'),node('b'),node('c')],[edge('ab','a','b'),edge('bc','b','c')]);f.definitions[0].role='uml.class';f.definitions[0].members=[];
 for(let i=0;i<12;i++){const m=node('field'+i,'field',{content:{parent:{id:'a'},type:'text'}});f.definitions.push(m);f.definitions[0].members.push({id:m.id});}
 f.view.layout={algorithm:'layered',direction:'down'};const result=render(f),a=result.entries.find(e=>e.definition.ref.id==='a'),b=result.entries.find(e=>e.definition.ref.id==='b');
 assert.ok(a.item.bounds.height>300);assert.ok(b.item.bounds.y>a.item.bounds.y+a.item.bounds.height);assert.ok(!overlap(a.item.bounds,b.item.bounds));assert.ok(texts(a).includes('ATTRIBUTES'));
});
test('containers enclose their own members without swallowing unrelated nodes',()=>{
 const f=custom('bpmn.basic@1',[node('buyer1','flow.process'),node('seller1','flow.process'),node('buyer2','flow.process')],[edge('a','buyer1','buyer2','uml.flow')]);f.view.layout={algorithm:'layered',direction:'right'};f.view.regions=[{id:'buyer',name:'Buyer',role:'bpmn.pool',members:[{id:'buyer1'},{id:'buyer2'}]},{id:'seller',name:'Seller',role:'bpmn.pool',members:[{id:'seller1'}]}];
 const result=render(f),frame=result.entries.find(e=>e.item.occurrence.endsWith(':region:buyer')).item.bounds,seller=result.entries.find(e=>e.definition.ref.id==='seller1'&&e.item.layer!=='frames').item.bounds;assert.ok(!overlap(frame,seller));
});
test('method palette and silhouettes preserve role distinctions while CSS and file paint win',()=>{
 const f=custom('archimate.basic@1',[node('actor','archi.business_actor'),node('component','archi.application_component'),node('service','archi.technology_service')]);const result=render(f);
 for(const e of result.entries){assert.ok(e.item.primitives.some(p=>'paint'in p&&p.paint.stroke===roleDescriptor(e.definition.record.role).render.colour));}
 assert.ok(result.entries[0].item.primitives.some(p=>p.kind==='ellipse'));assert.ok(result.entries[1].item.primitives.filter(p=>p.kind==='rect').length>=3);
 f.definitions[1].background={color:'#121212'};assert.ok(render(f).entries[1].item.primitives.some(p=>'paint'in p&&p.paint.fill==='#121212'));
 const themed=custom('uaf.security@1',[node('control','uaf.securitycontrol',{symbol:{color:'#ff0022',fill:'#111222'}})]);const e=render(themed,{propertyOrigins:{'symbol.color':'css','symbol.fill':'css'}}).entries[0];assert.ok(e.item.primitives.some(p=>'paint'in p&&p.paint.stroke==='#ff0022'));
});
test('requirements retain identifiers and wrapped prose; classifiers never leak synthetic identifiers',()=>{
 const f=custom('sysml.requirements@1',[node('req','req.requirement',{metadata:{x_diagram:{code:'REQ-17',text:'The system shall preserve all authored evidence and make every verification result readable before acceptance.'}}})]);const t=allTexts(render(f));assert.ok(t.includes('REQ-17'));assert.ok(t.join(' ').includes('before acceptance.'));
 const b=custom('sysml.bdd@2',[node('owner','sysml.block',{members:[{id:'member'}]}),node('other','sysml.block')]);b.definitions.push(node('member','field',{metadata:{x_part:{classifier:'declared-classifier:Pump'}}}));const bt=allTexts(render(b)).join(' ');assert.ok(bt.includes('member: Pump'));assert.ok(!bt.includes('declared-classifier:'));assert.ok(!bt.includes('<item>'));
});
test('Chen fields occur only once outside entities and connectors stop at entity outlines',()=>{
 const f=createGraphFixture('chen.binary@2'),result=render(f);for(const field of f.definitions.filter(d=>d.role==='field')){assert.equal(allTexts(result).filter(t=>t===field.name).length,1);const owner=result.entries.find(e=>e.definition.ref.id===field.content.parent.id);assert.ok(!texts(owner).includes(field.name));}
 const entities=result.entries.filter(e=>e.definition.record.role==='entity');for(const e of result.entries.filter(e=>e.definition.record.role==='field')){const d=e.item.primitives.find(p=>p.kind==='path').d,point=d.match(/^M([^,]+),([^L]+)/).slice(1).map(Number);assert.ok(entities.some(n=>point[0]===n.item.bounds.x||point[0]===n.item.bounds.x+n.item.bounds.width||point[1]===n.item.bounds.y||point[1]===n.item.bounds.y+n.item.bounds.height));}
});
test('ORM shows role captions, structured value constraints and prose derivation without JSON',()=>{
 const f=custom('orm.basic@1',[node('fact','orm.facttype',{metadata:{x_derive:{text:'from source'},x_objectified:{name:'Fact object'}},members:[{id:'who'},{id:'what'}]}),node('name','orm.valuetype',{metadata:{x_values:{values:['short','full']}}})]);f.definitions.push(node('who','field'),node('what','field'));
 const t=allTexts(render(f));for(const expected of ['who','what','{short, full}','from source','Fact object'])assert.ok(t.includes(expected));assert.ok(!t.some(s=>s.includes('"text"')));
});
test('named control symbols, functional types, DFD owner and store code stay visible',()=>{
 const bounds={x:0,y:0,width:150,height:90};for(const role of ['state.initial','state.final','state.forkjoin','flow.parallelmode','tree.gate','epk.connector']){const ps=nodeGlyph(role,{},bounds,{title:'Named symbol',profile:'uml.statemachine@1'});assert.ok(ps.some(p=>p.kind==='text'&&p.runs.some(r=>r.text==='Named symbol')),role);}
 for(const role of ['fbd.block','ladder.timer'])assert.ok(nodeGlyph(role,{metadata:{x_record:{block_type:'TON'}}},bounds,{title:'T1',profile:'fbd.basic@1'}).some(p=>p.kind==='text'&&p.runs[0].text==='TON'));
 const process=nodeGlyph('dfd.process',{metadata:{x_diagram:{number:'1.0',owner:'Accounts payable'}}},bounds,{title:'Process',profile:'dfd.gane_sarson@1'});assert.ok(process.some(p=>p.kind==='text'&&p.runs[0].text==='Accounts payable'));
 const store=nodeGlyph('dfd.store',{metadata:{x_diagram:{number:'D1'}}},bounds,{title:'Store',profile:'dfd.gane_sarson@1'});assert.ok(store.some(p=>p.kind==='text'&&p.runs[0].text==='D1'));
});
test('sequence numbering includes numeric metadata and receiver activation extends through reply',()=>{
 const f=custom('uml.sequence@2',[node('client','application'),node('server','service')],[edge('request','client','server','uml.message',{metadata:{x_message:{seq:7,sort:'synch'}}}),edge('response','server','client','uml.message',{metadata:{x_message:{sort:'reply'}}})]);const r=render(f);assert.ok(allTexts(r).includes('7: request'));assert.ok(allTexts(r).includes('2: response'));const server=r.entries.find(e=>e.definition.ref.id==='server');assert.ok(server.item.primitives.some(p=>p.kind==='rect'&&p.bounds.width===12&&p.bounds.height===65));
});
test('timing retains state duration, slew and readable time constraints',()=>{
 const f=createGraphFixture('uml.timing@2');f.definitions[0].metadata.x_states[1].duration='{20..30}';f.definitions[0].metadata.x_states[0].slew='{2}';f.definitions[0].metadata.x_timeconstraint=['{0..40}'];const t=allTexts(render(f));for(const expected of ['{20..30}','{2}','{0..40}','active'])assert.ok(t.includes(expected));
});
test('shared native edge semantics restore colour, weight, pattern and unambiguous crossings',()=>{
 const f=custom('uml.structure@2',[node('west'),node('east'),node('north'),node('south')],[edge('h','west','east','assoc'),edge('v','north','south','calls')]);
 f.document.appearances=[['west',0,200],['east',600,200],['north',300,0],['south',300,400]].map(([id,x,y])=>({id:'at-'+id,target:{id},parent:{id:'view'},position:{x,y},size:{width:100,height:100}}));
 for(const mode of ['gap','bridge','square_bridge']){f.view.layout={algorithm:'grid',routing:'straight',crossings:mode};const r=render(f),v=r.entries.find(e=>e.definition.ref.id==='v'),p=v.item.primitives.find(p=>p.kind==='path');assert.equal(p.paint.stroke,roleDescriptor('calls','relation').render.colour);assert.equal(p.paint['stroke-width'],roleDescriptor('calls','relation').render.width);assert.ok(mode==='gap'?p.d.split('M').length===3:mode==='bridge'?p.d.includes('Q'):p.d.split('L').length>=6);}
});
test('isometric region frames stay on the ground plane',()=>{
 const f=custom('uml.structure@2',[node('one')]);f.view.regions=[{id:'frame',members:[{id:'one'}]}];const scene=render(f),iso=isometricGraph(scene.entries,{x:0,y:0,width:900,height:600},30);const frame=iso.find(e=>e.item.layer==='frames');assert.match(frame.item.accessible.description,/ground route/);assert.equal(frame.item.primitives.length,scene.entries.find(e=>e.item.layer==='frames').item.primitives.length);
});

test('foreign looks preserve symbol silhouettes and deterministic sketch geometry',()=>{
 const bounds={x:0,y:0,width:150,height:90},options={title:'Decision',profile:'flow.basic@1',look:'handdrawn',seed:77,roughness:1.5};
 const a=nodeGlyph('flow.decision',{},bounds,options),b=nodeGlyph('flow.decision',{},bounds,options);assert.deepEqual(a,b);assert.match(a[0].d,/^M/);assert.ok(!a[0].d.includes('NaN'));assert.notDeepEqual(a[0],nodeGlyph('flow.decision',{},bounds,{...options,look:'classic'})[0]);
 const f=custom('uml.usecase@1',[node('buyer','uml.actor',{style:{look:'neo'}})]),actor=render(f).entries[0];assert.ok(!actor.item.primitives.some(p=>p.kind==='rect'&&p.paint.fill==='#cbd5e1'));
});
test('nested automatic frames enclose child frames without moving their content',()=>{
 const f=custom('state.composite@1',[node('a','state.state'),node('b','state.state'),node('outside','state.state')]);f.view.regions=[{id:'outer',members:[{id:'a'},{id:'b'}]},{id:'inner',parent:'outer',members:[{id:'a'}]}];const r=render(f),outer=r.entries.find(e=>e.item.occurrence.endsWith(':region:outer')).item.bounds,inner=r.entries.find(e=>e.item.occurrence.endsWith(':region:inner')).item.bounds;assert.ok(inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.width<=outer.x+outer.width&&inner.y+inner.height<=outer.y+outer.height);
});

test('sequence, timing and fishbone retain their method interpretation captions',()=>{
 for(const [profile,meaning]of [['uml.sequence@2','not a verified protocol'],['msc.basic@1','receiver activations'],['uml.timing@2','not a simulation'],['fishbone.basic@1','not proven causality']]){const r=render(createGraphFixture(profile)),caption=r.entries.find(e=>e.item.occurrence.endsWith(':method-caption'));assert.ok(caption,profile);assert.ok(texts(caption).join(' ').includes(meaning));const content=r.entries.filter(e=>e!==caption);assert.ok(caption.item.bounds.y>Math.max(...content.map(e=>e.item.bounds.y+e.item.bounds.height)));}
});

test('foreign communication views retain native role pictograms and separate parallel automatic connections',()=>{
 const f=custom('uml.communication@1',[node('client','application'),node('server','service')],[edge('request','client','server','uml.message'),edge('reply','server','client','uml.message')]);f.view.layout={algorithm:'layered',direction:'right',routing:'orthogonal'};const r=render(f);assert.ok(allTexts(r).includes('APP'));assert.ok(allTexts(r).includes('SRV'));const routes=r.entries.filter(e=>e.definition.record.category==='relation').map(e=>e.item.primitives.find(p=>p.kind==='path').d);assert.notEqual(routes[0].replace(/M|L/g,''),routes[1].replace(/M|L/g,''));assert.ok(routes[1].split('L').length>=6);
});

test('a scoped frame owner shares its member region and cannot enclose an unrelated sibling',()=>{
 const f=custom('cmmn.basic@1',[node('stage','cmmn.stage'),node('outside','cmmn.milestone'),node('inside','cmmn.humantask')]);f.view.layout={algorithm:'layered',direction:'right'};f.view.regions=[{id:'review',scope:{id:'stage'},members:[{id:'inside'}]}];const r=render(f),frame=r.entries.find(e=>e.item.occurrence.endsWith(':region:review')).item.bounds,outside=r.entries.find(e=>e.definition.ref.id==='outside').item.bounds;assert.ok(!overlap(frame,outside));for(const id of ['stage','inside']){const b=r.entries.find(e=>e.definition.ref.id===id&&e.item.layer!=='frames').item.bounds;assert.ok(b.x>=frame.x&&b.y>=frame.y&&b.x+b.width<=frame.x+frame.width&&b.y+b.height<=frame.y+frame.height);}
});

test('resolved neutral theme overrides role paint while unthemed standard values retain role colours',()=>{
 const f=custom('archimate.basic@1',[node('actor','archi.business_actor')]),effective={symbol:{color:'#303030',fill:'#ffffff'}},theme=render(f,{effective,propertyOrigins:{'symbol.color':'standard:theme neutral','symbol.fill':'standard:theme neutral'}}).entries[0];assert.ok(theme.item.primitives.some(p=>'paint'in p&&p.paint.stroke==='#303030'));
 const standard=render(f,{effective,propertyOrigins:{'symbol.color':'standard:definition','symbol.fill':'standard:definition'}}).entries[0];assert.ok(standard.item.primitives.some(p=>'paint'in p&&p.paint.stroke===roleDescriptor('archi.business_actor').render.colour));
});

test('layered workflows keep feedback stages together and rank every downstream stage',()=>{
 const ids=['Intake','Review','Copyediting','Typesetting','Archive'],nodes=ids.map(id=>({id,bounds:{x:0,y:0,width:200,height:id==='Review'?120:80}})),links=[['Intake','Review'],['Review','Intake'],['Review','Copyediting'],['Copyediting','Typesetting'],['Typesetting','Archive']].map(([from,to])=>({from,to}));
 for(const direction of ['right','down','left','up']){const p=graphLayout(nodes,links,{algorithm:'layered',direction});const axis=['down','up'].includes(direction)?'y':'x',sign=['left','up'].includes(direction)?-1:1;const dimension=axis==='x'?'width':'height';assert.equal(p.get('Intake')[axis]+p.get('Intake')[dimension]/2,p.get('Review')[axis]+p.get('Review')[dimension]/2);for(let i=1;i<ids.length-1;i++)assert.ok(sign*p.get(ids[i])[axis]<sign*p.get(ids[i+1])[axis]);assert.ok(!overlap(p.get('Intake'),p.get('Review')));}
 const f=custom('ddn@1',ids.map(id=>node(id,'flow.process')),links.map((link,i)=>edge('r'+i,link.from,link.to,'assoc')));f.view.layout={algorithm:'auto'};const r=render(f).entries;assert.equal(r.find(e=>e.definition.ref.id==='Intake').item.bounds.x,r.find(e=>e.definition.ref.id==='Review').item.bounds.x);
});
test('layered ordering reduces crossings between declared concepts without reversing relations',()=>{
 const nodes=['Order','Payment','Customer','Invoice'].map(id=>({id,bounds:{x:0,y:0,width:200,height:80}})),links=[['Order','Invoice'],['Payment','Customer']].map(([from,to])=>({from,to})),p=graphLayout(nodes,links,{algorithm:'layered'});assert.ok((p.get('Order').y-p.get('Payment').y)*(p.get('Invoice').y-p.get('Customer').y)>0);assert.ok(p.get('Order').x<p.get('Invoice').x);
});
test('mind map spans use each subtree height rather than the tallest card for every leaf',()=>{
 const nodes=[['root',180],['Pricing',180],['Onboarding',280],['Risks',128],['Marketing',100],['Usage',100],['Annual',100],['Scope',100]].map(([id,height])=>({id,bounds:{x:0,y:0,width:270,height}})),links=[['root','Pricing'],['root','Onboarding'],['root','Risks'],['root','Marketing'],['Pricing','Usage'],['Pricing','Annual'],['Risks','Scope']].map(([from,to])=>({from,to})),p=graphLayout(nodes,links,{algorithm:'mindmap',row_gap:112});const boxes=[...p.values()];assert.equal(Math.max(...boxes.map(b=>b.y+b.height))-Math.min(...boxes.map(b=>b.y)),552);assert.equal(p.get('Annual').y-p.get('Usage').y,212);assert.ok(p.get('Onboarding').x<p.get('root').x);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i],boxes[j]));
});
test('fit grid places connected clusters around the root and preserves authored pins',()=>{
 const nodes=['root','a','b','c','d','e'].map(id=>({id,bounds:{x:0,y:0,width:200,height:80}})),links=nodes.slice(1).map(n=>({from:'root',to:n.id})),p=graphLayout(nodes,links,{algorithm:'fit_grid'}),root=p.get('root');assert.ok([...p.values()].some(b=>b.x<root.x));assert.ok([...p.values()].some(b=>b.x>root.x));
 const pinned=nodes.map((n,i)=>i? n:{...n,pinned:true,bounds:{...n.bounds,x:480,y:360}}),q=graphLayout(pinned,links,{algorithm:'fit_grid'});assert.deepEqual(q.get('root'),pinned[0].bounds);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert.ok(!overlap(q.get(nodes[i].id),q.get(nodes[j].id)));
});
test('native grouped layout uses explicit grouping metadata and semantic roles as fallback',()=>{
 const f=custom('ddn@1',[node('company','context',{metadata:{x_record:{layout_group:'group'}}}),node('energy','application',{metadata:{x_record:{layout_group:'core'}}}),node('freight','application',{metadata:{x_record:{layout_group:'core'}}}),node('media','application',{metadata:{x_record:{layout_group:'support'}}})]);f.view.layout={algorithm:'grouped',group_by:'role',columns:2};const result=render(f).entries,b=id=>result.find(e=>e.definition.ref.id===id).item.bounds;assert.ok(b('company').x<b('energy').x);assert.ok(b('freight').x<b('media').x);assert.equal(b('company').y,b('media').y);
});
test('string connectors bow smoothly and numbered labels are compact with themed backdrops',()=>{
 const f=custom('ddn@1',[node('a','application'),node('b','service')],[edge('very long relationship caption','a','b','calls')]);f.view.layout={algorithm:'layered',routing:'string'};f.view.background={color:'#172033'};f.view.legend={mode:'numbers',keys:{'very long relationship caption':7}};const r=render(f),e=r.entries.find(e=>e.definition.record.category==='relation');assert.ok(e.item.primitives.find(p=>p.kind==='path').d.includes('C'));assert.deepEqual(texts(e),['7']);const backdrop=e.item.primitives.find(p=>p.kind==='ellipse');assert.equal(backdrop.paint.fill,'#172033');assert.ok(backdrop.bounds.width<40);assert.ok(e.item.bounds.height>40);
});
test('native subdiagram links and badges retain a visible target reference',()=>{
 for(const display of ['link','badge']){const f=custom('ddn@1',[node('reference','object',{metadata:{x_subdiagram:{view:'details',display}}})]);const r=render(f).entries[0];assert.ok(texts(r).includes('↗ details'));assert.equal(r.item.bounds.height,100);assert.match(r.item.accessible.description,/Reference to details/);}
});
test('descriptor diamonds use filled composition marks while explicit new marks stay hollow',()=>{
 const f=custom('ddn@1',[node('a'),node('b')],[edge('part','a','b','emb')]);let e=render(f).entries.find(e=>e.definition.record.category==='relation'),diamond=e.item.primitives.filter(p=>p.kind==='path')[1];assert.equal(diamond.paint.fill,roleDescriptor('emb','relation').render.colour);f.definitions[2].qualifiers={source:{mark:'diamond'}};e=render(f).entries.find(e=>e.definition.record.category==='relation');diamond=e.item.primitives.filter(p=>p.kind==='path')[1];assert.equal(diamond.paint.fill,'#fff');
});

test('curved connectors honor crossing gaps and bridge styles at sampled curve intersections',()=>{
 const f=custom('ddn@1',[node('west'),node('east'),node('north'),node('south')],[edge('h','west','east','assoc'),edge('v','north','south','calls')]);f.document.appearances=[['west',0,200],['east',600,200],['north',300,0],['south',300,400]].map(([id,x,y])=>({id:'at-'+id,target:{id},parent:{id:'view'},position:{x,y},size:{width:100,height:100}}));const paths=[];
 for(const crossings of ['gap','bridge','square_bridge']){f.view.layout={algorithm:'grid',routing:'curved',crossings};const e=render(f).entries.find(e=>e.definition.ref.id==='v'),d=e.item.primitives.find(p=>p.kind==='path').d;paths.push(d);assert.ok(crossings==='gap'?d.split('M').length===3:crossings==='bridge'?d.includes('Q'):new Set(d.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_,i)=>i%2===0)).size>1);}
 assert.equal(new Set(paths).size,3);
});
test('curved links avoid intervening boxes, separate return tracks, and round self loops',()=>{
 const f=custom('ddn@1',[node('upstream'),node('database'),node('downstream')],[edge('link','upstream','downstream','calls')]);f.document.appearances=[['upstream',0],['database',300],['downstream',600]].map(([id,x])=>({id:'at-'+id,target:{id},parent:{id:'view'},position:{x,y:200},size:{width:100,height:100}}));f.view.layout={algorithm:'grid',routing:'curved'};const route=render(f).entries.find(e=>e.definition.ref.id==='link').item.primitives.find(p=>p.kind==='path');assert.ok(route.d.includes('Q'));const numbers=route.d.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=0;i<numbers.length;i+=2)assert.ok(!(numbers[i]>300&&numbers[i]<400&&numbers[i+1]>200&&numbers[i+1]<300));
 const pair=custom('ddn@1',[node('client'),node('service')],[edge('request','client','service','calls'),edge('reply','service','client','calls')]);pair.view.layout={algorithm:'layered',routing:'curved'};const ps=render(pair).entries.filter(e=>e.definition.record.category==='relation').map(e=>e.item.primitives.find(p=>p.kind==='path').d);assert.ok(ps.every(d=>d.includes('C')));const ys=ps.map(d=>d.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_,i)=>i%2));assert.ok(new Set(ys[1]).size>1);
 const self=custom('ddn@1',[node('state')],[edge('retry','state','state','calls')]);self.view.layout={routing:'curved'};const sr=render(self),sb=sr.entries.find(e=>e.definition.ref.id==='state').item.bounds,sd=sr.entries.find(e=>e.definition.ref.id==='retry').item.primitives.find(p=>p.kind==='path').d;assert.ok(sd.includes('Q'));assert.ok(sd.startsWith('M'+(sb.x+sb.width)+','));assert.ok(sd.endsWith('L'+(sb.x+sb.width)+','+(sb.y+sb.height*.65)));
});

test('UML template parameters display as readable declarations and found/lost messages do not loop',()=>{
 const f=custom('uml.structure@2',[node('Catalog','uml.class',{metadata:{x_template:{parameters:['T','N: int']}}})]),t=allTexts(render(f));assert.ok(t.includes('T'));assert.ok(t.includes('N: int'));assert.ok(!t.some(value=>value.includes('"parameters"')));
 const q=custom('uml.sequence@2',[node('Agent','application')],[edge('metric','Agent','Agent','uml.message',{metadata:{x_message:{sort:'lost'}}}),edge('late','Agent','Agent','uml.message',{metadata:{x_message:{sort:'found'}}})]),r=render(q);
 for(const entry of r.entries.filter(e=>e.definition.record.category==='relation')){assert.ok(!entry.item.primitives.find(p=>p.kind==='path').d.includes('V'));assert.ok(entry.item.primitives.some(p=>p.kind==='ellipse'));}
});
test('fishbone branches stay inside the frame margin and sketch style reaches branch paths',()=>{
 const f=createGraphFixture('fishbone.basic@1'),r=render(f,{effective:{style:{look:'handdrawn'}}});assert.ok(r.entries.every(entry=>entry.item.bounds.x>=32));const classic=render(f);assert.notDeepEqual(r.entries.find(entry=>entry.item.occurrence.includes('cause-edge')).item.primitives,classic.entries.find(entry=>entry.item.occurrence.includes('cause-edge')).item.primitives);
});

test('concept layouts place the narrow feeder before the branching concept and keep store codes clear',()=>{
 const nodes=['Order','Payment','Invoice','Shipment','Ledger'].map(id=>({id,bounds:{x:0,y:0,width:240,height:100}})),links=[['Payment','Invoice'],['Order','Invoice'],['Order','Shipment'],['Invoice','Ledger'],['Shipment','Ledger']].map(([from,to])=>({from,to})),p=graphLayout(nodes,links,{algorithm:'layered'});assert.ok(p.get('Payment').y<p.get('Order').y);assert.ok(p.get('Invoice').y<p.get('Shipment').y);
 const ps=nodeGlyph('dfd.store',{metadata:{x_diagram:{code:'D1'}}},{x:0,y:0,width:248,height:100},{title:'Accepted receipts',profile:'dfd.gane_sarson@1'}),title=ps.find(p=>p.kind==='text'&&p.runs.some(r=>r.text==='Accepted receipts'));assert.ok(title.runs[0].x>140);
});
test('relation markings preserve dashed uncertainty and a non-colour prohibition strike',()=>{
 for(const mark of ['tentative','forbidden']){const f=custom('ddn@1',[node('a'),node('b')],[edge('r','a','b','calls')]);f.document.appearances=[{id:'marked',target:{id:'r'},parent:{id:'view'},marks:[mark]}];const r=render(f).entries.find(e=>e.definition.ref.id==='r'),paths=r.item.primitives.filter(p=>p.kind==='path');assert.equal(paths[0].paint['stroke-dasharray'],'6 4');assert.match(r.item.accessible.description,new RegExp(mark));if(mark==='forbidden')assert.ok(paths.filter(p=>p.paint['stroke-width']===2).length>=3);}
});

test('labels wrap inside narrow pipeline gaps instead of falling below the complete diagram',()=>{
 const f=custom('ddn@1',[node('raw'),node('transform'),node('mart')],[edge('read produces input for','raw','transform','flow'),edge('writes output to','transform','mart','flow')]);f.document.appearances=[['raw',32],['transform',365],['mart',698]].map(([id,x])=>({id:'at-'+id,target:{id},parent:{id:'view'},position:{x,y:100},size:{width:248,height:140}}));f.view.layout={routing:'orthogonal'};const r=render(f);for(const edge of r.entries.filter(e=>e.definition.record.category==='relation')){const labels=edge.item.primitives.filter(p=>p.kind==='text');assert.ok(labels.length>=2);assert.ok(labels.every(p=>p.runs.every(run=>run.y<250)));assert.ok(!edge.item.primitives.some(p=>p.kind==='path'&&p.paint['stroke-dasharray']==='2 2'));}
});
test('sampled curve labels use the middle of narrow gaps between unequal-height cards',()=>{
 const f=custom('ddn@1',[node('leaf'),node('parent')],[edge('associated with','leaf','parent','assoc')]);f.document.appearances=[{id:'leaf-at',target:{id:'leaf'},parent:{id:'view'},position:{x:32,y:190},size:{width:270,height:100}},{id:'parent-at',target:{id:'parent'},parent:{id:'view'},position:{x:414,y:100},size:{width:270,height:280}}];f.view.layout={routing:'curved'};const r=render(f).entries.find(e=>e.definition.record.category==='relation'),labels=r.item.primitives.filter(p=>p.kind==='text');assert.equal(labels.length,2);assert.ok(labels.every(p=>p.runs.every(run=>run.x>302&&run.x<414&&run.y>190&&run.y<290)));assert.ok(!r.item.primitives.some(p=>p.kind==='path'&&p.paint['stroke-dasharray']==='2 2'));
});
test('diagonal mind map labels stay in the clear gap beside unequal-height cards',()=>{
 const f=custom('ddn@1',[node('root'),node('onboarding')],[edge('associated with','root','onboarding','assoc')]);
 f.document.appearances=[{id:'root-at',target:{id:'root'},parent:{id:'view'},position:{x:782,y:287.632},size:{width:248,height:179.84}},{id:'onboarding-at',target:{id:'onboarding'},parent:{id:'view'},position:{x:422,y:144.896},size:{width:248,height:253.312}}];
 f.view.layout={routing:'curved'};
 const r=render(f).entries.find(e=>e.definition.record.category==='relation'),labels=r.item.primitives.filter(p=>p.kind==='text');
 assert.equal(labels.length,2);
 assert.ok(labels.every(p=>p.runs.every(run=>run.x>670&&run.x<782&&run.y>271&&run.y<398)));
 assert.ok(!r.item.primitives.some(p=>p.kind==='path'&&p.paint['stroke-dasharray']==='2 2'));
});
test('composite Chen attributes keep their direct parent and render each field only once',()=>{
 const f=custom('chen.binary@2',[node('Order','entity',{members:[{id:'address'},{id:'street'},{id:'city'},{id:'tags'}]})]);f.definitions.push(node('address','field',{content:{parent:{id:'Order'}},metadata:{x_chen:{composite:true}}}),node('street','field',{content:{parent:{id:'address'}}}),node('city','field',{content:{parent:{id:'address'}}}),node('tags','field',{content:{parent:{id:'Order'}}}));const r=render(f);for(const id of ['address','street','city','tags'])assert.equal(allTexts(r).filter(text=>text===id).length,1);const entries=r.entries.filter(e=>e.definition.record.role==='field');assert.ok(entries.find(e=>e.definition.ref.id==='street').item.bounds.y>entries.find(e=>e.definition.ref.id==='address').item.bounds.y);for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)assert.ok(!overlap(entries[i].item.bounds,entries[j].item.bounds));
});

test('automatic layout leaves authored pins fixed and reserves their occupied rectangles',()=>{
 const nodes=['hub','order','store','other'].map((id,i)=>({id,bounds:{x:32,y:64,width:248,height:140},...(i===0?{pinned:true}:{})})),links=[{from:'hub',to:'order'},{from:'order',to:'store'}];for(const algorithm of ['layered','grid','tree','mindmap','grouped']){const p=graphLayout(nodes,links,{algorithm});assert.deepEqual(p.get('hub'),nodes[0].bounds);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert.ok(!overlap(p.get(nodes[i].id),p.get(nodes[j].id)),algorithm);}
});

test('Petri transition names sit below the transition bar',()=>{
 const b={x:0,y:0,width:100,height:60},ps=nodeGlyph('petri.transition',{},b,{title:'Produce',profile:'petri.basic@1'}),name=ps.find(p=>p.kind==='text'&&p.runs[0].text==='Produce');assert.ok(name.runs[0].y>b.y+b.height);
});

test('UAF capability tag outline and actor stereotype preserve their separate visual roles',()=>{
 const f=custom('uaf.strategic@1',[node('capability','uaf.capability'),node('person','uaf.person')]),r=render(f),cap=r.entries.find(e=>e.definition.ref.id==='capability'),person=r.entries.find(e=>e.definition.ref.id==='person');assert.ok(cap.item.primitives.some(p=>p.kind==='path'&&p.d.endsWith('Z')));const stereotype=person.item.primitives.find(p=>p.kind==='text'&&p.runs[0].text==='«Person»');assert.ok(stereotype.runs[0].y<person.item.bounds.y);
});

test('native record icons in UML views reserve header space above attribute compartments',()=>{
 const f=custom('uml.object@2',[node('record','record',{members:[{id:'value'}]})]);f.definitions.push(node('value','field',{content:{parent:{id:'record'},value:'C-001'}}));const e=render(f).entries[0],runs=e.item.primitives.filter(p=>p.kind==='text').flatMap(p=>p.runs),badge=runs.find(r=>r.text==='REC'),heading=runs.find(r=>r.text==='ATTRIBUTES');assert.ok(heading.y>badge.y+15);
});
test('relation descriptor notation keeps extension triangles and interface or exclusion terminals',()=>{
 for(const role of ['uml.extension','uml.provided','uml.required','uml.assembly','orm.exclusion']){const f=custom('uml.structure@2',[node('a'),node('b')],[edge('r','a','b',role)]),ps=render(f).entries.find(e=>e.definition.ref.id==='r').item.primitives;if(role==='uml.extension')assert.ok(ps.some(p=>p.kind==='path'&&p.paint.fill===roleDescriptor(role,'relation').render.colour&&p.d.endsWith('Z')));else if(role==='uml.required')assert.ok(ps.some(p=>p.kind==='path'&&p.d.includes('Q')));else assert.ok(ps.some(p=>p.kind==='ellipse'));}
});


test('unconnected palette drops stay outside specialized method layouts until linked', () => {
 for(const profile of ['org.tree@1','uml.sequence@2','uml.timing@2','fishbone.basic@1','ladder.basic@1','network.rack@1']){
  const f=createGraphFixture(profile),before=render(f).entries;
  const role=f.definitions.find(item=>item.category==='element').role;
  f.definitions.push(node('pending',role));f.view.selection.include.push({id:'pending'});
  f.document.appearances??=[];
  f.document.appearances.push({id:'pending-at',target:{id:'pending'},parent:{id:'view'},pinned:false,position:{x:703,y:541}});
  const result=render(f).entries,pending=result.find(item=>item.definition.ref.id==='pending');
  assert.ok(pending,profile);
  assert.equal(pending.item.hitTargets[0].bounds.x,703,profile);
  assert.equal(pending.item.hitTargets[0].bounds.y,541,profile);
  for(const item of before){const after=result.find(other=>other.item.occurrence===item.item.occurrence);assert.deepEqual(after?.item.bounds,item.item.bounds,profile+': existing geometry');}
 }
});
test('a source-authored connection releases a provisional position without a designer session', () => {
 for(const profile of ['ddn@1','org.tree@1']){
  const f=custom(profile,[node('parent','organization'),node('child','organization')],[edge('link','parent','child','reports_to')]);
  f.view.layout={algorithm:'tree',direction:'down'};
  f.document.appearances=[{id:'pending-at',target:{id:'child'},parent:{id:'view'},pinned:false,position:{x:703,y:541}}];
  const result=render(f).entries,child=result.find(item=>item.definition.ref.id==='child'),parent=result.find(item=>item.definition.ref.id==='parent');
  assert.notEqual(child.item.bounds.x,703,profile);
  assert.ok(child.item.bounds.y>=parent.item.bounds.y+parent.item.bounds.height,profile);
 }
});
