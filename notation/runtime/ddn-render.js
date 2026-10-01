/* SPDX-License-Identifier: GPL-2.0-or-later. Deterministic illustrative SVG renderer.
 * Not a replacement for the production layout/conformance requirements in spec/.
 */
import {publishNamespace} from './ddn-module-registry.js';
import ICONLIBS from './assets/icon-libraries.js';
import {sanitizedLibraries,hostIconPacks} from './ddn-icon-sanitize.js';
import Sketch from './ddn-sketch.js';
import Layout from './ddn-layout.js';
import Text from './ddn-text.js';
import Placement from './ddn-placement.js';
import Palette from './ddn-palette.js';
import Shapes from './ddn-shapes.js';
import './ddn-core.js'; // sibling bundle: load order only; the namespace comes from the module registry
import './ddn-export.js'; // sibling bundle: load order only; the namespace comes from the module registry
import {namespace} from './ddn-module-registry.js';
const DDN=namespace('DDN');
const Export=namespace('DDNExport');
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fmt=n=>Number(n.toFixed(3));
const q=DDN.quantity;
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);};
const slug=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const cls=(...parts)=>parts.flat(Infinity).filter(Boolean).join(' ');
function wrap(s,n=30){const lines=[];for(const line of String(s??'').split('\n')){let current='';for(const word of line.split(/\s+/)){if((current+' '+word).trim().length>n&&current){lines.push(current);current=word;}else current=(current+' '+word).trim();}while(current.length>n+8){lines.push(current.slice(0,n));current=current.slice(n);}lines.push(current);}return lines;}
function text(x,y,s,size=14,fill='#203047',weight=400,extra=''){Text?.measure(s,size,activeFont,weight);return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${esc(fill)}" font-weight="${weight}" ${extra}>${esc(s).replace(/[→↗∅]/g,c=>`<tspan font-family="DejaVu Sans, Arial, sans-serif">${c}</tspan>`)}</text>`;}
function multilines(x,y,lines,size=14,fill='#203047',step=20,weight=400){return lines.map((l,i)=>text(x,y+i*step,l,size,fill,weight)).join('');}
function line(x1,y1,x2,y2,colour,width=1.5,dash=''){return `<path d="M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}" fill="none" stroke="${esc(colour)}" stroke-width="${width}"${dash?` stroke-dasharray="${esc(dash)}"`:''}/>`;}
function glyph(name,x,y,size=24,colour='#285EA8'){return `<use href="#g-${esc(name)}" xlink:href="#g-${esc(name)}" x="${fmt(x)}" y="${fmt(y)}" width="${size}" height="${size}" style="color:${esc(colour)}"/>`;}
function rect(x,y,w,h,stroke,fill,look='classic',id='',radius=0,style={}){
 if(look==='handDrawn'){
  if(!Sketch)throw new Error('DDN handDrawn requires ddn-sketch.js to be loaded before ddn-render.js');
  return Sketch.box(x,y,w,h,{stroke,fill,id,radius,seed:style.seed??42,roughness:style.roughness??1.8,hachure:style.hachure??true});
 }
 let out='';
 if(look==='neo')out+=`<rect x="${x+5}" y="${y+7}" width="${w}" height="${h}" rx="${radius}" fill="#000" opacity=".14"/>`;
 out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${esc(fill)}" stroke="${esc(stroke)}" stroke-width="1.8"/>`;
 if(look==='neo')out+=`<path d="M${x+radius+1} ${y+3}H${x+w-radius-1}" stroke="${esc(stroke)}" stroke-width="3" opacity=".68"/><path d="M${x+12} ${y+7}H${x+w-12}" stroke="#FFF" stroke-width="2" opacity=".75"/>`;
 return out;
}
function styleLine(x1,y1,x2,y2,colour,width,dash,p,id){
 return p.style.look==='handDrawn'?Sketch.polyline([[x1,y1],[x2,y2]],{stroke:colour,width,dash,id,seed:p.style.seed,roughness:(p.style.roughness??1.8)*.7}):line(x1,y1,x2,y2,colour,width,dash);
}
function badge(s,x,y,fill,stroke){let w=Math.max(32,s.length*6.5+12);return {svg:`<rect x="${x}" y="${y}" width="${w}" height="20" rx="4" fill="${esc(fill)}" stroke="${esc(stroke)}" stroke-width=".8"/>`+text(x+w/2,y+14,s,10,stroke,650,'text-anchor="middle"'),w};}
function pretty(v){if(v===null)return 'null';if(v?.$missing)return '∅ missing';if(v?.$state)return v.$state.replaceAll('_',' ');if(v?.$ref)return '@'+v.$ref.split('::').at(-1);if(v?.$quantity!==undefined)return v.$quantity+v.unit;if(Array.isArray(v))return v.map(pretty).join(', ');if(v&&typeof v==='object')return JSON.stringify(v);return String(v??'');}
const themes=Palette.themes;
function measureNode(n,registry,profiles,placement={},context={}){
 const k=DDN.kindEntry(registry,n.kind),s=q(profiles.style.font_size,16)/16,font=profiles.style.font;
 const visible=profiles.display.fields==='none'?[]:n.fields.filter(f=>(f.depth||0)<profiles.display.depth);
 let w=Math.max(placement.size?q(placement.size[0]):270*s,160*s);
 const titleLines=Text.wrap(n.name,w-96*s,16*s,font,650);if(profiles.display.kind==='text')w=Math.max(w,Text.measure(k.name,11*s,font,650).width+28*s);const headerH=Math.max(64*s,40*s+titleLines.length*21*s);
 let y=headerH,rows=[];
 for(const f of visible){const depth=f.depth||0;let label=f.name;if(f.properties.x_part){const xp=f.properties.x_part;label+=(xp.classifier?': '+xp.classifier:'')+(xp.multiplicity?' ['+xp.multiplicity+']':'');}if(f.properties.x_unit)label+=': '+f.properties.x_unit.unit;if(f.properties.shape==='array')label+=' []';else if(f.properties.shape==='object')label+=' {}';else if(f.properties.shape==='variant')label+=' <variant>';else if(f.properties.shape==='map')label+=' <map>';else if(f.properties.shape==='set')label+=' <set>';
  const prefix=(f.properties.presence==='optional'?'? ':'')+(f.properties.nullable===true?'nullable · ':'');
  const labelLines=Text.wrap(prefix+label,w-(40+depth*16)*s,13.5*s,font,400),details=[];
  if(profiles.display.domains==='show'&&f.properties.domain){const d=context.byId?.get(f.properties.domain.$ref);details.push('domain: '+(d?.name||pretty(f.properties.domain)));}
  const dt=f.properties.datatype||f.properties.x_erp?.sql_type;if(profiles.display.datatypes==='show'&&dt)details.push('type: '+pretty(dt));
  const detailLines=details.flatMap(x=>Text.wrap(x,w-(40+depth*16)*s,11.5*s,font,400));
  let h=(labelLines.length*18+detailLines.length*16+10)*s;h=Math.max(h,(context.degrees?.[f.id]||1)*18+10,(context.degrees?.[f.id]||1)>2?(context.degrees[f.id]*40+10):0);
  rows.push({id:f.id,field:f,top:y,h,labelLines,detailLines,depth});y+=h;
 }
 /* B1-061 : packaged-element visibility prefix. */
 if(n.properties.x_pack?.visibility)titleLines[0]=(n.properties.x_pack.visibility==='private'?'− ':'+ ')+titleLines[0];
 let meaningLines=[];if(n.type==='domain'||k.code==='DOM'){meaningLines=Text.wrap(n.properties.meaning||'Shared semantic meaning',w-30*s,12.5*s,font,400);y=Math.max(y,headerH)+meaningLines.length*18*s+20*s;}
 let noteLines=[];if(k.shape==='note'&&n.properties.description){noteLines=Text.wrap(n.properties.description,w-30*s,12.5*s,font,400);y+=noteLines.length*18*s+20*s;}
 /* B1-100: mind-map entities carry free-form body text (their description)
  * as wrapped rows. The box auto-sizes to the rows up to a line cap (default
  * 10, x_mindmap.lines 1..50 per entity); beyond the cap the box stays at the
  * cap height and a scrollbar affordance marks the hidden rows. The text
  * engine measures and wraps only — there is no inline-markup engine in the
  * runtime, so rows are plain text (documented gap). */
 let mindRows=null;
 if(profiles.projection?.profile==='mindmap.basic@1'&&n.properties.description){
  const lines=Text.wrap(String(n.properties.description),w-30*s,12.5*s,font,400);
  const cap=Math.max(1,Math.min(50,q(n.properties.x_mindmap?.lines,10))),total=lines.length,shown=Math.min(cap,total);
  mindRows={lines,total,cap,rowH:18*s};
  y+=shown*18*s+(total>cap?8*s:0);
 }
 let sample=null;
 if(n.type==='sample'||k.code==='SMP'){
  const columns=n.properties.columns||[],allRows=n.properties.rows||[],raw=allRows.slice(0,1000),omitted=allRows.length-raw.length,head=columns.map(c=>context.members?.get(c.$ref)?.name||c.$ref?.split('.').at(-1)||String(c)),widths=head.map((h,i)=>Math.max(110*s,Math.min(220*s,Math.max(Text.measure(h,11.5*s,font,650).width,...raw.map(row=>Text.measure(pretty(row[i]),12*s,font,400).width))+24*s)));
  w=Math.max(w,widths.reduce((a,b)=>a+b,0)+24*s);const total=widths.reduce((a,b)=>a+b,0),factor=(w-24*s)/Math.max(1,total);widths.forEach((x,i)=>widths[i]*=factor);
  const headers=head.map((h,i)=>Text.wrap(h,widths[i]-12*s,11.5*s,font,650)),headH=Math.max(...headers.map(a=>a.length),1)*17*s+14*s;
  let rowTop=headerH+headH;const tableRows=raw.map(row=>{const cells=row.map((v,i)=>Text.wrap(pretty(v),widths[i]-12*s,12*s,font,400)),h=Math.max(...cells.map(c=>c.length),1)*18*s+12*s,r={cells,top:rowTop,h};rowTop+=h;return r;});
  sample={columns,headers,widths,headH,rows:tableRows,omitted};y=rowTop+32*s;
 }
 const footer=[];if(profiles.display.badges!=='none')for(const key of ['workload','role','temporal','distribution','location'])if(n.properties[key]!==undefined)footer.push(pretty(n.properties[key]));
 if(footer.length)y+=38*s;
 let h=Math.max(y+14*s,100*s,placement.size?q(placement.size[1]):0,(context.degrees?.[n.id]||1)>4?(context.degrees[n.id]*44+40):((context.degrees?.[n.id]||1)*20+40));
 const g={id:n.id,n,k,w,h,fields:visible,titleLines,footer,scale:s,headerH,fieldRows:rows,meaningLines,noteLines,sample,...(mindRows?{mindRows}:{})}; return k.profileKind?Shapes.measure(g,profiles):g;
}
function renderNode(g,p,theme,registry){
 if(g.k.profileKind){let shaped=Shapes.render(g,p,theme);
  /* B1-082: icon binding — draw the referenced (pre-sanitized) library icon
   * inside the node's top area; ids namespaced per node. Host-registered
   * packs (B1-088) append after the shipped registry. */
  const baseLibs=registry.icon_libraries||(registry._iconLibsSanitized??(registry._iconLibsSanitized=sanitizedLibraries(ICONLIBS.libraries)));
  const allLibs=hostIconPacks().length?baseLibs.concat(hostIconPacks()):baseLibs;
  const xi=g.n.properties?.x_icon||((allLibs.flatMap(l=>(l.icons||[]).filter(i=>(i.kinds||[]).includes(g.n.kind)).map(i=>({library:l.id,icon:i.id}))))[0]);
  if(xi){
   const libs=allLibs;
   const lib=libs.find(l=>l.id===xi.library);
   const icon=lib?.icons?.find(i=>i.id===xi.icon||i.kinds?.includes(g.n.kind)&&i.id===xi.icon);
   if(!lib||!icon)throw new DDN.DDNError('DDN-PJ206','Icon reference '+xi.library+'/'+xi.icon+' is not in the icon libraries registry',g.n.source?.file,g.n.source?.start);
   const isz=26*g.scale,ix=g.x+g.w/2-isz/2,iy=g.y+7*g.scale;
   const vb=(icon.svg.match(/viewBox="([^"]+)"/)||[])[1]||'0 0 24 24';
   const iPrefix='ic-'+hash(g.id)+'-';
   let inner=icon.svg.replace(/<\?xml[^>]*>/,'')
    .replace(/ id="([^"]+)"/g,(m,id)=>` id="${iPrefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${iPrefix}${id})`);
   inner=inner.replace(/<svg /,`<svg x="${fmt(ix)}" y="${fmt(iy)}" width="${fmt(isz)}" height="${fmt(isz)}" viewBox="${vb}" `)
    .replace(/\bviewBox="[^"]*"/,'');
   shaped=shaped.slice(0,-4)+`<g class="ddn-icon" data-icon="${esc(xi.library+'/'+xi.icon)}">`+inner+'</g></g>';
  }

  /* B1-076: C4 tag chip under the node (any silhouette, decorator layer). */
  if(g.n.properties.x_c4tag?.tags?.length&&p.detail!=='shapes'){const tg=g.n.properties.x_c4tag.tags.join(', ');shaped=shaped.slice(0,-4)+`<g class="ddn-c4tag">`+text(g.x+g.w/2,g.y+g.h-6*g.scale,'['+tg+']',10*g.scale,theme.muted,500,'text-anchor="middle" font-style="italic"')+'</g></g>';}
  if(g.n.properties&&g.n.properties.x_subdiagram){const b=badge(g.ioChild?'↗ inline':'↗ ref',0,0,theme.surface,theme.accent);shaped=shaped.slice(0,-4)+`<g class="ddn-ref-badge" transform="translate(${fmt(g.x+g.w-b.w*g.scale)} ${fmt(g.y-10*g.scale)}) scale(${g.scale})">`+b.svg+'</g></g>';}
  /* B1-074 : frozen drill-down — embed the stored snapshot verbatim
   * through the same namespacing pass; the child is never re-rendered. */
  const xf=g.n.properties.x_subdiagram?.frozen===true?g.n.properties.x_subdiagram:null;
  if(xf){
   const guesstimate=Math.max(40*g.scale,g.w-24*g.scale);
   const prefix='io-'+hash(g.id)+'-';let inner=xf.snapshot.replace(/<\?xml[^>]*>/,'');
   inner=inner.replace(/ id="([^"]+)"/g,(m,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${prefix}${id})`).replace(/(href|xlink:href)="#([^"]+)"/g,(m,a2,id)=>`${a2}="#${prefix}${id}"`).replace(/aria-labelledby="[^"]*"/g,'');
   const wm=inner.match(/<svg[^>]*\bwidth="([^"]+)"/),hm=inner.match(/<svg[^>]*\bheight="([^"]+)"/);
   const sw=wm?parseFloat(wm[1]):guesstimate,sh=hm?parseFloat(hm[1]):guesstimate;
   const scale2=Math.min((g.w-24*g.scale)/sw,g.ioH/sh),cw2=sw*scale2,ch2=sh*scale2;
   inner=inner.replace(/<svg /,`<svg x="${fmt(g.x+(g.w-cw2)/2)}" y="${fmt(g.y+g.h-ch2-8*g.scale)}" `).replace(/width="[^"]*" height="[^"]*"/,`width="${fmt(cw2)}" height="${fmt(ch2)}"`);
   shaped=shaped.slice(0,-4)+`<g class="ddn-io-inline ddn-frozen" data-view="${esc(xf.view)}"${xf.snapshot_at?` data-snapshot-at="${esc(xf.snapshot_at)}"`:''}>`+inner+'</g></g>';
  }
  else if(g.ioChild){const c=g.ioChild,scale2=Math.min((g.w-24*g.scale)/c.scene.width,g.ioH/c.scene.height),cw2=c.scene.width*scale2,ch2=c.scene.height*scale2;
   const prefix='io-'+hash(g.id)+'-';let inner=c.svg.replace(/<\?xml[^>]*>/,'');
   inner=inner.replace(/ id="([^"]+)"/g,(m,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${prefix}${id})`).replace(/(href|xlink:href)="#([^"]+)"/g,(m,a2,id)=>`${a2}="#${prefix}${id}"`).replace(/aria-labelledby="[^"]*"/g,'');
   inner=inner.replace(/<svg /,`<svg x="${fmt(g.x+(g.w-cw2)/2)}" y="${fmt(g.y+g.h-ch2-8*g.scale)}" `).replace(/width="[^"]*" height="[^"]*"/,`width="${fmt(cw2)}" height="${fmt(ch2)}"`);
   shaped=shaped.slice(0,-4)+`<g class="ddn-io-inline" data-view="${esc(c.scene.projection?.profile||'')}">`+inner+'</g></g>';}
  /* B1-061 : interaction-use gates (border squares) and arguments. */
  const xu=g.n.properties?.x_use;
  if(xu){const s2=g.scale;
   if(xu.arguments?.length)shaped=shaped.slice(0,-4)+`<g class="ddn-io-arguments">`+text(g.x+g.w/2,g.y+g.h-8*s2,'('+xu.arguments.join(', ')+')',11*s2,theme.muted,500,'text-anchor="middle"')+'</g></g>';
   for(const [gi,gname]of (xu.gates||[]).entries()){
    shaped=shaped.slice(0,-4)+`<g class="ddn-io-gate" data-gate="${esc(gname)}"><rect x="${fmt(g.x-5*s2)}" y="${fmt(g.y+(24+gi*22)*s2)}" width="${fmt(10*s2)}" height="${fmt(10*s2)}" fill="${esc(theme.surface)}" stroke="${esc(theme.accent)}" stroke-width="1.4"/>`+text(g.x+8*s2,g.y+(32+gi*22)*s2,gname,10.5*s2,theme.muted,500)+'</g></g>';}}
  return shaped;}
 const{n,k,x,y,w,h,titleLines,footer}=g,s=g.scale,font=p.style.font,mono=p.style.theme==='neutral',look=p.style.look;
 const nc=Palette.node(k,theme),ink=mono?'#333333':nc.ink,fill=mono?'#FAFAFA':nc.fill,bodyInk=nc.text;
 const maturity={draft:'DRF',approved:'APR',undecided:'UNK',review:'REV',deprecated:'DEP',retired:'RET',rejected:'REJ'},m=typeof n.properties.maturity==='object'?'UNK':maturity[n.properties.maturity];
 let out=`<g class="${cls('ddn-node','ddn-kind-'+slug(k.code))}" data-id="${esc(n.id)}" data-ddn-id="${esc(n.id)}" data-ref="${esc(n.ref||n.id)}" tabindex="0" role="group" aria-label="${esc(n.name)}"><title>${esc(n.name+' — '+k.name)}</title>`;
 if(k.shape==='note'){
  if(look==='handDrawn')out+=Sketch.polygon([[x,y],[x+w-16*s,y],[x+w,y+16*s],[x+w,y+h],[x,y+h]],{...p.style,id:n.id,stroke:ink,fill});
  else out+=`<path d="M${x} ${y}H${x+w-16*s}L${x+w} ${y+16*s}V${y+h}H${x}Z" fill="${esc(fill)}" stroke="${esc(ink)}" stroke-width="1.8"/>`;
  out+=styleLine(x+w-16*s,y,x+w-16*s,y+16*s,ink,1.3,'',p,n.id+':fold-v')+styleLine(x+w-16*s,y+16*s,x+w,y+16*s,ink,1.3,'',p,n.id+':fold-h');
 }else out+=rect(x,y,w,h,ink,fill,look,n.id,k.shape==='activity'?18*s:0,p.style);
 if(k.shape==='frame')out+=`<rect x="${x+6}" y="${y+6}" width="${w-12}" height="${h-12}" fill="none" stroke="${esc(ink)}" stroke-dasharray="4 4" opacity=".55"/>`;
 if(p.display.kind!=='none'){
  if(p.display.kind!=='text')out+=glyph(k.glyph,x+13*s,y+15*s,24*s,ink);
  if(['text','icon_token'].includes(p.display.kind)||mono)out+=text(x+14*s,y+53*s,p.display.kind==='text'?k.name:k.code,11*s,ink,650);
 }
 if(p.projection.profile==='uml.object@2'&&n.properties.x_instance)out+=`<g text-decoration="underline">`+multilines(x+48*s,y+29*s,titleLines,16*s,bodyInk,21*s,650)+'</g>';
 else out+=multilines(x+48*s,y+29*s,titleLines,16*s,bodyInk,21*s,650);
 if(m&&p.display.maturity!=='none')out+=`<rect x="${x+w-46*s}" y="${y+8*s}" width="${38*s}" height="${22*s}" rx="4" fill="${esc(fill)}" stroke="${esc(ink)}"/>`+text(x+w-27*s,y+24*s,m,11*s,ink,650,'text-anchor="middle"');
 if(n.properties&&n.properties.x_subdiagram){const b=badge('↗ ref',0,0,theme.surface,theme.accent);out+=`<g class="ddn-ref-badge" transform="translate(${fmt(x+w-b.w*s)} ${fmt(y-10*s)}) scale(${s})">`+b.svg+'</g>';}
 if(g.fieldRows.length){out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':fields');
  for(const row of g.fieldRows){const xx=x+(16+row.depth*16)*s,yy=y+row.top+18*s;
   out+=`<g class="ddn-field" data-member="${esc(row.id)}">`+multilines(xx,yy,row.labelLines,13.5*s,bodyInk,18*s);
   if(row.field.properties.key)out+=glyph('key',x+w-27*s,yy-14*s,16*s,ink);
   if(row.detailLines.length)out+=multilines(xx,yy+row.labelLines.length*18*s,row.detailLines,11.5*s,ink,16*s);
   out+='</g>';
  }
 }
 if(g.meaningLines.length){out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':meaning');out+=multilines(x+15*s,y+g.headerH+18*s,g.meaningLines,12.5*s,bodyInk,18*s);}
 if(g.noteLines.length)out+=multilines(x+15*s,y+g.headerH+18*s,g.noteLines,12.5*s,bodyInk,18*s);
 if(g.mindRows){const mr=g.mindRows,top=y+g.headerH+8*s,winH=Math.min(mr.cap,mr.total)*mr.rowH,clipId='mindclip-'+hash(n.id);
  /* B1-100: mind-map body rows. ALL rows render inside a clip window sized to
   * the line cap; the tool pans the rows group and the thumb for scroll (no
   * re-render), and drags the lower-right handle to change the cap (overlay
   * re-render, presentation-only). The static export shows the first window. */
  out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':mindbody');
  out+=`<clipPath id="${clipId}"><rect x="${fmt(x+8*s)}" y="${fmt(top)}" width="${fmt(w-16*s)}" height="${fmt(winH)}"/></clipPath>`;
  out+=`<g class="ddn-mind-rows" data-node="${esc(n.id)}" data-total="${mr.total}" data-cap="${mr.cap}" data-row-h="${fmt(mr.rowH)}" clip-path="url(#${clipId})">`;
  mr.lines.forEach((ln,i)=>{Text.measure(ln,12.5*s,font,400);out+=`<text class="ddn-mind-row" data-row="${i}" x="${fmt(x+15*s)}" y="${fmt(top+13*s+i*mr.rowH)}" font-size="${fmt(12.5*s)}" fill="${bodyInk}">${esc(ln)}</text>`;});
  out+='</g>';
  if(mr.total>mr.cap){const tx=x+w-11*s,trackY=top+2*s,trackH=winH-4*s,thumbH=Math.max(12*s,trackH*mr.cap/mr.total);
   out+=`<g class="ddn-mind-scroll" data-node="${esc(n.id)}" data-track-y="${fmt(trackY)}" data-track-h="${fmt(trackH)}"><rect class="ddn-mind-scroll-track" x="${fmt(tx)}" y="${fmt(trackY)}" width="${fmt(5*s)}" height="${fmt(trackH)}" rx="${fmt(2.5*s)}" fill="${ink}" opacity=".18"/><rect class="ddn-mind-scroll-thumb" data-node="${esc(n.id)}" x="${fmt(tx)}" y="${fmt(trackY)}" width="${fmt(5*s)}" height="${fmt(thumbH)}" rx="${fmt(2.5*s)}" fill="${ink}" opacity=".55"/></g>`;}
  out+=`<g class="ddn-mind-resize" data-node="${esc(n.id)}" data-cap="${mr.cap}" data-total="${mr.total}"><path d="M${fmt(x+w-16*s)} ${fmt(y+h-5*s)}L${fmt(x+w-5*s)} ${fmt(y+h-16*s)}M${fmt(x+w-11*s)} ${fmt(y+h-5*s)}L${fmt(x+w-5*s)} ${fmt(y+h-11*s)}" stroke="${ink}" stroke-width="1.6" opacity=".5"/></g>`;
 }
 if(g.sample){const sm=g.sample;out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':sample');let xx=x+12*s;
  sm.headers.forEach((lines,i)=>{out+=multilines(xx,y+g.headerH+16*s,lines,11.5*s,ink,17*s,650);if(i)out+=styleLine(xx-5*s,y+g.headerH-4*s,xx-5*s,y+h-30*s,ink,.5,'',p,n.id+':column:'+i);xx+=sm.widths[i];});
  for(let j=0;j<sm.rows.length;j++){const row=sm.rows[j];let xx=x+12*s;row.cells.forEach((lines,i)=>{out+=multilines(xx,y+row.top+18*s,lines,12*s,bodyInk,18*s);xx+=sm.widths[i];});out+=styleLine(x+10*s,y+row.top+row.h-1,x+w-10*s,y+row.top+row.h-1,ink,.45,'',p,n.id+':row:'+j);}
  out+=text(x+13*s,y+h-12*s,(n.properties.mode||'example')+' · illustrative, not a constraint'+(sm.omitted?' · +'+sm.omitted+' rows not rendered':''),11*s,ink);
 }
 if(footer.length){let bx=x+12*s;for(const value of footer){let st=value.toUpperCase(),width=Text.measure(st,11*s,font,650).width+14*s;if(bx+width>x+w-10*s){out+=text(bx,y+h-14*s,'+ detail',11*s,ink);break;}out+=`<rect x="${bx}" y="${y+h-29*s}" width="${width}" height="${22*s}" rx="4" fill="${esc(fill)}" stroke="${esc(ink)}" stroke-width=".8"/>`+text(bx+width/2,y+h-13*s,st,11*s,ink,650,'text-anchor="middle"');bx+=width+7*s;}}
 return out+'</g>';
}
function endpoint(g,member,side){let x=g.x+g.w/2,y=g.y+g.h/2;
 if(member){const index=g.fields.findIndex(f=>f.id===member);if(index>=0)y=g.y+65+(g.titleLines.length-1)*20+index*25;}
 if(side==='west')x=g.x;else if(side==='east')x=g.x+g.w;else if(side==='north')y=g.y;else if(side==='south')y=g.y+g.h;
 return [x,y];}
