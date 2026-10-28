import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { root, outputPath } from './context.mjs';

const assets = join(root, 'project/ddn/assets/fonts');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function checkedFile(path, hash) {
 const absolute = resolve(assets, path), rel = relative(assets, absolute);
 if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Font manifest path escapes assets.');
 const bytes = readFileSync(absolute);
 if (digest(bytes) !== hash) throw new Error('Font asset integrity mismatch: ' + path);
 return bytes;
}
/** Serialized classic-script loader also works with direct local files. */
function fontLoader(catalogue) {
 const script=document.currentScript;
 if(!script?.src)throw Error('DDN font catalogue needs a local script URL.');
 const base=new URL('.',script.src),known=new Map(catalogue.map(face=>[face.id,face])),loaded=new Map(),pending=new Map();
 const initial=globalThis.DDN_FONT_RESOURCES??[];
 Object.defineProperty(globalThis,'DDN_FONT_CATALOGUE',{configurable:true,value:Object.freeze(catalogue.map(face=>Object.freeze({...face})))});
 globalThis.DDN_FONT_RESOURCES=Object.freeze([...initial]);
 Object.defineProperty(globalThis,'DDN_REGISTER_FONT',{configurable:true,value:(id,resource)=>{
  const face=known.get(id);
  if(!face||resource.family!==face.family||resource.style!==face.style||resource.weight!==face.weight)throw Error('Incompatible DDN font resource.');
  if(loaded.has(id)){if(JSON.stringify(loaded.get(id))!==JSON.stringify(resource))throw Error('Conflicting DDN font resource.');return;}
  loaded.set(id,Object.freeze(resource));
  globalThis.DDN_FONT_RESOURCES=Object.freeze([...initial,...loaded.values()]);
 }});
 Object.defineProperty(globalThis,'DDN_LOAD_FONTS',{configurable:true,value:async(requests)=>{
  const wanted=Array.isArray(requests)?requests:null;
  const selected=catalogue.filter(face=>!wanted||wanted.some(request=>
   (typeof request==='string'?request:request.family).toLowerCase()===face.family.toLowerCase() &&
   (typeof request==='string'||!request.style||request.style===face.style||!catalogue.some(candidate=>candidate.family===face.family&&candidate.style===request.style)&&face.style==='normal')));
  await Promise.all(selected.map(face=>{
   if(loaded.has(face.id))return;
   if(pending.has(face.id))return pending.get(face.id);
   const task=new Promise((resolve,reject)=>{
    const element=document.createElement('script');element.async=true;
    if(script.nonce)element.nonce=script.nonce;
    let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);element.onload=element.onerror=null;if(error){element.remove();reject(error);}else resolve();};
    const timer=setTimeout(()=>finish(Error('Timed out loading the local '+face.family+' font.')),15000);
    element.onload=()=>finish(loaded.has(face.id)?undefined:Error('Font resource did not register: '+face.family));
    element.onerror=()=>finish(Error('Unable to load the local '+face.family+' font.'));
    element.src=new URL(face.file,base).href;document.head.append(element);
   }).finally(()=>pending.delete(face.id));
   pending.set(face.id,task);return task;
  }));
  return selected.map(face=>loaded.get(face.id));
 }});
}
/** Emit a tiny catalogue and independent, immutable family/style resources. */
export function buildFontPack(outputDirectory) {
 const directory=outputPath(outputDirectory),manifest=JSON.parse(readFileSync(join(assets,'manifest.json'),'utf8'));
 if(manifest.format!=='ddn-font-resources-1')throw Error('Unsupported font manifest.');
 mkdirSync(join(directory,'fonts'),{recursive:true});
 const faces=[],notices=[];
 for(const family of manifest.families){
  const license=checkedFile(family.licensePath,family.licenseSha256).toString('utf8');
  notices.push(`${family.family}\n${family.repository}\nPinned commit: ${family.commit}\n\n${license}`);
  for(const face of family.files){
   const bytes=checkedFile(face.path,face.sha256);
   if(bytes.toString('ascii',0,4)!=='wOF2'||bytes.length!==face.bytes)throw Error('Invalid WOFF2 font: '+face.path);
   const resource={family:family.family,category:family.category,source:'standard',license,style:face.style,weight:face.weight,dataURL:'data:font/woff2;base64,'+bytes.toString('base64')};
   const id=digest(JSON.stringify(resource)),code='/* DDN font resource; SIL OFL 1.1. See ddn-fonts-LICENSES.txt. */\nglobalThis.DDN_REGISTER_FONT('+JSON.stringify(id)+','+JSON.stringify(resource)+');\n';
   const file='fonts/'+id+'.js';writeFileSync(join(directory,file),code);
   faces.push({id,family:family.family,category:family.category,style:face.style,weight:face.weight,file,rawBytes:Buffer.byteLength(code),sha256:digest(code),fontSha256:face.sha256});
  }
 }
 const code='/* DDN optional local fonts. Resources retain SIL OFL 1.1; see ddn-fonts-LICENSES.txt. */\n('+fontLoader.toString()+')('+JSON.stringify(faces)+');\n';
 const script=join(directory,'ddn-fonts.js'),manifestPath=join(directory,'ddn-fonts-manifest.json'),licensePath=join(directory,'ddn-fonts-LICENSES.txt'),indexPath=join(directory,'ddn-fonts-index.json');
 writeFileSync(script,code);writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');writeFileSync(licensePath,notices.join('\n\n'+'='.repeat(72)+'\n\n')+'\n');writeFileSync(indexPath,JSON.stringify({format:'ddn-font-chunks-1',faces},null,2)+'\n');
 const selected=new Set(faces.map(face=>face.file.slice(6)));
 for(const file of readdirSync(join(directory,'fonts')))if(/^[a-f0-9]{64}\.js$/.test(file)&&!selected.has(file))unlinkSync(join(directory,'fonts',file));
 return {script,manifest:manifestPath,licenses:licensePath,index:indexPath,bytes:Buffer.byteLength(code),files:['ddn-fonts.js','ddn-fonts-manifest.json','ddn-fonts-LICENSES.txt','ddn-fonts-index.json',...faces.map(face=>face.file)],faces};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildFontPack(process.argv[2]??join(root,'.work/builds/ddn-fonts'))));
