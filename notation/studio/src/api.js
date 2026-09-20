/* SPDX-License-Identifier: GPL-2.0-or-later. Public SDK on the consolidated DDN 0.3 core. */
function makeLiveAPI(backend,assets){
'use strict';
const VERSION='0.6.0-beta.1',D=backend.DDN,clone=x=>JSON.parse(JSON.stringify(x)),Q=n=>({$quantity:n,unit:'px'});
assets={...assets,registry:D.profiles.registry(assets.registry)};
const ENGINES={name:'ddn-consolidated',core:D.VERSION,interaction:backend.Interaction.VERSION,layout:backend.Placement.VERSION,palette:'blue-grey@1'};
class LiveError extends Error{constructor(code,message){super(message);this.name='DDNLiveError';this.code=code;}}
const fail=(code,message)=>{throw new LiveError(code,message);};
const choices={endpointOrdering:['source','optimize','preserve'],mark:['source','bar','line','area','point','pie','donut'],theme:['source','default','base','neutral','dark','night','forest'],placement:['source','auto','grid','manual','fit_grid','circular','radial','layered','tree','spanning_tree','mindmap','grouped','organic'],center:['source','pins','content'],look:['classic','handDrawn','neo'],routing:['source','orthogonal','straight','curved','rounded'],crossings:['source','gap','bridge','square_bridge'],fields:['source','names','none'],domains:['source','show','hide'],datatypes:['source','show','hide'],labels:['source','numbers','text','tokens'],kind:['source','icon_token','icon','text','none'],page:['source','content','web','a4-landscape','a4-portrait','letter-landscape','letter-portrait','custom'],font:['source','sans','serif','mono','handwriting']};
const defaults={endpointOrdering:'source',autoPlace:null,center:'source',gridStep:null,theme:'source',placement:'source',look:null,routing:'source',crossings:'source',fields:'source',domains:'source',datatypes:'source',depth:null,mark:'source',labels:'source',kind:'source',page:'source',font:'source',fontSize:null,width:1600,height:1000,roughness:null,hachure:null};
function checkOptions(o={}){
 if(!o||typeof o!=='object'||Array.isArray(o))fail('LIVE001','Presentation options must be a record.');
 for(const k of Object.keys(o))if(!Object.hasOwn(defaults,k))fail('LIVE001','Unsupported presentation option: '+k);
 for(const [k,values]of Object.entries(choices))if(o[k]!=null&&!values.includes(o[k]))fail('LIVE002',`Unsupported ${k}: ${o[k]}`);
 for(const [k,min,max]of [['width',400,32000],['height',400,32000],['roughness',0,3],['fontSize',8,64],['gridStep',8,512],['depth',0,64]])if(o[k]!=null&&(!Number.isFinite(o[k])||o[k]<min||o[k]>max||(k==='depth'&&!Number.isInteger(o[k]))))fail('LIVE003',`${k} must be between ${min} and ${max}.`);
 for(const k of ['autoPlace','hachure'])if(o[k]!=null&&typeof o[k]!=='boolean')fail('LIVE003',k+' must be boolean or null.');
 return o;
}
function pathChecked(k){
 if(typeof k!=='string'||!k||k.length>1024||k!==k.normalize('NFC')||k.startsWith('/')||/[\\\x00-\x1f\x7f]/.test(k)||/^[a-z]+:/i.test(k)||k.split('/').some(x=>!x||x==='.'||x==='..'||['__proto__','constructor','prototype'].includes(x))||!k.toLowerCase().endsWith('.ddn'))fail('LIVE010','Invalid workspace DDN path: '+k);
 return k;
}
function filesChecked(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('LIVE010','Workspace must be a filename-to-DDN-source map.');
 const files=Object.create(null);let total=0;
 for(const [path,text]of Object.entries(input)){pathChecked(path);if(typeof text!=='string'||text.length>2000000)fail('LIVE010','DDN source must be text, at most 2,000,000 characters per file.');total+=text.length;files[path]=text;}
 if(total>12000000||Object.keys(files).length>1500)fail('LIVE011','Workspace limit: 1,500 files and 12,000,000 source characters.');return files;
}
const fingerprint=s=>{let a=2166136261,b=5381;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');};
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function capabilities(ir){const projection=ir.view.profiles.projection?.kind||'graph',bound=!['graph','chen'].includes(projection);const sequence=!!ir.view.profiles.layout.x_interaction,redacted=ir.view.profiles.export.mode==='redacted';return{...ENGINES,sequence,projection,dataBound:bound,graphControls:!bound&&projection!=='chen',marks:projection==='chart'&&ir.view.profiles.projection.profile==='chart.quality@1'?(ir.view.profiles.projection.transform&&ir.view.profiles.projection.transform!=='identity'||ir.view.profiles.projection.layers?['source']:['source','bar','line','area','point']):projection==='chart'?(ir.view.profiles.projection.x_type==='number'?['source','point','line','area']:ir.view.profiles.projection.x_type==='date'?['source','line','area']:['source','bar','line','area','pie','donut']):['source'],sourceExport:!redacted,autoPlacement:!sequence&&!bound&&projection!=='chen',retainedPlacementState:!sequence&&!bound&&projection!=='chen',placement:sequence||bound||projection==='chen'?['source']:choices.placement,centers:sequence||bound||projection==='chen'?['source']:choices.center,routing:sequence||bound||projection==='chen'?['source']:choices.routing,fields:sequence||bound||projection==='chen'?['source']:choices.fields,labels:bound||projection==='chen'?['source']:sequence?['source','numbers']:choices.labels,page:sequence?['source']:choices.page,kind:sequence||bound||projection==='chen'?['source']:choices.kind,crossings:sequence||bound||projection==='chen'?['source']:choices.crossings,theme:choices.theme,looks:choices.look,notes:sequence?['Fixed participant lanes and ordered exchanges; free-node routing/page controls are disabled. Redacted interaction exports are rejected.']:['DDN 0.5 profiles and projections preserve core validation, native routing and publication checks. Layout search is deterministic and bounded; pins and explicit constraints can leave crossings.']};}
function apply(base,overrides){
 const ir={...base,view:clone(base.view)},o={...defaults,...checkOptions(overrides)},p=ir.view.profiles,caps=capabilities(ir);
 if(o.mark!=='source'){if(caps.projection!=='chart'||!caps.marks.includes(o.mark))fail('LIVE021','Requested mark is not supported by this projection/transform');p.projection.mark=o.mark;}
 if(caps.dataBound||caps.projection==='chen'){for(const key of ['placement','routing','crossings','fields','domains','datatypes','labels','kind','center','endpointOrdering'])if(o[key]!=='source')fail('LIVE021','This projection does not allow graph setting '+key);if(o.autoPlace!==null||o.gridStep!==null||o.depth!==null)fail('LIVE021','Data-bound coordinates cannot be replaced with automatic graph placement');}
 if(caps.sequence){for(const k of ['placement','routing','fields','labels','page','kind','crossings'])if(!caps[k].includes(o[k]))fail('LIVE020','Interaction projection does not support '+k+'='+o[k]);if(o.autoPlace!==null||o.gridStep!==null||o.center!=='source'||o.fontSize!==null||o.domains!=='source'||o.datatypes!=='source'||o.depth!==null||o.endpointOrdering!=='source')fail('LIVE020','Interaction projection retains its fixed lanes and typography.');}
 if(o.endpointOrdering!=='source')p.layout.endpoint_ordering=o.endpointOrdering;
 if(o.placement!=='source'){p.layout.algorithm=o.placement;if(o.center==='source')p.layout.center='pins';}
 if(o.autoPlace!==null)p.layout.auto_place=o.autoPlace;
 if(o.gridStep!==null)p.layout.grid_step=Q(o.gridStep);
 if(o.center!=='source')p.layout.center=o.center;
 if(o.routing!=='source'){
  p.layout.routing=o.routing==='rounded'?'curved':o.routing;p.layout.curve=o.routing==='rounded'?'rounded':'bezier';
  // The toolbar is a temporary view overlay. Explicit per-relation routing
  // selections still win; their presence is shown in the resolved source.
 }
 if(o.crossings!=='source')p.layout.crossings=o.crossings;
 for(const k of ['theme','font'])if(o[k]!=='source')p.style[k]=o[k];
 for(const k of ['look','roughness','hachure'])if(o[k]!==null)p.style[k]=o[k];
 if(o.fontSize!==null)p.style.font_size=Q(o.fontSize);
 for(const k of ['fields','domains','datatypes','kind'])if(o[k]!=='source')p.display[k]=o[k];if(o.depth!==null)p.display.depth=o.depth;
 if(o.labels!=='source')p.legend.mode=o.labels;
 if(p.legend.mode==='numbers'){
  if(p.legend.placement==='none')p.legend.placement='right';
  const used=new Set(Object.values(ir.view.keys)),rels=[...ir.relations].sort((a,b)=>a.id.localeCompare(b.id));let n=1;
  for(const r of rels)if(!ir.view.keys[r.id]){while(used.has(n))n++;ir.view.keys[r.id]=n;used.add(n++);}
 }
 if(o.page!=='source'){
  Object.assign(p.publication,{size:'figure',width:Q(o.width),height:Q(o.height),fit:'contain',overflow:'error'});
  if(o.page==='content'){p.publication.size='content';p.publication.fit='none';}
  if(o.page==='web'){p.publication.width=Q(1600);p.publication.height=Q(1000);}
  if(o.page.startsWith('a4-')){p.publication.size='a4';p.publication.orientation=o.page.endsWith('portrait')?'portrait':'landscape';}
  if(o.page.startsWith('letter-')){p.publication.size='letter';p.publication.orientation=o.page.endsWith('portrait')?'portrait':'landscape';}
 }
 return{ir,options:o};
}
function relative(base,target){const a=base.split('/').slice(0,-1),b=target.split('/');while(a.length&&b.length&&a[0]===b[0]){a.shift();b.shift();}return [...a.map(()=> '..'),...b].join('/')||'./'+target.split('/').at(-1);}
function resolvePath(base,rel){if(/^(?:[a-z]+:|\/|\\)/i.test(rel)||rel.includes('\\'))fail('LIVE010','Imports must be workspace relative.');const a=base.split('/').slice(0,-1);for(const bit of rel.split('/')){if(!bit||bit==='.')continue;if(bit==='..'){if(!a.length)fail('LIVE010','Import escapes workspace.');a.pop();}else a.push(bit);}return a.join('/');}
function replaceSpans(text,edits){const sorted=[...edits].sort((a,b)=>b.start-a.start);let last=text.length+1;for(const e of sorted){if(!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<e.start||e.end>text.length||e.end>last||typeof e.text!=='string')fail('LIVE031','Overlapping or invalid text edits.');text=text.slice(0,e.start)+e.text+text.slice(e.end);last=e.start;}return text;}
function createWorkspace(input){
 let files=filesChecked(input),revision=0;const cache=new Map(),listeners=new Set(),undo=[],redo=[];let historyBytes=0,destroyed=false;
 function notify(changed){revision++;cache.clear();for(const fn of listeners){try{fn({revision,changedFiles:changed});}catch(e){console.error('DDN listener:',e);}}}
 function commit(next,label='Edit source',record=true){if(destroyed)fail('LIVE016','Workspace destroyed.');next=filesChecked(next);const keys=[...new Set([...Object.keys(files),...Object.keys(next)])],patch=keys.filter(k=>files[k]!==next[k]).map(k=>({file:k,before:files[k],after:next[k]}));if(!patch.length)return revision;if(record){const bytes=patch.reduce((n,p)=>n+(p.before?.length||0)+(p.after?.length||0),0);undo.push({patch,label,bytes});historyBytes+=bytes;while(undo.length>60||historyBytes>16000000&&undo.length>1)historyBytes-=undo.shift().bytes;redo.length=0;}files=next;notify(patch.map(p=>p.file));return revision;}
 function compiled(entry,view){if(!Object.hasOwn(files,entry))fail('LIVE012','Missing entry: '+entry);const key=entry+'#'+(view||'');if(cache.has(key))return cache.get(key);const built=D.build(files,entry,view,assets.registry),ir=built.ir;
  if(ir.view.selected.length>128||ir.view.relations.length>384)fail('LIVE013','Live view limit: 128 elements and 384 relationships. Split the model into linked views.');
  freeze(ir.elements);freeze(ir.relations);const result={ir,dependencies:[...built.workspace.docs.keys()]};cache.set(key,result);while(cache.size>4)cache.delete(cache.keys().next().value);return result;}
 const ws={
  get revision(){return revision;},getFiles(){return {...files};},
  entries(){return Object.keys(files).sort().flatMap(file=>{try{const d=D.parse(files[file],file),v=d.declarations.filter(n=>n.type==='view');return v.length?[{file,views:v.map(n=>({id:n.id,name:n.label||n.id}))}]:[];}catch{return[];}});},
  views(entry){return D.parse(files[entry],entry).declarations.filter(n=>n.type==='view').map(n=>({id:n.id,name:n.label||n.id}));},
  analyze(file){if(!Object.hasOwn(files,file))fail('LIVE012','Missing source file: '+file);return D.parse(files[file],file);},
  resolve(entry,view){return clone(compiled(entry,view).ir);},
  inspect(entry,view){const b=compiled(entry,view),ir=b.ir;return{capabilities:capabilities(ir),profiles:clone(ir.view.profiles),fingerprint:fingerprint(JSON.stringify(D.semanticJSON(ir))),dependencies:b.dependencies.slice(),source:clone(ir.view.source)};},
  updateFiles(changes){if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('LIVE010','Expected a source changes map.');return commit({...files,...changes});},
  replaceFiles(next){return commit(next,'Replace workspace');},
  removeFile(file,{force=false}={}){if(!Object.hasOwn(files,file))fail('LIVE012','Missing source file.');const deps=this.dependents(file);if(deps.length&&!force)fail('LIVE033','File is imported by: '+deps.join(', '));const next={...files};delete next[file];return commit(next,'Remove '+file);},
  dependents(file){const out=[];for(const [name,text]of Object.entries(files))try{if(D.parse(text,name).imports.some(i=>resolvePath(name,i.path)===file))out.push(name);}catch{}return out;},
  renameFile(oldName,newName){pathChecked(newName);if(!Object.hasOwn(files,oldName))fail('LIVE012','File not found.');if(Object.hasOwn(files,newName))fail('LIVE034','Destination already exists.');const next={...files};delete next[oldName];
   for(const [name,text]of Object.entries(files)){const doc=D.parse(text,name),bound=doc.declarations[0]?.start??text.length,tokens=D.lex(text,name).filter(t=>t.start<bound),edits=[],newFile=name===oldName?newName:name;for(let i=0;i<tokens.length-1;i++)if(tokens[i].type==='id'&&tokens[i].value==='import'&&tokens[i+1].type==='string'){const tok=tokens[i+1],target=resolvePath(name,tok.value),newTarget=target===oldName?newName:target;if(name===oldName||target===oldName)edits.push({start:tok.start,end:tok.end,text:JSON.stringify(relative(newFile,newTarget))});}next[newFile]=replaceSpans(text,edits);}
   return commit(next,'Rename '+oldName+' to '+newName);},
  applyEdits(edits,{expectedRevision=revision,entry,view}={}){if(expectedRevision!==revision)fail('LIVE030','Source changed since this edit was prepared.');const next={...files},groups=new Map();for(const e of edits){if(!Object.hasOwn(files,e.file))fail('LIVE012','Missing edited file.');if(!groups.has(e.file))groups.set(e.file,[]);groups.get(e.file).push(e);}for(const [f,list]of groups)next[f]=replaceSpans(next[f],list);if(entry)D.build(next,entry,view,assets.registry);else for(const f of groups.keys())D.parse(next[f],f);return commit(next,'Structured edit');},
  history(){return{canUndo:undo.length>0,canRedo:redo.length>0,undoLabel:undo.at(-1)?.label||'',redoLabel:redo.at(-1)?.label||''};},
  undo(){const t=undo.pop();if(!t)return false;historyBytes-=t.bytes;const n={...files};for(const p of t.patch)if(p.before===undefined)delete n[p.file];else n[p.file]=p.before;commit(n,t.label,false);redo.push(t);return true;},
  redo(){const t=redo.pop();if(!t)return false;const n={...files};for(const p of t.patch)if(p.after===undefined)delete n[p.file];else n[p.file]=p.after;commit(n,t.label,false);undo.push(t);historyBytes+=t.bytes;return true;},
  subscribe(fn){if(typeof fn!=='function')throw new TypeError('Listener must be a function.');listeners.add(fn);return()=>listeners.delete(fn);},
  renderSync({entry,view,overrides={},layoutState=null}){
   const start=performance.now(),base=compiled(entry,view),v=apply(base.ir,overrides),p=v.ir.view.profiles;
   const result=backend.Engine.render(v.ir,assets.registry,assets.glyphs,{viewKey:entry+'#'+view,layoutState});
   const redacted=p.export.mode==='redacted',publicIR=result._ir||backend.Export.project(v.ir),fields=redacted?[]:v.ir.elements.flatMap(n=>n.fields||[]);
   const sourceNodes=[];function addSources(x){sourceNodes.push(...x.elements,...x.relations,...x.elements.flatMap(n=>n.fields||[]));for(const ch of x.view.children||[])addSources(ch.ir);}addSources(v.ir);
   const sourceMap=redacted?{}:Object.fromEntries(sourceNodes.filter(n=>n.source).map(n=>[n.id,{name:n.name,...n.source}]));
   for(const m of result.scene.projection?.mapping||[])if(sourceMap[m.source])sourceMap[m.occurrence]={...sourceMap[m.source],sourceId:m.source};
   const keys=clone((redacted?publicIR:v.ir).view.keys);
   return{svg:result.svg,scene:result.scene,layoutState:result.scene.layoutState||null,diagnostics:result.diagnostics||[],entry,view,modelFingerprint:fingerprint(JSON.stringify(D.semanticJSON(redacted?publicIR:base.ir))),revision,milliseconds:performance.now()-start,profiles:clone(redacted?publicIR.view.profiles:p),capabilities:capabilities(v.ir),overrides:v.options,keys,sourceMap,dependencies:redacted?[]:base.dependencies.slice()};
  },
  async render(options){return this.renderSync(options);},
  exportVegaLite({entry,view,overrides={}}){const v=apply(compiled(entry,view).ir,overrides);return backend.Projections.vegaLite(v.ir);},
  evaluateDecision(entry,view,input){return clone(backend.Projections.evaluateDecision(compiled(entry,view).ir,input));},
  simulateLifecycle(entry,view,events,expected){return clone(backend.Projections.simulateLifecycle(compiled(entry,view).ir,events,expected));},
  projectionPlan(entry,view){return clone(backend.Projections.plan(compiled(entry,view).ir,D.DDNError));},
  exportModel({entry,view,overrides={}}){const v=apply(compiled(entry,view).ir,overrides);if(v.ir.view.profiles.layout.x_interaction&&v.ir.view.profiles.export.mode==='redacted')backend.Interaction.validate(v.ir);return backend.Export.serialize(v.ir);},
  snapshot(entry,view,overrides={},layoutState=null){checkOptions(overrides);return{format:'ddn-workspace@1',runtime:ENGINES,files:{...files},entry,view,overrides:clone(overrides),...(layoutState?{layoutState:clone(layoutState)}:{})};},
  destroy(){cache.clear();listeners.clear();undo.length=redo.length=0;files=Object.create(null);destroyed=true;}
 };return ws;
}
const workspaces=new Map();
function registerWorkspace(id,files){if(typeof id!=='string'||!id)fail('LIVE014','Workspace name is required.');const ws=files&&typeof files.renderSync==='function'?files:createWorkspace(files);workspaces.set(id,ws);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ddn-workspace-ready',{detail:{id}}));return ws;}
function fromSnapshot(s){if(!['ddn-workspace@1','ddn-live-snapshot@0.1'].includes(s?.format)||typeof s.entry!=='string'||typeof s.view!=='string')fail('LIVE015','Unknown saved workspace format.');checkOptions(s.overrides||{});pathChecked(s.entry);return{workspace:createWorkspace(s.files),entry:s.entry,view:s.view,overrides:clone(s.overrides||{}),...(s.layoutState?{layoutState:clone(s.layoutState)}:{})};}
return{VERSION,profileCatalogue:clone(D.profiles.catalogue),runtime:ENGINES,LiveError,createWorkspace,registerWorkspace,workspaces,fromSnapshot,defaults,choices,checkOptions,filesChecked,pathChecked,fingerprint,parse:D.parse,lex:D.lex,resolvePath,replaceSpans,kinds:assets.registry.kinds.map(k=>({id:k.keyword,label:k.name,code:k.code})),relations:assets.registry.relationships.map(k=>({id:k.keyword,label:k.name||k.verb,code:k.code})),setTextMetrics:backend.Text.setMetrics,setTextProvider:backend.Text.setProvider};
}
