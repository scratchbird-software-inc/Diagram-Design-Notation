/* SPDX-License-Identifier: GPL-2.0-or-later. B1-008 spacing hints: tight|normal|loose|expanded on views and formats. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);}}
const fail=(fn,code)=>assert.throws(fn,e=>e.code===code);

// Multi-view fixture: three graph views sharing one model and one format.
const fixture=spacing=>`ddn "0.3";
module "tests.spacing";
data model {
 object a "Alpha" { kind: object; }
 object b "Beta" { kind: object; }
 object c "Gamma" { kind: object; }
 object d "Delta" { kind: object; }
 relation r1 "A deliberately long relationship label used for reservation checks" @a -> @b { kind: assoc; }
 relation r2 "links" @b -> @c { kind: assoc; }
 relation r3 "feeds" @c -> @d { kind: assoc; }
 relation r4 "audits" @a -> @d { kind: assoc; }
}
format fmts {
 layout lay { algorithm: grid; columns: 2; }
 bundle plain { layout: @lay; }
 bundle wide { spacing: loose; layout: @lay; }
}
view main "Spacing fixture / main" { data: [@model]; format: @fmts.plain; ${spacing} publication { size: content; fit: none; } }
view second "Spacing fixture / second" { data: [@model]; format: @fmts.plain; ${spacing} publication { size: content; fit: none; } }
`;
const formatFixture=(viewDecl,bundle)=>`ddn "0.3";
module "tests.spacing";
data model {
 object a "Alpha" { kind: object; }
 object b "Beta" { kind: object; }
 relation r1 "A deliberately long relationship label used for reservation checks" @a -> @b { kind: assoc; }
}
format fmts {
 layout lay { algorithm: grid; columns: 2; }
 bundle wide { spacing: loose; layout: @lay; }
 bundle plain { layout: @lay; }
}
view main "Spacing fixture / format" { data: [@model]; format: @fmts.${bundle}; ${viewDecl} publication { size: content; fit: none; } }
`;
const chartFixture=spacing=>`ddn "0.3";
module "tests.spacing.chart";
data metrics {
 object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10 }; }
 object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20 }; }
}
view main "Spacing fixture / chart" {
 data: [@metrics]; ${spacing}
 projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2]; mark: bar; x: "x_record.label"; y: "x_record.value"; width: 900px; height: 560px; }
 publication { size: content; fit: none; }
}
`;
const render=(src,view='main')=>A.createWorkspace({'fixture.ddn':src}).renderSync({entry:'fixture.ddn',view});

// --- Enum acceptance on views and formats ---
test('enum accepted on views: tight, normal, loose, expanded',()=>{
 for(const level of ['tight','normal','loose','expanded'])assert.ok(render(fixture(`spacing: ${level};`)).svg.startsWith('<?xml'),level);
});
test('enum accepted on a format (bundle) declaration',()=>{
 for(const level of ['tight','normal','loose','expanded']){
  const src=formatFixture('','plain').replace('bundle plain { layout: @lay; }',`bundle plain { spacing: ${level}; layout: @lay; }`);
  assert.ok(render(src).svg.startsWith('<?xml'),level);
 }
});
test('bad view spacing value rejected as DDN033',()=>fail(()=>render(fixture('spacing: roomy;')),'DDN033'));
test('bad format spacing value rejected as DDN033',()=>{
 const src=formatFixture('','plain').replace('bundle plain { layout: @lay; }','bundle plain { spacing: roomy; layout: @lay; }');
 fail(()=>render(src),'DDN033');
});
test('spacing inside a layout group is an unknown property (DDN033)',()=>{
 const src=fixture('').replace('layout lay { algorithm: grid; columns: 2; }','layout lay { algorithm: grid; columns: 2; spacing: loose; }');
 fail(()=>render(src),'DDN033');
});

// --- D3: normal == omitted, byte-identical on a multi-view fixture ---
test('normal equals omitted byte-identically on every view of a multi-view fixture',()=>{
 for(const view of ['main','second'])assert.equal(render(fixture('spacing: normal;'),view).svg,render(fixture(''),view).svg);
});

// --- Precedence ---
test('format-level spacing applies when the view omits it',()=>{
 assert.equal(render(formatFixture('','wide')).svg,render(formatFixture('spacing: loose;','plain')).svg);
});
test('view spacing wins over format spacing',()=>{
 assert.equal(render(formatFixture('spacing: tight;','wide')).svg,render(formatFixture('spacing: tight;','plain')).svg);
 assert.notEqual(render(formatFixture('spacing: tight;','wide')).svg,render(formatFixture('','wide')).svg);
});

// --- Monotonic spread of the canvas ---
const spreadFixture=spacing=>`ddn "0.3";
module "tests.spacing.spread";
data m {
 object a "Alpha" { kind: object; }
 object b "Beta" { kind: object; }
 object c "Gamma" { kind: object; }
 object d "Delta" { kind: object; }
 relation r1 "links" @a -> @b { kind: assoc; }
 relation r2 "feeds" @b -> @d { kind: assoc; }
 relation r3 "audits" @a -> @c { kind: assoc; }
 relation r4 "owns" @c -> @d { kind: assoc; }
}
format fmts { layout lay { algorithm: grid; columns: 2; gap: 120px; row_gap: 170px; } bundle plain { layout: @lay; } }
view main "Spread" { data: [@m]; format: @fmts.plain; ${spacing} publication { size: content; fit: none; } }
`;
test('canvas width and height spread monotonically tight < normal < loose < expanded',()=>{
 const dim=level=>render(spreadFixture(`spacing: ${level};`)).scene;
 const t=dim('tight'),n=dim('normal'),l=dim('loose'),e=dim('expanded');
 assert.ok(t.width<n.width&&n.width<l.width&&l.width<e.width,`width ${t.width} ${n.width} ${l.width} ${e.width}`);
 assert.ok(t.height<n.height&&n.height<l.height&&l.height<e.height,`height ${t.height} ${n.height} ${l.height} ${e.height}`);
});

// --- Label reservation: long label sits on its route inside the scaled reserved band ---
const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(!l)return Math.hypot(p[0]-a[0],p[1]-a[1]);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const segs=ps=>ps.slice(1).map((b,i)=>[ps[i],b]);
const hit=(rect,a,b,m)=>{const x1=rect.x-m,y1=rect.y-m,x2=rect.x+rect.w+m,y2=rect.y+rect.h+m;
 if(Math.abs(a[1]-b[1])<1e-9)return a[1]>y1&&a[1]<y2&&Math.max(a[0],b[0])>x1&&Math.min(a[0],b[0])<x2;
 if(Math.abs(a[0]-b[0])<1e-9)return a[0]>x1&&a[0]<x2&&Math.max(a[1],b[1])>y1&&Math.min(a[1],b[1])<y2;
 return false;};
test('at expanded the long label lies on its own route and keeps the scaled reserved band clear',()=>{
 const scene=render(fixture('spacing: expanded;')).scene;
 const long=scene.routes.find(r=>r.label.w>200),others=scene.routes.filter(r=>r!==long);
 assert.ok(long,'a route carries the long label');
 const center=[long.label.x+long.label.w/2,long.label.y+long.label.h/2];
 assert.ok(segs(long.points).some(([a,b])=>dist(center,a,b)<1),'label centre lies on its own route');
 // The route-label reservation margin is round(8*factor): 16px at expanded.
 for(const r of others)for(const [a,b] of segs(r.points))assert.ok(!hit(long.label,a,b,16),'unrelated route stays outside the 16px reserved band');
});
test('reservation margin scales: an unrelated route may pass inside the tight band but not the expanded one',()=>{
 const bandClear=(scene,m)=>scene.routes.every(r=>scene.routes.filter(o=>o!==r).every(o=>segs(o.points).every(([a,b])=>!hit(r.label,a,b,m))));
 assert.ok(bandClear(render(fixture('spacing: normal;')).scene,8));
 assert.ok(bandClear(render(fixture('spacing: expanded;')).scene,16));
});

// --- Graph-family hint: fixed-grid projections ignore spacing (documented, no warning) ---
test('chart projection output is byte-identical with and without spacing',()=>{
 assert.equal(render(chartFixture('spacing: expanded;')).svg,render(chartFixture('')).svg);
});

// --- Determinism ---
test('renders are deterministic at every spacing level',()=>{
 for(const level of ['tight','normal','loose','expanded'])assert.equal(render(fixture(`spacing: ${level};`)).svg,render(fixture(`spacing: ${level};`)).svg);
});

const passed=results.filter(r=>r.pass).length;
console.log(`Spacing hints ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
