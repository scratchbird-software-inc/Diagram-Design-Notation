/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN 0.3 deterministic native layout and obstacle-aware orthogonal routing.
 * Bounded search is deliberate: infeasibility produces a diagnostic, never an invisible topology change.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-shapes'));else root.DDNLayout=factory(root.DDNShapes);})(typeof globalThis!=='undefined'?globalThis:this,function(Shapes){
'use strict';
const VERSION='0.6.0-beta.1',EPS=.01;
const q=(x,d=0)=>typeof x==='number'?x:x&&Number.isFinite(x.$quantity)?x.$quantity*({px:1,pt:96/72,mm:96/25.4,cm:96/2.54,in:96}[x.unit]||1):d;
const round=x=>Math.round(x*1000)/1000;
const same=(a,b)=>Math.abs(a[0]-b[0])<EPS&&Math.abs(a[1]-b[1])<EPS;
const segs=ps=>ps.slice(1).map((b,i)=>({a:ps[i],b,i}));
const length=s=>Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]);
const box=(g,p=0)=>({x:g.x-p,y:g.y-p,w:g.w+2*p,h:g.h+2*p,id:g.id});
function overlap(a,b,p=0){return a.x<b.x+b.w+p-EPS&&a.x+a.w>b.x-p+EPS&&a.y<b.y+b.h+p-EPS&&a.y+a.h>b.y-p+EPS;}
function pointInside(p,b){return p[0]>b.x+EPS&&p[0]<b.x+b.w-EPS&&p[1]>b.y+EPS&&p[1]<b.y+b.h-EPS;}
function segmentBox(s,b){
 if(same(s.a,s.b))return pointInside(s.a,b);
 if(Math.abs(s.a[1]-s.b[1])<EPS)return s.a[1]>b.y+EPS&&s.a[1]<b.y+b.h-EPS&&Math.max(s.a[0],s.b[0])>b.x+EPS&&Math.min(s.a[0],s.b[0])<b.x+b.w-EPS;
 if(Math.abs(s.a[0]-s.b[0])<EPS)return s.a[0]>b.x+EPS&&s.a[0]<b.x+b.w-EPS&&Math.max(s.a[1],s.b[1])>b.y+EPS&&Math.min(s.a[1],s.b[1])<b.y+b.h-EPS;
 // Liang-Barsky clipping for straight routes, with a slightly inset rectangle.
 let lo=0,hi=1,dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];const p=[-dx,dx,-dy,dy],v=[s.a[0]-b.x-EPS,b.x+b.w-s.a[0]-EPS,s.a[1]-b.y-EPS,b.y+b.h-s.a[1]-EPS];
 for(let i=0;i<4;i++){if(Math.abs(p[i])<EPS){if(v[i]<0)return false;}else{const t=v[i]/p[i];if(p[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return hi>=lo;
}
function simplify(points){const out=[];for(const x of points){const p=x.map(round);if(out.length&&same(out.at(-1),p))continue;out.push(p);while(out.length>=3){const[a,b,c]=out.slice(-3);if((Math.abs(a[0]-b[0])<EPS&&Math.abs(b[0]-c[0])<EPS)||(Math.abs(a[1]-b[1])<EPS&&Math.abs(b[1]-c[1])<EPS))out.splice(out.length-2,1);else break;}}return out;}
function cross(s,t,margin=0){
 const sh=Math.abs(s.a[1]-s.b[1])<EPS,sv=Math.abs(s.a[0]-s.b[0])<EPS,th=Math.abs(t.a[1]-t.b[1])<EPS,tv=Math.abs(t.a[0]-t.b[0])<EPS;
 if(sh&&tv){const x=t.a[0],y=s.a[1];if(x>Math.min(s.a[0],s.b[0])+margin&&x<Math.max(s.a[0],s.b[0])-margin&&y>Math.min(t.a[1],t.b[1])+margin&&y<Math.max(t.a[1],t.b[1])-margin)return[x,y];}
 if(sv&&th)return cross(t,s,margin);return null;
}
function collinear(s,t,tolerance=.1){const h=Math.abs(s.a[1]-s.b[1])<EPS&&Math.abs(t.a[1]-t.b[1])<EPS,v=Math.abs(s.a[0]-s.b[0])<EPS&&Math.abs(t.a[0]-t.b[0])<EPS;if(h&&Math.abs(s.a[1]-t.a[1])<tolerance)return Math.min(Math.max(s.a[0],s.b[0]),Math.max(t.a[0],t.b[0]))-Math.max(Math.min(s.a[0],s.b[0]),Math.min(t.a[0],t.b[0]))>EPS;if(v&&Math.abs(s.a[0]-t.a[0])<tolerance)return Math.min(Math.max(s.a[1],s.b[1]),Math.max(t.a[1],t.b[1]))-Math.max(Math.min(s.a[1],s.b[1]),Math.min(t.a[1],t.b[1]))>EPS;return false;}
function distancePointSegment(p,s){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],l=dx*dx+dy*dy;if(!l)return Math.hypot(p[0]-s.a[0],p[1]-s.a[1]);const t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/l));return Math.hypot(p[0]-s.a[0]-t*dx,p[1]-s.a[1]-t*dy);}
function layoutNodes(nodes,rels,profiles,placements={},ErrorClass=Error){
 const p=profiles.layout,minGap=2*(q(p.object_clearance,16)+Math.max(24,q(p.port_clearance,28)))+2*q(p.edge_clearance,12),gap=Math.max(q(p.gap,100),minGap),rowGap=Math.max(q(p.row_gap,100),minGap),diag=[];if(gap<20||rowGap<20)throw new ErrorClass('DDN200','Automatic gaps must be at least 20px');
 const order=new Map(nodes.map((n,i)=>[n.id,i])),byId=new Map(nodes.map(n=>[n.id,n])),ids=new Set(byId.keys());
 const edges=rels.filter(r=>ids.has(r.from.element)&&ids.has(r.to.element)&&r.from.element!==r.to.element);
 function grid(ns,ox=0,oy=0){const cols=Math.max(1,p.columns||3),widths=Array(cols).fill(0),rows=[];ns.forEach((n,i)=>{widths[i%cols]=Math.max(widths[i%cols],n.w);rows[Math.floor(i/cols)]=Math.max(rows[Math.floor(i/cols)]||0,n.h);});ns.forEach((n,i)=>{n.x=ox+widths.slice(0,i%cols).reduce((a,b)=>a+b+gap,0);n.y=oy+rows.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b+rowGap,0);});}
 const horizontal=['right','left'].includes(p.direction);
 if(['grid','manual'].includes(p.algorithm))grid(nodes);
 else if(p.algorithm==='layered'){
  // Tarjan SCCs preserve cycles as explicit same-layer groups; no edge reversal mutates the model.
  const adj=new Map(nodes.map(n=>[n.id,[]]));edges.forEach(e=>adj.get(e.from.element).push(e.to.element));for(const a of adj.values())a.sort((a,b)=>order.get(a)-order.get(b));
  let counter=0;const ix=new Map(),low=new Map(),stack=[],on=new Set(),components=[];
  function visit(id){ix.set(id,counter);low.set(id,counter++);stack.push(id);on.add(id);for(const j of adj.get(id)){if(!ix.has(j)){visit(j);low.set(id,Math.min(low.get(id),low.get(j)));}else if(on.has(j))low.set(id,Math.min(low.get(id),ix.get(j)));}if(low.get(id)===ix.get(id)){let c=[],x;do{x=stack.pop();on.delete(x);c.push(x);}while(x!==id);c.sort((a,b)=>order.get(a)-order.get(b));components.push(c);}}
  nodes.forEach(n=>{if(!ix.has(n.id))visit(n.id);});const comp=new Map();components.forEach((c,i)=>c.forEach(id=>comp.set(id,i)));const rank=components.map(()=>0);for(let i=0;i<components.length;i++)for(const e of edges){const a=comp.get(e.from.element),b=comp.get(e.to.element);if(a!==b)rank[b]=Math.max(rank[b],rank[a]+1);}
  const layers=[];nodes.forEach(n=>(layers[rank[comp.get(n.id)]]??=[]).push(n));
  const pred=new Map(nodes.map(n=>[n.id,[]]));edges.forEach(e=>pred.get(e.to.element).push(e.from.element));
  for(let sweep=0;sweep<3;sweep++)for(let i=1;i<layers.length;i++){const pos=new Map(layers[i-1].map((n,j)=>[n.id,j]));const bary=n=>{const ps=pred.get(n.id).filter(id=>pos.has(id));return ps.length?ps.reduce((s,id)=>s+pos.get(id),0)/ps.length:order.get(n.id);};layers[i].sort((a,b)=>bary(a)-bary(b)||order.get(a.id)-order.get(b.id));}
  let major=0;for(const layer of layers){let minor=0,extent=0;for(const n of layer){if(horizontal){n.x=major;n.y=minor;minor+=n.h+rowGap;extent=Math.max(extent,n.w);}else{n.x=minor;n.y=major;minor+=n.w+gap;extent=Math.max(extent,n.h);}}major+=extent+(horizontal?gap:rowGap);}
  if(components.some(c=>c.length>1))diag.push({code:'DDN-LW01',severity:'info',message:'Directed cycles retained as same-rank strongly connected groups; no model edge reversed.'});
 }else if(['tree','mindmap'].includes(p.algorithm)){
  const vertical=p.algorithm==='tree'&&['down','up'].includes(p.direction);
  const hierarchy=Array.isArray(p.hierarchy)?p.hierarchy:null,es=hierarchy?edges.filter(e=>hierarchy.includes(e.kind)):edges;
  const incoming=new Map(nodes.map(n=>[n.id,0])),kids=new Map(nodes.map(n=>[n.id,[]]));for(const e of es){if(kids.get(e.from.element).includes(e.to.element))continue;kids.get(e.from.element).push(e.to.element);incoming.set(e.to.element,incoming.get(e.to.element)+1);}
  for(const [id,n]of incoming)if(n>1)throw new ErrorClass('DDN201','Tree hierarchy has multiple parents: '+id+'; select hierarchy relationship kinds or use layered.');
  const roots=nodes.filter(n=>incoming.get(n.id)===0).map(n=>n.id),root=p.root?.$ref||p.root;
  if(root&&!ids.has(root))throw new ErrorClass('DDN202','Layout root is outside selected view');if(!roots.length&&nodes.length)throw new ErrorClass('DDN201','Tree hierarchy contains a cycle');
  const seen=new Set(),active=new Set();function height(id){if(active.has(id))throw new ErrorClass('DDN201','Tree hierarchy contains a cycle');active.add(id);seen.add(id);const n=byId.get(id),ch=kids.get(id),h=Math.max(n.h,ch.reduce((sum,c)=>sum+height(c)+rowGap,0)-(ch.length?rowGap:0));active.delete(id);n.subtreeHeight=h;return h;}roots.forEach(height);if(seen.size!==nodes.length)throw new ErrorClass('DDN201','Unreachable hierarchy cycle');
  const levelWidth=Math.max(270,...nodes.map(n=>n.w))+gap;function tree(id,depth,top,sign=1){const n=byId.get(id);n.x=depth*levelWidth*sign;n.y=top+(n.subtreeHeight-n.h)/2;let y=top;for(const c of kids.get(id)){tree(c,depth+1,y,sign);y+=byId.get(c).subtreeHeight+rowGap;}}
  const levelDepth=Math.max(...nodes.map(n=>n.h))+rowGap;function width(id){const n=byId.get(id),ch=kids.get(id),w=Math.max(n.w,ch.reduce((sum,c)=>sum+width(c)+gap,0)-(ch.length?gap:0));n.subtreeWidth=w;return w;}
  function vtree(id,depth,left){const n=byId.get(id);n.y=depth*levelDepth;n.x=left+(n.subtreeWidth-n.w)/2;let x=left;for(const c of kids.get(id)){vtree(c,depth+1,x);x+=byId.get(c).subtreeWidth+gap;}}
  if(p.algorithm==='mindmap'&&roots.length===1){const id=root||roots[0];if(incoming.get(id)!==0)throw new ErrorClass('DDN202','Mind-map root must be a hierarchy root');const n=byId.get(id),ch=kids.get(id),left=ch.filter((_,i)=>i%2),right=ch.filter((_,i)=>!(i%2));const span=a=>a.reduce((s,id)=>s+byId.get(id).subtreeHeight+rowGap,0)-(a.length?rowGap:0),full=Math.max(n.h,span(left),span(right));n.x=0;n.y=(full-n.h)/2;for(const [a,sign]of [[left,-1],[right,1]]){let y=(full-span(a))/2;for(const c of a){tree(c,1,y,sign);y+=byId.get(c).subtreeHeight+rowGap;}}}
  else if(vertical){roots.forEach(width);let x=0;for(const id of roots){vtree(id,0,x);x+=byId.get(id).subtreeWidth+gap;}}
  else {let y=0;for(const id of roots){tree(id,0,y);y+=byId.get(id).subtreeHeight+rowGap;}}
  if(vertical&&p.direction==='up'){const max=Math.max(...nodes.map(n=>n.y+n.h));nodes.forEach(n=>n.y=max-n.y-n.h);}
  const minX=Math.min(0,...nodes.map(n=>n.x));nodes.forEach(n=>n.x-=minX);
 }else if(p.algorithm==='grouped'){
  const path=String(p.group_by||'kind').split('.'),read=n=>path.reduce((v,k)=>v?.[k],n.properties)??path.reduce((v,k)=>v?.[k],n.n?.properties)??n.n?.kind??'unassigned';
  const groups=new Map();for(const n of nodes){let key=String(read(n));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}let x=0;for(const [label,ns]of groups){grid(ns,x,50);x=Math.max(...ns.map(n=>n.x+n.w))+gap*2;ns.forEach(n=>n.group=label);}
 }else throw new ErrorClass('DDN203','No native placement algorithm '+p.algorithm);
 if(p.algorithm==='layered'&&['left','up'].includes(p.direction)){if(horizontal){const max=Math.max(...nodes.map(n=>n.x+n.w));nodes.forEach(n=>n.x=max-n.x-n.w);}else{const max=Math.max(...nodes.map(n=>n.y+n.h));nodes.forEach(n=>n.y=max-n.y-n.h);}}
 const pinned=[];for(const n of nodes){const at=placements[n.id]?.at;if(at){n.x=q(at[0]);n.y=q(at[1]);pinned.push(n);}}
 for(let i=0;i<pinned.length;i++)for(let j=i+1;j<pinned.length;j++)if(overlap(pinned[i],pinned[j]))throw new ErrorClass('DDN204','Conflicting hard placements: '+pinned[i].id+' / '+pinned[j].id);
 const settled=[...pinned];for(const n of nodes.filter(n=>!placements[n.id]?.at)){let tries=0;while(settled.some(o=>overlap(n,o,20))){n.y+=n.h+rowGap;if(++tries>nodes.length+2)throw new ErrorClass('DDN204','Unable to honor pinned geometry');}settled.push(n);}
 for(const n of nodes){n.x=round(n.x);n.y=round(n.y);delete n.subtreeHeight;delete n.subtreeWidth;}
 return {nodes,diagnostics:diag};
}
// Endpoint identity and a boundary slot are different. Only slots belonging to
// the same visible field row (or the unbound body) may exchange their order.
// Never make a journal FK look as though it is attached to an account field.
function portAssignments(nodes,rels,profiles,hints={}){
 const byId=new Map(nodes.map(n=>[n.id,n])),groups=new Map(),result=new Map();
 const optimize=profiles.layout.endpoint_ordering!=='preserve'&&profiles.layout.optimize!=='none';
 const directions={east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]};
 const portOf=(n,ep)=>n.n?.ports?.find(f=>f.id===ep.member);
 for(const r of rels){const a=byId.get(r.from.element),b=byId.get(r.to.element),hint=hints[r.id]||{};
  let ss=hint.source_side||portOf(a,r.from)?.properties?.side,ts=hint.target_side||portOf(b,r.to)?.properties?.side;
  if(!ss||!ts){const dx=b.x+b.w/2-a.x-a.w/2,dy=b.y+b.h/2-a.y-a.h/2,vertical=['down','up'].includes(profiles.layout.direction)&&!r.from.member&&!r.to.member;
   if(a===b){ss=ss||'east';ts=ts||'east';}else if(vertical){ss=ss||(dy>=0?'south':'north');ts=ts||(dy>=0?'north':'south');}else{ss=ss||(dx>=0?'east':'west');ts=ts||(dx>=0?'west':'east');}}
  const item={r,source_side:ss,target_side:ts};result.set(r.id,item);
  for(const [which,n,ep,side,remote,remoteEp]of [['source',a,r.from,ss,b,r.to],['target',b,r.to,ts,a,r.from]]){
   const row=n.fieldRows?.find(f=>f.id===ep.member),visualMember=row?ep.member:'';
   const key=JSON.stringify([n.id,visualMember,side]);
   const remoteRow=remote.fieldRows?.find(f=>f.id===remoteEp.member),vertical=side==='east'||side==='west';
   const remoteCoord=vertical?remote.y+(remoteRow?remoteRow.top+remoteRow.h/2:remote.h/2):remote.x+remote.w/2;
   const frac=hint[which+'_fraction']??hint['x_'+which+'_fraction'];
   if(frac!==undefined&&(!Number.isFinite(frac)||frac<=0||frac>=1||ep.member))throw Object.assign(new Error('Anchor fraction must be 0..1 and cannot replace a field endpoint'),{code:'DDN-I030'});
   if(!directions[side])throw Object.assign(new Error('Invalid endpoint side '+side),{code:'DDN-I030'});
   const fixed=frac!==undefined||!!portOf(n,ep)||hint.via!==undefined;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({item,which,n,ep,side,hint,row,frac,fixed,remoteCoord});
  }
 }
 for(const entries of groups.values()){
  entries.sort((a,b)=>a.item.r.id.localeCompare(b.item.r.id)||a.which.localeCompare(b.which));
  let ordered=entries.slice();
  if(optimize){
   const free=entries.filter(e=>!e.fixed).sort((a,b)=>{
    // Internal ranks are produced only by the checked local-order pass. They
    // are never parsed from DDN or used as a change to an endpoint identity.
    const ar=a.hint['_'+a.which+'_order'],br=b.hint['_'+b.which+'_order'];
    if(ar!==undefined||br!==undefined)return(ar??a.remoteCoord)-(br??b.remoteCoord)||a.item.r.id.localeCompare(b.item.r.id);
    return a.remoteCoord-b.remoteCoord||a.item.r.id.localeCompare(b.item.r.id)||a.which.localeCompare(b.which);
   });let i=0;ordered=entries.map(e=>e.fixed?e:free[i++]);
  }
  ordered.forEach((o,index)=>{const{item,which,n,ep,side,row,frac}=o;let x=n.x+n.w/2,y=n.y+n.h/2;
   if(side==='east'||side==='west'){x=side==='east'?n.x+n.w:n.x;y=n.y+(row?row.top+(index+1)*row.h/(entries.length+1):frac!==undefined?frac*n.h:(index+1)*n.h/(entries.length+1));}
   else{y=side==='south'?n.y+n.h:n.y;x=n.x+(frac!==undefined?frac*n.w:(index+1)*n.w/(entries.length+1));}
   item[which]=Shapes.anchor(n,side,[round(x),round(y)]);item[which+'_direction']=directions[side];
  });
 }
 return result;
}
class Heap{constructor(){this.a=[];}push(value){const a=this.a;let i=a.length;a.push(value);while(i){let p=(i-1)>>1;if(a[p].score<=value.score)break;a[i]=a[p];i=p;}a[i]=value;}pop(){const a=this.a;if(!a.length)return;const first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].score<a[j].score)j++;if(a[j].score>=last.score)break;a[i]=a[j];i=j;}a[i]=last;}return first;}get length(){return this.a.length;}}
function routingAttempt(nodes,rels,profiles,hints={},labelMeasure,ErrorClass=Error,extraObstacles=[]){
 const p=profiles.layout,clear=q(p.object_clearance,16),lane=q(p.edge_clearance,12),port=Math.max(24,q(p.port_clearance,28)),byId=new Map(nodes.map(n=>[n.id,n]));
 const assignments=portAssignments(nodes,rels,profiles,hints),routes=[],labels=[],diagnostics=[];
 const bounds={minX:Math.min(0,...nodes.map(n=>n.x)),minY:Math.min(0,...nodes.map(n=>n.y)),maxX:Math.max(100,...nodes.map(n=>n.x+n.w)),maxY:Math.max(100,...nodes.map(n=>n.y+n.h))};
 const inflated=nodes.map(n=>box(n,clear));
 const reservations=[];for(const r of rels){const ep=assignments.get(r.id);for(const which of ['source','target']){const pt=ep[which],dir=ep[which+'_direction'],out=[round(pt[0]+dir[0]*(clear+port)),round(pt[1]+dir[1]*(clear+port))];reservations.push({id:r.id+':reserved:'+which,owner:r.id,points:[pt,out]});}}
 for(const r of rels)if((hints[r.id]?.routing||p.routing)==='straight'){const ep=assignments.get(r.id);reservations.push({id:r.id+':reserved:direct',owner:r.id,points:[ep.source,ep.target]});}
 function costSegment(s,obstacles,prior,permitCross=true){
  if(same(s.a,s.b))return 0;
  if(obstacles.some(b=>segmentBox(s,b)))return Infinity;
  let cost=length(s);
  for(const route of prior)for(const t of segs(route.points)){
   if(collinear(s,t,lane-.1))return Infinity;
   const c=cross(s,t,-EPS);
   if(c){ // Reject T contacts and near-corner ambiguity; ordinary clear X crossings are allowed.
    const endpointDistance=Math.min(...[t.a,t.b].map(x=>Math.hypot(x[0]-c[0],x[1]-c[1])));
    if(endpointDistance<10||!permitCross)return Infinity;cost+=50;
   }
  }
  return cost;
 }
 function pointFree(point,obstacles){return !obstacles.some(b=>pointInside(point,b));}
 function search(a,b,obstacles,prior,edgeIndex){
  const envelope=60+(edgeIndex+1)*lane*2;
  let xs=[a[0],b[0],bounds.minX-envelope,bounds.maxX+envelope],ys=[a[1],b[1],bounds.minY-envelope,bounds.maxY+envelope];
  for(const ob of obstacles){xs.push(ob.x,ob.x+ob.w);ys.push(ob.y,ob.y+ob.h);}
  for(const route of prior)for(const seg of segs(route.points)){if(Math.abs(seg.a[0]-seg.b[0])<EPS)xs.push(seg.a[0]-lane,seg.a[0]+lane);else ys.push(seg.a[1]-lane,seg.a[1]+lane);}
  const uniq=a=>[...new Set(a.map(round))].sort((a,b)=>a-b);xs=uniq(xs);ys=uniq(ys);
  // Try a deterministic catalogue of small-bend paths before graph search.
  const candidates=[[a,b]];
  for(const x of xs)candidates.push([a,[x,a[1]],[x,b[1]],b]);
  for(const y of ys)candidates.push([a,[a[0],y],[b[0],y],b]);
  let best=null,bestCost=Infinity;
  for(let c of candidates){c=simplify(c);if(segs(c).some(s=>Math.abs(s.a[0]-s.b[0])>EPS&&Math.abs(s.a[1]-s.b[1])>EPS))continue;let cost=0;for(const s of segs(c)){cost+=costSegment(s,obstacles,prior);if(cost>bestCost)break;}cost+=Math.max(0,c.length-2)*20;if(cost<bestCost){best=c;bestCost=cost;}}
  // A small-bend candidate is an incumbent, not an unconditional winner.
  // Search when its cost exceeds the Manhattan bound plus two bends; a short
  // multi-bend route can be far better than an outside-of-drawing excursion.
  const lower=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
  if(best&&bestCost<=lower+40+EPS)return best;
  const nx=xs.length,ny=ys.length,limit=Math.max(10000,p.max_search||250000);if(nx*ny>400000)throw new ErrorClass('DDN211','Routing grid exceeds bounded capacity; split the view');
  const sx=xs.indexOf(round(a[0])),sy=ys.indexOf(round(a[1])),ex=xs.indexOf(round(b[0])),ey=ys.indexOf(round(b[1]));
  const total=nx*ny*2,dist=new Float64Array(total);dist.fill(Infinity);const prev=new Int32Array(total);prev.fill(-1);const start=(sy*nx+sx)*2;
  const heap=new Heap();dist[start]=0;dist[start+1]=0;heap.push({id:start,g:0,score:0});heap.push({id:start+1,g:0,score:0});let count=0,last=-1;
  const edgeCache=new Map();
  while(heap.length){const v=heap.pop();if(v.g!==dist[v.id])continue;if(v.score>=bestCost-EPS)break;if(++count>limit)break;const oldDir=v.id%2,node=(v.id-oldDir)/2,xi=node%nx,yi=(node-xi)/nx;if(xi===ex&&yi===ey){last=v.id;break;}
   for(const [dx,dy,dir]of [[-1,0,0],[1,0,0],[0,-1,1],[0,1,1]]){const xx=xi+dx,yy=yi+dy;if(xx<0||xx>=nx||yy<0||yy>=ny)continue;const ni=yy*nx+xx,tag=Math.min(node,ni)+':'+Math.max(node,ni);let cost=edgeCache.get(tag);if(cost===undefined){cost=costSegment({a:[xs[xi],ys[yi]],b:[xs[xx],ys[yy]]},obstacles,prior);edgeCache.set(tag,cost);}if(!Number.isFinite(cost))continue;const id=ni*2+dir,next=v.g+cost+(dir===oldDir?0:20);if(next<dist[id]){dist[id]=next;prev[id]=v.id;heap.push({id,g:next,score:next+Math.abs(xs[xx]-b[0])+Math.abs(ys[yy]-b[1])});}}
  }
  if(last<0)return best;const points=[];while(last>=0){const nd=Math.floor(last/2);points.push([xs[nd%nx],ys[Math.floor(nd/nx)]]);last=prev[last];}return simplify(points.reverse());
 }
 function labelFor(route,prior){
  const size=labelMeasure?labelMeasure(route.r):{w:30,h:30};const a=route.hint.callout?.map(v=>q(v));
  const candidates=a?[{point:a,explicit:true}]:[];
  for(const s of segs(route.points).sort((a,b)=>length(b)-length(a))){const horizontal=Math.abs(s.a[1]-s.b[1])<EPS,need=horizontal?size.w:size.h,len=length(s);if(len<need+24)continue;
   const samples=[.5,.25,.75,.125,.875,...Array.from({length:Math.min(30,Math.floor(len/24))},(_,i)=>(i+1)/(Math.min(30,Math.floor(len/24))+1))];
   for(const t of samples){if(t*len<need/2+12||(1-t)*len<need/2+12)continue;candidates.push({point:[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t]});}}
  for(const candidate of candidates){const[x,y]=candidate.point,rect={x:x-size.w/2,y:y-size.h/2,w:size.w,h:size.h};
   if(!segs(route.points).some(s=>distancePointSegment([x,y],s)<1))continue;
   if(nodes.some(n=>overlap(rect,n,8))||extraObstacles.some(n=>overlap(rect,n,8))||labels.some(l=>overlap(rect,l,8)))continue;
   if(prior.some(r=>segs(r.points).some(s=>segmentBox(s,box(rect,10)))))continue;
   return {id:route.id,x,y,w:size.w,h:size.h,bounds:rect,explicit:!!candidate.explicit};
  }return null;
 }
 for(let index=0;index<rels.length;index++){
  const r=rels[index],hint=hints[r.id]||{},ep=assignments.get(r.id),start=ep.source,end=ep.target,ownA=byId.get(r.from.element),ownB=byId.get(r.to.element),obstacles=[...inflated,...extraObstacles.map(n=>box(n,clear)),...labels.map(l=>box(l,8))];
  const normal=(point,dir,d)=>[round(point[0]+dir[0]*d),round(point[1]+dir[1]*d)];
  // Contour attachments (actors, initial/final markers, diamonds) may lie
  // inside their conservative rectangle. Escape all the way beyond that
  // envelope; a fixed-length stub can otherwise stop inside its own obstacle.
  const escape=(pt,dir,own)=>{let distance=clear+port;if(dir[0]>0)distance=Math.max(distance,own.x+own.w-pt[0]+clear+port);if(dir[0]<0)distance=Math.max(distance,pt[0]-own.x+clear+port);if(dir[1]>0)distance=Math.max(distance,own.y+own.h-pt[1]+clear+port);if(dir[1]<0)distance=Math.max(distance,pt[1]-own.y+clear+port);return normal(pt,dir,distance);};
  const a=escape(start,ep.source_direction,ownA),b=escape(end,ep.target_direction,ownB);
  const stubs=[{a:start,b:a},{a:b,b:end}];
  for(const [j,s]of stubs.entries()){const own=j?ownB:ownA;if(nodes.some(n=>n.id!==own.id&&segmentBox(s,box(n,clear))))throw new ErrorClass('DDN212','Endpoint clearance conflicts with another object: '+r.id);}
  const prior=[...routes,...reservations.filter(rt=>rt.owner!==r.id&&!routes.some(old=>old.id===rt.owner))];
  let points=null,repaired=false;
  if(hint.via){const specified=simplify([start,...hint.via.map(pt=>pt.map(x=>q(x))),end]);const parts=segs(specified),orthogonal=parts.every(s=>Math.abs(s.a[0]-s.b[0])<EPS||Math.abs(s.a[1]-s.b[1])<EPS);
   const safe=parts.every((s,i)=>Number.isFinite(costSegment(s,obstacles.filter(ob=>!((i===0&&ob.id===ownA.id)||(i===parts.length-1&&ob.id===ownB.id))),prior)));
   if(orthogonal&&safe)points=specified;
   else if((hint.policy||p.route_policy)==='strict')throw new ErrorClass(!orthogonal?'DDN073':'DDN213','Unsafe hard waypoint route: '+r.id);
   else repaired=true;
  }
  if(!points&&(hint.routing||p.routing)==='straight'){
   const s={a:start,b:end};if(nodes.some(n=>n.id!==ownA.id&&n.id!==ownB.id&&segmentBox(s,box(n,clear))))throw new ErrorClass('DDN214','Straight connector intersects an unrelated object; choose orthogonal routing');
   if(routes.some(rt=>segs(rt.points).some(t=>collinear(s,t,lane-.1))))throw new ErrorClass('DDN214','Straight connectors share a track; choose distinct ports or orthogonal routing');points=[start,end];
  }
  if(!points){if(!pointFree(a,obstacles)||!pointFree(b,obstacles))throw new ErrorClass('DDN212','No free endpoint escape corridor: '+r.id);
   const center=search(a,b,obstacles,prior,index);if(!center)throw new ErrorClass('DDN215','No unambiguous orthogonal route within bounded search: '+r.id);points=simplify([start,...center,end]);}
  // Check endpoint stubs against other edges too. Actual fields get separate appearance slots.
  if(segs(points).some(s=>routes.some(rt=>segs(rt.points).some(t=>collinear(s,t,lane-.1))))) {
   // Try an alternative side only when the author did not pin sides; never replace member identity.
   throw new ErrorClass('DDN216','Independent connector lanes overlap near an endpoint: '+r.id);
  }
  let route={id:r.id,r,routing:hint.routing||p.routing,hint:{...hint},points,source_side:ep.source_side,target_side:ep.target_side};
  let label=labelFor(route,prior);
  if(!label){
   // Label placement must not discard an authored hard path. The caller may
   // report the conflict but may not 'repair' it by changing the model's hints.
   if(hint.via&&(hint.policy||p.route_policy)==='strict')throw new ErrorClass('DDN217','No safe label on the authored hard route: '+r.id);
   const m=labelMeasure?labelMeasure(r):{w:30,h:30};
   // Search around these two endpoints, not the global graph centre. Nearby
   // obstacle faces supply other local corridors. Length/bends decide between
   // feasible candidates, so an out-and-back loop is never the first fallback.
   const half=m.w/2+16,cx=(a[0]+b[0])/2,pad=Math.max(24,m.h/2+clear+12);
   const ys=[Math.min(a[1],b[1])-pad,Math.max(a[1],b[1])+pad];
   for(const ob of [ownA,ownB])ys.push(ob.y-pad,ob.y+ob.h+pad);
   const yList=[...new Set(ys.map(round))].sort((u,v)=>Math.abs(a[1]-u)+Math.abs(b[1]-u)-Math.abs(a[1]-v)-Math.abs(b[1]-v)||u-v);
   let chosen=null,chosenLabel=null,chosenCost=Infinity;
   for(const y of yList)for(const sign of [b[0]>=a[0]?1:-1]){
    const l=[round(cx-sign*half),y],rr=[round(cx+sign*half),y];
    if(!pointFree(l,obstacles)||!pointFree(rr,obstacles))continue;
    if(!Number.isFinite(costSegment({a:l,b:rr},obstacles,prior)))continue;
    const one=search(a,l,obstacles,prior,index),two=one?search(rr,b,obstacles,[...prior,{id:r.id+':partial',points:one}],index):null;
    if(!one||!two)continue;
    const candidate=simplify([start,...one,rr,...two.slice(1),end]);
    const walk=segs(candidate).reduce((n,s)=>n+length(s),0);
    const extent=walk+Math.max(0,candidate.length-2)*20;
    if(extent>=chosenCost)continue;
    const trial={...route,points:candidate,hint:{...route.hint}};
    const candidateLabel=labelFor(trial,prior);
    if(candidateLabel){chosen=candidate;chosenLabel=candidateLabel;chosenCost=extent;}
   }
   if(chosen){route.points=chosen;label=chosenLabel;route.labelDetour=true;}
   // Last resort stays centred on the relation and is tried nearest first.
   // It is bounded and remains visible to the attachment optimizer.
   for(let attempt=0;attempt<6&&!label;attempt++){
    const y=Math.min(ownA.y,ownB.y)-pad-(attempt+1)*Math.max(50,m.h+lane*2),l=[cx-half,y],rr=[cx+half,y];
    const one=search(a,l,obstacles,prior,index+attempt+1),two=one?search(rr,b,obstacles,[...prior,{id:r.id+':partial',points:one}],index+attempt+2):null;
    if(one&&two&&Number.isFinite(costSegment({a:l,b:rr},obstacles,prior))){const trial={...route,points:simplify([start,...one,rr,...two.slice(1),end])},candidateLabel=labelFor(trial,prior);if(candidateLabel){route.points=trial.points;label=candidateLabel;route.labelDetour=true;}}
   }
  }
  if(!label)throw new ErrorClass('DDN217','No collision-free relationship label position: '+r.id);
  route.hint.callout=[round(label.x),round(label.y)];route.label=label;routes.push(route);labels.push({...label.bounds,id:r.id});
  if(repaired)diagnostics.push({code:'DDN-LW02',severity:'info',message:'Recomputed unsafe route hint '+r.id});
 }
 const crossings=[];for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)for(const s of segs(routes[i].points))for(const t of segs(routes[j].points)){const point=cross(s,t,8);if(point)crossings.push({point,under:routes[i].id,over:routes[j].id,overHorizontal:Math.abs(t.a[1]-t.b[1])<EPS});}
 const quality=inspect(nodes,routes,labels);
 if(quality.errors.length&&p.quality!=='warn')throw new ErrorClass('DDN218',quality.errors[0]);
 for(const message of quality.errors)diagnostics.push({code:'DDN-LW03',severity:'warning',message});
 return {routes,crossings,labels,diagnostics,quality};
}
function routing(nodes,rels,profiles,hints={},labelMeasure,ErrorClass=Error,extraObstacles=[]){
 const degree=new Map();for(const r of rels)for(const e of [r.from,r.to])degree.set(e.element,(degree.get(e.element)||0)+1);
 const distance=r=>{const a=nodes.find(n=>n.id===r.from.element),b=nodes.find(n=>n.id===r.to.element);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);};
 const orders=[rels,[...rels].sort((a,b)=>(degree.get(b.from.element)+degree.get(b.to.element))-(degree.get(a.from.element)+degree.get(a.to.element))||distance(b)-distance(a)||a.id.localeCompare(b.id)),[...rels].reverse(),[...rels].sort((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id))];
 let last;const failures=[];for(let attempt=0;attempt<orders.length;attempt++)try{const r=routingAttempt(nodes,orders[attempt],profiles,hints,labelMeasure,ErrorClass,extraObstacles);r.strategy=attempt;if(attempt)r.diagnostics.push({code:'DDN-LW04',severity:'info',message:'Deterministic congestion retry selected routing strategy '+attempt});return curvedRouting(r,nodes,profiles,hints,ErrorClass,extraObstacles);}catch(e){if(!['DDN212','DDN215','DDN216','DDN217','DDN218','DDN220','DDN221'].includes(e.code))throw e;last=e;failures.push({strategy:attempt,code:e.code,message:e.message});}last.attempts=failures;throw last;
}
function inspect(nodes,routes,labels=[]){const errors=[],overlaps=[],through=[],shared=[],masking=[];
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(overlap(nodes[i],nodes[j]))overlaps.push([nodes[i].id,nodes[j].id]);
 for(const r of routes)for(const s of segs(r.points))for(const n of nodes)if(n.id!==r.r?.from.element&&n.id!==r.r?.to.element&&segmentBox(s,box(n,1)))through.push([r.id,n.id]);
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)if(segs(routes[i].points).some(s=>segs(routes[j].points).some(t=>collinear(s,t,.1))))shared.push([routes[i].id,routes[j].id]);
 for(const l of labels)for(const r of routes)if(l.id!==r.id&&segs(r.points).some(s=>segmentBox(s,box(l,2))))masking.push([l.id,r.id]);
 if(overlaps.length)errors.push(overlaps.length+' overlapping object pairs');if(through.length)errors.push(through.length+' unrelated route/object intersections');if(shared.length)errors.push(shared.length+' independent collinear relation pairs');if(masking.length)errors.push(masking.length+' labels mask unrelated routes');
 return {errors,objectOverlaps:overlaps,routeObjectIntersections:through,sharedTracks:shared,labelRouteIntersections:masking};}
