/* SPDX-License-Identifier: GPL-2.0-or-later. Venn profile: panels.venn@1 fixed circle geometry, x_sets membership, region counts. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='40-venn.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='overlap',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const circles=svg=>[...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)" fill="[^"]+" fill-opacity="\.16"/g)].map(m=>({x:+m[1],y:+m[2],r:+m[3]}));
const regionCounts=svg=>Object.fromEntries([...svg.matchAll(/<g class="ddn-mark" data-id="([^"]*)"[^>]*data-projection-mark="[^"]*"[^>]*><text x="([\d.-]+)" y="([\d.-]+)" font-size="16" fill="[^"]+" font-weight="700" text-anchor="middle"[^>]*>(\d+)<\/text>/g)].map(m=>({id:m[1],x:+m[2],y:+m[3],count:+m[4]})).map(o=>[o.id,o]));
// Default geometry (technical format, s=1): W=1050, H=600, cx=525, cy=310, r=180.
const CX=525,CY=310,R=180,D=3*R/5,K=0.866*D;
test('Venn renders 3 circles at the fixed triangle centers, 3 set labels and 7 region count labels',()=>{const r=run();assert.match(r.svg,/<svg/);
 const cs=circles(r.svg);assert.equal(cs.length,3,'exactly 3 set circles');
 const expected=[[CX-K,CY-0.5*D],[CX+K,CY-0.5*D],[CX,CY+D]];
 for(let i=0;i<3;i++){assert.ok(Math.abs(cs[i].x-expected[i][0])<=0.5,'circle '+i+' cx '+cs[i].x+' != '+expected[i][0]);assert.ok(Math.abs(cs[i].y-expected[i][1])<=0.5,'circle '+i+' cy '+cs[i].y+' != '+expected[i][1]);assert.ok(Math.abs(cs[i].r-R)<=0.5,'circle '+i+' radius');}
 for(const t of ['ATLAS','BEACON','CIPHER'])assert.ok(r.svg.includes('>'+t+'</text>'),'SVG missing set label '+t);
 const rc=regionCounts(r.svg);assert.equal(Object.keys(rc).length,7,'exactly 7 region count labels');});
test('Region counts equal the declared x_sets membership of the fixture',()=>{const rc=regionCounts(run().svg);
 const expected={atlas:1,beacon:1,cipher:1,'atlas+beacon':2,'atlas+cipher':1,'beacon+cipher':1,'atlas+beacon+cipher':1};
 for(const [key,count] of Object.entries(expected))assert.ok(rc[key]&&rc[key].count===count,'region '+key+' count '+(rc[key]&&rc[key].count)+' != '+count);});
test('Plan exposes venn.sets (3 ids) and venn.regions with all 7 keys',()=>{const plan=workspace().projectionPlan(FILE,'overlap');
 assert.deepEqual(plan.venn.sets.map(s=>s.id),['atlas','beacon','cipher']);
 assert.deepEqual(Object.keys(plan.venn.regions).sort(),['atlas','atlas+beacon','atlas+beacon+cipher','atlas+cipher','beacon','beacon+cipher','cipher'].sort());
 assert.equal(plan.venn.regions['atlas+beacon'].count,2);
 assert.deepEqual(plan.venn.regions['atlas+beacon'].ids.sort(),['ddn.examples.venn::features.f_audit','ddn.examples.venn::features.f_share']);});
// Two-set mini source: set b has no exclusive member, so the b-only region renders 0.
const mini2='ddn "0.4";module "ddn.examples.venn2";import "shared.ddn" as shared;data m {object i1 "Only A" {kind: note; description: "Synthetic."; x_sets: ["a"];}object i2 "Both" {kind: note; description: "Synthetic."; x_sets: ["a", "b"];}}view v "Two sets" {data:[@m];format: @shared.styles.technical;projection {kind:panels; profile:"panels.venn@1"; columns:1; panels:[{id:"a",title:"SET A",row:0,column:0,rowspan:1,colspan:1,items:[@m.i1, @m.i2]},{id:"b",title:"SET B",row:1,column:0,rowspan:1,colspan:1,items:[@m.i2]}];}}';
const runMini=(src=mini2)=>A.createWorkspace({'mini.ddn':src,'shared.ddn':base['shared.ddn']}).renderSync({entry:'mini.ddn',view:'v'});
test('Two-set variant: centers (cx-r/2,cy)/(cx+r/2,cy), overlap label at the centroid, empty region renders 0',()=>{const r=runMini();
 const cs=circles(r.svg);assert.equal(cs.length,2,'exactly 2 set circles');
 assert.ok(Math.abs(cs[0].x-(CX-R/2))<=0.5&&Math.abs(cs[0].y-CY)<=0.5,'first center '+cs[0].x+','+cs[0].y);
 assert.ok(Math.abs(cs[1].x-(CX+R/2))<=0.5&&Math.abs(cs[1].y-CY)<=0.5,'second center '+cs[1].x+','+cs[1].y);
 const rc=regionCounts(r.svg);
 assert.ok(rc['a+b']&&Math.abs(rc['a+b'].x-CX)<=0.5&&Math.abs(rc['a+b'].y-CY)<=0.5,'overlap label sits at the centroid '+rc['a+b'].x+','+rc['a+b'].y);
 assert.equal(rc['a+b'].count,1);assert.equal(rc.a.count,1);
 assert.ok(rc.b&&rc.b.count===0,'empty b-only region renders a 0 label');});
test('Four set panels rejected as DDN-PJ090',()=>throws(()=>run('overlap',editFile('items:[@features.f_sdk, @features.f_embed, @features.f_export, @features.f_search]}];','items:[@features.f_sdk, @features.f_embed, @features.f_export, @features.f_search]},\n        {id:"delta",title:"DELTA",row:3,column:0,rowspan:1,colspan:1,items:[@features.f_sdk]}];')),'DDN-PJ090'));
test('One set panel rejected as DDN-PJ090',()=>{const one=mini2.replace('},{id:"b",title:"SET B",row:1,column:0,rowspan:1,colspan:1,items:[@m.i2]}','}').replace(' x_sets: ["a", "b"];',' x_sets: ["a"];');assert.ok(one!==mini2,'mutation applied');throws(()=>runMini(one),'DDN-PJ090');});
test('Member missing x_sets rejected as DDN-PJ091',()=>throws(()=>runMini(mini2.replace(' x_sets: ["a"];','')),'DDN-PJ091'));
test('x_sets naming an undeclared set id rejected as DDN-PJ091',()=>throws(()=>runMini(mini2.replace('x_sets: ["a", "b"];','x_sets: ["a", "zz"];')),'DDN-PJ091'));
test('Member listed in panel b but x_sets:["a"] rejected as DDN-PJ091',()=>throws(()=>runMini(mini2.replace('x_sets: ["a", "b"];','x_sets: ["a"];')),'DDN-PJ091'));
test('kind:matrix with the venn profile rejected as DDN-PF002',()=>throws(()=>run('overlap',editFile('kind:panels;','kind:matrix;')),'DDN-PF002'));
test('Deterministic rerender',()=>assert.equal(run('overlap').svg,run('overlap').svg));
const passed=results.filter(r=>r.pass).length;console.log(`Venn ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
