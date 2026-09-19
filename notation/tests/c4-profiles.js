/* SPDX-License-Identifier: GPL-2.0-or-later. C4 profile set: positive, negative and determinism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const SRC=`ddn "0.5";
module "test.c4";

format styles {
    notation core { registry: "ddn-core@0.3"; }
    style classic { look: classic; theme: default; font: sans; seed: 42; }
    layout wires { algorithm: layered; routing: orthogonal; direction: right; gap: 80px; }
    display compact { fields: none; kind: icon_token; maturity: none; badges: none; }
    publication screen { size: content; margin: 30px; minimum_text: 8pt; overflow: error; }
    legend words { mode: text; placement: right; width: 280px; }
    bundle technical {
        notation: @core; style: @classic; layout: @wires; display: @compact; publication: @screen; legend: @words;
    }
}

data shop {
    object customer "Customer" { kind: "c4.person"; }
    object site "Online shop" { kind: "c4.system"; }
    object mailer "Notification service" { kind: "c4.system"; }
    object web "Web application" { kind: "c4.container"; }
    object api "API service" { kind: "c4.container"; }
    object db "Orders database" { kind: "c4.store"; }
    object events "Order events" { kind: "c4.queue"; }
    object checkout "Checkout component" { kind: "c4.component"; }
    object cart "Cart component" { kind: "c4.component"; }
    relation browses "Browses and buys" @customer -> @site { kind: "c4.rel"; }
    relation notifies "Sends notifications" @site -> @mailer { kind: "c4.rel"; }
    relation visits @customer -> @web { kind: "c4.rel"; }
    relation orders "Reads/writes orders" @web -> @db { kind: "c4.rel"; }
    relation publishes "Publishes order events" @web -> @events { kind: "c4.rel"; }
    relation persists @checkout -> @db { kind: "c4.rel"; }
    relation uses "Uses" @cart -> @checkout { kind: "c4.rel"; }
}

view context "Synthetic shop / C4 context" {
    data: [@shop]; format: @styles.technical;
    projection { kind: graph; profile: "c4.context@1"; }
    select: [@shop.customer, @shop.site, @shop.mailer];
}

view container "Synthetic shop / C4 container" {
    data: [@shop]; format: @styles.technical;
    projection { kind: graph; profile: "c4.container@1"; }
    select: [@shop.site, @shop.web, @shop.api, @shop.db, @shop.events];
    frame system_boundary "Online shop" { scope: @shop.site; members: [@shop.web, @shop.api, @shop.db, @shop.events]; }
}

view component "Synthetic shop / C4 component" {
    data: [@shop]; format: @styles.technical;
    projection { kind: graph; profile: "c4.component@1"; }
    select: [@shop.customer, @shop.web, @shop.checkout, @shop.cart];
    frame container_boundary "Web application" { scope: @shop.web; members: [@shop.checkout, @shop.cart]; }
}
`;
const workspace=(src=SRC)=>A.createWorkspace({'main.ddn':src});
const run=(view,src)=>workspace(src).renderSync({entry:'main.ddn',view});
const edited=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return SRC.replace(before,after);};
const byId=(scene,id)=>scene.nodes.find(n=>n.id.endsWith('.'+id));

test('All three C4 views render with expected node counts',()=>{
 for(const [view,count] of [['context',3],['container',5],['component',4]]){
  const r=run(view);assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('</svg>'));
  assert.equal(r.scene.nodes.length,count,view+' node count');
 }
});
test('Context view shows actor silhouette and round systems, no frames',()=>{
 const r=run('context');
 assert.ok(r.svg.includes('data-shape="actor"'));
 assert.ok(r.svg.includes('data-shape="round"'));
 assert.equal(r.scene.frames.length,0);
});
test('Container view renders one boundary frame containing all four member nodes',()=>{
 const r=run('container');
 assert.equal(r.scene.frames.length,1);
 const f=r.scene.frames[0];
 assert.equal(f.name,'Online shop');
 for(const id of ['web','api','db','events']){
  const n=byId(r.scene,id);
  assert.ok(n.x>=f.x&&n.y>=f.y&&n.x+n.w<=f.x+f.w&&n.y+n.h<=f.y+f.h,id+' inside frame');
 }
});
test('Component view renders its boundary frame scoped to the container',()=>{
 const r=run('component');
 assert.equal(r.scene.frames.length,1);
 const f=r.scene.frames[0],web=byId(r.scene,'web');
 assert.equal(f.scope,web.id);
 assert.equal(f.name,'Web application');
 for(const id of ['checkout','cart']){const n=byId(r.scene,id);assert.ok(n.x>=f.x&&n.y>=f.y&&n.x+n.w<=f.x+f.w&&n.y+n.h<=f.y+f.h,id+' inside frame');}
});
test('Relation names render with text legend mode',()=>{
 const r=run('context');
 assert.ok(r.svg.includes('Browses and buys'));
 assert.ok(r.svg.includes('Sends notifications'));
});
test('Context view rejects field-level member endpoints',()=>{
 const src=edited('object cart "Cart component"','object t "Order extract" { kind: table; fields { field order_id; } }\n    object cart "Cart component"')
  .replace('relation uses "Uses" @cart -> @checkout { kind: "c4.rel"; }','relation uses "Uses" @cart -> @checkout { kind: "c4.rel"; }\n    relation peek @customer -> @t.order_id { kind: assoc; }')
  .replace('select: [@shop.customer, @shop.site, @shop.mailer];','select: [@shop.customer, @shop.site, @shop.mailer, @shop.t];');
 throws(()=>run('context',src),'DDN-PJ100');
});
test('C4 kinds reject attribute fields',()=>{
 throws(()=>run('context',edited('object customer "Customer" { kind: "c4.person"; }','object customer "Customer" { kind: "c4.person"; fields { field name; } }')),'DDN-PF003');
});
test('Container view without frame rejected',()=>{
 throws(()=>run('container',edited('    frame system_boundary "Online shop" { scope: @shop.site; members: [@shop.web, @shop.api, @shop.db, @shop.events]; }\n','')),'DDN-PJ101');
});
test('Container frame scoped to a store rejected',()=>{
 throws(()=>run('container',edited('scope: @shop.site;','scope: @shop.db;')),'DDN-PJ101');
});
test('Container frame omitting a selected interior node rejected',()=>{
 throws(()=>run('container',edited('members: [@shop.web, @shop.api, @shop.db, @shop.events];','members: [@shop.web, @shop.api, @shop.db];')),'DDN-PJ101');
});
test('Core kind participant in context view rejected',()=>{
 const src=edited('object cart "Cart component"','object t "Order extract" { kind: table; }\n    object cart "Cart component"')
  .replace('select: [@shop.customer, @shop.site, @shop.mailer];','select: [@shop.customer, @shop.site, @shop.mailer, @shop.t];');
 throws(()=>run('context',src),'DDN-PF007');
});
test('Non-c4.rel relation in container view rejected',()=>{
 const src=edited('relation orders "Reads/writes orders" @web -> @db { kind: "c4.rel"; }','relation orders "Reads/writes orders" @web -> @db { kind: "assoc"; }');
 throws(()=>run('container',src),'DDN-PF007');
});
test('Unknown C4 profile version rejected',()=>{
 throws(()=>run('context',edited('profile: "c4.context@1";','profile: "c4.context@2";')),'DDN-PF001');
});
test('Wrong projection kind rejected',()=>{
 const src=edited('view context "Synthetic shop / C4 context" {\n    data: [@shop]; format: @styles.technical;\n    projection { kind: graph; profile: "c4.context@1"; }\n    select: [@shop.customer, @shop.site, @shop.mailer];','view charted "Synthetic shop / wrong kind" {\n    data: [@shop]; format: @styles.technical;\n    projection { kind: chart; profile: "c4.context@1"; }\n    select: [@shop.customer, @shop.site, @shop.mailer];');
 throws(()=>run('charted',src),'DDN-PF002');
});
test('Deterministic rerender of all three views',()=>{
 for(const v of ['context','container','component'])assert.equal(run(v).svg,run(v).svg,v+' deterministic');
});
const report={runtime:A.VERSION,scope:'C4 profile set validation and rendering; not C4-brand certification.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/c4-profiles-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('C4 profiles',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
