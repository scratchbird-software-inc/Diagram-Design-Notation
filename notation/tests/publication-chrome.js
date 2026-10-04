/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 publication chrome
 * (chapter 53): header/footer records + variables (P1), page border (P2),
 * backgrounds and path rules (P3), multi-view publication sets (P4) and
 * print-size lint DDN-PS01–PS04 (P5) — plus the render side of chapters
 * 52/55: marking paint per theme (incl. mono_print B/W distinguishability),
 * ref: anchor resolution, numeral field boxes, patent.legal@1 chrome
 * defaults, and the colorblind_safe/mono_print theme re-skins. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-render.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const src=(body,version='0.6',extra={})=>({'m.ddn':'ddn "'+version+'";\nmodule "m";\n'+body,...extra});
const build=(body,view='v',version='0.6',extra)=>DDN.build(src(body,version,extra),'m.ddn',view,reg).ir;
const render=(body,options,version,extra)=>Render.render(build(body,'v',version,extra),reg,defs,options);
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};
const PNG64=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082','hex').toString('base64');
const GRID='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M0 0H40M0 20H40M0 40H40M0 0V40M20 0V40M40 0V40" stroke="#999" stroke-width="1"/></svg>';

const CHROME='format shared { publication filing { size: letter; margin: 18mm; header { left { text: "$title"; size: 9pt; } right { text: "CONFIDENTIAL — $date"; size: 8pt; } } footer { left { text: "$view_id"; size: 8pt; } center { text: "FIG. $figure"; size: 10pt; font: serif; } right { text: "Page $page"; size: 8pt; } } } }';
const MODEL='data m { object a "Alpha" { kind: component; } object b "Beta" { kind: component; } relation r1 @a -> @b { kind: assoc; } }';

test('P1: header/footer runs render with variables resolved at publication time',()=>{
 const res=render(CHROME+'\n'+MODEL+'\nview v "Filing view" { data: [@m]; publication: @shared.filing; }',{publicationDate:'2026-10-04'});
 assert.ok(res.svg.includes('Filing view'),'$title falls back to the view label');
 assert.ok(res.svg.includes('CONFIDENTIAL — 2026-10-04'),'$date from the publicationDate option');
 assert.ok(res.svg.includes('FIG. 1'),'$figure defaults to 1');
 assert.ok(res.svg.includes('Page 1'),'$page defaults to 1');
 assert.ok(res.svg.includes('>v<'),'$view_id is the view source id');
 assert.ok(res.svg.includes('ddn-pub-header')&&res.svg.includes('ddn-pub-footer'),'chrome bands emitted');
 assert.ok(res.svg.includes('DejaVu Serif'),'run font keyword honoured');
});

test('P1: publication.title beats the view label; page/figure options drive $page/$figure',()=>{
 const body=CHROME.replace('$title','$title')+'\n'+MODEL+'\nview v { data: [@m]; publication: @shared.filing; publication { title: "Declared title"; } }';
 const res=render(body,{publicationDate:'2026-01-01',page:3,figure:2});
 assert.ok(res.svg.includes('Declared title'));
 assert.ok(res.svg.includes('FIG. 2')&&res.svg.includes('Page 3'));
});

