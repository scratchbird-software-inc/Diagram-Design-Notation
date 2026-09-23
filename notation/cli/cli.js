#!/usr/bin/env node
/* SPDX-License-Identifier: GPL-2.0-or-later */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const Export=require('../runtime/ddn-export.js').default;
const DDN=require('../runtime/ddn-core.js').default,Render=require('../runtime/ddn-full.js').default;
/* B1-025: the CLI is a full-featured host — it wires the optional geo module and
 * pre-registers the world-110m asset (under its repo-relative and bare names). */
const Geo=require('../runtime/ddn-geo.js').default;
Render.registerProjectionRenderer('geo',Geo.render,{optional:true});
try{
 const asset=path.join(__dirname,'../../assets/geo/world-110m.json');
 if(fs.existsSync(asset)){const g=fs.readFileSync(asset,'utf8');Geo.registerGeography('assets/geo/world-110m.json',g);Geo.registerGeography('world-110m',g);}
}catch{}
function usage(){console.log('Usage: node notation/cli/cli.js check|render|resolve|bundle <entry.ddn> [--view NAME] [--out FILE] [--workspace DIR]');}
function main(){
 const args=process.argv.slice(2);if(args.length<2){usage();process.exitCode=2;return;}
 const [command,file]=args;const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
 if(!['check','render','resolve','bundle'].includes(command))throw new Error('Unknown command '+command);
 const root=path.resolve(get('--workspace')||'.'),absolute=path.resolve(file),entry=path.relative(root,absolute).split(path.sep).join('/');
 if(entry.startsWith('../'))throw new Error('Entry is outside workspace');
 const files={},visited=new Set();
 function load(name){if(visited.has(name))return;visited.add(name);const full=path.resolve(root,name),real=fs.realpathSync(full);if(real!==root&&!real.startsWith(root+path.sep))throw new Error('Import or symlink escapes workspace');const bytes=fs.readFileSync(real);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);files[name]=text;const ast=DDN.parse(text,name);for(const imp of ast.imports){const next=path.posix.normalize(path.posix.join(path.posix.dirname(name),imp.path));if(next.startsWith('../')||path.isAbsolute(imp.path)||/^[a-z]+:/i.test(imp.path))throw new Error('Unsafe import path');load(next);}}
 load(entry);
 if(command==='bundle'){
  const result=DDN.bundle(files,entry);
  for(const d of result.diagnostics)console.error(JSON.stringify(d));
  const out=get('--out');if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,result.text,'utf8');console.log(out);}else process.stdout.write(result.text);
  return;
 }
 const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../../standard/registry/catalogue.json'),'utf8'));
 const {ir}=DDN.build(files,entry,get('--view'),registry);let output;
 if(command==='render'){const library=fs.readFileSync(path.join(__dirname,'../../standard/registry/glyph-library.svg'),'utf8'),defs=library.match(/<defs>([\s\S]*?)<\/defs>/)[1];output=Render.render(ir,registry,defs).svg;}
 else if(command==='resolve')output=Export.serialize(ir);
 else {console.log(JSON.stringify({status:'pass-core',view:ir.view.id,elements:ir.elements.length,relations:ir.relations.length,warnings:ir.diagnostics},null,2));return;}
 const out=get('--out');if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,output,'utf8');console.log(out);}else process.stdout.write(output);
}
try{main();}catch(e){console.error(JSON.stringify({code:e.code||'DDN-CLI',message:e.message,source:e.source,offset:e.offset},null,2));process.exitCode=1;}
