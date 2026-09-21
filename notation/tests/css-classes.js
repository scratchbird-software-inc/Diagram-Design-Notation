/* SPDX-License-Identifier: GPL-2.0-or-later. B1-003 deterministic CSS class hooks + ddn.css. */
'use strict';
const A=require('../dist/ddn.global.js'),DDN=require('../runtime/ddn-core.js'),Render=require('../runtime/ddn-render.js');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}

const graphSource='ddn "0.5";\nmodule "m";\ndata m {\n    object orders "Orders" { kind: table; maturity: approved; fields { field order_id { key: primary; } field status; } }\n    object events "Events" { kind: topic; fields { field event_id { key: primary; } } }\n    relation r1 @orders -> @events { kind: publishes_to; }\n}\nview v "Orders / graph" {\n    data: [@m];\n    frame scope "CORE" { members: [@m.orders, @m.events]; }\n}\n';
const chartSource='ddn "0.5";\nmodule "c";\ndata c {\n    object r1 "Q1" { kind: record; x_record: {"quarter": "Q1", "total": 12}; }\n    object r2 "Q2" { kind: record; x_record: {"quarter": "Q2", "total": 19}; }\n    object r3 "Q3" { kind: record; x_record: {"quarter": "Q3", "total": 7}; }\n}\nview bars "Quarterly / bars" {\n    data: [@c];\n    projection { kind: chart; profile: "chart.basic@1"; records: [@c.r1, @c.r2, @c.r3]; mark: bar; x: "x_record.quarter"; y: "x_record.total"; }\n}\nview pie "Quarterly / shares" {\n    data: [@c];\n    projection { kind: chart; profile: "chart.basic@1"; records: [@c.r1, @c.r2, @c.r3]; mark: pie; x: "x_record.quarter"; y: "x_record.total"; }\n}\n';
const panelSource='ddn "0.5";\nmodule "p";\ndata p {\n    object a "Alpha" { kind: note; description: "Synthetic note alpha."; }\n    object b "Beta" { kind: note; description: "Synthetic note beta."; }\n}\nview board "Notes / board" {\n    data: [@p];\n    projection { kind: panels; profile: "panels.basic@1"; columns: 2; panels: [\n        {id:"left",title:"LEFT",row:0,column:0,rowspan:1,colspan:1,items:[@p.a]},\n        {id:"right",title:"RIGHT",row:0,column:1,rowspan:1,colspan:1,items:[@p.b]}]; }\n}\n';

const graph=A.createWorkspace({'m.ddn':graphSource}),chart=A.createWorkspace({'c.ddn':chartSource}),panels=A.createWorkspace({'p.ddn':panelSource});
const g1=graph.renderSync({entry:'m.ddn',view:'v'}),c1=chart.renderSync({entry:'c.ddn',view:'bars'}),p1=panels.renderSync({entry:'p.ddn',view:'board'});

test('Graph view: root, node, relation, field, label and frame classes present',()=>{
 const svg=g1.svg;
 assert.match(svg,/<svg class="ddn-svg ddn-view-graph ddn-profile-ddn-1 ddn-font-[0-9a-f]+"/,'root classes');
 assert.match(svg,/<g class="ddn-node ddn-kind-tbl" data-id=/,'table node class');
 assert.match(svg,/<g class="ddn-node ddn-kind-top" data-id=/,'topic node class');
 assert.match(svg,/<g class="ddn-relation ddn-rel ddn-verb-publish" /,'relation classes');
 assert.ok((svg.match(/class="ddn-field" data-member=/g)||[]).length>=3,'field rows classed');
 assert.match(svg,/<g class="ddn-label" data-id=/,'relation label classed');
 assert.match(svg,/<g class="ddn-frame" data-frame=/,'frame classed');
});

