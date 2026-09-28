/* SPDX-License-Identifier: GPL-2.0-or-later. B1-080: ORM 2 (ISO/IEC 19507) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.orm";
data m {
    object cust "Customer" { kind: "orm.entitytype"; }
    object name "Name" { kind: "orm.valuetype"; x_values: { values: [ "short", "full" ]; }; }
    object has "has / is of" { kind: "orm.facttype";
        fields {
            field who { x_role: { mandatory: true }; }
            field what { x_role: { uniqueness: true }; }
        }
        x_derive: { text: "from CRM extract" };
    }
    object vip "VIP customer" { kind: "orm.entitytype"; }
    object viporder "priority order" { kind: "orm.facttype";
        fields { field v; field o; }
        x_objectified: { name: "PriorityOrder" };
    }
    relation p1 "" @has.who -> @cust { kind: "orm.plays"; }
    relation p2 "" @has.what -> @name { kind: "orm.plays"; }
    relation s1 "" @vip -> @cust { kind: "orm.subset"; }
    relation x1 "" @viporder -> @has { kind: "orm.exclusion"; }
}
view model "Model" { data: [@m]; projection { kind: graph; profile: "orm.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='model',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('entity types solid ellipse, value type dashed ellipse with value constraint',()=>{const r=run();
 assert.ok(r.svg.includes('data-shape="ellipse"'),'ellipse missing');
 assert.ok(r.svg.includes('ddn-orm-values')&&r.svg.includes('{short, full}'),'value constraint missing');});
test('fact type renders the role-box predicate row with uniqueness bar and mandatory dot',()=>{const r=run();
 assert.ok(r.svg.includes('has.who')&&r.svg.includes('has.what'),'role boxes missing');
 assert.ok(r.svg.includes('data-uniqueness'),'uniqueness bar missing');
 assert.ok(r.svg.includes('data-mandatory'),'mandatory dot missing');});
test('objectification frame and derivation text render',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-objectified')&&r.svg.includes('PriorityOrder'),'objectification missing');
 assert.ok(r.svg.includes('ddn-orm-derive')&&r.svg.includes('* from CRM extract'),'derivation missing');});
test('subset and exclusion constraint arcs render (exclusion as circled X)',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-verb-ormsubset'),'subset arc missing');
 assert.ok(r.svg.includes('M-12 -3L-6 3M-6 -3L-12 3'),'exclusion circled-X missing');});
test('n-ary fact type: three roles play to three types',()=>{
 const mut={'main.ddn':SRC.replace('fields { field v; field o; }','fields { field v; field o; field w; }').replace('relation s1','relation p3 "" @viporder.w -> @name { kind: "orm.plays"; }\n    relation s1')};
 const r=run('model',mut);
 assert.ok(r.svg.includes('viporder.w'),'n-ary role missing');});
test('x_role on a non-facttype field (DDN-PJ204)',()=>{
 throws(()=>run('model',edit('object cust "Customer" { kind: "orm.entitytype"; }','object cust "Customer" { kind: "orm.entitytype"; fields { field f { x_role: { mandatory: true }; } } }')),'DDN-PJ204');});
test('x_values on a non-valuetype (DDN-PJ204)',()=>{
 throws(()=>run('model',edit('object cust "Customer" { kind: "orm.entitytype"; }','object cust "Customer" { kind: "orm.entitytype"; x_values: { values: [ "a" ]; }; }')),'DDN-PJ204');});
test('fact type without role boxes under the profile (DDN-PJ204)',()=>{
 throws(()=>run('model',edit('fields { field v; field o; }','')),'DDN-PJ204');});
test('plays must target entity/value types (endpoint contract DDN102)',()=>{
 throws(()=>run('model',edit('relation p2 "" @has.what -> @name','relation p2 "" @has.what -> @has')),'DDN102');});

const failed=results.filter(r=>!r.pass);
console.log('orm-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
