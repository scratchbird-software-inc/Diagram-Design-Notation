/* SPDX-License-Identifier: GPL-2.0-or-later. Sequence projection (kind:sequence, uml.sequence@1) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.sequence";

data flow {
    object customer_app "Customer app" { kind: application; }
    object checkout "Checkout" { kind: service; }
    object inventory "Inventory" { kind: service; }
    relation submit_order "Submit order" @customer_app -> @checkout { kind: "uml.message"; }
    relation reserve_stock "Reserve stock" @checkout -> @inventory { kind: "uml.message"; }
    relation reserve_stock_reply "Stock reserved" @inventory -> @checkout { kind: "uml.message"; x_return: true; }
    relation audit_log "Audit log" @checkout -> @checkout { kind: "uml.message"; }
    relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; }
}

view sequence "Synthetic order flow / sequence" {
    data: [@flow];
    projection { kind: sequence; profile: "uml.sequence@1"; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},overrides={}){return workspace(changes).renderSync({entry:'main.ddn',view:'sequence',overrides});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const Data=require('../runtime/ddn-projection-data.js');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const id=short=>'test.sequence::flow.'+short;
const groupOf=(svg,dataId)=>{const at=svg.indexOf('data-id="'+dataId+'"');assert.ok(at>=0,'mark missing for '+dataId);const rest=svg.slice(at);return rest.slice(0,rest.indexOf('</g>'));};
// Default style: s=1, left=110, gap=230 (labels fit), pitch=64, firstRow=118.
const PX={customer_app:110,checkout:340,inventory:570},ROW=i=>118+64*i;
test('Sequence view renders 3 lifelines, 5 numbered message arrows with labels above',()=>{const r=run();
 assert.match(r.svg,/<svg/);
 assert.equal((r.svg.match(/stroke-dasharray="5 5"/g)||[]).length,3,'exactly 3 dashed lifelines');
 for(const [i,name] of ['Submit order','Reserve stock','Stock reserved','Audit log','Confirm order'].entries())assert.ok(r.svg.includes('>'+(i+1)+'. '+name+'</text>'),'numbered label '+(i+1)+' missing');
 const marks=r.scene.marks,ids=marks.flatMap(m=>m.sourceIds);
 for(const s of ['customer_app','checkout','inventory','submit_order','reserve_stock','reserve_stock_reply','audit_log','confirm'])assert.ok(ids.includes(id(s)),'scene marks missing source id '+s);});
test('Participants equally spaced in declaration order; message rows descend strictly',()=>{const r=run();
 const partMarks=['customer_app','checkout','inventory'].map(s=>r.scene.marks.find(m=>m.sourceIds[0]===id(s)&&m.h>300));
 partMarks.forEach((m,i)=>{assert.ok(m,'participant mark '+i);const cx=m.x+m.w/2;assert.ok(Math.abs(cx-PX[['customer_app','checkout','inventory'][i]])<0.01,'participant '+i+' center '+cx);});
 const cxs=partMarks.map(m=>m.x+m.w/2);
 assert.ok(Math.abs((cxs[1]-cxs[0])-(cxs[2]-cxs[1]))<0.01,'spacing not equal');
 const msgMarks=['submit_order','reserve_stock','reserve_stock_reply','audit_log','confirm'].map(s=>r.scene.marks.find(m=>m.sourceIds[0]===id(s)));
 msgMarks.forEach((m,i)=>{assert.ok(m,'message mark '+i);assert.ok(Math.abs(m.y-(ROW(i)-20))<0.01,'row '+i+' y '+m.y);});
 for(let i=1;i<msgMarks.length;i++)assert.ok(msgMarks[i].y>msgMarks[i-1].y,'rows must descend');});
test('x_return renders dashed with open arrow; receiver activation spans to its next sourced message',()=>{const r=run();
 const g=groupOf(r.svg,id('reserve_stock_reply'));
 assert.ok(g.includes('stroke-dasharray="5 4"'),'return arrow is not dashed');
 assert.ok(g.includes('M-10 -5L0 0L-10 5'),'return arrowhead is not open');
 // reserve_stock_reply is row 2, receiver checkout next sources audit_log at row 3: bar y 230..326 (x=335, w=10, h=96).
 assert.ok(r.svg.includes(`<rect x="335" y="${ROW(2)-16}" width="10" height="${ROW(3)-ROW(2)+32}"`),'checkout activation bar for rows 2..3 missing');});
test('Self-message renders a rectangular loop to the right of the lifeline',()=>{const r=run();
 const g=groupOf(r.svg,id('audit_log'));
 assert.match(g,/M340 310H388V336H349/,'self-loop path missing: '+g.slice(0,200));});
test('Message endpoint that is not an object element rejected as DDN-PJ110',()=>{
 const bad=edit('object customer_app "Customer app" { kind: application; }','object customer_app "Customer app" { kind: application; fields { field id; } } sample snap { columns: [@customer_app.id]; rows: [[1]]; }')
  ['main.ddn'].replace('relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; }','relation confirm "Confirm order" @checkout -> @customer_app { kind: "uml.message"; } relation report @checkout -> @snap { kind: "uml.message"; }');
 assert.ok(bad.includes('@snap'),'mutation applied');
 throws(()=>run({'main.ddn':bad}),'DDN-PJ110');});
test('Unknown projection property rejected as DDN-PJ005; unknown kind remains DDN-PJ001',()=>{
 throws(()=>run(edit('kind: sequence;','kind: sequence; mark: pie;')),'DDN-PJ005');
 // The workspace override layer rejects unknown kinds first; assert the planner's own guard on a resolved IR.
 const ir=workspace().resolve('main.ddn','sequence');ir.view.profiles.projection.kind='unicorn';
 throws(()=>Data.plan(ir,Error),'DDN-PJ001');});
test('Graph place geometry in a sequence view rejected as DDN-PJ002',()=>{
 throws(()=>run(edit('projection { kind: sequence;','place @flow.checkout { at: [0px, 0px]; } projection { kind: sequence;')),'DDN-PJ002');});
test('Vega-Lite export of a sequence view rejected as DDN-PJ070',()=>{
 throws(()=>workspace().exportVegaLite({entry:'main.ddn',view:'sequence'}),'DDN-PJ070');});
test('Silent participant warns DDN-PJW03 and still renders',()=>{
 const quiet=edit('object inventory "Inventory" { kind: service; }','object inventory "Inventory" { kind: service; } object auditor "Auditor" { kind: application; }');
 const r=run(quiet);
 assert.match(r.svg,/<svg/);assert.ok(r.svg.includes('>Auditor</text>'));
 const d=r.diagnostics.filter(x=>x.code==='DDN-PJW03');
 assert.equal(d.length,1,'exactly one DDN-PJW03');assert.equal(d[0].severity,'warning');assert.ok(d[0].message.includes('Auditor'));});
test('Deterministic byte-identical rerender',()=>assert.equal(sha(run().svg),sha(run().svg)));
const failed=results.filter(r=>!r.pass);
for(const r of results)if(r.pass)console.log('PASS',r.name);
console.log('Sequence diagram '+results.filter(r=>r.pass).length+'/'+results.length);
if(failed.length)process.exitCode=1;
