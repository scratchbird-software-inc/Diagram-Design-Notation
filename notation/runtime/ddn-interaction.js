/* SPDX-License-Identifier: GPL-2.0-or-later
 * Experimental session-bootstrap interaction projection, 0.1.
 * This uses the DDN 0.3 core while preserving its notation. It is not a protocol engine,
 * a cryptographic implementation, or full UML/sequence conformance.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-core.js'),require('./ddn-render.js'),require('./ddn-sketch.js'));
  else root.DDNInteraction=factory(root.DDN,root.DDNRender,root.DDNSketch);
})(typeof globalThis!=='undefined'?globalThis:this,function(DDN,Base,Sketch){
'use strict';
const VERSION='0.1.1', PROFILE='session-bootstrap@0.1';
const esc=Base.esc, text=Base.text, q=DDN.quantity;
const fail=(code,message)=>{throw new DDN.DDNError(code,message);};
function validate(ir){
  const p=ir.view.profiles, profile=p.layout.x_interaction;
  if(profile!==PROFILE)fail('DDN-I001','Unsupported interaction projection '+profile);
  if(p.export?.mode==='redacted')fail('DDN-I032','Experimental interaction publication has no approved payload/occurrence redaction closure; use an explicitly allowlisted ordinary graph view. No SVG is emitted.');
  if(p.layout.routing==='curved'||Object.values(ir.view.routes||{}).some(r=>r.routing==='curved'))fail('DDN-I031','Curved routing belongs to the ordinary graph projection; the experimental interaction profile uses fixed participant lanes. No silent geometry fallback.');
  if(p.legend.mode!=='numbers'||p.legend.placement!=='right')fail('DDN-I002','Interaction 0.1 requires a right-hand numbered relationship key');
  const sequence=p.layout.x_sequence;
  if(typeof sequence!=='string'||!sequence)fail('DDN-I003','A nonempty x_sequence is required');
  const elements=new Map(ir.elements.map(n=>[n.id,n]));
  const actors=ir.view.selected.map(id=>elements.get(id));
  if(!actors.length||actors.some(n=>!n||!n.properties.x_protocol_role))fail('DDN-I004','Select explicit participant objects with x_protocol_role');
  const selected=new Set(actors.map(n=>n.id));
  const steps=ir.relations.filter(r=>r.properties.x_protocol?.sequence===sequence);
  if(!steps.length||steps.length>500)fail('DDN-I005','Interaction must contain between 1 and 500 exchanges');
  const byId=new Map(steps.map(r=>[r.id,r])),ids=new Set(),orders=new Set(),numbers=new Set();
  for(const r of steps){
    const m=r.properties.x_protocol;
    if(typeof m.step!=='string'||!m.step||ids.has(m.step))fail('DDN-I006','Missing or duplicate step identity');ids.add(m.step);
    if(!Number.isSafeInteger(m.display_order)||m.display_order<1||orders.has(m.display_order))fail('DDN-I007','display_order must be a unique positive integer');orders.add(m.display_order);
    if(!Array.isArray(m.after)||m.after.some(x=>!x?.$ref||!byId.has(x.$ref)))fail('DDN-I008','Every after entry must reference an exchange in the same sequence');
    if(new Set(m.after.map(x=>x.$ref)).size!==m.after.length)fail('DDN-I008','Duplicate predecessor');
    if(!selected.has(r.from.element)||!selected.has(r.to.element))fail('DDN-I009','Every exchange endpoint must have a selected participant lane');
    if(!['request','response','challenge','internal','event'].includes(m.form))fail('DDN-I010','Unsupported message form '+m.form);
    if(!['A','B','C','D'].includes(m.phase))fail('DDN-I011','This scenario uses phases A through D');
    if(!m.payload?.$ref||!elements.has(m.payload.$ref)||!['message','record'].includes(elements.get(m.payload.$ref).kind))fail('DDN-I012','Payload must reference an in-scope message or record contract');
    if(typeof m.note!=='string')fail('DDN-I027','The explanatory note must be text');
    if(Object.keys(m).some(k=>!['sequence','step','display_order','after','phase','form','payload','reply_to','note'].includes(k)))fail('DDN-I028','Unknown interaction metadata property');
    if(m.form==='internal'&&(r.from.element!==r.to.element||r.kind!=='invoke'))fail('DDN-I013','Internal events are same-participant invoke relationships');
    if(m.form!=='internal'&&r.kind!=='flow')fail('DDN-I014','Network/local payload exchanges retain the core flow relationship');
    if(m.reply_to){const request=byId.get(m.reply_to.$ref);if(!request||request.id===r.id)fail('DDN-I015','reply_to must identify another exchange');
      if(request.from.element!==r.to.element||request.to.element!==r.from.element)fail('DDN-I016','A reply must reverse the correlated request endpoints');}
    const key=ir.view.keys[r.id];if(!Number.isSafeInteger(key)||key<1||numbers.has(key))fail('DDN-I017','Each exchange requires an explicit unique callout key');numbers.add(key);
  }
  // Ordering comes only from after edges; integers break ties in a valid topological projection.
  const active=new Set(),done=new Set();
  function visit(r){if(active.has(r.id))fail('DDN-I018','Cycle in protocol predecessor graph');if(done.has(r.id))return;active.add(r.id);for(const a of r.properties.x_protocol.after)visit(byId.get(a.$ref));active.delete(r.id);done.add(r.id);}
  steps.forEach(visit);
  for(const r of steps)for(const a of r.properties.x_protocol.after)if(byId.get(a.$ref).properties.x_protocol.display_order>=r.properties.x_protocol.display_order)fail('DDN-I019','display_order conflicts with an explicit predecessor');
  function ancestors(r,set=new Set()){for(const a of r.properties.x_protocol.after)if(!set.has(a.$ref)){set.add(a.$ref);ancestors(byId.get(a.$ref),set);}return set;}
  for(const r of steps)if(r.properties.x_protocol.reply_to&&!ancestors(r).has(r.properties.x_protocol.reply_to.$ref))fail('DDN-I020','A response must causally follow its request');
  const phases=p.layout.x_phases;
  if(phases!==undefined&&(!Array.isArray(phases)||!phases.length||phases.some(x=>!['A','B','C','D'].includes(x))))fail('DDN-I021','x_phases must be a nonempty subset of A, B, C, D');
  const ordered=[...steps].sort((a,b)=>a.properties.x_protocol.display_order-b.properties.x_protocol.display_order);
  const shown=phases?ordered.filter(r=>phases.includes(r.properties.x_protocol.phase)):ordered;
  if(!shown.length)fail('DDN-I022','The selected phases contain no exchanges');
  const shownIds=new Set(shown.map(r=>r.id)), externalPredecessors=shown.flatMap(r=>r.properties.x_protocol.after.filter(x=>!shownIds.has(x.$ref)).map(x=>({step:r.id,predecessor:x.$ref})));
  return {profile,sequence,actors,steps:ordered,shown,externalPredecessors,elements};
}
function render(ir,registry,defs,options={}){
  if(!ir.view.profiles.layout.x_interaction)return Base.render(ir,registry,defs,options);
  const model=validate(ir),p=ir.view.profiles,t=Base.themes[p.style.theme],look=p.style.look;
  const rowH=q(p.layout.x_row_height,68),W=q(p.publication.width,1840),H=q(p.publication.height,400);
  if(rowH<60||rowH>160)fail('DDN-I023','row height must be between 60px and 160px');
  const left=30, legendW=q(p.legend.width,460), legendX=W-legendW-24;
  const diagramW=legendX-left-30, laneW=diagramW/model.actors.length;
  if(laneW<135)fail('DDN-I024','Too many participant lanes for the page width');
  const top=195, end=top+model.shown.length*rowH, needed=end+75;
  if(H<needed)fail('DDN-I025',`Interaction page needs at least ${needed}px height; split phases or enlarge page`);
  if(q(p.style.font_size,16)!==16)fail('DDN-I026','Experimental interaction typography remains 16px; variable fonts are supported by the native core view renderer');
  if(q(p.publication.minimum_text,0)>11)fail('DDN-I026','Smallest interaction labels are 11px; this minimum is unsupported');
  const font=p.style.font==='mono'?'DejaVu Sans Mono, monospace':p.style.font==='serif'?'DejaVu Serif, serif':p.style.font==='handwriting'?'Comic Neue, Segoe Print, Bradley Hand, cursive':'DejaVu Sans, Arial, sans-serif';
  const x=new Map(model.actors.map((n,i)=>[n.id,left+(i+.5)*laneW])), scene={format:'ddn-interaction-scene@0.1',width:W,height:H,scale:1,origin:[0,0],nodes:[],routes:[],messageRows:[],externalPredecessors:model.externalPredecessors};
  let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ddn-title ddn-desc" style="font-family:${font}"><title id="ddn-title">${esc(ir.view.name)}</title><desc id="ddn-desc">Ordered protocol illustration generated from explicit DDN predecessor references. The pale vertical guides are participant lanes, not data-flow relationships. Numbered circles index the adjacent exchange key. Requests and responses use distinct arrows. This is a success-path architecture proposal, not a verified secure protocol.</desc><defs>${defs}</defs><rect width="100%" height="100%" fill="${t.background}"/>`;
  out+=text(30,26,'DDN / SESSION BOOTSTRAP / EXPERIMENTAL INTERACTION PROFILE',11,t.muted,650)+text(30,59,ir.view.name,24,t.ink,650);
  out+=text(30,82,'Explicit predecessors define order. Vertical guides are NOT connectors. Rows show order, not duration.',12,t.muted);
  out+=text(W-30,26,look+' / '+model.shown.length+' of '+model.steps.length+' exchanges',11,t.muted,500,'text-anchor="end"');
  model.actors.forEach((n,i)=>{
    const nx=left+i*laneW+4,nw=laneW-8,k=DDN.kindEntry(registry,n.kind),cx=x.get(n.id),nc=Base.palette.node(k,t);
    out+=`<rect x="${left+i*laneW}" y="190" width="${laneW}" height="${end-190+15}" fill="${i%2?t.surface:t.background}"/>`;
    out+=`<path d="M${cx} 190V${end+15}" stroke="${t.rule}" stroke-width="1" data-guide="participant"/>`;
    out+=`<g class="ddn-node" data-id="${esc(n.id)}" role="group"><title>${esc(n.name)}</title>`+Base.rect(nx,105,nw,77,nc.ink,nc.fill,look,n.id,0,p.style);
    out+=Base.glyph(k.glyph,nx+9,115,19,nc.ink);
    const lines=Base.wrap(n.name,Math.floor((nw-45)/7.5));
    out+=Base.multilines(nx+35,125,lines,12.5,nc.text,17,650);
    out+=text(nx+12,170,k.code+' / '+String(n.properties.x_zone).toUpperCase(),11,nc.ink,600)+'</g>';
    scene.nodes.push({id:n.id,x:nx,y:105,w:nw,h:77});
  });
  out+=Base.line(legendX-15,102,legendX-15,end+15,t.rule,1.2)+text(legendX,123,'EXCHANGE KEY',12,t.ink,700)+text(legendX,147,'Callout / step identity / payload movement',11,t.muted);
  out+=text(legendX,170,'Payload contracts and guard notes are in the companion table.',11,t.muted);
  const phaseNames={A:'AUTHENTICATE',B:'AUTHORIZE BACKEND',C:'NEGOTIATE & READY',D:'FIRST QUERY'};
  model.shown.forEach((r,i)=>{
    const m=r.properties.x_protocol,y=top+i*rowH+rowH/2, ax=x.get(r.from.element),bx=x.get(r.to.element),reg=DDN.relationEntry(registry,r.kind);
    const colour=p.style.theme==='neutral'?'#383838':Base.palette.semantic(reg.colour,t);
    out+=Base.line(left,y+rowH/2-2,W-28,y+rowH/2-2,t.rule,.55);
    let points,keyx;
    if(ax===bx){points=[[ax,y-15],[ax+47,y-15],[ax+47,y+13],[ax,y+13]];keyx=ax+47;}
    else{points=[[ax,y],[bx,y]];keyx=ax+(bx>ax?1:-1)*Math.min(38,Math.abs(bx-ax)/2);}
    out+=`<g class="ddn-relation" data-id="${esc(r.id)}" role="group"><title>${esc(m.step+': '+r.name)}</title>`;
    out+=look==='handDrawn'?Sketch.polyline(points,{...p.style,id:r.id,stroke:colour,width:reg.width,dash:reg.pattern}):`<path d="${Base.pathD(points)}" fill="none" stroke="${colour}" stroke-width="${reg.width}"${reg.pattern?' stroke-dasharray="'+reg.pattern+'"':''}/>`;
    const endp=points.at(-1),prev=points.at(-2),angle=Math.atan2(endp[1]-prev[1],endp[0]-prev[0])*180/Math.PI;
    out+=`<g transform="translate(${endp[0]} ${endp[1]}) rotate(${angle})"><path d="M-10 -5L0 0L-10 5" fill="${m.form==='internal'?'none':colour}" stroke="${colour}" stroke-width="1.6"/></g>`;
    // Callout numerals remain precise in the sketch treatment.
    out+=`<g class="ddn-callout" data-id="${esc(r.id)}"><circle cx="${keyx}" cy="${y}" r="13" fill="${t.surface}" stroke="${t.ink}" stroke-width="1.2"/>`+text(keyx,y+4,String(ir.view.keys[r.id]),11,t.ink,700,'text-anchor="middle"')+'</g></g>';
    const n1=model.elements.get(r.from.element),n2=model.elements.get(r.to.element);
    const heading=m.step+'  '+phaseNames[m.phase]+'  /  '+m.form.toUpperCase();
    out+=`<g data-id="${esc(r.id)}"><circle cx="${legendX+12}" cy="${y}" r="12" fill="${t.surface}" stroke="${t.ink}"/>`+text(legendX+12,y+4,String(ir.view.keys[r.id]),11,t.ink,700,'text-anchor="middle"')+text(legendX+34,y-24,heading,11,t.muted,650);
    out+=Base.multilines(legendX+34,y-5,Base.wrap(r.name,Math.floor((legendW-58)/7.6)),14,t.ink,17,600);
    out+=text(legendX+34,y+rowH/2-12,n1.name+' → '+n2.name,11,t.muted)+'</g>';
    scene.routes.push({id:r.id,points});scene.messageRows.push({id:r.id,step:m.step,callout:ir.view.keys[r.id],y,phase:m.phase,from:r.from.element,to:r.to.element,form:m.form,after:m.after.map(x=>x.$ref),payload:m.payload.$ref});
  });
  const omitted=model.externalPredecessors.length?'Boundary prerequisites retained: '+model.externalPredecessors.map(x=>model.steps.find(r=>r.id===x.predecessor).properties.x_protocol.step).join(', ')+'.':'No hidden predecessor before the first displayed event.';
  out+=text(30,H-43,omitted,11,t.muted)+text(30,H-20,'Proposed architecture · no authentication or SQL is executed · source: session-bootstrap/model.ddn',11,t.muted)+text(W-30,H-20,'Interaction renderer '+VERSION+' / DDN '+DDN.VERSION,11,t.muted,400,'text-anchor="end"')+'</svg>';
  const diagnostics=[...ir.diagnostics,{code:'DDN-IW01',severity:'warning',message:'Experimental interaction projection validates declared predecessor/correlation metadata. It does not validate cryptographic security, real network behavior or full UML sequence semantics.'}];
  return {svg:out,scene,diagnostics};
}
return {VERSION,PROFILE,validate,render};
});
