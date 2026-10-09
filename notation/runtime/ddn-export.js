/* SPDX-License-Identifier: GPL-2.0-or-later. Explicit allowlist export, separate from display hiding.
 * The caller is responsible for authorization and classification decisions. This is not a DLP classifier.
 */
import Occurrences from './ddn-occurrences.js';
import {publishNamespace} from './ddn-module-registry.js';
'use strict';
const ref=v=>typeof v==='string'?v:v?.$ref;
const copy=x=>JSON.parse(JSON.stringify(x));
function project(ir){
 const policy=ir.view.profiles.export||{mode:'full'};if(policy.mode!=='redacted')return ir;
 if(!Array.isArray(policy.elements)||!Array.isArray(policy.fields)||!policy.elements.length)throw Object.assign(new Error('Redacted export requires explicit nonempty elements and an explicit field allowlist'),{code:'DDN150'});
 if(policy.include_samples)throw Object.assign(new Error('Public sample export needs a separately approved payload fixture; unsupported in redacted profile'),{code:'DDN154'});
 const allowed=new Set(policy.elements.map(ref)),allowedFields=new Set(policy.fields.map(ref)),all=new Set(ir.elements.map(n=>n.id));
 for(const id of allowed)if(!all.has(id))throw Object.assign(new Error('Export allowlist contains an unresolved object'),{code:'DDN151'});
 const names=new Map(),alias=id=>{if(!names.has(id))names.set(id,policy.identifier_mode==='preserve'?id:'published::n'+String(names.size+1).padStart(4,'0'));return names.get(id);};
 /* 0.8 amendment (ch. 11, fixed-lane occurrence/payload export closure): a
  * fixed-lane interaction view (layout.x_interaction) exports through the
  * SAME allowlist projection, with the occurrence rules of the chapter: an
  * exchange survives only when its endpoints AND its payload contract are
  * all allowlisted (never a partial payload); occurrence metadata keeps the
  * structural choreography subset (sequence/step/display_order/after/phase/
  * form/reply_to — note is free text and is dropped, exactly like other
  * free-text metadata); payload message/record contracts and participant
  * roles/zones export like ordinary elements under the same allowlists. The
  * closure never bypasses the selected export policy. */
 const interaction=ir.view.profiles.layout?.x_interaction?ir.view.profiles.layout:null;
 const INTERACTION_ELEMENT_PROPS=['x_protocol_role','x_zone'];
 const safeProperties=new Set(['kind','level','shape','presence','nullable','key','datatype','domain','unit','maturity','workload','role','temporal','distribution','location','direction']);
 const keep=new Set(policy.properties||[]);
 for(const key of keep)if(!safeProperties.has(key))throw Object.assign(new Error('Redacted property is not in the safe structural vocabulary: '+key),{code:'DDN152'});
 const approved=[...ir.elements].filter(n=>allowed.has(n.id)&&n.type!=='sample'&&n.kind!=='sample');
 approved.sort((a,b)=>a.id.localeCompare(b.id)).forEach(n=>{alias(n.id);n.fields.filter(f=>allowedFields.has(f.id)).forEach(f=>alias(f.id));});
 function value(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(value).filter(x=>x!==undefined);if(v.$ref)return names.has(v.$ref)?{$ref:alias(v.$ref)}:undefined;const out={};for(const[k,x]of Object.entries(v)){const p=value(x);if(p!==undefined)out[k]=p;}return out;}
 function props(p){const out={};for(const[k,v]of Object.entries(p||{}))if(keep.has(k)||(interaction&&INTERACTION_ELEMENT_PROPS.includes(k))){const x=value(v);if(x!==undefined)out[k]=x;}return out;}
 const elements=approved.map(n=>({id:alias(n.id),ref:alias(n.id),local:alias(n.id).split('::')[1],name:n.name,type:n.type,kind:n.kind,kindCode:n.kindCode,properties:props(n.properties),fields:n.fields.filter(f=>allowedFields.has(f.id)).map(f=>{
  if(f.parent&&!allowedFields.has(f.parent))throw Object.assign(new Error('A nested field export must explicitly include its ancestor fields'),{code:'DDN153'});
  return{id:alias(f.id),local:f.local,name:f.name,path:f.path,depth:f.depth,parent:f.parent?alias(f.parent):null,properties:props(f.properties)};
 }),ports:[]}));
 const selected=ir.view.selected.filter(id=>allowed.has(id)&&approved.some(n=>n.id===id)).map(alias),shown=new Set(selected);
 /* Occurrence closure (ch. 11): whole-or-nothing per exchange — a dropped
  * payload or endpoint drops the exchange, never a partial payload.
  * Surviving exchanges are aliased up front so after/reply_to references
  * resolve regardless of declaration order. */
 const surviving=ir.relations.filter(r=>allowed.has(r.from.element)&&allowed.has(r.to.element)&&(!r.from.member||allowedFields.has(r.from.member))&&(!r.to.member||allowedFields.has(r.to.member)))
  .filter(r=>!interaction||!r.properties?.x_protocol||allowed.has(r.properties.x_protocol.payload?.$ref));
 if(interaction)surviving.forEach(r=>alias(r.id));
 const rels=surviving.map(r=>{
  if(interaction&&r.properties?.x_protocol){
   const m=r.properties.x_protocol;
   const occ={sequence:m.sequence,step:m.step,display_order:m.display_order,
    after:(m.after||[]).map(x=>names.has(x.$ref)?{$ref:alias(x.$ref)}:null).filter(Boolean),
    phase:m.phase,form:m.form,payload:{$ref:alias(m.payload.$ref)}};
   if(m.reply_to?.$ref&&names.has(m.reply_to.$ref))occ.reply_to={$ref:alias(m.reply_to.$ref)};
   /* note is free text: dropped, exactly like source locations and other
    * free-text metadata in this projection (see DDN-PUBLIC). */
   return{id:alias(r.id),ref:alias(r.id),name:r.name,kind:r.kind,kindCode:r.kindCode,
    from:{element:alias(r.from.element),...(r.from.member?{member:alias(r.from.member),role:'field'}:{})},
    to:{element:alias(r.to.element),...(r.to.member?{member:alias(r.to.member),role:'field'}:{})},
    properties:{x_protocol:occ}};
  }
  return{id:alias(r.id),ref:alias(r.id),name:r.kind,kind:r.kind,kindCode:r.kindCode,from:{element:alias(r.from.element),...(r.from.member?{member:alias(r.from.member),role:'field'}:{})},to:{element:alias(r.to.element),...(r.to.member?{member:alias(r.to.member),role:'field'}:{})},properties:{}};
 });
 if(interaction&&!rels.some(r=>r.properties?.x_protocol))throw Object.assign(new Error('The occurrence/payload closure leaves no exportable exchanges; widen the elements allowlist to cover the exchanges and their payload contracts, or export full'),{code:'DDN-I033'});
 const profiles=copy(ir.view.profiles);profiles.export={mode:'full'};delete profiles.publication.caption;profiles.publication.title=policy.title||'Published data view';profiles.validation={mode:'logical',unknown_extensions:'warn'};profiles.legend.keys={};delete profiles.legend.keyset;delete profiles.layout.root;for(const group of Object.values(profiles))if(group&&typeof group==='object')for(const key of Object.keys(group))if(key.startsWith('x_'))delete group[key];
 /* Occurrence closure (ch. 11): the interaction profile's structural layout
  * config is choreography, not payload — it survives the x_ strip. */
 if(interaction){profiles.layout.x_interaction=interaction.x_interaction;if(interaction.x_sequence!==undefined)profiles.layout.x_sequence=interaction.x_sequence;if(interaction.x_phases!==undefined)profiles.layout.x_phases=copy(interaction.x_phases);if(interaction.x_row_height!==undefined)profiles.layout.x_row_height=interaction.x_row_height;}
 const keys={};for(const r of ir.relations)if(names.has(r.id)&&ir.view.keys[r.id])keys[alias(r.id)]=ir.view.keys[r.id];
 const output={format:'ddn-resolved@0.3',language:'0.3',registry:ir.registry,entry:'published.ddn',view:{id:'published::view',name:policy.title||'Published data view',local:'published',selected,relations:rels.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element)).map(r=>r.id),profiles,keys,placements:{},routes:{},subdiagrams:[],frames:[]},elements,relations:rels,diagnostics:[{code:'DDN-PUBLIC',severity:'info',message:'Allowlist projection. Source locations, free-text metadata, examples, and inline views removed.'}],publication:{audience:'allowlisted',sourceIncluded:false,samplesIncluded:false}};
 if(ir.view.occurrences){
  const mapId=new Map();
  const elements=ir.view.occurrences.elements.filter(o=>names.has(o.source)&&allowed.has(o.source)).map(o=>{const source=alias(o.source),id=Occurrences.id(output.view.id,source,o.number);mapId.set(o.id,id);return {id,source,number:o.number};});
  const relations=ir.view.occurrences.relations.filter(o=>rels.some(r=>r.id===names.get(o.source))&&mapId.has(o.from)&&mapId.has(o.to)).map(o=>({id:Occurrences.id(output.view.id,alias(o.source),o.number),source:alias(o.source),number:o.number,from:mapId.get(o.from),to:mapId.get(o.to)}));
  output.view.occurrences={version:1,elements,relations};
  output.view.selected=[...new Set(elements.map(o=>o.source))];output.view.relations=[...new Set(relations.map(o=>o.source))];
 }
 // Deliberately no counts or identifiers of excluded records: those can themselves disclose information.
 return output;
}
function sql(ir){
 const policy=ir.view.profiles.export||{};
 if(policy.mode!=='redacted')throw Object.assign(new Error('SQL export requires the redacted allowlist export profile (mode:redacted with explicit elements and fields)'),{code:'DDN150'});
 project(ir); // authorization gate: throws DDN150-DDN154 on policy violations
 const allowed=new Set(policy.elements.map(ref)),allowedFields=new Set((policy.fields||[]).map(ref));
 const pkAllowed=new Set(policy.properties||[]).has('key');
 const snake=v=>String(v).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
 // Ids/kinds are interpolated into `-- ` line comments verbatim; a newline in
 // an id would break out of the comment and inject attacker-chosen SQL text.
 const cmt=v=>String(v).replace(/[^\x20-\x7E]/g,'?');
 const tables=new Map(),elementNotes=new Map(),relationNotes=[],tablesSeen=new Map();
 for(const n of ir.elements){
  if(!allowed.has(n.id)||n.type==='sample'||n.kind==='sample')continue;
  if(n.kind!=='table'){elementNotes.set(n.id,`-- skipped: ${cmt(n.id)} (kind ${cmt(n.kind)} is not table)`);continue;}
  const tname=snake(n.name);
  if(!tname){elementNotes.set(n.id,`-- skipped: ${cmt(n.id)} (name has no SQL identifier characters)`);continue;}
  if(tablesSeen.has(tname))throw Object.assign(new Error('Duplicate SQL identifier after snake_case normalization: '+tname),{code:'DDN-PJ092'});
  tablesSeen.set(tname,n.id);
  const fields=n.fields.filter(f=>allowedFields.has(f.id)),colsSeen=new Map(),cols=[];
  for(const f of fields){const c=snake(f.name||f.local);if(colsSeen.has(c))throw Object.assign(new Error('Duplicate SQL identifier after snake_case normalization: '+c),{code:'DDN-PJ092'});colsSeen.set(c,f.id);cols.push({id:f.id,col:c,primary:pkAllowed&&f.properties&&f.properties.key==='primary'});}
  tables.set(n.id,{name:tname,cols,fks:[]});
 }
 for(const r of ir.relations){
  if(!allowed.has(r.from.element)||!allowed.has(r.to.element))continue; // excluded records stay invisible: no counts or identifiers
  if(!tables.has(r.from.element)||!tables.has(r.to.element)){relationNotes.push(`-- skipped: ${cmt(r.id)} (endpoint is not an exported table)`);continue;}
  if(r.kind!=='ref'){relationNotes.push(`-- skipped: ${cmt(r.id)} (kind ${cmt(r.kind)} is not ref)`);continue;}
  if(!r.properties||r.properties.enforcement!=='database'){relationNotes.push(`-- skipped: ${cmt(r.id)} (enforcement is not "database")`);continue;}
  if(!r.from.member||!r.to.member){relationNotes.push(`-- skipped: ${cmt(r.id)} (no field-level endpoints)`);continue;}
  const from=tables.get(r.from.element),to=tables.get(r.to.element),fc=from.cols.find(c=>c.id===r.from.member),tc=to.cols.find(c=>c.id===r.to.member);
  if(!allowedFields.has(r.from.member)||!allowedFields.has(r.to.member)||!fc||!tc){relationNotes.push(`-- skipped: ${cmt(r.id)} (endpoint field outside field allowlist)`);continue;}
  from.fks.push(`FOREIGN KEY (${fc.col}) REFERENCES ${to.name}(${tc.col})`);
 }
 if(!tables.size)throw Object.assign(new Error('SQL export found no allowlisted table objects; nothing to export'),{code:'DDN-PJ088'});
 const blocks=['-- DDN SQL DDL export · TEXT columns · declaration order · synthetic illustrative DDL, not a deployable schema'];
 const pushNote=text=>{if(blocks.at(-1).startsWith('-- ')&&blocks.length>1)blocks[blocks.length-1]+='\n'+text;else blocks.push(text);};
 for(const n of ir.elements){
  if(!allowed.has(n.id)||n.type==='sample'||n.kind==='sample')continue;
  const t=tables.get(n.id);
  if(!t){pushNote(elementNotes.get(n.id));continue;}
  const lines=t.cols.map(c=>`  ${c.col} TEXT`),pk=t.cols.filter(c=>c.primary).map(c=>c.col);
  if(pk.length)lines.push(`  PRIMARY KEY (${pk.join(', ')})`);
  for(const fk of t.fks)lines.push(`  ${fk}`);
  blocks.push(`CREATE TABLE ${t.name} (\n${lines.join(',\n')}\n);`);
 }
 for(const note of relationNotes)pushNote(note);
 return blocks.join('\n\n')+'\n';
}
function serialize(ir){const policy=ir.view.profiles.export||{};if(policy.format==='sql')return sql(ir);return JSON.stringify(project(ir),null,2)+'\n';}
const api={project,serialize,sql};
publishNamespace('DDNExport',api);
export default api;
