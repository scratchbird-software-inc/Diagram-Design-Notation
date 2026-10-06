/* SPDX-License-Identifier: GPL-2.0-or-later. Composable profile outlines with measured compartments and contour attachments. */
import {publishNamespace} from './ddn-module-registry.js';
import Sketch from './ddn-sketch.js';
import Text from './ddn-text.js';
import Palette from './ddn-palette.js';
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const f=x=>Math.round(x*1000)/1000;
const slug=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
function shapeOf(k,p){if(k.keyword==='dfd.process')return p.projection?.profile==='dfd.yourdon@1'?'circle':'round';
 /* B1-063: BPMN 2.0.2 profiles render event kinds as rings; bpmn.basic@1 keeps
  * its stadium markers. */
 if(/^bpmn\.(process|choreography|conversation)@/.test(p.projection?.profile||'')&&['flow.start','flow.intermediate','flow.end'].includes(k.keyword))return 'bpmevent';
 return k.silhouette;}
function measure(g,p){
 const s=g.scale,n=g.n,k=g.k;g.silhouette=shapeOf(k,p);
 /* 0.8 (chapter 04 §6A): per-element label text properties — profile
  * silhouettes measure and paint their name labels with the resolved record
  * (view style.text < element text { }), exactly like the plain rect path. */
 const labelTs=Text.mergeSpec(p.style?.text,n.properties?.text);
 if(n.properties?.text)g.labelSpec=n.properties.text;
 const compact=['ellipse','circle','diamond','bpmevent','choreotask','groupbox','dataobject','datainput','dataoutput','caseplan','userevent','actor','terminal','parallelogram','document','store','subprocess','round','hexagon','sendpent','acceptpent','hourglass','flowfinal'].includes(g.silhouette);
 if(compact&&!n.fields.length){
  const proportion=g.silhouette==='diamond'?.60:['ellipse','circle'].includes(g.silhouette)?.68:.78;
  g.titleLines=Text.wrap(n.name,g.w*proportion,16*s,p.style.font,labelTs?.weight??600,labelTs);
  g.h=Math.max(g.h,(g.titleLines.length*21+55)*s*(g.silhouette==='diamond'?1.55:1));
  if(g.silhouette==='circle'){g.w=Math.max(g.w,g.h);g.h=g.w;}
  if(g.silhouette==='actor')g.h=Math.max(g.h,(140+g.titleLines.length*21)*s);
  g.fieldRows=[];
 }
 if(['uml.class','uml.interface','uml.enumeration','uml.metaclass','uml.stereotype'].includes(n.kind)){
  const list=g.fieldRows.slice().sort((a,b)=>(a.field.properties.x_member?.kind==='operation')-(b.field.properties.x_member?.kind==='operation'));
  let y=70*s,last=null;const div=[];
  for(const row of list){const m=row.field.properties.x_member||{},type=m.kind||(n.kind==='uml.enumeration'?'literal':'attribute');if(type!==last){div.push({top:y,label:type==='operation'?'OPERATIONS':type==='literal'?'LITERALS':'ATTRIBUTES'});y+=25*s;last=type;}
   const prefix={public:'+',private:'−',protected:'#',package:'~'}[m.visibility]||'';
   const xp=row.field.properties.x_part;
   const adorned=(m.derived?'/':'')+row.field.name+(xp?(xp.classifier?': '+xp.classifier:'')+(xp.multiplicity?' ['+xp.multiplicity+']':''):'')+(m.multiplicity?' ['+m.multiplicity+']':'')+(m.modifiers?.length?' {'+m.modifiers.join(', ')+'}':'');
   row.labelLines=Text.wrap((prefix?prefix+' ':'')+adorned,g.w-32*s,13.5*s,p.style.font,400);row.top=y;row.h=Math.max(row.h,(row.labelLines.length*18+row.detailLines.length*16+10)*s);y+=row.h;
  }
  g.fieldRows=list;g.compartments=div;g.h=Math.max(g.h,y+20*s);g.headerH=70*s;
 }
 if(n.kind==='req.requirement'){
  g.requirement=Text.wrap(n.properties.x_diagram?.text||'',g.w-32*s,13*s,p.style.font);g.h=Math.max(g.h,(95+g.requirement.length*19)*s);
 }
 /* B1-065 : SysML block-family compartments and keyword headers.
  * Opt-in per profile (@2) and per x_block field property, so sysml.*@1
  * fixtures render byte-identically. */
 const SYSML2=/^sysml\.(bdd|ibd|parametric)@2$/.test(p.projection?.profile||'');
 const SYSML_KW={'sysml.block':'block','sysml.interfaceblock':'interfaceBlock','sysml.flowspec':'flowSpecification','sysml.valuetype':'valueType','sysml.constraint':'constraint','sysml.testcase':'testCase'};
 if(SYSML_KW[n.kind]&&(SYSML2||n.kind==='sysml.testcase')){
  g.sysmlKeyword=SYSML_KW[n.kind];
  if(n.fields.length){
   const ORDER=['values','parts','references','operations','constraints'];
   const list=g.fieldRows.slice().sort((a,b)=>ORDER.indexOf(a.field.properties.x_block?.compartment||(n.kind==='sysml.constraint'?'constraints':'values'))-ORDER.indexOf(b.field.properties.x_block?.compartment||(n.kind==='sysml.constraint'?'constraints':'values')));
   let y=70*s,last=null;const div=[];
   for(const row of list){const comp=row.field.properties.x_block?.compartment||(n.kind==='sysml.constraint'?'constraints':'values');
    const xu=row.field.properties.x_unit;
    const adorned=row.field.name+(xu?': '+xu.unit:'');
    row.labelLines=Text.wrap(adorned,g.w-32*s,13.5*s,p.style.font,400);
    if(comp!==last){div.push({top:y,label:comp});y+=25*s;last=comp;}
    row.top=y;row.h=Math.max(row.h,(row.labelLines.length*18+row.detailLines.length*16+10)*s);y+=row.h;
   }
   g.fieldRows=list;g.compartments=div;g.h=Math.max(g.h,y+20*s);
  }
  g.headerH=70*s;
 }
 /* B1-072 : SoaML kind keywords — header only (no compartments);
  * servicecontract renders the collaboration glyph (see the collab branch). */
 const SOAML_KW={'soaml.participant':'participant','soaml.agent':'agent','soaml.serviceinterface':'ServiceInterface','soaml.servicecontract':'ServiceContract','soaml.capability':'capability','soaml.message':'message','soaml.milestone':'milestone'};
 if(SOAML_KW[n.kind]){
  g.sysmlKeyword=SOAML_KW[n.kind];g.headerH=70*s;
 }
 /* B1-072 : UAF 1.2 domain vocabulary — keyword headers. */
 /* B1-083: SDL — flag shapes carry their name; keyword headers on the rest. */
 const SDL_KW={'sdl.block':'block','sdl.agent':'agent','sdl.signalset':'signalset','sdl.procedure':'procedure'};
 if(SDL_KW[n.kind]){g.sysmlKeyword=SDL_KW[n.kind];g.headerH=70*s;}
  const UAF_KW={'uaf.capability':'Capability','uaf.enterprisegoal':'EnterpriseGoal','uaf.enterprisevision':'EnterpriseVision','uaf.strategicphase':'StrategicPhase','uaf.opperformer':'OperationalPerformer','uaf.opactivity':'OperationalActivity','uaf.opnode':'OperationalNode','uaf.opexchange':'OperationalExchange','uaf.servicespec':'ServiceSpecification','uaf.servicefunction':'ServiceFunction','uaf.servicepolicy':'ServicePolicy','uaf.system':'System','uaf.systemfunction':'SystemFunction','uaf.implementer':'Implementer','uaf.person':'Person','uaf.organization':'Organization','uaf.post':'Post','uaf.responsibility':'Responsibility','uaf.resourceperformer':'ResourcePerformer','uaf.resource':'Resource','uaf.resourcefunction':'ResourceFunction','uaf.technology':'Technology','uaf.securityelement':'SecurityElement','uaf.securitycontrol':'SecurityControl','uaf.threat':'Threat','uaf.asset':'Asset','uaf.project':'Project','uaf.projectmilestone':'ProjectMilestone','uaf.workpackage':'WorkPackage','uaf.standard':'Standard','uaf.standardcollection':'StandardCollection','uaf.protocol':'Protocol','uaf.actualresource':'ActualResource','uaf.actualorganization':'ActualOrganization','uaf.actualperson':'ActualPerson','uaf.dictionaryentry':'DictionaryEntry','uaf.archdesc':'ArchitectureDescription','uaf.viewpoint':'Viewpoint','uaf.modelref':'ModelReference'};
 if(UAF_KW[n.kind]){g.sysmlKeyword=UAF_KW[n.kind];g.headerH=70*s;}
 /* B1-080: ORM role boxes — fact types lay their fields out as a horizontal
  * row of role boxes instead of vertical field rows. */
 if(n.kind==='orm.facttype'&&n.fields.length){
  const widths=n.fields.map(f=>Math.max(60*s,Text.measure(f.name,12*s,p.style.font,500).width+20*s));
  g.roleRow={fields:n.fields,widths};
  g.w=Math.max(g.w,widths.reduce((a,b)=>a+b,0)+24*s);
  g.h=Math.max(g.h,120*s);
  g.headerH=70*s;
 }
 /* B1-066 : DMN boxed-expression presentation — text rows in a
  * bottom compartment. Display only; the text is never parsed or evaluated. */
 if(['dmn.decision','dmn.bkm','dmn.decisionservice'].includes(n.kind)&&n.properties.x_boxed){
  const xb=n.properties.x_boxed,rows=[...(xb.text?[xb.text]:[]),...(xb.entries||[]).map(e=>(e.name?e.name+': ':'')+e.text)];
  const wrapped=rows.flatMap(r=>Text.wrap(r,g.w-32*s,12.5*s,p.style.font,400));
  g.boxedRows=wrapped;g.boxedH=wrapped.length*18*s+(rows.length?16*s:0);
  g.h=Math.max(g.h,g.h+24*s+g.boxedH);
 }
 if(['initial','final'].includes(g.silhouette)){g.w=Math.max(125*s,Text.measure(n.name,12*s,p.style.font,labelTs?.weight??400,labelTs).width+24*s);g.h=85*s;g.fieldRows=[];g.titleLines=[n.name];}
 /* B1-057 : pseudostate glyphs are small fixed markers with the name
  * below; states with activities/internal transitions/submachine grow a
  * compartment under the name. */
 if(['junction','choice','entrypoint','exitpoint','terminate','history','forkbar','hourglass','flowfinal'].includes(g.silhouette)){g.w=Math.max(110*s,Text.measure(n.name,12*s,p.style.font,labelTs?.weight??400,labelTs).width+24*s);g.h=85*s;g.fieldRows=[];g.titleLines=[n.name];}
 if(n.kind==='state.state'){const x=n.properties.x_state||{};
  const acts=[...['entry','exit','do'].filter(k=>x[k]).map(k=>k+' / '+x[k]),...(x.internal||[])];
  if(acts.length||x.submachine){g.stateActs=acts;g.submachine=x.submachine;
   g.w=Math.max(g.w,220*s,...acts.map(a=>Text.measure(a,12.5*s,p.style.font,400).width+40*s));
   g.h=Math.max(g.h,(100+acts.length*20+(x.submachine?24:0))*s);}
 }
 if(n.kind==='uml.usecase'&&n.properties.x_usecase?.extension_points?.length){g.extensionPoints=n.properties.x_usecase.extension_points;g.w=Math.max(g.w,320*s);g.h=Math.max(g.h,(110+g.extensionPoints.length*20)*s);}
 /* CMMN planning table: an expanded table attaches above its task/stage, never
  * over its body. Reserve a top band in the node's own box so layout, frames
  * and overlap inspection all account for it; render() draws the table there
  * and shifts the task body below it. */
 const xp=n.properties.x_planning;
 if(xp?.items?.length){
  const pw=Math.max(g.w,Math.max(...xp.items.map(it=>Text.measure(it,10.5*s,p.style.font,400).width))+24*s),ph=xp.items.length*16*s+24*s;
  g.w=Math.max(g.w,pw);g.planningH=ph+8*s;g.h+=g.planningH;
 }
 return g;
}
/* Small-marker silhouettes paint a glyph much smaller than the node box (the
 * box exists to carry the name below the glyph). Routing, clipping and
 * interior tests must target the painted glyph, not the box, or edges stop
 * in mid-air around BPMN events, CMMN listeners, UML pseudostates and flow
 * finals. Mirrors the render branches below exactly (centres and radii).
 * forkbar stays box-attached on purpose: its painted bar is 8px tall, so two
 * same-side endpoints would clamp within the 12px lane clearance and seal
 * each other's escape corridor (DDN215); the box edge keeps their stubs at
 * lane distance. */
