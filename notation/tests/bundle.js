/* SPDX-License-Identifier: GPL-2.0-or-later. RFC-117 D4/D5: io.bundle + CLI bundle, byte-identical render round-trip. */
'use strict';
const A=require('../dist/ddn.global.js'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);process.exitCode=1;}}
const root=path.resolve(__dirname,'../..');
function collect(dir,entry){const abs=path.resolve(root,dir);const files={};(function v(p){if(files[p])return;const t=fs.readFileSync(path.join(abs,p),'utf8');files[p]=t;for(const imp of A.parse(t,p).imports){const next=path.posix.normalize(path.posix.join(path.posix.dirname(p),imp.path));if(fs.existsSync(path.join(abs,next)))v(next);}})(entry);return files;}
function viewsOf(files){const out=[];for(const [p,text]of Object.entries(files))for(const s of A.parse(text,p).sections)for(const n of s.declarations)if(n.type==='view')out.push(n.id);return out;}
// D5 acceptance core: fixed workspace list incl. projections + quality.
const WORKSPACES=[
 {dir:'website/examples/basics',entry:'01-customer.ddn'},
 {dir:'website/examples/basics',entry:'17-curved-relations.ddn'},
 {dir:'website/examples/projections',entry:'views.ddn'},
 {dir:'website/examples/quality',entry:'views.ddn'},
];
let roundTrips=0,bytes=0;
for(const w of WORKSPACES){
 const files=collect(w.dir,w.entry),views=viewsOf(files);
 test('Bundle round-trip byte-identical: '+w.dir+'/'+w.entry+' ('+views.length+' views)',()=>{
  const {text,diagnostics}=A.io.bundle(files,w.entry);
  assert.equal(diagnostics.filter(d=>d.severity==='warning').length,0,'unexpected warnings: '+JSON.stringify(diagnostics));
  assert.ok(text.startsWith('ddn "'));
  assert.ok(text.includes('module "'));
  // check-equivalent: every view of the bundle resolves through the live API
  const bundled=A.createWorkspace({'bundled.ddn':text});
  const original=A.createWorkspace(files);
  for(const view of views){
   const a=original.renderSync({entry:w.entry,view}).svg;
   const b=bundled.renderSync({entry:'bundled.ddn',view}).svg;
   assert.equal(b,a,'render differs for view '+view);
   roundTrips++;bytes+=a.length;
  }
 });
 test('Bundle deterministic: '+w.dir+'/'+w.entry,()=>{
  const a=A.io.bundle(files,w.entry).text,b=A.io.bundle(files,w.entry).text;
  assert.equal(a,b);
 });
}
test('Round-trip proof size recorded',()=>{assert.ok(roundTrips>=60,'expected at least 60 view round-trips, got '+roundTrips);console.log(`  round-trip proof: ${roundTrips} views, ${bytes} SVG bytes compared`);});

test('Section bodies preserve comments and formatting',()=>{
 const files=collect('website/examples/basics','09-look-comparison.ddn');
 const {text}=A.io.bundle(files,'09-look-comparison.ddn');
 assert.ok(text.includes('// One model, three renderings. No at coordinates or manual route waypoints.'),'comment lost');
 assert.ok(text.includes('kind: table;'));
});

test('Dropped inter-bundled imports are canonicalized to module-qualified sibling references',()=>{
 const files=collect('website/examples/basics','01-customer.ddn');
 const {text}=A.io.bundle(files,'01-customer.ddn');
 assert.ok(!text.includes('import "customer-data.ddn"'),'inter-bundle import kept');
 assert.ok(!text.includes('@customer.model'),'alias reference not canonicalized');
 assert.ok(text.includes('@ddn.examples.customer-data.model'));
});

test('External imports kept at top with warning diagnostic (DDN-W013)',()=>{
 const files={
  'main.ddn':'ddn "0.5";\nmodule "m";\nimport "local.ddn" as local;\nimport "ext.ddn" as ext;\nview v { data: [@local.d]; publication { size: content; fit: none; } }\n',
  'local.ddn':'ddn "0.5";\nmodule "l";\ndata d { object o { kind: table; } }\n'};
 const {text,diagnostics}=A.io.bundle(files,'main.ddn');
 assert.ok(diagnostics.some(d=>d.code==='DDN-W013'&&d.message.includes('ext.ddn')));
 assert.ok(text.includes('import "ext.ddn" as ext;'));
 assert.ok(text.indexOf('import "ext.ddn" as ext;')<text.indexOf('module "'));
 assert.ok(!text.includes('import "local.ddn"'),'bundled import kept');
 // the bundle still checks: ext.ddn supplied alongside
 const ws=A.createWorkspace({'bundled.ddn':text,'ext.ddn':'ddn "0.5";\nmodule "e";\nformat f { style s { look: classic; theme: default; font: sans; } }\n'});
 assert.match(ws.renderSync({entry:'bundled.ddn',view:'v'}).svg,/<svg/);
});

test('CLI bundle command end-to-end',()=>{
 const out=path.join('/tmp','ddn-b1-015-cli-bundle.ddn');
 cp.execFileSync(process.execPath,[path.join(root,'notation/cli/cli.js'),'bundle','website/examples/basics/01-customer.ddn','--workspace','website/examples/basics','--out',out],{cwd:root,stdio:'pipe'});
 const text=fs.readFileSync(out,'utf8');
 assert.equal(text,A.io.bundle(collect('website/examples/basics','01-customer.ddn'),'01-customer.ddn').text,'CLI output differs from api.io.bundle');
 cp.execFileSync(process.execPath,[path.join(root,'notation/cli/cli.js'),'check',out,'--workspace','/tmp','--view','overview'],{cwd:root,stdio:'pipe'});
 const svg=cp.execFileSync(process.execPath,[path.join(root,'notation/cli/cli.js'),'render',out,'--workspace','/tmp','--view','overview'],{cwd:root,stdio:'pipe'}).toString();
 assert.match(svg,/<svg/);
 const orig=cp.execFileSync(process.execPath,[path.join(root,'notation/cli/cli.js'),'render','website/examples/basics/01-customer.ddn','--workspace','website/examples/basics','--view','overview'],{cwd:root,stdio:'pipe'}).toString();
 assert.equal(svg,orig,'CLI render not byte-identical');
});

console.log(`bundle ${results.filter(r=>r.pass).length}/${results.length}`);