/* Curved connectors are geometry, never relationship types. The orthogonal
 * router first reserves safe corridors. This pass tries a broad cubic branch,
 * then progressively tighter cubic corner transitions. It rejects a drawing
 * that cannot be checked; it never changes a relation endpoint or its meaning.
 */
const CURVE_TOLERANCE=.18;
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function curveSplit(s,t){
 if(s.kind==='line'){const p=mix(s.from,s.to,t);return [{kind:'line',from:s.from,to:p},{kind:'line',from:p,to:s.to}];}
 const a=mix(s.from,s.c1,t),b=mix(s.c1,s.c2,t),c=mix(s.c2,s.to,t),d=mix(a,b,t),e=mix(b,c,t),p=mix(d,e,t);
 return [{kind:'cubic',from:s.from,c1:a,c2:d,to:p},{kind:'cubic',from:p,c1:e,c2:c,to:s.to}];
}
function curveSlice(s,lo,hi){if(lo<=0&&hi>=1)return s;const left=hi<1?curveSplit(s,hi)[0]:s;return lo>0?curveSplit(left,lo/hi)[1]:left;}
function pathData(commands){if(!commands.length)return '';let d='M'+commands[0].from.map(round).join(' ');for(const c of commands)d+=(c.kind==='line'?' L'+c.to.map(round).join(' '):' C'+[...c.c1,...c.c2,...c.to].map(round).join(' '));return d;}
function flattenCurve(commands,tolerance=CURVE_TOLERANCE){
 const points=[],samples=[];let distance=0,last=null;
 const add=(p,segment,t)=>{if(last)distance+=Math.hypot(p[0]-last[0],p[1]-last[1]);points.push(p);samples.push({segment,t,distance,point:p});last=p;};
 function flat(s,segment,lo,hi,depth){if(s.kind==='line'){add(s.to,segment,hi);return;}const chord={a:s.from,b:s.to},error=Math.max(distancePointSegment(s.c1,chord),distancePointSegment(s.c2,chord));if(error<=tolerance){add(s.to,segment,hi);return;}if(depth>=18)throw Object.assign(new Error('Curve subdivision capacity exceeded'),{code:'DDN223'});const[l,r]=curveSplit(s,.5),mid=(lo+hi)/2;flat(l,segment,lo,mid,depth+1);flat(r,segment,mid,hi,depth+1);}
 commands.forEach((s,i)=>{if(!points.length)add(s.from,i,0);else samples.push({segment:i,t:0,distance,point:s.from});flat(s,i,0,1,0);});
 return {points,samples,length:distance,tolerance};
}
function commandsFromPolyline(points){return segs(points).map(s=>({kind:'line',from:s.a,to:s.b}));}
function roundedCommands(points,radius){
 const out=[];let current=points[0];const lineTo=p=>{if(!same(current,p))out.push({kind:'line',from:current,to:p});current=p;};
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],l1=Math.hypot(...u),l2=Math.hypot(...v);
  if(l1<.01||l2<.01||Math.abs(u[0]*v[1]-u[1]*v[0])<.01){lineTo(b);continue;}
  const r=Math.min(radius,l1*.43,l2*.43),p=[b[0]-u[0]/l1*r,b[1]-u[1]/l1*r],q=[b[0]+v[0]/l2*r,b[1]+v[1]/l2*r],k=.552284749831;
  lineTo(p);out.push({kind:'cubic',from:p,c1:[p[0]+u[0]/l1*r*k,p[1]+u[1]/l1*r*k],c2:[q[0]-v[0]/l2*r*k,q[1]-v[1]/l2*r*k],to:q});current=q;
 }
 lineTo(points.at(-1));return out;
}
function lineIntersection(s,t){
 const ux=s.b[0]-s.a[0],uy=s.b[1]-s.a[1],vx=t.b[0]-t.a[0],vy=t.b[1]-t.a[1],den=ux*vy-uy*vx;
 if(Math.abs(den)<1e-10)return null;const dx=t.a[0]-s.a[0],dy=t.a[1]-s.a[1],a=(dx*vy-dy*vx)/den,b=(dx*uy-dy*ux)/den;
 if(a< -1e-9||a>1+1e-9||b< -1e-9||b>1+1e-9)return null;
 return {point:[s.a[0]+ux*a,s.a[1]+uy*a],a,b,sine:Math.abs(den)/Math.max(1e-9,Math.hypot(ux,uy)*Math.hypot(vx,vy))};
}
function generalCollinear(s,t,tolerance=.12){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],len=Math.hypot(dx,dy);if(len<.001)return false;const cross=p=>Math.abs((p[0]-s.a[0])*dy-(p[1]-s.a[1])*dx)/len;if(cross(t.a)>tolerance||cross(t.b)>tolerance)return false;const pos=p=>((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/len;return Math.min(len,Math.max(pos(t.a),pos(t.b)))-Math.max(0,Math.min(pos(t.a),pos(t.b)))>.8;}
function routeCrossings(routes){const out=[];for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++){
 const a=routes[i],b=routes[j],as=segs(a.points),bs=segs(b.points);let ad=0,bd;const seen=[];
 for(const s of as){bd=0;for(const t of bs){const hit=lineIntersection(s,t);if(hit){const la=ad+length(s)*hit.a,lb=bd+length(t)*hit.b,ta=a.arc?.length??as.reduce((z,x)=>z+length(x),0),tb=b.arc?.length??bs.reduce((z,x)=>z+length(x),0);
 if(la>10&&ta-la>10&&lb>10&&tb-lb>10&&!seen.some(p=>Math.hypot(p[0]-hit.point[0],p[1]-hit.point[1])<1)){
 seen.push(hit.point);out.push({point:hit.point.map(round),under:a.id,over:b.id,overHorizontal:Math.abs(t.a[1]-t.b[1])<EPS,overAngle:Math.atan2(t.b[1]-t.a[1],t.b[0]-t.a[0])*180/Math.PI,underDistance:la,overDistance:lb,sine:hit.sine});}}
 bd+=length(t);}ad+=length(s);}
 }return out;}
