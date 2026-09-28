/* SPDX-License-Identifier: GPL-2.0-or-later. B1-074: drill-down thumbnails (RFC-132). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

const TOP=`ddn "0.5";
module "test.drill";
data m {
    object hub "Order handling" { kind: "flow.process"; x_subdiagram: { view: "detail"; display: "thumbnail" }; }
    object other "Billing" { kind: "flow.process"; }
    relation f1 "" @hub -> @other { kind: "flow.next"; }
}
data d {
    object a "Alpha" { kind: "flow.process"; }
    object b "Beta" { kind: "flow.process"; }
    relation x "" @a -> @b { kind: "flow.next"; }
}
view v "Top" { data: [@m]; publication { size: content; fit: none; overflow: error; } }
view detail "Detail" { data: [@d]; publication { size: content; fit: none; overflow: error; } }
`;
const fresh=()=>A.createWorkspace({'main.ddn':TOP});

test('thumbnail renders the child inline in shapes detail: silhouettes present, every text run suppressed',()=>{
 const r=fresh().renderSync({entry:'main.ddn',view:'v'});
 const m=r.svg.match(/<g class="ddn-io-inline"[\s\S]*?<\/svg>/);
 assert.ok(m,'inline group missing');
 assert.ok(!m[0].includes('<text'),'text run leaked into the thumbnail');
 assert.ok(m[0].includes('data-shape')||/<(rect|ellipse|path)/.test(m[0]),'silhouettes missing');
 assert.ok(!/<text[^>]*>[^<]*Beta/.test(m[0]),'child node names must be suppressed from text runs');
});
test('inline display renders the child live (full fidelity, like interaction overview)',()=>{
 const SRC=TOP.replace('display: "thumbnail"','display: "inline"');
 const r=A.createWorkspace({'main.ddn':SRC}).renderSync({entry:'main.ddn',view:'v'});
 const m=r.svg.match(/<g class="ddn-io-inline"[\s\S]*?<\/svg>/);
 assert.ok(m[0].includes('<text'),'live inline child must keep its text');
 assert.ok(m[0].includes('Beta'),'live inline child keeps node names');
});
test('badge default is unchanged: plain x_subdiagram renders only the ref badge',()=>{
 const SRC=TOP.replace('; display: "thumbnail"','');
 const r=A.createWorkspace({'main.ddn':SRC}).renderSync({entry:'main.ddn',view:'v'});
 assert.ok(r.svg.includes('ddn-ref-badge'),'ref badge missing');
 assert.ok(!r.svg.includes('ddn-io-inline'),'badge must not expand the child');
});

const FROZEN_BASE=`ddn "0.5";
module "test.frozen";
data m {
    object hub "Order handling" { kind: "flow.process"; x_subdiagram: { view: "detail"; display: "thumbnail"; frozen: true; snapshot_at: "2026-09-28T00:00Z"; snapshot: "SNAP"; }; }
}
data d {
    object a "Alpha" { kind: "flow.process"; }
}
view v "Top" { data: [@m]; publication { size: content; fit: none; overflow: error; } }
view detail "Detail" { data: [@d]; publication { size: content; fit: none; overflow: error; } }
`;
function frozenWorkspace(svg){return A.createWorkspace({'main.ddn':FROZEN_BASE.replace('"SNAP"',JSON.stringify(svg))});}
const grab=svg=>svg.match(/<g class="ddn-io-inline ddn-frozen"[\s\S]*?<\/g><\/g>/)?.[0];

test('frozen embeds the snapshot verbatim (namespaced), never re-rendering the child',()=>{
 const ws=A.createWorkspace({'main.ddn':FROZEN_BASE.replace('"SNAP"','""')});
 const snap=ws.renderSync({entry:'main.ddn',view:'detail'}).svg;
 const r=frozenWorkspace(snap).renderSync({entry:'main.ddn',view:'v'});
 assert.ok(r.svg.includes('ddn-frozen'),'frozen group missing');
 assert.ok(r.svg.includes('data-snapshot-at="2026-09-28T00:00Z"'),'snapshot_at missing');
 assert.ok(r.svg.includes('io-'),'namespacing pass missing');
});
test('frozen thumbnail does NOT update when the child source changes',()=>{
 const ws=A.createWorkspace({'main.ddn':FROZEN_BASE.replace('"SNAP"','""')});
 const snap=ws.renderSync({entry:'main.ddn',view:'detail'}).svg;
 const SRC1=FROZEN_BASE.replace('"SNAP"',JSON.stringify(snap));
 const r1=A.createWorkspace({'main.ddn':SRC1}).renderSync({entry:'main.ddn',view:'v'});
 const SRC2=SRC1.replace('"Alpha"','"Alpha CHANGED"');
 const r2=A.createWorkspace({'main.ddn':SRC2}).renderSync({entry:'main.ddn',view:'v'});
 assert.equal(grab(r2.svg),grab(r1.svg),'frozen thumbnail changed on a child edit');
});
test('host rewrite of the snapshot artifact refreshes the thumbnail',()=>{
 const ws=A.createWorkspace({'main.ddn':FROZEN_BASE.replace('"SNAP"','""')});
 const snap1=ws.renderSync({entry:'main.ddn',view:'detail'}).svg;
 const SRC1=FROZEN_BASE.replace('"SNAP"',JSON.stringify(snap1));
 const r1=A.createWorkspace({'main.ddn':SRC1}).renderSync({entry:'main.ddn',view:'v'});
 const ws2=A.createWorkspace({'main.ddn':SRC1.replace('"Alpha"','"Zeta"')});
 const snap2=ws2.renderSync({entry:'main.ddn',view:'detail'}).svg;
 const SRC2=FROZEN_BASE.replace('"SNAP"',JSON.stringify(snap2));
 const r2=A.createWorkspace({'main.ddn':SRC2}).renderSync({entry:'main.ddn',view:'v'});
 assert.notEqual(grab(r2.svg),grab(r1.svg),'rewritten snapshot did not refresh the thumbnail');
});

test('frozen without a snapshot payload (DDN-PJ198)',()=>{
 throws(()=>A.createWorkspace({'main.ddn':FROZEN_BASE.replace('snapshot: "SNAP"; ','')}).renderSync({entry:'main.ddn',view:'v'}),'DDN-PJ198');});
test('snapshot that is not an SVG document (DDN-PJ198)',()=>{
 throws(()=>A.createWorkspace({'main.ddn':FROZEN_BASE.replace('snapshot: "SNAP"','snapshot: "not svg"')}).renderSync({entry:'main.ddn',view:'v'}),'DDN-PJ198');});
test('frozen with display badge (DDN-PJ198)',()=>{
 throws(()=>A.createWorkspace({'main.ddn':FROZEN_BASE.replace('display: "thumbnail"; frozen: true','display: "badge"; frozen: true')}).renderSync({entry:'main.ddn',view:'v'}),'DDN-PJ198');});
test('thumbnail target view must exist (DDN-PJ119)',()=>{
 throws(()=>A.createWorkspace({'main.ddn':TOP.replace('view: "detail"','view: "nope"')}).renderSync({entry:'main.ddn',view:'v'}),'DDN-PJ119');});
test('nested drill-down children are one level (DDN-PJ198)',()=>{
 const SRC=TOP.replace('object a "Alpha" { kind: "flow.process"; }','object a "Alpha" { kind: "flow.process"; fields { field id; } x_subdiagram: { view: "detail"; display: "thumbnail" }; }');
 throws(()=>A.createWorkspace({'main.ddn':SRC}).renderSync({entry:'main.ddn',view:'v'}),'DDN-PJ198');});

const failed=results.filter(r=>!r.pass);
console.log('thumbnail-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
