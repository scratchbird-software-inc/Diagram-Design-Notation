/* SPDX-License-Identifier: GPL-2.0-or-later. DDN 0.8 fixed-lane interaction
 * occurrence/payload export closure (0.9 roadmap closure item, spec ch. 11):
 * redacted interaction export passes through the same allowlist projection
 * with whole-or-nothing occurrence rules — endpoints AND payload allowlisted
 * or the exchange drops; structural choreography survives; free-text notes
 * drop; DDN-I033 on an empty closure or an unprojected request. */
'use strict';
require('../runtime/ddn-core.js');
const I=require('../runtime/ddn-interaction.js').default,Export=require('../runtime/ddn-export.js').default;
const DDN=require('../runtime/ddn-module-registry.js').namespace('DDN');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const reg=JSON.parse(fs.readFileSync(path.join(root,'../standard/registry/catalogue.json'),'utf8'));
const defs=fs.readFileSync(path.join(root,'../standard/registry/glyph-library.svg'),'utf8').match(/<defs>([\s\S]*?)<\/defs>/)[1];
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const code=fn=>{try{fn();return null;}catch(e){return e.code;}};

/* Minimal fixed-lane workspace: two participants, two payload contracts,
 * three exchanges (one reply) plus a free-text note on every exchange. */
const MODEL='ddn "0.6";\nmodule "m";\ndata actors {\n object app "Client" { kind: application; x_protocol_role: "app"; x_zone: "client"; }\n object srv "Server" { kind: application; x_protocol_role: "engine"; x_zone: "server"; }\n}\ndata messages {\n object hello "Hello contract" { kind: message; }\n object token_msg "Token contract" { kind: message; }\n}\ndata exchanges {\n relation e1 @actors.app -> @actors.srv { kind: flow; x_protocol: { sequence: "seq.v1", step: "hello", display_order: 1, after: [], phase: "A", form: "request", payload: @messages.hello, note: "free-text guard note one" }; }\n relation e2 @actors.srv -> @actors.app { kind: flow; x_protocol: { sequence: "seq.v1", step: "challenge", display_order: 2, after: [@exchanges.e1], phase: "A", form: "challenge", payload: @messages.token_msg, reply_to: @exchanges.e1, note: "free-text guard note two" }; }\n relation e3 @actors.app -> @actors.srv { kind: flow; x_protocol: { sequence: "seq.v1", step: "answer", display_order: 3, after: [@exchanges.e2], phase: "A", form: "response", payload: @messages.hello, reply_to: @exchanges.e2, note: "free-text guard note three" }; }\n}';
const VIEW=allow=>'ddn "0.6";\nmodule "v";\nimport "m.ddn" as m;\nview auth "Exchange" {\n data: [@m.actors, @m.messages, @m.exchanges];\n layout { algorithm: grid; x_interaction: "session-bootstrap@0.1"; x_sequence: "seq.v1"; }\n legend { mode: numbers; placement: right; keys: { "exchanges.e1": 1, "exchanges.e2": 2, "exchanges.e3": 3 }; }\n select: [@m.actors.app, @m.actors.srv];\n publication { width: 1840px; height: 600px; }\n'+(allow?' export { mode: redacted; elements: ['+allow+']; fields: []; identifier_mode: opaque; title: "Allowlisted exchange"; }\n':'')+'}\n';
const filesFor=v=>({'m.ddn':MODEL,'v.ddn':v});
const ALL='@m.actors.app, @m.actors.srv, @m.messages.hello, @m.messages.token_msg';

test('full interaction render is unaffected by the closure work',()=>{
 const ir=DDN.build(filesFor(VIEW(null)),'v.ddn','auth',reg).ir;
 const out=I.render(ir,reg,defs);
 assert.ok(out.svg.length>1000&&out.scene.messageRows.length===3,'3 exchanges paint');
});

test('redacted interaction export flows through the closure and renders',()=>{
 const ir=DDN.build(filesFor(VIEW(ALL)),'v.ddn','auth',reg).ir;
 const out=I.render(ir,reg,defs);
 assert.equal(out.scene.messageRows.length,3,'all exchanges survive a complete allowlist');
 assert.ok(out.scene.messageRows.every(r=>r.payload.startsWith('published::n')),'payload contracts aliased opaque');
 const proj=Export.project(ir);
 for(const r of proj.relations){
  const m=r.properties.x_protocol;
  assert.ok(m&&m.sequence&&m.step&&m.display_order&&m.phase&&m.form,'structural choreography kept');
  assert.ok(!('note' in m),'free-text note dropped by the closure');
 }
 assert.ok(proj.view.profiles.layout.x_interaction==='session-bootstrap@0.1'&&proj.view.profiles.layout.x_sequence==='seq.v1','structural layout config survives the x_ strip');
 assert.ok(proj.elements.every(e=>!e.properties.x_protocol_role||typeof e.properties.x_protocol_role==='string'),'participant roles survive');
});

test('whole-or-nothing: a non-allowlisted payload drops the exchange, never partially',()=>{
 const proj=Export.project(DDN.build(filesFor(VIEW('@m.actors.app, @m.actors.srv, @m.messages.hello')),'v.ddn','auth',reg).ir);
 const steps=proj.relations.map(r=>r.properties.x_protocol.step);
 assert.deepEqual(steps,['hello','answer'],'challenge dropped with its token_msg payload; the two hello-payload exchanges survive');
});

test('DDN-I033: empty closure and unprojected redacted requests are coded errors',()=>{
 assert.equal(code(()=>I.render(DDN.build(filesFor(VIEW('@m.actors.app, @m.actors.srv')),'v.ddn','auth',reg).ir,reg,defs)),'DDN-I033','no exportable exchanges');
 assert.equal(code(()=>I.validate(DDN.build(filesFor(VIEW(ALL)),'v.ddn','auth',reg).ir)),'DDN-I033','validate rejects an unprojected redacted IR');
});

test('policy violations keep their existing codes (no bypass)',()=>{
 const ir=DDN.build(filesFor(VIEW(ALL)),'v.ddn','auth',reg).ir;
 ir.view.profiles.export={mode:'redacted',elements:['m::nope'],fields:[],identifier_mode:'opaque'};
 assert.equal(code(()=>Export.project(ir)),'DDN151','unresolved allowlist entry');
 assert.equal(code(()=>Export.project(DDN.build(filesFor(VIEW(ALL)),'v.ddn','auth',reg).ir)),null,'well-formed policy passes the gate');
});

console.log(results.filter(r=>r.pass).length+'/'+(results.length)+' interaction-export tests passed');