test('P1: multi-line runs split on \\n and cap at the declared line count',()=>{
 const res=render('format f { publication p { size: letter; footer { left { text: "line one\\nline two\\nline three"; lines: 2; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(res.svg.includes('line one')&&res.svg.includes('line two'),'declared lines render');
 assert.ok(!res.svg.includes('line three'),'lines beyond the cap are dropped');
});

test('P1: $$ renders a literal dollar sign',()=>{
 const res=render('format f { publication p { size: letter; footer { left { text: "USD $$5 flat"; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(res.svg.includes('USD $5 flat'));
});

test('P1: DDN-PB01 malformed runs, DDN-PB02 unknown variable',()=>{
 assert.equal(code(()=>build('format f { publication p { header { left { size: 9pt; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB01','missing text');
 assert.equal(code(()=>build('format f { publication p { header { left { text: "x"; align: sideways; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB01','bad align');
 assert.equal(code(()=>build('format f { publication p { header { left { text: "x"; size: 30pt; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB01','size out of range');
 assert.equal(code(()=>build('format f { publication p { header { left { text: "x"; lines: 9; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB01','lines out of range');
 assert.equal(code(()=>build('format f { publication p { header { left { text: "$secret"; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB02');
});

test('P1: $date is deterministic under a pinned publicationDate',()=>{
 const body=CHROME+'\n'+MODEL+'\nview v { data: [@m]; publication: @shared.filing; }';
 const a=render(body,{publicationDate:'2026-10-04'}),b=render(body,{publicationDate:'2026-10-04'});
 assert.equal(a.svg,b.svg,'same pinned date, same bytes');
});

test('P1: chrome-free publication renders with no 0.8 chrome paint',()=>{
 const res=render(MODEL+'\nview v { data: [@m]; }');
 for(const marker of ['ddn-pub-header','ddn-pub-footer','ddn-pub-border','ddn-pub-background','ddn-mark','ddn-numeral'])
  assert.ok(!res.svg.includes(marker),marker+' absent without 0.8 chrome');
});

test('P1/P2/P3: 0.8 chrome constructs are gated on ddn "0.6" (DDN-V04)',()=>{
 assert.equal(code(()=>build('format f { publication p { header { left { text: "x"; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }','v','0.5')),'DDN-V04');
 assert.equal(code(()=>build('format f { publication p { border { style: single; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }','v','0.5')),'DDN-V04');
 assert.equal(code(()=>build('format f { publication p { background { color: "#fff"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }','v','0.5')),'DDN-V04');
 assert.equal(code(()=>build(MODEL+'\nview v { data: [@m]; }\npublication_set s { figures: [@v]; }','v','0.5')),'DDN-V04','publication_set gated');
});

test('P2: page border paints single/double/dashed plus corner marks',()=>{
 const single=render('format f { publication p { size: a4; border { style: single; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(single.svg.includes('ddn-pub-border')&&single.svg.includes('data-style="single"'));
 assert.equal((single.svg.match(/ddn-pub-corner/g)||[]).length,0,'no corner marks by default');
 const dbl=render('format f { publication p { size: a4; border { style: double; weight: 2pt; inset: 6mm; corner_marks: true; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(dbl.svg.includes('data-style="double"'));
 const bi=dbl.svg.indexOf('ddn-pub-border'),borderGroup=dbl.svg.slice(bi,dbl.svg.indexOf('</g>',bi));
 assert.equal((borderGroup.match(/<rect /g)||[]).length,2,'double draws two rules');
 assert.ok(borderGroup.includes('<rect x="22.677'),'outer rule at the 6mm inset');
 assert.equal((dbl.svg.match(/ddn-pub-corner/g)||[]).length,4,'four corner marks');
 const dashed=render('format f { publication p { size: a4; border { style: dashed; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(/ddn-pub-border[\s\S]{0,300}stroke-dasharray/.test(dashed.svg));
});

test('P2: DDN-PB03 invalid border values',()=>{
 assert.equal(code(()=>build('format f { publication p { border { style: triple; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB03');
 assert.equal(code(()=>build('format f { publication p { border { style: single; weight: 9pt; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB03');
 assert.equal(code(()=>build('format f { publication p { border { weight: 1pt; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB03','style is required');
});

test('P3: background color paints behind drawing and chrome',()=>{
 const res=render('format f { publication p { size: content; background { color: "#f7f4ee"; opacity: 0.4; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(res.svg.includes('ddn-pub-background')&&res.svg.includes('fill="#f7f4ee"')&&res.svg.includes('opacity="0.4"'));
});

test('P3: PNG image embeds as a self-contained base64 data URI',()=>{
 const res=render('format f { publication p { size: letter; background { image: "wm.png"; opacity: 0.15; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }',{},'0.6',{'wm.png':PNG64});
 assert.ok(res.svg.includes('data:image/png;base64,'+PNG64),'raster embedded as data URI');
 assert.ok(!res.svg.includes('wm.png"'),'the export never references the original path');
 assert.ok(res.svg.includes('opacity="0.15"'));
});

test('P3: SVG pattern inlines sanitized with ids namespaced',()=>{
 const res=render('format f { publication p { size: content; background { pattern: "grid.svg"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }',{},'0.6',{'grid.svg':GRID});
 assert.ok(res.svg.includes('<pattern id="bgp-'),'pattern def emitted');
 assert.ok(res.svg.includes('fill="url(#bgp-'),'page rect paints the pattern');
});

test('P3: DDN-PB04/PB05/PB06 path and shape rules',()=>{
 assert.equal(code(()=>build('format f { publication p { background { color: "#fff"; image: "a.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB04','two kinds');
 assert.equal(code(()=>build('format f { publication p { background { opacity: 2; color: "#fff"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB04','opacity range');
 assert.equal(code(()=>build('format f { publication p { background { image: "/etc/passwd.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB05','absolute path');
 assert.equal(code(()=>build('format f { publication p { background { image: "https://x.test/wm.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB05','URL');
 assert.equal(code(()=>build('format f { publication p { background { image: "data:image/png;base64,AA"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB05','data: URI');
 assert.equal(code(()=>build('format f { publication p { background { image: "../escape.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB05','workspace escape');
 assert.equal(code(()=>build('format f { publication p { background { image: "wm.gif"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }', 'v','0.6',{'wm.gif':'R0lGOD=='})),'DDN-PB06','image format');
 assert.equal(code(()=>build('format f { publication p { background { pattern: "grid.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }', 'v','0.6',{'grid.png':PNG64})),'DDN-PB06','pattern format');
});

test('P3: DDN-PB07 missing image follows the overflow policy',()=>{
 assert.equal(code(()=>build('format f { publication p { overflow: error; background { image: "gone.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }')),'DDN-PB07','error under overflow: error');
 const ir=build('format f { publication p { overflow: warn; background { image: "gone.png"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 assert.ok(ir.diagnostics.some(d=>d.code==='DDN-PB07'&&d.severity==='warning'),'warning under overflow: warn');
 assert.equal(ir.view.profiles.publication.background,undefined,'plain background instead');
 const res=Render.render(ir,reg,defs);
 assert.ok(!res.svg.includes('ddn-pub-background'),'nothing paints');
});

test('P3: DDN-PB08 pattern sanitization names the rejected construct',()=>{
 try{build('format f { publication p { background { pattern: "evil.svg"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }','v','0.6',{'evil.svg':'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'});assert.fail('no throw');}
 catch(e){assert.equal(e.code,'DDN-PB08');assert.match(e.message,/script/i);}
 assert.equal(code(()=>build('format f { publication p { background { pattern: "ext.svg"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }','v','0.6',{'ext.svg':'<svg xmlns="http://www.w3.org/2000/svg"><use href="https://x.test/a.svg#i"/></svg>'})),'DDN-PB08','external href');
 const ok=build('format f { publication p { background { pattern: "ok.svg"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }','v','0.6',{'ok.svg':'<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect width="9" height="9" fill="url(#g)"/></svg>'});
 assert.ok(ok.view.profiles.publication.background,'internal url(#…) fragment references allowed');
});

test('P3: a view-level background overrides the referenced publication',()=>{
 const ir=build('format f { publication p { background { color: "#111111"; } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; publication { background { color: "#222222"; } } }');
 assert.equal(ir.view.profiles.publication.background.color,'#222222');
});

test('P4: publication_set validation (DDN-PB09)',()=>{
 const sets=DDN.publicationSets(src(CHROME+'\n'+MODEL+'\nview v { data: [@m]; }\nview w { data: [@m]; }\npublication_set figures "Patent figures" { publication: @shared.filing; figures: [@v, @w]; }'),'m.ddn',reg);
 assert.equal(sets.length,1);
 assert.equal(sets[0].name,'Patent figures');
 assert.deepEqual(sets[0].figures.map(f=>f.local),['v','w'],'authorial order preserved');
 assert.equal(code(()=>DDN.publicationSets(src(MODEL+'\nview v { data: [@m]; }\npublication_set s { figures: [@ghost]; }'),'m.ddn',reg)),'DDN-PB09','missing figure reference');
 assert.equal(code(()=>DDN.publicationSets(src(MODEL+'\nview v { data: [@m]; }\npublication_set s { figures: [@m]; }'),'m.ddn',reg)),'DDN-PB09','non-view figure');
 assert.equal(code(()=>DDN.publicationSets(src(MODEL+'\nview v { data: [@m]; }\npublication_set s { figures: []; }'),'m.ddn',reg)),'DDN-PB09','empty array');
});

test('P4: rendering a set emits one SVG per figure plus the manifest',()=>{
 const files=src(CHROME+'\n'+MODEL+'\nview v { data: [@m]; publication: @shared.filing; }\nview w "Second view" { data: [@m]; }\npublication_set figures "Patent figures" { publication: @shared.filing; figures: [@v, @w]; }');
 const out=Render.renderPublicationSet(files,'m.ddn','figures',reg,defs,{publicationDate:'2026-10-04'});
 assert.deepEqual(Object.keys(out.files),['m--v.svg','m--w.svg'],'<entry>--<view_id>.svg naming');
 assert.deepEqual(out.manifest,{set:'Patent figures',figures:[{view_id:'v',file:'m--v.svg',figure:1,page:1},{view_id:'w',file:'m--w.svg',figure:2,page:2}]});
 assert.ok(out.files['m--v.svg'].includes('FIG. 1')&&out.files['m--w.svg'].includes('FIG. 2'),'$figure numbers by position');
 assert.ok(out.files['m--w.svg'].includes('Page 2'),'$page numbers by position');
 assert.ok(out.files['m--w.svg'].includes('ddn-pub-header'),'shared chrome reaches figures that declare no publication');
 assert.equal(code(()=>Render.renderPublicationSet(files,'m.ddn','nope',reg,defs)),'DDN-PB09','unknown set names PB09');
});

test('P4: a figure concern declared on the view beats the set chrome',()=>{
 const files=src('format f { publication p { size: letter; footer { center { text: "SET $figure"; } } } }\n'+MODEL+'\nview v { data: [@m]; publication { size: letter; footer { center { text: "OWN $figure"; } } } }\npublication_set s { publication: @f.p; figures: [@v]; }');
 const out=Render.renderPublicationSet(files,'m.ddn','s',reg,defs);
 assert.ok(out.files['m--v.svg'].includes('OWN 1'),'the figure keeps its own footer');
 assert.ok(!out.files['m--v.svg'].includes('SET 1'));
});

test('P5: print-size lint skips size: content and fires PS03 on physical paper without minimum_text',()=>{
 const content=build(MODEL+'\nview v { data: [@m]; publication { size: content; } }');
 assert.deepEqual(Render.printSizeLint(content,reg,defs),[],'no physical target, no lint');
 const a4=build(MODEL+'\nview v { data: [@m]; publication { size: a4; } }');
 const diags=Render.printSizeLint(a4,reg,defs);
 assert.ok(diags.some(d=>d.code==='DDN-PS03'&&d.severity==='info'),'default minimum_text noted');
 const declared=build(MODEL+'\nview v { data: [@m]; publication { size: a4; minimum_text: 8pt; } }');
 assert.ok(!Render.printSizeLint(declared,reg,defs).some(d=>d.code==='DDN-PS03'),'declared minimum_text silences PS03');
});

test('P5: DDN-PS01 effective text below minimum_text at print scale',()=>{
 const ir=build(MODEL+'\nview v { data: [@m]; publication { size: letter; minimum_text: 40pt; overflow: warn; } }');
 const diags=Render.printSizeLint(ir,reg,defs);
 const ps=diags.find(d=>d.code==='DDN-PS01');
 assert.ok(ps,'lint fired');
 assert.equal(ps.severity,'warning');
 assert.match(ps.message,/increase base font to ≥[\d.]+px/,'DDN071-style remedy');
 const chromeSmall=build('format f { publication p { size: letter; minimum_text: 10pt; header { left { text: "tiny"; size: 4pt; } } } }\n'+MODEL+'\nview v { data: [@m]; publication: @f.p; }');
 const d2=Render.printSizeLint(chromeSmall,reg,defs).find(d=>d.code==='DDN-PS01');
 assert.ok(d2&&d2.message.includes('header left chrome run'),'chrome runs participate in lint');
});

test('P5: DDN-PS02 line-weight floor and DDN-PS04 strict-print gate',()=>{
 const ir=build(MODEL+'\nview v { data: [@m]; publication { size: letter; minimum_text: 40pt; embedding_scale: 0.25; overflow: warn; } }');
 const diags=Render.printSizeLint(ir,reg,defs);
 assert.ok(diags.some(d=>d.code==='DDN-PS02'&&/below the 0.5pt print floor/.test(d.message)),'relation weight under the floor');
 const strict=Render.printSizeLint(ir,reg,defs,{strictPrint:true});
 assert.ok(strict.some(d=>d.code==='DDN-PS04'&&d.severity==='error'),'warnings promote under strict-print');
 assert.ok(!Render.printSizeLint(ir,reg,defs).some(d=>d.code==='DDN-PS04'),'no gate without strict-print');
});

test('markings: forbidden relation renders struck/dashed per theme',()=>{
 const body=MODEL.replace('relation r1 @a -> @b { kind: assoc; }','relation r1 @a -> @b { kind: assoc; marks: [forbidden]; }')+'\nview v { data: [@m]; }';
 const def=render(body);
 assert.ok(def.svg.includes('ddn-mark-forbidden'));
 assert.ok(/ddn-mark-forbidden[\s\S]{0,600}#B42318/.test(def.svg),'red prohibition under the default theme');
 assert.ok(/ddn-mark-forbidden[\s\S]{0,600}stroke-dasharray/.test(def.svg),'dashed, never colour-only');
 const cbSvg=Render.render(build(body.replace('view v { data: [@m]; }','view v { data: [@m]; theme: colorblind_safe; }')),reg,defs).svg;
 assert.ok(/ddn-mark-forbidden[\s\S]{0,600}dasharray="2 3"/.test(cbSvg),'dash-heavy under colorblind_safe');
});

test('markings: mono_print keeps forbidden distinguishable in pure B/W',()=>{
 const body=MODEL.replace('relation r1 @a -> @b { kind: assoc; }','relation r1 @a -> @b { kind: assoc; marks: [forbidden]; }')+'\nview v { data: [@m]; theme: mono_print; }';
 const svg=render(body).svg;
 const mark=svg.slice(svg.indexOf('ddn-mark-forbidden'),svg.indexOf('ddn-mark-forbidden')+1200);
 assert.ok(mark.includes('stroke="#000000"'),'black paint only');
 assert.ok(mark.includes('stroke-dasharray="3 2"'),'dash treatment carries the signal');
 assert.ok(mark.includes('data-hatch="true"'),'hatched strike carries the signal without colour');
});

test('markings: tentative renders dashed-grey on elements and relations',()=>{
 const body=MODEL.replace('object b "Beta" { kind: component; }','object b "Beta" { kind: component; marks: [tentative]; }').replace('relation r1 @a -> @b { kind: assoc; }','relation r1 @a -> @b { kind: assoc; marks: [tentative]; }')+'\nview v { data: [@m]; }';
 const svg=render(body).svg;
 assert.equal((svg.match(/ddn-mark-tentative/g)||[]).length,2,'element and relation both painted');
 assert.ok(/ddn-mark-tentative[\s\S]{0,400}#8A8F98/.test(svg),'grey dash');
});

test('ref: anchors resolve to numeral, else label, before measurement',()=>{
 const body='data m { object valve "Shutoff valve" { kind: component; numeral: 112; } object pump "Feed pump" { kind: component; } note ops "Service interval" { text: "ignored"; } object note2 "Drain via ref:valve before opening ref:pump." { kind: note; } relation r1 @valve -> @pump { kind: assoc; } }';
 const svg=render(body+'\nview v { data: [@m]; }').svg;
 assert.ok(svg.includes('Drain via 112 before opening Feed pump.'),'numeral and label substitution');
 assert.ok(!svg.includes('ref:valve'),'no raw anchor survives render');
});

test('numeral field box paints under the element header and reserves height',()=>{
 const plain=render('data m { object a "Alpha" { kind: term; } }\nview v { data: [@m]; }');
 const boxed=render('data m { object a "Alpha" { kind: term; numeral: 102; } }\nview v { data: [@m]; }');
 assert.ok(boxed.svg.includes('class="ddn-numeral" data-numeral="102"'),'boxed numeral row');
 const gp=plain.scene.nodes[0],gb=boxed.scene.nodes[0];
 assert.ok(gb.h>gp.h,'the row reserves height like a field');
 const shaped=render('data m { object a "Alpha" { kind: component; numeral: 102; } }\nview v { data: [@m]; }');
 assert.ok(shaped.svg.includes('data-numeral="102"'),'profileKind numeral chip');
});

test('patent-figure kind attaches mono_print plus patent.legal@1 chrome defaults',()=>{
 const ir=build('data m { object a "Alpha" { kind: term; numeral: 100; } object b "Beta" { kind: component; } relation r1 @a -> @b { kind: assoc; } }\nview v "Filing" { data: [@m]; kind: patent-figure; }');
 assert.equal(ir.view.theme,'mono_print','kind-attached theme');
 assert.ok(ir.view.profiles.publication.header&&ir.view.profiles.publication.footer&&ir.view.profiles.publication.border,'chrome defaults present');
 const svg=Render.render(ir,reg,defs,{publicationDate:'2026-10-04'}).svg;
 assert.ok(svg.includes('Filing')&&svg.includes('2026-10-04'),'title block with $title and $date');
 assert.ok(svg.includes('FIG. 1')&&svg.includes('Page 1'),'footer defaults');
 assert.ok(svg.includes('data-style="single"'),'single page border');
 assert.ok(svg.includes('data-numeral="100"'),'numeral box painted');
 assert.ok(svg.includes('fill="#FFFFFF"'),'white fills under mono_print');
});

test('theme: mono_print re-skins paint only — same geometry, black/white output',()=>{
 const body=MODEL+'\nview v { data: [@m]; }';
 const plain=render(body);
 const mono=render(body.replace('view v { data: [@m]; }','view v { data: [@m]; theme: mono_print; }'));
 assert.deepEqual(mono.scene.nodes.map(n=>[n.x,n.y,n.w,n.h]),plain.scene.nodes.map(n=>[n.x,n.y,n.w,n.h]),'theme never moves geometry');
 assert.equal(mono.scene.routes.length,plain.scene.routes.length);
 assert.ok(mono.svg.includes('<rect width="100%" height="100%" fill="#FFFFFF"/>'),'white page');
 const monoStrokes=[...mono.svg.matchAll(/stroke="(#[0-9A-Fa-f]{6})"/g)].map(m=>m[1]);
 for(const s of monoStrokes){const r=parseInt(s.slice(1,3),16),g=parseInt(s.slice(3,5),16),b=parseInt(s.slice(5,7),16);assert.ok(r===g&&g===b,'stroke '+s+' is grayscale');}
});

test('theme: colorblind_safe remaps route colours onto the Okabe-Ito palette',()=>{
 const body=MODEL+'\nview v { data: [@m]; }';
 const plain=render(body);
 const cb=render(body.replace('view v { data: [@m]; }','view v { data: [@m]; theme: colorblind_safe; }'));
 const palette=['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7','#999999'];
 const routeStroke=svg=>(svg.match(/<g data-route-pieces[\s\S]{0,400}?stroke="(#[0-9A-F]{6})"/)||[])[1];
 assert.ok(palette.includes(routeStroke(cb.svg)),'route colour on the registered palette');
 assert.notEqual(routeStroke(cb.svg),routeStroke(plain.svg),'re-skinned');
 assert.deepEqual(cb.scene.nodes.map(n=>[n.x,n.y]),plain.scene.nodes.map(n=>[n.x,n.y]),'geometry untouched');
});

const passed=results.filter(r=>r.pass).length;
console.log(`Publication chrome ${passed}/${results.length}`);
if(passed!==results.length)process.exitCode=1;
