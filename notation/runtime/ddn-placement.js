/* SPDX-License-Identifier: GPL-2.0-or-later
 * Consolidated 0.3 placement orchestration. Keeps the 0.3 native router, text,
 * publication and export checks; imports only pin-pattern geometry from Live.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-layout.js'),require('./ddn-patterns.js'));else root.DDNPlacement=factory(root.DDNLayout,root.DDNPinPlacement);})(typeof globalThis!=='undefined'?globalThis:this,function(Layout,Patterns){
'use strict';
const VERSION='0.6.0-beta.1',q=Layout.q,clone=x=>JSON.parse(JSON.stringify(x));
function fail(code,message){throw Object.assign(new Error(message),{code});}
const center=g=>[g.x+g.w/2,g.y+g.h/2];
const same=(a,b)=>Math.abs(a[0]-b[0])<.001&&Math.abs(a[1]-b[1])<.001;
function stateChecked(state,key){
 if(!state)return null;
 if(state.format!=='ddn-layout-state@1'||state.view!==key||!state.positions||typeof state.positions!=='object'||Array.isArray(state.positions)||Object.keys(state.positions).length>500)fail('DDN-P002','Retained layout state has an invalid format or belongs to another view.');
 for(const [id,p]of Object.entries(state.positions))if(['__proto__','constructor','prototype'].includes(id)||!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1e7))fail('DDN-P002','Invalid retained world coordinates.');
 return state;
}
function place(nodes,rels,ir,options={}){
 const p=ir.view.profiles,at=ir.view.placements||{},algorithm=p.layout.algorithm,diagnostics=[];
 const key=options.viewKey||ir.view.id,state=stateChecked(options.layoutState,key),paused=p.layout.auto_place===false;
 const minGap=2*(q(p.layout.object_clearance,16)+Math.max(24,q(p.layout.port_clearance,28)))+2*q(p.layout.edge_clearance,12);
 const patternMode=algorithm==='auto'?'layered':algorithm==='spanning_tree'?'tree':algorithm;
 const usePattern=['auto','fit_grid','circular','radial','spanning_tree','organic'].includes(algorithm)||(algorithm==='layered'&&p.layout.center==='pins');
 let pattern=null;
 const ErrorClass=class extends Error{constructor(code,message){super(message);this.code=code;}};
 if(usePattern){
  const adapted={...p,layout:{...p.layout,algorithm:patternMode,gap:Layout.round(Math.max(minGap,q(p.layout.gap,100))*Layout.spacingScale(p.layout))}};
  const result=Patterns.place(nodes,rels,ir,adapted);pattern=result.pattern;diagnostics.push(...result.diagnostics);
  if(['left','up'].includes(p.layout.direction)&&patternMode==='layered'){
   for(const n of nodes)if(!at[n.id]?.at){const c=center(n),ax=pattern.anchor[0],ay=pattern.anchor[1];if(p.layout.direction==='left')n.x=2*ax-c[0]-n.w/2;else n.y=2*ay-c[1]-n.h/2;}
  }
 }else{
  const result=Layout.layoutNodes(nodes,rels,p,at,ErrorClass);nodes=result.nodes;diagnostics.push(...result.diagnostics);
 }
 const constraints=Patterns.constraintsFor(ir);
 for(const n of nodes)if(at[n.id]?.at){n.x=q(at[n.id].at[0]);n.y=q(at[n.id].at[1]);}
 const pins=nodes.filter(n=>at[n.id]?.at),bounds=Patterns.bounds(pins),anchor=bounds?center(bounds):null;
 let retained=[];
 if(paused&&state){
  for(const n of nodes)if(!at[n.id]?.at&&state.positions[n.id]){[n.x,n.y]=state.positions[n.id];retained.push(n.id);}
  const occupied=nodes.filter(n=>at[n.id]?.at||retained.includes(n.id));
  for(const n of nodes)if(!occupied.includes(n)){
   let ok=!occupied.some(o=>Layout.overlap(n,o,16));const base=center(n);
   for(let i=1;!ok&&i<1200;i++){const a=i*2.3999632297,d=Math.sqrt(i)*q(p.layout.grid_step,32);n.x=base[0]+Math.cos(a)*d-n.w/2;n.y=base[1]+Math.sin(a)*d-n.h/2;ok=Patterns.fits(n,constraints.get(n.id))&&!occupied.some(o=>Layout.overlap(n,o,16));}
   if(!ok)fail('DDN-P003','No space for a new element without moving retained positions: '+n.id);occupied.push(n);
  }
 }
 for(const n of nodes)if(!Patterns.fits(n,constraints.get(n.id)))fail('DDN-P004','Measured element lies outside a fixed frame: '+n.id);
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(Layout.overlap(nodes[i],nodes[j]))fail('DDN204','Pinned or retained placements overlap: '+nodes[i].id+' / '+nodes[j].id);
 if(pattern){pattern={...pattern,pattern:algorithm,autoPlace:!paused};for(const n of nodes)if(pattern.slots[n.id]){const slot=pattern.slots[n.id];slot.seedCenter=slot.center.slice();slot.center=center(n);slot.finalCenter=center(n);}}
 if(paused)diagnostics.push({code:'DDN-PI01',severity:'info',message:`Auto-placement paused; ${retained.length} free positions retained. New elements still need a seed position.`});
 return{nodes,diagnostics,pattern,anchor,pinned:pins.map(n=>n.id),constraints,telemetry:{algorithm,pattern,pinned:pins.map(n=>n.id),autoPlace:!paused,retentionActive:paused&&!!state,retained,portChanges:0,nodeMoves:0,stages:[]}};
}
/* Local side-order refinement. It permutes only compatible visual slots and
 * tests coupled side changes when visible field rows cannot be interchanged.
 * No source endpoints, node positions, authored offsets or ports are changed.
 * Run against the rendered paths (including cubic samples), not endpoint chords.
 */
