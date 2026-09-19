/* SPDX-License-Identifier: GPL-2.0-or-later. Funnel chart mark (chart.funnel@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const SRC=`ddn "0.5";
module "test.funnel";

data f {
    object s1 "Visits" { kind: record; x_record: {"stage": "Visits", "value": 1200, "unit": "deals"}; }
    object s2 "Signups" { kind: record; x_record: {"stage": "Signups", "value": 480, "unit": "deals"}; }
    object s3 "Trials" { kind: record; x_record: {"stage": "Trials", "value": 210, "unit": "deals"}; }
    object s4 "Qualified" { kind: record; x_record: {"stage": "Qualified", "value": 96, "unit": "deals"}; }
    object s5 "Closed" { kind: record; x_record: {"stage": "Closed", "value": 42, "unit": "deals"}; }
}

view funnel "Synthetic sales pipeline / funnel" {
    data: [@f];
    projection { kind:chart; profile:"chart.funnel@1"; records:[@f.s1, @f.s2, @f.s3, @f.s4, @f.s5]; mark:funnel; x:"x_record.stage"; y:"x_record.value"; unit:"deals"; width:1120px; height:620px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'funnel',overrides});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const stages=['Visits','Signups','Trials','Qualified','Closed'];

test('Funnel renders one projection mark group and one trapezoid path per stage',()=>{
 const r=run();
 assert.equal(r.scene.marks.length,5);
 assert.equal([...r.svg.matchAll(/<path data-value="/g)].length,5);
 assert.equal([...r.svg.matchAll(/data-projection-mark="/g)].length,5);
});

test('Band widths are proportional to stage values',()=>{
 const m=run().scene.marks,ratio=m[0].w/m[1].w,expected=1200/480;
 assert.ok(Math.abs(ratio-expected)<=0.5,'width ratio '+ratio+' vs value ratio '+expected);
});

test('All bands are centered on one vertical axis',()=>{
 const m=run().scene.marks,axis=m[0].x+m[0].w/2;
 for(const b of m)assert.ok(Math.abs(b.x+b.w/2-axis)<=0.5,'band off axis: '+(b.x+b.w/2)+' vs '+axis);
});

test('Stage labels appear in declaration order',()=>{
 const svg=run().svg;let at=-1;
 for(const s of stages){const i=svg.indexOf(s,at+1);assert.ok(i>at,'label out of order: '+s);at=i;}
});

test('Too few stages rejected',()=>throws(()=>run(edit('records:[@f.s1, @f.s2, @f.s3, @f.s4, @f.s5]','records:[@f.s1]')),'DDN-PJ073'));

test('Negative stage value rejected',()=>throws(()=>run(edit('"value": 210','"value": -210')),'DDN-PJ107'));

test('Missing value binding rejected by code',()=>throws(()=>run(edit('"value": 1200','"other": 1200')),'DDN-PJ032'));

test('Duplicate stage label rejected',()=>throws(()=>run(edit('"stage": "Signups"','"stage": "Visits"')),'DDN-PJ036'));

test('Aggregation rejected for funnel',()=>throws(()=>run(edit('mark:funnel;','mark:funnel; aggregate:sum;')),'DDN-PJ031'));

test('Series binding rejected for funnel',()=>throws(()=>run(edit('mark:funnel;','mark:funnel; series:"x_record.stage";')),'DDN-PJ030'));

test('Non-categorical x rejected for funnel',()=>throws(()=>run(edit('mark:funnel;','mark:funnel; x_type:number;')),'DDN-PJ030'));

test('Vega-Lite adapter rejects funnel explicitly',()=>throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'funnel'}),'DDN-PJ070'));

test('Deterministic rerender',()=>assert.equal(run().svg,run().svg));

test('Stage categories and profile registered',()=>{
 const p=workspace().projectionPlan('main.ddn','funnel');
 assert.deepEqual(p.categories,stages);
 assert.ok(A.profileCatalogue.profiles.some(x=>x.id==='chart.funnel@1'));
});

const report={runtime:A.VERSION,scope:'Funnel chart mark chart.funnel@1; native SVG trapezoid stage bands; negative and determinism fixtures.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tests/validation/funnel-chart-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Funnel chart',report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
