import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = file => import(pathToFileURL(resolve(output, 'ddn/packages', file)));
const {projectSnapshot, relationPresentation} = await load('presentation/src/index.js');
const {resolveProperties, validateProperty} = await load('defaults/src/index.js');
const {validateSchema} = await load('profiles/src/schema-core.js');
const ref = id => ({file: 'main.ddn', id});
function fixture(profile = 'ddn@1', viewSettings = {}) {
 const document = {
  definitions: ['a', 'b', 'c'].map((id, index) => ({id, name: ['Alpha', 'Beta', 'Gamma'][index], role: 'object'})),
  views: [{id: 'v', name: 'Map', profile, ...viewSettings}],
  appearances: [],
 };
 document.definitions.push(...['r1', 'r2'].map((id, i) => ({id, name: id, title: i ? 'Second link' : 'First link', category: 'relation', role: 'assoc', endpoints: [{definition: ref('a')}, {definition: ref(i ? 'c' : 'b')}]})));
 document.appearances = document.definitions.map(d => ({id: 'show-' + d.id, target: ref(d.id), parent: ref('v')}));
 const snapshot = {contract:'ddn-next-1',rootFile:'main.ddn',revision:{model:'1',sources:{'main.ddn':'1'},data:{}},versions:{api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{}},semanticFingerprint:'test',coverage:{scope:{kind:'workarea'},complete:true,checked:[],unavailable:[]},normalized:{version:'ddn-next-1',entry:'main.ddn',files:[{location:'main.ddn',document}]}};
 return {document, snapshot, appearance: id => document.appearances.find(a => a.target.id === id), definition: id => document.definitions.find(d => d.id === id)};
}
const render = (f, styles) => projectSnapshot(f.snapshot, {resolve: (target, context) => resolveProperties(f.snapshot, target, {...context, ...(styles ? {styles} : {})})});
const entry = (scene, id) => scene.entries.find(e => e.definition.ref.id === id && e.definition.owner === 'definition');
const text = item => item.primitives.flatMap(p => p.kind === 'text' ? p.runs.map(r => r.text) : []);
const caption = (scene, id) => text(entry(scene, id).item);
const key = scene => scene.entries.filter(e => e.definition.owner === 'view').flatMap(e => text(e.item)).join(' ');

test('relation settings are optional, typed appearance properties with CSS/file precedence', () => {
 for (const [path, valid, invalid] of [['label.visible',false,'no'],['label.mode','numbers','tokens'],['legend.include',true,1]]) {
  assert.deepEqual(validateProperty('appearance', path, valid), []);
  assert.ok(validateProperty('appearance', path, invalid).length);
 }
 assert.deepEqual(validateSchema('default_rule', {selector:{owner:'appearance',category:'relation'},declarations:{'label.visible':false,'label.mode':'numbers','legend.include':true}}), []);
 const f=fixture(), styles=[{selector:{owner:'appearance',category:'relation'},declarations:{'label.visible':false,'label.mode':'numbers','legend.include':true}}];
 let scene=render(f,styles);assert.deepEqual(caption(scene,'r1'),[]);assert.match(key(scene),/1\s+Alpha → Beta: First link/);
 f.appearance('r1').label={visible:true,mode:'text'};f.appearance('r1').legend={include:false};
 scene=render(f,styles);assert.equal(caption(scene,'r1').join(' '),'First link');assert.doesNotMatch(key(scene),/First link/);assert.match(key(scene),/Second link/);
 const resolved=resolveProperties(f.snapshot,ref('r1'),{view:ref('v'),appearance:ref('show-r1')});
 assert.equal(resolved.properties.find(p=>p.path==='label.visible').origin,'file:occurrence');
});