test('Chart view: root and typed mark classes; pie maps to arc',()=>{
 assert.match(c1.svg,/<svg class="ddn-svg ddn-view-chart ddn-profile-chart-basic-1"/,'chart root classes');
 assert.ok((c1.svg.match(/class="ddn-mark ddn-mark-bar"/g)||[]).length>=3,'bar marks typed');
 const pie=chart.renderSync({entry:'c.ddn',view:'pie'});
 assert.ok((pie.svg.match(/class="ddn-mark ddn-mark-arc"/g)||[]).length>=3,'pie sectors classed as arc');
});

test('Panels view: panel containers classed',()=>{
 assert.ok((p1.svg.match(/<g class="ddn-panel" data-panel="/g)||[]).length===2,'two panels classed');
 assert.match(p1.svg,/<svg class="ddn-svg ddn-view-panels ddn-profile-panels-basic-1"/,'panels root classes');
});

test('Slugs: lowercase, non-alphanumeric collapsed to dashes, registry-derived only',()=>{
 assert.equal(Render.slug('TBL'),'tbl');
 assert.equal(Render.slug('chart.basic@1'),'chart-basic-1');
 assert.equal(Render.slug('  Weird Code!! '),'weird-code');
 assert.equal(Render.cls('a',null,'b',['c',false]),'a b c');
});

test('Determinism: two renders of every fixture are byte-identical',()=>{
 assert.equal(graph.renderSync({entry:'m.ddn',view:'v'}).svg,g1.svg,'graph');
 assert.equal(chart.renderSync({entry:'c.ddn',view:'bars'}).svg,c1.svg,'chart');
 assert.equal(panels.renderSync({entry:'p.ddn',view:'board'}).svg,p1.svg,'panels');
});

test('Inline-override precedence (structural): script-level paint stays inline while the class remains',()=>{
 // Every script-driven paint is an inline presentation attribute beside the
 // class hook; page CSS can only restyle through the class, and the inline
 // attribute is emitted regardless.
 const node=g1.svg.match(/<g class="ddn-node ddn-kind-tbl"[\s\S]*?<\/g>/)[0];
 assert.match(node,/<rect [^>]*fill="#[0-9A-Fa-f]{6}"[^>]*stroke="#[0-9A-Fa-f]{6}"/,'inline paint present on the classed node');
 // An object-level declaration (maturity: approved) adds its own inline-painted badge on that one node.
 assert.match(node,/<rect [^>]*fill="#[0-9A-Fa-f]{6}" stroke="#[0-9A-Fa-f]{6}"\/><text[^>]*>APR<\/text>/,'object override badge inline');
 assert.ok(!g1.svg.includes('!important'),'no !important in renderer output');
});

test('dist/ddn.css is shipped with real rules and no !important',()=>{
 const css=fs.readFileSync(path.join(root,'dist/ddn.css'),'utf8');
 assert.match(css,/:root\s*\{[^}]*--ddn-font:/s,'custom property defaults');
 for(const sel of ['.ddn-svg','.ddn-node','.ddn-rel','.ddn-label','.ddn-field','.ddn-mark'])assert.ok(css.includes(sel),sel+' rule');
 assert.ok(css.includes('var(--ddn-font)'),'font mapped to custom property');
 assert.ok(!css.includes('!important'),'no !important');
});

test('Component theme attribute injects a constructed stylesheet of --ddn-* overrides',()=>{
 const src=fs.readFileSync(path.join(root,'studio/src/component.js'),'utf8');
 assert.match(src,/hasAttribute\('theme'\)/,'theme attribute observed');
 assert.match(src,/new CSSStyleSheet\(\)/,'constructed stylesheet');
 assert.match(src,/\^--ddn-/,'only ddn custom properties accepted');
 const bundle=fs.readFileSync(path.join(root,'dist/ddn.global.js'),'utf8');
 assert.ok(bundle.includes("hasAttribute('theme')"),'theme support rebuilt into dist');
});

const pass=results.filter(r=>r.pass).length;
console.log(`CSS class hooks ${pass}/${results.length}`);
if(pass!==results.length)process.exitCode=1;
