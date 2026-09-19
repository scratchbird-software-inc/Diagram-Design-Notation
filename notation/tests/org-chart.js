/* SPDX-License-Identifier: GPL-2.0-or-later. Org chart profile (org.tree@1): positive, negative and determinism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const SRC=`ddn "0.5";
module "test.org";

format o {
    notation core { registry: "ddn-core@0.3"; }
    style classic { look: classic; theme: default; font: sans; seed: 42; }
    layout org { algorithm: tree; direction: down; root: @people.ceo; hierarchy: [reports_to]; }
    display compact { fields: none; kind: icon_token; maturity: none; badges: none; }
    publication screen { size: content; margin: 30px; minimum_text: 8pt; overflow: error; }
    bundle technical {
        notation: @core; style: @classic; display: @compact; publication: @screen;
    }
}

data people {
    object ceo "A. Rivera — CEO" { kind: "analysis.role"; }
    object vp_eng "B. Okafor — VP Engineering" { kind: "analysis.role"; }
    object vp_fin "C. Novak — VP Finance" { kind: "analysis.role"; }
    object vp_ops "D. Sato — VP Operations" { kind: "analysis.role"; }
    object lead_plat "E. Mbeki — Platform lead" { kind: "analysis.role"; }
    object lead_qa "F. Costa — QA lead" { kind: "analysis.role"; }
    object lead_ar "G. Lund — AR lead" { kind: "analysis.role"; }
    object lead_fleet "H. Petit — Fleet lead" { kind: "analysis.role"; }
    relation r1 @ceo -> @vp_eng { kind: reports_to; }
    relation r2 @ceo -> @vp_fin { kind: reports_to; }
    relation r3 @ceo -> @vp_ops { kind: reports_to; }
    relation r4 @vp_eng -> @lead_plat { kind: reports_to; }
    relation r5 @vp_eng -> @lead_qa { kind: reports_to; }
    relation r6 @vp_fin -> @lead_ar { kind: reports_to; }
    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }
}

view org "Synthetic organisation / org chart" {
    data: [@people]; format: @o.technical; layout: @o.org;
    projection { kind: graph; profile: "org.tree@1"; }
}
`;
const workspace=(src=SRC)=>A.createWorkspace({'main.ddn':src});
const run=(view,src)=>workspace(src).renderSync({entry:'main.ddn',view});
const edited=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return SRC.replace(before,after);};
const byId=(scene,id)=>scene.nodes.find(n=>n.id.endsWith('.'+id));

test('Org chart renders 8 nodes with the root on top and levels aligned',()=>{
 const r=run('org');assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('</svg>'));
 assert.equal(r.scene.nodes.length,8);
 const ceo=byId(r.scene,'ceo');
 for(const n of r.scene.nodes)if(n!==ceo)assert.ok(ceo.y<n.y,n.id+' below root');
 const vps=['vp_eng','vp_fin','vp_ops'].map(id=>byId(r.scene,id));
 assert.ok(vps.every(n=>n.y===vps[0].y),'VPs share one level');
 assert.ok(vps[0].y>ceo.y);
 const leads=['lead_plat','lead_qa','lead_ar','lead_fleet'].map(id=>byId(r.scene,id));
 assert.ok(leads.every(n=>n.y===leads[0].y),'leads share one level');
 assert.ok(leads[0].y>vps[0].y,'leads deeper than VPs');
});
test('Every lead lies under its manager subtree span',()=>{
 const r=run('org');
 const kids={vp_eng:['lead_plat','lead_qa'],vp_fin:['lead_ar'],vp_ops:['lead_fleet']};
 for(const [manager,children] of Object.entries(kids)){
  const group=[byId(r.scene,manager),...children.map(id=>byId(r.scene,id))];
  const lo=Math.min(...group.map(n=>n.x)),hi=Math.max(...group.map(n=>n.x+n.w));
  for(const id of children){const n=byId(r.scene,id);assert.ok(n.x>=lo&&n.x+n.w<=hi,id+' inside '+manager+' span');}
 }
});
test('direction: right keeps the root at the left',()=>{
 const r=run('org',edited('direction: down;','direction: right;'));
 const ceo=byId(r.scene,'ceo');
 for(const n of r.scene.nodes)if(n!==ceo)assert.ok(ceo.x<n.x,n.id+' right of root');
});
test('Two roots rejected',()=>{
 throws(()=>run('org',edited('    relation r1 @ceo -> @vp_eng { kind: reports_to; }\n','')),'DDN-PJ102');
});
test('Isolated ninth person rejected',()=>{
 const src=edited('    relation r1 @ceo -> @vp_eng','    object consultant "I. Weiss — Consultant" { kind: "analysis.role"; }\n    relation r1 @ceo -> @vp_eng');
 throws(()=>run('org',src),'DDN-PJ102');
});
test('Cycle rejected',()=>{
 const src=edited('    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }','    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }\n    relation r8 @lead_plat -> @ceo { kind: reports_to; }');
 throws(()=>run('org',src),'DDN-PF004');
});
test('Two managers rejected at layout stage',()=>{
 const src=edited('    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }','    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }\n    relation r8 @vp_fin -> @lead_plat { kind: reports_to; }');
 throws(()=>run('org',src),'DDN201');
});
test('Non-org participant kind rejected',()=>{
 const src=edited('    relation r1 @ceo -> @vp_eng','    object t "Order extract" { kind: table; fields { field order_id; } }\n    relation r1 @ceo -> @vp_eng');
 throws(()=>run('org',src),'DDN-PF007');
});
test('Non-reports_to relation rejected',()=>{
 const src=edited('    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }','    relation r7 @vp_ops -> @lead_fleet { kind: reports_to; }\n    relation peers @lead_plat -> @lead_qa { kind: assoc; }');
 throws(()=>run('org',src),'DDN-PF007');
});
test('Unknown profile version rejected',()=>{
 throws(()=>run('org',edited('profile: "org.tree@1";','profile: "org.tree@2";')),'DDN-PF001');
});
test('Wrong projection kind rejected',()=>{
 const src=edited('view org "Synthetic organisation / org chart" {\n    data: [@people]; format: @o.technical; layout: @o.org;\n    projection { kind: graph; profile: "org.tree@1"; }','view charted "Synthetic organisation / wrong kind" {\n    data: [@people]; format: @o.technical; layout: @o.org;\n    projection { kind: chart; profile: "org.tree@1"; }');
 throws(()=>run('charted',src),'DDN-PF002');
});
test('Deterministic rerender',()=>assert.equal(run('org').svg,run('org').svg));
const report={runtime:A.VERSION,scope:'Org chart profile org.tree@1 validation and rendering.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/org-chart-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Org chart',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
