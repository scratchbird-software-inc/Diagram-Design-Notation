/* SPDX-License-Identifier: GPL-2.0-or-later. B1-101 slice 1: sticky-note entities
 * (x_sticky colour/pin/tape decorations) and sagging 'string' relation routing,
 * exercised through the whiteboard workshop example. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),D=require('../runtime/ddn-core').default,R=require('../runtime/ddn-render').default,reg=require('../../standard/registry/catalogue.json');
const files={};for(const f of fs.readdirSync(path.join(root,'../website/examples/basics')).filter(f=>f.endsWith('.ddn')))files['examples/'+f]=fs.readFileSync(path.join(root,'../website/examples/basics',f),'utf8');
const entry='examples/109-whiteboard-workshop.ddn',checks=[];
function test(name,fn){try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',detail:e.stack});console.error(name,e.message);}}
function build(name,edit){const f={...files};if(edit)f[entry]=edit(f[entry]);const ir=D.build(f,entry,name,reg).ir,out=R.render(ir,reg);return {ir,...out};}
let wall;
test('Compile the whiteboard workshop view',()=>{wall=build('workshop');assert.equal(wall.scene.quality.errors.length,0);});
test('The sticky alias resolves to the note.sticky kind',()=>{const wallDecl=D.parse(files[entry],entry).declarations.find(d=>d.id==='wall');const stickies=wallDecl.children.filter(c=>c.props.kind==='note.sticky');assert.equal(stickies.length,6);});
test('Every sticky note renders through the sticky branch',()=>{assert.equal((wall.svg.match(/class="ddn-sticky"/g)||[]).length,6);});
test('Pin and tape decorations follow x_sticky exactly',()=>{assert.equal((wall.svg.match(/class="ddn-sticky-pin"/g)||[]).length,4);assert.equal((wall.svg.match(/class="ddn-sticky-tape"/g)||[]).length,4);});
test('Sticky colours come from the contract palette',()=>{for(const c of ['yellow','pink','blue','green','orange','purple'])assert(wall.svg.includes(`data-colour="${c}"`),c);});
test('Sticky notes carry no name header or kind chip',()=>{const names={goal:'Goal',customers:'Customers',tour:'Sample tour',pricing:'Pricing',risk:'Risks',actions:'Next steps'};for(const [id,name] of Object.entries(names)){const start=wall.svg.indexOf('data-id="ddn.examples.whiteboard-workshop::wall.'+id+'"');assert(start>=0,id);const end=wall.svg.indexOf('<g class="ddn-node',start+10);const body=wall.svg.slice(start,end<0?undefined:end);assert(!body.includes('>'+name+'<'),name);}});
test('Sticky body text is the description, not rows',()=>{assert(wall.svg.includes('What does a good Q3 look like?'));assert(!(wall.svg.match(/<g class="ddn-node ddn-kind-stky"[\s\S]*?<\/g>/)||[''])[0].includes('ddn-field'));});
test('All five relations route as string',()=>{assert.equal(wall.scene.routes.filter(r=>r.routing==='string').length,5);assert.equal((wall.svg.match(/data-routing="string"/g)||[]).length,5);});
test('String routes draw a single sagging cubic, not segments',()=>{const pieces=wall.svg.match(/data-route-pieces="1"><path d="M[^"]*C[^"]*"/g)||[];assert.equal(pieces.length,5);assert(!wall.svg.includes('NaN'));});
test('String curves span endpoint to endpoint of the corridor',()=>{for(const r of wall.scene.routes){const d=(wall.svg.match(new RegExp('data-id="'+r.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"[\\s\\S]*?d="M([^"]+)"'))||[])[1];assert(d,r.id);const m=d.match(/^([\d.-]+) ([\d.-]+)C.*?, ([\d.-]+) ([\d.-]+)$/);assert(m,r.id);assert.equal(+m[1],r.points[0][0]);assert.equal(+m[2],r.points[0][1]);assert.equal(+m[3],r.points.at(-1)[0]);assert.equal(+m[4],r.points.at(-1)[1]);}});
test('String render is deterministic',()=>{assert.equal(build('workshop').svg,wall.svg);});
test('Reject a colour outside the x_sticky enum',()=>assert.throws(()=>build('workshop',s=>s.replace('colour: yellow','colour: teal')),e=>/^DDN/.test(e.code||'')));
test('Reject string routing where it makes no sense is not special-cased: invalid routing values still fail',()=>assert.throws(()=>build('workshop',s=>s.replace('routing: string','routing: spaghetti')),e=>e.code==='DDN046'));
test('Sticky notes still reject field rows in the grammar',()=>{const o=build('workshop');for(const n of o.scene.nodes)assert.equal((n.fieldRows||[]).length,0);});
test('SVG export contains no scripts, external fonts or remote fetches',()=>{assert(!/<script[\s>]/i.test(wall.svg));assert(!/@font-face|https?:\/\/(?!www.w3.org)/.test(wall.svg));});
const report={release:D.VERSION,scope:'Sticky-note entities (x_sticky decorations) and string routing on the whiteboard workshop example. Not a certification of workshop-method semantics.',passed:checks.filter(c=>c.status==='pass').length,failed:checks.filter(c=>c.status==='fail').length,checks};
fs.mkdirSync(path.join(root,'validation'),{recursive:true});fs.writeFileSync(path.join(root,'validation/sticky-string.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
