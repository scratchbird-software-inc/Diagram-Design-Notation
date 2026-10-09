/* SPDX-License-Identifier: GPL-2.0-or-later. Explicit appearance-aware diff. */
'use strict';const D=require('../runtime/ddn-core.js').default,R=require('../runtime/ddn-render.js').default,assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const reg=JSON.parse(fs.readFileSync(path.join(__dirname,'../../standard/registry/catalogue.json'),'utf8'));
const source=(extraA='',extraB='',scope='appearance')=>'ddn "0.7";module "m";data d {object a {kind:object;}object b {kind:object;}relation r @a -> @b {kind:assoc;}}view a {data:[@d];select:[@d.a,@d.a#2,@d.b];'+extraA+'}view b {data:[@d];select:[@d.a,@d.a#2,@d.b];'+extraB+'}view comparison {diff:[@a,@b];diff_scope:'+scope+';publication {size:content;}}';
const build=(a,b,s)=>D.build({'m.ddn':source(a,b,s)},'m.ddn','comparison',reg).ir;
let passed=0,total=0;function test(n,f){total++;try{f();passed++;console.log('PASS',n);}catch(e){process.exitCode=1;console.error('FAIL',n,e.stack);}}
test('identical appearances in different views compare unchanged',()=>{assert.deepEqual(build().view.diff.counts,{added:0,removed:0,changed:0,unchanged:3});});
test('one appearance colour or pin change leaves siblings unchanged',()=>{for(const prop of ['opacity:0.5;','at:[20px,40px];'])assert.deepEqual(build('','place @d.a#2 {'+prop+'}').view.diff.counts,{added:0,removed:0,changed:1,unchanged:2});});
test('hidden appearance is removed from the comparison',()=>{assert.deepEqual(build('','exclude:[@d.a#2];').view.diff.counts,{added:0,removed:1,changed:0,unchanged:2});});
test('appearance endpoint changes classify relation as changed',()=>{const ir=build('route @d.r {from:@d.a#1;to:@d.b#1;}','route @d.r {from:@d.a#2;to:@d.b#1;}');assert.equal(ir.relations[0].diffState,'changed');});
test('ordinary model diff retains semantic matching',()=>{assert.deepEqual(build('','place @d.a#2 {opacity:0.5;}','model').view.diff.counts,{added:0,removed:0,changed:0,unchanged:2});});
test('invalid scope rejects',()=>assert.throws(()=>build('','','other'),e=>e.code==='DDN-DF01'));
test('union of repeated appearances renders as distinct nodes',()=>{const result=R.render(build('','place @d.a#2 {opacity:0.5;}'),reg,'');assert.equal(result.scene.nodes.length,3);assert.equal(new Set(result.scene.nodes.map(n=>n.id)).size,3);});
test('same qualified endpoint ordinals in different operand views compare unchanged',()=>{const route='route @d.r {from:@d.a#2;to:@d.b#1;}';assert.equal(build(route,route).relations[0].diffState,'unchanged');});
console.log(`Appearance diff: ${passed}/${total} passed`);
