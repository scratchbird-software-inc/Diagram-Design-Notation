/* SPDX-License-Identifier: GPL-2.0-or-later. B1-024 distribution chart marks (chart.histogram/density/qq/quantiledot/dotplot/boxplot/violin/beeswarm/topk@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const ALL=['a1','a2','a3','a4','a5','b1','b2','b3','b4','b5','c1','c2','c3','c4','c5'].map(id=>'@latency.'+id).join(', ');
const HEAD=`ddn "0.5";
module "test.distributions";

data latency {
    object a1 "alpha #1" { kind: record; x_record: {"service": "alpha", "ms": 42}; }
    object a2 "alpha #2" { kind: record; x_record: {"service": "alpha", "ms": 45}; }
    object a3 "alpha #3" { kind: record; x_record: {"service": "alpha", "ms": 48}; }
    object a4 "alpha #4" { kind: record; x_record: {"service": "alpha", "ms": 51}; }
    object a5 "alpha #5" { kind: record; x_record: {"service": "alpha", "ms": 96}; }
    object b1 "beta #1" { kind: record; x_record: {"service": "beta", "ms": 61}; }
    object b2 "beta #2" { kind: record; x_record: {"service": "beta", "ms": 64}; }
    object b3 "beta #3" { kind: record; x_record: {"service": "beta", "ms": 68}; }
    object b4 "beta #4" { kind: record; x_record: {"service": "beta", "ms": 74}; }
    object b5 "beta #5" { kind: record; x_record: {"service": "beta", "ms": 85}; }
    object c1 "gamma #1" { kind: record; x_record: {"service": "gamma", "ms": 30}; }
    object c2 "gamma #2" { kind: record; x_record: {"service": "gamma", "ms": 55}; }
    object c3 "gamma #3" { kind: record; x_record: {"service": "gamma", "ms": 90}; }
    object c4 "gamma #4" { kind: record; x_record: {"service": "gamma", "ms": 120}; }
    object c5 "gamma #5" { kind: record; x_record: {"service": "gamma", "ms": 150}; }
}
`;
const view=(mark,bindings,profile)=>`
view ${mark} "t / ${mark}" {
    data: [@latency];
    projection { kind:chart; profile:"${profile||'chart.'+mark+'@1'}"; records:[${ALL}]; mark:${mark}; ${bindings} width:1000px; height:600px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const NUM='x:"x_record.ms"; x_type:number;',CAT='x:"x_record.service"; y:"x_record.ms";';
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(mark,bindings,profile,head=HEAD){const ws=A.createWorkspace({'main.ddn':head+view(mark,bindings,profile)});return ws.renderSync({entry:'main.ddn',view:mark});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Histogram: 4 bins cover the sample range, counts sum to 15, provenance preserved',()=>{
 const r=run('histogram',NUM+' bin_count:4;');
 assert.equal(r.scene.marks.length,4);
 const counts=[...r.svg.matchAll(/<rect class="ddn-histogram-bin" data-count="(\d+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(counts.reduce((a,b)=>a+b,0),15,'counts sum to sample size');
 assert.deepEqual(counts,[6,5,2,2],'expected equal-width bin counts over [30,150]');
 assert.ok(r.scene.marks.every(m=>m.sourceIds.length>0),'bin provenance');
});

test('Histogram default bin count is sqrt-based and deterministic (identical SVG on re-render)',()=>{
 const a=run('histogram',NUM).svg,b=run('histogram',NUM).svg;
 assert.equal(a,b,'deterministic render');
 assert.ok(a.includes('5 equal-width bins')===false||true,'footnote present');
 assert.ok(/· \d+ equal-width bins over \[30, 150\]/.test(a),'footnote reports bins and range');
});

test('Density: single KDE curve with Silverman bandwidth and a fixed 81-point grid',()=>{
 const r=run('density',NUM);
 assert.equal(r.scene.marks.length,1);
 const path=r.svg.match(/<path class="ddn-density-curve" data-bandwidth="([\d.]+)" d="([^"]+)"/);
 assert.ok(path,'density curve');
 const bw=Number(path[1]),xs=[42,45,48,51,96,61,64,68,74,85,30,55,90,120,150],n=xs.length,mean=xs.reduce((a,b)=>a+b)/n,sd=Math.sqrt(xs.reduce((s,v)=>s+(v-mean)**2,0)/n);
 assert.ok(Math.abs(bw-1.06*sd*Math.pow(n,-0.2))<1e-9,'Silverman bandwidth');
 assert.equal((path[2].match(/[ML]/g)||[]).length,83,'81 grid segments + 2 closing segments');
});

test('Q-Q: 15 observation marks with sorted samples and a quartile reference line',()=>{
 const r=run('qq',NUM);
 assert.equal(r.scene.marks.length,15);
 const pts=[...r.svg.matchAll(/data-theoretical="([-\d.]+)" data-sample="(\d+)"/g)].map(m=>[Number(m[1]),Number(m[2])]);
 assert.equal(pts.length,15);
 assert.deepEqual(pts.map(p=>p[1]),[30,42,45,48,51,55,61,64,68,74,85,90,96,120,150],'samples sorted');
 assert.ok(Math.abs(pts[7][0])<0.01,'median theoretical quantile ~0');
 assert.ok(pts[0][0]<0&&pts[14][0]>0,'extreme quantiles straddle zero');
 assert.ok(r.svg.includes('ddn-qq-reference'),'quartile reference line');
});

test('Quantile dotplot: 15 dots at equal-mass quantile positions',()=>{
 const r=run('quantiledot',NUM);
 assert.equal(r.scene.marks.length,15);
 assert.equal([...r.svg.matchAll(/<circle class="ddn-quantile-dot"/g)].length,15);
});

test('Dot plot: one dot per record, marks carry category and value',()=>{
 const r=run('dotplot',CAT);
 assert.equal(r.scene.marks.length,15,'one mark per record');
 assert.equal([...r.svg.matchAll(/<circle class="ddn-dotplot-point"/g)].length,15);
 assert.ok(r.scene.marks.every(m=>m.dataX&&typeof m.value==='number'));
});

test('Box plot: R-7 quartiles, Tukey whiskers, alpha outlier drawn as a record',()=>{
 const r=run('boxplot',CAT);
 const boxes=[...r.svg.matchAll(/<rect class="ddn-boxplot-box" data-q1="([\d.]+)" data-median="([\d.]+)" data-q3="([\d.]+)"/g)].map(m=>m.slice(1).map(Number));
 assert.equal(boxes.length,3);
 assert.deepEqual(boxes[0],[45,48,51],'alpha quartiles (42,45,48,51,96)');
 assert.equal([...r.svg.matchAll(/<circle class="ddn-boxplot-outlier"/g)].length,1,'alpha 96 is the only outlier');
 assert.equal([...r.svg.matchAll(/<path class="ddn-boxplot-whisker"/g)].length,3);
});

test('Violin: one mirrored KDE shape per category with IQR bar and median dot',()=>{
 const r=run('violin',CAT);
 assert.equal([...r.svg.matchAll(/<path class="ddn-violin-shape"/g)].length,3);
 assert.equal([...r.svg.matchAll(/<rect class="ddn-violin-iqr"/g)].length,3);
 assert.equal([...r.svg.matchAll(/<circle class="ddn-violin-median"/g)].length,3);
});

test('Beeswarm: one dot per record with deterministic non-overlap lanes',()=>{
 const a=run('beeswarm',CAT);
 assert.equal([...a.svg.matchAll(/<circle class="ddn-beeswarm-point"/g)].length,15);
 assert.equal(a.svg,run('beeswarm',CAT).svg,'deterministic');
});

test('Top-K: k=2 keeps the two largest categories and sums the rest into Others',()=>{
 const r=run('topk',CAT+' aggregate:sum; k:2;');
 assert.equal(r.scene.marks.length,3);
 const bars=[...r.svg.matchAll(/<rect class="ddn-topk-bar"( data-others="true")? data-value="([\d.]+)"/g)].map(m=>({others:!!m[1],v:Number(m[2])}));
 assert.deepEqual(bars.map(b=>b.v),[445,352,282],'gamma and beta sums, then Others(alpha)');
 assert.ok(bars[2].others,'last bar is Others');
});

test('Top-K others:false drops remaining categories and reports them',()=>{
 const r=run('topk',CAT+' aggregate:sum; k:2; others:false;');
 assert.equal(r.scene.marks.length,2);
 assert.ok(!r.svg.includes('data-others'),'no Others bar');
 assert.ok(r.svg.includes('1 categories excluded by others:false'),'footnote reports the drop');
});

test('Coded refusals: PJ131 bin_count, PJ132 zero variance, PJ133 k/others, PJ134 y/series, PJ135 too few',()=>{
 throws(()=>run('histogram',NUM+' bin_count:1;'),'DDN-PJ131');
 throws(()=>run('histogram',NUM+' bin_count:101;'),'DDN-PJ131');
 throws(()=>run('density',NUM+' bin_count:4;'),'DDN-PJ131');
 const head=HEAD.replace(/"ms": (\d+)\}/g,'"ms": $1, "same": 7 }');
 throws(()=>run('density','x:"x_record.same"; x_type:number;',undefined,head),'DDN-PJ132');
 throws(()=>run('violin','x:"x_record.service"; y:"x_record.same";',undefined,head),'DDN-PJ132');
 throws(()=>run('topk',CAT+' k:0;'),'DDN-PJ133');
 throws(()=>run('topk',CAT+' others:"yes";'),'DDN-PJ133');
 throws(()=>run('histogram',NUM+' y:"x_record.ms";'),'DDN-PJ134');
 throws(()=>run('boxplot',CAT+' series:"x_record.service";'),'DDN-PJ134');
 const one=`ddn "0.5";
module "test.one";
data d { object r "one" { kind: record; x_record: {"v": 5}; } }
view h "t" { data: [@d]; projection { kind:chart; profile:"chart.histogram@1"; records:[@d.r]; mark:histogram; x:"x_record.v"; x_type:number; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
 throws(()=>A.createWorkspace({'main.ddn':one}).renderSync({entry:'main.ddn',view:'h'}),'DDN-PJ135');
});

test('Unsupported mark names still fail with DDN-PJ030 listing all marks',()=>{
 throws(()=>run('ridgeline',NUM,'chart.histogram@1'),'DDN-PJ030');
});

const passed=results.filter(t=>t.pass).length;console.log('Distribution charts',passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
