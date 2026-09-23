/* SPDX-License-Identifier: GPL-2.0-or-later. B1-024 grid/other chart marks (chart.heatmap/densityheatmap/calendar/parallelcoords/wordcloud@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const HEAD=`ddn "0.5";
module "test.gridcharts";

data cells {
    object h1 "api am" { kind: record; x_record: {"hour": "am", "ep": "api", "n": 10}; }
    object h2 "api pm" { kind: record; x_record: {"hour": "pm", "ep": "api", "n": 30}; }
    object h3 "web am" { kind: record; x_record: {"hour": "am", "ep": "web", "n": 20}; }
    object h4 "web pm" { kind: record; x_record: {"hour": "pm", "ep": "web", "n": 40}; }
}

data scatter {
    object p1 "s1" { kind: record; x_record: {"a": 1, "b": 10}; }
    object p2 "s2" { kind: record; x_record: {"a": 2, "b": 20}; }
    object p3 "s3" { kind: record; x_record: {"a": 3, "b": 30}; }
    object p4 "s4" { kind: record; x_record: {"a": 9, "b": 90}; }
}

data days {
    object d1 "d1" { kind: record; x_record: {"day": "2026-03-02", "n": 3}; }
    object d2 "d2" { kind: record; x_record: {"day": "2026-03-03", "n": 5}; }
    object d3 "d3" { kind: record; x_record: {"day": "2026-03-10", "n": 2}; }
}

data metrics {
    object m1 "a x" { kind: record; x_record: {"svc": "a", "metric": "x", "v": 1}; }
    object m2 "a y" { kind: record; x_record: {"svc": "a", "metric": "y", "v": 5}; }
    object m3 "a z" { kind: record; x_record: {"svc": "a", "metric": "z", "v": 7}; }
    object m4 "b x" { kind: record; x_record: {"svc": "b", "metric": "x", "v": 3}; }
    object m5 "b y" { kind: record; x_record: {"svc": "b", "metric": "y", "v": 5}; }
    object m6 "b z" { kind: record; x_record: {"svc": "b", "metric": "z", "v": 1}; }
}

data tags {
    object t1 "w1" { kind: record; x_record: {"tag": "alpha", "n": 30}; }
    object t2 "w2" { kind: record; x_record: {"tag": "beta", "n": 20}; }
    object t3 "w3" { kind: record; x_record: {"tag": "gamma", "n": 10}; }
}
`;
const view=(mark,ids,bindings,profile)=>`
view ${mark} "t / ${mark}" {
    data: [@cells, @scatter, @days, @metrics, @tags];
    projection { kind:chart; profile:"${profile||'chart.'+mark+'@1'}"; records:[${ids}]; mark:${mark}; ${bindings} width:1000px; height:600px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const CELLS=['h1','h2','h3','h4'].map(i=>'@cells.'+i).join(', '),SCAT=['p1','p2','p3','p4'].map(i=>'@scatter.'+i).join(', '),DAYS=['d1','d2','d3'].map(i=>'@days.'+i).join(', '),MET=['m1','m2','m3','m4','m5','m6'].map(i=>'@metrics.'+i).join(', '),TAGS=['t1','t2','t3'].map(i=>'@tags.'+i).join(', ');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(mark,ids,bindings,head=HEAD){const ws=A.createWorkspace({'main.ddn':head+view(mark,ids,bindings)});return ws.renderSync({entry:'main.ddn',view:mark});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Heatmap: 2x2 cells with values, series as rows, intensity scale',()=>{
 const r=run('heatmap',CELLS,'x:"x_record.hour"; y:"x_record.n"; series:"x_record.ep";');
 const cells=[...r.svg.matchAll(/<rect class="ddn-heatmap-cell" data-value="(\d+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(cells.sort((a,b)=>a-b),[10,20,30,40]);
 assert.equal(r.scene.marks.length,4);
 assert.equal(r.svg,run('heatmap',CELLS,'x:"x_record.hour"; y:"x_record.n"; series:"x_record.ep";').svg,'deterministic');
});

test('Heatmap refuses duplicate (column,row) and missing series with PJ137',()=>{
 const dup=HEAD.replace('object h4 "web pm" { kind: record; x_record: {"hour": "pm", "ep": "web", "n": 40}; }','object h4 "web pm" { kind: record; x_record: {"hour": "pm", "ep": "api", "n": 40}; }');
 throws(()=>run('heatmap',CELLS,'x:"x_record.hour"; y:"x_record.n"; series:"x_record.ep";',dup),'DDN-PJ137');
 throws(()=>run('heatmap',CELLS,'x:"x_record.hour"; y:"x_record.n";'),'DDN-PJ137');
});

test('Density heatmap: bin counts match the scatter distribution',()=>{
 const r=run('densityheatmap',SCAT,'x:"x_record.a"; x_type:number; y:"x_record.b"; bin_count:2;');
 const counts=[...r.svg.matchAll(/<rect class="ddn-density-cell" data-count="(\d+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(counts.reduce((a,b)=>a+b,0),4,'all records binned');
 assert.ok(r.svg.includes('2×2 grid'),'footnote');
});

test('Density heatmap refuses zero-range fields with PJ132 (UNKNOWN, not silent)',()=>{
 const flat=HEAD.replace(/"b": \d+/g,'"b": 7');
 throws(()=>run('densityheatmap',SCAT,'x:"x_record.a"; x_type:number; y:"x_record.b";',flat),'DDN-PJ132');
 throws(()=>run('densityheatmap',SCAT,'x:"x_record.a"; x_type:number; y:"x_record.b"; bin_count:61;'),'DDN-PJ131');
});

test('Calendar: one cell per day on a Monday-first UTC week grid',()=>{
 const r=run('calendar',DAYS,'x:"x_record.day"; x_type:date; y:"x_record.n";');
 const cells=[...r.svg.matchAll(/<rect class="ddn-calendar-cell" data-date="(\d{4}-\d{2}-\d{2})"/g)].map(m=>m[1]);
 assert.deepEqual(cells,['2026-03-02','2026-03-03','2026-03-10']);
 const marks=r.scene.marks;
 assert.ok(Math.abs(marks[1].x-marks[0].x)<0.01,'same week shares a column');
 assert.ok(marks[2].x>marks[0].x,'next week is one column right');
 assert.ok(Math.abs(marks[1].y-marks[2].y)<0.01,'both Tuesdays share a row');
 assert.ok(marks[1].y>marks[0].y,'Tuesday below Monday');
});

test('Calendar refuses duplicate days with PJ137',()=>{
 const dup=HEAD.replace('"day": "2026-03-10"','"day": "2026-03-02"');
 throws(()=>run('calendar',DAYS,'x:"x_record.day"; x_type:date; y:"x_record.n";',dup),'DDN-PJ137');
});

test('Parallel coordinates: one polyline per series; constant axis is UNKNOWN mid-height with PJW04',()=>{
 const r=run('parallelcoords',MET,'x:"x_record.metric"; y:"x_record.v"; series:"x_record.svc";');
 assert.equal([...r.svg.matchAll(/<path class="ddn-pc-line"/g)].length,2);
 assert.equal([...r.svg.matchAll(/<path class="ddn-pc-axis"/g)].length,3);
 assert.ok(r.diagnostics.some(d=>d.code==='DDN-PJW04'&&d.message.includes('"y"')),'constant axis y warns');
 assert.ok(r.svg.includes('stroke-dasharray="4 4"'),'constant axis dashed');
});

test('Parallel coordinates refuses <2 axes and duplicate (series,axis)',()=>{
 const dup=HEAD.replace(/"metric": "y"/g,'"metric": "x"');
 throws(()=>run('parallelcoords',MET,'x:"x_record.metric"; y:"x_record.v"; series:"x_record.svc";',dup),'DDN-PJ137');
 const one=HEAD.replace(/"metric": "y"/g,'"metric": "x"').replace(/"metric": "z"/g,'"metric": "x"');
 throws(()=>run('parallelcoords',MET,'x:"x_record.metric"; y:"x_record.v"; series:"x_record.svc";',one),'DDN-PJ135');
 throws(()=>run('parallelcoords',MET,'x:"x_record.metric"; y:"x_record.v";'),'DDN-PJ137');
});

test('Word cloud: all words placed with sqrt-scaled font sizes, deterministic',()=>{
 const r=run('wordcloud',TAGS,'x:"x_record.tag"; y:"x_record.n";');
 const words=[...r.svg.matchAll(/<text class="ddn-wordcloud-word" data-weight="(\d+)" x="[^"]*" y="[^"]*" font-size="([\d.]+)"/g)];
 assert.equal(words.length,3);
 assert.ok(Number(words[0][2])>Number(words[2][2]),'heavier words are larger');
 assert.equal(r.svg,run('wordcloud',TAGS,'x:"x_record.tag"; y:"x_record.n";').svg,'deterministic');
});

test('Word cloud refuses duplicate words and nonpositive weights',()=>{
 const dup=HEAD.replace('"tag": "gamma"','"tag": "alpha"');
 throws(()=>run('wordcloud',TAGS,'x:"x_record.tag"; y:"x_record.n";',dup),'DDN-PJ137');
 const neg=HEAD.replace('"tag": "gamma", "n": 10','"tag": "gamma", "n": 0');
 throws(()=>run('wordcloud',TAGS,'x:"x_record.tag"; y:"x_record.n";',neg),'DDN-PJ138');
});

const passed=results.filter(t=>t.pass).length;console.log('Grid charts',passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
