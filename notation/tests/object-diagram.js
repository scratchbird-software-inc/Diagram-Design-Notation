/* SPDX-License-Identifier: GPL-2.0-or-later. Object profile (uml.object@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.object";

data model {
    object customer "Customer" { kind: "uml.class";
        fields { field customer_id { datatype: "string"; } field name { datatype: "string"; } }
    }
    object order "Order" { kind: "uml.class";
        fields { field order_id { datatype: "string"; } field total { datatype: "number"; } }
    }
    object sample_customer "sample_customer : Customer" {
        kind: record; x_instance: { classifier: @model.customer; };
        fields { field customer_id "C-1001"; field name "Ada Example"; }
    }
    object sample_order "sample_order : Order" {
        kind: record; x_instance: { classifier: @model.order; };
        fields { field order_id "O-4711"; field total "129.50"; }
    }
    relation placed "Placed" @sample_customer -> @sample_order { kind: assoc; }
}

view objects "Synthetic snapshot / objects" {
    data: [@model];
    projection { kind: graph; profile: "uml.object@1"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const SHARED=`ddn "0.5";
module "test.object.shared";

data types {
    object order "Order" { kind: "uml.class";
        fields { field order_id { datatype: "string"; } field total { datatype: "number"; } }
    }
}
`;
const IMPORTED=`ddn "0.5";
module "test.object.imported";

import "shared.ddn" as shared;

data model {
    object sample_order "sample_order : Order" {
        kind: record; x_instance: { classifier: @shared.types.order; };
        fields { field order_id "O-4711"; field total "129.50"; }
    }
}

view objects "Imported classifier / objects" {
    data: [@model];
    projection { kind: graph; profile: "uml.object@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='objects'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const id=s=>'test.object::model.'+s;
test('Instances render as record cards with their slot rows; scene nodes carry source ids',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.kind,'graph');assert.equal(r.profiles.projection.profile,'uml.object@1');
 for(const s of ['sample_customer : Customer','sample_order : Order','C-1001','Ada Example','O-4711','129.50'])assert.ok(r.svg.includes(s),'slot/instance text missing: '+s);
 assert.ok(r.svg.includes('>Placed<'),'assoc link label missing');
 const ids=[...r.scene.nodes.map(n=>n.id),...r.scene.routes.map(x=>x.id)];
 for(const s of ['customer','order','sample_customer','sample_order','placed'])assert.ok(ids.includes(id(s)),'scene nodes missing source id '+s);
 for(const n of r.scene.nodes.filter(n=>/sample_/.test(n.id)))assert.ok(n.fieldRows.length===2,'instance node missing slot rows: '+n.id);});
test('Classifier in an imported module resolves; matching slots pass DDN-PJ112',()=>{
 const r=A.createWorkspace({'main.ddn':IMPORTED,'shared.ddn':SHARED}).renderSync({entry:'main.ddn',view:'objects'});
 assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('O-4711'),'slot row missing with imported classifier');});
test('Classifier with no fields skips the slot check and renders',()=>{
 const r=run(edit('object order "Order" { kind: "uml.class";\n        fields { field order_id { datatype: "string"; } field total { datatype: "number"; } }\n    }',
  'object order "Order" { kind: "uml.class"; }'));
 assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('O-4711'),'slot row missing under fieldless classifier');});
test('Slot not present on the classifier is rejected as DDN-PJ112',()=>{
 throws(()=>run(edit('field total "129.50";','field ttoal "129.50";')),'DDN-PJ112');});
test('x_instance without a classifier is a contract failure DDN105',()=>{
 throws(()=>run(edit('x_instance: { classifier: @model.customer; };','x_instance: {};')),'DDN105');});
test('Unregistered extension typo fails DDN103 in strict mode and warns DDN-W103 in logical mode',()=>{
 const typo=edit('x_instance: { classifier: @model.customer; };','x_instnce: { classifier: @model.customer; };');
 typo['main.ddn']=typo['main.ddn'].replace('publication { size: content','validation { mode: strict; } publication { size: content');
 throws(()=>run(typo),'DDN103');
 const r=run(edit('x_instance: { classifier: @model.order; };','x_instnce: { classifier: @model.order; };'));
 const d=(r.diagnostics||r.ir?.diagnostics||[]).find(d=>d.code==='DDN-W103');
 assert.ok(d,'DDN-W103 diagnostic missing in logical mode');assert.equal(d.severity,'warning');});
test('Deterministic byte-identical rerender',()=>assert.equal(sha(run().svg),sha(run().svg)));
const failed=results.filter(r=>!r.pass);
for(const r of results)if(r.pass)console.log('PASS',r.name);
console.log('Object diagram '+results.filter(r=>r.pass).length+'/'+results.length);
if(failed.length)process.exitCode=1;
