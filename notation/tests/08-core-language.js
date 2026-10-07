/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 core language: header
 * acceptance and gating (ch. 51), view kinds/strictness/themes/numerals
 * (ch. 52), markings, assertions, provenance and ref: anchors (ch. 55). */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default,VP=require('../runtime/ddn-view-profiles.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const src=(body,version='0.6')=>({'m.ddn':'ddn "'+version+'";\nmodule "m";\n'+body});
const build=(body,view='v',version='0.6')=>DDN.build(src(body,version),'m.ddn',view,reg).ir;
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};

test('0.6 header accepted; unsupported versions stay DDN012',()=>{
 assert.ok(DDN.SOURCE_VERSIONS.includes('0.6'));
 assert.equal(DDN.parse('ddn "0.6"; module "a";').version,'0.6');
 for(const v of ['0.7','0.8','1.0','0.1'])assert.equal(code(()=>DDN.parse('ddn "'+v+'"; module "a";')),'DDN012',v);
});

test('0.6 file using no 0.8 constructs renders byte-identical to its 0.5 twin',()=>{
 const body='data m {\n object a "A" { kind: cache; }\n object b "B" { kind: queue; }\n relation r1 @a -> @b { kind: flow; }\n}\nview v "V" {\n data: [@m];\n}\n';
 const a=build(body),b=build(body,'v','0.5');
 assert.equal(a.format,'ddn-resolved@0.6');assert.equal(b.format,'ddn-resolved@0.5');
 assert.deepEqual(DDN.semanticJSON(a).elements,DDN.semanticJSON(b).elements);
 assert.deepEqual(DDN.semanticJSON(a).relations,DDN.semanticJSON(b).relations);
 assert.equal(Render.render(a,reg,defs).svg,Render.render(b,reg,defs).svg,'render drift');
});

test('DDN-V04: 0.8 constructs rejected in files declaring <=0.5, naming the minimum version',()=>{
 const gate=(body,version='0.5')=>{const c=code(()=>build(body,'v',version));assert.equal(c,'DDN-V04');};
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; kind: flowchart; }');
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; strictness: strict; }');
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; theme: mono_print; }');
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; source: "doc §1"; }');
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; generator: "tool 1.0"; }');
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; assertions: ["x"]; }');
 gate('data m { object a "A" { kind: cache; marks: [forbidden]; } }\nview v { data: [@m]; }');
 gate('data m { object a "A" { kind: cache; numeral: 102; } }\nview v { data: [@m]; }');
 gate('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; assertion: "x"; } }\nview v { data: [@m]; }');
 gate('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; kind: flowchart; }','0.4');
 gate('data m { object a "A" { kind: cache; } }\nformat f { bundle b { kind: flowchart; } }\nview v { data: [@m]; format: @f.b; }');
 // diff views (0.8 amendment, ch. 55 §55.6): validated in 0.6, gated below it
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; diff: [@v]; }')),'DDN-DF01');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; diff: [@v]; }','v','0.5')),'DDN-V04');
 try{build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; kind: flowchart; }','v','0.5');assert.fail('no throw');}
 catch(e){assert.match(e.message,/0\.6/);assert.match(e.message,/kind/);}
});

test('DDN-VP01/02/08: unknown kind, strictness without kind, unknown theme',()=>{
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; kind: nosuch; }')),'DDN-VP01');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; strictness: strict; }')),'DDN-VP02');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; kind: ddn-native; strictness: lax; }')),'DDN046');
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; theme: neon; }')),'DDN-VP08');
 const ir=build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; kind: ddn-native; theme: colorblind_safe; }');
 assert.equal(ir.view.kind,'ddn-native');assert.equal(ir.view.strictness,'permissive');assert.equal(ir.view.theme,'colorblind_safe');
});

test('kind-derived default profile applies only when no explicit projection is declared',()=>{
 const ir=build('data m { object p "P" { kind: "c4.person"; } object s "S" { kind: "c4.system"; } relation r @p -> @s { kind: "c4.rel"; } }\nview v { data: [@m]; kind: c4-context; }');
 assert.equal(ir.view.profiles.projection.profile,'c4.context@1');
 const ir2=build('data m { object p "P" { kind: "c4.person"; } object s "S" { kind: "c4.system"; } relation r @p -> @s { kind: "c4.rel"; } }\nview v { data: [@m]; kind: c4-context; projection { kind: graph; profile: "ddn@1"; } }');
 assert.equal(ir2.view.profiles.projection.profile,'ddn@1','explicit author declaration wins over kind default');
});

test('DDN-VP09: chart kind conflicts with an explicit incompatible projection kind',()=>{
 assert.equal(code(()=>build('data m { object r "R" { kind: record; } }\nview v { data: [@m]; kind: chart-bar; projection { kind: graph; profile: "ddn@1"; } }')),'DDN-VP09');
});