function simplify(points){const out=[];for(const p of points){if(out.length&&out.at(-1)[0]===p[0]&&out.at(-1)[1]===p[1])continue;out.push(p);while(out.length>=3){const a=out.at(-3),b=out.at(-2),c=out.at(-1);if((a[0]===b[0]&&b[0]===c[0])||(a[1]===b[1]&&b[1]===c[1]))out.splice(out.length-2,1);else break;}}return out;}
function pathD(points){return points.map((v,i)=>(i?'L':'M')+fmt(v[0])+' '+fmt(v[1])).join(' ');}
function segments(points){return points.slice(1).map((p,i)=>({a:points[i],b:p,i}));}
function intersect(s,t){const h=s.a[1]===s.b[1],v=t.a[0]===t.b[0];if(h&&v){let x=t.a[0],y=s.a[1];if(x>Math.min(s.a[0],s.b[0])+8&&x<Math.max(s.a[0],s.b[0])-8&&y>Math.min(t.a[1],t.b[1])+8&&y<Math.max(t.a[1],t.b[1])-8)return[x,y];}if(s.a[0]===s.b[0]&&t.a[1]===t.b[1])return intersect(t,s);return null;}
function routePoints(a,b,r,hints,p,index){let ss=hints.source_side||'east',ts=hints.target_side||'west';
 if(!hints.source_side&&!hints.target_side&&p.layout.direction==='down'){ss='south';ts='north';}
 const start=endpoint(a,r.from.member,ss),end=endpoint(b,r.to.member,ts);
 // Session example opt-in: visual boundary anchors, never semantic field/port identities.
 for(const [key,g,member,side,point] of [['x_source_fraction',a,r.from.member,ss,start],['x_target_fraction',b,r.to.member,ts,end]]){
  if(hints[key]!==undefined){const v=hints[key];if(member||!Number.isFinite(v)||v<=0||v>=1)throw new DDN.DDNError('DDN-I030','A visual anchor fraction must be strictly between 0 and 1 and cannot override a field/port endpoint');
   if(side==='west'||side==='east')point[1]=g.y+g.h*v;else point[0]=g.x+g.w*v;
  }
 }
 if(hints.via)return [start,...hints.via.map(pt=>pt.map(v=>q(v))),end];
 if(p.layout.routing==='straight')return[start,end];
 if(ss==='east'&&ts==='west'&&end[0]>start[0]+20){const mid=(start[0]+end[0])/2;return[start,[mid,start[1]],[mid,end[1]],end].filter((x,i,a)=>!i||x[0]!==a[i-1][0]||x[1]!==a[i-1][1]);}
 if(ss==='south'&&ts==='north'&&end[1]>start[1]+20){let mid=(start[1]+end[1])/2;return[start,[start[0],mid],[end[0],mid],end];}
 const y=Math.min(a.y,b.y)-35-index*12;return[start,[start[0]+25,start[1]],[start[0]+25,y],[end[0]-25,y],[end[0]-25,end[1]],end];
}
function direction(points,start=false){const a=start?points[1]:points.at(-2),b=start?points[0]:points.at(-1);return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;}
function endMark(point,angle,type,ink,surface='white'){if(!type||type==='none')return'';let s=`<g transform="translate(${point[0]} ${point[1]}) rotate(${angle})" stroke="${esc(ink)}" stroke-width="1.7" fill="none">`;
 if(type==='filled')s+=`<path d="M0 0L-10 -5L-10 5Z" fill="${esc(ink)}"/>`;
 else if(type==='open')s+='<path d="M-10 -5L0 0L-10 5"/>';
 else if(type==='diamond')s+=`<path d="M0 0L-8 -5L-16 0L-8 5Z" fill="${esc(ink)}"/>`;
 else if(type==='hollow_diamond')s+=`<path d="M0 0L-8 -5L-16 0L-8 5Z" fill="${esc(surface)}"/>`;
 else if(type==='triangle')s+=`<path d="M0 0L-12 -7L-12 7Z" fill="${esc(surface)}"/>`;
 else if(type==='filled_triangle')s+=`<path d="M0 0L-12 -7L-12 7Z" fill="${esc(ink)}"/>`;
 else if(type==='slash')s+=`<path d="M-9 -6L-3 6" stroke-width="2.4"/>`;
 else if(type==='lollipop')s+=`<circle cx="-7" cy="0" r="5" fill="${esc(surface)}"/>`;
 else if(type==='socket')s+=`<path d="M-11 -6A6.5 6.5 0 0 0 -11 6" fill="none"/>`;
 else if(type==='circle')s+=`<circle cx="-8" cy="0" r="4.5" fill="${esc(surface)}"/>`; /* B1-066 : DMN authority requirement */
 else if(type==='xcircle')s+=`<circle cx="-9" cy="0" r="6" fill="${esc(surface)}"/><path d="M-12 -3L-6 3M-6 -3L-12 3"/>`; /* B1-080: ORM exclusion */
 else if(['one','zeroone','many','zeromany'].includes(type)){
  if(type.includes('many'))s+='<path d="M-13 0L0 -7M-13 0L0 7M-13 0L0 0"/>';
  else s+='<path d="M-4 -7V7"/>';
  if(type.startsWith('zero'))s+=`<circle cx="-20" cy="0" r="4" fill="${esc(surface)}"/>`;else s+='<path d="M-18 -7V7"/>';
 }
 return s+'</g>';
}
/* B1-078: IDEF0 tunnel end — a small open parenthesis at the endpoint. */
function tunnelMark(point,angle,ink){return `<g transform="translate(${point[0]} ${point[1]}) rotate(${angle})" stroke="${esc(ink)}" stroke-width="1.7" fill="none"><path d="M-9 -6A9 9 0 0 0 -9 6"/></g>`;}
function midpoint(points){const seg=segments(points).sort((a,b)=>Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1])-Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1]))[0];return[(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];}
/* B1-055: point where the ray from a box centre toward `toward` exits the box. */
function rectAnchor(g,toward){const cx=g.x+g.w/2,cy=g.y+g.h/2,dx=toward[0]-cx,dy=toward[1]-cy;let t=Infinity;
 if(dx)t=Math.min(t,Math.abs((g.w/2)/dx));if(dy)t=Math.min(t,Math.abs((g.h/2)/dy));
 if(!Number.isFinite(t)||!t)return[cx,cy];return[cx+dx*t,cy+dy*t];}
