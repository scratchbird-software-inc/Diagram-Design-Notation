/*! DDN 0.7.0 · GPL-2.0-or-later · modular runtime bundle: ddn-graph — Graph renderer (ERD/flow/native layout, routing, interaction). Registers the "graph" projection kind. */
(function () {
  'use strict';

  var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-graph requires ddn-core.js to be loaded first');if(h.DDNLive.VERSION!=="0.7.0")throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNRender)return;

  var pkg = {
    "version": "0.7.0"}
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

  /* SPDX-License-Identifier: GPL-2.0-or-later. Fixed theme-aware semantic palette.
   * Dark/night variants retain the registered colour's hue association, with
   * deterministic lighter tints. Measured contrast is not full WCAG certification.
   */
  const themes$1={default:{background:'#F6F8FC',surface:'#FFFFFF',ink:'#17263D',muted:'#52647B',rule:'#D8E1EB',accent:'#244CB4'},base:{background:'#FFFFFF',surface:'#FFFFFF',ink:'#17263D',muted:'#52647B',rule:'#D8E1EB',accent:'#244CB4'},neutral:{background:'#FFFFFF',surface:'#FFFFFF',ink:'#222222',muted:'#555555',rule:'#BBBBBB',accent:'#303030'},dark:{background:'#202C3E',surface:'#2A3A50',ink:'#EDF3FC',muted:'#CBD8EA',rule:'#7389A5',accent:'#ABCBFF',lowLight:true},night:{background:'#2D3B50',surface:'#394B63',ink:'#F1F5FC',muted:'#D1DCEB',rule:'#93A8C1',accent:'#C3DAFF',lowLight:true},forest:{background:'#F2F6EF',surface:'#FBFDF9',ink:'#20342B',muted:'#526557',rule:'#D6E0D0',accent:'#375A42'}};
  function rgb(hex){const h=hex.replace('#','');return [h.slice(0,2),h.slice(2,4),h.slice(4,6)].map(v=>parseInt(v,16));}
  function mix$1(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('').toUpperCase();}
  function luminance(hex){const [r,g,b]=rgb(hex).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  const cache$1=new Map();
  function semantic(colour,theme){if(typeof theme==='string')theme=themes$1[theme];if(!theme.lowLight)return colour;const key=colour+theme.background+theme.surface;if(cache$1.has(key))return cache$1.get(key);let out;for(let i=65;i<=100;i++){out=mix$1(colour,'#EEF4FC',i/100);if(contrast(out,theme.background)>=4.5&&contrast(out,theme.surface)>=4.5)break;}cache$1.set(key,out);return out;}
  function node(kind,theme){return theme.lowLight?{ink:semantic(kind.colour,theme),fill:mix$1(theme.surface,kind.colour,.06),text:theme.ink}:{ink:kind.colour,fill:kind.fill,text:'#26364D'};}
  const api$8={themes: themes$1,semantic,node,contrast,mix: mix$1};
  publishNamespace('DDNPalette',api$8);

  /* SPDX-License-Identifier: GPL-2.0-or-later. Measured text service with explicit fallback provenance. No font files bundled. */
  /* Pinned measurement cache: loaded from the standard registry when running
   * under Node directly from the sources (import.meta.url resolves). In the
   * built dist bundles import.meta.url is rewritten to `undefined`, so the
   * browser/estimation path is taken exactly as before. */
  let initial=null;
  if(typeof process!=='undefined'&&process.getBuiltinModule){
   try{
    const url=process.getBuiltinModule('node:url'),path=process.getBuiltinModule('node:path'),fs=process.getBuiltinModule('node:fs');
    const here=path.dirname(url.fileURLToPath(undefined));
    initial=JSON.parse(fs.readFileSync(path.join(here,'../../standard/registry/text-metrics.json'),'utf8'));
   }catch{}
  }
  const FONTS={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'};
  let cache=initial?.measurements||{},provider=null,providerName=null,context=null;const requests=new Map();const counts={estimated:0,canvas:0,cache:0,provider:0};
  const key=(s,size,font,weight)=>JSON.stringify([String(s),+size,font,weight]);
  const segments$1=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('und',{granularity:'grapheme'}):null;
  const graphemes=s=>segments$1?[...segments$1.segment(String(s))].map(x=>x.segment):[...String(s)];
  function setMetrics(data){cache=data?.measurements||data||{};}
  function setProvider(fn,name='custom'){provider=fn;providerName=name;}
  function measure$1(s,size=14,font='sans',weight=400){s=String(s??'');const k=key(s,size,font,weight);let result;
   if(provider){counts.provider++;result=provider(s,size,FONTS[font]||font,weight);if(!result||!Number.isFinite(result.width))throw new Error('Text measurement provider returned invalid width');return {...result,method:providerName};}
   if(typeof document!=='undefined'&&document.createElement){try{context??=document.createElement('canvas').getContext('2d');if(context){counts.canvas++;context.font=`${weight} ${size}px ${FONTS[font]||font}`;const m=context.measureText(s);return {width:m.width,ascent:m.actualBoundingBoxAscent||size*.85,descent:m.actualBoundingBoxDescent||size*.25,method:'browser-canvas'};}}catch{}}
   if(cache[k]){counts.cache++;return {...cache[k],method:'pinned-measurement-cache'};}
   counts.estimated++;
   // Bounded retention: the capture map is a debugging aid, not a leak. FIFO-evict
   // past the cap so many unique labels cannot grow the process heap without bound.
   if(!requests.has(k)){if(requests.size>=4096)requests.delete(requests.keys().next().value);requests.set(k,{text:s,size,font,weight});}
   let width=0;for(const g of graphemes(s)){if(/^\s+$/u.test(g))width+=size*.34;else if(/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u.test(g))width+=size*1.08;else if(/[MW@#%&]/.test(g))width+=size*.9;else if(/[il.,:;!'|]/.test(g))width+=size*.34;else width+=size*(font==='mono'?.64:.64);}
   return {width,ascent:size*.88,descent:size*.28,method:'estimated'};
  }
  function wrap$1(s,maxWidth,size=14,font='sans',weight=400){
   const lines=[];maxWidth=Math.max(size*2,maxWidth);
   for(const raw of String(s??'').split('\n')){const words=raw.split(/(\s+)/u);let current='';for(const token of words){if(!token)continue;const joined=current+token;if(measure$1(joined,size,font,weight).width<=maxWidth){current=joined;continue;}if(current.trim())lines.push(current.trimEnd());current=token.trimStart();
    if(measure$1(current,size,font,weight).width>maxWidth){let part='';for(const g of graphemes(current)){if(part&&measure$1(part+g,size,font,weight).width>maxWidth){lines.push(part);part=g;}else part+=g;}current=part;}}
    lines.push(current.trimEnd());}
   return lines.length?lines:[''];
  }
  if(typeof process!=='undefined'&&process.env?.DDN_METRICS_CAPTURE){process.on('exit',()=>{const fs=process.getBuiltinModule('node:fs'),p=process.env.DDN_METRICS_CAPTURE;let old={};try{old=JSON.parse(fs.readFileSync(p,'utf8'));}catch{}for(const[k,v]of requests)old[k]=v;fs.writeFileSync(p,JSON.stringify(old));});}
  function pending(){return [...requests.values()];}
  function clearRequests(){requests.clear();}
  const api$7={stats:()=>({...counts}),FONTS,key,measure: measure$1,wrap: wrap$1,graphemes,setMetrics,setProvider,pending,clearRequests};
  publishNamespace('DDNText',api$7);

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * DDN seeded sketch primitives, rendering revision 2.
   * Pure vector geometry; no raster filter, remote resource, DOM, or font file.
   * Model coordinates are never mutated by a drawing treatment.
   */
  const f$1=n=>Number(n.toFixed(3));
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
    if(amount===0||len<10)return `L${f$1(b[0])} ${f$1(b[1])}`;
    const normal=[-dy/len,dx/len],count=Math.max(1,Math.ceil(len/95));
    let last=a,out='';
    for(let i=1;i<=count;i++){
      const t=i/count,offset=i===count?0:signed(r,amount*.8);
      const end=[a[0]+dx*t+normal[0]*offset,a[1]+dy*t+normal[1]*offset];
      const local=Math.hypot(end[0]-last[0],end[1]-last[1]);
      const bend=Math.min(amount*1.8,local*.095),o1=signed(r,bend),o2=signed(r,bend);
      const p=[last[0]+(end[0]-last[0])*.32+normal[0]*o1,last[1]+(end[1]-last[1])*.32+normal[1]*o1];
      const q=[last[0]+(end[0]-last[0])*.68+normal[0]*o2,last[1]+(end[1]-last[1])*.68+normal[1]*o2];
      out+=`C${f$1(p[0])} ${f$1(p[1])} ${f$1(q[0])} ${f$1(q[1])} ${f$1(end[0])} ${f$1(end[1])}`;
      last=end;
    }
    return out;
  }
  function strokes(paths,o,extra=''){
    return paths.map((d,i)=>`<path d="${d}" fill="none" stroke="${escape(o.stroke)}" stroke-width="${f$1(i?o.width*.68:o.width)}" stroke-linecap="round" stroke-linejoin="round"${i?' opacity=".56"':''}${o.dash?` stroke-dasharray="${escape(o.dash)}" stroke-dashoffset="${f$1(o.dashOffset||0)}"`:''}${extra}/>`).join('');
  }
  function exactRounded(x,y,w,h,r){
    return `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
  }
  function roughPolygon(points,o){
    const passes=o.roughness===0?1:2,paths=[];
    for(let pass=0;pass<passes;pass++){
      const r=rng(`${o.seed}:${o.id}:outline:${pass}`),a=o.roughness*(pass?.9:1);
      const vertices=points.map(([x,y])=>[x+signed(r,a*.8),y+signed(r,a*.8)]);
      let d=`M${f$1(vertices[0][0])} ${f$1(vertices[0][1])}`;
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
      parts.push(`M${f$1(p[0])} ${f$1(p[1])}`+segment(p,q,r,o.roughness*.35));
    }
    return `<path data-sketch-hachure="true" d="${parts.join(' ')}" fill="none" stroke="${escape(o.stroke)}" stroke-width=".75" stroke-linecap="round" opacity=".11"/>`;
  }
  function polygon$1(points,options={}){
    const o=settings(options),exact=points.map((p,i)=>(i?'L':'M')+p.join(' ')).join('')+'Z';
    return `<g data-sketch="outline"><path d="${exact}" fill="${escape(o.fill)}" stroke="none"/>`+hatch(points,o)+roughPolygon(points,o)+'</g>';
  }
  function box$1(x,y,w,h,options={}){
    const o=settings(options),radius=Math.min(options.radius||0,w/2,h/2);
    if(!radius)return polygon$1([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],o);
    const points=[],r=radius;
    for(const[cx,cy,angle]of [[x+w-r,y+r,-90],[x+w-r,y+h-r,0],[x+r,y+h-r,90],[x+r,y+r,180]])
      for(let i=0;i<=6;i++){const t=(angle+i*15)*Math.PI/180;points.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}
    let out=`<g data-sketch="rounded-outline"><path d="${exactRounded(x,y,w,h,r)}" fill="${escape(o.fill)}" stroke="none"/>`+hatch(points,o);
    const paths=[];
    for(let pass=0;pass<(o.roughness===0?1:2);pass++){
      const random=rng(`${o.seed}:${o.id}:rounded:${pass}`),a=o.roughness;
      const top=y+signed(random,a*.65),right=x+w+signed(random,a*.65),bottom=y+h+signed(random,a*.65),left=x+signed(random,a*.65);
      const p=[[x+r,top],[x+w-r,top],[right,y+r],[right,y+h-r],[x+w-r,bottom],[x+r,bottom],[left,y+h-r],[left,y+r]];
      let d=`M${f$1(p[0][0])} ${f$1(p[0][1])}`;
      for(let i=0;i<8;i+=2){
        d+=segment(p[i],p[i+1],random,a);
        const next=p[(i+2)%8];
        const corner=[[right,top],[right,bottom],[left,bottom],[left,top]][i/2];
        d+=`Q${f$1(corner[0])} ${f$1(corner[1])} ${f$1(next[0])} ${f$1(next[1])}`;
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
      let d=`M${f$1(points[0][0])} ${f$1(points[0][1])}`;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
        // Keep 12px around semantic endpoints and orthogonal bends exact.
        const guard=Math.min(12,len/3);
        const p=len?[a[0]+dx/len*guard,a[1]+dy/len*guard]:a;
        const q=len?[b[0]-dx/len*guard,b[1]-dy/len*guard]:b;
        d+=`L${f$1(p[0])} ${f$1(p[1])}`+segment(p,q,r,amplitude)+`L${f$1(b[0])} ${f$1(b[1])}`;
      }
      paths.push(d);
    }
    return `<g data-sketch="line">`+strokes(paths,o)+'</g>';
  }

  function curve(commands,options={}){
   const o=settings(options),paths=[];if(!commands.length)return '';
   for(let pass=0;pass<(o.dash||o.roughness===0?1:2);pass++){
    const r=rng(`${o.seed}:${o.id}:curve:${pass}`);let d=`M${f$1(commands[0].from[0])} ${f$1(commands[0].from[1])}`;
    for(const c of commands){if(c.kind==='line'){d+=`L${f$1(c.to[0])} ${f$1(c.to[1])}`;continue;}
     // Change handle length, not handle direction: true attachment and tangent
     // semantics are retained at curve ends. Maximum pen perturbation is <1px.
     const move=(control,anchor)=>{const dx=control[0]-anchor[0],dy=control[1]-anchor[1],len=Math.hypot(dx,dy);const a=pass?signed(r,Math.min(.65,o.roughness*.22)):0;return len?[control[0]+dx/len*a,control[1]+dy/len*a]:control;};
     const a=move(c.c1,c.from),b=move(c.c2,c.to);d+=`C${f$1(a[0])} ${f$1(a[1])} ${f$1(b[0])} ${f$1(b[1])} ${f$1(c.to[0])} ${f$1(c.to[1])}`;
    }paths.push(d);
   }return `<g data-sketch="curve">`+strokes(paths,o)+'</g>';
  }
  const api$6={box: box$1,polygon: polygon$1,polyline,curve};
  publishNamespace('DDNSketch',api$6);

  /* SPDX-License-Identifier: GPL-2.0-or-later. Composable profile outlines with measured compartments and contour attachments. */
  const esc$2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const f=x=>Math.round(x*1000)/1000;
  const slug$1=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  function shapeOf(k,p){if(k.keyword==='dfd.process')return p.projection?.profile==='dfd.yourdon@1'?'circle':'round';return k.silhouette;}
  function measure(g,p){
   const s=g.scale,n=g.n,k=g.k;g.silhouette=shapeOf(k,p);
   const compact=['ellipse','circle','diamond','actor','terminal','parallelogram','document','store','subprocess','round','hexagon'].includes(g.silhouette);
   if(compact&&!n.fields.length){
    const proportion=g.silhouette==='diamond'?.60:['ellipse','circle'].includes(g.silhouette)?.68:.78;
    g.titleLines=api$7.wrap(n.name,g.w*proportion,16*s,p.style.font,600);
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
     row.labelLines=api$7.wrap((prefix?prefix+' ':'')+row.field.name,g.w-32*s,13.5*s,p.style.font,400);row.top=y;row.h=Math.max(row.h,(row.labelLines.length*18+row.detailLines.length*16+10)*s);y+=row.h;
    }
    g.fieldRows=list;g.compartments=div;g.h=Math.max(g.h,y+20*s);g.headerH=70*s;
   }
   if(n.kind==='req.requirement'){
    g.requirement=api$7.wrap(n.properties.x_diagram?.text||'',g.w-32*s,13*s,p.style.font);g.h=Math.max(g.h,(95+g.requirement.length*19)*s);
   }
   if(['initial','final'].includes(g.silhouette)){g.w=Math.max(125*s,api$7.measure(n.name,12*s,p.style.font).width+24*s);g.h=85*s;g.fieldRows=[];g.titleLines=[n.name];}
   if(n.kind==='uml.usecase'&&n.properties.x_usecase?.extension_points?.length){g.extensionPoints=n.properties.x_usecase.extension_points;g.w=Math.max(g.w,320*s);g.h=Math.max(g.h,(110+g.extensionPoints.length*20)*s);}
   return g;
  }
  function polygon(g){const{x,y,w,h,silhouette:t}=g;
   if(['initial','final'].includes(t)){const ps=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;ps.push([x+w/2+12*g.scale*Math.cos(a),y+h/2-8*g.scale+12*g.scale*Math.sin(a)]);}return ps;}
   if(t==='offpage')return [[x,y],[x+w,y],[x+w,y+h*.7],[x+w/2,y+h],[x,y+h*.7]];
   if(t==='diamond')return [[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
   if(t==='hexagon')return [[x+w*.25,y],[x+w*.75,y],[x+w,y+h/2],[x+w*.75,y+h],[x+w*.25,y+h],[x,y+h/2]];
   if(t==='parallelogram')return [[x+w*.16,y],[x+w,y],[x+w*.84,y+h],[x,y+h]];
   if(t==='package')return [[x,y],[x+w*.43,y],[x+w*.49,y+20],[x+w,y+20],[x+w,y+h],[x,y+h]];
   if(t==='document'){const ps=[[x,y],[x+w,y],[x+w,y+h-14]];for(let i=1;i<=24;i++){const t=i/24;ps.push([x+w*(1-t),y+h-14+12*Math.sin(t*Math.PI*2)]);}return ps;}
   if(t==='actor'){const z=g.scale,cx=x+w/2;return [[cx,y+9*z],[cx+14*z,y+23*z],[cx+14*z,y+40*z],[cx+32*z,y+59*z],[cx+3*z,y+70*z],[cx+28*z,y+127*z],[cx,y+100*z],[cx-28*z,y+127*z],[cx-3*z,y+70*z],[cx-32*z,y+59*z],[cx-14*z,y+40*z],[cx-14*z,y+23*z]];}
   if(['ellipse','circle'].includes(t)){const ps=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;ps.push([x+w/2+Math.cos(a)*w/2,y+h/2+Math.sin(a)*h/2]);}return ps;}
   return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  }
  function anchor(g,side,point){
   const {x,y,w,h,silhouette:t}=g;if(!t)return point;
   let px=point[0],py=point[1];const cx=x+w/2,cy=y+h/2;
   if(['initial','final'].includes(t)){const a={east:0,south:Math.PI/2,west:Math.PI,north:-Math.PI/2}[side];return [f(cx+12*g.scale*Math.cos(a)),f(cy-8*g.scale+12*g.scale*Math.sin(a))];}
   if(['ellipse','circle'].includes(t)){
    if(side==='east'||side==='west'){const dy=Math.min(.94,Math.abs((py-cy)/(h/2)));px=cx+(side==='east'?1:-1)*w/2*Math.sqrt(1-dy*dy);}else {const dx=Math.min(.94,Math.abs((px-cx)/(w/2)));py=cy+(side==='south'?1:-1)*h/2*Math.sqrt(1-dx*dx);}
   }else if(t==='diamond'){
    if(side==='east'||side==='west'){py=Math.max(y+h*.1,Math.min(y+h*.9,py));px=cx+(side==='east'?1:-1)*(w/2)*(1-Math.abs(py-cy)/(h/2));}else {px=Math.max(x+w*.1,Math.min(x+w*.9,px));py=cy+(side==='south'?1:-1)*(h/2)*(1-Math.abs(px-cx)/(w/2));}
   }else if(t==='parallelogram'){
    if(side==='east')px=x+w-w*.16*(py-y)/h;else if(side==='west')px=x+w*.16*(1-(py-y)/h);else if(side==='north')px=Math.max(x+w*.16,px);else px=Math.min(x+w*.84,px);
   }else if(t==='package'&&side==='north'&&px>x+w*.43)py=y+20;
   // Actor has explicit side docking points, not an invisible server-card outline.
   else if(t==='actor'){const z=g.scale;px=cx+(side==='east'?32*z:side==='west'?-32*z:0);py=side==='north'?y+9*z:side==='south'?y+100*z:y+59*z;}
   return [f(px),f(py)];
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
  function render$2(g,p,theme){
   const {n,k,x,y,w,h}=g,s=g.scale,look=p.style.look,shape=g.silhouette,mono=p.style.theme==='neutral',nc=api$8.node(k,theme),ink=mono?'#333333':nc.ink,fill=mono?'#FAFAFA':nc.fill,fg=nc.text;
   const opt={...p.style,id:n.id,stroke:ink,fill,width:1.8};
   const line=(x1,y1,x2,y2,width=1)=>look==='handDrawn'?api$6.polyline([[x1,y1],[x2,y2]],{...opt,id:n.id+':line:'+x1+':'+y1,width,hachure:false}):`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" fill="none" stroke="${ink}" stroke-width="${width}"/>`;
   const text=(xx,yy,txt,size=13,weight=400,extra='')=>{api$7.measure(txt,size*s,p.style.font,weight);return `<text x="${f(xx)}" y="${f(yy)}" font-size="${size*s}" fill="${fg}" font-weight="${weight}" ${extra}>${esc$2(txt)}</text>`;};
   const lines=(ls,xx,yy,size=16,weight=600,extra='text-anchor="middle"')=>ls.map((v,i)=>text(xx,yy+i*(size+5)*s,v,size,weight,extra)).join('');
   let out=`<g class="ddn-node ddn-kind-${slug$1(k.code)}" data-id="${esc$2(n.id)}" data-ddn-id="${esc$2(n.id)}" data-shape="${esc$2(shape)}" tabindex="0" role="group" aria-label="${esc$2(n.name)}"><title>${esc$2(n.name+' — '+k.name)}</title>`;
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
    else {out+=line(x+w,y,x,y,2)+line(x,y,x,y+h,2)+line(x,y+h,x+w,y+h,2)+line(x+35*s,y,x+35*s,y+h,1);out+=text(x+17*s,y+h/2+5*s,n.properties.x_diagram?.number||'D',12,600,'text-anchor="middle"');}
   }else if(look==='handDrawn'){
    out+=['round','terminal'].includes(shape)?api$6.box(x,y,w,h,{...opt,radius:shape==='terminal'?h/2:14*s}):api$6.polygon(polygon(g),opt);
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
    for(const r of g.fieldRows){const m=r.field.properties.x_member||{},extra=`${m.static?'text-decoration="underline"':''} ${m.abstract?'font-style="italic"':''}`;out+=`<g class="ddn-field" data-member="${esc$2(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,extra)+lines(r.detailLines,x+16*s,y+r.top+r.labelLines.length*18*s+17*s,11.5,400,'')+'</g>';}
   }else if(n.kind==='req.requirement'){
    out+=text(x+14*s,y+21*s,'«requirement» '+n.properties.x_diagram.code,11,600)+lines(g.titleLines,x+14*s,y+45*s,16,650,'')+line(x,y+68*s,x+w,y+68*s)+lines(g.requirement,x+14*s,y+90*s,13,400,'');
   }else if(g.fieldRows.length){
    out+=lines(g.titleLines,x+16*s,y+31*s,16,600,'')+line(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s);for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc$2(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,'')+'</g>';
   }else {
    let yy=y+h/2-(g.titleLines.length-1)*10.5*s+5*s;if(shape==='package')yy+=10*s;
    out+=lines(g.titleLines,x+w/2+(shape==='store'&&p.projection.profile!=='dfd.yourdon@1'?12*s:0),yy,16,600,n.properties.key||n.properties.x_chen?.key?'text-anchor="middle" text-decoration="underline"':'text-anchor="middle"');
   }
   if(n.properties.x_chen?.partial_key){const tw=Math.min(w*.8,api$7.measure(n.name,16*s,p.style.font,600).width);out+=`<path d="M${x+w/2-tw/2} ${y+h/2+11*s}h${tw}" stroke="${ink}" fill="none" stroke-dasharray="4 3"/>`;}
   if(n.properties.x_continuation)out+=text(x+w/2,y+h-13*s,n.properties.x_continuation.key+' / '+n.properties.x_continuation.side,11,650,'text-anchor="middle"');
   return out+'</g>';
  }
  const api$5={VERSION:'0.7.0',measure,render: render$2,anchor,polygon,shapeOf,segmentInterior};
  publishNamespace('DDNShapes',api$5);

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * DDN 0.3 deterministic native layout and obstacle-aware orthogonal routing.
   * Bounded search is deliberate: infeasibility produces a diagnostic, never an invisible topology change.
   */
  const VERSION$3='0.7.0',EPS=.01;
  const q$3=(x,d=0)=>typeof x==='number'?x:x&&Number.isFinite(x.$quantity)?x.$quantity*({px:1,pt:96/72,mm:96/25.4,cm:96/2.54,in:96}[x.unit]||1):d;
  const round=x=>Math.round(x*1000)/1000;
  /* B1-008 spacing hints: fixed deterministic factors (D2/D4). Applied to inter-node
   * gaps, layer/band spacing and the route-label reservation margins only — never to
   * node bodies, fonts, glyphs or fixed-grid projections. normal (1.0) is the exact
   * historical path. */
  const SPACING={tight:.75,normal:1,loose:1.4,expanded:2};
  const spacingScale=p=>SPACING[p.spacing]||1;
  const same=(a,b)=>Math.abs(a[0]-b[0])<EPS&&Math.abs(a[1]-b[1])<EPS;
  const segs=ps=>ps.slice(1).map((b,i)=>({a:ps[i],b,i}));
  const length=s=>Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]);
  const box=(g,p=0)=>({x:g.x-p,y:g.y-p,w:g.w+2*p,h:g.h+2*p,id:g.id});
  const maxOf=(xs,f,seed=-Infinity)=>{let m=seed;for(const x of xs){const v=f(x);if(v>m)m=v;}return m;};
  const minOf=(xs,f,seed=Infinity)=>{let m=seed;for(const x of xs){const v=f(x);if(v<m)m=v;}return m;};
  function overlap(a,b,p=0){return a.x<b.x+b.w+p-EPS&&a.x+a.w>b.x-p+EPS&&a.y<b.y+b.h+p-EPS&&a.y+a.h>b.y-p+EPS;}
  function pointInside(p,b){return p[0]>b.x+EPS&&p[0]<b.x+b.w-EPS&&p[1]>b.y+EPS&&p[1]<b.y+b.h-EPS;}
  function segmentBox(s,b){
   if(same(s.a,s.b))return pointInside(s.a,b);
   if(Math.abs(s.a[1]-s.b[1])<EPS)return s.a[1]>b.y+EPS&&s.a[1]<b.y+b.h-EPS&&Math.max(s.a[0],s.b[0])>b.x+EPS&&Math.min(s.a[0],s.b[0])<b.x+b.w-EPS;
   if(Math.abs(s.a[0]-s.b[0])<EPS)return s.a[0]>b.x+EPS&&s.a[0]<b.x+b.w-EPS&&Math.max(s.a[1],s.b[1])>b.y+EPS&&Math.min(s.a[1],s.b[1])<b.y+b.h-EPS;
   // Liang-Barsky clipping for straight routes, with a slightly inset rectangle.
   let lo=0,hi=1,dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];const p=[-dx,dx,-dy,dy],v=[s.a[0]-b.x-EPS,b.x+b.w-s.a[0]-EPS,s.a[1]-b.y-EPS,b.y+b.h-s.a[1]-EPS];
   for(let i=0;i<4;i++){if(Math.abs(p[i])<EPS){if(v[i]<0)return false;}else {const t=v[i]/p[i];if(p[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return hi>=lo;
  }
  function simplify(points){const out=[];for(const x of points){const p=x.map(round);if(out.length&&same(out.at(-1),p))continue;out.push(p);while(out.length>=3){const[a,b,c]=out.slice(-3);if((Math.abs(a[0]-b[0])<EPS&&Math.abs(b[0]-c[0])<EPS)||(Math.abs(a[1]-b[1])<EPS&&Math.abs(b[1]-c[1])<EPS))out.splice(out.length-2,1);else break;}}return out;}
  /* B1-042 (D2.1/D2.2): scalar twins of segmentBox/cross/collinear plus
   * precomputed segment records (orientation + bbox). The router's inner loops
   * evaluate the same prior segments against millions of candidate edges; the
   * records derive the constants once per relation instead of once per probe,
   * and the bbox gates narrow collision checks to nearby geometry without any
   * dependency. Every gate is conservative: it only skips pairs the original
   * tests would certainly reject, so results (and tie-break order) are exact. */
  function segHitsBox(ax,ay,bx,by,b){
   if(Math.abs(ax-bx)<EPS&&Math.abs(ay-by)<EPS)return pointInside([ax,ay],b);
   if(Math.abs(ay-by)<EPS)return ay>b.y+EPS&&ay<b.y+b.h-EPS&&Math.max(ax,bx)>b.x+EPS&&Math.min(ax,bx)<b.x+b.w-EPS;
   if(Math.abs(ax-bx)<EPS)return ax>b.x+EPS&&ax<b.x+b.w-EPS&&Math.max(ay,by)>b.y+EPS&&Math.min(ay,by)<b.y+b.h-EPS;
   let lo=0,hi=1,dx=bx-ax,dy=by-ay;const p=[-dx,dx,-dy,dy],v=[ax-b.x-EPS,b.x+b.w-ax-EPS,ay-b.y-EPS,b.y+b.h-ay-EPS];
   for(let i=0;i<4;i++){if(Math.abs(p[i])<EPS){if(v[i]<0)return false;}else {const t=v[i]/p[i];if(p[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return hi>=lo;
  }
  function segRec(a,b){return {ax:a[0],ay:a[1],bx:b[0],by:b[1],horiz:Math.abs(a[1]-b[1])<EPS,vert:Math.abs(a[0]-b[0])<EPS,minx:Math.min(a[0],b[0]),maxx:Math.max(a[0],b[0]),miny:Math.min(a[1],b[1]),maxy:Math.max(a[1],b[1])};}
  function routeSegRecs(points){const out=[];for(let i=1;i<points.length;i++)out.push(segRec(points[i-1],points[i]));return out;}
  function crossRec(s,t,margin=0){
   if(s.horiz&&t.vert){const x=t.ax,y=s.ay;if(x>s.minx+margin&&x<s.maxx-margin&&y>t.miny+margin&&y<t.maxy-margin)return [x,y];}
   if(s.vert&&t.horiz)return crossRec(t,s,margin);return null;
  }
  function collinearRec(s,t,tol){
   if(s.horiz&&t.horiz&&Math.abs(s.ay-t.ay)<tol&&Math.min(s.maxx,t.maxx)-Math.max(s.minx,t.minx)>EPS)return true;
   if(s.vert&&t.vert&&Math.abs(s.ax-t.ax)<tol&&Math.min(s.maxy,t.maxy)-Math.max(s.miny,t.miny)>EPS)return true;
   return false;
  }
  /* Any segment of a raw polyline collinear with any precomputed record. */
  function collinearHits(points,recs,tol){for(let i=1;i<points.length;i++){const s=segRec(points[i-1],points[i]);for(const t of recs){if(s.minx>t.maxx+tol||s.maxx<t.minx-tol||s.miny>t.maxy+tol||s.maxy<t.miny-tol)continue;if(collinearRec(s,t,tol))return true;}}return false;}
  function cross(s,t,margin=0){
   const sh=Math.abs(s.a[1]-s.b[1])<EPS,sv=Math.abs(s.a[0]-s.b[0])<EPS,th=Math.abs(t.a[1]-t.b[1])<EPS,tv=Math.abs(t.a[0]-t.b[0])<EPS;
   if(sh&&tv){const x=t.a[0],y=s.a[1];if(x>Math.min(s.a[0],s.b[0])+margin&&x<Math.max(s.a[0],s.b[0])-margin&&y>Math.min(t.a[1],t.b[1])+margin&&y<Math.max(t.a[1],t.b[1])-margin)return [x,y];}
   if(sv&&th)return cross(t,s,margin);return null;
  }
  function collinear(s,t,tolerance=.1){const h=Math.abs(s.a[1]-s.b[1])<EPS&&Math.abs(t.a[1]-t.b[1])<EPS,v=Math.abs(s.a[0]-s.b[0])<EPS&&Math.abs(t.a[0]-t.b[0])<EPS;if(h&&Math.abs(s.a[1]-t.a[1])<tolerance)return Math.min(Math.max(s.a[0],s.b[0]),Math.max(t.a[0],t.b[0]))-Math.max(Math.min(s.a[0],s.b[0]),Math.min(t.a[0],t.b[0]))>EPS;if(v&&Math.abs(s.a[0]-t.a[0])<tolerance)return Math.min(Math.max(s.a[1],s.b[1]),Math.max(t.a[1],t.b[1]))-Math.max(Math.min(s.a[1],s.b[1]),Math.min(t.a[1],t.b[1]))>EPS;return false;}
  function distancePointSegment(p,s){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],l=dx*dx+dy*dy;if(!l)return Math.hypot(p[0]-s.a[0],p[1]-s.a[1]);const t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/l));return Math.hypot(p[0]-s.a[0]-t*dx,p[1]-s.a[1]-t*dy);}
  function layoutNodes(nodes,rels,profiles,placements={},ErrorClass=Error){
   const p=profiles.layout,minGap=2*(q$3(p.object_clearance,16)+Math.max(24,q$3(p.port_clearance,28)))+2*q$3(p.edge_clearance,12),diag=[];let gap=Math.max(q$3(p.gap,100),minGap),rowGap=Math.max(q$3(p.row_gap,100),minGap);if(gap<20||rowGap<20)throw new ErrorClass('DDN200','Automatic gaps must be at least 20px');
   const spread=spacingScale(p);gap=round(gap*spread);rowGap=round(rowGap*spread);
   const order=new Map(nodes.map((n,i)=>[n.id,i])),byId=new Map(nodes.map(n=>[n.id,n])),ids=new Set(byId.keys());
   const edges=rels.filter(r=>ids.has(r.from.element)&&ids.has(r.to.element)&&r.from.element!==r.to.element);
   function grid(ns,ox=0,oy=0){const cols=Math.max(1,p.columns||3),widths=Array(cols).fill(0),rows=[];ns.forEach((n,i)=>{widths[i%cols]=Math.max(widths[i%cols],n.w);rows[Math.floor(i/cols)]=Math.max(rows[Math.floor(i/cols)]||0,n.h);});ns.forEach((n,i)=>{n.x=ox+widths.slice(0,i%cols).reduce((a,b)=>a+b+gap,0);n.y=oy+rows.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b+rowGap,0);});}
   const horizontal=['right','left'].includes(p.direction);
   if(['grid','manual'].includes(p.algorithm))grid(nodes);
   else if(p.algorithm==='layered'){
    // Tarjan SCCs preserve cycles as explicit same-layer groups; no edge reversal mutates the model.
    const adj=new Map(nodes.map(n=>[n.id,[]]));edges.forEach(e=>adj.get(e.from.element).push(e.to.element));for(const a of adj.values())a.sort((a,b)=>order.get(a)-order.get(b));
    let counter=0;const ix=new Map(),low=new Map(),stack=[],on=new Set(),components=[];
    // Iterative Tarjan: deep graphs must not exhaust the call stack.
    for(const first of nodes){
     if(ix.has(first.id))continue;
     ix.set(first.id,counter);low.set(first.id,counter++);stack.push(first.id);on.add(first.id);
     const call=[[first.id,0]];
     while(call.length){
      const frame=call.at(-1),id=frame[0],kids=adj.get(id);
      if(frame[1]<kids.length){
       const j=kids[frame[1]++];
       if(!ix.has(j)){ix.set(j,counter);low.set(j,counter++);stack.push(j);on.add(j);call.push([j,0]);}
       else if(on.has(j))low.set(id,Math.min(low.get(id),ix.get(j)));
      }else {
       call.pop();
       if(call.length){const parent=call.at(-1)[0];low.set(parent,Math.min(low.get(parent),low.get(id)));}
       if(low.get(id)===ix.get(id)){let c=[],x;do{x=stack.pop();on.delete(x);c.push(x);}while(x!==id);c.sort((a,b)=>order.get(a)-order.get(b));components.push(c);}
      }
     }
    }const comp=new Map();components.forEach((c,i)=>c.forEach(id=>comp.set(id,i)));const rank=components.map(()=>0);for(let i=0;i<components.length;i++)for(const e of edges){const a=comp.get(e.from.element),b=comp.get(e.to.element);if(a!==b)rank[b]=Math.max(rank[b],rank[a]+1);}
    const layers=[];nodes.forEach(n=>(layers[rank[comp.get(n.id)]]??=[]).push(n));
    const pred=new Map(nodes.map(n=>[n.id,[]]));edges.forEach(e=>pred.get(e.to.element).push(e.from.element));
    for(let sweep=0;sweep<3;sweep++)for(let i=1;i<layers.length;i++){const pos=new Map(layers[i-1].map((n,j)=>[n.id,j]));const bary=n=>{const ps=pred.get(n.id).filter(id=>pos.has(id));return ps.length?ps.reduce((s,id)=>s+pos.get(id),0)/ps.length:order.get(n.id);};layers[i].sort((a,b)=>bary(a)-bary(b)||order.get(a.id)-order.get(b.id));}
    let major=0;for(const layer of layers){let minor=0,extent=0;for(const n of layer){if(horizontal){n.x=major;n.y=minor;minor+=n.h+rowGap;extent=Math.max(extent,n.w);}else {n.x=minor;n.y=major;minor+=n.w+gap;extent=Math.max(extent,n.h);}}major+=extent+(horizontal?gap:rowGap);}
    if(components.some(c=>c.length>1))diag.push({code:'DDN-LW01',severity:'info',message:'Directed cycles retained as same-rank strongly connected groups; no model edge reversed.'});
   }else if(['tree','mindmap'].includes(p.algorithm)){
    const vertical=p.algorithm==='tree'&&['down','up'].includes(p.direction);
    const hierarchy=Array.isArray(p.hierarchy)?p.hierarchy:null,es=hierarchy?edges.filter(e=>hierarchy.includes(e.kind)):edges;
    const incoming=new Map(nodes.map(n=>[n.id,0])),kids=new Map(nodes.map(n=>[n.id,[]]));for(const e of es){if(kids.get(e.from.element).includes(e.to.element))continue;kids.get(e.from.element).push(e.to.element);incoming.set(e.to.element,incoming.get(e.to.element)+1);}
    for(const [id,n]of incoming)if(n>1)throw new ErrorClass('DDN201','Tree hierarchy has multiple parents: '+id+'; select hierarchy relationship kinds or use layered.');
    const roots=nodes.filter(n=>incoming.get(n.id)===0).map(n=>n.id),root=p.root?.$ref||p.root;
    if(root&&!ids.has(root))throw new ErrorClass('DDN202','Layout root is outside selected view');if(!roots.length&&nodes.length)throw new ErrorClass('DDN201','Tree hierarchy contains a cycle');
    // Iterative subtree walks (post-order heights/widths, pre-order placement):
    // deep hierarchies must not exhaust the call stack.
    const seen=new Set(),active=new Set();
    for(const root of roots){
     if(seen.has(root))continue;
     active.add(root);seen.add(root);
     const st=[[root,0]];
     while(st.length){
      const f=st.at(-1),id=f[0],ch=kids.get(id);
      if(f[1]<ch.length){
       const c=ch[f[1]++];
       if(active.has(c))throw new ErrorClass('DDN201','Tree hierarchy contains a cycle');
       if(seen.has(c))continue;
       active.add(c);seen.add(c);st.push([c,0]);
      }else {
       const n=byId.get(id);
       n.subtreeHeight=Math.max(n.h,ch.reduce((sum,c)=>sum+byId.get(c).subtreeHeight+rowGap,0)-(ch.length?rowGap:0));
       active.delete(id);st.pop();
      }
     }
    }
    if(seen.size!==nodes.length)throw new ErrorClass('DDN201','Unreachable hierarchy cycle');
    const levelWidth=maxOf(nodes,n=>n.w,270)+gap;
    function tree(id,depth,top,sign=1){
     const st=[[id,depth,top,sign]];
     while(st.length){
      const [cid,cdepth,ctop,csign]=st.pop(),n=byId.get(cid);
      n.x=cdepth*levelWidth*csign;n.y=ctop+(n.subtreeHeight-n.h)/2;
      let y=ctop;const items=kids.get(cid).map(c=>{const it=[c,cdepth+1,y,csign];y+=byId.get(c).subtreeHeight+rowGap;return it;});
      for(let i=items.length-1;i>=0;i--)st.push(items[i]);
     }
    }
    const levelDepth=maxOf(nodes,n=>n.h,0)+rowGap;
    function width(rootIds){
     for(const r of rootIds){
      const st=[[r,0]];
      while(st.length){
       const f=st.at(-1),ch=kids.get(f[0]);
       if(f[1]<ch.length)st.push([ch[f[1]++],0]);
       else {const n=byId.get(f[0]);n.subtreeWidth=Math.max(n.w,ch.reduce((sum,c)=>sum+byId.get(c).subtreeWidth+gap,0)-(ch.length?gap:0));st.pop();}
      }
     }
    }
    function vtree(id,depth,left){
     const st=[[id,depth,left]];
     while(st.length){
      const [cid,cdepth,cleft]=st.pop(),n=byId.get(cid);
      n.y=cdepth*levelDepth;n.x=cleft+(n.subtreeWidth-n.w)/2;
      let x=cleft;const items=kids.get(cid).map(c=>{const it=[c,cdepth+1,x];x+=byId.get(c).subtreeWidth+gap;return it;});
      for(let i=items.length-1;i>=0;i--)st.push(items[i]);
     }
    }
    if(p.algorithm==='mindmap'&&roots.length===1){const id=root||roots[0];if(incoming.get(id)!==0)throw new ErrorClass('DDN202','Mind-map root must be a hierarchy root');const n=byId.get(id),ch=kids.get(id),left=ch.filter((_,i)=>i%2),right=ch.filter((_,i)=>!(i%2));const span=a=>a.reduce((s,id)=>s+byId.get(id).subtreeHeight+rowGap,0)-(a.length?rowGap:0),full=Math.max(n.h,span(left),span(right));n.x=0;n.y=(full-n.h)/2;for(const [a,sign]of [[left,-1],[right,1]]){let y=(full-span(a))/2;for(const c of a){tree(c,1,y,sign);y+=byId.get(c).subtreeHeight+rowGap;}}}
    else if(vertical){width(roots);let x=0;for(const id of roots){vtree(id,0,x);x+=byId.get(id).subtreeWidth+gap;}}
    else {let y=0;for(const id of roots){tree(id,0,y);y+=byId.get(id).subtreeHeight+rowGap;}}
    if(vertical&&p.direction==='up'){const max=maxOf(nodes,n=>n.y+n.h,0);nodes.forEach(n=>n.y=max-n.y-n.h);}
    const minX=minOf(nodes,n=>n.x,0);nodes.forEach(n=>n.x-=minX);
   }else if(p.algorithm==='grouped'){
    const path=String(p.group_by||'kind').split('.'),read=n=>path.reduce((v,k)=>v?.[k],n.properties)??path.reduce((v,k)=>v?.[k],n.n?.properties)??n.n?.kind??'unassigned';
    const groups=new Map();for(const n of nodes){let key=String(read(n));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}let x=0;for(const [label,ns]of groups){grid(ns,x,50);x=maxOf(ns,n=>n.x+n.w,0)+gap*2;ns.forEach(n=>n.group=label);}
   }else throw new ErrorClass('DDN203','No native placement algorithm '+p.algorithm);
   if(p.algorithm==='layered'&&['left','up'].includes(p.direction)){if(horizontal){const max=maxOf(nodes,n=>n.x+n.w,0);nodes.forEach(n=>n.x=max-n.x-n.w);}else {const max=maxOf(nodes,n=>n.y+n.h,0);nodes.forEach(n=>n.y=max-n.y-n.h);}}
   const pinned=[];for(const n of nodes){const at=placements[n.id]?.at;if(at){n.x=q$3(at[0]);n.y=q$3(at[1]);pinned.push(n);}}
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
     if(a===b){ss=ss||'east';ts=ts||'east';}else if(vertical){ss=ss||(dy>=0?'south':'north');ts=ts||(dy>=0?'north':'south');}else {ss=ss||(dx>=0?'east':'west');ts=ts||(dx>=0?'west':'east');}}
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
      if(ar!==undefined||br!==undefined)return (ar??a.remoteCoord)-(br??b.remoteCoord)||a.item.r.id.localeCompare(b.item.r.id);
      return a.remoteCoord-b.remoteCoord||a.item.r.id.localeCompare(b.item.r.id)||a.which.localeCompare(b.which);
     });let i=0;ordered=entries.map(e=>e.fixed?e:free[i++]);
    }
    ordered.forEach((o,index)=>{const{item,which,n,ep,side,row,frac}=o;let x=n.x+n.w/2,y=n.y+n.h/2;
     if(side==='east'||side==='west'){x=side==='east'?n.x+n.w:n.x;y=n.y+(row?row.top+(index+1)*row.h/(entries.length+1):frac!==undefined?frac*n.h:(index+1)*n.h/(entries.length+1));}
     else {y=side==='south'?n.y+n.h:n.y;x=n.x+(frac!==undefined?frac*n.w:(index+1)*n.w/(entries.length+1));}
     item[which]=api$5.anchor(n,side,[round(x),round(y)]);item[which+'_direction']=directions[side];
    });
   }
   return result;
  }
  class Heap{constructor(){this.a=[];}push(value){const a=this.a;let i=a.length;a.push(value);while(i){let p=(i-1)>>1;if(a[p].score<=value.score)break;a[i]=a[p];i=p;}a[i]=value;}pop(){const a=this.a;if(!a.length)return;const first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].score<a[j].score)j++;if(a[j].score>=last.score)break;a[i]=a[j];i=j;}a[i]=last;}return first;}get length(){return this.a.length;}}
  function routingAttempt(nodes,rels,profiles,hints={},labelMeasure,ErrorClass=Error,extraObstacles=[]){
   const p=profiles.layout,clear=q$3(p.object_clearance,16),lane=q$3(p.edge_clearance,12),port=Math.max(24,q$3(p.port_clearance,28)),byId=new Map(nodes.map(n=>[n.id,n]));
   // Route-label reservation margins widen/narrow with the spacing hint (D2), so
   // placed labels reserve broader bands before later relations are routed.
   const labelMargin=round(8*spacingScale(p)),labelRouteMargin=round(10*spacingScale(p));
   const assignments=portAssignments(nodes,rels,profiles,hints),routes=[],labels=[],diagnostics=[];
   const bounds={minX:minOf(nodes,n=>n.x,0),minY:minOf(nodes,n=>n.y,0),maxX:maxOf(nodes,n=>n.x+n.w,100),maxY:maxOf(nodes,n=>n.y+n.h,100)};
   const inflated=nodes.map(n=>box(n,clear));
   const reservations=[];for(const r of rels){const ep=assignments.get(r.id);for(const which of ['source','target']){const pt=ep[which],dir=ep[which+'_direction'],out=[round(pt[0]+dir[0]*(clear+port)),round(pt[1]+dir[1]*(clear+port))];reservations.push({id:r.id+':reserved:'+which,owner:r.id,points:[pt,out]});}}
   for(const r of rels)if((hints[r.id]?.routing||p.routing)==='straight'){const ep=assignments.get(r.id);reservations.push({id:r.id+':reserved:direct',owner:r.id,points:[ep.source,ep.target]});}
   function costSegment(s,obstacles,priorSegs,permitCross=true){
    const ax=s.a[0],ay=s.a[1],bx=s.b[0],by=s.b[1];
    if(Math.abs(ax-bx)<EPS&&Math.abs(ay-by)<EPS)return 0;
    const sh=Math.abs(ay-by)<EPS,sv=Math.abs(ax-bx)<EPS;
    const sminx=Math.min(ax,bx),smaxx=Math.max(ax,bx),sminy=Math.min(ay,by),smaxy=Math.max(ay,by);
    // Obstacle bbox gate: segmentBox can only hit when the envelopes overlap.
    for(let i=0;i<obstacles.length;i++){const b=obstacles[i];
     if(smaxx<=b.x+EPS||sminx>=b.x+b.w-EPS||smaxy<=b.y+EPS||sminy>=b.y+b.h-EPS)continue;
     if(segHitsBox(ax,ay,bx,by,b))return Infinity;}
    let cost=length(s);
    const tol=lane-.1;
    for(let i=0;i<priorSegs.length;i++){const t=priorSegs[i];
     // Envelope gate: collinearity or crossing both require the envelopes to
     // come within tol of each other.
     if(sminx>t.maxx+tol||smaxx<t.minx-tol||sminy>t.maxy+tol||smaxy<t.miny-tol)continue;
     if(sh&&t.horiz){if(Math.abs(ay-t.ay)<tol&&Math.min(smaxx,t.maxx)-Math.max(sminx,t.minx)>EPS)return Infinity;}
     else if(sv&&t.vert){if(Math.abs(ax-t.ax)<tol&&Math.min(smaxy,t.maxy)-Math.max(sminy,t.miny)>EPS)return Infinity;}
     let cx,cy;
     if(sh&&t.vert){cx=t.ax;cy=ay;if(!(cx>sminx-EPS&&cx<smaxx+EPS&&cy>t.miny-EPS&&cy<t.maxy+EPS))continue;}
     else if(sv&&t.horiz){cx=ax;cy=t.ay;if(!(cx>t.minx-EPS&&cx<t.maxx+EPS&&cy>sminy-EPS&&cy<smaxy+EPS))continue;}
     else continue;
     // Reject T contacts and near-corner ambiguity; ordinary clear X crossings are allowed.
     const endpointDistance=Math.min(Math.hypot(t.ax-cx,t.ay-cy),Math.hypot(t.bx-cx,t.by-cy));
     if(endpointDistance<10||!permitCross)return Infinity;cost+=50;
    }
    return cost;
   }
   function pointFree(point,obstacles){return !obstacles.some(b=>pointInside(point,b));}
   function search(a,b,obstacles,priorSegs,edgeIndex){
    const envelope=60+(edgeIndex+1)*lane*2;
    let xs=[a[0],b[0],bounds.minX-envelope,bounds.maxX+envelope],ys=[a[1],b[1],bounds.minY-envelope,bounds.maxY+envelope];
    for(const ob of obstacles){xs.push(ob.x,ob.x+ob.w);ys.push(ob.y,ob.y+ob.h);}
    for(const g of priorSegs){if(g.vert)xs.push(g.ax-lane,g.ax+lane);else ys.push(g.ay-lane,g.ay+lane);}
    const uniq=a=>[...new Set(a.map(round))].sort((a,b)=>a-b);xs=uniq(xs);ys=uniq(ys);
    // Try a deterministic catalogue of small-bend paths before graph search.
    const candidates=[[a,b]];
    for(const x of xs)candidates.push([a,[x,a[1]],[x,b[1]],b]);
    for(const y of ys)candidates.push([a,[a[0],y],[b[0],y],b]);
    let best=null,bestCost=Infinity;
    for(let c of candidates){c=simplify(c);if(segs(c).some(s=>Math.abs(s.a[0]-s.b[0])>EPS&&Math.abs(s.a[1]-s.b[1])>EPS))continue;let cost=0;for(const s of segs(c)){cost+=costSegment(s,obstacles,priorSegs);if(cost>bestCost)break;}cost+=Math.max(0,c.length-2)*20;if(cost<bestCost){best=c;bestCost=cost;}}
    // A small-bend candidate is an incumbent, not an unconditional winner.
    // Search when its cost exceeds the Manhattan bound plus two bends; a short
    // multi-bend route can be far better than an outside-of-drawing excursion.
    const lower=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
    if(best&&bestCost<=lower+40+EPS)return best;
    const nx=xs.length,ny=ys.length,limit=Math.max(10000,p.max_search||250000);if(nx*ny>400000)throw new ErrorClass('DDN211','Routing grid exceeds bounded capacity; split the view');
    const sx=xs.indexOf(round(a[0])),sy=ys.indexOf(round(a[1])),ex=xs.indexOf(round(b[0])),ey=ys.indexOf(round(b[1]));
    const total=nx*ny*2,dist=new Float64Array(total);dist.fill(Infinity);const prev=new Int32Array(total);prev.fill(-1);const start=(sy*nx+sx)*2;
    const heap=new Heap();dist[start]=0;dist[start+1]=0;heap.push({id:start,g:0,score:0});heap.push({id:start+1,g:0,score:0});let count=0,last=-1;
    /* B1-042 (D2.3): grid-edge cost cache as flat typed arrays indexed by the
     * edge's lattice position — no string keys, no Map, no per-edge objects.
     * NaN marks an unevaluated edge; costs are never NaN. */
    const hEdge=new Float64Array(ny*(nx>1?nx-1:0));hEdge.fill(NaN);
    const vEdge=new Float64Array(nx*(ny>1?ny-1:0));vEdge.fill(NaN);
    while(heap.length){const v=heap.pop();if(v.g!==dist[v.id])continue;if(v.score>=bestCost-EPS)break;if(++count>limit)break;const oldDir=v.id%2,node=(v.id-oldDir)/2,xi=node%nx,yi=(node-xi)/nx;if(xi===ex&&yi===ey){last=v.id;break;}
     for(const [dx,dy,dir]of [[-1,0,0],[1,0,0],[0,-1,1],[0,1,1]]){const xx=xi+dx,yy=yi+dy;if(xx<0||xx>=nx||yy<0||yy>=ny)continue;const ni=yy*nx+xx;let cost;
      if(dir===0){const ei=yi*(nx-1)+(xi<xx?xi:xx);cost=hEdge[ei];if(Number.isNaN(cost)){cost=costSegment({a:[xs[xi],ys[yi]],b:[xs[xx],ys[yy]]},obstacles,priorSegs);hEdge[ei]=cost;}}
      else {const ei=(yi<yy?yi:yy)*nx+xi;cost=vEdge[ei];if(Number.isNaN(cost)){cost=costSegment({a:[xs[xi],ys[yi]],b:[xs[xx],ys[yy]]},obstacles,priorSegs);vEdge[ei]=cost;}}
      if(!Number.isFinite(cost))continue;const id=ni*2+dir,next=v.g+cost+(dir===oldDir?0:20);if(next<dist[id]){dist[id]=next;prev[id]=v.id;heap.push({id,g:next,score:next+Math.abs(xs[xx]-b[0])+Math.abs(ys[yy]-b[1])});}}
    }
    if(last<0)return best;const points=[];while(last>=0){const nd=Math.floor(last/2);points.push([xs[nd%nx],ys[Math.floor(nd/nx)]]);last=prev[last];}return simplify(points.reverse());
   }
   function labelFor(route,priorSegs){
    const size=labelMeasure?labelMeasure(route.r):{w:30,h:30};const a=route.hint.callout?.map(v=>q$3(v));
    const candidates=a?[{point:a,explicit:true}]:[];
    const ownSegs=segs(route.points);
    for(const s of ownSegs.slice().sort((a,b)=>length(b)-length(a))){const horizontal=Math.abs(s.a[1]-s.b[1])<EPS,need=horizontal?size.w:size.h,len=length(s);if(len<need+24)continue;
     const samples=[.5,.25,.75,.125,.875,...Array.from({length:Math.min(30,Math.floor(len/24))},(_,i)=>(i+1)/(Math.min(30,Math.floor(len/24))+1))];
     for(const t of samples){if(t*len<need/2+12||(1-t)*len<need/2+12)continue;candidates.push({point:[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t]});}}
    for(const candidate of candidates){const[x,y]=candidate.point,rect={x:x-size.w/2,y:y-size.h/2,w:size.w,h:size.h};
     if(!ownSegs.some(s=>distancePointSegment([x,y],s)<1))continue;
     if(nodes.some(n=>overlap(rect,n,labelMargin))||extraObstacles.some(n=>overlap(rect,n,labelMargin))||labels.some(l=>overlap(rect,l,labelMargin)))continue;
     const bb=box(rect,labelRouteMargin);if(priorSegs.some(t=>segHitsBox(t.ax,t.ay,t.bx,t.by,bb)))continue;
     return {id:route.id,x,y,w:size.w,h:size.h,bounds:rect,explicit:!!candidate.explicit};
    }return null;
   }
   for(let index=0;index<rels.length;index++){
    const r=rels[index],hint=hints[r.id]||{},ep=assignments.get(r.id),start=ep.source,end=ep.target,ownA=byId.get(r.from.element),ownB=byId.get(r.to.element),obstacles=[...inflated,...extraObstacles.map(n=>box(n,clear)),...labels.map(l=>box(l,labelMargin))];
    const normal=(point,dir,d)=>[round(point[0]+dir[0]*d),round(point[1]+dir[1]*d)];
    // Contour attachments (actors, initial/final markers, diamonds) may lie
    // inside their conservative rectangle. Escape all the way beyond that
    // envelope; a fixed-length stub can otherwise stop inside its own obstacle.
    const escape=(pt,dir,own)=>{let distance=clear+port;if(dir[0]>0)distance=Math.max(distance,own.x+own.w-pt[0]+clear+port);if(dir[0]<0)distance=Math.max(distance,pt[0]-own.x+clear+port);if(dir[1]>0)distance=Math.max(distance,own.y+own.h-pt[1]+clear+port);if(dir[1]<0)distance=Math.max(distance,pt[1]-own.y+clear+port);return normal(pt,dir,distance);};
    const a=escape(start,ep.source_direction,ownA),b=escape(end,ep.target_direction,ownB);
    const stubs=[{a:start,b:a},{a:b,b:end}];
    for(const [j,s]of stubs.entries()){const own=j?ownB:ownA;if(nodes.some(n=>n.id!==own.id&&segmentBox(s,box(n,clear))))throw new ErrorClass('DDN212','Endpoint clearance conflicts with another object: '+r.id);}
    const prior=[...routes,...reservations.filter(rt=>rt.owner!==r.id&&!routes.some(old=>old.id===rt.owner))];
    // B1-042 (D2.1): the prior geometry is fixed for the whole relation
    // iteration — derive segment records once, not once per probe.
    const priorSegs=[];for(const rt of prior){const ps=rt.points;for(let i=1;i<ps.length;i++)priorSegs.push(segRec(ps[i-1],ps[i]));}
    let points=null,repaired=false;
    if(hint.via){const specified=simplify([start,...hint.via.map(pt=>pt.map(x=>q$3(x))),end]);const parts=segs(specified),orthogonal=parts.every(s=>Math.abs(s.a[0]-s.b[0])<EPS||Math.abs(s.a[1]-s.b[1])<EPS);
     const safe=parts.every((s,i)=>Number.isFinite(costSegment(s,obstacles.filter(ob=>!((i===0&&ob.id===ownA.id)||(i===parts.length-1&&ob.id===ownB.id))),priorSegs)));
     if(orthogonal&&safe)points=specified;
     else if((hint.policy||p.route_policy)==='strict')throw new ErrorClass(!orthogonal?'DDN073':'DDN213','Unsafe hard waypoint route: '+r.id);
     else repaired=true;
    }
    if(!points&&(hint.routing||p.routing)==='straight'){
     const s={a:start,b:end};if(nodes.some(n=>n.id!==ownA.id&&n.id!==ownB.id&&segmentBox(s,box(n,clear))))throw new ErrorClass('DDN214','Straight connector intersects an unrelated object; choose orthogonal routing');
     if(routes.some(rt=>segs(rt.points).some(t=>collinear(s,t,lane-.1))))throw new ErrorClass('DDN214','Straight connectors share a track; choose distinct ports or orthogonal routing');points=[start,end];
    }
    if(!points){if(!pointFree(a,obstacles)||!pointFree(b,obstacles))throw new ErrorClass('DDN212','No free endpoint escape corridor: '+r.id);
     const center=search(a,b,obstacles,priorSegs,index);if(!center)throw new ErrorClass('DDN215','No unambiguous orthogonal route within bounded search: '+r.id);points=simplify([start,...center,end]);}
    // Check endpoint stubs against other edges too. Actual fields get separate appearance slots.
    const placedSegs=[];for(const rt of routes){const ps=rt.points;for(let i=1;i<ps.length;i++)placedSegs.push(segRec(ps[i-1],ps[i]));}
    if(collinearHits(points,placedSegs,lane-.1)) {
     // Try an alternative side only when the author did not pin sides; never replace member identity.
     throw new ErrorClass('DDN216','Independent connector lanes overlap near an endpoint: '+r.id);
    }
    let route={id:r.id,r,routing:hint.routing||p.routing,hint:{...hint},points,source_side:ep.source_side,target_side:ep.target_side};
    let label=labelFor(route,priorSegs);
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
      if(!Number.isFinite(costSegment({a:l,b:rr},obstacles,priorSegs)))continue;
      const one=search(a,l,obstacles,priorSegs,index),two=one?search(rr,b,obstacles,priorSegs.concat(routeSegRecs(one)),index):null;
      if(!one||!two)continue;
      const candidate=simplify([start,...one,rr,...two.slice(1),end]);
      const walk=segs(candidate).reduce((n,s)=>n+length(s),0);
      const extent=walk+Math.max(0,candidate.length-2)*20;
      if(extent>=chosenCost)continue;
      const trial={...route,points:candidate,hint:{...route.hint}};
      const candidateLabel=labelFor(trial,priorSegs);
      if(candidateLabel){chosen=candidate;chosenLabel=candidateLabel;chosenCost=extent;}
     }
     if(chosen){route.points=chosen;label=chosenLabel;route.labelDetour=true;}
     // Last resort stays centred on the relation and is tried nearest first.
     // It is bounded and remains visible to the attachment optimizer.
     for(let attempt=0;attempt<6&&!label;attempt++){
      const y=Math.min(ownA.y,ownB.y)-pad-(attempt+1)*Math.max(50,m.h+lane*2),l=[cx-half,y],rr=[cx+half,y];
      const one=search(a,l,obstacles,priorSegs,index+attempt+1),two=one?search(rr,b,obstacles,priorSegs.concat(routeSegRecs(one)),index+attempt+2):null;
      if(one&&two&&Number.isFinite(costSegment({a:l,b:rr},obstacles,priorSegs))){const trial={...route,points:simplify([start,...one,rr,...two.slice(1),end])},candidateLabel=labelFor(trial,priorSegs);if(candidateLabel){route.points=trial.points;label=candidateLabel;route.labelDetour=true;}}
     }
    }
    if(!label)throw new ErrorClass('DDN217','No collision-free relationship label position: '+r.id);
    route.hint.callout=[round(label.x),round(label.y)];route.label=label;routes.push(route);labels.push({...label.bounds,id:r.id});
    if(repaired)diagnostics.push({code:'DDN-LW02',severity:'info',message:'Recomputed unsafe route hint '+r.id});
   }
   const crossings=[],routeRecs=routes.map(r=>routeSegRecs(r.points));for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)for(const s of routeRecs[i])for(const t of routeRecs[j]){if(s.minx>t.maxx+8||s.maxx<t.minx-8||s.miny>t.maxy+8||s.maxy<t.miny-8)continue;const point=crossRec(s,t,8);if(point)crossings.push({point,under:routes[i].id,over:routes[j].id,overHorizontal:t.horiz});}
   const quality=inspect(nodes,routes,labels,routeRecs);
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
  function inspect(nodes,routes,labels=[],routeRecs=null){const errors=[],overlaps=[],through=[],shared=[],masking=[];
   const recs=routeRecs||routes.map(r=>routeSegRecs(r.points)),nodeBoxes=nodes.map(n=>box(n,1)),labelBoxes=labels.map(l=>box(l,2));
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(overlap(nodes[i],nodes[j]))overlaps.push([nodes[i].id,nodes[j].id]);
   for(let i=0;i<routes.length;i++){const r=routes[i];for(const s of recs[i])for(let k=0;k<nodes.length;k++){const n=nodes[k];if(n.id===r.r?.from.element||n.id===r.r?.to.element)continue;const b=nodeBoxes[k];if(s.maxx<=b.x+EPS||s.minx>=b.x+b.w-EPS||s.maxy<=b.y+EPS||s.miny>=b.y+b.h-EPS)continue;if(segHitsBox(s.ax,s.ay,s.bx,s.by,b))through.push([r.id,n.id]);}}
   for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)if(recs[i].some(s=>recs[j].some(t=>collinearRec(s,t,.1))))shared.push([routes[i].id,routes[j].id]);
   for(let li=0;li<labels.length;li++)for(let i=0;i<routes.length;i++)if(labels[li].id!==routes[i].id&&recs[i].some(s=>segHitsBox(s.ax,s.ay,s.bx,s.by,labelBoxes[li])))masking.push([labels[li].id,routes[i].id]);
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
  function curvePointAt(route,distance){const a=route.arc||flattenCurve(route.commands||commandsFromPolyline(route.points));distance=Math.max(0,Math.min(a.length,distance));const samples=a.samples;for(let i=1;i<samples.length;i++){const b=samples[i],prev=samples[i-1];if(b.distance>=distance&&b.distance>prev.distance){const t=(distance-prev.distance)/(b.distance-prev.distance);return {point:mix(prev.point,b.point,t),segment:b.segment,t:prev.segment===b.segment?prev.t+(b.t-prev.t)*t:b.t*t};}}const s=samples.at(-1);return {point:s.point,segment:s.segment,t:s.t};}
  function curvePieces(route,holes=[],radius=7){
   const commands=route.commands||commandsFromPolyline(route.points),arc=route.arc||flattenCurve(commands),r={...route,commands,arc},ranges=[];
   for(const h of holes){let d=h.under===r.id?h.underDistance:h.overDistance;if(d===undefined){let near=Infinity,walk=0;for(const s of segs(r.points)){const len=length(s),dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((h.point[0]-s.a[0])*dx+(h.point[1]-s.a[1])*dy)/(len*len||1))),p=mix(s.a,s.b,t),dist=Math.hypot(p[0]-h.point[0],p[1]-h.point[1]);if(dist<near){near=dist;d=walk+len*t;}walk+=len;}}
   const gap=radius/Math.max(.25,h.sine||1);ranges.push([Math.max(0,d-gap),Math.min(arc.length,d+gap)]);}
   ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const rg of ranges){if(merged.length&&rg[0]<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(merged.at(-1)[1],rg[1]);else merged.push([...rg]);}
   let from=0;const spans=[];for(const [lo,hi]of merged){if(lo>from)spans.push([from,lo]);from=hi;}if(from<arc.length)spans.push([from,arc.length]);
   return spans.map(([lo,hi])=>{const a=curvePointAt(r,lo),b=curvePointAt(r,hi),cs=[];for(let i=a.segment;i<=b.segment;i++){const l=i===a.segment?a.t:0,h=i===b.segment?b.t:1;if(h-l>1e-8)cs.push(curveSlice(commands[i],l,h));}return {commands:cs,d:pathData(cs),points:cs.length?flattenCurve(cs).points:[],distance:lo};}).filter(p=>p.commands.length);
  }
  function curveDirection(route,source=false){const commands=route.commands;if(!commands?.length){const s=source?{a:route.points[1],b:route.points[0]}:{a:route.points.at(-2),b:route.points.at(-1)};return Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0])*180/Math.PI;}
   const c=source?commands[0]:commands.at(-1),a=source?(c.kind==='cubic'?c.c1:c.to):(c.kind==='cubic'?c.c2:c.from),b=source?c.from:c.to;return Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;}

  function crossingBridge(c,route,mode='bridge'){
   const d=c.overDistance,gap=7/Math.max(.25,c.sine||1),angle=(c.overAngle??(c.overHorizontal?0:90))*Math.PI/180,n=[Math.sin(angle),-Math.cos(angle)],a=curvePointAt(route,d-gap).point,b=curvePointAt(route,d+gap).point;
   if(mode==='bridge')return [{kind:'cubic',from:a,c1:[a[0]+n[0]*gap*1.5,a[1]+n[1]*gap*1.5],c2:[b[0]+n[0]*gap*1.5,b[1]+n[1]*gap*1.5],to:b}];
   const u=[a[0]+n[0]*gap,a[1]+n[1]*gap],v=[b[0]+n[0]*gap,b[1]+n[1]*gap];return [{kind:'line',from:a,to:u},{kind:'line',from:u,to:v},{kind:'line',from:v,to:b}];
  }
  function curvedRouting(result,nodes,profiles,hints,ErrorClass=Error,extraObstacles=[]){
   const p=profiles.layout,routes=result.routes.map(r=>({...r,points:r.points.map(v=>[...v]),hint:{...r.hint},routing:hints[r.id]?.routing||p.routing}));
   if(!routes.some(r=>r.routing==='curved'))return routes.some(r=>r.routing==='straight')?{...result,crossings:routeCrossings(routes)}:result;
   const dirs={east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]};
   const labelMargin=round(8*spacingScale(p)),labelRouteMargin=round(10*spacingScale(p));
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
    for(const n of [...nodes,...extraObstacles]){const owner=n.id===own.r.from.element||n.id===own.r.to.element,pad=owner?-0.3:Math.max(3,q$3(p.object_clearance,16)*.7);if(segments.some(s=>owner&&n.silhouette&&api$5.segmentInterior?api$5.segmentInterior(s,n):segmentBox(s,box(n,pad))))return false;}
    for(let j=0;j<routes.length;j++)if(j!==index){const other=routes[j];if(segments.some(s=>segmentBox(s,box(other.label.bounds,labelMargin))))return false;
     const ts=routeSegments(other);if(segments.some(s=>ts.some(t=>generalCollinear(s,t,.22))))return false;
     for(const s of segments)for(const t of ts){const hit=lineIntersection(s,t);if(hit&&hit.sine<.22)return false;}
    }return true;
   }
   function label(candidate,index){const size=routes[index].label,old=[size.x,size.y],len=candidate.arc.length,samples=[.5,.4,.6,.3,.7,.2,.8,.1,.9,...Array.from({length:80},(_,i)=>(i+1)/81)],positions=[];
   if(routeSegments(candidate).some(s=>distancePointSegment(old,s)<.15))positions.push(old);
   positions.push(...samples.map(t=>curvePointAt(candidate,len*t).point));
   for(const pt of positions){const[x,y]=pt,rect={x:x-size.w/2,y:y-size.h/2,w:size.w,h:size.h};if(Math.min(Math.hypot(x-candidate.points[0][0],y-candidate.points[0][1]),Math.hypot(x-candidate.points.at(-1)[0],y-candidate.points.at(-1)[1]))<Math.max(size.w,size.h)/2+20)continue;
   if([...nodes,...extraObstacles].some(n=>overlap(rect,n,labelMargin)))continue;
   if(routes.some((r,j)=>j!==index&&(overlap(rect,r.label.bounds,labelMargin)||routeSegments(r).some(s=>segmentBox(s,box(rect,labelRouteMargin))))))continue;
   if(previewCurves.some((pts,j)=>j>index&&pts&&segs(pts).some(s=>segmentBox(s,box(rect,labelRouteMargin)))))continue;
   return {...size,x:round(x),y:round(y),bounds:{...rect,x:round(rect.x),y:round(rect.y)},explicit:false};}return null;}
   for(let i=0;i<routes.length;i++){const r=routes[i];if(r.routing!=='curved')continue;const mode=hints[r.id]?.curve||p.curve||'bezier',radius=q$3(hints[r.id]?.curve_radius??p.curve_radius,32),tension=hints[r.id]?.curve_tension??p.curve_tension??.5,candidates=[];
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

  const api$4={crossingBridge,curvedRouting,flattenCurve,pathData,curvePieces,curveDirection,curveSplit,curveSlice,roundedCommands,lineIntersection,routeCrossings,generalCollinear,CURVE_TOLERANCE,VERSION: VERSION$3,q: q$3,round,overlap,box,segmentBox,segs,cross,collinear,distancePointSegment,simplify,layoutNodes,portAssignments,routing,inspect,SPACING,spacingScale};
  publishNamespace('DDNLayout',api$4);

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * Consolidated 0.3 placement orchestration. Keeps the 0.3 native router, text,
   * publication and export checks; imports only pin-pattern geometry from Live.
   */
  const Patterns=namespace('DDNPinPlacement');
  const VERSION$2='0.7.0',q$2=api$4.q,clone=x=>JSON.parse(JSON.stringify(x));
  function fail$1(code,message){throw Object.assign(new Error(message),{code});}
  const center=g=>[g.x+g.w/2,g.y+g.h/2];
  function stateChecked(state,key){
   if(!state)return null;
   if(state.format!=='ddn-layout-state@1'||state.view!==key||!state.positions||typeof state.positions!=='object'||Array.isArray(state.positions)||Object.keys(state.positions).length>500)fail$1('DDN-P002','Retained layout state has an invalid format or belongs to another view.');
   for(const [id,p]of Object.entries(state.positions))if(['__proto__','constructor','prototype'].includes(id)||!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1e7))fail$1('DDN-P002','Invalid retained world coordinates.');
   return state;
  }
  function place(nodes,rels,ir,options={}){
   const p=ir.view.profiles,at=ir.view.placements||{},algorithm=p.layout.algorithm,diagnostics=[];
   const key=options.viewKey||ir.view.id,state=stateChecked(options.layoutState,key),paused=p.layout.auto_place===false;
   const minGap=2*(q$2(p.layout.object_clearance,16)+Math.max(24,q$2(p.layout.port_clearance,28)))+2*q$2(p.layout.edge_clearance,12);
   const patternMode=algorithm==='auto'?'layered':algorithm==='spanning_tree'?'tree':algorithm;
   const usePattern=['auto','fit_grid','circular','radial','spanning_tree','organic'].includes(algorithm)||(algorithm==='layered'&&p.layout.center==='pins');
   let pattern=null;
   const ErrorClass=class extends Error{constructor(code,message){super(message);this.code=code;}};
   if(usePattern){
    const adapted={...p,layout:{...p.layout,algorithm:patternMode,gap:api$4.round(Math.max(minGap,q$2(p.layout.gap,100))*api$4.spacingScale(p.layout))}};
    const result=Patterns.place(nodes,rels,ir,adapted);pattern=result.pattern;diagnostics.push(...result.diagnostics);
    if(['left','up'].includes(p.layout.direction)&&patternMode==='layered'){
     for(const n of nodes)if(!at[n.id]?.at){const c=center(n),ax=pattern.anchor[0],ay=pattern.anchor[1];if(p.layout.direction==='left')n.x=2*ax-c[0]-n.w/2;else n.y=2*ay-c[1]-n.h/2;}
    }
   }else {
    const result=api$4.layoutNodes(nodes,rels,p,at,ErrorClass);nodes=result.nodes;diagnostics.push(...result.diagnostics);
   }
   const constraints=Patterns.constraintsFor(ir);
   for(const n of nodes)if(at[n.id]?.at){n.x=q$2(at[n.id].at[0]);n.y=q$2(at[n.id].at[1]);}
   const pins=nodes.filter(n=>at[n.id]?.at),bounds=Patterns.bounds(pins),anchor=bounds?center(bounds):null;
   let retained=[];
   if(paused&&state){
    for(const n of nodes)if(!at[n.id]?.at&&state.positions[n.id]){[n.x,n.y]=state.positions[n.id];retained.push(n.id);}
    const occupied=nodes.filter(n=>at[n.id]?.at||retained.includes(n.id));
    for(const n of nodes)if(!occupied.includes(n)){
     let ok=!occupied.some(o=>api$4.overlap(n,o,16));const base=center(n);
     for(let i=1;!ok&&i<1200;i++){const a=i*2.3999632297,d=Math.sqrt(i)*q$2(p.layout.grid_step,32);n.x=base[0]+Math.cos(a)*d-n.w/2;n.y=base[1]+Math.sin(a)*d-n.h/2;ok=Patterns.fits(n,constraints.get(n.id))&&!occupied.some(o=>api$4.overlap(n,o,16));}
     if(!ok)fail$1('DDN-P003','No space for a new element without moving retained positions: '+n.id);occupied.push(n);
    }
   }
   // frame_overflow: confine (RFC-118) clamps unpinned, non-retained members
   // into a fixed frame's interior — automatically what manual pins did. A
   // member larger than the interior is left for the fits check below.
   for(const n of nodes){const b=constraints.get(n.id);if(b&&!at[n.id]?.at&&!retained.includes(n.id)&&n.w<=b.w&&n.h<=b.h){n.x=Math.min(Math.max(n.x,b.x),b.x+b.w-n.w);n.y=Math.min(Math.max(n.y,b.y),b.y+b.h-n.h);}}
   for(const n of nodes)if(!Patterns.fits(n,constraints.get(n.id)))fail$1('DDN-P004','Measured element lies outside a fixed frame: '+n.id);
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(api$4.overlap(nodes[i],nodes[j]))fail$1('DDN204','Pinned or retained placements overlap: '+nodes[i].id+' / '+nodes[j].id);
   if(pattern){pattern={...pattern,pattern:algorithm,autoPlace:!paused};for(const n of nodes)if(pattern.slots[n.id]){const slot=pattern.slots[n.id];slot.seedCenter=slot.center.slice();slot.center=center(n);slot.finalCenter=center(n);}}
   if(paused)diagnostics.push({code:'DDN-PI01',severity:'info',message:`Auto-placement paused; ${retained.length} free positions retained. New elements still need a seed position.`});
   return {nodes,diagnostics,pattern,anchor,pinned:pins.map(n=>n.id),constraints,telemetry:{algorithm,pattern,pinned:pins.map(n=>n.id),autoPlace:!paused,retentionActive:paused&&!!state,retained,portChanges:0,nodeMoves:0,stages:[]}};
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
   const reach=Math.max(96,q$2(p.layout.object_clearance,16)+3*q$2(p.layout.port_clearance,28)+2*q$2(p.layout.edge_clearance,12));
   const stable=(a,b)=>a.id.localeCompare(b.id)||a.which.localeCompare(b.which);
   const at=(rt,which)=>which==='source'?rt.points[0]:rt.points.at(-1);
   const distance=(pt,n)=>Math.hypot(Math.max(n.x-pt[0],0,pt[0]-n.x-n.w),Math.max(n.y-pt[1],0,pt[1]-n.y-n.h));
   function endpoints(result){const map=new Map();for(const rt of result.routes){const list=[];for(const which of ['source','target']){const ep=rt.r[which==='source'?'from':'to'],n=byId.get(ep.element),a=ir.view.routes[rt.id]||{},side=rt[which+'_side'],row=n.fieldRows?.find(f=>f.id===ep.member),port=n.n?.ports?.find(f=>f.id===ep.member);
      const locked=a.via!==undefined||a[which+'_fraction']!==undefined||a['x_'+which+'_fraction']!==undefined||!!port;
      list.push({id:rt.id,which,ep,n,a,side,row,point:at(rt,which),slotFree:!locked,sideFree:!locked&&a[which+'_side']===undefined,region:row?row.id:''});
     }map.set(rt.id,list);}return map;}
   function incidents(result){const eps=endpoints(result),out=[];for(const c of result.crossings){const a=eps.get(c.under)||[],b=eps.get(c.over)||[];for(const x of a)for(const y of b)if(x.n.id===y.n.id){out.push({x,y,c,distance:distance(c.point,x.n)});}}
    return out.sort((a,b)=>a.distance-b.distance||a.x.n.id.localeCompare(b.x.n.id)||stable(a.x,b.x)||stable(a.y,b.y));}
   function cost(result){const rs=result.routes;return {crossings:result.crossings.length,localCrossings:incidents(result).filter(c=>c.distance<=reach).length,
      length:rs.reduce((sum,r)=>sum+api$4.segs(r.points).reduce((s,e)=>s+Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),0),0),
      bends:rs.reduce((sum,r)=>sum+Math.max(0,(r.commands?r.commands.length:r.points.length-1)-1),0)};}
   if(!best)return {best,hints,telemetry};telemetry.before=cost(best);
   if(p.layout.endpoint_ordering==='preserve'||p.layout.optimize==='none'||!limit){telemetry.after=telemetry.before;return {best,hints,telemetry};}
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
   return {best,hints:current,telemetry};
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
   const run=h=>api$4.routing(nodes,rels,p,h,labelMeasure,ErrorClass,obstacles);
   let best=null,lastError=null;
   try{best=run(hints);}catch(e){lastError=e;}
   const score=r=>({crossings:r.crossings.length,length:r.routes.reduce((n,r)=>n+api$4.segs(r.points).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0),0),bends:r.routes.reduce((n,r)=>n+Math.max(0,r.points.length-2),0)});
   // A crossing-free route may still contain a costly label excursion. Measure
   // against its own endpoint displacement, not the extent of the whole drawing.
   const inefficient=route=>{const ps=route.points,a=ps[0],b=ps.at(-1),direct=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),walk=api$4.segs(ps).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0);return route.r.from.element!==route.r.to.element&&(route.labelDetour||walk>direct*1.8+120);};
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
     const free=nodes.filter(n=>!protectedIds.has(n.id));new Set((best?.crossings||[]).flatMap(c=>[c.under,c.over]));let nt=0;
     new Map(nodes.map(n=>[n.id,[n.x,n.y]]));
     for(let i=0;i<free.length&&nt<Math.min(12,budget);i++)for(let j=i+1;j<free.length&&nt<Math.min(12,budget);j++){
      if(best&&score(best).crossings===0)break;
      const a=free[i],b=free[j],sa=slots[a.id],sb=slots[b.id];
      if(placed.pattern&&(!sa||!sb||sa.key!==sb.key))continue;
      if(!placed.pattern&&['mindmap','tree','layered','grouped'].includes(p.layout.algorithm))continue;
      const oldA=[a.x,a.y],oldB=[b.x,b.y],ca=center(a),cb=center(b);a.x=cb[0]-a.w/2;a.y=cb[1]-a.h/2;b.x=ca[0]-b.w/2;b.y=ca[1]-b.h/2;
      const clear=nodes.every((x,k)=>nodes.slice(k+1).every(y=>!api$4.overlap(x,y,16)));
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
   return {...best,telemetry:{portChanges,nodeMoves,portTrials:trials,endpointOrdering,stages,pattern:placed.pattern,remainingCrossings:best.crossings.length}};
  }
  const api$3={VERSION: VERSION$2,place,route,stateChecked,centeredBounds:Patterns.centeredBounds};
  publishNamespace('DDNPlacement',api$3);

  /* SPDX-License-Identifier: GPL-2.0-or-later. Deterministic illustrative SVG renderer.
   * Not a replacement for the production layout/conformance requirements in spec/.
   */
  const DDN$1=namespace('DDN');
  const Export=namespace('DDNExport');
  const esc$1=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const fmt=n=>Number(n.toFixed(3));
  const q$1=DDN$1.quantity;
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
  const slug=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const cls=(...parts)=>parts.flat(Infinity).filter(Boolean).join(' ');
  function wrap(s,n=30){const lines=[];for(const line of String(s??'').split('\n')){let current='';for(const word of line.split(/\s+/)){if((current+' '+word).trim().length>n&&current){lines.push(current);current=word;}else current=(current+' '+word).trim();}while(current.length>n+8){lines.push(current.slice(0,n));current=current.slice(n);}lines.push(current);}return lines;}
  function text$1(x,y,s,size=14,fill='#203047',weight=400,extra=''){api$7?.measure(s,size,activeFont,weight);return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${esc$1(fill)}" font-weight="${weight}" ${extra}>${esc$1(s).replace(/[→↗∅]/g,c=>`<tspan font-family="DejaVu Sans, Arial, sans-serif">${c}</tspan>`)}</text>`;}
  function multilines(x,y,lines,size=14,fill='#203047',step=20,weight=400){return lines.map((l,i)=>text$1(x,y+i*step,l,size,fill,weight)).join('');}
  function line(x1,y1,x2,y2,colour,width=1.5,dash=''){return `<path d="M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}" fill="none" stroke="${esc$1(colour)}" stroke-width="${width}"${dash?` stroke-dasharray="${esc$1(dash)}"`:''}/>`;}
  function glyph(name,x,y,size=24,colour='#285EA8'){return `<use href="#g-${esc$1(name)}" xlink:href="#g-${esc$1(name)}" x="${fmt(x)}" y="${fmt(y)}" width="${size}" height="${size}" style="color:${esc$1(colour)}"/>`;}
  function rect(x,y,w,h,stroke,fill,look='classic',id='',radius=0,style={}){
   if(look==='handDrawn'){
    if(!api$6)throw new Error('DDN handDrawn requires ddn-sketch.js to be loaded before ddn-render.js');
    return api$6.box(x,y,w,h,{stroke,fill,id,radius,seed:style.seed??42,roughness:style.roughness??1.8,hachure:style.hachure??true});
   }
   let out='';
   if(look==='neo')out+=`<rect x="${x+5}" y="${y+7}" width="${w}" height="${h}" rx="${radius}" fill="#000" opacity=".14"/>`;
   out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${esc$1(fill)}" stroke="${esc$1(stroke)}" stroke-width="1.8"/>`;
   if(look==='neo')out+=`<path d="M${x+radius+1} ${y+3}H${x+w-radius-1}" stroke="${esc$1(stroke)}" stroke-width="3" opacity=".68"/><path d="M${x+12} ${y+7}H${x+w-12}" stroke="#FFF" stroke-width="2" opacity=".75"/>`;
   return out;
  }
  function styleLine(x1,y1,x2,y2,colour,width,dash,p,id){
   return p.style.look==='handDrawn'?api$6.polyline([[x1,y1],[x2,y2]],{stroke:colour,width,dash,id,seed:p.style.seed,roughness:(p.style.roughness??1.8)*.7}):line(x1,y1,x2,y2,colour,width,dash);
  }
  function badge(s,x,y,fill,stroke){let w=Math.max(32,s.length*6.5+12);return {svg:`<rect x="${x}" y="${y}" width="${w}" height="20" rx="4" fill="${esc$1(fill)}" stroke="${esc$1(stroke)}" stroke-width=".8"/>`+text$1(x+w/2,y+14,s,10,stroke,650,'text-anchor="middle"'),w};}
  function pretty(v){if(v===null)return 'null';if(v?.$missing)return '∅ missing';if(v?.$state)return v.$state.replaceAll('_',' ');if(v?.$ref)return '@'+v.$ref.split('::').at(-1);if(v?.$quantity!==undefined)return v.$quantity+v.unit;if(Array.isArray(v))return v.map(pretty).join(', ');if(v&&typeof v==='object')return JSON.stringify(v);return String(v??'');}
  const themes=api$8.themes;
  function measureNode(n,registry,profiles,placement={},context={}){
   const k=DDN$1.kindEntry(registry,n.kind),s=q$1(profiles.style.font_size,16)/16,font=profiles.style.font;
   const visible=profiles.display.fields==='none'?[]:n.fields.filter(f=>(f.depth||0)<profiles.display.depth);
   let w=Math.max(placement.size?q$1(placement.size[0]):270*s,160*s);
   const titleLines=api$7.wrap(n.name,w-96*s,16*s,font,650);if(profiles.display.kind==='text')w=Math.max(w,api$7.measure(k.name,11*s,font,650).width+28*s);const headerH=Math.max(64*s,40*s+titleLines.length*21*s);
   let y=headerH,rows=[];
   for(const f of visible){const depth=f.depth||0;let label=f.name;if(f.properties.shape==='array')label+=' []';else if(f.properties.shape==='object')label+=' {}';else if(f.properties.shape==='variant')label+=' <variant>';else if(f.properties.shape==='map')label+=' <map>';else if(f.properties.shape==='set')label+=' <set>';
    const prefix=(f.properties.presence==='optional'?'? ':'')+(f.properties.nullable===true?'nullable · ':'');
    const labelLines=api$7.wrap(prefix+label,w-(40+depth*16)*s,13.5*s,font,400),details=[];
    if(profiles.display.domains==='show'&&f.properties.domain){const d=context.byId?.get(f.properties.domain.$ref);details.push('domain: '+(d?.name||pretty(f.properties.domain)));}
    const dt=f.properties.datatype||f.properties.x_erp?.sql_type;if(profiles.display.datatypes==='show'&&dt)details.push('type: '+pretty(dt));
    const detailLines=details.flatMap(x=>api$7.wrap(x,w-(40+depth*16)*s,11.5*s,font,400));
    let h=(labelLines.length*18+detailLines.length*16+10)*s;h=Math.max(h,(context.degrees?.[f.id]||1)*18+10,(context.degrees?.[f.id]||1)>2?(context.degrees[f.id]*40+10):0);
    rows.push({id:f.id,field:f,top:y,h,labelLines,detailLines,depth});y+=h;
   }
   let meaningLines=[];if(n.type==='domain'||k.code==='DOM'){meaningLines=api$7.wrap(n.properties.meaning||'Shared semantic meaning',w-30*s,12.5*s,font,400);y=Math.max(y,headerH)+meaningLines.length*18*s+20*s;}
   let noteLines=[];if(k.shape==='note'&&n.properties.description){noteLines=api$7.wrap(n.properties.description,w-30*s,12.5*s,font,400);y+=noteLines.length*18*s+20*s;}
   let sample=null;
   if(n.type==='sample'||k.code==='SMP'){
    const columns=n.properties.columns||[],allRows=n.properties.rows||[],raw=allRows.slice(0,1000),omitted=allRows.length-raw.length,head=columns.map(c=>context.members?.get(c.$ref)?.name||c.$ref?.split('.').at(-1)||String(c)),widths=head.map((h,i)=>Math.max(110*s,Math.min(220*s,Math.max(api$7.measure(h,11.5*s,font,650).width,...raw.map(row=>api$7.measure(pretty(row[i]),12*s,font,400).width))+24*s)));
    w=Math.max(w,widths.reduce((a,b)=>a+b,0)+24*s);const total=widths.reduce((a,b)=>a+b,0),factor=(w-24*s)/Math.max(1,total);widths.forEach((x,i)=>widths[i]*=factor);
    const headers=head.map((h,i)=>api$7.wrap(h,widths[i]-12*s,11.5*s,font,650)),headH=Math.max(...headers.map(a=>a.length),1)*17*s+14*s;
    let rowTop=headerH+headH;const tableRows=raw.map(row=>{const cells=row.map((v,i)=>api$7.wrap(pretty(v),widths[i]-12*s,12*s,font,400)),h=Math.max(...cells.map(c=>c.length),1)*18*s+12*s,r={cells,top:rowTop,h};rowTop+=h;return r;});
    sample={columns,headers,widths,headH,rows:tableRows,omitted};y=rowTop+32*s;
   }
   const footer=[];if(profiles.display.badges!=='none')for(const key of ['workload','role','temporal','distribution','location'])if(n.properties[key]!==undefined)footer.push(pretty(n.properties[key]));
   if(footer.length)y+=38*s;
   let h=Math.max(y+14*s,100*s,placement.size?q$1(placement.size[1]):0,(context.degrees?.[n.id]||1)>4?(context.degrees[n.id]*44+40):((context.degrees?.[n.id]||1)*20+40));
   const g={id:n.id,n,k,w,h,fields:visible,titleLines,footer,scale:s,headerH,fieldRows:rows,meaningLines,noteLines,sample}; return k.profileKind?api$5.measure(g,profiles):g;
  }
  function renderNode(g,p,theme){
   if(g.k.profileKind){let shaped=api$5.render(g,p,theme);if(g.n.properties&&g.n.properties.x_subdiagram){const b=badge('↗ ref',0,0,theme.surface,theme.accent);shaped=shaped.slice(0,-4)+`<g class="ddn-ref-badge" transform="translate(${fmt(g.x+g.w-b.w*g.scale)} ${fmt(g.y-10*g.scale)}) scale(${g.scale})">`+b.svg+'</g></g>';}return shaped;}
   const{n,k,x,y,w,h,titleLines,footer}=g,s=g.scale,font=p.style.font,mono=p.style.theme==='neutral',look=p.style.look;
   const nc=api$8.node(k,theme),ink=mono?'#333333':nc.ink,fill=mono?'#FAFAFA':nc.fill,bodyInk=nc.text;
   const maturity={draft:'DRF',approved:'APR',undecided:'UNK',review:'REV',deprecated:'DEP',retired:'RET',rejected:'REJ'},m=typeof n.properties.maturity==='object'?'UNK':maturity[n.properties.maturity];
   let out=`<g class="${cls('ddn-node','ddn-kind-'+slug(k.code))}" data-id="${esc$1(n.id)}" data-ddn-id="${esc$1(n.id)}" data-ref="${esc$1(n.ref||n.id)}" tabindex="0" role="group" aria-label="${esc$1(n.name)}"><title>${esc$1(n.name+' — '+k.name)}</title>`;
   if(k.shape==='note'){
    if(look==='handDrawn')out+=api$6.polygon([[x,y],[x+w-16*s,y],[x+w,y+16*s],[x+w,y+h],[x,y+h]],{...p.style,id:n.id,stroke:ink,fill});
    else out+=`<path d="M${x} ${y}H${x+w-16*s}L${x+w} ${y+16*s}V${y+h}H${x}Z" fill="${esc$1(fill)}" stroke="${esc$1(ink)}" stroke-width="1.8"/>`;
    out+=styleLine(x+w-16*s,y,x+w-16*s,y+16*s,ink,1.3,'',p,n.id+':fold-v')+styleLine(x+w-16*s,y+16*s,x+w,y+16*s,ink,1.3,'',p,n.id+':fold-h');
   }else out+=rect(x,y,w,h,ink,fill,look,n.id,k.shape==='activity'?18*s:0,p.style);
   if(k.shape==='frame')out+=`<rect x="${x+6}" y="${y+6}" width="${w-12}" height="${h-12}" fill="none" stroke="${esc$1(ink)}" stroke-dasharray="4 4" opacity=".55"/>`;
   if(p.display.kind!=='none'){
    if(p.display.kind!=='text')out+=glyph(k.glyph,x+13*s,y+15*s,24*s,ink);
    if(['text','icon_token'].includes(p.display.kind)||mono)out+=text$1(x+14*s,y+53*s,p.display.kind==='text'?k.name:k.code,11*s,ink,650);
   }
   out+=multilines(x+48*s,y+29*s,titleLines,16*s,bodyInk,21*s,650);
   if(m&&p.display.maturity!=='none')out+=`<rect x="${x+w-46*s}" y="${y+8*s}" width="${38*s}" height="${22*s}" rx="4" fill="${esc$1(fill)}" stroke="${esc$1(ink)}"/>`+text$1(x+w-27*s,y+24*s,m,11*s,ink,650,'text-anchor="middle"');
   if(n.properties&&n.properties.x_subdiagram){const b=badge('↗ ref',0,0,theme.surface,theme.accent);out+=`<g class="ddn-ref-badge" transform="translate(${fmt(x+w-b.w*s)} ${fmt(y-10*s)}) scale(${s})">`+b.svg+'</g>';}
   if(g.fieldRows.length){out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':fields');
    for(const row of g.fieldRows){const xx=x+(16+row.depth*16)*s,yy=y+row.top+18*s;
     out+=`<g class="ddn-field" data-member="${esc$1(row.id)}">`+multilines(xx,yy,row.labelLines,13.5*s,bodyInk,18*s);
     if(row.field.properties.key)out+=glyph('key',x+w-27*s,yy-14*s,16*s,ink);
     if(row.detailLines.length)out+=multilines(xx,yy+row.labelLines.length*18*s,row.detailLines,11.5*s,ink,16*s);
     out+='</g>';
    }
   }
   if(g.meaningLines.length){out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':meaning');out+=multilines(x+15*s,y+g.headerH+18*s,g.meaningLines,12.5*s,bodyInk,18*s);}
   if(g.noteLines.length)out+=multilines(x+15*s,y+g.headerH+18*s,g.noteLines,12.5*s,bodyInk,18*s);
   if(g.sample){const sm=g.sample;out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':sample');let xx=x+12*s;
    sm.headers.forEach((lines,i)=>{out+=multilines(xx,y+g.headerH+16*s,lines,11.5*s,ink,17*s,650);if(i)out+=styleLine(xx-5*s,y+g.headerH-4*s,xx-5*s,y+h-30*s,ink,.5,'',p,n.id+':column:'+i);xx+=sm.widths[i];});
    for(let j=0;j<sm.rows.length;j++){const row=sm.rows[j];let xx=x+12*s;row.cells.forEach((lines,i)=>{out+=multilines(xx,y+row.top+18*s,lines,12*s,bodyInk,18*s);xx+=sm.widths[i];});out+=styleLine(x+10*s,y+row.top+row.h-1,x+w-10*s,y+row.top+row.h-1,ink,.45,'',p,n.id+':row:'+j);}
    out+=text$1(x+13*s,y+h-12*s,(n.properties.mode||'example')+' · illustrative, not a constraint'+(sm.omitted?' · +'+sm.omitted+' rows not rendered':''),11*s,ink);
   }
   if(footer.length){let bx=x+12*s;for(const value of footer){let st=value.toUpperCase(),width=api$7.measure(st,11*s,font,650).width+14*s;if(bx+width>x+w-10*s){out+=text$1(bx,y+h-14*s,'+ detail',11*s,ink);break;}out+=`<rect x="${bx}" y="${y+h-29*s}" width="${width}" height="${22*s}" rx="4" fill="${esc$1(fill)}" stroke="${esc$1(ink)}" stroke-width=".8"/>`+text$1(bx+width/2,y+h-13*s,st,11*s,ink,650,'text-anchor="middle"');bx+=width+7*s;}}
   return out+'</g>';
  }
  function pathD(points){return points.map((v,i)=>(i?'L':'M')+fmt(v[0])+' '+fmt(v[1])).join(' ');}
  function segments(points){return points.slice(1).map((p,i)=>({a:points[i],b:p,i}));}
  function endMark(point,angle,type,ink,surface='white'){if(!type||type==='none')return '';let s=`<g transform="translate(${point[0]} ${point[1]}) rotate(${angle})" stroke="${esc$1(ink)}" stroke-width="1.7" fill="none">`;
   if(type==='filled')s+=`<path d="M0 0L-10 -5L-10 5Z" fill="${esc$1(ink)}"/>`;
   else if(type==='open')s+='<path d="M-10 -5L0 0L-10 5"/>';
   else if(type==='diamond')s+=`<path d="M0 0L-8 -5L-16 0L-8 5Z" fill="${esc$1(ink)}"/>`;
   else if(type==='triangle')s+=`<path d="M0 0L-12 -7L-12 7Z" fill="${esc$1(surface)}"/>`;
   else if(['one','zeroone','many','zeromany'].includes(type)){
    if(type.includes('many'))s+='<path d="M-13 0L0 -7M-13 0L0 7M-13 0L0 0"/>';
    else s+='<path d="M-4 -7V7"/>';
    if(type.startsWith('zero'))s+=`<circle cx="-20" cy="0" r="4" fill="${esc$1(surface)}"/>`;else s+='<path d="M-18 -7V7"/>';
   }
   return s+'</g>';
  }
  function midpoint(points){const seg=segments(points).sort((a,b)=>Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1])-Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1]))[0];return [(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];}
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
  function render$1(ir,registry,glyphDefs='',options={}){const before=activeFont;activeFont=ir.view.profiles.style.font;try{return renderInner(ir,registry,glyphDefs,options);}finally{activeFont=before;}}
  function renderInner(ir,registry,glyphDefs='',options={}){
   if(!api$4||!api$7||!Export)throw new DDN$1.DDNError('DDN099','Load layout/text/export modules before rendering');
   ir=Export.project(ir);
   const textBefore=api$7.stats();
   const p=ir.view.profiles,t=themes[p.style.theme],mono=p.style.theme==='neutral';
   /* B1-045 (D2): view chrome visibility. Defaults (auto/on) reproduce the
    * pre-option emission rules exactly. legend off behaves like placement none
    * for layout and emission; title off drops the header block and its reserved
    * band; footer off drops the footer line. */
   const chrome=p.chrome||{legend:'auto',title:'on',footer:'on'},titleOn=chrome.title!=='off',footerOn=chrome.footer!=='off';
   const legendPlacement=chrome.legend==='off'?'none':p.legend.placement;
   const headBlock=titleOn?110:20;
   const elems=ir.view.selected.map(id=>ir.elements.find(n=>n.id===id));
   const rels=ir.view.relations.map(id=>ir.relations.find(r=>r.id===id));
   const context={byId:new Map(ir.elements.map(n=>[n.id,n])),members:new Map(ir.elements.flatMap(n=>[...n.fields,...n.ports].map(f=>[f.id,f]))),degrees:{}};
   const portIds=new Set(ir.elements.flatMap(n=>n.ports.map(pt=>pt.id)));
   for(const r of rels)for(const ep of [r.from,r.to]){context.degrees[ep.element]=(context.degrees[ep.element]||0)+1;if(ep.member)context.degrees[ep.member]=(context.degrees[ep.member]||0)+1;}
   let geoms=elems.map(n=>measureNode(n,registry,p,ir.view.placements[n.id],context));
   
   if(p.publication.fit==='reflow'&&p.layout.algorithm==='grid'&&!Object.values(ir.view.placements).some(x=>x.at)){const pw=q$1(p.publication.width,1280),reserve=legendPlacement==='right'?q$1(p.legend.width,310)+25:0;let cols=Math.floor((pw-2*q$1(p.publication.margin,32)-reserve)/(geoms.reduce((m,g)=>Math.max(m,g.w),270)+api$4.round(q$1(p.layout.gap,100)*api$4.spacingScale(p.layout))));p.layout={...p.layout,columns:Math.max(1,Math.min(geoms.length,cols))};}
   const placed=api$3.place(geoms,rels,ir,options);geoms=placed.nodes;
   geoms.reduce((m,g)=>Math.max(m,g.w),270);geoms.reduce((m,g)=>Math.max(m,g.h),130);
   const byId=new Map(geoms.map(g=>[g.id,g]));
   let frames=ir.view.frames.map(f=>{const m=f.members.map(id=>byId.get(id)).filter(Boolean);let x=f.at?q$1(f.at[0]):(m.length?m.reduce((v,g)=>Math.min(v,g.x),Infinity)-20:0),y=f.at?q$1(f.at[1]):(m.length?m.reduce((v,g)=>Math.min(v,g.y),Infinity)-54:0),w=f.size?q$1(f.size[0]):(m.length?m.reduce((v,g)=>Math.max(v,g.x+g.w),-Infinity)-x+20:300),h=f.size?q$1(f.size[1]):(m.length?m.reduce((v,g)=>Math.max(v,g.y+g.h),-Infinity)-y+22:170);
   // frame_overflow (RFC-118): expand grows a declared rect to enclose members
   // at the standard padding; when members already fit this is a no-op.
   if(m.length&&p.layout.frame_overflow!=='confine'&&(f.at||f.size)){w=Math.max(w,m.reduce((v,g)=>Math.max(v,g.x+g.w),-Infinity)-x+20);h=Math.max(h,m.reduce((v,g)=>Math.max(v,g.y+g.h),-Infinity)-y+22);}
   return {...f,x,y,w,h};});
   let subs=ir.view.subdiagrams.map((d,i)=>({...d,x:q$1(d.at?.[0],i*310),y:q$1(d.at?.[1],geoms.reduce((m,g)=>Math.max(m,g.y+g.h),0)+100),w:q$1(d.size?.[0],270),h:q$1(d.size?.[1],95)}));
   const labelMeasure=r=>{if(r._visualLabel===false)return {w:0,h:0};const reg=DDN$1.relationEntry(registry,r.kind);if(p.legend.mode==='numbers')return {w:30,h:30};const str=p.legend.mode==='tokens'?reg.code:r.name;return {w:api$7.measure(str,12,p.style.font,500).width+20,h:28};};
   const routed=api$3.route(geoms,rels,ir,labelMeasure,subs,placed);
   const routes=routed.routes.map(a=>({...a,reg:DDN$1.relationEntry(registry,a.r.kind)})),crossings=routed.crossings;
   const allBoxes=[...geoms,...frames,...subs,...routed.labels];
   let minX=allBoxes.reduce((m,g)=>Math.min(m,g.x),0),minY=allBoxes.reduce((m,g)=>Math.min(m,g.y),0);for(const r of routes)for(const pt of r.points){minX=Math.min(minX,pt[0]);minY=Math.min(minY,pt[1]);}
   let maxX=allBoxes.reduce((m,g)=>Math.max(m,g.x+g.w),100),maxY=allBoxes.reduce((m,g)=>Math.max(m,g.y+g.h),100);for(const r of routes)for(const pt of r.points){maxX=Math.max(maxX,pt[0]);maxY=Math.max(maxY,pt[1]);}
   const pinFocus=p.layout.center==='pins'?placed.anchor:null;
   if(pinFocus){const b=api$3.centeredBounds({x:minX,y:minY,w:maxX-minX,h:maxY-minY},pinFocus);minX=b.x;minY=b.y;maxX=b.x+b.w;maxY=b.y+b.h;}
   const width=maxX-minX+30,height=maxY-minY+30;
   let pageW=q$1(p.publication.width,1280),pageH=q$1(p.publication.height,800);
   if(['a4','letter'].includes(p.publication.size)){pageW=p.publication.size==='a4'?210*96/25.4:8.5*96;pageH=p.publication.size==='a4'?297*96/25.4:11*96;if(p.publication.orientation==='landscape')[pageW,pageH]=[pageH,pageW];}
   const margin=q$1(p.publication.margin,32),legendW=legendPlacement==='right'?q$1(p.legend.width,270):0;
   let legendEntries=rels.map(r=>{const a=ir.elements.find(n=>n.id===r.from.element),b=ir.elements.find(n=>n.id===r.to.element),reg=DDN$1.relationEntry(registry,r.kind);const fromName=a.name+(r.from.member?'.'+(a.fields.find(f=>f.id===r.from.member)?.name||a.ports.find(f=>f.id===r.from.member)?.name||r.from.member.split('.').at(-1)):'');const toName=b.name+(r.to.member?'.'+(b.fields.find(f=>f.id===r.to.member)?.name||b.ports.find(f=>f.id===r.to.member)?.name||r.to.member.split('.').at(-1)):'');let detail=`${fromName} → ${toName}: ${r.name}`;
    const qualifiers=['enforcement','capture','transport','delivery','scope'];for(const prop of qualifiers)if(r.properties[prop]!==undefined)detail+=`; ${prop}: ${pretty(r.properties[prop])}`;
    return {id:r.id,key:ir.view.keys[r.id],name:r.name,reg,lines:api$7.wrap(detail,Math.max(legendW,300)-42,12,p.style.font,400)};
   });
   const legendHeight=50+legendEntries.reduce((n,e)=>n+Math.max(44,e.lines.length*18+16),0),bottomH=legendPlacement==='bottom'?legendHeight:0;
   const pageTitle=p.publication.title||ir.view.name;
   if(p.publication.size==='content'){pageW=Math.max(640,api$7.measure(pageTitle,24,p.style.font,650).width+2*margin,width+2*margin+(legendW?legendW+25:0));pageH=Math.max(360,height+2*margin+headBlock+bottomH,legendPlacement==='right'?legendHeight+headBlock+60:0);}
   const titleLines=titleOn?api$7.wrap(pageTitle,pageW-2*margin,24,p.style.font,650):[],captionLines=titleOn&&p.publication.caption?api$7.wrap(p.publication.caption,pageW-2*margin,13,p.style.font,400):[],extraHeader=titleOn?(titleLines.length-1)*28+(captionLines.length?captionLines.length*18+8:0):0;
   const availW=pageW-2*margin-(legendW?legendW+25:0),availH=pageH-2*margin-(headBlock-10)-bottomH-extraHeader;
   let scale=p.publication.fit==='none'?1:Math.min(1,availW/width,availH/height);
   const diags=[...ir.diagnostics,...placed.diagnostics,...routed.diagnostics];
   if(scale<=0)throw new DDN$1.DDNError('DDN070','Page has no usable drawing area');
   const embeddingScale=q$1(p.publication.embedding_scale,1);if(embeddingScale<=0||embeddingScale>4)throw new DDN$1.DDNError('DDN070','embedding_scale must be >0 and <=4');
   const fontSize=Math.min(11*q$1(p.style.font_size,16)/16*scale,rels.length?12*scale:Infinity,11)*embeddingScale,minFont=q$1(p.publication.minimum_text,10.66);
   if(fontSize<minFont){
    /* B1-046 (D3): name the remedy. smallest = min(11·base/16·scale, rels?12·scale:∞, 11)·embed,
     * so the implied minimum base font is 16·minFont/(11·scale·embed) — unless a
     * fixed cap (12·scale with relations, 11 absolute) binds below the minimum,
     * in which case no base font can fix it and the page must grow. */
    const relCap=rels.length?12*scale*embeddingScale:Infinity,absCap=11*embeddingScale;
    const remedy=Math.min(relCap,absCap)<minFont
     ?'the page scale already caps the smallest text role below the minimum, so a larger base font cannot fix it — enlarge the page, reduce content, or raise publication.minimum_text/embedding_scale'
     :`increase base font to ≥${(16*minFont/(11*scale*embeddingScale)).toFixed(1)}px or enlarge the smallest text role`;
    let d={code:'DDN071',severity:p.publication.overflow==='error'?'error':'warning',message:`Smallest final text ${fontSize.toFixed(2)}px is below minimum ${minFont.toFixed(2)}px — ${remedy}`};if(d.severity==='error')throw new DDN$1.DDNError(d.code,d.message);diags.push(d);}
   if(legendPlacement==='right'&&legendHeight>pageH-(headBlock+50)-extraHeader)throw new DDN$1.DDNError('DDN072','Legend exceeds page height');
   if(p.publication.fit==='none'&&(width>availW+.1||height>availH+.1)){if(p.publication.overflow==='error')throw new DDN$1.DDNError('DDN074','Unscaled drawing exceeds publication area; choose reflow or a larger page');diags.push({code:'DDN074',severity:'warning',message:'Unscaled drawing exceeds publication area'});}
   const tx=pinFocus?margin+availW/2-pinFocus[0]*scale:margin-minX*scale+10,ty=pinFocus?headBlock-20+extraHeader+availH/2-pinFocus[1]*scale:headBlock-20+extraHeader-minY*scale+10;
   let diagram='';
   for(const f of frames){diagram+=`<g class="ddn-frame" data-frame="${esc$1(f.id)}">`+rect(f.x,f.y,f.w,f.h,t.rule,t.surface,p.style.look,f.id,0,{...p.style,hachure:false})+text$1(f.x+15,f.y+26,f.name,13,t.muted,650);if(f.x_region===true)diagram+=`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="none" stroke="${t.rule}" stroke-dasharray="6 4"/>`;diagram+=`</g>`;}
   const routeColours={};
   for(const a of routes){const colour=mono?'#383838':api$8.semantic(a.reg.colour,t);routeColours[a.id]=colour;
    let mask='';const holes=crossings.filter(c=>p.layout.crossings==='gap'?c.under===a.id:c.over===a.id);if(holes.length){const mid='gap-'+hash(a.id);mask=` mask="url(#${mid})"`;diagram+=`<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="${minX-100}" y="${minY-100}" width="${width+200}" height="${height+200}"><rect x="${minX-100}" y="${minY-100}" width="${width+200}" height="${height+200}" fill="white"/>`+holes.map(h=>`<circle cx="${h.point[0]}" cy="${h.point[1]}" r="7" fill="black"/>`).join('')+'</mask></defs>';}
    diagram+=`<g class="${cls('ddn-relation','ddn-rel','ddn-verb-'+slug(a.reg.code||a.r.kind))}" data-routing="${a.routing||p.layout.routing}" data-id="${esc$1(a.id)}"><title>${esc$1(a.r.name)}</title>`;
    const pieces=a.commands||holes.some(h=>h.overDistance!==undefined)?api$4.curvePieces(a,holes):visibleRoutePieces(a.points,holes);
    diagram+=`<g${mask} data-route-pieces="${pieces.length}">`+pieces.map((piece,i)=>p.style.look==='handDrawn'?(a.commands?api$6.curve:api$6.polyline)(a.commands?piece.commands:piece.points,{...p.style,id:a.id+':piece:'+i,stroke:colour,width:a.reg.width,dash:a.reg.pattern,dashOffset:-piece.distance,protectedPoints:crossings.filter(c=>c.under===a.id||c.over===a.id).map(c=>c.point)}):`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(colour)}" stroke-width="${a.reg.width}"${a.reg.pattern?` stroke-dasharray="${esc$1(a.reg.pattern)}" stroke-dashoffset="${fmt(-piece.distance)}"`:''}/>`).join('')+'</g>';
    if(a.r.properties.x_chen_total){diagram+=`<g${mask} data-total-participation="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(colour)}" stroke-width="5"/><path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(t.surface)}" stroke-width="2"/>`).join('')+'</g>';}
    if(a.r.properties.x_critical){const s=q$1(p.style.font_size,16)/16;diagram+=`<g${mask} data-critical-path="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${t.accent}" stroke-width="${fmt(3*s)}"/>`).join('')+'</g>';}
    const startType=a.r.properties.source_mark||a.reg.start,endType=a.r.properties.target_mark||a.reg.end;
    diagram+=endMark(a.points[0],api$4.curveDirection(a,true),startType,colour,t.surface)+endMark(a.points.at(-1),api$4.curveDirection(a),endType,colour,t.surface);
    if(p.projection.profile?.startsWith('sysml.')){const s=q$1(p.style.font_size,16)/16;
     for(const[ep,pt]of [[a.r.from,a.points[0]],[a.r.to,a.points.at(-1)]])if(ep.member&&portIds.has(ep.member))diagram+=`<rect data-port-square="${esc$1(ep.member)}" x="${fmt(pt[0]-5*s)}" y="${fmt(pt[1]-5*s)}" width="${fmt(10*s)}" height="${fmt(10*s)}" fill="${esc$1(t.surface)}" stroke="${esc$1(colour)}" stroke-width="1.5"/>`;}
    diagram+='</g>';
   }
   // Bridge geometry is explicit postprocessing. A rounded bridge is a local exception to orthogonality.
   if(p.layout.crossings!=='gap')for(const c of crossings){
    const col=routeColours[c.over];
    if(c.overDistance!==undefined){const route=routes.find(r=>r.id===c.over),commands=api$4.crossingBridge(c,route,p.layout.crossings),points=api$4.flattenCurve(commands).points;
     if(geoms.some(g=>api$4.segs(points).some(s=>api$4.segmentBox(s,api$4.box(g,2))))||routed.labels.some(g=>api$4.segs(points).some(s=>api$4.segmentBox(s,api$4.box(g,2)))))throw new DDN$1.DDNError('DDN224','Crossing jump obstructs an object or label; increase spacing or select crossings:gap');
     diagram+=`<path data-crossing-jump="true" d="${api$4.pathData(commands)}" stroke="${esc$1(col)}" stroke-width="2" fill="none"/>`;
    }else {const[x,y]=c.point,r=7,orientation=c.overHorizontal?0:90;diagram+=`<g transform="translate(${x} ${y}) rotate(${orientation})"><path d="${p.layout.crossings==='bridge'?`M-${r} 0 C-${r} -${r*1.5} ${r} -${r*1.5} ${r} 0`:`M-${r} 0V-${r}H${r}V0`}" stroke="${esc$1(col)}" stroke-width="2" fill="none"/></g>`;}
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
    const routeD=a=>a.commands?api$4.pathData(a.commands):pathD(a.points);
    const RATE_MAX=32,motionRate=v=>Math.min(RATE_MAX,Math.max(1,Number.isSafeInteger(v)?v:1));
    const markerShape=(kind,size,color,anim)=>kind==='square'?`<rect x="${fmt(-size/2)}" y="${fmt(-size/2)}" width="${fmt(size)}" height="${fmt(size)}" fill="${esc$1(color)}">${anim}</rect>`:kind==='rect'?`<rect x="${fmt(-size*.75)}" y="${fmt(-size/2)}" width="${fmt(size*1.5)}" height="${fmt(size)}" fill="${esc$1(color)}">${anim}</rect>`:`<circle r="${fmt(size/2)}" fill="${esc$1(color)}">${anim}</circle>`;
    for(const a of routes){
     const props=a.r.properties||{};if(props.motion!=='flow'&&props.motion!=='pulse')continue;
     const len=pathLength(a.points);if(!(len>0))continue;
     const speed=q$1(props.speed,60),dur=fmt(len/speed);
     if(props.motion==='pulse'){
      const pulse=props.pulse_color||t.accent;
      diagram+=`<g class="ddn-motion ddn-pulse" data-relation="${esc$1(a.id)}" data-hop="0" data-hop-start="0" data-hop-end="${dur}" data-dur="${dur}"><path d="${esc$1(routeD(a))}" fill="none" stroke="${esc$1(routeColours[a.id])}" stroke-width="${a.reg.width}" opacity=".9"><animate attributeName="stroke" values="${esc$1(routeColours[a.id])};${esc$1(pulse)};${esc$1(routeColours[a.id])}" dur="${dur}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".25;1;.25" dur="${dur}s" repeatCount="indefinite"/></path></g>`;
      motionScene.push({relation:a.id,kind:'pulse',duration:len/speed,rate:1});
      continue;
     }
     const rate=motionRate(props.rate),size=q$1(props.marker_size,8),colour=props.marker_color||routeColours[a.id];
     let g=`<g class="ddn-motion" data-relation="${esc$1(a.id)}" data-hop="0" data-hop-start="0" data-hop-end="${dur}" data-dur="${dur}">`;
     for(let i=0;i<rate;i++)g+=markerShape(props.marker||'circle',size,colour,`<animateMotion dur="${dur}s" begin="${fmt(-i*(len/speed)/rate)}s" repeatCount="indefinite" rotate="auto" path="${esc$1(routeD(a))}"/>`);
     diagram+=g+'</g>';
     motionScene.push({relation:a.id,kind:'flow',duration:len/speed,rate});
    }
    for(const f of ir.view.flows||[]){
     const props=f.properties||{};
     const speed=q$1(props.speed,60),size=q$1(props.marker_size,8),rate=motionRate(props.rate),colour=props.marker_color||t.accent;
     const hops=f.hops.map(id=>routeById.get(id));
     if(hops.some(a=>!a))continue;
     const lens=hops.map(a=>pathLength(a.points)),total=lens.reduce((x,y)=>x+y,0);
     if(!(total>0))continue;
     const durT=total/speed;let acc=0;const hopScene=[];
     let g=`<g class="ddn-flow ddn-flow-${slug(f.local||f.id)}" data-flow="${esc$1(f.id)}" data-dur="${fmt(durT)}"><title>${esc$1(f.name)}</title>`;
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
       g+=markerShape(props.marker||'circle',size,colour,`<animateMotion dur="${fmt(durT)}s" begin="${begin}s" repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="${keyPoints}" keyTimes="${keyTimes}" path="${esc$1(routeD(a))}"/><animate attributeName="opacity" values="${opValues}" keyTimes="${opTimes}" calcMode="discrete" dur="${fmt(durT)}s" begin="${begin}s" repeatCount="indefinite"/>`);}
      g+='</g>';
     });
     diagram+=g+'</g>';
     flowScene.push({id:f.id,name:f.name,duration:durT,hops:hopScene});
    }
   }
   geoms.forEach(g=>diagram+=renderNode(g,p,t));
   for(const d of subs){
    if(d.mode==='inline'&&d.child){const child=render$1(d.child,registry,glyphDefs),childScale=Math.min(d.w/child.scene.width,d.h/child.scene.height)*scale*embeddingScale;const childMin=child.scene.smallestText*childScale;if(childMin<minFont){if(p.publication.overflow==='error')throw new DDN$1.DDNError('DDN076','Inline child text is below final minimum; enlarge the child or link a detail view');diags.push({code:'DDN076',severity:'warning',message:'Inline child rendered below configured minimum'});}let inner=child.svg.replace(/<\?xml[^>]*>/,'');const prefix='sub-'+hash(d.id)+'-';inner=inner.replace(/ id="([^"]+)"/g,(m,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${prefix}${id})`).replace(/(href|xlink:href)="#([^"]+)"/g,(m,a,id)=>`${a}="#${prefix}${id}"`).replace(/aria-labelledby="[^"]*"/g,'').replace(/<svg /,`<svg x="${d.x}" y="${d.y}" `).replace(/width="[^"]*" height="[^"]*"/,`width="${d.w}" height="${d.h}"`);diagram+=`<g class="ddn-inline" data-view="${esc$1(d.target)}">`+inner+'</g>';}
    else {if(!/^[A-Za-z0-9_.\/-]+$/.test(d.targetLocal)||d.targetLocal.startsWith('/')||d.targetLocal.includes('..'))throw new DDN$1.DDNError('DDN078','Subdiagram reference target must be a safe relative identifier: '+d.targetLocal);diagram+=`<g class="ddn-subdiagram" data-view="${esc$1(d.target)}"><a href="${esc$1(d.targetLocal)}.svg">`+rect(d.x,d.y,d.w,d.h,t.accent,t.surface,p.style.look,d.id,0,p.style)+glyph('frame',d.x+14,d.y+18,25,t.accent)+text$1(d.x+48,d.y+33,d.name,15,t.ink,600)+text$1(d.x+14,d.y+64,'↗ '+d.targetLocal+' · diagram reference',11,t.muted)+'</a></g>';}
   }
   for(const a of routes){if(a.r._visualLabel===false)continue;let [x,y]=a.hint.callout?a.hint.callout.map(v=>q$1(v)):midpoint(a.points);let mode=p.legend.mode;
    if(mode==='numbers'){diagram+=`<g class="ddn-callout ddn-label" data-id="${esc$1(a.id)}"><circle cx="${x}" cy="${y}" r="14" fill="${t.surface}" stroke="${t.ink}" stroke-width="1.5"/>`+text$1(x,y+4.5,String(ir.view.keys[a.id]),12,t.ink,700,'text-anchor="middle"')+'</g>';}
    else {let s=mode==='tokens'?a.reg.code:a.r.name,w=a.label.w;diagram+=`<g class="ddn-label" data-id="${esc$1(a.id)}"><rect x="${x-w/2}" y="${y-12}" width="${w}" height="24" rx="3" fill="${t.surface}"/>`+text$1(x,y+4,s,12,t.ink,500,'text-anchor="middle"')+'</g>';}
   }
   const scene={smallestText:fontSize,width:pageW,height:pageH,scale,origin:[tx,ty],nodes:geoms.map(({n,k,fieldRows,sample,...g})=>({...g,fields:g.fields.map(f=>f.id),fieldRows:fieldRows.map(({field,...row})=>row)})),routes:routes.map(({id,points,label,source_side,target_side,commands,routing,strategy,curveFamily,radius,appliedTension})=>({id,points,label:label.bounds,source_side,target_side,routing:routing||p.layout.routing,...(commands?{commands,strategy,curveFamily,...(radius!==undefined?{curveRadius:radius}:{}),...(appliedTension!==undefined?{appliedTension}:{}),flattenTolerance:api$4.CURVE_TOLERANCE}:{})})),crossings,frames,subdiagrams:subs,quality:routed.quality,layout:{...placed.telemetry,...routed.telemetry,algorithm:p.layout.algorithm,routing:p.layout.routing,engine:'ddn-native@'+DDN$1.VERSION},drawingBounds:{x:minX,y:minY,w:width,h:height},drawingArea:{x:margin,y:headBlock-20+extraHeader,w:availW,h:availH},...(motionScene.length?{motion:motionScene}:{}),...(flowScene.length?{flows:flowScene}:{}),...(pinFocus?{focus:{world:pinFocus,page:[tx+pinFocus[0]*scale,ty+pinFocus[1]*scale]}}:{})};
   const font={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'}[p.style.font]||'DejaVu Sans, Arial, sans-serif';
   const fontClass='ddn-font-'+hash(font);
   const viewClass=cls('ddn-svg','ddn-view-'+slug(p.projection?.kind||'graph'),p.projection?.profile&&'ddn-profile-'+slug(p.projection.profile),fontClass);
   let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg class="${viewClass}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(pageW)}" height="${fmt(pageH)}" viewBox="0 0 ${fmt(pageW)} ${fmt(pageH)}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="ddn-title ddn-desc"><title id="ddn-title">${esc$1(ir.view.name)}</title><desc id="ddn-desc">DDN 0.5 proposed standard example. ${esc$1(p.publication.caption||'')} ${esc$1(p.style.look)} look; ${esc$1(p.style.theme)} presentation. Crossings are not connections.${chrome.legend==='off'?'':' Relationship details are in the adjacent legend.'}</desc><defs>${glyphDefs}</defs><style>.${fontClass}{font-family:${font}} .ddn-node:focus{outline:none}</style><rect width="100%" height="100%" fill="${t.background}"/>`;
   if(titleOn)out+=text$1(margin,margin+5,'DDN / PROPOSED STANDARD / 0.5',11,t.muted,650)+multilines(margin,margin+34,titleLines,24,t.ink,28,650)+multilines(margin,margin+34+titleLines.length*28,captionLines,13,t.muted,18)+text$1(pageW-margin,margin+5,p.style.look+' · '+p.style.theme,11,t.muted,500,'text-anchor="end"');
   out+=`<g id="drawing" transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})">${diagram}</g>`;
   if(legendPlacement!=='none'&&legendEntries.length){let lx=legendPlacement==='right'?pageW-margin-legendW:margin,ly=legendPlacement==='right'?headBlock-15+extraHeader:pageH-margin-legendHeight;out+=line(lx-12,ly-12,lx-12,legendPlacement==='right'?pageH-margin-40:ly+legendHeight,t.rule,1);out+=text$1(lx,ly,'RELATIONSHIP KEY',11,t.muted,700);ly+=33;
    for(const entry of legendEntries){const key=p.legend.mode==='numbers'?entry.key:entry.reg.code;if(p.legend.mode==='numbers')out+=`<circle cx="${lx+12}" cy="${ly-4}" r="12" fill="${t.surface}" stroke="${t.ink}"/>`+text$1(lx+12,ly,String(key),11,t.ink,700,'text-anchor="middle"');else out+=text$1(lx,ly,String(key),11,t.muted,650);
     out+=multilines(lx+34,ly,entry.lines,12,t.ink,18);ly+=Math.max(44,entry.lines.length*18+16);}
   }
   if(footerOn)out+=line(margin,pageH-39,pageW-margin,pageH-39,t.rule,1)+text$1(margin,pageH-20,'Same data · independent view · fixed semantics · presentation only',11,t.muted)+text$1(pageW-margin,pageH-20,ir.view.local+' / '+ir.registry,11,t.muted,400,'text-anchor="end"');
   out+='</svg>';
   const textAfter=api$7.stats(),estimated=textAfter.estimated-textBefore.estimated;
   if(estimated){if(p.publication.metrics==='required')throw new DDN$1.DDNError('DDN077','Required measured fonts unavailable; supply text metrics or a browser provider');diags.push({code:'DDN-TW01',severity:'warning',message:'Some text runs used estimated metrics; this is not a typography-certified publication.'});}
   scene.layoutState={format:'ddn-layout-state@1',view:options.viewKey||ir.view.id,positions:Object.fromEntries(geoms.map(g=>[g.id,[g.x,g.y]]))};
   scene.textMeasurement={mode:estimated?'estimated':'measured',requestedFont:p.style.font,provider:textAfter.canvas>textBefore.canvas?'browser-canvas':'pinned-cache'};
   return {svg:out,scene,diagnostics:diags,_drawing:diagram,_defs:glyphDefs,_ir:ir};
  }
  const api$2={palette:api$8,render: render$1,measureNode,visibleRoutePieces,esc: esc$1,hash,wrap,text: text$1,multilines,line,glyph,rect,badge,pretty,themes,pathD,endMark,cls,slug};
  publishNamespace('DDNRender',api$2);

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * Experimental session-bootstrap interaction projection, 0.1.
   * This uses the DDN 0.3 core while preserving its notation. It is not a protocol engine,
   * a cryptographic implementation, or full UML/sequence conformance.
   */
  const DDN=namespace('DDN');
  const VERSION$1='0.1.1', PROFILE='session-bootstrap@0.1';
  const esc=api$2.esc, text=api$2.text, q=DDN.quantity;
  const fail=(code,message)=>{throw new DDN.DDNError(code,message);};
  function validate(ir){
    const p=ir.view.profiles, profile=p.layout.x_interaction;
    if(profile!==PROFILE)fail('DDN-I001','Unsupported interaction projection '+profile);
    if(p.export?.mode==='redacted')fail('DDN-I032','Experimental interaction publication has no approved payload/occurrence redaction closure; use an explicitly allowlisted ordinary graph view. No SVG is emitted.');
    if(p.layout.routing==='curved'||Object.values(ir.view.routes||{}).some(r=>r.routing==='curved'))fail('DDN-I031','Curved routing belongs to the ordinary graph projection; the experimental interaction profile uses fixed participant lanes. No silent geometry fallback.');
    if(p.legend.mode!=='numbers'||p.legend.placement!=='right')fail('DDN-I002','Interaction 0.1 requires a right-hand numbered relationship key');
    const sequence=p.layout.x_sequence;
    if(typeof sequence!=='string'||!sequence)fail('DDN-I003','A nonempty x_sequence is required');
    const elements=new Map(ir.elements.map(n=>[n.id,n]));
    const actors=ir.view.selected.map(id=>elements.get(id));
    if(!actors.length||actors.some(n=>!n||!n.properties.x_protocol_role))fail('DDN-I004','Select explicit participant objects with x_protocol_role');
    const selected=new Set(actors.map(n=>n.id));
    const steps=ir.relations.filter(r=>r.properties.x_protocol?.sequence===sequence);
    if(!steps.length||steps.length>500)fail('DDN-I005','Interaction must contain between 1 and 500 exchanges');
    const byId=new Map(steps.map(r=>[r.id,r])),ids=new Set(),orders=new Set(),numbers=new Set();
    for(const r of steps){
      const m=r.properties.x_protocol;
      if(typeof m.step!=='string'||!m.step||ids.has(m.step))fail('DDN-I006','Missing or duplicate step identity');ids.add(m.step);
      if(!Number.isSafeInteger(m.display_order)||m.display_order<1||orders.has(m.display_order))fail('DDN-I007','display_order must be a unique positive integer');orders.add(m.display_order);
      if(!Array.isArray(m.after)||m.after.some(x=>!x?.$ref||!byId.has(x.$ref)))fail('DDN-I008','Every after entry must reference an exchange in the same sequence');
      if(new Set(m.after.map(x=>x.$ref)).size!==m.after.length)fail('DDN-I008','Duplicate predecessor');
      if(!selected.has(r.from.element)||!selected.has(r.to.element))fail('DDN-I009','Every exchange endpoint must have a selected participant lane');
      if(!['request','response','challenge','internal','event'].includes(m.form))fail('DDN-I010','Unsupported message form '+m.form);
      if(!['A','B','C','D'].includes(m.phase))fail('DDN-I011','This scenario uses phases A through D');
      if(!m.payload?.$ref||!elements.has(m.payload.$ref)||!['message','record'].includes(elements.get(m.payload.$ref).kind))fail('DDN-I012','Payload must reference an in-scope message or record contract');
      if(typeof m.note!=='string')fail('DDN-I027','The explanatory note must be text');
      if(Object.keys(m).some(k=>!['sequence','step','display_order','after','phase','form','payload','reply_to','note'].includes(k)))fail('DDN-I028','Unknown interaction metadata property');
      if(m.form==='internal'&&(r.from.element!==r.to.element||r.kind!=='invoke'))fail('DDN-I013','Internal events are same-participant invoke relationships');
      if(m.form!=='internal'&&r.kind!=='flow')fail('DDN-I014','Network/local payload exchanges retain the core flow relationship');
      if(m.reply_to){const request=byId.get(m.reply_to.$ref);if(!request||request.id===r.id)fail('DDN-I015','reply_to must identify another exchange');
        if(request.from.element!==r.to.element||request.to.element!==r.from.element)fail('DDN-I016','A reply must reverse the correlated request endpoints');}
      const key=ir.view.keys[r.id];if(!Number.isSafeInteger(key)||key<1||numbers.has(key))fail('DDN-I017','Each exchange requires an explicit unique callout key');numbers.add(key);
    }
    // Ordering comes only from after edges; integers break ties in a valid topological projection.
    const active=new Set(),done=new Set();
    function visit(r){if(active.has(r.id))fail('DDN-I018','Cycle in protocol predecessor graph');if(done.has(r.id))return;active.add(r.id);for(const a of r.properties.x_protocol.after)visit(byId.get(a.$ref));active.delete(r.id);done.add(r.id);}
    steps.forEach(visit);
    for(const r of steps)for(const a of r.properties.x_protocol.after)if(byId.get(a.$ref).properties.x_protocol.display_order>=r.properties.x_protocol.display_order)fail('DDN-I019','display_order conflicts with an explicit predecessor');
    function ancestors(r,set=new Set()){for(const a of r.properties.x_protocol.after)if(!set.has(a.$ref)){set.add(a.$ref);ancestors(byId.get(a.$ref),set);}return set;}
    for(const r of steps)if(r.properties.x_protocol.reply_to&&!ancestors(r).has(r.properties.x_protocol.reply_to.$ref))fail('DDN-I020','A response must causally follow its request');
    const phases=p.layout.x_phases;
    if(phases!==undefined&&(!Array.isArray(phases)||!phases.length||phases.some(x=>!['A','B','C','D'].includes(x))))fail('DDN-I021','x_phases must be a nonempty subset of A, B, C, D');
    const ordered=[...steps].sort((a,b)=>a.properties.x_protocol.display_order-b.properties.x_protocol.display_order);
    const shown=phases?ordered.filter(r=>phases.includes(r.properties.x_protocol.phase)):ordered;
    if(!shown.length)fail('DDN-I022','The selected phases contain no exchanges');
    const shownIds=new Set(shown.map(r=>r.id)), externalPredecessors=shown.flatMap(r=>r.properties.x_protocol.after.filter(x=>!shownIds.has(x.$ref)).map(x=>({step:r.id,predecessor:x.$ref})));
    return {profile,sequence,actors,steps:ordered,shown,externalPredecessors,elements};
  }
  function render(ir,registry,defs,options={}){
    if(!ir.view.profiles.layout.x_interaction)return api$2.render(ir,registry,defs,options);
    const model=validate(ir),p=ir.view.profiles,t=api$2.themes[p.style.theme],look=p.style.look;
    const rowH=q(p.layout.x_row_height,68),W=q(p.publication.width,1840),H=q(p.publication.height,400);
    if(rowH<60||rowH>160)fail('DDN-I023','row height must be between 60px and 160px');
    const left=30, legendW=q(p.legend.width,460), legendX=W-legendW-24;
    const diagramW=legendX-left-30, laneW=diagramW/model.actors.length;
    if(laneW<135)fail('DDN-I024','Too many participant lanes for the page width');
    const top=195, end=top+model.shown.length*rowH, needed=end+75;
    if(H<needed)fail('DDN-I025',`Interaction page needs at least ${needed}px height; split phases or enlarge page`);
    if(q(p.style.font_size,16)!==16)fail('DDN-I026','Experimental interaction typography remains 16px; variable fonts are supported by the native core view renderer');
    if(q(p.publication.minimum_text,0)>11)fail('DDN-I026','Smallest interaction labels are 11px; this minimum is unsupported');
    const font=p.style.font==='mono'?'DejaVu Sans Mono, monospace':p.style.font==='serif'?'DejaVu Serif, serif':p.style.font==='handwriting'?'Comic Neue, Segoe Print, Bradley Hand, cursive':'DejaVu Sans, Arial, sans-serif';
    const x=new Map(model.actors.map((n,i)=>[n.id,left+(i+.5)*laneW])), scene={format:'ddn-interaction-scene@0.1',width:W,height:H,scale:1,origin:[0,0],nodes:[],routes:[],messageRows:[],externalPredecessors:model.externalPredecessors};
    let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ddn-title ddn-desc" style="font-family:${font}"><title id="ddn-title">${esc(ir.view.name)}</title><desc id="ddn-desc">Ordered protocol illustration generated from explicit DDN predecessor references. The pale vertical guides are participant lanes, not data-flow relationships. Numbered circles index the adjacent exchange key. Requests and responses use distinct arrows. This is a success-path architecture proposal, not a verified secure protocol.</desc><defs>${defs}</defs><rect width="100%" height="100%" fill="${t.background}"/>`;
    out+=text(30,26,'DDN / SESSION BOOTSTRAP / EXPERIMENTAL INTERACTION PROFILE',11,t.muted,650)+text(30,59,ir.view.name,24,t.ink,650);
    out+=text(30,82,'Explicit predecessors define order. Vertical guides are NOT connectors. Rows show order, not duration.',12,t.muted);
    out+=text(W-30,26,look+' / '+model.shown.length+' of '+model.steps.length+' exchanges',11,t.muted,500,'text-anchor="end"');
    model.actors.forEach((n,i)=>{
      const nx=left+i*laneW+4,nw=laneW-8,k=DDN.kindEntry(registry,n.kind),cx=x.get(n.id),nc=api$2.palette.node(k,t);
      out+=`<rect x="${left+i*laneW}" y="190" width="${laneW}" height="${end-190+15}" fill="${i%2?t.surface:t.background}"/>`;
      out+=`<path d="M${cx} 190V${end+15}" stroke="${t.rule}" stroke-width="1" data-guide="participant"/>`;
      out+=`<g class="ddn-node" data-id="${esc(n.id)}" role="group"><title>${esc(n.name)}</title>`+api$2.rect(nx,105,nw,77,nc.ink,nc.fill,look,n.id,0,p.style);
      out+=api$2.glyph(k.glyph,nx+9,115,19,nc.ink);
      const lines=api$2.wrap(n.name,Math.floor((nw-45)/7.5));
      out+=api$2.multilines(nx+35,125,lines,12.5,nc.text,17,650);
      out+=text(nx+12,170,k.code+' / '+String(n.properties.x_zone).toUpperCase(),11,nc.ink,600)+'</g>';
      scene.nodes.push({id:n.id,x:nx,y:105,w:nw,h:77});
    });
    out+=api$2.line(legendX-15,102,legendX-15,end+15,t.rule,1.2)+text(legendX,123,'EXCHANGE KEY',12,t.ink,700)+text(legendX,147,'Callout / step identity / payload movement',11,t.muted);
    out+=text(legendX,170,'Payload contracts and guard notes are in the companion table.',11,t.muted);
    const phaseNames={A:'AUTHENTICATE',B:'AUTHORIZE BACKEND',C:'NEGOTIATE & READY',D:'FIRST QUERY'};
    model.shown.forEach((r,i)=>{
      const m=r.properties.x_protocol,y=top+i*rowH+rowH/2, ax=x.get(r.from.element),bx=x.get(r.to.element),reg=DDN.relationEntry(registry,r.kind);
      const colour=p.style.theme==='neutral'?'#383838':api$2.palette.semantic(reg.colour,t);
      out+=api$2.line(left,y+rowH/2-2,W-28,y+rowH/2-2,t.rule,.55);
      let points,keyx;
      if(ax===bx){points=[[ax,y-15],[ax+47,y-15],[ax+47,y+13],[ax,y+13]];keyx=ax+47;}
      else {points=[[ax,y],[bx,y]];keyx=ax+(bx>ax?1:-1)*Math.min(38,Math.abs(bx-ax)/2);}
      out+=`<g class="ddn-relation" data-id="${esc(r.id)}" role="group"><title>${esc(m.step+': '+r.name)}</title>`;
      out+=look==='handDrawn'?api$6.polyline(points,{...p.style,id:r.id,stroke:colour,width:reg.width,dash:reg.pattern}):`<path d="${api$2.pathD(points)}" fill="none" stroke="${colour}" stroke-width="${reg.width}"${reg.pattern?' stroke-dasharray="'+reg.pattern+'"':''}/>`;
      const endp=points.at(-1),prev=points.at(-2),angle=Math.atan2(endp[1]-prev[1],endp[0]-prev[0])*180/Math.PI;
      out+=`<g transform="translate(${endp[0]} ${endp[1]}) rotate(${angle})"><path d="M-10 -5L0 0L-10 5" fill="${m.form==='internal'?'none':colour}" stroke="${colour}" stroke-width="1.6"/></g>`;
      // Callout numerals remain precise in the sketch treatment.
      out+=`<g class="ddn-callout" data-id="${esc(r.id)}"><circle cx="${keyx}" cy="${y}" r="13" fill="${t.surface}" stroke="${t.ink}" stroke-width="1.2"/>`+text(keyx,y+4,String(ir.view.keys[r.id]),11,t.ink,700,'text-anchor="middle"')+'</g></g>';
      const n1=model.elements.get(r.from.element),n2=model.elements.get(r.to.element);
      const heading=m.step+'  '+phaseNames[m.phase]+'  /  '+m.form.toUpperCase();
      out+=`<g data-id="${esc(r.id)}"><circle cx="${legendX+12}" cy="${y}" r="12" fill="${t.surface}" stroke="${t.ink}"/>`+text(legendX+12,y+4,String(ir.view.keys[r.id]),11,t.ink,700,'text-anchor="middle"')+text(legendX+34,y-24,heading,11,t.muted,650);
      out+=api$2.multilines(legendX+34,y-5,api$2.wrap(r.name,Math.floor((legendW-58)/7.6)),14,t.ink,17,600);
      out+=text(legendX+34,y+rowH/2-12,n1.name+' → '+n2.name,11,t.muted)+'</g>';
      scene.routes.push({id:r.id,points});scene.messageRows.push({id:r.id,step:m.step,callout:ir.view.keys[r.id],y,phase:m.phase,from:r.from.element,to:r.to.element,form:m.form,after:m.after.map(x=>x.$ref),payload:m.payload.$ref});
    });
    const omitted=model.externalPredecessors.length?'Boundary prerequisites retained: '+model.externalPredecessors.map(x=>model.steps.find(r=>r.id===x.predecessor).properties.x_protocol.step).join(', ')+'.':'No hidden predecessor before the first displayed event.';
    out+=text(30,H-43,omitted,11,t.muted)+text(30,H-20,'Proposed architecture · no authentication or SQL is executed · source: session-bootstrap/model.ddn',11,t.muted)+text(W-30,H-20,'Interaction renderer '+VERSION$1+' / DDN '+DDN.VERSION,11,t.muted,400,'text-anchor="end"')+'</svg>';
    const diagnostics=[...ir.diagnostics,{code:'DDN-IW01',severity:'warning',message:'Experimental interaction projection validates declared predecessor/correlation metadata. It does not validate cryptographic security, real network behavior or full UML sequence semantics.'}];
    return {svg:out,scene,diagnostics};
  }
  const api$1={VERSION: VERSION$1,PROFILE,validate,render};
  publishNamespace('DDNInteraction',api$1);

  /* SPDX-License-Identifier: GPL-2.0-or-later. ddn-graph bundle entry (B1-019).
   * Load-order guard, graph renderer registration, browser globals. */

  const host = globalThis;
  if (!host.DDNLive) throw new Error('ddn-graph requires ddn-core.js to be loaded first');
  if (host.DDNLive.VERSION !== pkg.version) throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');
  if (!host.DDNRender) {
    Object.assign(host, { DDNPalette: api$8, DDNText: api$7, DDNSketch: api$6, DDNShapes: api$5, DDNLayout: api$4, DDNPlacement: api$3, DDNRender: api$2, DDNInteraction: api$1 });
    optionalNamespace('DDNEngine').registerProjectionRenderer('graph', api$1.render);
  }
  const api = host.DDNLive;
  if (typeof module === 'object' && module.exports) module.exports = api;
  const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;

})();
