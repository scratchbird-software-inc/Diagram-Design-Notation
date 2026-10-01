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

/* ---- B1-100: entity body-text rows, line cap, scrollbar affordance ---- */
const BODY_SRC=SRC.replace('    relation r1 @root -> @pricing { kind: assoc; }',
`    relation r1 @root -> @pricing { kind: assoc; }
    object noted "Note heavy" { kind: object; description: "Row one of the long note body. Row two keeps the thought going. Row three adds more words here. Row four continues the note. Row five is about the middle. Row six carries the idea on. Row seven keeps writing. Row eight adds a sentence. Row nine says more again. Row ten should still show. Row eleven hides by default. Row twelve is clipped too. Row thirteen likewise. Row fourteen at the back. Row fifteen is the last."; }
    relation r9 @root -> @noted { kind: assoc; }`)
 .replace('    object pricing "Pricing" { kind: object; }','    object pricing "Pricing" { kind: object; description: "Short body, two rows at most."; }')
 .replace('    object risks "Risks" { kind: object; }','    object risks "Risks" { kind: object; description: "Tight cap demo."; x_mindmap: { lines: 1 }; }');

test('B1-100: entities auto-size to body rows; default cap is 10 with a scrollbar affordance',()=>{
 const r=run('mindmap',BODY_SRC);
 const noted=r.scene.nodes.find(n=>n.id.endsWith('.noted'));
 assert.ok(noted,'note-heavy entity placed');
 const group=r.svg.match(/<g class="ddn-mind-rows" data-node="[^"]*noted" data-total="(\d+)" data-cap="(\d+)"/);
 assert.ok(group,'rows group carries total and cap');
 const total=Number(group[1]);
 assert.ok(total>10,'the long note exceeds the default 10-line cap ('+total+' rows)');
 assert.equal(Number(group[2]),10,'default cap is 10');
 const notedRows=[...r.svg.matchAll(/<g class="ddn-mind-rows" data-node="[^"]*noted"[^>]*>([\s\S]*?)<\/g>/g)];
 assert.ok(notedRows.length,'noted rows group present');
 const emitted=(r.svg.match(/<g class="ddn-mind-rows" data-node="[^"]*noted"[^>]*>[\s\S]*?<\/g>/)||[''])[0].match(/class="ddn-mind-row"/g);
 assert.equal(emitted.length,total,'every wrapped row emits inside the clip window ('+total+')');
 assert.ok(r.svg.includes('ddn-mind-scroll-thumb'),'scrollbar thumb drawn when total exceeds the cap');
 assert.ok(r.svg.includes('ddn-mind-resize'),'resize affordance drawn');
 // The box height is the capped window, not the full text: rows 10..14 are clipped away in the static render.
 const clip=r.svg.match(/<clipPath id="(mindclip-[^"]+)"><rect x="[^"]*" y="[^"]*" width="[^"]*" height="([\d.]+)"/);
 assert.ok(clip&&Number(clip[2])<=10*18+1,'clip window is the 10-row cap, not the 15-row content');
});

test('B1-100: x_mindmap.lines shrinks the visible window (authored cap)',()=>{
 const r=run('mindmap',BODY_SRC);
 const group=r.svg.match(/<g class="ddn-mind-rows" data-node="[^"]*risks" data-total="(\d+)" data-cap="(\d+)"/);
 assert.ok(group,'risks rows group present');
 assert.equal(Number(group[2]),1,'authored x_mindmap.lines: 1 caps the window to one row');
});

test('B1-100: entities without body text keep the previous compact shape',()=>{
 const r=run('mindmap',BODY_SRC);
 const marketing=r.svg.match(/data-id="[^"]*marketing"/);
 assert.ok(marketing,'marketing present');
 assert.ok(!r.svg.includes('data-node="'+(marketing[0].replace('data-id="','').replace('"',''))+'" data-total'),'no rows group for a textless entity');
});

/* ---- combined-file path (B1-100 live-site regression): the bundled
 * single-file variant must render identically-correct mind-map geometry:
 * side-centre attachments only (never top/bottom) and rounded corners. */
test('Combined variant: no top/bottom edge attachments, rounded corners',()=>{
 const fs2=require('node:fs');
 const combined=fs2.readFileSync(require('node:path').resolve(__dirname,'../../website/examples/basics/28-mind-map.combined.ddn'),'utf8');
 const r=A.createWorkspace({'m.ddn':combined}).renderSync({entry:'m.ddn',view:'mindmap'});
 assert.equal(r.scene.routes.length,8,'all eight branch routes present');
 for(const rt of r.scene.routes){
  assert.ok(['east','west'].includes(rt.source_side),rt.id+' source_side must be east/west, got '+rt.source_side);
  assert.ok(['east','west'].includes(rt.target_side),rt.id+' target_side must be east/west, got '+rt.target_side);
 }
 assert.ok((r.svg.match(/rx="10"/g)||[]).length>=9,'every mind-map entity carries rounded corners (rx=10)');
 assert.ok(!r.svg.includes('RELATIONSHIP KEY'),'full inline labels suppress the legend');
});

const report={runtime:A.VERSION,scope:'Mind map profile mindmap.basic@1 validation and rendering.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/mind-map-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Mind map',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
