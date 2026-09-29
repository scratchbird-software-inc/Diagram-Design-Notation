/* SPDX-License-Identifier: GPL-2.0-or-later. B1-072: SoaML 1.0.1 compliance fixtures (RFC-130). */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.soaml";

data m {
    object shop "Shop" { kind: "soaml.participant";
        ports { port billing { direction: out; x_service: { kind: "request" }; datatype: "Billing"; } }
    }
    object billing "Billing service" { kind: "soaml.serviceinterface";
        fields { field charge "charge()"; }
        ports { port api { direction: in; x_service: { kind: "service" }; datatype: "Billing"; } }
    }
    object org "Retail group" { kind: "soaml.agent"; }
    object cap "Online retail" { kind: "soaml.capability"; }
    object msg "Invoice" { kind: "soaml.message"; }
    object ms "Payment received" { kind: "soaml.milestone"; }
    object contract "Billing terms" { kind: "soaml.servicecontract";
        fields { field provider { x_part: { classifier: "Billing" }; } field consumer { x_part: { classifier: "Shop" }; } }
        x_contract: { choreography: @choreo };
    }
    relation a1 "" @shop.billing -> @billing.api { kind: "uml.assembly"; }
    relation cap1 "" @billing -> @cap { kind: "uml.realization"; }
    relation offers "" @contract -> @billing { kind: "uml.provided"; }
}
data c {
    object shopper "Shop" { kind: "uml.class"; }
    object biller "Billing" { kind: "uml.class"; }
    relation m1 "charge()" @shopper -> @biller { kind: "uml.message"; }
}
view arch "Architecture" { data: [@m]; projection { kind: graph; profile: "soaml.services@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view choreo "Choreography" { data: [@c]; projection { kind: sequence; profile: "uml.sequence@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view sm "Protocol" { data: [@c]; projection { kind: graph; profile: "uml.statemachine@1"; } publication { size: content; fit: none; overflow: error; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='arch',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('SoaML kind keywords render (participant, ServiceInterface, ServiceContract, capability, message, milestone, agent)',()=>{const r=run();
 for(const s of ['«participant»','«ServiceInterface»','«ServiceContract»','«capability»','«message»','«milestone»','«agent»'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('«Service»/«Request» port badges with filled/hollow squares',()=>{const r=run();
 assert.ok(r.svg.includes('«Service»')&&r.svg.includes('«Request»'),'badges missing');
 assert.ok(r.svg.includes('data-service="service"')&&r.svg.includes('data-service="request"'),'data hooks missing');});
test('service contract: collaboration glyph with provider/consumer role rows',()=>{const r=run();
 assert.ok(r.svg.includes('provider: Billing')&&r.svg.includes('consumer: Shop'),'role rows missing');
 assert.ok(r.svg.includes('stroke-dasharray="6 4"'),'dashed collaboration outline missing');});
test('choreography binding renders and the choreography view renders',()=>{
 run('choreo');run('arch');});
test('protocol state machine binding accepted (uml.statemachine@1 choreography)',()=>{
 run('arch',edit('choreography: @choreo','choreography: @sm'));});

test('x_service on a non-participant owner (DDN-PJ195)',()=>{
 throws(()=>run('arch',edit('object cap "Online retail" { kind: "soaml.capability"; }','object cap "Online retail" { kind: "soaml.capability"; ports { port p { direction: in; x_service: { kind: "service" }; } } }')),'DDN-PJ195');});
test('x_contract on a non-contract owner (DDN-PJ195)',()=>{
 throws(()=>run('arch',edit('object cap "Online retail" { kind: "soaml.capability"; }','object cap "Online retail" { kind: "soaml.capability"; x_contract: { choreography: @choreo }; }')),'DDN-PJ195');});
test('assembly between two «Service» ports (DDN-PJ196)',()=>{
 throws(()=>run('arch',edit('x_service: { kind: "request" }','x_service: { kind: "service" }')),'DDN-PJ196');});
test('assembly between mismatched interface types (DDN-PJ196)',()=>{
 throws(()=>run('arch',edit('x_service: { kind: "request" }; datatype: "Billing"','x_service: { kind: "request" }; datatype: "Other"')),'DDN-PJ196');});
test('choreography binding to a wrong view kind (DDN-PJ197)',()=>{
 throws(()=>run('arch',edit('choreography: @choreo','choreography: @arch')),'DDN-PJ197');});
test('assembly endpoint kinds are registry-enforced (DDN102)',()=>{
 throws(()=>run('arch',edit('relation a1 "" @shop.billing -> @billing.api','relation a1 "" @cap -> @billing.api')),'DDN102');});

/* B1-089: SoaML §6.4.15 ServiceChannel compatibility modes (x_compatibility). */
/* Mode fixtures: interface *elements* named exactly by their datatype text. */
const MODES=`ddn "0.5";
module "test.soaml.modes";
data m {
    object req "BillingSmall" { kind: "uml.interface"; fields { field charge "charge()"; } }
    object svc "BillingFull" { kind: "uml.interface"; fields { field charge "charge()"; field refund "refund()"; } }
    object shop "Shop" { kind: "soaml.participant";
        ports { port billing { direction: out; x_service: { kind: "request" }; datatype: "BillingSmall"; } }
    }
    object prov "Provider" { kind: "soaml.participant";
        ports { port api { direction: in; x_service: { kind: "service" }; datatype: "BillingFull"; } }
    }
    relation a1 "" @shop.billing -> @prov.api { kind: "uml.assembly"; x_compatibility: { mode: "operation-coverage" }; }
}
view arch "A" { data: [@m]; projection { kind: graph; profile: "soaml.services@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const runModes=changes=>A.createWorkspace({'main.ddn':MODES,...changes}).renderSync({entry:'main.ddn',view:'arch'});
const medit=(before,after)=>{assert.ok(MODES.includes(before),'Mutation target missing: '+before);return{'main.ddn':MODES.replace(before,after)};};
test('absent mode keeps the strict same-type rule (byte-identical default)',()=>{
 throws(()=>run('arch',edit('x_service: { kind: "request" }; datatype: "Billing"','x_service: { kind: "request" }; datatype: "BillingSub"')),'DDN-PJ196');});
test('operation-coverage: request operations covered by the service interface pass',()=>{
 assert.match(runModes().svg,/<svg/);});
test('operation-coverage: a missing operation fails (DDN-PJ196)',()=>{
 throws(()=>runModes(medit('field charge "charge()"; field refund','field refund')),'DDN-PJ196');});
test('operation-coverage: interfaces must name model elements (DDN-PJ196)',()=>{
 throws(()=>runModes(medit('datatype: "BillingFull"; } }','datatype: "BillingOther"; } }')),'DDN-PJ196');});
test('specialization mode: passes with a generalization from service type to request type',()=>{
 const r=runModes(medit('relation a1 "" @shop.billing -> @prov.api { kind: "uml.assembly"; x_compatibility: { mode: "operation-coverage" }; }','relation g1 "" @svc -> @req { kind: "uml.generalization"; }\n    relation a1 "" @shop.billing -> @prov.api { kind: "uml.assembly"; x_compatibility: { mode: "specialization" }; }'));
 assert.match(r.svg,/<svg/);});
test('specialization mode without the generalization fails (DDN-PJ196)',()=>{
 throws(()=>runModes(medit('x_compatibility: { mode: "operation-coverage" }; }','x_compatibility: { mode: "specialization" }; }')),'DDN-PJ196');});
test('realization mode: uses uml.realization evidence',()=>{
 const r=runModes({'main.ddn':MODES.replace('object svc "BillingFull" { kind: "uml.interface";','object svc "BillingFull" { kind: "uml.class";').replace('relation a1 "" @shop.billing -> @prov.api { kind: "uml.assembly"; x_compatibility: { mode: "operation-coverage" }; }','relation g1 "" @svc -> @req { kind: "uml.realization"; }\n    relation a1 "" @shop.billing -> @prov.api { kind: "uml.assembly"; x_compatibility: { mode: "realization" }; }')});
 assert.match(r.svg,/<svg/);});
test('realization mode without the realization fails (DDN-PJ196)',()=>{
 throws(()=>runModes(medit('x_compatibility: { mode: "operation-coverage" }; }','x_compatibility: { mode: "realization" }; }')),'DDN-PJ196');});
test('x_compatibility on a non-connector relation fails (DDN-PJ196)',()=>{
 throws(()=>run('arch',edit('relation cap1 "" @billing -> @cap { kind: "uml.realization"; }','relation cap1 "" @billing -> @cap { kind: "uml.realization"; x_compatibility: { mode: "same" }; }')),'DDN-PJ196');});

const failed=results.filter(r=>!r.pass);
console.log('soaml-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
