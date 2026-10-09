/* SPDX-License-Identifier: GPL-2.0-or-later. Source-preserving DDNA rule authoring. */
'use strict';const fs=require('node:fs'),assert=require('node:assert/strict'),A=require('../dist/ddn.global.js'),R=require('../tool/src/rule-editor.js');
const src=fs.readFileSync(require('node:path').join(__dirname,'../../standard/examples/decision-discount.ddna'),'utf8');
function features(text){const out={keel:[]};const walk=n=>{if(n.props?.x_profile)out.profile=n.props.x_profile;if(n.props?.x_keel)out.keel.push(n.props.x_keel);for(const c of n.children||[])walk(c);};A.parse(text,'r.ddna').declarations.forEach(walk);return out;}
const rewrite=f=>R.rewrite(src+'\n// Keep unrelated text\ndata extra {object keep {kind:object;description:"Retain me";}}\n',f,A.parse,A.lex,A.authoring.value);
let total=0,passed=0;function test(n,f){total++;try{f();passed++;console.log('PASS',n);}catch(e){process.exitCode=1;console.error('FAIL',n,e.stack);}}
test('changes a rule policy and expression without deleting unrelated declarations',()=>{const f=features(src);f.profile.nodes[1].table.hit_policy='collect';f.keel.find(k=>k.id==='net_expr').body='gross * 0.8';const text=rewrite(f),back=features(text);assert.equal(back.profile.nodes[1].table.hit_policy,'collect');assert.equal(back.keel.find(k=>k.id==='net_expr').body,'gross * 0.8');assert.match(text,/Keep unrelated text/);assert.match(text,/Retain me/);});
test('adds new expressions in a fresh data block',()=>{const f=features(src);f.keel.push({id:'additional',language:'keel-l0@1',body:'42'});assert.equal(features(rewrite(f)).keel.find(k=>k.id==='additional').body,'42');});
test('deleted expression removes only its property',()=>{const f=features(src);f.keel=f.keel.filter(k=>k.id!=='net_expr');const text=rewrite(f);assert.ok(!features(text).keel.some(k=>k.id==='net_expr'));assert.match(text,/object net_expression/);});
test('ambiguous profile carriers are rejected',()=>{assert.throws(()=>R.rewrite(src+' data other {object profile {x_profile:{name:"other";};}}',features(src),A.parse,A.lex,A.authoring.value),/exactly one/);});
console.log(`Rule editor: ${passed}/${total} passed`);
