/* SPDX-License-Identifier: GPL-2.0-or-later. Chapters 04 §6D and 54 §6–7:
 * exercise source → IR → geometry → SVG, including rejection and visibility. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const Text=require('../runtime/ddn-text.js').default;
const reg=JSON.parse(fs.readFileSync(__dirname+'/../../standard/registry/catalogue.json','utf8'));
const defs=fs.readFileSync(__dirname+'/../../standard/registry/glyph-library.svg','utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
let passed=0,total=0;
function test(name,fn){total++;try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
const source=(body,version='0.6',view='')=>`ddn "${version}"; module "test"; data m { ${body} } view v { data: [@m]; publication { size: content; } ${view} }`;
const build=(body,version,view)=>DDN.build({'m.ddn':source(body,version,view)},'m.ddn','v',reg).ir;
const render=(body,version,view)=>Render.render(build(body,version,view),reg,defs);
const node=r=>r.scene.nodes[0];
const table=(columns,rest='')=>`object t "Customer" { kind: table; ${columns} fields { id "Customer identifier" { key: primary; datatype: integer; description: "Complete customer notes"; } } ${rest} }`;
const rejects=(body,code,version)=>assert.throws(()=>render(body,version),e=>e.code===code);

test('structured cells paint entire values and preserve row identity',()=>{
 const r=render(table('columns { name {} datatype {} notes { path: "description"; } }','max_width: 600px;'),undefined,'place @m.t { size: [600px, 200px]; }');
 assert.ok(/>Customer identifier<\/text>/.test(r.svg),'complete name painted');assert.match(r.svg,/>integer<\/text>/);
 assert.match(r.svg,/>Complete customer notes<\/title>/);assert.match(r.svg,/data-member="test::m.t.id"/);
 assert.equal(node(r).fieldRows.length,1);assert.equal(node(r).fieldRows[0].fullCells[0],'Customer identifier');
});
test('legacy field text clips by default, keeps accessible full label and source',()=>{
 const name='A very long field label '.repeat(8);const body=`object t {kind: table; fields { f "${name}"; } }`;
 const r=render(body),g=node(r);assert.equal(g.fieldRows[0].labelLines.length,1);
 assert.match(g.fieldRows[0].labelLines[0],/…$/);assert.ok(r.svg.includes('<title>'+name+'</title>'));
 assert.equal(build(body).elements[0].fields[0].name,name);
});
test('field wrap overrides element default and nested field order stays intact',()=>{
 const label='Long nested field name '.repeat(9);const r=render(`object t {kind: table; text_wrap: on; fields { parent "${label}" {text_wrap: off; fields { child "${label}"; } } } }`);
 assert.equal(node(r).fieldRows[0].labelLines.length,1);assert.ok(node(r).fieldRows[1].labelLines.length>1);
});
test('clipped datatype details retain their full accessible value',()=>{
 const r=render(`object t { kind: table; fields { f {datatype: "${'LONGTYPE'.repeat(30)}";} } }`,undefined,'display { datatypes: show; }');
 assert.ok(node(r).fieldRows[0].fullDetails.includes('LONGTYPE'.repeat(30)));assert.ok(r.svg.includes('LONGTYPE'.repeat(30)));
});
test('grapheme clipping does not split combining characters',()=>{
 const full='e\u0301'.repeat(100);const r=render(`object t {kind: table; fields { f "${full}"; }}`);
 const clipped=node(r).fieldRows[0].labelLines[0];assert.match(clipped, /^(?:e\u0301)*…$/);
});
test('schema opt-in, hidden and on-demand columns; legacy source unchanged',()=>{
 assert.equal(node(render(table(''))).columnLayout,undefined);
 const cols=node(render(table('columns {}'))).columnLayout.cols;
 assert.ok(cols.some(c=>c.id==='name'));assert.ok(!cols.some(c=>['domain','system'].includes(c.id)));
 const shown=node(render(table('columns { system {visibility: shown;} }','max_width: 600px;'))).columnLayout.cols;
 assert.ok(shown.some(c=>c.id==='system'));
});
test('all-hidden schema does not fall back to revealing field rows',()=>{
 const cols='columns { name {width: equal; visibility: hidden;} }';const r=render(table(cols));
 assert.equal(node(r).columnLayout.cols.length,0);assert.ok(!r.svg.includes('Customer identifier'));
});
test('declared row and column ordering survives on UML profile shapes',()=>{
 const r=render(`object c {kind: "uml.class"; columns { datatype {} name {} } fields { op {x_member: {kind: operation};} attr; }}`);
 assert.deepEqual(node(r).columnLayout.cols.map(c=>c.id),['datatype','name']);
 assert.deepEqual(node(r).fieldRows.map(r=>r.id.split('.').at(-1)),['op','attr']);assert.match(r.svg,/ddn-columns/);
});
test('fixed widths clamp before distributing remaining space; percentages scale',()=>{
 const r=render(table('columns { name {width: 100ch; max_chars: 3;} datatype {width: 25%;} notes {width: equal;} }'));
 const [a,b,c]=node(r).columnLayout.cols;assert.ok(a._px<50);assert.ok(Math.abs(c._px/b._px-3)<.001);
 const pct=node(render(table('columns { name {width: 20%;} datatype {width: 30%;} }'))).columnLayout.cols;
 assert.ok(Math.abs(pct[1]._px/pct[0]._px-1.5)<.001);assert.ok(Math.abs(pct.reduce((n,c)=>n+c._px,0)-(node(r).w-30))<.001);
});
test('columns recompute to an authored width instead of expanding the element',()=>{
 const g=node(render(table('columns { name {} datatype {} }','max_width: 180px;')));
 assert.equal(g.w,180);assert.equal(g.columnLayout.cols.reduce((n,c)=>n+c._px,0),150);
});
test('opposing equal-column bounds redistribute without rejecting a feasible fit',()=>{
 const Layout=require('../runtime/ddn-field-layout.js').default;
 const cols=Layout.columns([{id:'a',width:{kind:'equal'},min_chars:80},{id:'b',width:{kind:'equal'},max_chars:30}],100,1,(code,message)=>{throw new Error(code+': '+message);});
 assert.equal(cols[0]._px,80);assert.ok(Math.abs(cols[1]._px-20)<.001);
});
test('impossible minimum widths and fixed widths reject with CL02',()=>{
 rejects(table('columns { name {width: 100ch;} }','max_width: 180px;'),'DDN-CL02');
 rejects(table('columns { name {min_chars: 100;} datatype {min_chars: 100;} }','max_width: 180px;'),'DDN-CL02');
});
test('zero-width optional cells use SVG clips and preserve accessible values',()=>{
 const r=render(table('columns { name {width: 0%;} datatype {} }'));
 assert.equal(node(r).columnLayout.cols[0]._px,0);assert.match(r.svg,/clip-path="url\(#ddn-cell-/);
 assert.ok(r.svg.includes('<title>Customer identifier</title>'));
});
test('invalid column shapes, nesting, duplicates and unsafe paths reject',()=>{
 for(const c of ['columns { bogus: true; }','columns { name {nested {}} }','columns { name {} name {} }','columns { name {bogus: true;} }'])rejects(table(c),'DDN-CL01');
 for(const c of ['columns { name {path: "__proto__.x";} }','columns { name {width: -1%;} }','columns { name {width: 2px;} }','columns { name {min_chars: 8;max_chars: 2;} }'])rejects(table(c),'DDN-CL02');
});
test('visibility-only entries validate values, duplicates, names and mixed overrides',()=>{
 rejects(table('columns { system {visibility: invisible;} }'),'DDN-CL02');
 rejects(table('columns { system {visibility: shown;} system {visibility: hidden;} }'),'DDN-CL01');
 rejects(table('columns { bogus {visibility: hidden;} }'),'DDN-CL03');
 rejects(table('columns { system {visibility: shown;} name {width: equal;} }'),'DDN-CL03');
});
test('hiding a relation-keyed column rejects, unrelated keys may be hidden',()=>{
 const body=table('columns { key {visibility: hidden;} }');render(body);
 rejects(body+' object u {kind: table; fields {id {key: primary;}}} relation r @t.id -> @u.id {verb: references;}','DDN-CL03');
});
test('new syntax is gated below 0.6 and invalid text_wrap is coded',()=>{
 rejects(table('columns {}'),'DDN-V04','0.5');rejects(table('','text_wrap: on;'),'DDN-V04','0.5');
 rejects('object t {fields { f {text_wrap: on;} }}','DDN-V04','0.5');
 rejects(table('','text_wrap: true;'),'DDN-FL01');rejects('object t {fields { f {text_wrap: bad;} }}','DDN-FL01');
});
test('long marker titles wrap within width and grow downward',()=>{
 const r=render(`object s "${'Long title '.repeat(20)}" {kind: "state.initial"; max_width: 150px;}`);
 const g=node(r);assert.equal(g.w,150);assert.ok(g.titleLines.length>1);assert.ok(g.h>85);
 assert.equal((r.svg.match(/Long/g)||[]).length>=20,true);
 const Shapes=require('../runtime/ddn-shapes.js').default;
 const attachment=Shapes.anchor(g,'east',[g.x+g.w,g.y+g.h/2]);
 assert.equal(attachment[1],g.y+g.markerHeight/2-8*g.scale,'endpoint stays on the painted marker above its caption');
});
test('circle titles never grow width to match text height',()=>{
 const g=node(render(`object c "${'Long title '.repeat(30)}" {kind: "flow.connector"; max_width: 180px;}`));
 assert.equal(g.w,180);assert.ok(g.h>180);
});
test('UML field rows respect no-wrap and wrap overrides',()=>{
 const label='operation with long parameters '.repeat(8);
 const a=node(render(`object c {kind: "uml.class"; fields { f "${label}"; }}`));
 const b=node(render(`object c {kind: "uml.class"; fields { f "${label}" {text_wrap: on;} }}`));
 assert.equal(a.fieldRows[0].labelLines.length,1);assert.ok(b.fieldRows[0].labelLines.length>1);
});
test('column render is byte deterministic and raw bindings stay intact in exports',()=>{
 const body=table('columns { name {} notes {path: "description";} }');
 assert.equal(render(body).svg,render(body).svg);assert.equal(build(body).elements[0].fields[0].properties.description,'Complete customer notes');
});
test('descriptions render below fields on ordinary and profile elements',()=>{
 for(const kind of ['table','uml.class']){const r=render(`object t {kind: "${kind}"; description: "Additional prose body"; fields { f; }}`);assert.ok(r.svg.includes('>Additional prose body</text>'));}
 const dark=render('object t {kind: "uml.class"; description: "Readable dark prose";}',undefined,'style {theme: dark;}');
 assert.match(dark.svg,/<text[^>]+fill="#EDF3FC"[^>]*>Readable dark prose<\/text>/);
 const r=render('object t {kind: table; description: "Hidden prose";}',undefined,'display {fields: none;}');assert.ok(!r.svg.includes('>Hidden prose</text>'));
});
console.log(`field-presentation ${passed}/${total}`);
