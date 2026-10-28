import {shellInputs} from './ddn-shells.mjs';
/** Production ESM tree shaking precedes the offline classic-script packaging. */
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {environment,outputPath} from './context.mjs';
const require=createRequire(import.meta.url);
export const standaloneMinifyPasses=3;
export function optimizeEntries(entries,{built,label='modular'}) {
 label=label+'-'+createHash('sha256').update(resolve(built)).digest('hex').slice(0,12);
 ({entries,built}=shellInputs(entries,built,label));
 const env=environment(),esbuild=require(join(env.DDN_BUILD_WORKAREA,'tools/optimizer/node_modules/esbuild/lib/main.js'));
 const terser=require(join(env.DDN_BUILD_WORKAREA,'tools/optimizer/node_modules/terser/dist/bundle.min.js'));
 const destination=outputPath(join(env.DDN_BUILD_WORKAREA,'builds/optimized',label));
 const names=Object.fromEntries(Object.keys(entries).map(name=>[name,name.replace(/[^a-z0-9-]/gi,'-')]));
 const result=esbuild.buildSync({absWorkingDir:built,entryPoints:Object.fromEntries(Object.entries(entries).map(([name,file])=>[names[name],file])),outdir:destination,bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',treeShaking:true,minify:true,write:false,metafile:true,legalComments:'inline',chunkNames:'shared/[name]-[hash]',logLevel:'silent'});
 rmSync(destination,{recursive:true,force:true});mkdirSync(destination,{recursive:true});
 for(const file of result.outputFiles){outputPath(file.path);mkdirSync(dirname(file.path),{recursive:true});writeFileSync(file.path,file.contents);}
 const provenance=new Map();
 for(const [file,record] of Object.entries(result.metafile.outputs))if(file.endsWith('.js')){
  provenance.set(relative(destination,resolve(built,file)).replaceAll('\\','/'),Object.entries(record.inputs).filter(([,v])=>v.bytesInOutput>0).map(([path,v])=>({id:relative(built,resolve(built,path)).replaceAll('\\','/'),bytes:v.bytesInOutput})));
 }
 return {entries:Object.fromEntries(Object.keys(entries).map(name=>[name,join(destination,names[name]+'.js')])),built:destination,provenance,minify:code=>esbuild.transformSync(code,{target:'es2022',minify:true,treeShaking:true,legalComments:'inline'}).code,minifyStandalone:code=>terser.minify_sync(code,{ecma:2022,toplevel:true,compress:{passes:standaloneMinifyPasses,pure_getters:false},mangle:true,format:{comments:/SPDX|@license|@preserve|^!/,ascii_only:false}}).code,metadata:result.metafile,version:esbuild.version};
}