function curvePointAt(route,distance){const a=route.arc||flattenCurve(route.commands||commandsFromPolyline(route.points));distance=Math.max(0,Math.min(a.length,distance));const samples=a.samples;for(let i=1;i<samples.length;i++){const b=samples[i],prev=samples[i-1];if(b.distance>=distance&&b.distance>prev.distance){const t=(distance-prev.distance)/(b.distance-prev.distance);return {point:mix(prev.point,b.point,t),segment:b.segment,t:prev.segment===b.segment?prev.t+(b.t-prev.t)*t:b.t*t};}}const s=samples.at(-1);return{point:s.point,segment:s.segment,t:s.t};}
function curvePieces(route,holes=[],radius=7){
 const commands=route.commands||commandsFromPolyline(route.points),arc=route.arc||flattenCurve(commands),r={...route,commands,arc},ranges=[];
 for(const h of holes){let d=h.under===r.id?h.underDistance:h.overDistance;if(d===undefined){let near=Infinity,walk=0;for(const s of segs(r.points)){const len=length(s),dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((h.point[0]-s.a[0])*dx+(h.point[1]-s.a[1])*dy)/(len*len||1))),p=mix(s.a,s.b,t),dist=Math.hypot(p[0]-h.point[0],p[1]-h.point[1]);if(dist<near){near=dist;d=walk+len*t;}walk+=len;}}
 const gap=radius/Math.max(.25,h.sine||1);ranges.push([Math.max(0,d-gap),Math.min(arc.length,d+gap)]);}
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const rg of ranges){if(merged.length&&rg[0]<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(merged.at(-1)[1],rg[1]);else merged.push([...rg]);}
 let from=0;const spans=[];for(const [lo,hi]of merged){if(lo>from)spans.push([from,lo]);from=hi;}if(from<arc.length)spans.push([from,arc.length]);
 return spans.map(([lo,hi])=>{const a=curvePointAt(r,lo),b=curvePointAt(r,hi),cs=[];for(let i=a.segment;i<=b.segment;i++){const l=i===a.segment?a.t:0,h=i===b.segment?b.t:1;if(h-l>1e-8)cs.push(curveSlice(commands[i],l,h));}return{commands:cs,d:pathData(cs),points:cs.length?flattenCurve(cs).points:[],distance:lo};}).filter(p=>p.commands.length);
}
function curveDirection(route,source=false){const commands=route.commands;if(!commands?.length){const s=source?{a:route.points[1],b:route.points[0]}:{a:route.points.at(-2),b:route.points.at(-1)};return Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0])*180/Math.PI;}
 const c=source?commands[0]:commands.at(-1),a=source?(c.kind==='cubic'?c.c1:c.to):(c.kind==='cubic'?c.c2:c.from),b=source?c.from:c.to;return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;}

