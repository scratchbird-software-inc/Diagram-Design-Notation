/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN seeded sketch primitives, rendering revision 2.
 * Pure vector geometry; no raster filter, remote resource, DOM, or font file.
 * Model coordinates are never mutated by a drawing treatment.
 */
import {publishNamespace} from './ddn-module-registry.js';
'use strict';
const f=n=>Number(n.toFixed(3));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function rng(key){
  let h=2166136261;
  for(const c of String(key)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return ()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;};
}
const signed=(r,n)=>(r()-.5)*2*n;
function settings(o={}){
  return {id:o.id||'shape',seed:o.seed??42,roughness:o.roughness??1.8,
    hachure:o.hachure!==false,stroke:o.stroke||'#334155',fill:o.fill||'none',width:o.width??1.9,...o};
}
/* Smooth low-frequency deviations around a straight segment. Intermediate
 * points are shared by adjacent cubic pieces, not unrelated noisy line ends. */
function segment(a,b,r,amount){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<.01)return '';
  if(amount===0||len<10)return `L${f(b[0])} ${f(b[1])}`;
  const normal=[-dy/len,dx/len],count=Math.max(1,Math.ceil(len/95));
  let last=a,out='';
  for(let i=1;i<=count;i++){
    const t=i/count,offset=i===count?0:signed(r,amount*.8);
    const end=[a[0]+dx*t+normal[0]*offset,a[1]+dy*t+normal[1]*offset];
    const local=Math.hypot(end[0]-last[0],end[1]-last[1]);
    const bend=Math.min(amount*1.8,local*.095),o1=signed(r,bend),o2=signed(r,bend);
    const p=[last[0]+(end[0]-last[0])*.32+normal[0]*o1,last[1]+(end[1]-last[1])*.32+normal[1]*o1];
    const q=[last[0]+(end[0]-last[0])*.68+normal[0]*o2,last[1]+(end[1]-last[1])*.68+normal[1]*o2];
    out+=`C${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])} ${f(end[0])} ${f(end[1])}`;
    last=end;
  }
  return out;
}
function strokes(paths,o,extra=''){
  return paths.map((d,i)=>`<path d="${d}" fill="none" stroke="${escape(o.stroke)}" stroke-width="${f(i?o.width*.68:o.width)}" stroke-linecap="round" stroke-linejoin="round"${i?' opacity=".56"':''}${o.dash?` stroke-dasharray="${escape(o.dash)}" stroke-dashoffset="${f(o.dashOffset||0)}"`:''}${extra}/>`).join('');
}
function exactRounded(x,y,w,h,r){
  return `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
}
function roughPolygon(points,o){
  const passes=o.roughness===0?1:2,paths=[];
  for(let pass=0;pass<passes;pass++){
    const r=rng(`${o.seed}:${o.id}:outline:${pass}`),a=o.roughness*(pass?.9:1);
    const vertices=points.map(([x,y])=>[x+signed(r,a*.8),y+signed(r,a*.8)]);
    let d=`M${f(vertices[0][0])} ${f(vertices[0][1])}`;
    for(let i=0;i<vertices.length;i++)d+=segment(vertices[i],vertices[(i+1)%vertices.length],r,a);
    paths.push(d+'Z');
  }
  return strokes(paths,o);
}
/* Clip diagonal hatch segments analytically against a convex card polygon.
 * No shared SVG IDs are required, including when a view is nested twice. */
function hatch(points,o){
  if(!o.hachure||o.roughness===0||o.fill==='none')return '';
  const min=Math.min(...points.map(p=>p[0]+p[1])),max=Math.max(...points.map(p=>p[0]+p[1]));
  const gap=13,r=rng(`${o.seed}:${o.id}:hatch`),parts=[];
  for(let c=min+7;c<max-6;c+=gap){
    const sum=c+signed(r,1.6),hits=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],den=b[0]+b[1]-a[0]-a[1];
      if(Math.abs(den)<1e-8)continue;
      const t=(sum-a[0]-a[1])/den;
      if(t>=0&&t<1)hits.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
    }
    if(hits.length<2)continue;
    hits.sort((a,b)=>a[0]-b[0]);
    const a=hits[0],b=hits.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    if(len<12)continue;
    const inset=3+signed(r,1.1),p=[a[0]+dx/len*inset,a[1]+dy/len*inset],q=[b[0]-dx/len*inset,b[1]-dy/len*inset];
    parts.push(`M${f(p[0])} ${f(p[1])}`+segment(p,q,r,o.roughness*.35));
  }
  return `<path data-sketch-hachure="true" d="${parts.join(' ')}" fill="none" stroke="${escape(o.stroke)}" stroke-width=".75" stroke-linecap="round" opacity=".11"/>`;
}
function polygon(points,options={}){
  const o=settings(options),exact=points.map((p,i)=>(i?'L':'M')+p.join(' ')).join('')+'Z';
  return `<g data-sketch="outline"><path d="${exact}" fill="${escape(o.fill)}" stroke="none"/>`+hatch(points,o)+roughPolygon(points,o)+'</g>';
}
function box(x,y,w,h,options={}){
  const o=settings(options),radius=Math.min(options.radius||0,w/2,h/2);
  if(!radius)return polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],o);
  const points=[],r=radius;
  for(const[cx,cy,angle]of[[x+w-r,y+r,-90],[x+w-r,y+h-r,0],[x+r,y+h-r,90],[x+r,y+r,180]])
    for(let i=0;i<=6;i++){const t=(angle+i*15)*Math.PI/180;points.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}
  let out=`<g data-sketch="rounded-outline"><path d="${exactRounded(x,y,w,h,r)}" fill="${escape(o.fill)}" stroke="none"/>`+hatch(points,o);
  const paths=[];
  for(let pass=0;pass<(o.roughness===0?1:2);pass++){
    const random=rng(`${o.seed}:${o.id}:rounded:${pass}`),a=o.roughness;
    const top=y+signed(random,a*.65),right=x+w+signed(random,a*.65),bottom=y+h+signed(random,a*.65),left=x+signed(random,a*.65);
    const p=[[x+r,top],[x+w-r,top],[right,y+r],[right,y+h-r],[x+w-r,bottom],[x+r,bottom],[left,y+h-r],[left,y+r]];
    let d=`M${f(p[0][0])} ${f(p[0][1])}`;
    for(let i=0;i<8;i+=2){
      d+=segment(p[i],p[i+1],random,a);
      const next=p[(i+2)%8];
      const corner=[[right,top],[right,bottom],[left,bottom],[left,top]][i/2];
      d+=`Q${f(corner[0])} ${f(corner[1])} ${f(next[0])} ${f(next[1])}`;
    }
    paths.push(d+'Z');
  }
  return out+strokes(paths,o)+'</g>';
}
function polyline(points,options={}){
  const o=settings(options),paths=[];
  if(o.protectedPoints?.length){
    const split=[points[0]];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),cuts=[];
      if(length>0)for(const p of o.protectedPoints){
        const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length*length);
        const distance=Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]);
        if(t>0&&t<1&&distance<.01)for(const q of [t-14/length,t+14/length])if(q>0&&q<1)cuts.push(q);
      }
      for(const t of [...new Set(cuts)].sort((a,b)=>a-b))split.push([a[0]+dx*t,a[1]+dy*t]);
      split.push(b);
    }
    points=split;
  }
  // Dashed relation families get ONE pass to preserve their registered rhythm.
  const passes=o.dash||o.roughness===0?1:2;
  for(let pass=0;pass<passes;pass++){
    const r=rng(`${o.seed}:${o.id}:line:${pass}`),amplitude=o.roughness*(pass?.64:.5);
    let d=`M${f(points[0][0])} ${f(points[0][1])}`;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      // Keep 12px around semantic endpoints and orthogonal bends exact.
      const guard=Math.min(12,len/3);
      const p=len?[a[0]+dx/len*guard,a[1]+dy/len*guard]:a;
      const q=len?[b[0]-dx/len*guard,b[1]-dy/len*guard]:b;
      d+=`L${f(p[0])} ${f(p[1])}`+segment(p,q,r,amplitude)+`L${f(b[0])} ${f(b[1])}`;
    }
    paths.push(d);
  }
  return `<g data-sketch="line">`+strokes(paths,o)+'</g>';
}

function curve(commands,options={}){
 const o=settings(options),paths=[];if(!commands.length)return '';
 for(let pass=0;pass<(o.dash||o.roughness===0?1:2);pass++){
  const r=rng(`${o.seed}:${o.id}:curve:${pass}`);let d=`M${f(commands[0].from[0])} ${f(commands[0].from[1])}`;
  for(const c of commands){if(c.kind==='line'){d+=`L${f(c.to[0])} ${f(c.to[1])}`;continue;}
   // Change handle length, not handle direction: true attachment and tangent
   // semantics are retained at curve ends. Maximum pen perturbation is <1px.
   const move=(control,anchor)=>{const dx=control[0]-anchor[0],dy=control[1]-anchor[1],len=Math.hypot(dx,dy);const a=pass?signed(r,Math.min(.65,o.roughness*.22)):0;return len?[control[0]+dx/len*a,control[1]+dy/len*a]:control;};
   const a=move(c.c1,c.from),b=move(c.c2,c.to);d+=`C${f(a[0])} ${f(a[1])} ${f(b[0])} ${f(b[1])} ${f(c.to[0])} ${f(c.to[1])}`;
  }paths.push(d);
 }return `<g data-sketch="curve">`+strokes(paths,o)+'</g>';
}
const api={box,polygon,polyline,curve};
publishNamespace('DDNSketch',api);
export default api;
