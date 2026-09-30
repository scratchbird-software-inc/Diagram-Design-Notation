/* SPDX-License-Identifier: GPL-2.0-or-later. B1-065: SysML 1.6 compliance fixtures . */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.sysml2";

data m {
    object r1 "Pump performance" { kind: "req.requirement"; x_diagram: { code: "R-1"; text: "The pump shall sustain 40 L/min." }; }
    object r2 "Response" { kind: "req.requirement"; x_diagram: { code: "R-1.1"; text: "Rated flow within 500 ms." }; }
    object tc "Rated-flow test" { kind: "sysml.testcase"; }
    object pump "Pump" { kind: "sysml.block";
        fields {
            field capacity "capacity" { x_block: { compartment: "values" }; x_unit: { unit: "L/min" }; }
            field impeller "impeller" { x_block: { compartment: "parts" }; }
        }
        ports { port outlet { direction: out; x_port: { type: "full"; multiplicity: "1..2"; nested: [ { name: "seal"; direction: "out" } ] }; } }
    }
    object reservoir "Reservoir" { kind: "sysml.block";
        ports { port inlet { direction: in; x_port: { type: "proxy"; conjugated: true }; } }
    }
    object base "Fluid mover" { kind: "sysml.block"; }
    object litres "Litres per minute" { kind: "sysml.valuetype"; }
    object ifb "Pump interface" { kind: "sysml.interfaceblock"; ports { port cmd { direction: in; } } }
    object spec "Water flow spec" { kind: "sysml.flowspec"; ports { port rate { direction: out; } } }
    object cb "{flow = pressure x area}" { kind: "sysml.constraint";
        fields { field flow "flow" { x_unit: { unit: "L/min" }; } }
    }

    relation derive "" @r2 -> @r1 { kind: "sysml.derive"; }
    relation verify "" @tc -> @r1 { kind: "sysml.verify"; }
    relation satisfy "" @pump -> @r1 { kind: "sysml.satisfy"; }
    relation refine "" @pump -> @r2 { kind: "sysml.refine"; }
    relation trace "" @r1 -> @r2 { kind: "sysml.trace"; }
    relation comp "" @pump -> @reservoir { kind: "sysml.composition"; }
    relation gen "" @pump -> @base { kind: "uml.generalization"; }
    relation alloc "" @tc -> @pump { kind: "sysml.allocate"; }
    relation water "water" @pump.outlet -> @reservoir.inlet { kind: "sysml.flow"; }
    relation b1 "" @cb -> @pump { kind: "assoc"; }
    relation b2 "" @cb -> @reservoir { kind: "assoc"; }
    relation b3 "" @cb -> @base { kind: "assoc"; }
}

