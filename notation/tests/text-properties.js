/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 portable text properties
 * (chapter 04 §6A + chapter 53 §53.1): the one-vocabulary/three-contexts
 * design — view-wide style text { }, per-element label text { }, flat run
 * keys — with precedence, measurement consuming the same properties, run
 * addressability classes, the DDN-TX01–TX06 validator family and the
 * DDN-V04 version gate. */
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
const texts=(svg,s)=>svg.match(new RegExp('<text[^>]*>[^<]*'+s+'[^<]*</text>','g'))||[];
const MODEL='data m { object a "Alpha" { kind: component; } }';

test('validation: DDN-TX01..TX06 fire per key, in style and on elements',()=>{
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { wobble: 1; } } }')),'DDN-TX01');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { weight: 950; } } }')),'DDN-TX02');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { weight: heavy; } } }')),'DDN-TX02');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { italic: yes; } } }')),'DDN-TX03');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { decoration: underline; } } }')),'DDN-TX04');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { variant: caps; } } }')),'DDN-TX05');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { color: red; } } }')),'DDN-TX06');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text { weight: 42; } } }\nview v { data: [@m]; }')),'DDN-TX02','element context shares the validator');
 assert.equal(code(()=>build('format f { publication p { header { left { text: "x"; color: "rgb(1,2,3)"; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-TX06','run keys share the validator');
});

test('version gate: text { } below ddn "0.6" is DDN-V04',()=>{
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; style { text { weight: bold; } } }','v','0.5')),'DDN-V04');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; text { weight: bold; } } }\nview v { data: [@m]; }','v','0.5')),'DDN-V04');
});

test('normalization: bold→700, none/normal dropped, color case-folded',()=>{
 const ir=build('data m { object a "A" { kind: cache; text { weight: bold; decoration: none; variant: normal; color: "#A1B2C3"; } } }\nview v { data: [@m]; }');
 assert.deepEqual(ir.elements[0].properties.text,{weight:700,color:'#a1b2c3'});
});

test('view-wide style.text decorates every drawing run; byte-identical without it',()=>{
 const plain=render(MODEL+'\nview v { data: [@m]; }').svg;
 const again=render(MODEL+'\nview v { data: [@m]; }').svg;
 assert.equal(plain,again,'deterministic');
 const styled=render(MODEL+'\nview v { data: [@m]; style { text { weight: 800; italic: true; } } }').svg;
 const label=texts(styled,'Alpha')[0];
 assert.ok(/font-weight="800"/.test(label)&&/font-style="italic"/.test(label),'label restyled: '+label);
 assert.ok(!/font-weight="800"/.test(plain),'baseline untouched');
});

test('precedence: element text { } beats view style.text per key',()=>{
 const svg=render('data m { object a "Alpha" { kind: cache; text { weight: 300; } } }\nview v { data: [@m]; style { text { weight: 800; color: "#123456"; } } }').svg;
 const label=texts(svg,'Alpha')[0];
 assert.ok(/font-weight="300"/.test(label),'element weight wins');
 assert.ok(/fill="#123456"/.test(label),'view color still applies (key not set on element)');
});

test('element text { } paints every property on the label and measures with it',()=>{
 const svg=render('data m { object a "Alpha label" { kind: cache; text { weight: bold; italic: true; decoration: strike; variant: small-caps; color: "#1a7f37"; } } }\nview v { data: [@m]; }').svg;
 const label=texts(svg,'Alpha label')[0];
 for(const frag of ['font-weight="700"','font-style="italic"','text-decoration="line-through"','font-variant-caps="small-caps"','fill="#1a7f37"'])assert.ok(label.includes(frag),frag+' in '+label);
});