function crossingBridge(c,route,mode='bridge'){
 const d=c.overDistance,gap=7/Math.max(.25,c.sine||1),angle=(c.overAngle??(c.overHorizontal?0:90))*Math.PI/180,n=[Math.sin(angle),-Math.cos(angle)],a=curvePointAt(route,d-gap).point,b=curvePointAt(route,d+gap).point;
 if(mode==='bridge')return [{kind:'cubic',from:a,c1:[a[0]+n[0]*gap*1.5,a[1]+n[1]*gap*1.5],c2:[b[0]+n[0]*gap*1.5,b[1]+n[1]*gap*1.5],to:b}];
 const u=[a[0]+n[0]*gap,a[1]+n[1]*gap],v=[b[0]+n[0]*gap,b[1]+n[1]*gap];return[{kind:'line',from:a,to:u},{kind:'line',from:u,to:v},{kind:'line',from:v,to:b}];
}
function curvedRouting(result,nodes,profiles,hints,ErrorClass=Error,extraObstacles=[]){
 const p=profiles.layout,routes=result.routes.map(r=>({...r,points:r.points.map(v=>[...v]),hint:{...r.hint},routing:hints[r.id]?.routing||p.routing}));
 if(!routes.some(r=>r.routing==='curved'))return routes.some(r=>r.routing==='straight')?{...result,crossings:routeCrossings(routes)}:result;
 const dirs={east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]};
 const routeSegments=r=>segs(r.points);
 // Keep early callouts off likely later cubic branches, so the sequential
 // planner does not force needless detours merely to avoid its own labels.
 const previewCurves=routes.map(r=>{
  if(r.routing!=='curved'||(hints[r.id]?.curve||p.curve)!=='bezier'||hints[r.id]?.via||r.r.from.element===r.r.to.element)return null;
  const a=r.points[0],b=r.points.at(-1),sd=dirs[r.source_side],td=dirs[r.target_side],tension=hints[r.id]?.curve_tension??p.curve_tension??.5,handle=Math.max(24,Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*tension);
  return flattenCurve([{kind:'cubic',from:a,c1:[a[0]+sd[0]*handle,a[1]+sd[1]*handle],c2:[b[0]+td[0]*handle,b[1]+td[1]*handle],to:b}]).points;
 });
 function safe(candidate,index){
  const own=routes[index],segments=routeSegments(candidate);
  for(const n of [...nodes,...extraObstacles]){const owner=n.id===own.r.from.element||n.id===own.r.to.element,pad=owner?-.3:Math.max(3,q(p.object_clearance,16)*.7);if(segments.some(s=>owner&&n.silhouette&&Shapes.segmentInterior?Shapes.segmentInterior(s,n):segmentBox(s,box(n,pad))))return false;}
  for(let j=0;j<routes.length;j++)if(j!==index){const other=routes[j];if(segments.some(s=>segmentBox(s,box(other.label.bounds,8))))return false;
   const ts=routeSegments(other);if(segments.some(s=>ts.some(t=>generalCollinear(s,t,.22))))return false;
   for(const s of segments)for(const t of ts){const hit=lineIntersection(s,t);if(hit&&hit.sine<.22)return false;}
  }return true;
 }
 function label(candidate,index){const size=routes[index].label,old=[size.x,size.y],len=candidate.arc.length,samples=[.5,.4,.6,.3,.7,.2,.8,.1,.9,...Array.from({length:80},(_,i)=>(i+1)/81)],positions=[];
 if(routeSegments(candidate).some(s=>distancePointSegment(old,s)<.15))positions.push(old);
 positions.push(...samples.map(t=>curvePointAt(candidate,len*t).point));
 for(const pt of positions){const[x,y]=pt,rect={x:x-size.w/2,y:y-size.h/2,w:size.w,h:size.h};if(Math.min(Math.hypot(x-candidate.points[0][0],y-candidate.points[0][1]),Math.hypot(x-candidate.points.at(-1)[0],y-candidate.points.at(-1)[1]))<Math.max(size.w,size.h)/2+20)continue;
 if([...nodes,...extraObstacles].some(n=>overlap(rect,n,8)))continue;
 if(routes.some((r,j)=>j!==index&&(overlap(rect,r.label.bounds,8)||routeSegments(r).some(s=>segmentBox(s,box(rect,10))))))continue;
 if(previewCurves.some((pts,j)=>j>index&&pts&&segs(pts).some(s=>segmentBox(s,box(rect,10)))))continue;
 return{...size,x:round(x),y:round(y),bounds:{...rect,x:round(rect.x),y:round(rect.y)},explicit:false};}return null;}
 for(let i=0;i<routes.length;i++){const r=routes[i];if(r.routing!=='curved')continue;const mode=hints[r.id]?.curve||p.curve||'bezier',radius=q(hints[r.id]?.curve_radius??p.curve_radius,32),tension=hints[r.id]?.curve_tension??p.curve_tension??.5,candidates=[];
 if(mode==='bezier'&&!hints[r.id]?.via&&r.r.from.element!==r.r.to.element){const a=r.points[0],b=r.points.at(-1),sd=dirs[r.source_side],td=dirs[r.target_side],major=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])),handle=Math.max(24,major*tension);
  for(const t of [1,.75,.5])candidates.push({strategy:'direct-bezier',appliedTension:tension*t,commands:[{kind:'cubic',from:a,c1:[a[0]+sd[0]*handle*t,a[1]+sd[1]*handle*t],c2:[b[0]+td[0]*handle*t,b[1]+td[1]*handle*t],to:b}]});}
 for(const rad of [mode==='bezier'?Math.max(radius,70):radius,radius,16,8,4,2,1].filter((x,i,a)=>x>0&&a.indexOf(x)===i))candidates.push({strategy:'corridor-spline',commands:roundedCommands(r.points,rad),radius:rad});
 let selected=null;for(const candidate of candidates){const arc=flattenCurve(candidate.commands),test={...r,...candidate,arc,points:arc.points};if(!safe(test,i))continue;const nextLabel=label(test,i);if(nextLabel){selected={...test,label:nextLabel,hint:{...r.hint,callout:[nextLabel.x,nextLabel.y]}};break;}}
 if(!selected)throw new ErrorClass('DDN220','No checked curved route/label fits '+r.id+'; enlarge spacing or split the view. No silent angular fallback.');
 if(!selected.commands.some(s=>s.kind==='cubic'))selected.strategy='aligned-curve';selected.curveFamily=mode;routes[i]=selected;
 if(selected.strategy==='corridor-spline')result.diagnostics.push({code:'DDN-CW01',severity:'info',message:'Cubic corridor spline used to retain clearance or routing hints for '+r.id});
 }
 const crossings=routeCrossings(routes),labels=routes.map(r=>({...r.label.bounds,id:r.id})),quality=inspect(nodes,routes,labels);
 // Additional general-segment checks are needed because cubic samples are not axis aligned.
 const shared=[];for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)if(routeSegments(routes[i]).some(s=>routeSegments(routes[j]).some(t=>generalCollinear(s,t,.1))))shared.push([routes[i].id,routes[j].id]);
 quality.sharedTracks=shared;if(shared.length&&!quality.errors.some(s=>s.includes('collinear')))quality.errors.push(shared.length+' independent shared curved/polyline tracks');
 for(let i=0;i<crossings.length;i++)for(let j=i+1;j<crossings.length;j++)if(Math.hypot(crossings[i].point[0]-crossings[j].point[0],crossings[i].point[1]-crossings[j].point[1])<16)quality.errors.push('Closely spaced curve crossings require additional routing clearance');
 if(quality.errors.length&&p.quality!=='warn')throw new ErrorClass('DDN221',quality.errors[0]);
 return {...result,routes,crossings,labels,quality,curveTolerance:CURVE_TOLERANCE};
}

return {crossingBridge,curvedRouting,flattenCurve,pathData,curvePieces,curveDirection,curveSplit,curveSlice,roundedCommands,lineIntersection,routeCrossings,generalCollinear,CURVE_TOLERANCE,VERSION,q,overlap,box,segmentBox,segs,cross,collinear,distancePointSegment,simplify,layoutNodes,portAssignments,routing,inspect};
});