function visibleRoutePieces(points,holes,radius=7){
 if(!holes.length)return [{points,distance:0}];
 const pieces=[];let current=[],distance=0,startDistance=0;
 const flush=()=>{if(current.length>1)pieces.push({points:current,distance:startDistance});current=[];};
 for(const seg of segments(points)){
  const a=seg.a,b=seg.b,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ranges=[];
  if(!len)continue;
  for(const hole of holes){const p=hole.point,t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(len*len),d=Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]);if(t>0&&t<1&&d<.01)ranges.push([Math.max(0,t-radius/len),Math.min(1,t+radius/len)]);}
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const v of ranges){if(merged.length&&v[0]<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(merged.at(-1)[1],v[1]);else merged.push([...v]);}
  let from=0;const intervals=[];for(const v of merged){if(v[0]>from)intervals.push([from,v[0]]);from=v[1];}if(from<1)intervals.push([from,1]);
  for(const [lo,hi]of intervals){if(lo>0)flush();const first=[a[0]+dx*lo,a[1]+dy*lo],last=[a[0]+dx*hi,a[1]+dy*hi];if(!current.length){current=[first];startDistance=distance+len*lo;}else if(current.at(-1)[0]!==first[0]||current.at(-1)[1]!==first[1])current.push(first);current.push(last);if(hi<1)flush();}
  distance+=len;
 }
 flush();return pieces;
}
let activeFont='sans';
function render(ir,registry,glyphDefs='',options={}){const before=activeFont;activeFont=ir.view.profiles.style.font;try{return renderInner(ir,registry,glyphDefs,options);}finally{activeFont=before;}}
function renderInner(ir,registry,glyphDefs='',options={}){
 if(!Layout||!Text||!Export)throw new DDN.DDNError('DDN099','Load layout/text/export modules before rendering');
 ir=Export.project(ir);
 const textBefore=Text.stats();
 /* B1-074 : options.detail — 'full' (default) renders text as
  * always; 'shapes' (drill-down thumbnails) suppresses every text run. */
 const p={...ir.view.profiles,detail:options.detail||'full'},t=themes[p.style.theme],mono=p.style.theme==='neutral';
 /* B1-045 (D2): view chrome visibility. Defaults (auto/on) reproduce the
  * pre-option emission rules exactly. legend off behaves like placement none
  * for layout and emission; title off drops the header block and its reserved
  * band; footer off drops the footer line. */
 const chrome=p.chrome||{legend:'auto',title:'on',footer:'on'},
  titleOn=chrome.title!=='off'&&p.detail!=='shapes',
  footerOn=chrome.footer!=='off'&&p.detail!=='shapes';
 /* B1-100: the RELATIONSHIP KEY legend exists to decode numbered badges and
  * tokens. When relation names already print in full inline (legend mode
  * 'text'), the legend repeats what the diagram says — suppress it unless the
  * author explicitly asked for it (chrome.legend: 'on'). Numbers/tokens keep
  * their legend; an explicit legend: 'off' still wins everywhere. */
 const legendPlacement=chrome.legend==='off'||p.detail==='shapes'||(p.legend.mode==='text'&&chrome.legend!=='on')?'none':p.legend.placement;
 const headBlock=titleOn?110:20;
 const elems=ir.view.selected.map(id=>ir.elements.find(n=>n.id===id));
 const rels=ir.view.relations.map(id=>ir.relations.find(r=>r.id===id));
 const context={byId:new Map(ir.elements.map(n=>[n.id,n])),members:new Map(ir.elements.flatMap(n=>[...n.fields,...n.ports].map(f=>[f.id,f]))),degrees:{}};
 const portIds=new Set(ir.elements.flatMap(n=>n.ports.map(pt=>pt.id)));
 for(const r of rels)for(const ep of [r.from,r.to]){context.degrees[ep.element]=(context.degrees[ep.element]||0)+1;if(ep.member)context.degrees[ep.member]=(context.degrees[ep.member]||0)+1;}
 let geoms=elems.map(n=>measureNode(n,registry,p,ir.view.placements[n.id],context));
 /* B1-061 : interaction-overview inline expansion. Child views render
  * through the same recursive render() as inline subdiagrams; the owning node
  * grows to fit. */
 const ioChildren=ir.view.ioChildren||{};
 for(const g of geoms){const child=ioChildren[g.id];if(!child)continue;
  /* B1-074 : display:'thumbnail' renders the child in shapes detail
   * (silhouettes/edges/frames/ports, no text). */
  const thumb=g.n.properties.x_subdiagram?.display==='thumbnail'||g.n.properties.x_subdiagram?.frozen===true;
  const c=render(child,registry,glyphDefs,thumb?{...options,detail:'shapes'}:options),s=q(p.style.font_size,16)/16;
  const cw=Math.min(360*s,c.scene.width),ch=Math.min(200*s,c.scene.height);
  g.ioChild={scene:c,svg:c.svg};g.w=Math.max(g.w,cw+24*s);g.h+=ch+16*s;g.ioH=ch;
 }
 /* B1-074 : frozen nodes carry their snapshot instead of a live
  * child — grow the node around the snapshot's declared size the same way. */
 for(const g of geoms){const xf=g.n.properties.x_subdiagram;if(xf?.frozen!==true)continue;
  const s=q(p.style.font_size,16)/16;
  const wm=xf.snapshot.match(/<svg[^>]*\bwidth="([^"]+)"/),hm=xf.snapshot.match(/<svg[^>]*\bheight="([^"]+)"/);
  const cw=Math.min(360*s,wm?parseFloat(wm[1]):360*s),ch=Math.min(200*s,hm?parseFloat(hm[1]):200*s);
  g.w=Math.max(g.w,cw+24*s);g.h+=ch+16*s;g.ioH=ch;
 }

 if(p.publication.fit==='reflow'&&p.layout.algorithm==='grid'&&!Object.values(ir.view.placements).some(x=>x.at)){const pw=q(p.publication.width,1280),reserve=legendPlacement==='right'?q(p.legend.width,310)+25:0;let cols=Math.floor((pw-2*q(p.publication.margin,32)-reserve)/(geoms.reduce((m,g)=>Math.max(m,g.w),270)+Layout.round(q(p.layout.gap,100)*Layout.spacingScale(p.layout))));p.layout={...p.layout,columns:Math.max(1,Math.min(geoms.length,cols))};}
 const placed=Placement.place(geoms,rels,ir,options);geoms=placed.nodes;
 /* B1-063: BPMN boundary events attach to their host's bottom border (port
  * attachment precedent — visual anchor, the node keeps its identity). */
 {const byIdPre=new Map(geoms.map(g=>[g.id,g]));
  for(const g of geoms){const xe=g.n.properties.x_event;
   if(xe?.position==='boundary'&&xe.on){const host=byIdPre.get(xe.on.$ref);
    if(host){g.x=host.x+host.w/2-g.w/2;g.y=host.y+host.h-g.h*0.30;g.x_boundaryOf=host.id;}}
   /* B1-064: CMMN criterion attachment — a sentry with x_sentry.attach sits on
    * the plan item's border (same machinery as BPMN boundary events). */
   const xs=g.n.properties.x_sentry;
   if(xs?.attach){const host=byIdPre.get(xs.attach.$ref);
    if(host){g.x=host.x+host.w/2-g.w/2;g.y=host.y+host.h-g.h*0.30;g.x_boundaryOf=host.id;}}}}
 let maxW=geoms.reduce((m,g)=>Math.max(m,g.w),270),maxH=geoms.reduce((m,g)=>Math.max(m,g.h),130);
 const byId=new Map(geoms.map(g=>[g.id,g]));
 let frames=ir.view.frames.map(f=>{const m=f.members.map(id=>byId.get(id)).filter(Boolean);let x=f.at?q(f.at[0]):(m.length?m.reduce((v,g)=>Math.min(v,g.x),Infinity)-20:0),y=f.at?q(f.at[1]):(m.length?m.reduce((v,g)=>Math.min(v,g.y),Infinity)-54:0),w=f.size?q(f.size[0]):(m.length?m.reduce((v,g)=>Math.max(v,g.x+g.w),-Infinity)-x+20:300),h=f.size?q(f.size[1]):(m.length?m.reduce((v,g)=>Math.max(v,g.y+g.h),-Infinity)-y+22:170);
 // frame_overflow : expand grows a declared rect to enclose members
 // at the standard padding; when members already fit this is a no-op.
 if(m.length&&p.layout.frame_overflow!=='confine'&&(f.at||f.size)){w=Math.max(w,m.reduce((v,g)=>Math.max(v,g.x+g.w),-Infinity)-x+20);h=Math.max(h,m.reduce((v,g)=>Math.max(v,g.y+g.h),-Infinity)-y+22);}
 return{...f,x,y,w,h};});
 /* B1-085: IEC 61131-3 power rails flank the rung area under the ladder profile. */
 let ladderRails=null;
 if(p.projection.profile==='ladder.basic@1'&&geoms.length){
  const gx0=geoms.reduce((m,g)=>Math.min(m,g.x),Infinity),gx1=geoms.reduce((m,g)=>Math.max(m,g.x+g.w),-Infinity),gy0=geoms.reduce((m,g)=>Math.min(m,g.y),Infinity),gy1=geoms.reduce((m,g)=>Math.max(m,g.y+g.h),-Infinity);
  ladderRails={x0:gx0-56,x1:gx1+56,y0:gy0-28,y1:gy1+28};
 }
 let subs=ir.view.subdiagrams.map((d,i)=>({...d,x:q(d.at?.[0],i*310),y:q(d.at?.[1],geoms.reduce((m,g)=>Math.max(m,g.y+g.h),0)+100),w:q(d.size?.[0],270),h:q(d.size?.[1],95)}));
 const labelMeasure=r=>{if(r._visualLabel===false)return{w:0,h:0};const reg=DDN.relationEntry(registry,r.kind);if(p.legend.mode==='numbers')return{w:30,h:30};const str=p.legend.mode==='tokens'?reg.code:r.name;return{w:Text.measure(str,12,p.style.font,500).width+20,h:28};};
 const routed=Placement.route(geoms,rels,ir,labelMeasure,subs,placed);
 const routes=routed.routes.map(a=>({...a,reg:DDN.relationEntry(registry,a.r.kind)})),crossings=routed.crossings;
 const allBoxes=[...geoms,...frames,...subs,...routed.labels];
 if(ladderRails)allBoxes.push({x:ladderRails.x0-4,y:ladderRails.y0,w:8,h:ladderRails.y1-ladderRails.y0},{x:ladderRails.x1-4,y:ladderRails.y0,w:8,h:ladderRails.y1-ladderRails.y0});
 let minX=allBoxes.reduce((m,g)=>Math.min(m,g.x),0),minY=allBoxes.reduce((m,g)=>Math.min(m,g.y),0);for(const r of routes)for(const pt of r.points){minX=Math.min(minX,pt[0]);minY=Math.min(minY,pt[1]);}
 let maxX=allBoxes.reduce((m,g)=>Math.max(m,g.x+g.w),100),maxY=allBoxes.reduce((m,g)=>Math.max(m,g.y+g.h),100);for(const r of routes)for(const pt of r.points){maxX=Math.max(maxX,pt[0]);maxY=Math.max(maxY,pt[1]);}
 const pinFocus=p.layout.center==='pins'?placed.anchor:null;
 if(pinFocus){const b=Placement.centeredBounds({x:minX,y:minY,w:maxX-minX,h:maxY-minY},pinFocus);minX=b.x;minY=b.y;maxX=b.x+b.w;maxY=b.y+b.h;}
 /* B1-081: VSM timeline ladder — reserve space below the content before the
  * page bounds are computed; drawn after the labels. */
 let vsmLadder=null;
 if(p.projection.profile==='vsm.basic@1'){
  const steps=geoms.filter(g=>g.n.kind==='vsm.process'&&g.n.properties.x_vsm).sort((a,b)=>a.x-b.x)
   .map(g=>({x:g.x+g.w/2,va:g.n.properties.x_vsm.va,nva:g.n.properties.x_vsm.nva,unit:g.n.properties.x_vsm.unit||''}));
  if(steps.length){
   const ls=q(p.style.font_size,16)/16,ladderH=40*ls;
   vsmLadder={steps,s:ls,h:ladderH};
   maxY+=ladderH+52*ls;
  }
 }
 const width=maxX-minX+30,height=maxY-minY+30;
 let pageW=q(p.publication.width,1280),pageH=q(p.publication.height,800);
 if(['a4','letter'].includes(p.publication.size)){pageW=p.publication.size==='a4'?210*96/25.4:8.5*96;pageH=p.publication.size==='a4'?297*96/25.4:11*96;if(p.publication.orientation==='landscape')[pageW,pageH]=[pageH,pageW];}
 const margin=q(p.publication.margin,32),legendW=legendPlacement==='right'?q(p.legend.width,270):0;
 let legendEntries=rels.map(r=>{const a=ir.elements.find(n=>n.id===r.from.element),b=ir.elements.find(n=>n.id===r.to.element),reg=DDN.relationEntry(registry,r.kind);const fromName=a.name+(r.from.member?'.'+(a.fields.find(f=>f.id===r.from.member)?.name||a.ports.find(f=>f.id===r.from.member)?.name||r.from.member.split('.').at(-1)):'');const toName=b.name+(r.to.member?'.'+(b.fields.find(f=>f.id===r.to.member)?.name||b.ports.find(f=>f.id===r.to.member)?.name||r.to.member.split('.').at(-1)):'');let detail=`${fromName} → ${toName}: ${r.name}`;
  const qualifiers=['enforcement','capture','transport','delivery','scope'];for(const prop of qualifiers)if(r.properties[prop]!==undefined)detail+=`; ${prop}: ${pretty(r.properties[prop])}`;
  return {id:r.id,key:ir.view.keys[r.id],name:r.name,reg,lines:Text.wrap(detail,Math.max(legendW,300)-42,12,p.style.font,400)};
 });
 const legendHeight=50+legendEntries.reduce((n,e)=>n+Math.max(44,e.lines.length*18+16),0),bottomH=legendPlacement==='bottom'?legendHeight:0;
 const pageTitle=p.publication.title||ir.view.name;
 if(p.publication.size==='content'){pageW=Math.max(640,Text.measure(pageTitle,24,p.style.font,650).width+2*margin,width+2*margin+(legendW?legendW+25:0));pageH=Math.max(360,height+2*margin+headBlock+bottomH,legendPlacement==='right'?legendHeight+headBlock+60:0);}
 const titleLines=titleOn?Text.wrap(pageTitle,pageW-2*margin,24,p.style.font,650):[],captionLines=titleOn&&p.publication.caption?Text.wrap(p.publication.caption,pageW-2*margin,13,p.style.font,400):[],extraHeader=titleOn?(titleLines.length-1)*28+(captionLines.length?captionLines.length*18+8:0):0;
 const availW=pageW-2*margin-(legendW?legendW+25:0),availH=pageH-2*margin-(headBlock-10)-bottomH-extraHeader;
 let scale=p.publication.fit==='none'?1:Math.min(1,availW/width,availH/height);
 const diags=[...ir.diagnostics,...placed.diagnostics,...routed.diagnostics];
 if(scale<=0)throw new DDN.DDNError('DDN070','Page has no usable drawing area');
 const embeddingScale=q(p.publication.embedding_scale,1);if(embeddingScale<=0||embeddingScale>4)throw new DDN.DDNError('DDN070','embedding_scale must be >0 and <=4');
 const fontSize=Math.min(11*q(p.style.font_size,16)/16*scale,rels.length?12*scale:Infinity,11)*embeddingScale,minFont=q(p.publication.minimum_text,10.66);
 if(fontSize<minFont){
  /* B1-046 (D3): name the remedy. smallest = min(11·base/16·scale, rels?12·scale:∞, 11)·embed,
   * so the implied minimum base font is 16·minFont/(11·scale·embed) — unless a
   * fixed cap (12·scale with relations, 11 absolute) binds below the minimum,
   * in which case no base font can fix it and the page must grow. */
  const relCap=rels.length?12*scale*embeddingScale:Infinity,absCap=11*embeddingScale;
  const remedy=Math.min(relCap,absCap)<minFont
   ?'the page scale already caps the smallest text role below the minimum, so a larger base font cannot fix it — enlarge the page, reduce content, or raise publication.minimum_text/embedding_scale'
   :`increase base font to ≥${(16*minFont/(11*scale*embeddingScale)).toFixed(1)}px or enlarge the smallest text role`;
  let d={code:'DDN071',severity:p.publication.overflow==='error'?'error':'warning',message:`Smallest final text ${fontSize.toFixed(2)}px is below minimum ${minFont.toFixed(2)}px — ${remedy}`};if(d.severity==='error')throw new DDN.DDNError(d.code,d.message);diags.push(d);}
 if(legendPlacement==='right'&&legendHeight>pageH-(headBlock+50)-extraHeader)throw new DDN.DDNError('DDN072','Legend exceeds page height');
 if(p.publication.fit==='none'&&(width>availW+.1||height>availH+.1)){if(p.publication.overflow==='error')throw new DDN.DDNError('DDN074','Unscaled drawing exceeds publication area; choose reflow or a larger page');diags.push({code:'DDN074',severity:'warning',message:'Unscaled drawing exceeds publication area'});}
 const tx=pinFocus?margin+availW/2-pinFocus[0]*scale:margin-minX*scale+10,ty=pinFocus?headBlock-20+extraHeader+availH/2-pinFocus[1]*scale:headBlock-20+extraHeader-minY*scale+10;
 let diagram='';
 if(ladderRails)diagram+=`<g class="ddn-ladder-rails"><path d="M${fmt(ladderRails.x0)} ${fmt(ladderRails.y0)}V${fmt(ladderRails.y1)}" fill="none" stroke="${t.ink}" stroke-width="2.5"/><path d="M${fmt(ladderRails.x1)} ${fmt(ladderRails.y0)}V${fmt(ladderRails.y1)}" fill="none" stroke="${t.ink}" stroke-width="2.5"/></g>`;
 for(const f of frames){diagram+=`<g class="ddn-frame" data-frame="${esc(f.id)}">`+rect(f.x,f.y,f.w,f.h,t.rule,t.surface,p.style.look,f.id,0,{...p.style,hachure:false})+text(f.x+15,f.y+26,f.name,13,t.muted,650);
  if(f.x_region===true)diagram+=`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="none" stroke="${t.rule}" stroke-dasharray="6 4"/>`;
  /* B1-060 : interruptible activity region (dashed roundrect) and
   * structured/expansion region keyword. */
  if(f.x_interruptible===true)diagram+=`<rect data-interruptible="true" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="18" fill="none" stroke="${t.rule}" stroke-dasharray="7 5"/>`;
  if(f.x_structured?.mode)diagram+=text(f.x+15,f.y+46,'«'+f.x_structured.mode+'»',11,t.muted,650);
  /* B1-063: collapsed pool — black-box participant band. */
  if(f.x_pool===true&&f.x_collapsed===true)diagram+=`<rect data-collapsed-pool="true" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${esc(t.surface)}" stroke="${esc(t.ink)}" stroke-width="2.4"/>`;
  diagram+=`</g>`;}
 const routeColours={};
 const gensets=new Map();
 for(const a of routes){const colour=mono?'#383838':Palette.semantic(a.reg.colour,t);routeColours[a.id]=colour;
  /* B1-055 : n-ary association — the binary route is suppressed and
   * replaced by the UML diamond junction at the member centroid with one
   * straight spoke per end, each carrying its role/multiplicity labels. */
  const nary=a.r.properties.x_nary;
  if(nary){const s=q(p.style.font_size,16)/16;
   const el=a.r.properties.x_endlabels||{};
   const ends=[{element:a.r.from.element,label:el.source},{element:a.r.to.element,label:el.target},...nary.ends.map(e=>({element:e.element?.$ref,label:{role:e.role,multiplicity:e.multiplicity}}))];
   const gs2=ends.map(e=>byId.get(e.element)).filter(Boolean);
   if(gs2.length>=3){
    const j=[gs2.reduce((v,g)=>v+g.x+g.w/2,0)/gs2.length,gs2.reduce((v,g)=>v+g.y+g.h/2,0)/gs2.length];
    diagram+=`<g class="${cls('ddn-relation','ddn-rel','ddn-nary','ddn-verb-'+slug(a.reg.code||a.r.kind))}" data-id="${esc(a.id)}"><title>${esc(a.r.name)}</title>`;
    for(const [i,g]of gs2.entries()){const pt=rectAnchor(g,j),ang=Math.atan2(j[1]-pt[1],j[0]-pt[0])*180/Math.PI,rad=ang*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad),nx=-dy,ny=dx,e=ends[i].label;
     diagram+=`<path data-nary-spoke="${esc(ends[i].element)}" d="M${fmt(j[0])} ${fmt(j[1])}L${fmt(pt[0])} ${fmt(pt[1])}" fill="none" stroke="${esc(colour)}" stroke-width="${a.reg.width}"/>`;
     if(e?.role)diagram+=`<g class="ddn-endlabel ddn-endlabel-role">`+text(pt[0]+dx*22*s+nx*11*s,pt[1]+dy*22*s+ny*11*s,e.role,11*s,colour,500)+'</g>';
     if(e?.multiplicity)diagram+=`<g class="ddn-endlabel ddn-endlabel-multiplicity">`+text(pt[0]+dx*22*s-nx*11*s,pt[1]+dy*22*s-ny*11*s+4*s,e.multiplicity,11*s,colour,500)+'</g>';}
    diagram+=`<path data-nary-junction="true" d="M${fmt(j[0])} ${fmt(j[1]-9*s)}L${fmt(j[0]+9*s)} ${fmt(j[1])}L${fmt(j[0])} ${fmt(j[1]+9*s)}L${fmt(j[0]-9*s)} ${fmt(j[1])}Z" fill="${esc(colour)}"/>`;
    diagram+='</g>';
    continue;
   }
  }
  if(a.r.properties.x_genset&&!gensets.has(a.r.properties.x_genset.name))gensets.set(a.r.properties.x_genset.name,{gs:a.r.properties.x_genset,pt:a.points.at(-1),ang:Layout.curveDirection(a)+180,colour});
  let mask='';const holes=crossings.filter(c=>p.layout.crossings==='gap'?c.under===a.id:c.over===a.id);if(holes.length){const mid='gap-'+hash(a.id);mask=` mask="url(#${mid})"`;diagram+=`<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="${minX-100}" y="${minY-100}" width="${width+200}" height="${height+200}"><rect x="${minX-100}" y="${minY-100}" width="${width+200}" height="${height+200}" fill="white"/>`+holes.map(h=>`<circle cx="${h.point[0]}" cy="${h.point[1]}" r="7" fill="black"/>`).join('')+'</mask></defs>';}
  diagram+=`<g class="${cls('ddn-relation','ddn-rel','ddn-verb-'+slug(a.reg.code||a.r.kind))}" data-routing="${a.routing||p.layout.routing}" data-id="${esc(a.id)}"><title>${esc(a.r.name)}</title>`;
  const pieces=a.commands||holes.some(h=>h.overDistance!==undefined)?Layout.curvePieces(a,holes):visibleRoutePieces(a.points,holes);
  diagram+=`<g${mask} data-route-pieces="${pieces.length}">`+pieces.map((piece,i)=>p.style.look==='handDrawn'?(a.commands?Sketch.curve:Sketch.polyline)(a.commands?piece.commands:piece.points,{...p.style,id:a.id+':piece:'+i,stroke:colour,width:a.reg.width,dash:a.reg.pattern,dashOffset:-piece.distance,protectedPoints:crossings.filter(c=>c.under===a.id||c.over===a.id).map(c=>c.point)}):`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc(colour)}" stroke-width="${a.reg.width}"${a.reg.pattern?` stroke-dasharray="${esc(a.reg.pattern)}" stroke-dashoffset="${fmt(-piece.distance)}"`:''}/>`).join('')+'</g>';
  /* B1-090: cross-file relations — the badge edge draws dashed and muted. */
  if(a.r.properties.x_external)diagram+=`<g data-external="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc(t.muted)}" stroke-width="${a.reg.width}" stroke-dasharray="7 5"/>`).join('')+'</g>';
  /* B1-090: x_link — external association note at the route's target end. */
  const xl=a.r.properties.x_link;
  if(xl){const s2=q(p.style.font_size,16)/16,xpt=a.points.at(-1);
   diagram+=`<g class="ddn-xlink" data-file="${esc(xl.file)}" data-target="${esc(xl.target)}"${a.r.properties._xlink==='unresolved'?' data-unresolved="true"':''}>`+text(xpt[0]+10*s2,xpt[1]-8*s2,'→ '+xl.file+': '+xl.target+(a.r.properties._xlink==='unresolved'?' (unresolved)':''),10*s2,t.muted,500)+'</g>';}
  if(a.r.properties.x_chen_total){diagram+=`<g${mask} data-total-participation="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc(colour)}" stroke-width="5"/><path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc(t.surface)}" stroke-width="2"/>`).join('')+'</g>';}
  if(a.r.properties.x_critical){const s=q(p.style.font_size,16)/16;diagram+=`<g${mask} data-critical-path="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${t.accent}" stroke-width="${fmt(3*s)}"/>`).join('')+'</g>';}
  const startType=a.r.properties.source_mark||a.reg.start,endType=a.r.properties.target_mark||a.reg.end;
  /* B1-078: IDEF0 tunneled arrows — an open parenthesis at the tunneled end
   * instead of the arrowhead. */
  const tun=side=>{const xt=a.r.properties.x_tunnel||{};if(!xt[side])return false;return true;};
  diagram+=(tun('start')?tunnelMark(a.points[0],Layout.curveDirection(a,true),colour):endMark(a.points[0],Layout.curveDirection(a,true),startType,colour,t.surface))
   +(tun('end')?tunnelMark(a.points.at(-1),Layout.curveDirection(a),colour):endMark(a.points.at(-1),Layout.curveDirection(a),endType,colour,t.surface));
  /* B1-060 : interrupting/exception edges draw a lightning-bolt
   * zigzag over the route (perpendicular jog per segment, alternating side). */
  if(a.r.properties.x_interrupt===true||a.r.properties.x_exception===true){
   const bolt=[];let side=1;
   for(const seg of segments(a.points)){const mx=(seg.a[0]+seg.b[0])/2,my=(seg.a[1]+seg.b[1])/2,dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*8,ny=dx/len*8;
    bolt.push(seg.a,[mx+nx*side,my+ny*side]);side=-side;}
   bolt.push(a.points.at(-1));
   diagram+=`<g data-lightning="${a.r.properties.x_exception===true?'exception':'interrupt'}"><path d="${pathD(bolt)}" fill="none" stroke="${esc(colour)}" stroke-width="1.7"/>`+endMark(a.points.at(-1),Layout.curveDirection(a),'filled',colour,t.surface)+'</g>';}
  /* B1-055 : UML endpoint label slots. Role text sits above the line
   * near the endpoint, multiplicity below it; a qualifier is the small rect at
   * the end. Angles point away from the endpoint along the route. */
  const el=a.r.properties.x_endlabels;
  if(el){const s=q(p.style.font_size,16)/16;
   for(const [key,pt,ang]of[['source',a.points[0],Layout.curveDirection(a,true)+180],['target',a.points.at(-1),Layout.curveDirection(a)+180]]){
    const e=el[key];if(!e)continue;
    const rad=ang*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad),nx=-dy,ny=dx;
    if(e.role)diagram+=`<g class="ddn-endlabel ddn-endlabel-role" data-end="${key}">`+text(pt[0]+dx*24*s+nx*11*s,pt[1]+dy*24*s+ny*11*s,e.role,11*s,colour,500)+'</g>';
    if(e.multiplicity)diagram+=`<g class="ddn-endlabel ddn-endlabel-multiplicity" data-end="${key}">`+text(pt[0]+dx*24*s-nx*11*s,pt[1]+dy*24*s-ny*11*s+4*s,e.multiplicity,11*s,colour,500)+'</g>';
    if(e.qualifier){const qw=Math.max(24*s,e.qualifier.length*6.2*s+10*s),qh=17*s,cx=pt[0]+dx*(qw/2+2),cy=pt[1]+dy*(qh/2+2);
     diagram+=`<g class="ddn-qualifier" data-end="${key}"><rect x="${fmt(cx-qw/2)}" y="${fmt(cy-qh/2)}" width="${fmt(qw)}" height="${fmt(qh)}" fill="${esc(t.surface)}" stroke="${esc(colour)}" stroke-width="1.2"/>`+text(cx-qw/2+5*s,cy+4*s,e.qualifier,10.5*s,colour,500)+'</g>';}
   }
  }
  /* B1-055: association class — dashed connector from the path midpoint to the
   * named class box border. */
  const ac=a.r.properties.x_association_class;
  if(ac){const g=byId.get(ac.class?.$ref);if(g){const [mx,my]=midpoint(a.points),pt=rectAnchor(g,[mx,my]);
   diagram+=`<g class="ddn-association-class" data-class="${esc(ac.class.$ref)}"><path d="M${fmt(mx)} ${fmt(my)}L${fmt(pt[0])} ${fmt(pt[1])}" fill="none" stroke="${esc(colour)}" stroke-width="1.3" stroke-dasharray="6 4"/></g>`;}}
  if(p.projection.profile?.startsWith('sysml.')||['uml.composite@1','uml.activity@2','sysml.activity@1','soaml.services@1','sdl.basic@1','fbd.basic@1','ladder.basic@1'].includes(p.projection.profile)){const s=q(p.style.font_size,16)/16;
   for(const[ep,pt]of[[a.r.from,a.points[0]],[a.r.to,a.points.at(-1)]])if(ep.member&&portIds.has(ep.member)){
    const member=context.members.get(ep.member),xp=member?.properties?.x_pin||{},xo=member?.properties?.x_port||{},xs=member?.properties?.x_service||null;
    const filled=xp.streaming||xo.type==='full'||xs?.kind==='service';
    diagram+=`<rect data-port-square="${esc(ep.member)}"${xp.streaming?' data-streaming="true"':''}${xo.type?` data-port-type="${xo.type}"`:''}${xo.conjugated?' data-conjugated="true"':''}${xs?` data-service="${xs.kind}"`:''} x="${fmt(pt[0]-5*s)}" y="${fmt(pt[1]-5*s)}" width="${fmt(10*s)}" height="${fmt(10*s)}" fill="${filled?esc(colour):esc(t.surface)}" stroke="${esc(colour)}" stroke-width="1.5"/>`;
    /* B1-084: FBD pin type label and negation bubble. */
    const xf=member?.properties?.x_fbd;
    if(xf){
     diagram+=`<g class="ddn-fbd-pin">`+text(pt[0]+(ep===a.r.from?-12*s:12*s),pt[1]+4*s,xf.type,9.5*s,colour,500,ep===a.r.from?'text-anchor="end"':'')+'</g>';
     if(xf.negated)diagram+=`<circle data-negated="true" cx="${fmt(pt[0])}" cy="${fmt(pt[1])}" r="${fmt(4*s)}" fill="${esc(t.surface)}" stroke="${esc(colour)}" stroke-width="1.5"/>`;
    }
    /* B1-072 : SoaML «Service»/«Request» badge by the port square. */
    if(xs)diagram+=`<g class="ddn-port-label ddn-service-badge">`+text(pt[0]+12*s,pt[1]+16*s,'«'+(xs.kind==='service'?'Service':'Request')+'»',10*s,colour,600)+'</g>';
    /* B1-065 : SysML port typing — «proxy»/«full» label, conjugation
     * tilde, multiplicity, nested port sub-squares. */
    const portNote=[xo.conjugated?'~':'',member?.name||'',xo.multiplicity?' ['+xo.multiplicity+']':''].join('');
    if(xo.type||xo.conjugated||xo.multiplicity)diagram+=`<g class="ddn-port-label">`+text(pt[0]+12*s,pt[1]-8*s,(xo.type?'«'+xo.type+'» ':'')+portNote,10.5*s,colour,500)+'</g>';
    for(const [ni,np]of (xo.nested||[]).entries())diagram+=`<rect data-nested-port="${esc(np.name)}" x="${fmt(pt[0]-3*s+ni*7*s)}" y="${fmt(pt[1]-3*s)}" width="${fmt(6*s)}" height="${fmt(6*s)}" fill="${np.type==='full'?esc(colour):esc(t.surface)}" stroke="${esc(colour)}" stroke-width="1.2"/>`;
    if(xp.set)diagram+=`<g class="ddn-pin-set">`+text(pt[0]+12*s,pt[1]-8*s,xp.set,10.5*s,colour,500)+'</g>';}}
  diagram+='</g>';
 }
 /* B1-060 : pins with no incident edge still render on the action
  * border (in→west, out→east), streaming filled, set label beside. */
 if(p.projection.profile==='uml.activity@2'||p.projection.profile==='sysml.activity@1'){
  const s=q(p.style.font_size,16)/16,connected=new Set(rels.flatMap(r=>[r.from.member,r.to.member].filter(Boolean)));
  for(const n of ir.elements){if(!byId.has(n.id)||!n.ports?.length)continue;
   const g=byId.get(n.id);
   for(const pt of n.ports){if(connected.has(pt.id))continue;
    const xp=pt.properties.x_pin||{},west=(pt.properties.direction||'in')!=='out';
    const xx=west?g.x:g.x+g.w,yy=g.y+g.h/2;
    diagram+=`<g class="ddn-pin" data-port-square="${esc(pt.id)}"${xp.streaming?' data-streaming="true"':''}><rect x="${fmt(xx-5*s)}" y="${fmt(yy-5*s)}" width="${fmt(10*s)}" height="${fmt(10*s)}" fill="${xp.streaming?esc(t.ink):esc(t.surface)}" stroke="${esc(t.ink)}" stroke-width="1.5"/>`+(xp.set?text(xx+(west?-8*s:8*s),yy-8*s,xp.set,10.5*s,t.muted,500,west?'text-anchor="end"':''):'')+'</g>';}
  }
 }
 // B1-061 : communication-diagram fragments — dashed frame with an
 // operator pentagon over the covered message routes; guards at operand starts.
 if(p.projection.profile==='uml.communication@2'){
  const s=q(p.style.font_size,16)/16,byRelId=new Map(routes.map(a=>[a.r.id,a]));
  const drawFrag=(fx,owner,depth,x0,y0,x1,y1)=>{
   const pad=(30+depth*10)*s,rx0=Math.max(4*s,x0-pad),ry0=Math.max(4*s,y0-pad),rx1=x1+pad,ry1=y1+pad;
   const opw=Math.max(54*s,Text.measure(fx.operator,11*s,p.style.font,650).width+22*s);
   let out=`<g class="ddn-fragment ddn-fragment-${esc(fx.operator)}" data-operator="${esc(fx.operator)}" data-owner="${esc(owner)}"><rect x="${fmt(rx0)}" y="${fmt(ry0)}" width="${fmt(rx1-rx0)}" height="${fmt(ry1-ry0)}" fill="none" stroke="${t.ink}" stroke-width="1.3" stroke-dasharray="7 5"/>`;
   out+=`<path d="M${fmt(rx0)} ${fmt(ry0)}H${fmt(rx0+opw)}V${fmt(ry0+12*s)}L${fmt(rx0+opw-10*s)} ${fmt(ry0+22*s)}H${fmt(rx0)}Z" fill="${esc(t.surface)}" stroke="${esc(t.ink)}" stroke-width="1.2"/>`+text(rx0+11*s,ry0+15*s,fx.operator,11*s,t.ink,650);
   for(const op of fx.operands){if(op.guard){const first=byRelId.get(op.messages[0]?.$ref);if(first){const [mx,my]=midpoint(first.points);out+=text(mx,my-22*s,'['+op.guard+']',11*s,t.ink,500);}}
    for(const nf of op.fragments||[]){}}
   return out+'</g>';};
  for(const a of routes){const fx=a.r.properties.x_fragment;if(!fx)continue;
   const pts=[];const collect=(f2)=>{for(const op of f2.operands){for(const mref of op.messages){const rr=byRelId.get(mref?.$ref);if(rr)pts.push(...rr.points);}for(const nf of op.fragments||[])collect(nf);}};
   collect(fx);if(pts.length<2)continue;
   const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
   diagram+=drawFrag(fx,a.r.id,0,Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));}
 }
 // B1-055: generalization-set labels at the shared target end.
 for(const [name,{gs,pt,ang,colour}] of gensets){const s=q(p.style.font_size,16)/16,rad=ang*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad);
  const str=name+' {'+(gs.disjoint===false?'overlapping':'disjoint')+', '+(gs.complete?'complete':'incomplete')+'}';
  diagram+=`<g class="ddn-genset" data-genset="${esc(name)}">`+text(pt[0]+dx*36*s,pt[1]+dy*36*s-8*s,str,11*s,colour,500)+'</g>';}
 // Bridge geometry is explicit postprocessing. A rounded bridge is a local exception to orthogonality.
 if(p.layout.crossings!=='gap')for(const c of crossings){
  const col=routeColours[c.over];
  if(c.overDistance!==undefined){const route=routes.find(r=>r.id===c.over),commands=Layout.crossingBridge(c,route,p.layout.crossings),points=Layout.flattenCurve(commands).points;
   if(geoms.some(g=>Layout.segs(points).some(s=>Layout.segmentBox(s,Layout.box(g,2))))||routed.labels.some(g=>Layout.segs(points).some(s=>Layout.segmentBox(s,Layout.box(g,2)))))throw new DDN.DDNError('DDN224','Crossing jump obstructs an object or label; increase spacing or select crossings:gap');
   diagram+=`<path data-crossing-jump="true" d="${Layout.pathData(commands)}" stroke="${esc(col)}" stroke-width="2" fill="none"/>`;
  }else{const[x,y]=c.point,r=7,orientation=c.overHorizontal?0:90;diagram+=`<g transform="translate(${x} ${y}) rotate(${orientation})"><path d="${p.layout.crossings==='bridge'?`M-${r} 0 C-${r} -${r*1.5} ${r} -${r*1.5} ${r} 0`:`M-${r} 0V-${r}H${r}V0`}" stroke="${esc(col)}" stroke-width="2" fill="none"/></g>`;}
 }
 // B1-033 (D1/D4): declarative SMIL motion — <animateMotion> markers travelling
 // the existing route paths and <animate> colour/opacity pulses. Deterministic:
 // same DDN, same animated SVG; diagrams without motion properties are
 // byte-identical to before. options.noMotion strips animation for print/static
 // targets (a render option, not text munging). Markers get stable
 // ids/classes/data-hop attributes so the tool controller can drive them.
 const motionScene=[],flowScene=[];
 if(!options.noMotion){
  const routeById=new Map(routes.map(a=>[a.id,a]));
  const pathLength=points=>segments(points).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0);
  const routeD=a=>a.commands?Layout.pathData(a.commands):pathD(a.points);
  const RATE_MAX=32,motionRate=v=>Math.min(RATE_MAX,Math.max(1,Number.isSafeInteger(v)?v:1));
  const markerShape=(kind,size,color,anim)=>kind==='square'?`<rect x="${fmt(-size/2)}" y="${fmt(-size/2)}" width="${fmt(size)}" height="${fmt(size)}" fill="${esc(color)}">${anim}</rect>`:kind==='rect'?`<rect x="${fmt(-size*.75)}" y="${fmt(-size/2)}" width="${fmt(size*1.5)}" height="${fmt(size)}" fill="${esc(color)}">${anim}</rect>`:`<circle r="${fmt(size/2)}" fill="${esc(color)}">${anim}</circle>`;
  for(const a of routes){
   const props=a.r.properties||{};if(props.motion!=='flow'&&props.motion!=='pulse')continue;
   const len=pathLength(a.points);if(!(len>0))continue;
   const speed=q(props.speed,60),dur=fmt(len/speed);
   if(props.motion==='pulse'){
    const pulse=props.pulse_color||t.accent;
    diagram+=`<g class="ddn-motion ddn-pulse" data-relation="${esc(a.id)}" data-hop="0" data-hop-start="0" data-hop-end="${dur}" data-dur="${dur}"><path d="${esc(routeD(a))}" fill="none" stroke="${esc(routeColours[a.id])}" stroke-width="${a.reg.width}" opacity=".9"><animate attributeName="stroke" values="${esc(routeColours[a.id])};${esc(pulse)};${esc(routeColours[a.id])}" dur="${dur}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".25;1;.25" dur="${dur}s" repeatCount="indefinite"/></path></g>`;
    motionScene.push({relation:a.id,kind:'pulse',duration:len/speed,rate:1});
    continue;
   }
   const rate=motionRate(props.rate),size=q(props.marker_size,8),colour=props.marker_color||routeColours[a.id];
   let g=`<g class="ddn-motion" data-relation="${esc(a.id)}" data-hop="0" data-hop-start="0" data-hop-end="${dur}" data-dur="${dur}">`;
   for(let i=0;i<rate;i++)g+=markerShape(props.marker||'circle',size,colour,`<animateMotion dur="${dur}s" begin="${fmt(-i*(len/speed)/rate)}s" repeatCount="indefinite" rotate="auto" path="${esc(routeD(a))}"/>`);
   diagram+=g+'</g>';
   motionScene.push({relation:a.id,kind:'flow',duration:len/speed,rate});
  }
  for(const f of ir.view.flows||[]){
   const props=f.properties||{};
   const speed=q(props.speed,60),size=q(props.marker_size,8),rate=motionRate(props.rate),colour=props.marker_color||t.accent;
   const hops=f.hops.map(id=>routeById.get(id));
   if(hops.some(a=>!a))continue;
   const lens=hops.map(a=>pathLength(a.points)),total=lens.reduce((x,y)=>x+y,0);
   if(!(total>0))continue;
   const durT=total/speed;let acc=0;const hopScene=[];
   let g=`<g class="ddn-flow ddn-flow-${slug(f.local||f.id)}" data-flow="${esc(f.id)}" data-dur="${fmt(durT)}"><title>${esc(f.name)}</title>`;
   hops.forEach((a,i)=>{
    const hopDur=lens[i]/speed,start=acc,end=acc+hopDur;acc=end;
    hopScene.push({relation:a.id,start,end});
    const sF=fmt(start/durT),eF=fmt(end/durT);
    // Each hop marker owns its hop's route path but shares the flow cycle:
    // keyTimes confine travel to [start,end] and a discrete opacity hides it
    // outside its window, so the chain reads as one marker hopping the route.
    const keyTimes=i===0?`0;${eF};1`:`0;${sF};${eF};1`,keyPoints=i===0?`0;1;1`:`0;0;1;1`;
    const opValues=i===0?'1;0':'0;1;0',opTimes=i===0?`0;${eF}`:`0;${sF};${eF}`;
    g+=`<g class="ddn-flow-hop" data-hop="${i}" data-hop-start="${fmt(start)}" data-hop-end="${fmt(end)}">`;
    for(let j=0;j<rate;j++){const begin=fmt(-j*durT/rate);
     g+=markerShape(props.marker||'circle',size,colour,`<animateMotion dur="${fmt(durT)}s" begin="${begin}s" repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="${keyPoints}" keyTimes="${keyTimes}" path="${esc(routeD(a))}"/><animate attributeName="opacity" values="${opValues}" keyTimes="${opTimes}" calcMode="discrete" dur="${fmt(durT)}s" begin="${begin}s" repeatCount="indefinite"/>`);}
    g+='</g>';
   });
   diagram+=g+'</g>';
   flowScene.push({id:f.id,name:f.name,duration:durT,hops:hopScene});
  }
 }
 geoms.forEach(g=>diagram+=renderNode(g,p,t,registry));
 for(const d of subs){
  if(d.mode==='inline'&&d.child){const child=render(d.child,registry,glyphDefs),childScale=Math.min(d.w/child.scene.width,d.h/child.scene.height)*scale*embeddingScale;const childMin=child.scene.smallestText*childScale;if(childMin<minFont){if(p.publication.overflow==='error')throw new DDN.DDNError('DDN076','Inline child text is below final minimum; enlarge the child or link a detail view');diags.push({code:'DDN076',severity:'warning',message:'Inline child rendered below configured minimum'});}let inner=child.svg.replace(/<\?xml[^>]*>/,'');const prefix='sub-'+hash(d.id)+'-';inner=inner.replace(/ id="([^"]+)"/g,(m,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${prefix}${id})`).replace(/(href|xlink:href)="#([^"]+)"/g,(m,a,id)=>`${a}="#${prefix}${id}"`).replace(/aria-labelledby="[^"]*"/g,'').replace(/<svg /,`<svg x="${d.x}" y="${d.y}" `).replace(/width="[^"]*" height="[^"]*"/,`width="${d.w}" height="${d.h}"`);diagram+=`<g class="ddn-inline" data-view="${esc(d.target)}">`+inner+'</g>';}
  else{if(!/^[A-Za-z0-9_.\/-]+$/.test(d.targetLocal)||d.targetLocal.startsWith('/')||d.targetLocal.includes('..'))throw new DDN.DDNError('DDN078','Subdiagram reference target must be a safe relative identifier: '+d.targetLocal);diagram+=`<g class="ddn-subdiagram" data-view="${esc(d.target)}"><a href="${esc(d.targetLocal)}.svg">`+rect(d.x,d.y,d.w,d.h,t.accent,t.surface,p.style.look,d.id,0,p.style)+glyph('frame',d.x+14,d.y+18,25,t.accent)+text(d.x+48,d.y+33,d.name,15,t.ink,600)+text(d.x+14,d.y+64,'↗ '+d.targetLocal+' · diagram reference',11,t.muted)+'</a></g>';}
 }
 for(const a of routes){
  /* B1-079: Petri arc weights print at the target end of the arc. */
  const wgt=a.r.properties.x_petri?.weight;
  if(wgt>1&&p.detail!=='shapes'){
   const sc=q(p.style.font_size,16)/16,[tx,ty]=a.points.at(-1),ang=Layout.curveDirection(a)*Math.PI/180;
   diagram+=`<g class="ddn-petri-weight">`+text(tx-Math.cos(ang)*18*sc-Math.sin(ang)*10*sc,ty-Math.sin(ang)*18*sc+Math.cos(ang)*10*sc+4*sc,String(wgt),11*sc,t.ink,600)+'</g>';
  }
  if(a.r.kind==='vsm.einfo'){
   /* B1-081: einfo relations draw a zigzag over the route (electronic info). */
   const bolt=[];let side=1;
   for(const seg of segments(a.points)){const mx=(seg.a[0]+seg.b[0])/2,my=(seg.a[1]+seg.b[1])/2,dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*7,ny=dx/len*7;
    bolt.push(seg.a,[mx+nx*side,my+ny*side]);side=-side;}
   bolt.push(a.points.at(-1));
   const ecolour=mono?'#383838':Palette.semantic(a.reg.colour,t);
   diagram+=`<g class="ddn-vsm-einfo" data-zigzag="electronic"><path d="${pathD(bolt)}" fill="none" stroke="${esc(ecolour)}" stroke-width="1.6"/>`+endMark(a.points.at(-1),Layout.curveDirection(a),'open',ecolour,t.surface)+'</g>';
   continue;
  }
  if(a.r._visualLabel===false||p.detail==='shapes')continue;let [x,y]=a.hint.callout?a.hint.callout.map(v=>q(v)):midpoint(a.points);let mode=p.legend.mode;
  if(mode==='numbers'){diagram+=`<g class="ddn-callout ddn-label" data-id="${esc(a.id)}"><circle cx="${x}" cy="${y}" r="14" fill="${t.surface}" stroke="${t.ink}" stroke-width="1.5"/>`+text(x,y+4.5,String(ir.view.keys[a.id]),12,t.ink,700,'text-anchor="middle"')+'</g>';}
  else {let s=mode==='tokens'?a.reg.code:a.r.name,w=a.label.w;diagram+=`<g class="ddn-label" data-id="${esc(a.id)}"><rect x="${x-w/2}" y="${y-12}" width="${w}" height="24" rx="3" fill="${t.surface}"/>`+text(x,y+4,s,12,t.ink,500,'text-anchor="middle"')+'</g>';
   /* B1-061: {…} time/duration constraints under the message label. */
   const cons=[a.r.properties.x_message?.time,a.r.properties.x_message?.duration].filter(Boolean);
   if(cons.length&&p.projection.profile==='uml.communication@2')diagram+=`<g class="ddn-timing-constraint">`+text(x,y+22,cons.join(' '),11,t.muted,500,'text-anchor="middle"')+'</g>';}
 }
 if(vsmLadder){
  const L=vsmLadder,ls=L.s,top=maxY-L.h-16*ls,bot=top+L.h;
  let lx=minX-24*ls,level=0,path=`M${fmt(lx)} ${fmt(top)}`;
  const labels=[];
  for(const step of L.steps){
   path+=`L${fmt(step.x)} ${fmt(level?bot:top)}`;
   level=1-level;
   path+=`L${fmt(step.x)} ${fmt(level?bot:top)}`;
   if(step.va!==undefined)labels.push(text(step.x,top-6*ls,String(step.va)+(step.unit?' '+step.unit:''),11*ls,t.ink,600,'text-anchor="middle"'));
   if(step.nva!==undefined)labels.push(text(step.x,bot+16*ls,String(step.nva)+(step.unit?' '+step.unit:''),11*ls,t.muted,500,'text-anchor="middle"'));
  }
  const totVA=L.steps.reduce((n,st)=>n+(st.va||0),0),totNVA=L.steps.reduce((n,st)=>n+(st.nva||0),0);
  path+=`L${fmt(maxX+24*ls)} ${fmt(level?bot:top)}`;
  labels.push(text(maxX+8*ls,top-6*ls,'Σ '+totVA,11*ls,t.ink,650,''));
  labels.push(text(maxX+8*ls,bot+16*ls,'Σ '+totNVA,11*ls,t.muted,650,''));
  diagram+=`<g class="ddn-vsm-ladder"><path d="${path}" fill="none" stroke="${esc(t.ink)}" stroke-width="2"/>`+labels.join('')+text(lx,bot+34*ls,'VA / NVA timeline',10.5*ls,t.muted,500,'')+'</g>';
 }
 const scene={smallestText:fontSize,width:pageW,height:pageH,scale,origin:[tx,ty],nodes:geoms.map(({n,k,fieldRows,sample,...g})=>({...g,fields:g.fields.map(f=>f.id),fieldRows:fieldRows.map(({field,...row})=>row)})),routes:routes.map(({id,points,label,source_side,target_side,commands,routing,strategy,curveFamily,radius,appliedTension})=>({id,points,label:label.bounds,source_side,target_side,routing:routing||p.layout.routing,...(commands?{commands,strategy,curveFamily,...(radius!==undefined?{curveRadius:radius}:{}),...(appliedTension!==undefined?{appliedTension}:{}),flattenTolerance:Layout.CURVE_TOLERANCE}:{})})),crossings,frames,subdiagrams:subs,quality:routed.quality,layout:{...placed.telemetry,...routed.telemetry,algorithm:p.layout.algorithm,routing:p.layout.routing,engine:'ddn-native@'+DDN.VERSION},drawingBounds:{x:minX,y:minY,w:width,h:height},drawingArea:{x:margin,y:headBlock-20+extraHeader,w:availW,h:availH},...(motionScene.length?{motion:motionScene}:{}),...(flowScene.length?{flows:flowScene}:{}),...(pinFocus?{focus:{world:pinFocus,page:[tx+pinFocus[0]*scale,ty+pinFocus[1]*scale]}}:{})};
 const font={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'}[p.style.font]||'DejaVu Sans, Arial, sans-serif';
 const fontClass='ddn-font-'+hash(font);
 const viewClass=cls('ddn-svg','ddn-view-'+slug(p.projection?.kind||'graph'),p.projection?.profile&&'ddn-profile-'+slug(p.projection.profile),fontClass);
 let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg class="${viewClass}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(pageW)}" height="${fmt(pageH)}" viewBox="0 0 ${fmt(pageW)} ${fmt(pageH)}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="ddn-title ddn-desc"><title id="ddn-title">${esc(ir.view.name)}</title><desc id="ddn-desc">DDN 0.5 proposed standard example. ${esc(p.publication.caption||'')} ${esc(p.style.look)} look; ${esc(p.style.theme)} presentation. Crossings are not connections.${legendPlacement==='none'?'':' Relationship details are in the adjacent legend.'}</desc><defs>${glyphDefs}</defs><style>.${fontClass}{font-family:${font}} .ddn-node:focus{outline:none}</style><rect width="100%" height="100%" fill="${t.background}"/>`;
 if(titleOn)out+=text(margin,margin+5,'DDN / PROPOSED STANDARD / 0.5',11,t.muted,650)+multilines(margin,margin+34,titleLines,24,t.ink,28,650)+multilines(margin,margin+34+titleLines.length*28,captionLines,13,t.muted,18)+text(pageW-margin,margin+5,p.style.look+' · '+p.style.theme,11,t.muted,500,'text-anchor="end"');
 out+=`<g id="drawing" transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})">${diagram}</g>`;
 if(legendPlacement!=='none'&&legendEntries.length){let lx=legendPlacement==='right'?pageW-margin-legendW:margin,ly=legendPlacement==='right'?headBlock-15+extraHeader:pageH-margin-legendHeight;out+=line(lx-12,ly-12,lx-12,legendPlacement==='right'?pageH-margin-40:ly+legendHeight,t.rule,1);out+=text(lx,ly,'RELATIONSHIP KEY',11,t.muted,700);ly+=33;
  for(const entry of legendEntries){const key=p.legend.mode==='numbers'?entry.key:entry.reg.code;if(p.legend.mode==='numbers')out+=`<circle cx="${lx+12}" cy="${ly-4}" r="12" fill="${t.surface}" stroke="${t.ink}"/>`+text(lx+12,ly,String(key),11,t.ink,700,'text-anchor="middle"');else out+=text(lx,ly,String(key),11,t.muted,650);
   out+=multilines(lx+34,ly,entry.lines,12,t.ink,18);ly+=Math.max(44,entry.lines.length*18+16);}
 }
 if(footerOn)out+=line(margin,pageH-39,pageW-margin,pageH-39,t.rule,1)+text(margin,pageH-20,'Same data · independent view · fixed semantics · presentation only',11,t.muted)+text(pageW-margin,pageH-20,ir.view.local+' / '+ir.registry,11,t.muted,400,'text-anchor="end"');
 out+='</svg>';
 const textAfter=Text.stats(),estimated=textAfter.estimated-textBefore.estimated;
 if(estimated){if(p.publication.metrics==='required')throw new DDN.DDNError('DDN077','Required measured fonts unavailable; supply text metrics or a browser provider');diags.push({code:'DDN-TW01',severity:'warning',message:'Some text runs used estimated metrics; this is not a typography-certified publication.'});}
 scene.layoutState={format:'ddn-layout-state@1',view:options.viewKey||ir.view.id,positions:Object.fromEntries(geoms.map(g=>[g.id,[g.x,g.y]]))};
 scene.textMeasurement={mode:estimated?'estimated':'measured',requestedFont:p.style.font,provider:textAfter.canvas>textBefore.canvas?'browser-canvas':'pinned-cache'};
 return{svg:out,scene,diagnostics:diags,_drawing:diagram,_defs:glyphDefs,_ir:ir};
}
const api={palette:Palette,render,measureNode,visibleRoutePieces,esc,hash,wrap,text,multilines,line,glyph,rect,badge,pretty,themes,pathD,endMark,cls,slug};
publishNamespace('DDNRender',api);
export default api;
