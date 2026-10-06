/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 portable stroke/line
 * properties (chapter 04 §6B): line { color, weight, dash } on relations and
 * stroke { color, weight, dash, corners } + flat fill on elements — the
 * DDN-LN01–LN05 validator family, DDN-V04 gating, route/arrowhead pen
 * sharing, silhouette paint (plain cards + profile channels), monochrome
 * suppression and byte-identical output when nothing is declared. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const src=(body,version='0.6')=>({'m.ddn':'ddn "'+version+'";\nmodule "m";\n'+body});
const build=(body,version='0.6')=>DDN.build(src(body,version),'m.ddn','v',reg).ir;
const render=(body,version)=>Render.render(build(body,version),reg,defs).svg;
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const TWO='data m { object a "Alpha" { kind: cache; } object b "Beta" { kind: queue; } relation r @a -> @b { kind: flow; } }';

test('validation: DDN-LN01..LN05 fire per key in both contexts',()=>{
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; line { wobble: 1; } } }\nview v { data: [@m]; }')),'DDN-LN01','unknown line key');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { corners: round; } } object b "B" { kind: queue; } relation r @a -> @b { line { corners: round; } } }\nview v { data: [@m]; }')),'DDN-LN01','corners is element-only');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; fill: red; } }\nview v { data: [@m]; }')),'DDN-LN02');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { color: "#12345"; } } }\nview v { data: [@m]; }')),'DDN-LN02');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { weight: 0.1px; } } }\nview v { data: [@m]; }')),'DDN-LN03','below floor');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { weight: 99px; } } }\nview v { data: [@m]; }')),'DDN-LN03','above ceiling');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { dash: "4 2"; } } }\nview v { data: [@m]; }')),'DDN-LN04','custom array reserved');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { dash: wavy; } } }\nview v { data: [@m]; }')),'DDN-LN04');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { corners: square; } } }\nview v { data: [@m]; }')),'DDN-LN05','square reserved');
});

test('version gate: line/stroke/fill below ddn "0.6" is DDN-V04',()=>{
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; stroke { color: "#123456"; } } }\nview v { data: [@m]; }','0.5')),'DDN-V04');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; fill: "#123456"; } }\nview v { data: [@m]; }','0.5')),'DDN-V04');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { line { dash: dashed; } } }\nview v { data: [@m]; }','0.5')),'DDN-V04');
});

test('normalization: colour case-folded, weight to px number, pt converted',()=>{
 const ir=build('data m { object a "A" { kind: cache; fill: "#A1B2C3"; stroke { weight: 2.25pt; dash: solid; corners: round; } } object b "B" { kind: queue; } relation r @a -> @b { line { weight: 3px; } } }\nview v { data: [@m]; }');
 assert.equal(ir.elements[0].properties.fill,'#a1b2c3');
 assert.deepEqual(ir.elements[0].properties.stroke,{weight:3,dash:'solid'},'2.25pt = 3px; corners dropped');
 assert.deepEqual(ir.relations[0].properties.line,{weight:3});
});