test('electrical default captions stay suppressed but explicit visibility and membership work', () => {
 const f=fixture('ddn@1',{legend:{mode:'numbers'}});
 f.document.assets=[{id:'image',name:'image',media_type:'image/svg+xml',path:'resistor.svg'}];
 for (const id of ['a','b','c']) {f.definition(id).metadata={x_icon:{library:'electrical-common@1',icon:'resistor'}};f.appearance(id).symbol={image:ref('image')};}
 for (const id of ['r1','r2']) f.definition(id).title='associated with';
 let scene=render(f);assert.deepEqual(caption(scene,'r1'),[]);assert.doesNotMatch(key(scene),/RELATIONSHIP KEY/);
 f.appearance('r1').label={visible:true,mode:'numbers'};f.appearance('r1').legend={include:true};
 scene=render(f);assert.deepEqual(caption(scene,'r1'),['1']);assert.match(key(scene),/1\s+Alpha → Beta: associated with/);assert.deepEqual(caption(scene,'r2'),[]);
});

test('visibility, numbers and legend membership are independent and do not renumber other edges', () => {
 const f=fixture();let scene=render(f);
 assert.equal(caption(scene,'r1').join(' '),'First link');assert.doesNotMatch(key(scene),/RELATIONSHIP KEY/);
 f.appearance('r1').label={visible:false,mode:'numbers'};f.appearance('r1').legend={include:true};
 f.appearance('r2').label={mode:'numbers'};f.appearance('r2').legend={include:true};
 scene=render(f);assert.deepEqual(caption(scene,'r1'),[]);assert.deepEqual(caption(scene,'r2'),['2']);assert.match(key(scene),/1\s+Alpha → Beta: First link/);
 f.appearance('r1').legend.include=false;
 scene=render(f);assert.deepEqual(caption(scene,'r2'),['2']);assert.doesNotMatch(key(scene),/First link/);assert.match(key(scene),/2\s+Alpha → Gamma: Second link/);
 f.appearance('r1').label.visible=true;
 scene=render(f);assert.deepEqual(caption(scene,'r1'),['1']);assert.doesNotMatch(key(scene),/First link/);
});

test('explicit text overrides numbered view and endpoint labels remain untouched', () => {
 const f=fixture('ddn@1',{legend:{mode:'numbers'}});
 f.definition('r1').metadata={x_endlabels:{source:{role:'owner',multiplicity:'1'},target:{role:'items',multiplicity:'*'}}};
 f.appearance('r1').label={mode:'text'};
 let scene=render(f);assert.match(caption(scene,'r1').join(' '),/First link/);assert.ok(caption(scene,'r1').includes('owner 1'));assert.ok(caption(scene,'r1').includes('items *'));
 f.appearance('r1').label={visible:false,mode:'numbers'};
 scene=render(f);assert.deepEqual(caption(scene,'r1'),['owner 1','items *']);assert.match(key(scene),/First link/);
});

test('global hidden legend leaves explicit inline number and membership unchanged', () => {
 for (const settings of [{legend:{placement:'none'}},{chrome:{legend:'off'}}]) {
  const f=fixture('ddn@1',settings);f.appearance('r1').label={mode:'numbers'};f.appearance('r1').legend={include:true};
  const scene=render(f);assert.deepEqual(caption(scene,'r1'),['1']);assert.doesNotMatch(key(scene),/RELATIONSHIP KEY/);assert.equal(relationPresentation(entry(scene,'r1')).inLegend,true);
 }
});

test('per-occurrence settings do not alter another view or shared relation', () => {
 const f=fixture();f.appearance('r1').label={visible:false};f.document.views.push({id:'v2',name:'Other',profile:'ddn@1'});
 f.document.appearances.push(...['a','b','r1'].map(id=>({id:'other-'+id,parent:ref('v2'),target:ref(id)})));
 const scene=render(f), copies=scene.entries.filter(e=>e.definition.ref.id==='r1');
 assert.deepEqual(text(copies.find(e=>e.view.ref.id==='v').item),[]);assert.equal(text(copies.find(e=>e.view.ref.id==='v2').item).join(' '),'First link');assert.equal(f.definition('r1').label,undefined);
});

