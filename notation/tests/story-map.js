/* SPDX-License-Identifier: GPL-2.0-or-later. User story map: matrix.storymap@1 release rows × backbone columns with analysis.task cells. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='36-story-map.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='storymap',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const getPlan=(changes={})=>workspace(changes).projectionPlan(FILE,'storymap');
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
test('Story map renders: 2 release rows × 5 backbone columns, names in SVG',()=>{const r=run(),plan=getPlan();
 assert.equal(plan.rows.length,2,'two release rows');assert.equal(plan.columns.length,5,'five backbone columns');
 for(const t of ['Browse catalogue','Configure item','Check out','Pay','Fulfil order'])assert.ok(r.svg.includes(t),'SVG missing column header '+t);
 for(const t of ['List products','Cart','Guest checkout','Card payment','Picking list','Search by name','Photo gallery','Wallet payment','Tracking page'])for(const w of t.split(' '))assert.ok(r.svg.includes(w),'SVG missing story text '+t);
 assert.ok(r.svg.includes('RELEASE / BACKBONE STORY MAP'),'story map header caption');});
test('Cell provenance carries the story element id plus the placing relation id',()=>{const r=run(),plan=getPlan();
 const cell=plan.cells[0][0][0];
 assert.match(cell.id,/::shop\.s_list$/,'cell id is the story element id, not the relation id');
 assert.match(cell.relationId,/::shop\.r1_list$/,'cell relationId is the placing assoc relation');
 const mark=r.scene.marks.find(m=>m.sourceIds.includes(cell.id));
 assert.ok(mark,'a rendered mark references the story id');
 assert.ok(r.svg.includes(cell.id),'SVG data-source-ids contains the story element id');});
test('Order: row 0 is the first release; a release-2 story stays out of release 1',()=>{const plan=getPlan();
 assert.match(plan.rows[0].name,/Release 1/);assert.match(plan.rows[1].name,/Release 2/);
 const row0=plan.cells[0].flat().map(c=>c.value),row1=plan.cells[1].flat().map(c=>c.value);
 assert.ok(row0.includes('List products'),'release-1 story in row 0');
 assert.ok(!row0.includes('Search by name'),'release-2 story absent from row 0');
 assert.ok(row1.includes('Search by name')&&!row1.includes('List products'),'release-1 story absent from row 1');
 const shared=plan.cells[0][2].map(c=>c.value);assert.deepEqual(shared,['Guest checkout','Account checkout'],'joined cell lists both declared stories');});
test('A story in two releases rejected as DDN-PJ086 naming story and both releases',()=>{const e=editFile('relation r2_track @r2 -> @fulfil { kind: assoc; x_story: { task: @s_track }; }','relation r2_track @r2 -> @fulfil { kind: assoc; x_story: { task: @s_track }; } relation r2_guest @r2 -> @browse { kind: assoc; x_story: { task: @s_list }; }');
 throws(()=>run('storymap',e),'DDN-PJ086');
 assert.throws(()=>run('storymap',e),e=>e.message.includes('List products')&&e.message.includes('Release 1')&&e.message.includes('Release 2'));});
test('A story twice in one release rejected as DDN-PJ086 naming story and release',()=>{const e=editFile('relation r1_card @r1 -> @pay { kind: assoc; x_story: { task: @s_card }; }','relation r1_card @r1 -> @pay { kind: assoc; x_story: { task: @s_card }; } relation r1_card2 @r1 -> @fulfil { kind: assoc; x_story: { task: @s_card }; }');
 throws(()=>run('storymap',e),'DDN-PJ086');
 assert.throws(()=>run('storymap',e),e=>e.message.includes('Card payment')&&e.message.includes('Release 1'));});
test('Cell reference to a non-task object rejected as DDN-PJ093',()=>throws(()=>run('storymap',editFile('task: @s_list','task: @r2')),'DDN-PJ093'));
test('Cell reference outside the view data scope rejected as DDN-PJ007',()=>{const e=editFile('}\n\nview storymap','relation r2_hidden @r2 -> @browse { kind: assoc; x_story: { task: @backlog.s_hidden }; } }\ndata backlog { object s_hidden "Hidden story" { kind: "analysis.task"; } }\n\nview storymap');
 throws(()=>run('storymap',e),'DDN-PJ007');});
test('value:"name" rejected as DDN-PJ014',()=>throws(()=>run('storymap',editFile('value:"x_story.task"','value:"name"')),'DDN-PJ014'));
test('relation other than assoc rejected as DDN-PJ014',()=>throws(()=>run('storymap',editFile('relation:"assoc"','relation:"analysis.assignment"')),'DDN-PJ014'));
test('Regression: matrix.relations join lists both ids; raci still rejects join',()=>{const src=`ddn "0.4";\nmodule "regression.storymap";\ndata m {\n object a "A" { kind: record; }\n object b "B" { kind: record; }\n object c "C" { kind: record; }\n object d "D" { kind: record; }\n relation r1 "First" @a -> @c { kind: assoc; }\n relation r2 "Second" @a -> @c { kind: assoc; }\n}\nview v { data: [@m]; projection { kind:matrix; profile:"PRO"; rows:[@m.a, @m.b]; columns:[@m.c, @m.d]; relation:"REL"; value:"VAL"; duplicates:join; } }\n`;
 const w=A.createWorkspace({'mini.ddn':src.replace('PRO','matrix.relations@1').replace('REL','assoc').replace('VAL','name')});
 const plan=w.projectionPlan('mini.ddn','v');
 assert.equal(plan.cells[0][0].length,2,'joined relations cell lists both entries');
 const ids=plan.cells[0][0].map(c=>c.id);assert.ok(ids.some(i=>i.endsWith('::m.r1'))&&ids.some(i=>i.endsWith('::m.r2')),'both relation ids retained');
 throws(()=>A.createWorkspace({'mini.ddn':src.replace('PRO','matrix.raci@1').replace('REL','analysis.assignment').replace('VAL','x_assignment.code')}).renderSync({entry:'mini.ddn',view:'v'}),'DDN-PJ014');});
test('Deterministic rerender of the storymap view',()=>assert.equal(run().svg,run().svg));
const passed=results.filter(r=>r.pass).length;console.log(`Story map ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
