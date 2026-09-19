/* SPDX-License-Identifier: GPL-2.0-or-later. Mind map profile (mindmap.basic@1): positive, negative and determinism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const SRC=`ddn "0.5";
module "test.mindmap";

format o {
    notation core { registry: "ddn-core@0.3"; }
    style classic { look: classic; theme: default; font: sans; seed: 42; }
    layout mind { algorithm: mindmap; routing: curved; curve: bezier; root: @m.root; hierarchy: [assoc]; }
    display compact { fields: none; kind: icon_token; maturity: none; badges: none; }
    publication screen { size: content; margin: 30px; minimum_text: 8pt; overflow: error; }
    bundle technical {
        notation: @core; style: @classic; display: @compact; publication: @screen;
    }
}

data m {
    object root "Q3 launch brainstorm" { kind: object; }
    object pricing "Pricing" { kind: object; }
    object onboarding "Onboarding" { kind: object; }
    object risks "Risks" { kind: object; }
    object marketing "Marketing" { kind: object; }
    object tiers "Usage tiers" { kind: term; }
    object discount "Annual discount" { kind: term; }
    object tour "Sample data tour" { kind: term; }
    object creep "Scope creep" { kind: term; }
    relation r1 @root -> @pricing { kind: assoc; }
    relation r2 @root -> @onboarding { kind: assoc; }
    relation r3 @root -> @risks { kind: assoc; }
    relation r4 @root -> @marketing { kind: assoc; }
    relation r5 @pricing -> @tiers { kind: assoc; }
    relation r6 @pricing -> @discount { kind: assoc; }
    relation r7 @onboarding -> @tour { kind: assoc; }
    relation r8 @risks -> @creep { kind: assoc; }
}

view mindmap "Synthetic brainstorm / mind map" {
    data: [@m]; format: @o.technical; layout: @o.mind;
    projection { kind: graph; profile: "mindmap.basic@1"; }
}
`;
const workspace=(src=SRC)=>A.createWorkspace({'main.ddn':src});
const run=(view,src)=>workspace(src).renderSync({entry:'main.ddn',view});
const edited=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return SRC.replace(before,after);};
const byId=(scene,id)=>scene.nodes.find(n=>n.id.endsWith('.'+id));

test('Mind map renders 9 nodes with the root centred between two-sided branches',()=>{
 const r=run('mindmap');assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('</svg>'));
 assert.equal(r.scene.nodes.length,9);
 const root=byId(r.scene,'root');
 const branches=['pricing','onboarding','risks','marketing'].map(id=>byId(r.scene,id));
 const xs=branches.map(n=>n.x),lo=Math.min(...xs),hi=Math.max(...xs);
 assert.ok(root.x>lo&&root.x<hi,'root x strictly between leftmost and rightmost branch');
 assert.ok(branches.some(n=>n.x<root.x),'at least one branch left of root');
 assert.ok(branches.some(n=>n.x>root.x),'at least one branch right of root');
});
test('Scene routes carry curved routing',()=>{
 const r=run('mindmap');
 assert.equal(r.scene.routes.length,8);
 assert.ok(r.scene.routes.every(rt=>rt.routing==='curved'),'every route is curved');
});
test('Top branches alternate left/right in declaration order',()=>{
 const r=run('mindmap'),root=byId(r.scene,'root');
 const branches=['pricing','onboarding','risks','marketing'].map(id=>byId(r.scene,id));
 const side=n=>n.x<root.x?'left':'right';
 // Children 0,2 (pricing, risks) on one side; 1,3 (onboarding, marketing) on the other.
 assert.equal(side(branches[0]),side(branches[2]),'branches 0 and 2 share a side');
 assert.equal(side(branches[1]),side(branches[3]),'branches 1 and 3 share a side');
 assert.notEqual(side(branches[0]),side(branches[1]),'alternating sides');
});
test('Detached branch (two roots) rejected',()=>{
 throws(()=>run('mindmap',edited('    relation r4 @root -> @marketing { kind: assoc; }\n','')),'DDN-PJ102');
});
test('Leaf-to-root cycle rejected',()=>{
 const src=edited('    relation r8 @risks -> @creep { kind: assoc; }','    relation r8 @risks -> @creep { kind: assoc; }\n    relation r9 @tiers -> @root { kind: assoc; }');
 throws(()=>run('mindmap',src),'DDN-PF004');
});
test('Non-concept participant kind rejected',()=>{
 const src=edited('    relation r1 @root -> @pricing','    object t "Order extract" { kind: table; fields { field order_id; } }\n    relation r1 @root -> @pricing');
 throws(()=>run('mindmap',src),'DDN-PF007');
});
test('Non-assoc relation kind rejected',()=>{
 const src=edited('    relation r8 @risks -> @creep { kind: assoc; }','    relation r8 @risks -> @creep { kind: assoc; }\n    relation r9 @pricing -> @marketing { kind: depends; }');
 throws(()=>run('mindmap',src),'DDN-PF007');
});
test('Non-mindmap layout algorithm rejected',()=>{
 throws(()=>run('mindmap',edited('algorithm: mindmap;','algorithm: grid;')),'DDN-PF007');
});
test('Unknown profile version rejected',()=>{
 throws(()=>run('mindmap',edited('profile: "mindmap.basic@1";','profile: "mindmap.basic@2";')),'DDN-PF001');
});
test('Wrong projection kind rejected',()=>{
 const src=edited('view mindmap "Synthetic brainstorm / mind map" {\n    data: [@m]; format: @o.technical; layout: @o.mind;\n    projection { kind: graph; profile: "mindmap.basic@1"; }','view charted "Synthetic brainstorm / wrong kind" {\n    data: [@m]; format: @o.technical; layout: @o.mind;\n    projection { kind: chart; profile: "mindmap.basic@1"; }');
 throws(()=>run('charted',src),'DDN-PF002');
});
test('Deterministic rerender',()=>assert.equal(run('mindmap').svg,run('mindmap').svg));
const report={runtime:A.VERSION,scope:'Mind map profile mindmap.basic@1 validation and rendering.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/mind-map-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Mind map',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
