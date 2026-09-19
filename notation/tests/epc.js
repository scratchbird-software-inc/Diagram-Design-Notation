/* SPDX-License-Identifier: GPL-2.0-or-later. EPC profile (epc.basic@1): positive, negative and determinism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Shapes=require('../runtime/ddn-shapes.js');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const SRC=`ddn "0.5";
module "test.epc";

format o {
    notation core { registry: "ddn-core@0.3"; }
    style classic { look: classic; theme: default; font: sans; seed: 42; }
    layout epc { algorithm: layered; direction: right; }
    display compact { fields: none; kind: icon_token; maturity: none; badges: none; }
    legend words { mode: text; placement: right; width: 280px; }
    publication screen { size: content; margin: 30px; minimum_text: 8pt; overflow: error; }
    bundle technical {
        notation: @core; style: @classic; display: @compact; publication: @screen; legend: @words;
    }
}

data chain {
    object ev1 "Order received" { kind: "epk.event"; }
    object fn1 "Check stock" { kind: "epk.function"; }
    object ev2 "Stock confirmed" { kind: "epk.event"; }
    object c1 "XOR" { kind: "epk.connector"; x_epc: { operator: "xor" }; }
    object fn2 "Ship order" { kind: "epk.function"; }
    object ev3 "Shipment confirmed" { kind: "epk.event"; }
    object fn3 "Send invoice" { kind: "epk.function"; }
    object ev4 "Invoice paid" { kind: "epk.event"; }
    object fn4 "Record backorder" { kind: "epk.function"; }
    object ev5 "Backorder recorded" { kind: "epk.event"; }
    relation r1 @ev1 -> @fn1 { kind: "epk.next"; }
    relation r2 @fn1 -> @ev2 { kind: "epk.next"; }
    relation r3 @ev2 -> @c1 { kind: "epk.next"; }
    relation r4 @c1 -> @fn2 { kind: "epk.next"; }
    relation r5 @c1 -> @fn4 { kind: "epk.next"; }
    relation r6 @fn2 -> @ev3 { kind: "epk.next"; }
    relation r7 @fn4 -> @ev5 { kind: "epk.next"; }
    relation r8 @ev3 -> @fn3 { kind: "epk.next"; }
    relation r9 @fn3 -> @ev4 { kind: "epk.next"; }
}

view epc "Synthetic order-to-cash / EPC" {
    data: [@chain]; format: @o.technical; layout: @o.epc;
    projection { kind: graph; profile: "epc.basic@1"; }
}
`;
const workspace=(src=SRC)=>A.createWorkspace({'main.ddn':src});
const run=(view,src)=>workspace(src).renderSync({entry:'main.ddn',view});
const edited=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return SRC.replace(before,after);};

test('EPC renders 10 nodes, 9 routes; silhouette golden counts; operator text visible',()=>{
 const r=run('epc');assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('</svg>'));
 assert.equal(r.scene.nodes.length,10);
 assert.equal(r.scene.routes.length,9);
 const count=shape=>(r.svg.match(new RegExp('data-shape="'+shape+'"','g'))||[]).length;
 assert.equal(count('hexagon'),5,'five hexagon events');
 assert.equal(count('round'),4,'four rounded functions');
 assert.equal(count('circle'),1,'one circle connector');
 assert.ok(/xor/i.test(r.svg),'operator text xor/XOR present in SVG');
});
test('Hexagon outline is a six-point polygon in the SVG and in Shapes.polygon',()=>{
 const svg=run('epc').svg,m=svg.match(/<g class="ddn-node"[^>]*data-shape="hexagon"[\s\S]*?<path d="([^"]+)"/);
 assert.ok(m,'hexagon node outline path found');
 assert.equal((m[1].match(/L/g)||[]).length,5,'closed six-point polygon draws M + five L segments');
 assert.ok(m[1].endsWith('Z'));
 assert.equal(Shapes.polygon({x:0,y:0,w:100,h:50,silhouette:'hexagon'}).length,6,'polygon() returns six points');
});
test('Connector operator renders via the node label; x_epc value carried in the model',()=>{
 const r=run('epc');assert.ok(r.svg.includes('XOR'),'connector name XOR printed inside the circle');
 const ir=workspace().resolve('main.ddn','epc'),c1=ir.elements.find(n=>n.name==='XOR');
 assert.equal(c1.kind,'epk.connector');
 assert.equal(c1.properties.x_epc.operator,'xor');
});
test('Event-to-event edge rejected (strict alternation)',()=>{
 throws(()=>run('epc',edited('    relation r3 @ev2 -> @c1 { kind: "epk.next"; }','    relation r3 @ev2 -> @ev3 { kind: "epk.next"; }')),'DDN-PJ105');
});
test('Function-to-function edge rejected (strict alternation)',()=>{
 throws(()=>run('epc',edited('    relation r4 @c1 -> @fn2 { kind: "epk.next"; }','    relation r4 @fn1 -> @fn2 { kind: "epk.next"; }')),'DDN-PJ105');
});
test('Connector without x_epc rejected',()=>{
 throws(()=>run('epc',edited(' x_epc: { operator: "xor" };','')),'DDN-PJ106');
});
test('Connector with unknown operator rejected',()=>{
 throws(()=>run('epc',edited('operator: "xor"','operator: "nand"')),'DDN-PJ106');
});
test('x_epc.operator on a non-connector node rejected',()=>{
 throws(()=>run('epc',edited('    object fn1 "Check stock" { kind: "epk.function"; }','    object fn1 "Check stock" { kind: "epk.function"; x_epc: { operator: "and" }; }')),'DDN-PJ106');
});
test('Non-EPC participant kind rejected',()=>{
 const src=edited('    relation r1 @ev1 -> @fn1 { kind: "epk.next"; }','    object foreign "Foreign process" { kind: "flow.process"; }\n    relation r1 @ev1 -> @fn1 { kind: "epk.next"; }');
 throws(()=>run('epc',src),'DDN-PF007');
});
test('flow.next is not the EPC verb (regression witness: endpoint contract is flow.*-only)',()=>{
 throws(()=>run('epc',edited('    relation r1 @ev1 -> @fn1 { kind: "epk.next"; }','    relation r1 @ev1 -> @fn1 { kind: "flow.next"; }')),'DDN102');
});
test('Non-epk.next relation kind rejected by the profile',()=>{
 const src=edited('    relation r9 @fn3 -> @ev4 { kind: "epk.next"; }','    relation r9 @fn3 -> @ev4 { kind: "epk.next"; }\n    relation extra @fn3 -> @fn4 { kind: "epk.next"; }\n    object c2 "AND" { kind: "epk.connector"; x_epc: { operator: "and" }; }\n    relation r10 @fn4 -> @c2 { kind: "depends"; }');
 throws(()=>run('epc',src),'DDN-PF007');
});
test('Fields on an epk.function node rejected',()=>{
 throws(()=>run('epc',edited('    object fn1 "Check stock" { kind: "epk.function"; }','    object fn1 "Check stock" { kind: "epk.function"; fields { field extra; } }')),'DDN-PF003');
});
test('Unknown profile version rejected',()=>{
 throws(()=>run('epc',edited('profile: "epc.basic@1";','profile: "epc.basic@2";')),'DDN-PF001');
});
test('Wrong projection kind rejected',()=>{
 const src=edited('view epc "Synthetic order-to-cash / EPC" {\n    data: [@chain]; format: @o.technical; layout: @o.epc;\n    projection { kind: graph; profile: "epc.basic@1"; }','view charted "Synthetic order-to-cash / wrong kind" {\n    data: [@chain]; format: @o.technical; layout: @o.epc;\n    projection { kind: chart; profile: "epc.basic@1"; }');
 throws(()=>run('charted',src),'DDN-PF002');
});
test('Deterministic rerender',()=>assert.equal(run('epc').svg,run('epc').svg));
const report={runtime:A.VERSION,scope:'EPC profile epc.basic@1 validation and rendering.',passed:results.filter(t=>t.pass).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname,'../tests/validation'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../tests/validation/epc-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log('EPC',report.passed+'/'+report.total);
if(report.passed!==report.total)process.exitCode=1;
