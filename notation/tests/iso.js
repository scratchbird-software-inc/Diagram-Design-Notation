/* SPDX-License-Identifier: GPL-2.0-or-later. B1-034 ddn-iso: axonometric math
 * fixtures, shading, painter's total order, depth binding (number/px/per-record/
 * @data.record.field), stage-1 chart extrusions, stage-2 iso graph prisms,
 * refresh-driven SMIL depth transitions, graceful-missing degradation, and
 * determinism (incl. the painter's tie-break). */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),results=[];
require('../runtime/ddn-full.js').default; // wire source namespaces (mirrors ddn.global.js)
const Iso=require('../runtime/ddn-iso.js').default;
const read=n=>fs.readFileSync(path.join(dist,n),'utf8');
const basics=f=>fs.readFileSync(path.join(root,'../website/examples/basics',f),'utf8');
const ISO_CHARTS={'72-iso-charts.ddn':basics('72-iso-charts.ddn'),'shared.ddn':basics('shared.ddn')};
const ISO_GRAPH={'73-iso-architecture.ddn':basics('73-iso-architecture.ddn'),'shared.ddn':basics('shared.ddn')};
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.code||'',e.message);}}
function context(...bundles){const c=vm.createContext({console,performance,TextEncoder,TextDecoder});for(const b of bundles)vm.runInContext(read('ddn-'+b+'.js'),c,{filename:'ddn-'+b+'.js'});return c;}
const close=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
const COS=Math.sqrt(3)/2; // cos30°, computed independently of the module

/* ---- projection math against independently computed reference values (D2) ---- */
test('project: origin, unit axes at 30°, z lifts straight up',()=>{
 assert.deepEqual(Iso.project(0,0,0),[0,0]);
 const [x1,y1]=Iso.project(100,0,0);assert.ok(close(x1,100*COS)&&close(y1,50));
 const [x2,y2]=Iso.project(0,100,0);assert.ok(close(x2,-100*COS)&&close(y2,50));
 const [x3,y3]=Iso.project(10,20,30);assert.ok(close(x3,-10*COS)&&close(y3,15-30));
 const [x4,y4]=Iso.project(50,50,10);assert.ok(close(x4,0)&&close(y4,40));
});
test('shade: top=base, left=×0.85, right=×0.7, channels clamp',()=>{
 assert.equal(Iso.shade('#337DB7',1),'#337db7');
 assert.equal(Iso.shade('#337DB7',Iso.SHADE.right),'#245880');
 assert.equal(Iso.shade('#337DB7',Iso.SHADE.left),'#2b6a9c');
 assert.equal(Iso.shade('#FFFFFF',Iso.SHADE.right),'#b3b3b3');
});
test('paintOrder is a total order: x+y back-to-front, z, then id tie-break',()=>{
 const items=[{id:'n.b',x:10,y:10,z:5},{id:'n.a',x:10,y:10,z:5},{id:'n.c',x:0,y:0,z:0},{id:'n.d',x:4,y:6,z:9}];
 assert.deepEqual(Iso.paintOrder(items).map(i=>i.id),['n.c','n.d','n.a','n.b']);
 const shuffled=[...items].reverse();
 assert.deepEqual(Iso.paintOrder(shuffled).map(i=>i.id),['n.c','n.d','n.a','n.b'],'order is input-permutation invariant');
});

