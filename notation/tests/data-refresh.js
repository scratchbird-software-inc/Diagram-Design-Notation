/* SPDX-License-Identifier: GPL-2.0-or-later. B1-006 ws.replaceData: swap data-block records only. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const fail=(fn,code)=>assert.throws(fn,e=>e.code===code);

const source=`ddn "0.5";
module "tests.refresh";

data metrics {
    object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }
    object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20, unit: "ms" }; }
    object m3 "Gamma" { kind: record; x_record: { label: "Gamma", value: 15, unit: "ms" }; }
}

data cells {
    object r1 "Inbound" { kind: object; }
    object r2 "Outbound" { kind: object; }
    object c1 "Desktop" { kind: team; }
    object c2 "Mobile" { kind: team; }
    relation x1 "A" @r1 -> @c1 { kind: assoc; x_record: { score: 3 }; }
    relation x2 "B" @r1 -> @c2 { kind: assoc; x_record: { score: 5 }; }
    relation x3 "C" @r2 -> @c1 { kind: assoc; x_record: { score: 1 }; }
    relation x4 "D" @r2 -> @c2 { kind: assoc; x_record: { score: 4 }; }
}

data empty {
}

view chart_view "Refresh / chart" {
    data: [@metrics];
    projection { kind: chart; profile: "chart.basic@1"; records: [@metrics.m1, @metrics.m2, @metrics.m3]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; width: 900px; height: 560px; }
    publication { size: content; fit: none; }
}

view graph_view "Refresh / graph" {
    data: [@metrics];
    publication { size: content; fit: none; }
}

view matrix_view "Refresh / matrix" {
    data: [@cells];
    projection { kind: matrix; profile: "matrix.relations@1"; rows: [@cells.r1, @cells.r2]; columns: [@cells.c1, @cells.c2]; relation: "assoc"; value: "x_record.score"; }
    publication { size: content; fit: none; }
}
`;
const files={'fixture.ddn':source};
const views=['chart_view','graph_view','matrix_view'];
const fresh=()=>A.createWorkspace(files);
const renderAll=ws=>Object.fromEntries(views.map(v=>[v,ws.renderSync({entry:'fixture.ddn',view:v})]));
const texts=svg=>[...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1]);
const metrics=ws=>ws.resolve('fixture.ddn','chart_view').elements.map(e=>({...e.properties.x_record}));
const cellScores=ws=>ws.projectionPlan('fixture.ddn','matrix_view').cells.flat(2).map(c=>c.raw);

// D3 first clause: same values -> every view renders byte-identical SVG.
test('Same-values refresh re-renders every view byte-identical',()=>{
 const ws=fresh(),before=renderAll(ws);
 const r=ws.replaceData('metrics',metrics(ws));
 assert.ok(r.revision>=1&&Array.isArray(r.diagnostics));
 assert.ok(ws.replaceData('cells',cellScores(ws).map(score=>({score}))).revision>=1);
 const after=renderAll(ws);
 for(const v of views)assert.equal(after[v].svg,before[v].svg,v+' SVG changed on a same-values refresh');
 for(const v of views)assert.equal(after[v].modelFingerprint,before[v].modelFingerprint);
});

// D3 second clause: changed values -> graph byte-identical; chart/matrix differ in marks only.
test('Changed values: graph byte-identical, chart marks move, frame texts identical',()=>{
 const ws=fresh(),before=renderAll(ws);
 ws.replaceData('metrics',[{label:'Alpha',value:16,unit:'ms'},{label:'Beta',value:8,unit:'ms'},{label:'Gamma',value:20,unit:'ms'}]);
 const after=renderAll(ws);
 assert.equal(after.graph_view.svg,before.graph_view.svg,'graph view without data binding must be byte-identical');
 assert.notEqual(after.chart_view.svg,before.chart_view.svg);
 assert.deepEqual(texts(after.chart_view.svg),texts(before.chart_view.svg),'axis/title/footer text nodes must be identical');
 const bm=before.chart_view.scene.marks,am=after.chart_view.scene.marks;
 assert.equal(bm.length,am.length);
 for(let i=0;i<bm.length;i++){assert.equal(am[i].x,bm[i].x);assert.equal(am[i].w,bm[i].w);assert.notEqual(am[i].y,bm[i].y,'bar geometry must move');assert.notEqual(am[i].value,bm[i].value);}
});
test('Changed values: matrix cell marks differ, headers and frame identical',()=>{
 const ws=fresh(),before=renderAll(ws);
 ws.replaceData('cells',[{score:9},{score:2},{score:6},{score:1}]);
 const after=renderAll(ws);
 assert.notEqual(after.matrix_view.svg,before.matrix_view.svg);
 assert.deepEqual(cellScores(ws),[9,2,6,1]);
 const strip=svg=>texts(svg).filter(t=>!/^\d+$/.test(t));
 assert.deepEqual(strip(after.matrix_view.svg),strip(before.matrix_view.svg),'row/column/title text nodes must be identical');
 assert.deepEqual(texts(after.graph_view.svg),texts(before.graph_view.svg));
});

// D2 shape contract, all with source untouched.
test('Extra or missing record keys rejected DDN-E011; source untouched',()=>{
 const ws=fresh(),before=ws.getFiles();
 fail(()=>ws.replaceData('metrics',[{label:'A',value:1,unit:'ms',extra:2},{label:'B',value:2,unit:'ms'},{label:'C',value:3,unit:'ms'}]),'DDN-E011');
 fail(()=>ws.replaceData('metrics',[{label:'A',value:1},{label:'B',value:2},{label:'C',value:3}]),'DDN-E011');
 fail(()=>ws.replaceData('cells',[{score:1,other:2}]),'DDN-E011');
 assert.deepEqual(ws.getFiles(),before);assert.equal(ws.revision,0);
});
test('Unknown block name rejected DDN-E002; source untouched',()=>{
 const ws=fresh(),before=ws.getFiles();
 fail(()=>ws.replaceData('nope',[]),'DDN-E002');
 assert.deepEqual(ws.getFiles(),before);assert.equal(ws.revision,0);
});
test('Malformed record payloads rejected with coded errors; source untouched',()=>{
 const ws=fresh(),before=ws.getFiles();
 fail(()=>ws.replaceData('metrics','not-an-array'),'DDN-E011');
 fail(()=>ws.replaceData('metrics',[{label:'A',value:NaN,unit:'ms'}]),'DDN-E011');
 fail(()=>ws.replaceData('metrics',[null]),'DDN-E011');
 fail(()=>ws.replaceData('',[]),'DDN-E001');
 assert.deepEqual(ws.getFiles(),before);
});

// D4 determinism.
test('Determinism: identical calls on identical sources produce identical source',()=>{
 const recs=[{label:'Alpha',value:16,unit:'ms'},{label:'Beta',value:8,unit:'ms'},{label:'Gamma',value:20,unit:'ms'}];
 const a=fresh(),b=fresh();
 a.replaceData('metrics',recs);b.replaceData('metrics',recs);
 assert.equal(a.getFiles()['fixture.ddn'],b.getFiles()['fixture.ddn']);
 a.replaceData('metrics',recs); // repeat on rewritten source
 assert.equal(a.getFiles()['fixture.ddn'],b.getFiles()['fixture.ddn'],'a second identical call must not drift');
});

test('Revision increments exactly once per changing refresh',()=>{
 const ws=fresh();assert.equal(ws.revision,0);
 const r=ws.replaceData('metrics',[{label:'Alpha',value:1,unit:'ms'},{label:'Beta',value:2,unit:'ms'},{label:'Gamma',value:3,unit:'ms'}]);
 assert.equal(ws.revision,1);assert.equal(r.revision,1);
 assert.deepEqual(r.diagnostics,[]);
});

test('Record count can grow: new record declarations get deterministic ids and render',()=>{
 const ws=fresh();
 ws.replaceData('metrics',[...metrics(ws),{label:'Delta',value:12,unit:'ms'}]);
 const text=ws.getFiles()['fixture.ddn'];
 assert.match(text,/object metrics_r4 "metrics_r4" \{ kind: record; x_record: \{ "label": "Delta", "value": 12, "unit": "ms" \}; \}/);
 assert.equal(ws.resolve('fixture.ddn','graph_view').elements.length,4);
 ws.replaceData('metrics',[...metrics(ws).slice(0,3),{label:'Epsilon',value:9,unit:'ms'},{label:'Zeta',value:5,unit:'ms'}]);
 assert.match(ws.getFiles()['fixture.ddn'],/object metrics_r5 /,'id counter continues deterministically');
});
test('Record count can shrink: trailing record lines removed, workspace still validates',()=>{
 const ws=fresh();
 ws.replaceData('cells',[{score:8},{score:7}]);
 const text=ws.getFiles()['fixture.ddn'];
 assert.doesNotMatch(text,/relation x3 /);assert.doesNotMatch(text,/relation x4 /);
 assert.match(text,/relation x2 /);
 assert.deepEqual(cellScores(ws),[8,7]);
 const r=ws.renderSync({entry:'fixture.ddn',view:'matrix_view'});
 assert.match(r.svg,/<svg/);
});

// B1-029 D1–D6: keyed matching, membership reporting, transactional validation,
// removal rejection, empty result sets and the refresh result object.
const graphOnly=`ddn "0.5";
module "tests.refresh.graphonly";

data metrics {
    object m1 "Alpha" { kind: record; x_record: { label: "Alpha", value: 10, unit: "ms" }; }
    object m2 "Beta" { kind: record; x_record: { label: "Beta", value: 20, unit: "ms" }; }
    object m3 "Gamma" { kind: record; x_record: { label: "Gamma", value: 15, unit: "ms" }; }
}

view graph_view "Refresh / graph only" {
    data: [@metrics];
    publication { size: content; fit: none; }
}
`;
const emptyStates=`ddn "0.5";
module "tests.refresh.empty";

data metrics {
}

data other {
    object o1 "One" { kind: record; x_record: { label: "One", value: 5, unit: "ms" }; }
}

view chart_view "Empty / chart" {
    data: [@metrics];
    projection { kind: chart; profile: "chart.basic@1"; records: []; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; }
    publication { size: content; fit: none; }
}

view table_view "Empty / table" {
    data: [@metrics];
    projection { kind: table; profile: "table.records@1"; records: []; columns: [{ key: "x_record.label", label: "Route" }, { key: "x_record.value", label: "p95" }]; }
    publication { size: content; fit: none; }
}

view graph_view "Empty / graph" {
    data: [@metrics];
    publication { size: content; fit: none; }
}

view chart_filtered "Empty / filtered" {
    data: [@other];
    projection { kind: chart; profile: "chart.basic@1"; records: [@other.o1]; mark: bar; x: "x_record.label"; y: "x_record.value"; unit: "ms"; filter: { key: "x_record.label", op: "eq", value: "Nope" }; }
    publication { size: content; fit: none; }
}
`;

// Bug 3 (identity corruption on reorder): keyed refresh matches by key, never by position.
test('Keyed reorder preserves declaration identity (D1)',()=>{
 const ws=fresh();
 const r=ws.replaceData('metrics',[{key:'m3',label:'Gamma',value:99,unit:'ms'},{key:'m1',label:'Alpha',value:11,unit:'ms'},{key:'m2',label:'Beta',value:22,unit:'ms'}]);
 assert.equal(r.committed,true);assert.deepEqual([...r.updated].sort(),['m1','m2','m3']);assert.deepEqual(r.added,[]);assert.deepEqual(r.removed,[]);
 assert.deepEqual(metrics(ws),[{label:'Alpha',value:11,unit:'ms'},{label:'Beta',value:22,unit:'ms'},{label:'Gamma',value:99,unit:'ms'}],'values must stay with their declaration identities');
});
test('Keyed refresh adds and removes by declared id (D1)',()=>{
 const ws=A.createWorkspace({'fixture.ddn':graphOnly});
 const r=ws.replaceData('metrics',[{key:'m2',label:'Beta',value:8,unit:'ms'},{key:'delta',label:'Delta',value:4,unit:'ms'}]);
 assert.equal(r.committed,true);assert.deepEqual(r.added,['delta']);assert.deepEqual([...r.removed].sort(),['m1','m3']);assert.deepEqual(r.updated,['m2']);
 const text=ws.getFiles()['fixture.ddn'];
 assert.match(text,/object delta "delta"/);assert.doesNotMatch(text,/object m1 /);
 assert.equal(ws.resolve('fixture.ddn','graph_view').elements.length,2);
});
test('Record keys are all-or-nothing, valid identifiers and unique; source untouched',()=>{
 const ws=fresh(),before=ws.getFiles();
 fail(()=>ws.replaceData('metrics',[{key:'m1',label:'A',value:1,unit:'ms'},{label:'B',value:2,unit:'ms'},{key:'m3',label:'C',value:3,unit:'ms'}]),'DDN-E011');
 fail(()=>ws.replaceData('metrics',[{key:'m1',label:'A',value:1,unit:'ms'},{key:'m1',label:'B',value:2,unit:'ms'},{key:'m3',label:'C',value:3,unit:'ms'}]),'DDN-E011');
 fail(()=>ws.replaceData('metrics',[{key:'bad key!',label:'A',value:1,unit:'ms'},{key:'m2',label:'B',value:2,unit:'ms'},{key:'m3',label:'C',value:3,unit:'ms'}]),'DDN-E011');
 fail(()=>ws.replaceData('metrics',[{key:'m1',label:'A',value:1,unit:'ms',extra:1},{key:'m2',label:'B',value:2,unit:'ms'},{key:'m3',label:'C',value:3,unit:'ms'}]),'DDN-E011');
 assert.deepEqual(ws.getFiles(),before);assert.equal(ws.revision,0);
});

// Bug 4 (type mismatch committed): field types are validated against the block's
// declared/coerced field types before commit, in keyed and positional mode.
test('Type mismatch rejected at commit DDN-E012; transaction leaves source untouched (D3)',()=>{
 const ws=fresh(),before=ws.getFiles();
 const r=ws.replaceData('metrics',[{key:'m1',label:'Alpha',value:'fast',unit:'ms'},{key:'m2',label:'Beta',value:20,unit:'ms'},{key:'m3',label:'Gamma',value:15,unit:'ms'}]);
 assert.equal(r.committed,false);assert.equal(ws.revision,0);assert.deepEqual(ws.getFiles(),before);
 const d=r.diagnostics[0];assert.equal(d.code,'DDN-E012');assert.equal(d.failure,'type-mismatch');assert.equal(d.record,'m1');assert.equal(d.field,'value');
 const r2=ws.replaceData('metrics',[{label:'Alpha',value:1,unit:'ms'},{label:'Beta',value:'x',unit:'ms'},{label:'Gamma',value:3,unit:'ms'}]);
 assert.equal(r2.committed,false);assert.equal(r2.diagnostics[0].record,'m2');assert.deepEqual(ws.getFiles(),before);
 for(const v of views)assert.match(ws.renderSync({entry:'fixture.ddn',view:v}).svg,/<svg/);
});

// Bug 2 (removal breaks next render): removal of a view-referenced record is rejected
// transactionally (D4, option a) — never committed-then-failing.
test('Removing a view-referenced record is rejected transactionally (D4)',()=>{
 const ws=fresh(),before=ws.getFiles();
 const r=ws.replaceData('metrics',[{key:'m1',label:'Alpha',value:1,unit:'ms'},{key:'m3',label:'Gamma',value:3,unit:'ms'}]);
 assert.equal(r.committed,false);assert.equal(ws.revision,0);assert.deepEqual(ws.getFiles(),before);
 const d=r.diagnostics.find(x=>x.failure==='removed-record-referenced');
 assert.ok(d,'expected a removed-record-referenced diagnostic');assert.equal(d.code,'DDN-E012');assert.equal(d.view,'chart_view');assert.equal(d.record,'m2');
 for(const v of views)assert.match(ws.renderSync({entry:'fixture.ddn',view:v}).svg,/<svg/);
});

// Bug 1 (membership not re-evaluated): selector-membership views re-resolve after
// refresh; explicit-membership views keep exactly their bound records and the result
// REPORTS the added records they do not display (D2).
test('Added records: selector views re-resolve; explicit views reported DDN-W015 (D2)',()=>{
 const ws=fresh();
 const r=ws.replaceData('metrics',[{key:'m1',label:'Alpha',value:1,unit:'ms'},{key:'m2',label:'Beta',value:2,unit:'ms'},{key:'m3',label:'Gamma',value:3,unit:'ms'},{key:'m4',label:'Delta',value:4,unit:'ms'}]);
 assert.equal(r.committed,true);assert.deepEqual(r.added,['m4']);
 assert.equal(ws.resolve('fixture.ddn','graph_view').elements.length,4,'selector-membership view picks up the added record');
 const chart=ws.renderSync({entry:'fixture.ddn',view:'chart_view'});
 assert.equal(chart.scene.marks.length,3,'explicit-membership view keeps exactly its bound records');
 const w=r.diagnostics.find(d=>d.code==='DDN-W015');
 assert.ok(w,'expected a DDN-W015 membership diagnostic');assert.equal(w.view,'chart_view');assert.deepEqual(w.addedRecordsNotVisible,['m4']);
});

// Bug 5 (empty result set fails): a block MAY be refreshed to empty when no view binds
// its records explicitly; declared-empty records render empty states, never fabricated data.
test('Empty refresh: rejected under explicit bindings; legal for selector-only blocks (D5)',()=>{
 const ws=fresh(),before=ws.getFiles();
 const r=ws.replaceData('metrics',[]);
 assert.equal(r.committed,false,'chart_view explicitly references m1..m3');assert.equal(ws.revision,0);assert.deepEqual(ws.getFiles(),before);
 assert.ok(r.diagnostics.some(d=>d.failure==='removed-record-referenced'&&d.record==='m1'));
 const ws2=A.createWorkspace({'fixture.ddn':graphOnly});
 const r2=ws2.replaceData('metrics',[]);
 assert.equal(r2.committed,true);assert.deepEqual([...r2.removed].sort(),['m1','m2','m3']);
 assert.match(ws2.renderSync({entry:'fixture.ddn',view:'graph_view'}).svg,/<svg/,'graph renders its empty canvas with title');
 const r3=ws.replaceData('empty',[]);
 assert.equal(r3.committed,true);assert.equal(r3.revision,0);assert.deepEqual(ws.getFiles(),before,'empty-on-empty is a no-op');
 fail(()=>ws.replaceData('empty',[{a:1}]),'DDN-E011');
});
test('Declared-empty records render empty states: chart axes, table header, graph canvas (D5)',()=>{
 const ws=A.createWorkspace({'fixture.ddn':emptyStates});
 const chart=ws.renderSync({entry:'fixture.ddn',view:'chart_view'});
 assert.match(chart.svg,/<svg/);assert.equal(chart.scene.marks.length,0);assert.match(chart.svg,/intentionally empty data set/);
 const table=ws.renderSync({entry:'fixture.ddn',view:'table_view'});
 assert.match(table.svg,/<svg/);assert.equal(table.scene.marks.length,0);assert.match(table.svg,/Route/,'table renders its header row');
 assert.match(ws.renderSync({entry:'fixture.ddn',view:'graph_view'}).svg,/<svg/);
 fail(()=>ws.renderSync({entry:'fixture.ddn',view:'chart_filtered'}),'DDN-PJ012');
});

// check() after refresh: CLI validation passes on the rewritten source.
test('CLI check passes on refreshed source',()=>{
 const ws=fresh();
 ws.replaceData('metrics',[{label:'Alpha',value:16,unit:'ms'},{label:'Beta',value:8,unit:'ms'},{label:'Gamma',value:20,unit:'ms'}]);
 ws.replaceData('cells',[{score:9},{score:2},{score:6},{score:1}]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ddn-refresh-'));
 fs.writeFileSync(path.join(dir,'fixture.ddn'),ws.getFiles()['fixture.ddn']);
 const out=cp.spawnSync(process.execPath,[path.join(root,'notation/cli/cli.js'),'check','fixture.ddn','--workspace','.'],{encoding:'utf8',cwd:dir});
 assert.equal(out.status,0,out.stdout+out.stderr);
 for(const v of views)assert.match(ws.renderSync({entry:'fixture.ddn',view:v}).svg,/<svg/);
 fs.rmSync(dir,{recursive:true,force:true});
});

const passed=results.filter(r=>r.pass).length;console.log(`Data refresh ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
