/* SPDX-License-Identifier: GPL-2.0-or-later. WBS profile (wbs.tree@1): positive, negative and determinism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const SRC=`ddn "0.5";
module "test.wbs";

format o {
    notation core { registry: "ddn-core@0.3"; }
    style classic { look: classic; theme: default; font: sans; seed: 42; }
    layout wbs { algorithm: tree; direction: down; root: @plan.project; hierarchy: ["analysis.decomposes"]; }
    display compact { fields: none; kind: icon_token; maturity: none; badges: none; }
    publication screen { size: content; margin: 30px; minimum_text: 8pt; overflow: error; }
    bundle technical {
        notation: @core; style: @classic; display: @compact; publication: @screen;
    }
}

data plan {
    object project "Website relaunch (synthetic)" { kind: "analysis.task"; }
    object design "Design" { kind: "analysis.task"; }
    object build "Build" { kind: "analysis.task"; }
    object launch "Launch" { kind: "analysis.task"; }
    object wireframes "Wireframes" { kind: "analysis.task"; }
    object visual "Visual design" { kind: "analysis.task"; }
    object pages "Page build" { kind: "analysis.task"; }
    object cms "CMS wiring" { kind: "analysis.task"; }
    object beta "Beta window" { kind: "analysis.task"; }
    object golive "Go-live" { kind: "analysis.task"; }
    relation r1 @project -> @design { kind: "analysis.decomposes"; }
    relation r2 @project -> @build { kind: "analysis.decomposes"; }
    relation r3 @project -> @launch { kind: "analysis.decomposes"; }
    relation r4 @design -> @wireframes { kind: "analysis.decomposes"; }
    relation r5 @design -> @visual { kind: "analysis.decomposes"; }
    relation r6 @build -> @pages { kind: "analysis.decomposes"; }
    relation r7 @build -> @cms { kind: "analysis.decomposes"; }
    relation r8 @launch -> @beta { kind: "analysis.decomposes"; }
    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }
}

view wbs "Synthetic project / work breakdown structure" {
    data: [@plan]; format: @o.technical; layout: @o.wbs;
    projection { kind: graph; profile: "wbs.tree@1"; }
}
`;
const workspace=(src=SRC)=>A.createWorkspace({'main.ddn':src});
const run=(view,src)=>workspace(src).renderSync({entry:'main.ddn',view});
const edited=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return SRC.replace(before,after);};
const byId=(scene,id)=>scene.nodes.find(n=>n.id.endsWith('.'+id));

test('WBS renders 10 nodes with the root on top and three aligned levels',()=>{
 const r=run('wbs');assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('</svg>'));
 assert.equal(r.scene.nodes.length,10);
 const project=byId(r.scene,'project');
 for(const n of r.scene.nodes)if(n!==project)assert.ok(project.y<n.y,n.id+' below root');
 const phases=['design','build','launch'].map(id=>byId(r.scene,id));
 assert.ok(phases.every(n=>n.y===phases[0].y),'phases share one level');
 assert.ok(phases[0].y>project.y);
 const packages=['wireframes','visual','pages','cms','beta','golive'].map(id=>byId(r.scene,id));
 assert.ok(packages.every(n=>n.y===packages[0].y),'work packages share one level');
 assert.ok(packages[0].y>phases[0].y,'work packages deeper than phases');
});
test('Every work package lies under its parent phase subtree span',()=>{
 const r=run('wbs');
 const kids={design:['wireframes','visual'],build:['pages','cms'],launch:['beta','golive']};
 for(const [parent,children] of Object.entries(kids)){
  const group=[byId(r.scene,parent),...children.map(id=>byId(r.scene,id))];
  const lo=Math.min(...group.map(n=>n.x)),hi=Math.max(...group.map(n=>n.x+n.w));
  for(const id of children){const n=byId(r.scene,id);assert.ok(n.x>=lo&&n.x+n.w<=hi,id+' inside '+parent+' span');}
 }
});
test('Detached phase (two roots) rejected',()=>{
 throws(()=>run('wbs',edited('    relation r1 @project -> @design { kind: "analysis.decomposes"; }\n','')),'DDN-PJ102');
});
test('Cycle rejected',()=>{
 const src=edited('    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }','    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }\n    relation r10 @wireframes -> @project { kind: "analysis.decomposes"; }');
 throws(()=>run('wbs',src),'DDN-PF004');
});
test('Two parents rejected at layout stage',()=>{
 const src=edited('    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }','    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }\n    relation r10 @build -> @wireframes { kind: "analysis.decomposes"; }');
 throws(()=>run('wbs',src),'DDN201');
});
test('Non-task participant kind rejected',()=>{
 const src=edited('    relation r1 @project -> @design','    object t "Order extract" { kind: table; fields { field order_id; } }\n    relation r1 @project -> @design');
 throws(()=>run('wbs',src),'DDN-PF007');
});
test('Non-decomposes relation rejected',()=>{
 const src=edited('    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }','    relation r9 @launch -> @golive { kind: "analysis.decomposes"; }\n    relation peers @wireframes -> @visual { kind: assoc; }');
 throws(()=>run('wbs',src),'DDN-PF007');
});
test('Unknown profile version rejected',()=>{
 throws(()=>run('wbs',edited('profile: "wbs.tree@1";','profile: "wbs.tree@2";')),'DDN-PF001');
});
test('Wrong projection kind rejected',()=>{
 const src=edited('view wbs "Synthetic project / work breakdown structure" {\n    data: [@plan]; format: @o.technical; layout: @o.wbs;\n    projection { kind: graph; profile: "wbs.tree@1"; }','view charted "Synthetic project / wrong kind" {\n    data: [@plan]; format: @o.technical; layout: @o.wbs;\n    projection { kind: chart; profile: "wbs.tree@1"; }');
 throws(()=>run('charted',src),'DDN-PF002');
});
test('Deterministic rerender',()=>assert.equal(run('wbs').svg,run('wbs').svg));
const report={runtime:A.VERSION,scope:'WBS profile wbs.tree@1 validation and rendering.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/wbs-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('WBS',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
