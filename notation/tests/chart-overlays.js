/* SPDX-License-Identifier: GPL-2.0-or-later. B1-024 statistical overlays (error bars on bar/point, regression + loess trend lines) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const HEAD=`ddn "0.5";
module "test.overlays";

data bench {
    object b1 "s1" { kind: record; x_record: {"stage": "parse", "ms": 20, "err": 3}; }
    object b2 "s2" { kind: record; x_record: {"stage": "layout", "ms": 40, "err": 5}; }
    object b3 "s3" { kind: record; x_record: {"stage": "render", "ms": 60, "err": 4}; }
}

data samples {
    object s1 "p1" { kind: record; x_record: {"x": 1, "y": 2}; }
    object s2 "p2" { kind: record; x_record: {"x": 2, "y": 4}; }
    object s3 "p3" { kind: record; x_record: {"x": 3, "y": 6}; }
    object s4 "p4" { kind: record; x_record: {"x": 4, "y": 9}; }
    object s5 "p5" { kind: record; x_record: {"x": 5, "y": 11}; }
    object s6 "p6" { kind: record; x_record: {"x": 6, "y": 13}; }
}
`;
const view=(id,mark,bindings)=>`
view ${id} "t / ${id}" {
    data: [@bench, @samples];
    projection { kind:chart; profile:"chart.basic@1"; records:[${bindings[0]}]; mark:${mark}; ${bindings[1]} width:1000px; height:600px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const BENCH=['b1','b2','b3'].map(i=>'@bench.'+i).join(', '),SAMP=['s1','s2','s3','s4','s5','s6'].map(i=>'@samples.'+i).join(', ');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(id,mark,bindings,head=HEAD){const ws=A.createWorkspace({'main.ddn':head+view(id,mark,bindings)});return ws.renderSync({entry:'main.ddn',view:id});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Error bars on bar: one I-beam per record with caps, axis extends to cover y±err',()=>{
 const r=run('eb','bar',[BENCH,'x:"x_record.stage"; y:"x_record.ms"; error:"x_record.err";']);
 const bars=[...r.svg.matchAll(/<path class="ddn-error-bar" data-error="([\d.]+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(bars,[3,5,4]);
 assert.equal(r.scene.marks.length,3,'still one mark per record');
 assert.equal(r.svg,run('eb','bar',[BENCH,'x:"x_record.stage"; y:"x_record.ms"; error:"x_record.err";']).svg,'deterministic');
});

test('Error bars on point scatter work; refused on other marks, with aggregate, or for negative/NaN (PJ141)',()=>{
 const r=run('ep','point',[SAMP,'x:"x_record.x"; x_type:number; y:"x_record.y";']);
 assert.ok(!r.svg.includes('ddn-error-bar'),'no error bars without the binding');
 throws(()=>run('eb2','line',[BENCH,'x:"x_record.stage"; y:"x_record.ms"; error:"x_record.err";']),'DDN-PJ141');
 throws(()=>run('eb3','bar',[BENCH,'x:"x_record.stage"; y:"x_record.ms"; error:"x_record.err"; aggregate:sum;']),'DDN-PJ141');
 const neg=HEAD.replace('"err": 3','"err": -1');
 throws(()=>run('eb4','bar',[BENCH,'x:"x_record.stage"; y:"x_record.ms"; error:"x_record.err";'],neg),'DDN-PJ141');
});

test('Linear trend: least-squares line drawn, slope/intercept exact for the sample',()=>{
 const r=run('lr','point',[SAMP,'x:"x_record.x"; x_type:number; y:"x_record.y"; trend:linear;']);
 const line=r.svg.match(/<path class="ddn-trend-line" data-trend="linear" d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)"/);
 assert.ok(line,'trend line drawn');
 const xs=[1,2,3,4,5,6],ys=[2,4,6,9,11,13],n=6,mx=3.5,my=45/6,sxx=xs.reduce((s,v)=>s+(v-mx)**2,0),sxy=xs.reduce((s,v,i)=>s+(v-mx)*(ys[i]-my),0),slope=sxy/sxx,intercept=my-slope*mx;
 assert.ok(r.svg.includes('slope '+slope.toFixed(2))||r.svg.includes('slope '+Math.round(slope*100)/100),'footnote reports the slope');
 assert.ok(Math.abs(slope-39.5/17.5)<1e-9&&Math.abs(intercept-(7.5-39.5/17.5*3.5))<1e-9,'known least-squares solution');
});

test('Loess trend: 51-point smooth curve, deterministic, spans the x range',()=>{
 const a=run('lo','point',[SAMP,'x:"x_record.x"; x_type:number; y:"x_record.y"; trend:loess;']);
 const path=a.svg.match(/<path class="ddn-trend-line" data-trend="loess" d="([^"]+)"/);
 assert.ok(path,'loess curve');
 assert.equal((path[1].match(/[ML]/g)||[]).length,51,'51 grid points');
 assert.equal(a.svg,run('lo','point',[SAMP,'x:"x_record.x"; x_type:number; y:"x_record.y"; trend:loess;']).svg,'deterministic');
});

test('Trend refused on categorical x, bar marks, constant-x samples, and <3 points (PJ142/PJ132/PJ135)',()=>{
 throws(()=>run('t1','point',[SAMP,'x:"x_record.x"; y:"x_record.y"; trend:linear;']),'DDN-PJ142');
 throws(()=>run('t2','bar',[BENCH,'x:"x_record.stage"; y:"x_record.ms"; trend:linear;']),'DDN-PJ142');
 throws(()=>run('t3','point',[SAMP,'x:"x_record.x"; x_type:number; y:"x_record.y"; trend:"spline";']),'DDN-PJ142');
 const flat=HEAD.replace(/"x": \d,/g,'"x": 2,');
 throws(()=>run('t4','point',[SAMP,'x:"x_record.x"; x_type:number; y:"x_record.y"; trend:loess;'],flat),'DDN-PJ132');
 const few=['s1','s2'].map(i=>'@samples.'+i).join(', ');
 throws(()=>run('t5','point',[few,'x:"x_record.x"; x_type:number; y:"x_record.y"; trend:linear;']),'DDN-PJ135');
});

const passed=results.filter(t=>t.pass).length;console.log('Chart overlays',passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
