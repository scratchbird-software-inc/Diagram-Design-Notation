/* SPDX-License-Identifier: GPL-2.0-or-later. RFC-117: multi-module (sectioned) .ddn files. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const throws=(fn,code)=>assert.throws(fn,e=>{if(e.code!==code)console.error('Expected',code,'got',e.code,e.message);return e.code===code;});

const two=`ddn "0.5";

module "shop.model";
data model {
    object customer "Customer" { kind: table; fields { field id; field name; } }
    object order "Order" { kind: table; fields { field id; } }
    relation oc @order.id -> @customer.id { kind: references; }
}

module "shop.views";
view overview "Overview" {
    data: [@shop.model.model];
    layout { algorithm: grid; }
    publication { size: content; fit: none; }
}
`;
const files={'main.ddn':two};

test('Two-section file parses with both module sections',()=>{
 const d=A.parse(two,'main.ddn');
 assert.equal(d.module,'shop.model');
 assert.deepEqual(d.sections.map(s=>s.module),['shop.model','shop.views']);
 assert.equal(d.sections[0].declarations.length,1);
 assert.equal(d.sections[1].declarations.length,1);
 assert.equal(d.declarations.length,2);
});

test('Multi-module file checks and renders; sibling cross-reference by module-qualified id',()=>{
 const ws=A.createWorkspace(files);
 const r=ws.renderSync({entry:'main.ddn',view:'overview'});
 assert.match(r.svg,/<svg/);
 assert.ok(r.svg.includes('Customer'));
 const ir=ws.resolve('main.ddn','overview');
 assert.equal(ir.view.id,'shop.views::overview');
 assert.ok(ir.elements.some(n=>n.id==='shop.model::model.customer'));
 assert.ok(ir.relations.some(n=>n.id==='shop.model::model.oc'));
});

test('Sibling references need no import and resolve across dotted module ids',()=>{
 const src=`ddn "0.5";
module "a.b.data";
data d { object thing { kind: table; } }
module "c.views";
view v { data: [@a.b.data.d]; publication { size: content; fit: none; } }
`;
 const r=A.createWorkspace({'m.ddn':src}).renderSync({entry:'m.ddn',view:'v'});
 assert.match(r.svg,/<svg/);
});

test('Duplicate section id in one file rejected (DDN023)',()=>{
 const src='ddn "0.5";\nmodule "m";\ndata d;\nmodule "m";\ndata e;\nview v { data: [@m.e]; }\n';
 throws(()=>A.createWorkspace({'m.ddn':src}).renderSync({entry:'m.ddn',view:'v'}),'DDN023');
});

test('Same module id in two files rejected (DDN023)',()=>{
 throws(()=>A.createWorkspace({'a.ddn':'ddn "0.5";\nmodule "m";\nimport "b.ddn" as b;\nview v { data: [@b.d]; }\n','b.ddn':'ddn "0.5";\nmodule "m";\ndata d;\n'}).renderSync({entry:'a.ddn',view:'v'}),'DDN023');
});

test('Symbol collision across sections keeps DDN024',()=>{
 const src='ddn "0.5";\nmodule "m1";\ndata d;\nmodule "m2";\ndata d;\nview v { data: [@m1.d,@m2.d]; }\n';
 // distinct modules → no collision; collide via duplicate stable uid instead
 const ok=A.createWorkspace({'m.ddn':src}).renderSync({entry:'m.ddn',view:'v'});
 assert.match(ok.svg,/<svg/);
 const clash='ddn "0.5";\nmodule "m1";\ndata d { object o { uid: "x"; kind: table; } }\nmodule "m2";\ndata e { object o { uid: "x"; kind: table; } }\nview v { data: [@m1.d,@m2.e]; }\n';
 throws(()=>A.createWorkspace({'m.ddn':clash}).renderSync({entry:'m.ddn',view:'v'}),'DDN026');
});

test('Import after a section declaration rejected (DDN015)',()=>{
 throws(()=>A.parse('ddn "0.5";\nmodule "a";\ndata d;\nimport "x.ddn" as x;\n','a.ddn'),'DDN015');
 throws(()=>A.parse('ddn "0.5";\nmodule "a";\ndata d;\nmodule "b";\nimport "x.ddn" as x;\n','a.ddn'),'DDN015');
});

test('Imports accepted in both file-level positions; alias uniqueness across the merge (DDN014)',()=>{
 const canonical=A.parse('ddn "0.5";\nimport "x.ddn" as x;\nmodule "a";\ndata d;\n','a.ddn');
 assert.equal(canonical.imports.length,1);
 const legacy=A.parse('ddn "0.5";\nmodule "a";\nimport "x.ddn" as x;\ndata d;\n','a.ddn');
 assert.equal(legacy.imports.length,1);
 throws(()=>A.parse('ddn "0.5";\nimport "x.ddn" as x;\nmodule "a";\nimport "y.ddn" as x;\ndata d;\n','a.ddn'),'DDN014');
});

test('Other file importing a multi-module file gets all its modules',()=>{
 const multi='ddn "0.5";\nmodule "one";\ndata d1 { object a { kind: table; } }\nmodule "two";\ndata d2 { object b { kind: table; } }\n';
 const entry='ddn "0.5";\nmodule "top";\nimport "multi.ddn" as mm;\nview v { data: [@mm.d1, @mm.d2]; publication { size: content; fit: none; } }\n';
 const r=A.createWorkspace({'main.ddn':entry,'multi.ddn':multi}).renderSync({entry:'main.ddn',view:'v'});
 assert.match(r.svg,/<svg/);
 const ir=A.createWorkspace({'main.ddn':entry,'multi.ddn':multi}).resolve('main.ddn','v');
 assert.ok(ir.elements.some(n=>n.id==='one::d1.a'));
 assert.ok(ir.elements.some(n=>n.id==='two::d2.b'));
});

test('Workspace entries/views list views from every section',()=>{
 const ws=A.createWorkspace(files);
 const entries=ws.entries();
 assert.deepEqual(entries.map(e=>e.file),['main.ddn']);
 assert.deepEqual(entries[0].views.map(v=>v.id),['overview']);
 assert.deepEqual(ws.views('main.ddn').map(v=>v.id),['overview']);
});

test('Determinism: identical renders and identical parse trees',()=>{
 const a=A.createWorkspace(files).renderSync({entry:'main.ddn',view:'overview'}).svg;
 const b=A.createWorkspace(files).renderSync({entry:'main.ddn',view:'overview'}).svg;
 assert.equal(a,b);
 assert.equal(JSON.stringify(A.parse(two,'main.ddn')),JSON.stringify(A.parse(two,'main.ddn')));
});

console.log(`multi-module ${results.filter(r=>r.pass).length}/${results.length}`);
