/*! DDN 0.6.0-beta.1 · GPL-2.0-or-later · modular runtime bundle: ddn-quality — Quality renderers (quality charts, decision tables, fishbone). Registers the "fishbone" and "decision" kinds; they compose through ddn-projections.js. */
(function () {
  'use strict';

  var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-quality requires ddn-core.js to be loaded first');if(!h.DDNRender)throw new Error('ddn-quality requires ddn-graph.js to be loaded first');if(h.DDNLive.VERSION!=="0.6.0-beta.1")throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNQualityRender)return;

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
  /* Optional sibling namespace for lazy cross-bundle composition (e.g. quality
   * renderers used by projections only when ddn-quality.js is present). */
  function optionalNamespace(name){
   return store.namespaces[name]||null;
  }

  /* SPDX-License-Identifier: GPL-2.0-or-later. SVG bodies for explicit quality projections.
   * Numeric coordinates remain exact even when outlines use a sketch treatment.
   */
  const Q=namespace('DDNQualityData');
  const Sketch=namespace('DDNSketch');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const f=n=>Number(n.toFixed(3));
  const fmt=n=>n!==0&&(Math.abs(n)>=1e9||Math.abs(n)<.01)?n.toExponential(3):new Intl.NumberFormat('en',{maximumFractionDigits:3}).format(n);
  function encodedColour(intensity,theme,palette){
   const clamp=Math.max(0,Math.min(1,intensity)),rgb=h=>h.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)),mix=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');
   const fill=palette==='grey'?mix('#EEEEEE','#444444',clamp):palette==='diverging'?(clamp<.5?mix('#A84646','#F2F4F7',clamp*2):mix('#F2F4F7','#2465A6',(clamp-.5)*2)):mix('#E5F0FB','#225784',clamp);
   const c=rgb(fill).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}),lum=.2126*c[0]+.7152*c[1]+.0722*c[2];return {fill,ink:(lum+.05)/.05>=1.05/(lum+.05)?'#000000':'#FFFFFF'};
  }
  function draw(plan,ir,c){
   const {text,lines,wrap,line,rect,group,colour,s,theme:t,diagnostics=[],options={}}=c,p=ir.view.profiles.projection;let W=c.W,H=600*s,body='';
   const recolor=(svg,col)=>svg.replace(/(<text\b[^>]*\bfill=")[^"]*(")/g,'$1'+col+'$2');
   const sourceGroup=(ids,content,box={},property)=>group(ids[0],ids,content,box,property);
   if(plan.kind==='matrix'&&plan.encoding){
    const rw=240*s,cw=Math.max(135*s,(W-rw)/plan.columns.length),hh=Math.max(82*s,32*s+Math.max(...plan.columns.map(n=>wrap(n.name,cw-22*s,12,650).length))*18*s);W=rw+cw*plan.columns.length;let y=hh;
    body+=rect(0,0,W,hh)+text(14*s,30*s,'DECLARED CELL ENCODING',11,650);
    plan.columns.forEach((n,j)=>body+=sourceGroup([n.id],lines(wrap(n.name,cw-20*s,12,650),rw+j*cw+10*s,27*s,12,650),{x:rw+j*cw,y:0,w:cw,h:hh}));
    for(let i=0;i<plan.rows.length;i++){const rl=wrap(plan.rows[i].name,rw-25*s,13,600),cellLines=plan.cells[i].map(cell=>wrap(cell[0]?.label??'— no record',cw-20*s,12,600)),rh=Math.max(70*s,Math.max(rl.length*19,...cellLines.map(x=>x.length*18))*s+32*s);body+=rect(0,y,rw,rh)+sourceGroup([plan.rows[i].id],lines(rl,12*s,y+27*s,13,600),{x:0,y,w:rw,h:rh});
     for(let j=0;j<plan.columns.length;j++){const cell=plan.cells[i][j],x=rw+j*cw,paint=cell.length?encodedColour(cell[0].intensity,t,ir.view.profiles.style.theme==='neutral'?'grey':plan.encoding.palette):{fill:t.background,ink:t.muted},ids=cell.map(n=>n.id),txt=lines(cellLines[j],x+cw/2,y+(rh-(cellLines[j].length-1)*18*s)/2+4*s,12,600,'middle');body+=group(ids[0]||plan.rows[i].id,ids,rect(x,y,cw,rh,paint.fill,t.rule,true)+recolor(txt,paint.ink),{x,y,w:cw,h:rh,rowId:plan.rows[i].id,columnId:plan.columns[j].id,relationKind:p.relation,rawValue:cell[0]?.raw??null},p.value);}
     y+=rh;
    }
    let xx=0,yy=y+40*s;const e=plan.encoding,legend=e.mode==='numeric'?Array.from({length:5},(_,i)=>({t:i/4,label:fmt(e.domain[0]+(e.domain[1]-e.domain[0])*i/4)})):e.labels.map((label,i)=>({t:e.labels.length===1?.5:i/(e.labels.length-1),label:e.mode==='bands'?label+' ['+e.boundaries[i]+', '+e.boundaries[i+1]+(i===e.labels.length-1?']':')'):label}));
    for(const v of legend){const lw=Math.min(W,Math.max(120*s,v.label.length*7*s+48*s));if(xx+lw>W){xx=0;yy+=38*s;}body+=rect(xx,yy-17*s,22*s,22*s,encodedColour(v.t,t,ir.view.profiles.style.theme==='neutral'?'grey':e.palette).fill,t.rule,true)+text(xx+31*s,yy,v.label,11);xx+=lw;}
    H=yy+60*s;body+=text(0,H-16*s,'Missing is not zero. Colours follow the declared legend; labels remain visible in monochrome exports.',11);return {body,W,H};
   }
   if(plan.kind==='fishbone'){
    const count=n=>1+n.children.reduce((s,c)=>s+count(c),0),depth=n=>1+Math.max(0,...n.children.map(depth));
    const groups=plan.categories.map((cat,i)=>({cat,i,levels:depth(cat),size:count(cat)})),cols=Math.ceil(groups.length/2),sector=Math.max(370*s,320*s+Math.max(...groups.map(g=>g.levels))*34*s),row=44*s,maxRows=Math.max(...groups.map(g=>g.size));
    const half=Math.max(235*s,maxRows*row+95*s),spineY=half,W=cols*sector+310*s,H=half*2+90*s;let body='';
    const path=(pts,id,w=1.7)=>ir.view.profiles.style.look==='handDrawn'?Sketch.polyline(pts,{...ir.view.profiles.style,id,stroke:t.accent,width:w,hachure:false}):`<path d="${pts.map((p,i)=>(i?'L':'M')+f(p[0])+' '+f(p[1])).join('')}" fill="none" stroke="${t.accent}" stroke-width="${w}"/>`;
    body+=path([[22*s,spineY],[W-230*s,spineY]],'spine',2.3)+`<path d="M${W-240*s} ${spineY-6*s}L${W-228*s} ${spineY}L${W-240*s} ${spineY+6*s}Z" fill="${t.accent}"/>`;
    const effectLines=wrap(plan.effect.name,205*s,16,650),eh=Math.max(100*s,effectLines.length*22*s+34*s),ex=W-223*s;body+=sourceGroup([plan.effect.id],rect(ex,spineY-eh/2,220*s,eh)+lines(effectLines,ex+110*s,spineY-(effectLines.length-1)*11*s+5*s,16,650,'middle'),{x:ex,y:spineY-eh/2,w:220*s,h:eh});
    for(const g of groups){const side=g.i%2===0?-1:1,col=Math.floor(g.i/2),joinX=(col+1)*sector-8*s,rootX=col*sector+sector*.62,edgeY=spineY+side*(half-40*s),flat=[];
     function flatten(n,parent=null,d=0){const item={n,parent,d,index:flat.length};flat.push(item);n.children.forEach(ch=>flatten(ch,item,d+1));}g.cat.children.forEach(ch=>flatten(ch));
     body+=path([[rootX,edgeY+side*-22*s],[joinX,spineY]],g.cat.occurrence,1.8);
     const category=wrap(g.cat.node.name,sector*.75,15,650);body+=sourceGroup([g.cat.node.id,g.cat.relationId],lines(category,rootX,edgeY+(side<0?-12:30)*s,15,650,'middle'),{x:rootX-sector*.35,y:edgeY-20*s,w:sector*.7,h:40*s});
     for(const item of flat){const fraction=(item.index+1)/(flat.length+1),yy=edgeY+(spineY-edgeY)*fraction,tipX=rootX+(joinX-rootX)*fraction,leftX=col*sector+18*s+item.d*26*s,available=tipX-leftX-28*s,label=wrap(item.n.node.name,available,12),labelY=yy-(label.length-1)*16*s-7*s;
      let target=[tipX,yy];if(item.parent){const parent=item.parent,fp=(parent.index+1)/(flat.length+1),py=edgeY+(spineY-edgeY)*fp,px=col*sector+18*s+parent.d*26*s+Math.min(100*s,available*.6);target=[px,py];body+=path([[leftX,yy],[leftX+50*s,yy],target],item.n.occurrence+':child',1.1);}else body+=path([[leftX,yy],target],item.n.occurrence,1.3);
      const ids=[item.n.node.id,item.n.relationId];body+=group(item.n.node.id,ids,lines(label,leftX,labelY,12),{x:leftX,y:labelY-13*s,w:Math.max(available,30*s),h:label.length*16*s,occurrence:item.n.occurrence});
     }
    }
    body+=text(20*s,H-26*s,'Possible causes, not proven causality · branches are source relationships · repeated appearances retain one identity',11);return {body,W,H};
   }
   if(plan.kind==='decision'){
    const headers=['Rule',...plan.inputs.map(d=>d.key),...plan.outputs.map(k=>'→ '+k)],cw=Math.max(155*s,W/headers.length);W=cw*headers.length;const head=84*s;body+=rect(0,0,W,head)+text(14*s,24*s,'HIT POLICY: '+plan.policy.toUpperCase()+'  ·  coverage: '+plan.coverage,12,650);headers.forEach((v,i)=>body+=text(i*cw+12*s,61*s,v,12,650));let y=head;
    for(const rule of plan.rules){const vals=[rule.node.name,...plan.inputs.map(d=>Q.formatPredicate(rule.when[d.key])),...plan.outputs.map(k=>JSON.stringify(rule.then[k]))],ls=vals.map(v=>wrap(v,cw-24*s,12)),rh=Math.max(64*s,Math.max(...ls.map(x=>x.length))*18*s+24*s);body+=rect(0,y,W,rh);vals.forEach((v,i)=>{body+=line(i*cw,y,i*cw,y+rh)+group(rule.id,[rule.id],lines(ls[i],i*cw+12*s,y+26*s,12),{x:i*cw,y,w:cw,h:rh});});y+=rh;}
    const a=plan.analysis,notes=['Analysis: '+a.status+' · '+(a.checks||0)+' tested partition atoms of '+a.combinations+'.',a.status==='budget_exceeded'?'Coverage and overlap were NOT established.':a.uncovered.length?'Uncovered input witnesses: '+a.uncovered.length+' shown (first 20 retained).':'No uncovered domain atoms.',a.shadowed.length?'Shadowed first-hit rules: '+a.shadowed.length+'.':'Source order defines first-hit precedence; collect returns all matching outcomes.'];
    H=y+105*s;notes.forEach((n,i)=>body+=text(10*s,y+28*s+i*24*s,n,11));return {body,W,H};
   }
   if(plan.kind!=='chart'||!plan.quality)return null;
   W=Math.max(W,800*s);H=Math.max(c.H||600*s,600*s);const tr=plan.transform;
   let points=plan.points||[],ys=[],xmin=0,xmax=1,categories=[];
   if(tr==='histogram'){xmin=plan.bins[0].a;xmax=plan.bins.at(-1).b;ys=plan.bins.map(b=>b.y);}
   else if(tr==='boxplot'){categories=plan.boxes.map(b=>b.x);ys=plan.boxes.flatMap(b=>[b.low,b.high,...b.outliers.map(x=>x.value)]);}
   else if(tr==='waterfall'){categories=points.map(b=>b.x);ys=points.flatMap(b=>[b.start,b.end]);}
   else if(tr==='pareto'){categories=points.map(b=>b.x);ys=[0,plan.total];}
   else {categories=plan.categories;ys=points.filter(n=>n.y!==null).flatMap(n=>[n.start,n.end]);if(plan.target!==undefined)ys.push(plan.target);}
   /* B1-036 (D1): iso hook on the quality path (multi-series bar/area charts).
    * Absent module: the engine already degraded visibly before this renderer ran
    * (iso:true → placeholder + DDN-E010; depth-only → flat + DDN-E010 warning),
    * so a null ISO here simply renders flat, mirroring the basic-chart path. */
   const ISO=optionalNamespace('DDNIso'),byId=new Map(ir.elements.map(n=>[n.id,n]));let isoSpec=null;
   if(ISO){
    const spec=ISO.chartSpec(ir,tr==='identity'?plan.mark:'bar');
    if(spec&&tr!=='identity')diagnostics.push({code:'DDN-ISOW01',severity:'warning',message:'iso/depth extrusion is implemented for untransformed (identity) quality charts; the '+tr+' transform renders flat.'});
    else if(spec&&!(spec.supported&&plan.layers.every(l=>ISO.EXTRUDED_MARKS.includes(l.mark))))diagnostics.push({code:'DDN-ISOW01',severity:'warning',message:'iso/depth extrusion is implemented for bar and area layers on quality charts; the '+plan.mark+' mark renders flat.'});
    else isoSpec=spec;
   }
   if(categories.length)W=Math.max(W,categories.length*65*s+155*s);
   let lo=tr==='boxplot'?Math.min(...ys):Math.min(0,...ys),hi=tr==='boxplot'?Math.max(...ys):Math.max(0,...ys);if(tr==='boxplot'&&hi>lo){const pad=(hi-lo)*.08;lo-=pad;hi+=pad;}if(lo===hi)hi=lo+1;if(!Number.isFinite(hi-lo))throw Object.assign(new Error('Quantitative extent overflow'),{code:'DDN-QC099'});
   const legendSlots=[];let legendX=100*s,legendY=54*s;if(tr==='identity')for(const layer of plan.layers){const ww=Math.min(W-155*s,Math.max(110*s,layer.series.length*8*s+50*s));if(legendX+ww>W-55*s){legendX=100*s;legendY+=24*s;}legendSlots.push({x:legendX,y:legendY,w:ww});legendX+=ww;}H+=Math.max(0,legendY-54*s);
   const labelDepth=categories.length?Math.max(...categories.map(x=>wrap(String(x),(W-155*s)/categories.length-10*s,11).length)):1,labelSpace=Math.max(145*s,(labelDepth*16+75)*s);H+=labelSpace-145*s;
   const isoPad=isoSpec?isoSpec.viewDepth*plan.layers.length:0;
   const left=100*s,right=W-(tr==='pareto'?90:55)*s-(isoPad?Math.ceil(isoPad*ISO.COS30)+4:0),top=Math.max(80*s,legendY+26*s)+(isoPad?Math.ceil(isoPad*ISO.SIN30):0),bottom=H-labelSpace,pw=right-left,ph=bottom-top,fy=v=>bottom-(v-lo)/(hi-lo)*ph,barWidth=pw/Math.max(categories.length,1)*.66,step=pw/Math.max(categories.length,1),xcat=i=>left+(i+.5)*step;
   let xValues=categories;if(tr==='identity'&&plan.xType!=='category'){xValues=categories.map(x=>plan.xType==='date'?Date.parse(x+'T00:00:00Z'):x);xmin=Math.min(...xValues);xmax=Math.max(...xValues);}
   if(!Number.isFinite(xmax-xmin))throw Object.assign(new Error('Quantitative x span overflow'),{code:'DDN-QC099'});
   const fx=v=>xmax===xmin?left+pw/2:left+(v-xmin)/(xmax-xmin)*pw;
   const xc=x=>tr==='identity'&&plan.xType!=='category'?fx(plan.xType==='date'?Date.parse(x+'T00:00:00Z'):x):xcat(categories.findIndex(z=>JSON.stringify(z)===JSON.stringify(x)));
   for(let i=0;i<=5;i++){const v=lo+(hi-lo)*i/5,y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmt(v),11,400,'end');if(tr==='pareto')body+=text(right+13*s,y+4*s,fmt(i*20)+'%',11);}
   body+=line(left,top,left,bottom,t.ink,1.5)+line(left,tr==='boxplot'?bottom:fy(0),right,tr==='boxplot'?bottom:fy(0),t.ink,1.5)+text(left,30*s,plan.unit||p.y,12,650);
   const bar=(x,w,y0,y1,col,ids,meta={})=>{const yy=Math.min(fy(y0),fy(y1)),hh=Math.abs(fy(y1)-fy(y0)),svg=`<rect x="${f(x)}" y="${f(yy)}" width="${f(w)}" height="${f(hh)}" fill="${col}" stroke="${t.surface}" stroke-width="1"><title>${esc(meta.title||String(y1))}</title></rect>`;return sourceGroup(ids,svg,{x,y:yy,w,h:hh,...meta},p.y);};
   if(tr==='histogram'){
    for(const b of plan.bins){const x=fx(b.a),w=fx(b.b)-x;body+=bar(x+1*s,Math.max(1,w-2*s),0,b.y,colour(0),b.sourceIds,{value:b.y,count:b.count,bin:[b.a,b.b],title:'['+b.a+', '+b.b+(b.b===xmax?']':')')+' · '+b.count+' observations'});if(plan.bins.length<=15)body+=text(x+w/2,Math.max(top+17*s,fy(b.y)-9*s),String(b.count),11,600,'middle');}
    for(let j=0;j<=5;j++){const v=xmin+(xmax-xmin)*j/5;body+=text(fx(v),bottom+28*s,fmt(v),11,400,'middle');}body+=text((left+right)/2,bottom+58*s,plan.xUnit||p.y,12,500,'middle');
   }else if(tr==='boxplot'){
    plan.boxes.forEach((b,i)=>{const x=xcat(i),bw=barWidth*.65,col=colour(i);let svg=line(x,fy(b.low),x,fy(b.high),col,1.8)+line(x-bw/3,fy(b.low),x+bw/3,fy(b.low),col,2)+line(x-bw/3,fy(b.high),x+bw/3,fy(b.high),col,2)+`<rect x="${x-bw/2}" y="${fy(b.q3)}" width="${bw}" height="${Math.max(.6,fy(b.q1)-fy(b.q3))}" fill="${col}" fill-opacity=".3" stroke="${col}"/>`+line(x-bw/2,fy(b.median),x+bw/2,fy(b.median),t.ink,2.3);body+=sourceGroup(b.sourceIds,svg,{x:x-bw/2,y:fy(b.high),w:bw,h:fy(b.low)-fy(b.high),quartiles:[b.q1,b.median,b.q3],whiskers:[b.low,b.high]},p.y);
     b.outliers.forEach(o=>body+=sourceGroup([o.id],`<circle cx="${x}" cy="${fy(o.value)}" r="${4*s}" fill="none" stroke="${col}" stroke-width="1.7"><title>${esc('Outlier '+o.value)}</title></circle>`,{x:x-4*s,y:fy(o.value)-4*s,w:8*s,h:8*s,value:o.value},p.y));body+=text(x,top-17*s,'n = '+b.n,11,500,'middle');});
   }else if(tr==='waterfall'){
    points.forEach((pt,i)=>{const x=xcat(i)-barWidth/2,col=pt.step==='delta'?(pt.y<0?colour(2):colour(1)):colour(0);body+=bar(x,barWidth,pt.start,pt.end,col,pt.sourceIds,{value:pt.y,start:pt.start,end:pt.end,step:pt.step,valueSourceIds:pt.valueSourceIds,title:pt.x+' · '+pt.step+' '+fmt(pt.y)});if(i+1<points.length)body+=line(x+barWidth,fy(pt.end),xcat(i+1)-barWidth/2,fy(pt.end),t.muted,1,'4 3');body+=text(xcat(i),Math.max(top+12*s,Math.min(fy(pt.start),fy(pt.end))-10*s),fmt(pt.y),11,600,'middle');});
   }else if(tr==='pareto'){
    points.forEach((pt,i)=>body+=bar(xcat(i)-barWidth/2,barWidth,0,pt.y,colour(0),pt.sourceIds,{value:pt.y,title:pt.x+' · '+pt.y}));const d=points.map((pt,i)=>(i?'L':'M')+f(xcat(i))+' '+f(fy(pt.cumulative))).join(' ');body+=`<path d="${d}" stroke="${colour(2)}" fill="none" stroke-width="2.5"/>`;points.forEach((pt,i)=>body+=sourceGroup(pt.cumulativeSourceIds,`<circle cx="${xcat(i)}" cy="${fy(pt.cumulative)}" r="${4*s}" fill="${colour(2)}"><title>${fmt(pt.percent)}% cumulative</title></circle>`,{x:xcat(i)-4*s,y:fy(pt.cumulative)-4*s,w:8*s,h:8*s,value:pt.percent,aggregate:true}));body+=text(right,30*s,'Cumulative %',12,600,'end');
   }else {
    const n=plan.series.length;
    if(isoSpec){
     /* B1-036 (D1): bar layers extrude as columns, area layers as ribbons
      * (ddn-iso primitives). Series li sits on its own depth plane — geometry
      * translated by (li·d·cos30°, −li·d·sin30°) — so coincident faces never
      * z-fight. One total painter's order via ISO.paintOrder: plane (back
      * first), then footprint x, then stack level, then source id. */
     const isoPrev=id=>options.noMotion?undefined:options.isoFrom?.depths?.[id],items=[];
     plan.layers.forEach((layer,li)=>{
      const ser=layer.series,col=colour(li),ps=points.filter(pt=>pt.series===ser),o=li*isoSpec.viewDepth,ox=o*ISO.COS30,oy=-o*ISO.SIN30;
      let runs=[],run=[];for(const pt of ps){if(pt.y===null){if(run.length)runs.push(run);run=[];}else run.push(pt);}if(run.length)runs.push(run);
      if(layer.mark==='area')for(const run2 of runs){
       const topPts=run2.map(pt=>[xc(pt.x)+ox,fy(pt.end)+oy]),d=topPts.map((pt,i)=>(i?'L':'M')+f(pt[0])+' '+f(pt[1])).join(''),bottomPath=run2.slice().reverse().map(pt=>'L'+f(xc(pt.x)+ox)+' '+f(fy(pt.start)+oy)).join('');
       let svg=(isoSpec.viewDepth>0?ISO.ribbon(topPts,isoSpec.viewDepth,col,undefined,isoPrev('area:'+ser)):'')+`<path d="${d+bottomPath}Z" fill="${col}" opacity="${plan.arrangement==='overlay'?.15:.36}"/>`+`<path d="${d}" fill="none" stroke="${col}" stroke-width="2.3"${li%3===1?' stroke-dasharray="7 3"':li%3===2?' stroke-dasharray="2 3"':''}/>`;
       svg+=run2.map(pt=>`<circle cx="${f(xc(pt.x)+ox)}" cy="${f(fy(pt.end)+oy)}" r="${4*s}" fill="${col}" stroke="${t.surface}"/>`).join('');
       items.push({x:Math.min(...topPts.map(pt=>pt[0])),y:-o,z:0,id:'area:'+ser+':'+items.length,svg});
      }
      if(layer.mark==='bar')ps.filter(pt=>pt.y!==null).forEach(pt=>{
       let x=xc(pt.x)+ox,w=barWidth;if(plan.arrangement==='group'){w=barWidth/n;x+=-barWidth/2+w*(plan.series.indexOf(ser)+.5);}
       const yy=Math.min(fy(pt.start),fy(pt.end))+oy,hh=Math.abs(fy(pt.end)-fy(pt.start)),bx=x-w/2,dp=isoSpec.depthOf(byId.get(pt.sourceIds[0])),meta={value:pt.y,rawValue:pt.rawY,start:pt.start,end:pt.end,series:ser,synthetic:!!pt.synthetic},title=ser+' / '+pt.x+': '+fmt(pt.rawY);
       const svg=dp>0
        ?sourceGroup(pt.sourceIds,`<title>${esc(title)}</title>`+ISO.column(bx,yy,w,hh,dp,col,t.surface,isoPrev(pt.sourceIds[0])),{x:bx,y:yy-dp*ISO.SIN30,w:w+dp*ISO.COS30,h:hh+dp*ISO.SIN30,...meta,depth:dp},p.y)
        :sourceGroup(pt.sourceIds,`<rect x="${f(bx)}" y="${f(yy)}" width="${f(w)}" height="${f(hh)}" fill="${col}" stroke="${t.surface}" stroke-width="1"><title>${esc(title)}</title></rect>`,{x:bx,y:yy,w,h:hh,...meta},p.y);
       items.push({x:bx,y:-o,z:-yy,id:pt.sourceIds[0],svg});
      });
     });
     body+=ISO.paintOrder(items).map(it=>it.svg).join('');
    }else plan.layers.forEach((layer,li)=>{const ser=layer.series,col=colour(li),ps=points.filter(pt=>pt.series===ser);let runs=[],run=[];for(const pt of ps){if(pt.y===null){if(run.length)runs.push(run);run=[];}else run.push(pt);}if(run.length)runs.push(run);
     if(['line','area'].includes(layer.mark))for(const run of runs){const d=run.map((pt,i)=>(i?'L':'M')+f(xc(pt.x))+' '+f(fy(pt.end))).join(' ');if(layer.mark==='area'){const bottomPath=run.slice().reverse().map(pt=>'L'+f(xc(pt.x))+' '+f(fy(pt.start))).join(' ');body+=`<path d="${d+bottomPath}Z" fill="${col}" opacity="${plan.arrangement==='overlay'?.15:.36}"/>`;}body+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="2.3"${li%3===1?' stroke-dasharray="7 3"':li%3===2?' stroke-dasharray="2 3"':''}/>`;}
     ps.filter(pt=>pt.y!==null).forEach(pt=>{let x=xc(pt.x),w=barWidth;if(layer.mark==='bar'){if(plan.arrangement==='group'){w=barWidth/n;x+=-barWidth/2+w*(plan.series.indexOf(ser)+.5);}body+=bar(x-w/2,w,pt.start,pt.end,col,pt.sourceIds,{value:pt.y,rawValue:pt.rawY,start:pt.start,end:pt.end,series:ser,synthetic:!!pt.synthetic,title:ser+' / '+pt.x+': '+fmt(pt.rawY)});}else body+=sourceGroup(pt.sourceIds,`<circle cx="${f(x)}" cy="${f(fy(pt.end))}" r="${4*s}" fill="${col}" stroke="${t.surface}"><title>${esc(ser+' / '+pt.x+': '+fmt(pt.rawY))}</title></circle>`,{x:x-4*s,y:fy(pt.end)-4*s,w:8*s,h:8*s,value:pt.y,series:ser},p.y);});
    });
    plan.layers.forEach((layer,i)=>{const a=legendSlots[i];body+=line(a.x,a.y,a.x+22*s,a.y,colour(i),3)+text(a.x+29*s,a.y+4*s,layer.series,11);});
    if(plan.target!==undefined)body+=line(left,fy(plan.target),right,fy(plan.target),t.ink,1.6,'6 4')+text(right,fy(plan.target)-8*s,'Target '+fmt(plan.target),11,600,'end');
   }
   if(tr!=='histogram'){
    if(tr==='identity'&&plan.xType!=='category'){for(let j=0;j<=(xmin===xmax?0:5);j++){const v=xmin+(xmax-xmin)*j/5;body+=text(fx(v),bottom+28*s,plan.xType==='date'?new Date(v).toISOString().slice(0,10):fmt(v),11,400,'middle');}}
    else categories.forEach((x,i)=>body+=lines(wrap(String(x),step-10*s,11),xcat(i),bottom+25*s,11,400,'middle'));
   }
   const foot=tr==='histogram'?'Explicit bins · '+plan.intervalPolicy+' · excluded: '+plan.excluded.length:tr==='boxplot'?'Quartiles: linear R7 · whiskers: '+plan.whiskers+' · fence ties included · no significance inference':tr==='waterfall'?'Totals/subtotals are asserted cumulative checkpoints, not extra changes.':tr==='pareto'?'Descending categories · cumulative percentage shares the total-valued left-axis extent.':'Shared y scale · '+plan.arrangement+' · missing series values are never silently inferred.';
   body+=lines(wrap(foot,W-24*s,11),12*s,H-43*s,11)+text(12*s,H-14*s,'Supplied synthetic observations / source-bound marks / finite JavaScript arithmetic, not certified financial computation.',11);
   return {body,W,H};
  }
  const api$1={VERSION:'0.6.0-beta.1',draw,encodedColour};
  publishNamespace('DDNQualityRender',api$1);

  /* SPDX-License-Identifier: GPL-2.0-or-later. ddn-quality bundle entry (B1-019).
   * Guards, fishbone/decision registration composing through ddn-projections.js
   * lazily (DDN-E010 when it is absent), browser globals. */

  const host = globalThis;
  if (!host.DDNLive) throw new Error('ddn-quality requires ddn-core.js to be loaded first');
  if (!host.DDNRender) throw new Error('ddn-quality requires ddn-graph.js to be loaded first');
  if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
  if (!host.DDNQualityRender) {
    host.DDNQualityRender = api$1;
    const Engine = optionalNamespace('DDNEngine'), DDN = optionalNamespace('DDN');
    for (const k of ['fishbone', 'decision']) Engine.registerProjectionRenderer(k, (kind => (ir, reg, g, opts) => {
      const P = optionalNamespace('DDNProjections');
      if (!P) throw new DDN.DDNError('DDN-E010', 'Projection kind "' + kind + '" renders through ddn-projections.js; load it together with ddn-quality.js.');
      return P.render(ir, reg, g, opts);
    })(k));
  }
  const api = host.DDNLive;
  if (typeof module === 'object' && module.exports) module.exports = api;
  const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;

})();
