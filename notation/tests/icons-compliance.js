/* SPDX-License-Identifier: GPL-2.0-or-later. B1-082: icon-library mechanism fixtures. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict');
const P=globalThis.__DDN_MODULE_REGISTRY__.namespaces.DDNProfiles;
const SRC=`ddn "0.5";
module "test.icons";
data m {
    object lan "Office LAN" { kind: "network.bus"; }
    object srv "App server" { kind: "network.server"; }
    object rack "Data rack" { kind: "network.rack"; }
    object guest "Guest user" { kind: "network.server"; x_icon: { library: "generic-demo@1", icon: "user" }; }
    relation a1 "" @srv -> @lan { kind: "network.attaches"; }
    relation a2 "" @rack -> @lan { kind: "network.attaches"; }
    relation a3 "" @guest -> @lan { kind: "network.attaches"; }
}
view net "Net" { data: [@m]; projection { kind: graph; profile: "network.basic@1"; } publication { size: content; fit: none; overflow: error; minimum_text: 8pt; } }
`;
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,code:e.code,message:e.message});console.error('FAIL',name,e.stack);}}
function run(view='net',changes={}){return A.createWorkspace({'main.ddn':SRC,...changes}).renderSync({entry:'main.ddn',view});}
const edit=(before,after)=>{assert.ok(SRC.includes(before),'Mutation target missing: '+before);return{'main.ddn':SRC.replace(before,after)};};
const throws=(fn,code)=>assert.throws(fn,e=>{if(code&&e.code!==code)console.error('Expected',code,'got',e.code,e.message);return code?e.code===code:typeof e.code==='string';});

test('default bindings draw icons on network kinds (bus→cloud, server→server, rack→database)',()=>{const r=run();
 /* B1-087: network-generic@1 precedes the demo set, so its bindings win. */
 for(const ic of ['network-generic@1/cloud','network-generic@1/server','network-generic@1/database'])assert.ok(r.svg.includes('data-icon="'+ic+'"'),'missing binding: '+ic);});
test('explicit x_icon override renders the named icon',()=>{const r=run();
 assert.ok(r.svg.includes('data-icon="generic-demo@1/user"'),'user icon missing');});
test('icon ids are namespaced per node (no id collisions)',()=>{const r=run();
 assert.ok(r.svg.includes('ic-'),'namespace prefix missing');});
test('unknown icon reference (DDN-PJ206)',()=>{
 throws(()=>run('net',edit('icon: "user"','icon: "nope"')),'DDN-PJ206');
 throws(()=>run('net',edit('library: "generic-demo@1"','library: "nope@1"')),'DDN-PJ206');});
test('sanitization rejects scripts, foreignObject, handlers, external refs',()=>{
 const cases=[
  ['<svg><script>alert(1)</script></svg>','script'],
  ['<svg><foreignObject/></svg>','foreignObject'],
  ['<svg><rect onclick="x()"/></svg>','event handler'],
  ['<svg><rect onload="x()"/></svg>','onload handler'],
  ['<svg><image href="http://evil.example/x.png"/></svg>','external image'],
  ['<svg><a href="https://evil.example">x</a></svg>','external href'],
  ['<svg><a xlink:href="https://evil.example">x</a></svg>','xlink href'],
  ['<svg><rect fill="url(http://evil.example/g.svg)"/></svg>','external url()'],
  ['<svg><text>javascript:alert(1)</text></svg>','javascript: text is inert'],
 ];
 for(const [svg,label] of cases.slice(0,8))assert.ok(P.sanitizeIcon({id:'lib'},{id:'x',svg}),label+' must be rejected');
 assert.ok(!P.sanitizeIcon({id:'lib'},{id:'x',svg:'<svg><text>fine</text></svg>'}),'clean icon must pass');});
test('sanitization rejects non-SVG and oversized assets',()=>{
 assert.ok(P.sanitizeIcon({id:'lib'},{id:'x',svg:'not svg'}),'non-SVG must be rejected');
 assert.ok(P.sanitizeIcon({id:'lib'},{id:'x',svg:'<svg>'+'x'.repeat(21000)+'</svg>'}),'oversize must be rejected');});