test('file-qualified identities and repeated appearances retain stable distinct numbers', () => {
 const f=fixture('ddn@1',{legend:{mode:'numbers',keys:{r1:'ambiguous','other.ddn::r1':'Z'}}});
 const external={id:'r1',title:'External identity',name:'External',category:'relation',role:'assoc',endpoints:[{definition:ref('b')},{definition:ref('c')}]};
 f.snapshot.normalized.files.push({location:'other.ddn',document:{definitions:[external]}});
 f.document.appearances.push({id:'external',parent:ref('v'),target:{file:'other.ddn',id:'r1'}},{id:'duplicate',parent:ref('v'),target:ref('r2'),label:{visible:false}});
 const scene=render(f), relations=scene.entries.filter(e=>e.definition.record.category==='relation');
 assert.equal(relations.find(e=>e.definition.file==='main.ddn'&&e.definition.ref.id==='r1').relationNumber,'1');
 assert.equal(relations.find(e=>e.definition.file==='other.ddn').relationNumber,'Z');
 assert.deepEqual(relations.filter(e=>e.definition.ref.id==='r2').map(e=>e.relationNumber),['2','2']);
 assert.equal(key(scene).match(/Second link/g).length,1);assert.match(key(scene),/External identity/);
});

test('internal mind-map branches cannot enable captions or legend entries', () => {
 const f=fixture('mindmap.basic@1',{legend:{mode:'numbers'}});
 for (const id of ['r1','r2']) {f.appearance(id).label={visible:true,mode:'numbers'};f.appearance(id).legend={include:true};}
 const scene=render(f);assert.deepEqual(caption(scene,'r1'),[]);assert.deepEqual(caption(scene,'r2'),[]);assert.doesNotMatch(key(scene),/RELATIONSHIP KEY/);
 assert.equal(relationPresentation(entry(scene,'r1')).allowed,false);
});

test('Chen, sequence and timing captions honor appearance controls without removing method marks', () => {
 for (const profile of ['chen.basic@1','uml.sequence@1','uml.timing@1']) {
  const f=fixture(profile);
  if (profile.startsWith('chen')) for (const id of ['a','b','c']) f.definition(id).role='entity';
  else for (const id of ['r1','r2']) f.definition(id).role='uml.message';
  if (profile.startsWith('uml.timing')) {
   for (const id of ['a','b','c']) f.definition(id).metadata={x_states:[{at:0,state:'idle'},{at:10,state:'active'}]};
   for (const id of ['r1','r2']) f.definition(id).metadata={x_message:{at:5}};
  }
  f.appearance('r1').label={visible:false};f.appearance('r1').legend={include:true};f.appearance('r2').label={mode:'numbers'};
  const scene=render(f);assert.deepEqual(caption(scene,'r1'),[],profile);assert.deepEqual(caption(scene,'r2'),['2'],profile);assert.match(key(scene),/First link/,profile);assert.ok(entry(scene,'r1').item.primitives.length>0,profile);
 }
});

test('fishbone caption toggles refer to bones, preserving cause and category node names', () => {
 const f=fixture('fishbone.basic@1');f.definition('a').role='quality.effect';f.definition('b').role='quality.category';f.definition('c').role='quality.cause';
 f.definition('r1').role=f.definition('r2').role='quality.cause';f.definition('r1').endpoints=[{definition:ref('b')},{definition:ref('a')}];f.definition('r2').endpoints=[{definition:ref('c')},{definition:ref('b')}];
 let scene=render(f);assert.deepEqual(caption(scene,'r1'),[]);assert.ok(scene.items.flatMap(text).includes('Beta'));
 f.appearance('r1').label={visible:true,mode:'numbers'};f.appearance('r1').legend={include:true};
 scene=render(f);assert.deepEqual(caption(scene,'r1'),['1']);assert.ok(scene.items.flatMap(text).includes('Beta'));assert.ok(scene.items.flatMap(text).includes('Gamma'));assert.match(key(scene),/First link/);
});
