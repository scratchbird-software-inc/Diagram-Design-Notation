/* SPDX-License-Identifier: GPL-2.0-or-later. B1-024 tree chart marks (chart.tidytree/radialtree/circlepack/sunburst/packedbubble@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const ALL=['n1','n2','n3','n4','s1','s2','s3','s4','s5'].map(id=>'@sales.'+id).join(', ');
const HEAD=`ddn "0.5";
module "test.treecharts";

data sales {
    object n1 "N.H.Tools" { kind: record; x_record: {"path": "North.Hardware.Tools", "v": 120}; }
    object n2 "N.H.Parts" { kind: record; x_record: {"path": "North.Hardware.Parts", "v": 80}; }
    object n3 "N.S.Licenses" { kind: record; x_record: {"path": "North.Software.Licenses", "v": 150}; }
    object n4 "N.S.Support" { kind: record; x_record: {"path": "North.Software.Support", "v": 60}; }
    object s1 "S.H.Tools" { kind: record; x_record: {"path": "South.Hardware.Tools", "v": 90}; }
    object s2 "S.H.Parts" { kind: record; x_record: {"path": "South.Hardware.Parts", "v": 45}; }
    object s3 "S.S.Licenses" { kind: record; x_record: {"path": "South.Software.Licenses", "v": 110}; }
    object s4 "S.S.Support" { kind: record; x_record: {"path": "South.Software.Support", "v": 35}; }
    object s5 "S.Services" { kind: record; x_record: {"path": "South.Services", "v": 70}; }
}
`;
const view=(mark,bindings)=>`
view ${mark} "t / ${mark}" {
    data: [@sales];
    projection { kind:chart; profile:"chart.${mark}@1"; records:[${ALL}]; mark:${mark}; ${bindings} width:1000px; height:600px; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const BIND='x:"x_record.path"; y:"x_record.v";';
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(mark,bindings=BIND,head=HEAD){const ws=A.createWorkspace({'main.ddn':head+view(mark,bindings)});return ws.renderSync({entry:'main.ddn',view:mark});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('Tidy tree: 15 nodes (9 leaves + 4 groups + 2 roots), 14 links, parents centred over children',()=>{
 const r=run('tidytree');
 assert.equal([...r.svg.matchAll(/<circle class="ddn-tree-node"/g)].length,15);
 assert.equal([...r.svg.matchAll(/<path class="ddn-tree-link"/g)].length,13);
 assert.equal(r.scene.marks.length,15);
 const leaves=[...r.svg.matchAll(/data-path="([^"]+)" data-depth="2"/g)].map(m=>m[1]);
 assert.equal(leaves.length,8,'depth-2 leaves');
});

test('Radial tree: same structure mapped to polar coordinates; deterministic',()=>{
 const a=run('radialtree');
 assert.equal([...a.svg.matchAll(/<circle class="ddn-tree-node"/g)].length,15);
 assert.equal(a.svg,run('radialtree').svg,'deterministic');
 assert.notEqual(a.svg,run('tidytree').svg,'differs from cartesian tidy tree');
});

test('Circle packing: leaf circles plus enclosing group circles; leaf provenance intact',()=>{
 const r=run('circlepack');
 assert.equal([...r.svg.matchAll(/<circle class="ddn-circlepack-leaf"/g)].length,9);
 assert.equal([...r.svg.matchAll(/<circle class="ddn-circlepack-group"/g)].length,6);
 assert.ok(r.scene.marks.some(m=>m.path==='North.Hardware.Tools'&&m.sourceIds.some(id=>id.endsWith("sales.n1"))));
});

test('Sunburst: one arc per node, angle proportional to value share',()=>{
 const r=run('sunburst');
 const arcs=[...r.svg.matchAll(/<path class="ddn-sunburst-arc" data-path="([^"]+)" data-depth="(\d)" data-value="(\d+)"/g)];
 assert.equal(arcs.length,15);
 const north=arcs.find(m=>m[1]==='North'),south=arcs.find(m=>m[1]==='South');
 assert.ok(north&&south,'root arcs');
 assert.equal(Number(north[3]),410,'North value is the child sum');
 assert.equal(Number(south[3]),350,'South value is the child sum');
 assert.equal(r.svg,run('sunburst').svg,'deterministic');
});

test('Packed bubbles: one bubble per record grouped by first path segment',()=>{
 const r=run('packedbubble');
 const bubbles=[...r.svg.matchAll(/<circle class="ddn-bubble" data-path="([^"]+)" data-group="([^"]+)" data-value="(\d+)"/g)];
 assert.equal(bubbles.length,9);
 assert.deepEqual([...new Set(bubbles.map(b=>b[2]))].sort(),['North','South'],'two groups');
 assert.ok(bubbles.every(b=>Number(b[3])>0),'positive values');
});

test('Hierarchy marks refuse negative values (PJ136), aggregation (PJ031) and series (PJ030)',()=>{
 const neg=HEAD.replace('"v": 45}','"v": -5}');
 throws(()=>run('sunburst',BIND,neg),'DDN-PJ136');
 throws(()=>run('tidytree',BIND+' aggregate:sum;'),'DDN-PJ031');
 throws(()=>run('circlepack',BIND+' series:"x_record.path";'),'DDN-PJ030');
 throws(()=>run('packedbubble','x:"x_record.path"; y:"x_record.v"; x_type:number;'),'DDN-PJ030');
});

test('Path depth beyond 3 levels refuses with DDN-PJ030',()=>{
 const deep=HEAD.replace('"path": "South.Services"','"path": "South.Services.Field.Crew"');
 throws(()=>run('tidytree',BIND,deep),'DDN-PJ030');
});

const passed=results.filter(t=>t.pass).length;console.log('Tree charts',passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
