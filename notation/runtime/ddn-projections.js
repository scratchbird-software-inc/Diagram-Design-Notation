/* SPDX-License-Identifier: GPL-2.0-or-later. Data-bound SVG projections using one shared model and publication contract. */
import {publishNamespace} from './ddn-module-registry.js';
import './ddn-core.js'; // sibling bundle: load order only; the namespace comes from the module registry
import './ddn-projection-data.js'; // sibling bundle: load order only; the namespace comes from the module registry
import './ddn-render.js'; // sibling bundle: load order only; the namespace comes from the module registry
import './ddn-text.js'; // sibling bundle: load order only; the namespace comes from the module registry
import './ddn-palette.js'; // sibling bundle: load order only; the namespace comes from the module registry
import {namespace,optionalNamespace} from './ddn-module-registry.js';
const D=namespace('DDN');
const Data=namespace('DDNProjectionData');
const R=namespace('DDNRender');
const Text=namespace('DDNText');
const Palette=namespace('DDNPalette');
'use strict';
const esc=R.esc,f=n=>Number(n.toFixed(3)),q=D.quantity,clone=x=>JSON.parse(JSON.stringify(x));
function chen(ir,reg,glyphs,options){
 const projected=clone(ir),selected=new Set(ir.view.selected),nodes=ir.elements.filter(n=>selected.has(n.id)),edges=ir.relations.filter(r=>ir.view.relations.includes(r.id));
 if(nodes.some(n=>n.kind!=='entity')||edges.some(r=>!['assoc','ref'].includes(r.kind)||r.from.member||r.to.member))throw new D.DDNError('DDN-PJ050','Chen subset requires entity objects and binary object-level assoc/ref relationships');
 const extended=ir.view.profiles.projection.profile==='chen.binary@2';
 if(!extended&&nodes.some(n=>n.fields.some(f=>f.depth||f.properties.shape&&f.properties.shape!=='scalar')))throw new D.DDNError('DDN-PJ050','Chen scalar subset does not silently flatten nested or repeated fields');
 const out=[],rels=[],mapping=[];
 function node(source,kind,name){const k=D.kindEntry(reg,kind),n={...clone(source),name,kind,kindCode:k.code,fields:[],ports:[],type:'object'};out.push(n);mapping.push({occurrence:n.id,source:source.id});return n;}
 function connect(id,a,b,source,label='',double=false){rels.push({id,ref:id,name:label,kind:'assoc',kindCode:'ASSOC',from:{element:a},to:{element:b},properties:{x_chen_total:double},_visualLabel:!!label});mapping.push({occurrence:id,source});}
 for(const n of nodes){node(n,'chen.entity',n.name);for(const fld of n.fields){const a=node({...fld,ref:fld.id,local:fld.local,properties:fld.properties},'chen.attribute',fld.name);connect('occ:attribute:'+fld.id,extended&&fld.parent?fld.parent:n.id,a.id,fld.id);}}
 for(const r of edges){const x=extended?r.properties.x_chen||{}:{};node({...r,properties:{x_chen:{identifying:!!x.identifying}},local:r.id,ref:r.id},'chen.association',r.name);const label=m=>m?'('+m.min+'..'+(m.max==='many'?'N':m.max)+')':'';connect('occ:from:'+r.id,r.from.element,r.id,r.id,label(x.from),extended&&x.identifying&&x.weak?.$ref===r.from.element);connect('occ:to:'+r.id,r.id,r.to.element,r.id,label(x.to),extended&&x.identifying&&x.weak?.$ref===r.to.element);}
 projected.elements=out;projected.relations=rels;projected.view.selected=out.map(n=>n.id);projected.view.relations=rels.map(r=>r.id);projected.view.keys={};projected.view.profiles.projection={kind:'graph',profile:'ddn@1'};projected.view.profiles.legend={...projected.view.profiles.legend,mode:'text',placement:'none'};
 const result=R.render(projected,reg,glyphs,options);result.scene.projection={kind:'chen',profile:ir.view.profiles.projection.profile,mapping};result._ir=ir;result.diagnostics.push({code:'DDN-PJW01',severity:'info',message:(extended?'Extended binary Chen; ':'Chen scalar/binary subset; ')+ ' attribute and relationship occurrences are projections, not copied semantic entities.'});return result;
}
function render(ir,reg,glyphs='',options={}){
 const plan=Data.plan(ir,D.DDNError),p=ir.view.profiles,pr=p.projection;
 if(plan.kind==='chen')return chen(ir,reg,glyphs,options);
 if(plan.kind==='graph')return R.render(ir,reg,glyphs,options);
 if(options.layoutState)throw new D.DDNError('DDN-PJ051','Retained graph positions cannot override data-bound projection coordinates');
 const t=Palette.themes[p.style.theme],s=q(p.style.font_size,16)/16,stats=Text.stats(),marks=[],diagnostics=[...ir.diagnostics],numbers=[],S=24*s;
 const markType=plan.kind==='chart'?({pie:'arc',donut:'arc'}[plan.mark]||plan.mark||'chart'):plan.kind;
 let body='',W=q(pr.width,1050),H=500,smallest=11*s;
 const text=(x,y,value,size=13,weight=400,anchor='start',extra='')=>{const txt=String(value??'');Text.measure(txt,size*s,p.style.font,weight);smallest=Math.min(smallest,size*s);return `<text x="${f(x)}" y="${f(y)}" font-size="${size*s}" fill="${t.ink}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${esc(txt)}</text>`;};
 const lines=(ls,x,y,size=13,weight=400,anchor='start')=>ls.map((v,i)=>text(x,y+i*(size+6)*s,v,size,weight,anchor)).join('');
 const wrap=(str,w,size=13,weight=400)=>Text.wrap(str,w,size*s,p.style.font,weight);
 const line=(x,y,xx,yy,colour=t.rule,width=1,dash='')=>`<path d="M${f(x)} ${f(y)}L${f(xx)} ${f(yy)}" stroke="${colour}" stroke-width="${width}" fill="none"${dash?` stroke-dasharray="${dash}"`:''}/>`;
 const rect=(x,y,w,h,fill=t.surface,stroke=t.rule,semantic=false)=>R.rect(x,y,w,h,stroke,fill,semantic?'classic':p.style.look,ir.view.id+':'+x+':'+y,0,{...p.style,hachure:false});
 const group=(id,ids,content,box={},key)=>{const mid='mark:'+ir.view.id+':'+marks.length;marks.push({id:mid,sourceIds:ids,...box,...(key?{property:key}:{})});return `<g class="${R.cls('ddn-mark','ddn-mark-'+markType)}" data-id="${esc(id||ids[0]||'')}" data-source-ids="${esc(JSON.stringify(ids))}" data-projection-mark="${esc(mid)}"${box.rowId?` data-matrix-row="${esc(box.rowId)}" data-matrix-column="${esc(box.columnId)}"`:''}${key?` data-property="${esc(key)}"`:''} tabindex="0" role="group">${content}</g>`;};
 const colours=['#337DB7','#34976E','#AC6538','#8259B1','#967421','#347D8E','#AC5573'];
 const colour=i=>Palette.semantic(colours[i%colours.length],t);
 let composedSubs=[];
 const QR=optionalNamespace('DDNQualityRender');
 if((plan.quality||plan.kind==='fishbone'||plan.kind==='decision')&&!QR)throw new D.DDNError('DDN-E010','Projection '+plan.profile+' is provided by ddn-quality.js; load it after ddn-core.js and ddn-graph.js.');
 const qualityBody=QR?QR.draw(plan,ir,{text,lines,wrap,line,rect,group,colour,s,theme:t,W,H:q(pr.height,600*s)}):null;
 if(qualityBody){body=qualityBody.body;W=qualityBody.W;H=qualityBody.H;}
 if(plan.kind==='matrix'&&!qualityBody){
  const rowW=Math.max(230*s,Math.min(390*s,Math.max(...plan.rows.map(n=>Text.measure(n.name,13*s,p.style.font,600).width))+32*s)),cw=Math.max(130*s,(W-rowW)/plan.columns.length);W=rowW+cw*plan.columns.length;
  const heads=plan.columns.map(n=>wrap(n.name,cw-24*s,13,600)),hh=Math.max(75*s,(Math.max(...heads.map(x=>x.length))*19+30)*s);let y=hh;
  body+=rect(0,0,W,hh)+text(16*s,28*s,pr.profile==='matrix.raci@1'?'ACTIVITY / RESPONSIBILITY':pr.profile==='matrix.crud@1'?'PROCESS / DATA ACCESS':pr.profile==='matrix.bcg@1'?'GROWTH / SHARE MATRIX':pr.profile==='matrix.ansoff@1'?'PRODUCT / MARKET MATRIX':pr.profile==='matrix.tows@1'?'TOWS STRATEGY MATRIX':pr.profile==='matrix.storymap@1'?'RELEASE / BACKBONE STORY MAP':'RELATIONSHIP MATRIX',11,650);
  for(let j=0;j<plan.columns.length;j++){body+=line(rowW+j*cw,0,rowW+j*cw,hh);body+=group(plan.columns[j].id,[plan.columns[j].id],lines(heads[j],rowW+j*cw+12*s,28*s,13,600),{x:rowW+j*cw,y:0,w:cw,h:hh});}
  for(let i=0;i<plan.rows.length;i++){const label=wrap(plan.rows[i].name,rowW-28*s),cellLines=plan.cells[i].map(c=>wrap(c.map(a=>a.value).join(' / ')||'—',cw-24*s,pr.profile==='matrix.relations@1'?13:17,650)),rh=Math.max(62*s,(Math.max(label.length,...cellLines.map(a=>a.length))*23+25)*s);body+=rect(0,y,W,rh,i%2?t.background:t.surface);body+=group(plan.rows[i].id,[plan.rows[i].id],lines(label,14*s,y+25*s),{x:0,y,w:rowW,h:rh});
   for(let j=0;j<plan.columns.length;j++){body+=line(rowW+j*cw,y,rowW+j*cw,y+rh);const c=plan.cells[i][j],v=c.map(a=>a.value).join(' / ')||'—',ids=c.map(a=>a.id),x=rowW+j*cw;body+=group(ids[0]||plan.rows[i].id,ids,`<rect x="${x}" y="${y}" width="${cw}" height="${rh}" fill="transparent" pointer-events="all"/>`+lines(cellLines[j],x+cw/2,y+(rh-(cellLines[j].length-1)*23*s)/2+5*s,pr.profile==='matrix.relations@1'?13:17,650,'middle'),{x,y,w:cw,h:rh,rowId:plan.rows[i].id,columnId:plan.columns[j].id,relationKind:pr.relation},pr.value);}
   y+=rh;
  }H=y+52*s;body+=text(0,H-15*s,pr.profile==='matrix.raci@1'?'R responsible · A accountable · C consulted · I informed. One A and at least one R per row.':pr.profile==='matrix.crud@1'?'C create · R read · U update · D delete. Cells are shared relationship records.':pr.profile==='matrix.bcg@1'?'Rows: market growth (high/low) · Columns: relative share (high/low) · Cells are declared items, not computed positions.':pr.profile==='matrix.ansoff@1'?'Rows: markets · Columns: products (existing/new) · Cells are declared strategy items.':pr.profile==='matrix.tows@1'?'Rows: internal S/W · Columns: external O/T · Cells are declared strategy notes.':pr.profile==='matrix.storymap@1'?'Rows are releases (top ships first) · columns are backbone activities · cells are declared analysis.task stories.':'Cells derive from declared relationships; an empty cell is not an invented relation.',11);
 }
 if(plan.kind==='table'){
  const cols=plan.columns.length,cw=Math.max(140*s,W/cols);W=cw*cols;const hs=plan.columns.map(c=>wrap(c.label,cw-24*s,12,650)),hh=(Math.max(...hs.map(a=>a.length))*18+28)*s;let y=hh;body+=rect(0,0,W,hh);
  for(let j=0;j<cols;j++)body+=lines(hs[j],j*cw+12*s,25*s,12,650)+line(j*cw,0,j*cw,hh);
  for(let i=0;i<plan.rows.length;i++){const cs=plan.rows[i].map(c=>wrap(c,cw-24*s)),rh=Math.max(54*s,(Math.max(...cs.map(a=>a.length))*19+22)*s);body+=rect(0,y,W,rh,i%2?t.background:t.surface);
   for(let j=0;j<cols;j++)body+=line(j*cw,y,j*cw,y+rh)+group(plan.records[i].id,[plan.records[i].id],lines(cs[j],j*cw+12*s,y+24*s),{x:j*cw,y,w:cw,h:rh},plan.columns[j].key);y+=rh;
  }H=y+38*s;body+=text(0,H-9*s,'Source-bound table · no expression or decision-rule execution is implied.',11);
 }
 if(plan.kind==='panels'&&plan.profile==='panels.venn@1'&&!plan.panels.some(v=>v.child)){
  W=Math.max(W,640*s);H=Math.max(q(pr.height,600*s),440*s);
  const sets=plan.venn.sets,N=sets.length,cx=W/2,cy=H/2+10*s,r=Math.min(W,H)*0.3,G=[cx,cy];
  let C;
  if(N===2)C=[[cx-r/2,cy],[cx+r/2,cy]];
  else{const d=3*r/5,k=0.866*d;C=[[cx-k,cy-0.5*d],[cx+k,cy-0.5*d],[cx,cy+d]];}
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),idx=id=>sets.findIndex(v=>v.id===id);
  for(let i=0;i<N;i++)body+=group(sets[i].id,plan.panels[i].items.map(it=>it.node.id),`<circle cx="${f(C[i][0])}" cy="${f(C[i][1])}" r="${f(r)}" fill="${colour(i)}" fill-opacity=".16" stroke="${colour(i)}" stroke-width="1.8"/>`,{x:C[i][0]-r,y:C[i][1]-r,w:2*r,h:2*r});
  for(let i=0;i<N;i++){const d=dist(C[i],G),L=[C[i][0]+(C[i][0]-G[0])*(r+18*s)/d,C[i][1]+(C[i][1]-G[1])*(r+18*s)/d];
   body+=group(sets[i].id,[sets[i].id],text(L[0],L[1],sets[i].title,13,700,'middle'),{x:L[0]-60*s,y:L[1]-10*s,w:120*s,h:20*s});}
  const keys=[];const combs=(k,start,cur)=>{if(cur.length===k){keys.push([...cur].sort().join('+'));return;}for(let j=start;j<N;j++)combs(k,j+1,[...cur,sets[j].id]);};
  for(let k=1;k<=N;k++)combs(k,0,[]);
  for(const key of keys){const rg=plan.venn.regions[key],parts=key.split('+');let L;
   if(parts.length===1){const i=idx(parts[0]),d=dist(C[i],G);L=[C[i][0]+(C[i][0]-G[0])*(0.62*r)/d,C[i][1]+(C[i][1]-G[1])*(0.62*r)/d];}
   else if(parts.length===2){const i=idx(parts[0]),j=idx(parts[1]),M=[(C[i][0]+C[j][0])/2,(C[i][1]+C[j][1])/2];L=[M[0]+(M[0]-G[0])*0.8,M[1]+(M[1]-G[1])*0.8];}
   else L=G;
   body+=group(key,rg.ids,text(L[0],L[1],rg.count,16,700,'middle'),{x:L[0]-14*s,y:L[1]-10*s,w:28*s,h:20*s},'x_sets');}
 }else if(plan.kind==='panels'&&plan.profile==='panels.pyramid@1'&&!plan.panels.some(v=>v.child)){
  W=Math.max(W,560*s);const bandH=150*s,gap=10*s,cx=W/2,bands=[...plan.panels].sort((a,b)=>a.row-b.row),n=bands.length,widthAt=k=>W*(k+1)/(n+1);
  for(let i=0;i<n;i++){const bandStart=body.length,band=bands[i],tw=widthAt(i),bw=widthAt(i+1),y=i*(bandH+gap);
   const poly=`<polygon points="${f(cx-tw/2)} ${f(y)} ${f(cx+tw/2)} ${f(y)} ${f(cx+bw/2)} ${f(y+bandH)} ${f(cx-bw/2)} ${f(y+bandH)}" fill="${colour(i)}" fill-opacity=".18" stroke="${colour(i)}" stroke-width="1.6"/>`;
   body+=group(band.id,[band.id],poly+lines(wrap(band.title,Math.max(tw,60*s),13,700),cx,y+bandH/2,13,700,'middle'),{x:cx-tw/2,y:y,w:tw,h:bandH});
   let ay=y+26*s;
   for(const it of band.items){const block=wrap(it.node.name+': '+it.text,240*s,11);body+=group(it.node.id,[it.node.id],lines(block,cx+bw/2+18*s,ay,11),{x:cx+bw/2+18*s,y:ay-11*s,w:240*s,h:(block.length*17+10)*s});ay+=(block.length*17+10)*s;}
   body=body.slice(0,bandStart)+`<g class="ddn-panel" data-panel="${esc(band.id)}">`+body.slice(bandStart)+'</g>';
  }
  H=n*(bandH+gap)+40*s;
 }else if(plan.kind==='panels'&&!plan.panels.some(v=>v.child)){
  const gap=22*s,cw=Math.max(230*s,(W-gap*(plan.columns-1))/plan.columns);W=cw*plan.columns+gap*(plan.columns-1);
  let rowCount=Math.max(...plan.panels.map(p=>p.row+p.rowspan)),heights=Array(rowCount).fill(160*s);
  const measured=plan.panels.map(panel=>{const width=cw*panel.colspan+gap*(panel.colspan-1),items=panel.items.map(i=>({item:i,label:wrap(i.node.name,width-36*s,14,650),content:wrap(i.text,width-36*s,12)}));const title=wrap(panel.title,width-32*s,14,700),titleHeight=(title.length*20+24)*s;const needed=titleHeight+20*s+items.reduce((h,i)=>h+(i.label.length*20+i.content.length*18+25)*s,0);return{panel,width,items,needed,title,titleHeight};});
  for(const m of measured.sort((a,b)=>a.panel.rowspan-b.panel.rowspan)){const available=heights.slice(m.panel.row,m.panel.row+m.panel.rowspan).reduce((a,b)=>a+b,0)+gap*(m.panel.rowspan-1);if(available<m.needed){const delta=(m.needed-available)/m.panel.rowspan;for(let r=m.panel.row;r<m.panel.row+m.panel.rowspan;r++)heights[r]+=delta;}}
  const tops=[0];heights.forEach(h=>tops.push(tops.at(-1)+h+gap));
  for(const m of measured){const panelStart=body.length,{panel,width,items,title,titleHeight}=m,x=panel.column*(cw+gap),y=tops[panel.row],height=heights.slice(panel.row,panel.row+panel.rowspan).reduce((a,b)=>a+b,0)+gap*(panel.rowspan-1);body+=rect(x,y,width,height)+lines(title,x+16*s,y+28*s,14,700)+line(x,y+titleHeight,x+width,y+titleHeight);
   if(plan.profile==='panels.journey@1'&&panel.id==='emotions'){
    const top=y+titleHeight+34*s,bottom=y+height-30*s,px=i=>x+i*(cw+gap)+cw/2,py=v=>bottom-(v-1)/4*(bottom-top);
    for(let v=1;v<=5;v++)body+=line(x+8*s,py(v),x+width-8*s,py(v))+text(x+14*s,py(v)-4*s,String(v),10);
    const pts=panel.emotionPoints;
    body+=`<path d="${pts.map((pt,i)=>(i?'L':'M')+f(px(pt.col))+' '+f(py(pt.value))).join('')}" stroke="${colour(0)}" stroke-width="2.5" fill="none"/>`;
    for(const pt of pts)body+=group(pt.nodeId,[pt.nodeId],`<circle cx="${f(px(pt.col))}" cy="${f(py(pt.value))}" r="${f(5*s)}" fill="${colour(0)}"/>`+text(px(pt.col),py(pt.value)-12*s,String(pt.value),12,700,'middle'),{x:px(pt.col)-8*s,y:py(pt.value)-8*s,w:16*s,h:16*s},'x_record.value');
   }else{let yy=y+titleHeight+28*s;
   for(const i of items){const h=(i.label.length*20+i.content.length*18+25)*s;body+=group(i.item.node.id,[i.item.node.id],lines(i.label,x+16*s,yy,14,650)+lines(i.content,x+16*s,yy+i.label.length*20*s+6*s,12),{x:x+12*s,y:yy-20*s,w:width-24*s,h});yy+=h;}}
   body=body.slice(0,panelStart)+`<g class="ddn-panel" data-panel="${esc(m.panel.id)}">`+body.slice(panelStart)+'</g>'; }
  H=tops.at(-1)-gap+32*s;
 }
 const fmtNumber=n=>n!==0&&(Math.abs(n)>=1e9||Math.abs(n)<.01)?n.toExponential(3):new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(n);
 if(plan.kind==='chart'&&!qualityBody){
  H=Math.max(q(pr.height,600*s),340*s);W=Math.max(W,650*s);const pts=plan.points,left=100*s,top=35*s,bottom=H-115*s,right=W-55*s,plotH=bottom-top,plotW=right-left;
  if(['pie','donut'].includes(plan.mark)){
   const radius=Math.min((H-85*s)/2,W*.24),cx=radius+50*s,cy=radius+35*s,inner=plan.mark==='donut'?radius*(pr.inner_radius??.56):0,total=pts.reduce((s,p)=>s+p.y,0);let angle=-Math.PI/2,ly=50*s;
   for(let i=0;i<pts.length;i++){const pt=pts[i],span=pt.y/total*2*Math.PI,end=angle+span,col=colour(i);let d='';const xy=(a,r)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
    if(span>0){const slices=span>=Math.PI*2-.000001?2:1,step=span/slices;let start=xy(angle,radius);d=`M${f(start[0])} ${f(start[1])}`;for(let z=1;z<=slices;z++){const b=xy(angle+step*z,radius);d+=`A${radius} ${radius} 0 ${step>Math.PI?1:0} 1 ${f(b[0])} ${f(b[1])}`;}
     if(inner){const b=xy(end,inner);d+=`L${f(b[0])} ${f(b[1])}`;for(let z=1;z<=slices;z++){const b=xy(end-step*z,inner);d+=`A${inner} ${inner} 0 ${step>Math.PI?1:0} 0 ${f(b[0])} ${f(b[1])}`;}}else d+=`L${cx} ${cy}`;d+='Z';
     body+=group(pt.sourceIds[0],pt.sourceIds,`<title>${esc(pt.rawX+': '+fmtNumber(pt.y)+' '+plan.unit)}</title><path data-value="${pt.y}" d="${d}" fill="${col}" stroke="${t.surface}" stroke-width="2"/>`,{cx,cy,radius,startAngle:angle,endAngle:end,value:pt.y},pr.y);}
    const xx=2*radius+100*s,label=wrap(pt.rawX+': '+fmtNumber(pt.y)+' '+plan.unit,W-xx-35*s,12);body+=`<rect x="${xx}" y="${ly-12*s}" width="${14*s}" height="${14*s}" fill="${col}"/>`+lines(label,xx+24*s,ly,12);ly+=Math.max(35*s,label.length*18*s+12*s);angle=end;
   }H=Math.max(H,ly+40*s);body+=text(20*s,H-20*s,'Total '+fmtNumber(total)+' '+plan.unit+' · angles encode values; zero entries have no sector.',11);
  }else if(plan.mark==='treemap'){
   const tiles=plan.tiles,gap=4*s,headH=22*s,tx=left+10*s,ty=top+5*s,tw=W-left-20*s,th=bottom-ty-40*s,total=tiles.reduce((s,n)=>s+n.value,0)||1,groupLeaf=[];let leafCount=0;
   function tileLayout(nodes,x,y,w,h,depth){
    const sum=nodes.reduce((s,n)=>s+n.value,0)||1,vertical=depth%2===0;let off=0;
    for(const n of nodes){const share=n.value/sum,cw=vertical?w*share:w,ch=vertical?h:h*share,cx=x+(vertical?off:0),cy=y+(vertical?0:off);n.box={x:cx,y:cy,w:cw,h:ch};off+=vertical?cw:ch;
     if(!n.leaf)tileLayout(n.children,cx,cy+headH,cw,Math.max(0,ch-headH),depth+1);}
   }
   tileLayout(tiles,tx,ty,tw,th,0);
   function drawGroup(n,gi){
    const b=n.box,ix=b.x+2*s,iy=b.y+2*s,iw=Math.max(0,b.w-4*s),ih=Math.max(0,b.h-4*s);
    body+=`<rect class="ddn-treemap-group" data-path="${esc(n.path)}" x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" fill="transparent" stroke="${t.rule}" stroke-width="1"/>`;
    body+=`<rect class="ddn-treemap-header" data-path="${esc(n.path)}" x="${f(ix)}" y="${f(iy)}" width="${f(iw)}" height="${f(headH-4*s)}" fill="${t.surface}" stroke="${t.rule}" stroke-width="1"/>`;
    body+=text(ix+8*s,iy+headH-8*s,n.name+' · '+fmtNumber(n.value)+' '+plan.unit,12,650);
    for(const c of n.children)if(c.leaf)drawLeaf(c,gi);else drawGroup(c,gi);
   }
   function drawLeaf(n,gi){
    const b=n.box,i=(groupLeaf[gi]||0);groupLeaf[gi]=i+1;leafCount++;const col=colour(gi+i),label=n.name+': '+fmtNumber(n.value)+' '+plan.unit,ix=b.x+2*s,iy=b.y+2*s,iw=Math.max(0,b.w-4*s),ih=Math.max(0,b.h-4*s);
    let content=`<title>${esc(n.path+': '+fmtNumber(n.value)+' '+plan.unit)}</title><rect data-value="${n.value}" x="${f(ix)}" y="${f(iy)}" width="${f(iw)}" height="${f(ih)}" fill="${col}" stroke="${t.surface}" stroke-width="2"/>`;
    const fitted=wrap(label,iw-16*s,12);
    if(ih>=(fitted.length*15+10)*s&&fitted.every(v=>Text.measure(v,12*s,p.style.font,400).width<=iw-16*s))content+=lines(fitted,ix+8*s,iy+18*s,12,400);
    body+=group(n.sourceIds[0],n.sourceIds,content,{x:b.x,y:b.y,w:b.w,h:b.h,value:n.value,path:n.path},pr.y);
   }
   tiles.forEach((n,gi)=>{if(n.leaf)drawLeaf(n,gi);else drawGroup(n,gi);});
   body+=text(20*s,H-15*s,leafCount+' tiles · total '+fmtNumber(total)+' '+plan.unit+' · tile area encodes one value per record; slice-and-dice layout in declaration order; dotted paths nest tiles.',11);
  }else if(plan.mark==='sankey'){
   const flow=plan.flow,maxDepth=Math.max(...flow.nodes.map(n=>n.depth)),nodeW=14*s,gap=12*s,sPlotW=plotW-170*s,cx=d=>left+d*(sPlotW/Math.max(1,maxDepth));
   const flowOf=i=>Math.max(flow.links.filter(l=>l.source===i).reduce((a,l)=>a+l.value,0),flow.links.filter(l=>l.target===i).reduce((a,l)=>a+l.value,0));
   const rawMax=Math.max(...[...new Set(flow.nodes.map(n=>n.depth))].map(d=>{const col=flow.nodes.map((n,i)=>[n,i]).filter(([n])=>n.depth===d);return col.reduce((a,[n,i])=>a+flowOf(i),0)+gap*(col.length-1);}));
   const k=plotH/rawMax,pos=[];
   for(let d=0;d<=maxDepth;d++){let y=top+(plotH-(flow.nodes.map((n,i)=>[n,i]).filter(([n])=>n.depth===d).reduce((a,[n,i])=>a+flowOf(i)*k+gap,0)-gap))/2;
    for(const [n,i] of flow.nodes.map((n,i)=>[n,i]).filter(([n])=>n.depth===d)){pos[i]={x:cx(d),y,w:nodeW,h:flowOf(i)*k};y+=flowOf(i)*k+gap;}}
   const usedOut=flow.nodes.map(()=>0),usedIn=flow.nodes.map(()=>0);
   flow.links.forEach((l,li)=>{
    const a=pos[l.source],b=pos[l.target],th=l.value*k,x0=a.x+a.w,x1=b.x,y0=a.y+usedOut[l.source],y1=b.y+usedIn[l.target],mx=(x0+x1)/2;usedOut[l.source]+=th;usedIn[l.target]+=th;
    const d=`M${f(x0)} ${f(y0)}C${f(mx)} ${f(y0)} ${f(mx)} ${f(y1)} ${f(x1)} ${f(y1)}L${f(x1)} ${f(y1+th)}C${f(mx)} ${f(y1+th)} ${f(mx)} ${f(y0+th)} ${f(x0)} ${f(y0+th)}Z`;
    body+=group(l.sourceIds[0],l.sourceIds,`<title>${esc(flow.nodes[l.source].name+' → '+flow.nodes[l.target].name+': '+fmtNumber(l.value)+' '+plan.unit)}</title><path class="ddn-sankey-ribbon" data-value="${l.value}" d="${d}" fill="${colour(li)}" fill-opacity=".25" stroke="${colour(li)}" stroke-opacity=".6"/>`,{x:x0,y:Math.min(y0,y1),w:x1-x0,h:th,value:l.value},pr.y);
   });
   flow.nodes.forEach((n,i)=>{
    const b=pos[i],total=flowOf(i);
    body+=group(n.sourceIds[0],n.sourceIds,`<title>${esc(n.name+': '+fmtNumber(total)+' '+plan.unit)}</title><rect class="ddn-sankey-node" data-depth="${n.depth}" x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" fill="${t.ink}" fill-opacity=".8"/>`,{x:b.x,y:b.y,w:b.w,h:b.h,depth:n.depth});
    body+=text(n.depth===maxDepth?b.x+b.w+8*s:b.x-8*s,b.y+b.h/2+4*s,n.name+' · '+fmtNumber(total)+' '+plan.unit,12,600,n.depth===maxDepth?'start':'end');
   });
   body+=text(left,H-15*s,flow.nodes.length+' nodes · '+flow.links.length+' flows · '+(maxDepth+1)+' depth columns from pure sources · ribbon thickness encodes '+plan.unit+' value; duplicate source→target pairs stack in declaration order.',11);
  }else if(plan.mark==='funnel'){
   const N=pts.length,maxY=Math.max(...pts.map(p=>p.y))||1,bandH=plotH/N,cx=left+plotW/2,total=pts.reduce((s,p)=>s+p.y,0);
   for(let i=0;i<N;i++){const pt=pts[i],y=top+i*bandH,topW=plotW*pt.y/maxY,bottomW=i<N-1?plotW*pts[i+1].y/maxY:Math.max(24*s,topW*.35),col=colour(i);
    const d=`M${f(cx-topW/2)} ${f(y)}L${f(cx+topW/2)} ${f(y)}L${f(cx+bottomW/2)} ${f(y+bandH)}L${f(cx-bottomW/2)} ${f(y+bandH)}Z`;
    body+=group(pt.sourceIds[0],pt.sourceIds,`<title>${esc(String(pt.rawX)+': '+fmtNumber(pt.y)+' '+plan.unit)}</title><path data-value="${pt.y}" d="${d}" fill="${col}" stroke="${t.surface}" stroke-width="2"/>`,{x:cx-topW/2,y,w:topW,h:bandH,value:pt.y},pr.y);
    const label=String(pt.rawX)+': '+fmtNumber(pt.y)+' '+plan.unit;
    if(Text.measure(label,12*s,p.style.font,400).width<=topW-24*s)body+=text(cx,y+bandH/2+4*s,label,12,400,'middle');
    else body+=lines(wrap(label,W-(cx+Math.max(topW,bottomW)/2+12*s)-20*s,12),cx+Math.max(topW,bottomW)/2+12*s,y+bandH/2+4*s,12);
   }
   body+=text(left,H-15*s,N+' stages · total '+fmtNumber(total)+' '+plan.unit+' · band widths encode one value per stage in declaration order; conversion rates are not computed.',11);
  }else if(plan.mark==='radar'){
   const cats=plan.categories,N=cats.length,max=Math.max(0,...pts.map(p=>p.y))||1,labelPad=52*s,radius=Math.max(50*s,Math.min(plotW,plotH)/2-labelPad),cx=left+plotW/2,cy=top+plotH/2,vertex=(i,r)=>[cx+Math.cos(-Math.PI/2+i*2*Math.PI/N)*r,cy+Math.sin(-Math.PI/2+i*2*Math.PI/N)*r];
   const ringPts=k=>cats.map((_,i)=>vertex(i,radius*k).map(f).join(' ')).join(' ');
   for(const k of [.25,.5,.75,1])body+=`<polygon class="ddn-radar-ring" points="${ringPts(k)}" fill="none" stroke="${t.rule}" stroke-width="1"/>`;
   cats.forEach((c,i)=>{const[x,y]=vertex(i,radius);body+=`<path class="ddn-radar-spoke" d="M${f(cx)} ${f(cy)}L${f(x)} ${f(y)}" stroke="${t.rule}" stroke-width="1" fill="none"/>`;const[lx,ly]=vertex(i,radius+20*s);body+=lines(wrap(String(c),2*labelPad,11,600),lx,ly+4*s,11,600,'middle');});
   plan.series.forEach((ser,si)=>{const col=colour(si),vs=[];cats.forEach((c,i)=>{const pt=pts.find(p=>p.series===ser&&JSON.stringify(p.x)===JSON.stringify(c));if(pt)vs.push({pt,xy:vertex(i,radius*pt.y/max)});});
    const ids=vs.flatMap(v=>v.pt.sourceIds),d=vs.map(v=>v.xy.map(f).join(' ')).join(' ');
    body+=group(ids[0]||ser,ids,`<title>${esc(ser+': '+vs.map(v=>String(v.pt.rawX)+' '+fmtNumber(v.pt.y)).join(', ')+' '+plan.unit)}</title><polygon class="ddn-radar-series" data-series="${esc(ser)}" points="${d}" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-width="2.5"/>`,{x:cx-radius,y:cy-radius,w:radius*2,h:radius*2,series:ser},pr.y);});
   let lx=left,ly=26*s;plan.series.forEach((ser,i)=>{const w=Math.min(plotW,Math.max(110*s,String(ser).length*8*s+50*s));if(lx+w>right){lx=left;ly+=24*s;}body+=line(lx,ly,lx+22*s,ly,colour(i),3)+text(lx+29*s,ly+4*s,ser,11);lx+=w;});
   body+=text(left,H-15*s,'Source-bound radar · one shared 0…'+fmtNumber(max)+' '+(plan.unit||pr.y)+' scale over all spokes · '+N+' categories · per-axis normalization is not applied.',11);
  }else if(plan.mark==='gauge'){
   const pt=pts[0],pad=46*s,radius=Math.max(60*s,Math.min(plotW/2-pad,plotH-60*s)),bandW=radius*.22,rin=radius-bandW,cx=left+plotW/2,cy=top+20*s+radius,sa=v=>Math.PI*(1+v/100),ang=v=>Math.PI*(1-v/100),xy=(a,r)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
   for(let k=0;k<4;k++){const a0=sa(k*25),a1=sa((k+1)*25),[ox0,oy0]=xy(a0,radius),[ox1,oy1]=xy(a1,radius),[ix1,iy1]=xy(a1,rin),[ix0,iy0]=xy(a0,rin);
    body+=`<path class="ddn-gauge-band" data-band="${k}" d="M${f(ox0)} ${f(oy0)}A${f(radius)} ${f(radius)} 0 0 1 ${f(ox1)} ${f(oy1)}L${f(ix1)} ${f(iy1)}A${f(rin)} ${f(rin)} 0 0 0 ${f(ix0)} ${f(iy0)}Z" fill="${colour(k)}" fill-opacity=".85" stroke="${t.surface}" stroke-width="2"/>`;}
   for(let v=0;v<=100;v+=25){const[lx,ly]=xy(sa(v),radius+20*s);body+=text(lx,ly+4*s,v,11,400,'middle');}
   const angle=ang(pt.y),na=sa(pt.y),nl=rin-10*s,[nx,ny]=xy(na,nl);
   body+=group(pt.sourceIds[0],pt.sourceIds,`<title>${esc(String(pt.rawX)+': '+fmtNumber(pt.y)+'%'+(plan.unit?' '+plan.unit:''))}</title><path class="ddn-gauge-needle" data-value="${pt.y}" d="M${f(cx)} ${f(cy)}L${f(nx)} ${f(ny)}" stroke="${t.ink}" stroke-width="3" fill="none"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(5*s)}" fill="${t.ink}"/>`,{cx,cy,radius,angle,value:pt.y},pr.y);
   if(plan.target!==undefined){const ta=sa(plan.target),[tx0,ty0]=xy(ta,radius+2*s),[tx1,ty1]=xy(ta,radius+16*s);body+=`<path class="ddn-gauge-target" data-target="${plan.target}" d="M${f(tx0)} ${f(ty0)}L${f(tx1)} ${f(ty1)}" stroke="${t.ink}" stroke-width="3" fill="none"/>`;}
   body+=text(cx,cy-radius*.32,fmtNumber(pt.y)+'%'+(plan.unit&&plan.unit!=='%'?' '+plan.unit:''),22,650,'middle');
   body+=lines(wrap(String(pt.rawX),plotW-2*pad,13,600),cx,cy+34*s,13,600,'middle');
   body+=text(left,H-15*s,'Source-bound gauge/KPI dial · semicircular 0…100 '+(plan.unit||'%')+' scale · 4 equal bands'+(plan.target!==undefined?' · target tick at '+fmtNumber(plan.target):'')+' · supplied value, not a computed score.',11);
  }else if(plan.mark==='candlestick'){
   const lo=Math.min(...pts.map(p=>p.low)),hi0=Math.max(...pts.map(p=>p.high)),hi=hi0===lo?lo+1:hi0,fy=n=>bottom-(n-lo)/(hi-lo)*plotH,fx=i=>left+(i+.5)*plotW/pts.length,bw=Math.max(2,plotW/pts.length*.5);
   for(let j=0;j<=5;j++){const v=lo+(hi-lo)*(j/5),y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(v),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+text(left,top-14*s,plan.unit||'value',12,650);
   for(let i=0;i<pts.length;i++){const pt=pts[i],cx=fx(i),up=pt.close>=pt.open,col=up?colour(1):colour(2),wickTop=fy(pt.high),wickBottom=fy(pt.low),bodyTop=fy(Math.max(pt.open,pt.close)),bodyBottom=fy(Math.min(pt.open,pt.close));
    const content=`<title>${esc(String(pt.rawX)+': O '+fmtNumber(pt.open)+' H '+fmtNumber(pt.high)+' L '+fmtNumber(pt.low)+' C '+fmtNumber(pt.close)+(plan.unit?' '+plan.unit:''))}</title><path class="ddn-candle-wick" data-high="${pt.high}" data-low="${pt.low}" d="M${f(cx)} ${f(wickTop)}L${f(cx)} ${f(wickBottom)}" stroke="${col}" stroke-width="1.6" fill="none"/><rect class="ddn-candle-body" data-open="${pt.open}" data-close="${pt.close}" x="${f(cx-bw/2)}" y="${f(bodyTop)}" width="${f(bw)}" height="${f(Math.max(1,bodyBottom-bodyTop))}" fill="${col}" stroke="${t.surface}"/>`;
    body+=group(pt.sourceIds[0],pt.sourceIds,content,{x:cx-bw/2,y:wickTop,w:bw,h:wickBottom-wickTop,open:pt.open,high:pt.high,low:pt.low,close:pt.close},pr.x);
    const tick=plan.xType==='date'?new Date(pt.x).toISOString().slice(0,10):String(pt.rawX);
    body+=lines(wrap(tick,plotW/pts.length-8*s,11),cx,bottom+25*s,11,400,'middle');
   }
   body+=text(left,H-15*s,'Source-bound candlestick · '+pts.length+' marks'+(plan.skipped.length?' · '+plan.skipped.length+' explicit missing rows skipped':'')+' · supplied data, not a financial calculation certificate.',11);
  }else if(plan.mark==='histogram'){
   const bins=plan.dist.bins,maxC=Math.max(1,...bins.map(b=>b.count)),min=plan.dist.min,max=plan.dist.max,span=max-min||1,fx=v=>left+(v-min)/span*plotW,fy=c=>bottom-c/maxC*plotH;
   for(let j=0;j<=5;j++){const c=maxC*j/5,y=fy(c);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(c),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+line(left,bottom,right,bottom,t.ink,1.4)+text(left,top-14*s,'count',12,650);
   bins.forEach((b,i)=>{const x=fx(b.x0),w=Math.max(1,fx(b.x1)-x-1),h=bottom-fy(b.count);
    body+=group(b.sourceIds[0]||'bin:'+i,b.sourceIds,`<title>${esc(fmtNumber(b.x0)+' to '+fmtNumber(b.x1)+': '+b.count)}</title><rect class="ddn-histogram-bin" data-count="${b.count}" x="${f(x)}" y="${f(fy(b.count))}" width="${f(w)}" height="${f(h)}" fill="${colour(0)}" stroke="${t.surface}"/>`,{x,y:fy(b.count),w,h,value:b.count},pr.x);});
   for(let j=0;j<=4;j++){const v=min+span*j/4;body+=text(fx(v),bottom+25*s,fmtNumber(v),11,400,'middle');}
   body+=text(left,H-15*s,plan.dist.count+' observations · '+bins.length+' equal-width bins over ['+fmtNumber(min)+', '+fmtNumber(max)+']'+(plan.skipped.length?' · '+plan.skipped.length+' explicit missing rows skipped':'')+' · intervals are [lower, upper), the last bin includes the maximum.',11);
  }else if(plan.mark==='density'){
   const curve=plan.dist.curve,min=plan.dist.min,max=plan.dist.max,pad=3*plan.dist.bandwidth,span=max-min+2*pad,maxD=Math.max(...curve.map(c=>c[1])),fx=v=>left+(v-(min-pad))/span*plotW,fy=d=>bottom-d/maxD*plotH;
   for(let j=0;j<=4;j++){const v=min-pad+span*j/4;body+=line(fx(v),top,fx(v),bottom)+text(fx(v),bottom+25*s,fmtNumber(v),11,400,'middle');}
   body+=line(left,top,left,bottom,t.ink,1.4)+line(left,bottom,right,bottom,t.ink,1.4)+text(left,top-14*s,'density',12,650);
   const d=curve.map((c,i)=>(i?'L':'M')+f(fx(c[0]))+' '+f(fy(c[1]))).join('');
   body+=group(plan.sourceIds[0],plan.sourceIds,`<title>${esc('Gaussian KDE · bandwidth '+fmtNumber(plan.dist.bandwidth)+' · n='+plan.dist.count)}</title><path class="ddn-density-curve" data-bandwidth="${plan.dist.bandwidth}" d="${d}L${f(fx(curve.at(-1)[0]))} ${f(bottom)}L${f(fx(curve[0][0]))} ${f(bottom)}Z" fill="${colour(0)}" fill-opacity=".18" stroke="${colour(0)}" stroke-width="2.5"/>`,{x:left,y:top,w:plotW,h:plotH},pr.x);
   body+=text(left,H-15*s,'Gaussian kernel density · Silverman bandwidth '+fmtNumber(plan.dist.bandwidth)+' · n='+plan.dist.count+(plan.skipped.length?' · '+plan.skipped.length+' explicit missing rows skipped':'')+' · fixed 81-point grid; area under the curve integrates to 1.',11);
  }else if(plan.mark==='qq'){
   const obs=plan.dist.observations,ts=obs.map(o=>o.t),vs=obs.map(o=>o.v),t0=Math.min(...ts),t1=Math.max(...ts),v0=Math.min(...vs),v1=Math.max(...vs),fx=v=>left+(v-t0)/(t1-t0||1)*plotW,fy=v=>bottom-(v-v0)/(v1-v0||1)*plotH;
   body+=line(left,top,left,bottom,t.ink,1.4)+line(left,bottom,right,bottom,t.ink,1.4)+text(left,top-14*s,'sample quantile ('+(plan.unit||pr.x)+')',12,650)+text(right,H-42*s,'theoretical normal quantile',11,400,'end');
   for(let j=0;j<=4;j++){const v=t0+(t1-t0)*j/4;body+=line(fx(v),top,fx(v),bottom)+text(fx(v),bottom+25*s,fmtNumber(v),11,400,'middle');}
   for(let j=0;j<=4;j++){const v=v0+(v1-v0)*j/4;body+=line(left,fy(v),right,fy(v))+text(left-12*s,fy(v)+4*s,fmtNumber(v),11,400,'end');}
   const L=plan.dist.line,slope=(L.v3-L.v1)/(L.t3-L.t1),ya=L.v1+slope*(t0-L.t1),yb=L.v1+slope*(t1-L.t1);
   body+=`<path class="ddn-qq-reference" d="M${f(fx(t0))} ${f(fy(ya))}L${f(fx(t1))} ${f(fy(yb))}" stroke="${t.rule}" stroke-width="1.6" stroke-dasharray="6 4" fill="none"/>`;
   for(const o of obs)body+=group(o.sourceIds[0],o.sourceIds,`<title>${esc('theoretical '+fmtNumber(o.t)+' · sample '+fmtNumber(o.v))}</title><circle class="ddn-qq-point" data-theoretical="${f(o.t)}" data-sample="${o.v}" cx="${f(fx(o.t))}" cy="${f(fy(o.v))}" r="${f(4*s)}" fill="${colour(0)}" fill-opacity=".82" stroke="${t.surface}"/>`,{x:fx(o.t)-4*s,y:fy(o.v)-4*s,w:8*s,h:8*s,theoretical:o.t,value:o.v},pr.x);
   body+=text(left,H-15*s,'Normal Q-Q plot · n='+plan.dist.count+' · sample quantiles vs theoretical N(0,1) quantiles (Acklam inversion) · dashed reference through the first/third quartile pair · supplied data, not a normality certificate.',11);
  }else if(plan.mark==='quantiledot'){
   const dots=plan.dist.dots,min=plan.dist.min,max=plan.dist.max,span=max-min||1,fx=v=>left+(v-min)/span*plotW,r=7*s,rows=[];
   for(const d of dots){const px=fx(d.value);let row=rows.findIndex(last=>px-last>=2.4*r);if(row<0){row=rows.length;rows.push(-Infinity);}rows[row]=px;d.px=px;d.row=row;}
   for(let j=0;j<=4;j++){const v=min+span*j/4;body+=line(fx(v),top,fx(v),bottom)+text(fx(v),bottom+25*s,fmtNumber(v),11,400,'middle');}
   body+=line(left,bottom,right,bottom,t.ink,1.4)+text(left,top-14*s,plan.dist.quantiles+' quantiles of '+(plan.unit||pr.x),12,650);
   dots.forEach((d,i)=>{const cy=bottom-r-d.row*2.4*r;body+=group(d.sourceIds[0]||'q:'+i,d.sourceIds,`<title>${esc('quantile '+(i+1)+'/'+plan.dist.quantiles+': '+fmtNumber(d.value))}</title><circle class="ddn-quantile-dot" data-value="${d.value}" cx="${f(d.px)}" cy="${f(cy)}" r="${f(r)}" fill="${colour(0)}" fill-opacity=".85" stroke="${t.surface}"/>`,{x:d.px-r,y:cy-r,w:2*r,h:2*r,value:d.value},pr.x);});
   body+=text(left,H-15*s,plan.dist.quantiles+'-quantile dotplot of n='+plan.dist.count+' · each dot sits at the '+(100/plan.dist.quantiles)+'% slice boundary of the sorted sample · vertical stacking only avoids overlap; it encodes nothing.',11);
  }else if(['dotplot','beeswarm'].includes(plan.mark)){
   const cats=[];for(const pt of pts)if(!cats.some(v=>JSON.stringify(v)===JSON.stringify(pt.rawX)))cats.push(pt.rawX);
   const N=cats.length,ys=pts.map(p=>p.y),lo=Math.min(...ys),hi0=Math.max(...ys),hi=hi0===lo?lo+1:hi0,fy=n=>bottom-(n-lo)/(hi-lo)*plotH,fx=i=>left+(i+.5)*plotW/N,r=Math.min(9*s,plotW/N/8);
   for(let j=0;j<=5;j++){const v=lo+(hi-lo)*(j/5),y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(v),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+text(left,top-14*s,plan.unit||pr.y,12,650);
   cats.forEach((c,i)=>{
    const groupPts=pts.map((pt,idx)=>({pt,idx})).filter(o=>JSON.stringify(o.pt.rawX)===JSON.stringify(c));
    groupPts.sort((a,b)=>a.pt.y-b.pt.y||a.idx-b.idx);
    const lanes=new Map(),order=[0];for(let l=1;l<=24;l++){order.push(l,-l);}
    for(const {pt} of groupPts){const py=fy(pt.y);let lane=0;
     if(plan.mark==='beeswarm'){for(const L of order){const occ=lanes.get(L)||[];if(occ.every(v=>Math.abs(v-py)>=2.3*r)){lane=L;break;}}}
     else{const tied=groupPts.filter(o=>Math.abs(o.pt.y-pt.y)<1e-12);const rank=tied.findIndex(o=>o.pt===pt);lane=rank-(tied.length-1)/2;}
     if(!lanes.has(lane))lanes.set(lane,[]);lanes.get(lane).push(py);
     const cx=fx(i)+lane*2.3*r;
     body+=group(pt.sourceIds[0],pt.sourceIds,`<title>${esc(String(pt.rawX)+': '+fmtNumber(pt.y)+' '+plan.unit)}</title><circle class="ddn-${plan.mark==='beeswarm'?'beeswarm':'dotplot'}-point" data-value="${pt.y}" cx="${f(cx)}" cy="${f(py)}" r="${f(r)}" fill="${colour(i)}" fill-opacity=".85" stroke="${t.surface}"/>`,{x:cx-r,y:py-r,w:2*r,h:2*r,value:pt.y,dataX:pt.rawX},pr.y);}
    body+=lines(wrap(String(c),plotW/N-8*s,11),fx(i),bottom+25*s,11,400,'middle');
   });
   body+=text(left,H-15*s,(plan.mark==='beeswarm'?'Beeswarm: one dot per record, deterministic non-overlap lanes widen the swarm':'Dot plot: one dot per record, tied values dodge sideways')+' · '+pts.length+' marks'+(plan.skipped.length?' · '+plan.skipped.length+' explicit missing rows skipped':'')+' · horizontal displacement encodes nothing.',11);
  }else if(plan.mark==='boxplot'){
   const groups=plan.dist.groups,N=groups.length,allY=groups.flatMap(g=>[g.low,g.high,...g.outliers.map(o=>o.y)]),lo=Math.min(...allY),hi0=Math.max(...allY),hi=hi0===lo?lo+1:hi0,fy=n=>bottom-(n-lo)/(hi-lo)*plotH,fx=i=>left+(i+.5)*plotW/N,bw=Math.min(70*s,plotW/N*.45);
   for(let j=0;j<=5;j++){const v=lo+(hi-lo)*(j/5),y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(v),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+text(left,top-14*s,plan.unit||pr.y,12,650);
   groups.forEach((g,i)=>{const cx=fx(i),col=colour(i);
    let content=`<title>${esc(String(g.cat)+': median '+fmtNumber(g.median)+' · IQR ['+fmtNumber(g.q1)+', '+fmtNumber(g.q3)+'] · whiskers ['+fmtNumber(g.low)+', '+fmtNumber(g.high)+'] · n='+g.count)}</title>`;
    content+=`<path class="ddn-boxplot-whisker" d="M${f(cx)} ${f(fy(g.high))}L${f(cx)} ${f(fy(g.q3))}M${f(cx)} ${f(fy(g.q1))}L${f(cx)} ${f(fy(g.low))}M${f(cx-bw/3)} ${f(fy(g.high))}L${f(cx+bw/3)} ${f(fy(g.high))}M${f(cx-bw/3)} ${f(fy(g.low))}L${f(cx+bw/3)} ${f(fy(g.low))}" stroke="${col}" stroke-width="1.6" fill="none"/>`;
    content+=`<rect class="ddn-boxplot-box" data-q1="${g.q1}" data-median="${g.median}" data-q3="${g.q3}" x="${f(cx-bw/2)}" y="${f(fy(g.q3))}" width="${f(bw)}" height="${f(Math.max(1,fy(g.q1)-fy(g.q3)))}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="2"/>`;
    content+=`<path class="ddn-boxplot-median" d="M${f(cx-bw/2)} ${f(fy(g.median))}L${f(cx+bw/2)} ${f(fy(g.median))}" stroke="${col}" stroke-width="3" fill="none"/>`;
    body+=group(g.sourceIds[0],g.sourceIds,content,{x:cx-bw/2,y:fy(g.high),w:bw,h:fy(g.low)-fy(g.high)},pr.y);
    for(const o of g.outliers){const cy=fy(o.y);body+=group(o.sourceIds[0],o.sourceIds,`<title>${esc(String(g.cat)+' outlier: '+fmtNumber(o.y))}</title><circle class="ddn-boxplot-outlier" data-value="${o.y}" cx="${f(cx)}" cy="${f(cy)}" r="${f(4.5*s)}" fill="${t.surface}" stroke="${col}" stroke-width="2"/>`,{x:cx-5*s,y:cy-5*s,w:10*s,h:10*s,value:o.y},pr.y);}
    body+=lines(wrap(String(g.cat)+' (n='+g.count+')',plotW/N-8*s,11),cx,bottom+25*s,11,400,'middle');});
   body+=text(left,H-15*s,'Box plot · quartiles by linear interpolation (R-7) · Tukey 1.5×IQR whiskers · '+N+' categories · outliers beyond the fences are individual records, never dropped silently.',11);
  }else if(plan.mark==='violin'){
   const groups=plan.dist.groups,N=groups.length,maxD=Math.max(...groups.flatMap(g=>g.curve.map(c=>c[1]))),fx=i=>left+(i+.5)*plotW/N,half=plotW/N*.42;
   groups.forEach((g,i)=>{g.y0=Math.min(...g.curve.map(c=>c[0]));g.y1=Math.max(...g.curve.map(c=>c[0]));});
   const lo=Math.min(...groups.map(g=>g.y0)),hi0=Math.max(...groups.map(g=>g.y1)),hi=hi0===lo?lo+1:hi0,fy=n=>bottom-(n-lo)/(hi-lo)*plotH;
   for(let j=0;j<=5;j++){const v=lo+(hi-lo)*(j/5),y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(v),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+text(left,top-14*s,plan.unit||pr.y,12,650);
   groups.forEach((g,i)=>{const cx=fx(i),col=colour(i),w=d=>d/maxD*half;
    const d=g.curve.map((c,j)=>(j?'L':'M')+f(cx+w(c[1]))+' '+f(fy(c[0]))).join('')+g.curve.slice().reverse().map((c,j)=>'L'+f(cx-w(c[1]))+' '+f(fy(c[0]))).join('')+'Z';
    let content=`<title>${esc(String(g.cat)+': Gaussian KDE · bandwidth '+fmtNumber(g.bandwidth)+' · median '+fmtNumber(g.median)+' · n='+g.count)}</title><path class="ddn-violin-shape" data-bandwidth="${g.bandwidth}" d="${d}" fill="${col}" fill-opacity=".2" stroke="${col}" stroke-width="2"/>`;
    content+=`<rect class="ddn-violin-iqr" x="${f(cx-2.5*s)}" y="${f(fy(g.q3))}" width="${f(5*s)}" height="${f(Math.max(1,fy(g.q1)-fy(g.q3)))}" fill="${col}"/><circle class="ddn-violin-median" data-median="${g.median}" cx="${f(cx)}" cy="${f(fy(g.median))}" r="${f(3.5*s)}" fill="${t.surface}" stroke="${col}" stroke-width="2"/>`;
    body+=group(g.sourceIds[0],g.sourceIds,content,{x:cx-half,y:fy(g.y1),w:2*half,h:fy(g.y0)-fy(g.y1)},pr.y);
    body+=lines(wrap(String(g.cat)+' (n='+g.count+')',plotW/N-8*s,11),cx,bottom+25*s,11,400,'middle');});
   body+=text(left,H-15*s,'Violin · per-category Gaussian KDE, Silverman bandwidth, shared density scale across categories · inner bar is the IQR, dot the median · '+N+' categories.',11);
  }else if(plan.mark==='topk'){
   const info=plan.topk,maxY=Math.max(1,...pts.map(p=>p.y)),fy=n=>bottom-n/maxY*plotH,fx=i=>left+(i+.5)*plotW/pts.length,bw=Math.max(2,plotW/pts.length*.65);
   for(let j=0;j<=5;j++){const v=maxY*j/5,y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(v),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+line(left,bottom,right,bottom,t.ink,1.4)+text(left,top-14*s,plan.unit||pr.y,12,650);
   pts.forEach((pt,i)=>{const x=fx(i),h=bottom-fy(pt.y),col=pt.others?t.rule:colour(i);
    body+=group(pt.sourceIds[0],pt.sourceIds,`<title>${esc(String(pt.rawX)+': '+fmtNumber(pt.y)+' '+plan.unit+(pt.others?' · merged '+info.merged+' remaining categories':''))}</title><rect class="ddn-topk-bar"${pt.others?' data-others="true"':''} data-value="${pt.y}" x="${f(x-bw/2)}" y="${f(fy(pt.y))}" width="${f(bw)}" height="${f(h)}" fill="${col}"/>`,{x:x-bw/2,y:fy(pt.y),w:bw,h,value:pt.y,dataX:pt.rawX},pr.y);
    body+=lines(wrap(String(pt.rawX),plotW/pts.length-8*s,11),x,bottom+25*s,11,400,'middle');});
   body+=text(left,H-15*s,'Top '+info.kept+' of '+info.total+' categories by value'+(info.merged?' · '+info.merged+' remaining categories summed into Others':'')+(info.dropped?' · '+info.dropped+' categories excluded by others:false':'')+' · ranking is explicit and deterministic (value desc, name asc, declaration order).',11);
  }else{
   const ys=pts.map(p=>p.y),lo=Math.min(0,...ys),hi0=Math.max(0,...ys),hi=hi0===lo?lo+1:hi0,fy=n=>bottom-(n-lo)/(hi-lo)*plotH;let fx;
   if(plan.xType==='category')fx=(n,i)=>left+(i+.5)*plotW/pts.length;
   else{const xs=pts.map(p=>p.x),min=Math.min(...xs),max=Math.max(...xs);fx=x=>max===min?left+plotW/2:left+(x-min)/(max-min)*plotW;}
   for(let j=0;j<=5;j++){const v=lo+(hi-lo)*(j/5),y=fy(v);body+=line(left,y,right,y)+text(left-12*s,y+4*s,fmtNumber(v),11,400,'end');}
   body+=line(left,top,left,bottom,t.ink,1.4)+line(left,fy(0),right,fy(0),t.ink,1.4)+text(left,top-14*s,plan.unit||pr.y,12,650);
   let coords=pts.map((pt,i)=>({pt,x:fx(pt.x,i),y:fy(pt.y)}));
   if(['line','area'].includes(plan.mark)){
    const d=coords.map((a,i)=>(i?'L':'M')+f(a.x)+' '+f(a.y)).join(' ');
    if(plan.mark==='area')body+=`<path d="${d}L${f(coords.at(-1).x)} ${f(fy(0))}L${f(coords[0].x)} ${f(fy(0))}Z" fill="${colour(0)}" opacity=".18"/>`;
    body+=`<path d="${d}" fill="none" stroke="${colour(0)}" stroke-width="2.5"/>`;
   }
   for(let i=0;i<coords.length;i++){const{x,y,pt}=coords[i],col=colour(plan.mark==='bar'?i:0);let content=`<title>${esc(String(pt.rawX)+': '+fmtNumber(pt.y)+' '+plan.unit)}</title>`,box;
    if(plan.mark==='bar'){const bw=Math.max(2,plotW/pts.length*.65),yy=Math.min(y,fy(0)),h=Math.abs(fy(0)-y);content+=`<rect data-value="${pt.y}" x="${f(x-bw/2)}" y="${f(yy)}" width="${f(bw)}" height="${f(h)}" fill="${col}"/>`;box={x:x-bw/2,y:yy,w:bw,h};}
    else {const radius=plan.mark==='point'&&pr.size?21*Math.sqrt(pt.size/Math.max(Number.MIN_VALUE,...pts.map(p=>p.size))):4;content+=`<circle data-value="${pt.y}" cx="${f(x)}" cy="${f(y)}" r="${f(radius)}" fill="${col}" fill-opacity=".82" stroke="${t.surface}"/>`;box={x:x-radius,y:y-radius,w:radius*2,h:radius*2};}
    body+=group(pt.sourceIds[0],pt.sourceIds,content,{...box,value:pt.y,dataX:pt.x},pr.y);
    if(plan.xType==='category'){const label=wrap(String(pt.rawX),plotW/pts.length-8*s,11);body+=lines(label,x,bottom+25*s,11,400,'middle');}
   }
   if(plan.xType!=='category'){const min=Math.min(...pts.map(p=>p.x)),max=Math.max(...pts.map(p=>p.x));for(let j=0;j<=(min===max?0:4);j++){const v=min+(max-min)*(j/4);body+=text(fx(v),bottom+25*s,plan.xType==='date'?new Date(v).toISOString().slice(0,10):fmtNumber(v),11,400,'middle');}}
   body+=text(left,H-15*s,'Source-bound '+plan.mark+' · '+pts.length+' marks'+(plan.skipped.length?' · '+plan.skipped.length+' explicit missing rows skipped':'')+' · supplied data, not a financial calculation certificate.',11);
  }
  diagnostics.push({code:'DDN-PJW02',severity:'info',message:'Quantitative mark coordinates remain exact in every drawing style; styling does not change values.'});
 }
 if(plan.kind==='timeline'){
  W=Math.max(W,900*s);const lw=250*s,right=W-65*s,top=70*s,rowH=70*s,bottom=top+rowH*plan.items.length,lo=Math.min(...plan.items.map(n=>n.a)),hi0=Math.max(...plan.items.map(n=>n.b)),hi=hi0===lo?lo+86400000:hi0,fx=t=>lw+(t-lo)/(hi-lo)*(right-lw);H=bottom+65*s;
  const day=86400000,step=Math.max(1,Math.ceil((hi-lo)/day/5)),ticks=[];for(let d=lo;d<hi;d+=step*day)ticks.push(d);ticks.push(hi);for(const d of ticks){const x=fx(d);body+=line(x,top-15*s,x,bottom)+text(x,35*s,new Date(d).toISOString().slice(0,10),11,400,'middle');}
  const positions=new Map();for(let i=0;i<plan.items.length;i++){const n=plan.items[i],y=top+i*rowH,xx=fx(n.a),end=fx(n.b),cy=y+rowH/2;positions.set(n.id,{start:[xx,cy],end:[end,cy],y});body+=line(0,y+rowH,W,y+rowH)+group(n.id,[n.id],lines(wrap(n.label,lw-35*s),12*s,cy,13,600),{x:0,y,w:lw-15*s,h:rowH});
   const box=n.a===n.b?`<path d="M${xx} ${cy-10*s}L${xx+10*s} ${cy}L${xx} ${cy+10*s}L${xx-10*s} ${cy}Z" fill="${colour(i)}"/>`:`<rect x="${f(xx)}" y="${f(cy-12*s)}" width="${f(end-xx)}" height="${24*s}" rx="3" fill="${colour(i)}"/>`;
   body+=group(n.id,[n.id],`<title>${esc(n.label+' · ['+n.start+', '+n.end+') UTC')}</title>`+box,{x:xx,y:cy-12*s,w:end-xx,h:24*s,start:n.start,end:n.end},pr.start);
  }
  for(let i=0;i<plan.dependencies.length;i++){const r=plan.dependencies[i],a=positions.get(r.from.element),b=positions.get(r.to.element),x=Math.min(right+15*s,a.end[0]+16*s),yy=b.start[1],d=`M${f(a.end[0])} ${f(a.end[1])}H${f(x)}V${f(yy-23*s)}H${f(b.start[0])}V${f(yy-12*s)}`;body+=group(r.id,[r.id],`<path d="${d}" stroke="${t.ink}" fill="none" stroke-width="1.2"/>`+R.endMark([b.start[0],yy-12*s],90,'filled',t.ink,t.surface));}
  body+=text(0,H-20*s,'UTC dates · end-exclusive intervals · diamonds are milestones · supplied schedule, not a scheduling solver.',11);
 }
 if(plan.kind==='sequence'){
  const parts=plan.participants,msgs=plan.messages,px=new Map();
  const headH=52*s,pitch=64*s,firstRow=headH+66*s;
  const labelW=Math.max(0,...parts.map(n=>Text.measure(n.name,13*s,p.style.font,600).width));
  const gap=Math.max(230*s,labelW+100*s),left=110*s;
  parts.forEach((n,i)=>px.set(n.id,left+i*gap));
  const bottom=firstRow+Math.max(msgs.length,1)*pitch-20*s;H=bottom+64*s;W=Math.max(W,left*2+(parts.length-1)*gap);
  for(const n of parts){
   const x=px.get(n.id),hw=Math.max(130*s,Text.measure(n.name,13*s,p.style.font,600).width+36*s);
   const used=msgs.some(r=>r.from.element===n.id||r.to.element===n.id);
   if(!used)diagnostics.push({code:'DDN-PJW03',severity:'warning',message:'Sequence participant '+n.name+' has no incident messages; it is drawn with an empty lifeline.'});
   body+=group(n.id,[n.id],rect(x-hw/2,0,hw,headH,t.surface,t.ink)+lines(wrap(n.name,hw-20*s,13,600),x,headH/2+5*s,13,600,'middle')+line(x,headH,x,bottom,t.rule,1.2,'5 5'),{x:x-hw/2,y:0,w:hw,h:bottom});
  }
  const bars=new Map();
  msgs.forEach((r,i)=>{
   const recv=r.to.element,next=msgs.findIndex((m,j)=>j>i&&m.from.element===recv),key=recv+':'+i+':'+(next<0?msgs.length-1:next);
   if(!bars.has(key))bars.set(key,{id:recv,from:i,to:next<0?msgs.length-1:next});
  });
  for(const a of bars.values()){const x=px.get(a.id),y0=firstRow+a.from*pitch-16*s,y1=firstRow+a.to*pitch+16*s;
   body+=group(a.id,[a.id],`<rect x="${f(x-5*s)}" y="${f(y0)}" width="${f(10*s)}" height="${f(y1-y0)}" fill="${t.surface}" stroke="${t.ink}" stroke-width="1.2"/>`,{x:x-5*s,y:y0,w:10*s,h:y1-y0});}
  msgs.forEach((r,i)=>{
   const y=firstRow+i*pitch,ret=r.properties.x_return===true,xs=px.get(r.from.element),xt=px.get(r.to.element),num=(i+1)+'. ';
   if(r.from.element===r.to.element){
    const lw=48*s,lh=26*s,d=`M${f(xs)} ${f(y)}H${f(xs+lw)}V${f(y+lh)}H${f(xs+9*s)}`;
    body+=group(r.id,[r.id],`<path d="${d}" stroke="${ret?t.rule:t.ink}" stroke-width="1.4" fill="none"${ret?' stroke-dasharray="5 4"':''}/>`+R.endMark([xs+9*s,y+lh],90,'open',ret?t.rule:t.ink,t.surface)+text(xs+lw/2+12*s,y-10*s,num+r.name,12,400,'middle'),{x:xs,y:y-20*s,w:lw+14*s,h:lh+22*s});
   }else{
    const dir=xt>xs?0:180,ex=xt+(xt>xs?-2:2)*s;
    body+=group(r.id,[r.id],line(xs,y,ex,y,ret?t.rule:t.ink,1.4,ret?'5 4':'')+R.endMark([ex,y],dir,ret?'open':'filled',ret?t.rule:t.ink,t.surface)+text((xs+xt)/2,y-10*s,num+r.name,12,400,'middle'),{x:Math.min(xs,xt),y:y-20*s,w:Math.abs(xt-xs),h:24*s});
   }
  });
  body+=text(0,H-15*s,'Declaration order, not a verified protocol · '+parts.length+' participants · '+msgs.length+' messages · dashed arrows are x_return replies · bars are receiver activations.',11);
 }
 if(plan.kind==='timing'){
  const parts=plan.participants;
  W=Math.max(W,900*s);
  const labelW=Math.max(110*s,Math.max(...parts.map(x=>Text.measure(x.node.name,13*s,p.style.font,600).width))+40*s);
  const right=W-60*s,top=64*s,bandH=96*s,pad=12*s,bottom=top+bandH*parts.length;
  const lo=Math.min(...parts.flatMap(x=>x.states.map(e=>e.at))),hi0=Math.max(...parts.flatMap(x=>x.states.map(e=>e.at))),hi=hi0===lo?lo+1:hi0;
  const fx=v=>labelW+(v-lo)/(hi-lo)*(right-labelW);
  H=bottom+80*s;
  parts.forEach((part,i)=>{
   const y=top+i*bandH,n=part.node;
   const order=[],level=new Map();
   for(const e of part.states)if(!level.has(e.state)){level.set(e.state,order.length);order.push(e.state);}
   const step=(bandH-2*pad)/order.length,ly=j=>y+pad+j*step;
   body+=group(n.id,[n.id],lines(wrap(n.name,labelW-30*s,13,600),12*s,y+bandH/2+5*s,13,600)+line(0,y+bandH,W,y+bandH),{x:0,y,w:labelW-15*s,h:bandH});
   let d='';
   part.states.forEach((e,m)=>{
    const x0=fx(e.at),x1=m+1<part.states.length?fx(part.states[m+1].at):fx(hi),yy=ly(level.get(e.state));
    d+=(m?'L':'M')+f(x0)+' '+f(yy)+'L'+f(x1)+' '+f(yy);
    const content=`<title>${esc(n.name+': '+e.state+' from '+fmtNumber(e.at))}</title><path class="ddn-timing-plateau" data-at="${e.at}" data-state="${esc(e.state)}" d="M${f(x0)} ${f(yy)}L${f(x1)} ${f(yy)}" stroke="${colour(level.get(e.state))}" stroke-width="2.5" fill="none"/>`;
    body+=group(n.id,[n.id],content+text((x0+x1)/2,yy-8*s,e.state,11,400,'middle'),{x:x0,y:yy-16*s,w:x1-x0,h:20*s,at:e.at,state:e.state},'x_states');
   });
   body+=`<path class="ddn-timing-trace" d="${d}" stroke="${t.ink}" stroke-width="1.4" fill="none"/>`;
   for(let m=1;m<part.states.length;m++){const xx=fx(part.states[m].at);body+=line(xx,ly(level.get(part.states[m-1].state)),xx,ly(level.get(part.states[m].state)),t.ink,1.4);}
  });
  body+=line(labelW,bottom,right,bottom,t.ink,1.4);
  for(const v of [lo,hi0]){const x=fx(v);body+=line(x,bottom,x,bottom+8*s,t.ink,1.2)+text(x,bottom+26*s,fmtNumber(v),11,400,'middle');}
  body+=text(labelW,H-15*s,'Supplied time points, not a simulation · '+parts.length+' participants · abstract numeric time axis in the author\'s unit.',11);
 }
 if(plan.kind==='panels'&&plan.panels.some(v=>v.child)){
  if(typeof options.renderChild!=='function')throw new D.DDNError('DDN-QP004','Child panels require the unified engine dispatcher');
  const gap=24*s,pad=18*s,measured=[];let cw=Math.max(260*s,(W-gap*(plan.columns-1))/plan.columns);
  function scopeSVG(svg,prefix,font){
   svg=svg.replace(/<\?xml[^?]*\?>/g,'').replace(/<style>[\s\S]*?<\/style>/g,'');const ids=new Map();
   svg.replace(/\sid="([^"]+)"/g,(_,id)=>{ids.set(id,prefix+id);return _;});
   svg=svg.replace(/(\s)id="([^"]+)"/g,(_,a,id)=>a+'id="'+ids.get(id)+'"').replace(/url\(#([^)]*)\)/g,(_,id)=>'url(#'+(ids.get(id)||id)+')').replace(/(href=")#([^"]+)"/g,(_,a,id)=>a+'#'+(ids.get(id)||id)+'"').replace(/(aria-labelledby|aria-describedby)="([^"]*)"/g,(_,a,ls)=>a+'="'+ls.split(/\s+/).map(x=>ids.get(x)||x).join(' ')+'"').replace(/data-projection-mark="([^"]+)"/g,(_,id)=>'data-projection-mark="'+prefix+id+'"');
   return svg.replace(/<svg\b/, '<svg font-family="'+esc(font)+'"');
  }
  for(const panel of plan.panels){let child=null;if(panel.child){const input=clone(panel.child);input.view.profiles.style={...input.view.profiles.style,look:p.style.look,theme:p.style.theme};input.view.profiles.publication={...input.view.profiles.publication,size:'content',fit:'none'};
    child=options.renderChild(input,reg,glyphs,{...options,layoutState:null});diagnostics.push(...child.diagnostics.map(d=>({...d,message:'Child '+panel.title+': '+d.message})));cw=Math.max(cw,(child.scene.width+2*pad-gap*(panel.colspan-1))/panel.colspan);smallest=Math.min(smallest,child.scene.smallestText*child.scene.scale);
   }measured.push({panel,child});}
  W=cw*plan.columns+gap*(plan.columns-1);const nr=Math.max(...plan.panels.map(v=>v.row+v.rowspan)),rh=Array(nr).fill(180*s);
  for(const m of measured){const pw=cw*m.panel.colspan+gap*(m.panel.colspan-1);m.title=wrap(m.panel.title,pw-2*pad,15,650);m.header=(m.title.length*21+26)*s;m.width=pw;
   if(m.child)m.need=m.header+2*pad+m.child.scene.height;else{m.itemLines=m.panel.items.map(i=>({i,title:wrap(i.node.name,pw-2*pad,14,600),body:wrap(i.text,pw-2*pad,12)}));m.need=m.header+pad+m.itemLines.reduce((n,x)=>n+(x.title.length*20+x.body.length*18+24)*s,0);}}
  for(const m of measured.slice().sort((a,b)=>a.panel.rowspan-b.panel.rowspan)){const avail=rh.slice(m.panel.row,m.panel.row+m.panel.rowspan).reduce((a,b)=>a+b,0)+gap*(m.panel.rowspan-1);if(avail<m.need)for(let j=m.panel.row;j<m.panel.row+m.panel.rowspan;j++)rh[j]+=(m.need-avail)/m.panel.rowspan;}
  const tops=[0];rh.forEach(h=>tops.push(tops.at(-1)+h+gap));
  for(const m of measured){const panelStart=body.length,x=m.panel.column*(cw+gap),y=tops[m.panel.row],height=rh.slice(m.panel.row,m.panel.row+m.panel.rowspan).reduce((a,b)=>a+b,0)+gap*(m.panel.rowspan-1);body+=rect(x,y,m.width,height)+lines(m.title,x+pad,y+29*s,15,650)+line(x,y+m.header,x+m.width,y+m.header);
   if(m.child){const cc=m.child.scene,xx=x+(m.width-cc.width)/2,yy=y+m.header+pad,prefix='child-'+R.hash(ir.view.id+':'+m.panel.id)+'-',svg=scopeSVG(m.child.svg,prefix,Text.FONTS[m.panel.child.view.profiles.style.font]);body+='<g data-child-view="'+esc(m.panel.child.view.id)+'">'+svg.replace(/<svg\b/,'<svg x="'+f(xx)+'" y="'+f(yy)+'"')+'</g>';
    composedSubs.push({id:m.panel.id,target:m.panel.child.view.id,x:xx,y:yy,w:cc.width,h:cc.height,mode:'inline'});
    for(const mark of cc.marks||[])marks.push({...mark,id:prefix+mark.id,x:xx+cc.origin[0]+(mark.x||0)*cc.scale,y:yy+cc.origin[1]+(mark.y||0)*cc.scale,w:(mark.w||0)*cc.scale,h:(mark.h||0)*cc.scale,childView:m.panel.child.view.id});
    for(const node of cc.nodes||[])marks.push({id:prefix+node.id,sourceIds:[node.id],x:xx+cc.origin[0]+node.x*cc.scale,y:yy+cc.origin[1]+node.y*cc.scale,w:node.w*cc.scale,h:node.h*cc.scale,childView:m.panel.child.view.id});
   }else{let yy=y+m.header+pad+18*s;for(const item of m.itemLines){body+=group(item.i.node.id,[item.i.node.id],lines(item.title,x+pad,yy,14,600)+lines(item.body,x+pad,yy+item.title.length*20*s,12),{x:x+pad,y:yy-16*s,w:m.width-2*pad,h:(item.title.length*20+item.body.length*18+24)*s});yy+=(item.title.length*20+item.body.length*18+24)*s;}}
   body=body.slice(0,panelStart)+`<g class="ddn-panel" data-panel="${esc(m.panel.id)}">`+body.slice(panelStart)+'</g>';
  }H=tops.at(-1)-gap+24*s;
 }
 if(!Number.isFinite(W)||!Number.isFinite(H)||W>50000||H>50000)throw new D.DDNError('DDN-PJ060','Projection extent exceeds bounded publication budget');
 // Page composition: measurements and all visible labels participate, unlike CSS-only scaling.
 const margin=q(p.publication.margin,32),titleLines=wrap(ir.view.name,W,24,650),header=Math.max(92*s,(titleLines.length*29+48)*s),footer=46*s;
 let pageW=q(p.publication.width,1280),pageH=q(p.publication.height,800);if(['a4','letter'].includes(p.publication.size)){pageW=p.publication.size==='a4'?210*96/25.4:816;pageH=p.publication.size==='a4'?297*96/25.4:1056;if(p.publication.orientation==='landscape')[pageW,pageH]=[pageH,pageW];}
 if(p.publication.size==='content'){pageW=W+margin*2;pageH=H+margin*2+header+footer;}
 const aw=pageW-2*margin,ah=pageH-2*margin-header-footer;if(aw<=0||ah<=0)throw new D.DDNError('DDN-PJ061','Page has no remaining drawing area');
 const scale=p.publication.fit==='none'?1:Math.min(1,aw/W,ah/H),min=q(p.publication.minimum_text,8*96/72),embed=p.publication.embedding_scale??1;
 if(!Number.isFinite(embed)||embed<=0||embed>100)throw new D.DDNError('DDN-PJ062','embedding_scale must be a positive finite value <= 100');
 const warnOrFail=(code,msg)=>{if(p.publication.overflow==='error')throw new D.DDNError(code,msg);diagnostics.push({code,severity:'warning',message:msg});};
 if(W*scale>aw+.01||H*scale>ah+.01)warnOrFail('DDN074','Projection exceeds publication page; use content size or a larger page');
 if(smallest*scale*embed<min-.001)warnOrFail('DDN071','Projection text would fall below the final publication minimum');
 const tx=margin+(aw-W*scale)/2,ty=margin+header;
 let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg class="${R.cls('ddn-svg','ddn-view-'+plan.kind,'ddn-profile-'+R.slug(plan.profile))}" xmlns="http://www.w3.org/2000/svg" width="${f(pageW)}" height="${f(pageH)}" viewBox="0 0 ${f(pageW)} ${f(pageH)}" role="img" aria-labelledby="projection-title projection-description" style="font-family:${esc(Text.FONTS[p.style.font])}"><title id="projection-title">${esc(ir.view.name)}</title><desc id="projection-description">${esc(plan.profile)}. Data-bound projection. Inspect marks to locate shared source definitions.</desc><rect width="100%" height="100%" fill="${t.background}"/>`;
 out+=text(margin,margin+8*s,'DDN / 0.5 PROJECTION PREVIEW / '+plan.profile,11,600)+lines(titleLines,margin,margin+42*s,24,650)+`<g id="drawing" transform="translate(${f(tx)} ${f(ty)}) scale(${f(scale)})">`+rect(0,0,W,H,t.surface,t.rule)+body+'</g>';
 out+=line(margin,pageH-margin-23*s,pageW-margin,pageH-margin-23*s)+text(margin,pageH-margin,'One model · source-bound occurrences · '+p.style.look+' / '+p.style.theme,11)+text(pageW-margin,pageH-margin,plan.kind,11,600,'end')+'</svg>';
 const after=Text.stats(),estimated=after.estimated>stats.estimated;if(estimated){if(p.publication.metrics==='required')throw new D.DDNError('DDN077','Required measured fonts unavailable for projection');diagnostics.push({code:'DDN-TW01',severity:'warning',message:'Some projection text used estimated metrics. Browser-specific shaping is not certified.'});}
 const scene={width:pageW,height:pageH,smallestText:smallest,scale,origin:[tx,ty],nodes:[],routes:[],crossings:[],frames:[],subdiagrams:composedSubs,marks,projection:{kind:plan.kind,profile:plan.profile,sourceIds:plan.sourceIds||[],quantitative:!!plan.quantitative},drawingBounds:{x:0,y:0,w:W,h:H},drawingArea:{x:margin,y:margin+header,w:aw,h:ah},textMeasurement:{mode:estimated?'estimated':'measured',requestedFont:p.style.font}};
 return{svg:out,scene,diagnostics,_ir:ir};
}
function vegaLite(ir){
 const plan=Data.plan(ir,D.DDNError),p=ir.view.profiles.projection;if(plan.quality)throw new D.DDNError('DDN-PJ070','Quality transforms are native; this optional adapter does not silently flatten them');if(!['chart','timeline'].includes(plan.kind))throw new D.DDNError('DDN-PJ070','Vega-Lite adapter supports chart/timeline only');
 const spec={$schema:'https://vega.github.io/schema/vega-lite/v6.json',description:'DDN source-bound quantitative projection; local values only',width:q(p.width,900),height:q(p.height,450),usermeta:{ddnView:ir.view.id,profile:p.profile,sourceIds:plan.sourceIds}};
 if(plan.kind==='timeline'){spec.data={values:plan.items.map(n=>({label:n.label,start:n.start,end:n.end,sourceId:n.id}))};spec.mark='bar';spec.encoding={y:{field:'label',type:'nominal'},x:{field:'start',type:'temporal',scale:{type:'utc'}},x2:{field:'end'}};spec.usermeta.omissions=['dependency overlay','milestones are zero-width intervals; native view displays diamonds'];}
 else{if(['radar','funnel','gauge','candlestick','treemap','sankey'].includes(plan.mark))throw new D.DDNError('DDN-PJ070','Radar, funnel, gauge, candlestick, treemap and sankey marks have no faithful Vega-Lite mapping in this adapter; use the native SVG projection');spec.data={values:plan.points.map(n=>({x:n.rawX,y:n.y,size:n.size,sourceIds:n.sourceIds.join('|')}))};spec.mark=['pie','donut'].includes(plan.mark)?{type:'arc',innerRadius:plan.mark==='donut'?100:0}:plan.mark;const type={category:'nominal',number:'quantitative',date:'temporal'}[plan.xType];spec.encoding=['pie','donut'].includes(plan.mark)?{theta:{field:'y',type:'quantitative'},color:{field:'x',type:'nominal'}}:{x:{field:'x',type,...(type==='temporal'?{scale:{type:'utc'}}:{})},y:{field:'y',type:'quantitative',title:plan.unit||p.y}};if(plan.mark==='point'&&p.size)spec.encoding.size={field:'size',type:'quantitative'};}
 return spec;
}
const api={VERSION:'0.6.0-beta.1',render,vegaLite,plan:Data.plan,evaluateDecision:(ir,input)=>Data.quality.evaluateDecision(Data.plan(ir,D.DDNError),input),simulateLifecycle:(ir,events,expected)=>Data.quality.simulate(Data.plan(ir,D.DDNError).lifecycle,events,expected)};
publishNamespace('DDNProjections',api);
export default api;
