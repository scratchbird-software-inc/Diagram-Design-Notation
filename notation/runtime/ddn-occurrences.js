/* SPDX-License-Identifier: GPL-2.0-or-later. View appearances, never model copies.
 * The ordinary occurrence keeps its historical scene id. Qualified ids carry
 * the full view/model/ordinal tuple and are opaque to consumers. */
const id=(view,source,number=1)=>number===1?source:'occ:'+JSON.stringify([view,source,number]);
function presentation(base,over){const out={...base,...over};for(const key of ['text','stroke','line','composition'])if(over[key])out[key]={...base[key],...over[key]};return out;}
function expand(ir){
 const layer=ir.view.occurrences;if(!layer||ir.occurrenceMapping)return ir;
 const elements=ir.elements.slice(),relations=ir.relations.slice(),mapping=[];
 const byId=new Map(elements.map(e=>[e.id,e])),byRel=new Map(relations.map(r=>[r.id,r]));
 const sourceIds=new Set([...byId.keys(),...byRel.keys(),...elements.flatMap(e=>[...e.fields,...e.ports].map(f=>f.id))]);
 const defaults=new Map();
 for(const o of [...layer.elements,...layer.relations]){const prev=defaults.get(o.source);if(!prev||o.number<prev.number)defaults.set(o.source,o);}
 for(const o of layer.elements)if(defaults.get(o.source)===o)for(const f of [...byId.get(o.source).fields,...byId.get(o.source).ports])defaults.set(f.id,{id:id(ir.view.id,f.id,o.number),number:o.number});
 // Model references used by visual annotations (association classes, boundary
 // hosts, roots) follow the ordinary lowest-visible-ordinal rule. Endpoint
 // overrides remain explicit and never rewrite their semantic declarations.
 const visualValue=v=>{if(!v||typeof v!=='object')return v;if(v.$ref)return {...v,$ref:defaults.get(v.$ref)?.id||v.$ref};if(Array.isArray(v))return v.map(visualValue);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visualValue(x)]));};
 const visualId=id=>defaults.get(id)?.id||id;
 const keys={...ir.view.keys};
 for(const o of layer.elements){
  const source=byId.get(o.source),props=ir.view.placements[o.id]?.presentation||{};
  const memberId=m=>id(ir.view.id,m,o.number);
  const mapMember=f=>{const fid=memberId(f.id);if(fid!==f.id){
    if(sourceIds.has(fid))throw Object.assign(new Error('Occurrence member identity collides with a model identity'),{code:'DDN-OC02'});
    mapping.push({occurrence:fid,source:f.id,owner:o.id,number:o.number});
   }return {...f,id:fid,properties:visualValue(f.properties),...(f.parent?{parent:memberId(f.parent)}:{})};};
  const n={...source,id:o.id,properties:visualValue(presentation(source.properties,props)),fields:source.fields.map(mapMember),ports:source.ports.map(mapMember)};
  if(o.number===1)elements[elements.findIndex(e=>e.id===o.source)]=n;else elements.push(n);
  mapping.push({occurrence:o.id,source:o.source,number:o.number});
 }
 for(const o of layer.relations){
  const source=byRel.get(o.source);
  const endpoint=(ep,which)=>{const target=layer.elements.find(e=>e.id===o[which]);return {...ep,element:target.id,...(ep.member?{member:id(ir.view.id,ep.member,target.number)}:{})};};
  const overrides=ir.view.routes[o.id]?.presentation||{};
  const r={...source,id:o.id,from:endpoint(source.from,'from'),to:endpoint(source.to,'to'),properties:visualValue(presentation(source.properties,overrides))};
  if(o.number===1)relations[relations.findIndex(r=>r.id===o.source)]=r;else relations.push(r);
  if(keys[o.source]!==undefined)keys[o.id]=keys[o.source];
  mapping.push({occurrence:o.id,source:o.source,number:o.number});
 }
 const ioChildren={...(ir.view.ioChildren||{})};for(const o of layer.elements)if(ioChildren[o.source])ioChildren[o.id]=ioChildren[o.source];
 const flows=(ir.view.flows||[]).map(f=>({...f,steps:f.steps.map(visualId),hops:f.hops.map(visualId)}));
 return {...ir,elements,relations,view:{...ir.view,profiles:{...ir.view.profiles,layout:visualValue(ir.view.profiles.layout)},...(ir.view.ioChildren?{ioChildren}:{}),flows,selected:layer.elements.map(o=>o.id),relations:layer.relations.map(o=>o.id),keys},occurrenceMapping:mapping};
}
export default {id,expand};