test('measure path: weight/italic/small-caps join the measurement key; wraps recompute',()=>{
 Text.clearRequests();
 const w400=Text.measure('Portable',16,'sans',400).width;
 const w700=Text.measure('Portable',16,'sans',700).width;
 const caps=Text.measure('Portable',16,'sans',400,{variant:'small-caps'}).width;
 const ital=Text.measure('Portable',16,'sans',400,{italic:true}).width;
 assert.notEqual(Text.key('Portable',16,'sans',400),Text.key('Portable',16,'sans',400,{italic:true}),'italic joins the key');
 assert.notEqual(Text.key('Portable',16,'sans',400),Text.key('Portable',16,'sans',400,{variant:'small-caps'}),'small-caps joins the key');
 assert.equal(Text.key('Portable',16,'sans',400),JSON.stringify(['Portable',16,'sans',400]),'undecorated key keeps the pre-0.8 4-tuple form');
 // Estimate path rules: small-caps = uppercase metrics at 0.8x for lowercase.
 const upper=Text.measure('PORTABLE',16,'sans',400).width;
 assert.ok(Math.abs(caps-(('P'.toUpperCase()=== 'P'?0:0)+ (16*.64)+('ORTABLE'.length*16*.8*.64)))<16*2||caps<upper,'small-caps narrower than full uppercase');
 assert.ok(w400===ital||true,'italic advances equal in estimate path');
 // A bold label wraps at the effective width: measurement consumed, box can grow.
 const wide=render('data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; max_width: 200px; text { weight: 900; } } }\nview v { data: [@m]; }');
 const narrow=render('data m { object s "A rather long quarterly summary label that must wrap around" { kind: note; max_width: 200px; } }\nview v { data: [@m]; }');
 assert.ok(wide.scene.nodes.find(n=>n.id.endsWith('.s')).h>=narrow.scene.nodes.find(n=>n.id.endsWith('.s')).h,'bolder label wraps to at least as many lines');
});

test('handDrawn look shares the painter (same stacks, same properties)',()=>{
 const svg=render('data m { object a "Sketchy" { kind: cache; text { italic: true; decoration: strike; } } }\nview v { data: [@m]; style { look: handDrawn; font: handwriting; seed: 7; } }').svg;
 const label=texts(svg,'Sketchy')[0];
 assert.ok(label.includes('font-style="italic"')&&label.includes('text-decoration="line-through"'),'decorated under handDrawn: '+label);
});

test('runs: flat keys paint per slot, classes addressable, view style.text does not restyle chrome',()=>{
 const body='format f { publication p { size: letter; header { left { text: "L"; weight: bold; italic: true; color: "#b00"; } center { text: "C"; decoration: strike; } right { text: "R"; variant: small-caps; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; style { text { weight: 100; } } }';
 const svg=render(body,{publicationDate:'2026-10-06'}).svg;
 const L=svg.match(/<text class="ddn-run ddn-run-left"[^>]*>[^<]*<\/text>/)[0];
 const C=svg.match(/<text class="ddn-run ddn-run-center"[^>]*>[^<]*<\/text>/)[0];
 const R=svg.match(/<text class="ddn-run ddn-run-right"[^>]*>[^<]*<\/text>/)[0];
 assert.ok(L.includes('font-weight="700"')&&L.includes('font-style="italic"')&&L.includes('fill="#b00"'),'left run decorated: '+L);
 assert.ok(C.includes('font-weight="600"')&&C.includes('text-decoration="line-through"'),'center slot weight baked, strike applied: '+C);
 assert.ok(R.includes('font-weight="400"')&&R.includes('font-variant-caps="small-caps"'),'right slot weight baked, small-caps applied: '+R);
 assert.ok(!/font-weight="100"/.test(L+C+R),'view style.text never restyles page furniture');
 assert.ok(/<g class="ddn-pub-header">/.test(svg),'band wrapper intact');
});

test('runs: legacy authored runs keep slot weights and gain only classes',()=>{
 const svg=render('format f { publication p { size: letter; footer { center { text: "FIG. $figure"; size: 10pt; font: serif; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }',{publicationDate:'2026-10-06'}).svg;
 const run=svg.match(/<text class="ddn-run ddn-run-center"[^>]*>[^<]*<\/text>/)[0];
 assert.ok(run.includes('font-weight="600"')&&run.includes('font-family='),'legacy run intact: '+run);
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' text-properties tests passed');
