/* SPDX-License-Identifier: GPL-2.0-or-later. Parsed, file-independent workspace navigation and source edits. */
(function(host){
'use strict';
const key=(file,module,path)=>JSON.stringify([file,module,path]);
function index(files,A){
 const result={files,documents:[],items:[],views:[],errors:[],docs:new Map(),byKey:new Map()};
 for(const [file,text] of Object.entries(files).sort())try{
  if(file.endsWith('.ddnn')){const doc=A.documentFormats.read(text);result.docs.set(file,doc);for(const [id,document] of Object.entries(doc.documents))result.documents.push({key:key(file,'',id),file,id,document});continue;}
  const doc=A.parse(text,file);result.docs.set(file,doc);
  for(const section of doc.sections||[doc]){
   const walk=(nodes,parent=null)=>{for(const node of nodes||[]){
    const base=parent?.semanticPath||'';
    const semanticPath=node.group?base:(base?base+'.':'')+(node.id||node.type);
    const path=node.group?(base?base+'.':'')+'@'+node.type:semanticPath;
    const item={key:key(file,section.module,path),file,module:section.module,path,semanticPath,node,parent:parent?.key||null,uid:node.props?.uid||section.module+'::'+path,label:node.label||node.id||node.type,type:node.type,group:!!node.group};
    result.items.push(item);result.byKey.set(item.key,item);
    if(node.type==='view'&&!node.group){item.view=item.uid;result.views.push(item);}
    walk(node.children,item);
   }};walk(section.declarations);
  }
 }catch(error){result.errors.push({file,error});}
 for(const v of result.views)if(result.views.filter(x=>x.file===v.file&&x.node.id===v.node.id).length===1)v.view=v.node.id;
 return result;
}
function find(idx,item){const next=idx.byKey.get(typeof item==='string'?item:item.key);if(!next)throw Error('This section no longer exists. Reopen it from the workspace.');return next;}
function resolveRef(idx,owner,ref){
 const raw=typeof ref==='string'?ref:ref?.$ref;if(!raw)return null;
 const own=typeof owner==='string'?find(idx,owner):owner;
 const local=(file,module,path)=>idx.items.find(x=>x.file===file&&x.module===module&&x.path===path&&!x.group);
 const seek=(file,module,path,seen=new Set())=>{
  const stamp=key(file,module,path);if(seen.has(stamp))return null;seen.add(stamp);
  let hit=local(file,module,path);if(hit)return hit;
  const doc=idx.docs.get(file);if(!doc?.sections)return null;
  for(const sec of doc.sections)if(path.startsWith(sec.module+'.')){hit=local(file,sec.module,path.slice(sec.module.length+1));if(hit)return hit;}
  for(const imp of doc.imports||[])if(path.startsWith(imp.alias+'.')){const target=host.DDNLive?host.DDNLive.resolvePath(file,imp.path):idx.resolvePath(file,imp.path);const d=idx.docs.get(target);return d?seek(target,d.module,path.slice(imp.alias.length+1),seen):null;}
  return null;
 };
 let prefix=(own.semanticPath||own.path).split('.');prefix.pop();
 while(prefix.length){const hit=local(own.file,own.module,prefix.join('.')+'.'+raw);if(hit)return hit;prefix.pop();}
 return seek(own.file,own.module,raw);
}
function indexed(files,A){const idx=index(files,A);idx.resolvePath=A.resolvePath;return idx;}
function references(idx){
 const out=[];
 for(const item of idx.items){const visit=v=>{if(!v||typeof v!=='object')return;if(v.$ref){out.push({owner:item,ref:v,target:resolveRef(idx,item,v)});return;}for(const val of Object.values(v))visit(val);};visit(item.node.props);visit(item.node.from);visit(item.node.to);visit(item.node.target);}
 return out;
}
function stringReferences(idx){const out=[];for(const owner of idx.items){const profile=owner.node.props.x_profile;for(const [i,node]of (Array.isArray(profile?.nodes)?profile.nodes:[]).entries()){if(typeof node.target!=='string')continue;const matches=idx.items.filter(x=>x.type==='object'&&(x.uid===node.target||x.path===node.target));for(const target of matches)out.push({owner,target,property:'x_profile',index:i,raw:node.target,ambiguous:matches.length>1});}const sub=owner.node.props.x_subdiagram;if(typeof sub?.view==='string'){const matches=idx.views.filter(x=>x.uid===sub.view||x.node.id===sub.view);for(const target of matches)out.push({owner,target,property:'x_subdiagram',raw:sub.view,ambiguous:matches.length>1});}}return out;}
function users(idx,item){return [...references(idx),...stringReferences(idx)].filter(r=>r.target?.key===item.key||r.target?.file===item.file&&r.target?.module===item.module&&r.target?.path.startsWith(item.path+'.')).map(r=>r.owner).filter((x,i,a)=>a.findIndex(y=>y.key===x.key)===i);}
function patches(text,edits){for(const e of edits.filter(Boolean).sort((a,b)=>b.start-a.start||b.end-a.end))text=text.slice(0,e.start)+e.text+text.slice(e.end);return text;}
function propertyEdit(text,node,name,value,A){
 const tokens=A.lex(text,node.source).filter(t=>t.start>=node.bodyStart&&t.end<=node.bodyEnd);let depth=0;
 const code=value===undefined?'':name+': '+A.authoring.value(value)+';';
 for(let i=0;i<tokens.length;i++){const t=tokens[i];if(!depth&&t.value===name&&tokens[i+1]?.type===':'){let d=0;for(let j=i+2;j<tokens.length;j++){const q=tokens[j];if(q.type===';'&&!d)return {start:t.start,end:q.end,text:code};if(['{','['].includes(q.type))d++;if(['}',']'].includes(q.type))d--;}}
 if(['{','['].includes(t.type))depth++;if(['}',']'].includes(t.type))depth--;}
 if(value===undefined)return null;
 return node.bodyStart!==undefined?{start:node.bodyStart,end:node.bodyStart,text:'\n    '+code+'\n'}:{start:node.end-1,end:node.end,text:' { '+code+' }'};
}
function props(files,item,changes,A){let next={...files};for(const [k,v]of Object.entries(changes)){identifier(k);const n=find(indexed(next,A),item);next[n.file]=patches(next[n.file],[propertyEdit(next[n.file],n.node,k,v,A)]);}return next;}
function idToken(text,node,A){const ts=A.lex(text,node.source).filter(t=>t.start>=node.start&&t.end<=(node.bodyStart??node.end));return ts.find((t,i)=>i>0&&t.type==='id'&&t.value===node.id);}
function label(files,item,label,A){const idx=indexed(files,A),n=find(idx,item),text=files[n.file],t=idToken(text,n.node,A);if(!t)throw Error('This group has no name');const next=A.lex(text,n.file).find(x=>x.start>=t.end&&x.type!=='eof');const edit=next?.type==='string'?{start:next.start,end:next.end,text:JSON.stringify(label)}:{start:t.end,end:t.end,text:' '+JSON.stringify(label)};return {...files,[n.file]:patches(text,[edit])};}
function identifier(id){if(!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('Use a nonreserved identifier with letters, digits, underscores or hyphens.');return id;}
function rename(files,item,id,A){identifier(id);const idx=indexed(files,A),n=find(idx,item);if(n.group)throw Error('Unnamed groups cannot be renamed');if(n.node.id===id)return files;
 if(idx.items.some(x=>x.file===n.file&&x.module===n.module&&x.parent===n.parent&&x.node.id===id))throw Error('That identifier already exists in this section');
 const edits=new Map(),add=(f,e)=>{if(!edits.has(f))edits.set(f,[]);edits.get(f).push(e);};const t=idToken(files[n.file],n.node,A);if(!t)throw Error('Cannot locate identifier');add(n.file,{...t,text:id});
 for(const r of references(idx)){if(!r.target||r.target.file!==n.file||r.target.module!==n.module||!(r.target.path===n.path||r.target.path.startsWith(n.path+'.')))continue;
  const at=r.ref.$offset;if(!Number.isInteger(at))throw Error('Reference has no editable source location');const ts=A.lex(files[r.owner.file],r.owner.file).filter(t=>t.start>at);const parts=[];for(let j=0;j<ts.length;j++){if(j%2===0&&ts[j].type==='id')parts.push(ts[j]);else if(j%2===1&&ts[j].type==='.')continue;else break;}
  const suffix=r.target.path.split('.').length-n.path.split('.').length,pos=parts.length-1-suffix;if(pos<0||parts[pos].value!==n.node.id)continue;add(r.owner.file,{start:parts[pos].start,end:parts[pos].end,text:id});
 }
 // Schema-defined string identities (DDNA decision targets and child views).
 const strings=new Map();for(const r of stringReferences(idx)){const target=r.target;if(target.file!==n.file||target.module!==n.module||!(target.path===n.path||target.path.startsWith(n.path+'.')))continue;if(r.ambiguous)throw Error('Qualify ambiguous identity '+r.raw+' before renaming');if(target.node.props.uid&&r.raw===target.uid)continue;
 const k=r.owner.key+':'+r.property,change=strings.get(k)||{owner:r.owner,property:r.property,value:JSON.parse(JSON.stringify(r.owner.node.props[r.property]))};const newPath=n.path.split('.').slice(0,-1).concat(id).join('.')+target.path.slice(n.path.length);const replacement=r.raw.includes('::')?target.module+'::'+newPath:r.property==='x_subdiagram'?id:newPath;if(r.property==='x_profile')change.value.nodes[r.index].target=replacement;else change.value.view=replacement;strings.set(k,change);
 }for(const change of strings.values())add(change.owner.file,propertyEdit(files[change.owner.file],change.owner.node,change.property,change.value,A));
 const next={...files};for(const [f,es]of edits)next[f]=patches(files[f],es);return next;
}
function remove(files,item,A){const idx=indexed(files,A),n=find(idx,item),used=users(idx,n).filter(x=>!x.path.startsWith(n.path+'.')||x.file!==n.file||x.module!==n.module);if(used.length)throw Error('Still referenced by '+used.map(x=>x.file+' / '+x.path).join(', '));return {...files,[n.file]:patches(files[n.file],[{start:n.node.start,end:n.node.end,text:''}])};}
function append(files,parent,code,A){const idx=indexed(files,A),n=find(idx,parent);const edit=n.node.bodyEnd===undefined?{start:n.node.end-1,end:n.node.end,text:' {\n'+code+'\n}'}:{start:n.node.bodyEnd,end:n.node.bodyEnd,text:'\n'+code+'\n'};return {...files,[n.file]:patches(files[n.file],[edit])};}
function ensureRef(files,owner,target,A){const idx=indexed(files,A),o=find(idx,owner),t=find(idx,target);
 if(o.file===t.file)return {files,ref:{$ref:(o.module===t.module?'':t.module+'.')+t.path}};
 const doc=idx.docs.get(o.file);let im=doc.imports.find(i=>A.resolvePath(o.file,i.path)===t.file),next=files;
 if(!im){const used=new Set([...doc.imports.map(i=>i.alias),...doc.declarations.map(d=>d.id)]);let alias='source',i=2;while(used.has(alias))alias='source'+i++;im={alias,path:A.relative(o.file,t.file)};const at=A.lex(files[o.file],o.file).find(t=>t.type===';').end;next={...files,[o.file]:patches(files[o.file],[{start:at,end:at,text:'\nimport '+JSON.stringify(im.path)+' as '+im.alias+';'}])};}
 return {files:next,ref:{$ref:im.alias+'.'+(idx.docs.get(t.file).module===t.module?'':t.module+'.')+t.path}};
}
function bind(files,view,blocks,selection,A){let next=files;const refs=[];for(const b of blocks){const out=ensureRef(next,view,b,A);next=out.files;refs.push(out.ref);}const edits={data:refs};if(selection!==undefined){const selected=[];for(const s of selection){const out=ensureRef(next,view,s,A);next=out.files;selected.push(out.ref);}edits.select=selected;edits.exclude=undefined;}
 return props(next,view,edits,A);
}
function createView(files,{file,module,id,label:caption,kind='',blocks=[],copy=null},A){identifier(id);A.pathChecked(file);if(!file.endsWith('.ddn'))throw Error('View files use .ddn');let next={...files};
 if(!next[file])next[file]='ddn "0.7";\nmodule '+JSON.stringify(module||id)+';\n';
 let idx=indexed(next,A),doc=idx.docs.get(file);if(!doc?.sections)throw Error('Choose a DDN source file');module=module||doc.module;const sec=doc.sections.find(s=>s.module===module);if(!sec)throw Error('Module not found');if(sec.declarations.some(n=>n.id===id))throw Error('Identifier already exists in destination module');
 let code='view '+id+' '+JSON.stringify(caption||id)+' {data: []; publication {size:content;fit:none;}'+(kind?' kind:'+JSON.stringify(kind)+';':'')+'}';
 if(copy){const old=find(idx,copy);code=next[old.file].slice(old.node.start,old.node.end);const tok=idToken(next[old.file],old.node,A);code=code.slice(0,tok.start-old.node.start)+id+code.slice(tok.end-old.node.start);
  // References are rewritten below, after the destination exists.
 }
 const at=sec.declarations.at(-1)?.end??(()=>{const ts=A.lex(next[file],file);for(let i=0;i<ts.length;i++)if(ts[i].value==='module'&&ts[i+1]?.value===module)return ts[i+2].end;throw Error('Module declaration missing');})();
 next[file]=patches(next[file],[{start:at,end:at,text:'\n\n'+code+'\n'}]);
 const viewKey=key(file,module,id);
 if(copy){const old=find(idx,copy),refs=references(idx).filter(r=>r.owner.file===old.file&&r.owner.module===old.module&&(r.owner.key===old.key||r.owner.path.startsWith(old.path+'.')));const replacements=[];
  // Recompute relative offsets after changing the identifier length.
  const delta=id.length-old.node.id.length;
  for(const r of refs){if(!r.target)throw Error('Cannot duplicate a view with unresolved references');const out=ensureRef(next,viewKey,r.target,A);next=out.files;const start=r.ref.$offset-old.node.start+delta;replacements.push({start,end:start+1+r.ref.$ref.length,text:'@'+out.ref.$ref});}
  const v=find(indexed(next,A),viewKey);let text=next[file].slice(v.node.start,v.node.end);text=patches(text,replacements);next[file]=patches(next[file],[{start:v.node.start,end:v.node.end,text}]);next=label(next,viewKey,caption||id,A);
 }else {const available=indexed(next,A).items.filter(x=>x.type==='object'&&blocks.some(b=>{const block=typeof b==='string'?find(indexed(next,A),b):b;return x.file===block.file&&x.module===block.module&&x.path.startsWith(block.path+'.');}));next=bind(next,viewKey,blocks,available,A);}
 return {files:next,key:viewKey};
}
function documentUsers(idx,file,id,A){return idx.items.filter(x=>x.group&&x.type==='document'&&x.node.props.file&&A.resolvePath(x.file,x.node.props.file)===file&&x.node.props.id===id).map(x=>idx.byKey.get(x.parent));}
const api={key,index:indexed,find,resolveRef,references,users,patches,propertyEdit,props,label,identifier,rename,remove,append,ensureRef,bind,createView,documentUsers};
if(typeof module==='object'&&module.exports)module.exports=api;host.DDNWorkbenchModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
