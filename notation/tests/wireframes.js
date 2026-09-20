/* SPDX-License-Identifier: GPL-2.0-or-later. Wireframe profile wireframe.ui@1: seven-control stencil, scoped-frame nesting, orphan-control warning DDN-PJ128 (warning, not thrown), determinism. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='55-wireframe.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='settings',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
const pj128=r=>r.diagnostics.filter(d=>d.code==='DDN-PJ128');
test('Settings example renders all seven stencil controls inside the scoped frame with neutral greys',()=>{
 const r=run();
 for(const s of ['Settings','Profile','Display name','Email notifications','Timezone','Avatar','Save'])assert.ok(r.svg.includes(s),'SVG missing '+s);
 assert.equal(r.scene.frames.length,1,'one view frame renders');
 assert.equal(r.scene.frames[0].name,'Settings','frame is scoped to the ui.frame object');
 assert.equal(r.scene.nodes.length,6,'six control nodes render inside the frame');
 const byId=Object.fromEntries(r.scene.nodes.map(n=>[n.id.split('::').pop(),n]));
 assert.equal(byId['m.save_button'].silhouette,'round','ui.button uses the round silhouette');
 for(const id of ['m.profile_label','m.display_name','m.email_notifications','m.timezone_list','m.avatar_placeholder'])assert.equal(byId[id].silhouette,'rect',id+' uses the rect silhouette');
 assert.ok(byId['m.timezone_list'].fieldRows.length===3,'ui.list shows its declared field rows');
 assert.ok(r.svg.includes('#222222')&&r.svg.includes('#BBBBBB'),'neutral-theme greys appear in output');
 const pc=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../standard/registry/profiles/catalogue.json'),'utf8'));
 for(const k of ['ui.frame','ui.label','ui.input','ui.button','ui.image','ui.checkbox','ui.list'])assert.ok(pc.kinds.find(x=>x.keyword===k),'registry missing kind '+k);});
test('Members of the ui.frame-scoped frame produce no DDN-PJ128 diagnostics',()=>{
 const r=run();
 assert.deepEqual(pj128(r),[],'covered controls must not warn');});
test('A control outside any ui.frame warns DDN-PJ128 and still renders (CLI-style and SDK diagnostics)',()=>{
 const changes=editFile('    object save_button "Save" { kind: "ui.button"; }','    object save_button "Save" { kind: "ui.button"; }\n    object stray_label "Loose note" { kind: "ui.label"; }');
 const changes2={[FILE]:changes[FILE].replace('    select: [@m.profile_label','    select: [@m.stray_label, @m.profile_label')};
 const r=run('settings',changes2);
 const w=pj128(r);
 assert.equal(w.length,1,'exactly one orphan-control warning');
 assert.equal(w[0].severity,'warning','DDN-PJ128 is a warning');
 assert.ok(w[0].message.includes('stray_label'),'warning names the control');
 assert.ok(r.svg.includes('Loose note'),'the orphan control still renders');
 assert.ok(r.svg.includes('Save'),'the rest of the view still renders');
 assert.ok(Array.isArray(r.diagnostics),'SDK renderSync surfaces diagnostics[]');});
test('DDN-PJ128 is a warning, not a thrown error (contrast with thrown DDN-PJ1xx codes)',()=>{
 const changes=editFile('    object save_button "Save" { kind: "ui.button"; }','    object save_button "Save" { kind: "ui.button"; }\n    object stray_label "Loose note" { kind: "ui.label"; }');
 const changes2={[FILE]:changes[FILE].replace('    select: [@m.profile_label','    select: [@m.stray_label, @m.profile_label')};
 assert.doesNotThrow(()=>run('settings',changes2),'orphan control must not throw');
 const bad=editFile('    publication { size: content;','    export { mode: redacted; }\n    publication { size: content;');
 assert.throws(()=>run('settings',bad),e=>e.code==='DDN-PJ003','thrown DDN-PJ1xx codes still throw under the profile');});
test('Nested frames: a ui.frame member of another ui.frame renders; inner controls produce no warnings',()=>{
 const inner='    object advanced "Advanced" { kind: "ui.frame"; }\n    object verbose_label "Verbose logging" { kind: "ui.label"; }\n';
 const changes=editFile('    object save_button "Save" { kind: "ui.button"; }','    object save_button "Save" { kind: "ui.button"; }\n'+inner);
 const changes2={[FILE]:changes[FILE]
  .replace('    select: [@m.profile_label','    select: [@m.advanced, @m.verbose_label, @m.profile_label')
  .replace('members: [@m.profile_label,','members: [@m.advanced, @m.profile_label,')
  .replace('    place @m.save_button','    frame advanced_area "Advanced" { scope: @m.advanced; members: [@m.verbose_label]; }\n    place @m.advanced { at: [300px, 240px]; }\n    place @m.verbose_label { at: [300px, 500px]; }\n    place @m.save_button')};
 const r=run('settings',changes2);
 assert.equal(r.scene.frames.length,2,'both frames render');
 assert.ok(r.svg.includes('Advanced')&&r.svg.includes('Verbose logging'),'nested frame and its control render');
 assert.deepEqual(pj128(r),[],'controls of the inner frame produce no warnings');});
test('Repeated render is byte-identical',()=>{
 assert.equal(run().svg,run().svg);});
const passed=results.filter(r=>r.pass).length;console.log(`Wireframes ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
