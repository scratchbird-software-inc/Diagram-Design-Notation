/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 per-element sizing
 * resolution (chapter 04 §6C + chapter 54 §54.1) and content opacity: per-key
 * element > view > engine default resolution consumed by the two-pass fit
 * loop, content_scale composition, opacity paint/validation (DDN-SZ01,
 * DDN-V04) and paint-only guarantees. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const src=(body,version='0.6')=>({'m.ddn':'ddn "'+version+'";\nmodule "m";\n'+body});
const build=(body,version='0.6')=>DDN.build(src(body,version),'m.ddn','v',reg).ir;
const render=(body,options,version)=>Render.render(build(body,version),reg,defs,options);
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const node=(res,local)=>res.scene.nodes.find(n=>n.id.endsWith('.'+local)||n.id.endsWith('::'+local));
const LONG='A rather long quarterly summary label that must wrap around';

test('per-key resolution: element overrides exactly what it declares, inherits the rest',()=>{
 const res=render('data m { object s "'+LONG+'" { kind: note; max_width: 200px; } object t "'+LONG+'" { kind: note; } }\nview v { data: [@m]; style { max_width: 220px; text_fit: wrap; } }');
 assert.equal(node(res,'s').w,200,'element max_width beats the view-wide 220');
 assert.equal(node(res,'t').w,220,'sibling inherits the view-wide 220');
 assert.deepEqual(res.scene.layout.textFit.resized.sort(),['m::m.s','m::m.t'],'view-wide text_fit: wrap applies to both (inherited key)');
});

test('element text_fit beats the view mode: shrink under a view-wide wrap',()=>{
 const res=render('data m { object s "'+LONG+' with even more words to force adaptation steps" { kind: term; text_fit: shrink; max_width: 140px; max_height: 60px; min_font: 12px; } object t "'+LONG+'" { kind: note; } }\nview v { data: [@m]; style { text_fit: wrap; max_width: 220px; } layout { quality: warn; } }');
 assert.ok(res.diagnostics.some(d=>d.code==='DDN-LW08'&&/12px/.test(d.message)),'element shrank to its own floor (LW08 names 12px)');
 assert.ok(!res.diagnostics.some(d=>d.code==='DDN-LW07'&&/s\b/.test(d.message)),'element did not take the view wrap path');
 assert.ok(res.scene.layout.textFit.resized.includes('m::m.t'),'sibling still follows the view wrap default');
});

test('fit loop consumes the resolved record: element min_font floors the shrink',()=>{
 const body=f=>'data m { object s "'+LONG+' with even more words to force several shrink steps" { kind: term; text_fit: shrink; max_width: 140px; max_height: 60px; '+(f?'min_font: '+f+';':'')+' } }\nview v { data: [@m]; layout { quality: warn; } }';
 const floor8=render(body(null));
 const floor14=render(body('14px'));
 assert.ok(floor8.diagnostics.some(d=>d.code==='DDN-LW08'),'default 8px floor still overflows → LW08');
 assert.ok(floor14.diagnostics.some(d=>d.code==='DDN-LW08'&&/14px/.test(d.message)),'element min_font named as the floor');
 assert.equal(code(()=>build('data m { object s "x" { kind: term; min_font: 99px; } }\nview v { data: [@m]; }')),'DDN-TF03','element min_font validated at build');
});

test('content_scale composes after the fit: post-fit drawing scales uniformly',()=>{
 const body='data m { object s "'+LONG+'" { kind: note; text_fit: wrap; max_width: 200px; } }\nview v { data: [@m]; publication { size: content; content_scale: 2; } }';
 const res=render(body);
 assert.equal(res.scene.scale,2,'page scale records content_scale');
 assert.equal(node(res,'s').w,200,'scene geometry stays in unscaled world units');
});

test('opacity: paints one group opacity over the whole node; 1 paints nothing',()=>{
 const svg=render('data m { object a "Ghost" { kind: cache; opacity: 0.5; fields { f1: string; } } object b "Solid" { kind: cache; opacity: 1; } object c "Plain" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }').svg;
 const ga=svg.match(/<g class="[^"]*ddn-kind-cac[^"]*"[^>]*>/g);
 assert.ok(ga[0].includes('opacity="0.5"'),'declared opacity on the node group: '+ga[0]);
 assert.ok(!/opacity=/.test(ga[1]),'opacity: 1 paints nothing');
 const gc=svg.match(/<g class="[^"]*ddn-kind-que[^"]*"[^>]*>/)[0];
 assert.ok(!/opacity=/.test(gc),'undeclared paints nothing (byte-identical)');
});

test('opacity: validation DDN-SZ01, gate DDN-V04, and paint-only (layout/diagnostics untouched)',()=>{
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; opacity: 1.5; } }\nview v { data: [@m]; }')),'DDN-SZ01');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; opacity: -0.1; } }\nview v { data: [@m]; }')),'DDN-SZ01');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; opacity: high; } }\nview v { data: [@m]; }')),'DDN-SZ01');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; opacity: 0.5; } }\nview v { data: [@m]; }','0.5')),'DDN-V04');
 const plain=render('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }');
 const faded=render('data m { object a "A" { kind: cache; opacity: 0.3; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }');
 assert.equal(JSON.stringify(faded.scene.nodes),JSON.stringify(plain.scene.nodes),'layout identical');
 assert.equal(faded.scene.edges?JSON.stringify(faded.scene.edges):'',plain.scene.edges?JSON.stringify(plain.scene.edges):'','routing identical');
 assert.equal(faded.diagnostics.length,plain.diagnostics.length,'diagnostics identical');
});

test('opacity on a profile silhouette rides the same group contract',()=>{
 const svg=render('data m { object start "Go" { kind: "flow.start"; opacity: 0.4; } object act "Work" { kind: "flow.process"; } object fin "Done" { kind: "flow.end"; } relation r @start -> @act { kind: "flow.next"; } relation r2 @act -> @fin { kind: "flow.next"; } }\nview v { data: [@m]; projection { kind: graph; profile: "flow.basic@1"; } }').svg;
 const g=svg.match(/<g class="ddn-node[^>]*data-shape="terminal"[^>]*>/)[0];
 assert.ok(g.includes('opacity="0.4"'),'silhouette group carries opacity: '+g);
});

test('byte-identical when no sizing/opacity key is declared',()=>{
 const body='data m { object a "Alpha" { kind: cache; } object b "Beta" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }';
 assert.equal(render(body).svg,render(body).svg,'deterministic');
 assert.ok(!/opacity=/.test(render(body).svg),'no attribute leak');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' sizing-properties tests passed');
