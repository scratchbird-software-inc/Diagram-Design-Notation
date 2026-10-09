/* SPDX-License-Identifier: GPL-2.0-or-later. Optional browser-host DDNN loading.
 * No transport implementation: all data comes from the supplied callback. */
(function(host){
'use strict';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
async function resolveDocuments(source,{load,parse,read,signal}){
 const files={...source},needed=new Map();
 const cancelled=()=>{if(signal?.aborted)fail('DDN-T109','Document loading cancelled');};
 cancelled();
 for(const [owner,text] of Object.entries(files)){
  if(!/\.ddna?(?:\.ddn)?$/i.test(owner))continue;
  const doc=parse(text,owner),walk=n=>{
   if(n.group&&n.type==='document'&&n.props.file!==undefined){
    const ref=n.props.file;
    if(typeof ref!=='string'||!ref.endsWith('.ddnn')||/^[a-z][a-z0-9+.-]*:/i.test(ref)||ref.startsWith('/'))fail('DDN-NT01','Document loader accepts workspace-relative DDNN paths only');
    const parts=owner.split('/').slice(0,-1);for(const part of ref.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)fail('DDN-NT01','Document path escapes workspace');parts.pop();}else parts.push(part);}
    const path=parts.join('/');if(path.includes('\\'))fail('DDN-NT01','Document paths use forward slashes');
    if(!Object.hasOwn(files,path)){if(!needed.has(path))needed.set(path,[]);needed.get(path).push({owner,id:n.props.id});}
   }
   for(const child of n.children||[])walk(child);
  };for(const n of doc.declarations||[])walk(n);
 }
 if(needed.size>64)fail('DDN-NT02','At most 64 missing DDNN files may be requested per load');
 for(const [path,references] of needed){
  cancelled();let onAbort;
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Object.assign(new Error('Document loading cancelled'),{code:'DDN-T109'}));signal?.addEventListener('abort',onAbort,{once:true});});
  try{
   const text=await Promise.race([Promise.resolve().then(()=>{cancelled();return load(Object.freeze({path,references:Object.freeze(references.map(Object.freeze)),signal}));}),aborted]);
   cancelled();if(typeof text!=='string')fail('DDN-NT04','Host did not supply DDNN text for '+path);
   if(new TextEncoder().encode(text).length>8388608)fail('DDN-NT02','Host DDNN file exceeds 8 MiB');
   read(text);files[path]=text;
  }finally{signal?.removeEventListener('abort',onAbort);}
 }
 return files;
}
const api={resolveDocuments};if(typeof module==='object'&&module.exports)module.exports=api;host.DDNToolDocuments=api;
})(typeof globalThis!=='undefined'?globalThis:this);