/* B1-087/B1-088: every icon in every shipped pack — sanitize, size, render smoke. */
const fs2=require('node:fs'),path2=require('node:path');
const PACKDIR=path2.resolve(__dirname,'..','..','standard','registry','icon-packs');
const PACKIDX=JSON.parse(fs2.readFileSync(path2.join(PACKDIR,'index.json'),'utf8'));
const PACKS=PACKIDX.packs.map(f=>JSON.parse(fs2.readFileSync(path2.join(PACKDIR,f),'utf8')));
const LIBS=PACKS.map(p=>({id:p.id,name:p.name,icons:p.icons}));
test('every shipped icon passes PJ207 sanitization and the 20 KiB cap',()=>{
 for(const lib of LIBS)for(const icon of lib.icons){
  assert.ok(icon.svg.length<=20480,lib.id+'/'+icon.id+' exceeds 20 KiB');
  assert.ok(icon.svg.length<=4096,lib.id+'/'+icon.id+' exceeds the 4 KiB quality bar');
  const bad=P.sanitizeIcon({id:lib.id},icon);
  assert.ok(!bad,lib.id+'/'+icon.id+' rejected: '+bad);
 }});
test('every icon renders inside a node (one smoke view per library)',()=>{
 for(const lib of LIBS){
  const objects=lib.icons.map((ic,i)=>`    object n${i} "${ic.name.replace(/"/g,'')}" { kind: "network.server"; x_icon: { library: "${lib.id}", icon: "${ic.id}" }; }`).join('\n');
  const src=`ddn "0.5";\nmodule "test.iconsmoke";\ndata m {\n${objects}\n}\nview d "D" { data: [@m]; projection { kind: graph; profile: "network.basic@1"; } layout { algorithm: grid; columns: 6; } publication { size: content; fit: none; } }\n`;
  const r=A.createWorkspace({'main.ddn':src}).renderSync({entry:'main.ddn',view:'d'});
  for(const ic of lib.icons)assert.ok(r.svg.includes('data-icon="'+lib.id+'/'+ic.id+'"'),lib.id+'/'+ic.id+' did not render');
 }});
test('library kind bindings point at registered kinds',()=>{
 const cat=JSON.parse(fs2.readFileSync(path2.resolve(__dirname,'..','..','standard','registry','profiles','catalogue.json'),'utf8'));
 const known=new Set(cat.kinds.map(k=>k.keyword));
 for(const lib of LIBS)for(const icon of lib.icons)for(const k of icon.kinds||[])assert.ok(known.has(k),lib.id+'/'+icon.id+' binds unknown kind '+k);
});

