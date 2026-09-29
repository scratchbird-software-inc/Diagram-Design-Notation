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

/* B1-087: every icon in every shipped library — sanitize, size, render smoke. */
const fs2=require('node:fs'),path2=require('node:path');
const LIBS=JSON.parse(fs2.readFileSync(path2.resolve(__dirname,'..','..','standard','registry','icon-libraries.json'),'utf8')).libraries;
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

const failed=results.filter(r=>!r.pass);
console.log('icons-compliance:',results.length-failed.length+'/'+results.length,'passed');
if(failed.length){console.error(failed.map(f=>f.name+' ['+f.code+'] '+f.message).join('\n'));process.exit(1);}
