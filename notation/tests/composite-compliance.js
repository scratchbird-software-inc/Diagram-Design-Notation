/* SPDX-License-Identifier: GPL-2.0-or-later. B1-059 (RFC-123): UML 2.5.1 component + composite-structure fixtures (uml.composite@1). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.comp";

data m {
    object shop "Shop" { kind: "uml.component";
        ports { port web { direction: in; } port store_if { direction: out; } }
        fields { field cart { x_part: { classifier: "Cart"; multiplicity: "1" }; } }
    }
    object store "Store" { kind: "uml.component";
        ports { port cart_if { direction: in; } }
        fields { field stock { x_part: { classifier: "Stock"; multiplicity: "0..*" }; } }
    }
    object session "Session planning" { kind: "uml.collaboration";
        fields { field buyer { x_part: { classifier: "Customer" }; } field seller { x_part: { classifier: "Merchant" }; } }
    }
    object billing "Billing" { kind: "uml.interface"; }

    relation asm "" @shop.store_if -> @store.cart_if { kind: "uml.assembly"; }
    relation del "" @shop.web -> @shop.cart { kind: "uml.delegation"; }
    relation con "" @shop.cart -> @store.stock { kind: "uml.connector";
        x_endlabels: { source: { role: "cart"; multiplicity: "1"; }; target: { role: "stock"; multiplicity: "0..*"; }; };
    }
    relation prov "" @shop -> @billing { kind: "uml.provided"; }
}

view v "Composite" {
    data: [@m];
    projection { kind: graph; profile: "uml.composite@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(changes={},view='v'){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('uml.composite@1 renders ports with port squares at member endpoints',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'uml.composite@1');
 assert.ok((r.svg.match(/data-port-square/g)||[]).length>=3,'port squares missing at assembly/delegation attachments');});
test('Assembly renders socket at source and lollipop at target (ball-and-socket)',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-verb-assembly'),'assembly group missing');
 assert.ok(r.svg.includes('A6.5 6.5 0 0 0 -11 6'),'socket arc missing');
 assert.ok(r.svg.includes('<circle cx="-7" cy="0" r="5"'),'lollipop circle missing');});
test('Delegation renders as a dashed open-arrow connector',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-verb-delegation'),'delegation group missing');
 assert.ok(r.svg.includes('stroke-dasharray="7 5"'),'delegation dash missing');});
test('Parts render as "role: Classifier [mult]" rows; collaboration renders dashed ellipse with keyword',()=>{const r=run();
 for(const s of ['cart: Cart [1]','stock: Stock [0..*]','buyer: Customer','seller: Merchant'])assert.ok(r.svg.includes(s),'part row missing: '+s);
 assert.ok(r.svg.includes('«collaboration»'),'collaboration keyword missing');
 assert.ok(r.svg.includes('stroke-dasharray="6 4"'),'dashed collaboration ellipse missing');});
test('Connector carries RFC-119 role names and multiplicity',()=>{const r=run();
 for(const s of ['cart','stock','0..*'])assert.ok(r.svg.includes(s));
 assert.ok((r.svg.match(/ddn-endlabel-role/g)||[]).length>=2,'connector role labels missing');});

test('Assembly may attach a component element or its ports; non-component kinds are DDN102',()=>{
 const r=run(edit('relation asm "" @shop.store_if -> @store.cart_if','relation asm "" @shop.store_if -> @store'));
 assert.match(r.svg,/<svg/);
 throws(()=>run(edit('relation prov "" @shop -> @billing { kind: "uml.provided"; }','relation prov "" @shop -> @billing { kind: "uml.assembly"; }')),'DDN102');});
test('Assembly member endpoints must be ports, not fields (DDN-PJ165)',()=>{
 throws(()=>run(edit('relation asm "" @shop.store_if -> @store.cart_if','relation asm "" @shop.store_if -> @store.stock')),'DDN-PJ165');});
test('Delegation must start at a port member (DDN-PJ165)',()=>{
 throws(()=>run(edit('relation del "" @shop.web -> @shop.cart','relation del "" @shop.cart -> @shop.web')),'DDN-PJ165');});
test('x_part on a non-classifier owner is DDN-PJ166',()=>{
 throws(()=>run(edit('object billing "Billing" { kind: "uml.interface"; }','object billing "Billing" { kind: "uml.interface"; fields { field p { x_part: { classifier: "X" }; } } }')),'DDN-PJ166');});
test('Bad part multiplicity is DDN-PJ166',()=>{
 throws(()=>run(edit('classifier: "Cart"; multiplicity: "1"','classifier: "Cart"; multiplicity: "many"')),'DDN-PJ166');});
test('x_endlabels on connector siblings stays DDN-PJ149',()=>{
 throws(()=>run(edit('relation prov "" @shop -> @billing { kind: "uml.provided"; }','relation prov "" @shop -> @billing { kind: "uml.provided"; x_endlabels: { source: { multiplicity: "1"; }; }; }')),'DDN-PJ149');});
test('Endpoint contracts: connector requires class/component kinds (DDN102)',()=>{
 throws(()=>run(edit('relation con "" @shop.cart -> @store.stock','relation con "" @shop.cart -> @session')),'DDN102');});

const failed=results.filter(r=>!r.pass);
console.log('composite-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