view req "Requirements" { data: [@m]; projection { kind: graph; profile: "sysml.requirements@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } exclude: [@m.cb, @m.water, @m.b1, @m.b2, @m.b3, @m.gen, @m.litres, @m.ifb, @m.spec]; }
view bdd "BDD" { data: [@m]; projection { kind: graph; profile: "sysml.bdd@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } exclude: [@m.cb, @m.water, @m.b1, @m.b2, @m.b3, @m.derive, @m.verify, @m.alloc]; }
view ibd "IBD" { data: [@m]; projection { kind: graph; profile: "sysml.ibd@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } exclude: [@m.r1, @m.r2, @m.tc, @m.cb, @m.derive, @m.verify, @m.satisfy, @m.refine, @m.trace, @m.comp, @m.gen, @m.alloc, @m.b1, @m.b2, @m.b3]; }
view par "Parametric" { data: [@m]; projection { kind: graph; profile: "sysml.parametric@2"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } exclude: [@m.tc, @m.litres, @m.ifb, @m.spec, @m.derive, @m.verify, @m.satisfy, @m.refine, @m.trace, @m.alloc, @m.water, @m.comp, @m.gen]; }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='req',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('requirements diagram: «requirement» compartments, test case, dependency keywords',()=>{const r=run('req');
 for(const s of ['«requirement»','R-1','«testCase»','«deriveReqt»','«verify»','«satisfy»','«refine»','«trace»','«allocate»'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('bdd@2: block compartments with unit display, value type, interface block, flow spec keywords',()=>{const r=run('bdd');
 for(const s of ['«block»','values','parts','capacity: L/min','«valueType»','«interfaceBlock»','«flowSpecification»'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('ibd@2: proxy/full/conjugated port glyphs, multiplicity, nested ports',()=>{const r=run('ibd');
 for(const s of ['data-port-type="full"','data-port-type="proxy"','data-conjugated="true"','[1..2]','data-nested-port="seal"','«proxy»','«full»'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('parametric@2: three bindings allowed, «constraint» parameters compartment with units',()=>{const r=run('par');
 for(const s of ['«constraint»','constraints','flow: L/min'])assert.ok(r.svg.includes(s),'missing: '+s);});
test('copy/master dependency keywords render',()=>{const r=run('req',edit('relation trace "" @r1 -> @r2 { kind: "sysml.trace"; }','relation trace "" @r1 -> @r2 { kind: "sysml.trace"; } relation c1 "" @r2 -> @r1 { kind: "sysml.copy"; } relation m1 "" @r2 -> @r1 { kind: "sysml.master"; }'));
 for(const s of ['«copy»','«master»'])assert.ok(r.svg.includes(s),'missing: '+s);});

test('sysml.verify must start at a test case (DDN-PJ185)',()=>{
 throws(()=>run('req',edit('relation verify "" @tc -> @r1','relation verify "" @r2 -> @r1')),'DDN-PJ185');});
test('sysml.derive must connect requirements (DDN-PJ185)',()=>{
 throws(()=>run('req',edit('relation derive "" @r2 -> @r1 { kind: "sysml.derive"','relation derive "" @r2 -> @pump { kind: "sysml.derive"')),'DDN-PJ185');});
test('sysml.satisfy must target a requirement (DDN-PJ185)',()=>{
 throws(()=>run('req',edit('relation satisfy "" @pump -> @r1 { kind: "sysml.satisfy"','relation satisfy "" @pump -> @tc { kind: "sysml.satisfy"')),'DDN-PJ185');});
test('x_block compartment on a non-block owner (DDN-PJ186)',()=>{
 throws(()=>run('req',edit('object tc "Rated-flow test" { kind: "sysml.testcase"; }','object tc "Rated-flow test" { kind: "sysml.testcase"; fields { field f "f" { x_block: { compartment: "values" }; } } }')),'DDN-PJ186');});
test('x_port malformed multiplicity (DDN-PJ187)',()=>{
 throws(()=>run('ibd',edit('multiplicity: "1..2"','multiplicity: "many"')),'DDN-PJ187');});
test('x_port nested names must be unique (DDN-PJ187)',()=>{
 throws(()=>run('ibd',edit('{ name: "seal"; direction: "out" }','{ name: "seal"; direction: "out" }, { name: "seal" }')),'DDN-PJ187');});
test('x_unit must resolve in the units registry (DDN-PJ188)',()=>{
 throws(()=>run('bdd',edit('unit: "L/min"','unit: "furlong"')),'DDN-PJ188');});
test('x_unit quantity kind must match (DDN-PJ188)',()=>{
 throws(()=>run('bdd',edit('x_unit: { unit: "L/min" }','x_unit: { unit: "L/min"; quantity: "force" }')),'DDN-PJ188');});
test('parametric@2: constraint with zero bindings (DDN-PJ189)',()=>{
 throws(()=>run('par',{'main.ddn':SRC.replace('relation b1 "" @cb -> @pump { kind: "assoc"; }','').replace('relation b2 "" @cb -> @reservoir { kind: "assoc"; }','').replace('relation b3 "" @cb -> @base { kind: "assoc"; }','')}),'DDN-PJ189');});
test('generalization between non-block kinds under sysml.bdd@2 (DDN-PJ190)',()=>{
 const mut={'main.ddn':SRC.replace('data m {','data m {\n    object pa "A" { kind: "uml.class"; }\n    object pb "B" { kind: "uml.class"; }\n').replace('relation gen "" @pump -> @base { kind: "uml.generalization"; }','relation gen "" @pa -> @pb { kind: "uml.generalization"; }')};
 throws(()=>run('bdd',mut),'DDN-PJ190');});
test('sysml.composition endpoint kinds are registry-enforced (DDN102)',()=>{
 throws(()=>run('bdd',edit('relation comp "" @pump -> @reservoir { kind: "sysml.composition"','relation comp "" @pump -> @tc { kind: "sysml.composition"')),'DDN102');});
test('x_flow only on uml.flow under sysml.activity@1 (DDN-PJ191)',()=>{
 throws(()=>run('ibd',edit('relation water "water" @pump.outlet -> @reservoir.inlet { kind: "sysml.flow"; }','relation water "water" @pump.outlet -> @reservoir.inlet { kind: "sysml.flow"; x_flow: { rate: "x" }; }')),'DDN-PJ191');});
test('ports group on a value type still rejected under @2 (DDN-PJ121)',()=>{
 throws(()=>run('bdd',edit('object litres "Litres per minute" { kind: "sysml.valuetype"; }','object litres "Litres per minute" { kind: "sysml.valuetype"; ports { port p { direction: in; } } }')),'DDN-PJ121');});
test('parametric@1 keeps the exactly-two rule (DDN-PJ122)',()=>{
 throws(()=>run('par',edit('profile: "sysml.parametric@2"','profile: "sysml.parametric@1"')),'DDN-PJ122');});

test('behavioral rebadges render with the UML machinery (DDN-PJW06)',()=>{
 const beh={'main.ddn':`ddn "0.5";
module "test.sysmlbeh";
data a {
    object s "" { kind: "flow.start"; }
    object p "Meter" { kind: "flow.process"; ports { port o { direction: out; x_pin: { streaming: true }; } } }
    object e "" { kind: "flow.end"; }
    relation f1 "" @s -> @p { kind: "uml.flow"; }
    relation f2 "water" @p.o -> @e { kind: "uml.flow"; x_flow: { rate: "10 L/min"; continuous: true; probability: 0.9 }; }
}
view v "A" { data: [@a]; projection { kind: graph; profile: "sysml.activity@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(beh).renderSync({entry:'main.ddn',view:'v'});
 assert.ok(r.svg.includes('rate = 10 L/min')&&r.svg.includes('continuous')&&r.svg.includes('probability = 0.9'),'x_flow labels missing');
 assert.ok(r.svg.includes('data-streaming="true"'),'streaming pin missing');
 assert.ok((r.diagnostics||[]).some(d=>d.code==='DDN-PJW06'),'rebadge info diagnostic missing');});
test('state machine rebadge renders trigger/guard labels',()=>{
 const sm={'main.ddn':`ddn "0.5";
module "test.sysmlsm";
data s {
    object off "Off" { kind: "state.state"; }
    object on "On" { kind: "state.state"; }
    relation t1 "" @off -> @on { kind: "transition"; x_transition: { event: "start"; guard: "ready" }; }
}
view v "S" { data: [@s]; projection { kind: graph; profile: "sysml.statemachine@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(sm).renderSync({entry:'main.ddn',view:'v'});
 assert.ok(r.svg.includes('start [ready]'),'transition label missing');});
test('sequence rebadge renders the interaction',()=>{
 const sq={'main.ddn':`ddn "0.5";
module "test.sysmlsq";
data s {
    object hmi "HMI" { kind: "uml.class"; }
    object ctl "Controller" { kind: "uml.class"; }
    relation m1 "start()" @hmi -> @ctl { kind: "uml.message"; }
}
view v "Q" { data: [@s]; projection { kind: sequence; profile: "sysml.sequence@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(sq).renderSync({entry:'main.ddn',view:'v'});
 assert.ok(r.svg.includes('start()'),'message missing');});
test('use-case rebadge enforces subject sharing (DDN-PX006)',()=>{
 const uc={'main.ddn':`ddn "0.5";
module "test.sysmluc";
data u {
    object subj "Station" { kind: "uml.subject"; }
    object op "Op" { kind: "uml.actor"; }
    object a "A" { kind: "uml.usecase"; x_usecase: { subjects: [ @subj ]; }; }
    object b "B" { kind: "uml.usecase"; }
    relation i1 "" @a -> @b { kind: "uml.include"; }
}
view v "U" { data: [@u]; projection { kind: graph; profile: "sysml.usecase@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 throws(()=>A.createWorkspace(uc).renderSync({entry:'main.ddn',view:'v'}),'DDN-PX006');});
test('package diagram: import/access/merge render',()=>{
 const pk={'main.ddn':`ddn "0.5";
module "test.symlpkg";
data p {
    object a "Plant" { kind: "uml.package"; }
    object b "Pump lib" { kind: "uml.package"; }
    object c "Safety lib" { kind: "uml.package"; }
    relation i1 "" @a -> @b { kind: "uml.import"; }
    relation m1 "" @b -> @c { kind: "uml.merge"; }
    relation a1 "" @a -> @c { kind: "uml.access"; }
}
view v "P" { data: [@p]; projection { kind: graph; profile: "sysml.package@1"; } publication { size: content; fit: none; overflow: error; } }
`};
 const r=A.createWorkspace(pk).renderSync({entry:'main.ddn',view:'v'});
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'sysml.package@1');});

const failed=results.filter(r=>!r.pass);
console.log('sysml-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