test('DDN-VP03 permissive (info) and DDN-VP04 strict (error) vocabulary membership',()=>{
 const body=kind=>'data m { object c "C" { kind: "uml.class"; } object i "I" { kind: "uml.interface"; } object db "D" { kind: database; } relation r @c -> @i { kind: "uml.realization"; } }\nview v { data: [@m]; kind: '+kind+'; }';
 const ir=build(body('uml-class'));
 const vp03=ir.diagnostics.filter(d=>d.code==='DDN-VP03');
 assert.equal(vp03.length,1,'one info per offending element');assert.equal(vp03[0].severity,'info');assert.match(vp03[0].message,/database/);
 assert.equal(code(()=>build(body('uml-class; strictness: strict'))),'DDN-VP04');
 // in-subset vocabulary lints nothing
 const ok=build('data m { object c "C" { kind: "uml.class"; } object i "I" { kind: "uml.interface"; } relation r @c -> @i { kind: "uml.realization"; } }\nview v { data: [@m]; kind: uml-class; strictness: strict; }');
 assert.ok(!ok.diagnostics.some(d=>d.code.startsWith('DDN-VP0')));
});

test('DDN-VP05/06: numeral shape and per-view uniqueness; valid numerals carried in IR',()=>{
 const pre='data m { object a "A" { kind: "uml.class"; numeral: 102; } object b "B" { kind: "uml.class"; } }\nview v { data: [@m]; kind: uml-class; }\n';
 assert.equal(code(()=>build(pre.replace('numeral: 102;','numeral: 0;'))),'DDN-VP05');
 assert.equal(code(()=>build(pre.replace('numeral: 102;','numeral: 100000;'))),'DDN-VP05');
 assert.equal(code(()=>build(pre.replace('numeral: 102;','numeral: 1.5;'))),'DDN-VP05');
 assert.equal(code(()=>build(pre.replace('kind: "uml.class"; }','kind: "uml.class"; numeral: 102; }'))),'DDN-VP06');
 const ir=build(pre);
 assert.equal(ir.elements.find(e=>e.local==='a').properties.numeral,102);
});

test('patent-figure: DDN-VP07 warns on unlabelled decision branches only',()=>{
 const flow='data m {\n object s "S" { kind: "flow.start"; } object d "D?" { kind: "flow.decision"; numeral: 110; } object e "E" { kind: "flow.end"; }\n relation r1 @s -> @d { kind: "flow.next"; }\n relation r2 @d -> @e { kind: "flow.next"; }\n}\nview v { data: [@m]; kind: patent-figure; }\n';
 const ir=build(flow);
 const w=ir.diagnostics.filter(d=>d.code==='DDN-VP07');
 assert.equal(w.length,1);assert.equal(w[0].severity,'warning');
 const labelled=build(flow.replace('relation r2 @d -> @e { kind: "flow.next"; }','relation r2 "yes" @d -> @e { kind: "flow.next"; }'));
 assert.ok(!labelled.diagnostics.some(d=>d.code==='DDN-VP07'));
});

test('DDN-MK01/02: marking names and duplicates; valid marks carried to render IR',()=>{
 const rel='relation r @a -> @b { kind: flow; marks: MARKS; }';
 const wrap=m=>'data m { object a "A" { kind: cache; marks: [tentative]; } object b "B" { kind: queue; }\n '+rel.replace('MARKS',m)+'\n}\nview v { data: [@m]; }\n';
 assert.equal(code(()=>build(wrap('[cosmic]'))),'DDN-MK01');
 assert.equal(code(()=>build(wrap('[forbidden, forbidden]'))),'DDN-MK02');
 assert.equal(code(()=>build(wrap('forbidden'))),'DDN-MK01');
 const ir=build(wrap('[forbidden]'));
 assert.deepEqual(ir.relations.find(r=>r.local===undefined||true).properties.marks,['forbidden']);
 assert.deepEqual(ir.elements.find(e=>e.local==='a').properties.marks,['tentative']);
});

test('DDN-MK03/04: assertion bounds; assertions carried inert in the IR',()=>{
 const view=a=>'data m { object a "A" { kind: cache; } }\nview v { data: [@m]; assertions: '+a+'; }\n';
 assert.equal(code(()=>build(view('['+Array.from({length:33},(_,i)=>'"a'+i+'"').join(',')+']'))),'DDN-MK03');
 assert.equal(code(()=>build(view('[""]'))),'DDN-MK04');
 assert.equal(code(()=>build(view('["'+'x'.repeat(501)+'"]'))),'DDN-MK04');
 assert.equal(code(()=>build(view('[]'))),'DDN-MK03');
 const ir=build(view('["no cycle contains a payment gateway","every refund references an order"]'));
 assert.deepEqual(ir.view.assertions,['no cycle contains a payment gateway','every refund references an order']);
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; assertion: ""; } }\nview v { data: [@m]; }')),'DDN-MK04');
 const ir2=build('data m { object a "A" { kind: cache; } object b "B" { kind: queue; } relation r @a -> @b { kind: flow; assertion: "every order posts exactly one ledger entry"; } }\nview v { data: [@m]; }');
 assert.equal(ir2.relations[0].properties.assertion,'every order posts exactly one ledger entry');
});

