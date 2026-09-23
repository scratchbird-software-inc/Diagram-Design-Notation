/* SPDX-License-Identifier: GPL-2.0-or-later. B1-022 frame_overflow: expand|confine for scoped frames (RFC-118). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);}}
const fail=(fn,code)=>assert.throws(fn,e=>e.code===code);

// One model, one boundary object, two members; the frame variants differ only
// in the layout.frame_overflow value and the frame's declared geometry.
const fixture=(viewDecl,frameDecl)=>`ddn "0.5";
module "tests.frameoverflow";
data model {
 object boundary "Boundary" { kind: block; }
 object a "Alpha" { kind: block; }
 object b "Beta" { kind: block; }
}
view main "Frame overflow fixture" {
 data: [@model];
 select: [@model.a, @model.b];
 layout { algorithm: grid; ${viewDecl} }
 publication { size: content; fit: none; }
 ${frameDecl}
}
`;
const render=(src,view='main')=>A.createWorkspace({'fixture.ddn':src}).renderSync({entry:'fixture.ddn',view});
const frameRect=svg=>{const m=svg.match(/class="ddn-frame"[^>]*><rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/);assert.ok(m,'frame rect present');return{x:+m[1],y:+m[2],w:+m[3],h:+m[4]};};
const nodeBoxes=svg=>[...svg.matchAll(/ddn-node[^"]*" data-id="[^"]*::model\.([ab])"/g)].map(m=>{const r=svg.slice(m.index).match(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/);return{id:m[1],x:+r[1],y:+r[2],w:+r[3],h:+r[4]};});

// --- Default / equivalence ---
test('default is expand: omitted and explicit frame_overflow: expand render byte-identical',()=>{
 const memberDerived=fixture('','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; }');
 assert.equal(render(memberDerived).svg,render(fixture('frame_overflow: expand;','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; }')).svg);
});
test('declared rect that already encloses members is unchanged under expand',()=>{
 const src=fixture('','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; at: [-100px, -100px]; size: [2000px, 900px]; }');
 const f=frameRect(render(src).svg);
 assert.deepEqual(f,{x:-100,y:-100,w:2000,h:900});
});

// --- expand ---
test('expand grows a too-small declared frame to the member bbox plus standard padding',()=>{
 const src=fixture('','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; at: [0px, 0px]; size: [200px, 150px]; }');
 const svg=render(src).svg,f=frameRect(svg),ns=nodeBoxes(svg);
 assert.equal(ns.length,2);
 const right=Math.max(...ns.map(n=>n.x+n.w)),bottom=Math.max(...ns.map(n=>n.y+n.h));
 assert.equal(f.x,0);assert.equal(f.y,0);           // declared origin kept
 assert.equal(f.w,right-f.x+20);                     // grown: right padding 20
 assert.equal(f.h,Math.max(150,bottom-f.y+22));      // declared height already covers
 assert.ok(f.w>200&&f.h>=150,'frame grew past the declared size');
});
test('expand keeps members enclosed for a size-only declared frame',()=>{
 const src=fixture('','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; size: [120px, 100px]; }');
 const svg=render(src).svg,f=frameRect(svg),ns=nodeBoxes(svg);
 for(const n of ns){assert.ok(n.x>=f.x&&n.y>=f.y&&n.x+n.w<=f.x+f.w&&n.y+n.h<=f.y+f.h,'member '+n.id+' enclosed');}
});

// --- confine ---
test('confine keeps the declared rect and clamps unpinned members into the interior',()=>{
 const src=fixture('frame_overflow: confine;','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; at: [0px, 0px]; size: [760px, 300px]; }');
 const svg=render(src).svg,f=frameRect(svg),ns=nodeBoxes(svg);
 assert.deepEqual(f,{x:0,y:0,w:760,h:300},'frame keeps declared rect');
 for(const n of ns){
  assert.ok(n.x>=20-0.001&&n.y>=54-0.001,'member '+n.id+' inside padded interior');
  assert.ok(n.x+n.w<=f.x+f.w-20+0.001&&n.y+n.h<=f.y+f.h-22+0.001,'member '+n.id+' inside padded interior');
 }
});
test('confine on a member-derived frame renders like expand (nothing to clamp)',()=>{
 const decl='frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; }';
 assert.equal(render(fixture('frame_overflow: confine;',decl)).svg,render(fixture('',decl)).svg);
});
test('confine still fails a pinned member outside the fixed frame',()=>{
 const src=fixture('frame_overflow: confine;','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; at: [0px, 0px]; size: [760px, 300px]; } place @model.b { at: [2000px, 2000px]; }');
 fail(()=>render(src),'DDN-P004');
});
test('confine fails a member too large for the interior instead of hiding it',()=>{
 const src=fixture('frame_overflow: confine;','frame f "F" { scope: @model.boundary; members: [@model.a, @model.b]; at: [0px, 0px]; size: [200px, 120px]; }');
 fail(()=>render(src),'DDN-P004');
});

// --- parse surface ---
test('invalid frame_overflow value fails DDN046',()=>{
 fail(()=>render(fixture('frame_overflow: grow;','')),'DDN046');
});
test('frame_overflow is accepted in a format profile declaration',()=>{
 const src=`ddn "0.5";
module "tests.frameoverflow.fmt";
data model { object boundary "B" { kind: block; } object a "A" { kind: block; } }
format fmts { layout lay { algorithm: grid; frame_overflow: confine; } bundle b { layout: @lay; } }
view main "V" { data: [@model]; select: [@model.a]; format: @fmts.b; publication { size: content; fit: none; }
 frame f "F" { scope: @model.boundary; members: [@model.a]; at: [0px, 0px]; size: [600px, 300px]; } }
`;
 const svg=render(src).svg,f=frameRect(svg),ns=nodeBoxes(svg);
 assert.deepEqual(f,{x:0,y:0,w:600,h:300});
 assert.ok(ns[0].x>=20-0.001&&ns[0].y>=54-0.001,'member clamped through format-carried confine');
});

const failed=results.filter(r=>!r.pass);
console.log(`Frame overflow ${results.length-failed.length}/${results.length}`);
process.exit(failed.length?1:0);