/* B1-088: pack manifests, schema shape, licenses, and the host-pack API. */
const SCHEMA=JSON.parse(fs2.readFileSync(path2.resolve(__dirname,'..','..','standard','schemas','icon-pack.schema.json'),'utf8'));
test('every shipped pack conforms to the icon-pack schema (required fields, formats, grid, icon entries)',()=>{
 assert.equal(SCHEMA.$id,'urn:ddn:schema:icon-pack:1');
 const req=SCHEMA.required;
 for(const p of PACKS){
  for(const f of req)assert.ok(p[f]!==undefined,p.id+' missing manifest field '+f);
  assert.equal(p.format,'ddn-icon-pack@1');
  assert.match(p.id,/^[a-z0-9][a-z0-9-]*@[0-9]+$/,p.id+' id form');
  assert.match(p.version,/^[0-9]+\.[0-9]+\.[0-9]+$/,p.id+' version form');
  assert.ok(Number.isInteger(p.grid.size)&&p.grid.strokeWidth>0,p.id+' grid');
  assert.ok(p.icons.length>=1,p.id+' has icons');
  const seen=new Set();
  for(const ic of p.icons){
   for(const f of SCHEMA.$defs.icon.required)assert.ok(ic[f]!==undefined,p.id+'/'+ic.id+' missing '+f);
   assert.match(ic.id,/^[a-z0-9][a-z0-9-]*$/);
   assert.ok(ic.svg.startsWith('<svg')&&ic.svg.length<=20480);
   assert.ok(!/<svg\b[^>]*\s(width|height)=/.test(ic.svg),p.id+'/'+ic.id+' root must not carry width/height (embedding sets them; duplicates break XML parsing)');
   assert.ok(!seen.has(ic.id),'duplicate '+p.id+'/'+ic.id);seen.add(ic.id);
   const vb=(ic.svg.match(/viewBox="0 0 (\d+) \1"/)||[])[0];
   assert.equal(vb,'viewBox="0 0 '+p.grid.size+' '+p.grid.size+'"',p.id+'/'+ic.id+' viewBox off the pack grid');
  }
 }
});
test('license and attribution fields are present; MIT packs carry the license text and copyright',()=>{
 for(const p of PACKS){
  assert.ok(p.license&&p.attribution&&p.source,p.id+' license/attribution/source');
  if(p.license==='MIT'){
   assert.ok(p.licenseText.includes('MIT License')&&p.licenseText.includes('Permission is hereby granted'),p.id+' MIT text');
   assert.ok(p.attribution.includes('Copyright'),p.id+' attribution copyright');
  }
 }
 const tabler=PACKS.find(p=>p.id==='tabler-infra@1'),iconoir=PACKS.find(p=>p.id==='iconoir-infra@1');
 assert.ok(tabler&&tabler.attribution.includes('Paweł Kuna'),'tabler attribution');
 assert.ok(iconoir&&iconoir.attribution.includes('Luca Burgio'),'iconoir attribution');
});
const GOODPACK={format:'ddn-icon-pack@1',id:'acme-test@1',name:'Acme test pack',version:'1.0.0',license:'MIT',attribution:'Copyright Acme',source:'https://example.invalid/acme',grid:{size:24,strokeWidth:1.6},icons:[{id:'dot',name:'Dot',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="6"/></svg>'}]};
const PACKSRC=()=>`ddn "0.5";
module "test.extpack";
data m {
    object n0 "Host node" { kind: "network.server"; x_icon: { library: "acme-test@1", icon: "dot" }; }
}
view d "D" { data: [@m]; projection { kind: graph; profile: "network.basic@1"; } publication { size: content; fit: none; } }
`;
test('host-supplied pack registers, renders, and unregisters (B1-088 API)',()=>{
 assert.equal(typeof A.registerIconPack,'function','registerIconPack exported');
 A.registerIconPack(GOODPACK);
 try{
  const r=A.createWorkspace({'main.ddn':PACKSRC()}).renderSync({entry:'main.ddn',view:'d'});
  assert.ok(r.svg.includes('data-icon="acme-test@1/dot"'),'external pack icon did not render');
 }finally{assert.ok(A.unregisterIconPack('acme-test@1'),'unregister');}
 throws(()=>A.createWorkspace({'main.ddn':PACKSRC()}).renderSync({entry:'main.ddn',view:'d'}),'DDN-PJ206');});
test('external pack registration rejects malformed manifests and duplicates (DDN-PJ206)',()=>{
 const cases=[
  [{},'empty pack'],
  [{...GOODPACK,format:'nope@1'},'wrong format'],
  [{...GOODPACK,id:'Bad ID@1'},'bad id form'],
  [{...GOODPACK,version:'1'},'bad version'],
  [{...GOODPACK,icons:[]},'no icons'],
  [{...GOODPACK,icons:[{id:'dot',name:'Dot'}]},'icon missing svg'],
  [{...GOODPACK,icons:[{id:'dot',name:'A',svg:GOODPACK.icons[0].svg},{id:'dot',name:'B',svg:GOODPACK.icons[0].svg}]},'duplicate icon id'],
  [{...GOODPACK,id:'network-generic@1'},'shipped pack id'],
 ];
 for(const [pack,label] of cases)assert.throws(()=>A.registerIconPack(pack),e=>{if(e.code!=='DDN-PJ206')console.error(label,'got',e.code,e.message);return e.code==='DDN-PJ206';},label);
 A.registerIconPack(GOODPACK);
 assert.throws(()=>A.registerIconPack(GOODPACK),e=>e.code==='DDN-PJ206','re-registration must fail');
 A.unregisterIconPack('acme-test@1');});
test('external pack icons are sanitized identically (DDN-PJ207)',()=>{
 const evil={...GOODPACK,icons:[{id:'evil',name:'Evil',svg:'<svg><script>alert(1)</script></svg>'}]};
 assert.throws(()=>A.registerIconPack(evil),e=>e.code==='DDN-PJ207','script icon must be rejected at registration');
});

const failed=results.filter(r=>!r.pass);
console.log('icons-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
