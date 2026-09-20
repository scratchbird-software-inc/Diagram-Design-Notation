/* SPDX-License-Identifier: GPL-2.0-or-later. Family tree profile family.tree@1: union join nodes, partner/parent edges, birth/death years, DDN-PJ129 cycle and DDN-PJ130 two-parent errors, endpoint contracts, determinism. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='56-family-tree.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='family',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
test('Example renders three generations with union join nodes and downward parent edges',()=>{
 const r=run();
 for(const s of ['Alex','Miriam','Sam','Jo','Robin'])assert.ok(r.svg.includes(s),'SVG missing '+s);
 const byId=Object.fromEntries(r.scene.nodes.map(n=>[n.id.split('::').pop(),n]));
 assert.equal(byId['m.union_am'].silhouette,'circle','union_am renders as a small circle');
 assert.equal(byId['m.union_sj'].silhouette,'circle','union_sj renders as a small circle');
 for(const id of ['m.alex','m.miriam','m.sam','m.jo','m.robin'])assert.equal(byId[id].silhouette,'round',id+' renders as a rounded person node');
 assert.ok(byId['m.alex'].y<byId['m.union_am'].y,'grandparents above their union');
 assert.ok(byId['m.union_am'].y<byId['m.sam'].y,'union above the child generation');
 assert.ok(byId['m.sam'].y<byId['m.union_sj'].y,'child generation above its union');
 assert.ok(byId['m.union_sj'].y<byId['m.robin'].y,'grandchild at the bottom');
 for(const rt of r.scene.routes){
  const pts=rt.points||[];
  assert.ok(pts.length>=2,'route has geometry');}
 const partnerRoutes=r.scene.routes.filter(rt=>/partner/.test(rt.id)),parentRoutes=r.scene.routes.filter(rt=>/parent|child/.test(rt.id));
 assert.equal(partnerRoutes.length,4,'four partner_of edges');
 assert.equal(parentRoutes.length,2,'two parent_of edges');
 for(const rt of parentRoutes){const pts=rt.points;assert.ok(pts[pts.length-1][1]>pts[0][1],'parent_of edge '+rt.id+' points downward');}
 const pc=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../standard/registry/profiles/catalogue.json'),'utf8'));
 for(const k of ['family.person','family.union'])assert.ok(pc.kinds.find(x=>x.keyword===k),'registry missing kind '+k);
 for(const v of ['family.partner_of','family.parent_of'])assert.ok(pc.relationships.find(x=>x.keyword===v),'registry missing verb '+v);
 assert.ok(pc.profiles.find(x=>x.id==='family.tree@1'),'registry missing profile family.tree@1');});
test('partner_of edges have no arrowheads; parent_of edges carry filled arrowheads',()=>{
 const r=run();
 const relRe=/<g class="ddn-relation"[^>]*data-id="([^"]+)"[\s\S]*?<\/g>\n?<\/g>|<g class="ddn-relation"[^>]*data-id="([^"]+)"[\s\S]*?(?=<g class="ddn-relation"|<\/svg>)/g;
 const found={};let m;
 while((m=relRe.exec(r.svg)))found[(m[1]||m[2]).split('::').pop()]=m[0];
 for(const id of Object.keys(found).filter(x=>/partner/.test(x)))assert.ok(!found[id].includes('L-10 -5L-10 5Z'),'partner edge '+id+' must have no arrowhead');
 for(const id of Object.keys(found).filter(x=>/child/.test(x))){
  assert.ok(found[id].includes('L-10 -5L-10 5Z'),'parent edge '+id+' must carry a filled arrowhead');
  assert.ok(found[id].includes('rotate(90)'),'parent edge '+id+' arrowhead points downward');}});
test('Birth/death years render in person node text',()=>{
 const r=run();
 for(const y of ['1948','2019','1951','1976','1978','2005'])assert.ok(r.svg.includes(y),'SVG missing year '+y);
 assert.ok(r.svg.includes('1948-2019'),'lifespan range renders for the deceased grandparent');
 assert.ok(r.svg.includes('b. 1951'),'birth-only year renders');});
test('A direct person-to-person partner_of link (childless couple) passes validation',()=>{
 const changes=editFile('    object union_sj { kind: "family.union"; }','    object taylor "Taylor" { kind: "family.person"; x_birth: 1980; }\n    object casey "Casey" { kind: "family.person"; x_birth: 1982; }');
 const changes2={[FILE]:changes[FILE]
  .replace('    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }','    relation partner_tc "partner of" @taylor -> @casey { kind: "family.partner_of"; }\n    relation child_robin "parent of" @sam -> @robin { kind: "family.parent_of"; }')
  .replace('    relation partner_sam "partner of" @sam -> @union_sj { kind: "family.partner_of"; }\n','')
  .replace('    relation partner_jo "partner of" @jo -> @union_sj { kind: "family.partner_of"; }\n','')
  .replace('@m.union_sj, ','@m.taylor, @m.casey, ')};
 const r=run('family',changes2);
 assert.ok(r.svg.includes('Taylor')&&r.svg.includes('Casey'),'childless couple renders');
 assert.deepEqual(r.diagnostics.filter(d=>String(d.code).startsWith('DDN-PJ12')||String(d.code).startsWith('DDN-PJ13')),[],'no family diagnostics');});
test('A parent_of cycle throws DDN-PJ129',()=>{
 const changes=editFile('    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }','    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }\n    relation cycle_a "parent of" @sam -> @alex { kind: "family.parent_of"; }\n    relation cycle_b "parent of" @alex -> @sam { kind: "family.parent_of"; }');
 assert.throws(()=>run('family',changes),e=>e.code==='DDN-PJ129','cycle must throw DDN-PJ129');});
test('A person with three distinct parent_of sources throws DDN-PJ130 (error, not a warning)',()=>{
 const changes=editFile('    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }','    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }\n    relation extra_parent "parent of" @alex -> @robin { kind: "family.parent_of"; }\n    relation extra_parent2 "parent of" @miriam -> @robin { kind: "family.parent_of"; }');
 assert.throws(()=>run('family',changes),e=>e.code==='DDN-PJ130','three parents must throw DDN-PJ130');
 const changes2=editFile('    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }','    relation child_robin "parent of" @union_sj -> @robin { kind: "family.parent_of"; }\n    relation extra_parent "parent of" @alex -> @robin { kind: "family.parent_of"; }');
 const r=run('family',changes2);
 assert.deepEqual(r.diagnostics.filter(d=>d.code==='DDN-PJ130'),[],'two distinct parents are fine and never warn');});
test('Endpoint contracts: partner_of from a union and parent_of targeting a union throw DDN102',()=>{
 const badSource=editFile('    relation partner_alex "partner of" @alex -> @union_am { kind: "family.partner_of"; }','    relation partner_alex "partner of" @union_sj -> @union_am { kind: "family.partner_of"; }');
 assert.throws(()=>run('family',badSource),e=>e.code==='DDN102','partner_of source must be a family.person');
 const badTarget=editFile('    relation child_sam "parent of" @union_am -> @sam { kind: "family.parent_of"; }','    relation child_sam "parent of" @union_am -> @union_sj { kind: "family.parent_of"; }');
 assert.throws(()=>run('family',badTarget),e=>e.code==='DDN102','parent_of target must be a family.person');});
test('A non-integer x_birth value throws contract failure DDN105',()=>{
 const changes=editFile('x_birth: 1951;','x_birth: "unknown";');
 assert.throws(()=>run('family',changes),e=>e.code==='DDN105','x_birth must be an integer year');});
test('Repeated render is byte-identical',()=>{
 assert.equal(run().svg,run().svg);});
const passed=results.filter(r=>r.pass).length;console.log(`Family tree ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
