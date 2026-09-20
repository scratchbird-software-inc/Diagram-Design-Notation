/* SPDX-License-Identifier: GPL-2.0-or-later. SysML-style block profiles (sysml.bdd@1 / sysml.ibd@1 / sysml.parametric@1 on kind:graph) fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SRC=`ddn "0.5";
module "test.sysml";

data m {
    object pump "Pump" { kind: "sysml.block";
        ports { port out { direction: out; } }
    }
    object reservoir "Reservoir" { kind: "sysml.block";
        ports { port in { direction: in; } }
    }
    object flow_balance "{flow = pressure × area}" { kind: "sysml.constraint"; }

    relation feeds "feeds" @pump -> @reservoir { kind: "assoc"; }
    relation water "water" @pump.out -> @reservoir.in { kind: "sysml.flow"; }
    relation bind_pump "binds pump" @flow_balance -> @pump { kind: "assoc"; }
    relation bind_reservoir "binds reservoir" @flow_balance -> @reservoir { kind: "assoc"; }
}

view bdd "Pump station block definition" {
    data: [@m];
    projection { kind: graph; profile: "sysml.bdd@1"; }
    layout { algorithm: layered; direction: right; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    exclude: [@m.flow_balance];
}

view ibd "Pump station internal block" {
    data: [@m];
    projection { kind: graph; profile: "sysml.ibd@1"; }
    layout { algorithm: layered; direction: right; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
    exclude: [@m.flow_balance];
}

view parametric "Pump station flow balance" {
    data: [@m];
    projection { kind: graph; profile: "sysml.parametric@1"; }
    layout { algorithm: layered; direction: right; }
    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }
}
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({'main.ddn':SRC,...changes});}
function run(changes={},view='ibd'){return workspace(changes).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code,check)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);if(check)check(e);return code?e.code===code:typeof e.code==='string';});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const squares=r=>(r.svg.match(/data-port-square="[^"]*"/g)||[]);
test('bdd view: two blocks and one assoc render; SVG contains the block names',()=>{const r=run({},'bdd');
 assert.match(r.svg,/<svg/);assert.equal(r.profiles.projection.profile,'sysml.bdd@1');
 for(const s of ['Pump','Reservoir','feeds'])assert.ok(r.svg.includes(s),'label missing: '+s);
 assert.ok(!r.svg.includes('flow = pressure'),'constraint must be excluded from the bdd view');
 assert.equal(r.scene.nodes.length,2,'expected exactly the two blocks');});
test('ibd view: sysml.flow between port members renders with a port square at each attachment point plus the flow label',()=>{const r=run();
 assert.equal(r.profiles.projection.profile,'sysml.ibd@1');
 const sq=squares(r);
 assert.equal(sq.length,2,'expected port squares at both flow attachment points');
 assert.ok(sq.some(s=>s.includes('m.pump.out')),'square at pump.out missing');
 assert.ok(sq.some(s=>s.includes('m.reservoir.in')),'square at reservoir.in missing');
 assert.ok(r.svg.includes('water'),'flow label missing');
 const flow=r.scene.routes.find(x=>x.id.endsWith('.water'));
 assert.ok(flow,'water route missing from scene');
 for(const [pt,sqAttr] of [[flow.points[0],'m.pump.out'],[flow.points.at(-1),'m.reservoir.in']]){
  const m=r.svg.match(new RegExp('data-port-square="[^"]*'+sqAttr.replace(/\./g,'\\.')+'" x="([\\d.-]+)" y="([\\d.-]+)" width="([\\d.-]+)"'));
  assert.ok(m,'square geometry for '+sqAttr+' missing');
  const cx=parseFloat(m[1])+parseFloat(m[3])/2,cy=parseFloat(m[2])+parseFloat(m[3])/2;
  assert.ok(Math.abs(cx-pt[0])<1&&Math.abs(cy-pt[1])<1,'square not centred at the route endpoint for '+sqAttr);
 }
 assert.equal(parseFloat((r.svg.match(/data-port-square="[^"]*"[^>]*?width="([\d.]+)"/)||[])[1]),10,'port square is 10×10·s at default scale');});
test('parametric view: a constraint bound by exactly two relations renders its formula text',()=>{const r=run({},'parametric');
 assert.equal(r.profiles.projection.profile,'sysml.parametric@1');
 assert.ok(r.svg.includes('{flow = pressure × area}'),'formula text missing');
 assert.ok(r.scene.nodes.some(n=>n.id.endsWith('.flow_balance')),'constraint scene node missing');});
test('A non-sysml.block object declaring a ports group under a sysml.* profile is rejected as DDN-PJ121',()=>{
 const files=edit('    relation feeds "feeds"','    object impostor "Impostor" { kind: "analysis.task"; ports { port p { direction: in; } } }\n    relation feeds "feeds"');
 throws(()=>run(files,'bdd'),'DDN-PJ121',
  e=>{assert.ok(e.message.includes('Impostor'),'message must name the element');assert.ok(e.message.includes('analysis.task'),'message must name the kind');});
 throws(()=>run(files),'DDN-PJ121');
 throws(()=>run(files,'parametric'),'DDN-PJ121');});
test('A parametric constraint touched by one (or three) visible relations is rejected as DDN-PJ122',()=>{
 throws(()=>run(edit('    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n}\n','    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    exclude: [@m.reservoir];\n}\n'),'parametric'),'DDN-PJ122',
  e=>{assert.ok(e.message.includes('flow = pressure'),'message must name the constraint');assert.ok(e.message.includes('1'),'message must state the actual count');});
 const three=edit('    relation bind_reservoir "binds reservoir" @flow_balance -> @reservoir { kind: "assoc"; }','    relation bind_reservoir "binds reservoir" @flow_balance -> @reservoir { kind: "assoc"; }\n    relation bind_extra "binds extra" @flow_balance -> @pump { kind: "assoc"; }');
 throws(()=>run(three,'parametric'),'DDN-PJ122',
  e=>assert.ok(e.message.includes('3'),'message must state the actual count'));});
test('sysml.flow targeting an unknown member is rejected as DDN031 (member-side rejection at reference resolution); a declared FIELD member is accepted by the verb contract but draws no port square on that endpoint',()=>{
 throws(()=>run(edit('@pump.out -> @reservoir.in','@pump.out -> @reservoir.nope')),'DDN031');
 const fielded=edit('    object pump "Pump" { kind: "sysml.block";','    object pump "Pump" { kind: "sysml.block"; fields { field rpm; }');
 fielded['main.ddn']=fielded['main.ddn'].replace('@pump.out -> @reservoir.in','@pump.rpm -> @reservoir.in');
 const r=run(fielded);
 const sq=squares(r);
 assert.equal(sq.length,1,'only the port endpoint draws a square (verb member_endpoints:true admits any declared member; documented behavior, no DDN102 since source/target are *)');
 assert.ok(sq[0].includes('m.reservoir.in'),'square must remain on the port endpoint');});
test('Regression: examples/basics/15-process-contracts.ddn (core ports, ddn@1 profile) renders without port squares',()=>{
 const dir=path.resolve(__dirname,'../../examples/basics');
 const w=A.createWorkspace({'main.ddn':fs.readFileSync(path.join(dir,'15-process-contracts.ddn'),'utf8'),'shared.ddn':fs.readFileSync(path.join(dir,'shared.ddn'),'utf8')});
 const r=w.renderSync({entry:'main.ddn',view:'balanced'});
 assert.match(r.svg,/<svg/);assert.ok(!r.profiles.projection.profile?.startsWith('sysml.'));
 assert.equal(squares(r).length,0,'non-sysml port rendering must stay pixel-unchanged (no port squares)');});
test('Repeated renders of each view are byte-identical',()=>{
 for(const view of ['bdd','ibd','parametric'])assert.equal(sha(run({},view).svg),sha(run({},view).svg),view+' render not deterministic');});
let pass=0;for(const r of results){if(r.pass)pass++;else console.error('FAIL',r.name,r.code,r.message);}
console.log(`SysML profiles ${pass}/${results.length}`);if(pass!==results.length)process.exitCode=1;
