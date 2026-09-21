/* SPDX-License-Identifier: GPL-2.0-or-later. Radar/spider chart mark (chart.radar@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const entry='19-radar-chart.ddn',base=fs.readFileSync(path.resolve(__dirname,'../../website/examples/basics',entry),'utf8');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({[entry]:base,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry,view:'radar',overrides});}
const edit=(before,after)=>{assert.ok(base.includes(before),'Mutation target missing: '+before);return{[entry]:base.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const cats=['Battery','Camera','Display','Performance','Durability','Value'];
function geometry(svg){
 const spokes=[...svg.matchAll(/ddn-radar-spoke" d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/g)].map(m=>m.slice(1).map(Number));
 const cx=spokes[0][0],cy=spokes[0][1],radius=Math.hypot(spokes[0][2]-cx,spokes[0][3]-cy);
 const polys=[...svg.matchAll(/<polygon class="ddn-radar-series" data-series="([^"]+)" points="([^"]+)"/g)].map(m=>{const nums=m[2].trim().split(' ').map(Number),points=[];for(let i=0;i<nums.length;i+=2)points.push([nums[i],nums[i+1]]);return{series:m[1],points};});
 return{spokes,cx,cy,radius,polys};
}

test('Radar renders one polygon per series and one spoke per category',()=>{
 const r=run(),g=geometry(r.svg);
 assert.equal(g.spokes.length,cats.length);
 assert.equal(g.polys.length,2);
 for(const p of g.polys)assert.equal(p.points.length,cats.length);
 const marked=r.scene.marks.filter(m=>m.series);assert.equal(marked.length,2);
});

test('Polygon vertex at y=max sits on the outer ring radius',()=>{
 const r=run(),g=geometry(r.svg);
 const aurora=g.polys.find(p=>p.series==='Aurora');
 const vertex=aurora.points[cats.indexOf('Display')];// score 9 is the dataset maximum
 assert.ok(Math.abs(Math.hypot(vertex[0]-g.cx,vertex[1]-g.cy)-g.radius)<=0.5,'vertex radius '+Math.hypot(vertex[0]-g.cx,vertex[1]-g.cy)+' vs ring '+g.radius);
 const inner=aurora.points[cats.indexOf('Durability')];// score 5 of max 9
 assert.ok(Math.abs(Math.hypot(inner[0]-g.cx,inner[1]-g.cy)-g.radius*5/9)<=0.5);
});

test('Category labels appear in declared record order',()=>{
 const svg=run().svg;let at=-1;
 for(const c of cats){const i=svg.indexOf(c,at+1);assert.ok(i>at,'label out of order: '+c);at=i;}
});

test('Two categories rejected',()=>throws(()=>run(edit('records: [@facts.a1, @facts.a2, @facts.a3, @facts.a4, @facts.a5, @facts.a6, @facts.n1, @facts.n2, @facts.n3, @facts.n4, @facts.n5, @facts.n6]','records: [@facts.a1, @facts.a2]')),'DDN-PJ071'));

test('Negative value rejected',()=>throws(()=>run(edit('"score": 8, "unit": "points"}; }\n    object a2','"score": -8, "unit": "points"}; }\n    object a2')),'DDN-PJ072'));

test('Missing value rejected by code',()=>throws(()=>run(edit('"criterion": "Battery", "score": 8','"criterion": "Battery", "other": 8')),'DDN-PJ032'));

test('Aggregation rejected for radar',()=>throws(()=>run(edit('mark: radar;','mark: radar; aggregate: sum;')),'DDN-PJ031'));

test('Non-categorical x rejected for radar',()=>throws(()=>run(edit('mark: radar;','mark: radar; x_type: number;')),'DDN-PJ030'));

test('Vega-Lite adapter rejects radar explicitly',()=>throws(()=>workspace().exportVegaLite({entry,view:'radar'}),'DDN-PJ070'));

test('Deterministic rerender',()=>assert.equal(run().svg,run().svg));

test('Shared scale and profile registered',()=>{
 const p=workspace().projectionPlan(entry,'radar');
 assert.deepEqual(p.categories,cats);
 assert.deepEqual(p.series,['Aurora','Nimbus']);
 assert.ok(A.profileCatalogue.profiles.some(x=>x.id==='chart.radar@1'));
});

const report={runtime:A.VERSION,scope:'Radar/spider chart mark chart.radar@1; native SVG spokes/rings/polygons; negative and determinism fixtures.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tests/validation/radar-chart-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Radar chart',report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