/* ---- graceful missing module (D1, mirrors the B1-025 geo path) ---- */
test('iso:true without ddn-iso.js → visible placeholder + DDN-E010 diagnostic',()=>{
 const c=context('core','graph','projections');
 const r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 assert.ok(r.svg.includes('Isometric view requires ddn-iso.js')&&r.svg.includes('ddn-missing-module'));
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-E010').length,1);
 const g=context('core','graph');
 const r2=g.DDNLive.createWorkspace(ISO_GRAPH).renderSync({entry:'73-iso-architecture.ddn',view:'iso_map'});
 assert.ok(r2.svg.includes('Isometric view requires ddn-iso.js'));
 assert.equal(r2.diagnostics.filter(d=>d.code==='DDN-E010').length,1);
});
test('depth without ddn-iso.js (no iso:true) degrades to the flat render + DDN-E010, never a crash',()=>{
 const files={'72-iso-charts.ddn':ISO_CHARTS['72-iso-charts.ddn'].replace(' iso:true; depth:"x_record.load";',' depth:24px;'),'shared.ddn':ISO_CHARTS['shared.ddn']};
 const c=context('core','graph','projections');
 const r=c.DDNLive.createWorkspace(files).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 assert.ok(!r.svg.includes('ddn-missing-module')&&!r.svg.includes('ddn-iso-front'),'flat render, no placeholder');
 assert.ok(r.svg.includes('data-value="420"'),'flat bars still render');
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-E010'&&d.severity==='warning').length,1);
});
test('load-order guards name the missing bundle',()=>{
 assert.throws(()=>context('iso'),/ddn-iso requires ddn-core\.js/);
 assert.throws(()=>context('core','iso'),/ddn-iso requires ddn-graph\.js/);
});

/* ---- notation validation (D3/D8) ---- */
const baseChart=patch=>{let src=ISO_CHARTS['72-iso-charts.ddn'];for(const [a,b] of Object.entries(patch))src=src.replace(a,b);return{'72-iso-charts.ddn':src,'shared.ddn':ISO_CHARTS['shared.ddn']};};
test('iso must be boolean (DDN-ISO150); depth forms validated (DDN-ISO151)',()=>{
 const c=context('core','graph','projections','iso');
 assert.throws(()=>c.DDNLive.createWorkspace(baseChart({'iso:true; depth:"x_record.load"':'iso:"yes"; depth:"x_record.load"'})).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}),e=>e.code==='DDN-ISO150');
 assert.throws(()=>c.DDNLive.createWorkspace(baseChart({'iso:true; depth:"x_record.load"':'iso:true; depth:-5'})).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}),e=>e.code==='DDN-ISO151');
});
test('unresolvable depth binding field → DDN-ISO152',()=>{
 const c=context('core','graph','projections','iso');
 assert.throws(()=>c.DDNLive.createWorkspace(baseChart({'depth:"x_record.load"':'depth:"x_record.nope"'})).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}),e=>e.code==='DDN-ISO152');
});
test('iso/depth rejected on non-graph/chart kinds (DDN-ISO150)',()=>{
 const c=context('core','graph','projections','iso');
 const files=baseChart({'kind:chart; profile:"chart.basic@1"':'kind:timeline; profile:"timeline.basic@1"'});
 assert.throws(()=>c.DDNLive.createWorkspace(files).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}),e=>e.code==='DDN-ISO150');
});
test('depth: @data.record.field resolves a single record field as the view depth',()=>{
 const c=context('core','graph','projections','iso');
 const files=baseChart({'iso:true; depth:"x_record.load";':'iso:true; depth: @capacity.api.x_record.load;'});
 const r=c.DDNLive.createWorkspace(files).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 assert.ok(r.svg.includes('ddn-iso-front'),'extruded');
 assert.ok(r.svg.includes('data-value-depth="34"'),'api record load=34 drives the view depth');
});

