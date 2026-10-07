/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 assertion evaluation
 * (0.9 closure, spec ch. 55 §55.2 amendment): structured assertion elements
 * evaluate read-only against the resolved model — contradiction is a DDN-AS01
 * warning (never a failure, never evidence), subject resolution DDN-AS02,
 * record shape DDN-AS03; undecided/not_applicable carried not judged;
 * confidence/observed_at carried not judged. Inert string assertions stay
 * inert. */
'use strict';
const DDN=require('../runtime/ddn-core.js').default;
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const MODEL='data m {\n object order "Order" { kind: cache; maturity: approved; fields { total { datatype: money; } }\n }\n relation pay @order -> @order { kind: flow; }\n ASSERTION\n}\n';
const build=a=>DDN.build({'m.ddn':'ddn "0.6";\nmodule "m";\n'+MODEL.replace(' ASSERTION',a?(' assertion a1 { '+a+' }'):'')+'\nview v { data: [@m]; }'},'m.ddn','v',reg).ir;
const codes=a=>build(a).diagnostics.map(d=>d.code);
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};

test('satisfied assertion is silent; contradiction is a DDN-AS01 warning',()=>{
 assert.deepEqual(codes('subject: @order; property: maturity; value: approved;'),[]);
 const diags=build('subject: @order; property: maturity; value: draft;').diagnostics;
 const d=diags.find(x=>x.code==='DDN-AS01');
 assert.ok(d&&d.severity==='warning'&&/contradicted/.test(d.message)&&/draft/.test(d.message),'warning names the contradiction: '+d?.message);
});

test('subjects: elements, fields and relations resolve; non-model targets are DDN-AS02',()=>{
 assert.deepEqual(codes('subject: @order.total; property: datatype; value: money;'),[],'field subject');
 assert.deepEqual(codes('subject: @pay; property: kind; value: flow;'),[],'relation subject');
 assert.equal(code(()=>build('subject: @m; property: maturity; value: draft;')),'DDN-AS02','data block is not a model member');
});

test('carried not judged: undecided/not_applicable skip evaluation; confidence/observed_at ride along',()=>{
 assert.deepEqual(codes('subject: @order; property: maturity; value: draft; state: undecided;'),[],'undecided not judged');
 assert.deepEqual(codes('subject: @order; property: maturity; value: approved; basis: observed; source: "audit-2026-09"; observed_at: "2026-09-30T14:00:00Z"; confidence: 0.9;'),[],'full record evaluates clean');
});

test('DDN-AS03 shape: subject/property/value required; enums; source rule; offset rule',()=>{
 assert.equal(code(()=>build('property: maturity; value: draft;')),'DDN-AS03','no subject');
 assert.equal(code(()=>build('subject: @order; value: draft;')),'DDN-AS03','no property');
 assert.equal(code(()=>build('subject: @order; property: maturity;')),'DDN-AS03','no value');
 assert.equal(code(()=>build('subject: @order; property: maturity; value: draft; basis: guessed;')),'DDN-AS03','bad basis');
 assert.equal(code(()=>build('subject: @order; property: maturity; value: draft; state: "wishful";')),'DDN-AS03','bad state');
 assert.equal(code(()=>build('subject: @order; property: maturity; value: draft; basis: observed;')),'DDN-AS03','observed without source');
 assert.equal(code(()=>build('subject: @order; property: maturity; value: draft; confidence: 1.5;')),'DDN-AS03','confidence out of range');
 assert.equal(code(()=>build('subject: @order; property: maturity; value: draft; observed_at: "2026-09-30T14:00:00";')),'DDN-AS03','offset-less instant');
});

test('comparison: quantities in px, absent properties contradict, no evaluation of inert strings',()=>{
 const diags=build('subject: @order; property: missing_thing; value: 1;').diagnostics;
 assert.ok(diags.some(d=>d.code==='DDN-AS01'&&/absent/.test(d.message)),'absent property contradicts an asserted value');
 const diags2=build(null).diagnostics;
 assert.ok(!diags2.some(d=>d.code.startsWith('DDN-AS')),'no assertion elements → no assertion diagnostics');
 const inert=DDN.build({'m.ddn':'ddn "0.6";\nmodule "m";\ndata m { object order "Order" { kind: cache; } relation pay @order -> @order { kind: flow; assertion: "every order posts exactly one ledger entry — inert text"; } }\nview v { data: [@m]; assertions: ["unverifiable natural-language claim"]; }'},'m.ddn','v',reg).ir;
 assert.ok(!inert.diagnostics.some(d=>d.code.startsWith('DDN-AS')),'inert string assertions never evaluate');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' assertion-eval tests passed');
