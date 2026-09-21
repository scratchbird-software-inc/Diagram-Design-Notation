/* SPDX-License-Identifier: GPL-2.0-or-later. Pin-pattern invariants against the public 0.3 bundle. */
const A=require('../dist/ddn.global.js'),P=require('../runtime/ddn-palette.js'),fs=require('fs'),assert=require('assert/strict'),root=require('path').resolve(__dirname,'..');
const out=[];function t(name,fn){try{fn();out.push({name,pass:true});}catch(e){out.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.message);}}
const entry='examples/live/pinned-patterns.ddn',w=A.createWorkspace({[entry]:fs.readFileSync(root+'/../website/'+entry,'utf8')}),saved=w.getFiles();let renders={};
for(const v of w.views(entry)){let r;t(v.id+' compiles with current native routing',()=>{r=w.renderSync({entry,view:v.id});renders[v.id]=r;});if(!r)continue;
 t(v.id+' does not mutate DDN source',()=>assert.deepEqual(w.getFiles(),saved));
 if(!['single_pin','no_pins'].includes(v.id)){
  t(v.id+' keeps both exact source pins',()=>{for(const [id,x]of [['hub',580],['store',930]]){const n=r.scene.nodes.find(n=>n.id==='ddn.live.pinned-patterns::network.'+id);assert.equal(n.x,x);assert.equal(n.y,400);}});
  t(v.id+' centres the measured pin bounding rectangle',()=>{const ns=r.scene.nodes.filter(n=>n.id.endsWith('.hub')||n.id.endsWith('.store')),x=(Math.min(...ns.map(n=>n.x))+Math.max(...ns.map(n=>n.x+n.w)))/2,y=(Math.min(...ns.map(n=>n.y))+Math.max(...ns.map(n=>n.y+n.h)))/2;assert.ok(Math.abs(r.scene.focus.world[0]-x)<.01);assert.ok(Math.abs(r.scene.focus.world[1]-y)<.01);const d=r.scene.drawingArea;assert.ok(Math.abs(r.scene.focus.page[0]-(d.x+d.w/2))<.01);});
 }
 if(['circular','sketch_night'].includes(v.id))t(v.id+' keeps free centres on their ring',()=>{const pp=r.scene.layout.pattern,ds=r.scene.nodes.filter(n=>!pp.pinIds?.includes(n.id)&&!['ddn.live.pinned-patterns::network.hub','ddn.live.pinned-patterns::network.store'].includes(n.id)).map(n=>Math.hypot(n.x+n.w/2-pp.anchor[0],n.y+n.h/2-pp.anchor[1]));assert.ok(Math.max(...ds)-Math.min(...ds)<.1);});
}
t('Classic and sketch circle represent exactly the same semantic model',()=>assert.equal(renders.circular.modelFingerprint,renders.sketch_night.modelFingerprint));
t('Pause retains a successful free arrangement across look changes',()=>{const a=renders.circular,b=w.renderSync({entry,view:'circular',layoutState:a.layoutState,overrides:{autoPlace:false,look:'neo'}});assert.deepEqual(a.scene.nodes.map(n=>[n.id,n.x,n.y]),b.scene.nodes.map(n=>[n.id,n.x,n.y]));});
t('Reflow reuses pin coordinates, not frozen free coordinates',()=>{const a=renders.fit_grid,b=w.renderSync({entry,view:'fit_grid',layoutState:a.layoutState,overrides:{autoPlace:true,placement:'radial'}});assert.equal(b.scene.nodes.find(n=>n.id.endsWith('.hub')).x,580);assert.notDeepEqual(a.scene.nodes.map(n=>[n.x,n.y]),b.scene.nodes.map(n=>[n.x,n.y]));});
t('Retained-state coordinates must be finite',()=>{const a=JSON.parse(JSON.stringify(renders.circular.layoutState));a.positions[Object.keys(a.positions)[0]]=[NaN,1];assert.throws(()=>w.renderSync({entry,view:'circular',layoutState:a}),e=>e.code==='DDN-P002');});
t('No-pin graph has no fabricated focus',()=>assert.ok(!renders.no_pins.scene.focus));
t('Wrong declared-tree graph is not silently treated as spanning forest',()=>{assert.throws(()=>w.renderSync({entry,view:'circular',overrides:{placement:'tree'}}));});
const reg=require('../../standard/registry/catalogue.json');let contrast=[];for(const name of ['dark','night'])for(const r of reg.relationships){const theme=P.themes[name],c=P.semantic(r.colour,theme);contrast.push({theme:name,id:r.id,colour:c,canvas:P.contrast(c,theme.background),surface:P.contrast(c,theme.surface)});}
t('All registered relation colours contrast on both low-light surfaces',()=>{assert.equal(contrast.length,reg.relationships.length*2);assert.ok(contrast.every(c=>c.canvas>=4.5&&c.surface>=4.5));});
fs.mkdirSync(root+'/tests/validation',{recursive:true});fs.writeFileSync(root+'/tests/validation/palette-contrast.json',JSON.stringify(contrast,null,2));
const report={passed:out.filter(x=>x.pass).length,total:out.length,failed:out.filter(r=>!r.pass).length,results:out};fs.writeFileSync(root+'/tests/validation/pattern-tests.json',JSON.stringify(report,null,2));console.log('Patterns',report.passed+'/'+report.total);process.exitCode=report.passed===report.total?0:1;
