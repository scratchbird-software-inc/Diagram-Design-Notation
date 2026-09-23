/* SPDX-License-Identifier: GPL-2.0-or-later
 * Pinned-centre layout patterns, 0.3.0-draft.2.
 * Original bounded algorithms; no yWorks/yEd/yFiles code or assets are used.
 * Node pins are world-space top-left coordinates, never suggestions.
 */
import {publishNamespace} from './ddn-module-registry.js';
'use strict';
const MODES = ['fit_grid', 'circular', 'radial', 'layered', 'tree', 'organic'];
const EPS = 0.01;
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const q = (v,d=0) => typeof v === 'number' ? v : v?.$quantity !== undefined ? v.$quantity * ({px:1,pt:96/72,mm:96/25.4,cm:96/2.54,in:96}[v.unit] || 1) : d;
const center = n => [n.x+n.w/2,n.y+n.h/2];
const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const overlaps = (a,b,gap=0) => a.x < b.x+b.w+gap-EPS && a.x+a.w > b.x-gap+EPS && a.y < b.y+b.h+gap-EPS && a.y+a.h > b.y-gap+EPS;
const error = (code,message) => { throw Object.assign(new Error(message),{code}); };
const maxOf=(xs,f,seed=-Infinity)=>{let m=seed;for(const x of xs){const v=f(x);if(v>m)m=v;}return m;};
function bounds(nodes) {
 if (!nodes.length) return null;
 const minX=nodes.reduce((m,n)=>Math.min(m,n.x),Infinity), minY=nodes.reduce((m,n)=>Math.min(m,n.y),Infinity);
 return {x:minX,y:minY,w:nodes.reduce((m,n)=>Math.max(m,n.x+n.w),-Infinity)-minX,h:nodes.reduce((m,n)=>Math.max(m,n.y+n.h),-Infinity)-minY};
}
function constraintsFor(ir) {
 const result=new Map();
 // frame_overflow (RFC-118): fixed-frame interior constraints bind placement
 // only under `confine`; under the default `expand` the frame rect grows to
 // enclose members instead of constraining them.
 if(ir.view.profiles?.layout?.frame_overflow!=='confine')return result;
 for (const frame of ir.view.frames || []) if(frame.at && frame.size) {
  const next={x:q(frame.at[0])+20,y:q(frame.at[1])+54,w:q(frame.size[0])-40,h:q(frame.size[1])-76};
  for(const id of frame.members) {
   const old=result.get(id);
   if(!old) result.set(id,{...next});
   else {
    const x=Math.max(old.x,next.x),y=Math.max(old.y,next.y);
    result.set(id,{x,y,w:Math.min(old.x+old.w,next.x+next.w)-x,h:Math.min(old.y+old.h,next.y+next.h)-y});
   }
  }
 }
 return result;
}
function fits(n,b) { return !b || n.x >= b.x-EPS && n.y >= b.y-EPS && n.x+n.w <= b.x+b.w+EPS && n.y+n.h <= b.y+b.h+EPS; }
function adjacency(nodes,rels) {
 const adj=new Map(nodes.map(n=>[n.id,new Set()]));
 for(const r of rels) {
  const a=r.from.element,b=r.to.element;
  if(a!==b && adj.has(a) && adj.has(b)) { adj.get(a).add(b);adj.get(b).add(a); }
 }
 return new Map([...adj].map(([k,v])=>[k,[...v].sort(cmp)]));
}
function distances(nodes,adj,roots) {
 const rank=new Map(),parent=new Map(),queue=[...roots].sort(cmp);
 for(const r of queue) {rank.set(r,0);parent.set(r,null);}
 for(let i=0;i<queue.length;i++) for(const id of adj.get(queue[i]) || []) if(!rank.has(id)) {
  rank.set(id,rank.get(queue[i])+1);parent.set(id,queue[i]);queue.push(id);
 }
 const reachableMax=maxOf(rank.values(),v=>v,0),disconnected=[];
 // Retain disconnected components, with their own breadth-first order outside
 // the reachable layers. No component is silently discarded.
 for(const n of nodes) if(!rank.has(n.id)) {
  disconnected.push(n.id);rank.set(n.id,reachableMax+1);parent.set(n.id,null);
  const sub=[n.id];for(let i=0;i<sub.length;i++) for(const id of adj.get(sub[i]) || []) if(!rank.has(id)) {
   rank.set(id,rank.get(sub[i])+1);parent.set(id,sub[i]);sub.push(id);
  }
 }
 return {rank,parent,disconnected};
}
function directedRanks(nodes,rels) {
 const adj=new Map(nodes.map(n=>[n.id,[]]));
 for(const r of rels) if(adj.has(r.from.element)&&adj.has(r.to.element)&&r.from.element!==r.to.element) adj.get(r.from.element).push(r.to.element);
 for(const a of adj.values())a.sort(cmp);
 let tick=0;const idx=new Map(),low=new Map(),stack=[],active=new Set(),parts=[];
 // Iterative Tarjan: deep graphs must not exhaust the call stack.
 for(const first of nodes) {
  if(idx.has(first.id))continue;
  idx.set(first.id,tick);low.set(first.id,tick++);stack.push(first.id);active.add(first.id);
  const call=[[first.id,0]];
  while(call.length) {
   const frame=call.at(-1),id=frame[0],kids=adj.get(id);
   if(frame[1]<kids.length) {
    const to=kids[frame[1]++];
    if(!idx.has(to)){idx.set(to,tick);low.set(to,tick++);stack.push(to);active.add(to);call.push([to,0]);}
    else if(active.has(to))low.set(id,Math.min(low.get(id),idx.get(to)));
   } else {
    call.pop();
    if(call.length){const parent=call.at(-1)[0];low.set(parent,Math.min(low.get(parent),low.get(id)));}
    if(low.get(id)===idx.get(id)){const part=[];let item;do{item=stack.pop();active.delete(item);part.push(item);}while(item!==id);parts.push(part.sort(cmp));}
   }
  }
 }
 const group=new Map();parts.forEach((p,i)=>p.forEach(id=>group.set(id,i)));
 const out=parts.map(()=>new Set()),inc=parts.map(()=>0),rank=parts.map(()=>0);
 for(const [a,bs] of adj)for(const b of bs){const x=group.get(a),y=group.get(b);if(x!==y&&!out[x].has(y)){out[x].add(y);inc[y]++;}}
 const queue=parts.map((_,i)=>i).filter(i=>!inc[i]);
 while(queue.length){queue.sort((a,b)=>cmp(parts[a][0],parts[b][0]));const i=queue.shift();for(const j of out[i]){rank[j]=Math.max(rank[j],rank[i]+1);if(--inc[j]===0)queue.push(j);}}
 return {rank:new Map(nodes.map(n=>[n.id,rank[group.get(n.id)]])),cycles:parts.filter(p=>p.length>1)};
}
function setup(nodes,rels,ir,p) {
 const algorithm=p.layout.x_live_placement || p.layout.algorithm;
 const ordered=[...nodes].sort((a,b)=>cmp(a.id,b.id)),placements=ir.view.placements || {};
 for(const n of ordered){n.pinned=!!placements[n.id]?.at;if(n.pinned){n.x=q(placements[n.id].at[0]);n.y=q(placements[n.id].at[1]);}}
 const pins=ordered.filter(n=>n.pinned),pinBounds=bounds(pins),anchor=pinBounds?center(pinBounds):[0,0];
 const adj=adjacency(ordered,rels),root=pins.length?pins.map(n=>n.id):ordered.length?[...ordered].sort((a,b)=>adj.get(b.id).length-adj.get(a.id).length||cmp(a.id,b.id))[0].id:null;
 const roots=Array.isArray(root)?root:root?[root]:[];
 const gap=q(p.layout.gap,80),step=q(p.layout.grid_step,32);
 if(!Number.isFinite(gap)||gap<16||gap>2000)error('LIVE-P001','Pattern gap must be a length from 16 to 2000 CSS pixels.');
 if(!Number.isFinite(step)||step<8||step>512)error('LIVE-P001','grid_step must be a length from 8 to 512 CSS pixels.');
 const ctx={algorithm,ordered,pins,free:ordered.filter(n=>!n.pinned),pinBounds,anchor,adj,roots,gap,step,
  constraints:constraintsFor(ir),slots:new Map(),level:new Map(),rings:[],attempts:0,diagnostics:[],cycles:[],disconnected:[],mode:p.layout.center||'pins'};
 for(const n of ordered){if(!Number.isFinite(n.w)||!Number.isFinite(n.h)||n.w<=0||n.h<=0)error('LIVE-P001','Layout needs finite, positive measured rectangles.');const b=ctx.constraints.get(n.id);if(b&&(n.w>b.w+EPS||n.h>b.h+EPS||b.w<0||b.h<0))error('LIVE-P004','Measured element does not fit all fixed frames: '+n.id);if(n.pinned&&!fits(n,b))error('LIVE-P004','Pinned element is outside its fixed frame: '+n.id);}
 return ctx;
}
function record(ctx,n,c,key,extra={}) { n.x=c[0]-n.w/2;n.y=c[1]-n.h/2;ctx.slots.set(n.id,{center:c.slice(),key,...extra}); }
function orderFree(ctx) {
 const bfs=distances(ctx.ordered,ctx.adj,ctx.roots);
 return [...ctx.free].sort((a,b)=>bfs.rank.get(a.id)-bfs.rank.get(b.id)||ctx.adj.get(b.id).length-ctx.adj.get(a.id).length||cmp(a.id,b.id));
}
function candidateOK(ctx,n,c,placed,pad=ctx.gap/2) {
 // Bounded search, like the orthogonal router: infeasible constrained inputs
 // must fail with a diagnostic, not hang in quadratic candidate scans.
 if(++ctx.attempts>5000000)error('LIVE-P002','Placement search budget exhausted; split the view or relax fixed frames.');
 const box={...n,x:c[0]-n.w/2,y:c[1]-n.h/2};
 return fits(box,ctx.constraints.get(n.id))&&!placed.some(o=>o!==n&&overlaps(box,o,pad));
}
function fitGrid(ctx) {
 const pitchX=Math.ceil((maxOf(ctx.ordered,n=>n.w,1)+ctx.gap)/ctx.step)*ctx.step;
 const pitchY=Math.ceil((maxOf(ctx.ordered,n=>n.h,1)+ctx.gap)/ctx.step)*ctx.step;
 ctx.pitch=[pitchX,pitchY];const placed=[...ctx.pins];let sx=0,sy=0,count=0;
 for(const n of orderFree(ctx)) {
  let chosen=null,best=Infinity;
  // Expanding integer rings. Every centre lies on the lattice whose origin is
  // the pin group's centre; a pin itself need not be on that lattice.
  for(let ring=0;ring<80&&!chosen;ring++) {
   for(let ix=-ring;ix<=ring;ix++)for(let iy=-ring;iy<=ring;iy++)if(Math.max(Math.abs(ix),Math.abs(iy))===ring){
    const c=[ctx.anchor[0]+ix*pitchX,ctx.anchor[1]+iy*pitchY];
    if(!candidateOK(ctx,n,c,placed))continue;
    const neighbors=(ctx.adj.get(n.id)||[]).map(id=>placed.find(x=>x.id===id)).filter(Boolean);
    const edgeCost=neighbors.length?neighbors.reduce((v,o)=>v+dist(c,center(o)),0)/neighbors.length:0;
    const balance=Math.hypot(sx+c[0]-ctx.anchor[0],sy+c[1]-ctx.anchor[1])/(count+1);
    const cost=dist(c,ctx.anchor)+balance*.7+edgeCost*.12;
    if(cost<best-EPS){chosen={c,ix,iy};best=cost;}
   }
  }
  if(!chosen)error('LIVE-P003','No available grid slot within the bounded placement search: '+n.id);
  record(ctx,n,chosen.c,'grid',{column:chosen.ix,row:chosen.iy});placed.push(n);sx+=chosen.c[0]-ctx.anchor[0];sy+=chosen.c[1]-ctx.anchor[1];count++;
 }
}
function outerRadius(ctx) {return maxOf(ctx.pins,n=>Math.hypot(Math.abs(center(n)[0]-ctx.anchor[0])+n.w/2,Math.abs(center(n)[1]-ctx.anchor[1])+n.h/2),0);}
function ringRadius(nodes,gap) {const diam=maxOf(nodes,n=>Math.hypot(n.w,n.h),1);return nodes.length>1?(diam+gap)/(2*Math.sin(Math.PI/nodes.length)):(diam+gap)/2;}
function ring(ctx,list,minimum,level,placed) {
 if(!list.length)return minimum;
 let radius=Math.max(minimum,ringRadius(list,ctx.gap));
 for(let attempt=0;attempt<60;attempt++,radius=radius*1.08+ctx.step){
  const temp=[],positions=[];let valid=true;
  for(let i=0;i<list.length;i++){
   const n=list[i],theta=-Math.PI/2+2*Math.PI*i/list.length,c=[ctx.anchor[0]+radius*Math.cos(theta),ctx.anchor[1]+radius*Math.sin(theta)];
   if(!candidateOK(ctx,n,c,[...placed,...temp])){valid=false;break;}
   temp.push({...n,x:c[0]-n.w/2,y:c[1]-n.h/2});positions.push({n,c,theta});
  }
  if(valid){for(const {n,c,theta} of positions){record(ctx,n,c,'ring:'+level,{level,radius,angle:theta});ctx.level.set(n.id,level);placed.push(n);}ctx.rings.push({level,radius,count:list.length});return radius;}
 }
 error('LIVE-P003','The requested ring cannot fit fixed frames or obstacles. Increase available space, reduce detail, or choose another pattern.');
}
function circular(ctx){const free=orderFree(ctx),half=maxOf(free,n=>Math.hypot(n.w,n.h)/2,1);ring(ctx,free,outerRadius(ctx)+half+ctx.gap,1,[...ctx.pins]);}
function radial(ctx){
 const bfs=distances(ctx.ordered,ctx.adj,ctx.roots);ctx.disconnected=bfs.disconnected;ctx.level=bfs.rank;
 const placed=[...ctx.pins],root=!ctx.pins.length?ctx.ordered.find(n=>n.id===ctx.roots[0]):null;
 let radius=outerRadius(ctx),previousHalf=0;
 if(root){record(ctx,root,ctx.anchor,'root',{level:0});placed.push(root);previousHalf=Math.hypot(root.w,root.h)/2;}
 const layers=new Map();for(const n of ctx.free)if(n!==root){const lev=Math.max(1,bfs.rank.get(n.id));if(!layers.has(lev))layers.set(lev,[]);layers.get(lev).push(n);}
 for(const [lev,list] of [...layers].sort((a,b)=>a[0]-b[0])){
  list.sort((a,b)=>cmp(bfs.parent.get(a.id)||'',bfs.parent.get(b.id)||'')||cmp(a.id,b.id));
  const half=maxOf(list,n=>Math.hypot(n.w,n.h)/2,0);radius=ring(ctx,list,radius+previousHalf+half+ctx.gap,lev,placed);previousHalf=half;
 }
}
function layers(ctx,rels,down,tree=false) {
 const ranking=tree?distances(ctx.ordered,ctx.adj,ctx.roots):directedRanks(ctx.ordered,rels);
 ctx.level=ranking.rank;ctx.cycles=ranking.cycles||[];ctx.disconnected=ranking.disconnected||[];
 const pinnedRanks=ctx.pins.map(n=>ctx.level.get(n.id)).sort((a,b)=>a-b);
 const referenceRank=pinnedRanks.length?pinnedRanks[Math.floor((pinnedRanks.length-1)/2)]:0;
 const pitchPrimary=maxOf(ctx.ordered,n=>down?n.h:n.w,1)+ctx.gap;
 const pitchSecondary=maxOf(ctx.ordered,n=>down?n.w:n.h,1)+ctx.gap;
 ctx.pitch=down?[pitchSecondary,pitchPrimary]:[pitchPrimary,pitchSecondary];ctx.referenceRank=referenceRank;
 const placed=[...ctx.pins],free=[...ctx.free].sort((a,b)=>ctx.level.get(a.id)-ctx.level.get(b.id)||cmp(ranking.parent?.get(a.id)||'',ranking.parent?.get(b.id)||'')||cmp(a.id,b.id));
 const byLevel=new Map();for(const n of free){const lev=ctx.level.get(n.id);if(!byLevel.has(lev))byLevel.set(lev,[]);byLevel.get(lev).push(n);}
 for(const [lev,list]of byLevel){
  for(let i=0;i<list.length;i++){
   const n=list[i],primary=(lev-referenceRank)*pitchPrimary;let found=null;
   const offsets=ctx.pins.length?[0,...Array.from({length:150},(_,j)=>(j%2?-1:1)*(1+Math.floor(j/2)))]:[i-(list.length-1)/2,...Array.from({length:150},(_,j)=>(j%2?-1:1)*(1+Math.floor(j/2)))];
   for(const offset of offsets){const c=down?[ctx.anchor[0]+offset*pitchSecondary,ctx.anchor[1]+primary]:[ctx.anchor[0]+primary,ctx.anchor[1]+offset*pitchSecondary];if(candidateOK(ctx,n,c,placed)){found=c;break;}}
   if(!found)error('LIVE-P003','No legal slot in the requested graph layer: '+n.id);
   record(ctx,n,found,'layer:'+lev,{level:lev});placed.push(n);
  }
 }
 // Without pins there is no fixed anchor. Centre the complete drawing at (0,0)
 // rather than interpreting the first source node's location as a hidden pin.
 if(!ctx.pins.length){const b=bounds(ctx.ordered),c=center(b);for(const n of ctx.free){n.x-=c[0];n.y-=c[1];const s=ctx.slots.get(n.id);s.center=center(n);} }
}
function organic(ctx,rels) {
 // The all-pairs force solver is O(n²) per iteration; bound the input size.
 if(ctx.ordered.length>4000)error('LIVE-P002','Organic placement is bounded to 4000 elements; split the view or choose another pattern.');
 circular(ctx);const all=ctx.ordered,by=new Map(all.map(n=>[n.id,n]));
 // A deterministic small force solver. Pins participate in the forces but are
 // never integrated. Final projection resolves measured rectangle collisions.
 for(let iteration=0;iteration<100;iteration++){
  const force=new Map(all.map(n=>[n.id,[0,0]]));
  for(let i=0;i<all.length;i++)for(let j=0;j<i;j++){
   const a=all[i],b=all[j],ca=center(a),cb=center(b);let dx=ca[0]-cb[0],dy=ca[1]-cb[1],len=Math.hypot(dx,dy);
   if(len<.01){dx=1;dy=i%2?1:-1;len=Math.SQRT2;}
   const reach=(Math.hypot(a.w,a.h)+Math.hypot(b.w,b.h))/2+ctx.gap;
   const power=Math.min(35,0.035*reach*reach/(len+30));
   force.get(a.id)[0]+=dx/len*power;force.get(a.id)[1]+=dy/len*power;force.get(b.id)[0]-=dx/len*power;force.get(b.id)[1]-=dy/len*power;
  }
  for(const r of rels){const a=by.get(r.from.element),b=by.get(r.to.element);if(!a||!b||a===b)continue;const ca=center(a),cb=center(b),dx=cb[0]-ca[0],dy=cb[1]-ca[1],len=Math.max(1,Math.hypot(dx,dy)),ideal=(Math.hypot(a.w,a.h)+Math.hypot(b.w,b.h))/2+ctx.gap;const power=(len-ideal)*.11;
   force.get(a.id)[0]+=dx/len*power;force.get(a.id)[1]+=dy/len*power;force.get(b.id)[0]-=dx/len*power;force.get(b.id)[1]-=dy/len*power;
  }
  const cooling=1-iteration/125;
  for(const n of ctx.free){const f=force.get(n.id),c=center(n);f[0]+=(ctx.anchor[0]-c[0])*.026;f[1]+=(ctx.anchor[1]-c[1])*.026;const len=Math.hypot(...f),scale=Math.min(1,16*cooling/Math.max(1,len));n.x+=f[0]*scale;n.y+=f[1]*scale;}
 }
 const placed=[...ctx.pins];for(const n of orderFree(ctx)){
  const desired=center(n);let found=candidateOK(ctx,n,desired,placed)?desired:null;
  for(let k=1;k<=1500&&!found;k++){const angle=k*2.399963229728653,radius=ctx.step*Math.sqrt(k),c=[desired[0]+Math.cos(angle)*radius,desired[1]+Math.sin(angle)*radius];if(candidateOK(ctx,n,c,placed))found=c;}
  if(!found)error('LIVE-P003','No collision-free organic placement in the search budget: '+n.id);
  record(ctx,n,found,'organic');placed.push(n);
 }
 ctx.rings=[];ctx.iterations=100;
}
function place(nodes,rels,ir,p) {
 const ctx=setup(nodes,rels,ir,p);
 if(!nodes.length)return finish(ctx);
 switch(ctx.algorithm){case 'fit_grid':fitGrid(ctx);break;case 'circular':circular(ctx);break;case 'radial':radial(ctx);break;case 'layered':layers(ctx,rels,p.layout.direction==='down');break;case 'tree':layers(ctx,rels,p.layout.direction==='down',true);break;case 'organic':organic(ctx,rels);break;default:error('LIVE-P001','Unsupported placement pattern: '+ctx.algorithm);}
 return finish(ctx);
}
function finish(ctx) {
 const metadata={engine:'pinned-patterns@0.3-draft.2',pattern:ctx.algorithm,anchor:ctx.anchor,pinBounds:ctx.pinBounds,
  anchorSource:ctx.pins.length?'pinned-bounds':'origin',pinIds:ctx.pins.map(n=>n.id),rootIds:ctx.roots,
  slots:Object.fromEntries(ctx.slots),rings:ctx.rings,levels:Object.fromEntries(ctx.level),pitch:ctx.pitch||null,
  cycleComponents:ctx.cycles,disconnectedRoots:ctx.disconnected,attempts:ctx.attempts,iterations:ctx.iterations||0,
  centerPolicy:ctx.mode,autoPlace:true};
 return {algorithm:ctx.algorithm,constraints:ctx.constraints,pattern:metadata,diagnostics:ctx.diagnostics};
}
function centeredBounds(raw,anchor) {
 const rx=Math.max(Math.abs(raw.x-anchor[0]),Math.abs(raw.x+raw.w-anchor[0]),50),ry=Math.max(Math.abs(raw.y-anchor[1]),Math.abs(raw.y+raw.h-anchor[1]),50);
 return {x:anchor[0]-rx,y:anchor[1]-ry,w:2*rx,h:2*ry};
}
const api={MODES,place,bounds,center,centeredBounds,constraintsFor,fits};
publishNamespace('DDNPinPlacement',api);
export default api;
