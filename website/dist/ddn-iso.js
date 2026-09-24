/*! DDN 0.6.0-beta.1 · GPL-2.0-or-later · modular runtime bundle: ddn-iso — Optional isometric module: axonometric 30° projection, face shading, chart extrusions (bar/pie/donut/area/treemap) and iso graph prisms (optional: visible placeholder when absent). */
(function () {
  'use strict';

  var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-iso requires ddn-core.js to be loaded first');if(!h.DDNRender)throw new Error('ddn-iso requires ddn-graph.js to be loaded first');if(h.DDNLive.VERSION!=="0.6.0-beta.1")throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNIso)return;

  var pkg = {
    "version": "0.6.0-beta.1"}
  ;

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * Explicit cross-bundle module registry (B1-019, D6). One store per realm,
   * shared through globalThis so independently loaded runtime bundles (script
   * tags, CJS require, ESM import, vm contexts) find each other's namespaces.
   * Runtime modules never read host.* globals; bundle entries publish the
   * documented browser globals (DDNLive, DDNRender, …) from these namespaces.
   */
  const host$1=typeof globalThis==='object'&&globalThis?globalThis:{};
  const store=host$1.__DDN_MODULE_REGISTRY__||(host$1.__DDN_MODULE_REGISTRY__={namespaces:Object.create(null)});
  /* Register a module namespace. First publish wins: re-evaluating a bundle
   * (double load) never swaps instances underneath its siblings. Returns the
   * namespace other modules should use. */
  function publishNamespace(name,ns){
   const current=store.namespaces[name];
   if(current)return current;
   store.namespaces[name]=ns;
   return ns;
  }
  /* Required sibling namespace, resolved at module evaluation time. */
  function namespace(name){
   const ns=store.namespaces[name];
   if(!ns)throw new Error('DDN runtime namespace '+name+' is not loaded; load its bundle first.');
   return ns;
  }

  /* SPDX-License-Identifier: GPL-2.0-or-later. Optional isometric module (B1-034):
   * pure-math axonometric projection (30°), face shading, painter's-order
   * composition, chart extrusions (bar/pie/donut/area/treemap) and isometric
   * graph nodes (extruded prisms on an iso ground plane; relations are routed
   * flat by the ordinary renderer, then projected onto the ground plane).
   * Loaded only on demand; the engine renders a visible placeholder plus a
   * coded DDN-E010 diagnostic when this bundle is missing (mirrors B1-025). */
  const D=namespace('DDN');
  const Data=namespace('DDNProjectionData');
  const R=namespace('DDNRender');
  const Text=namespace('DDNText');
  const Palette=namespace('DDNPalette');
  const esc=R.esc,f=n=>Number(n.toFixed(3)),q=D.quantity;

  /* ---------------------------------------------------------------- raw math
   * Axonometric projection at 30° (D2): sx=(x−y)·cos30°, sy=(x+y)·sin30°−z.
   * Ground plane axes: +x runs right-down, +y runs left-down, +z runs up. */
  const ANGLE=30,COS30=Math.cos(ANGLE*Math.PI/180),SIN30=Math.sin(ANGLE*Math.PI/180);
  const project=(x,y,z=0)=>[(x-y)*COS30,(x+y)*SIN30-z];
  /* Face shading from the base colour (D2): top = base, left (+y face) = ×0.85,
   * right (+x face) = ×0.7. shade overrides are exposed through shade(col,f). */
  const SHADE={top:1,left:.85,right:.7};
  function shade(col,factor){
   const m=String(col).match(/[a-f0-9]{2}/gi);
   if(!m||m.length<3)return col;
   return '#'+m.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(parseInt(v,16)*factor))).toString(16).padStart(2,'0')).join('');
  }

  /* ------------------------------------------------------- painter's z-order
   * Total order (D7): ground-plane depth key (x+y of the footprint's minimum
   * corner, back-to-front), then extrusion height, then element id as the
   * deterministic tie-break. Same input → same order → same SVG. */
  function paintOrder(items){
   return items.map((it,i)=>({it,i})).sort((a,b)=>{
    const ka=a.it.x+a.it.y,kb=b.it.x+b.it.y;
    if(ka!==kb)return ka-kb;
    const za=a.it.z||0,zb=b.it.z||0;
    if(za!==zb)return za-zb;
    const ia=String(a.it.id),ib=String(b.it.id);
    return ia<ib?-1:ia>ib?1:a.i-b.i;
   }).map(o=>o.it);
  }

  const pt=([x,y])=>f(x)+' '+f(y);

  /* -------------------------------------------------------- SMIL transitions
   * Refresh-driven depth transitions (D6/B1-033): declarative, ≤300 ms. Hosts
   * pass the previous committed depths as options.isoFrom {elementId: depth};
   * when a face's path changes, each face carries a one-shot <animate> from the
   * old path to the new one. Deterministic: same (from,to) → same SVG. */
  const TRANSITION_MS=250;
  const animate=(oldD,newD)=>oldD!==undefined&&oldD!==newD?`<animate attributeName="d" values="${oldD};${newD}" dur="${TRANSITION_MS/1000}s" fill="freeze"/>`:'';

  /* ----------------------------------------------------------- chart prisms
   * Chart extrusion (D4): the flat mark is the front face; depth extrudes
   * up-right by (d·cos30°, −d·sin30°). Shading: front = base, top = ×0.85,
   * side = ×0.7. All faces are paths so depth transitions animate `d`. */
  function columnFaces(x,y,w,h,d){
   const dx=d*COS30,dy=-d*SIN30;
   return {
    side:`M${f(x+w)} ${f(y)}L${f(x+w+dx)} ${f(y+dy)}L${f(x+w+dx)} ${f(y+h+dy)}L${f(x+w)} ${f(y+h)}Z`,
    top:`M${f(x)} ${f(y)}L${f(x+dx)} ${f(y+dy)}L${f(x+w+dx)} ${f(y+dy)}L${f(x+w)} ${f(y)}Z`,
    front:`M${f(x)} ${f(y)}L${f(x+w)} ${f(y)}L${f(x+w)} ${f(y+h)}L${f(x)} ${f(y+h)}Z`,
   };
  }
  function column(x,y,w,h,d,color,stroke,prev){
   const c=columnFaces(x,y,w,h,d),p=prev!==undefined?columnFaces(x,y,w,h,prev):null;
   return `<path class="ddn-iso-side" d="${c.side}" fill="${shade(color,SHADE.right)}"${stroke?` stroke="${stroke}" stroke-width="1"`:''}>${p?animate(p.side,c.side):''}</path>`
    +`<path class="ddn-iso-top" d="${c.top}" fill="${shade(color,SHADE.left)}"${stroke?` stroke="${stroke}" stroke-width="1"`:''}>${p?animate(p.top,c.top):''}</path>`
    +`<path class="ddn-iso-front" data-value-depth="${f(d)}" d="${c.front}" fill="${color}"${stroke?` stroke="${stroke}" stroke-width="1"`:''}>${p?animate(p.front,c.front):''}</path>`;
  }
  /* Pie/donut thickness: the top face is the flat arc; the outer wall drops
   * straight down by d (screen space). The upper half of the wall is covered by
   * the top face, the lower half reads as the thickness. Donuts also get the
   * inner wall so the hole reads as drilled. */
  function arcSideFaces(cx,cy,r,inner,a0,a1,d){
   const xy=(a,rr,dy=0)=>[cx+Math.cos(a)*rr,cy+Math.sin(a)*rr+dy];
   const span=a1-a0,slices=span>=Math.PI*2-.000001?48:Math.max(4,Math.ceil(Math.abs(span)/(Math.PI/24))),step=span/slices;
   const wall=(rr)=>{let dd='';for(let z=0;z<=slices;z++){const b=xy(a0+step*z,rr);dd+=(z?'L':'M')+f(b[0])+' '+f(b[1]);}for(let z=slices;z>=0;z--){const b=xy(a0+step*z,rr,d);dd+='L'+f(b[0])+' '+f(b[1]);}return dd+'Z';};
   const out={outer:wall(r)};
   if(inner>0)out.inner=wall(inner);
   return out;
  }
  function arcSide(cx,cy,r,inner,a0,a1,d,color,prev){
   const faces=arcSideFaces(cx,cy,r,inner,a0,a1,d),p=prev!==undefined?arcSideFaces(cx,cy,r,inner,a0,a1,prev):null;
   let out=`<path class="ddn-iso-side" d="${faces.outer}" fill="${shade(color,SHADE.right)}" stroke="${shade(color,SHADE.right)}" stroke-width="1">${p?animate(p.outer,faces.outer):''}</path>`;
   if(faces.inner)out+=`<path class="ddn-iso-side-inner" d="${faces.inner}" fill="${shade(color,SHADE.left)}" stroke="${shade(color,SHADE.left)}" stroke-width="1">${p?animate(p.inner,faces.inner):''}</path>`;
   return out;
  }
  /* Area ribbon (D4): the side band joins the flat top polyline to its
   * extruded copy; the flat area fill stays the front face. */
  function ribbon(points,d,color,stroke,prev){
   const band=(pts,dd)=>{const dx=dd*COS30,dy=-dd*SIN30;return 'M'+pts.map(p=>f(p[0])+' '+f(p[1])).join('L')+pts.slice().reverse().map(p=>'L'+f(p[0]+dx)+' '+f(p[1]+dy)).join('')+'Z';};
   const dNow=band(points,d),dOld=prev!==undefined?band(points,prev):undefined;
   return `<path class="ddn-iso-ribbon" d="${dNow}" fill="${shade(color,SHADE.right)}"${stroke?` stroke="${stroke}" stroke-width="1"`:''}>${animate(dOld,dNow)}</path>`;
  }

  /* ----------------------------------------------------------- depth binding
   * depth forms (D3): quantity/number constant; "x_record.field" per-record
   * binding (chart idiom, Data.get exactly); @data.record.field (compiled to
   * {$ref,$field} by ddn-core) reads one record's field as the view depth. */
  function resolveViewDepth(ir){
   const pr=ir.view.profiles.projection||{},v=pr.depth;
   const fail=(code,msg)=>{throw new D.DDNError(code,msg,ir.view.source?.file,ir.view.source?.start);};
   if(v===undefined)return {depth:0,binding:null};
   if(typeof v==='number'){if(!Number.isFinite(v)||v<0||v>2000)fail('DDN-ISO151','depth must be a finite number 0..2000 (px)');return {depth:v,binding:null};}
   if(v&&v.$quantity!==undefined){const dpx=q(v,NaN);if(!Number.isFinite(dpx)||dpx<0||dpx>2000)fail('DDN-ISO151','depth must be a finite px quantity 0..2000');return {depth:dpx,binding:null};}
   if(typeof v==='string')return {depth:0,binding:{kind:'records',path:v}};
   if(v&&v.$ref!==undefined&&typeof v.$field==='string'){
    const rec=ir.elements.find(n=>n.id===v.$ref);
    if(!rec)fail('DDN-ISO152','depth binding @'+v.$ref+' is outside the view data scope');
    const val=Data.get(rec,v.$field);
    if(typeof val!=='number'||!Number.isFinite(val)||val<0||val>2000)fail('DDN-ISO152','depth binding '+v.$field+' must supply a finite number 0..2000');
    return {depth:val,binding:{kind:'record',ref:v.$ref,field:v.$field}};
   }
   fail('DDN-ISO151','depth is a px quantity, a number, an "x_record.field" per-record binding or @data.record.field');
  }
  /* Per-element depth (D3): an object's own depth property overrides the view
   * depth; the default inherits the view depth. */
  function elementDepth(node,viewDepth){
   const v=node.properties?.depth;
   if(v===undefined)return viewDepth;
   const dpx=typeof v==='number'?v:v&&v.$quantity!==undefined?q(v,NaN):NaN;
   if(!Number.isFinite(dpx)||dpx<0||dpx>2000)throw new D.DDNError('DDN-ISO151','Per-element depth on '+node.id+' must be a finite px quantity 0..2000',node.source?.file,node.source?.start);
   return dpx;
  }

  /* Chart spec: null when the view is flat; otherwise per-record depth
   * resolution for the extruded marks (bar/pie/donut/area/treemap, D4). */
  const EXTRUDED_MARKS=['bar','pie','donut','area','treemap'];
  function chartSpec(ir,mark){
   const pr=ir.view.profiles.projection||{};
   const isoOn=pr.iso===true,hasDepth=pr.depth!==undefined;
   new Map(ir.elements.map(n=>[n.id,n]));
   const hasElementDepth=ir.elements.some(n=>ir.view.selected.includes(n.id)&&n.properties?.depth!==undefined);
   if(!isoOn&&!hasDepth&&!hasElementDepth)return null;
   const vd=resolveViewDepth(ir);
   const viewDepth=hasDepth?vd.depth:(isoOn?18:0);
   const depthOf=node=>{
    if(!node)return viewDepth;
    if(node.properties?.depth!==undefined)return elementDepth(node,viewDepth);
    if(vd.binding?.kind==='records'){
     const val=Data.get(node,vd.binding.path);
     if(typeof val!=='number'||!Number.isFinite(val)||val<0||val>2000)throw new D.DDNError('DDN-ISO152','depth binding '+vd.binding.path+' must supply a finite number 0..2000 for every bound record',node.source?.file,node.source?.start);
     return val;
    }
    return viewDepth;
   };
   return {iso:isoOn,viewDepth,depthOf,binding:vd.binding,supported:EXTRUDED_MARKS.includes(mark)};
  }

  /* ------------------------------------------------------- iso graph (D5)
   * Nodes render as extruded prisms on an iso ground plane; labels sit on the
   * top face; relations are routed FLAT by the ordinary graph renderer and the
   * resulting 2D route points are then projected onto the ground plane (z=0).
   * Routing is never computed in 3D. Endpoints attach at prism top-face
   * centres/edges: route ends are re-anchored to the projected top-centre. */
  function renderGraph(ir,reg,glyphs='',options={}){
   const pr=ir.view.profiles.projection,p=ir.view.profiles,t=Palette.themes[p.style.theme];
   const vd=resolveViewDepth(ir),viewDepth=pr.depth!==undefined?vd.depth:18;
   const byId=new Map(ir.elements.map(n=>[n.id,n]));
   const shown=new Set(ir.view.selected);
   const depthOf=n=>elementDepth(n,viewDepth);
   if(vd.binding?.kind==='records')throw new D.DDNError('DDN-ISO151','Per-record "x_record.field" depth binding applies to chart views; graph views take a constant or @data.record.field depth');
   /* Flat geometry first: the ordinary renderer lays out and routes in 2D. */
   const flat=R.render(ir,reg,glyphs,{...options,noMotion:true});
   const diagnostics=[...flat.diagnostics];
   const fs=flat.scene,s=q(p.style.font_size,16)/16,stats=Text.stats();
   const nodes=fs.nodes.filter(g=>shown.has(g.id));
   const nodeBox=new Map(nodes.map(g=>[g.id,g]));
   /* World bounds (flat coordinates) and projected bounds, fitted to the box. */
   let wx0=Infinity,wy0=Infinity,wx1=-Infinity,wy1=-Infinity,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
   const visit=(x,y,z)=>{wx0=Math.min(wx0,x);wy0=Math.min(wy0,y);wx1=Math.max(wx1,x);wy1=Math.max(wy1,y);const [sx,sy]=project(x,y,z);x0=Math.min(x0,sx);y0=Math.min(y0,sy);x1=Math.max(x1,sx);y1=Math.max(y1,sy);};
   for(const g of nodes){const z=depthOf(byId.get(g.id));visit(g.x,g.y,0);visit(g.x+g.w,g.y+g.h,0);visit(g.x,g.y,z);visit(g.x+g.w,g.y+g.h,z);}
   for(const r of fs.routes)for(const pt2 of r.points)visit(pt2[0],pt2[1],0);
   if(!Number.isFinite(x0)){wx0=0;wy0=0;wx1=100;wy1=100;const[a,b]=project(0,0,0),[c,d]=project(100,100,0);x0=a;y0=b;x1=c;y1=d;}
   const pad=30*s,W=q(pr.width,Math.max(640,(x1-x0)+2*pad)),H=q(pr.height,Math.max(360,(y1-y0)+2*pad+30*s));
   const scale=Math.min(1,(W-2*pad)/((x1-x0)||1e-9),(H-2*pad-30*s)/((y1-y0)||1e-9));
   const P=(x,y,z=0)=>{const [sx,sy]=project(x,y,z);return [pad+(sx-x0)*scale+(W-2*pad-(x1-x0)*scale)/2,pad+30*s+(sy-y0)*scale];};
   let smallest=11*s;
   const text=(x,y,value,size=13,weight=400,anchor='start',fill=t.ink)=>{const txt=String(value??'');Text.measure(txt,size*s,p.style.font,weight);smallest=Math.min(smallest,size*s);return `<text x="${f(x)}" y="${f(y)}" font-size="${size*s}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(txt)}</text>`;};
   const marks=[];let body='';
   /* Ground-plane hint: the projected drawing-bounds rectangle, then the
    * flat-computed routes projected onto the ground plane under the prisms. */
   body+=`<path class="ddn-iso-ground" d="${[[wx0,wy0],[wx1,wy0],[wx1,wy1],[wx0,wy1]].map((c,i)=>{const pj=P(c[0],c[1],0);return (i?'L':'M')+f(pj[0])+' '+f(pj[1]);}).join('')}Z" fill="${t.surface}" stroke="${t.rule}" stroke-width="1"/>`;
   const group=(id,ids,content,box={},key)=>{const mid='mark:'+ir.view.id+':'+marks.length;marks.push({id:mid,sourceIds:ids,...box,...({property:key})});return `<g class="${R.cls('ddn-mark','ddn-mark-iso-node')}" data-id="${esc(id||ids[0]||'')}" data-source-ids="${esc(JSON.stringify(ids))}" data-projection-mark="${esc(mid)}" tabindex="0" role="group">${content}</g>`;};
   /* Routes: flat-computed 2D points projected onto the ground plane (z=0);
    * endpoints re-anchored to the projected top-face centre of each prism. */
   const topCentre=g=>{const n=byId.get(g.id),z=depthOf(n);return P(g.x+g.w/2,g.y+g.h/2,z);};
   for(const r of fs.routes){
    const rel=ir.relations.find(x=>x.id===r.id),reg2=rel?D.relationEntry(reg,rel.kind):null;
    const colour=reg2?Palette.semantic(reg2.colour,t):t.ink;
    const pts=r.points.map(pt2=>P(pt2[0],pt2[1],0));
    const a=nodeBox.get(rel?.from.element),b=nodeBox.get(rel?.to.element);
    if(a)pts[0]=topCentre(a);
    if(b)pts[pts.length-1]=topCentre(b);
    const d=pts.map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join(' ');
    const endp=pts.at(-1),prev2=pts.at(-2)||[endp[0]-1,endp[1]],angle=Math.atan2(endp[1]-prev2[1],endp[0]-prev2[0])*180/Math.PI;
    body+=`<g class="${R.cls('ddn-relation','ddn-iso-route')}" data-id="${esc(r.id)}"><title>${esc(rel?.name||r.id)}</title><path d="${d}" fill="none" stroke="${colour}" stroke-width="${reg2?.width||1.6}"${reg2?.pattern?` stroke-dasharray="${esc(reg2.pattern)}"`:''}/><g transform="translate(${f(endp[0])} ${f(endp[1])}) rotate(${f(angle)})"><path d="M-9 -4.5L0 0L-9 4.5" fill="none" stroke="${colour}" stroke-width="1.5"/></g></g>`;
   }
   /* Prisms back-to-front (total painter's order, id tie-break). */
   const items=paintOrder(nodes.map(g=>({id:g.id,x:g.x,y:g.y,z:depthOf(byId.get(g.id)),g})));
   const prev=(options.isoFrom&&options.isoFrom.depths)||null,animateOk=!options.noMotion;
   for(const {g,z} of items){
    const n=byId.get(g.id),k=D.kindEntry(reg,n.kind),nc=Palette.node(k,t);
    const base=p.style.theme==='neutral'?'#FAFAFA':nc.fill,ink=p.style.theme==='neutral'?'#333333':nc.ink;
    const c00=P(g.x,g.y,0),c10=P(g.x+g.w,g.y,0),c11=P(g.x+g.w,g.y+g.h,0),c01=P(g.x,g.y+g.h,0);
    const t00=P(g.x,g.y,z),t10=P(g.x+g.w,g.y,z),t11=P(g.x+g.w,g.y+g.h,z),t01=P(g.x,g.y+g.h,z);
    const leftD=`M${pt(c01)}L${pt(c11)}L${pt(t11)}L${pt(t01)}Z`,rightD=`M${pt(c10)}L${pt(c11)}L${pt(t11)}L${pt(t10)}Z`,topD=`M${pt(t00)}L${pt(t10)}L${pt(t11)}L${pt(t01)}Z`;
    const pd=animateOk&&prev&&prev[n.id]!==undefined&&prev[n.id]!==z?(()=>{const o=prev[n.id],o00=P(g.x,g.y,o),o10=P(g.x+g.w,g.y,o),o11=P(g.x+g.w,g.y+g.h,o),o01=P(g.x,g.y+g.h,o);return {left:`M${pt(c01)}L${pt(c11)}L${pt(o11)}L${pt(o01)}Z`,right:`M${pt(c10)}L${pt(c11)}L${pt(o11)}L${pt(o10)}Z`,top:`M${pt(o00)}L${pt(o10)}L${pt(o11)}L${pt(o01)}Z`};})():null;
    let content=`<title>${esc(n.name+' — '+k.name+(z?' · depth '+f(z)+'px':''))}</title>`;
    content+=`<path class="ddn-iso-left" d="${leftD}" fill="${shade(base,SHADE.left)}" stroke="${ink}" stroke-width="1.2">${pd?animate(pd.left,leftD):''}</path>`;
    content+=`<path class="ddn-iso-right" d="${rightD}" fill="${shade(base,SHADE.right)}" stroke="${ink}" stroke-width="1.2">${pd?animate(pd.right,rightD):''}</path>`;
    content+=`<path class="ddn-iso-top" d="${topD}" fill="${base}" stroke="${ink}" stroke-width="1.6">${pd?animate(pd.top,topD):''}</path>`;
    /* Label on the top face, kept horizontal for legibility (documented). */
    const cx=(t00[0]+t11[0])/2,cy=(t00[1]+t11[1])/2;
    const lines=Text.wrap(n.name,Math.max(40,(g.w)*scale*.8),13*s,p.style.font,650);
    content+=lines.map((l2,i)=>text(cx,cy+(i-(lines.length-1)/2)*16*s+4*s,l2,13,650,'middle',nc.text)).join('');
    body+=group(n.id,[n.id],content,{x:Math.min(c00[0],c01[0],t01[0]),y:t00[1],w:Math.max(c10[0],c11[0],t10[0])-Math.min(c00[0],c01[0],t01[0]),h:c11[1]-t00[1],depth:z},'depth');
   }
   if(ir.view.frames.length||ir.view.subdiagrams.length)diagnostics.push({code:'DDN-ISOW02',severity:'warning',message:'Isometric graph views render nodes and relations on the ground plane; frames and subdiagrams are flat-view devices and are omitted here (never silently merged).'});
   body+=text(0,H-12*s,'Isometric projection (axonometric 30°) · '+nodes.length+' prisms · relations routed flat, then projected onto the ground plane · prism height is the declared depth.',11);
   /* Page composition mirrors the geo module's page shape. */
   const margin=q(p.publication.margin,32),titleLines=Text.wrap(ir.view.name,W,24*s,p.style.font,650),header=Math.max(92*s,(titleLines.length*29+48)*s),footer=46*s;
   let pageW=q(p.publication.width,1280),pageH=q(p.publication.height,800);if(['a4','letter'].includes(p.publication.size)){pageW=p.publication.size==='a4'?210*96/25.4:816;pageH=p.publication.size==='a4'?297*96/25.4:1056;if(p.publication.orientation==='landscape')[pageW,pageH]=[pageH,pageW];}
   if(p.publication.size==='content'){pageW=W+margin*2;pageH=H+margin*2+header+footer;}
   const aw=pageW-2*margin,ah=pageH-2*margin-header-footer;if(aw<=0||ah<=0)throw new D.DDNError('DDN-PJ061','Page has no remaining drawing area');
   const pscale=p.publication.fit==='none'?1:Math.min(1,aw/W,ah/H);
   const tx=margin+(aw-W*pscale)/2,ty=margin+header;
   const line=(x,y,xx,yy,colour=t.rule,width=1)=>`<path d="M${f(x)} ${f(y)}L${f(xx)} ${f(yy)}" stroke="${colour}" stroke-width="${width}" fill="none"/>`;
   let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg class="${R.cls('ddn-svg','ddn-view-graph','ddn-iso','ddn-profile-'+R.slug(pr.profile))}" xmlns="http://www.w3.org/2000/svg" width="${f(pageW)}" height="${f(pageH)}" viewBox="0 0 ${f(pageW)} ${f(pageH)}" role="img" aria-labelledby="projection-title projection-description" style="font-family:${esc(Text.FONTS[p.style.font])}"><title id="projection-title">${esc(ir.view.name)}</title><desc id="projection-description">${esc(pr.profile)}. Isometric graph view (axonometric 30°). Nodes are extruded prisms; relations are flat-computed routes projected onto the ground plane.</desc><rect width="100%" height="100%" fill="${t.background}"/>`;
   out+=text(margin,margin+8*s,'DDN / 0.5 PROJECTION PREVIEW / '+pr.profile+' / ISO',11,600)+titleLines.map((v,i)=>text(margin,margin+42*s+i*29*s,v,24,650)).join('')+`<g id="drawing" transform="translate(${f(tx)} ${f(ty)}) scale(${f(pscale)})">`+body+'</g>';
   out+=line(margin,pageH-margin-23*s,pageW-margin,pageH-margin-23*s)+text(margin,pageH-margin,'One model · source-bound occurrences · '+p.style.look+' / '+p.style.theme+' · iso',11)+text(pageW-margin,pageH-margin,'iso',11,600,'end')+'</svg>';
   const after=Text.stats();if(after.estimated>stats.estimated&&!diagnostics.some(d2=>d2.code==='DDN-TW01'))diagnostics.push({code:'DDN-TW01',severity:'warning',message:'Some projection text used estimated metrics. Browser-specific shaping is not certified.'});
   const scene={width:pageW,height:pageH,smallestText:smallest,scale:pscale,origin:[tx,ty],nodes:nodes.map(g=>({id:g.id,depth:depthOf(byId.get(g.id))})),routes:fs.routes.map(r=>({id:r.id,points:r.points.map(pt2=>P(pt2[0],pt2[1],0))})),crossings:[],frames:[],subdiagrams:[],marks,projection:{kind:'graph',profile:pr.profile,iso:true,depth:viewDepth,sourceIds:[...shown],quantitative:false},drawingBounds:{x:0,y:0,w:W,h:H},drawingArea:{x:margin,y:margin+header,w:aw,h:ah},textMeasurement:{mode:after.estimated>stats.estimated?'estimated':'measured',requestedFont:p.style.font}};
   return {svg:out,scene,diagnostics,_ir:ir};
  }

  const api$1={VERSION:'0.6.0-beta.1',ANGLE,COS30,SIN30,SHADE,TRANSITION_MS,project,shade,paintOrder,column,columnFaces,arcSide,arcSideFaces,ribbon,resolveViewDepth,elementDepth,chartSpec,renderGraph,EXTRUDED_MARKS};
  publishNamespace('DDNIso',api$1);

  /* SPDX-License-Identifier: GPL-2.0-or-later. ddn-iso bundle entry
   * (B1-034). Guards, optional isometric module publication, browser globals. */

  const host = globalThis;
  if (!host.DDNLive) throw new Error('ddn-iso requires ddn-core.js to be loaded first');
  if (!host.DDNRender) throw new Error('ddn-iso requires ddn-graph.js to be loaded first');
  if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
  if (!host.DDNIso) {
    host.DDNIso = api$1;
  }
  const api = host.DDNLive;
  if (typeof module === 'object' && module.exports) module.exports = api;
  const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;

})();
