/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 text fit (chapter 54):
 * wrap/grow/shrink modes and bounds (T1), residual-overflow diagnostics
 * DDN-TF01–TF05 / DDN-LW07–LW08 (T2), the two-pass measure → resize →
 * re-layout cap (T3), font/metric pinning (T4) and the content-size render
 * override (T5). */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default,Text=require('../runtime/ddn-text.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const src=(body,version='0.6',extra={})=>({'m.ddn':'ddn "'+version+'";\nmodule "m";\n'+body,...extra});
const build=(body,view='v',version='0.6',extra)=>DDN.build(src(body,version,extra),'m.ddn',view,reg).ir;
const render=(body,options,version,extra)=>Render.render(build(body,'v',version,extra),reg,defs,options);
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const node=(res,local)=>res.scene.nodes.find(n=>n.id.endsWith('.'+local)||n.id.endsWith('::'+local));

test('wrap: width fixed at max_width, box grows downward',()=>{
 const res=render('data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; text_fit: wrap; max_width: 200px; } }\nview v { data: [@m]; }');
 const g=node(res,'s');
 assert.equal(g.w,200,'width fixed at max_width');
 assert.ok(g.h>138,'box grew downward past the unwrapped height');
 assert.deepEqual(res.scene.layout.textFit.resized,['m::m.s']);
 assert.ok(!res.diagnostics.some(d=>d.code.startsWith('DDN-LW')),'no overflow when only width is bounded');
});

test('wrap inferred from a width constraint with no declared mode',()=>{
 const res=render('data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; max_width: 200px; } }\nview v { data: [@m]; }');
 assert.equal(node(res,'s').w,200);
 assert.ok(res.scene.layout.textFit,'textFit scene present for inferred wrap');
});

test('grow: box expands with content, bounded by max_width then wraps, capped at max_height',()=>{
 const small=render('data m { object b "OK" { kind: note; text_fit: grow; max_width: 400px; max_height: 400px; } }\nview v { data: [@m]; }');
 assert.equal(small.scene.layout.textFit.passes,1,'short content needs one measure pass only');
 assert.deepEqual(small.scene.layout.textFit.resized,[],'short content is not resized');
 const res=render('data m { object b "A rather long legend label that keeps on going and going" { kind: note; text_fit: grow; max_width: 240px; max_height: 400px; } }\nview v { data: [@m]; }');
 const g=node(res,'b');
 assert.ok(g.w<=240,'growth stops at max_width');
 assert.ok(g.h>117,'wrapped content grew the box downward');
});

test('shrink: font steps down to the first fitting size, never below min_font',()=>{
 const res=render('data m { object t "A rather long legend label" { kind: term; text_fit: shrink; min_font: 9px; max_width: 200px; } }\nview v { data: [@m]; }');
 const g=node(res,'t');
 assert.ok(g.scale<1,'font stepped down');
 assert.ok(g.scale>=9/16-.001,'never below the declared floor');
 assert.ok(g.w<=200,'fits after shrinking');
 // a box that fits at base size is untouched
 const plain=render('data m { object t "OK" { kind: term; text_fit: shrink; min_font: 9px; max_width: 400px; } }\nview v { data: [@m]; }');
 assert.equal(node(plain,'t').scale,1);
 assert.deepEqual(plain.scene.layout.textFit.resized,[],'no resize when the base size fits');
});

test('profile default applies only to elements that declare no mode (precedence)',()=>{
 const body='format f { style s { text_fit: wrap; max_width: 200px; } }\ndata m { object a "A rather long quarterly summary label that must wrap around" { kind: note; } object b "A rather long quarterly summary label that must wrap around" { kind: note; text_fit: grow; max_width: 300px; } }\nview v { data: [@m]; style: @f.s; }';
 const res=render(body);
 assert.equal(node(res,'a').w,200,'profile default wraps the undeclared element');
 assert.equal(node(res,'b').w,270,'element declaration wins over the profile default');
});

test('DDN-TF01/02/03: mode and bounds checked at build time',()=>{
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text_fit: squish; } }\nview v { data: [@m]; }')),'DDN-TF01');
 try{build('data m { object a "A" { kind: cache; text_fit: squish; } }\nview v { data: [@m]; }');assert.fail('no throw');}
 catch(e){assert.match(e.message,/wrap, grow or shrink/);}
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text_fit: wrap; max_width: 20px; } }\nview v { data: [@m]; }')),'DDN-TF02');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text_fit: wrap; max_height: 4001px; } }\nview v { data: [@m]; }')),'DDN-TF02');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text_fit: shrink; min_font: 5px; } }\nview v { data: [@m]; }')),'DDN-TF03');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text_fit: shrink; min_font: 60px; } }\nview v { data: [@m]; }')),'DDN-TF03','min_font above the effective base font');
 // style-profile defaults are checked too
 assert.equal(code(()=>build('format f { style s { text_fit: squish; } }\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; style: @f.s; }')),'DDN-TF01');
});

