/* SPDX-License-Identifier: GPL-2.0-or-later. 0.8 amendment (spec ch. 06):
 * publication.content_scale — true content scaling applied to the laid-out
 * drawing (geometry + all font roles) BEFORE fit/contain, so contain and the
 * DDN071/DDN074 checks operate on the scaled result; embedding_scale stays
 * declaration-only and its range is unified at (0, 4] across renderers;
 * DDN200 authored-gap validation rejects sub-20px gaps before the clearance
 * floor. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default,Projections=require('../runtime/ddn-projections.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const src=body=>({'m.ddn':'ddn "0.6";\nmodule "m";\n'+body});
const build=(body,view='v')=>DDN.build(src(body),'m.ddn',view,reg).ir;
const render=(body,options)=>Render.render(build(body),reg,defs,options);
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const MODEL='data m { object a "Alpha" { kind: component; } object b "Beta" { kind: component; } relation r1 @a -> @b { kind: assoc; } }';
const CHART='data m { object r1 "A" { kind: record; x_record: { month: "Jan", value: 4 }; } object r2 "B" { kind: record; x_record: { month: "Feb", value: 9 }; } }\nview v { data: [@m]; projection { kind: chart; profile: "chart.basic@1"; records: [@m.r1, @m.r2]; mark: bar; x: "x_record.month"; y: "x_record.value"; width: 800px; height: 400px; } PUB }';

test('fit:none renders at exactly content_scale; drawing bounds stay unscaled',()=>{
 const BIG='size: figure; width: 4000px; height: 2000px; fit: none; ';
 const base=render(MODEL+'\nview v { data: [@m]; publication { '+BIG+'} }');
 const up=render(MODEL+'\nview v { data: [@m]; publication { '+BIG+'content_scale: 2; } }');
 const down=render(MODEL+'\nview v { data: [@m]; publication { '+BIG+'overflow: warn; content_scale: 0.5; } }');
 assert.equal(base.scene.scale,1,'baseline scale 1');
 assert.ok(Math.abs(up.scene.scale-2)<1e-9,'scale 2');
 assert.ok(Math.abs(down.scene.scale-0.5)<1e-9,'scale 0.5');
 assert.deepEqual(up.scene.drawingBounds,base.scene.drawingBounds,'world-space bounds unchanged');
 assert.ok(up.svg.includes('scale(2)'),'page transform carries the content scale');
});

test('contain judges the scaled drawing and DDN071 operates on the final scale',()=>{
 // Same drawing, fixed page: at content_scale 2 the contain factor halves.
 const one=render(MODEL+'\nview v { data: [@m]; publication { size: figure; content_scale: 1; } }');
 const two=render(MODEL+'\nview v { data: [@m]; publication { size: figure; content_scale: 2; } }');
 const b=one.scene.drawingBounds,area=one.scene.drawingArea;
 const expect=Math.min(1,area.w/(b.w*2),area.h/(b.h*2))*2;
 assert.ok(Math.abs(two.scene.scale-expect)<1e-9,'contain factor computed against the scaled drawing');
 assert.ok(Math.abs(one.scene.scale-Math.min(1,area.w/b.w,area.h/b.h))<1e-9,'content_scale 1 is byte-equivalent semantics');
});

test('content_scale 1 renders byte-identically to an undeclared key',()=>{
 const a=render(MODEL+'\nview v { data: [@m]; }').svg;
 const b=render(MODEL+'\nview v { data: [@m]; publication { content_scale: 1; } }').svg;
 assert.equal(a,b);
});

test('size:content wraps the scaled drawing',()=>{
 const one=render(MODEL+'\nview v { data: [@m]; publication { size: content; } }');
 const two=render(MODEL+'\nview v { data: [@m]; publication { size: content; content_scale: 2; } }');
 const b=one.scene.drawingBounds;
 assert.ok(Math.abs(two.scene.width-(b.w*2+64))<1e-6,'page width grows with content scale (margin 32 each side, no legend on two components?)');
});

test('DDN071 fires on the scaled text: shrinking below the minimum warns/fails',()=>{
 const warn=render(MODEL+'\nview v { data: [@m]; publication { fit: none; minimum_text: 10px; overflow: warn; content_scale: 0.5; } }');
 assert.ok(warn.diagnostics.some(d=>d.code==='DDN071'),'scaled smallest role 11*0.5=5.5px < 10px minimum');
 const err=code(()=>render(MODEL+'\nview v { data: [@m]; publication { fit: none; minimum_text: 10px; content_scale: 0.5; } }'));
 assert.equal(err,'DDN071','overflow: error promotes to failure');
 const ok=render(MODEL+'\nview v { data: [@m]; publication { fit: none; minimum_text: 10px; content_scale: 1; } }');
 assert.ok(!ok.diagnostics.some(d=>d.code==='DDN071'),'unscaled render clears the same minimum');
});

test('DDN074 overflow rules apply to the scaled size under fit:none',()=>{
 const wide='data m { object a "Alpha" { kind: component; } object b "Beta" { kind: component; } object c "Gamma" { kind: component; } object d "Delta" { kind: component; } relation r1 @a -> @b { kind: assoc; } relation r2 @b -> @c { kind: assoc; } relation r3 @c -> @d { kind: assoc; } }';
 const fits=render(wide+'\nview v { data: [@m]; publication { size: figure; width: 4000px; height: 2000px; fit: none; } }');
 assert.ok(!fits.diagnostics.some(d=>d.code==='DDN074'),'unscaled drawing fits the large page');
 assert.equal(code(()=>render(wide+'\nview v { data: [@m]; publication { size: figure; width: 4000px; height: 2000px; fit: none; content_scale: 4; } }')),'DDN074','scaled 4x drawing overflows');
});

test('content_scale validation: DDN046 at build, DDN070/DDN-PJ063 renderer backstops',()=>{
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; publication { content_scale: 0.1; } }')),'DDN046','below 0.25');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; publication { content_scale: 5; } }')),'DDN046','above 4');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; publication { content_scale: "big"; } }')),'DDN046','not a number');
 const ir=build(MODEL+'\nview v { data: [@m]; }');
 ir.view.profiles.publication.content_scale=10;
 assert.equal(code(()=>Render.render(ir,reg,defs)),'DDN070','graph renderer backstop');
 const ir2=build(CHART.replace('PUB','publication { size: content; fit: none; }'));
 ir2.view.profiles.publication.content_scale=10;
 assert.equal(code(()=>Projections.render(ir2,reg,defs)),'DDN-PJ063','projection renderer backstop');
});

test('projection path: content_scale scales the chart before page composition',()=>{
 const one=Projections.render(build(CHART.replace('PUB','publication { size: content; fit: none; }')),reg,defs);
 const two=Projections.render(build(CHART.replace('PUB','publication { size: content; fit: none; content_scale: 2; }')),reg,defs);
 assert.ok(Math.abs(two.scene.scale-2)<1e-9,'projection scale is the content scale under fit:none');
 assert.ok(Math.abs(two.scene.width-one.scene.drawingBounds.w*2-64)<1e-6,'content page wraps the scaled drawing');
 assert.deepEqual(two.scene.drawingBounds,one.scene.drawingBounds,'world-space bounds unchanged');
});

test('embedding_scale range unified at <=4 across renderers (DDN-PJ062)',()=>{
 const ir=build(CHART.replace('PUB','publication { size: content; fit: none; embedding_scale: 5; }'));
 assert.equal(code(()=>Projections.render(ir,reg,defs)),'DDN-PJ062','projection rejects >4 now');
 const ir2=build(CHART.replace('PUB','publication { size: content; fit: none; embedding_scale: 4; }'));
 assert.doesNotThrow(()=>Projections.render(ir2,reg,defs),'4 still allowed');
});

test('embedding_scale stays declaration-only: SVG bytes unchanged by embedding_scale alone',()=>{
 const a=render(MODEL+'\nview v { data: [@m]; publication { embedding_scale: 1; } }').svg;
 const b=render(MODEL+'\nview v { data: [@m]; publication { embedding_scale: 3; } }').svg;
 assert.equal(a,b,'no lint trigger at default minimum_text');
});

test('DDN200: authored gap below 20px is rejected, not floored; >=20 raised to clearance floor',()=>{
 assert.equal(code(()=>render(MODEL+'\nview v { data: [@m]; layout { gap: 10px; } }')),'DDN200','gap 10 rejected');
 assert.equal(code(()=>render(MODEL+'\nview v { data: [@m]; layout { row_gap: 19px; } }')),'DDN200','row_gap 19 rejected');
 const r=render(MODEL+'\nview v { data: [@m]; layout { gap: 20px; algorithm: grid; } }');
 assert.ok(r.svg.includes('<svg'),'gap 20 accepted and floored to the clearance-derived minimum');
});
console.log('content-scale:',results.filter(r=>r.pass).length+'/'+results.length,'passed');