function refineEndpointOrder(nodes,rels,ir,best,hints,run){
 const p=ir.view.profiles,byId=new Map(nodes.map(n=>[n.id,n]));
 const limit=rels.length<=16?32:rels.length<=48?12:rels.length<=96?4:0;
 const telemetry={policy:p.layout.endpoint_ordering||'optimize',trials:0,accepted:0,slotSwaps:0,sideChanges:0,budget:limit};
 const reach=Math.max(96,q(p.layout.object_clearance,16)+3*q(p.layout.port_clearance,28)+2*q(p.layout.edge_clearance,12));
 const stable=(a,b)=>a.id.localeCompare(b.id)||a.which.localeCompare(b.which);
 const at=(rt,which)=>which==='source'?rt.points[0]:rt.points.at(-1);
 const distance=(pt,n)=>Math.hypot(Math.max(n.x-pt[0],0,pt[0]-n.x-n.w),Math.max(n.y-pt[1],0,pt[1]-n.y-n.h));
 function endpoints(result){const map=new Map();for(const rt of result.routes){const list=[];for(const which of ['source','target']){const ep=rt.r[which==='source'?'from':'to'],n=byId.get(ep.element),a=ir.view.routes[rt.id]||{},side=rt[which+'_side'],row=n.fieldRows?.find(f=>f.id===ep.member),port=n.n?.ports?.find(f=>f.id===ep.member);
    const locked=a.via!==undefined||a[which+'_fraction']!==undefined||a['x_'+which+'_fraction']!==undefined||!!port;
    list.push({id:rt.id,which,ep,n,a,side,row,point:at(rt,which),slotFree:!locked,sideFree:!locked&&a[which+'_side']===undefined,region:row?row.id:''});
   }map.set(rt.id,list);}return map;}
 function incidents(result){const eps=endpoints(result),out=[];for(const c of result.crossings){const a=eps.get(c.under)||[],b=eps.get(c.over)||[];for(const x of a)for(const y of b)if(x.n.id===y.n.id){out.push({x,y,c,distance:distance(c.point,x.n)});}}
  return out.sort((a,b)=>a.distance-b.distance||a.x.n.id.localeCompare(b.x.n.id)||stable(a.x,b.x)||stable(a.y,b.y));}
 function cost(result){const rs=result.routes;return{crossings:result.crossings.length,localCrossings:incidents(result).filter(c=>c.distance<=reach).length,
    length:rs.reduce((sum,r)=>sum+Layout.segs(r.points).reduce((s,e)=>s+Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),0),0),
    bends:rs.reduce((sum,r)=>sum+Math.max(0,(r.commands?r.commands.length:r.points.length-1)-1),0)};}
 if(!best)return{best,hints,telemetry};telemetry.before=cost(best);
 if(p.layout.endpoint_ordering==='preserve'||p.layout.optimize==='none'||!limit){telemetry.after=telemetry.before;return{best,hints,telemetry};}
 let current=hints;const seen=new Set();
 function accepted(trial){const a=cost(best),b=cost(trial),lengthLimit=Math.min(a.length*1.15+96,telemetry.before.length*1.3+128);
  if(b.length>lengthLimit)return false;
  return b.crossings<a.crossings||b.crossings===a.crossings&&(b.localCrossings<a.localCrossings||b.localCrossings===a.localCrossings&&b.length+b.bends*20<a.length+a.bends*20-1);
 }
 function tryHints(h,type){if(telemetry.trials>=limit)return false;const key=JSON.stringify(Object.entries(h).sort(([a],[b])=>a.localeCompare(b)));if(seen.has(key))return false;seen.add(key);telemetry.trials++;
  try{const trial=run(h);if(accepted(trial)){best=trial;current=h;telemetry.accepted++;if(type==='swap')telemetry.slotSwaps++;else telemetry.sideChanges++;return true;}}
  catch(e){if(!['DDN073','DDN212','DDN213','DDN214','DDN215','DDN216','DDN217','DDN218','DDN220','DDN221','DDN-I030'].includes(e.code))throw e;}
  return false;
 }
 for(let sweep=0;sweep<8&&telemetry.trials<limit;sweep++){
  const conflicts=incidents(best);if(!conflicts.length)break;let changed=false;
  for(const {x,y}of conflicts){
   if(telemetry.trials>=limit)break;
   if(x.side===y.side&&x.region===y.region&&x.slotFree&&y.slotFree){
    const group=[...endpoints(best).values()].flat().filter(e=>e.n.id===x.n.id&&e.side===x.side&&e.region===x.region&&e.slotFree);
    const axis=['west','east'].includes(x.side)?1:0;group.sort((a,b)=>a.point[axis]-b.point[axis]||stable(a,b));
    const ix=group.findIndex(e=>e.id===x.id&&e.which===x.which),iy=group.findIndex(e=>e.id===y.id&&e.which===y.which);
    if(ix>=0&&iy>=0&&ix!==iy){const h=clone(current);group.forEach((e,i)=>{h[e.id]={...(h[e.id]||{}),['_'+e.which+'_order']:i===ix?iy:i===iy?ix:i};});
     if(tryHints(h,'swap')){changed=true;break;}
    }
   }
   // A crossing between distinct fields cannot be fixed by pretending their
   // rows have exchanged identities. Try legal sides jointly instead.
   const alternates=e=>!e.sideFree?[]:(e.row||e.ep.role==='field'?['west','east']:['west','east','north','south']).filter(s=>s!==e.side);
   const xs=alternates(x),ys=alternates(y);
   const options=[...xs.map(s=>[[x,s]]),...ys.map(s=>[[y,s]]),...xs.flatMap(s=>ys.map(t=>[[x,s],[y,t]]))];
   for(const edits of options){const h=clone(current);for(const [e,side]of edits){h[e.id]={...(h[e.id]||{}),[e.which+'_side']:side};delete h[e.id]['_'+e.which+'_order'];}
    if(tryHints(h,'side')){changed=true;break;}if(telemetry.trials>=limit)break;
   }
   if(changed)break;
  }
  if(!changed)break;
 }
 telemetry.after=cost(best);telemetry.exhausted=telemetry.trials>=limit&&telemetry.after.localCrossings>0;
 return{best,hints:current,telemetry};
}

