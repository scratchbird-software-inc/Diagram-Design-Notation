/* SPDX-License-Identifier: GPL-2.0-or-later. Allowlisted SQL DDL export (export format sql): golden, mapping, gates, and JSON regression. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('../runtime/ddn-core'),X=require('../runtime/ddn-export'),reg=require('../../standard/registry/catalogue.json');
const dir=path.resolve(__dirname,'../../examples/basics'),FILE='38-sql-ddl-export.ddn';
const base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const GOLDEN=fs.readFileSync(path.resolve(__dirname,'fixtures/sql-ddl-export.sql'),'utf8');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
const build=(text,view='publish')=>D.build({...base,[FILE]:text},FILE,view,reg).ir;
const ir=build(base[FILE]);
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const edit=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return base[FILE].replace(before,after);};
test('Golden: serialize(ir) equals the checked-in SQL fixture byte-for-byte',()=>assert.equal(X.serialize(ir),GOLDEN));
test('Output carries the FK line and both -- skipped: audit comments',()=>{const out=X.serialize(ir);
 assert.ok(out.includes('FOREIGN KEY (customer_id) REFERENCES customer(customer_id)'));
 assert.ok(out.includes('-- skipped: ddn.examples.sql-ddl::shop.note (kind note is not table)'));
 assert.ok(out.includes('-- skipped: ddn.examples.sql-ddl::shop.note_customer (endpoint is not an exported table)'));});
test('JSON path regression: a view without format serializes identically to project()+JSON.stringify',()=>{
 const f={'14-authorized-export.ddn':fs.readFileSync(dir+'/14-authorized-export.ddn','utf8'),'shared.ddn':base['shared.ddn']};
 const jir=D.build(f,'14-authorized-export.ddn','public',reg).ir;
 assert.equal(jir.view.profiles.export.format,'json','format default must be json');
 assert.equal(X.serialize(jir),JSON.stringify(X.project(jir),null,2)+'\n');});
test('Table-less allowlist (note only, no fields) throws DDN-PJ088',()=>{
 const text=edit('elements: [@shop.customer, @shop.purchase, @shop.note];','elements: [@shop.note];').replace(/fields: \[[^\]]*\];/,'fields: [];');
 throws(()=>X.serialize(build(text)),'DDN-PJ088');});
test('mode: full with format: sql throws DDN150',()=>throws(()=>X.serialize(build(edit('mode: redacted;','mode: full;'))),'DDN150'));
test('include_samples: true with format: sql throws DDN154',()=>throws(()=>X.serialize(build(edit('mode: redacted;','mode: redacted;\n  include_samples: true;'))),'DDN154'));
test('Two tables normalizing to the same snake identifier throw DDN-PJ092 naming the identifier',()=>{
 const src='ddn "0.3";\nmodule "test.sql-collision";\ndata m {\n object a "Order Line" { kind: table; fields { field id; } }\n object b "order-line" { kind: table; fields { field id; } }\n}\nview v {\n data: [@m];\n export { mode: redacted; format: sql; elements: [@m.a, @m.b]; fields: [@m.a.id, @m.b.id]; properties: [kind]; }\n publication {size: content; fit: none; overflow: error;}\n}\n';
 assert.throws(()=>X.serialize(D.build({'mini.ddn':src},'mini.ddn','v',reg).ir),e=>e.code==='DDN-PJ092'&&/order_line/.test(e.message));});
test('format: yaml is rejected by CHOICES validation at build time',()=>{
 let code;try{build(edit('format: sql;','format: yaml;'));}catch(e){code=e.code;}
 assert.ok(typeof code==='string','build must throw a coded error');console.log('  format:yaml rejection code:',code);});
test('Without key in properties allowlist no PRIMARY KEY lines are emitted',()=>{
 const out=X.serialize(build(edit('properties: [kind, key];','properties: [kind];')));
 assert.ok(!out.includes('PRIMARY KEY'),'PK must be gated on the key property allowlist');
 assert.ok(out.includes('CREATE TABLE customer ('));});
test('enforcement: undecided replaces the FK line with an enforcement skipped comment',()=>{
 const out=X.serialize(build(edit('enforcement: database;','enforcement: undecided;')));
 assert.ok(!out.includes('FOREIGN KEY'),'FK must require enforcement: database');
 assert.ok(out.includes('-- skipped: ddn.examples.sql-ddl::shop.purchase_customer (enforcement is not "database")'));});
test('Determinism: two serializations are byte-identical',()=>assert.equal(X.serialize(ir),X.serialize(build(base[FILE]))));
const passed=results.filter(r=>r.pass).length;console.log(`SQL export ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
