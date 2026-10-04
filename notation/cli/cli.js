#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const Export=require('../runtime/ddn-export.js').default;
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-full.js').default;
/* 0.8 (ch. 53): publication-set rendering and print-size lint live on the
 * core renderer (ddn-render), not the projection engine (ddn-full). */
const RenderCore=require('../runtime/ddn-render.js').default;
/* B1-025: the CLI is a full-featured host — it wires the optional geo module and
 * pre-registers the world-110m asset (under its repo-relative and bare names). */
const Geo=require('../runtime/ddn-geo.js').default;
Render.registerProjectionRenderer('geo',Geo.render,{optional:true});
/* B1-034: the CLI also wires the optional isometric module; loading it
 * publishes the DDNIso namespace the engine consults for iso/depth views. */
require('../runtime/ddn-iso.js');
try{
 const asset=path.join(__dirname,'../../assets/geo/world-110m.json');
 if(fs.existsSync(asset)){const g=fs.readFileSync(asset,'utf8');Geo.registerGeography('assets/geo/world-110m.json',g);Geo.registerGeography('world-110m',g);}
}catch{}
function usage(){console.log('Usage: node notation/cli/cli.js check|render|resolve|bundle <entry.ddn> [--view NAME] [--out FILE] [--workspace DIR] [--no-motion] [--content-size] [--publication-date YYYY-MM-DD] [--figure N] [--page N] [--strict-print] [--diagnostics json] [--pack FILE.json]...\n       node notation/cli/cli.js publish <entry.ddn> --set <name> --outdir <dir> [--workspace DIR] [--publication-date YYYY-MM-DD]\n       node notation/cli/cli.js verbs --from <kind> --to <kind> [--json]');}
function catalogue(){return JSON.parse(fs.readFileSync(path.join(__dirname,'../../standard/registry/catalogue.json'),'utf8'));}
/* DDN 0.8 (standard ch. 56 §X1): endpoint-legality query. The merged registry
 * (base catalogue + registered profile packs) is exactly what build() validates
 * against (ddn-core.js line 695), so the answer is computed, never cached. */
function verbsCommand(args){
 const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];},flag=k=>args.includes(k);
 const from=get('--from'),to=get('--to');
 if(!from||!to){usage();process.exitCode=2;return;}
 const registry=DDN.profiles.registry(catalogue());
 const known=new Map();for(const k of registry.kinds){known.set(k.keyword,k.keyword);for(const a of k.aliases||[])known.set(a,k.keyword);}
 const distance=(a,b)=>{const m=a.length,n=b.length;if(Math.abs(m-n)>3)return 9;let prev=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur.push(Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)));prev=cur;}return prev[n];};
 for(const [role,value] of [['--from',from],['--to',to]]){
  if(!known.has(value)){
   const close=[...registry.kinds.map(k=>k.keyword)].filter(k=>distance(value,k)<=2).sort().slice(0,5);
   const e=new Error('Unknown kind '+JSON.stringify(value)+' for '+role+(close.length?'; close matches: '+close.join(', '):''));
   e.code='DDN-WS01';throw e;
  }
 }
 const source=known.get(from),target=known.get(to);
 const legal=(contract,kinds,kind)=>kinds.includes('*')||kinds.includes(kind);
 const verbs=registry.relationships.filter(r=>{const c=r.endpoint_contract;return c&&legal(c,c.source,source)&&legal(c,c.target,target);}).map(r=>r.keyword);
 if(flag('--json'))console.log(JSON.stringify({from,to,verbs}));
 else for(const v of verbs)console.log(v);
}
/* DDN 0.8 (ch. 56 §X2): where a failing rule has one obvious fix the message
 * carries it. Hints are advisory text, appended deterministically at the CLI
 * boundary for the high-frequency rules the chapter names; machine consumers
 * use the code, never the message text. */
function withHint(code,message,registry){
 if(code==='DDN102'){
  const m=/^(\S+) cannot use (\S+) as (source|target)$/.exec(message||'');
  if(m){const r=registry.relationships.find(x=>x.keyword===m[1]);const allowed=r?.endpoint_contract?.[m[3]];
   if(allowed)return message+' — legal '+m[3]+' kinds for '+m[1]+': '+(allowed.includes('*')?'any kind':allowed.join(', '));}
  if(/requires object endpoints$/.test(message||''))return message+' — remove the field/port member from the endpoint';
  if(/requires distinct object identities$/.test(message||''))return message+' — connect two distinct elements';
 }
 if(code==='DDN-PJ002')return message+' — remove the place/route/frame/subdiagram geometry from this view, or select a graph view';
 return message;
}
/* DDN 0.8 (ch. 56 §X4): stable machine-parseable diagnostics. Shape contract
 * {code,severity,file?,line?,view?,message}; site-less diagnostics omit
 * file/line rather than fabricating them. line is 1-based in the file's text. */