/* ---- stage 1: chart extrusions (D4) ---- */
test('iso bar chart extrudes every column with per-record bound depth',()=>{
 const c=context('core','graph','projections','iso');
 const r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 for(const cls of['ddn-iso-front','ddn-iso-top','ddn-iso-side'])assert.equal((r.svg.match(new RegExp(cls,'g'))||[]).length,4,cls);
 for(const d of[26,34,18,12])assert.ok(r.svg.includes('data-value-depth="'+d+'"'),'depth '+d);
 assert.ok(r.svg.includes('<text'),'axis labels/grid stay flat-overlayed');
});
test('iso donut gets thickness walls (outer + inner) per slice',()=>{
 const c=context('core','graph','projections','iso');
 const r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:'iso_donut'});
 assert.equal((r.svg.match(/ddn-iso-thickness/g)||[]).length,4);
 assert.equal((r.svg.match(/ddn-iso-side-inner/g)||[]).length,4,'donut hole walls');
});
test('iso area renders a ribbon behind the flat fill',()=>{
 const c=context('core','graph','projections','iso');
 const r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:'iso_area'});
 assert.equal((r.svg.match(/ddn-iso-ribbon/g)||[]).length,1);
});
test('iso treemap renders leaf prisms',()=>{
 const c=context('core','graph','projections','iso');
 const r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:'iso_treemap'});
 assert.equal((r.svg.match(/ddn-iso-front/g)||[]).length,4);
});
test('iso:true on an unsupported mark warns (DDN-ISOW01) and renders flat',()=>{
 const c=context('core','graph','projections','iso');
 const files=baseChart({'mark:bar; x:"x_record.tier"':'mark:line; x:"x_record.tier"'});
 const r=c.DDNLive.createWorkspace(files).renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 assert.ok(!r.svg.includes('ddn-iso-front'));
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-ISOW01').length,1);
});

/* ---- stage 2: iso graph nodes (D5) ---- */
test('iso graph: extruded prisms, flat-computed routes projected onto the ground plane',()=>{
 const c=context('core','graph','iso');
 const r=c.DDNLive.createWorkspace(ISO_GRAPH).renderSync({entry:'73-iso-architecture.ddn',view:'iso_map'});
 for(const cls of['ddn-iso-top','ddn-iso-left','ddn-iso-right'])assert.equal((r.svg.match(new RegExp(cls,'g'))||[]).length,5,cls);
 assert.equal((r.svg.match(/ddn-iso-route/g)||[]).length,4);
 assert.ok(r.svg.includes('ddn-iso-ground'));
 assert.ok(r.svg.includes('depth 58px'),'per-element depth override (ledger 58px vs view 18px)');
 assert.equal(r.scene.projection.iso,true);
 assert.equal(r.scene.nodes.find(n=>n.id.endsWith('ledger')).depth,58);
 assert.equal(r.scene.nodes.find(n=>n.id.endsWith('client')).depth,14);
});

/* ---- refresh + SMIL transition (D6) ---- */
test('keyed refresh of the bound depth field re-renders new heights; same values byte-identical',()=>{
 const c=context('core','graph','projections','iso');
 const ws=c.DDNLive.createWorkspace(ISO_CHARTS);
 const r1=ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 const res=ws.replaceData('capacity',[
  {key:'web',tier:'Web',value:420,load:40,unit:'req/s'},
  {key:'api',tier:'API',value:610,load:20,unit:'req/s'},
  {key:'db',tier:'Database',value:380,load:18,unit:'req/s'},
  {key:'cache',tier:'Cache',value:240,load:12,unit:'req/s'}]);
 assert.equal(res.committed,true);
 const r2=ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 assert.ok(r2.svg.includes('data-value-depth="40"')&&r2.svg.includes('data-value-depth="20"'));
 assert.notEqual(r1.svg,r2.svg);
 ws.replaceData('capacity',[
  {key:'web',tier:'Web',value:420,load:26,unit:'req/s'},
  {key:'api',tier:'API',value:610,load:34,unit:'req/s'},
  {key:'db',tier:'Database',value:380,load:18,unit:'req/s'},
  {key:'cache',tier:'Cache',value:240,load:12,unit:'req/s'}]);
 assert.equal(ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}).svg,r1.svg,'restored values re-render byte-identical');
});
test('isoFrom emits a declarative SMIL transition ≤300ms; noMotion strips it',()=>{
 const c=context('core','graph','projections','iso');
 const ws=c.DDNLive.createWorkspace(ISO_CHARTS);
 const id=[...ISO_CHARTS['72-iso-charts.ddn'].matchAll(/object (\w+) /g)].map(m=>m[1]);
 const prev={depths:{},};
 const r0=ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'});
 assert.ok(!r0.svg.includes('<animate'),'no transition without isoFrom');
 const rec=uid=>uid; // scene carries source ids on marks
 const webId=r0.scene.marks.map(m=>m.sourceIds?.[0]).find(Boolean);
 const r=ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar',isoFrom:{depths:{[webId]:10}}});
 assert.ok(r.svg.includes('<animate attributeName="d"'),'SMIL transition present');
 assert.ok(r.svg.includes('dur="0.25s"'),'250ms ≤ 300ms');
 const rStill=ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar',isoFrom:{depths:{[webId]:26}}});
 assert.ok(!rStill.svg.includes('<animate'),'unchanged depth → no transition');
 const rNo=ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar',isoFrom:{depths:{[webId]:10}},noMotion:true});
 assert.ok(!rNo.svg.includes('<animate'),'noMotion strips the transition');
});

