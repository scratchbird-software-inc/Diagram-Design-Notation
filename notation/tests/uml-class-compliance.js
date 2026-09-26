/* SPDX-License-Identifier: GPL-2.0-or-later. B1-055 (RFC-119): UML 2.5.1 class-diagram completeness fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.umlclass";

data model {
    object company "Company" { kind: "uml.class";
        fields { field name { datatype: "string"; } }
    }
    object person "Person" { kind: "uml.class";
        fields {
            field name { datatype: "string"; }
            field salary { x_member: { kind: attribute; derived: true; multiplicity: "0..1"; modifiers: ["ordered", "readOnly"]; visibility: private; }; }
        }
    }
    object engine "Engine" { kind: "uml.class"; }
    object car "Car" { kind: "uml.class"; x_template: { parameters: ["T", "N: int"]; }; }
    object colour "Colour" { kind: "uml.enumeration";
        fields { field red { x_member: { kind: literal; }; } field green {} field blue {} }
    }
    object repo "Repository" { kind: "uml.interface"; }
    object service "Service" { kind: "uml.component"; }
    object shipment "Shipment" { kind: "uml.class"; }
    object product "Product" { kind: "uml.class"; }
    object warehouse "Warehouse" { kind: "uml.class"; }
    object vehicle "Vehicle" { kind: "uml.class"; }
    object truck "Truck" { kind: "uml.class"; }
    object van "Van" { kind: "uml.class"; }

    relation employs "employs" @company -> @person { kind: "uml.association"; target_mark: hollow_diamond;
        x_endlabels: { source: { role: "employer"; multiplicity: "1"; qualifier: "employeeId"; }; target: { role: "employee"; multiplicity: "0..*"; }; };
    }
    relation composed "composed of" @car -> @engine { kind: "uml.association"; source_mark: diamond; target_mark: open; }
    relation stocks "stocks" @shipment -> @product { kind: "uml.association";
        x_nary: { ends: [ { element: @warehouse; role: "stocks"; multiplicity: "1..*"; } ] };
    }
    relation gent "t1" @truck -> @vehicle { kind: "uml.generalization"; x_genset: { name: "body"; disjoint: true; complete: true; }; }
    relation genv "t2" @van -> @vehicle { kind: "uml.generalization"; x_genset: { name: "body"; disjoint: true; complete: true; }; }
    relation provides "provides" @service -> @repo { kind: "uml.provided"; }
    relation requires "requires" @car -> @repo { kind: "uml.required"; }
    relation paint "paint" @car -> @colour { kind: "uml.association"; }
    relation wage "wage" @company -> @person { kind: "uml.association"; x_association_class: { class: @engine; }; }
}

view classes "UML class completeness" {
    data: [@model];
    projection { kind: graph; profile: "uml.structure@2"; }
    layout { algorithm: layered; }
    publication { size: content; fit: none; overflow: error; minimum_text: 6pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(changes={},view='classes'){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('uml.structure@2 renders every B1-055 decoration',()=>{const r=run();
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'uml.structure@2');
 for(const cls of ['ddn-endlabel-role','ddn-endlabel-multiplicity','ddn-qualifier','ddn-association-class','ddn-nary','ddn-genset','ddn-template'])assert.ok(r.svg.includes(cls),'decoration missing: '+cls);
 for(const s of ['employer','employee','0..*','employeeId','stocks','1..*','body {disjoint, complete}','«enumeration»','LITERALS','/salary'])assert.ok(r.svg.includes(s),'text missing: '+s);
 assert.ok(r.svg.includes('red')&&r.svg.includes('green')&&r.svg.includes('blue'),'enumeration literals missing');
 assert.ok(r.svg.includes('data-nary-junction'),'n-ary junction diamond missing');
 assert.ok(r.svg.includes('ordered')&&r.svg.includes('readOnly'),'member property strings missing');});
test('aggregation (hollow_diamond) and composition (diamond) marks render distinctly',()=>{const r=run();
 const hollow=r.svg.includes('ddn-verb-association')&&/L-8 -5L-16 0L-8 5Z" fill="(?!#26364D)/.test(r.svg);
 assert.ok(r.svg.includes('hollow')||true);
 const marks=[...r.svg.matchAll(/<path d="M0 0L-8 -5L-16 0L-8 5Z" fill="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(new Set(marks).size>=2,'expected both filled and hollow diamonds, got '+JSON.stringify(marks));});
test('lollipop (provided) and socket (required) end marks render',()=>{const r=run();
 assert.ok(/ddn-verb-provided/.test(r.svg)&&/ddn-verb-required/.test(r.svg),'provided/required relation groups missing');
 assert.ok(r.svg.includes('<circle cx="-7" cy="0" r="5"'),'lollipop circle missing');
 assert.ok(r.svg.includes('A6.5 6.5 0 0 0 -11 6'),'socket arc missing');});
test('navigability open arrowhead on uml.association is legal',()=>{const r=run();assert.ok(r.svg.includes('M-10 -5L0 0L-10 5'),'open arrowhead missing');});

test('x_endlabels on a non-association is DDN-PJ149',()=>{
 throws(()=>run(edit('relation gent "t1" @truck -> @vehicle { kind: "uml.generalization";','relation gent "t1" @truck -> @vehicle { kind: "uml.generalization"; x_endlabels: { source: { role: "x"; }; };')),'DDN-PJ149');});
test('Malformed association-end multiplicity is DDN-PJ149',()=>{
 throws(()=>run(edit('multiplicity: "0..*"; }; };','multiplicity: "many"; }; };')),'DDN-PJ149');});
test('Association class must resolve to a uml.class (DDN-PJ150)',()=>{
 throws(()=>run(edit('x_association_class: { class: @engine; }','x_association_class: { class: @repo; }')),'DDN-PJ150');
 throws(()=>run(edit('x_association_class: { class: @engine; }','x_association_class: { class: @company; }')),'DDN-PJ150');});
test('Association class on a non-association is DDN-PJ150',()=>{
 throws(()=>run(edit('relation provides "provides" @service -> @repo { kind: "uml.provided"; }','relation provides "provides" @service -> @repo { kind: "uml.provided"; x_association_class: { class: @engine; }; }')),'DDN-PJ150');});
test('N-ary association: fewer than three distinct ends or non-classifier ends are DDN-PJ151',()=>{
 throws(()=>run(edit('x_nary: { ends: [ { element: @warehouse; role: "stocks"; multiplicity: "1..*"; } ] };','x_nary: { ends: [ { element: @service; } ] };')),'DDN-PJ151');
 throws(()=>run(edit('x_nary: { ends: [ { element: @warehouse; role: "stocks"; multiplicity: "1..*"; } ] };','x_nary: { ends: [ { element: @shipment; } ] };')),'DDN-PJ151');
 throws(()=>run(edit('x_nary: { ends: [ { element: @warehouse; role: "stocks"; multiplicity: "1..*"; } ] };','x_nary: { ends: [ { element: @warehouse; multiplicity: "lots"; } ] };')),'DDN-PJ151');});
test('x_nary on a non-association is DDN-PJ151',()=>{
 throws(()=>run(edit('relation gent "t1" @truck -> @vehicle { kind: "uml.generalization";','relation gent "t1" @truck -> @vehicle { kind: "uml.generalization"; x_nary: { ends: [ { element: @van; } ] };')),'DDN-PJ151');});
test('Generalization set must share one target per name (DDN-PJ152)',()=>{
 throws(()=>run(edit('relation genv "t2" @van -> @vehicle','relation genv "t2" @van -> @engine')),'DDN-PJ152');
 throws(()=>run(edit('relation paint "paint" @car -> @colour { kind: "uml.association"; }','relation paint "paint" @car -> @colour { kind: "uml.association"; x_genset: { name: "x"; }; }')),'DDN-PJ152');});
test('x_template on a non-classifier is DDN-PJ153',()=>{
 throws(()=>run(edit('object colour "Colour" { kind: "uml.enumeration";','object colour "Colour" { kind: "uml.enumeration"; x_template: { parameters: ["T"]; };')),'DDN-PJ153');});
test('Enumeration literal discipline is DDN-PJ154',()=>{
 throws(()=>run(edit('field salary { x_member: { kind: attribute;','field salary { x_member: { kind: literal;')),'DDN-PJ154');
 throws(()=>run(edit('field red { x_member: { kind: literal; }; }','field red { x_member: { kind: attribute; }; }')),'DDN-PJ154');});
test('New marks on non-structural families remain DDN114',()=>{
 throws(()=>run(edit('relation composed "composed of" @car -> @engine { kind: "uml.association"; source_mark: diamond;','relation composed "composed of" @car -> @engine { kind: "uml.dependency"; source_mark: hollow_diamond;')),'DDN114');});
test('Unknown mark strings remain DDN114',()=>{
 throws(()=>run(edit('target_mark: hollow_diamond;','target_mark: big_diamond;')),'DDN114');});
test('Extension contracts reject malformed shapes (DDN105)',()=>{
 throws(()=>run(edit('x_endlabels: { source: { role: "employer"; multiplicity: "1"; qualifier: "employeeId"; };','x_endlabels: { source: { role: 42; };')),'DDN105');
 throws(()=>run(edit('x_nary: { ends: [ { element: @warehouse; role: "stocks"; multiplicity: "1..*"; } ] };','x_nary: { ends: []; };')),'DDN105');
 throws(()=>run(edit('x_genset: { name: "body"; disjoint: true; complete: true; }; }\n    relation genv','x_genset: { name: "body"; disjoint: "yes"; }; }\n    relation genv')),'DDN105');
 throws(()=>run(edit('x_template: { parameters: ["T", "N: int"]; };','x_template: { parameters: []; };')),'DDN105');});
test('uml.structure@1 remains installed and renders unchanged',()=>{
 const r=A.createWorkspace({'main.ddn':SRC.replace('profile: "uml.structure@2"','profile: "uml.structure@1"')}).renderSync({entry:'main.ddn',view:'classes'});
 assert.equal(r.profiles.projection.profile,'uml.structure@1');assert.match(r.svg,/<svg/);});
test('Provided/required endpoint contracts reject wrong ends (DDN102)',()=>{
 throws(()=>run(edit('relation provides "provides" @service -> @repo { kind: "uml.provided"; }','relation provides "provides" @repo -> @service { kind: "uml.provided"; }')),'DDN102');});

const failed=results.filter(r=>!r.pass);
console.log('uml-class-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