function markerOutline(g){
 const {x,y,w,h,silhouette:t,scale:s}=g,cx=x+w/2;
 switch(t){
  case 'bpmevent':return{cx,cy:y+h/2-10*s,r:16*s};
  case 'userevent':return{cx,cy:y+h/2-8,r:15*s};
  case 'flowfinal':return{cx,cy:y+h/2-8,r:11*s};
  case 'junction':return{cx,cy:y+h/2-8,r:7*s};
  case 'entrypoint':case 'exitpoint':return{cx,cy:y+h/2-8,r:9*s};
  case 'history':return{cx,cy:y+h/2-8,r:12*s};
  case 'choice':return{cx,cy:y+h/2-8,r:12*s,diamond:true};
  case 'terminate':return{cx,cy:y+h/2-8,r:8*s};
  case 'hourglass':return{cx,cy:y+h/2,hw:Math.min(w/2,26*s),hh:Math.min(h/2,20*s)};
 }
 return null;
}
function polygon(g){const{x,y,w,h,silhouette:t}=g;
 if(['initial','final'].includes(t)){const ps=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;ps.push([x+w/2+12*g.scale*Math.cos(a),y+h/2-8*g.scale+12*g.scale*Math.sin(a)]);}return ps;}
 const mk=markerOutline(g);
 if(mk){
  if(mk.diamond)return[[mk.cx,mk.cy-mk.r],[mk.cx+mk.r,mk.cy],[mk.cx,mk.cy+mk.r],[mk.cx-mk.r,mk.cy]];
  if(mk.r!=null){const ps=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;ps.push([mk.cx+mk.r*Math.cos(a),mk.cy+mk.r*Math.sin(a)]);}return ps;}
  return[[mk.cx-mk.hw,mk.cy-mk.hh],[mk.cx+mk.hw,mk.cy-mk.hh],[mk.cx+mk.hw,mk.cy+mk.hh],[mk.cx-mk.hw,mk.cy+mk.hh]];
 }
 if(t==='offpage')return[[x,y],[x+w,y],[x+w,y+h*.7],[x+w/2,y+h],[x,y+h*.7]];
 if(t==='sendpent')return[[x,y],[x+w*.82,y],[x+w,y+h/2],[x+w*.82,y+h],[x,y+h]];
 if(t==='acceptpent')return[[x,y],[x+w,y],[x+w*.82,y+h/2],[x+w,y+h],[x,y+h],[x+w*.18,y+h/2]];
 if(t==='diamond')return[[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
 if(t==='hexagon')return[[x+w*.25,y],[x+w*.75,y],[x+w,y+h/2],[x+w*.75,y+h],[x+w*.25,y+h],[x,y+h/2]];
 if(t==='manualinput')return[[x,y+h*.35],[x+w,y],[x+w,y+h],[x,y+h]];
 if(t==='manualop')return[[x,y],[x+w,y],[x+w*.84,y+h],[x+w*.16,y+h]];
 if(t==='burst'){const ps=[],cx=x+w/2,cy=y+h/2;for(let i=0;i<16;i++){const a=i/16*Math.PI*2-Math.PI/2,r=i%2?Math.min(w,h)*.22:Math.min(w,h)*.48;ps.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}return ps;}
if(t==='triangledown')return[[x,y],[x+w,y],[x+w/2,y+h]];
 if(t==='triangleup')return[[x+w/2,y],[x+w,y+h],[x,y+h]];
 if(t==='card')return[[x+12*g.scale,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y+12*g.scale]];
 if(t==='parallelogram')return[[x+w*.16,y],[x+w,y],[x+w*.84,y+h],[x,y+h]];
 if(t==='package')return[[x,y],[x+w*.43,y],[x+w*.49,y+20],[x+w,y+20],[x+w,y+h],[x,y+h]];
 if(t==='document'){const ps=[[x,y],[x+w,y],[x+w,y+h-14]];for(let i=1;i<=24;i++){const t=i/24;ps.push([x+w*(1-t),y+h-14+12*Math.sin(t*Math.PI*2)]);}return ps;}
 if(t==='actor'){const z=g.scale,cx=x+w/2;return [[cx,y+9*z],[cx+14*z,y+23*z],[cx+14*z,y+40*z],[cx+32*z,y+59*z],[cx+3*z,y+70*z],[cx+28*z,y+127*z],[cx,y+100*z],[cx-28*z,y+127*z],[cx-3*z,y+70*z],[cx-32*z,y+59*z],[cx-14*z,y+40*z],[cx-14*z,y+23*z]];}
 if(['ellipse','circle','collab'].includes(t)){const ps=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;ps.push([x+w/2+Math.cos(a)*w/2,y+h/2+Math.sin(a)*h/2]);}return ps;}
 return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
}
function anchor(g,side,point){
 const {x,y,w,h,silhouette:t}=g;if(!t)return point;
 let px=point[0],py=point[1];const cx=x+w/2,cy=y+h/2;
 if(['initial','final'].includes(t)){const a={east:0,south:Math.PI/2,west:Math.PI,north:-Math.PI/2}[side];return [f(cx+12*g.scale*Math.cos(a)),f(cy-8*g.scale+12*g.scale*Math.sin(a))];}
 const mk=markerOutline(g);
 if(mk){
  /* Slot-preserving contour attachment (same idiom as the ellipse and
   * diamond branches below): the endpoint ordering slot's spread coordinate
   * stays, the approach coordinate moves from the box edge onto the painted
   * glyph outline. Ray-casting instead would drag slots off their lanes and
   * congest escape corridors when several relations share a side. */
  if(mk.diamond){
   if(side==='east'||side==='west'){py=Math.max(mk.cy-mk.r*.9,Math.min(mk.cy+mk.r*.9,py));px=mk.cx+(side==='east'?1:-1)*mk.r*(1-Math.abs(py-mk.cy)/mk.r);}
   else{px=Math.max(mk.cx-mk.r*.9,Math.min(mk.cx+mk.r*.9,px));py=mk.cy+(side==='south'?1:-1)*mk.r*(1-Math.abs(px-mk.cx)/mk.r);}
  }else if(mk.r!=null){
   if(side==='east'||side==='west'){py=Math.max(mk.cy-.94*mk.r,Math.min(mk.cy+.94*mk.r,py));const dy=Math.abs((py-mk.cy)/mk.r);px=mk.cx+(side==='east'?1:-1)*mk.r*Math.sqrt(1-dy*dy);}
   else{px=Math.max(mk.cx-.94*mk.r,Math.min(mk.cx+.94*mk.r,px));const dx=Math.abs((px-mk.cx)/mk.r);py=mk.cy+(side==='south'?1:-1)*mk.r*Math.sqrt(1-dx*dx);}
  }else{
   px=side==='east'?mk.cx+mk.hw:side==='west'?mk.cx-mk.hw:Math.max(mk.cx-mk.hw,Math.min(mk.cx+mk.hw,px));
   py=side==='south'?mk.cy+mk.hh:side==='north'?mk.cy-mk.hh:Math.max(mk.cy-mk.hh,Math.min(mk.cy+mk.hh,py));
  }
  return[f(px),f(py)];
 }
 if(['ellipse','circle','collab'].includes(t)){
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
 if(['ellipse','circle','collab'].includes(g.silhouette)){
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
 let planning=null;
 if(g.planningH){planning={x:g.x,y:g.y,w:g.w,h:g.planningH-8*g.scale,items:g.n.properties.x_planning.items};g={...g,y:g.y+g.planningH,h:g.h-g.planningH};}
 let {n,k,x,y,w,h}=g;const s=g.scale,look=p.style.look,shape=g.silhouette,mono=p.style.theme==='neutral'||p.theme08==='mono_print',monoPrint=p.theme08==='mono_print',nc=Palette.node(k,theme),fg=monoPrint?'#000000':nc.text;
 /* 0.8 (chapter 04 §6B): portable element outline/fill on profile
  * silhouettes — color and fill ride the shared palette channels (ink/fill);
  * weight and dash are plain-card-silhouette properties this revision
  * (silhouette paint strings bake their registered widths). Monochrome
  * themes keep their B/W contract. */
 let ink=monoPrint?'#000000':mono?'#333333':nc.ink,fill=monoPrint?'#FFFFFF':mono?'#FAFAFA':nc.fill;
 if(!mono&&!monoPrint){const st=n.properties?.stroke;if(st?.color)ink=st.color;if(n.properties?.fill)fill=n.properties.fill;}
 const opt={...p.style,id:n.id,stroke:ink,fill,width:1.8};
 const line=(x1,y1,x2,y2,width=1)=>look==='handDrawn'?Sketch.polyline([[x1,y1],[x2,y2]],{...opt,id:n.id+':line:'+x1+':'+y1,width,hachure:false}):`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" fill="none" stroke="${ink}" stroke-width="${width}"/>`;
 /* B1-074 : shapes-detail (thumbnails) suppresses every text run. */
 const shapesOnly=p.detail==='shapes';
 /* 0.8 (chapter 04 §6A): view-wide style.text decorates every painted run;
  * the element's own text { } decorates its name/title lines only. With no
  * text properties the output is byte-identical to before. */
 const viewTs=p.style.text||null;
 const labelTs=g.labelSpec?Text.mergeSpec(viewTs,g.labelSpec):null;
 const labelSet=labelTs?new Set([n.name,...(g.titleLines||[])]):null;
 const text=(xx,yy,txt,size=13,weight=400,extra='')=>{if(shapesOnly)return'';const ts=labelSet?.has(txt)?labelTs:viewTs;const w=ts?.weight??weight,fil=ts?.color??fg;Text.measure(txt,size*s,p.style.font,w,ts);return `<text x="${f(xx)}" y="${f(yy)}" font-size="${size*s}" fill="${fil}" font-weight="${w}"${ts?Text.paintAttrs(ts):''} ${extra}>${esc(txt)}</text>`;};
 const lines=(ls,xx,yy,size=16,weight=600,extra='text-anchor="middle"')=>ls.map((v,i)=>text(xx,yy+i*(size+5)*s,v,size,weight,extra)).join('');
 let out=`<g class="ddn-node ddn-kind-${slug(k.code)}" data-id="${esc(n.id)}" data-ddn-id="${esc(n.id)}" data-shape="${esc(shape)}" tabindex="0" role="group" aria-label="${esc(n.name)}"><title>${esc(n.name+' — '+k.name)}</title>`;
 if(planning)out+=`<g class="ddn-planning-table"><rect x="${f(planning.x)}" y="${f(planning.y)}" width="${f(planning.w)}" height="${f(planning.h)}" fill="${fill}" stroke="${ink}" stroke-width="1.3" stroke-dasharray="5 4"/>`+text(planning.x+8*s,planning.y+18*s,'Planning',10,650,'')+planning.items.map((it,i)=>text(planning.x+8*s,planning.y+(36+i*16)*s,it,10.5,400,'')).join('')+'</g>';
 if(['initial','final'].includes(shape)){
  const cx=x+w/2,cy=y+h/2-8,r=12*s;
  if(shape==='initial')out+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>`;
  else out+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r*.65}" fill="${ink}"/>`;
  out+=text(cx,y+h-5*s,n.name,12,600,'text-anchor="middle"');return out+'</g>';
 }
 /* B1-057 : UML pseudostate markers. */
 if(['junction','choice','entrypoint','exitpoint','terminate','history','forkbar'].includes(shape)){
  const cx=x+w/2,cy=y+h/2-8,r=12*s;
  if(shape==='junction')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(7*s)}" fill="${ink}"/>`;
  else if(shape==='choice')out+=`<path d="M${f(cx)} ${f(cy-r)}L${f(cx+r)} ${f(cy)}L${f(cx)} ${f(cy+r)}L${f(cx-r)} ${f(cy)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  else if(shape==='entrypoint')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(9*s)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  else if(shape==='exitpoint')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(9*s)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/><path d="M${f(cx-4.5*s)} ${f(cy-4.5*s)}L${f(cx+4.5*s)} ${f(cy+4.5*s)}M${f(cx+4.5*s)} ${f(cy-4.5*s)}L${f(cx-4.5*s)} ${f(cy+4.5*s)}" stroke="${ink}" stroke-width="1.6"/>`;
  else if(shape==='terminate')out+=`<path d="M${f(cx-8*s)} ${f(cy-8*s)}L${f(cx+8*s)} ${f(cy+8*s)}M${f(cx+8*s)} ${f(cy-8*s)}L${f(cx-8*s)} ${f(cy+8*s)}" stroke="${ink}" stroke-width="2.2"/>`;
  else if(shape==='history')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`+text(cx,cy+4.5*s,k.keyword==='state.history_deep'?'H*':'H',13,650,'text-anchor="middle"');
  else if(shape==='forkbar')out+=`<rect x="${f(cx-32*s)}" y="${f(cy-4*s)}" width="${f(64*s)}" height="${f(8*s)}" rx="${f(2*s)}" fill="${ink}"/>`;
  out+=text(cx,y+h-5*s,n.name,12,600,'text-anchor="middle"');return out+'</g>';
 }
 /* B1-064: CMMN 1.1 — case plan clipboard, user event listener, case file
  * (reuses the dataobject fold), and x_cmmn/x_planning decorators. */
 if(shape==='caseplan'){
  const tw=w*.62,th=24*s;
  out+=`<rect x="${f(x)}" y="${f(y+th)}" width="${f(w)}" height="${f(h-th)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=`<path d="M${f(x)} ${f(y+th)}V${f(y)}H${f(x+tw)}L${f(x+tw+8*s)} ${f(y+th)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=lines(g.titleLines,x+w/2,y+th+26*s,15,650);
  return out+'</g>';
 }
 if(shape==='userevent'){
  const cx=x+w/2,cy=y+h/2-8,r=15*s;
  out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r-3.5*s)}" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  out+=`<circle cx="${f(cx)}" cy="${f(cy-3.5*s)}" r="${f(2.6*s)}" fill="none" stroke="${ink}" stroke-width="1.5"/><path d="M${f(cx-4*s)} ${f(cy+5*s)}Q${f(cx)} ${f(cy-1*s)} ${f(cx+4*s)} ${f(cy+5*s)}" fill="none" stroke="${ink}" stroke-width="1.5"/>`;
  out+=text(cx,y+h-4*s,n.name,12,600,'text-anchor="middle"');return out+'</g>';
 }
 /* B1-066 : DMN silhouettes — BKM is a rect with the top corners
  * clipped; the decision service is a rect with a divider band under the
  * name (the collapsed form). */
 if(shape==='clippedcorner'){
  const c=10*s;
  out+=`<path d="M${f(x+c)} ${f(y)}H${f(x+w-c)}L${f(x+w)} ${f(y+c)}V${f(y+h-c)}L${f(x+w-c)} ${f(y+h)}H${f(x+c)}L${f(x)} ${f(y+h-c)}V${f(y+c)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=lines(g.titleLines,x+w/2,y+30*s,16,650);
  if(g.boxedRows?.length){const by=y+h-g.boxedH-8*s;out+=line(x,by-10*s,x+w,by-10*s)+g.boxedRows.map((v,i)=>text(x+14*s,by+8*s+i*18*s,v,12.5,400,'')).join('');}
  return out+'</g>';
 }
 if(n.kind==='dmn.decisionservice'){
  out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=line(x,y+44*s,x+w,y+44*s,2.2);
  out+=lines(g.titleLines,x+w/2,y+30*s,15,650);
  if(g.boxedRows?.length){const by=y+60*s;out+=g.boxedRows.map((v,i)=>text(x+14*s,by+8*s+i*18*s,v,12.5,400,'')).join('');}
  return out+'</g>';
 }
 /* B1-066 : plain dmn.decision — rect with optional boxed rows. */
 if(n.kind==='dmn.decision'){
  out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=lines(g.titleLines,x+w/2,y+30*s,16,650);
  if(g.boxedRows?.length){const by=y+h-g.boxedH-8*s;out+=line(x,by-10*s,x+w,by-10*s)+g.boxedRows.map((v,i)=>text(x+14*s,by+8*s+i*18*s,v,12.5,400,'')).join('');}
  return out+'</g>';
 }
 /* B1-063: BPMN 2.0.2 decorator layer — event rings + trigger icons, data
  * documents, choreography bands, group artifacts. Driven by the extension
  * contracts (x_event/x_activity/x_io/x_bands), not profile ids, so other
  * notations (CMMN) can reuse the layer. */
 function triggerIcon(type,cx,cy,r,ink){
  const u=r/8;
  switch(type){
   case 'message':return `<rect x="${f(cx-4*u)}" y="${f(cy-3*u)}" width="${f(8*u)}" height="${f(6*u)}" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M${f(cx-4*u)} ${f(cy-3*u)}L${f(cx)} ${f(cy+0.5*u)}L${f(cx+4*u)} ${f(cy-3*u)}" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
   case 'timer':return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(4*u)}" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M${f(cx)} ${f(cy)}V${f(cy-2.6*u)}M${f(cx)} ${f(cy)}L${f(cx+1.8*u)} ${f(cy+1*u)}" stroke="${ink}" stroke-width="1.4" fill="none"/>`;
   case 'signal':return `<path d="M${f(cx)} ${f(cy-4*u)}L${f(cx+3.5*u)} ${f(cy+2.5*u)}L${f(cx-3.5*u)} ${f(cy+2.5*u)}Z" fill="${ink}"/>`;
   case 'error':return `<path d="M${f(cx+1.5*u)} ${f(cy-4.5*u)}L${f(cx-2*u)} ${f(cy+0.5*u)}L${f(cx+0.5*u)} ${f(cy+0.5*u)}L${f(cx-1.5*u)} ${f(cy+4.5*u)}L${f(cx+2*u)} ${f(cy-1*u)}L${f(cx-0.5*u)} ${f(cy-1*u)}Z" fill="${ink}"/>`;
   case 'escalation':return `<path d="M${f(cx-3*u)} ${f(cy+2.5*u)}L${f(cx)} ${f(cy-2.5*u)}L${f(cx+3*u)} ${f(cy+2.5*u)}" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M${f(cx-3*u)} ${f(cy+4*u)}L${f(cx)} ${f(cy-1*u)}L${f(cx+3*u)} ${f(cy+4*u)}" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
   case 'compensation':return `<path d="M${f(cx-4*u)} ${f(cy-3*u)}L${f(cx-4*u)} ${f(cy+3*u)}L${f(cx-0.5*u)} ${f(cy)}Z" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M${f(cx)} ${f(cy-3*u)}L${f(cx)} ${f(cy+3*u)}L${f(cx+3.5*u)} ${f(cy)}Z" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
   case 'conditional':return `<rect x="${f(cx-3.5*u)}" y="${f(cy-3.5*u)}" width="${f(7*u)}" height="${f(7*u)}" fill="none" stroke="${ink}" stroke-width="1.3"/><path d="M${f(cx-2*u)} ${f(cy-1.5*u)}H${f(cx+2*u)}M${f(cx-2*u)} ${f(cy)}H${f(cx+2*u)}M${f(cx-2*u)} ${f(cy+1.5*u)}H${f(cx+2*u)}" stroke="${ink}" stroke-width="1.2" fill="none"/>`;
   case 'link':return `<path d="M${f(cx-3.5*u)} ${f(cy+2.5*u)}L${f(cx+2.5*u)} ${f(cy-3.5*u)}" stroke="${ink}" stroke-width="1.6" fill="none"/><path d="M${f(cx+0.5*u)} ${f(cy-3.5*u)}H${f(cx+2.5*u)}V${f(cy-1.5*u)}" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
   case 'terminate':return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(3.6*u)}" fill="${ink}"/>`;
   case 'cancel':return `<path d="M${f(cx-3*u)} ${f(cy-3*u)}L${f(cx+3*u)} ${f(cy+3*u)}M${f(cx+3*u)} ${f(cy-3*u)}L${f(cx-3*u)} ${f(cy+3*u)}" stroke="${ink}" stroke-width="1.8" fill="none"/>`;
   case 'multiple':return `<path d="M${f(cx-3.5*u)} ${f(cy-3.5*u)}L${f(cx+3.5*u)} ${f(cy+3.5*u)}M${f(cx+3.5*u)} ${f(cy-3.5*u)}L${f(cx-3.5*u)} ${f(cy+3.5*u)}" stroke="${ink}" stroke-width="1.3" fill="none"/><path d="M${f(cx)} ${f(cy-4*u)}L${f(cx+3*u)} ${f(cy)}L${f(cx)} ${f(cy+4*u)}L${f(cx-3*u)} ${f(cy)}Z" fill="none" stroke="${ink}" stroke-width="1.3"/>`;
   case 'parallel_multiple':return `<path d="M${f(cx-3.5*u)} ${f(cy-2*u)}H${f(cx+3.5*u)}M${f(cx-3.5*u)} ${f(cy+2*u)}H${f(cx+3.5*u)}" stroke="${ink}" stroke-width="1.8" fill="none"/>`;
   default:return '';
  }
 }
 if(shape==='bpmevent'){
  const xe=n.properties.x_event||{},cx=x+w/2,cy=y+h/2-10*s,r=16*s;
  const pos=xe.position||(n.kind==='flow.start'?'start':n.kind==='flow.end'?'end':'intermediate');
  const dash=xe.position==='boundary'&&xe.interrupting===false?' stroke-dasharray="4 3"':'';
  if(pos==='end')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="${f(3.6*s)}"${dash}/>`;
  else{out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="1.8"${dash}/>`;
   if(pos==='intermediate')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r-3.5*s)}" fill="none" stroke="${ink}" stroke-width="1.4"${dash}/>`;}
  out+=`<g class="ddn-trigger" data-trigger="${esc(xe.type||'none')}">`+triggerIcon(xe.type||'none',cx,cy,r-4*s,ink)+'</g>';
  out+=text(cx,y+h-4*s,n.name,12,600,'text-anchor="middle"');return out+'</g>';
 }
 if(['dataobject','datainput','dataoutput'].includes(shape)){
  const ear=12*s;
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w-ear)}L${f(x+w)} ${f(y+ear)}V${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
  out+=line(x+w-ear,y,x+w-ear,y+ear,1.2)+line(x+w-ear,y+ear,x+w,y+ear,1.2);
  const ay=y+h-14*s;
  if(shape==='datainput')out+=`<path d="M${f(x+w/2)} ${f(ay-8*s)}L${f(x+w/2-4*s)} ${f(ay)}H${f(x+w/2+4*s)}Z" fill="${ink}"/>`;
  if(shape==='dataoutput')out+=`<path d="M${f(x+w/2)} ${f(ay+2*s)}L${f(x+w/2-4*s)} ${f(ay-6*s)}H${f(x+w/2+4*s)}Z" fill="${ink}"/>`;
  if(n.properties.x_io?.set)out+=`<path d="M${f(x+w/2-6*s)} ${f(y+10*s)}H${f(x+w/2+6*s)}M${f(x+w/2-6*s)} ${f(y+14*s)}H${f(x+w/2+6*s)}M${f(x+w/2-6*s)} ${f(y+18*s)}H${f(x+w/2+6*s)}" stroke="${ink}" stroke-width="1.4" fill="none"/>`;
  out+=lines(g.titleLines,x+w/2,y+h/2-(g.titleLines.length-1)*10.5*s,15,600);
  return out+'</g>';
 }
 if(shape==='groupbox'){
  out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(10*s)}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  out+=lines(g.titleLines,x+w/2,y+h-10*s,12,500);
  return out+'</g>';
 }
 if(shape==='choreotask'){
  const bands=n.properties.x_bands||[],bh=22*s;
  out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(6*s)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  if(bands.length){out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(bh)}" rx="${f(6*s)}" fill="${fill}" stroke="${ink}" stroke-width="1.5"/>`+text(x+w/2,y+bh-7*s,bands[0],11,600,'text-anchor="middle"');}
  if(bands.length>1){out+=`<rect x="${f(x)}" y="${f(y+h-bh)}" width="${f(w)}" height="${f(bh)}" rx="${f(6*s)}" fill="${fill}" stroke="${ink}" stroke-width="1.5"/>`+bands.slice(1).map((b,i)=>{const mi=b.endsWith(' *');return text(x+w/2,y+h-bh+bh-7*s+i*0,b.replace(/ \*$/,''),11,600,'text-anchor="middle"')+(mi?`<path d="M${f(x+w-20*s)} ${f(y+h-bh+6*s)}V${f(y+h-6*s)}M${f(x+w-16*s)} ${f(y+h-bh+6*s)}V${f(y+h-6*s)}M${f(x+w-12*s)} ${f(y+h-bh+6*s)}V${f(y+h-6*s)}" stroke="${ink}" stroke-width="1.4" fill="none"/>`:'');}).join('');}
  out+=lines(g.titleLines,x+w/2,y+(bands.length?bh+(h-2*bh)/2+4*s:h/2+5*s),14,600);
  return out+'</g>';
 }
 /* B1-059 : collaboration occurrence — dashed ellipse with keyword. */
 if(shape==='collab'){
  out+=`<ellipse cx="${f(x+w/2)}" cy="${f(y+h/2)}" rx="${f(w/2)}" ry="${f(h/2)}" fill="${fill}" stroke="${ink}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  const hasRows=(g.fieldRows||[]).length>0;
  /* B1-072 : the SoaML service contract reuses the collaboration
   * glyph with its own keyword. */
  out+=text(x+w/2,y+(hasRows?24*s:h/2-10*s),g.sysmlKeyword?'«'+g.sysmlKeyword+'»':'«collaboration»',11,500,'text-anchor="middle"');
  out+=lines(g.titleLines,x+w/2,y+(hasRows?48*s:h/2+14*s),16,600);
  if(hasRows){out+=line(x+w*.18,y+62*s,x+w*.82,y+62*s,1);
   for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc(r.id)}">`+lines(r.labelLines,x+w/2,y+r.top+18*s,12.5,400)+'</g>';}
  return out+'</g>';
 }
 /* B1-058 : deployment silhouettes — 3D-box node (top/right depth
  * faces) and dog-eared artifact document. */
 if(shape==='node3d'){
  const dx=10*s,dy=-8*s,fx=x,fy=y+8*s,fw=w-10*s,fh=h-8*s;
  out+=`<path d="M${f(fx)} ${f(fy)}L${f(fx+dx)} ${f(fy+dy)}L${f(fx+fw+dx)} ${f(fy+dy)}L${f(fx+fw)} ${f(fy)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=`<path d="M${f(fx+fw)} ${f(fy)}L${f(fx+fw+dx)} ${f(fy+dy)}L${f(fx+fw+dx)} ${f(fy+fh+dy)}L${f(fx+fw)} ${f(fy+fh)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=`<rect x="${f(fx)}" y="${f(fy)}" width="${f(fw)}" height="${f(fh)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  const stereo=n.kind==='uml.device'?'«device»':n.kind==='uml.executionenv'?'«execution environment»':'';
  if(stereo)out+=text(x+fw/2,fy+22*s,stereo,11,500,'text-anchor="middle"');
  out+=lines(g.titleLines,x+fw/2,fy+(stereo?48*s:Math.min(fh/2+5*s,40*s)),16,600);
  return out+'</g>';
 }
 if(shape==='artifact'){
  const ear=15*s;
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w-ear)}L${f(x+w)} ${f(y+ear)}V${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=line(x+w-ear,y,x+w-ear,y+ear,1.4)+line(x+w-ear,y+ear,x+w,y+ear,1.4);
  out+=text(x+w/2,y+24*s,'«artifact»',11,500,'text-anchor="middle"')+lines(g.titleLines,x+w/2,y+52*s,16,600);
  return out+'</g>';
 }
 if(look==='neo'&&shape!=='actor')out+=`<path d="${polygon(g).map((v,i)=>(i?'L':'M')+f(v[0]+4)+' '+f(v[1]+6)).join('')}Z" fill="#000" opacity=".14"/>`;
 /* B1-060 : signal pentagons, time-event hourglass, flow final. */
 if(['sendpent','acceptpent'].includes(shape)){
  out+=`<path d="${polygon(g).map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join('')}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=lines(g.titleLines,x+w/2,y+h/2-(g.titleLines.length-1)*10.5*s+5*s);
  return out+'</g>';
 }
 if(shape==='hourglass'){
  const cx=x+w/2,cy=y+h/2,hw=Math.min(w/2,26*s),hh=Math.min(h/2,20*s);
  out+=`<path d="M${f(cx-hw)} ${f(cy-hh)}L${f(cx+hw)} ${f(cy-hh)}L${f(cx-hw)} ${f(cy+hh)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=`<path d="M${f(cx+hw)} ${f(cy-hh)}L${f(cx-hw)} ${f(cy+hh)}L${f(cx+hw)} ${f(cy+hh)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=lines(g.titleLines,cx,y+h-5*s,12,600);
  return out+'</g>';
 }
 if(shape==='flowfinal'){
  const cx=x+w/2,cy=y+h/2-8,r=11*s;
  out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="2"/><path d="M${f(cx-5*s)} ${f(cy-5*s)}L${f(cx+5*s)} ${f(cy+5*s)}M${f(cx+5*s)} ${f(cy-5*s)}L${f(cx-5*s)} ${f(cy+5*s)}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=text(cx,y+h-5*s,n.name,12,600,'text-anchor="middle"');return out+'</g>';
 }
 if(shape==='actor'){
  /* B1-072 : SoaML agents are actors with a keyword header. */
  if(g.sysmlKeyword)out+=text(x+w/2,y+16*s,'«'+g.sysmlKeyword+'»',11,500,'text-anchor="middle"');
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
 }else if(['ellipse','circle'].includes(shape))out+=`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="${ink}" stroke-width="1.8"${n.kind==='orm.valuetype'?' stroke-dasharray="5 4"':''}/>`;
 else if(shape==='manualinput'){
  out+=`<path d="M${f(x)} ${f(y+h*.35)}L${f(x+w)} ${f(y)}V${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='manualop'){
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w)}L${f(x+w*.84)} ${f(y+h)}H${f(x+w*.16)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='display'){
  const c=18*s;
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w-c)}Q${f(x+w)} ${f(y+h/2)} ${f(x+w-c)} ${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='delay'){
  const r=h/2;
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w-r)}A${f(r)} ${f(r)} 0 0 1 ${f(x+w-r)} ${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='burst'){
  const pts=polygon(g).map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join('');
  out+=`<path d="${pts}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='triangledown'){
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w)}L${f(x+w/2)} ${f(y+h)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='triangleup'){
  out+=`<path d="M${f(x+w/2)} ${f(y)}L${f(x+w)} ${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='card'){
  const c=12*s;
  out+=`<path d="M${f(x+c)} ${f(y)}H${f(x+w)}V${f(y+h)}H${f(x)}V${f(y+c)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 }else if(shape==='xellipse'){
  out+=`<ellipse cx="${f(x+w/2)}" cy="${f(y+h/2)}" rx="${f(w/2)}" ry="${f(h/2)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=line(x+w*.28,y+h*.28,x+w*.72,y+h*.72,1.6)+line(x+w*.72,y+h*.28,x+w*.28,y+h*.72,1.6);
 }else if(shape==='barellipse'){
  out+=`<ellipse cx="${f(x+w/2)}" cy="${f(y+h/2)}" rx="${f(w/2)}" ry="${f(h/2)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=line(x+w*.18,y+h/2,x+w*.82,y+h/2,1.6);
 }else if(shape==='parallelmode'){
  out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
  out+=line(x+6*s,y+10*s,x+w-6*s,y+10*s,2.2)+line(x+6*s,y+18*s,x+w-6*s,y+18*s,2.2);
 }else if(shape==='tag'){
  /* B1-072 : UAF capability tag — the one genuinely new silhouette. */
  const c=16*s;
  out+=`<path d="M${f(x)} ${f(y)}H${f(x+w-c)}L${f(x+w)} ${f(y+h/2)}L${f(x+w-c)} ${f(y+h)}H${f(x)}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 } else if(['rect','round','terminal','component','subprocess'].includes(shape))out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape==='terminal'?h/2:shape==='round'?14*s:0}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 else out+=`<path d="${polygon(g).map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join('')}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
 if(n.properties.x_chen?.derived)out=out.replace(/stroke-width="1.8"/g,'stroke-width="1.8" stroke-dasharray="6 4"');
 if(n.properties.x_chen?.weak||n.properties.x_chen?.identifying){const inset=7*s,inner={...g,x:x+inset,y:y+inset,w:w-2*inset,h:h-2*inset};out+=`<path d="${polygon(inner).map((v,i)=>(i?'L':'M')+f(v[0])+' '+f(v[1])).join('')}Z" fill="none" stroke="${ink}" stroke-width="1.5"/>`;}
 if(n.properties.x_chen?.multivalued)out+=`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2-6*s}" ry="${h/2-6*s}" fill="none" stroke="${ink}" stroke-width="1.5"/>`;
 if(shape==='subprocess')out+=line(x+15*s,y,x+15*s,y+h)+line(x+w-15*s,y,x+w-15*s,y+h);
 if(shape==='component')out+=`<rect x="${x+w-40*s}" y="${y+13*s}" width="${23*s}" height="${25*s}" fill="${fill}" stroke="${ink}"/><rect x="${x+w-45*s}" y="${y+17*s}" width="${10*s}" height="${6*s}" fill="${fill}" stroke="${ink}"/><rect x="${x+w-45*s}" y="${y+29*s}" width="${10*s}" height="${6*s}" fill="${fill}" stroke="${ink}"/>`;
 if(g.extensionPoints){const yy=y+h*.35;out+=lines(g.titleLines,x+w/2,yy,16,600)+line(x+w*.16,y+h*.50,x+w*.84,y+h*.50)+text(x+w/2,y+h*.50+20*s,'extension points',11,600,'text-anchor="middle"')+lines(g.extensionPoints,x+w/2,y+h*.50+42*s,12,400);}
 else if(n.kind==='dfd.process'&&p.projection.profile==='dfd.gane_sarson@1'){
  const num=n.properties.x_diagram?.number||'',owner=n.properties.x_diagram?.owner||'Process';out+=line(x,y+30*s,x+w,y+30*s)+line(x,y+h-30*s,x+w,y+h-30*s)+text(x+15*s,y+21*s,num,12,600)+text(x+15*s,y+h-10*s,owner,11);out+=lines(g.titleLines,x+w/2,y+h/2-(g.titleLines.length-1)*10.5*s+5*s);
 }else if(g.sysmlKeyword){
  /* B1-065 : SysML block-family — «keyword» header plus named
   * compartments (values/parts/references/operations/constraints). */
  out+=text(x+w/2,y+20*s,'«'+g.sysmlKeyword+'»',11,500,'text-anchor="middle"')+lines(g.titleLines,x+w/2,y+45*s,16,650);
  for(const c of g.compartments||[])out+=line(x,y+c.top,x+w,y+c.top)+text(x+13*s,y+c.top+17*s,c.label,10,500);
  for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,'')+lines(r.detailLines,x+16*s,y+r.top+r.labelLines.length*18*s+17*s,11.5,400,'')+'</g>';
 }else if(['uml.class','uml.interface','uml.enumeration','uml.metaclass','uml.stereotype'].includes(n.kind)){
  out+=text(x+w/2,y+20*s,{['uml.interface']:'«interface»','uml.enumeration':'«enumeration»','uml.metaclass':'«metaclass»','uml.stereotype':'«stereotype»'}[n.kind]||'«class»',11,500,'text-anchor="middle"')+lines(g.titleLines,x+w/2,y+45*s,16,650);
  for(const c of g.compartments||[])out+=line(x,y+c.top,x+w,y+c.top)+text(x+13*s,y+c.top+17*s,c.label,10,500);
  for(const r of g.fieldRows){const m=r.field.properties.x_member||{},extra=`${m.static?'text-decoration="underline"':''} ${m.abstract?'font-style="italic"':''}`;out+=`<g class="ddn-field" data-member="${esc(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,extra)+lines(r.detailLines,x+16*s,y+r.top+r.labelLines.length*18*s+17*s,11.5,400,'')+'</g>';}
 }else if(n.kind==='req.requirement'){
  out+=text(x+14*s,y+21*s,'«requirement» '+n.properties.x_diagram.code,11,600)+lines(g.titleLines,x+14*s,y+45*s,16,650,'')+line(x,y+68*s,x+w,y+68*s)+lines(g.requirement,x+14*s,y+90*s,13,400,'');
 }else if(n.kind==='state.state'&&(g.stateActs||g.submachine)){
  /* B1-057 : state compartment — name header, then entry/exit/do and
   * internal-transition lines, then the «submachine» binding. */
  out+=lines(g.titleLines,x+w/2,y+31*s,16,650)+line(x,y+50*s,x+w,y+50*s);
  let yy=y+72*s;for(const a of g.stateActs){out+=text(x+14*s,yy,a,12.5,400,'');yy+=20*s;}
  if(g.submachine){const ref=String(g.submachine.$ref||g.submachine);out+=(g.stateActs.length?line(x,yy-12*s,x+w,yy-12*s):'')+text(x+14*s,yy+4*s,'«submachine» '+ref.split(/[.:]/).pop(),12,500,'');}
 }else if(g.roleRow){
  /* B1-080: the role-box predicate row. */
  out+=lines(g.titleLines,x+w/2,y+22*s,15,650);
  let rx=x+12*s;
  for(const [i,rf] of g.roleRow.fields.entries()){
   const bw=g.roleRow.widths[i],by=y+38*s,bh=24*s;
   if(rf.properties.x_role?.uniqueness)out+=`<g data-uniqueness="true">`+line(rx+4*s,by-6*s,rx+bw-4*s,by-6*s,2.4)+'</g>';
   out+=`<rect data-role="${esc(rf.id)}" x="${f(rx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" fill="${fill}" stroke="${ink}" stroke-width="1.5"/>`+text(rx+bw/2,by+16*s,rf.name,12,500,'text-anchor="middle"');
   rx+=bw;
  }
  if(g.roleRow.fields.some(rf=>rf.properties.x_role?.mandatory))out+=`<circle data-mandatory="true" cx="${f(x+5*s)}" cy="${f(y+50*s)}" r="${f(3.5*s)}" fill="${ink}"/>`;
 }else if(g.fieldRows.length){
  out+=lines(g.titleLines,x+16*s,y+31*s,16,600,'')+line(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s);for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,'')+'</g>';
 }else{
  let yy=y+h/2-(g.titleLines.length-1)*10.5*s+5*s;if(shape==='package')yy+=10*s;
  /* B1-085: contact/coil names sit above the glyph, not at node centre. */
  if(['ladder.contact','ladder.coil'].includes(n.kind))yy=y+17*s;
  /* A sentry criterion shows its if-part condition at the diamond centre; an
   * unnamed (id-labelled) sentry would otherwise print its id on top of it. */
  const sentryCriterion=n.kind==='cmmn.sentry'&&n.properties.x_sentry?.if_part;
  if(!sentryCriterion)out+=lines(g.titleLines,x+w/2+(shape==='store'&&p.projection.profile!=='dfd.yourdon@1'?12*s:0),yy,16,600,n.properties.key||n.properties.x_chen?.key?'text-anchor="middle" text-decoration="underline"':'text-anchor="middle"');
 }
 if(n.properties.x_chen?.partial_key){const tw=Math.min(w*.8,Text.measure(n.name,16*s,p.style.font,600).width);out+=`<path d="M${x+w/2-tw/2} ${y+h/2+11*s}h${tw}" stroke="${ink}" fill="none" stroke-dasharray="4 3"/>`;}
 /* B1-079: Petri markings — token dots inside a place (count text past 5). */
 if(n.kind==='petri.place'){
  const tok=n.properties.x_petri?.tokens||0,cx=x+w/2,cy=y+h/2-4*s;
  if(tok>0&&tok<=5)for(let i=0;i<tok;i++){const a=-Math.PI/2+i*(Math.PI*2/Math.max(tok,1));out+=`<circle data-token="true" cx="${f(cx+9*s*Math.cos(a))}" cy="${f(cy+9*s*Math.sin(a))}" r="${f(3.2*s)}" fill="${ink}"/>`;}
  else if(tok>5)out+=text(cx,cy+4*s,String(tok),13,700,'text-anchor="middle"');
 }
 /* B1-084: FBD block header — type above the instance name. */
 if(n.kind==='fbd.block'){
  const tp=n.properties.datatype||n.properties.type||'';
  if(tp)out+=text(x+w/2,y+16*s,tp,11,650,'text-anchor="middle"');
 }
 /* B1-085: ladder glyphs — IEC 61131-3 contact bars and coil parentheses. */
 if(n.kind==='ladder.contact'){
  const cx=x+w/2,form=n.properties.x_contact?.form||'no';
  out+=`<g class="ddn-ladder-contact" data-form="${form}">`+line(cx-8*s,y+26*s,cx-8*s,y+h-10*s,2.2)+line(cx+8*s,y+26*s,cx+8*s,y+h-10*s,2.2);
  if(form==='nc')out+=line(cx-11*s,y+h-10*s,cx+11*s,y+26*s,2.2);
  out+='</g>';
 }
 if(n.kind==='ladder.coil'){
  const cx=x+w/2,cy=y+(26*s+h-10*s)/2,ry=(h-36*s)/2,rx=11*s,mode=n.properties.x_coil?.mode||'normal';
  out+=`<g class="ddn-ladder-coil" data-mode="${mode}"><path d="M${f(cx-rx)} ${f(cy-ry)}Q${f(cx-rx-9*s)} ${f(cy)} ${f(cx-rx)} ${f(cy+ry)}" fill="none" stroke="${ink}" stroke-width="2"/><path d="M${f(cx+rx)} ${f(cy-ry)}Q${f(cx+rx+9*s)} ${f(cy)} ${f(cx+rx)} ${f(cy+ry)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  if(mode==='set'||mode==='reset')out+=text(cx,cy+4.5*s,mode==='set'?'S':'R',13,650,'text-anchor="middle"');
  if(mode==='negated')out+=line(cx-rx-4*s,cy+ry,cx+rx+4*s,cy-ry,2);
  out+='</g>';
 }
 if(n.kind==='ladder.jump')out+=text(x+12*s,y+h/2+4.5*s,'»',14,650,'');
 if(n.kind==='ladder.return')out+=text(x+12*s,y+h/2+4.5*s,'RET',10.5,650,'');
 /* B1-083: SDL create symbol — dashed border. */
 if(n.kind==='sdl.create')out+=`<rect x="${f(x+4*s)}" y="${f(y+4*s)}" width="${f(w-8*s)}" height="${f(h-8*s)}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
 /* B1-081: VSM glyph details — inventory I, supermarket inner lines. */
 if(n.kind==='vsm.inventory')out+=text(x+w/2,y+h/2+5*s,'I',14,650,'text-anchor="middle"');
 if(n.kind==='vsm.supermarket'){out+=line(x+14*s,y+18*s,x+w-14*s,y+18*s,1.4)+line(x+14*s,y+26*s,x+w-14*s,y+26*s,1.4)+line(x+26*s,y+10*s,x+26*s,y+h-10*s,1.4);}
 /* B1-080: ORM decorations — value constraint text, objectification frame,
  * derivation text. */
 if(n.properties.x_values?.values?.length)out+=`<g class="ddn-orm-values">`+text(x+w/2,y+h-6*s,'{'+n.properties.x_values.values.join(', ')+'}',10.5,500,'text-anchor="middle"')+'</g>';
 if(n.properties.x_objectified?.name){
  out+=`<g class="ddn-objectified"><rect x="${f(x-6*s)}" y="${f(y-20*s)}" width="${f(w+12*s)}" height="${f(h+26*s)}" rx="${f(10*s)}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="5 4"/>`+text(x+4*s,y-7*s,n.properties.x_objectified.name,11,650,'')+'</g>';
 }
 if(n.properties.x_derive?.text)out+=`<g class="ddn-orm-derive">`+text(x+w/2,y+h-6*s,'* '+n.properties.x_derive.text,10.5,400,'text-anchor="middle" font-style="italic"')+'</g>';
 // B1-064: sentry if-part condition text inside the criterion diamond.
 if(n.kind==='cmmn.sentry'&&n.properties.x_sentry?.if_part)out+=text(x+w/2,y+h/2+4*s,n.properties.x_sentry.if_part,10.5,500,'text-anchor="middle"');
 /* B1-064: CMMN decorators (extending the B1-063 badge layer). */
 const xc=n.properties.x_cmmn;
 if(xc){
  if(xc.discretionary||xc.nonblocking)out+=`<rect x="${f(x+3*s)}" y="${f(y+3*s)}" width="${f(w-6*s)}" height="${f(h-6*s)}" rx="${f(8*s)}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
  const cbadges=[...(xc.required?['required']:[]),...(xc.repetition?['repetition']:[]),...(xc.manual_activation?['manual']:[]),...(xc.completion?['completion']:[]),...(xc.collapsed?['collapsed']:[])];
  cbadges.forEach((m,i)=>{const bx=x+w-12*s-i*20*s,by=y+h-13*s;
   if(m==='required')out+=`<g class="ddn-marker" data-marker="required">`+text(bx,by+4*s,'!',14,650,'text-anchor="middle"')+'</g>';
   else if(m==='repetition')out+=`<g class="ddn-marker" data-marker="repetition"><circle cx="${f(bx)}" cy="${f(by)}" r="${f(6*s)}" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M${f(bx+6*s)} ${f(by)}L${f(bx+3*s)} ${f(by-3*s)}L${f(bx+3*s)} ${f(by+3*s)}Z" fill="${ink}"/></g>`;
   else if(m==='manual')out+=`<g class="ddn-marker" data-marker="manual_activation"><rect x="${f(bx-4*s)}" y="${f(by-2*s)}" width="${f(8*s)}" height="${f(7*s)}" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M${f(bx-3*s)} ${f(by-2*s)}V${f(by-6*s)}M${f(bx-1*s)} ${f(by-2*s)}V${f(by-7*s)}M${f(bx+1*s)} ${f(by-2*s)}V${f(by-7*s)}M${f(bx+3*s)} ${f(by-2*s)}V${f(by-6*s)}" stroke="${ink}" stroke-width="1.2" fill="none"/></g>`;
   else if(m==='completion')out+=`<g class="ddn-marker" data-marker="completion"><path d="M${f(bx-5*s)} ${f(by)}L${f(bx-1*s)} ${f(by+4*s)}L${f(bx+6*s)} ${f(by-5*s)}" fill="none" stroke="${ink}" stroke-width="1.8"/></g>`;
   else if(m==='collapsed')out+=`<g class="ddn-marker" data-marker="collapsed">`+text(bx,by+4*s,'+',14,650,'text-anchor="middle"')+'</g>';
  });
 }
 /* B1-063: BPMN decorators — gateway inner glyphs and activity border
  * modes/markers. Driven by x_gateway/x_activity contracts; profile-neutral. */
 const bpmnProfile=/^bpmn\.(process|choreography|conversation)@/.test(p.projection?.profile||'');
 const xg=n.properties.x_gateway;
 if(xg&&bpmnProfile){
  const cx=x+w/2,cy=y+h/2,u=8*s;
  const G={
   exclusive:`<path d="M${f(cx-u)} ${f(cy-u)}L${f(cx+u)} ${f(cy+u)}M${f(cx+u)} ${f(cy-u)}L${f(cx-u)} ${f(cy+u)}" stroke="${ink}" stroke-width="2.6" fill="none"/>`,
   parallel:`<path d="M${f(cx)} ${f(cy-u)}V${f(cy+u)}M${f(cx-u)} ${f(cy)}H${f(cx+u)}" stroke="${ink}" stroke-width="2.6" fill="none"/>`,
   inclusive:`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(u)}" fill="none" stroke="${ink}" stroke-width="2.4"/>`,
   complex:`<path d="M${f(cx)} ${f(cy-u)}V${f(cy+u)}M${f(cx-u)} ${f(cy)}H${f(cx+u)}M${f(cx-u*.7)} ${f(cy-u*.7)}L${f(cx+u*.7)} ${f(cy+u*.7)}M${f(cx+u*.7)} ${f(cy-u*.7)}L${f(cx-u*.7)} ${f(cy+u*.7)}" stroke="${ink}" stroke-width="1.6" fill="none"/>`,
   event:`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(u)}" fill="none" stroke="${ink}" stroke-width="1.3"/><path d="M${f(cx)} ${f(cy-u*.6)}L${f(cx+u*.55)} ${f(cy-u*.2)}L${f(cx+u*.34)} ${f(cy+u*.5)}L${f(cx-u*.34)} ${f(cy+u*.5)}L${f(cx-u*.55)} ${f(cy-u*.2)}Z" fill="none" stroke="${ink}" stroke-width="1.4"/>`,
   event_exclusive:`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(u)}" fill="none" stroke="${ink}" stroke-width="1.3"/><path d="M${f(cx)} ${f(cy-u*.6)}L${f(cx+u*.55)} ${f(cy-u*.2)}L${f(cx+u*.34)} ${f(cy+u*.5)}L${f(cx-u*.34)} ${f(cy+u*.5)}L${f(cx-u*.55)} ${f(cy-u*.2)}Z" fill="none" stroke="${ink}" stroke-width="1.4"/><path d="M${f(cx-u*.3)} ${f(cy-u*.3)}L${f(cx+u*.3)} ${f(cy+u*.3)}M${f(cx+u*.3)} ${f(cy-u*.3)}L${f(cx-u*.3)} ${f(cy+u*.3)}" stroke="${ink}" stroke-width="1.4" fill="none"/>`,
  };
  out+=`<g class="ddn-gateway" data-gateway="${esc(xg.type)}">`+(G[xg.type]||'')+'</g>';
 }
 const xa=n.properties.x_activity;
 if(xa&&bpmnProfile&&['flow.process','flow.subprocess','flow.choreotask'].includes(n.kind)){
  if(xa.call)out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(6*s)}" fill="none" stroke="${ink}" stroke-width="${f(3.6*s)}"/>`;
  if(xa.transaction)out+=`<rect x="${f(x+4*s)}" y="${f(y+4*s)}" width="${f(w-8*s)}" height="${f(h-8*s)}" rx="${f(5*s)}" fill="none" stroke="${ink}" stroke-width="1.4"/>`;
  if(xa.event_subprocess)out+=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(6*s)}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  const badges=[...(xa.markers||[]),...(xa.adhoc?['adhoc']:[])];
  badges.forEach((m,i)=>{const bx=x+12*s+i*20*s,by=y+h-13*s;
   if(m==='loop')out+=`<g class="ddn-marker" data-marker="loop"><circle cx="${f(bx)}" cy="${f(by)}" r="${f(6*s)}" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M${f(bx+6*s)} ${f(by)}L${f(bx+3*s)} ${f(by-3*s)}L${f(bx+3*s)} ${f(by+3*s)}Z" fill="${ink}"/></g>`;
   else if(m==='parallel')out+=`<g class="ddn-marker" data-marker="parallel"><path d="M${f(bx-4*s)} ${f(by-5*s)}V${f(by+5*s)}M${f(bx)} ${f(by-5*s)}V${f(by+5*s)}M${f(bx+4*s)} ${f(by-5*s)}V${f(by+5*s)}" stroke="${ink}" stroke-width="1.8" fill="none"/></g>`;
   else if(m==='sequential')out+=`<g class="ddn-marker" data-marker="sequential"><path d="M${f(bx-5*s)} ${f(by-4*s)}H${f(bx+5*s)}M${f(bx-5*s)} ${f(by)}H${f(bx+5*s)}M${f(bx-5*s)} ${f(by+4*s)}H${f(bx+5*s)}" stroke="${ink}" stroke-width="1.8" fill="none"/></g>`;
   else if(m==='compensation')out+=`<g class="ddn-marker" data-marker="compensation"><path d="M${f(bx-6*s)} ${f(by-4*s)}L${f(bx-6*s)} ${f(by+4*s)}L${f(bx-1*s)} ${f(by)}Z" fill="none" stroke="${ink}" stroke-width="1.3"/><path d="M${f(bx-1*s)} ${f(by-4*s)}L${f(bx-1*s)} ${f(by+4*s)}L${f(bx+4*s)} ${f(by)}Z" fill="none" stroke="${ink}" stroke-width="1.3"/></g>`;
   else if(m==='adhoc')out+=`<g class="ddn-marker" data-marker="adhoc">`+text(bx,by+4*s,'~',16,600,'text-anchor="middle"')+'</g>';
  });
 }
 if(n.properties.x_continuation)out+=text(x+w/2,y+h-13*s,n.properties.x_continuation.key+' / '+n.properties.x_continuation.side,11,650,'text-anchor="middle"');
 /* B1-055 : template signature box — dashed rect centred on the
  * top-right corner, one parameter name per line. */
 if(n.properties.x_template?.parameters?.length){const params=n.properties.x_template.parameters;
  const pw=Math.max(...params.map(v=>Text.measure(v,11*s,p.style.font,400).width))+18*s,ph=params.length*15*s+10*s,px=x+w-pw/2,py=y-ph/2;
  out+=`<g class="ddn-template" data-template="${esc(params.join(','))}"><rect x="${f(px)}" y="${f(py)}" width="${f(pw)}" height="${f(ph)}" fill="${fill}" stroke="${ink}" stroke-width="1.2" stroke-dasharray="5 3"/>`+params.map((v,i)=>text(px+9*s,py+16*s+i*15*s,v,11,400)).join('')+'</g>';}
 return out+'</g>';
}
const api={VERSION:'0.8.0',measure,render,anchor,polygon,shapeOf,segmentInterior};
publishNamespace('DDNShapes',api);
export default api;
