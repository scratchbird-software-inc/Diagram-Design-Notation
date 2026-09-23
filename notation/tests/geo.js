/* SPDX-License-Identifier: GPL-2.0-or-later. B1-025 ddn-geo: projection math fixtures,
 * GeoJSON ingestion, renderer registration, graceful-missing placeholder (D3). */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),results=[];
const A=require('../dist/ddn.global.js'); // reference all-in-one (never includes ddn-geo)
require('../runtime/ddn-full.js').default; // wire source namespaces for the source module below
const Geo=require('../runtime/ddn-geo.js').default;
const read=n=>fs.readFileSync(path.join(dist,n),'utf8');
const basics=f=>fs.readFileSync(path.join(root,'../website/examples/basics',f),'utf8');
const CHORO={'67-geo-choropleth.ddn':basics('67-geo-choropleth.ddn'),'shared.ddn':basics('shared.ddn')};
const WORLD=fs.readFileSync(path.join(root,'../assets/geo/world-110m.json'),'utf8');
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.code||'',e.message);}}
function context(...bundles){const c=vm.createContext({console,performance,TextEncoder,TextDecoder});for(const b of bundles)vm.runInContext(read('ddn-'+b+'.js'),c,{filename:'ddn-'+b+'.js'});return c;}
const close=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;
const rad=d=>d*Math.PI/180;

/* ---- projection math against independently computed reference values ---- */
test('mercator: origin, equator linearity, 85.051129° limit maps to π',()=>{
 assert.ok(close(Geo.projections.mercator(0,0)[0],0)&&close(Geo.projections.mercator(0,0)[1],0));
 assert.ok(close(Geo.projections.mercator(Math.PI,0)[0],Math.PI)&&close(Geo.projections.mercator(Math.PI,0)[1],0));
 assert.ok(close(Geo.projections.mercator(0,rad(85.051129))[1],Math.PI,1e-6));
 assert.ok(close(Geo.projections.mercator(0,rad(89.9))[1],Math.PI,1e-6),'clamped beyond the limit');
});
test('equirectangular is the identity on radians',()=>{
 assert.deepEqual(Geo.projections.equirectangular(rad(-73.9857),rad(40.7484)),[rad(-73.9857),rad(40.7484)]);
});
test('albers: origin is (0,0); (-96°, 37.5°) matches the published conic form',()=>{
 assert.deepEqual(Geo.projections.albers(0,0),[0,0]);
 const [x,y]=Geo.projections.albers(rad(-96),rad(37.5));
 assert.ok(close(x,-1.1036878581414347,1e-9)&&close(y,1.2351655517534073,1e-9));
});
test('equal-earth: origin, equator half-width 2.70663, north pole y 1.31736',()=>{
 assert.deepEqual(Geo.projections.equalEarth(0,0),[0,0]);
 const [x,y]=Geo.projections.equalEarth(Math.PI,0);
 assert.ok(close(x,2.7066299836960743,1e-9)&&y===0);
 assert.ok(close(Geo.projections.equalEarth(0,Math.PI/2)[1],1.317362759157413,1e-9));
 const [x2,y2]=Geo.projections.equalEarth(-2,0.7);
 assert.ok(close(x2,-1.5261654035117047,1e-9)&&close(y2,0.7764946462831419,1e-9));
});

/* ---- GeoJSON ingestion ---- */
test('ingest accepts FeatureCollection/Feature/bare geometry; Point and MultiPoint kept',()=>{
 assert.equal(Geo.ingest(WORLD).features.length,177);
 assert.equal(Geo.ingest({type:'Feature',properties:{name:'x'},geometry:{type:'Point',coordinates:[1,2]}}).features[0].name,'x');
 assert.equal(Geo.ingest({type:'MultiPoint',coordinates:[[1,2],[3,4]]}).features.length,1);
});
test('ingest rejects unsupported geometry with DDN-PJ147',()=>{
 assert.throws(()=>Geo.ingest({type:'LineString',coordinates:[[0,0],[1,1]]}),e=>e.code==='DDN-PJ147');
});
test('ingest rejects non-finite and out-of-range coordinates with DDN-PJ146',()=>{
 assert.throws(()=>Geo.ingest({type:'Point',coordinates:[0,95]}),e=>e.code==='DDN-PJ146');
 assert.throws(()=>Geo.ingest({type:'Point',coordinates:[0,NaN]}),e=>e.code==='DDN-PJ146');
});
test('geoPath splits antimeridian crossings instead of streaking',()=>{
 const geo={type:'Polygon',coordinates:[[[170,10],[-170,10],[-170,20],[170,20],[170,10]]]};
 const d=Geo.geoPath(geo,pt=>pt);
 assert.ok((d.match(/M/g)||[]).length>=2,'path broken at the antimeridian: '+d);
 assert.ok(d.endsWith('Z'));
});