/* ---- B1-036: multi-series (quality-render) path ---- */
const MS_VIEW='iso_multiseries_bar';
test('multi-series quality chart with iso extrudes one column per series point (8 records)',()=>{
 const c=context('core','graph','quality','projections','iso');
 const r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 for(const cls of['ddn-iso-front','ddn-iso-top','ddn-iso-side'])assert.equal((r.svg.match(new RegExp(cls,'g'))||[]).length,8,cls);
 assert.ok(!r.diagnostics.some(d=>d.code==='DDN-ISOW01'),'no flat warning on the supported path');
 assert.ok(r.svg.includes('Line A / Q1')&&r.svg.includes('Line B / Q4'),'series point titles preserved');
});
test('multi-series iso painter order: within a category the back series paints first; re-render is byte-identical',()=>{
 const c=context('core','graph','quality','projections','iso');
 const ws=c.DDNLive.createWorkspace(ISO_CHARTS);
 const r=ws.renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.ok(r.svg.indexOf('Line A / Q1')>-1&&r.svg.indexOf('Line A / Q1')<r.svg.indexOf('Line B / Q1'),'Line A column before Line B in the same group');
 assert.equal(ws.renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW}).svg,r.svg,'same input → same SVG');
});
test('multi-series iso honours a per-record depth binding on the quality path',()=>{
 const c=context('core','graph','quality','projections','iso');
 const src=ISO_CHARTS['72-iso-charts.ddn'].replace('series:"x_record.line"; arrangement:group; unit:"req/s"; iso:true; depth:18px;','series:"x_record.line"; arrangement:group; unit:"req/s"; iso:true; depth:"x_record.value";');
 const r=c.DDNLive.createWorkspace({'72-iso-charts.ddn':src,'shared.ddn':ISO_CHARTS['shared.ddn']}).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.ok(r.svg.includes('data-value-depth="420"')&&r.svg.includes('data-value-depth="410"'),'per-record depths bound');
});
test('multi-series stacked bar and overlay area extrude (columns / ribbons)',()=>{
 const c=context('core','graph','quality','projections','iso');
 const stacked=ISO_CHARTS['72-iso-charts.ddn'].replace('arrangement:group','arrangement:stack');
 const r=c.DDNLive.createWorkspace({'72-iso-charts.ddn':stacked,'shared.ddn':ISO_CHARTS['shared.ddn']}).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.equal((r.svg.match(/ddn-iso-front/g)||[]).length,8,'stacked columns');
 const area=ISO_CHARTS['72-iso-charts.ddn'].replace('mark:bar; x:"x_record.quarter"; y:"x_record.value"; series:"x_record.line"; arrangement:group;','mark:area; x:"x_record.quarter"; y:"x_record.value"; series:"x_record.line"; arrangement:overlay;');
 const r2=c.DDNLive.createWorkspace({'72-iso-charts.ddn':area,'shared.ddn':ISO_CHARTS['shared.ddn']}).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.equal((r2.svg.match(/ddn-iso-ribbon/g)||[]).length,2,'one ribbon per series');
 assert.ok(!r2.diagnostics.some(d=>d.code==='DDN-ISOW01'));
});
test('iso on an unsupported quality layer mark warns (DDN-ISOW01) and renders flat',()=>{
 const c=context('core','graph','quality','projections','iso');
 const src=ISO_CHARTS['72-iso-charts.ddn'].replace('series:"x_record.line"; arrangement:group;','series:"x_record.line"; arrangement:overlay;').replace('mark:bar; x:"x_record.quarter"','mark:line; x:"x_record.quarter"');
 const r=c.DDNLive.createWorkspace({'72-iso-charts.ddn':src,'shared.ddn':ISO_CHARTS['shared.ddn']}).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.ok(!r.svg.includes('ddn-iso-front')&&!r.svg.includes('ddn-iso-ribbon'));
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-ISOW01').length,1);
});
test('iso on a quality transform chart (histogram) warns (DDN-ISOW01) and renders flat',()=>{
 const c=context('core','graph','quality','projections','iso');
 const q=f=>fs.readFileSync(path.join(root,'../website/examples/quality',f),'utf8');
 const files={};for(const f2 of['model.ddn','views.ddn','formats.ddn','details.ddn'])files[f2]=q(f2);
 files['views.ddn']=files['views.ddn'].replace('transform: "histogram"; mark: "bar";','transform: "histogram"; mark: "bar"; iso: true;');
 const r=c.DDNLive.createWorkspace(files).renderSync({entry:'views.ddn',view:'histogram'});
 assert.ok(!r.svg.includes('ddn-iso-front'));
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-ISOW01').length,1);
});
test('multi-series iso without ddn-iso.js: iso:true → placeholder + DDN-E010; depth-only → flat + DDN-E010 warning',()=>{
 let c=context('core','graph','quality','projections');
 let r=c.DDNLive.createWorkspace(ISO_CHARTS).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.ok(r.svg.includes('ddn-missing-module')&&r.svg.includes('Isometric view requires ddn-iso.js'));
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-E010').length,1);
 const files={'72-iso-charts.ddn':ISO_CHARTS['72-iso-charts.ddn'].replace('iso:true; depth:18px; width:1120px; height:640px; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}','depth:18px; width:1120px; height:640px; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}'),'shared.ddn':ISO_CHARTS['shared.ddn']};
 assert.ok(!files['72-iso-charts.ddn'].includes('iso:true; depth:18px;'),'patched depth-only');
 c=context('core','graph','quality','projections');
 r=c.DDNLive.createWorkspace(files).renderSync({entry:'72-iso-charts.ddn',view:MS_VIEW});
 assert.ok(!r.svg.includes('ddn-missing-module')&&!r.svg.includes('ddn-iso-front'),'flat render, no placeholder');
 assert.equal(r.diagnostics.filter(d=>d.code==='DDN-E010'&&d.severity==='warning').length,1);
});

/* ---- determinism (D7) ---- */
test('same input → same SVG for iso charts and iso graphs',()=>{
 const c=context('core','graph','projections','iso');
 const ws=c.DDNLive.createWorkspace(ISO_CHARTS);
 assert.equal(ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}).svg,ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_bar'}).svg);
 assert.equal(ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_treemap'}).svg,ws.renderSync({entry:'72-iso-charts.ddn',view:'iso_treemap'}).svg);
 const g=context('core','graph','iso'),gw=g.DDNLive.createWorkspace(ISO_GRAPH);
 assert.equal(gw.renderSync({entry:'73-iso-architecture.ddn',view:'iso_map'}).svg,gw.renderSync({entry:'73-iso-architecture.ddn',view:'iso_map'}).svg);
});
const passed=results.filter(r=>r.pass).length;console.log(`iso ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
