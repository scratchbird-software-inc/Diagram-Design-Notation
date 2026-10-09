/* SPDX-License-Identifier: GPL-2.0-or-later. Explicit UML structural assertions. */
export function validateUmlStructure(ir,fail){
 const nodes=new Map(ir.elements.map(n=>[n.id,n])),packages=new Set(ir.elements.filter(n=>n.kind==='uml.package').map(n=>n.id)),owners=new Map();
 for(const n of ir.elements)if(n.properties.x_pack?.package!==undefined){const id=n.properties.x_pack.package?.$ref;if(!packages.has(id)||id===n.id)fail('DDN-PJ225','Package ownership must reference a different uml.package',n);owners.set(n.id,id);}
 const ancestors=id=>{const out=new Set();while(owners.has(id)){id=owners.get(id);if(out.has(id))fail('DDN-PJ225','Package ownership contains a cycle',nodes.get(id));out.add(id);}return out;};for(const id of owners.keys())ancestors(id);
 const merges=[];
 for(const r of ir.relations){
  if(!['uml.import','uml.access','uml.merge'].includes(r.kind))continue;
  if(!packages.has(r.from.element)||r.from.member||r.to.member)fail('DDN-PJ225','Package dependencies start at a package and use element endpoints',r);
  if(r.kind==='uml.merge'){
   if(!packages.has(r.to.element)||r.from.element===r.to.element||ancestors(r.from.element).has(r.to.element)||ancestors(r.to.element).has(r.from.element))fail('DDN-PJ225','Package merge cannot join a package to itself, its ancestor or its descendant',r);
   merges.push(r);
  }else if(nodes.get(r.to.element)?.properties.x_pack?.visibility==='private')fail('DDN-PJ225','An element import cannot expose a private packaged element',r);
 }
 const active=new Set(),done=new Set(),visit=id=>{if(active.has(id))fail('DDN-PJ225','Package merge graph contains a cycle',nodes.get(id));if(done.has(id))return;active.add(id);for(const r of merges)if(r.from.element===id)visit(r.to.element);active.delete(id);done.add(id);};for(const id of packages)visit(id);
 const members=new Map(ir.elements.flatMap(n=>[...n.fields,...n.ports].map(m=>[m.id,{node:m,owner:n}])));
 const assertInterfaces=(n,owner)=>{const x=n.properties.x_interfaces;if(x===undefined)return;
  if(!['uml.component','uml.class','uml.collaboration','sysml.block','soaml.participant','soaml.agent','soaml.serviceinterface'].includes(owner.kind))fail('DDN-PJ226','Interface assertions belong to classifiers or their connectable members',n);
  for(const key of ['provides','requires']){const refs=x[key]||[];if(!Array.isArray(refs)||refs.length>64||new Set(refs.map(r=>r?.$ref)).size!==refs.length||refs.some(r=>nodes.get(r?.$ref)?.kind!=='uml.interface'))fail('DDN-PJ226','Interface assertions reference distinct uml.interface definitions',n);}
 };
 for(const n of ir.elements){assertInterfaces(n,n);for(const m of [...n.fields,...n.ports])assertInterfaces(m,n);}
 const interfaceAncestors=id=>{const seen=new Set([id]),todo=[id];while(todo.length){const next=todo.pop();for(const r of ir.relations)if(r.kind==='uml.generalization'&&r.from.element===next&&nodes.get(r.to.element)?.kind==='uml.interface'&&!seen.has(r.to.element)){seen.add(r.to.element);todo.push(r.to.element);}}return seen;};
 const compatible=(provided,required)=>provided.some(ref=>interfaceAncestors(ref.$ref).has(required.$ref));
 const connected=new Map();
 for(const r of ir.relations){if(!['uml.assembly','uml.delegation','uml.connector'].includes(r.kind))continue;
  const endpoint=e=>e.member?members.get(e.member)?.node:nodes.get(e.element),a=endpoint(r.from),b=endpoint(r.to),ax=a?.properties.x_interfaces,bx=b?.properties.x_interfaces;
  if(ax===undefined&&bx===undefined)continue;
  if(ax===undefined||bx===undefined)fail('DDN-PJ226','Typed connector checks require explicit interface assertions on both endpoints',r);
  // A boundary port reverses its effective interfaces inside a delegation.
  const ap=r.kind==='uml.delegation'?(ax.requires||[]):(ax.provides||[]),ar=r.kind==='uml.delegation'?(ax.provides||[]):(ax.requires||[]),bp=bx.provides||[],br=bx.requires||[];
  if(r.properties.x_nary)fail('DDN-PJ226','Typed interface assertions currently require binary connector records',r);
  for(const [node,required,provided,delegating]of [[a,ar,bp,r.kind==='uml.delegation'],[b,br,ap,false]]){const key=node.id+':'+delegating;if(!connected.has(key))connected.set(key,{required,provided:[],relation:r});connected.get(key).provided.push(...provided);}

 }
 for(const group of connected.values())if(group.required.some(ref=>!compatible(group.provided,ref)))fail('DDN-PJ226','Connected endpoints do not collectively provide the required interfaces',group.relation);
 return {packages:packages.size,merges:merges.length};
}