/* ---- graceful missing behavior (D3) ---- */
test('global bundle (no ddn-geo): geo view renders the placeholder plus coded DDN-E010, never silent',()=>{
 const r=A.createWorkspace(CHORO).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'});
 assert.ok(r.svg.includes('<svg')&&r.svg.includes('Map view requires ddn-geo.js')&&r.svg.includes('ddn-missing-module'));
 assert.equal(r.scene.projection.kind,'geo');
 const d=r.diagnostics.filter(x=>x.code==='DDN-E010');
 assert.equal(d.length,1);
 assert.equal(d[0].severity,'error');
 assert.ok(d[0].message.includes('ddn-geo.js'));
});
test('placeholder is deterministic; other kinds keep the hard DDN-E010',()=>{
 const a=A.createWorkspace(CHORO).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'}).svg;
 assert.equal(a,A.createWorkspace(CHORO).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'}).svg);
 const c=context('core');
 assert.throws(()=>c.DDNLive.createWorkspace(CHORO).projectionPlan('67-geo-choropleth.ddn','choropleth'),e=>e.code==='DDN-E010','plan stays a hard error');
 const CHART={'20-funnel-chart.ddn':basics('20-funnel-chart.ddn'),'shared.ddn':basics('shared.ddn')};
 const c2=context('core','graph');
 assert.throws(()=>c2.DDNLive.createWorkspace(CHART).renderSync({entry:'20-funnel-chart.ddn',view:'funnel'}),e=>e.code==='DDN-E010','non-optional kinds still throw');
});
test('core+graph without geo: placeholder, not a throw',()=>{
 const c=context('core','graph');
 const r=c.DDNLive.createWorkspace(CHORO).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'});
 assert.ok(r.svg.includes('Map view requires ddn-geo.js'));
 assert.equal(r.diagnostics.filter(x=>x.code==='DDN-E010').length,1);
});
test('core+graph+geo renders the choropleth; double load is a no-op',()=>{
 const c=context('core','graph','geo');
 vm.runInContext(read('ddn-geo.js'),c,{filename:'ddn-geo.js again'});
 assert.ok(c.DDNEngine.hasRenderer('geo'));
 c.DDNGeo.registerGeography('assets/geo/world-110m.json',JSON.parse(WORLD));
 const r=c.DDNLive.createWorkspace(CHORO).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'});
 assert.ok(r.svg.includes('ddn-mark-geo-choropleth'));
 assert.ok(!r.svg.includes('Map view requires'));
 assert.equal(r.diagnostics.filter(x=>x.code==='DDN-E010').length,0);
 const pj=r.diagnostics.find(x=>x.code==='DDN-PJW05');
 assert.ok(pj&&pj.severity==='info','unmatched features/records are reported, not silent');
 assert.equal(r.scene.projection.kind,'geo');
 assert.ok(r.scene.marks.length>150);
});

/* ---- renderer validation codes ---- */
function geoContext(){const c=context('core','graph','geo');c.DDNGeo.registerGeography('world',JSON.parse(WORLD));c.DDNGeo.registerGeography('assets/geo/world-110m.json',JSON.parse(WORLD));return c;}
function geoView(mut){
 const files={...CHORO};
 files['67-geo-choropleth.ddn']=mut(files['67-geo-choropleth.ddn']);
 return files;
}
test('unknown method rejected with DDN-PJ143',()=>{
 const c=geoContext();
 assert.throws(()=>c.DDNLive.createWorkspace(geoView(s=>s.replace('method:equalEarth','method:orthographic'))).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'}),e=>e.code==='DDN-PJ143');
});
test('unregistered geography rejected with DDN-PJ144',()=>{
 const c=geoContext();
 assert.throws(()=>c.DDNLive.createWorkspace(geoView(s=>s.replace('assets/geo/world-110m.json','nowhere-map'))).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'}),e=>e.code==='DDN-PJ144');
});
test('inline GeoJSON record geography resolves through @ref',()=>{
 const c=geoContext();
 const tiny=JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',id:'840',properties:{name:'United States'},geometry:{type:'Polygon',coordinates:[[[-125,25],[-66,25],[-66,49],[-125,49],[-125,25]]]}}]});
 const files=geoView(s=>s
  .replace('data indicators {','data inline {\n    object us "US outline" { kind: record; x_record: '+tiny+'; }\n}\n\ndata indicators {')
  .replace('data: [@indicators];','data: [@inline, @indicators];')
  .replace('geography:"assets/geo/world-110m.json"','geography: @inline.us'));
 const r=c.DDNLive.createWorkspace(files).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'});
 assert.ok(r.svg.includes('ddn-mark-geo-choropleth'));
});
test('choropleth binding violations: missing value DDN-PJ145, duplicate key DDN-PJ148',()=>{
 const c=geoContext();
 assert.throws(()=>c.DDNLive.createWorkspace(geoView(s=>s.replace('value:"x_record.value"','value:"x_record.id"'))).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'}),e=>e.code==='DDN-PJ145');
 assert.throws(()=>c.DDNLive.createWorkspace(geoView(s=>s.replace('"id": "156", "value": 74','"id": "840", "value": 74'))).renderSync({entry:'67-geo-choropleth.ddn',view:'choropleth'}),e=>e.code==='DDN-PJ148');
});
test('symbol map: out-of-range longitude rejected with DDN-PJ146',()=>{
 const c=geoContext();
 const sym={'68-geo-symbols.ddn':basics('68-geo-symbols.ddn'),'shared.ddn':basics('shared.ddn')};
 assert.throws(()=>c.DDNLive.createWorkspace({...sym,'68-geo-symbols.ddn':sym['68-geo-symbols.ddn'].replace('"lon": 141.3','"lon": 241.3')}).renderSync({entry:'68-geo-symbols.ddn',view:'symbols'}),e=>e.code==='DDN-PJ146');
});
test('symbol map renders through the dist bundle; deterministic rerender',()=>{
 const c=geoContext();
 const sym={'68-geo-symbols.ddn':basics('68-geo-symbols.ddn'),'shared.ddn':basics('shared.ddn')};
 const ws=c.DDNLive.createWorkspace(sym);
 const a=ws.renderSync({entry:'68-geo-symbols.ddn',view:'symbols'});
 assert.ok(a.svg.includes('ddn-mark-geo-symbol')&&a.svg.includes('ddn-graticule')===false);
 assert.ok(a.svg.includes('<circle'));
 assert.equal(a.svg,ws.renderSync({entry:'68-geo-symbols.ddn',view:'symbols'}).svg);
});
test('outline plate renders all four methods',()=>{
 const c=geoContext();
 const files={'69-geo-projections.ddn':basics('69-geo-projections.ddn'),'shared.ddn':basics('shared.ddn')};
 const ws=c.DDNLive.createWorkspace(files);
 for(const v of ['mercator','equirectangular','albers','equalearth']){
  const r=ws.renderSync({entry:'69-geo-projections.ddn',view:v});
  assert.ok(r.svg.includes('ddn-mark-geo-outline')&&r.svg.includes('ddn-graticule'),v);
 }
});

/* ---- the optional asset stays inside its budget ---- */
test('world-110m asset: valid FeatureCollection within the ~100KB budget',()=>{
 const bytes=Buffer.byteLength(WORLD);
 assert.ok(bytes<=117760,'asset over budget: '+bytes);
 const doc=JSON.parse(WORLD);
 assert.equal(doc.type,'FeatureCollection');
 assert.ok(doc.features.every(ft=>['Polygon','MultiPolygon'].includes(ft.geometry.type)));
 assert.ok(doc.features.every(ft=>ft.id!==undefined||ft.properties.name.length>0),'features carry an id or a name (disputed territories join by name)');
});

const report={tests:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length};
console.log(JSON.stringify(report));if(report.failed)process.exitCode=1;