test('relation line: route paints color/weight/dash and arrowheads share the pen',()=>{
 const svg=render('data m { object a "Alpha" { kind: cache; } object b "Beta" { kind: queue; } relation r @a -> @b { kind: flow; line { color: "#1D4ED8"; weight: 2.5px; dash: dotted; } } }\nview v { data: [@m]; }');
 const route=svg.match(/<path d="[^"]*" fill="none" stroke="#1d4ed8"[^>]*>/g);
 assert.ok(route&&route.length,'route painted in line color');
 assert.ok(route[0].includes('stroke-width="2.5"')&&route[0].includes('stroke-dasharray="2 5"'),'weight + dotted pattern: '+route[0]);
 const head=svg.match(/<g transform="translate[^>]*stroke="#1d4ed8" stroke-width="2.5"[^>]*>/g);
 assert.ok(head&&head.length,'arrowhead shares the line pen: '+(head||[])[0]);
});

test('dash: solid un-dashes a registered dashed verb; dashed overrides a solid one',()=>{
 const dashedVerb=render('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: depends; } }\nview v { data: [@m]; }');
 const solid=render('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: depends; line { dash: solid; } } }\nview v { data: [@m]; }');
 const dashed=render('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; line { dash: dashed; } } }\nview v { data: [@m]; }');
 const routeOut=g=>g.match(/data-route-pieces="1"><path[^>]*>/)[0];
 assert.ok(/stroke-dasharray/.test(routeOut(dashedVerb)),'dep is registered-dashed (fixture assumption)');
 assert.ok(!/stroke-dasharray/.test(routeOut(solid)),'dash: solid strips the registered pattern');
 assert.ok(routeOut(dashed).includes('stroke-dasharray="10 6"'),'dashed maps to 10 6');
});

test('element stroke/fill on the plain card; interior text keeps role channels',()=>{
 const svg=render('data m { object a "Alpha" { kind: cache; fill: "#FFF7ED"; stroke { color: "#C2410C"; weight: 3px; dash: dashed; corners: round; } fields { f1: string; } } object b "Beta" { kind: service; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }');
 const card=svg.match(/<rect[^>]*stroke="#c2410c"[^>]*>/)[0];
 assert.ok(card.includes('fill="#fff7ed"')&&card.includes('stroke-width="3"')&&card.includes('stroke-dasharray="10 6"'),'card outline: '+card);
 const label=svg.match(/<text[^>]*>[^<]*Alpha[^<]*<\/text>/)[0];
 assert.ok(!/c2410c/i.test(label),'label text keeps its role ink');
 const beta=svg.match(/<rect[^>]*stroke-width="1.8"[^>]*>/)[0];
 assert.ok(!/stroke-dasharray/.test(beta),'undeclared element unchanged');
});

test('profile silhouette: color/fill ride the palette channels; weight/dash stay registered',()=>{
 const body='data m { object start "Go" { kind: "flow.start"; fill: "#ECFDF5"; stroke { color: "#047857"; weight: 9px; dash: dotted; } } object act "Work" { kind: "flow.process"; } object fin "Done" { kind: "flow.end"; } relation r @start -> @act { kind: "flow.next"; } relation r2 @act -> @fin { kind: "flow.next"; } }';
 const svg=render(body+'\nview v { data: [@m]; projection { kind: graph; profile: "flow.basic@1"; } }');
 assert.ok(svg.includes('stroke="#047857"'),'silhouette ink overridden');
 assert.ok(svg.includes('fill="#ecfdf5"'),'silhouette fill overridden');
 assert.ok(!/stroke-width="9"/.test(svg),'weight is a plain-card property this revision');
});

test('handDrawn: sketch pen receives color/weight/dash; classic geometry consistent',()=>{
 const svg=render('data m { object a "Sketchy" { kind: cache; fill: "#FEF9C3"; stroke { color: "#A16207"; weight: 2.5px; dash: dashed; } } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; line { color: "#1D4ED8"; weight: 3px; dash: dotted; } } }\nview v { data: [@m]; style { look: handDrawn; seed: 11; } }');
 assert.ok(svg.includes('stroke="#a16207"'),'sketch outline color');
 assert.ok(svg.includes('stroke-width="2.5"'),'sketch outline weight');
 assert.ok(svg.includes('stroke-dasharray="10 6"'),'sketch outline dash');
 assert.ok(svg.includes('stroke="#1d4ed8"')&&svg.includes('stroke-width="3"'),'sketch route pen');
});

test('monochrome themes suppress declared colours (B/W contract wins)',()=>{
 const body='data m { object a "A" { kind: cache; fill: "#FFF7ED"; stroke { color: "#C2410C"; weight: 3px; } } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; line { color: "#1D4ED8"; } } }';
 const svg=render(body+'\nview v { data: [@m]; style { theme: neutral; } }');
 assert.ok(!/c2410c|fff7ed|1d4ed8/i.test(svg),'no declared colour under neutral');
 assert.ok(/stroke-width="3"/.test(svg),'weight still applies (geometry-neutral paint)');
});

test('byte-identical when nothing is declared; geometry and fingerprint untouched',()=>{
 const plain=render(TWO+'\nview v { data: [@m]; }');
 const again=render(TWO+'\nview v { data: [@m]; }');
 assert.equal(plain,again,'deterministic');
 assert.ok(!/stroke-dasharray="10 6"/.test(plain),'no dash leak');
 const r1=Render.render(build('data m { object a "Alpha" { kind: cache; stroke { weight: 16px; color: "#123456"; } } object b "Beta" { kind: queue; } relation r @a -> @b { kind: flow; line { weight: 16px; } } }\nview v { data: [@m]; }'),reg,defs);
 const r2=Render.render(build(TWO+'\nview v { data: [@m]; }'),reg,defs);
 assert.equal(JSON.stringify(r1.scene.nodes),JSON.stringify(r2.scene.nodes),'layout untouched by paint properties');
 assert.equal(r1.scene.edges?JSON.stringify(r1.scene.edges):'',r2.scene.edges?JSON.stringify(r2.scene.edges):'','routing untouched');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' line-properties tests passed');
