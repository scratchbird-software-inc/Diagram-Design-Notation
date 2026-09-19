/* SPDX-License-Identifier: GPL-2.0-or-later. Sankey diagram mark (chart.sankey@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const SRC=`ddn "0.5";
module "test.sankey";

data flows {
    object f1 "grid → heating" { kind: record; x_record: {"source": "grid", "target": "heating", "value": 40, "unit": "MWh"}; }
    object f2 "grid → it" { kind: record; x_record: {"source": "grid", "target": "it", "value": 30, "unit": "MWh"}; }
    object f3 "gas → heating" { kind: record; x_record: {"source": "gas", "target": "heating", "value": 35, "unit": "MWh"}; }
    object f4 "solar → it" { kind: record; x_record: {"source": "solar", "target": "it", "value": 15, "unit": "MWh"}; }
    object f5 "heating → building_a" { kind: record; x_record: {"source": "heating", "target": "building_a", "value": 45, "unit": "MWh"}; }
    object f6 "heating → building_b" { kind: record; x_record: {"source": "heating", "target": "building_b", "value": 30, "unit": "MWh"}; }
    object f7 "it → building_a" { kind: record; x_record: {"source": "it", "target": "building_a", "value": 45, "unit": "MWh"}; }
}

view sankey "Synthetic energy flow across three stages / sankey" {
    data: [@flows];
    projection { kind:chart; profile:"chart.sankey@1"; records:[@flows.f1, @flows.f2, @flows.f3, @flows.f4, @flows.f5, @flows.f6, @flows.f7]; mark:sankey; x:"x_record.source"; target:"x_record.target"; y:"x_record.value"; unit:"MWh"; width:1120px; height:620px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'sankey',overrides});}
const plan=(changes={})=>workspace(changes).projectionPlan('main.ddn','sankey');
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const ribbons=r=>r.scene.marks.filter(m=>m.value!==undefined&&typeof m.x==='number');
const nodes=r=>r.scene.marks.filter(m=>m.depth!==undefined);

test('Renders 7 nodes in BFS depth columns and 7 ribbon marks',()=>{
 const p=plan(),r=run();
 assert.equal(p.flow.nodes.length,7,'flow.nodes.length');
 const depth=Object.fromEntries(p.flow.nodes.map(n=>[n.name,n.depth]));
 assert.deepEqual(depth,{grid:0,heating:1,it:1,gas:0,solar:0,building_a:2,building_b:2});
 assert.equal(p.flow.links.length,7);
 assert.equal(ribbons(r).length,7,'7 ribbon marks with value and path geometry');
 for(const m of ribbons(r))assert.ok(m.w>0&&m.h>0,'ribbon box');
 assert.equal(nodes(r).length,7,'7 node box marks');
 assert.equal((r.svg.match(/class="ddn-sankey-ribbon"/g)||[]).length,7);
});

test('Ribbon thickness is proportional to value (45 vs 40 is exactly 45/40)',()=>{
 const r=run(),rs=ribbons(r),byValue=v=>rs.find(m=>m.value===v);
 const ratio=byValue(45).h/byValue(40).h;
 assert.ok(Math.abs(ratio-45/40)<=0.5,'thickness ratio '+ratio);
 assert.ok(Math.abs(byValue(30).h/byValue(15).h-2)<=0.5,'30 vs 15');
});

test('Node height encodes max(inflow, outflow): heating 75 vs it 45',()=>{
 const r=run(),ns=nodes(r);
 const heating=ns.reduce((a,m)=>a.h>m.h?a:m),it=ns.filter(m=>m.depth===1).find(m=>m!==heating);
 assert.ok(Math.abs(heating.h/it.h-75/45)<=0.5,'heating/it height ratio '+(heating.h/it.h));
});

test('Column x positions increase with depth',()=>{
 const r=run(),ns=nodes(r);
 for(const d of [0,1])assert.ok(Math.max(...ns.filter(m=>m.depth===d).map(m=>m.x))<Math.min(...ns.filter(m=>m.depth===d+1).map(m=>m.x)),'depth '+d+' before '+(d+1));
 assert.ok(new Set(ns.map(m=>m.x)).size===3,'three distinct column x positions');
});

test('Duplicate (source,target) pair stacks in declaration order as an 8th ribbon',()=>{
 const c=edit('object f2 "grid → it"','object f1b "grid → heating again" { kind: record; x_record: {"source": "grid", "target": "heating", "value": 10, "unit": "MWh"}; }\n    object f2 "grid → it"')
  ,src=Object.values(c)[0].replace('records:[@flows.f1, @flows.f2','records:[@flows.f1, @flows.f1b, @flows.f2');
 const r=run({'main.ddn':src}),rs=ribbons(r);
 assert.equal(rs.length,8,'8 ribbons');
 const gh=rs.filter(m=>m.value===40||m.value===10);
 assert.equal(gh.length,2);
 assert.ok(gh[0].value===40&&gh[1].value===10,'declaration order preserved');
 assert.ok(gh[1].y>=gh[0].y,'second ribbon stacks below the first at the source side');
});

test('Cycle rejected as DDN-PJ079',()=>{
 throws(()=>run(edit('object f7 "it → building_a" { kind: record; x_record: {"source": "it", "target": "building_a", "value": 45, "unit": "MWh"}; }','object f7 "building_a → grid" { kind: record; x_record: {"source": "building_a", "target": "grid", "value": 45, "unit": "MWh"}; }')),'DDN-PJ079');
});

test('Nonpositive, missing and mistyped flow values rejected',()=>{
 throws(()=>run(edit('"value": 40,','"value": 0,')),'DDN-PJ108');
 throws(()=>run(edit('"value": 40,','"value": -10,')),'DDN-PJ108');
 throws(()=>run(edit('"value": 40, "unit": "MWh"','"unit": "MWh"')),'DDN-PJ032');
 throws(()=>run(edit('target:"x_record.target";','target:5;')),'DDN-PJ030');
});

test('Aggregation rejected and Vega-Lite adapter declines sankey',()=>{
 throws(()=>run(edit('mark:sankey;','mark:sankey; aggregate:sum;')),'DDN-PJ031');
 throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'sankey'}),'DDN-PJ070');
});

test('Deterministic rerender',()=>assert.equal(run().svg,run().svg));

test('Profile registered in the published catalogue',()=>{
 const p=A.profileCatalogue.profiles.find(x=>x.id==='chart.sankey@1');
 assert.ok(p);assert.deepEqual(p.diagramFamilies,['Sankey/flow diagram']);
 assert.ok(p.unsupported.includes('cyclic flows'));
});

const report={runtime:A.VERSION,scope:'Sankey mark chart.sankey@1; BFS depth columns, ribbon thickness proportional to value, duplicate-pair stacking, cycle/positivity/binding validation, determinism fixtures.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../tests/validation/sankey-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Sankey',report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
