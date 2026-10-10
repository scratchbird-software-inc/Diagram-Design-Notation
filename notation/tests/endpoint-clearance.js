/* SPDX-License-Identifier: GPL-2.0-or-later.
 * Four dropped entities: adding a second outgoing link must try clear body
 * sides before rejecting the user's edit, without moving the entities. */
'use strict';
const assert=require('node:assert/strict'),L=require('../runtime/ddn-layout.js').default;
class Diagnostic extends Error {constructor(code,message){super(message);this.code=code;}}
const nodes=[{id:'a',x:-322,y:72,w:270,h:100},{id:'b',x:-615,y:-66,w:270,h:100},{id:'c',x:-301,y:-68,w:270,h:100},{id:'d',x:9,y:-38,w:270,h:100}];
const relations=[{id:'r',from:{element:'a'},to:{element:'b'}},{id:'s',from:{element:'a'},to:{element:'c'}}];
const profiles={layout:{direction:'right',routing:'orthogonal',object_clearance:16,edge_clearance:12,port_clearance:28}};
const render=(rs=relations,hints={},ns=nodes)=>L.routing(ns,rs,profiles,hints,()=>({w:110,h:30}),Diagnostic);
const snapshot=JSON.stringify({nodes,relations,profiles});
assert.equal(render(relations.slice(0,1)).routes.length,1);
const two=render();assert.equal(two.routes.length,2);assert.deepEqual(two.quality.errors,[]);
assert.equal(JSON.stringify({nodes,relations,profiles}),snapshot,'repair cannot mutate geometry or model');
assert.deepEqual(render(),two,'fallback is deterministic');
for(const transform of [n=>({...n,x:n.x+1000,y:n.y+1000}),n=>({...n,x:-n.x-n.w}),n=>({...n,y:-n.y-n.h})]){
 const result=render(relations,{},nodes.map(transform));assert.equal(result.routes.length,2);assert.deepEqual(result.quality.errors,[]);
}
for(const hint of [{target_side:'west'},{target_fraction:.5},{x_target_fraction:.5},{via:[],policy:'strict'}]){
 const hints={s:hint},before=JSON.stringify(hints);
 assert.throws(()=>render(relations,hints),e=>e.code==='DDN212','Authored attachment must not be changed');
 assert.equal(JSON.stringify(hints),before);
}
const memberRels=structuredClone(relations);memberRels[1].to.member='field';
const memberNodes=structuredClone(nodes);memberNodes[2].fieldRows=[{id:'field',top:0,h:100}];
assert.throws(()=>render(memberRels,{},memberNodes),e=>e.code==='DDN212','Member attachments must remain bound');
console.log('Endpoint clearance regression passed: second link, fixed geometry, determinism, reflections, authored constraints and member identity');