test('provenance carried on the view IR; bounds enforced',()=>{
 const ir=build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; source: "system-overview.docx §3"; generator: "ddn-import 0.8.0"; }');
 assert.deepEqual(ir.view.provenance,{source:'system-overview.docx §3',generator:'ddn-import 0.8.0'});
 assert.equal(code(()=>build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; source: "'+'s'.repeat(301)+'"; }')),'DDN046');
});

test('ref: anchors parse, validate and land in the IR (MK05/MK06)',()=>{
 const base=t=>'data m {\n object valve "Shutoff valve" { kind: component; numeral: 112; }\n note ops "Service interval" { text: "'+t+'"; }\n}\nview v { data: [@m]; }\n';
 const ir=build(base('Drain via ref:valve before opening.'));
 assert.deepEqual(ir.view.refAnchors,[{site:ir.elements.find(e=>e.local==='ops').id,target:ir.elements.find(e=>e.local==='valve').id,anchor:'valve'}]);
 assert.equal(code(()=>build(base('See ref:nosuch here.'))),'DDN-MK05');
 assert.equal(code(()=>build(base('See ref:ops here.'))),'DDN-MK06');
});

test('DDN-V06: mixed workspace notes files older than the newest source version',()=>{
 const files={
  'entry.ddn':'ddn "0.6";\nmodule "entry";\nimport "old.ddn" as old;\ndata m { object a "A" { kind: cache; } }\nview v { data: [@m]; }\n',
  'old.ddn':'ddn "0.5";\nmodule "old";\ndata o { object b "B" { kind: queue; } }\n'};
 const {ir}=DDN.build(files,'entry.ddn','v',reg);
 const v06=ir.diagnostics.filter(d=>d.code==='DDN-V06');
 assert.equal(v06.length,1);assert.equal(v06[0].severity,'info');assert.match(v06[0].message,/old\.ddn/);
 // a single-dialect workspace lints nothing
 assert.ok(!build('data m { object a "A" { kind: cache; } }\nview v { data: [@m]; }').diagnostics.some(d=>d.code==='DDN-V06'));
});

test('view-kind/vocabulary/marking/theme tables are registered data consumable by later phases',()=>{
 assert.equal(DDN.viewProfiles,VP);
 for(const k of ['ddn-native','flowchart','c4-context','c4-container','c4-component','uml-class','uml-sequence','uml-state','uml-activity','uml-usecase','chart-bar','chart-line','ladder','patent-figure'])assert.ok(VP.VIEW_KINDS[k],k);
 assert.ok(VP.subsetAdmits('flow.process','kind','flow.decision')&&VP.subsetAdmits('flow.process','verb','flow')&&VP.subsetAdmits('flow.process','verb','flow.next'));
 assert.ok(!VP.subsetAdmits('flow.process','kind','database'));
 assert.ok(VP.subsetAdmits('core.full','kind','anything.at.all'));
 assert.ok(!VP.subsetAdmits('chart.records','verb','assoc'));
 assert.deepEqual(Object.keys(VP.MARKINGS),['forbidden','tentative']);
 assert.equal(VP.THEMES.colorblind_safe.id,'theme.a11y.cb@1');assert.equal(VP.THEMES.mono_print.id,'theme.mono.print@1');
 assert.equal(VP.PATENT_LEGAL.pack,'patent.legal@1');
});

test('cli check passes an 0.6 document and reports warnings',()=>{
 const cp=require('node:child_process'),os=require('node:os');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ddn08-'));
 fs.writeFileSync(path.join(dir,'m.ddn'),'ddn "0.6";\nmodule "m";\ndata m {\n object s "S" { kind: "flow.start"; }\n object d "D?" { kind: "flow.decision"; numeral: 110; marks: [tentative]; }\n object e "E" { kind: "flow.end"; }\n relation r1 @s -> @d { kind: "flow.next"; marks: [forbidden]; }\n relation r2 "yes" @d -> @e { kind: "flow.next"; assertion: "deterministic"; }\n}\nview v "V" {\n data: [@m];\n kind: patent-figure;\n strictness: strict;\n source: "spec §3";\n generator: "test";\n}\n');
 const out=JSON.parse(cp.execFileSync(process.execPath,[path.join(root,'cli/cli.js'),'check',path.join(dir,'m.ddn'),'--workspace',dir],{encoding:'utf8'}));
 assert.equal(out.status,'pass-core');assert.equal(out.elements,3);assert.equal(out.relations,2);
 fs.rmSync(dir,{recursive:true,force:true});
 const dir2=fs.mkdtempSync(path.join(os.tmpdir(),'ddn08-'));
 fs.writeFileSync(path.join(dir2,'m.ddn'),'ddn "0.5";\nmodule "m";\ndata m { object a "A" { kind: cache; marks: [forbidden]; } }\nview v { data: [@m]; }\n');
 const res=cp.spawnSync(process.execPath,[path.join(root,'cli/cli.js'),'check',path.join(dir2,'m.ddn'),'--workspace',dir2],{encoding:'utf8'});
 assert.notEqual(res.status,0);assert.match(res.stderr,/DDN-V04/);
 fs.rmSync(dir2,{recursive:true,force:true});
});

const passed=results.filter(r=>r.pass).length;
console.log(`0.8 core language ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
