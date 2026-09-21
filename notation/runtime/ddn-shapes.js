/* SPDX-License-Identifier: GPL-2.0-or-later. Composable profile outlines with measured compartments and contour attachments. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-sketch'),require('./ddn-text'),require('./ddn-palette'));else root.DDNShapes=factory(root.DDNSketch,root.DDNText,root.DDNPalette);})(typeof globalThis!=='undefined'?globalThis:this,function(Sketch,Text,Palette){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const f=x=>Math.round(x*1000)/1000;
const slug=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
function shapeOf(k,p){if(k.keyword==='dfd.process')return p.projection?.profile==='dfd.yourdon@1'?'circle':'round';return k.silhouette;}
function measure(g,p){
 const s=g.scale,n=g.n,k=g.k;g.silhouette=shapeOf(k,p);
 const compact=['ellipse','circle','diamond','actor','terminal','parallelogram','document','store','subprocess','round','hexagon'].includes(g.silhouette);
 if(compact&&!n.fields.length){
  const proportion=g.silhouette==='diamond'?.60:['ellipse','circle'].includes(g.silhouette)?.68:.78;
  g.titleLines=Text.wrap(n.name,g.w*proportion,16*s,p.style.font,600);
  g.h=Math.max(g.h,(g.titleLines.length*21+55)*s*(g.silhouette==='diamond'?1.55:1));
  if(g.silhouette==='circle'){g.w=Math.max(g.w,g.h);g.h=g.w;}
  if(g.silhouette==='actor')g.h=Math.max(g.h,(140+g.titleLines.length*21)*s);
  g.fieldRows=[];
 }
 if(['uml.class','uml.interface'].includes(n.kind)){
  const list=g.fieldRows.slice().sort((a,b)=>(a.field.properties.x_member?.kind==='operation')-(b.field.properties.x_member?.kind==='operation'));
  let y=70*s,last=null;const div=[];
  for(const row of list){const m=row.field.properties.x_member||{},type=m.kind||'attribute';if(type!==last){div.push({top:y,label:type==='operation'?'OPERATIONS':'ATTRIBUTES'});y+=25*s;last=type;}
   const prefix={public:'+',private:'−',protected:'#',package:'~'}[m.visibility]||'';
   row.labelLines=Text.wrap((prefix?prefix+' ':'')+row.field.name,g.w-32*s,13.5*s,p.style.font,400);row.top=y;row.h=Math.max(row.h,(row.labelLines.length*18+row.detailLines.length*16+10)*s);y+=row.h;
  }
  g.fieldRows=list;g.compartments=div;g.h=Math.max(g.h,y+20*s);g.headerH=70*s;
 }
 if(n.kind==='req.requirement'){
  g.requirement=Text.wrap(n.properties.x_diagram?.text||'',g.w-32*s,13*s,p.style.font);g.h=Math.max(g.h,(95+g.requirement.length*19)*s);
 }
 if(['initial','final'].includes(g.silhouette)){g.w=Math.max(125*s,Text.measure(n.name,12*s,p.style.font).width+24*s);g.h=85*s;g.fieldRows=[];g.titleLines=[n.name];}
 if(n.kind==='uml.usecase'&&n.properties.x_usecase?.extension_points?.length){g.extensionPoints=n.properties.x_usecase.extension_points;g.w=Math.max(g.w,320*s);g.h=Math.max(g.h,(110+g.extensionPoints.length*20)*s);}
 return g;
}
function polygon(g){const{x,y,w,h,silhouette:t}=g;
 if(['initial','final'].includes(t)){const ps=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;ps.push([x+w/2+12*g.scale*Math.cos(a),y+h/2-8*g.scale+12*g.scale*Math.sin(a)]);}return ps;}
 if(t==='offpage')return[[x,y],[x+w,y],[x+w,y+h*.7],[x+w/2,y+h],[x,y+h*.7]];
 if(t==='diamond')return[[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
 if(t==='hexagon')return[[x+w*.25,y],[x+w*.75,y],[x+w,y+h/2],[x+w*.75,y+h],[x+w*.25,y+h],[x,y+h/2]];
 if(t==='parallelogram')return[[x+w*.16,y],[x+w,y],[x+w*.84,y+h],[x,y+h]];
 if(t==='package')return[[x,y],[x+w*.43,y],[x+w*.49,y+20],[x+w,y+20],[x+w,y+h],[x,y+h]];
 if(t==='document'){const ps=[[x,y],[x+w,y],[x+w,y+h-14]];for(let i=1;i<=24;i++){const t=i/24;ps.push([x+w*(1-t),y+h-14+12*Math.sin(t*Math.PI*2)]);}return ps;}
 if(t==='actor'){const z=g.scale,cx=x+w/2;return [[cx,y+9*z],[cx+14*z,y+23*z],[cx+14*z,y+40*z],[cx+32*z,y+59*z],[cx+3*z,y+70*z],[cx+28*z,y+127*z],[cx,y+100*z],[cx-28*z,y+127*z],[cx-3*z,y+70*z],[cx-32*z,y+59*z],[cx-14*z,y+40*z],[cx-14*z,y+23*z]];}
 if(['ellipse','circle'].includes(t)){const ps=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;ps.push([x+w/2+Math.cos(a)*w/2,y+h/2+Math.sin(a)*h/2]);}return ps;}
 return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
}
function anchor(g,side,point){
 const {x,y,w,h,silhouette:t}=g;if(!t)return point;
 let px=point[0],py=point[1];const cx=x+w/2,cy=y+h/2;
 if(['initial','final'].includes(t)){const a={east:0,south:Math.PI/2,west:Math.PI,north:-Math.PI/2}[side];return [f(cx+12*g.scale*Math.cos(a)),f(cy-8*g.scale+12*g.scale*Math.sin(a))];}
 if(['ellipse','circle'].includes(t)){
  if(side==='east'||side==='west'){const dy=Math.min(.94,Math.abs((py-cy)/(h/2)));px=cx+(side==='east'?1:-1)*w/2*Math.sqrt(1-dy*dy);}else{const dx=Math.min(.94,Math.abs((px-cx)/(w/2)));py=cy+(side==='south'?1:-1)*h/2*Math.sqrt(1-dx*dx);}
 }else if(t==='diamond'){
  if(side==='east'||side==='west'){py=Math.max(y+h*.1,Math.min(y+h*.9,py));px=cx+(side==='east'?1:-1)*(w/2)*(1-Math.abs(py-cy)/(h/2));}else{px=Math.max(x+w*.1,Math.min(x+w*.9,px));py=cy+(side==='south'?1:-1)*(h/2)*(1-Math.abs(px-cx)/(w/2));}
 }else if(t==='parallelogram'){
  if(side==='east')px=x+w-w*.16*(py-y)/h;else if(side==='west')px=x+w*.16*(1-(py-y)/h);else if(side==='north')px=Math.max(x+w*.16,px);else px=Math.min(x+w*.84,px);
 }else if(t==='package'&&side==='north'&&px>x+w*.43)py=y+20;
 // Actor has explicit side docking points, not an invisible server-card outline.
 else if(t==='actor'){const z=g.scale;px=cx+(side==='east'?32*z:side==='west'?-32*z:0);py=side==='north'?y+9*z:side==='south'?y+100*z:y+59*z;}
 return[f(px),f(py)];
}
// Segment/contour interior test for endpoint owners. A shape's rectangular
// envelope is suitable for unrelated obstacles, but rejects legal endpoints
// inside the empty corners of a diamond or parallelogram.
function segmentInterior(segment,g){
 const a=segment.a,b=segment.b,dx=b[0]-a[0],dy=b[1]-a[1];
 if(['ellipse','circle'].includes(g.silhouette)){
  const rx=g.w/2,ry=g.h/2,cx=g.x+rx,cy=g.y+ry;
  const x=(a[0]-cx)/rx,y=(a[1]-cy)/ry,u=dx/rx,v=dy/ry,den=u*u+v*v;
  const t=den?Math.max(0,Math.min(1,-(x*u+y*v)/den)):0;
  return (x+t*u)**2+(y+t*v)**2<1-1e-5;
 }
 const ps=polygon(g),cross=(u,v)=>u[0]*v[1]-u[1]*v[0],cuts=[0,1];
 for(let i=0;i<ps.length;i++){
  const p=ps[i],q=ps[(i+1)%ps.length],e=[q[0]-p[0],q[1]-p[1]],den=cross([dx,dy],e);
  if(Math.abs(den)<1e-10)continue;
  const d=[p[0]-a[0],p[1]-a[1]],t=cross(d,e)/den,u=cross(d,[dx,dy])/den;
  if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
 }
 const contains=pt=>{
  let inside=false;
  for(let i=0,j=ps.length-1;i<ps.length;j=i++){
   const p=ps[j],q=ps[i],ex=q[0]-p[0],ey=q[1]-p[1],d=ex*ex+ey*ey;
   const t=d?Math.max(0,Math.min(1,((pt[0]-p[0])*ex+(pt[1]-p[1])*ey)/d)):0;
   if(Math.hypot(pt[0]-p[0]-t*ex,pt[1]-p[1]-t*ey)<.002)return false;
   if((p[1]>pt[1])!==(q[1]>pt[1])&&pt[0]<(q[0]-p[0])*(pt[1]-p[1])/(q[1]-p[1])+p[0])inside=!inside;
  }return inside;
 };
 cuts.sort((x,y)=>x-y);
 for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>1e-9){const t=(cuts[i]+cuts[i-1])/2;if(contains([a[0]+t*dx,a[1]+t*dy]))return true;}
 return false;
}
function render(g,p,theme){
 const {n,k,x,y,w,h}=g,s=g.scale,look=p.style.look,shape=g.silhouette,mono=p.style.theme==='neutral',nc=Palette.node(k,theme),ink=mono?'#333333':nc.ink,fill=mono?'#FAFAFA':nc.fill,fg=nc.text;
 const opt={...p.style,id:n.id,stroke:ink,fill,width:1.8};
 const line=(x1,y1,x2,y2,width=1)=>look==='handDrawn'?Sketch.polyline([[x1,y1],[x2,y2]],{...opt,id:n.id+':line:'+x1+':'+y1,width,hachure:false}):`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" fill="none" stroke="${ink}" stroke-width="${width}"/>`;
 const text=(xx,yy,txt,size=13,weight=400,extra='')=>{Text.measure(txt,size*s,p.style.font,weight);return `<text x="${f(xx)}" y="${f(yy)}" font-size="${size*s}" fill="${fg}" font-weight="${weight}" ${extra}>${esc(txt)}</text>`;};
 const lines=(ls,xx,yy,size=16,weight=600,extra='text-anchor="middle"')=>ls.map((v,i)=>text(xx,yy+i*(size+5)*s,v,size,weight,extra)).join('');
 let out=`<g class="ddn-node ddn-kind-${slug(k.code)}" data-id="${esc(n.id)}" data-shape="${shape}" tabindex="0" role="group" aria-label="${esc(n.name)}"><title>${esc(n.name+' — '+k.name)}</title>`;
 if(['initial','final'].includes(shape)){
  const cx=x+w/2,cy=y+h/2-8,r=12*s;
  if(shape==='initial')out+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>`;
  else out+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r*.65}" fill="${ink}"/>`;
  out+=text(cx,y+h-5*s,n.name,12,600,'text-anchor="middle"');return out+'</g>';
 }
 if(look==='neo'&&shape!=='actor')out+=`<path d="${polygon(g).map((v,i)=>(i?'L':'M')+f(v[0]+4)+' '+f(v[1]+6)).join('')}Z" fill="#000" opacity=".14"/>`;
 if(shape==='actor'){
  const cx=x+w/2,head=y+23*s;out+=`<circle cx="${cx}" cy="${head}" r="${14*s}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  for(const a of [[cx,head+14*s,cx,head+65*s],[cx-32*s,head+36*s,cx+32*s,head+36*s],[cx,head+65*s,cx-28*s,head+104*s],[cx,head+65*s,cx+28*s,head+104*s]])out+=line(...a,1.8);
  out+=lines(g.titleLines,cx,y+h-(g.titleLines.length-1)*21*s-8*s);
  return out+'</g>';
 }
 if(shape==='bracket'){out+=line(x+18*s,y,x,y)+line(x,y,x,y+h)+line(x,y+h,x+18*s,y+h);out+=lines(g.titleLines,x+w/2,y+h/2-(g.titleLines.length-1)*10.5*s+5*s);return out+'</g>';}
 if(shape==='cylinder'){out+=`<path d="M${x} ${y+14*s}V${y+h-14*s}C${x} ${y+h+6*s} ${x+w} ${y+h+6*s} ${x+w} ${y+h-14*s}V${y+14*s}Z" fill="${fill}" stroke="${ink}"/><ellipse cx="${x+w/2}" cy="${y+14*s}" rx="${w/2}" ry="${14*s}" fill="${fill}" stroke="${ink}"/>`;out+=lines(g.titleLines,x+w/2,y+h/2+5*s);return out+'</g>';}
 if(shape==='store'){
  if(p.projection.profile==='dfd.yourdon@1')out+=line(x,y,w+x,y,2)+line(x,y+h,x+w,y+h,2);
  else{out+=line(x+w,y,x,y,2)+line(x,y,x,y+h,2)+line(x,y+h,x+w,y+h,2)+line(x+35*s,y,x+35*s,y+h,1);out+=text(x+17*s,y+h/2+5*s,n.properties.x_diagram?.number||'D',12,600,'text-anchor="middle"');}
 }else if(look==='handDrawn'){
  out+=['round','terminal'].includes(shape)?Sketch.box(x,y,w,h,{...opt,radius:shape==='terminal'?h/2:14*s}):Sketch.polygon(polygon(g),opt);
 }else if(['ellipse','circle'].includes(shape))out+=`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 else if(['rect','round','terminal','component','subprocess'].includes(shape))out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape==='terminal'?h/2:shape==='round'?14*s:0}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 else out+=`<path d="${polygon(g).map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join('')}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 if(n.properties.x_chen?.derived)out=out.replace(/stroke-width="1.8"/g,'stroke-width="1.8" stroke-dasharray="6 4"');
 if(n.properties.x_chen?.weak||n.properties.x_chen?.identifying){const inset=7*s,inner={...g,x:x+inset,y:y+inset,w:w-2*inset,h:h-2*inset};out+=`<path d="${polygon(inner).map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join('')}Z" fill="none" stroke="${ink}" stroke-width="1.5"/>`;}
 if(n.properties.x_chen?.multivalued)out+=`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2-6*s}" ry="${h/2-6*s}" fill="none" stroke="${ink}" stroke-width="1.5"/>`;
 if(shape==='subprocess')out+=line(x+15*s,y,x+15*s,y+h)+line(x+w-15*s,y,x+w-15*s,y+h);
 if(shape==='component')out+=`<rect x="${x+w-40*s}" y="${y+13*s}" width="${23*s}" height="${25*s}" fill="${fill}" stroke="${ink}"/><rect x="${x+w-45*s}" y="${y+17*s}" width="${10*s}" height="${6*s}" fill="${fill}" stroke="${ink}"/><rect x="${x+w-45*s}" y="${y+29*s}" width="${10*s}" height="${6*s}" fill="${fill}" stroke="${ink}"/>`;
 if(g.extensionPoints){const yy=y+h*.35;out+=lines(g.titleLines,x+w/2,yy,16,600)+line(x+w*.16,y+h*.50,x+w*.84,y+h*.50)+text(x+w/2,y+h*.50+20*s,'extension points',11,600,'text-anchor="middle"')+lines(g.extensionPoints,x+w/2,y+h*.50+42*s,12,400);}
 else if(n.kind==='dfd.process'&&p.projection.profile==='dfd.gane_sarson@1'){
  const num=n.properties.x_diagram?.number||'',owner=n.properties.x_diagram?.owner||'Process';out+=line(x,y+30*s,x+w,y+30*s)+line(x,y+h-30*s,x+w,y+h-30*s)+text(x+15*s,y+21*s,num,12,600)+text(x+15*s,y+h-10*s,owner,11);out+=lines(g.titleLines,x+w/2,y+h/2-(g.titleLines.length-1)*10.5*s+5*s);
 }else if(['uml.class','uml.interface'].includes(n.kind)){
  out+=text(x+w/2,y+20*s,n.kind==='uml.interface'?'«interface»':'«class»',11,500,'text-anchor="middle"')+lines(g.titleLines,x+w/2,y+45*s,16,650);
  for(const c of g.compartments||[])out+=line(x,y+c.top,x+w,y+c.top)+text(x+13*s,y+c.top+17*s,c.label,10,500);
  for(const r of g.fieldRows){const m=r.field.properties.x_member||{},extra=`${m.static?'text-decoration="underline"':''} ${m.abstract?'font-style="italic"':''}`;out+=`<g class="ddn-field" data-member="${esc(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,extra)+lines(r.detailLines,x+16*s,y+r.top+r.labelLines.length*18*s+17*s,11.5,400,'')+'</g>';}
 }else if(n.kind==='req.requirement'){
  out+=text(x+14*s,y+21*s,'«requirement» '+n.properties.x_diagram.code,11,600)+lines(g.titleLines,x+14*s,y+45*s,16,650,'')+line(x,y+68*s,x+w,y+68*s)+lines(g.requirement,x+14*s,y+90*s,13,400,'');
 }else if(g.fieldRows.length){
  out+=lines(g.titleLines,x+16*s,y+31*s,16,600,'')+line(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s);for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,'')+'</g>';
 }else{
  let yy=y+h/2-(g.titleLines.length-1)*10.5*s+5*s;if(shape==='package')yy+=10*s;
  out+=lines(g.titleLines,x+w/2+(shape==='store'&&p.projection.profile!=='dfd.yourdon@1'?12*s:0),yy,16,600,n.properties.key||n.properties.x_chen?.key?'text-anchor="middle" text-decoration="underline"':'text-anchor="middle"');
 }
 if(n.properties.x_chen?.partial_key){const tw=Math.min(w*.8,Text.measure(n.name,16*s,p.style.font,600).width);out+=`<path d="M${x+w/2-tw/2} ${y+h/2+11*s}h${tw}" stroke="${ink}" fill="none" stroke-dasharray="4 3"/>`;}
 if(n.properties.x_continuation)out+=text(x+w/2,y+h-13*s,n.properties.x_continuation.key+' / '+n.properties.x_continuation.side,11,650,'text-anchor="middle"');
 return out+'</g>';
}
return{VERSION:'0.6.0-beta.1',measure,render,anchor,polygon,shapeOf,segmentInterior};
});