function route(nodes,rels,ir,labelMeasure,obstacles,placed){
 const p=ir.view.profiles,hints=clone(ir.view.routes||{}),ErrorClass=class extends Error{constructor(code,message){super(message);this.code=code;}};
 // For radial/free patterns select initial body sides from the actual vector,
 // not a global left-to-right assumption. Field and authored port contracts win.
 if(['fit_grid','circular','radial','organic'].includes(p.layout.algorithm))for(const r of rels){
  const a=nodes.find(n=>n.id===r.from.element),b=nodes.find(n=>n.id===r.to.element);
  const ca=center(a),cb=center(b),dx=cb[0]-ca[0],dy=cb[1]-ca[1],vertical=Math.abs(dy)>Math.abs(dx);
  for(const [which,n,ep,side]of [['source',a,r.from,vertical?(dy>=0?'south':'north'):(dx>=0?'east':'west')],['target',b,r.to,vertical?(dy>=0?'north':'south'):(dx>=0?'west':'east')]]){
   if(ep.member||hints[r.id]?.[which+'_side']||n.n.ports?.find(f=>f.id===ep.member)?.properties.side)continue;
   hints[r.id]={...(hints[r.id]||{}),[which+'_side']:side};
  }
 }
 const run=h=>Layout.routing(nodes,rels,p,h,labelMeasure,ErrorClass,obstacles);
 let best=null,lastError=null;
 try{best=run(hints);}catch(e){lastError=e;}
 const score=r=>({crossings:r.crossings.length,length:r.routes.reduce((n,r)=>n+Layout.segs(r.points).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0),0),bends:r.routes.reduce((n,r)=>n+Math.max(0,r.points.length-2),0)});
 // A crossing-free route may still contain a costly label excursion. Measure
 // against its own endpoint displacement, not the extent of the whole drawing.
 const inefficient=route=>{const ps=route.points,a=ps[0],b=ps.at(-1),direct=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),walk=Layout.segs(ps).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0);return route.r.from.element!==route.r.to.element&&(route.labelDetour||walk>direct*1.8+120);};
 const needsWork=()=>!best||best.crossings.length>0||best.routes.some(inefficient);
 const initial=best?score(best):null,stages=[{stage:'initial-clear-routing',...(initial||{failure:lastError?.code})}];
 let trials=0,portChanges=0,nodeMoves=0,endpointOrdering=null;
 const budget=rels.length<=12?24:rels.length<=32?8:0;
 const eligible=e=>!['DDN073','DDN-I030','DDN223'].includes(e?.code);
 if(p.layout.optimize!=='none'&&(!lastError||eligible(lastError))){
  const improves=r=>{if(!best)return true;const a=score(best),b=score(r);return b.crossings<a.crossings&&b.length<=a.length*1.35+52 || b.crossings===a.crossings&&b.length+b.bends*20<a.length+a.bends*20-1;};
  let currentHints=hints;
  // Change visual attachment positions before relocating any object. Named field
  // or port identities are never rewritten; explicit sides/fractions stay hard.
  const conflicts=()=>new Set([...(best?.crossings||[]).flatMap(c=>[c.under,c.over]),...(best?.routes||[]).filter(inefficient).map(r=>r.id)]);
  for(const r of [...rels].sort((a,b)=>Number(lastError?.message?.includes(b.id))-Number(lastError?.message?.includes(a.id)))){
   if(trials>=budget||!needsWork())break;if(best&&!conflicts().has(r.id))continue;
   const authored=ir.view.routes[r.id]||{};
   if(authored.via?.length&&((authored.policy||p.layout.route_policy)==='strict'))continue;
   for(const which of ['source','target']){
    if(trials>=budget||!needsWork())break;
    const ep=r[which==='source'?'from':'to'],n=nodes.find(n=>n.id===ep.element),port=n.n.ports?.find(f=>f.id===ep.member);
    const active=best?.routes.find(rt=>rt.id===r.id),sideKey=which+'_side',fracKey=which+'_fraction',candidates=[];
    const currentSide=active?.[sideKey]||currentHints[r.id]?.[sideKey]||authored[sideKey];
    // Align a free body anchor to the opposite endpoint before trying another
    // side. Field/port identities and explicitly authored offsets are immutable.
    if(active&&!ep.member&&authored[fracKey]===undefined&&authored['x_'+fracKey]===undefined){
     const other=which==='source'?active.points.at(-1):active.points[0],vertical=['east','west'].includes(currentSide),fraction=vertical?(other[1]-n.y)/n.h:(other[0]-n.x)/n.w;
     if(fraction>=.12&&fraction<=.88)candidates.push({[sideKey]:currentSide,[fracKey]:fraction});
    }
    if(authored[sideKey]===undefined&&!port?.properties.side){
     const sides=ep.member&&n.n.fields.some(f=>f.id===ep.member)?['east','west']:['east','west','south','north'];
     for(const side of sides)if(side!==currentSide)candidates.push({[sideKey]:side});
    }
    for(const candidate of candidates){if(trials>=budget||!needsWork())break;
     const h=clone(currentHints);h[r.id]={...(h[r.id]||{}),...candidate};trials++;
     try{const trial=run(h);if(improves(trial)){best=trial;currentHints=h;portChanges++;lastError=null;}}catch(e){if(!eligible(e))throw e;}
    }
   }
  }
  stages.push({stage:'connection-points',trials,accepted:portChanges,...(best?score(best):{failure:lastError?.code})});
  if(best){const local=refineEndpointOrder(nodes,rels,ir,best,currentHints,run);best=local.best;currentHints=local.hints;endpointOrdering=local.telemetry;stages.push({stage:'local-endpoint-ordering',...endpointOrdering.after,trials:endpointOrdering.trials,accepted:endpointOrdering.accepted});}
  const slots=placed.pattern?.slots||{},protectedIds=new Set(placed.pinned);
  for(const r of rels)if((ir.view.routes[r.id]?.via?.length||0)>0){protectedIds.add(r.from.element);protectedIds.add(r.to.element);}
  // Frames and inline views add ownership/placement constraints. Do not move
  // their members in a post-layout pass that could invalidate those bounds.
  const canMove=!placed.telemetry.retentionActive&&!ir.view.frames.length&&!ir.view.subdiagrams.length;
  if(canMove&&(!best||score(best).crossings>0)){
   const free=nodes.filter(n=>!protectedIds.has(n.id)),remaining=new Set((best?.crossings||[]).flatMap(c=>[c.under,c.over]));let nt=0;
   const originalBy=new Map(nodes.map(n=>[n.id,[n.x,n.y]]));
   for(let i=0;i<free.length&&nt<Math.min(12,budget);i++)for(let j=i+1;j<free.length&&nt<Math.min(12,budget);j++){
    if(best&&score(best).crossings===0)break;
    const a=free[i],b=free[j],sa=slots[a.id],sb=slots[b.id];
    if(placed.pattern&&(!sa||!sb||sa.key!==sb.key))continue;
    if(!placed.pattern&&['mindmap','tree','layered','grouped'].includes(p.layout.algorithm))continue;
    const oldA=[a.x,a.y],oldB=[b.x,b.y],ca=center(a),cb=center(b);a.x=cb[0]-a.w/2;a.y=cb[1]-a.h/2;b.x=ca[0]-b.w/2;b.y=ca[1]-b.h/2;
    const clear=nodes.every((x,k)=>nodes.slice(k+1).every(y=>!Layout.overlap(x,y,16)));
    nt++;
    let accepted=false;if(clear)try{const trial=run(currentHints);if(improves(trial)){best=trial;accepted=true;nodeMoves+=2;lastError=null;}}catch(e){}
    if(!accepted){[a.x,a.y]=oldA;[b.x,b.y]=oldB;}
   }
   trials+=nt;
  }
  stages.push({stage:'unpinned-elements',accepted:nodeMoves,...(best?score(best):{failure:lastError?.code})});
  if(best&&nodeMoves){const local=refineEndpointOrder(nodes,rels,ir,best,currentHints,run);best=local.best;currentHints=local.hints;endpointOrdering={...local.telemetry,before:endpointOrdering?.before,prior:endpointOrdering};stages.push({stage:'final-endpoint-ordering',...local.telemetry.after,trials:local.telemetry.trials,accepted:local.telemetry.accepted});}
 }
 if(!best)throw lastError||new ErrorClass('DDN215','No valid route under the authored constraints.');
 stages.push({stage:'residual-short-routes-and-crossing-marks',...score(best)});
 if(best.crossings.length)best.diagnostics.push({code:'DDN-LW05',severity:'warning',message:`${best.crossings.length} disconnected crossings remain after bounded routing; rendered with ${p.layout.crossings}.`});
 if(!budget&&rels.length>32&&p.layout.optimize!=='none')best.diagnostics.push({code:'DDN-LW06',severity:'info',message:'Larger graph: native obstacle routing runs, but expensive whole-graph crossing trials are skipped.'});
 if(placed.pattern)for(const n of nodes)if(placed.pattern.slots[n.id]){placed.pattern.slots[n.id].center=center(n);placed.pattern.slots[n.id].finalCenter=center(n);}
 return{...best,telemetry:{portChanges,nodeMoves,portTrials:trials,endpointOrdering,stages,pattern:placed.pattern,remainingCrossings:best.crossings.length}};
}
return{VERSION,place,route,stateChecked,centeredBounds:Patterns.centeredBounds};
});
