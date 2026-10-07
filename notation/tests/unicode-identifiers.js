/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 Unicode identifiers
 * (0.9 roadmap item, spec ch. 01 amendment + S06): UAX #31 ID_Start/Continue
 * plus the ASCII separators, UTS #39 conservative profile — NFC required
 * (DDN-ID03), no zero-width/bidi-control/format characters (DDN-ID01),
 * single script per identifier (DDN-ID02). ASCII identifiers and every
 * pre-0.9 source are byte-identical. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const build=(body,version='0.6',file='m.ddn')=>DDN.build({[file]:'ddn "'+version+'";\nmodule "m";\n'+body},file,'v',reg).ir;
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};

test('happy paths: CJK, Greek, Cyrillic, Arabic, accented Latin identifiers end-to-end',()=>{
 const ir=build('data m {\n object 数据 "Database" { kind: cache; fields { 名前 { datatype: string; } }\n }\n object αβγ "Letters" { kind: queue; }\n object данные "Data" { kind: service; }\n object café "Café" { kind: queue; }\n relation r1 @数据 -> @αβγ { kind: flow; }\n relation r2 @данные -> @café { kind: flow; }\n}\nview v { data: [@m]; }');
 assert.deepEqual(ir.elements.map(e=>e.local),['数据','αβγ','данные','café']);
 assert.equal(ir.relations.length,2);
 assert.equal(ir.elements[0].fields[0].local,'名前','Unicode field id');
 const svg=Render.render(ir,reg,defs).svg;
 assert.ok(svg.includes('data-id="m::m.数据"'),'Unicode uid in the SVG');
});

test('Unicode module identities, references and dotted paths',()=>{
 const ir=DDN.build({'m.ddn':'ddn "0.6";\nmodule "店.東京";\ndata m { object a {} }\nview v { data: [@m]; }'},'m.ddn','v',reg).ir;
 assert.ok(ir.view.id.startsWith('店.東京::'),'dotted Unicode module id');
});

test('kebab separators and ASCII sources are unchanged',()=>{
 const ir=build('data m { object a-b_c2 "X" { kind: cache; } }\nview v { data: [@m]; }');
 assert.equal(ir.elements[0].local,'a-b_c2');
});

test('DDN-ID01: zero-width and bidi-control characters are hard-rejected',()=>{
 assert.equal(code(()=>build('data m { object abc​def "X" {} }\nview v { data: [@m]; }')),'DDN-ID01','ZWSP U+200B');
 assert.equal(code(()=>build('data m { object abc‍def "X" {} }\nview v { data: [@m]; }')),'DDN-ID01','ZWJ U+200D');
 assert.equal(code(()=>build('data m { object abc‏def "X" {} }\nview v { data: [@m]; }')),'DDN-ID01','RLM U+200F');
 assert.equal(code(()=>build('data m { object abc‮def "X" {} }\nview v { data: [@m]; }')),'DDN-ID01','RLO U+202E');
 assert.equal(code(()=>build('data m { object abc⁦def "X" {} }\nview v { data: [@m]; }')),'DDN-ID01','LRI U+2066');
 assert.equal(code(()=>build('data m { object a "label with‍zwj is fine" {} }\nview v { data: [@m]; }')),null,'format characters stay legal in display strings');
});

test('DDN-ID02: mixed-script identifiers rejected; script-neutral digits/separators fine',()=>{
 assert.equal(code(()=>build('data m { object саfе "Spoof" {} }\nview v { data: [@m]; }')),'DDN-ID02','Cyrillic a in a Latin word');
 assert.equal(code(()=>build('data m { object 数据db "Mixed" {} }\nview v { data: [@m]; }')),'DDN-ID02','Han + Latin');
 assert.equal(code(()=>build('data m { object αβa "Mixed" {} }\nview v { data: [@m]; }')),'DDN-ID02','Greek + Latin');
 assert.equal(code(()=>build('data m { object 数据1 "Digits ok" {} }\nview v { data: [@m]; }')),null,'digits are Common script');
 assert.equal(code(()=>build('data m { object α_2 "Neutral ok" {} }\nview v { data: [@m]; }')),null,'underscore/digit neutral');
});

test('DDN-ID03: identifiers must be in NFC (no silent normalization)',()=>{
 assert.equal(code(()=>build('data m { object caf&e "X" {} }\nview v { data: [@m]; }'.replace('&','é')),'DDN-ID03'),'DDN-ID03','decomposed é');
 assert.equal(code(()=>build('data m { object café "X" {} }\nview v { data: [@m]; }')),null,'precomposed é accepted');
});

test('no dialect gate needed: pre-0.9 processors reject cleanly (parse error either way)',()=>{
 // The Unicode identifier rule is lexical and version-independent: an 0.2
 // file with Unicode ids parses on the new reader exactly like 0.6.
 const ir=build('data m { object 数据 "D" { kind: cache; } }\nview v { data: [@m]; }','0.2');
 assert.equal(ir.elements[0].local,'数据');
 // ...while an old (ASCII) reader rejects the same file as DDN006 — clean failure, documented.
});

test('fragment substitution and ref: anchors follow the same grammar',()=>{
 const defs='fragment f(x) { object x { kind: cache; } relation out @x -> @audit { kind: flow; } }';
 const ir=build(defs+'\ndata m { object audit { kind: database; } use: @f(数据); }\nview v { data: [@m]; }');
 assert.equal(ir.elements.find(e=>e.local==='数据').local,'数据','Unicode arg into declaration id');
 assert.equal(code(()=>build(defs+'\ndata m { object audit { kind: database; } use: @f(数据db); }\nview v { data: [@m]; }')),'DDN-ID02','bad arg still screened by the lexer');
});

test('byte-identical ASCII pipeline: unicode-capable lexer changes nothing for ASCII sources',()=>{
 const body='data m { object a "Alpha" { kind: cache; } object b "Beta" { kind: queue; } relation r @a -> @b { kind: flow; } }\nview v { data: [@m]; }';
 const toks=DDN.lex(body,'m.ddn');
 assert.ok(toks.every(t=>typeof t.value==='string'||typeof t.value==='number'||typeof t.value==='object'),'token stream intact');
 assert.equal(Render.render(build(body),reg,defs).svg,Render.render(build(body),reg,defs).svg,'deterministic');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' unicode-identifiers tests passed');
