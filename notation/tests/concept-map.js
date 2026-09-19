/* SPDX-License-Identifier: GPL-2.0-or-later. Concept map profile (concept.map@1): positive, negative and determinism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const SRC=`ddn "0.5";
module "test.concepts";

format o {
    notation core { registry: "ddn-core@0.3"; }
    style classic { look: classic; theme: default; font: sans; seed: 42; }
    layout cmap { algorithm: layered; direction: right; routing: curved; curve: bezier; }
    display compact { fields: none; kind: icon_token; maturity: none; badges: none; }
    legend words { mode: text; placement: right; width: 280px; }
    publication screen { size: content; margin: 30px; minimum_text: 8pt; overflow: error; }
    bundle technical {
        notation: @core; style: @classic; display: @compact; publication: @screen; legend: @words;
    }
}

data domain {
    object order "Order" { kind: entity; }
    object invoice "Invoice" { kind: entity; }
    object payment "Payment" { kind: entity; }
    object ledger "Ledger" { kind: entity; }
    object shipment "Shipment" { kind: entity; }
    relation r1 "bills" @order -> @invoice { kind: assoc; }
    relation r2 "settles" @payment -> @invoice { kind: assoc; }
    relation r3 "posts to" @invoice -> @ledger { kind: assoc; }
    relation r4 "fulfilled by" @order -> @shipment { kind: assoc; }
    relation r5 "books freight to" @shipment -> @ledger { kind: assoc; }
}

view concepts "Synthetic order-to-cash concepts / concept map" {
    data: [@domain]; format: @o.technical; layout: @o.cmap;
    projection { kind: graph; profile: "concept.map@1"; }
}
`;
const workspace=(src=SRC)=>A.createWorkspace({'main.ddn':src});
const run=(view,src)=>workspace(src).renderSync({entry:'main.ddn',view});
const edited=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return SRC.replace(before,after);};

test('Concept map renders 5 nodes; every route carries a measured label',()=>{
 const r=run('concepts');assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('</svg>'));
 assert.equal(r.scene.nodes.length,5);
 assert.equal(r.scene.routes.length,5);
 assert.ok(r.scene.routes.every(rt=>rt.label&&rt.label.w>0),'every route label has positive width');
});
test('SVG contains every author label as text',()=>{
 const svg=run('concepts').svg;
 for(const s of ['bills','settles','posts to','fulfilled by','books freight to'])assert.ok(svg.includes(s),'missing label '+s);
});
test('Stripped relation name rejected (verb default is not an explicit label)',()=>{
 throws(()=>run('concepts',edited('    relation r2 "settles" @payment -> @invoice { kind: assoc; }','    relation r2 @payment -> @invoice { kind: assoc; }')),'DDN-PJ104');
});
test('Explicit empty label rejected',()=>{
 throws(()=>run('concepts',edited('    relation r2 "settles" @payment -> @invoice { kind: assoc; }','    relation r2 "" @payment -> @invoice { kind: assoc; }')),'DDN-PJ104');
});
test('Label equal to the verb default rejected (documented heuristic)',()=>{
 throws(()=>run('concepts',edited('    relation r2 "settles" @payment -> @invoice { kind: assoc; }','    relation r2 "associated with" @payment -> @invoice { kind: assoc; }')),'DDN-PJ104');
});
test('Non-concept participant kind rejected',()=>{
 const src=edited('    object order "Order" { kind: entity; }','    object order "Order" { kind: entity; }\n    object extract "Order extract" { kind: table; fields { field order_id; } }');
 throws(()=>run('concepts',src),'DDN-PF007');
});
test('Non-structural relation kind rejected',()=>{
 const src=edited('    relation r5 "books freight to" @shipment -> @ledger { kind: assoc; }','    relation r5 "books freight to" @shipment -> @ledger { kind: assoc; }\n    relation r6 "triggers" @payment -> @shipment { kind: depends; }');
 throws(()=>run('concepts',src),'DDN-PF007');
});
test('Unknown profile version rejected',()=>{
 throws(()=>run('concepts',edited('profile: "concept.map@1";','profile: "concept.map@2";')),'DDN-PF001');
});
test('Wrong projection kind rejected',()=>{
 const src=edited('view concepts "Synthetic order-to-cash concepts / concept map" {\n    data: [@domain]; format: @o.technical; layout: @o.cmap;\n    projection { kind: graph; profile: "concept.map@1"; }','view charted "Synthetic order-to-cash concepts / wrong kind" {\n    data: [@domain]; format: @o.technical; layout: @o.cmap;\n    projection { kind: chart; profile: "concept.map@1"; }');
 throws(()=>run('charted',src),'DDN-PF002');
});
test('Deterministic rerender',()=>assert.equal(run('concepts').svg,run('concepts').svg));
const report={runtime:A.VERSION,scope:'Concept map profile concept.map@1 validation and rendering.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/concept-map-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('Concept map',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
