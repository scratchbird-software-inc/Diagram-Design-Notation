/* SPDX-License-Identifier: GPL-2.0-or-later. Deterministic build and semantic checks for the teaching gallery. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),DDN=require('../runtime/ddn-core.js'),Render=require('../runtime/ddn-render.js');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const uc=path.join(root,'../examples/use-cases');
const cat=JSON.parse(fs.readFileSync(path.join(uc,'catalogue.json'),'utf8'));
const man=JSON.parse(fs.readFileSync(path.join(uc,'manifest.json'),'utf8'));
const files={};for(const r of man.results)for(const f in r.sourceHashes)files[f]=fs.readFileSync(path.join(uc,f.replace(/^use-cases\//,'')),'utf8');
const report={engine:DDN.VERSION,edition:cat.edition,views:[],checks:[],status:'pass'};
function check(name,fn){fn();report.checks.push({name,status:'pass'});console.log('PASS',name);}
check('22 scenarios and 27 compiled views',()=>{assert.equal(cat.cases.length,22);assert.equal(man.results.length,27);});
for(const r of man.results){
 const {ir}=DDN.build(files,r.entry,r.view,reg),a=Render.render(ir,reg,defs),b=Render.render(ir,reg,defs);
 assert.equal(a.svg,b.svg,'nondeterministic '+r.svg);assert.equal(hash(a.svg),r.svgHash,'SVG hash '+r.svg);
 assert.equal(a.svg,fs.readFileSync(path.join(uc,r.svg.replace(/^use-cases\//,'')),'utf8'),'stale SVG '+r.svg);
 assert.equal(hash(JSON.stringify(DDN.semanticJSON(ir))),r.semanticHash);
 for(const [f,h]of Object.entries(r.sourceHashes))assert.equal(hash(files[f]),h,'stale source '+f);
 assert.deepEqual(a.scene,JSON.parse(fs.readFileSync(path.join(uc,r.scene.replace(/^use-cases\//,'')),'utf8')));
 assert.ok(!a.diagnostics.some(d=>d.severity==='error'),'unexpected error diagnostics '+r.svg);
 // A route must not pass through an unrelated box. This is a fixture check, not a new router.
 for(const route of a.scene.routes){const relation=ir.relations.find(x=>x.id===route.id);
  for(const n of a.scene.nodes){if([relation.from.element,relation.to.element].includes(n.id))continue;
   for(let i=1;i<route.points.length;i++){const [x,y]=route.points[i-1],[xx,yy]=route.points[i];
    if(y===yy&&y>n.y+1&&y<n.y+n.h-1)assert.ok(Math.max(x,xx)<=n.x||Math.min(x,xx)>=n.x+n.w,`route ${route.id} crosses ${n.id}`);
    if(x===xx&&x>n.x+1&&x<n.x+n.w-1)assert.ok(Math.max(y,yy)<=n.y||Math.min(y,yy)>=n.y+n.h,`route ${route.id} crosses ${n.id}`);
   }
  }
 }
 report.views.push({entry:r.entry,view:r.view,deterministic:true,hashesMatch:true,unrelatedNodeIntersections:0,diagnostics:a.diagnostics.map(d=>d.code)});
}
check('All primary scenarios have no absolute placement or waypoint coordinates',()=>{const auto=cat.cases.filter(c=>c.layout==='automatic grid');assert.equal(auto.length,16);for(const c of auto)assert.ok(!/\bat\s*:|\bvia\s*:|\bcallout\s*:/.test(files[c.entry]),c.entry);});
check('Classic, compact sketch and neo share one semantic model',()=>{const rows=man.results.filter(r=>r.slug==='relational');assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.semanticHash)).size,1);assert.equal(new Set(rows.map(r=>r.svgHash)).size,3);});
check('Shared Orders identity is reused across schema, dependencies, namespaces, deployment and lineage',()=>{const wanted=['relational','sql-dependencies','namespaces','hybrid-deployment','lineage'];const ids=wanted.map(slug=>{const r=man.results.find(r=>r.slug===slug);const {ir}=DDN.build(files,r.entry,r.view,reg);const n=ir.elements.find(n=>n.ref==='tables.orders');assert.ok(n);return n.id;});assert.equal(new Set(ids).size,1);});
check('Subdiagram destinations exist beside the exported overview SVG',()=>{const r=man.results.find(r=>r.slug==='linked-documentation');const svg=fs.readFileSync(path.join(uc,r.svg.replace(/^use-cases\//,'')),'utf8');for(const m of svg.matchAll(/href="([^"#]+\.svg)"/g))assert.ok(fs.existsSync(path.resolve(path.dirname(path.join(uc,r.svg.replace(/^use-cases\//,''))),m[1])));});
check('Temporal fixture uses half-open recorded and valid intervals',()=>{const r=man.results.find(r=>r.slug==='temporal');const ir=DDN.build(files,r.entry,r.view,reg).ir;const rows=ir.elements.find(n=>n.type==='sample').properties.rows;
 const status=(valid,known)=>rows.filter(x=>x[2]<=valid&&(!x[3]||valid<x[3])&&x[4]<=known&&(!x[5]||known<x[5])).map(x=>x[1]);
 assert.deepEqual(status('2026-03-04','2026-03-04'),['Active']);assert.deepEqual(status('2026-03-04','2026-03-06'),['Suspended']);});
fs.writeFileSync(path.join(root,'tests/use-cases-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({views:report.views.length,checks:report.checks.length,status:report.status}));
