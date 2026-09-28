/* SPDX-License-Identifier: GPL-2.0-or-later. B1-081: value stream mapping fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.vsm";
data m {
    object cust "Retailer" { kind: "vsm.customer"; }
    object ctrl "Production control" { kind: "vsm.control"; }
    object stamp "Stamping" { kind: "vsm.process"; x_vsm: { va: 1.5, nva: 3, unit: "d" };
        fields { field co "C/O 30 min"; }
    }
    object inv1 "" { kind: "vsm.inventory"; }
    object weld "Welding" { kind: "vsm.process"; x_vsm: { va: 2, nva: 1.5, unit: "d" }; }
    object sup "Supermarket" { kind: "vsm.supermarket"; }
    object asm "Assembly" { kind: "vsm.process"; x_vsm: { va: 3, nva: 2, unit: "d" }; }
    object kz "" { kind: "vsm.kaizen"; }
    object op "Operator" { kind: "vsm.operator"; }
    relation m1 "" @cust -> @stamp { kind: "vsm.pull"; }
    relation m2 "" @stamp -> @inv1 { kind: "vsm.material"; }
    relation m3 "" @inv1 -> @weld { kind: "vsm.push"; }
    relation m4 "" @weld -> @sup { kind: "vsm.material"; }
    relation m5 "" @sup -> @asm { kind: "vsm.pull"; }
    relation i1 "" @ctrl -> @stamp { kind: "vsm.einfo"; }
    relation i2 "" @ctrl -> @asm { kind: "vsm.minfo"; }
    relation i3 "" @op -> @weld { kind: "vsm.minfo"; }
}
view map "Map" { data: [@m]; projection { kind: graph; profile: "vsm.basic@1"; } layout { algorithm: layered; direction: right; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='map',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('VSM glyphs render: inventory triangle with I, supermarket lines, kaizen burst, operator actor',()=>{const r=run();
 assert.ok(r.svg.includes('data-shape="triangledown"')&&r.svg.includes('>I<'),'inventory triangle missing');
 assert.ok(r.svg.includes('data-shape="burst"'),'kaizen burst missing');
 assert.ok(r.svg.includes('data-shape="actor"'),'operator missing');});
test('process boxes carry data rows (field text)',()=>{const r=run();
 assert.ok(r.svg.includes('C/O 30 min'),'data row missing');});
test('the VA/NVA timeline ladder strip draws with values and totals',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-vsm-ladder'),'ladder missing');
 assert.ok(r.svg.includes('Σ 6.5'),'totals missing');
 assert.ok(r.svg.includes('VA / NVA timeline'),'ladder caption missing');});
test('electronic info draws a zigzag; manual info is dashed',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-vsm-einfo')&&r.svg.includes('data-zigzag="electronic"'),'einfo zigzag missing');
 assert.ok(r.svg.includes('stroke-dasharray="4 3"'),'manual info dash missing');});
test('push is solid, pull is dashed open',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-verb-vsmpush'),'push missing');
 assert.ok(r.svg.includes('stroke-dasharray="5 4"'),'pull dash missing');});
test('ladder values only on vsm.process (DDN-PJ205)',()=>{
 throws(()=>run('map',edit('object cust "Retailer" { kind: "vsm.customer"; }','object cust "Retailer" { kind: "vsm.customer"; x_vsm: { va: 1 }; }')),'DDN-PJ205');});
test('x_vsm needs at least one of va/nva (DDN-PJ205)',()=>{
 throws(()=>run('map',edit('x_vsm: { va: 2, nva: 1.5, unit: "d" }','x_vsm: { unit: "d" }')),'DDN-PJ205');});
test('negative ladder values are contract-rejected (DDN105)',()=>{
 throws(()=>run('map',edit('x_vsm: { va: 1.5, nva: 3, unit: "d" }','x_vsm: { va: -1, nva: 3, unit: "d" }')),'DDN105');});

const failed=results.filter(r=>!r.pass);
console.log('vsm-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
