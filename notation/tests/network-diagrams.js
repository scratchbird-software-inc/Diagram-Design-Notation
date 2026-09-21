/* SPDX-License-Identifier: GPL-2.0-or-later. Network diagrams: network.basic@1/network.rack@1 bus attachments and rack slots (DDN-PJ127), original glyphs, DDN046 guards intact. */
'use strict';
const A=require('../dist/ddn.global.js'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../../website/examples/basics'),FILE='54-network-diagram.ddn',base={[FILE]:fs.readFileSync(dir+'/'+FILE,'utf8'),'shared.ddn':fs.readFileSync(dir+'/shared.ddn','utf8')};
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function workspace(changes={}){return A.createWorkspace({...base,...changes});}
function run(view='lan',changes={}){return workspace(changes).renderSync({entry:FILE,view});}
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});
const editFile=(before,after)=>{assert.ok(base[FILE].includes(before),'Mutation target missing: '+before);return{[FILE]:base[FILE].replace(before,after)};};
test('LAN view renders bus, switch, two servers and uplink; attachments are plain edges; new glyph symbols present',()=>{const r=run();
 for(const s of ['Office bus','Core switch','File server','App server','Uplink router'])assert.ok(r.svg.includes(s),'SVG missing '+s);
 assert.ok(!r.svg.includes('marker-end')&&!r.svg.includes('marker-start'),'attachment edges render without arrowheads');
 for(const g of ['g-network-bus','g-network-switch','g-network-server','g-network-rack'])assert.ok(r.svg.includes('id="'+g+'"'),'SVG defs missing '+g);
 assert.ok(r.svg.includes('attaches to'),'attachment labels render');});
test('Rack view renders the rack frame with both device members stacked bottom-up',()=>{const r=run('rack');
 for(const s of ['Rack A (4U)','File server','App server'])assert.ok(r.svg.includes(s),'SVG missing '+s);
 assert.ok(r.scene.nodes.length>=2,'frame members render as nodes');});
test('Glyph library and catalogue register the four original network glyphs and kinds reference them',()=>{
 const lib=fs.readFileSync(path.resolve(__dirname,'../../standard/registry/glyph-library.svg'),'utf8');
 for(const g of ['g-network-bus','g-network-switch','g-network-server','g-network-rack'])assert.ok(lib.includes('<symbol id="'+g+'"'),'glyph-library.svg missing '+g);
 const cat=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../standard/registry/catalogue.json'),'utf8'));
 for(const g of ['network-bus','network-switch','network-server','network-rack'])assert.deepEqual(cat.glyphs[g],{base:g,viewBox:'0 0 24 24'},'catalogue glyphs missing '+g);
 const pc=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../standard/registry/profiles/catalogue.json'),'utf8'));
 for(const [k,g] of [['network.bus','network-bus'],['network.switch','network-switch'],['network.server','network-server'],['network.rack','network-rack']])assert.equal(pc.kinds.find(x=>x.keyword===k)?.glyph,g,'kind '+k+' does not reference glyph '+g);});
test('network.attaches targeting a plain element (not a bus, no port member) rejected as DDN-PJ127',()=>{
 const e=editFile('    relation attach_switch "attaches to" @core_switch -> @office_bus { kind: "network.attaches"; }','    relation attach_switch "attaches to" @core_switch -> @uplink { kind: "network.attaches"; }');
 throws(()=>run('lan',e),'DDN-PJ127');
 assert.throws(()=>run('lan',e),e=>e.message.includes('attach')&&e.message.includes('network.bus'),'message names the relation and the rule');});
test('network.attaches targeting a port member passes (file_server.eth0 and core_switch.wan)',()=>{
 const r=run();assert.ok(r.svg.includes('File server')&&r.svg.includes('Uplink router'),'port-member attachments render');});
test('Rack slot above the rack height and duplicate slots rejected as DDN-PJ127',()=>{
 const high=editFile('x_rack: { unit: 1 };','x_rack: { unit: 5 };');
 throws(()=>run('rack',high),'DDN-PJ127');
 assert.throws(()=>run('rack',high),e=>e.message.includes('File server')&&e.message.includes('5')&&e.message.includes('4'),'message names the device, slot and rack height');
 const dup=editFile('x_rack: { unit: 3 };','x_rack: { unit: 1 };');
 throws(()=>run('rack',dup),'DDN-PJ127');
 assert.throws(()=>run('rack',dup),e=>e.message.includes('unique'),'message names the uniqueness rule');});
test('Routing guards intact: junctions:auto and shared_segments:declared still rejected as DDN046',()=>{
 throws(()=>run('lan',editFile('layout { algorithm: layered; direction: down; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    place @m.office_bus','layout { algorithm: layered; direction: down; junctions: auto; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    place @m.office_bus')),'DDN046');
 throws(()=>run('lan',editFile('layout { algorithm: layered; direction: down; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    place @m.office_bus','layout { algorithm: layered; direction: down; shared_segments: declared; }\n    publication { size: content; fit: none; overflow: error; minimum_text: 8pt; }\n    place @m.office_bus')),'DDN046');});
test('Repeated render of each view is byte-identical',()=>{
 assert.equal(run().svg,run().svg);
 assert.equal(run('rack').svg,run('rack').svg);});
const passed=results.filter(r=>r.pass).length;console.log(`Network diagrams ${passed}/${results.length}`);if(passed!==results.length)process.exitCode=1;
