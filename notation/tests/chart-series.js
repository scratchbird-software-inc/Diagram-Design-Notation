/* SPDX-License-Identifier: GPL-2.0-or-later. DDN quantitative multi-series +
 * stacking (0.9 roadmap closure item, spec ch. 19/22): pins the
 * chart.quality@1 contract — grouped bars, multi-line, stacked bars/areas,
 * percent stacks, overlay layers, series_missing gap/zero/error, arc
 * exclusion from series/stacking, and the coded-error surface. The feature
 * shipped in 0.7 (ch. 22); this suite is the 0.9 conformance pin. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default;
require('../runtime/ddn-quality-data.js');require('../runtime/ddn-quality-render.js');
const R=require('../runtime/ddn-projections.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const rec=(id,stage,ser,v)=>'  record '+id+' "'+ser+' / '+stage+'" {x_record: { "stage": "'+stage+'", "series": "'+ser+'", "count": '+v+', "unit": "defects" }; }';
const FULL=[rec('a1','Incoming','alpha',10),rec('a2','In-process','alpha',14),rec('a3','Final','alpha',6),rec('b1','Incoming','beta',6),rec('b2','In-process','beta',9),rec('b3','Final','beta',5)];
const GAP=[rec('a1','Incoming','alpha',10),rec('a2','In-process','alpha',14),rec('a3','Final','alpha',6),rec('b1','Incoming','beta',6)];
const src=(rows,extra)=>'ddn "0.6";\nmodule "m";\ndata series {\n'+rows.join('\n')+'\n}\nview v { data: [@series]; projection { kind: "chart"; profile: "chart.quality@1"; records: ['+rows.map(r=>'@series.'+r.trim().split(' ')[1]).join(', ')+']; x: "x_record.stage"; y: "x_record.count"; series: "x_record.series"; unit: "defects"; '+extra+' } }';
const render=(rows,extra)=>R.render(DDN.build({'m.ddn':src(rows,extra)},'m.ddn','v',reg).ir,reg);
const build=(rows,extra)=>code(()=>render(rows,extra));

test('multiple series: grouped bars paint one slot group per series per category',()=>{
 const out=render(FULL,'mark: "bar"; arrangement: "group";');
 const marks=out.scene.marks;
 assert.equal(marks.length,6,'six series×category marks');
 assert.equal(new Set(marks.map(m=>m.series)).size,2,'two series');
 const xsBySeries={};for(const m of marks)(xsBySeries[m.series]??=[]).push(m.x);
 assert.ok(Math.abs(xsBySeries.alpha[0]-xsBySeries.beta[0])>1,'grouped: separate x slots per series within a category');
 assert.ok(/alpha/.test(out.svg)&&/beta/.test(out.svg),'series legend present');
});

test('multi-line and overlay arrangements render per-series paths',()=>{
 const line=render(FULL,'mark: "line"; arrangement: "group";');
 const seriesSeen=new Set((line.scene.marks||[]).map(m=>m.series));
 assert.ok(seriesSeen.has('alpha')&&seriesSeen.has('beta'),'two series in scene marks');
 const layers=render(FULL,'mark: "bar"; arrangement: "overlay"; layers: [{ "series": "alpha", "mark": "bar" }, { "series": "beta", "mark": "line" }];');
 assert.ok(layers.svg.length>1000&&layers.scene.marks.length===6,'mixed bar+line overlay paints');
});

test('stacked bars: cumulative offsets, totals add up per category',()=>{
 const out=render(FULL,'mark: "bar"; arrangement: "stack";');
 const marks=out.scene.marks;
 const byCat={};for(const m of marks)(byCat[m.title.split('/')[1].split(':')[0].trim()]??=[]).push(m);
 for(const [cat,ms] of Object.entries(byCat)){
  ms.sort((a,b)=>a.start-b.start);
  assert.equal(ms[0].start,0,cat+': stack starts at zero');
  const total=ms.reduce((a,m)=>a+m.value,0);
  assert.ok(Math.abs(ms.at(-1).end-total)<1e-9,cat+': stack end equals the category total ('+total+')');
 }
});

test('percent stacks: normalized to 100 with raw values retained',()=>{
 const out=render(FULL,'mark: "bar"; arrangement: "percent";');
 const byCat={};for(const m of out.scene.marks)(byCat[m.title.split('/')[1].split(':')[0].trim()]??=[]).push(m);
 for(const [cat,ms] of Object.entries(byCat)){
  assert.ok(Math.abs(ms.reduce((a,m)=>a+m.value,0)-100)<1e-6,cat+': percent stack sums to 100');
  assert.ok(ms.every(m=>typeof m.rawValue==='number'),cat+': raw values retained on marks');
 }
});

test('stacked area renders with signed cumulative offsets',()=>{
 const out=render(FULL,'mark: "area"; arrangement: "stack";');
 const seriesSeen=new Set((out.scene.marks||[]).map(m=>m.series));
 assert.ok(seriesSeen.has('alpha')&&seriesSeen.has('beta'),'two stacked areas in scene');
 const over=render(FULL,'mark: "area"; arrangement: "overlay";');
 const pick=(o,ser)=>o.scene.marks.filter(m=>m.series===ser).sort((a,b)=>a.x-b.x)[0];
 const stB=pick(out,'beta'),ovB=pick(over,'beta'),stA=pick(out,'alpha');
 assert.ok(Math.abs(stB.x-stA.x)<1e-9,'same category slot');
 assert.ok(stB.y<stA.y,'beta stacks above alpha (cumulative offset) at the same x');
 assert.ok(Math.abs(ovB.y-stB.y)>1,'overlay puts beta at its own value — stacking genuinely offsets');
});

test('series_missing: gap rejects stacks, zero fills synthetically, error is strict',()=>{
 assert.equal(build(GAP,'mark: "bar"; arrangement: "stack";'),'DDN-QC022','stack with a missing cell rejects (gap default)');
 assert.equal(build(GAP,'mark: "bar"; arrangement: "stack"; series_missing: "gap";'),'DDN-QC022','explicit gap rejects too');
 const zero=render(GAP,'mark: "bar"; arrangement: "stack"; series_missing: "zero";');
 assert.ok(zero.scene.marks.some(m=>m.synthetic===true),'zero-fill creates an explicitly synthetic mark');
 assert.equal(build(GAP,'mark: "bar"; arrangement: "stack"; series_missing: "error";'),'DDN-QC022','error policy rejects');
 assert.equal(build(GAP,'mark: "bar"; arrangement: "stack"; series_missing: "bogus";'),'DDN-QC020','unknown policy is DDN-QC020');
});

test('arcs are excluded from series and stacking (chart.basic domain)',()=>{
 assert.equal(build(FULL,'mark: "pie";'),'DDN-QC001','pie rejected under chart.quality@1');
 assert.equal(build(FULL,'mark: "donut";'),'DDN-QC001','donut rejected under chart.quality@1');
});

test('determinism: identical multi-series renders are byte-identical',()=>{
 const a=render(FULL,'mark: "bar"; arrangement: "stack";').svg;
 const b=render(FULL,'mark: "bar"; arrangement: "stack";').svg;
 assert.equal(a,b,'deterministic');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' chart-series tests passed');
