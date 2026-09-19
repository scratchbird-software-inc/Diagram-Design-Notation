/* SPDX-License-Identifier: GPL-2.0-or-later. Pyramid profile: panels.pyramid@1 trapezoid bands, centered labels, side annotations. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='39-pyramid.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='tiers',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const polygons=svg=>[...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m=>{const pts=m[1].trim().split(/\s+/).map(Number),xs=pts.filter((_,i)=>i%2===0),ys=pts.filter((_,i)=>i%2===1),topY=Math.min(...ys),botY=Math.max(...ys),atY=y=>pts.reduce((a,_,i)=>i%2===1&&Math.abs(pts[i]-y)<0.01?a.concat(pts[i-1]):a,[]);return{topY,botY,topW:Math.max(...atY(topY))-Math.min(...atY(topY)),botW:Math.max(...atY(botY))-Math.min(...atY(botY))};}).sort((a,b)=>a.topY-b.topY);
test('Pyramid renders exactly 4 polygon bands with all band titles',()=>{const r=run();assert.match(r.svg,/<svg/);
 assert.equal((r.svg.match(/<polygon /g)||[]).length,4,'exactly 4 trapezoid polygons');
 for(const t of ['DEDICATED ENGINEER','PRIORITY SUPPORT','STANDARD SUPPORT','COMMUNITY &amp; SELF-SERVICE'])assert.ok(r.svg.includes(t),'SVG missing band title '+t);});
test('Geometry: bottom band spans the full drawing width; each higher band is narrower',()=>{const r=run(),W=r.scene.drawingBounds.w,bands=polygons(r.svg);
 assert.equal(bands.length,4);
 assert.ok(Math.abs(bands[3].botW-W)<=0.5,'bottom band bottom edge '+bands[3].botW+' spans drawing width '+W);
 for(let i=0;i<3;i++)assert.ok(bands[i].botW<bands[i+1].botW,'band '+i+' ('+bands[i].botW+') narrower than band '+(i+1)+' ('+bands[i+1].botW+')');
 for(const b of bands)assert.ok(b.topW<b.botW,'every band widens downward');});
test('Band labels are centered at cx=W/2 with middle anchor',()=>{const r=run(),cx=r.scene.drawingBounds.w/2;
 const labels=[...r.svg.matchAll(/<text x="([\d.-]+)" y="[\d.-]+" font-size="13" fill="[^"]+" font-weight="700" text-anchor="middle" >([^<]+)<\/text>/g)];
 assert.equal(labels.length,4,'one centered label line per band');
 for(const m of labels)assert.ok(Math.abs(Number(m[1])-cx)<=0.5,'label "'+m[2]+'" x='+m[1]+' equals cx='+cx);
 for(const t of ['DEDICATED ENGINEER','PRIORITY SUPPORT','STANDARD SUPPORT','COMMUNITY &amp; SELF-SERVICE'])assert.ok(labels.some(m=>m[2]===t),'centered label missing '+t);});
test('Side annotations render for annotated bands only; the items-less top band has none',()=>{const r=run();
 for(const a of ['ann_priority','ann_standard','ann_community']){assert.ok(r.svg.includes('data-id="ddn.examples.pyramid::tier_notes.'+a+'"'),'missing annotation group '+a);}
 const texts=[...r.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1]).join(' ');
 for(const frag of ['Priority channel:','Standard channel:','Community channel:'])assert.ok(texts.includes(frag),'annotation text missing '+frag);
 const ids=r.scene.marks.map(m=>m.sourceIds[0]).sort();
 assert.deepEqual(ids,['community','ddn.examples.pyramid::tier_notes.ann_community','ddn.examples.pyramid::tier_notes.ann_priority','ddn.examples.pyramid::tier_notes.ann_standard','dedicated','priority','standard'],'exactly 4 band marks and 3 annotation marks; the dedicated band carries no annotation group');});
test('Band count below 3 rejected as DDN-PJ089',()=>throws(()=>run('tiers',editFile('{id:"dedicated",title:"DEDICATED ENGINEER",row:0,column:0,rowspan:1,colspan:1},\n        {id:"priority",title:"PRIORITY SUPPORT",row:1,column:0,rowspan:1,colspan:1,items:[@tier_notes.ann_priority]},\n        ','')),'DDN-PJ089'));
test('A sixth band rejected as DDN-PJ089',()=>throws(()=>run('tiers',editFile('{id:"community",title:"COMMUNITY & SELF-SERVICE",row:3,column:0,rowspan:1,colspan:1,items:[@tier_notes.ann_community]}];','{id:"community",title:"COMMUNITY & SELF-SERVICE",row:3,column:0,rowspan:1,colspan:1,items:[@tier_notes.ann_community]},\n        {id:"platinum",title:"PLATINUM",row:4,column:0,rowspan:1,colspan:1},\n        {id:"concierge",title:"CONCIERGE",row:5,column:0,rowspan:1,colspan:1}];')),'DDN-PJ089'));
test('columns:2 rejected as DDN-PJ089',()=>throws(()=>run('tiers',editFile('columns:1;','columns:2;')),'DDN-PJ089'));
test('Non-contiguous band rows rejected as DDN-PJ089',()=>{const a=editFile('{id:"standard",title:"STANDARD SUPPORT",row:2','{id:"standard",title:"STANDARD SUPPORT",row:3'),b={...a,[FILE]:a[FILE].replace('{id:"community",title:"COMMUNITY & SELF-SERVICE",row:3','{id:"community",title:"COMMUNITY & SELF-SERVICE",row:4')};assert.ok(b[FILE]!==a[FILE],'second renumbering applied');
 throws(()=>run('tiers',b),'DDN-PJ089');});
test('kind:matrix with the pyramid profile rejected as DDN-PF002',()=>throws(()=>run('tiers',editFile('kind:panels;','kind:matrix;')),'DDN-PF002'));
test('panels.basic@1 keeps DDN-PJ009 on empty items (relaxation is pyramid-only)',()=>{
 const mini='ddn "0.4";module "ddn.examples.pyramid-regression";import "shared.ddn" as shared;data m {object n "Note" {kind: note; description: "Synthetic.";}}view v "Basic panels" {data:[@m];format: @shared.styles.technical;projection {kind:panels; profile:"panels.basic@1"; columns:1; panels:[{id:"a",title:"A",row:0,column:0,rowspan:1,colspan:1,items:[]}];}}';
 throws(()=>A.createWorkspace({'mini.ddn':mini,'shared.ddn':base['shared.ddn']}).renderSync({entry:'mini.ddn',view:'v'}),'DDN-PJ009');});
test('Deterministic rerender',()=>assert.equal(run('tiers').svg,run('tiers').svg));
const passed=results.filter(r=>r.pass).length;console.log(`Pyramid ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