function toStable(d,files,view,registry){
 const out={code:d.code,severity:d.severity||'error'};
 const file=d.file!==undefined?d.file:d.source;
 if(file){out.file=file;const text=files?.[file];const offset=d.line!==undefined?null:(d.offset??d.start);
  if(text&&typeof offset==='number'){let line=1;for(let i=0;i<offset&&i<text.length;i++)if(text[i]==='\n')line++;out.line=line;}
  else if(typeof d.line==='number')out.line=d.line;}
 if(view)out.view=view;
 out.message=withHint(d.code,d.message,registry);
 return out;
}
function main(){
 const args=process.argv.slice(2);
 if(args[0]==='--version'||args[0]==='-V'||args[0]==='version'){console.log(DDN.VERSION);return;}
 if(args[0]==='verbs'){verbsCommand(args.slice(1));return;}
 if(args.length<2){usage();process.exitCode=2;return;}
 const [command,file]=args;const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];},flag=k=>args.includes(k);
 if(!['check','render','resolve','bundle','publish'].includes(command))throw new Error('Unknown command '+command);
 const diagnosticsJson=get('--diagnostics')==='json';
 /* 0.8 (ch. 53): publication-time options. --publication-date pins $date for
  * byte-stable chrome; --figure/--page pass through to the renderer. */
 const publicationDate=get('--publication-date');
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d+'T00:00:00Z').getTime())&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 if(publicationDate!==null&&!validDate(publicationDate)){console.error('Invalid --publication-date '+JSON.stringify(publicationDate)+'; expected YYYY-MM-DD');process.exitCode=2;return;}
 for(const k of ['--figure','--page']){const v=get(k);if(v!==null&&!/^[1-9]\d{0,4}$/.test(v)){console.error('Invalid '+k+' '+JSON.stringify(v)+'; expected a positive integer');process.exitCode=2;return;}}
 const renderOpts={noMotion:flag('--no-motion'),contentSize:flag('--content-size')};
 if(publicationDate)renderOpts.publicationDate=publicationDate;
 if(get('--figure'))renderOpts.figure=Number(get('--figure'));
 if(get('--page'))renderOpts.page=Number(get('--page'));
 /* B1-101 slice 3: --pack registers a ddn-icon-pack@1 or ddn-art-pack@1
  * document for this run (art packs are never inlined into the runtime). */
 for(let i=0;i<args.length;i++)if(args[i]==='--pack'){const pack=JSON.parse(fs.readFileSync(path.resolve(args[i+1]),'utf8'));
  if(pack.format==='ddn-art-pack@1')DDN.registerArtPack(pack);
  else if(pack.format==='ddn-icon-pack@1')DDN.registerIconPack(pack);
  else throw new Error('Unsupported pack format '+JSON.stringify(pack.format));}
 const root=path.resolve(get('--workspace')||'.'),absolute=path.resolve(file),entry=path.relative(root,absolute).split(path.sep).join('/');
 if(entry.startsWith('../'))throw new Error('Entry is outside workspace');
 const files={},visited=new Set();
 function load(name){if(visited.has(name))return;visited.add(name);const full=path.resolve(root,name),real=fs.realpathSync(full);if(real!==root&&!real.startsWith(root+path.sep))throw new Error('Import or symlink escapes workspace');const bytes=fs.readFileSync(real);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);files[name]=text;const ast=DDN.parse(text,name);for(const imp of ast.imports){const next=path.posix.normalize(path.posix.join(path.posix.dirname(name),imp.path));if(next.startsWith('../')||path.isAbsolute(imp.path)||/^[a-z]+:/i.test(imp.path))throw new Error('Unsafe import path');load(next);}
  /* B1-090: architecture bases and x_link files join the workspace too. */
  const extra=(rel=>{if(!rel||rel.startsWith('../')||path.isAbsolute(rel)||/^[a-z]+:/i.test(rel))throw new Error('Unsafe architecture/x_link path');load(path.posix.normalize(path.posix.join(path.posix.dirname(name),rel)));});
  /* 0.8 (ch. 53 §53.3): publication chrome backgrounds reference workspace
   * files. The runtime expects the files-map value as base64 text for
   * PNG/WebP images and as SVG text for patterns; it validates the value
   * (DDN-PB05–PB08) itself, so anything unsafe or unreadable is skipped here
   * and reported by the validator with its proper code. 0.8 (ch. 54 §54.4):
   * font_pin metrics files load the same way, as UTF-8 JSON text. */
  const asset=(rel=>{if(!rel||typeof rel!=='string'||path.isAbsolute(rel)||/^[a-z]+:/i.test(rel)||rel.includes('\\'))return;
   const next=path.posix.normalize(path.posix.join(path.posix.dirname(name),rel));
   if(next.startsWith('../')||visited.has(next))return;
   try{const full=path.resolve(root,next),real=fs.realpathSync(full);
    if(real!==root&&!real.startsWith(root+path.sep))return;
    const ext=next.split('.').pop().toLowerCase(),bytes=fs.readFileSync(real);
    if(['png','webp'].includes(ext)){visited.add(next);files[next]=bytes.toString('base64');}
    else if(ext==='svg'||ext==='json'){visited.add(next);files[next]=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}}catch{}});
  const walk=n=>{if(n.type==='architecture')for(const f of n.props?.files||[])extra(f);if(n.props?.x_link?.file)extra(n.props.x_link.file);
   if(n.type==='background'){asset(n.props?.image);asset(n.props?.pattern);}
   if(n.type==='style'&&n.props?.font_pin)asset(n.props.font_pin);
   for(const c of n.children||[])walk(c);};
  for(const sec of ast.sections||[])for(const d of sec.declarations||[])walk(d);}
 load(entry);
 if(command==='bundle'){
  const result=DDN.bundle(files,entry);
  for(const d of result.diagnostics)console.error(JSON.stringify(d));
  const out=get('--out');if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,result.text,'utf8');console.log(out);}else process.stdout.write(result.text);
  return;
 }
 const registry=catalogue(),merged=DDN.profiles.registry(registry);
 const library=fs.readFileSync(path.join(__dirname,'../../standard/registry/glyph-library.svg'),'utf8'),defs=library.match(/<defs>([\s\S]*?)<\/defs>/)[1];
 if(command==='publish'){
  /* 0.8 (ch. 53 §53.4): one SVG per figure (<entry>--<view_id>.svg) plus the
   * manifest JSON, written into --outdir. */
  const setName=get('--set'),outdir=get('--outdir');
  if(!setName||!outdir){usage();process.exitCode=2;return;}
  const result=RenderCore.renderPublicationSet(files,entry,setName,registry,defs,renderOpts);
  const dir=path.resolve(outdir);fs.mkdirSync(dir,{recursive:true});
  for(const [fname,svg] of Object.entries(result.files)){fs.writeFileSync(path.join(dir,fname),svg,'utf8');console.log(path.join(dir,fname));}
  const manifestPath=path.join(dir,entry.split('/').pop().replace(/\.ddn$/,'')+'--'+setName+'.manifest.json');
  fs.writeFileSync(manifestPath,JSON.stringify(result.manifest,null,2)+'\n');console.log(manifestPath);
  return;
 }
 let ir;
 try{({ir}=DDN.build(files,entry,get('--view'),registry));}
 catch(e){if(diagnosticsJson&&e.code){console.log(JSON.stringify([toStable(e,files,null,merged)],null,2));process.exitCode=1;return;}throw e;}
 let output;
 if(command==='render'){
  const result=Render.render(ir,registry,defs,renderOpts);
  if(diagnosticsJson){console.log(JSON.stringify(result.diagnostics.map(d=>toStable(d,files,ir.view.local,merged)),null,2));return;}
  output=result.svg;}
 else if(command==='resolve')output=Export.serialize(ir);
 else {
  /* 0.8 (ch. 53 §53.5): check runs print-size lint for physical paper sizes;
   * --strict-print turns DDN-PS01/PS02 warnings into the failing DDN-PS04 gate. */
  const lint=flag('--strict-print')||['a4','letter'].includes(ir.view.profiles.publication.size)
   ?RenderCore.printSizeLint(ir,registry,defs,{strictPrint:flag('--strict-print'),...(publicationDate?{publicationDate}:{})}):[];
  const all=[...ir.diagnostics,...lint];
  const failed=all.some(d=>d.severity==='error');
  if(diagnosticsJson){console.log(JSON.stringify(all.map(d=>toStable(d,files,ir.view.local,merged)),null,2));if(failed)process.exitCode=1;return;}
  console.log(JSON.stringify({status:failed?'fail-print':'pass-core',view:ir.view.id,elements:ir.elements.length,relations:ir.relations.length,warnings:all.map(d=>({...d,message:withHint(d.code,d.message,merged)}))},null,2));
  if(failed)process.exitCode=1;return;}
 const out=get('--out');if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,output,'utf8');console.log(out);}else process.stdout.write(output);
}
try{main();}catch(e){let message=e.message;try{if(e.code)message=withHint(e.code,e.message,DDN.profiles.registry(catalogue()));}catch{}console.error(JSON.stringify({code:e.code||'DDN-CLI',message,source:e.source,offset:e.offset},null,2));process.exitCode=1;}
