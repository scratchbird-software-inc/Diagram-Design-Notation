/* SPDX-License-Identifier: GPL-2.0-or-later. B1-066: DMN 1.4 DRD compliance fixtures . */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const SRC=`ddn "0.5";
module "test.dmn";

data rules {
    object high "High" { kind: "rule.row"; x_rule: { when: { severity: { op: "eq", value: "high" } }; then: { route: "senior", fee: 100, flag: "urgent" } }; }
    object low "Low" { kind: "rule.row"; x_rule: { when: { severity: { op: "eq", value: "low" } }; then: { route: "standard", fee: 20, flag: "none" } }; }
}

data d {
    object inp "Claim data" { kind: "dmn.inputdata"; }
    object ks "Policy manual" { kind: "dmn.knowledgesource"; }
    object dec "Route claim" { kind: "dmn.decision"; x_subdiagram: { view: "table" };
        x_boxed: { form: "literal"; text: "if severity = high then senior else standard" }; }
    object bkm "Fee schedule" { kind: "dmn.bkm";
        x_boxed: { form: "context"; entries: [ { name: "base"; text: "20" }, { name: "uplift"; text: "80" } ] }; }
    object svc "Claim service" { kind: "dmn.decisionservice"; }

    relation i1 "" @inp -> @dec { kind: "dmn.inforeq"; }
    relation k1 "" @bkm -> @dec { kind: "dmn.knowledgereq"; }
    relation a1 "" @ks -> @bkm { kind: "dmn.authorityreq"; }
    relation i2 "" @dec -> @svc { kind: "dmn.inforeq"; }
}

view drd "DRD" { data: [@d]; projection { kind: graph; profile: "dmn.drd@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
view table "Table" { data: [@rules]; projection { kind: decision; profile: "decision.rules@1"; records: [@rules.high, @rules.low]; inputs: [{ "key": "severity", "type": "enum", "values": ["low", "high"] }]; outputs: ["route", "fee", "flag"]; hit_policy: "priority"; coverage: "complete"; } }
view graph2 "Other graph" { data: [@rules]; projection { kind: graph; } publication { size: content; fit: none; overflow: error; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='drd',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('DRD renders all five node silhouettes and three requirement connectors',()=>{const r=run();
 assert.ok(r.svg.includes('data-shape="clippedcorner"'),'BKM clipped corner missing');
 assert.ok(r.svg.includes('data-shape="round"'),'input data missing');
 assert.ok(r.svg.includes('data-shape="document"'),'knowledge source missing');
 for(const s of ['Claim data','Policy manual','Route claim','Fee schedule','Claim service'])assert.ok(r.svg.includes(s),'missing '+s);
 for(const v of ['ddn-verb-inforeq','ddn-verb-knowledgereq','ddn-verb-authorityreq'])assert.ok(r.svg.includes(v),'missing verb '+v);});
test('decision binds the decision-table view with the ref badge',()=>{const r=run();
 assert.ok(r.svg.includes('ddn-ref-badge'),'ref badge missing');});
test('boxed expressions render as text rows (literal + context forms)',()=>{const r=run();
 assert.ok(r.svg.includes('if severity = high then'),'literal text missing');
 assert.ok(r.svg.includes('base: 20')&&r.svg.includes('uplift: 80'),'context entries missing');});
test('boxed invocation and relation forms render',()=>{const r=run('drd',edit('x_boxed: { form: "literal"; text: "if severity = high then senior else standard" }','x_boxed: { form: "invocation"; entries: [ { name: "severity"; text: "claim.severity" } ] }'));
 assert.ok(r.svg.includes('severity: claim.severity'));});
test('DMN-labelled hit policies render the label and the completeness cell',()=>{
 for(const hp of ['priority','any','output_order','rule_order','aggregation']){
  const r=run('table',edit('hit_policy: "priority"','hit_policy: "'+hp+'"'));
  assert.ok(r.svg.includes('HIT POLICY: '+hp.toUpperCase()),hp+' label missing');
  assert.ok(r.svg.includes('C+'),hp+' completeness cell missing');}});
test('multi-output table renders one column per output',()=>{const r=run('table');
 for(const s of ['→ route','→ fee','→ flag'])assert.ok(r.svg.includes(s),'missing column '+s);});
test('legacy policies keep the old header (no completeness cell without opt-in)',()=>{
 const r=run('table',edit('hit_policy: "priority"','hit_policy: "unique"'));
 assert.ok(!r.svg.includes('C+')&&!r.svg.includes('C−'),'completeness cell leaked into legacy table');
 assert.ok(r.svg.includes('HIT POLICY: UNIQUE'));});
test('x_completeness: true opts a legacy table into the cell',()=>{
 const r=run('table',edit('hit_policy: "priority"','hit_policy: "unique"; x_completeness: true'));
 assert.ok(r.svg.includes('C+'));});
test('evaluateDecision: rule_order behaves as first (first match in rule order)',()=>{
 const ws=A.createWorkspace({'main.ddn':SRC.replace('hit_policy: "priority"','hit_policy: "rule_order"')});
 const ev=ws.evaluateDecision('main.ddn','table',{severity:'high'});
 assert.equal(ev.policy,'rule_order');assert.equal(ev.matched.length,1);assert.equal(ev.outputs[0].route,'senior');
 assert.ok(!ev.annotation,'rule_order must not carry the deferral note');
 ws.destroy();});
test('annotation policy evaluation returns matches in table order with deferral note',()=>{
 const ws=A.createWorkspace({'main.ddn':SRC});
 const ev=ws.evaluateDecision('main.ddn','table',{severity:'high'});
 assert.equal(ev.policy,'priority');
 assert.equal(ev.outputs[0].route,'senior');
 assert.ok(ev.annotation&&/host/.test(ev.annotation),'deferral note missing');
 ws.destroy();});

test('unknown view reference (DDN-PJ192)',()=>{
 throws(()=>run('drd',edit('x_subdiagram: { view: "table" }','x_subdiagram: { view: "nope" }')),'DDN-PJ192');});
test('binding a non-decision view (DDN-PJ192)',()=>{
 throws(()=>run('drd',edit('x_subdiagram: { view: "table" }','x_subdiagram: { view: "graph2" }')),'DDN-PJ192');});
test('x_subdiagram on a non-DMN node under dmn.drd@1 (DDN-PJ192)',()=>{
 throws(()=>run('drd',edit('object inp "Claim data" { kind: "dmn.inputdata"; }','object inp "Claim data" { kind: "rule.row"; x_subdiagram: { view: "table" }; x_rule: { when: {}; then: { a: 1 } }; }')),'DDN-PJ192');});
test('x_boxed on a non-DMN kind (DDN-PJ193)',()=>{
 throws(()=>run('drd',edit('object inp "Claim data" { kind: "dmn.inputdata"; }','object inp "Claim data" { kind: "dmn.inputdata"; x_boxed: { form: "literal"; text: "x" }; }')),'DDN-PJ193');});
test('information requirement cannot start at a BKM (DDN-PJ194)',()=>{
 throws(()=>run('drd',edit('relation i1 "" @inp -> @dec','relation i1 "" @bkm -> @dec')),'DDN-PJ194');});
test('knowledge requirement must start at a BKM (DDN-PJ194)',()=>{
 throws(()=>run('drd',edit('relation k1 "" @bkm -> @dec','relation k1 "" @inp -> @dec')),'DDN-PJ194');});
test('authority requirement must start at a knowledge source or decision (DDN-PJ194)',()=>{
 throws(()=>run('drd',edit('relation a1 "" @ks -> @bkm','relation a1 "" @inp -> @bkm')),'DDN-PJ194');});
test('FEEL evaluation is declared unsupported in the profile',()=>{
 const cat=require('../runtime/assets/profiles-catalogue.js').default||require('../runtime/assets/profiles-catalogue.js');
 const prof=(cat.profiles||[]).find(p=>p.id==='dmn.drd@1');
 assert.ok(prof.unsupported.some(u=>/FEEL/.test(u)&&/backend|host/.test(u)),'FEEL boundary declaration missing');});

const failed=results.filter(r=>!r.pass);
console.log('dmn-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
