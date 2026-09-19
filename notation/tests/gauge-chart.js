/* SPDX-License-Identifier: GPL-2.0-or-later. Gauge/KPI chart mark (chart.gauge@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const SRC=`ddn "0.5";
module "test.gauge";

data sla {
    object q1 "SLA attainment" { kind: record; x_record: {"kpi": "SLA attainment", "value": 87, "unit": "%"}; }
}

view gauge "Synthetic SLA attainment / gauge" {
    data: [@sla];
    projection { kind:chart; profile:"chart.gauge@1"; records:[@sla.q1]; mark:gauge; x:"x_record.kpi"; y:"x_record.value"; unit:"%"; target:95; width:1120px; height:620px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'gauge',overrides});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Gauge renders 4 arc band paths, one needle mark and tick labels 0/25/50/75/100',()=>{
 const r=run();
 assert.equal([...r.svg.matchAll(/<path class="ddn-gauge-band"/g)].length,4);
 const needle=r.scene.marks.find(m=>m.angle!==undefined);
 assert.ok(needle,'scene.marks contains a needle mark with angle');
 assert.equal(needle.value,87);
 for(const v of ['0','25','50','75','100'])assert.ok(r.svg.includes('>'+v+'</text>'),'tick label '+v);
});

test('Needle geometry matches pi*(1-y/100) and stays on the dial radius',()=>{
 const r=run(),needle=r.scene.marks.find(m=>m.angle!==undefined);
 assert.ok(Math.abs(needle.angle-Math.PI*(1-0.87))<=1e-9,'angle '+needle.angle);
 const d=r.svg.match(/<path class="ddn-gauge-needle"[^>]* d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)"/);
 assert.ok(d,'needle path found');
 const [sx,sy,ex,ey]=d.slice(1).map(Number);
 assert.ok(Math.abs(sx-needle.cx)<=0.5&&Math.abs(sy-needle.cy)<=0.5,'needle starts at dial center');
 const len=Math.hypot(ex-needle.cx,ey-needle.cy);
 assert.ok(len<=needle.radius+0.5,'needle endpoint inside dial radius: '+len+' vs '+needle.radius);
 assert.ok(Math.abs(needle.cx+Math.cos(needle.angle)*len-ex)<=0.5&&Math.abs(needle.cy-Math.sin(needle.angle)*len-ey)<=0.5,'needle endpoint direction matches angle');
});

test('Target tick renders when target is set and is absent without it',()=>{
 assert.ok(run().svg.includes('class="ddn-gauge-target" data-target="95"'),'target tick present');
 assert.ok(!run(edit(' target:95;','')).svg.includes('ddn-gauge-target'),'target tick absent without target');
});

test('Caption text equals the record x value',()=>{
 assert.ok(run().svg.includes('>SLA attainment</text>'));
});

test('Two records rejected',()=>{
 const dup=SRC.replace('data sla {','data sla {\n    object q2 "Second" { kind: record; x_record: {"kpi": "Other", "value": 40, "unit": "%"}; }').replace('records:[@sla.q1]','records:[@sla.q1, @sla.q2]');
 throws(()=>run({'main.ddn':dup}),'DDN-PJ074');
});

test('Out-of-domain values rejected',()=>{
 throws(()=>run(edit('"value": 87','"value": 120')),'DDN-PJ075');
 throws(()=>run(edit('"value": 87','"value": -5')),'DDN-PJ075');
});

test('Missing value binding rejected by code',()=>throws(()=>run(edit('"value": 87','"other": 87')),'DDN-PJ032'));

test('Out-of-domain or non-numeric target rejected',()=>{
 throws(()=>run(edit('target:95;','target:140;')),'DDN-PJ075');
 throws(()=>run(edit('target:95;','target:"high";')),'DDN-PJ075');
});

test('Aggregation and series rejected for gauge',()=>{
 throws(()=>run(edit('mark:gauge;','mark:gauge; aggregate:sum;')),'DDN-PJ031');
 throws(()=>run(edit('mark:gauge;','mark:gauge; series:"x_record.kpi";')),'DDN-PJ030');
});

test('Vega-Lite adapter rejects gauge explicitly',()=>throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'gauge'}),'DDN-PJ070'));

test('Gauge with target bypasses the quality planner (native SVG, no quality transform)',()=>{
 const r=run();
 assert.ok(r.svg.includes('ddn-gauge-band'),'native gauge bands rendered despite target property');
 assert.ok(!r.scene.marks.some(m=>m.series),'no quality series plan');
});

test('Deterministic rerender',()=>assert.equal(run().svg,run().svg));

test('Profile registered in the published catalogue',()=>{
 assert.ok(A.profileCatalogue.profiles.some(x=>x.id==='chart.gauge@1'));
});

const report={runtime:A.VERSION,scope:'Gauge/KPI chart mark chart.gauge@1; native SVG semicircular dial with bands, needle and optional target; negative and determinism fixtures.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tests/validation/gauge-chart-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Gauge chart',report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
