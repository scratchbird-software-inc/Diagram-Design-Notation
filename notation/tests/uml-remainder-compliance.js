/* SPDX-License-Identifier: GPL-2.0-or-later. B1-061 (RFC-125): UML 2.5.1 remainder fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.rem";

data obj {
    object customer "Customer" { kind: "uml.class";
        fields { field customer_id { datatype: "string"; } field age { datatype: "number"; } }
    }
    object ada "ada : Customer" { kind: record; x_instance: { classifier: @obj.customer; };
        fields { field customer_id "C-1001"; field age "41"; }
    }
    object bob "bob : Customer" { kind: record; x_instance: { classifier: @obj.customer; };
        fields { field customer_id "C-1002"; field age "36"; }
    }
    relation link1 "knows" @ada -> @bob { kind: "uml.link"; x_endlabels: { source: { multiplicity: "0..*"; }; target: { multiplicity: "1"; }; }; }
}

data pkg {
    object shop "shop" { kind: "uml.package"; }
    object core "core" { kind: "uml.package"; }
    object domain_model "Domain model" { kind: "uml.class"; x_pack: { visibility: public; }; }
    object helper "Helper" { kind: "uml.class"; x_pack: { visibility: private; }; }
    relation imp "" @shop -> @core { kind: "uml.import"; }
}

data prof {
    object meta "Classifier" { kind: "uml.metaclass"; }
    object stereo "Audited" { kind: "uml.stereotype";
        fields { field audited_by { x_member: { kind: attribute; }; } }
    }
    object base_pkg "base" { kind: "uml.package"; }
    object applied_pkg "shop" { kind: "uml.package"; }
    relation ext "" @stereo -> @meta { kind: "uml.extension"; }
    relation app "" @applied_pkg -> @base_pkg { kind: "uml.application"; }
}

data comm {
    object ui "UI" { kind: application; }
    object svc "Service" { kind: service; }
    relation m1 "request" @ui -> @svc { kind: "uml.message"; x_message: { seq: "1"; time: "{t1}"; };
        x_fragment: { operator: alt; operands: [ { guard: "ok"; messages: [@comm.m1]; }, { guard: "else"; messages: [@comm.m2]; } ] };
    }
    relation m2 "fail" @svc -> @ui { kind: "uml.message"; x_message: { seq: "2"; duration: "{0..2s}"; }; }
}

data io {
    object start "Start" { kind: "flow.start"; }
    object pay "Pay" { kind: "flow.process"; x_subdiagram: { view: "detail" };
        x_use: { arguments: [ "order" ]; gates: [ "in", "out" ]; };
    }
    object end "End" { kind: "flow.end"; }
    relation t1 "" @start -> @pay { kind: "flow.next"; }
    relation t2 "" @pay -> @end { kind: "flow.next"; }
}
data detail_data {
    object a "Authorize" { kind: "flow.process"; }
    object b "Capture" { kind: "flow.process"; }
    relation ab "" @a -> @b { kind: "flow.next"; }
}

data tim {
    object bus "Bus" { kind: service;
        x_timeconstraint: [ "{0..40}" ];
        x_states: [ { at: 0; state: "idle"; }, { at: 10; state: "idle"; }, { at: 20; state: "busy"; duration: "{20..30}"; } ];
    }
    object card "Card" { kind: application;
        x_states: [ { at: 5; state: "out"; slew: "{2}"; }, { at: 25; state: "in"; } ];
    }
    relation tm "swipe" @card -> @bus { kind: "uml.message"; x_message: { at: 15 }; }
}

data uc {
    object sys "Shop" { kind: "uml.subject"; }
    object buyer "Buyer" { kind: "uml.actor"; }
    object checkout "Checkout" { kind: "uml.usecase"; x_usecase: { subjects: [@uc.sys]; extension_points: [ "payment" ]; }; }
    object rush "Rush order" { kind: "uml.usecase"; x_usecase: { subjects: [@uc.sys]; }; }
    relation u1 "" @buyer -> @checkout { kind: "uml.uses"; }
    relation u2 "rush extends" @rush -> @checkout { kind: "uml.extend"; x_usecase: { extension_point: "payment"; condition: "basket > 200"; }; }
}

view objects "Objects" { data: [@obj]; projection { kind: graph; profile: "uml.object@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view packages "Packages" { data: [@pkg]; projection { kind: graph; profile: "uml.structure@2"; } frame shopf "shop" { scope: @pkg.shop; members: [@pkg.domain_model, @pkg.helper]; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view profiles "Profile diagram" { data: [@prof]; projection { kind: graph; profile: "uml.profile@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view comms "Communication" { data: [@comm]; projection { kind: graph; profile: "uml.communication@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view overview "IO" { data: [@io]; projection { kind: graph; profile: "uml.interaction_overview@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 6pt; } }
view detail "Pay detail" { data: [@detail_data]; projection { kind: graph; profile: "ddn@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 6pt; } }
view timing "Timing" { data: [@tim]; projection { kind: timing; profile: "uml.timing@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 6pt; } }
view usecases "Use cases" { data: [@uc]; projection { kind: graph; profile: "uml.usecase@3"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view,changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('(a) uml.object@2: underlined instance titles, link multiplicity end labels',()=>{const r=run('objects');
 assert.ok(r.svg.includes('text-decoration="underline"'),'instance underline missing');
 assert.ok(r.svg.includes('0..*')&&r.svg.includes('ddn-endlabel-multiplicity'),'link multiplicity missing');});
test('(a) slot datatype checking rejects a non-numeric number slot (DDN-PJ170)',()=>{
 throws(()=>run('objects',edit('field age "41";','field age "forty-one";')),'DDN-PJ170');});
test('(b) package import/access/merge + visibility prefixes render',()=>{const r=run('packages');
 for(const s of ['«import»','>+ Domain model','>− Helper'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('(b) x_pack.visibility outside a package frame is DDN-PJ171',()=>{
 throws(()=>run('packages',edit('frame shopf "shop" { scope: @pkg.shop; members: [@pkg.domain_model, @pkg.helper]; }','frame shopf "shop" { scope: @pkg.shop; members: []; }')),'DDN-PJ171');});
test('(f) uml.profile@1: «metaclass»/«stereotype» compartments, extension filled triangle, «apply»',()=>{const r=run('profiles');
 for(const s of ['«metaclass»','«stereotype»','«apply»'])assert.ok(r.svg.includes(s),'missing: '+s);
 assert.ok(r.svg.includes('M0 0L-12 -7L-12 7Z'),'extension arrowhead missing');
 assert.ok(/ddn-verb-ext/.test(r.svg));});
test('(f) extension endpoints are stereotype → metaclass (DDN102)',()=>{
 throws(()=>run('profiles',edit('relation ext "" @stereo -> @meta','relation ext "" @meta -> @stereo')),'DDN102');});
test('(c) uml.communication@2: fragment frame with pentagon + {…} constraints',()=>{const r=run('comms');
 assert.ok(r.svg.includes('ddn-fragment-alt'),'fragment frame missing');
 assert.ok(r.svg.includes('[ok]')&&r.svg.includes('[else]'),'operand guards missing');
 assert.ok(r.svg.includes('{t1}')&&r.svg.includes('{0..2s}'),'constraints missing');});
test('(c) fragment references must resolve to visible messages (DDN-PJ172)',()=>{
 throws(()=>run('comms',edit('messages: [@comm.m2]; } ] };','messages: [@obj.link1]; } ] };')),'DDN-PJ172');});
test('(c) malformed constraint form is DDN-PJ172',()=>{
 throws(()=>run('comms',edit('time: "{t1}"','time: "t1"')),'DDN-PJ172');});
test('(d) uml.interaction_overview@2: inline expansion + gates + arguments',()=>{const r=run('overview');
 assert.ok(r.svg.includes('ddn-io-inline'),'inline expansion missing');
 assert.ok(r.svg.includes('Authorize'),'child content missing');
 assert.ok((r.svg.match(/ddn-io-gate/g)||[]).length===2,'gates missing');
 assert.ok(r.svg.includes('(order)'),'arguments missing');});
test('(d) duplicate gate names are DDN-PJ174',()=>{
 throws(()=>run('overview',edit('gates: [ "in", "out" ];','gates: [ "in", "in" ];')),'DDN-PJ174');});
test('(e) uml.timing@2: annotations, constraints, compaction, lifeline messages',()=>{const r=run('timing');
 assert.ok(r.svg.includes('ddn-timing-annotation'),'annotations missing');
 assert.ok(r.svg.includes('ddn-timing-constraint'),'constraint missing');
 assert.ok(r.svg.includes('ddn-timing-message'),'lifeline message missing');
 assert.ok(r.svg.includes('{20..30}')&&r.svg.includes('{2}'));});
test('(e) malformed timing annotation/anchor is DDN-PJ173',()=>{
 throws(()=>run('timing',edit('duration: "{20..30}"','duration: "20..30"')),'DDN-PJ173');
 throws(()=>run('timing',edit('x_message: { at: 15 };','x_message: { };')),'DDN-PJ173');});
test('(g) uml.usecase@3: extend condition renders on the edge label',()=>{const r=run('usecases');
 assert.ok(r.svg.includes('rush extends {basket &gt; 200}'),'condition label missing');});
test('predecessor profiles still installed (object@1, communication@1, timing@1, io@1, usecase@2)',()=>{
 const Profiles=require('../runtime/ddn-profiles.js').default;
 for(const id of ['uml.object@1','uml.communication@1','uml.timing@1','uml.interaction_overview@1','uml.usecase@2'])assert.ok(Profiles.get(id),'missing '+id);});

const failed=results.filter(r=>!r.pass);
console.log('uml-remainder-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
