/* SPDX-License-Identifier: GPL-2.0-or-later. Workspace editing preserves identities, references and unrelated source. */
'use strict';
const assert=require('node:assert/strict'),A=require('../dist/ddn.global'),M=require('../tool/src/workspace-model');
const fixture={
 'model.ddn':'ddn "0.7";module "sales"; data model { object customer "Customer"; object order "Order"; relation buys @customer -> @order; }',
 'other.ddn':'ddn "0.7";module "other"; data model {object supplier "Supplier";} ',
 'formats.ddn':'ddn "0.7";module "shared";format styles {layout normal {direction:right;}}',
 'views.ddn':'ddn "0.7";import "model.ddn" as m;import "formats.ddn" as f;module "views";view overview "Overview" {data:[@m.model];layout:@f.styles.normal; publication {size:content;}}view detail {data:[@m.model];select:[@m.model.customer];publication {size:content;}}'
};
const validate=files=>{const w=A.createWorkspace(files);try{for(const v of M.index(files,A).views)w.renderSync({entry:v.file,view:v.uid});}finally{w.destroy();}};
let idx=M.index(fixture,A),v=idx.views[0],data=idx.items.find(x=>x.uid==='sales::model');validate(fixture);
assert.equal(M.resolveRef(idx,v,v.node.props.data[0]).key,data.key);
let next=M.rename(fixture,data,'renamed',A);validate(next);assert.ok(next['views.ddn'].includes('@m.renamed.customer'));assert.equal(next['other.ddn'],fixture['other.ddn']);
const dup=M.createView(fixture,{file:'views/new.ddn',module:'new_views',id:'third',label:'Third',copy:v},A);validate(dup.files);assert.equal(dup.files['model.ddn'],fixture['model.ddn']);assert.ok(dup.files['views/new.ddn'].includes('../model.ddn'));
const blocks=idx.items.filter(x=>x.type==='data');next=M.bind(fixture,v,blocks,[],A);validate(next);assert.equal(A.createWorkspace(next).resolve('views.ddn','overview').elements.length,3);assert.equal(A.createWorkspace(next).resolve('views.ddn','overview').view.selected.length,0);
assert.throws(()=>M.remove(fixture,data,A),/referenced/);
const multi={'m.ddn':'ddn "0.7";module "a";data m{}view same{data:[@m];}module "b";data m{}view same{data:[@m];}'};idx=M.index(multi,A);assert.deepEqual(idx.views.map(x=>x.view),['a::same','b::same']);validate(multi);
console.log('Workspace model: references, shared data, cross-file view copies, guarded deletion, module-qualified views passed');

const withRules={...fixture,'rules.ddna':'ddn "0.7";module "rules";data rules {object profile {x_profile:{nodes:[{id:"decide";target:"sales::model.customer";}];};}}'};
const original=M.index(withRules,A).items.find(x=>x.uid==='sales::model.customer');
const renamed=M.rename(withRules,original,'client',A);assert.equal(A.parse(renamed['rules.ddna'],'rules.ddna').declarations[0].children[0].props.x_profile.nodes[0].target,'sales::model.client');
assert.throws(()=>M.remove(withRules,original,A),/referenced/);
const leaf=M.index(fixture,A).items.find(x=>x.uid==='sales::model.order');const multiple=M.props(fixture,leaf,{description:'Exact text',kind:'entity'},A);validate(multiple);assert.equal(M.find(M.index(multiple,A),leaf).node.props.description,'Exact text');
console.log('PASS schema-defined DDNA identities and multi-property leaf edits');