test('DDN-V04: text-fit and font_pin constructs are gated on ddn "0.6"',()=>{
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text_fit: wrap; } }\nview v { data: [@m]; }','v','0.5')),'DDN-V04');
 assert.equal(code(()=>build('format f { style s { font_pin: "m.json"; } }\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; style: @f.s; }','v','0.5')),'DDN-V04');
});

test('two-pass cap: passes never exceed 2; convergent resize stops at pass 2',()=>{
 const res=render('data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; text_fit: wrap; max_width: 200px; max_height: 150px; } }\nview v { data: [@m]; layout { quality: warn; } }');
 assert.ok(res.scene.layout.textFit.passes<=2,'hard cap of two passes');
 assert.equal(res.scene.layout.textFit.passes,2,'the clamped resize re-measures once more');
 const g=node(res,'s');
 assert.equal(g.w,200);assert.equal(g.h,150,'box at its bounded size');
});

test('DDN-LW07: residual wrap/grow overflow warns with the remedy; quality:error fails the render',()=>{
 const body='data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; text_fit: wrap; max_width: 200px; max_height: 120px; } }\nview v { data: [@m]; LAYOUT }\n';
 const res=render(body.replace('LAYOUT','layout { quality: warn; }'));
 const lw=res.diagnostics.find(d=>d.code==='DDN-LW07');
 assert.ok(lw,'residual overflow diagnosed');
 assert.equal(lw.severity,'warning');
 assert.match(lw.message,/overflows by \d+(\.\d+)?px vertically/);
 assert.match(lw.message,/max_height` \(currently 120px\)/);
 assert.match(lw.message,/element `s`/);
 // clipped at the box edge with a visible ellipsis marker, never invisible text
 assert.ok(res.svg.includes('data-textfit-overflow'),'node marked');
 assert.ok(res.svg.includes('ddn-textfit-clip'),'text clipped at the box edge');
 assert.ok(res.svg.includes('ddn-textfit-ellipsis'),'visible ellipsis marker');
 const err=code(()=>render(body.replace('LAYOUT','')));
 assert.equal(err,'DDN-LW07','quality:error fails the render like other quality failures');
});

test('DDN-LW08: shrink at min_font with residual overflow names the floor',()=>{
 const res=render('data m { object t "A rather long legend label" { kind: term; text_fit: shrink; min_font: 9px; max_width: 120px; } }\nview v { data: [@m]; layout { quality: warn; } }');
 const lw=res.diagnostics.find(d=>d.code==='DDN-LW08');
 assert.ok(lw);assert.equal(lw.severity,'warning');
 assert.match(lw.message,/min_font 9px/);
 assert.match(lw.message,/absolute floor 8px/);
 assert.equal(code(()=>render('data m { object t "A rather long legend label" { kind: term; text_fit: shrink; min_font: 9px; max_width: 120px; } }\nview v { data: [@m]; }')),'DDN-LW08');
 // min_font equal to the base font: no step exists, so any misfit is residual at once
 const edge=render('data m { object t "A rather long legend label" { kind: term; text_fit: shrink; min_font: 16px; max_width: 120px; } }\nview v { data: [@m]; layout { quality: warn; } }');
 assert.ok(edge.diagnostics.some(d=>d.code==='DDN-LW08'));
 assert.equal(node(edge,'t').scale,1,'never steps above or below the floor window');
});

test('font pin: resolution rules, IR carriage and pinned measurement path',()=>{
 const pin=JSON.stringify({engine:'ddn-text@1',version:'1',measurements:{}});
 const pinned=(extra)=>build('format f { style s { font: sans; font_pin: "pin.json"; } }\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; style: @f.s; }','v','0.6',{'pin.json':extra});
 assert.equal(pinned(pin).view.fontPin.path,'pin.json');
 assert.equal(code(()=>pinned('{not json')),'DDN-PB05');
 assert.equal(code(()=>pinned(JSON.stringify({measurements:{}}))),'DDN-PB05','engine required');
 assert.equal(code(()=>build('format f { style s { font_pin: "absent.json"; } }\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; style: @f.s; }')),'DDN-PB05','missing pin file');
 assert.equal(code(()=>build('format f { style s { font_pin: "/etc/passwd"; } }\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; style: @f.s; }')),'DDN-PB05','absolute paths rejected');
 const res=Render.render(pinned(pin),reg,defs);
 assert.equal(res.scene.textMeasurement.pin,'pin.json','pinned measurement recorded');
 assert.ok(!res.diagnostics.some(d=>d.code==='DDN-TF05'));
});

test('DDN-TF05: pin/engine mismatch warns and the pin is ignored',()=>{
 const ir=build('format f { style s { font_pin: "pin.json"; } }\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; style: @f.s; }','v','0.6',{'pin.json':JSON.stringify({engine:'other-engine@9',measurements:{}})});
 const res=Render.render(ir,reg,defs);
 const tf=res.diagnostics.find(d=>d.code==='DDN-TF05');
 assert.ok(tf);assert.equal(tf.severity,'warning');
 assert.match(tf.message,/ignored/);
 assert.equal(res.scene.textMeasurement.pin,undefined,'pin ignored for this render');
});

test('DDN-TF04: a run missing from the pin under metrics: required is an error',()=>{
 const ir=build('format f { style s { font_pin: "pin.json"; } }\ndata m { object a "A unique label 12345" { kind: cache; } }\nview v { data: [@m]; style: @f.s; publication { metrics: required; } }','v','0.6',{'pin.json':JSON.stringify({engine:'ddn-text@1',measurements:{}})});
 assert.equal(code(()=>Render.render(ir,reg,defs)),'DDN-TF04');
});

test('content-size render override forces size: content for one render (T5)',()=>{
 const ir=build('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }');
 const res=Render.render(ir,reg,defs,{contentSize:true});
 assert.ok(res.scene.width>=640&&res.scene.height>=360);
 // the source IR is untouched: the override rides the render channel only
 assert.notEqual(ir.view.profiles.publication.size,'content');
 const plain=Render.render(ir,reg,defs);
 assert.ok(res.svg!==plain.svg||res.scene.width!==plain.scene.width,'override changes only this render');
 // size: content artboards grow with the final post-fit bounds
 const fit=render('data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; text_fit: wrap; max_width: 200px; } }\nview v { data: [@m]; publication { size: content; } }');
 const fitNode=node(fit,'s');
 assert.ok(fitNode.h>138,'post-fit growth happened');
 assert.ok(fit.scene.height>=fitNode.h,'artboard covers the post-fit bounds');
 assert.ok(!fit.diagnostics.some(d=>d.code==='DDN-LW07'));
});

test('legacy diagrams are byte-identical: no text-fit declarations, no pipeline change',()=>{
 const body='data m { object a "Alpha" { kind: cache; } object b "Beta" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }';
 const a=Render.render(build(body,'v','0.6'),reg,defs).svg;
 const b=Render.render(build(body,'v','0.5'),reg,defs).svg;
 assert.equal(a,b,'render drift');
 assert.equal(Render.render(build(body),reg,defs).scene.layout.textFit,undefined);
});

const passed=results.filter(r=>r.pass).length;
console.log(`text-fit ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
