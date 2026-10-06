/*! DDN 0.8.0 · GPL-2.0-or-later · modular runtime bundle: ddn-graph — Graph renderer (ERD/flow/native layout, routing, interaction). Registers the "graph" projection kind. */
(function () {
  'use strict';

  var h=typeof globalThis!=='undefined'?globalThis:this;if(!h.DDNLive)throw new Error('ddn-graph requires ddn-core.js to be loaded first');if(h.DDNLive.VERSION!=="0.8.0")throw new Error('A different DDNLive runtime is already loaded. Load exactly one version.');if(h.DDNRender)return;

  var pkg = {
    "version": "0.8.0"}
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
  const api$a={themes: themes$1,semantic,node,contrast,mix: mix$1};
  publishNamespace('DDNPalette',api$a);

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
  const FONTS={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Comic Sans MS, Segoe Print, Bradley Hand, Purisa, Nanum Pen Script, cursive'};
  /* 0.8 (chapter 54 §54.4): measurement-engine identity. A font_pin records the
   * producing engine; a mismatch is DDN-TF05 (pin ignored) at render time. */
  const ENGINE='ddn-text@1';
  let cache=initial?.measurements||{},provider=null,providerName=null,context=null;const requests=new Map();const counts={estimated:0,canvas:0,cache:0,provider:0};
  /* 0.8 (chapter 04 §6A): portable text properties. Measurement consumes the
   * same decoration properties painting emits: an optional style record
   * {italic:'italic'|true, variant:'small-caps'} joins the cache key (only when
   * present, so pre-0.8 pinned caches keep their 4-tuple keys) and the canvas
   * font string. Weight already rode the key. In the estimate path italic keeps
   * regular advance widths (oblique advances are equal) and small-caps
   * substitutes uppercase metrics at 0.8x size for cased-lowercase graphemes. */
  const styleFlags=st=>st&&(st.italic||st.variant==='small-caps')?[st.italic?1:0,st.variant==='small-caps'?1:0]:null;
  const key=(s,size,font,weight,st)=>{const base=[String(s),+size,font,weight];const fl=styleFlags(st);return JSON.stringify(fl?base.concat(fl):base);};
  const segments$1=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('und',{granularity:'grapheme'}):null;
  const graphemes=s=>segments$1?[...segments$1.segment(String(s))].map(x=>x.segment):[...String(s)];
  function setMetrics(data){cache=data?.measurements||data||{};}
  function setProvider(fn,name='custom'){provider=fn;providerName=name;}
  function measure$1(s,size=14,font='sans',weight=400,st=null){s=String(s??'');const k=key(s,size,font,weight,st);let result;
   if(provider){counts.provider++;result=provider(s,size,FONTS[font]||font,weight);if(!result||!Number.isFinite(result.width))throw new Error('Text measurement provider returned invalid width');return {...result,method:providerName};}
   if(typeof document!=='undefined'&&document.createElement){try{context??=document.createElement('canvas').getContext('2d');if(context){counts.canvas++;context.font=`${st?.italic?'italic ':''}${st?.variant==='small-caps'?'small-caps ':''}${weight} ${size}px ${FONTS[font]||font}`;const m=context.measureText(s);return {width:m.width,ascent:m.actualBoundingBoxAscent||size*.85,descent:m.actualBoundingBoxDescent||size*.25,method:'browser-canvas'};}}catch{}}
   if(cache[k]){counts.cache++;return {...cache[k],method:'pinned-measurement-cache'};}
   counts.estimated++;
   // Bounded retention: the capture map is a debugging aid, not a leak. FIFO-evict
   // past the cap so many unique labels cannot grow the process heap without bound.
   if(!requests.has(k)){if(requests.size>=4096)requests.delete(requests.keys().next().value);requests.set(k,{text:s,size,font,weight});}
   const caps=st?.variant==='small-caps';
   let width=0;for(const g of graphemes(s)){const up=caps&&g.toUpperCase()!==g;const gs=up?size*.8:size,gc=up?g.toUpperCase():g;if(/^\s+$/u.test(gc))width+=gs*.34;else if(/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u.test(gc))width+=gs*1.08;else if(/[MW@#%&]/.test(gc))width+=gs*.9;else if(/[il.,:;!'|]/.test(gc))width+=gs*.34;else width+=gs*(font==='mono'?.64:.64);}
   return {width,ascent:size*.88,descent:size*.28,method:'estimated'};
  }
  function wrap$1(s,maxWidth,size=14,font='sans',weight=400,st=null){
   const lines=[];maxWidth=Math.max(size*2,maxWidth);
   for(const raw of String(s??'').split('\n')){const words=raw.split(/(\s+)/u);let current='';for(const token of words){if(!token)continue;const joined=current+token;if(measure$1(joined,size,font,weight,st).width<=maxWidth){current=joined;continue;}if(current.trim())lines.push(current.trimEnd());current=token.trimStart();
    if(measure$1(current,size,font,weight,st).width>maxWidth){let part='';for(const g of graphemes(current)){if(part&&measure$1(part+g,size,font,weight,st).width>maxWidth){lines.push(part);part=g;}else part+=g;}current=part;}}
    lines.push(current.trimEnd());}
   return lines.length?lines:[''];
  }
  if(typeof process!=='undefined'&&process.env?.DDN_METRICS_CAPTURE){process.on('exit',()=>{const fs=process.getBuiltinModule('node:fs'),p=process.env.DDN_METRICS_CAPTURE;let old={};try{old=JSON.parse(fs.readFileSync(p,'utf8'));}catch{}for(const[k,v]of requests)old[k]=v;fs.writeFileSync(p,JSON.stringify(old));});}
  function pending(){return [...requests.values()];}
  function clearRequests(){requests.clear();}
  /* 0.8 (chapter 04 §6A): merge a base (role/view) text-property record with an
   * override record, key by key; null/undefined bases are fine. Returns null
   * when neither side carries anything, so hot paths can skip all work. */
  function mergeSpec(base,over){if(!base&&!over)return null;const out={};for(const src of [base,over])if(src)for(const[k,v]of Object.entries(src))if(v!==undefined)out[k]=v;return Object.keys(out).length?out:null;}
  /* SVG attribute fragment for a resolved text-property record (painter side;
   * weight and fill are emitted by the caller since they already have slots). */
  function paintAttrs(spec){if(!spec)return '';let s='';if(spec.italic)s+=' font-style="italic"';if(spec.decoration==='strike')s+=' text-decoration="line-through"';if(spec.variant==='small-caps')s+=' font-variant-caps="small-caps"';return s;}
  const api$9={stats:()=>({...counts}),FONTS,ENGINE,engine:ENGINE,key,measure: measure$1,wrap: wrap$1,graphemes,setMetrics,getMetrics:()=>cache,setProvider,pending,clearRequests,mergeSpec,paintAttrs};
  publishNamespace('DDNText',api$9);

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
  const api$8={box: box$1,polygon: polygon$1,polyline,curve};
  publishNamespace('DDNSketch',api$8);

  /* SPDX-License-Identifier: GPL-2.0-or-later. Composable profile outlines with measured compartments and contour attachments. */
  const esc$2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const f=x=>Math.round(x*1000)/1000;
  const slug$1=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
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
   const labelTs=api$9.mergeSpec(p.style?.text,n.properties?.text);
   if(n.properties?.text)g.labelSpec=n.properties.text;
   const compact=['ellipse','circle','diamond','bpmevent','choreotask','groupbox','dataobject','datainput','dataoutput','caseplan','userevent','actor','terminal','parallelogram','document','store','subprocess','round','hexagon','sendpent','acceptpent','hourglass','flowfinal'].includes(g.silhouette);
   if(compact&&!n.fields.length){
    const proportion=g.silhouette==='diamond'?.60:['ellipse','circle'].includes(g.silhouette)?.68:.78;
    g.titleLines=api$9.wrap(n.name,g.w*proportion,16*s,p.style.font,labelTs?.weight??600,labelTs);
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
     row.labelLines=api$9.wrap((prefix?prefix+' ':'')+adorned,g.w-32*s,13.5*s,p.style.font,400);row.top=y;row.h=Math.max(row.h,(row.labelLines.length*18+row.detailLines.length*16+10)*s);y+=row.h;
    }
    g.fieldRows=list;g.compartments=div;g.h=Math.max(g.h,y+20*s);g.headerH=70*s;
   }
   if(n.kind==='req.requirement'){
    g.requirement=api$9.wrap(n.properties.x_diagram?.text||'',g.w-32*s,13*s,p.style.font);g.h=Math.max(g.h,(95+g.requirement.length*19)*s);
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
      row.labelLines=api$9.wrap(adorned,g.w-32*s,13.5*s,p.style.font,400);
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
    const widths=n.fields.map(f=>Math.max(60*s,api$9.measure(f.name,12*s,p.style.font,500).width+20*s));
    g.roleRow={fields:n.fields,widths};
    g.w=Math.max(g.w,widths.reduce((a,b)=>a+b,0)+24*s);
    g.h=Math.max(g.h,120*s);
    g.headerH=70*s;
   }
   /* B1-066 : DMN boxed-expression presentation — text rows in a
    * bottom compartment. Display only; the text is never parsed or evaluated. */
   if(['dmn.decision','dmn.bkm','dmn.decisionservice'].includes(n.kind)&&n.properties.x_boxed){
    const xb=n.properties.x_boxed,rows=[...(xb.text?[xb.text]:[]),...(xb.entries||[]).map(e=>(e.name?e.name+': ':'')+e.text)];
    const wrapped=rows.flatMap(r=>api$9.wrap(r,g.w-32*s,12.5*s,p.style.font,400));
    g.boxedRows=wrapped;g.boxedH=wrapped.length*18*s+(rows.length?16*s:0);
    g.h=Math.max(g.h,g.h+24*s+g.boxedH);
   }
   if(['initial','final'].includes(g.silhouette)){g.w=Math.max(125*s,api$9.measure(n.name,12*s,p.style.font,labelTs?.weight??400,labelTs).width+24*s);g.h=85*s;g.fieldRows=[];g.titleLines=[n.name];}
   /* B1-057 : pseudostate glyphs are small fixed markers with the name
    * below; states with activities/internal transitions/submachine grow a
    * compartment under the name. */
   if(['junction','choice','entrypoint','exitpoint','terminate','history','forkbar','hourglass','flowfinal'].includes(g.silhouette)){g.w=Math.max(110*s,api$9.measure(n.name,12*s,p.style.font,labelTs?.weight??400,labelTs).width+24*s);g.h=85*s;g.fieldRows=[];g.titleLines=[n.name];}
   if(n.kind==='state.state'){const x=n.properties.x_state||{};
    const acts=[...['entry','exit','do'].filter(k=>x[k]).map(k=>k+' / '+x[k]),...(x.internal||[])];
    if(acts.length||x.submachine){g.stateActs=acts;g.submachine=x.submachine;
     g.w=Math.max(g.w,220*s,...acts.map(a=>api$9.measure(a,12.5*s,p.style.font,400).width+40*s));
     g.h=Math.max(g.h,(100+acts.length*20+(x.submachine?24:0))*s);}
   }
   if(n.kind==='uml.usecase'&&n.properties.x_usecase?.extension_points?.length){g.extensionPoints=n.properties.x_usecase.extension_points;g.w=Math.max(g.w,320*s);g.h=Math.max(g.h,(110+g.extensionPoints.length*20)*s);}
   /* CMMN planning table: an expanded table attaches above its task/stage, never
    * over its body. Reserve a top band in the node's own box so layout, frames
    * and overlap inspection all account for it; render() draws the table there
    * and shifts the task body below it. */
   const xp=n.properties.x_planning;
   if(xp?.items?.length){
    const pw=Math.max(g.w,Math.max(...xp.items.map(it=>api$9.measure(it,10.5*s,p.style.font,400).width))+24*s),ph=xp.items.length*16*s+24*s;
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
    case 'bpmevent':return {cx,cy:y+h/2-10*s,r:16*s};
    case 'userevent':return {cx,cy:y+h/2-8,r:15*s};
    case 'flowfinal':return {cx,cy:y+h/2-8,r:11*s};
    case 'junction':return {cx,cy:y+h/2-8,r:7*s};
    case 'entrypoint':case 'exitpoint':return {cx,cy:y+h/2-8,r:9*s};
    case 'history':return {cx,cy:y+h/2-8,r:12*s};
    case 'choice':return {cx,cy:y+h/2-8,r:12*s,diamond:true};
    case 'terminate':return {cx,cy:y+h/2-8,r:8*s};
    case 'hourglass':return {cx,cy:y+h/2,hw:Math.min(w/2,26*s),hh:Math.min(h/2,20*s)};
   }
   return null;
  }
  function polygon(g){const{x,y,w,h,silhouette:t}=g;
   if(['initial','final'].includes(t)){const ps=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;ps.push([x+w/2+12*g.scale*Math.cos(a),y+h/2-8*g.scale+12*g.scale*Math.sin(a)]);}return ps;}
   const mk=markerOutline(g);
   if(mk){
    if(mk.diamond)return [[mk.cx,mk.cy-mk.r],[mk.cx+mk.r,mk.cy],[mk.cx,mk.cy+mk.r],[mk.cx-mk.r,mk.cy]];
    if(mk.r!=null){const ps=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;ps.push([mk.cx+mk.r*Math.cos(a),mk.cy+mk.r*Math.sin(a)]);}return ps;}
    return [[mk.cx-mk.hw,mk.cy-mk.hh],[mk.cx+mk.hw,mk.cy-mk.hh],[mk.cx+mk.hw,mk.cy+mk.hh],[mk.cx-mk.hw,mk.cy+mk.hh]];
   }
   if(t==='offpage')return [[x,y],[x+w,y],[x+w,y+h*.7],[x+w/2,y+h],[x,y+h*.7]];
   if(t==='sendpent')return [[x,y],[x+w*.82,y],[x+w,y+h/2],[x+w*.82,y+h],[x,y+h]];
   if(t==='acceptpent')return [[x,y],[x+w,y],[x+w*.82,y+h/2],[x+w,y+h],[x,y+h],[x+w*.18,y+h/2]];
   if(t==='diamond')return [[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
   if(t==='hexagon')return [[x+w*.25,y],[x+w*.75,y],[x+w,y+h/2],[x+w*.75,y+h],[x+w*.25,y+h],[x,y+h/2]];
   if(t==='manualinput')return [[x,y+h*.35],[x+w,y],[x+w,y+h],[x,y+h]];
   if(t==='manualop')return [[x,y],[x+w,y],[x+w*.84,y+h],[x+w*.16,y+h]];
   if(t==='burst'){const ps=[],cx=x+w/2,cy=y+h/2;for(let i=0;i<16;i++){const a=i/16*Math.PI*2-Math.PI/2,r=i%2?Math.min(w,h)*.22:Math.min(w,h)*.48;ps.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}return ps;}
  if(t==='triangledown')return [[x,y],[x+w,y],[x+w/2,y+h]];
   if(t==='triangleup')return [[x+w/2,y],[x+w,y+h],[x,y+h]];
   if(t==='card')return [[x+12*g.scale,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y+12*g.scale]];
   if(t==='parallelogram')return [[x+w*.16,y],[x+w,y],[x+w*.84,y+h],[x,y+h]];
   if(t==='package')return [[x,y],[x+w*.43,y],[x+w*.49,y+20],[x+w,y+20],[x+w,y+h],[x,y+h]];
   if(t==='document'){const ps=[[x,y],[x+w,y],[x+w,y+h-14]];for(let i=1;i<=24;i++){const t=i/24;ps.push([x+w*(1-t),y+h-14+12*Math.sin(t*Math.PI*2)]);}return ps;}
   if(t==='actor'){const z=g.scale,cx=x+w/2;return [[cx,y+9*z],[cx+14*z,y+23*z],[cx+14*z,y+40*z],[cx+32*z,y+59*z],[cx+3*z,y+70*z],[cx+28*z,y+127*z],[cx,y+100*z],[cx-28*z,y+127*z],[cx-3*z,y+70*z],[cx-32*z,y+59*z],[cx-14*z,y+40*z],[cx-14*z,y+23*z]];}
   if(['ellipse','circle','collab'].includes(t)){const ps=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;ps.push([x+w/2+Math.cos(a)*w/2,y+h/2+Math.sin(a)*h/2]);}return ps;}
   return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
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
     else {px=Math.max(mk.cx-mk.r*.9,Math.min(mk.cx+mk.r*.9,px));py=mk.cy+(side==='south'?1:-1)*mk.r*(1-Math.abs(px-mk.cx)/mk.r);}
    }else if(mk.r!=null){
     if(side==='east'||side==='west'){py=Math.max(mk.cy-.94*mk.r,Math.min(mk.cy+.94*mk.r,py));const dy=Math.abs((py-mk.cy)/mk.r);px=mk.cx+(side==='east'?1:-1)*mk.r*Math.sqrt(1-dy*dy);}
     else {px=Math.max(mk.cx-.94*mk.r,Math.min(mk.cx+.94*mk.r,px));const dx=Math.abs((px-mk.cx)/mk.r);py=mk.cy+(side==='south'?1:-1)*mk.r*Math.sqrt(1-dx*dx);}
    }else {
     px=side==='east'?mk.cx+mk.hw:side==='west'?mk.cx-mk.hw:Math.max(mk.cx-mk.hw,Math.min(mk.cx+mk.hw,px));
     py=side==='south'?mk.cy+mk.hh:side==='north'?mk.cy-mk.hh:Math.max(mk.cy-mk.hh,Math.min(mk.cy+mk.hh,py));
    }
    return [f(px),f(py)];
   }
   if(['ellipse','circle','collab'].includes(t)){
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
  function render$2(g,p,theme){
   let planning=null;
   if(g.planningH){planning={x:g.x,y:g.y,w:g.w,h:g.planningH-8*g.scale,items:g.n.properties.x_planning.items};g={...g,y:g.y+g.planningH,h:g.h-g.planningH};}
   let {n,k,x,y,w,h}=g;const s=g.scale,look=p.style.look,shape=g.silhouette,mono=p.style.theme==='neutral'||p.theme08==='mono_print',monoPrint=p.theme08==='mono_print',nc=api$a.node(k,theme),fg=monoPrint?'#000000':nc.text;
   /* 0.8 (chapter 04 §6B): portable element outline/fill on profile
    * silhouettes — color and fill ride the shared palette channels (ink/fill);
    * weight and dash are plain-card-silhouette properties this revision
    * (silhouette paint strings bake their registered widths). Monochrome
    * themes keep their B/W contract. */
   let ink=monoPrint?'#000000':mono?'#333333':nc.ink,fill=monoPrint?'#FFFFFF':mono?'#FAFAFA':nc.fill;
   if(!mono&&!monoPrint){const st=n.properties?.stroke;if(st?.color)ink=st.color;if(n.properties?.fill)fill=n.properties.fill;}
   const opt={...p.style,id:n.id,stroke:ink,fill,width:1.8};
   const line=(x1,y1,x2,y2,width=1)=>look==='handDrawn'?api$8.polyline([[x1,y1],[x2,y2]],{...opt,id:n.id+':line:'+x1+':'+y1,width,hachure:false}):`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" fill="none" stroke="${ink}" stroke-width="${width}"/>`;
   /* B1-074 : shapes-detail (thumbnails) suppresses every text run. */
   const shapesOnly=p.detail==='shapes';
   /* 0.8 (chapter 04 §6A): view-wide style.text decorates every painted run;
    * the element's own text { } decorates its name/title lines only. With no
    * text properties the output is byte-identical to before. */
   const viewTs=p.style.text||null;
   const labelTs=g.labelSpec?api$9.mergeSpec(viewTs,g.labelSpec):null;
   const labelSet=labelTs?new Set([n.name,...(g.titleLines||[])]):null;
   const text=(xx,yy,txt,size=13,weight=400,extra='')=>{if(shapesOnly)return '';const ts=labelSet?.has(txt)?labelTs:viewTs;const w=ts?.weight??weight,fil=ts?.color??fg;api$9.measure(txt,size*s,p.style.font,w,ts);return `<text x="${f(xx)}" y="${f(yy)}" font-size="${size*s}" fill="${fil}" font-weight="${w}"${ts?api$9.paintAttrs(ts):''} ${extra}>${esc$2(txt)}</text>`;};
   const lines=(ls,xx,yy,size=16,weight=600,extra='text-anchor="middle"')=>ls.map((v,i)=>text(xx,yy+i*(size+5)*s,v,size,weight,extra)).join('');
   /* 0.8 (chapter 04 §6C): per-element opacity — one group opacity over the
    * whole silhouette, same contract as the plain card path. */
   const elOp=n.properties?.opacity;
   let out=`<g class="ddn-node ddn-kind-${slug$1(k.code)}" data-id="${esc$2(n.id)}" data-ddn-id="${esc$2(n.id)}" data-shape="${esc$2(shape)}"${elOp!==undefined&&elOp<1?` opacity="${elOp}"`:''} tabindex="0" role="group" aria-label="${esc$2(n.name)}"><title>${esc$2(n.name+' — '+k.name)}</title>`;
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
    else {out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="1.8"${dash}/>`;
     if(pos==='intermediate')out+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r-3.5*s)}" fill="none" stroke="${ink}" stroke-width="1.4"${dash}/>`;}
    out+=`<g class="ddn-trigger" data-trigger="${esc$2(xe.type||'none')}">`+triggerIcon(xe.type||'none',cx,cy,r-4*s,ink)+'</g>';
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
     for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc$2(r.id)}">`+lines(r.labelLines,x+w/2,y+r.top+18*s,12.5,400)+'</g>';}
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
    else {out+=line(x+w,y,x,y,2)+line(x,y,x,y+h,2)+line(x,y+h,x+w,y+h,2)+line(x+35*s,y,x+35*s,y+h,1);out+=text(x+17*s,y+h/2+5*s,n.properties.x_diagram?.number||'D',12,600,'text-anchor="middle"');}
   }else if(look==='handDrawn'){
    out+=['round','terminal'].includes(shape)?api$8.box(x,y,w,h,{...opt,radius:shape==='terminal'?h/2:14*s}):api$8.polygon(polygon(g),opt);
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
    for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc$2(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,'')+lines(r.detailLines,x+16*s,y+r.top+r.labelLines.length*18*s+17*s,11.5,400,'')+'</g>';
   }else if(['uml.class','uml.interface','uml.enumeration','uml.metaclass','uml.stereotype'].includes(n.kind)){
    out+=text(x+w/2,y+20*s,{['uml.interface']:'«interface»','uml.enumeration':'«enumeration»','uml.metaclass':'«metaclass»','uml.stereotype':'«stereotype»'}[n.kind]||'«class»',11,500,'text-anchor="middle"')+lines(g.titleLines,x+w/2,y+45*s,16,650);
    for(const c of g.compartments||[])out+=line(x,y+c.top,x+w,y+c.top)+text(x+13*s,y+c.top+17*s,c.label,10,500);
    for(const r of g.fieldRows){const m=r.field.properties.x_member||{},extra=`${m.static?'text-decoration="underline"':''} ${m.abstract?'font-style="italic"':''}`;out+=`<g class="ddn-field" data-member="${esc$2(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,extra)+lines(r.detailLines,x+16*s,y+r.top+r.labelLines.length*18*s+17*s,11.5,400,'')+'</g>';}
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
     out+=`<rect data-role="${esc$2(rf.id)}" x="${f(rx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" fill="${fill}" stroke="${ink}" stroke-width="1.5"/>`+text(rx+bw/2,by+16*s,rf.name,12,500,'text-anchor="middle"');
     rx+=bw;
    }
    if(g.roleRow.fields.some(rf=>rf.properties.x_role?.mandatory))out+=`<circle data-mandatory="true" cx="${f(x+5*s)}" cy="${f(y+50*s)}" r="${f(3.5*s)}" fill="${ink}"/>`;
   }else if(g.fieldRows.length){
    out+=lines(g.titleLines,x+16*s,y+31*s,16,600,'')+line(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s);for(const r of g.fieldRows)out+=`<g class="ddn-field" data-member="${esc$2(r.id)}">`+lines(r.labelLines,x+16*s,y+r.top+18*s,13.5,400,'')+'</g>';
   }else {
    let yy=y+h/2-(g.titleLines.length-1)*10.5*s+5*s;if(shape==='package')yy+=10*s;
    /* B1-085: contact/coil names sit above the glyph, not at node centre. */
    if(['ladder.contact','ladder.coil'].includes(n.kind))yy=y+17*s;
    /* A sentry criterion shows its if-part condition at the diamond centre; an
     * unnamed (id-labelled) sentry would otherwise print its id on top of it. */
    const sentryCriterion=n.kind==='cmmn.sentry'&&n.properties.x_sentry?.if_part;
    if(!sentryCriterion)out+=lines(g.titleLines,x+w/2+(shape==='store'&&p.projection.profile!=='dfd.yourdon@1'?12*s:0),yy,16,600,n.properties.key||n.properties.x_chen?.key?'text-anchor="middle" text-decoration="underline"':'text-anchor="middle"');
   }
   if(n.properties.x_chen?.partial_key){const tw=Math.min(w*.8,api$9.measure(n.name,16*s,p.style.font,600).width);out+=`<path d="M${x+w/2-tw/2} ${y+h/2+11*s}h${tw}" stroke="${ink}" fill="none" stroke-dasharray="4 3"/>`;}
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
    out+=`<g class="ddn-gateway" data-gateway="${esc$2(xg.type)}">`+(G[xg.type]||'')+'</g>';
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
    const pw=Math.max(...params.map(v=>api$9.measure(v,11*s,p.style.font,400).width))+18*s,ph=params.length*15*s+10*s,px=x+w-pw/2,py=y-ph/2;
    out+=`<g class="ddn-template" data-template="${esc$2(params.join(','))}"><rect x="${f(px)}" y="${f(py)}" width="${f(pw)}" height="${f(ph)}" fill="${fill}" stroke="${ink}" stroke-width="1.2" stroke-dasharray="5 3"/>`+params.map((v,i)=>text(px+9*s,py+16*s+i*15*s,v,11,400)).join('')+'</g>';}
   return out+'</g>';
  }
  const api$7={VERSION:'0.8.0',measure,render: render$2,anchor,polygon,shapeOf,segmentInterior};
  publishNamespace('DDNShapes',api$7);

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * DDN 0.3 deterministic native layout and obstacle-aware orthogonal routing.
   * Bounded search is deliberate: infeasibility produces a diagnostic, never an invisible topology change.
   */
  const VERSION$4='0.8.0',EPS=.01;
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
   /* DDN200: the authored gap/row_gap IS the inter-element gap (floor 20px).
    * object/edge/port clearances govern routing pads and port fan-out stubs
    * (routingAttempt), never node spacing. */
   const p=profiles.layout,diag=[];const authoredGap=q$3(p.gap,64),authoredRowGap=q$3(p.row_gap,64);if(authoredGap<20||authoredRowGap<20)throw new ErrorClass('DDN200','Automatic gaps must be at least 20px');let gap=authoredGap,rowGap=authoredRowGap;
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
    const pred=new Map(nodes.map(n=>[n.id,[]])),succ=new Map(nodes.map(n=>[n.id,[]]));edges.forEach(e=>{pred.get(e.to.element).push(e.from.element);succ.get(e.from.element).push(e.to.element);});
    /* Two-sided Sugiyama sweeps: alternate predecessor and successor barycenter
     * passes, keep the ordering with the fewest crossings between adjacent
     * ranks. Bounded iterations, deterministic tie-breaks on declaration order. */
    const layerCrossings=()=>{let c=0;
     for(let i=0;i<layers.length-1;i++){const up=new Map(layers[i].map((n,j)=>[n.id,j])),down=new Map(layers[i+1].map((n,j)=>[n.id,j]));
      const es=edges.filter(e=>up.has(e.from.element)&&down.has(e.to.element));
      for(let a=0;a<es.length;a++)for(let b=a+1;b<es.length;b++)if((up.get(es[a].from.element)-up.get(es[b].from.element))*(down.get(es[a].to.element)-down.get(es[b].to.element))<0)c++;}
     return c;};
    const sweep=(peer,range)=>{for(const i of range){const pos=new Map(layers[i+(peer===pred?-1:1)].map((n,j)=>[n.id,j]));const bary=n=>{const ps=peer.get(n.id).filter(id=>pos.has(id));return ps.length?ps.reduce((s,id)=>s+pos.get(id),0)/ps.length:order.get(n.id);};layers[i].sort((a,b)=>bary(a)-bary(b)||order.get(a.id)-order.get(b.id));}};
    const forward=[],backward=[];for(let i=1;i<layers.length;i++)forward.push(i);for(let i=layers.length-2;i>=0;i--)backward.push(i);
    let bestC=layerCrossings(),bestOrder=layers.map(l=>l.map(n=>n.id));
    for(let it=0;it<8&&bestC>0;it++){
     sweep(pred,forward);sweep(succ,backward);
     const c=layerCrossings();
     if(c<bestC){bestC=c;bestOrder=layers.map(l=>l.map(n=>n.id));}else break;
    }
    layers.forEach((l,i)=>{const at=new Map(bestOrder[i].map((id,j)=>[id,j]));l.sort((a,b)=>at.get(a.id)-at.get(b.id));});
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
   }else if(p.algorithm==='ladder'){
    /* B1-085: IEC 61131-3 rung layout. One data block per rung (declaration
     * order, top to bottom); series wiring forms a left-to-right DAG; parallel
     * OR branches fall out of shared junctions as extra tracks; coils, jumps
     * and returns hug the right rail, labels the left. */
    const RIGHT=['ladder.coil','ladder.jump','ladder.return'];
    const rungOf=n=>String(n.n?.ref??n.id).split('::').pop().split('.')[0];
    const rungs=[],byRung=new Map();
    for(const n of nodes){const k=rungOf(n);if(!byRung.has(k)){byRung.set(k,[]);rungs.push(k);}byRung.get(k).push(n);}
    let rungY=0;
    for(const rk of rungs){
     const ns=byRung.get(rk),member=new Set(ns.map(n=>n.id));
     const es=edges.filter(e=>e.kind==='ladder.series'&&member.has(e.from.element)&&member.has(e.to.element));
     const pred=new Map(ns.map(n=>[n.id,[]]));
     for(const e of es)pred.get(e.to.element).push(e.from.element);
     const col=new Map(ns.map(n=>[n.id,0]));
     for(let pass=0;pass<=ns.length;pass++){let moved=false;
      for(const e of es){const c=col.get(e.from.element)+1;if(c>col.get(e.to.element)){col.set(e.to.element,c);moved=true;}}
      if(!moved)break;}
     if(ns.some(n=>col.get(n.id)>ns.length)){diag.push({code:'DDN-LW02',severity:'info',message:'Ladder rung '+rk+' contains a series cycle; column assignment is approximate.'});for(const n of ns)if(col.get(n.id)>ns.length)col.set(n.id,0);}
     Math.max(0,...ns.map(n=>col.get(n.id)));
     for(const n of ns)if(n.n?.kind==='ladder.label')col.set(n.id,-1);
     for(const n of ns)if(RIGHT.includes(n.n?.kind))col.set(n.id,Math.max(...ns.map(m=>m.n?.kind==='ladder.label'?-1:col.get(m.id)),0));
     const minCol=ns.some(n=>n.n?.kind==='ladder.label')?-1:0;
     const track=new Map();
     for(let c=minCol;c<=Math.max(...ns.map(n=>col.get(n.id)));c++){
      const layer=ns.filter(n=>col.get(n.id)===c).sort((a,b)=>{
       const bary=x=>pred.get(x.id).length?pred.get(x.id).reduce((t,id)=>t+(track.get(id)??0),0)/pred.get(x.id).length:order.get(x.id)%7;
       return bary(a)-bary(b)||order.get(a.id)-order.get(b.id);});
      layer.forEach((n,i)=>track.set(n.id,i));
     }
     const trackCount=Math.max(1,...ns.map(n=>track.get(n.id)+1));
     const colW=maxOf(ns,n=>n.w,90)+gap,rowH=maxOf(ns,n=>n.h,60)+Math.round(rowGap*.6);
     for(const n of ns){n.x=(col.get(n.id)-minCol)*colW;n.y=rungY+track.get(n.id)*rowH;}
     rungY+=trackCount*rowH;
    }
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
  /* B1-101 slice 3: presentation art geometry, shared by render (drawing the
   * illustration) and routing (pinning endpoints to its declared anchors). The
   * art box is the node interior below the header; the viewBox scales to fit,
   * centred. Anchors are declared in viewBox coordinates by the art pack. */
  function artBox(n){const s=n.scale||1,hh=n.headerH||64*s,pad=10*s;return {x:n.x+pad,y:n.y+hh+4*s,w:Math.max(8,n.w-2*pad),h:Math.max(8,n.h-hh-14*s)};}
  function artTransform(n){const art=n._art;if(!art)return null;const b=artBox(n),fit=Math.min(b.w/art.vbW,b.h/art.vbH),w=art.vbW*fit,h=art.vbH*fit;return {x:b.x+(b.w-w)/2,y:b.y+(b.h-h)/2,scale:fit,w,h};}
  function artAnchorPoint(n,name){const t=artTransform(n),pt=n._art?.anchors?.[name];return t&&pt?[round(t.x+pt[0]*t.scale),round(t.y+pt[1]*t.scale)]:null;}
  function artAnchorSide(n,name){const art=n._art;if(!art?.anchors?.[name])return null;
   if(['north','east','south','west'].includes(name))return name;
   const [ax,ay]=art.anchors[name],d={west:ax,east:art.vbW-ax,north:ay,south:art.vbH-ay};
   return Object.entries(d).sort((a,b)=>a[1]-b[1])[0][0];}
  function portAssignments(nodes,rels,profiles,hints={}){
   const byId=new Map(nodes.map(n=>[n.id,n])),groups=new Map(),result=new Map();
   const optimize=profiles.layout.endpoint_ordering!=='preserve'&&profiles.layout.optimize!=='none';
   const directions={east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]};
   const portOf=(n,ep)=>n.n?.ports?.find(f=>f.id===ep.member);
   for(const r of rels){const a=byId.get(r.from.element),b=byId.get(r.to.element),hint=hints[r.id]||{};
    let ss=hint.source_side||portOf(a,r.from)?.properties?.side,ts=hint.target_side||portOf(b,r.to)?.properties?.side;
    /* B1-100: the mindmap algorithm owns its attachment rule — branches leave
     * only the left or right side of an entity (root branches from both),
     * never the top or bottom edge. When several relations share one side they
     * fan from a tight cluster centred on that side's vertical centre, so the
     * side presents one connection point. */
    const mindBody=profiles.layout.algorithm==='mindmap'&&!r.from.member&&!r.to.member;
    if(mindBody&&a!==b){const dx=b.x+b.w/2-a.x-a.w/2;ss=hint.source_side||(dx>=0?'east':'west');ts=hint.target_side||(dx>=0?'west':'east');}
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
     /* B1-101 slice 3: art anchors pin endpoints onto the illustration. A
      * member endpoint naming an anchor snaps to it; a lone body endpoint on a
      * side with a declared anchor lands exactly on the anchor point. */
     if(n._art){
      const memberAnchor=ep.member?String(ep.member).split('.').pop().replace(/_/g,'-'):null;
      const named=memberAnchor&&n._art.anchors[memberAnchor]?memberAnchor:null;
      const pt=named?artAnchorPoint(n,named):(!row&&frac===undefined&&entries.length===1?artAnchorPoint(n,side):null);
      if(pt){item[which]=pt;item[which+'_direction']=directions[named?artAnchorSide(n,named)||side:side];return;}
     }
     /* B1-100: mind-map side anchors cluster on the side's vertical centre —
      * one branch exactly at the centre, a fan clustered ± a few pixels around
      * it (within the stroke's visual width, so the side reads as one point)
      * rather than spread down the whole edge. */
     const mindCentre=profiles.layout.algorithm==='mindmap'&&!row&&frac===undefined;
     if(side==='east'||side==='west'){x=side==='east'?n.x+n.w:n.x;y=n.y+(row?row.top+(index+1)*row.h/(entries.length+1):frac!==undefined?frac*n.h:mindCentre?n.h/2+(index-(entries.length-1)/2)*Math.max(12,q$3(profiles.layout.edge_clearance,12)):(index+1)*n.h/(entries.length+1));}
     else {y=side==='south'?n.y+n.h:n.y;x=n.x+(frac!==undefined?frac*n.w:(index+1)*n.w/(entries.length+1));}
     item[which]=api$7.anchor(n,side,[round(x),round(y)]);item[which+'_direction']=directions[side];
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
   for(const r of rels)if(['straight','string'].includes(hints[r.id]?.routing||p.routing)){const ep=assignments.get(r.id);reservations.push({id:r.id+':reserved:direct',owner:r.id,points:[ep.source,ep.target]});}
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
    for(const [j,s]of stubs.entries()){const own=j?ownB:ownA;/* B1-063/064: boundary-attached nodes sit on their host's corridor by design. */if(nodes.some(n=>n.id!==own.id&&!(n.x_boundaryOf===own.id||own.x_boundaryOf===n.id)&&segmentBox(s,box(n,clear))))throw new ErrorClass('DDN212','Endpoint clearance conflicts with another object: '+r.id);}
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
    if(!points&&['straight','string'].includes(hint.routing||p.routing)){
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
   if(quality.labelIssues.length&&p.quality!=='warn')throw new ErrorClass('DDN218',quality.labelIssues[0]);
   for(const message of quality.labelIssues)diagnostics.push({code:'DDN-LW09',severity:'warning',message});
   return {routes,crossings,labels,diagnostics,quality};
  }
  function routing(nodes,rels,profiles,hints={},labelMeasure,ErrorClass=Error,extraObstacles=[]){
   const degree=new Map();for(const r of rels)for(const e of [r.from,r.to])degree.set(e.element,(degree.get(e.element)||0)+1);
   const distance=r=>{const a=nodes.find(n=>n.id===r.from.element),b=nodes.find(n=>n.id===r.to.element);return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);};
   const orders=[rels,[...rels].sort((a,b)=>(degree.get(b.from.element)+degree.get(b.to.element))-(degree.get(a.from.element)+degree.get(a.to.element))||distance(b)-distance(a)||a.id.localeCompare(b.id)),[...rels].reverse(),[...rels].sort((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id))];
   /* Every feasible deterministic ordering is evaluated for small and medium
    * graphs, then the best drawing wins on (crossings, bends, length) with the
    * ordering index as the final tie-break. A zero-crossing ordering is
    * unbeatable, so the search stops there. Large graphs (>96 relations) keep
    * the historical first-feasible selection: a full extra routing pass per
    * ordering is not bounded cheaply at that size. Scoring happens before the
    * curved pass: all four orderings share that pass, and curve-specific checks
    * (B1-100 side rules, tension) belong to its own candidates. */
   const score=r=>({crossings:r.crossings.length,bends:r.routes.reduce((n,rt)=>n+Math.max(0,rt.points.length-2),0),length:r.routes.reduce((n,rt)=>n+segs(rt.points).reduce((m,s)=>m+length(s),0),0)});
   const better=(a,b)=>!b||a.crossings<b.crossings||a.crossings===b.crossings&&(a.bends<b.bends||a.bends===b.bends&&a.length<b.length-EPS);
   const wantsCurved=rels.some(r=>['curved'].includes(hints[r.id]?.routing||profiles.layout.routing));
   const FIRST=rels.length>96;
   let best=null,bestScore=null,bestAttempt=-1,last;const failures=[],candidates=[];
   for(let attempt=0;attempt<orders.length;attempt++)try{
    const r=routingAttempt(nodes,orders[attempt],profiles,hints,labelMeasure,ErrorClass,extraObstacles),s=score(r);
    // Curved routing checks each relation against the other orderings' final
    // curves, so its pass runs once the orthogonal winner is known; when the
    // winner cannot be curved safely the next-best ordering takes its place.
    if(wantsCurved){candidates.push({r,s,attempt});if(!FIRST&&!s.crossings)break;}
    else {const checked=curvedRouting(r,nodes,profiles,hints,ErrorClass,extraObstacles);if(FIRST){best=checked;bestAttempt=attempt;break;}if(better(s,bestScore)){best=checked;bestScore=s;bestAttempt=attempt;if(!s.crossings)break;}}
   }catch(e){if(!['DDN212','DDN215','DDN216','DDN217','DDN218','DDN220','DDN221'].includes(e.code))throw e;last=e;failures.push({strategy:attempt,code:e.code,message:e.message});}
   if(wantsCurved){
    if(FIRST)candidates.sort((a,b)=>a.attempt-b.attempt);else candidates.sort((a,b)=>better(a.s,b.s)?-1:better(b.s,a.s)?1:a.attempt-b.attempt);
    for(const c of candidates)try{best=curvedRouting(c.r,nodes,profiles,hints,ErrorClass,extraObstacles);bestAttempt=c.attempt;break;}catch(e){if(!['DDN220','DDN221'].includes(e.code))throw e;last=e;failures.push({strategy:c.attempt,code:e.code,message:e.message});}
   }
   if(best){best.strategy=bestAttempt;if(bestAttempt)best.diagnostics.push({code:'DDN-LW04',severity:'info',message:'Deterministic congestion retry selected routing strategy '+bestAttempt});return best;}
   last.attempts=failures;throw last;
  }
  function inspect(nodes,routes,labels=[],routeRecs=null){const errors=[],overlaps=[],through=[],shared=[],masking=[],labelPairs=[],labelNodes=[];
   const recs=routeRecs||routes.map(r=>routeSegRecs(r.points)),nodeBoxes=nodes.map(n=>box(n,1)),labelBoxes=labels.map(l=>box(l,2));
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){if(!overlap(nodes[i],nodes[j]))continue; /* B1-063: a boundary event attached to its host's border is not an overlap. */ if(nodes[i].x_boundaryOf===nodes[j].id||nodes[j].x_boundaryOf===nodes[i].id)continue; overlaps.push([nodes[i].id,nodes[j].id]);}
   for(let i=0;i<routes.length;i++){const r=routes[i];for(const s of recs[i])for(let k=0;k<nodes.length;k++){const n=nodes[k];if(n.id===r.r?.from.element||n.id===r.r?.to.element)continue;const b=nodeBoxes[k];if(s.maxx<=b.x+EPS||s.minx>=b.x+b.w-EPS||s.maxy<=b.y+EPS||s.miny>=b.y+b.h-EPS)continue;if(segHitsBox(s.ax,s.ay,s.bx,s.by,b))through.push([r.id,n.id]);}}
   for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)if(recs[i].some(s=>recs[j].some(t=>collinearRec(s,t,.1))))shared.push([routes[i].id,routes[j].id]);
   for(let li=0;li<labels.length;li++)for(let i=0;i<routes.length;i++)if(labels[li].id!==routes[i].id&&recs[i].some(s=>segHitsBox(s.ax,s.ay,s.bx,s.by,labelBoxes[li])))masking.push([labels[li].id,routes[i].id]);
   /* Label collisions (DDN-LW09 family): relationship labels, reference numerals
    * and callout badges must never overlap each other or crowd unrelated
    * geometry. Placement already avoids these with margins wherever a bounded
    * search admits it; anything left here is a defect worth a diagnostic. A
    * label may still sit beside (mind maps: on) its own two endpoint nodes. */
   const labelRoute=new Map(routes.map(r=>[r.id,r]));
   for(let i=0;i<labels.length;i++){
    for(let j=i+1;j<labels.length;j++)if(overlap(labels[i],labels[j]))labelPairs.push([labels[i].id,labels[j].id]);
    const lr=labelRoute.get(labels[i].id);
    for(let k=0;k<nodes.length;k++){if(lr&&(nodes[k].id===lr.r?.from.element||nodes[k].id===lr.r?.to.element))continue;
     if(overlap(labels[i],nodes[k]))labelNodes.push([labels[i].id,nodes[k].id]);}
   }
   const labelIssues=[];
   if(labelPairs.length)labelIssues.push(labelPairs.length+' colliding relationship label pairs');
   if(labelNodes.length)labelIssues.push(labelNodes.length+' relationship labels overlap unrelated objects');
   if(overlaps.length)errors.push(overlaps.length+' overlapping object pairs');if(through.length)errors.push(through.length+' unrelated route/object intersections');if(shared.length)errors.push(shared.length+' independent collinear relation pairs');if(masking.length)errors.push(masking.length+' labels mask unrelated routes');
   return {errors,labelIssues,objectOverlaps:overlaps,routeObjectIntersections:through,sharedTracks:shared,labelRouteIntersections:masking,labelPairs,labelNodes};}
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
    for(const n of [...nodes,...extraObstacles]){const owner=n.id===own.r.from.element||n.id===own.r.to.element,pad=owner?-0.3:Math.max(3,q$3(p.object_clearance,16)*.7);if(segments.some(s=>owner&&n.silhouette&&api$7.segmentInterior?api$7.segmentInterior(s,n):segmentBox(s,box(n,pad))))return false;}
    for(let j=0;j<routes.length;j++)if(j!==index){const other=routes[j];if(segments.some(s=>segmentBox(s,box(other.label.bounds,labelMargin))))return false;
     const ts=routeSegments(other);if(segments.some(s=>ts.some(t=>generalCollinear(s,t,.22))))return false;
     for(const s of segments)for(const t of ts){const hit=lineIntersection(s,t);if(hit&&hit.sine<.22)return false;}
    }return true;
   }
   function label(candidate,index){const size=routes[index].label,old=[size.x,size.y],len=candidate.arc.length,samples=[.5,.4,.6,.3,.7,.2,.8,.1,.9,...Array.from({length:80},(_,i)=>(i+1)/81)],positions=[];
   if(routeSegments(candidate).some(s=>distancePointSegment(old,s)<.15))positions.push(old);
   positions.push(...samples.map(t=>curvePointAt(candidate,len*t).point));
   for(const pt of positions){const[x,y]=pt,rect={x:x-size.w/2,y:y-size.h/2,w:size.w,h:size.h};/* B1-100: mind-map branches are short by nature (fan-out from one anchor);
    * the long-endpoint label clearance makes every position illegal. A branch
    * label near its anchor still reads perfectly in a mind map. */
   const endClear=p.algorithm==='mindmap'?Math.max(size.h,10)/2+6:Math.max(size.w,size.h)/2+20;
   if(Math.min(Math.hypot(x-candidate.points[0][0],y-candidate.points[0][1]),Math.hypot(x-candidate.points.at(-1)[0],y-candidate.points.at(-1)[1]))<endClear){continue;}
   /* B1-100: a mind-map branch label may sit on the edge of its own two
    * entities — the standard mind-map reading (the corridor between fan-out
    * neighbours is narrower than any label). Unrelated nodes still reject. */
   const ownNode=n=>p.algorithm==='mindmap'&&(n.id===routes[index].r.from.element||n.id===routes[index].r.to.element);
   const nodeHit=[...nodes,...extraObstacles].find(n=>!ownNode(n)&&overlap(rect,n,labelMargin));if(nodeHit){continue;}

   if(routes.some((r,j)=>j!==index&&(overlap(rect,r.label.bounds,labelMargin)||routeSegments(r).some(s=>segmentBox(s,box(rect,labelRouteMargin))))))continue;
   if(previewCurves.some((pts,j)=>j>index&&pts&&segs(pts).some(s=>segmentBox(s,box(rect,labelRouteMargin)))))continue;
   return {...size,x:round(x),y:round(y),bounds:{...rect,x:round(rect.x),y:round(rect.y)},explicit:false};}return null;}
   for(let i=0;i<routes.length;i++){const r=routes[i];if(r.routing!=='curved')continue;const mode=hints[r.id]?.curve||p.curve||'bezier',radius=q$3(hints[r.id]?.curve_radius??p.curve_radius,32),tension=hints[r.id]?.curve_tension??p.curve_tension??.5,candidates=[];
   if(mode==='bezier'&&!hints[r.id]?.via&&r.r.from.element!==r.r.to.element){const a=r.points[0],b=r.points.at(-1),sd=dirs[r.source_side],td=dirs[r.target_side],major=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])),handle=Math.max(24,major*tension);
    for(const t of [1,.75,.5])candidates.push({strategy:'direct-bezier',appliedTension:tension*t,commands:[{kind:'cubic',from:a,c1:[a[0]+sd[0]*handle*t,a[1]+sd[1]*handle*t],c2:[b[0]+td[0]*handle*t,b[1]+td[1]*handle*t],to:b}]});}
   for(const rad of [mode==='bezier'?Math.max(radius,70):radius,radius,16,8,4,2,1].filter((x,i,a)=>x>0&&a.indexOf(x)===i))candidates.push({strategy:'corridor-spline',commands:roundedCommands(r.points,rad),radius:rad});
   let selected=null;for(const candidate of candidates){const arc=flattenCurve(candidate.commands),test={...r,...candidate,arc,points:arc.points};const safeOk=safe(test,i);if(!safeOk)continue;const nextLabel=label(test,i);if(nextLabel){selected={...test,label:nextLabel,hint:{...r.hint,callout:[nextLabel.x,nextLabel.y]}};break;}}
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
   if(quality.labelIssues.length&&p.quality!=='warn')throw new ErrorClass('DDN221',quality.labelIssues[0]);
   for(const message of quality.labelIssues)result.diagnostics.push({code:'DDN-LW09',severity:'warning',message});
   return {...result,routes,crossings,labels,quality,curveTolerance:CURVE_TOLERANCE};
  }

  const api$6={crossingBridge,curvedRouting,flattenCurve,pathData,curvePieces,curveDirection,curveSplit,curveSlice,roundedCommands,lineIntersection,routeCrossings,generalCollinear,CURVE_TOLERANCE,VERSION: VERSION$4,q: q$3,round,overlap,box,segmentBox,segs,cross,collinear,distancePointSegment,simplify,layoutNodes,portAssignments,routing,inspect,SPACING,spacingScale,artBox,artTransform,artAnchorPoint,artAnchorSide};
  publishNamespace('DDNLayout',api$6);

  /* SPDX-License-Identifier: GPL-2.0-or-later
   * Consolidated 0.3 placement orchestration. Keeps the 0.3 native router, text,
   * publication and export checks; imports only pin-pattern geometry from Live.
   */
  const Patterns=namespace('DDNPinPlacement');
  const VERSION$3='0.8.0',q$2=api$6.q,clone=x=>JSON.parse(JSON.stringify(x));
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
   const patternMode=algorithm==='auto'?'layered':algorithm==='spanning_tree'?'tree':algorithm;
   const usePattern=['auto','fit_grid','circular','radial','spanning_tree','organic'].includes(algorithm)||(algorithm==='layered'&&p.layout.center==='pins');
   let pattern=null;
   const ErrorClass=class extends Error{constructor(code,message){super(message);this.code=code;}};
   /* DDN200 (spec ch. 15): an AUTHORED gap/row_gap below 20px is rejected, not
    * silently floored. Authored values of 20px or more are used verbatim as the
    * inter-element gap (scaled by the spacing hint); object/edge/port clearances
    * govern routing pads and port fan-out, never node spacing. Validated here so
    * every algorithm path (pattern and layoutNodes) enforces it. */
   const authoredGap=q$2(p.layout.gap,64),authoredRowGap=q$2(p.layout.row_gap,64);
   if(authoredGap<20||authoredRowGap<20)throw new ErrorClass('DDN200','Automatic gaps must be at least 20px');
   if(usePattern){
    const adapted={...p,layout:{...p.layout,algorithm:patternMode,gap:api$6.round(q$2(p.layout.gap,64)*api$6.spacingScale(p.layout))}};
    const result=Patterns.place(nodes,rels,ir,adapted);pattern=result.pattern;diagnostics.push(...result.diagnostics);
    if(['left','up'].includes(p.layout.direction)&&patternMode==='layered'){
     for(const n of nodes)if(!at[n.id]?.at){const c=center(n),ax=pattern.anchor[0],ay=pattern.anchor[1];if(p.layout.direction==='left')n.x=2*ax-c[0]-n.w/2;else n.y=2*ay-c[1]-n.h/2;}
    }
   }else {
    const result=api$6.layoutNodes(nodes,rels,p,at,ErrorClass);nodes=result.nodes;diagnostics.push(...result.diagnostics);
   }
   const constraints=Patterns.constraintsFor(ir);
   for(const n of nodes)if(at[n.id]?.at){n.x=q$2(at[n.id].at[0]);n.y=q$2(at[n.id].at[1]);}
   const pins=nodes.filter(n=>at[n.id]?.at),bounds=Patterns.bounds(pins),anchor=bounds?center(bounds):null;
   let retained=[];
   if(paused&&state){
    for(const n of nodes)if(!at[n.id]?.at&&state.positions[n.id]){[n.x,n.y]=state.positions[n.id];retained.push(n.id);}
    const occupied=nodes.filter(n=>at[n.id]?.at||retained.includes(n.id));
    for(const n of nodes)if(!occupied.includes(n)){
     let ok=!occupied.some(o=>api$6.overlap(n,o,16));const base=center(n);
     for(let i=1;!ok&&i<1200;i++){const a=i*2.3999632297,d=Math.sqrt(i)*q$2(p.layout.grid_step,32);n.x=base[0]+Math.cos(a)*d-n.w/2;n.y=base[1]+Math.sin(a)*d-n.h/2;ok=Patterns.fits(n,constraints.get(n.id))&&!occupied.some(o=>api$6.overlap(n,o,16));}
     if(!ok)fail$1('DDN-P003','No space for a new element without moving retained positions: '+n.id);occupied.push(n);
    }
   }
   // frame_overflow: confine  clamps unpinned, non-retained members
   // into a fixed frame's interior — automatically what manual pins did. A
   // member larger than the interior is left for the fits check below.
   for(const n of nodes){const b=constraints.get(n.id);if(b&&!at[n.id]?.at&&!retained.includes(n.id)&&n.w<=b.w&&n.h<=b.h){n.x=Math.min(Math.max(n.x,b.x),b.x+b.w-n.w);n.y=Math.min(Math.max(n.y,b.y),b.y+b.h-n.h);}}
   for(const n of nodes)if(!Patterns.fits(n,constraints.get(n.id)))fail$1('DDN-P004','Measured element lies outside a fixed frame: '+n.id);
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(api$6.overlap(nodes[i],nodes[j]))fail$1('DDN204','Pinned or retained placements overlap: '+nodes[i].id+' / '+nodes[j].id);
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
      length:rs.reduce((sum,r)=>sum+api$6.segs(r.points).reduce((s,e)=>s+Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),0),0),
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
     const alternates=e=>!e.sideFree?[]:(e.row||e.ep.role==='field'||p.layout.algorithm==='mindmap'?['west','east']:['west','east','north','south']).filter(s=>s!==e.side);
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
   const run=h=>api$6.routing(nodes,rels,p,h,labelMeasure,ErrorClass,obstacles);
   let best=null,lastError=null;
   try{best=run(hints);}catch(e){lastError=e;}
   const score=r=>({crossings:r.crossings.length,length:r.routes.reduce((n,r)=>n+api$6.segs(r.points).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0),0),bends:r.routes.reduce((n,r)=>n+Math.max(0,r.points.length-2),0)});
   // A crossing-free route may still contain a costly label excursion. Measure
   // against its own endpoint displacement, not the extent of the whole drawing.
   const inefficient=route=>{const ps=route.points,a=ps[0],b=ps.at(-1),direct=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),walk=api$6.segs(ps).reduce((n,s)=>n+Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]),0);return route.r.from.element!==route.r.to.element&&(route.labelDetour||walk>direct*1.8+120);};
   const needsWork=()=>!best||best.crossings.length>0||best.routes.some(inefficient);
   const initial=best?score(best):null,stages=[{stage:'initial-clear-routing',...(initial||{failure:lastError?.code})}];
   let trials=0,portChanges=0,nodeMoves=0,endpointOrdering=null;
   // Whole-graph re-route trials are affordable up to 96 relations; beyond that
   // the historical zero budget keeps large-graph cost bounded (DDN-LW06).
   const budget=rels.length<=12?24:rels.length<=32?8:rels.length<=96?Math.min(8,Math.max(4,Math.ceil(128/rels.length))):0;
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
       // B1-100: a mind map owns its attachment rule — branches never leave the
       // top or bottom edge, so the optimizer may not offer those sides.
       const sides=ep.member&&n.n.fields.some(f=>f.id===ep.member)||p.layout.algorithm==='mindmap'?['east','west']:['east','west','south','north'];
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
    // Frames add ownership constraints: swaps stay inside one frame (or outside
    // every frame), and fixed-frame interior bounds are re-checked after a swap.
    const frameKey=n=>JSON.stringify(ir.view.frames.filter(f=>f.members.includes(n.id)).map(f=>f.id).sort());
    const canMove=!placed.telemetry.retentionActive;
    if(canMove&&(!best||score(best).crossings>0)){
     const free=nodes.filter(n=>!protectedIds.has(n.id));new Set((best?.crossings||[]).flatMap(c=>[c.under,c.over]));let nt=0;
     const horizontal=['right','left'].includes(p.layout.direction);
     for(let i=0;i<free.length&&nt<Math.min(12,budget);i++)for(let j=i+1;j<free.length&&nt<Math.min(12,budget);j++){
      if(best&&score(best).crossings===0)break;
      const a=free[i],b=free[j],sa=slots[a.id],sb=slots[b.id];
      if(frameKey(a)!==frameKey(b))continue;
      if(placed.pattern&&(!sa||!sb||sa.key!==sb.key))continue;
      if(!placed.pattern&&['mindmap','tree','grouped','ladder'].includes(p.layout.algorithm))continue;
      // Layered swaps stay inside one rank; exchanging ranks would re-order the flow.
      if(!placed.pattern&&p.layout.algorithm==='layered'&&Math.abs((horizontal?a.x:a.y)-(horizontal?b.x:b.y))>.01)continue;
      const oldA=[a.x,a.y],oldB=[b.x,b.y],ca=center(a),cb=center(b);a.x=cb[0]-a.w/2;a.y=cb[1]-a.h/2;b.x=ca[0]-b.w/2;b.y=ca[1]-b.h/2;
      const clear=nodes.every((x,k)=>nodes.slice(k+1).every(y=>!api$6.overlap(x,y,16)))&&Patterns.fits(a,placed.constraints.get(a.id))&&Patterns.fits(b,placed.constraints.get(b.id));
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
   if(rels.length>32&&p.layout.optimize!=='none')best.diagnostics.push({code:'DDN-LW06',severity:'info',message:rels.length>96?'Larger graph: native obstacle routing runs, but expensive whole-graph crossing trials are skipped.':'Larger graph: native obstacle routing runs with a reduced whole-graph crossing-trial budget.'});
   if(placed.pattern)for(const n of nodes)if(placed.pattern.slots[n.id]){placed.pattern.slots[n.id].center=center(n);placed.pattern.slots[n.id].finalCenter=center(n);}
   return {...best,telemetry:{portChanges,nodeMoves,portTrials:trials,endpointOrdering,stages,pattern:placed.pattern,remainingCrossings:best.crossings.length}};
  }
  const api$5={VERSION: VERSION$3,place,route,stateChecked,centeredBounds:Patterns.centeredBounds};
  publishNamespace('DDNPlacement',api$5);

  /* Generated by tools/build-assets.js from standard/registry/ — do not hand-edit. */
  var ICONLIBS = {"libraries":[{"id":"network-generic@1","name":"Generic network infrastructure (agent-drawn)","icons":[{"id":"router","name":"Router","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"3\" y=\"10\" width=\"18\" height=\"5.5\" rx=\"1.4\"/>\u003cpath d=\"M7 7l2.5 2.5M9.5 7L7 9.5M14.5 18l2.5-2.5M17 18l-2.5-2.5\"/>\u003c/svg>"},{"id":"switch","name":"Switch","kinds":["network.switch"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"3\" y=\"10\" width=\"18\" height=\"5.5\" rx=\"1.4\"/>\u003cpath d=\"M6 7h5M9 5l2 2-2 2M18 18h-5M15 16l-2 2 2 2\"/>\u003c/svg>"},{"id":"firewall","name":"Firewall","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"4\" y=\"5\" width=\"16\" height=\"14\"/>\u003cpath d=\"M4 9.7h16M4 14.3h16M10 5v4.7M16 5v4.7M7 9.7v4.6M13 9.7v4.6M10 14.3V19M16 14.3V19\"/>\u003c/svg>"},{"id":"load-balancer","name":"Load balancer","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"6\" r=\"2.4\"/>\u003cpath d=\"M12 8.4v4M12 12.4l-6 5M12 12.4l6 5\"/>\u003ccircle cx=\"5\" cy=\"18.5\" r=\"1.8\"/>\u003ccircle cx=\"19\" cy=\"18.5\" r=\"1.8\"/>\u003c/svg>"},{"id":"server","name":"Server","kinds":["network.server"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"4\" y=\"4\" width=\"16\" height=\"6\" rx=\"1\"/>\u003crect x=\"4\" y=\"14\" width=\"16\" height=\"6\" rx=\"1\"/>\u003ccircle cx=\"7\" cy=\"7\" r=\".8\" fill=\"currentColor\"/>\u003ccircle cx=\"7\" cy=\"17\" r=\".8\" fill=\"currentColor\"/>\u003c/svg>"},{"id":"database","name":"Database","kinds":["network.rack"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cellipse cx=\"12\" cy=\"5.5\" rx=\"7\" ry=\"2.5\"/>\u003cpath d=\"M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13\"/>\u003cpath d=\"M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5\"/>\u003c/svg>"},{"id":"storage","name":"Storage array","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"4\" y=\"7\" width=\"16\" height=\"10\" rx=\"1.5\"/>\u003ccircle cx=\"9\" cy=\"12\" r=\"3\"/>\u003cpath d=\"M15.5 10v4\"/>\u003c/svg>"},{"id":"cloud","name":"Cloud","kinds":["network.bus"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M6.5 17a4.5 4.5 0 1 1 .4-8.98A6 6 0 0 1 18.5 10a3.75 3.75 0 0 1-.5 7z\"/>\u003c/svg>"},{"id":"user","name":"User","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"8\" r=\"3.5\"/>\u003cpath d=\"M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5\"/>\u003c/svg>"},{"id":"workstation","name":"Workstation","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"1\"/>\u003cpath d=\"M9 20h6M12 16v4\"/>\u003c/svg>"},{"id":"laptop","name":"Laptop","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"6\" y=\"5\" width=\"12\" height=\"9\"/>\u003cpath d=\"M3 18l2-4h14l2 4z\"/>\u003c/svg>"},{"id":"phone","name":"Desk phone","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"6\" y=\"4\" width=\"12\" height=\"7\" rx=\"1\"/>\u003cpath d=\"M9 11v6M15 11v6M7 20h10M7 17h10\"/>\u003c/svg>"},{"id":"mobile","name":"Mobile phone","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"8\" y=\"3\" width=\"8\" height=\"18\" rx=\"1.5\"/>\u003cpath d=\"M11 18h2\"/>\u003c/svg>"},{"id":"printer","name":"Printer","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M7 9V4h10v5\"/>\u003crect x=\"4\" y=\"9\" width=\"16\" height=\"7\" rx=\"1\"/>\u003crect x=\"7\" y=\"14\" width=\"10\" height=\"6\"/>\u003c/svg>"},{"id":"wifi-ap","name":"Wireless access point","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"18\" r=\"1\" fill=\"currentColor\"/>\u003cpath d=\"M7 14a7 7 0 0 1 10 0M4 10.5a11.5 11.5 0 0 1 16 0M1.5 7a16 16 0 0 1 21 0\"/>\u003c/svg>"},{"id":"antenna","name":"Antenna","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M9 21l3-13 3 13\"/>\u003ccircle cx=\"12\" cy=\"6.5\" r=\"1.4\"/>\u003cpath d=\"M8 4a6 6 0 0 1 8 0\"/>\u003c/svg>"},{"id":"globe","name":"Globe / WAN","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"9\"/>\u003cpath d=\"M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18\"/>\u003c/svg>"},{"id":"link","name":"Link segment","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 12h16\"/>\u003ccircle cx=\"4\" cy=\"12\" r=\"1.4\"/>\u003ccircle cx=\"20\" cy=\"12\" r=\"1.4\"/>\u003c/svg>"},{"id":"link-wireless","name":"Wireless link","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 12h16\" stroke-dasharray=\"3 3\"/>\u003ccircle cx=\"4\" cy=\"12\" r=\"1.4\"/>\u003ccircle cx=\"20\" cy=\"12\" r=\"1.4\"/>\u003c/svg>"},{"id":"hub","name":"Hub / star centre","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"2.4\"/>\u003cpath d=\"M12 9.6V4M12 14.4V20M9.6 12H4M14.4 12H20\"/>\u003ccircle cx=\"12\" cy=\"4\" r=\"1.2\"/>\u003ccircle cx=\"12\" cy=\"20\" r=\"1.2\"/>\u003ccircle cx=\"4\" cy=\"12\" r=\"1.2\"/>\u003ccircle cx=\"20\" cy=\"12\" r=\"1.2\"/>\u003c/svg>"}],"note":"Common-practice rendering — compliance against the governing standard pending document review. Generic glyphs only; vendor packs (Cisco/AWS/Azure/GCP) excluded pending licensing diligence.","license":"GPL-2.0-or-later","attribution":"DDN contributors (agent-drawn artwork)","source":"https://github.com/scratchbird-software-inc/Diagram-Design-Notation"},{"id":"vsm-symbols@1","name":"Value-stream mapping symbols (agent-drawn)","icons":[{"id":"process","name":"Process box","kinds":["vsm.process"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"3\" y=\"6\" width=\"18\" height=\"12\"/>\u003cpath d=\"M3 10h18\"/>\u003c/svg>"},{"id":"customer","name":"Customer (factory)","kinds":["vsm.customer"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 20V10l4.5 3V10l4.5 3V10l4.5 3v7\"/>\u003cpath d=\"M2 20h20\"/>\u003cpath d=\"M15.5 10V5h2v6.5\"/>\u003c/svg>"},{"id":"supplier","name":"Supplier (factory)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M20 20V10l-4.5 3V10L11 13v-3l-4.5 3v7\"/>\u003cpath d=\"M2 20h20\"/>\u003c/svg>"},{"id":"production-control","name":"Production control","kinds":["vsm.control"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"4\" y=\"5\" width=\"16\" height=\"14\"/>\u003cpath d=\"M4 9.7h16M4 14.3h16M9.3 5v14M14.7 5v14\"/>\u003c/svg>"},{"id":"inventory","name":"Inventory","kinds":["vsm.inventory"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M12 5l9 15H3z\"/>\u003cpath d=\"M12 12v4\"/>\u003c/svg>"},{"id":"supermarket","name":"Supermarket","kinds":["vsm.supermarket"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M6 5v14M6 5h12M6 12h12M6 19h12\"/>\u003c/svg>"},{"id":"fifo-lane","name":"FIFO lane","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 8h18M3 16h18\"/>\u003cpath d=\"M14 12H5M8 9l-3 3 3 3\"/>\u003c/svg>"},{"id":"truck","name":"Truck shipment","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M2 16V8h11v8M13 11h5l3 3v2h-8\"/>\u003ccircle cx=\"7\" cy=\"17.5\" r=\"1.6\"/>\u003ccircle cx=\"17\" cy=\"17.5\" r=\"1.6\"/>\u003c/svg>"},{"id":"push-arrow","name":"Push arrow","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 10h12v4H3z\"/>\u003cpath d=\"M15 8l6 4-6 4z\"/>\u003c/svg>"},{"id":"pull","name":"Pull arrow","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M21 12H8M13 7l-5 5 5 5\"/>\u003c/svg>"},{"id":"einfo","name":"Electronic information","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 16l4-6 3 5 3.5-7 3 5 4.5-6\"/>\u003c/svg>"},{"id":"minfo","name":"Manual information","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 12h18\" stroke-dasharray=\"4 3\"/>\u003cpath d=\"M17 9l3 3-3 3\"/>\u003c/svg>"},{"id":"kaizen","name":"Kaizen burst","kinds":["vsm.kaizen"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M12 3l1.8 4.2L18 5.5l-1.7 4.2L20.5 12l-4.2 1.8L18 18l-4.2-1.7L12 20.5l-1.8-4.2L6 18l1.7-4.2L3.5 12l4.2-1.8L6 6l4.2 1.7z\"/>\u003c/svg>"},{"id":"operator","name":"Operator","kinds":["vsm.operator"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"7\" r=\"3\"/>\u003cpath d=\"M6 20c1-4 3.2-6 6-6s5 2 6 6\"/>\u003c/svg>"},{"id":"timeline","name":"Timeline ladder","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 4v6h8v4h8v6\"/>\u003c/svg>"},{"id":"safety-stock","name":"Safety / buffer stock","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M12 4l9 16H3z\"/>\u003cpath d=\"M14 12h-3.2a1.7 1.7 0 0 0 0 3.4h2.4a1.7 1.7 0 0 1 0 3.4H10\"/>\u003c/svg>"}],"note":"Common-practice rendering — compliance against the governing standard pending document review. Artwork upgrade over the built-in simple VSM glyphs.","license":"GPL-2.0-or-later","attribution":"DDN contributors (agent-drawn artwork)","source":"https://github.com/scratchbird-software-inc/Diagram-Design-Notation"},{"id":"pid-common@1","name":"P&ID common symbols (agent-drawn)","icons":[{"id":"instrument-field","name":"Instrument — field mounted","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M4 12h16\"/>\u003c/svg>"},{"id":"instrument-panel","name":"Instrument — panel mounted","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\"/>\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M4 12h16\"/>\u003c/svg>"},{"id":"instrument-shared","name":"Instrument — shared display","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" stroke-dasharray=\"3 2\"/>\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M4 12h16\"/>\u003c/svg>"},{"id":"instrument-dcs","name":"Instrument — DCS","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M4 10.5h16M4 13.5h16\"/>\u003c/svg>"},{"id":"instrument-plc","name":"Instrument — PLC","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M12 7l5 5-5 5-5-5z\"/>\u003c/svg>"},{"id":"instrument-inline","name":"Instrument — inline","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h3.5M19.5 12H23\"/>\u003ccircle cx=\"12\" cy=\"12\" r=\"7.5\"/>\u003cpath d=\"M4.5 12h15\"/>\u003c/svg>"},{"id":"valve-gate","name":"Gate valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4zM20 8l-8 4 8 4z\"/>\u003cpath d=\"M12 12V4M8 4h8\"/>\u003c/svg>"},{"id":"valve-globe","name":"Globe valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4zM20 8l-8 4 8 4z\"/>\u003ccircle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\"/>\u003cpath d=\"M12 12V4M8 4h8\"/>\u003c/svg>"},{"id":"valve-ball","name":"Ball valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4zM20 8l-8 4 8 4z\"/>\u003ccircle cx=\"12\" cy=\"12\" r=\"1.8\"/>\u003c/svg>"},{"id":"valve-butterfly","name":"Butterfly valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4zM20 8l-8 4 8 4z\"/>\u003cpath d=\"M12 8v8\"/>\u003c/svg>"},{"id":"valve-check","name":"Check valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 8l8 4-8 4z\"/>\u003cpath d=\"M15 7v10\"/>\u003c/svg>"},{"id":"valve-control","name":"Control valve (diaphragm actuator)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4zM20 8l-8 4 8 4z\"/>\u003cpath d=\"M12 12V7\"/>\u003cpath d=\"M7 7a5 5 0 0 1 10 0\"/>\u003c/svg>"},{"id":"valve-needle","name":"Needle valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4zM20 8l-8 4 8 4z\"/>\u003cpath d=\"M12 12V4M10 4l2 2 2-2\"/>\u003c/svg>"},{"id":"valve-three-way","name":"Three-way valve","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 9l6 3-6 3zM19 9l-6 3 6 3zM12 16l-3-3h6z\"/>\u003c/svg>"},{"id":"valve-relief","name":"Relief valve (spring)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 9l6 3-6 3zM19 9l-6 3 6 3z\"/>\u003cpath d=\"M12 9V7l-2-2 4-1.5L10 2\"/>\u003c/svg>"},{"id":"actuator-diaphragm","name":"Diaphragm actuator","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M6 9a6 6 0 0 1 12 0\"/>\u003cpath d=\"M12 9v5M8 14h8\"/>\u003c/svg>"},{"id":"actuator-motor","name":"Motor actuator","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"7\"/>\u003cpath d=\"M8.5 15l1.5-5 2 3.5 2-3.5 1.5 5\"/>\u003c/svg>"},{"id":"actuator-solenoid","name":"Solenoid actuator","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"6\" y=\"8\" width=\"12\" height=\"9\"/>\u003cpath d=\"M14 10h-3.2a1.6 1.6 0 0 0 0 3.2h2.4a1.6 1.6 0 0 1 0 3.2H10\"/>\u003c/svg>"},{"id":"actuator-manual","name":"Manual actuator (handwheel)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"9\" r=\"3.5\"/>\u003cpath d=\"M8.5 9h7M12 5.5v7M12 12.5V17\"/>\u003c/svg>"},{"id":"pump-centrifugal","name":"Centrifugal pump","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"11\" cy=\"13\" r=\"6.5\"/>\u003cpath d=\"M11 6.5V2.5M17.5 13h4\"/>\u003c/svg>"},{"id":"pump-displacement","name":"Positive-displacement pump","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"7\"/>\u003cpath d=\"M9 9l6 3-6 3z\" fill=\"currentColor\"/>\u003c/svg>"},{"id":"compressor","name":"Compressor","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"7\"/>\u003cpath d=\"M8 14l4-5 4 5z\"/>\u003c/svg>"},{"id":"vessel-vertical","name":"Vertical vessel","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M7 4v16M17 4v16\"/>\u003cellipse cx=\"12\" cy=\"4\" rx=\"5\" ry=\"1.8\"/>\u003cpath d=\"M7 20a5 1.8 0 0 0 10 0\"/>\u003c/svg>"},{"id":"vessel-horizontal","name":"Horizontal vessel","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>\u003c/svg>"},{"id":"tank-roof","name":"Tank with cone roof","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 9l7-4 7 4M5 9v11h14V9\"/>\u003c/svg>"},{"id":"heat-exchanger","name":"Heat exchanger","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"7\"/>\u003cpath d=\"M8 9l2 6 2-6 2 6 2-6\"/>\u003c/svg>"},{"id":"exchanger-plate","name":"Plate heat exchanger","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"5\" y=\"5\" width=\"14\" height=\"14\"/>\u003cpath d=\"M5 19L19 5\"/>\u003c/svg>"},{"id":"mixer","name":"Agitated vessel","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M7 5v14M17 5v14\"/>\u003cellipse cx=\"12\" cy=\"5\" rx=\"5\" ry=\"1.6\"/>\u003cpath d=\"M12 5v8l-3 3M12 13l3 3\"/>\u003c/svg>"},{"id":"strainer","name":"Strainer / filter","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 8l8 4-8 4z\"/>\u003cpath d=\"M15 7v10\" stroke-dasharray=\"2 2\"/>\u003c/svg>"},{"id":"flow-arrow","name":"Flow direction arrow","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 12h15M14 8l5 4-5 4\"/>\u003c/svg>"},{"id":"line-process","name":"Signal line — process (solid)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 12h18\"/>\u003c/svg>"},{"id":"line-pneumatic","name":"Signal line — pneumatic","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 12h18\" stroke-dasharray=\"1.5 3.5\"/>\u003c/svg>"},{"id":"line-electric","name":"Signal line — electric","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 12h18\" stroke-dasharray=\"5 3\"/>\u003c/svg>"},{"id":"line-hydraulic","name":"Signal line — hydraulic","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M3 12h18\" stroke-dasharray=\"8 2 2 2\"/>\u003c/svg>"},{"id":"line-datalink","name":"Signal line — data link","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"5\" cy=\"12\" r=\"1.6\"/>\u003ccircle cx=\"12\" cy=\"12\" r=\"1.6\"/>\u003ccircle cx=\"19\" cy=\"12\" r=\"1.6\"/>\u003cpath d=\"M6.6 12h3.8M13.6 12h3.8\"/>\u003c/svg>"},{"id":"tag-plate","name":"Tag plate (two compartments)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"3\" y=\"6\" width=\"18\" height=\"12\"/>\u003cpath d=\"M3 12h18\"/>\u003c/svg>"}],"note":"Common-practice rendering — compliance against the governing standard pending document review. ISA-5.1-style common set; the ISA-5.1 document is not in hand, so forms follow well-known public renderings.","license":"GPL-2.0-or-later","attribution":"DDN contributors (agent-drawn artwork)","source":"https://github.com/scratchbird-software-inc/Diagram-Design-Notation"},{"id":"electrical-common@1","name":"Electrical common symbols (agent-drawn)","icons":[{"id":"resistor","name":"Resistor (box form)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"4\" y=\"9\" width=\"16\" height=\"6\"/>\u003cpath d=\"M1 12h3M20 12h3\"/>\u003c/svg>"},{"id":"resistor-zigzag","name":"Resistor (zigzag form)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h3l2-4 3 8 3-8 3 8 3-8 2 4h4\"/>\u003c/svg>"},{"id":"capacitor","name":"Capacitor","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h9.5M14.5 12H23\"/>\u003cpath d=\"M10.5 6v12M13.5 6v12\"/>\u003c/svg>"},{"id":"capacitor-polarized","name":"Capacitor, polarized","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h9.5M14.5 12H23\"/>\u003cpath d=\"M10.5 6v12M13.5 18a5.5 5.5 0 0 1 0-12\"/>\u003c/svg>"},{"id":"inductor","name":"Inductor","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h3M21 12h3\"/>\u003cpath d=\"M4 12a2.7 2.7 0 0 1 5.3 0 2.7 2.7 0 0 1 5.4 0 2.7 2.7 0 0 1 5.3 0\"/>\u003c/svg>"},{"id":"diode","name":"Diode","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h7M16 12h7\"/>\u003cpath d=\"M7 7l9 5-9 5z\"/>\u003cpath d=\"M16 7v10\"/>\u003c/svg>"},{"id":"led","name":"LED","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h5M14 12h7\"/>\u003cpath d=\"M5 7l9 5-9 5z\"/>\u003cpath d=\"M14 7v10\"/>\u003cpath d=\"M11 4l2.5-2.5M13.5 4h-2.5v2.5M15 6.5L17.5 4M17.5 6.5v-2.5H15\"/>\u003c/svg>"},{"id":"zener","name":"Zener diode","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h7M16 12h7\"/>\u003cpath d=\"M7 7l9 5-9 5z\"/>\u003cpath d=\"M16 7v10M14 8l2-1M18 16l-2 1\"/>\u003c/svg>"},{"id":"transistor-npn","name":"Transistor NPN","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M9 8v8M9 12h4M13 12l5-4M13 12l5 4\"/>\u003cpath d=\"M18 16l-2.8-.8.8-2.8\"/>\u003c/svg>"},{"id":"transistor-pnp","name":"Transistor PNP","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M9 8v8M9 12h4M13 12l5-4M13 12l5 4\"/>\u003cpath d=\"M13 12l2.8.8-.8 2.8\"/>\u003c/svg>"},{"id":"ground","name":"Ground","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M12 4v7M5 11h14M8 15h8M11 19h2\"/>\u003c/svg>"},{"id":"ground-chassis","name":"Chassis ground","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M12 4v7M5 11h14M9 11l-2 4M13 11l-2 4M17 11l-2 4\"/>\u003c/svg>"},{"id":"battery","name":"Battery","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h4.5M19.5 12H23M5.5 8v8M10.5 5v14M13.5 8v8M18.5 5v14\"/>\u003cpath d=\"M10.5 12h3\"/>\u003c/svg>"},{"id":"switch-no","name":"Switch, normally open","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 18h5M18 18h5\"/>\u003ccircle cx=\"6\" cy=\"18\" r=\"1\"/>\u003ccircle cx=\"18\" cy=\"18\" r=\"1\"/>\u003cpath d=\"M6 18L17 8\"/>\u003c/svg>"},{"id":"switch-nc","name":"Switch, normally closed","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 14h4M19 14h4\"/>\u003ccircle cx=\"6\" cy=\"14\" r=\"1\"/>\u003ccircle cx=\"18\" cy=\"14\" r=\"1\"/>\u003cpath d=\"M6 14L18 11\"/>\u003c/svg>"},{"id":"switch-changeover","name":"Switch, changeover","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"6\" cy=\"16\" r=\"1\"/>\u003ccircle cx=\"18\" cy=\"16\" r=\"1\"/>\u003ccircle cx=\"18\" cy=\"8\" r=\"1\"/>\u003cpath d=\"M1 16h4M19 16h4M19 8h4\"/>\u003cpath d=\"M6 16L17 9\"/>\u003c/svg>"},{"id":"relay","name":"Relay (coil + contact)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"2\" y=\"9\" width=\"7\" height=\"7\"/>\u003cpath d=\"M9 12.5h3\"/>\u003ccircle cx=\"15.5\" cy=\"14\" r=\"1\"/>\u003ccircle cx=\"21.5\" cy=\"14\" r=\"1\"/>\u003cpath d=\"M15.5 14l6-4.5\"/>\u003c/svg>"},{"id":"fuse","name":"Fuse","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003crect x=\"6\" y=\"9\" width=\"12\" height=\"6\"/>\u003cpath d=\"M1 12h22\"/>\u003c/svg>"},{"id":"transformer","name":"Transformer","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 9a3 3 0 0 1 0 6M8 9a3 3 0 0 1 0 6\"/>\u003cpath d=\"M16 9a3 3 0 0 0 0 6M20 9a3 3 0 0 0 0 6\"/>\u003cpath d=\"M11 7v10M13 7v10\"/>\u003c/svg>"},{"id":"motor","name":"Motor","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M8 15l1.5-6L12 13l2.5-4L16 15\"/>\u003c/svg>"},{"id":"generator","name":"Generator","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"8\"/>\u003cpath d=\"M15.5 10a3.5 3.5 0 1 0 0 4H12\"/>\u003c/svg>"},{"id":"lamp","name":"Lamp","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"7\"/>\u003cpath d=\"M7.5 7.5l9 9M16.5 7.5l-9 9\"/>\u003c/svg>"},{"id":"terminal","name":"Connector / terminal","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"7\" cy=\"12\" r=\"2.5\"/>\u003ccircle cx=\"17\" cy=\"12\" r=\"2.5\"/>\u003cpath d=\"M9.5 12h5\"/>\u003c/svg>"},{"id":"junction-dot","name":"Wire junction","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003ccircle cx=\"12\" cy=\"12\" r=\"2.2\" fill=\"currentColor\"/>\u003cpath d=\"M1 12h9M14 12h9M12 1v9\"/>\u003c/svg>"},{"id":"crossover-hop","name":"Wire crossover (no connection)","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M1 12h22\"/>\u003cpath d=\"M12 4v5a3.5 3.5 0 0 0 0 6v5\"/>\u003c/svg>"},{"id":"op-amp","name":"Operational amplifier","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 5l14 7-14 7z\"/>\u003cpath d=\"M1 9h4M1 15h4M2.5 9h3M4 7.5v3M2.5 15h3\"/>\u003c/svg>"},{"id":"gate-and","name":"AND gate","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 5h6a6 7 0 0 1 0 14H5z\"/>\u003cpath d=\"M1 9h4M1 15h4M17 12h6\"/>\u003c/svg>"},{"id":"gate-or","name":"OR gate","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 5c6 0 10 3 13 7-3 4-7 7-13 7 2-4.5 2-9.5 0-14z\"/>\u003cpath d=\"M1 9h4M1 15h4M18 12h5\"/>\u003c/svg>"},{"id":"gate-not","name":"NOT gate","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M6 5l10 7-10 7z\"/>\u003ccircle cx=\"18\" cy=\"12\" r=\"1.6\"/>\u003cpath d=\"M1 12h5M19.6 12H23\"/>\u003c/svg>"},{"id":"gate-nand","name":"NAND gate","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M5 5h6a6 7 0 0 1 0 14H5z\"/>\u003ccircle cx=\"19.5\" cy=\"12\" r=\"1.6\"/>\u003cpath d=\"M1 9h4M1 15h4M21.1 12H23\"/>\u003c/svg>"},{"id":"gate-nor","name":"NOR gate","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M4 5c6 0 10 3 13 7-3 4-7 7-13 7 2-4.5 2-9.5 0-14z\"/>\u003ccircle cx=\"19.5\" cy=\"12\" r=\"1.6\"/>\u003cpath d=\"M1 9h3M1 15h3M21.1 12H23\"/>\u003c/svg>"},{"id":"gate-xor","name":"XOR gate","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\u003cpath d=\"M6 5c6 0 10 3 13 7-3 4-7 7-13 7 2-4.5 2-9.5 0-14z\"/>\u003cpath d=\"M3.5 5c2 4.5 2 9.5 0 14\"/>\u003cpath d=\"M1 9h4M1 15h4M19 12h4\"/>\u003c/svg>"}],"note":"Common-practice rendering — compliance against the governing standard pending document review. IEC 60617-style common set; the IEC 60617 document is not in hand, so forms follow well-known public renderings. Primary orientation only; rotate at bind time if needed.","license":"GPL-2.0-or-later","attribution":"DDN contributors (agent-drawn artwork)","source":"https://github.com/scratchbird-software-inc/Diagram-Design-Notation"},{"id":"tabler-infra@1","name":"Tabler infrastructure selection (MIT)","icons":[{"id":"server","name":"Server","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2\" />\u003cpath d=\"M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2\" />\u003cpath d=\"M7 8l0 .01\" />\u003cpath d=\"M7 16l0 .01\" />\u003c/svg>"},{"id":"server-2","name":"Server 2","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2\" />\u003cpath d=\"M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2\" />\u003cpath d=\"M7 8l0 .01\" />\u003cpath d=\"M7 16l0 .01\" />\u003cpath d=\"M11 8h6\" />\u003cpath d=\"M11 16h6\" />\u003c/svg>"},{"id":"database","name":"Database","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0\" />\u003cpath d=\"M4 6v6a8 3 0 0 0 16 0v-6\" />\u003cpath d=\"M4 12v6a8 3 0 0 0 16 0v-6\" />\u003c/svg>"},{"id":"cloud","name":"Cloud","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878\" />\u003c/svg>"},{"id":"cloud-computing","name":"Cloud Computing","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M6.657 16c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878\" />\u003cpath d=\"M12 16v5\" />\u003cpath d=\"M16 16v4a1 1 0 0 0 1 1h4\" />\u003cpath d=\"M8 16v4a1 1 0 0 1 -1 1h-4\" />\u003c/svg>"},{"id":"network","name":"Network","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M6 9a6 6 0 1 0 12 0a6 6 0 0 0 -12 0\" />\u003cpath d=\"M12 3c1.333 .333 2 2.333 2 6s-.667 5.667 -2 6\" />\u003cpath d=\"M12 3c-1.333 .333 -2 2.333 -2 6s.667 5.667 2 6\" />\u003cpath d=\"M6 9h12\" />\u003cpath d=\"M3 20h7\" />\u003cpath d=\"M14 20h7\" />\u003cpath d=\"M10 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\u003cpath d=\"M12 15v3\" />\u003c/svg>"},{"id":"router","name":"Router","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 15a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -4\" />\u003cpath d=\"M17 17l0 .01\" />\u003cpath d=\"M13 17l0 .01\" />\u003cpath d=\"M15 13l0 -2\" />\u003cpath d=\"M11.75 8.75a4 4 0 0 1 6.5 0\" />\u003cpath d=\"M8.5 6.5a8 8 0 0 1 13 0\" />\u003c/svg>"},{"id":"wifi","name":"Wifi","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M12 18l.01 0\" />\u003cpath d=\"M9.172 15.172a4 4 0 0 1 5.656 0\" />\u003cpath d=\"M6.343 12.343a8 8 0 0 1 11.314 0\" />\u003cpath d=\"M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0\" />\u003c/svg>"},{"id":"antenna","name":"Antenna","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M20 4v8\" />\u003cpath d=\"M16 4.5v7\" />\u003cpath d=\"M12 5v16\" />\u003cpath d=\"M8 5.5v5\" />\u003cpath d=\"M4 6v4\" />\u003cpath d=\"M20 8h-16\" />\u003c/svg>"},{"id":"satellite","name":"Satellite","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3.707 6.293l2.586 -2.586a1 1 0 0 1 1.414 0l5.586 5.586a1 1 0 0 1 0 1.414l-2.586 2.586a1 1 0 0 1 -1.414 0l-5.586 -5.586a1 1 0 0 1 0 -1.414\" />\u003cpath d=\"M6 10l-3 3l3 3l3 -3\" />\u003cpath d=\"M10 6l3 -3l3 3l-3 3\" />\u003cpath d=\"M12 12l1.5 1.5\" />\u003cpath d=\"M14.5 17a2.5 2.5 0 0 0 2.5 -2.5\" />\u003cpath d=\"M15 21a6 6 0 0 0 6 -6\" />\u003c/svg>"},{"id":"device-desktop","name":"Device Desktop","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10\" />\u003cpath d=\"M7 20h10\" />\u003cpath d=\"M9 16v4\" />\u003cpath d=\"M15 16v4\" />\u003c/svg>"},{"id":"device-laptop","name":"Device Laptop","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 19l18 0\" />\u003cpath d=\"M5 7a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -8\" />\u003c/svg>"},{"id":"device-mobile","name":"Device Mobile","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14\" />\u003cpath d=\"M11 4h2\" />\u003cpath d=\"M12 17v.01\" />\u003c/svg>"},{"id":"device-tablet","name":"Device Tablet","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 4a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-16\" />\u003cpath d=\"M11 17a1 1 0 1 0 2 0a1 1 0 0 0 -2 0\" />\u003c/svg>"},{"id":"device-speaker","name":"Device Speaker","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14\" />\u003cpath d=\"M9 14a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\u003cpath d=\"M12 7l0 .01\" />\u003c/svg>"},{"id":"printer","name":"Printer","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2\" />\u003cpath d=\"M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4\" />\u003cpath d=\"M7 15a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2l0 -4\" />\u003c/svg>"},{"id":"cpu","name":"Cpu","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 6a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -12\" />\u003cpath d=\"M9 9h6v6h-6l0 -6\" />\u003cpath d=\"M3 10h2\" />\u003cpath d=\"M3 14h2\" />\u003cpath d=\"M10 3v2\" />\u003cpath d=\"M14 3v2\" />\u003cpath d=\"M21 10h-2\" />\u003cpath d=\"M21 14h-2\" />\u003cpath d=\"M14 21v-2\" />\u003cpath d=\"M10 21v-2\" />\u003c/svg>"},{"id":"cpu-2","name":"Cpu 2","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 6a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -12\" />\u003cpath d=\"M8 10v-2h2m6 6v2h-2m-4 0h-2v-2m8 -4v-2h-2\" />\u003cpath d=\"M3 10h2\" />\u003cpath d=\"M3 14h2\" />\u003cpath d=\"M10 3v2\" />\u003cpath d=\"M14 3v2\" />\u003cpath d=\"M21 10h-2\" />\u003cpath d=\"M21 14h-2\" />\u003cpath d=\"M14 21v-2\" />\u003cpath d=\"M10 21v-2\" />\u003c/svg>"},{"id":"battery-charging","name":"Battery Charging","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M16 7h1a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-2\" />\u003cpath d=\"M8 7h-2a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h1\" />\u003cpath d=\"M12 8l-2 4h3l-2 4\" />\u003c/svg>"},{"id":"plug","name":"Plug","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054\" />\u003cpath d=\"M4 20l3.5 -3.5\" />\u003cpath d=\"M15 4l-3.5 3.5\" />\u003cpath d=\"M20 9l-3.5 3.5\" />\u003c/svg>"},{"id":"plug-connected","name":"Plug Connected","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5\" />\u003cpath d=\"M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5\" />\u003cpath d=\"M3 21l2.5 -2.5\" />\u003cpath d=\"M18.5 5.5l2.5 -2.5\" />\u003cpath d=\"M10 11l-2 2\" />\u003cpath d=\"M13 14l-2 2\" />\u003c/svg>"},{"id":"bolt","name":"Bolt","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11\" />\u003c/svg>"},{"id":"globe","name":"Globe","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M7 9a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\u003cpath d=\"M5.75 15a8.015 8.015 0 1 0 9.25 -13\" />\u003cpath d=\"M11 17v4\" />\u003cpath d=\"M7 21h8\" />\u003c/svg>"},{"id":"world","name":"World","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\u003cpath d=\"M3.6 9h16.8\" />\u003cpath d=\"M3.6 15h16.8\" />\u003cpath d=\"M11.5 3a17 17 0 0 0 0 18\" />\u003cpath d=\"M12.5 3a17 17 0 0 1 0 18\" />\u003c/svg>"},{"id":"browser","name":"Browser","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M4 8h16\" />\u003cpath d=\"M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12\" />\u003cpath d=\"M8 4v4\" />\u003c/svg>"},{"id":"terminal-2","name":"Terminal 2","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M8 9l3 3l-3 3\" />\u003cpath d=\"M13 15l3 0\" />\u003cpath d=\"M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -12\" />\u003c/svg>"},{"id":"folder","name":"Folder","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2\" />\u003c/svg>"},{"id":"file-database","name":"File Database","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M8 12.75a4 1.75 0 1 0 8 0a4 1.75 0 1 0 -8 0\" />\u003cpath d=\"M8 12.5v3.75c0 .966 1.79 1.75 4 1.75s4 -.784 4 -1.75v-3.75\" />\u003cpath d=\"M14 3v4a1 1 0 0 0 1 1h4\" />\u003cpath d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" />\u003c/svg>"},{"id":"file-code","name":"File Code","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M14 3v4a1 1 0 0 0 1 1h4\" />\u003cpath d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" />\u003cpath d=\"M10 13l-1 2l1 2\" />\u003cpath d=\"M14 13l1 2l-1 2\" />\u003c/svg>"},{"id":"lock","name":"Lock","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6\" />\u003cpath d=\"M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0\" />\u003cpath d=\"M8 11v-4a4 4 0 1 1 8 0v4\" />\u003c/svg>"},{"id":"shield-lock","name":"Shield Lock","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3\" />\u003cpath d=\"M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\u003cpath d=\"M12 12l0 2.5\" />\u003c/svg>"},{"id":"key","name":"Key","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0\" />\u003cpath d=\"M15 9h.01\" />\u003c/svg>"},{"id":"user","name":"User","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\u003cpath d=\"M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" />\u003c/svg>"},{"id":"users","name":"Users","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\u003cpath d=\"M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" />\u003cpath d=\"M16 3.13a4 4 0 0 1 0 7.75\" />\u003cpath d=\"M21 21v-2a4 4 0 0 0 -3 -3.85\" />\u003c/svg>"},{"id":"building","name":"Building","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 21l18 0\" />\u003cpath d=\"M9 8l1 0\" />\u003cpath d=\"M9 12l1 0\" />\u003cpath d=\"M9 16l1 0\" />\u003cpath d=\"M14 8l1 0\" />\u003cpath d=\"M14 12l1 0\" />\u003cpath d=\"M14 16l1 0\" />\u003cpath d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16\" />\u003c/svg>"},{"id":"building-factory","name":"Building Factory","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M4 21c1.147 -4.02 1.983 -8.027 2 -12h6c.017 3.973 .853 7.98 2 12\" />\u003cpath d=\"M12.5 13h4.5c.025 2.612 .894 5.296 2 8\" />\u003cpath d=\"M9 5a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1\" />\u003cpath d=\"M3 21l19 0\" />\u003c/svg>"},{"id":"mail","name":"Mail","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10\" />\u003cpath d=\"M3 7l9 6l9 -6\" />\u003c/svg>"},{"id":"camera","name":"Camera","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2\" />\u003cpath d=\"M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />\u003c/svg>"},{"id":"microphone","name":"Microphone","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M9 5a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3l0 -5\" />\u003cpath d=\"M5 10a7 7 0 0 0 14 0\" />\u003cpath d=\"M8 21l8 0\" />\u003cpath d=\"M12 17l0 4\" />\u003c/svg>"},{"id":"keyboard","name":"Keyboard","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M2 8a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2l0 -8\" />\u003cpath d=\"M6 10l0 .01\" />\u003cpath d=\"M10 10l0 .01\" />\u003cpath d=\"M14 10l0 .01\" />\u003cpath d=\"M18 10l0 .01\" />\u003cpath d=\"M6 14l0 .01\" />\u003cpath d=\"M18 14l0 .01\" />\u003cpath d=\"M10 14l4 .01\" />\u003c/svg>"},{"id":"mouse","name":"Mouse","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M6 7a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-4a4 4 0 0 1 -4 -4l0 -10\" />\u003cpath d=\"M12 7l0 4\" />\u003c/svg>"},{"id":"sitemap","name":"Sitemap","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M3 17a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2\" />\u003cpath d=\"M15 17a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2\" />\u003cpath d=\"M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2\" />\u003cpath d=\"M6 15v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1\" />\u003cpath d=\"M12 9l0 3\" />\u003c/svg>"},{"id":"hierarchy-2","name":"Hierarchy 2","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M10 3h4v4h-4l0 -4\" />\u003cpath d=\"M3 17h4v4h-4l0 -4\" />\u003cpath d=\"M17 17h4v4h-4l0 -4\" />\u003cpath d=\"M7 17l5 -4l5 4\" />\u003cpath d=\"M12 7l0 6\" />\u003c/svg>"},{"id":"git-branch","name":"Git Branch","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\u003cpath d=\"M5 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\u003cpath d=\"M15 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\u003cpath d=\"M7 8l0 8\" />\u003cpath d=\"M9 18h6a2 2 0 0 0 2 -2v-5\" />\u003cpath d=\"M14 14l3 -3l3 3\" />\u003c/svg>"},{"id":"api","name":"Api","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M4 13h5\" />\u003cpath d=\"M12 16v-8h3a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-3\" />\u003cpath d=\"M20 8v8\" />\u003cpath d=\"M9 16v-5.5a2.5 2.5 0 0 0 -5 0v5.5\" />\u003c/svg>"},{"id":"webhook","name":"Webhook","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M4.876 13.61a4 4 0 1 0 6.124 3.39h6\" />\u003cpath d=\"M15.066 20.502a4 4 0 1 0 1.934 -7.502c-.706 0 -1.424 .179 -2 .5l-3 -5.5\" />\u003cpath d=\"M16 8a4 4 0 1 0 -8 0c0 1.506 .77 2.818 2 3.5l-3 5.5\" />\u003c/svg>"},{"id":"link","name":"Link","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M9 15l6 -6\" />\u003cpath d=\"M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464\" />\u003cpath d=\"M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463\" />\u003c/svg>"},{"id":"topology-star","name":"Topology Star","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M8 18a2 2 0 1 0 -4 0a2 2 0 0 0 4 0\" />\u003cpath d=\"M20 6a2 2 0 1 0 -4 0a2 2 0 0 0 4 0\" />\u003cpath d=\"M8 6a2 2 0 1 0 -4 0a2 2 0 0 0 4 0\" />\u003cpath d=\"M20 18a2 2 0 1 0 -4 0a2 2 0 0 0 4 0\" />\u003cpath d=\"M14 12a2 2 0 1 0 -4 0a2 2 0 0 0 4 0\" />\u003cpath d=\"M7.5 7.5l3 3\" />\u003cpath d=\"M7.5 16.5l3 -3\" />\u003cpath d=\"M13.5 13.5l3 3\" />\u003cpath d=\"M16.5 7.5l-3 3\" />\u003c/svg>"},{"id":"dashboard","name":"Dashboard","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M10 13a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\u003cpath d=\"M13.45 11.55l2.05 -2.05\" />\u003cpath d=\"M6.4 20a9 9 0 1 1 11.2 0l-11.2 0\" />\u003c/svg>"},{"id":"settings","name":"Settings","kinds":[],"tags":["infrastructure"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" >\u003cpath d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065\" />\u003cpath d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />\u003c/svg>"}],"note":"Curated diagram-relevant subset of tabler-icons (outline style); the full set is not vendored.","license":"MIT","attribution":"Tabler Icons, Copyright (c) 2020-2026 Paweł Kuna — https://tabler.io","source":"https://github.com/tabler/tabler-icons"},{"id":"iconoir-infra@1","name":"Iconoir infrastructure & development selection (MIT)","icons":[{"id":"cloud","name":"Cloud","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 4C6 4 6 8 6 10C4.33333 10 1 11 1 15C1 19 4.33333 20 6 20H18C19.6667 20 23 19 23 15C23 11 19.6667 10 18 10C18 8 18 4 12 4Z\" stroke=\"currentColor\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"cloud-sync","name":"Cloud Sync","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M20 17.6073C21.4937 17.0221 23 15.6889 23 13C23 9 19.6667 8 18 8C18 6 18 2 12 2C6 2 6 6 6 8C4.33333 8 1 9 1 13C1 15.6889 2.50628 17.0221 4 17.6073\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7.58059 19.4874L9.34836 21.2552C10.9105 22.8173 13.4431 22.8173 15.0052 21.2552L15.3588 20.9016\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7.93413 21.9623L7.58058 19.4874L10.0554 19.841L7.93413 21.9623Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M16.2981 16.9016L14.5303 15.1339C12.9682 13.5718 10.4355 13.5718 8.87345 15.1339L8.51989 15.4874\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M15.9445 14.4268L16.2981 16.9017L13.8232 16.5481L15.9445 14.4268Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"cloud-upload","name":"Cloud Upload","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 22V13M12 13L15.5 16.5M12 13L8.5 16.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M20 17.6073C21.4937 17.0221 23 15.6889 23 13C23 9 19.6667 8 18 8C18 6 18 2 12 2C6 2 6 6 6 8C4.33333 8 1 9 1 13C1 15.6889 2.50628 17.0221 4 17.6073\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"cloud-download","name":"Cloud Download","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 13V22M12 22L15.5 18.5M12 22L8.5 18.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M20 17.6073C21.4937 17.0221 23 15.6889 23 13C23 9 19.6667 8 18 8C18 6 18 2 12 2C6 2 6 6 6 8C4.33333 8 1 9 1 13C1 15.6889 2.50628 17.0221 4 17.6073\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"cloud-check","name":"Cloud Check","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M8 18L11 21L16 16\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M20 17.6073C21.4937 17.0221 23 15.6889 23 13C23 9 19.6667 8 18 8C18 6 18 2 12 2C6 2 6 6 6 8C4.33333 8 1 9 1 13C1 15.6889 2.50628 17.0221 4 17.6073\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"database","name":"Database","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M5 12V18C5 18 5 21 12 21C19 21 19 18 19 18V12\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003cpath d=\"M5 6V12C5 12 5 15 12 15C19 15 19 12 19 12V6\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003cpath d=\"M12 3C19 3 19 6 19 6C19 6 19 9 12 9C5 9 5 6 5 6C5 6 5 3 12 3Z\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003c/svg>"},{"id":"database-backup","name":"Database Backup","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M4 6V12C4 12 4 15 11 15C11.5925 15 12.1349 14.9785 12.6313 14.9392\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 6V12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 3C18 3 18 6 18 6C18 6 18 9 11 9C4 9 4 6 4 6C4 6 4 3 11 3Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 21C4 21 4 18 4 18V12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M22.6664 17.6667C22.0476 16.097 20.6345 15 18.9901 15C17.2318 15 15.7377 16.2545 15.1968 18\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M20.9951 17.6667H22.6664V17.6667C22.8507 17.6667 23.0001 17.5173 23.0001 17.333V15.4445\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M15.3336 20.3333C15.9524 21.903 17.3655 23 19.0099 23C20.7682 23 22.2623 21.7455 22.8032 20\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M17.0049 20.3333H15.3336V20.3333C15.1493 20.3333 14.9999 20.4827 14.9999 20.667V22.5555\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"database-search","name":"Database Search","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M20.5 20.5L22 22\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M16 18.5C16 19.8807 17.1193 21 18.5 21C19.1916 21 19.8175 20.7192 20.2701 20.2654C20.7211 19.8132 21 19.1892 21 18.5C21 17.1193 19.8807 16 18.5 16C17.1193 16 16 17.1193 16 18.5Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M4 6V12C4 12 4 15 11 15C18 15 18 12 18 12V6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 3C18 3 18 6 18 6C18 6 18 9 11 9C4 9 4 6 4 6C4 6 4 3 11 3Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 21C4 21 4 18 4 18V12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"database-script","name":"Database Script","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M22 14V6C22 4.34315 20.6569 3 19 3H9C7.34315 3 6 4.34315 6 6V13\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 21H6C3.79086 21 2 19.2091 2 17C2 14.7909 3.79086 13 6 13H17H18C15.7909 13 14 14.7909 14 17C14 19.2091 15.7909 21 18 21C20.2091 21 22 19.2091 22 17V14\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"database-check","name":"Database Check","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M14 19L17 22L22 17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M4 6V12C4 12 4 15 11 15C18 15 18 12 18 12V6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 3C18 3 18 6 18 6C18 6 18 9 11 9C4 9 4 6 4 6C4 6 4 3 11 3Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 21C4 21 4 18 4 18V12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"component","name":"Component","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M5.21173 15.1113L2.52473 12.4243C2.29041 12.1899 2.29041 11.8101 2.52473 11.5757L5.21173 8.88873C5.44605 8.65442 5.82595 8.65442 6.06026 8.88873L8.74727 11.5757C8.98158 11.8101 8.98158 12.1899 8.74727 12.4243L6.06026 15.1113C5.82595 15.3456 5.44605 15.3456 5.21173 15.1113Z\" stroke=\"currentColor\"/>\u003cpath d=\"M11.5757 21.475L8.88874 18.788C8.65443 18.5537 8.65443 18.1738 8.88874 17.9395L11.5757 15.2525C11.8101 15.0182 12.19 15.0182 12.4243 15.2525L15.1113 17.9395C15.3456 18.1738 15.3456 18.5537 15.1113 18.788L12.4243 21.475C12.19 21.7094 11.8101 21.7094 11.5757 21.475Z\" stroke=\"currentColor\"/>\u003cpath d=\"M11.5757 8.7475L8.88874 6.06049C8.65443 5.82618 8.65443 5.44628 8.88874 5.21197L11.5757 2.52496C11.8101 2.29065 12.19 2.29065 12.4243 2.52496L15.1113 5.21197C15.3456 5.44628 15.3456 5.82618 15.1113 6.06049L12.4243 8.7475C12.19 8.98181 11.8101 8.98181 11.5757 8.7475Z\" stroke=\"currentColor\"/>\u003cpath d=\"M17.9396 15.1113L15.2526 12.4243C15.0183 12.1899 15.0183 11.8101 15.2526 11.5757L17.9396 8.88873C18.174 8.65442 18.5539 8.65442 18.7882 8.88873L21.4752 11.5757C21.7095 11.8101 21.7095 12.1899 21.4752 12.4243L18.7882 15.1113C18.5539 15.3456 18.174 15.3456 17.9396 15.1113Z\" stroke=\"currentColor\"/>\u003c/svg>"},{"id":"code","name":"Code","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M13.5 6L10 18.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6.5 8.5L3 12L6.5 15.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M17.5 8.5L21 12L17.5 15.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"code-brackets","name":"Code Brackets","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M9.00001 21L8.00001 21C6.89544 21 6.00001 20.1057 6.00001 19.0011C6.00001 17.4501 6.00001 15.3443 6 14C6 13 4.5 12 4.5 12C4.5 12 6.00001 11 6.00001 10C6.00001 8.827 6.00001 6.62207 6.00001 4.99914C6.00001 3.89457 6.89544 3 8.00001 3L9.00001 3\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M15 21L16 21C17.1046 21 18 20.1057 18 19.0011C18 17.4501 18 15.3443 18 14C18 13 19.5 12 19.5 12C19.5 12 18 11 18 10C18 8.827 18 6.62207 18 4.99914C18 3.89457 17.1046 3 16 3L15 3\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"bug","name":"Bug","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 21C8.13401 21 5 16.9706 5 12C5 7.02944 8.13401 3 12 3C15.866 3 19 7.02944 19 12C19 16.9706 15.866 21 12 21Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 17.5L20 19.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19 9.5L21 8.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M5 9.5L3 8.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 8C18 8 15 9 12 9M6 8C6 8 9 9 12 9M12 9V21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M5 14H2\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M22 14H19\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 17.5L4 19.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"app-window","name":"App Window","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M2 19V5C2 3.89543 2.89543 3 4 3H20C21.1046 3 22 3.89543 22 5V19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19Z\" stroke=\"currentColor\"/>\u003cpath d=\"M2 7L22 7\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M5 5.01L5.01 4.99889\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M8 5.01L8.01 4.99889\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M11 5.01L11.01 4.99889\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"archive","name":"Archive","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M7 6L17 6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7 9L17 9\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M9 17H15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M3 12H2.6C2.26863 12 2 12.2686 2 12.6V21.4C2 21.7314 2.26863 22 2.6 22H21.4C21.7314 22 22 21.7314 22 21.4V12.6C22 12.2686 21.7314 12 21.4 12H21M3 12V2.6C3 2.26863 3.26863 2 3.6 2H20.4C20.7314 2 21 2.26863 21 2.6V12M3 12H21\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003c/svg>"},{"id":"attachment","name":"Attachment","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M21.4383 11.6622L12.2483 20.8522C11.1225 21.9781 9.59552 22.6106 8.00334 22.6106C6.41115 22.6106 4.88418 21.9781 3.75834 20.8522C2.63249 19.7264 2 18.1994 2 16.6072C2 15.015 2.63249 13.4881 3.75834 12.3622L12.9483 3.17222C13.6989 2.42166 14.7169 2 15.7783 2C16.8398 2 17.8578 2.42166 18.6083 3.17222C19.3589 3.92279 19.7806 4.94077 19.7806 6.00222C19.7806 7.06368 19.3589 8.08166 18.6083 8.83222L9.40834 18.0222C9.03306 18.3975 8.52406 18.6083 7.99334 18.6083C7.46261 18.6083 6.95362 18.3975 6.57834 18.0222C6.20306 17.6469 5.99222 17.138 5.99222 16.6072C5.99222 16.0765 6.20306 15.5675 6.57834 15.1922L15.0683 6.71222\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"bell","name":"Bell","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M18 8.4C18 6.70261 17.3679 5.07475 16.2426 3.87452C15.1174 2.67428 13.5913 2 12 2C10.4087 2 8.88258 2.67428 7.75736 3.87452C6.63214 5.07475 6 6.70261 6 8.4C6 15.8667 3 18 3 18H21C21 18 18 15.8667 18 8.4Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"bookmark","name":"Bookmark","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21L13.0815 17.1953C12.4227 16.7717 11.5773 16.7717 10.9185 17.1953L5 21Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"calendar","name":"Calendar","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M15 4V2M15 4V6M15 4H10.5M3 10V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V10H3Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M3 10V6C3 4.89543 3.89543 4 5 4H7\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7 2V6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M21 10V6C21 4.89543 20.1046 4 19 4H18.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"map-pin","name":"Map Pin","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M20 10C20 14.4183 12 22 12 22C12 22 4 14.4183 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10Z\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003cpath d=\"M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z\" fill=\"currentColor\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"send","name":"Send","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M22 12L3 20L6.5625 12L3 4L22 12Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6.5 12L22 12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"filter","name":"Filter","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M3.99961 3H19.9997C20.552 3 20.9997 3.44764 20.9997 3.99987L20.9999 5.58569C21 5.85097 20.8946 6.10538 20.707 6.29295L14.2925 12.7071C14.105 12.8946 13.9996 13.149 13.9996 13.4142L13.9996 19.7192C13.9996 20.3698 13.3882 20.8472 12.7571 20.6894L10.7571 20.1894C10.3119 20.0781 9.99961 19.6781 9.99961 19.2192L9.99961 13.4142C9.99961 13.149 9.89425 12.8946 9.70672 12.7071L3.2925 6.29289C3.10496 6.10536 2.99961 5.851 2.99961 5.58579V4C2.99961 3.44772 3.44732 3 3.99961 3Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"search","name":"Search","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M17 17L21 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M3 11C3 15.4183 6.58172 19 11 19C13.213 19 15.2161 18.1015 16.6644 16.6493C18.1077 15.2022 19 13.2053 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"graph-up","name":"Graph Up","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M20 20H4V4\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M4 16.5L12 9L15 12L19.5 7.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"rocket","name":"Rocket","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M16.0614 10.4037L14 17L10 17L7.93865 10.4037C7.35085 8.52273 7.72417 6.47307 8.93738 4.92015L11.5272 1.6052C11.7674 1.29772 12.2326 1.29772 12.4728 1.6052L15.0626 4.92015C16.2758 6.47307 16.6491 8.52273 16.0614 10.4037Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M10 20C10 22 12 23 12 23C12 23 14 22 14 20\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M8.5 12.5C5 15 7 19 7 19L10 17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M15.9312 12.5C19.4312 15 17.4312 19 17.4312 19L14.4312 17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 11C10.8954 11 10 10.1046 10 9C10 7.89543 10.8954 7 12 7C13.1046 7 14 7.89543 14 9C14 10.1046 13.1046 11 12 11Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"puzzle","name":"Puzzle","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M4 14V18.4C4 18.7314 4.26863 19 4.6 19H10\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19 14V18.4C19 18.7314 18.7314 19 18.4 19H14\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M14 5H18.4C18.7314 5 19 5.26863 19 5.6V10\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M4 10V5.6C4 5.26863 4.26863 5 4.6 5H10\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M14 19V20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20V19\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M4 10H5C6.10457 10 7 10.8954 7 12C7 13.1046 6.10457 14 5 14H4\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19 10H20C21.1046 10 22 10.8954 22 12C22 13.1046 21.1046 14 20 14H19\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M14 5V4C14 2.89543 13.1046 2 12 2C10.8954 2 10 2.89543 10 4V5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"electronics-chip","name":"Electronics Chip","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M7 19.4V4.6C7 4.26863 7.26863 4 7.6 4H16.4C16.7314 4 17 4.26863 17 4.6V19.4C17 19.7314 16.7314 20 16.4 20H7.6C7.26863 20 7 19.7314 7 19.4Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M14 20V22.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M10 20V22.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M14 4V1.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M10 4V1.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7 12H4.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19.5 12H17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7 6.5H4.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19.5 6.5H17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7 17.5H4.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19.5 17.5H17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"computer","name":"Computer","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M2 21L17 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M21 21L22 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M2 16.4V3.6C2 3.26863 2.26863 3 2.6 3H21.4C21.7314 3 22 3.26863 22 3.6V16.4C22 16.7314 21.7314 17 21.4 17H2.6C2.26863 17 2 16.7314 2 16.4Z\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003c/svg>"},{"id":"hard-drive","name":"Hard Drive","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M10 17.01L10.01 16.9989\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 17.01L6.01 16.9989\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M2 13V20.4C2 20.7314 2.26863 21 2.6 21H21.4C21.7314 21 22 20.7314 22 20.4V13M2 13H22M2 13L4.87172 3.42759C4.94786 3.1738 5.18145 3 5.44642 3H18.5536C18.8185 3 19.0521 3.1738 19.1283 3.42759L22 13\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003c/svg>"},{"id":"flash","name":"Flash","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M13 10V3L5 14H11V21L19 10H13Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"battery-charging","name":"Battery Charging","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M23 10V14\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M1 16V8C1 6.89543 1.89543 6 3 6H18C19.1046 6 20 6.89543 20 8V16C20 17.1046 19.1046 18 18 18H3C1.89543 18 1 17.1046 1 16Z\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003cpath d=\"M10.1667 9L8.5 12H12.5L10.8333 15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"wifi","name":"Wifi","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 19.51L12.01 19.4989\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M2 8C8 3.5 16 3.5 22 8\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M5 12C9 9 15 9 19 12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M8.5 15.5C10.7504 14.1 13.2498 14.0996 15.5001 15.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"antenna","name":"Antenna","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 5C12.5523 5 13 4.55228 13 4C13 3.44772 12.5523 3 12 3C11.4477 3 11 3.44772 11 4C11 4.55228 11.4477 5 12 5Z\" fill=\"currentColor\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M16 1C16 1 17.5 2 17.5 4C17.5 6 16 7 16 7\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M8 1C8 1 6.5 2 6.5 4C6.5 6 8 7 8 7\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M7 23L8.11111 19M17 23L15.8889 19M14.5 14L12 5L9.5 14M14.5 14H9.5M14.5 14L15.8889 19M9.5 14L8.11111 19M8.11111 19H15.8889\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"globe","name":"Globe","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M2.5 12.5L8 14.5L7 18L8 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M17 20.5L16.5 18L14 17V13.5L17 12.5L21.5 13\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19 5.5L18.5 7L15 7.5V10.5L17.5 9.5H19.5L21.5 10.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M2.5 10.5L5 8.5L7.5 8L9.5 5L8.5 3\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"user","name":"User","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M5 20V19C5 15.134 8.13401 12 12 12V12C15.866 12 19 15.134 19 19V20\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"community","name":"Community","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M7 18V17C7 14.2386 9.23858 12 12 12V12C14.7614 12 17 14.2386 17 17V18\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M1 18V17C1 15.3431 2.34315 14 4 14V14\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M23 18V17C23 15.3431 21.6569 14 20 14V14\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M4 14C5.10457 14 6 13.1046 6 12C6 10.8954 5.10457 10 4 10C2.89543 10 2 10.8954 2 12C2 13.1046 2.89543 14 4 14Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M20 14C21.1046 14 22 13.1046 22 12C22 10.8954 21.1046 10 20 10C18.8954 10 18 10.8954 18 12C18 13.1046 18.8954 14 20 14Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"industry","name":"Industry","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M18 10C18 9 17 8 15 8C14.6978 8 14.355 8 14.0002 8C12.3434 8 11 6.65685 11 5V2\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 21H21V12H18V16.5M18 21V16.5M18 21L3 21V17L6.5 14L10.5 16.5L14.5 14L18 16.5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M21 10C21 4 17 4 17 4C17 4 21 4.5 21 2\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"network","name":"Network","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003crect x=\"3\" y=\"2\" width=\"7\" height=\"5\" rx=\"0.6\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003crect x=\"8.5\" y=\"17\" width=\"7\" height=\"5\" rx=\"0.6\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003crect x=\"14\" y=\"2\" width=\"7\" height=\"5\" rx=\"0.6\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003cpath d=\"M6.5 7V10.5C6.5 11.6046 7.39543 12.5 8.5 12.5H15.5C16.6046 12.5 17.5 11.6046 17.5 10.5V7\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003cpath d=\"M12 12.5V17\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003c/svg>"},{"id":"home-simple","name":"Home Simple","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M17 21H7C4.79086 21 3 19.2091 3 17V10.7076C3 9.30887 3.73061 8.01175 4.92679 7.28679L9.92679 4.25649C11.2011 3.48421 12.7989 3.48421 14.0732 4.25649L19.0732 7.28679C20.2694 8.01175 21 9.30887 21 10.7076V17C21 19.2091 19.2091 21 17 21Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M9 17H15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"settings","name":"Settings","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"wrench","name":"Wrench","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg viewBox=\"0 0 24 24\" stroke-width=\"1.5\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M10.0503 10.6066L2.97923 17.6777C2.19818 18.4587 2.19818 19.725 2.97923 20.5061V20.5061C3.76027 21.2871 5.0266 21.2871 5.80765 20.5061L12.8787 13.435\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M10.0502 10.6066C9.20638 8.45358 9.37134 5.6286 11.1109 3.88909C12.8504 2.14957 16.0606 1.76777 17.8284 2.82843L14.7877 5.8691L14.5051 8.98014L17.6161 8.69753L20.6568 5.65685C21.7175 7.42462 21.3357 10.6349 19.5961 12.3744C17.8566 14.1139 15.0316 14.2789 12.8786 13.435\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"cube","name":"Cube","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M21 7.35304L21 16.647C21 16.8649 20.8819 17.0656 20.6914 17.1715L12.2914 21.8381C12.1102 21.9388 11.8898 21.9388 11.7086 21.8381L3.30861 17.1715C3.11814 17.0656 3 16.8649 3 16.647L2.99998 7.35304C2.99998 7.13514 3.11812 6.93437 3.3086 6.82855L11.7086 2.16188C11.8898 2.06121 12.1102 2.06121 12.2914 2.16188L20.6914 6.82855C20.8818 6.93437 21 7.13514 21 7.35304Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M3.52844 7.29357L11.7086 11.8381C11.8898 11.9388 12.1102 11.9388 12.2914 11.8381L20.5 7.27777\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 21L12 12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"packages","name":"Packages","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M9.99998 15L9.99999 19C10 20.1046 9.10457 21 7.99999 21H4C2.89543 21 2 20.1046 2 19V15C2 13.8954 2.89543 13 4 13H7.99998C9.10455 13 9.99998 13.8954 9.99998 15Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M16 4.99999L16 8.99999C16 10.1046 15.1046 11 14 11H10C8.89543 11 8 10.1046 8 9V5C8 3.89543 8.89543 3 10 3H14C15.1045 3 16 3.89543 16 4.99999Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M22 15L22 19C22 20.1046 21.1046 21 20 21H16C14.8954 21 14 20.1046 14 19V15C14 13.8954 14.8954 13 16 13H20C21.1045 13 22 13.8954 22 15Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 16V13\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 6V3\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 16V13\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"terminal","name":"Terminal","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M13 17H20\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M5 7L10 12L5 17\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"qr-code","name":"Qr Code","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M15 12L15 15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 3V6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 12L18 15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 18L21 18\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 21H21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 12H9\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 6.01111L6.01 6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 12.0111L12.01 12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M3 12.0111L3.01 12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 9.01111L12.01 9\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 15.0111L12.01 15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M15 21.0111L15.01 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 21.0111L12.01 21\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M21 12.0111L21.01 12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M21 15.0111L21.01 15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 6.01111L18.01 6\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M9 3.6V8.4C9 8.73137 8.73137 9 8.4 9H3.6C3.26863 9 3 8.73137 3 8.4V3.6C3 3.26863 3.26863 3 3.6 3H8.4C8.73137 3 9 3.26863 9 3.6Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M21 3.6V8.4C21 8.73137 20.7314 9 20.4 9H15.6C15.2686 9 15 8.73137 15 8.4V3.6C15 3.26863 15.2686 3 15.6 3H20.4C20.7314 3 21 3.26863 21 3.6Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 18.0111L6.01 18\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M9 15.6V20.4C9 20.7314 8.73137 21 8.4 21H3.6C3.26863 21 3 20.7314 3 20.4V15.6C3 15.2686 3.26863 15 3.6 15H8.4C8.73137 15 9 15.2686 9 15.6Z\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"barcode","name":"Barcode","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M5 19L5 5L6 5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M12 19L12 5L13 5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M9 5L9 19\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M16 5L16 19\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M19 5L19 19\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M6 5L6 19H5\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M13 5L13 19H12\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"},{"id":"lock-square","name":"Lock Square","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M14.6667 12H15.4C15.7314 12 16 12.2686 16 12.6V16.4C16 16.7314 15.7314 17 15.4 17H8.6C8.26863 17 8 16.7314 8 16.4V12.6C8 12.2686 8.26863 12 8.6 12H9.33333M14.6667 12V9.5C14.6667 8.66667 14.1333 7 12 7C9.86667 7 9.33333 8.66667 9.33333 9.5V12M14.6667 12H9.33333\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\u003c/svg>"},{"id":"key","name":"Key","kinds":[],"tags":["infrastructure","development"],"svg":"\u003csvg stroke-width=\"1.5\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\u003cpath d=\"M10 12C10 14.2091 8.20914 16 6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C8.20914 8 10 9.79086 10 12ZM10 12H22V15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003cpath d=\"M18 12V15\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\u003c/svg>"}],"note":"Curated diagram-relevant subset of iconoir (regular style), chosen to complement the Tabler selection; the full set is not vendored.","license":"MIT","attribution":"Iconoir, Copyright (c) 2021 Luca Burgio — https://iconoir.com","source":"https://github.com/iconoir-icons/iconoir"},{"id":"generic-demo@1","name":"Generic demo set (agent-drawn)","icons":[{"id":"cloud","name":"Cloud","kinds":["network.bus"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\">\u003cpath d=\"M6.5 17a4.5 4.5 0 1 1 .4-8.98A6 6 0 0 1 18.5 10a3.75 3.75 0 0 1-.5 7z\"/>\u003c/svg>"},{"id":"server","name":"Server","kinds":["network.server"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\">\u003crect x=\"4\" y=\"4\" width=\"16\" height=\"6\" rx=\"1\"/>\u003crect x=\"4\" y=\"14\" width=\"16\" height=\"6\" rx=\"1\"/>\u003ccircle cx=\"7\" cy=\"7\" r=\".8\" fill=\"currentColor\"/>\u003ccircle cx=\"7\" cy=\"17\" r=\".8\" fill=\"currentColor\"/>\u003c/svg>"},{"id":"database","name":"Database","kinds":["network.rack"],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\">\u003cellipse cx=\"12\" cy=\"5.5\" rx=\"7\" ry=\"2.5\"/>\u003cpath d=\"M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13\"/>\u003cpath d=\"M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5\"/>\u003c/svg>"},{"id":"user","name":"User","kinds":[],"svg":"\u003csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\">\u003ccircle cx=\"12\" cy=\"8\" r=\"3.5\"/>\u003cpath d=\"M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5\"/>\u003c/svg>"}],"license":"GPL-2.0-or-later","attribution":"DDN contributors (agent-drawn artwork)","source":"https://github.com/scratchbird-software-inc/Diagram-Design-Notation"},{"id":"ddn-pack-general@1","name":"DDN general-purpose selection (Tabler, MIT)","icons":[{"id":"user-check","name":"User check","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  \u003cpath d=\"M6 21v-2a4 4 0 0 1 4 -4h4\" />\n  \u003cpath d=\"M15 19l2 2l4 -4\" />\n\u003c/svg>"},{"id":"user-cog","name":"User cog","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  \u003cpath d=\"M6 21v-2a4 4 0 0 1 4 -4h2.5\" />\n  \u003cpath d=\"M17.001 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M19.001 15.5v1.5\" />\n  \u003cpath d=\"M19.001 21v1.5\" />\n  \u003cpath d=\"M22.032 17.25l-1.299 .75\" />\n  \u003cpath d=\"M17.27 20l-1.3 .75\" />\n  \u003cpath d=\"M15.97 17.25l1.3 .75\" />\n  \u003cpath d=\"M20.733 20l1.3 .75\" />\n\u003c/svg>"},{"id":"user-plus","name":"User plus","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  \u003cpath d=\"M16 19h6\" />\n  \u003cpath d=\"M19 16v6\" />\n  \u003cpath d=\"M6 21v-2a4 4 0 0 1 4 -4h4\" />\n\u003c/svg>"},{"id":"user-x","name":"User x","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  \u003cpath d=\"M6 21v-2a4 4 0 0 1 4 -4h3.5\" />\n  \u003cpath d=\"M22 22l-5 -5\" />\n  \u003cpath d=\"M17 22l5 -5\" />\n\u003c/svg>"},{"id":"user-search","name":"User search","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0\" />\n  \u003cpath d=\"M6 21v-2a4 4 0 0 1 4 -4h1.5\" />\n  \u003cpath d=\"M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\n  \u003cpath d=\"M20.2 20.2l1.8 1.8\" />\n\u003c/svg>"},{"id":"id","name":"Id","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -10\" />\n  \u003cpath d=\"M7 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M15 8l2 0\" />\n  \u003cpath d=\"M15 12l2 0\" />\n  \u003cpath d=\"M7 16l10 0\" />\n\u003c/svg>"},{"id":"id-badge","name":"Id badge","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 6a3 3 0 0 1 3 -3h8a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3l0 -12\" />\n  \u003cpath d=\"M10 13a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M10 6h4\" />\n  \u003cpath d=\"M9 18h6\" />\n\u003c/svg>"},{"id":"address-book","name":"Address book","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2\" />\n  \u003cpath d=\"M10 16h6\" />\n  \u003cpath d=\"M11 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M4 8h3\" />\n  \u003cpath d=\"M4 12h3\" />\n  \u003cpath d=\"M4 16h3\" />\n\u003c/svg>"},{"id":"hierarchy","name":"Hierarchy","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M3 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M17 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M6.5 17.5l5.5 -4.5l5.5 4.5\" />\n  \u003cpath d=\"M12 7l0 6\" />\n\u003c/svg>"},{"id":"affiliate","name":"Affiliate","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5.931 6.936l1.275 4.249m5.607 5.609l4.251 1.275\" />\n  \u003cpath d=\"M11.683 12.317l5.759 -5.759\" />\n  \u003cpath d=\"M4 5.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0\" />\n  \u003cpath d=\"M17 5.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0\" />\n  \u003cpath d=\"M17 18.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0\" />\n  \u003cpath d=\"M4 15.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0\" />\n\u003c/svg>"},{"id":"briefcase","name":"Briefcase","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9\" />\n  \u003cpath d=\"M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2\" />\n  \u003cpath d=\"M12 12l0 .01\" />\n  \u003cpath d=\"M3 13a20 20 0 0 0 18 0\" />\n\u003c/svg>"},{"id":"building-skyscraper","name":"Building skyscraper","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21l18 0\" />\n  \u003cpath d=\"M5 21v-14l8 -4v18\" />\n  \u003cpath d=\"M19 21v-10l-6 -4\" />\n  \u003cpath d=\"M9 9l0 .01\" />\n  \u003cpath d=\"M9 12l0 .01\" />\n  \u003cpath d=\"M9 15l0 .01\" />\n  \u003cpath d=\"M9 18l0 .01\" />\n\u003c/svg>"},{"id":"building-community","name":"Building community","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8\" />\n  \u003cpath d=\"M13 7l0 .01\" />\n  \u003cpath d=\"M17 7l0 .01\" />\n  \u003cpath d=\"M17 11l0 .01\" />\n  \u003cpath d=\"M17 15l0 .01\" />\n\u003c/svg>"},{"id":"building-store","name":"Building store","kinds":[],"tags":["general","people"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21l18 0\" />\n  \u003cpath d=\"M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4\" />\n  \u003cpath d=\"M5 21l0 -10.15\" />\n  \u003cpath d=\"M19 21l0 -10.15\" />\n  \u003cpath d=\"M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4\" />\n\u003c/svg>"},{"id":"file","name":"File","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M14 3v4a1 1 0 0 0 1 1h4\" />\n  \u003cpath d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" />\n\u003c/svg>"},{"id":"file-text","name":"File text","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M14 3v4a1 1 0 0 0 1 1h4\" />\n  \u003cpath d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" />\n  \u003cpath d=\"M9 9l1 0\" />\n  \u003cpath d=\"M9 13l6 0\" />\n  \u003cpath d=\"M9 17l6 0\" />\n\u003c/svg>"},{"id":"files","name":"Files","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M15 3v4a1 1 0 0 0 1 1h4\" />\n  \u003cpath d=\"M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2\" />\n  \u003cpath d=\"M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2\" />\n\u003c/svg>"},{"id":"file-description","name":"File description","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M14 3v4a1 1 0 0 0 1 1h4\" />\n  \u003cpath d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2\" />\n  \u003cpath d=\"M9 17h6\" />\n  \u003cpath d=\"M9 13h6\" />\n\u003c/svg>"},{"id":"clipboard","name":"Clipboard","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\" />\n  \u003cpath d=\"M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2\" />\n\u003c/svg>"},{"id":"clipboard-text","name":"Clipboard text","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2\" />\n  \u003cpath d=\"M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2\" />\n  \u003cpath d=\"M9 12h6\" />\n  \u003cpath d=\"M9 16h6\" />\n\u003c/svg>"},{"id":"book","name":"Book","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0\" />\n  \u003cpath d=\"M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0\" />\n  \u003cpath d=\"M3 6l0 13\" />\n  \u003cpath d=\"M12 6l0 13\" />\n  \u003cpath d=\"M21 6l0 13\" />\n\u003c/svg>"},{"id":"notebook","name":"Notebook","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18\" />\n  \u003cpath d=\"M13 8l2 0\" />\n  \u003cpath d=\"M13 12l2 0\" />\n\u003c/svg>"},{"id":"folder-open","name":"Folder open","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2\" />\n\u003c/svg>"},{"id":"news","name":"News","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11\" />\n  \u003cpath d=\"M8 8l4 0\" />\n  \u003cpath d=\"M8 12l4 0\" />\n  \u003cpath d=\"M8 16l4 0\" />\n\u003c/svg>"},{"id":"receipt","name":"Receipt","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2\" />\n\u003c/svg>"},{"id":"paper-bag","name":"Paper bag","kinds":[],"tags":["general","documents"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 3h8a2 2 0 0 1 2 2v1.82a5 5 0 0 0 .528 2.236l.944 1.888a5 5 0 0 1 .528 2.236v5.82a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-5.82a5 5 0 0 1 .528 -2.236l1.472 -2.944v-3a2 2 0 0 1 2 -2\" />\n  \u003cpath d=\"M12 15a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M6 21a2 2 0 0 0 2 -2v-5.82a5 5 0 0 0 -.528 -2.236l-1.472 -2.944\" />\n  \u003cpath d=\"M11 7h2\" />\n\u003c/svg>"},{"id":"device-watch","name":"Device watch","kinds":[],"tags":["general","devices"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6 9a3 3 0 0 1 3 -3h6a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-6a3 3 0 0 1 -3 -3v-6\" />\n  \u003cpath d=\"M9 18v3h6v-3\" />\n  \u003cpath d=\"M9 6v-3h6v3\" />\n\u003c/svg>"},{"id":"device-gamepad-2","name":"Device gamepad 2","kinds":[],"tags":["general","devices"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4\" />\n  \u003cpath d=\"M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232\" />\n  \u003cpath d=\"M8 9v2\" />\n  \u003cpath d=\"M7 10h2\" />\n  \u003cpath d=\"M14 10h2\" />\n\u003c/svg>"},{"id":"device-tv","name":"Device tv","kinds":[],"tags":["general","devices"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9\" />\n  \u003cpath d=\"M16 3l-4 4l-4 -4\" />\n\u003c/svg>"},{"id":"device-audio-tape","name":"Device audio tape","kinds":[],"tags":["general","devices"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10\" />\n  \u003cpath d=\"M3 17l4 -3h10l4 3\" />\n  \u003cpath d=\"M7 9.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\" />\n  \u003cpath d=\"M16 9.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\" />\n\u003c/svg>"},{"id":"switch-horizontal","name":"Switch horizontal","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M16 3l4 4l-4 4\" />\n  \u003cpath d=\"M10 7l10 0\" />\n  \u003cpath d=\"M8 13l-4 4l4 4\" />\n  \u003cpath d=\"M4 17l9 0\" />\n\u003c/svg>"},{"id":"wifi-off","name":"Wifi off","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 18l.01 0\" />\n  \u003cpath d=\"M9.172 15.172a4 4 0 0 1 5.656 0\" />\n  \u003cpath d=\"M6.343 12.343a7.963 7.963 0 0 1 3.864 -2.14m4.163 .155a7.965 7.965 0 0 1 3.287 2\" />\n  \u003cpath d=\"M3.515 9.515a12 12 0 0 1 3.544 -2.455m3.101 -.92a12 12 0 0 1 10.325 3.374\" />\n  \u003cpath d=\"M3 3l18 18\" />\n\u003c/svg>"},{"id":"world-download","name":"World download","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M21 12a9 9 0 1 0 -9 9\" />\n  \u003cpath d=\"M3.6 9h16.8\" />\n  \u003cpath d=\"M3.6 15h8.4\" />\n  \u003cpath d=\"M11.578 3a17 17 0 0 0 0 18\" />\n  \u003cpath d=\"M12.5 3c1.719 2.755 2.5 5.876 2.5 9\" />\n  \u003cpath d=\"M18 14v7m-3 -3l3 3l3 -3\" />\n\u003c/svg>"},{"id":"world-upload","name":"World upload","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M21 12a9 9 0 1 0 -9 9\" />\n  \u003cpath d=\"M3.6 9h16.8\" />\n  \u003cpath d=\"M3.6 15h8.4\" />\n  \u003cpath d=\"M11.578 3a17 17 0 0 0 0 18\" />\n  \u003cpath d=\"M12.5 3c1.719 2.755 2.5 5.876 2.5 9\" />\n  \u003cpath d=\"M18 21v-7m3 3l-3 -3l-3 3\" />\n\u003c/svg>"},{"id":"signal-3g","name":"Signal 3g","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M17 8h-2a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2v-4h-1\" />\n  \u003cpath d=\"M6 8h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-2.5\" />\n\u003c/svg>"},{"id":"signal-4g","name":"Signal 4g","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6 8v3a1 1 0 0 0 1 1h3\" />\n  \u003cpath d=\"M10 8v8\" />\n  \u003cpath d=\"M17 8h-2a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2v-4h-1\" />\n\u003c/svg>"},{"id":"broadcast","name":"Broadcast","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M18.364 19.364a9 9 0 1 0 -12.728 0\" />\n  \u003cpath d=\"M15.536 16.536a5 5 0 1 0 -7.072 0\" />\n  \u003cpath d=\"M11 13a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n\u003c/svg>"},{"id":"access-point","name":"Access point","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 12l0 .01\" />\n  \u003cpath d=\"M14.828 9.172a4 4 0 0 1 0 5.656\" />\n  \u003cpath d=\"M17.657 6.343a8 8 0 0 1 0 11.314\" />\n  \u003cpath d=\"M9.168 14.828a4 4 0 0 1 0 -5.656\" />\n  \u003cpath d=\"M6.337 17.657a8 8 0 0 1 0 -11.314\" />\n\u003c/svg>"},{"id":"share","name":"Share","kinds":[],"tags":["general","network"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\n  \u003cpath d=\"M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\n  \u003cpath d=\"M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\n  \u003cpath d=\"M8.7 10.7l6.6 -3.4\" />\n  \u003cpath d=\"M8.7 13.3l6.6 3.4\" />\n\u003c/svg>"},{"id":"lock-open","name":"Lock open","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -6\" />\n  \u003cpath d=\"M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M8 11v-5a4 4 0 0 1 8 0\" />\n\u003c/svg>"},{"id":"shield","name":"Shield","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3\" />\n\u003c/svg>"},{"id":"shield-check","name":"Shield check","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06\" />\n  \u003cpath d=\"M15 19l2 2l4 -4\" />\n\u003c/svg>"},{"id":"shield-off","name":"Shield off","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M17.67 17.667a12 12 0 0 1 -5.67 3.333a12 12 0 0 1 -8.5 -15c.794 .036 1.583 -.006 2.357 -.124m3.128 -.926a11.997 11.997 0 0 0 3.015 -1.95a12 12 0 0 0 8.5 3a12 12 0 0 1 -1.116 9.376\" />\n  \u003cpath d=\"M3 3l18 18\" />\n\u003c/svg>"},{"id":"eye","name":"Eye","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  \u003cpath d=\"M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6\" />\n\u003c/svg>"},{"id":"fingerprint","name":"Fingerprint","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3\" />\n  \u003cpath d=\"M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6\" />\n  \u003cpath d=\"M12 11v2a14 14 0 0 0 2.5 8\" />\n  \u003cpath d=\"M8 15a18 18 0 0 0 1.8 6\" />\n  \u003cpath d=\"M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95\" />\n\u003c/svg>"},{"id":"password","name":"Password","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 10v4\" />\n  \u003cpath d=\"M10 13l4 -2\" />\n  \u003cpath d=\"M10 11l4 2\" />\n  \u003cpath d=\"M5 10v4\" />\n  \u003cpath d=\"M3 13l4 -2\" />\n  \u003cpath d=\"M3 11l4 2\" />\n  \u003cpath d=\"M19 10v4\" />\n  \u003cpath d=\"M17 13l4 -2\" />\n  \u003cpath d=\"M17 11l4 2\" />\n\u003c/svg>"},{"id":"shield-half","name":"Shield half","kinds":[],"tags":["general","security"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3\" />\n  \u003cpath d=\"M12 3v18\" />\n\u003c/svg>"},{"id":"coin","name":"Coin","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  \u003cpath d=\"M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1\" />\n  \u003cpath d=\"M12 7v10\" />\n\u003c/svg>"},{"id":"cash","name":"Cash","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3\" />\n  \u003cpath d=\"M7 10a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -8\" />\n  \u003cpath d=\"M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n\u003c/svg>"},{"id":"currency-dollar","name":"Currency dollar","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2\" />\n  \u003cpath d=\"M12 3v3m0 12v3\" />\n\u003c/svg>"},{"id":"shopping-cart","name":"Shopping cart","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M17 17h-11v-14h-2\" />\n  \u003cpath d=\"M6 5l14 1l-1 7h-13\" />\n\u003c/svg>"},{"id":"chart-bar","name":"Chart bar","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6\" />\n  \u003cpath d=\"M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10\" />\n  \u003cpath d=\"M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14\" />\n  \u003cpath d=\"M4 20h14\" />\n\u003c/svg>"},{"id":"chart-line","name":"Chart line","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 19l16 0\" />\n  \u003cpath d=\"M4 15l4 -6l4 2l4 -5l4 4\" />\n\u003c/svg>"},{"id":"chart-pie","name":"Chart pie","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M10 3.2a9 9 0 1 0 10.8 10.8a1 1 0 0 0 -1 -1h-6.8a2 2 0 0 1 -2 -2v-7a.9 .9 0 0 0 -1 -.8\" />\n  \u003cpath d=\"M15 3.5a9 9 0 0 1 5.5 5.5h-4.5a1 1 0 0 1 -1 -1v-4.5\" />\n\u003c/svg>"},{"id":"presentation","name":"Presentation","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 4l18 0\" />\n  \u003cpath d=\"M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10\" />\n  \u003cpath d=\"M12 16l0 4\" />\n  \u003cpath d=\"M9 20l6 0\" />\n  \u003cpath d=\"M8 12l3 -3l2 2l3 -3\" />\n\u003c/svg>"},{"id":"calculator","name":"Calculator","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 5a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -14\" />\n  \u003cpath d=\"M8 8a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1l0 -1\" />\n  \u003cpath d=\"M8 14l0 .01\" />\n  \u003cpath d=\"M12 14l0 .01\" />\n  \u003cpath d=\"M16 14l0 .01\" />\n  \u003cpath d=\"M8 17l0 .01\" />\n  \u003cpath d=\"M12 17l0 .01\" />\n  \u003cpath d=\"M16 17l0 .01\" />\n\u003c/svg>"},{"id":"scale","name":"Scale","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M7 20l10 0\" />\n  \u003cpath d=\"M6 6l6 -1l6 1\" />\n  \u003cpath d=\"M12 3l0 17\" />\n  \u003cpath d=\"M9 12l-3 -6l-3 6a3 3 0 0 0 6 0\" />\n  \u003cpath d=\"M21 12l-3 -6l-3 6a3 3 0 0 0 6 0\" />\n\u003c/svg>"},{"id":"credit-card","name":"Credit card","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8\" />\n  \u003cpath d=\"M3 10l18 0\" />\n  \u003cpath d=\"M7 15l.01 0\" />\n  \u003cpath d=\"M11 15l2 0\" />\n\u003c/svg>"},{"id":"building-bank","name":"Building bank","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21l18 0\" />\n  \u003cpath d=\"M3 10l18 0\" />\n  \u003cpath d=\"M5 6l7 -3l7 3\" />\n  \u003cpath d=\"M4 10l0 11\" />\n  \u003cpath d=\"M20 10l0 11\" />\n  \u003cpath d=\"M8 14l0 3\" />\n  \u003cpath d=\"M12 14l0 3\" />\n  \u003cpath d=\"M16 14l0 3\" />\n\u003c/svg>"},{"id":"pig-money","name":"Pig money","kinds":[],"tags":["general","business"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M15 11v.01\" />\n  \u003cpath d=\"M5.173 8.378a3 3 0 1 1 4.656 -1.377\" />\n  \u003cpath d=\"M16 4v3.803a6.019 6.019 0 0 1 2.658 3.197h1.341a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-1.342c-.336 .95 -.907 1.8 -1.658 2.473v2.027a1.5 1.5 0 0 1 -3 0v-.583a6.04 6.04 0 0 1 -1 .083h-4a6.04 6.04 0 0 1 -1 -.083v.583a1.5 1.5 0 0 1 -3 0v-2l0 -.027a6 6 0 0 1 4 -10.473h2.5l4.5 -3\" />\n\u003c/svg>"},{"id":"settings-2","name":"Settings 2","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M19.875 6.27a2.225 2.225 0 0 1 1.125 1.948v7.284c0 .809 -.443 1.555 -1.158 1.948l-6.75 4.27a2.269 2.269 0 0 1 -2.184 0l-6.75 -4.27a2.225 2.225 0 0 1 -1.158 -1.948v-7.285c0 -.809 .443 -1.554 1.158 -1.947l6.75 -3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98h-.033\" />\n  \u003cpath d=\"M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\" />\n\u003c/svg>"},{"id":"robot","name":"Robot","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6 6a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -4\" />\n  \u003cpath d=\"M12 2v2\" />\n  \u003cpath d=\"M9 12v9\" />\n  \u003cpath d=\"M15 12v9\" />\n  \u003cpath d=\"M5 16l4 -2\" />\n  \u003cpath d=\"M15 14l4 2\" />\n  \u003cpath d=\"M9 18h6\" />\n  \u003cpath d=\"M10 8v.01\" />\n  \u003cpath d=\"M14 8v.01\" />\n\u003c/svg>"},{"id":"tool","name":"Tool","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5\" />\n\u003c/svg>"},{"id":"assembly","name":"Assembly","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M19.875 6.27c.7 .398 1.13 1.143 1.125 1.948v7.284c0 .809 -.443 1.555 -1.158 1.948l-6.75 4.27a2.27 2.27 0 0 1 -2.184 0l-6.75 -4.27a2.23 2.23 0 0 1 -1.158 -1.948v-7.285c0 -.809 .443 -1.554 1.158 -1.947l6.75 -3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98l-.033 0\" />\n  \u003cpath d=\"M15.5 9.422c.312 .18 .503 .515 .5 .876v3.277c0 .364 -.197 .7 -.515 .877l-3 1.922a1 1 0 0 1 -.97 0l-3 -1.922a1 1 0 0 1 -.515 -.876v-3.278c0 -.364 .197 -.7 .514 -.877l3 -1.79c.311 -.174 .69 -.174 1 0l3 1.79h-.014l0 .001\" />\n\u003c/svg>"},{"id":"crane","name":"Crane","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6 21h6\" />\n  \u003cpath d=\"M9 21v-18l-6 6h18\" />\n  \u003cpath d=\"M9 3l10 6\" />\n  \u003cpath d=\"M17 9v4a2 2 0 1 1 -2 2\" />\n\u003c/svg>"},{"id":"building-factory-2","name":"Building factory 2","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21h18\" />\n  \u003cpath d=\"M5 21v-12l5 4v-4l5 4h4\" />\n  \u003cpath d=\"M19 21v-8l-1.436 -9.574a.5 .5 0 0 0 -.495 -.426h-1.145a.5 .5 0 0 0 -.494 .418l-1.43 8.582\" />\n  \u003cpath d=\"M9 17h1\" />\n  \u003cpath d=\"M14 17h1\" />\n\u003c/svg>"},{"id":"automation","name":"Automation","kinds":[],"tags":["general","process"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M13 20.693c-.905 .628 -2.36 .292 -2.675 -1.01a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.492 .362 1.716 2.219 .674 3.03\" />\n  \u003cpath d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />\n  \u003cpath d=\"M17 22l5 -3l-5 -3l0 6\" />\n\u003c/svg>"},{"id":"building-warehouse","name":"Building warehouse","kinds":[],"tags":["general","places"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21v-13l9 -4l9 4v13\" />\n  \u003cpath d=\"M13 13h4v8h-10v-6h6\" />\n  \u003cpath d=\"M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3\" />\n\u003c/svg>"},{"id":"building-hospital","name":"Building hospital","kinds":[],"tags":["general","places"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21l18 0\" />\n  \u003cpath d=\"M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16\" />\n  \u003cpath d=\"M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4\" />\n  \u003cpath d=\"M10 9l4 0\" />\n  \u003cpath d=\"M12 7l0 4\" />\n\u003c/svg>"},{"id":"building-arch","name":"Building arch","kinds":[],"tags":["general","places"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 21l18 0\" />\n  \u003cpath d=\"M4 21v-15a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v15\" />\n  \u003cpath d=\"M9 21v-8a3 3 0 0 1 6 0v8\" />\n\u003c/svg>"},{"id":"map-2","name":"Map 2","kinds":[],"tags":["general","places"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 18.5l-3 -1.5l-6 3v-13l6 -3l6 3l6 -3v7.5\" />\n  \u003cpath d=\"M9 4v13\" />\n  \u003cpath d=\"M15 7v5.5\" />\n  \u003cpath d=\"M21.121 20.121a3 3 0 1 0 -4.242 0c.418 .419 1.125 1.045 2.121 1.879c1.051 -.89 1.759 -1.516 2.121 -1.879\" />\n  \u003cpath d=\"M19 18v.01\" />\n\u003c/svg>"},{"id":"truck","name":"Truck","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5\" />\n\u003c/svg>"},{"id":"car","name":"Car","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5\" />\n\u003c/svg>"},{"id":"plane","name":"Plane","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3l4 7\" />\n\u003c/svg>"},{"id":"ship","name":"Ship","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1\" />\n  \u003cpath d=\"M4 18l-1 -5h18l-2 4\" />\n  \u003cpath d=\"M5 13v-6h8l4 6\" />\n  \u003cpath d=\"M7 7v-4h-1\" />\n\u003c/svg>"},{"id":"train","name":"Train","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M21 13c0 -3.87 -3.37 -7 -10 -7h-8\" />\n  \u003cpath d=\"M3 15h16a2 2 0 0 0 2 -2\" />\n  \u003cpath d=\"M3 6v5h17.5\" />\n  \u003cpath d=\"M3 11v4\" />\n  \u003cpath d=\"M8 11v-5\" />\n  \u003cpath d=\"M13 11v-4.5\" />\n  \u003cpath d=\"M3 19h18\" />\n\u003c/svg>"},{"id":"bike","name":"Bike","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />\n  \u003cpath d=\"M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />\n  \u003cpath d=\"M12 19v-4l-3 -3l5 -4l2 3h3\" />\n  \u003cpath d=\"M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n\u003c/svg>"},{"id":"walk","name":"Walk","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M7 21l3 -4\" />\n  \u003cpath d=\"M16 21l-2 -4l-3 -3l1 -6\" />\n  \u003cpath d=\"M6 12l2 -3l4 -1l3 3l3 1\" />\n\u003c/svg>"},{"id":"alert-triangle","name":"Alert triangle","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 9v4\" />\n  \u003cpath d=\"M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0\" />\n  \u003cpath d=\"M12 16h.01\" />\n\u003c/svg>"},{"id":"info-circle","name":"Info circle","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  \u003cpath d=\"M12 9h.01\" />\n  \u003cpath d=\"M11 12h1v4h1\" />\n\u003c/svg>"},{"id":"circle-check","name":"Circle check","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  \u003cpath d=\"M9 12l2 2l4 -4\" />\n\u003c/svg>"},{"id":"alert-circle","name":"Alert circle","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  \u003cpath d=\"M12 8v4\" />\n  \u003cpath d=\"M12 16h.01\" />\n\u003c/svg>"},{"id":"help-circle","name":"Help circle","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  \u003cpath d=\"M12 16v.01\" />\n  \u003cpath d=\"M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483\" />\n\u003c/svg>"},{"id":"flag","name":"Flag","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9\" />\n  \u003cpath d=\"M5 21v-7\" />\n\u003c/svg>"},{"id":"flag-3","name":"Flag 3","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 14h14l-4.5 -4.5l4.5 -4.5h-14v16\" />\n\u003c/svg>"},{"id":"ban","name":"Ban","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  \u003cpath d=\"M5.7 5.7l12.6 12.6\" />\n\u003c/svg>"},{"id":"circle-x","name":"Circle x","kinds":[],"tags":["general","status"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n  \u003cpath d=\"M10 10l4 4m0 -4l-4 4\" />\n\u003c/svg>"},{"id":"sun","name":"Sun","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\n  \u003cpath d=\"M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7\" />\n\u003c/svg>"},{"id":"droplet","name":"Droplet","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546\" />\n\u003c/svg>"},{"id":"leaf","name":"Leaf","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 21c.5 -4.5 2.5 -8 7 -10\" />\n  \u003cpath d=\"M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0\" />\n\u003c/svg>"},{"id":"bulb","name":"Bulb","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7\" />\n  \u003cpath d=\"M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3\" />\n  \u003cpath d=\"M9.7 17l4.6 0\" />\n\u003c/svg>"},{"id":"flame","name":"Flame","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235\" />\n\u003c/svg>"},{"id":"snowflake","name":"Snowflake","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M10 4l2 1l2 -1\" />\n  \u003cpath d=\"M12 2v6.5l3 1.72\" />\n  \u003cpath d=\"M17.928 6.268l.134 2.232l1.866 1.232\" />\n  \u003cpath d=\"M20.66 7l-5.629 3.25l.01 3.458\" />\n  \u003cpath d=\"M19.928 14.268l-1.866 1.232l-.134 2.232\" />\n  \u003cpath d=\"M20.66 17l-5.629 -3.25l-2.99 1.738\" />\n  \u003cpath d=\"M14 20l-2 -1l-2 1\" />\n  \u003cpath d=\"M12 22v-6.5l-3 -1.72\" />\n  \u003cpath d=\"M6.072 17.732l-.134 -2.232l-1.866 -1.232\" />\n  \u003cpath d=\"M3.34 17l5.629 -3.25l-.01 -3.458\" />\n  \u003cpath d=\"M4.072 9.732l1.866 -1.232l.134 -2.232\" />\n  \u003cpath d=\"M3.34 7l5.629 3.25l2.99 -1.738\" />\n\u003c/svg>"},{"id":"wind","name":"Wind","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24\" />\n  \u003cpath d=\"M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24\" />\n  \u003cpath d=\"M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24\" />\n\u003c/svg>"},{"id":"solar-panel","name":"Solar panel","kinds":[],"tags":["general","nature"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4.28 14h15.44a1 1 0 0 0 .97 -1.243l-1.5 -6a1 1 0 0 0 -.97 -.757h-12.44a1 1 0 0 0 -.97 .757l-1.5 6a1 1 0 0 0 .97 1.243\" />\n  \u003cpath d=\"M4 10h16\" />\n  \u003cpath d=\"M10 6l-1 8\" />\n  \u003cpath d=\"M14 6l1 8\" />\n  \u003cpath d=\"M12 14v4\" />\n  \u003cpath d=\"M7 18h10\" />\n\u003c/svg>"},{"id":"message-circle","name":"Message circle","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1\" />\n\u003c/svg>"},{"id":"message-dots","name":"Message dots","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 11v.01\" />\n  \u003cpath d=\"M8 11v.01\" />\n  \u003cpath d=\"M16 11v.01\" />\n  \u003cpath d=\"M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3l12 0\" />\n\u003c/svg>"},{"id":"phone-call","name":"Phone call","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2\" />\n  \u003cpath d=\"M15 7a2 2 0 0 1 2 2\" />\n  \u003cpath d=\"M15 3a6 6 0 0 1 6 6\" />\n\u003c/svg>"},{"id":"clock","name":"Clock","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  \u003cpath d=\"M12 7v5l3 3\" />\n\u003c/svg>"},{"id":"history","name":"History","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 8l0 4l2 2\" />\n  \u003cpath d=\"M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5\" />\n\u003c/svg>"},{"id":"calendar-event","name":"Calendar event","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12\" />\n  \u003cpath d=\"M16 3l0 4\" />\n  \u003cpath d=\"M8 3l0 4\" />\n  \u003cpath d=\"M4 11l16 0\" />\n  \u003cpath d=\"M8 15h2v2h-2l0 -2\" />\n\u003c/svg>"},{"id":"alarm","name":"Alarm","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M5 13a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\" />\n  \u003cpath d=\"M12 10l0 3l2 0\" />\n  \u003cpath d=\"M7 4l-2.75 2\" />\n  \u003cpath d=\"M17 4l2.75 2\" />\n\u003c/svg>"},{"id":"bell-ringing","name":"Bell ringing","kinds":[],"tags":["general","messaging"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6\" />\n  \u003cpath d=\"M9 17v1a3 3 0 0 0 6 0v-1\" />\n  \u003cpath d=\"M21 6.727a11.05 11.05 0 0 0 -2.794 -3.727\" />\n  \u003cpath d=\"M3 6.727a11.05 11.05 0 0 1 2.792 -3.727\" />\n\u003c/svg>"},{"id":"star","name":"Star","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245\" />\n\u003c/svg>"},{"id":"heart","name":"Heart","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572\" />\n\u003c/svg>"},{"id":"tag","name":"Tag","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3\" />\n\u003c/svg>"},{"id":"target","name":"Target","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0\" />\n  \u003cpath d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" />\n\u003c/svg>"},{"id":"list-check","name":"List check","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3.5 5.5l1.5 1.5l2.5 -2.5\" />\n  \u003cpath d=\"M3.5 11.5l1.5 1.5l2.5 -2.5\" />\n  \u003cpath d=\"M3.5 17.5l1.5 1.5l2.5 -2.5\" />\n  \u003cpath d=\"M11 6l9 0\" />\n  \u003cpath d=\"M11 12l9 0\" />\n  \u003cpath d=\"M11 18l9 0\" />\n\u003c/svg>"},{"id":"adjustments","name":"Adjustments","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  \u003cpath d=\"M6 4v4\" />\n  \u003cpath d=\"M6 12v8\" />\n  \u003cpath d=\"M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  \u003cpath d=\"M12 4v10\" />\n  \u003cpath d=\"M12 18v2\" />\n  \u003cpath d=\"M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" />\n  \u003cpath d=\"M18 4v1\" />\n  \u003cpath d=\"M18 9v11\" />\n\u003c/svg>"},{"id":"grid-dots","name":"Grid dots","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M18 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M4 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n  \u003cpath d=\"M18 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />\n\u003c/svg>"},{"id":"layout-grid","name":"Layout grid","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" />\n  \u003cpath d=\"M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" />\n  \u003cpath d=\"M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" />\n  \u003cpath d=\"M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" />\n\u003c/svg>"},{"id":"zoom-in","name":"Zoom in","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\" />\n  \u003cpath d=\"M7 10l6 0\" />\n  \u003cpath d=\"M10 7l0 6\" />\n  \u003cpath d=\"M21 21l-6 -6\" />\n\u003c/svg>"},{"id":"download","name":"Download","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2\" />\n  \u003cpath d=\"M7 11l5 5l5 -5\" />\n  \u003cpath d=\"M12 4l0 12\" />\n\u003c/svg>"},{"id":"upload","name":"Upload","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2\" />\n  \u003cpath d=\"M7 9l5 -5l5 5\" />\n  \u003cpath d=\"M12 4l0 12\" />\n\u003c/svg>"},{"id":"external-link","name":"External link","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6\" />\n  \u003cpath d=\"M11 13l9 -9\" />\n  \u003cpath d=\"M15 4h5v5\" />\n\u003c/svg>"},{"id":"pin","name":"Pin","kinds":[],"tags":["general","utility"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4\" />\n  \u003cpath d=\"M9 15l-4.5 4.5\" />\n  \u003cpath d=\"M14.5 4l5.5 5.5\" />\n\u003c/svg>"},{"id":"forklift","name":"Forklift","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M12 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />\n  \u003cpath d=\"M7 17l5 0\" />\n  \u003cpath d=\"M3 17v-6h13v6\" />\n  \u003cpath d=\"M5 11v-4h4\" />\n  \u003cpath d=\"M9 11v-6h4l3 6\" />\n  \u003cpath d=\"M22 15h-3v-10\" />\n  \u003cpath d=\"M16 13l3 0\" />\n\u003c/svg>"},{"id":"direction-sign","name":"Direction sign","kinds":[],"tags":["general","places"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3.32 12.774l7.906 7.905c.427 .428 1.12 .428 1.548 0l7.905 -7.905a1.095 1.095 0 0 0 0 -1.548l-7.905 -7.905a1.095 1.095 0 0 0 -1.548 0l-7.905 7.905a1.095 1.095 0 0 0 0 1.548\" />\n  \u003cpath d=\"M8 12h7.5\" />\n  \u003cpath d=\"M12 8.5l3.5 3.5l-3.5 3.5\" />\n\u003c/svg>"},{"id":"device-cctv","name":"Device cctv","kinds":[],"tags":["general","devices"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M3 4a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -2\" />\n  \u003cpath d=\"M8 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\n  \u003cpath d=\"M19 7v7a7 7 0 0 1 -14 0v-7\" />\n  \u003cpath d=\"M12 14l.01 0\" />\n\u003c/svg>"},{"id":"device-sim","name":"Device sim","kinds":[],"tags":["general","devices"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M6 3h8.5l4.5 4.5v12.5a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-16a1 1 0 0 1 1 -1\" />\n  \u003cpath d=\"M9 11h3v6\" />\n  \u003cpath d=\"M15 17v.01\" />\n  \u003cpath d=\"M15 14v.01\" />\n  \u003cpath d=\"M15 11v.01\" />\n  \u003cpath d=\"M9 14v.01\" />\n  \u003cpath d=\"M9 17v.01\" />\n\u003c/svg>"},{"id":"package","name":"Package","kinds":[],"tags":["general","transport"],"svg":"\u003csvg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  \u003cpath d=\"M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5\" />\n  \u003cpath d=\"M12 12l8 -4.5\" />\n  \u003cpath d=\"M12 12l0 9\" />\n  \u003cpath d=\"M12 12l-8 -4.5\" />\n  \u003cpath d=\"M16 5.25l-8 4.5\" />\n\u003c/svg>"}],"note":"General-purpose diagram icons for end users (people, documents, devices, network, security, business, process, places, transport, status, nature, messaging). Curated from tabler-icons outline style to match the DDN 24x24 stroke grid; no default kind bindings — icons are chosen explicitly (x_icon) or bound by a host pack. freesvg.org was evaluated as a source (site-wide CC0 confirmed on its About page) and not used: its catalogue is filled clip-art that does not match the stroke-grid convention.","license":"MIT","attribution":"Tabler Icons, Copyright (c) 2020-2026 Paweł Kuna — https://tabler.io","source":"https://github.com/tabler/tabler-icons"}]};

  /* SPDX-License-Identifier: GPL-2.0-or-later. B1-082: icon-library SVG
   * sanitization (PJ207) — user-supplied SVG rendered into the page; reject
   * scripts, foreignObject, event handlers, external references and oversized
   * assets. Shared by the registry path (ddn-profiles.js) and the raw-catalogue
   * render path (CLI via ddn-render.js). */
  const FORBIDDEN=/<script|foreignObject|<iframe|<embed|<object|<image|\b(?:xlink:)?href\s*=|\bon[a-z]+\s*=|javascript:|url\s*\(|<\!doctype|<\!entity/i;
  function sanitizeIcon(lib,icon){
   const svg=icon?.svg;
   if(typeof svg!=='string'||!svg.trimStart().startsWith('<svg'))return {error:'Icon '+lib.id+'/'+icon?.id+' is not an SVG document'};
   if(svg.length>20480)return {error:'Icon '+lib.id+'/'+icon?.id+' exceeds the 20 KiB asset budget'};
   if(FORBIDDEN.test(svg))return {error:'Icon '+lib.id+'/'+icon?.id+' contains forbidden content (script, foreignObject, event handler or external reference)'};
   return null;
  }
  function sanitizedLibraries(libraries){
   return (libraries||[]).map(lib=>{for(const icon of lib.icons||[]){const bad=sanitizeIcon(lib,icon);if(bad)throw Object.assign(new Error(bad),{code:'DDN-PJ207'});}return lib;});
  }
  /* B1-088: icon packs (ddn-icon-pack@1) — manifest validation and the
   * host-supplied pack registry. A host (viewer, tool, embedding application)
   * registers an external pack at runtime; it is validated and sanitized
   * exactly like a shipped pack before it can render. */
  function validateIconPack(pack){
   const bad=m=>Object.assign(new Error(m),{code:'DDN-PJ206'});
   if(!pack||typeof pack!=='object'||Array.isArray(pack))throw bad('Icon pack must be a JSON object');
   if(pack.format!=='ddn-icon-pack@1')throw bad('Icon pack format must be ddn-icon-pack@1; found '+JSON.stringify(pack.format));
   for(const f of ['id','name','version','license','attribution','source'])if(typeof pack[f]!=='string'||!pack[f])throw bad('Icon pack manifest needs a non-empty '+f);
   if(!/^[a-z0-9][a-z0-9-]*@[0-9]+$/.test(pack.id))throw bad('Icon pack id '+JSON.stringify(pack.id)+' must be lowercase-name@major');
   if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pack.version))throw bad('Icon pack version must be semantic (x.y.z)');
   if(!pack.grid||!Number.isInteger(pack.grid.size)||!(pack.grid.strokeWidth>0))throw bad('Icon pack grid needs size and strokeWidth');
   if(!Array.isArray(pack.icons)||!pack.icons.length||pack.icons.length>400)throw bad('Icon pack needs 1..400 icons');
   const seen=new Set();
   for(const icon of pack.icons){
    if(!icon||typeof icon!=='object')throw bad('Icon entry in '+pack.id+' must be an object');
    for(const f of ['id','name','svg'])if(typeof icon[f]!=='string'||!icon[f])throw bad('Icon in '+pack.id+' needs a non-empty '+f);
    if(!/^[a-z0-9][a-z0-9-]*$/.test(icon.id))throw bad('Icon id '+JSON.stringify(icon.id)+' in '+pack.id+' must be lowercase-with-hyphens');
    if(seen.has(icon.id))throw bad('Duplicate icon id '+icon.id+' in pack '+pack.id);
    seen.add(icon.id);
   }
   return pack;
  }
  const hostPacks=[],hostIds=new Set();
  function registerIconPack(pack,builtins=[]){
   validateIconPack(pack);
   if(hostIds.has(pack.id)||builtins.some(l=>l.id===pack.id))throw Object.assign(new Error('Icon pack id '+pack.id+' is already registered'),{code:'DDN-PJ206'});
   sanitizedLibraries([pack]);
   const lib={id:pack.id,name:pack.name,icons:pack.icons};
   if(pack.note)lib.note=pack.note;
   lib.license=pack.license;lib.attribution=pack.attribution;lib.source=pack.source;
   hostPacks.push(lib);hostIds.add(pack.id);
   return lib;
  }
  function unregisterIconPack(id){
   const i=hostPacks.findIndex(l=>l.id===id);
   if(i<0)return false;
   hostPacks.splice(i,1);hostIds.delete(id);return true;
  }
  function hostIconPacks(){return hostPacks.slice();}
  /* B1-101 slice 3: art packs (ddn-art-pack@1) — detailed presentation
   * illustrations, NOT 24x24 stroke icons. Same manifest discipline and the
   * same DDN-PJ206/207 gates as icon packs; differences: a larger per-item byte
   * budget, arbitrary viewBoxes, declared connection anchors, and a reference
   * rule tuned for real artwork: internal fragment references (url(#…),
   * href="#…" — gradients, reused paths) are fine, external references of any
   * kind remain forbidden. */
  const ART_BUDGET=65536;
  const ART_FORBIDDEN=/<script|foreignObject|<iframe|<embed|<object|<image|\bon[a-z]+\s*=|javascript:|<\!doctype|<\!entity/i;
  const ART_EXTERNAL=/\b(?:xlink:)?href\s*=\s*"(?!#)[^"]*"|url\(\s*['"]?(?!#)/i;
  function sanitizeArt(pack,item){
   const svg=item?.svg;
   if(typeof svg!=='string'||!svg.trimStart().startsWith('<svg'))return {error:'Art item '+pack.id+'/'+item?.id+' is not an SVG document'};
   if(svg.length>ART_BUDGET)return {error:'Art item '+pack.id+'/'+item?.id+' exceeds the 64 KiB asset budget'};
   if(ART_FORBIDDEN.test(svg)||ART_EXTERNAL.test(svg))return {error:'Art item '+pack.id+'/'+item?.id+' contains forbidden content (script, foreignObject, event handler or external reference)'};
   return null;
  }
  function validateArtPack(pack){
   const bad=m=>Object.assign(new Error(m),{code:'DDN-PJ206'});
   if(!pack||typeof pack!=='object'||Array.isArray(pack))throw bad('Art pack must be a JSON object');
   if(pack.format!=='ddn-art-pack@1')throw bad('Art pack format must be ddn-art-pack@1; found '+JSON.stringify(pack.format));
   for(const f of ['id','name','version','license','attribution','source'])if(typeof pack[f]!=='string'||!pack[f])throw bad('Art pack manifest needs a non-empty '+f);
   if(!/^[a-z0-9][a-z0-9-]*@[0-9]+$/.test(pack.id))throw bad('Art pack id '+JSON.stringify(pack.id)+' must be lowercase-name@major');
   if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pack.version))throw bad('Art pack version must be semantic (x.y.z)');
   if(!Array.isArray(pack.items)||!pack.items.length||pack.items.length>400)throw bad('Art pack needs 1..400 items');
   const seen=new Set();
   for(const item of pack.items){
    if(!item||typeof item!=='object')throw bad('Art item in '+pack.id+' must be an object');
    for(const f of ['id','name','svg'])if(typeof item[f]!=='string'||!item[f])throw bad('Art item in '+pack.id+' needs a non-empty '+f);
    if(!/^[a-z0-9][a-z0-9-]*$/.test(item.id))throw bad('Art item id '+JSON.stringify(item.id)+' in '+pack.id+' must be lowercase-with-hyphens');
    if(seen.has(item.id))throw bad('Duplicate art item id '+item.id+' in pack '+pack.id);
    seen.add(item.id);
    const a=item.anchors;
    if(!a||typeof a!=='object'||Array.isArray(a))throw bad('Art item '+pack.id+'/'+item.id+' needs declared connection anchors');
    for(const side of ['north','east','south','west'])if(!point(a[side]))throw bad('Art item '+pack.id+'/'+item.id+' is missing the '+side+' anchor');
    for(const [name,pt] of Object.entries(a)){
     if(!/^[a-z0-9][a-z0-9-]*$/.test(name))throw bad('Anchor name '+JSON.stringify(name)+' in '+pack.id+'/'+item.id+' must be lowercase-with-hyphens');
     if(!point(pt))throw bad('Anchor '+name+' in '+pack.id+'/'+item.id+' must be [x,y] numbers');
    }
   }
   return pack;
   function point(v){return Array.isArray(v)&&v.length===2&&v.every(x=>Number.isFinite(x));}
  }
  const hostArt=[],hostArtIds=new Set();
  function registerArtPack(pack){
   validateArtPack(pack);
   if(hostArtIds.has(pack.id))throw Object.assign(new Error('Art pack id '+pack.id+' is already registered'),{code:'DDN-PJ206'});
   for(const item of pack.items){const bad=sanitizeArt(pack,item);if(bad)throw Object.assign(new Error(bad.error),{code:'DDN-PJ207'});}
   const lib={id:pack.id,name:pack.name,items:pack.items};
   if(pack.note)lib.note=pack.note;
   lib.license=pack.license;lib.attribution=pack.attribution;lib.source=pack.source;
   hostArt.push(lib);hostArtIds.add(pack.id);
   return lib;
  }
  function unregisterArtPack(id){
   const i=hostArt.findIndex(l=>l.id===id);
   if(i<0)return false;
   hostArt.splice(i,1);hostArtIds.delete(id);return true;
  }
  function hostArtPacks(){return hostArt.slice();}
  const api$4={sanitizeIcon,sanitizedLibraries,validateIconPack,registerIconPack,unregisterIconPack,hostIconPacks,sanitizeArt,validateArtPack,registerArtPack,unregisterArtPack,hostArtPacks};
  /* The host pack registries are cross-bundle shared state (module-scope lists
   * would split: ddn.global.js and ddn-graph.js each inline their own copy, so
   * a pack registered through one bundle would be invisible to renders running
   * through the other). First publish wins; every consumer must resolve the
   * namespace, not the module-local import. */
  publishNamespace('DDNPacks',api$4);

  /* SPDX-License-Identifier: GPL-2.0-or-later.
   * DDN 0.8 view-kind registry data (standard chapters 52 and 55). Data-only:
   * registered view kinds, named vocabulary subsets, registered markings and
   * themes, and the patent.legal@1 pack defaults. Later phases (render themes,
   * designer templates) consume these tables; the core parser/validator reads
   * them for the DDN-VP and DDN-MK diagnostic checks. No runtime dependencies. */
  const VERSION$2='0.8.0';
  /* Vocabulary subsets are named registry entries (chapter 52 §52.2). Membership
   * is prefix-based against resolved kind/verb keywords: an entry 'flow.' admits
   * every 'flow.*' keyword, an entry 'flow' admits the bare verb exactly. */
  const VOCABULARY=Object.freeze({
   'core.full':null, // unrestricted: the full core registry
   'flow.process':Object.freeze({kinds:['flow.'],verbs:['flow','flow.']}),
   'c4.model':Object.freeze({kinds:['c4.'],verbs:['c4.rel']}),
   'uml.structure':Object.freeze({kinds:['uml.'],verbs:['uml.']}),
   'uml.behavior':Object.freeze({kinds:['uml.','flow.'],verbs:['uml.','flow','flow.']}),
   'chart.records':Object.freeze({kinds:['record'],verbs:[]}),
   'ladder.logic':Object.freeze({kinds:['ladder.'],verbs:['ladder.']}),
  });
  /* Registered view kinds. attachment names defaults only (chapter 52 §52.4,
   * layer 2): explicit author declarations always win. attachment.profile is an
   * installed projection profile applied when the view declares no projection;
   * attachment.pack/attachment.theme are recorded for the render phase. */
  const VIEW_KINDS=Object.freeze({
   'ddn-native':Object.freeze({vocabulary:'core.full',attachment:Object.freeze({theme:'default'})}),
   'flowchart':Object.freeze({vocabulary:'flow.process',attachment:Object.freeze({profile:'flow.documented@2'})}),
   'c4-context':Object.freeze({vocabulary:'c4.model',attachment:Object.freeze({profile:'c4.context@1'})}),
   'c4-container':Object.freeze({vocabulary:'c4.model',attachment:Object.freeze({profile:'c4.container@1'})}),
   'c4-component':Object.freeze({vocabulary:'c4.model',attachment:Object.freeze({profile:'c4.component@1'})}),
   'uml-class':Object.freeze({vocabulary:'uml.structure',attachment:Object.freeze({pack:'uml.structure@2'})}),
   'uml-sequence':Object.freeze({vocabulary:'uml.structure',attachment:Object.freeze({pack:'uml.sequence@2'})}),
   'uml-state':Object.freeze({vocabulary:'uml.behavior',attachment:Object.freeze({pack:'uml.statemachine@1'})}),
   'uml-activity':Object.freeze({vocabulary:'uml.behavior',attachment:Object.freeze({pack:'uml.activity@2'})}),
   'uml-usecase':Object.freeze({vocabulary:'uml.structure',attachment:Object.freeze({pack:'uml.usecase@3'})}),
   'chart-bar':Object.freeze({vocabulary:'chart.records',attachment:Object.freeze({profile:'chart.basic@1'})}),
   'chart-line':Object.freeze({vocabulary:'chart.records',attachment:Object.freeze({profile:'chart.basic@1'})}),
   'ladder':Object.freeze({vocabulary:'ladder.logic',attachment:Object.freeze({pack:'ladder'})}),
   'patent-figure':Object.freeze({vocabulary:'flow.process',attachment:Object.freeze({pack:'patent.legal@1',theme:'mono_print'})}),
  });
  /* Registered markings (chapter 55 §55.1). Render treatment per theme is the
   * render phase's contract; profiles must not reuse 'forbidden' for anything
   * other than negation/prohibition. */
  const MARKINGS=Object.freeze({
   'forbidden':Object.freeze({meaning:'negation/prohibition',render:'struck-through, dashed prohibition treatment per theme'}),
   'tentative':Object.freeze({meaning:'draft/uncommitted',render:'dashed-grey per theme'}),
  });
  /* Registered themes (chapter 52 §52.6): paint only — never geometry, layout,
   * routing, label text or semantics. */
  const THEMES=Object.freeze({
   'colorblind_safe':Object.freeze({id:'theme.a11y.cb@1',purpose:'palette distinguishable under deuteranopia/protanopia/tritanopia simulation; redundant non-colour encoding preserved'}),
   'mono_print':Object.freeze({id:'theme.mono.print@1',purpose:'black/white/grayscale for B/W filing and print; fills restricted to white; 4.5:1 text contrast'}),
  });
  /* patent.legal@1 pack defaults (chapter 52 §52.5): reference-numeral field
   * boxes, flowchart-with-decision styling, publication chrome defaults. Data
   * for the render phase; the core enforces numeral shape (DDN-VP05/06) and the
   * labelled-branch lint (DDN-VP07). */
  const PATENT_LEGAL=Object.freeze({pack:'patent.legal@1',viewKind:'patent-figure',theme:'mono_print',numeral:Object.freeze({min:1,max:99999}),chrome:Object.freeze({title:'$title / $date',footer:'FIG. $figure / $page',border:'single'}),
   /* Structured chapter 53 chrome defaults (chapter 52 §52.5): applied by the
    * core as layer-2 defaults — any authored header/footer/border concern wins. */
   chromeDefaults:Object.freeze({
    header:Object.freeze({left:Object.freeze({text:'$title',align:'left',size:9,lines:1}),right:Object.freeze({text:'$date',align:'right',size:9,lines:1})}),
    footer:Object.freeze({center:Object.freeze({text:'FIG. $figure',align:'center',font:'serif',size:10,lines:1}),right:Object.freeze({text:'Page $page',align:'right',size:8,lines:1})}),
    border:Object.freeze({style:'single',weight:1,inset:6*96/25.4,corner_marks:false}),
   })});
  /* Marking render treatment per registered theme (chapter 55 §55.1, chapter 52
   * §52.6): the prohibition signal never rides on colour alone — every theme
   * keeps a strike plus a dash treatment; mono_print adds a hatch (second
   * diagonal) so it stays distinguishable in pure B/W. stroke/dash only, never
   * geometry. Sizes in pt, converted by the renderer. */
  const MARKING_PAINT=Object.freeze({
   forbidden:Object.freeze({
    default:Object.freeze({stroke:'#B42318',dash:'7 4',strike:true,hatch:false}),
    colorblind_safe:Object.freeze({stroke:'#000000',dash:'2 3',strike:true,hatch:false}),
    mono_print:Object.freeze({stroke:'#000000',dash:'3 2',strike:true,hatch:true}),
   }),
   tentative:Object.freeze({
    default:Object.freeze({stroke:'#8A8F98',dash:'5 4',strike:false,hatch:false}),
    colorblind_safe:Object.freeze({stroke:'#6E6E6E',dash:'5 4',strike:false,hatch:false}),
    mono_print:Object.freeze({stroke:'#444444',dash:'5 4',strike:false,hatch:false}),
   }),
  });
  /* Theme paint tables (chapter 52 §52.6): re-skin colours/fills/dash only.
   * mono_print is pure black/white/grayscale with white fills; colorblind_safe
   * is the Okabe-Ito palette the renderer hue-maps kind/verb colours onto. */
  const THEME_PAINT=Object.freeze({
   mono_print:Object.freeze({background:'#FFFFFF',surface:'#FFFFFF',ink:'#000000',muted:'#2B2B2B',rule:'#5A5A5A',accent:'#000000',nodeInk:'#000000',nodeFill:'#FFFFFF'}),
   colorblind_safe:Object.freeze({palette:Object.freeze(['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7','#999999'])}),
  });
  function subsetAdmits(subsetName,what,keyword){
   const subset=VOCABULARY[subsetName];
   if(subset===undefined)return false;
   if(subset===null)return true; // core.full: no restriction
   const list=what==='kind'?subset.kinds:subset.verbs;
   return list.some(p=>p.endsWith('.')?keyword.startsWith(p):keyword===p);
  }
  const api$3={VERSION: VERSION$2,VOCABULARY,VIEW_KINDS,MARKINGS,THEMES,PATENT_LEGAL,MARKING_PAINT,THEME_PAINT,subsetAdmits};
  publishNamespace('DDNViewProfiles',api$3);

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
  /* 0.8 (chapter 04 §6A): the painter resolves the active text-property record
   * (view-wide activeText merged with an optional per-call spec) over the role
   * defaults passed by each call site: weight and fill keep their parameter
   * slots, italic/strike/small-caps ride as attributes, and measurement
   * consumes the identical record. With no text properties anywhere the emitted
   * SVG is byte-identical to before. */
  function text$1(x,y,s,size=14,fill='#203047',weight=400,extra='',spec=null){const ts=spec?api$9.mergeSpec(activeText,spec):activeText;const w=ts?.weight??weight,fil=ts?.color??fill;api$9?.measure(s,size,activeFont,w,ts);return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${esc$1(fil)}" font-weight="${w}"${ts?api$9.paintAttrs(ts):''} ${extra}>${esc$1(s).replace(/[→↗∅]/g,c=>`<tspan font-family="DejaVu Sans, Arial, sans-serif">${c}</tspan>`)}</text>`;}
  function multilines(x,y,lines,size=14,fill='#203047',step=20,weight=400,spec=null){return lines.map((l,i)=>text$1(x,y+i*step,l,size,fill,weight,'',spec)).join('');}
  function line(x1,y1,x2,y2,colour,width=1.5,dash=''){return `<path d="M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}" fill="none" stroke="${esc$1(colour)}" stroke-width="${width}"${dash?` stroke-dasharray="${esc$1(dash)}"`:''}/>`;}
  function glyph(name,x,y,size=24,colour='#285EA8'){return `<use href="#g-${esc$1(name)}" xlink:href="#g-${esc$1(name)}" x="${fmt(x)}" y="${fmt(y)}" width="${size}" height="${size}" style="color:${esc$1(colour)}"/>`;}
  function rect(x,y,w,h,stroke,fill,look='classic',id='',radius=0,style={},pen={}){
   if(look==='handDrawn'){
    if(!api$8)throw new Error('DDN handDrawn requires ddn-sketch.js to be loaded before ddn-render.js');
    return api$8.box(x,y,w,h,{stroke,fill,id,radius,seed:style.seed??42,roughness:style.roughness??1.8,hachure:style.hachure??true,...(pen.width!==undefined?{width:pen.width}:{}),...(pen.dash?{dash:pen.dash}:{})});
   }
   let out='';
   if(look==='neo')out+=`<rect x="${x+5}" y="${y+7}" width="${w}" height="${h}" rx="${radius}" fill="#000" opacity=".14"/>`;
   out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${esc$1(fill)}" stroke="${esc$1(stroke)}" stroke-width="${pen.width??1.8}"${pen.dash?` stroke-dasharray="${esc$1(pen.dash)}"`:''}/>`;
   if(look==='neo')out+=`<path d="M${x+radius+1} ${y+3}H${x+w-radius-1}" stroke="${esc$1(stroke)}" stroke-width="3" opacity=".68"/><path d="M${x+12} ${y+7}H${x+w-12}" stroke="#FFF" stroke-width="2" opacity=".75"/>`;
   return out;
  }
  function styleLine(x1,y1,x2,y2,colour,width,dash,p,id){
   return p.style.look==='handDrawn'?api$8.polyline([[x1,y1],[x2,y2]],{stroke:colour,width,dash,id,seed:p.style.seed,roughness:(p.style.roughness??1.8)*.7}):line(x1,y1,x2,y2,colour,width,dash);
  }
  function badge(s,x,y,fill,stroke){let w=Math.max(32,s.length*6.5+12);return {svg:`<rect x="${x}" y="${y}" width="${w}" height="20" rx="4" fill="${esc$1(fill)}" stroke="${esc$1(stroke)}" stroke-width=".8"/>`+text$1(x+w/2,y+14,s,10,stroke,650,'text-anchor="middle"'),w};}
  function pretty(v){if(v===null)return 'null';if(v?.$missing)return '∅ missing';if(v?.$state)return v.$state.replaceAll('_',' ');if(v?.$ref)return '@'+v.$ref.split('::').at(-1);if(v?.$quantity!==undefined)return v.$quantity+v.unit;if(Array.isArray(v))return v.map(pretty).join(', ');if(v&&typeof v==='object')return JSON.stringify(v);return String(v??'');}
  const themes=api$a.themes;
  /* 0.8 (chapter 52 §52.6): registered accessibility themes re-skin paint only.
   * colorblind_safe hue-maps kind/verb colours onto the Okabe-Ito palette
   * (nearest circular-hue match; near-grey inputs pass through). Geometry,
   * layout, routing and label text never change under a theme. */
  function hueOf(hex){const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex||'');if(!m)return null;
   const r=parseInt(m[1],16)/255,g=parseInt(m[2],16)/255,b=parseInt(m[3],16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
   if(d<.08)return null;let h;
   if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;
   return (h*60+360)%360;}
  function cbRemap(hex){const h=hueOf(hex);if(h===null)return hex;
   const palette=api$3.THEME_PAINT.colorblind_safe.palette;let best=palette[0],bd=Infinity;
   for(const c of palette){const ch=hueOf(c);if(ch===null)continue;const d=Math.min(Math.abs(ch-h),360-Math.abs(ch-h));if(d<bd){bd=d;best=c;}}
   return best;}
  const FONT_STACKS={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Comic Sans MS, Segoe Print, Bradley Hand, Purisa, Nanum Pen Script, cursive'};
  const PT=96/72;
  /* 0.8 (chapter 55 §55.1): marking paint resolves per registered theme, so a
   * forbidden/tentative signal keeps a non-colour rendering under every theme. */
  function markingPaint(name,theme08){const t=api$3.MARKING_PAINT[name];return (theme08&&t?.[theme08])||t?.default||null;}
  function measureNode(n,registry,profiles,placement={},context={},fit=null){
   /* 0.8 (chapter 54): fit may force the box width (wrap/grow bound) or the base
    * font size (shrink step); both re-run the identical measurement path. */
   const k=DDN$1.kindEntry(registry,n.kind),s=q$1(fit?.fontSize??profiles.style.font_size,16)/16,font=profiles.style.font;
   const visible=profiles.display.fields==='none'?[]:n.fields.filter(f=>(f.depth||0)<profiles.display.depth);
   let w=fit?.width??Math.max(placement.size?q$1(placement.size[0]):270*s,160*s);
   /* 0.8 (chapter 04 §6A): the element label measures with its resolved text
    * properties (view style.text < element text { }); wraps recompute at the
    * effective width, so a bolder or small-caps label can grow the box. */
   const labelSpec=api$9.mergeSpec(profiles.style?.text,n.properties?.text);
   const titleLines=api$9.wrap(n.name,w-96*s,16*s,font,labelSpec?.weight??650,labelSpec);if(profiles.display.kind==='text')w=Math.max(w,api$9.measure(k.name,11*s,font,650).width+28*s);const headerH=Math.max(64*s,40*s+titleLines.length*21*s);
   /* 0.8 (chapter 52 §52.5): a reference numeral renders in a boxed field row
    * directly under the element header; the row reserves height like a field. */
   let numeralRow=null;
   if(n.properties?.numeral!==undefined&&!k.profileKind)numeralRow={value:n.properties.numeral,top:headerH,h:26*s};
   let y=headerH+(numeralRow?numeralRow.h:0),rows=[];
   for(const f of visible){const depth=f.depth||0;let label=f.name;if(f.properties.x_part){const xp=f.properties.x_part;label+=(xp.classifier?': '+xp.classifier:'')+(xp.multiplicity?' ['+xp.multiplicity+']':'');}if(f.properties.x_unit)label+=': '+f.properties.x_unit.unit;if(f.properties.shape==='array')label+=' []';else if(f.properties.shape==='object')label+=' {}';else if(f.properties.shape==='variant')label+=' <variant>';else if(f.properties.shape==='map')label+=' <map>';else if(f.properties.shape==='set')label+=' <set>';
    const prefix=(f.properties.presence==='optional'?'? ':'')+(f.properties.nullable===true?'nullable · ':'');
    const labelLines=api$9.wrap(prefix+label,w-(40+depth*16)*s,13.5*s,font,400),details=[];
    if(profiles.display.domains==='show'&&f.properties.domain){const d=context.byId?.get(f.properties.domain.$ref);details.push('domain: '+(d?.name||pretty(f.properties.domain)));}
    const dt=f.properties.datatype||f.properties.x_erp?.sql_type;if(profiles.display.datatypes==='show'&&dt)details.push('type: '+pretty(dt));
    const detailLines=details.flatMap(x=>api$9.wrap(x,w-(40+depth*16)*s,11.5*s,font,400));
    let h=(labelLines.length*18+detailLines.length*16+10)*s;h=Math.max(h,(context.degrees?.[f.id]||1)*18+10,(context.degrees?.[f.id]||1)>2?(context.degrees[f.id]*40+10):0);
    rows.push({id:f.id,field:f,top:y,h,labelLines,detailLines,depth});y+=h;
   }
   /* B1-061 : packaged-element visibility prefix. */
   if(n.properties.x_pack?.visibility)titleLines[0]=(n.properties.x_pack.visibility==='private'?'− ':'+ ')+titleLines[0];
   let meaningLines=[];if(n.type==='domain'||k.code==='DOM'){meaningLines=api$9.wrap(n.properties.meaning||'Shared semantic meaning',w-30*s,12.5*s,font,400);y=Math.max(y,headerH)+meaningLines.length*18*s+20*s;}
   let noteLines=[];if((k.shape==='note'||k.shape==='note.sticky')&&n.properties.description){noteLines=api$9.wrap(n.properties.description,w-30*s,12.5*s,font,400);y+=noteLines.length*18*s+20*s;}
   /* B1-101: a sticky note has no header — its box is exactly the wrapped body
    * text plus padding (line 65 added the lines onto a header it does not use). */
   if(k.shape==='note.sticky')y=Math.max(noteLines.length*18*s+30*s,60*s);
   /* B1-101 slice 3: art-bound nodes reserve an illustration area below the
    * header. The resolved item's viewBox and anchors ride on the node so the
    * router can pin endpoints to the art's declared connection points. */
   let _art=null;
   if(n.properties?.x_art){
    const found=artFor({n});
    if(found?.item){const[,,vbW,vbH]=artViewBox(found.item);_art={vbW,vbH,anchors:found.item.anchors};}
    y=Math.max(y,headerH+140*s);
   }
   /* B1-100: mind-map entities carry free-form body text (their description)
    * as wrapped rows. The box auto-sizes to the rows up to a line cap (default
    * 10, x_mindmap.lines 1..50 per entity); beyond the cap the box stays at the
    * cap height and a scrollbar affordance marks the hidden rows. The text
    * engine measures and wraps only — there is no inline-markup engine in the
    * runtime, so rows are plain text (documented gap). */
   let mindRows=null;
   if(profiles.projection?.profile==='mindmap.basic@1'&&n.properties.description){
    const lines=api$9.wrap(String(n.properties.description),w-30*s,12.5*s,font,400);
    /* B1-100: the presentation override channel (studio apply()) may raise or
     * lower an entity's window for this render without touching source —
     * profiles.x_mind_nodes wins over the authored x_mindmap.lines hint. */
    const cap=Math.max(1,Math.min(50,q$1(profiles.x_mind_nodes?.[n.id]?.lines??n.properties.x_mindmap?.lines,10))),total=lines.length,shown=Math.min(cap,total);
    mindRows={lines,total,cap,rowH:18*s};
    y+=shown*18*s+(total>cap?8*s:0);
   }
   let sample=null;
   if(n.type==='sample'||k.code==='SMP'){
    const columns=n.properties.columns||[],allRows=n.properties.rows||[],raw=allRows.slice(0,1000),omitted=allRows.length-raw.length,head=columns.map(c=>context.members?.get(c.$ref)?.name||c.$ref?.split('.').at(-1)||String(c)),widths=head.map((h,i)=>Math.max(110*s,Math.min(220*s,Math.max(api$9.measure(h,11.5*s,font,650).width,...raw.map(row=>api$9.measure(pretty(row[i]),12*s,font,400).width))+24*s)));
    w=Math.max(w,widths.reduce((a,b)=>a+b,0)+24*s);const total=widths.reduce((a,b)=>a+b,0),factor=(w-24*s)/Math.max(1,total);widths.forEach((x,i)=>widths[i]*=factor);
    const headers=head.map((h,i)=>api$9.wrap(h,widths[i]-12*s,11.5*s,font,650)),headH=Math.max(...headers.map(a=>a.length),1)*17*s+14*s;
    let rowTop=headerH+headH;const tableRows=raw.map(row=>{const cells=row.map((v,i)=>api$9.wrap(pretty(v),widths[i]-12*s,12*s,font,400)),h=Math.max(...cells.map(c=>c.length),1)*18*s+12*s,r={cells,top:rowTop,h};rowTop+=h;return r;});
    sample={columns,headers,widths,headH,rows:tableRows,omitted};y=rowTop+32*s;
   }
   const footer=[];if(profiles.display.badges!=='none')for(const key of ['workload','role','temporal','distribution','location'])if(n.properties[key]!==undefined)footer.push(pretty(n.properties[key]));
   if(footer.length)y+=38*s;
   let h=Math.max(y+14*s,100*s,placement.size?q$1(placement.size[1]):0,(context.degrees?.[n.id]||1)>4?(context.degrees[n.id]*44+40):((context.degrees?.[n.id]||1)*20+40));
   const g={id:n.id,n,k,w,h,fields:visible,titleLines,footer,scale:s,headerH,fieldRows:rows,meaningLines,noteLines,sample,...(numeralRow?{numeralRow}:{}),...(_art?{_art}:{}),...(mindRows?{mindRows}:{})}; return k.profileKind?api$7.measure(g,profiles):g;
  }
  /* 0.8 (chapter 54): text fit. Mode resolution follows §54.1 precedence —
   * element > style-profile/bundle default > mode inferred from a width
   * constraint > legacy fixed box. The adaptation loop (§54.2) is measure →
   * resize → re-layout with a HARD cap of two passes (never a fixpoint solver);
   * placement and routing downstream see the post-fit boxes exactly as if the
   * author had declared the new sizes. Residual overflow after pass two is
   * diagnosed (§54.3), never silently clipped: under `layout { quality: warn; }`
   * the box keeps its bounded size and the text clips at the box edge with a
   * visible ellipsis marker; under the default `quality: error` the render is
   * refused with the DDN-LW07/LW08 error. Geometry
   * only — modelFingerprint, endpoints and relation identities are untouched,
   * and a place pin's origin never moves (growth extends away from it). */
  function textFit(geoms,registry,p,ir,context){
   const placements=ir.view.placements||{};
   const fits=geoms.map(g=>{const el=g.n.properties||{};
    const mode=el.text_fit??p.style.text_fit??((el.max_width??p.style.max_width)!==undefined?'wrap':null);
    if(!mode)return null;
    const mw=q$1(el.max_width??p.style.max_width,NaN),mh=q$1(el.max_height??p.style.max_height,NaN),mf=q$1(el.min_font??p.style.min_font,NaN);
    return {mode,maxW:Number.isFinite(mw)?mw:null,maxH:Number.isFinite(mh)?mh:null,minFont:Number.isFinite(mf)?mf:8};});
   if(!fits.some(Boolean))return {geoms,scene:null,diags:[]};
   const diags=[],scene={passes:0,resized:[],deltas:[]},baseFont=q$1(p.style.font_size,16);
   const remeasure=(g,opt)=>{const g2=measureNode(g.n,registry,p,placements[g.id]||{},context,opt);g2.x=g.x;g2.y=g.y;return g2;};
   for(let pass=1;pass<=2;pass++){
    scene.passes=pass;let changed=false;
    for(let i=0;i<geoms.length;i++){
     const fit=fits[i];if(!fit)continue;
     let g=geoms[i];const before=[g.w,g.h];
     if(fit.mode==='wrap'||fit.mode==='grow'){
      if(fit.maxW!==null&&g.w>fit.maxW+.01)g=remeasure(g,{width:fit.maxW});
      if(fit.maxW!==null&&g.w>fit.maxW+.01)g.tfClipW={px:api$6.round(g.w-fit.maxW),bound:fit.maxW};
      if(fit.maxH!==null&&g.h>fit.maxH){g.tfClip={px:api$6.round(g.h-fit.maxH),bound:fit.maxH};g.h=fit.maxH;}
     }else { /* shrink: font steps down 1px per step from the base to the floor; first size that fits wins */
      const placement=placements[g.id]||{};
      const tw=placement.size?q$1(placement.size[0]):fit.maxW,th=placement.size?q$1(placement.size[1]):fit.maxH;
      if(tw!==null||th!==null){
       const fitsAt=(g2)=>(tw===null||g2.w<=tw+.01)&&(th===null||g2.h<=th+.01);
       if(!fitsAt(g)){
        let chosen=null;
        for(let size=baseFont-1;size>=fit.minFont;size--){const g2=remeasure(g,{fontSize:size});if(fitsAt(g2)){chosen=g2;break;}chosen=g2;}
        g=chosen||remeasure(g,{fontSize:fit.minFont}); /* min_font == base font: no step exists */
        if(!fitsAt(g)){ /* reached the floor and still overflows: residual, diagnosed after pass two */
         let smallestFit=null;
         for(let size=Math.max(9,fit.minFont+1);size<baseFont;size++){if(fitsAt(remeasure(g,{fontSize:size}))){smallestFit=size;break;}}
         const px=api$6.round(Math.max(tw!==null?g.w-tw:0,th!==null?g.h-th:0));
         g.tfShrinkOver={floor:fit.minFont,smallestFit,px};
         if(tw!==null&&g.w>tw+.01)g.tfClipW={px:api$6.round(g.w-tw),bound:tw};
         if(th!==null&&g.h>th+.01){g.tfClip={px:api$6.round(g.h-th),bound:th};g.h=th;}
        }
       }
      }
     }
     geoms[i]=g;
     if(g.w!==before[0]||g.h!==before[1]){changed=true;if(!scene.resized.includes(g.id))scene.resized.push(g.id);scene.deltas.push({id:g.id,pass,from:before,to:[g.w,g.h]});}
    }
    if(!changed)break;
   }
   const qualityError=p.layout.quality!=='warn';
   const report=(code,message)=>{if(qualityError)throw new DDN$1.DDNError(code,message);diags.push({code,severity:'warning',message});};
   for(let i=0;i<geoms.length;i++){
    const fit=fits[i];if(!fit)continue;const g=geoms[i],local=g.n.local||g.id;
    if(fit.mode==='shrink'){
     if(g.tfShrinkOver)report('DDN-LW08','shrink on element `'+local+'` reached min_font '+g.tfShrinkOver.floor+'px and the text still overflows by '+g.tfShrinkOver.px+'px; '+(g.tfShrinkOver.smallestFit?'the smallest fitting size is '+g.tfShrinkOver.smallestFit+'px (above the absolute floor 8px) — lower min_font or shorten the label.':'no fitting size exists above the absolute floor 8px — shorten the label or widen the box.'));
    }else {
     if(g.tfClip)report('DDN-LW07','element `'+local+'` overflows by '+g.tfClip.px+'px vertically — raise `max_height` (currently '+g.tfClip.bound+'px) or shorten the label.');
     if(g.tfClipW)report('DDN-LW07','element `'+local+'` overflows by '+g.tfClipW.px+'px horizontally — raise `max_width` (currently '+g.tfClipW.bound+'px) or shorten the label.');
    }
   }
   return {geoms,scene,diags};
  }
  function iconFor(g,registry){
   const baseLibs=registry.icon_libraries||(registry._iconLibsSanitized??(registry._iconLibsSanitized=sanitizedLibraries(ICONLIBS.libraries)));
   const Packs=namespace('DDNPacks'),hostLibs=Packs.hostIconPacks();
   const allLibs=hostLibs.length?baseLibs.concat(hostLibs):baseLibs;
   const xi=g.n.properties?.x_icon||((allLibs.flatMap(l=>(l.icons||[]).filter(i=>(i.kinds||[]).includes(g.n.kind)).map(i=>({library:l.id,icon:i.id}))))[0]);
   if(!xi)return null;
   const lib=allLibs.find(l=>l.id===xi.library);
   const icon=lib?.icons?.find(i=>i.id===xi.icon||i.kinds?.includes(g.n.kind)&&i.id===xi.icon);
   if(!lib||!icon)throw new DDN$1.DDNError('DDN-PJ206','Icon reference '+xi.library+'/'+xi.icon+' is not in the icon libraries registry',g.n.source?.file,g.n.source?.start);
   return {xi,icon};
  }
  function emitIcon(g,found){
   const{xi,icon}=found,isz=26*g.scale,ix=g.x+g.w/2-isz/2,iy=g.y+7*g.scale;
   const vb=(icon.svg.match(/viewBox="([^"]+)"/)||[])[1]||'0 0 24 24';
   const iPrefix='ic-'+hash(g.id)+'-';
   let inner=icon.svg.replace(/<\?xml[^>]*>/,'')
    .replace(/ id="([^"]+)"/g,(m,id)=>` id="${iPrefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${iPrefix}${id})`);
   inner=inner.replace(/<svg /,`<svg x="${fmt(ix)}" y="${fmt(iy)}" width="${fmt(isz)}" height="${fmt(isz)}" viewBox="${vb}" `)
    .replace(/\bviewBox="[^"]*"/,'');
   return `<g class="ddn-icon" data-icon="${esc$1(xi.library+'/'+xi.icon)}">`+inner+'</g>';
  }
  /* B1-101 slice 3: presentation art binding. x_art references an item in a
   * host-registered ddn-art-pack@1 pack. An unresolvable reference is NOT an
   * error (art is presentation content and packs install per host): the node
   * draws a dashed placeholder naming the missing reference. */
  function artFor(g){
   const xa=g.n.properties?.x_art;
   if(!xa)return null;
   const lib=namespace('DDNPacks').hostArtPacks().find(l=>l.id===xa.library);
   const item=lib?.items?.find(i=>i.id===xa.item);
   return {xa,item};
  }
  function artViewBox(item){const m=item.svg.match(/viewBox="([^"]+)"/);if(m){const v=m[1].trim().split(/[\s,]+/).map(Number);if(v.length===4&&v.every(Number.isFinite)&&(v[2]>0&&v[3]>0))return v;}
   const w=parseFloat((item.svg.match(/\bwidth="([\d.]+)/)||[])[1]),h=parseFloat((item.svg.match(/\bheight="([\d.]+)/)||[])[1]);
   return Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0?[0,0,w,h]:[0,0,100,100];}
  function emitArt(g,found,p){
   const{xa,item}=found,s=g.scale,box=api$6.artBox(g);
   if(!item)return `<g class="ddn-art ddn-art-missing" data-art="${esc$1(xa.library+'/'+xa.item)}"><rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${fmt(box.w)}" height="${fmt(box.h)}" fill="none" stroke="${esc$1(p.style.theme==='neutral'?'#333333':'#94A3B8')}" stroke-width="1.4" stroke-dasharray="6 4"/>`+text$1(box.x+box.w/2,box.y+box.h/2-4*s,'art: '+xa.library+' / '+xa.item,11*s,'#94A3B8',500,'text-anchor="middle"')+text$1(box.x+box.w/2,box.y+box.h/2+14*s,'pack not registered in this host',10*s,'#94A3B8',400,'text-anchor="middle"')+'</g>';
   const[,,vbW,vbH]=artViewBox(item),fit=Math.min(box.w/vbW,box.h/vbH),w=vbW*fit,h=vbH*fit,ax=box.x+(box.w-w)/2,ay=box.y+(box.h-h)/2;
   const aPrefix='art-'+hash(g.id)+'-';
   let inner=item.svg.replace(/<\?xml[^>]*>/,'')
    .replace(/ id="([^"]+)"/g,(m,id)=>` id="${aPrefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${aPrefix}${id})`);
   /* Root-tag-only rewrite: strip the file's own width/height, guarantee a
    * viewBox, then place and size through the shared fit transform. */
   inner=inner.replace(/<svg\b[^>]*>/,tag=>{
    const cleaned=tag.replace(/\s(?:width|height|x|y)="[^"]*"/g,'');
    const withVb=/\bviewBox=/.test(cleaned)?cleaned:cleaned.replace(/\s*>$/,' viewBox="0 0 '+vbW+' '+vbH+'">');
    return withVb.replace(/<svg\b/,`<svg x="${fmt(ax)}" y="${fmt(ay)}" width="${fmt(w)}" height="${fmt(h)}"`);
   });
   return `<g class="ddn-art" data-art="${esc$1(xa.library+'/'+xa.item)}">`+inner+'</g>';
  }
  function renderNode(g,p,theme,registry){
   if(g.k.profileKind){let shaped=api$7.render(p.theme08==='colorblind_safe'?{...g,k:{...g.k,colour:cbRemap(g.k.colour)}}:g,p,theme);
    /* B1-082: icon binding — draw the referenced (pre-sanitized) library icon
     * inside the node's top area; ids namespaced per node. Host-registered
     * packs (B1-088) append after the shipped registry. */
    const found=iconFor(g,registry);
    if(found)shaped=shaped.slice(0,-4)+emitIcon(g,found)+'</g>';
    const foundArt=artFor(g);
    if(foundArt)shaped=shaped.slice(0,-4)+emitArt(g,foundArt,p)+'</g>';

    /* B1-076: C4 tag chip under the node (any silhouette, decorator layer). */
    if(g.n.properties.x_c4tag?.tags?.length&&p.detail!=='shapes'){const tg=g.n.properties.x_c4tag.tags.join(', ');shaped=shaped.slice(0,-4)+`<g class="ddn-c4tag">`+text$1(g.x+g.w/2,g.y+g.h-6*g.scale,'['+tg+']',10*g.scale,theme.muted,500,'text-anchor="middle" font-style="italic"')+'</g></g>';}
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
     shaped=shaped.slice(0,-4)+`<g class="ddn-io-inline ddn-frozen" data-view="${esc$1(xf.view)}"${xf.snapshot_at?` data-snapshot-at="${esc$1(xf.snapshot_at)}"`:''}>`+inner+'</g></g>';
    }
    else if(g.ioChild){const c=g.ioChild,scale2=Math.min((g.w-24*g.scale)/c.scene.width,g.ioH/c.scene.height),cw2=c.scene.width*scale2,ch2=c.scene.height*scale2;
     const prefix='io-'+hash(g.id)+'-';let inner=c.svg.replace(/<\?xml[^>]*>/,'');
     inner=inner.replace(/ id="([^"]+)"/g,(m,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${prefix}${id})`).replace(/(href|xlink:href)="#([^"]+)"/g,(m,a2,id)=>`${a2}="#${prefix}${id}"`).replace(/aria-labelledby="[^"]*"/g,'');
     inner=inner.replace(/<svg /,`<svg x="${fmt(g.x+(g.w-cw2)/2)}" y="${fmt(g.y+g.h-ch2-8*g.scale)}" `).replace(/width="[^"]*" height="[^"]*"/,`width="${fmt(cw2)}" height="${fmt(ch2)}"`);
     shaped=shaped.slice(0,-4)+`<g class="ddn-io-inline" data-view="${esc$1(c.scene.projection?.profile||'')}">`+inner+'</g></g>';}
    /* B1-061 : interaction-use gates (border squares) and arguments. */
    const xu=g.n.properties?.x_use;
    if(xu){const s2=g.scale;
     if(xu.arguments?.length)shaped=shaped.slice(0,-4)+`<g class="ddn-io-arguments">`+text$1(g.x+g.w/2,g.y+g.h-8*s2,'('+xu.arguments.join(', ')+')',11*s2,theme.muted,500,'text-anchor="middle"')+'</g></g>';
     for(const [gi,gname]of (xu.gates||[]).entries()){
      shaped=shaped.slice(0,-4)+`<g class="ddn-io-gate" data-gate="${esc$1(gname)}"><rect x="${fmt(g.x-5*s2)}" y="${fmt(g.y+(24+gi*22)*s2)}" width="${fmt(10*s2)}" height="${fmt(10*s2)}" fill="${esc$1(theme.surface)}" stroke="${esc$1(theme.accent)}" stroke-width="1.4"/>`+text$1(g.x+8*s2,g.y+(32+gi*22)*s2,gname,10.5*s2,theme.muted,500)+'</g></g>';}}
    /* 0.8 (chapter 52 §52.5): shaped (profileKind) nodes carry their reference
     * numeral as a boxed chip at the top of the shape, the profileKind analogue
     * of the plain path's under-header field row. */
    if(g.n.properties?.numeral!==undefined&&p.detail!=='shapes'){const b=badge(String(g.n.properties.numeral),0,0,theme.surface,theme.accent);
     shaped=shaped.slice(0,-4)+`<g class="ddn-numeral" data-numeral="${esc$1(g.n.properties.numeral)}" transform="translate(${fmt(g.x+g.w/2-b.w*g.scale/2)} ${fmt(g.y+3*g.scale)}) scale(${g.scale})">`+b.svg+'</g></g>';}
    /* 0.8 (chapter 55 §55.1): element markings over the shape outline — same
     * theme-painted contract as the plain path. */
    for(const mk of (g.n.properties?.marks||[])){const paint=markingPaint(mk,p.theme08);if(!paint)continue;
     let mo=`<g class="ddn-mark ddn-mark-${esc$1(mk)}" data-mark="${esc$1(mk)}"><rect x="${fmt(g.x)}" y="${fmt(g.y)}" width="${fmt(g.w)}" height="${fmt(g.h)}" rx="${fmt(4*g.scale)}" fill="none" stroke="${esc$1(paint.stroke)}" stroke-width="2.2"${paint.dash?` stroke-dasharray="${esc$1(paint.dash)}"`:''}/>`;
     if(paint.strike)mo+=`<path d="M${fmt(g.x)} ${fmt(g.y)}L${fmt(g.x+g.w)} ${fmt(g.y+g.h)}" stroke="${esc$1(paint.stroke)}" stroke-width="2.2" fill="none"/>`;
     if(paint.hatch)mo+=`<path data-hatch="true" d="M${fmt(g.x+g.w)} ${fmt(g.y)}L${fmt(g.x)} ${fmt(g.y+g.h)}" stroke="${esc$1(paint.stroke)}" stroke-width="1.6" fill="none"/>`;
     shaped+=mo+'</g>';}
    return shaped;}
   const{n,k,x,y,w,h,titleLines,footer}=g,s=g.scale,font=p.style.font,mono=p.style.theme==='neutral'||p.theme08==='mono_print',monoPrint=p.theme08==='mono_print',look=p.style.look;
   const kc=p.theme08==='colorblind_safe'?{...k,colour:cbRemap(k.colour)}:k;
   const nc=api$a.node(kc,theme),ink=monoPrint?'#000000':mono?'#333333':nc.ink,fill=monoPrint?'#FFFFFF':mono?'#FAFAFA':nc.fill,bodyInk=monoPrint?'#000000':nc.text;
   /* 0.8 (chapter 04 §6B): portable element outline/fill. Applies to the
    * silhouette outline only — interior separators, chips and text keep their
    * role channels. Monochrome themes keep their B/W contract: declared
    * colours are suppressed, but weight/dash (monochrome-safe) still apply.
    * Stroke paint is SVG-standard centred on the outline path, so half the
    * declared weight lies outside the laid-out box; geometry, endpoints and
    * the model fingerprint are untouched. */
   const elPen=n.properties?.stroke||null,elFill=n.properties?.fill??null;
   const oInk=mono||monoPrint?ink:(elPen?.color??ink),oFill=mono||monoPrint?fill:(elFill??fill),oDash=elPen?.dash?DDN$1.LINE_DASH_PATTERNS[elPen.dash]:null,oW=elPen?.weight;
   const maturity={draft:'DRF',approved:'APR',undecided:'UNK',review:'REV',deprecated:'DEP',retired:'RET',rejected:'REJ'},m=typeof n.properties.maturity==='object'?'UNK':maturity[n.properties.maturity];
   /* 0.8 (chapter 04 §6C): per-element opacity paints as one group opacity over
    * the whole node — fill, stroke and text fade together; hit-testing and
    * diagnostics are unaffected (SVG group opacity changes paint only). */
   const op=n.properties?.opacity;
   let out=`<g class="${cls('ddn-node','ddn-kind-'+slug(k.code))}" data-id="${esc$1(n.id)}" data-ddn-id="${esc$1(n.id)}" data-ref="${esc$1(n.ref||n.id)}"${g.tfClip||g.tfClipW?' data-textfit-overflow="true"':''}${op!==undefined&&op<1?` opacity="${op}"`:''} tabindex="0" role="group" aria-label="${esc$1(n.name)}"><title>${esc$1(n.name+' — '+k.name)}</title>`;
   /* 0.8 (chapter 54 §54.2): residual overflow renders with the text clipped at
    * the box edge and a visible ellipsis marker — never invisible text. The clip
    * rect is the box inflated by the border stroke so the frame stays whole. */
   const tfClip=g.tfClip||g.tfClipW?'tfclip-'+hash(n.id):null;
   if(tfClip)out+=`<clipPath id="${tfClip}"><rect x="${fmt(x-2)}" y="${fmt(y-2)}" width="${fmt(w+4)}" height="${fmt(h+4)}"/></clipPath><g class="ddn-textfit-clip" clip-path="url(#${tfClip})">`;
   const tfClose=()=>(tfClip?'</g>'+text$1(x+w-14*s,y+h-5*s,'…',13*s,ink,650,'class="ddn-textfit-ellipsis"'):'');
   if(k.shape==='note.sticky'){
    /* B1-101: sticky note (collaborative whiteboard idiom) — a coloured,
     * optionally taped/pinned free-form note. No name header, no kind chip, no
     * field rows: the body text IS the note. */
    const STICKY={yellow:'#FEF3C7',pink:'#FCE7F3',blue:'#DBEAFE',green:'#D1FAE5',orange:'#FFEDD5',purple:'#EDE9FE'};
    const st=n.properties.x_sticky||{},sfill=STICKY[st.colour]||STICKY.yellow;
    out+=`<rect class="ddn-sticky" data-colour="${esc$1(st.colour||'yellow')}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${4*s}" fill="${esc$1(elFill??sfill)}" stroke="${oInk}" stroke-width="${oW??1.8}"${oDash?` stroke-dasharray="${esc$1(oDash)}"`:''}/>`;
    if(st.tape){for(const sx of [x+w*.22,x+w*.78])out+=`<rect class="ddn-sticky-tape" x="${fmt(sx-14*s)}" y="${fmt(y-6*s)}" width="${fmt(28*s)}" height="${fmt(12*s)}" fill="${ink}" opacity=".16" transform="rotate(-4 ${fmt(sx)} ${fmt(y)})"/>`;}
    if(g.noteLines.length){let ty=y+14*s;for(const ln of g.noteLines){api$9.measure(ln,12.5*s,p.style.font,400);out+=text$1(x+15*s,ty+13*s,ln,12.5*s,bodyInk,400);ty+=18*s;}}
    if(st.pin){const px=x+w/2,py=y+4*s;
     out+=`<g class="ddn-sticky-pin"><path d="M${fmt(px)} ${fmt(py)}L${fmt(px)} ${fmt(py+12*s)}" stroke="${ink}" stroke-width="1.8"/><circle cx="${fmt(px)}" cy="${fmt(py)}" r="${fmt(6*s)}" fill="#DC2626" stroke="${ink}" stroke-width="1.4"/><circle cx="${fmt(px-2*s)}" cy="${fmt(py-2*s)}" r="${fmt(1.8*s)}" fill="#fff" opacity=".7"/></g>`;}
    /* The sticky note is self-contained: no kind glyph/chip, no title, no field
     * or meaning rows (line 201 would also re-draw the note lines). */
    return out+tfClose()+'</g>';
   }else if(k.shape==='note'){
    if(look==='handDrawn')out+=api$8.polygon([[x,y],[x+w-16*s,y],[x+w,y+16*s],[x+w,y+h],[x,y+h]],{...p.style,id:n.id,stroke:oInk,fill:oFill,...(oW!==undefined?{width:oW}:{}),...(oDash?{dash:oDash}:{})});
    else out+=`<path d="M${x} ${y}H${x+w-16*s}L${x+w} ${y+16*s}V${y+h}H${x}Z" fill="${esc$1(oFill)}" stroke="${esc$1(oInk)}" stroke-width="${oW??1.8}"${oDash?` stroke-dasharray="${esc$1(oDash)}"`:''}/>`;
    out+=styleLine(x+w-16*s,y,x+w-16*s,y+16*s,ink,1.3,'',p,n.id+':fold-v')+styleLine(x+w-16*s,y+16*s,x+w,y+16*s,ink,1.3,'',p,n.id+':fold-h');
   /* B1-100 (corner fix): mind-map entities read as ideas, not records —
    * rounded corners for every node silhouette in the profile, including the
    * plain rect path object/entity/term/domain actually render through. */
   }else out+=rect(x,y,w,h,oInk,oFill,look,n.id,k.shape==='activity'?18*s:p.projection?.profile==='mindmap.basic@1'?10*s:0,p.style,{width:oW,dash:oDash});
   if(k.shape==='frame')out+=`<rect x="${x+6}" y="${y+6}" width="${w-12}" height="${h-12}" fill="none" stroke="${esc$1(ink)}" stroke-dasharray="4 4" opacity=".55"/>`;
   /* B1-100 icon generalization: icons are not a profileKind privilege — the
    * plain rect path resolves the same binding and leaves room for it. */
   const plainIcon=iconFor(g,registry);
   if(p.display.kind!=='none'){
    if(p.display.kind!=='text')out+=glyph(k.glyph,x+13*s,y+15*s,24*s,ink);
    if(['text','icon_token'].includes(p.display.kind)||mono)out+=text$1(x+14*s,y+53*s,p.display.kind==='text'?k.name:k.code,11*s,ink,650);
   }
   const elTextSpec=n.properties?.text||null;
   if(p.projection.profile==='uml.object@2'&&n.properties.x_instance)out+=`<g text-decoration="underline">`+multilines(x+48*s,y+29*s+(plainIcon?22*s:0),titleLines,16*s,bodyInk,21*s,650,elTextSpec)+'</g>';
   else out+=multilines(x+48*s,y+29*s+(plainIcon?22*s:0),titleLines,16*s,bodyInk,21*s,650,elTextSpec);
   if(plainIcon)out+=emitIcon(g,plainIcon);
   const artBind=artFor(g);
   if(artBind)out+=emitArt(g,artBind,p);
   if(m&&p.display.maturity!=='none')out+=`<rect x="${x+w-46*s}" y="${y+8*s}" width="${38*s}" height="${22*s}" rx="4" fill="${esc$1(fill)}" stroke="${esc$1(ink)}"/>`+text$1(x+w-27*s,y+24*s,m,11*s,ink,650,'text-anchor="middle"');
   if(n.properties&&n.properties.x_subdiagram){const b=badge('↗ ref',0,0,theme.surface,theme.accent);out+=`<g class="ddn-ref-badge" transform="translate(${fmt(x+w-b.w*s)} ${fmt(y-10*s)}) scale(${s})">`+b.svg+'</g>';}
   if(g.numeralRow){const nr=g.numeralRow,ny=y+nr.top,bw=Math.max(48*s,String(nr.value).length*8.5*s+16*s);
    /* 0.8 (chapter 52 §52.5): reference-numeral field box directly under the
     * element header; ref: anchors resolve to this numeral. */
    out+=styleLine(x,ny-4*s,x+w,ny-4*s,ink,1,'',p,n.id+':numeral-top');
    out+=`<g class="ddn-numeral" data-numeral="${esc$1(nr.value)}"><rect x="${fmt(x+12*s)}" y="${fmt(ny+3*s)}" width="${fmt(bw)}" height="${fmt(nr.h-8*s)}" rx="${fmt(2*s)}" fill="${esc$1(fill)}" stroke="${esc$1(ink)}" stroke-width="1.2"/>`+text$1(x+12*s+bw/2,ny+nr.h-9*s,String(nr.value),12*s,ink,650,'text-anchor="middle"')+'</g>';
    out+=styleLine(x,ny+nr.h-1,x+w,ny+nr.h-1,ink,.6,'',p,n.id+':numeral');}
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
   if(g.mindRows){const mr=g.mindRows,top=y+g.headerH+8*s,winH=Math.min(mr.cap,mr.total)*mr.rowH,clipId='mindclip-'+hash(n.id);
    /* B1-100: mind-map body rows. ALL rows render inside a clip window sized to
     * the line cap; the tool pans the rows group and the thumb for scroll (no
     * re-render), and drags the lower-right handle to change the cap (overlay
     * re-render, presentation-only). The static export shows the first window. */
    out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':mindbody');
    out+=`<clipPath id="${clipId}"><rect x="${fmt(x+8*s)}" y="${fmt(top)}" width="${fmt(w-16*s)}" height="${fmt(winH)}"/></clipPath>`;
    out+=`<g class="ddn-mind-rows" data-node="${esc$1(n.id)}" data-total="${mr.total}" data-cap="${mr.cap}" data-row-h="${fmt(mr.rowH)}" clip-path="url(#${clipId})">`;
    mr.lines.forEach((ln,i)=>{api$9.measure(ln,12.5*s,font,400);out+=`<text class="ddn-mind-row" data-row="${i}" x="${fmt(x+15*s)}" y="${fmt(top+13*s+i*mr.rowH)}" font-size="${fmt(12.5*s)}" fill="${bodyInk}">${esc$1(ln)}</text>`;});
    out+='</g>';
    if(mr.total>mr.cap){const tx=x+w-11*s,trackY=top+2*s,trackH=winH-4*s,thumbH=Math.max(12*s,trackH*mr.cap/mr.total);
     out+=`<g class="ddn-mind-scroll" data-node="${esc$1(n.id)}" data-track-y="${fmt(trackY)}" data-track-h="${fmt(trackH)}"><rect class="ddn-mind-scroll-track" x="${fmt(tx)}" y="${fmt(trackY)}" width="${fmt(5*s)}" height="${fmt(trackH)}" rx="${fmt(2.5*s)}" fill="${ink}" opacity=".18"/><rect class="ddn-mind-scroll-thumb" data-node="${esc$1(n.id)}" x="${fmt(tx)}" y="${fmt(trackY)}" width="${fmt(5*s)}" height="${fmt(thumbH)}" rx="${fmt(2.5*s)}" fill="${ink}" opacity=".55"/></g>`;}
    out+=`<g class="ddn-mind-resize" data-node="${esc$1(n.id)}" data-cap="${mr.cap}" data-total="${mr.total}"><path d="M${fmt(x+w-16*s)} ${fmt(y+h-5*s)}L${fmt(x+w-5*s)} ${fmt(y+h-16*s)}M${fmt(x+w-11*s)} ${fmt(y+h-5*s)}L${fmt(x+w-5*s)} ${fmt(y+h-11*s)}" stroke="${ink}" stroke-width="1.6" opacity=".5"/></g>`;
   }
   if(g.sample){const sm=g.sample;out+=styleLine(x,y+g.headerH-4*s,x+w,y+g.headerH-4*s,ink,1,'',p,n.id+':sample');let xx=x+12*s;
    sm.headers.forEach((lines,i)=>{out+=multilines(xx,y+g.headerH+16*s,lines,11.5*s,ink,17*s,650);if(i)out+=styleLine(xx-5*s,y+g.headerH-4*s,xx-5*s,y+h-30*s,ink,.5,'',p,n.id+':column:'+i);xx+=sm.widths[i];});
    for(let j=0;j<sm.rows.length;j++){const row=sm.rows[j];let xx=x+12*s;row.cells.forEach((lines,i)=>{out+=multilines(xx,y+row.top+18*s,lines,12*s,bodyInk,18*s);xx+=sm.widths[i];});out+=styleLine(x+10*s,y+row.top+row.h-1,x+w-10*s,y+row.top+row.h-1,ink,.45,'',p,n.id+':row:'+j);}
    out+=text$1(x+13*s,y+h-12*s,(n.properties.mode||'example')+' · illustrative, not a constraint'+(sm.omitted?' · +'+sm.omitted+' rows not rendered':''),11*s,ink);
   }
   if(footer.length){let bx=x+12*s;for(const value of footer){let st=value.toUpperCase(),width=api$9.measure(st,11*s,font,650).width+14*s;if(bx+width>x+w-10*s){out+=text$1(bx,y+h-14*s,'+ detail',11*s,ink);break;}out+=`<rect x="${bx}" y="${y+h-29*s}" width="${width}" height="${22*s}" rx="4" fill="${esc$1(fill)}" stroke="${esc$1(ink)}" stroke-width=".8"/>`+text$1(bx+width/2,y+h-13*s,st,11*s,ink,650,'text-anchor="middle"');bx+=width+7*s;}}
   /* 0.8 (chapter 55 §55.1): element markings — theme-painted annotation over
    * the element outline; forbidden adds strike (plus hatch under mono_print)
    * so the signal never rides on colour alone. */
   for(const mk of (n.properties.marks||[])){const paint=markingPaint(mk,p.theme08);if(!paint)continue;
    out+=`<g class="ddn-mark ddn-mark-${esc$1(mk)}" data-mark="${esc$1(mk)}"><rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(4*s)}" fill="none" stroke="${esc$1(paint.stroke)}" stroke-width="2.2"${paint.dash?` stroke-dasharray="${esc$1(paint.dash)}"`:''}/>`;
    if(paint.strike)out+=`<path d="M${fmt(x)} ${fmt(y)}L${fmt(x+w)} ${fmt(y+h)}" stroke="${esc$1(paint.stroke)}" stroke-width="2.2" fill="none"/>`;
    if(paint.hatch)out+=`<path data-hatch="true" d="M${fmt(x+w)} ${fmt(y)}L${fmt(x)} ${fmt(y+h)}" stroke="${esc$1(paint.stroke)}" stroke-width="1.6" fill="none"/>`;
    out+='</g>';}
   return out+tfClose()+'</g>';
  }
  function pathD(points){return points.map((v,i)=>(i?'L':'M')+fmt(v[0])+' '+fmt(v[1])).join(' ');}
  function segments(points){return points.slice(1).map((p,i)=>({a:points[i],b:p,i}));}
  function endMark(point,angle,type,ink,surface='white',weight=1.7){if(!type||type==='none')return '';let s=`<g transform="translate(${point[0]} ${point[1]}) rotate(${angle})" stroke="${esc$1(ink)}" stroke-width="${weight}" fill="none">`;
   if(type==='filled')s+=`<path d="M0 0L-10 -5L-10 5Z" fill="${esc$1(ink)}"/>`;
   else if(type==='open')s+='<path d="M-10 -5L0 0L-10 5"/>';
   else if(type==='diamond')s+=`<path d="M0 0L-8 -5L-16 0L-8 5Z" fill="${esc$1(ink)}"/>`;
   else if(type==='hollow_diamond')s+=`<path d="M0 0L-8 -5L-16 0L-8 5Z" fill="${esc$1(surface)}"/>`;
   else if(type==='triangle')s+=`<path d="M0 0L-12 -7L-12 7Z" fill="${esc$1(surface)}"/>`;
   else if(type==='filled_triangle')s+=`<path d="M0 0L-12 -7L-12 7Z" fill="${esc$1(ink)}"/>`;
   else if(type==='slash')s+=`<path d="M-9 -6L-3 6" stroke-width="2.4"/>`;
   else if(type==='lollipop')s+=`<circle cx="-7" cy="0" r="5" fill="${esc$1(surface)}"/>`;
   else if(type==='socket')s+=`<path d="M-11 -6A6.5 6.5 0 0 0 -11 6" fill="none"/>`;
   else if(type==='circle')s+=`<circle cx="-8" cy="0" r="4.5" fill="${esc$1(surface)}"/>`; /* B1-066 : DMN authority requirement */
   else if(type==='xcircle')s+=`<circle cx="-9" cy="0" r="6" fill="${esc$1(surface)}"/><path d="M-12 -3L-6 3M-6 -3L-12 3"/>`; /* B1-080: ORM exclusion */
   else if(['one','zeroone','many','zeromany'].includes(type)){
    if(type.includes('many'))s+='<path d="M-13 0L0 -7M-13 0L0 7M-13 0L0 0"/>';
    else s+='<path d="M-4 -7V7"/>';
    if(type.startsWith('zero'))s+=`<circle cx="-20" cy="0" r="4" fill="${esc$1(surface)}"/>`;else s+='<path d="M-18 -7V7"/>';
   }
   return s+'</g>';
  }
  /* B1-078: IDEF0 tunnel end — a small open parenthesis at the endpoint. */
  function tunnelMark(point,angle,ink){return `<g transform="translate(${point[0]} ${point[1]}) rotate(${angle})" stroke="${esc$1(ink)}" stroke-width="1.7" fill="none"><path d="M-9 -6A9 9 0 0 0 -9 6"/></g>`;}
  function midpoint(points){const seg=segments(points).sort((a,b)=>Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1])-Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1]))[0];return [(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];}
  /* B1-055: point where the ray from a box centre toward `toward` exits the box. */
  function rectAnchor(g,toward){const cx=g.x+g.w/2,cy=g.y+g.h/2,dx=toward[0]-cx,dy=toward[1]-cy;let t=Infinity;
   if(dx)t=Math.min(t,Math.abs((g.w/2)/dx));if(dy)t=Math.min(t,Math.abs((g.h/2)/dy));
   if(!Number.isFinite(t)||!t)return [cx,cy];return [cx+dx*t,cy+dy*t];}
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
  let activeFont='sans',activeText=null;
  function render$1(ir,registry,glyphDefs='',options={}){const before=activeFont,beforeText=activeText;activeFont=ir.view.profiles.style.font;activeText=ir.view.profiles.style.text||null;
   /* 0.8 (chapter 54 §54.4): an active font pin replaces the measurement cache
    * for this render only (engine match was checked against Text.engine). */
   const pin=ir.view.fontPin&&ir.view.fontPin.engine===api$9.engine?ir.view.fontPin:null;
   const prevMetrics=pin?api$9.getMetrics():null;
   if(pin)api$9.setMetrics(pin.measurements);
   try{return renderInner(ir,registry,glyphDefs,options);}finally{if(pin)api$9.setMetrics(prevMetrics);activeFont=before;activeText=beforeText;}}
  function renderInner(ir,registry,glyphDefs='',options={}){
   if(!api$6||!api$9||!Export)throw new DDN$1.DDNError('DDN099','Load layout/text/export modules before rendering');
   ir=Export.project(ir);
   const textBefore=api$9.stats();
   /* 0.8 (chapter 55 §S4): ref: anchors resolve to the target element's numeral
    * (else its display label) at render time, before measurement, so renumbering
    * an element updates every anchor consistently. The IR is copied shallowly —
    * anchors are a render-time text substitution, never a model edit. */
   const refText=new Map();
   for(const n of ir.elements)if(!refText.has(n.local))refText.set(n.local,n.properties?.numeral!==undefined?String(n.properties.numeral):n.name);
   const REF_RE=/\bref:([A-Za-z_][A-Za-z0-9_-]*)/g;
   const resolveRefs=s=>typeof s==='string'&&s.includes('ref:')?s.replace(REF_RE,(m,id)=>refText.has(id)?refText.get(id):m):s;
   if(ir.view.refAnchors?.length){
    const subProps=props=>{const o={...props};for(const k of ['description','text','label'])if(typeof o[k]==='string')o[k]=resolveRefs(o[k]);return o;};
    ir={...ir,
     elements:ir.elements.map(n=>({...n,name:resolveRefs(n.name),properties:subProps(n.properties)})),
     relations:ir.relations.map(r=>({...r,name:resolveRefs(r.name),properties:subProps(r.properties)})),
     view:{...ir.view,name:resolveRefs(ir.view.name)}};
   }
   /* B1-074 : options.detail — 'full' (default) renders text as
    * always; 'shapes' (drill-down thumbnails) suppresses every text run. */
   const p={...ir.view.profiles,detail:options.detail||'full'};
   /* 0.8 (chapter 52 §52.6): a registered view theme re-skins paint only.
    * mono_print collapses to pure black/white/grayscale with white fills;
    * colorblind_safe remaps kind/verb colours onto the Okabe-Ito palette at the
    * paint sites (nodes below, routes further down). */
   const theme08=ir.view.theme;p.theme08=theme08;
   let t=themes[p.style.theme];
   if(theme08==='mono_print')t={...api$3.THEME_PAINT.mono_print};
   const mono=p.style.theme==='neutral'||theme08==='mono_print';
   /* 0.8 (chapter 54 §54.5): the content-size render override (CLI --content-size)
    * forces size: content for one render on the existing render-override channel —
    * never a source rewrite. The artboard grows with the final post-fit bounds. */
   if(options.contentSize)p.publication={...p.publication,size:'content'};
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
   /* labels 'none' behaves like 'text' for the legend: nothing to decode, so
    * the key disappears unless the author explicitly asks for it ('on'). */
   const legendPlacement=chrome.legend==='off'||p.detail==='shapes'||((p.legend.mode==='text'||p.legend.mode==='none')&&chrome.legend!=='on')?'none':p.legend.placement;
   /* 0.8 (chapter 53 §53.1): publication header/footer chrome bands reserve
    * space outside the drawing area; variables resolve to plain text before
    * measurement. $date is exempt from byte stability (chapter 51 §51.5);
    * conformance pins it via the publicationDate render option. */
   const chromeVars={title:p.publication.title||ir.view.name||ir.view.local,page:options.page??1,figure:options.figure??1,view_id:ir.view.local,date:options.publicationDate||(()=>{const d=new Date(),p2=v=>String(v).padStart(2,'0');return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());})()};
   const resolveChrome=str=>resolveRefs(String(str).replace(/\$\$|\$([A-Za-z_][A-Za-z0-9_]*)/g,(m,name)=>m==='$$'?'$':(Object.hasOwn(chromeVars,name)?String(chromeVars[name]):m)));
   const bandRuns=band=>['left','center','right'].map(slot=>band?.[slot]).filter(Boolean);
   const bandLines=run=>resolveChrome(run.text).split('\n').slice(0,run.lines);
   const bandHeight=band=>{let h=0;for(const r of bandRuns(band))h=Math.max(h,bandLines(r).length*r.size*PT*1.35);return h?Math.ceil(h+8):0;};
   const headerBand=p.publication.header&&titleOn?bandHeight(p.publication.header):0;
   const footerBand=p.publication.footer&&footerOn?bandHeight(p.publication.footer):0;
   const headBlock=(titleOn?110:20)+headerBand;
   const elems=ir.view.selected.map(id=>ir.elements.find(n=>n.id===id));
   const rels=ir.view.relations.map(id=>ir.relations.find(r=>r.id===id));
   const context={byId:new Map(ir.elements.map(n=>[n.id,n])),members:new Map(ir.elements.flatMap(n=>[...n.fields,...n.ports].map(f=>[f.id,f]))),degrees:{}};
   const portIds=new Set(ir.elements.flatMap(n=>n.ports.map(pt=>pt.id)));
   for(const r of rels)for(const ep of [r.from,r.to]){context.degrees[ep.element]=(context.degrees[ep.element]||0)+1;if(ep.member)context.degrees[ep.member]=(context.degrees[ep.member]||0)+1;}
   let geoms=elems.map(n=>measureNode(n,registry,p,ir.view.placements[n.id],context));
   /* 0.8 (chapter 54): text fit — measure → resize (≤2 passes), then the
    * placement/routing below re-lays out with the post-fit boxes. */
   const tf=textFit(geoms,registry,p,ir,context);geoms=tf.geoms;
   /* 0.8 (chapter 54 §54.4 DDN-TF05): pin/engine mismatch — pin ignored. */
   const pinDiags=ir.view.fontPin&&ir.view.fontPin.engine!==api$9.engine?[{code:'DDN-TF05',severity:'warning',message:'font_pin '+ir.view.fontPin.path+' was produced by '+ir.view.fontPin.engine+' but this renderer measures with '+api$9.engine+'; pinned metrics ignored for this render.'}]:[];
   /* B1-061 : interaction-overview inline expansion. Child views render
    * through the same recursive render() as inline subdiagrams; the owning node
    * grows to fit. */
   const ioChildren=ir.view.ioChildren||{};
   for(const g of geoms){const child=ioChildren[g.id];if(!child)continue;
    /* B1-074 : display:'thumbnail' renders the child in shapes detail
     * (silhouettes/edges/frames/ports, no text). */
    const thumb=g.n.properties.x_subdiagram?.display==='thumbnail'||g.n.properties.x_subdiagram?.frozen===true;
    const c=render$1(child,registry,glyphDefs,thumb?{...options,detail:'shapes'}:options),s=q$1(p.style.font_size,16)/16;
    const cw=Math.min(360*s,c.scene.width),ch=Math.min(200*s,c.scene.height);
    g.ioChild={scene:c,svg:c.svg};g.w=Math.max(g.w,cw+24*s);g.h+=ch+16*s;g.ioH=ch;
   }
   /* B1-074 : frozen nodes carry their snapshot instead of a live
    * child — grow the node around the snapshot's declared size the same way. */
   for(const g of geoms){const xf=g.n.properties.x_subdiagram;if(xf?.frozen!==true)continue;
    const s=q$1(p.style.font_size,16)/16;
    const wm=xf.snapshot.match(/<svg[^>]*\bwidth="([^"]+)"/),hm=xf.snapshot.match(/<svg[^>]*\bheight="([^"]+)"/);
    const cw=Math.min(360*s,wm?parseFloat(wm[1]):360*s),ch=Math.min(200*s,hm?parseFloat(hm[1]):200*s);
    g.w=Math.max(g.w,cw+24*s);g.h+=ch+16*s;g.ioH=ch;
   }

   if(p.publication.fit==='reflow'&&p.layout.algorithm==='grid'&&!Object.values(ir.view.placements).some(x=>x.at)){const pw=q$1(p.publication.width,1280),reserve=legendPlacement==='right'?q$1(p.legend.width,310)+25:0;let cols=Math.floor((pw-2*q$1(p.publication.margin,32)-reserve)/(geoms.reduce((m,g)=>Math.max(m,g.w),270)+api$6.round(q$1(p.layout.gap,64)*api$6.spacingScale(p.layout))));p.layout={...p.layout,columns:Math.max(1,Math.min(geoms.length,cols))};}
   const placed=api$5.place(geoms,rels,ir,options);geoms=placed.nodes;
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
   geoms.reduce((m,g)=>Math.max(m,g.w),270);geoms.reduce((m,g)=>Math.max(m,g.h),130);
   const byId=new Map(geoms.map(g=>[g.id,g]));
   let frames=ir.view.frames.map(f=>{const m=f.members.map(id=>byId.get(id)).filter(Boolean);let x=f.at?q$1(f.at[0]):(m.length?m.reduce((v,g)=>Math.min(v,g.x),Infinity)-20:0),y=f.at?q$1(f.at[1]):(m.length?m.reduce((v,g)=>Math.min(v,g.y),Infinity)-54:0),w=f.size?q$1(f.size[0]):(m.length?m.reduce((v,g)=>Math.max(v,g.x+g.w),-Infinity)-x+20:300),h=f.size?q$1(f.size[1]):(m.length?m.reduce((v,g)=>Math.max(v,g.y+g.h),-Infinity)-y+22:170);
   // frame_overflow : expand grows a declared rect to enclose members
   // at the standard padding; when members already fit this is a no-op.
   if(m.length&&p.layout.frame_overflow!=='confine'&&(f.at||f.size)){w=Math.max(w,m.reduce((v,g)=>Math.max(v,g.x+g.w),-Infinity)-x+20);h=Math.max(h,m.reduce((v,g)=>Math.max(v,g.y+g.h),-Infinity)-y+22);}
   return {...f,x,y,w,h};});
   /* B1-085: IEC 61131-3 power rails flank the rung area under the ladder profile. */
   let ladderRails=null;
   if(p.projection.profile==='ladder.basic@1'&&geoms.length){
    const gx0=geoms.reduce((m,g)=>Math.min(m,g.x),Infinity),gx1=geoms.reduce((m,g)=>Math.max(m,g.x+g.w),-Infinity),gy0=geoms.reduce((m,g)=>Math.min(m,g.y),Infinity),gy1=geoms.reduce((m,g)=>Math.max(m,g.y+g.h),-Infinity);
    ladderRails={x0:gx0-56,x1:gx1+56,y0:gy0-28,y1:gy1+28};
   }
   let subs=ir.view.subdiagrams.map((d,i)=>({...d,x:q$1(d.at?.[0],i*310),y:q$1(d.at?.[1],geoms.reduce((m,g)=>Math.max(m,g.y+g.h),0)+100),w:q$1(d.size?.[0],270),h:q$1(d.size?.[1],95)}));
   const labelMeasure=r=>{if(r._visualLabel===false||p.legend.mode==='none')return {w:0,h:0};const reg=DDN$1.relationEntry(registry,r.kind);if(p.legend.mode==='numbers')return {w:30,h:30};const str=p.legend.mode==='tokens'?reg.code:r.name;return {w:api$9.measure(str,12,p.style.font,500).width+20,h:28};};
   const routed=api$5.route(geoms,rels,ir,labelMeasure,subs,placed);
   const routes=routed.routes.map(a=>({...a,reg:DDN$1.relationEntry(registry,a.r.kind)})),crossings=routed.crossings;
   const allBoxes=[...geoms,...frames,...subs,...routed.labels];
   if(ladderRails)allBoxes.push({x:ladderRails.x0-4,y:ladderRails.y0,w:8,h:ladderRails.y1-ladderRails.y0},{x:ladderRails.x1-4,y:ladderRails.y0,w:8,h:ladderRails.y1-ladderRails.y0});
   let minX=allBoxes.reduce((m,g)=>Math.min(m,g.x),0),minY=allBoxes.reduce((m,g)=>Math.min(m,g.y),0);for(const r of routes)for(const pt of r.points){minX=Math.min(minX,pt[0]);minY=Math.min(minY,pt[1]);}
   let maxX=allBoxes.reduce((m,g)=>Math.max(m,g.x+g.w),100),maxY=allBoxes.reduce((m,g)=>Math.max(m,g.y+g.h),100);for(const r of routes)for(const pt of r.points){maxX=Math.max(maxX,pt[0]);maxY=Math.max(maxY,pt[1]);}
   const pinFocus=p.layout.center==='pins'?placed.anchor:null;
   if(pinFocus){const b=api$5.centeredBounds({x:minX,y:minY,w:maxX-minX,h:maxY-minY},pinFocus);minX=b.x;minY=b.y;maxX=b.x+b.w;maxY=b.y+b.h;}
   /* B1-081: VSM timeline ladder — reserve space below the content before the
    * page bounds are computed; drawn after the labels. */
   let vsmLadder=null;
   if(p.projection.profile==='vsm.basic@1'){
    const steps=geoms.filter(g=>g.n.kind==='vsm.process'&&g.n.properties.x_vsm).sort((a,b)=>a.x-b.x)
     .map(g=>({x:g.x+g.w/2,va:g.n.properties.x_vsm.va,nva:g.n.properties.x_vsm.nva,unit:g.n.properties.x_vsm.unit||''}));
    if(steps.length){
     const ls=q$1(p.style.font_size,16)/16,ladderH=40*ls;
     vsmLadder={steps,s:ls,h:ladderH};
     maxY+=ladderH+52*ls;
    }
   }
   const width=maxX-minX+30,height=maxY-minY+30;
   /* 0.8 amendment (chapter 06, content scale): content_scale grows/shrinks the
    * laid-out drawing — geometry and every font role together — BEFORE the
    * fit/contain calculation, so contain scaling and the DDN071/DDN074 checks
    * operate on the scaled result. Placement and routing are unaffected: they
    * work in unscaled world space; scaling happens at the same point contain
    * scaling does (the drawing-group transform). */
   const contentScale=q$1(p.publication.content_scale,1);
   if(!Number.isFinite(contentScale)||contentScale<0.25||contentScale>4)throw new DDN$1.DDNError('DDN070','content_scale must be a finite ratio in [0.25, 4]');
   const scaledW=width*contentScale,scaledH=height*contentScale;
   let pageW=q$1(p.publication.width,1280),pageH=q$1(p.publication.height,800);
   if(['a4','letter'].includes(p.publication.size)){pageW=p.publication.size==='a4'?210*96/25.4:8.5*96;pageH=p.publication.size==='a4'?297*96/25.4:11*96;if(p.publication.orientation==='landscape')[pageW,pageH]=[pageH,pageW];}
   const margin=q$1(p.publication.margin,32),legendW=legendPlacement==='right'?q$1(p.legend.width,270):0;
   const pageTitle=p.publication.title||ir.view.name;
   if(p.publication.size==='content')pageW=Math.max(640,api$9.measure(pageTitle,24,p.style.font,650).width+2*margin,scaledW+2*margin+(legendW?legendW+25:0));
   /* Legend text wraps to the space the panel actually owns: entries start at
    * lx+34, so a right panel of legendW holds legendW-42 of text (8px right
    * inset) and never runs past pageW-margin; a bottom panel spans the drawing
    * width. The old Math.max(legendW,300) floor let narrow configured widths
    * wrap 258px lines that escaped the panel and clipped at the page edge. */
   const legendTextW=legendPlacement==='right'?Math.max(60,legendW-42):Math.max(60,Math.min(258,pageW-2*margin-34));
   let legendEntries=rels.map(r=>{const a=ir.elements.find(n=>n.id===r.from.element),b=ir.elements.find(n=>n.id===r.to.element),reg=DDN$1.relationEntry(registry,r.kind);const fromName=a.name+(r.from.member?'.'+(a.fields.find(f=>f.id===r.from.member)?.name||a.ports.find(f=>f.id===r.from.member)?.name||r.from.member.split('.').at(-1)):'');const toName=b.name+(r.to.member?'.'+(b.fields.find(f=>f.id===r.to.member)?.name||b.ports.find(f=>f.id===r.to.member)?.name||r.to.member.split('.').at(-1)):'');let detail=`${fromName} → ${toName}: ${r.name}`;
    const qualifiers=['enforcement','capture','transport','delivery','scope'];for(const prop of qualifiers)if(r.properties[prop]!==undefined)detail+=`; ${prop}: ${pretty(r.properties[prop])}`;
    return {id:r.id,key:ir.view.keys[r.id],name:r.name,reg,lines:api$9.wrap(detail,legendTextW,12,p.style.font,400)};
   });
   const legendHeight=50+legendEntries.reduce((n,e)=>n+Math.max(44,e.lines.length*18+16),0),bottomH=(legendPlacement==='bottom'?legendHeight:0)+footerBand;
   if(p.publication.size==='content'){pageH=Math.max(360,scaledH+2*margin+headBlock+bottomH,legendPlacement==='right'?legendHeight+headBlock+60:0);}
   const titleLines=titleOn?api$9.wrap(pageTitle,pageW-2*margin,24,p.style.font,650):[],captionLines=titleOn&&p.publication.caption?api$9.wrap(p.publication.caption,pageW-2*margin,13,p.style.font,400):[],extraHeader=titleOn?(titleLines.length-1)*28+(captionLines.length?captionLines.length*18+8:0):0;
   const availW=pageW-2*margin-(legendW?legendW+25:0),availH=pageH-2*margin-(headBlock-10)-bottomH-extraHeader;
   let scale=(p.publication.fit==='none'?1:Math.min(1,availW/scaledW,availH/scaledH))*contentScale;
   const diags=[...ir.diagnostics,...tf.diags,...pinDiags,...placed.diagnostics,...routed.diagnostics];
   if(scale<=0)throw new DDN$1.DDNError('DDN070','Page has no usable drawing area');
   const embeddingScale=q$1(p.publication.embedding_scale,1);if(embeddingScale<=0||embeddingScale>4)throw new DDN$1.DDNError('DDN070','embedding_scale must be >0 and <=4');
   const fontSize=Math.min(11*q$1(p.style.font_size,16)/16*scale,rels.length?12*scale:Infinity,11*contentScale)*embeddingScale,minFont=q$1(p.publication.minimum_text,10.66);
   if(fontSize<minFont){
    /* B1-046 (D3): name the remedy. smallest = min(11·base/16·scale, rels?12·scale:∞, 11·cs)·embed
     * (scale is the final page scale, contain factor × content_scale), so the
     * implied minimum base font is 16·minFont/(11·scale·embed) — unless a
     * fixed cap (12·scale with relations, 11·cs absolute) binds below the minimum,
     * in which case no base font can fix it and the page must grow. */
    const relCap=rels.length?12*scale*embeddingScale:Infinity,absCap=11*contentScale*embeddingScale;
    const remedy=Math.min(relCap,absCap)<minFont
     ?'the page scale already caps the smallest text role below the minimum, so a larger base font cannot fix it — enlarge the page, reduce content, or raise publication.minimum_text/embedding_scale'
     :`increase base font to ≥${(16*minFont/(11*scale*embeddingScale)).toFixed(1)}px or enlarge the smallest text role`;
    let d={code:'DDN071',severity:p.publication.overflow==='error'?'error':'warning',message:`Smallest final text ${fontSize.toFixed(2)}px is below minimum ${minFont.toFixed(2)}px — ${remedy}`};if(d.severity==='error')throw new DDN$1.DDNError(d.code,d.message);diags.push(d);}
   if(legendPlacement==='right'&&legendHeight>pageH-(headBlock+50)-extraHeader)throw new DDN$1.DDNError('DDN072','Legend exceeds page height');
   if(p.publication.fit==='none'&&(width*scale>availW+.1||height*scale>availH+.1)){if(p.publication.overflow==='error')throw new DDN$1.DDNError('DDN074','Unscaled drawing exceeds publication area; choose reflow or a larger page');diags.push({code:'DDN074',severity:'warning',message:'Unscaled drawing exceeds publication area'});}
   const tx=pinFocus?margin+availW/2-pinFocus[0]*scale:margin-minX*scale+10,ty=pinFocus?headBlock-20+extraHeader+availH/2-pinFocus[1]*scale:headBlock-20+extraHeader-minY*scale+10;
   let diagram='';
   if(ladderRails)diagram+=`<g class="ddn-ladder-rails"><path d="M${fmt(ladderRails.x0)} ${fmt(ladderRails.y0)}V${fmt(ladderRails.y1)}" fill="none" stroke="${t.ink}" stroke-width="2.5"/><path d="M${fmt(ladderRails.x1)} ${fmt(ladderRails.y0)}V${fmt(ladderRails.y1)}" fill="none" stroke="${t.ink}" stroke-width="2.5"/></g>`;
   for(const f of frames){diagram+=`<g class="ddn-frame" data-frame="${esc$1(f.id)}">`+rect(f.x,f.y,f.w,f.h,t.rule,t.surface,p.style.look,f.id,0,{...p.style,hachure:false})+text$1(f.x+15,f.y+26,f.name,13,t.muted,650);
    if(f.x_region===true)diagram+=`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="none" stroke="${t.rule}" stroke-dasharray="6 4"/>`;
    /* B1-060 : interruptible activity region (dashed roundrect) and
     * structured/expansion region keyword. */
    if(f.x_interruptible===true)diagram+=`<rect data-interruptible="true" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="18" fill="none" stroke="${t.rule}" stroke-dasharray="7 5"/>`;
    if(f.x_structured?.mode)diagram+=text$1(f.x+15,f.y+46,'«'+f.x_structured.mode+'»',11,t.muted,650);
    /* B1-063: collapsed pool — black-box participant band. */
    if(f.x_pool===true&&f.x_collapsed===true)diagram+=`<rect data-collapsed-pool="true" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${esc$1(t.surface)}" stroke="${esc$1(t.ink)}" stroke-width="2.4"/>`;
    diagram+=`</g>`;}
   const routeColours={};
   const gensets=new Map();
   for(const a of routes){
    /* 0.8 (chapter 04 §6B): portable relation line { } — color/weight/dash
     * decorate the painted route and its endpoint heads (they share the line's
     * pen). Monochrome themes keep their B/W contract; geometry is untouched. */
    const lineSpec=a.r.properties?.line||null;
    const colour=mono?(theme08==='mono_print'?'#000000':'#383838'):lineSpec?.color??(theme08==='colorblind_safe'?cbRemap(api$a.semantic(a.reg.colour,t)):api$a.semantic(a.reg.colour,t));routeColours[a.id]=colour;
    const lineW=lineSpec?.weight??a.reg.width;
    const lineDash=lineSpec&&Object.hasOwn(lineSpec,'dash')?DDN$1.LINE_DASH_PATTERNS[lineSpec.dash]:a.reg.pattern;
    /* B1-055 : n-ary association — the binary route is suppressed and
     * replaced by the UML diamond junction at the member centroid with one
     * straight spoke per end, each carrying its role/multiplicity labels. */
    const nary=a.r.properties.x_nary;
    if(nary){const s=q$1(p.style.font_size,16)/16;
     const el=a.r.properties.x_endlabels||{};
     const ends=[{element:a.r.from.element,label:el.source},{element:a.r.to.element,label:el.target},...nary.ends.map(e=>({element:e.element?.$ref,label:{role:e.role,multiplicity:e.multiplicity}}))];
     const gs2=ends.map(e=>byId.get(e.element)).filter(Boolean);
     if(gs2.length>=3){
      const j=[gs2.reduce((v,g)=>v+g.x+g.w/2,0)/gs2.length,gs2.reduce((v,g)=>v+g.y+g.h/2,0)/gs2.length];
      diagram+=`<g class="${cls('ddn-relation','ddn-rel','ddn-nary','ddn-verb-'+slug(a.reg.code||a.r.kind))}" data-id="${esc$1(a.id)}"><title>${esc$1(a.r.name)}</title>`;
      for(const [i,g]of gs2.entries()){const pt=rectAnchor(g,j),ang=Math.atan2(j[1]-pt[1],j[0]-pt[0])*180/Math.PI,rad=ang*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad),nx=-dy,ny=dx,e=ends[i].label;
       diagram+=`<path data-nary-spoke="${esc$1(ends[i].element)}" d="M${fmt(j[0])} ${fmt(j[1])}L${fmt(pt[0])} ${fmt(pt[1])}" fill="none" stroke="${esc$1(colour)}" stroke-width="${lineW}"${lineDash?` stroke-dasharray="${esc$1(lineDash)}"`:''}/>`;
       if(e?.role)diagram+=`<g class="ddn-endlabel ddn-endlabel-role">`+text$1(pt[0]+dx*22*s+nx*11*s,pt[1]+dy*22*s+ny*11*s,e.role,11*s,colour,500)+'</g>';
       if(e?.multiplicity)diagram+=`<g class="ddn-endlabel ddn-endlabel-multiplicity">`+text$1(pt[0]+dx*22*s-nx*11*s,pt[1]+dy*22*s-ny*11*s+4*s,e.multiplicity,11*s,colour,500)+'</g>';}
      diagram+=`<path data-nary-junction="true" d="M${fmt(j[0])} ${fmt(j[1]-9*s)}L${fmt(j[0]+9*s)} ${fmt(j[1])}L${fmt(j[0])} ${fmt(j[1]+9*s)}L${fmt(j[0]-9*s)} ${fmt(j[1])}Z" fill="${esc$1(colour)}"/>`;
      diagram+='</g>';
      continue;
     }
    }
    if(a.r.properties.x_genset&&!gensets.has(a.r.properties.x_genset.name))gensets.set(a.r.properties.x_genset.name,{gs:a.r.properties.x_genset,pt:a.points.at(-1),ang:api$6.curveDirection(a)+180,colour});
    let mask='';const holes=crossings.filter(c=>p.layout.crossings==='gap'?c.under===a.id:c.over===a.id);if(holes.length){const mid='gap-'+hash(a.id);mask=` mask="url(#${mid})"`;diagram+=`<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="${minX-100}" y="${minY-100}" width="${width+200}" height="${height+200}"><rect x="${minX-100}" y="${minY-100}" width="${width+200}" height="${height+200}" fill="white"/>`+holes.map(h=>`<circle cx="${h.point[0]}" cy="${h.point[1]}" r="7" fill="black"/>`).join('')+'</mask></defs>';}
    diagram+=`<g class="${cls('ddn-relation','ddn-rel','ddn-verb-'+slug(a.reg.code||a.r.kind))}" data-routing="${a.routing||p.layout.routing}" data-id="${esc$1(a.id)}"><title>${esc$1(a.r.name)}</title>`;
    /* B1-101: string routing — a slightly sagging, gently wavy line pinned
     * between the two points (workshop string between sticky notes). Geometry
     * is the straight corridor; only the drawn path changes. */
    const isString=(a.routing||p.layout.routing)==='string';
    /* The layout router may detour a direct corridor to seat the label; a
     * string only cares about its two pinned ends, so the curve always spans
     * endpoint to endpoint regardless of any label-detour middle points. */
    const stringD=pts=>{const [x0,y0]=pts[0],[x1,y1]=pts.at(-1);
     const dist=Math.hypot(x1-x0,y1-y0),sag=Math.max(8,Math.min(40,dist*.12)),dx=(x1-x0)/3,dy=(y1-y0)/3,wob=((parseInt(hash(a.id),16)%7)-3)*2;
     return `M${fmt(x0)} ${fmt(y0)}C${fmt(x0+dx)} ${fmt(y0+dy+sag+wob)}, ${fmt(x0+2*dx)} ${fmt(y0+2*dy+sag-wob)}, ${fmt(x1)} ${fmt(y1)}`;};
    const pieces=isString?[{points:a.points,d:stringD(a.points),distance:0}]:(a.commands||holes.some(h=>h.overDistance!==undefined)?api$6.curvePieces(a,holes):visibleRoutePieces(a.points,holes));
    diagram+=`<g${mask} data-route-pieces="${pieces.length}">`+pieces.map((piece,i)=>p.style.look==='handDrawn'?(a.commands?api$8.curve:api$8.polyline)(a.commands?piece.commands:piece.points,{...p.style,id:a.id+':piece:'+i,stroke:colour,width:lineW,dash:lineDash,dashOffset:-piece.distance,protectedPoints:crossings.filter(c=>c.under===a.id||c.over===a.id).map(c=>c.point)}):`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(colour)}" stroke-width="${lineW}"${lineDash?` stroke-dasharray="${esc$1(lineDash)}" stroke-dashoffset="${fmt(-piece.distance)}"`:''}/>`).join('')+'</g>';
    /* B1-090: cross-file relations — the badge edge draws dashed and muted. */
    if(a.r.properties.x_external)diagram+=`<g data-external="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(t.muted)}" stroke-width="${a.reg.width}" stroke-dasharray="7 5"/>`).join('')+'</g>';
    /* B1-090: x_link — external association note at the route's target end. */
    const xl=a.r.properties.x_link;
    if(xl){const s2=q$1(p.style.font_size,16)/16,xpt=a.points.at(-1);
     diagram+=`<g class="ddn-xlink" data-file="${esc$1(xl.file)}" data-target="${esc$1(xl.target)}"${a.r.properties._xlink==='unresolved'?' data-unresolved="true"':''}>`+text$1(xpt[0]+10*s2,xpt[1]-8*s2,'→ '+xl.file+': '+xl.target+(a.r.properties._xlink==='unresolved'?' (unresolved)':''),10*s2,t.muted,500)+'</g>';}
    if(a.r.properties.x_chen_total){diagram+=`<g${mask} data-total-participation="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(colour)}" stroke-width="5"/><path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(t.surface)}" stroke-width="2"/>`).join('')+'</g>';}
    if(a.r.properties.x_critical){const s=q$1(p.style.font_size,16)/16;diagram+=`<g${mask} data-critical-path="true">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${t.accent}" stroke-width="${fmt(3*s)}"/>`).join('')+'</g>';}
    const startType=a.r.properties.source_mark||a.reg.start,endType=a.r.properties.target_mark||a.reg.end;
    /* B1-078: IDEF0 tunneled arrows — an open parenthesis at the tunneled end
     * instead of the arrowhead. */
    const tun=side=>{const xt=a.r.properties.x_tunnel||{};if(!xt[side])return false;return true;};
    diagram+=(tun('start')?tunnelMark(a.points[0],api$6.curveDirection(a,true),colour):endMark(a.points[0],api$6.curveDirection(a,true),startType,colour,t.surface,lineSpec?.weight))
     +(tun('end')?tunnelMark(a.points.at(-1),api$6.curveDirection(a),colour):endMark(a.points.at(-1),api$6.curveDirection(a),endType,colour,t.surface,lineSpec?.weight));
    /* B1-060 : interrupting/exception edges draw a lightning-bolt
     * zigzag over the route (perpendicular jog per segment, alternating side). */
    if(a.r.properties.x_interrupt===true||a.r.properties.x_exception===true){
     const bolt=[];let side=1;
     for(const seg of segments(a.points)){const mx=(seg.a[0]+seg.b[0])/2,my=(seg.a[1]+seg.b[1])/2,dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*8,ny=dx/len*8;
      bolt.push(seg.a,[mx+nx*side,my+ny*side]);side=-side;}
     bolt.push(a.points.at(-1));
     diagram+=`<g data-lightning="${a.r.properties.x_exception===true?'exception':'interrupt'}"><path d="${pathD(bolt)}" fill="none" stroke="${esc$1(colour)}" stroke-width="1.7"/>`+endMark(a.points.at(-1),api$6.curveDirection(a),'filled',colour,t.surface)+'</g>';}
    /* B1-055 : UML endpoint label slots. Role text sits above the line
     * near the endpoint, multiplicity below it; a qualifier is the small rect at
     * the end. Angles point away from the endpoint along the route. */
    const el=a.r.properties.x_endlabels;
    if(el){const s=q$1(p.style.font_size,16)/16;
     for(const [key,pt,ang]of [['source',a.points[0],api$6.curveDirection(a,true)+180],['target',a.points.at(-1),api$6.curveDirection(a)+180]]){
      const e=el[key];if(!e)continue;
      const rad=ang*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad),nx=-dy,ny=dx;
      if(e.role)diagram+=`<g class="ddn-endlabel ddn-endlabel-role" data-end="${key}">`+text$1(pt[0]+dx*24*s+nx*11*s,pt[1]+dy*24*s+ny*11*s,e.role,11*s,colour,500)+'</g>';
      if(e.multiplicity)diagram+=`<g class="ddn-endlabel ddn-endlabel-multiplicity" data-end="${key}">`+text$1(pt[0]+dx*24*s-nx*11*s,pt[1]+dy*24*s-ny*11*s+4*s,e.multiplicity,11*s,colour,500)+'</g>';
      if(e.qualifier){const qw=Math.max(24*s,e.qualifier.length*6.2*s+10*s),qh=17*s,cx=pt[0]+dx*(qw/2+2),cy=pt[1]+dy*(qh/2+2);
       diagram+=`<g class="ddn-qualifier" data-end="${key}"><rect x="${fmt(cx-qw/2)}" y="${fmt(cy-qh/2)}" width="${fmt(qw)}" height="${fmt(qh)}" fill="${esc$1(t.surface)}" stroke="${esc$1(colour)}" stroke-width="1.2"/>`+text$1(cx-qw/2+5*s,cy+4*s,e.qualifier,10.5*s,colour,500)+'</g>';}
     }
    }
    /* B1-055: association class — dashed connector from the path midpoint to the
     * named class box border. */
    const ac=a.r.properties.x_association_class;
    if(ac){const g=byId.get(ac.class?.$ref);if(g){const [mx,my]=midpoint(a.points),pt=rectAnchor(g,[mx,my]);
     diagram+=`<g class="ddn-association-class" data-class="${esc$1(ac.class.$ref)}"><path d="M${fmt(mx)} ${fmt(my)}L${fmt(pt[0])} ${fmt(pt[1])}" fill="none" stroke="${esc$1(colour)}" stroke-width="1.3" stroke-dasharray="6 4"/></g>`;}}
    if(p.projection.profile?.startsWith('sysml.')||['uml.composite@1','uml.activity@2','sysml.activity@1','soaml.services@1','sdl.basic@1','fbd.basic@1','ladder.basic@1'].includes(p.projection.profile)){const s=q$1(p.style.font_size,16)/16;
     for(const[ep,pt]of [[a.r.from,a.points[0]],[a.r.to,a.points.at(-1)]])if(ep.member&&portIds.has(ep.member)){
      const member=context.members.get(ep.member),xp=member?.properties?.x_pin||{},xo=member?.properties?.x_port||{},xs=member?.properties?.x_service||null;
      const filled=xp.streaming||xo.type==='full'||xs?.kind==='service';
      diagram+=`<rect data-port-square="${esc$1(ep.member)}"${xp.streaming?' data-streaming="true"':''}${xo.type?` data-port-type="${xo.type}"`:''}${xo.conjugated?' data-conjugated="true"':''}${xs?` data-service="${xs.kind}"`:''} x="${fmt(pt[0]-5*s)}" y="${fmt(pt[1]-5*s)}" width="${fmt(10*s)}" height="${fmt(10*s)}" fill="${filled?esc$1(colour):esc$1(t.surface)}" stroke="${esc$1(colour)}" stroke-width="1.5"/>`;
      /* B1-084: FBD pin type label and negation bubble. */
      const xf=member?.properties?.x_fbd;
      if(xf){
       diagram+=`<g class="ddn-fbd-pin">`+text$1(pt[0]+(ep===a.r.from?-12*s:12*s),pt[1]+4*s,xf.type,9.5*s,colour,500,ep===a.r.from?'text-anchor="end"':'')+'</g>';
       if(xf.negated)diagram+=`<circle data-negated="true" cx="${fmt(pt[0])}" cy="${fmt(pt[1])}" r="${fmt(4*s)}" fill="${esc$1(t.surface)}" stroke="${esc$1(colour)}" stroke-width="1.5"/>`;
      }
      /* B1-072 : SoaML «Service»/«Request» badge by the port square. */
      if(xs)diagram+=`<g class="ddn-port-label ddn-service-badge">`+text$1(pt[0]+12*s,pt[1]+16*s,'«'+(xs.kind==='service'?'Service':'Request')+'»',10*s,colour,600)+'</g>';
      /* B1-065 : SysML port typing — «proxy»/«full» label, conjugation
       * tilde, multiplicity, nested port sub-squares. */
      const portNote=[xo.conjugated?'~':'',member?.name||'',xo.multiplicity?' ['+xo.multiplicity+']':''].join('');
      if(xo.type||xo.conjugated||xo.multiplicity)diagram+=`<g class="ddn-port-label">`+text$1(pt[0]+12*s,pt[1]-8*s,(xo.type?'«'+xo.type+'» ':'')+portNote,10.5*s,colour,500)+'</g>';
      for(const [ni,np]of (xo.nested||[]).entries())diagram+=`<rect data-nested-port="${esc$1(np.name)}" x="${fmt(pt[0]-3*s+ni*7*s)}" y="${fmt(pt[1]-3*s)}" width="${fmt(6*s)}" height="${fmt(6*s)}" fill="${np.type==='full'?esc$1(colour):esc$1(t.surface)}" stroke="${esc$1(colour)}" stroke-width="1.2"/>`;
      if(xp.set)diagram+=`<g class="ddn-pin-set">`+text$1(pt[0]+12*s,pt[1]-8*s,xp.set,10.5*s,colour,500)+'</g>';}}
    /* 0.8 (chapter 55 §55.1): relation markings. forbidden = struck-through
     * with a dashed, theme-supplied prohibition treatment (mono_print adds a
     * hatch cross so the signal survives pure B/W); tentative = dashed-grey.
     * Paint only — the routed geometry is untouched. */
    for(const mk of (a.r.properties.marks||[])){const paint=markingPaint(mk,theme08);if(!paint)continue;
     const[mx,my]=midpoint(a.points),ang=api$6.curveDirection(a)*Math.PI/180,nx=-Math.sin(ang),ny=Math.cos(ang);
     diagram+=`<g class="ddn-mark ddn-mark-${esc$1(mk)}" data-mark="${esc$1(mk)}" data-relation="${esc$1(a.id)}">`+pieces.map(piece=>`<path d="${piece.d||pathD(piece.points)}" fill="none" stroke="${esc$1(paint.stroke)}" stroke-width="${a.reg.width+0.6}"${paint.dash?` stroke-dasharray="${esc$1(paint.dash)}"`:''}/>`).join('');
     if(paint.strike)diagram+=`<path d="M${fmt(mx-nx*13)} ${fmt(my-ny*13)}L${fmt(mx+nx*13)} ${fmt(my+ny*13)}" stroke="${esc$1(paint.stroke)}" stroke-width="2.4" fill="none"/>`;
     if(paint.hatch)diagram+=`<path data-hatch="true" d="M${fmt(mx-nx*13-Math.cos(ang)*10)} ${fmt(my-ny*13-Math.sin(ang)*10)}L${fmt(mx+nx*13-Math.cos(ang)*10)} ${fmt(my+ny*13-Math.sin(ang)*10)}M${fmt(mx-nx*13+Math.cos(ang)*10)} ${fmt(my-ny*13+Math.sin(ang)*10)}L${fmt(mx+nx*13+Math.cos(ang)*10)} ${fmt(my+ny*13+Math.sin(ang)*10)}" stroke="${esc$1(paint.stroke)}" stroke-width="1.4" fill="none"/>`;
     diagram+='</g>';}
    diagram+='</g>';
   }
   /* B1-060 : pins with no incident edge still render on the action
    * border (in→west, out→east), streaming filled, set label beside. */
   if(p.projection.profile==='uml.activity@2'||p.projection.profile==='sysml.activity@1'){
    const s=q$1(p.style.font_size,16)/16,connected=new Set(rels.flatMap(r=>[r.from.member,r.to.member].filter(Boolean)));
    for(const n of ir.elements){if(!byId.has(n.id)||!n.ports?.length)continue;
     const g=byId.get(n.id);
     for(const pt of n.ports){if(connected.has(pt.id))continue;
      const xp=pt.properties.x_pin||{},west=(pt.properties.direction||'in')!=='out';
      const xx=west?g.x:g.x+g.w,yy=g.y+g.h/2;
      diagram+=`<g class="ddn-pin" data-port-square="${esc$1(pt.id)}"${xp.streaming?' data-streaming="true"':''}><rect x="${fmt(xx-5*s)}" y="${fmt(yy-5*s)}" width="${fmt(10*s)}" height="${fmt(10*s)}" fill="${xp.streaming?esc$1(t.ink):esc$1(t.surface)}" stroke="${esc$1(t.ink)}" stroke-width="1.5"/>`+(xp.set?text$1(xx+(west?-8*s:8*s),yy-8*s,xp.set,10.5*s,t.muted,500,west?'text-anchor="end"':''):'')+'</g>';}
    }
   }
   // B1-061 : communication-diagram fragments — dashed frame with an
   // operator pentagon over the covered message routes; guards at operand starts.
   if(p.projection.profile==='uml.communication@2'){
    const s=q$1(p.style.font_size,16)/16,byRelId=new Map(routes.map(a=>[a.r.id,a]));
    const drawFrag=(fx,owner,depth,x0,y0,x1,y1)=>{
     const pad=(30+depth*10)*s,rx0=Math.max(4*s,x0-pad),ry0=Math.max(4*s,y0-pad),rx1=x1+pad,ry1=y1+pad;
     const opw=Math.max(54*s,api$9.measure(fx.operator,11*s,p.style.font,650).width+22*s);
     let out=`<g class="ddn-fragment ddn-fragment-${esc$1(fx.operator)}" data-operator="${esc$1(fx.operator)}" data-owner="${esc$1(owner)}"><rect x="${fmt(rx0)}" y="${fmt(ry0)}" width="${fmt(rx1-rx0)}" height="${fmt(ry1-ry0)}" fill="none" stroke="${t.ink}" stroke-width="1.3" stroke-dasharray="7 5"/>`;
     out+=`<path d="M${fmt(rx0)} ${fmt(ry0)}H${fmt(rx0+opw)}V${fmt(ry0+12*s)}L${fmt(rx0+opw-10*s)} ${fmt(ry0+22*s)}H${fmt(rx0)}Z" fill="${esc$1(t.surface)}" stroke="${esc$1(t.ink)}" stroke-width="1.2"/>`+text$1(rx0+11*s,ry0+15*s,fx.operator,11*s,t.ink,650);
     for(const op of fx.operands){if(op.guard){const first=byRelId.get(op.messages[0]?.$ref);if(first){const [mx,my]=midpoint(first.points);out+=text$1(mx,my-22*s,'['+op.guard+']',11*s,t.ink,500);}}
      for(const nf of op.fragments||[]){}}
     return out+'</g>';};
    for(const a of routes){const fx=a.r.properties.x_fragment;if(!fx)continue;
     const pts=[];const collect=(f2)=>{for(const op of f2.operands){for(const mref of op.messages){const rr=byRelId.get(mref?.$ref);if(rr)pts.push(...rr.points);}for(const nf of op.fragments||[])collect(nf);}};
     collect(fx);if(pts.length<2)continue;
     const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
     diagram+=drawFrag(fx,a.r.id,0,Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));}
   }
   // B1-055: generalization-set labels at the shared target end.
   for(const [name,{gs,pt,ang,colour}] of gensets){const s=q$1(p.style.font_size,16)/16,rad=ang*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad);
    const str=name+' {'+(gs.disjoint===false?'overlapping':'disjoint')+', '+(gs.complete?'complete':'incomplete')+'}';
    diagram+=`<g class="ddn-genset" data-genset="${esc$1(name)}">`+text$1(pt[0]+dx*36*s,pt[1]+dy*36*s-8*s,str,11*s,colour,500)+'</g>';}
   // Bridge geometry is explicit postprocessing. A rounded bridge is a local exception to orthogonality.
   if(p.layout.crossings!=='gap')for(const c of crossings){
    const col=routeColours[c.over];
    if(c.overDistance!==undefined){const route=routes.find(r=>r.id===c.over),commands=api$6.crossingBridge(c,route,p.layout.crossings),points=api$6.flattenCurve(commands).points;
     if(geoms.some(g=>api$6.segs(points).some(s=>api$6.segmentBox(s,api$6.box(g,2))))||routed.labels.some(g=>api$6.segs(points).some(s=>api$6.segmentBox(s,api$6.box(g,2)))))throw new DDN$1.DDNError('DDN224','Crossing jump obstructs an object or label; increase spacing or select crossings:gap');
     diagram+=`<path data-crossing-jump="true" d="${api$6.pathData(commands)}" stroke="${esc$1(col)}" stroke-width="2" fill="none"/>`;
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
    const routeD=a=>a.commands?api$6.pathData(a.commands):pathD(a.points);
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
   geoms.forEach(g=>diagram+=renderNode(g,p,t,registry));
   for(const d of subs){
    if(d.mode==='inline'&&d.child){const child=render$1(d.child,registry,glyphDefs),childScale=Math.min(d.w/child.scene.width,d.h/child.scene.height)*scale*embeddingScale;const childMin=child.scene.smallestText*childScale;if(childMin<minFont){if(p.publication.overflow==='error')throw new DDN$1.DDNError('DDN076','Inline child text is below final minimum; enlarge the child or link a detail view');diags.push({code:'DDN076',severity:'warning',message:'Inline child rendered below configured minimum'});}let inner=child.svg.replace(/<\?xml[^>]*>/,'');const prefix='sub-'+hash(d.id)+'-';inner=inner.replace(/ id="([^"]+)"/g,(m,id)=>` id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${prefix}${id})`).replace(/(href|xlink:href)="#([^"]+)"/g,(m,a,id)=>`${a}="#${prefix}${id}"`).replace(/aria-labelledby="[^"]*"/g,'').replace(/<svg /,`<svg x="${d.x}" y="${d.y}" `).replace(/width="[^"]*" height="[^"]*"/,`width="${d.w}" height="${d.h}"`);diagram+=`<g class="ddn-inline" data-view="${esc$1(d.target)}">`+inner+'</g>';}
    else {if(!/^[A-Za-z0-9_.\/-]+$/.test(d.targetLocal)||d.targetLocal.startsWith('/')||d.targetLocal.includes('..'))throw new DDN$1.DDNError('DDN078','Subdiagram reference target must be a safe relative identifier: '+d.targetLocal);diagram+=`<g class="ddn-subdiagram" data-view="${esc$1(d.target)}"><a href="${esc$1(d.targetLocal)}.svg">`+rect(d.x,d.y,d.w,d.h,t.accent,t.surface,p.style.look,d.id,0,p.style)+glyph('frame',d.x+14,d.y+18,25,t.accent)+text$1(d.x+48,d.y+33,d.name,15,t.ink,600)+text$1(d.x+14,d.y+64,'↗ '+d.targetLocal+' · diagram reference',11,t.muted)+'</a></g>';}
   }
   for(const a of routes){
    /* B1-079: Petri arc weights print at the target end of the arc. */
    const wgt=a.r.properties.x_petri?.weight;
    if(wgt>1&&p.detail!=='shapes'){
     const sc=q$1(p.style.font_size,16)/16,[tx,ty]=a.points.at(-1),ang=api$6.curveDirection(a)*Math.PI/180;
     diagram+=`<g class="ddn-petri-weight">`+text$1(tx-Math.cos(ang)*18*sc-Math.sin(ang)*10*sc,ty-Math.sin(ang)*18*sc+Math.cos(ang)*10*sc+4*sc,String(wgt),11*sc,t.ink,600)+'</g>';
    }
    if(a.r.kind==='vsm.einfo'){
     /* B1-081: einfo relations draw a zigzag over the route (electronic info). */
     const bolt=[];let side=1;
     for(const seg of segments(a.points)){const mx=(seg.a[0]+seg.b[0])/2,my=(seg.a[1]+seg.b[1])/2,dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*7,ny=dx/len*7;
      bolt.push(seg.a,[mx+nx*side,my+ny*side]);side=-side;}
     bolt.push(a.points.at(-1));
     const ecolour=mono?'#383838':api$a.semantic(a.reg.colour,t);
     diagram+=`<g class="ddn-vsm-einfo" data-zigzag="electronic"><path d="${pathD(bolt)}" fill="none" stroke="${esc$1(ecolour)}" stroke-width="1.6"/>`+endMark(a.points.at(-1),api$6.curveDirection(a),'open',ecolour,t.surface)+'</g>';
     continue;
    }
    if(a.r._visualLabel===false||p.detail==='shapes'||p.legend.mode==='none')continue;let [x,y]=a.hint.callout?a.hint.callout.map(v=>q$1(v)):midpoint(a.points);let mode=p.legend.mode;
    if(mode==='numbers'){diagram+=`<g class="ddn-callout ddn-label" data-id="${esc$1(a.id)}"><circle cx="${x}" cy="${y}" r="14" fill="${t.surface}" stroke="${t.ink}" stroke-width="1.5"/>`+text$1(x,y+4.5,String(ir.view.keys[a.id]),12,t.ink,700,'text-anchor="middle"')+'</g>';}
    else {let s=mode==='tokens'?a.reg.code:a.r.name,w=a.label.w;diagram+=`<g class="ddn-label" data-id="${esc$1(a.id)}"><rect x="${x-w/2}" y="${y-12}" width="${w}" height="24" rx="3" fill="${t.surface}"/>`+text$1(x,y+4,s,12,t.ink,500,'text-anchor="middle"')+'</g>';
     /* B1-061: {…} time/duration constraints under the message label. */
     const cons=[a.r.properties.x_message?.time,a.r.properties.x_message?.duration].filter(Boolean);
     if(cons.length&&p.projection.profile==='uml.communication@2')diagram+=`<g class="ddn-timing-constraint">`+text$1(x,y+22,cons.join(' '),11,t.muted,500,'text-anchor="middle"')+'</g>';}
   }
   if(vsmLadder){
    const L=vsmLadder,ls=L.s,top=maxY-L.h-16*ls,bot=top+L.h;
    let lx=minX-24*ls,level=0,path=`M${fmt(lx)} ${fmt(top)}`;
    const labels=[];
    for(const step of L.steps){
     path+=`L${fmt(step.x)} ${fmt(level?bot:top)}`;
     level=1-level;
     path+=`L${fmt(step.x)} ${fmt(level?bot:top)}`;
     if(step.va!==undefined)labels.push(text$1(step.x,top-6*ls,String(step.va)+(step.unit?' '+step.unit:''),11*ls,t.ink,600,'text-anchor="middle"'));
     if(step.nva!==undefined)labels.push(text$1(step.x,bot+16*ls,String(step.nva)+(step.unit?' '+step.unit:''),11*ls,t.muted,500,'text-anchor="middle"'));
    }
    const totVA=L.steps.reduce((n,st)=>n+(st.va||0),0),totNVA=L.steps.reduce((n,st)=>n+(st.nva||0),0);
    path+=`L${fmt(maxX+24*ls)} ${fmt(level?bot:top)}`;
    labels.push(text$1(maxX+8*ls,top-6*ls,'Σ '+totVA,11*ls,t.ink,650,''));
    labels.push(text$1(maxX+8*ls,bot+16*ls,'Σ '+totNVA,11*ls,t.muted,650,''));
    diagram+=`<g class="ddn-vsm-ladder"><path d="${path}" fill="none" stroke="${esc$1(t.ink)}" stroke-width="2"/>`+labels.join('')+text$1(lx,bot+34*ls,'VA / NVA timeline',10.5*ls,t.muted,500,'')+'</g>';
   }
   const scene={smallestText:fontSize,width:pageW,height:pageH,scale,origin:[tx,ty],nodes:geoms.map(({n,k,fieldRows,sample,...g})=>({...g,fields:g.fields.map(f=>f.id),fieldRows:fieldRows.map(({field,...row})=>row)})),routes:routes.map(({id,points,label,source_side,target_side,commands,routing,strategy,curveFamily,radius,appliedTension})=>({id,points,label:label.bounds,source_side,target_side,routing:routing||p.layout.routing,...(commands?{commands,strategy,curveFamily,...(radius!==undefined?{curveRadius:radius}:{}),...(appliedTension!==undefined?{appliedTension}:{}),flattenTolerance:api$6.CURVE_TOLERANCE}:{})})),crossings,frames,subdiagrams:subs,quality:routed.quality,layout:{...placed.telemetry,...routed.telemetry,algorithm:p.layout.algorithm,routing:p.layout.routing,engine:'ddn-native@'+DDN$1.VERSION,...(tf.scene?{textFit:tf.scene}:{})},drawingBounds:{x:minX,y:minY,w:width,h:height},drawingArea:{x:margin,y:headBlock-20+extraHeader,w:availW,h:availH},...(motionScene.length?{motion:motionScene}:{}),...(flowScene.length?{flows:flowScene}:{}),...(pinFocus?{focus:{world:pinFocus,page:[tx+pinFocus[0]*scale,ty+pinFocus[1]*scale]}}:{})};
   const font=FONT_STACKS[p.style.font]||'DejaVu Sans, Arial, sans-serif';
   const fontClass='ddn-font-'+hash(font);
   const viewClass=cls('ddn-svg','ddn-view-'+slug(p.projection?.kind||'graph'),p.projection?.profile&&'ddn-profile-'+slug(p.projection.profile),fontClass);
   let out=`<?xml version="1.0" encoding="UTF-8"?>\n<svg class="${viewClass}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(pageW)}" height="${fmt(pageH)}" viewBox="0 0 ${fmt(pageW)} ${fmt(pageH)}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="ddn-title ddn-desc"><title id="ddn-title">${esc$1(ir.view.name)}</title><desc id="ddn-desc">DDN ${DDN$1.VERSION} proposed standard example. ${esc$1(p.publication.caption||'')} ${esc$1(p.style.look)} look; ${esc$1(p.style.theme)} presentation. Crossings are not connections.${legendPlacement==='none'?'':' Relationship details are in the adjacent legend.'}</desc><defs>${glyphDefs}</defs><style>.${fontClass}{font-family:${font}} .ddn-node:focus{outline:none}</style><rect width="100%" height="100%" fill="${t.background}"/>`;
   /* 0.8 (chapter 53 §53.3): page background paints the whole page behind
    * drawing and chrome. Rasters embed as base64 data URIs of the resolved
    * workspace file (the export is self-contained); patterns inline the
    * pre-sanitized SVG with ids namespaced per page. */
   const bg08=p.publication.background;
   if(bg08){
    if(bg08.kind==='color')out+=`<rect class="ddn-pub-background" width="100%" height="100%" fill="${esc$1(bg08.color)}"${bg08.opacity<1?` opacity="${bg08.opacity}"`:''}/>`;
    else if(bg08.kind==='image')out+=`<image class="ddn-pub-background" href="data:${bg08.mime};base64,${bg08.data}" xlink:href="data:${bg08.mime};base64,${bg08.data}" width="${fmt(pageW)}" height="${fmt(pageH)}" preserveAspectRatio="xMidYMid slice"${bg08.opacity<1?` opacity="${bg08.opacity}"`:''}/>`;
    else if(bg08.kind==='pattern'){const pid='bgp-'+hash(bg08.path+bg08.svg);
     let inner=bg08.svg.replace(/<\?xml[^>]*>/,'').replace(/ id="([^"]+)"/g,(m,id)=>` id="${pid}-${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#${pid}-${id})`);
     const vb=(bg08.svg.match(/viewBox="([^"]+)"/)||[])[1]?.trim().split(/[\s,]+/).map(Number);
     const tw=vb?.length===4&&vb[2]>0?vb[2]:80,th=vb?.length===4&&vb[3]>0?vb[3]:80;
     inner=inner.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
     out+=`<defs><pattern id="${pid}" width="${fmt(tw)}" height="${fmt(th)}" patternUnits="userSpaceOnUse">${inner}</pattern></defs><rect class="ddn-pub-background" width="100%" height="100%" fill="url(#${pid})"${bg08.opacity<1?` opacity="${bg08.opacity}"`:''}/>`;}}
   /* 0.8 (chapter 53 §53.2): page border/frame — a page frame with no model
    * semantics; it neither shrinks nor grows the drawing area. */
   const border08=p.publication.border;
   if(border08){
    const bw=border08.weight*PT,ix=border08.inset,rw=pageW-2*ix,rh=pageH-2*ix,dash=border08.style==='dashed'?` stroke-dasharray="${fmt(6*bw)} ${fmt(4*bw)}"`:'';
    out+=`<g class="ddn-pub-border" data-style="${border08.style}">`;
    if(rw>0&&rh>0){
     out+=`<rect x="${fmt(ix)}" y="${fmt(ix)}" width="${fmt(rw)}" height="${fmt(rh)}" fill="none" stroke="${esc$1(t.ink)}" stroke-width="${fmt(bw)}"${dash}/>`;
     if(border08.style==='double'){const off=1.5*bw;out+=`<rect x="${fmt(ix+off)}" y="${fmt(ix+off)}" width="${fmt(rw-2*off)}" height="${fmt(rh-2*off)}" fill="none" stroke="${esc$1(t.ink)}" stroke-width="${fmt(bw)}"${dash}/>`;}
    }
    if(border08.corner_marks){const L=18,G=6;
     for(const[cx,cy,sx,sy]of [[ix,ix,-1,-1],[pageW-ix,ix,1,-1],[ix,pageH-ix,-1,1],[pageW-ix,pageH-ix,1,1]])
      out+=`<path class="ddn-pub-corner" d="M${fmt(cx+sx*G)} ${fmt(cy)}L${fmt(Math.max(2,Math.min(pageW-2,cx+sx*(G+L))))} ${fmt(cy)}M${fmt(cx)} ${fmt(cy+sy*G)}L${fmt(cx)} ${fmt(Math.max(2,Math.min(pageH-2,cy+sy*(G+L))))}" stroke="${esc$1(t.ink)}" stroke-width="${fmt(bw)}" fill="none"/>`;}
    out+='</g>';}
   /* 0.8 (chapter 53 §53.1): header/footer runs. Slots position the run
    * (left/center/right across the page); align overrides the anchor. Every run
    * carries addressable classes (ddn-run ddn-run-<slot>). Run-level text
    * properties (chapter 04 §6A) resolve against the slot's baked weight; the
    * view-wide style.text deliberately does NOT restyle page furniture, so runs
    * paint through their own path rather than text(). */
   const emitBand=(band,y0,clsName)=>{
    let s=`<g class="${clsName}">`;
    for(const slot of ['left','center','right']){const r=band[slot];if(!r)continue;
     const sizePx=r.size*PT,anchor=r.align==='center'?'middle':r.align==='right'?'end':'start';
     const bx=r.align==='center'?pageW/2:r.align==='right'?pageW-margin:margin;
     const fontExtra=r.font?` font-family="${esc$1(FONT_STACKS[r.font]||font)}"`:'';
     const ts=r.textStyle||null,rw=ts?.weight??(slot==='center'?600:400),rf=ts?.color??t.muted;
     bandLines(r).forEach((ln,i)=>{api$9.measure(ln,sizePx,r.font||activeFont,rw,ts);s+=`<text class="ddn-run ddn-run-${slot}" x="${fmt(bx)}" y="${fmt(y0+sizePx+i*sizePx*1.35)}" font-size="${fmt(sizePx)}" fill="${esc$1(rf)}" font-weight="${rw}"${ts?api$9.paintAttrs(ts):''} text-anchor="${anchor}"${fontExtra}>${esc$1(ln)}</text>`;});}
    return s+'</g>';};
   if(headerBand)out+=emitBand(p.publication.header,6,'ddn-pub-header');
   /* 0.8 (chapter 44 amendment): the banner is the engine-version line above the
    * view title. chrome.banner 'on' shows the engine version, 'off' suppresses
    * the line, any other string replaces the text. */
   const bannerText=chrome.banner==='off'?null:(typeof chrome.banner==='string'&&chrome.banner!=='on'?chrome.banner:'DDN / PROPOSED STANDARD / '+DDN$1.VERSION);
   if(titleOn)out+=(bannerText?text$1(margin,headerBand+margin+5,bannerText,11,t.muted,650):'')+multilines(margin,headerBand+margin+34,titleLines,24,t.ink,28,650)+multilines(margin,headerBand+margin+34+titleLines.length*28,captionLines,13,t.muted,18)+text$1(pageW-margin,headerBand+margin+5,p.style.look+' · '+p.style.theme,11,t.muted,500,'text-anchor="end"');
   out+=`<g id="drawing" transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})">${diagram}</g>`;
   if(legendPlacement!=='none'&&legendEntries.length){let lx=legendPlacement==='right'?pageW-margin-legendW:margin,ly=legendPlacement==='right'?headBlock-15+extraHeader:pageH-margin-footerBand-legendHeight;out+=line(lx-12,ly-12,lx-12,legendPlacement==='right'?pageH-margin-footerBand-40:ly+legendHeight,t.rule,1);out+=text$1(lx,ly,'RELATIONSHIP KEY',11,t.muted,700);ly+=33;
    for(const entry of legendEntries){const key=p.legend.mode==='numbers'?entry.key:entry.reg.code;if(p.legend.mode==='numbers')out+=`<circle cx="${lx+12}" cy="${ly-4}" r="12" fill="${t.surface}" stroke="${t.ink}"/>`+text$1(lx+12,ly,String(key),11,t.ink,700,'text-anchor="middle"');else out+=text$1(lx,ly,String(key),11,t.muted,650);
     out+=multilines(lx+34,ly,entry.lines,12,t.ink,18);ly+=Math.max(44,entry.lines.length*18+16);}
   }
   /* 0.8 (chapter 53 §53.1): an authored footer replaces the default footer
    * content at the chapter 44 emission site; without one the legacy footer is
    * byte-identical to 0.7. */
   if(footerBand)out+=emitBand(p.publication.footer,pageH-margin-footerBand+2,'ddn-pub-footer');
   else if(footerOn)out+=line(margin,pageH-39-footerBand,pageW-margin,pageH-39-footerBand,t.rule,1)+text$1(margin,pageH-20-footerBand,'Same data · independent view · fixed semantics · presentation only',11,t.muted)+text$1(pageW-margin,pageH-20-footerBand,ir.view.local+' / '+ir.registry,11,t.muted,400,'text-anchor="end"');
   out+='</svg>';
   const textAfter=api$9.stats(),estimated=textAfter.estimated-textBefore.estimated;
   if(estimated){const pinActive=ir.view.fontPin&&ir.view.fontPin.engine===api$9.engine;
    /* 0.8 (chapter 54 §54.4): with a pin active, unknown runs are DDN-TF04 under
     * metrics: required; otherwise the grapheme estimate plus DDN-TW01. */
    if(p.publication.metrics==='required')throw new DDN$1.DDNError(pinActive?'DDN-TF04':'DDN077',pinActive?'One or more text runs are missing from the active font_pin '+ir.view.fontPin.path+' under metrics: required':'Required measured fonts unavailable; supply text metrics or a browser provider');
    diags.push({code:'DDN-TW01',severity:'warning',message:'Some text runs used estimated metrics; this is not a typography-certified publication.'});}
   scene.layoutState={format:'ddn-layout-state@1',view:options.viewKey||ir.view.id,positions:Object.fromEntries(geoms.map(g=>[g.id,[g.x,g.y]]))};
   scene.textMeasurement={mode:estimated?'estimated':'measured',requestedFont:p.style.font,provider:textAfter.canvas>textBefore.canvas?'browser-canvas':'pinned-cache',...(ir.view.fontPin&&ir.view.fontPin.engine===api$9.engine?{pin:ir.view.fontPin.path}:{})};
   return {svg:out,scene,diagnostics:diags,_drawing:diagram,_defs:glyphDefs,_ir:ir};
  }
  /* 0.8 (chapter 53 §53.4): render a multi-view publication set — one SVG per
   * figure named <entry>--<view_id>.svg, plus a manifest JSON in declaration
   * order. The set's publication supplies shared chrome (header/footer/border/
   * background) to every figure; a figure's own declared concern wins. $figure
   * and $page are the 1-based positions. Determinism per chapter 51 holds per
   * figure (pin options.publicationDate for byte-stable $date). */
  function renderPublicationSet(files,entry,setName,registry,glyphDefs='',options={}){
   const sets=DDN$1.publicationSets(files,entry,registry);
   const set=sets.find(s=>s.local===setName||s.uid===setName||s.name===setName);
   if(!set)throw new DDN$1.DDNError('DDN-PB09','Publication set not found: '+JSON.stringify(setName)+'; declared sets: '+(sets.map(s=>s.local).join(', ')||'(none)'),entry);
   const entryBase=entry.split('/').pop().replace(/\.ddn$/,'');
   const out={},manifest={set:set.name,figures:[]};
   set.figures.forEach((f,i)=>{
    const ir=DDN$1.build(files,f.file,f.uid,registry).ir;
    if(set.publication){
     const {chrome}=DDN$1.extractPublicationChrome([set.publication.node],files,ir.view.profiles.publication.overflow);
     for(const k of ['header','footer','border','background'])if(chrome[k]&&!ir.view.profiles.publication[k])ir.view.profiles.publication[k]=chrome[k];
    }
    const r=render$1(ir,registry,glyphDefs,{...options,figure:i+1,page:i+1});
    const file=entryBase+'--'+f.local+'.svg';
    out[file]=r.svg;
    manifest.figures.push({view_id:f.local,file,figure:i+1,page:i+1});
   });
   return {files:out,manifest};
  }
  /* 0.8 (chapter 53 §53.5): print-size lint — a check-time diagnostic family
   * that never blocks or alters rendering and never fires for size: content.
   * Effective sizes are computed against the deterministic render scale (the
   * contain factor) with overflow/quality policies relaxed so lint cannot fail
   * on the very overflow it reports. */
  function printSizeLint(ir,registry,glyphDefs='',options={}){
   const p=ir.view.profiles;
   if(p.publication.size==='content')return [];
   const diags=[],embed=q$1(p.publication.embedding_scale,1);
   const minPx=q$1(p.publication.minimum_text,8*PT),minPt=minPx/PT;
   let scale=1,smallestPx=null;
   try{
    const clone=JSON.parse(JSON.stringify(ir));
    clone.view.profiles.publication.overflow='warn';
    clone.view.profiles.layout={...clone.view.profiles.layout,quality:'warn'};
    const r=renderInner(clone,registry,glyphDefs,{...options,noMotion:true});
    scale=r.scene.scale;smallestPx=r.scene.smallestText;
   }catch(e){/* lint never blocks rendering; on an unrenderable view it reports nothing */}
   const offenders=[];
   if(smallestPx!==null&&smallestPx<minPx-.001)offenders.push({what:'smallest text role',eff:smallestPx/PT});
   for(const band of [p.publication.header,p.publication.footer])
    for(const slot of ['left','center','right']){const run=band?.[slot];if(run&&run.size*embed<minPt-.001)offenders.push({what:(band===p.publication.header?'header':'footer')+' '+slot+' chrome run',eff:run.size*embed});}
   if(offenders.length){
    offenders.sort((a,b)=>a.eff-b.eff);
    const impliedPt=16*minPx/(11*scale*embed)/PT;
    diags.push({code:'DDN-PS01',severity:'warning',message:'Effective text size below minimum_text '+minPt.toFixed(2)+'pt at the declared print size: '+offenders[0].what+' ('+offenders[0].eff.toFixed(2)+'pt effective); increase base font to ≥'+(impliedPt*PT).toFixed(1)+'px or raise publication.minimum_text.'});
   }
   const relFloor=0.5*PT;let worst=null;
   for(const rid of ir.view.relations){
    const r=ir.relations.find(x=>x.id===rid);if(!r)continue;
    const reg=DDN$1.relationEntry(registry,r.kind);if(!reg)continue;
    const eff=reg.width*scale*embed;
    if(eff<relFloor-.001&&(!worst||eff<worst.eff))worst={name:r.name||r.ref,eff};
   }
   if(worst)diags.push({code:'DDN-PS02',severity:'warning',message:'Relation '+worst.name+' line weight is '+(worst.eff/PT).toFixed(2)+'pt effective at the declared print size, below the 0.5pt print floor.'});
   if(p.publication.border&&p.publication.border.weight*embed<0.25)diags.push({code:'DDN-PS02',severity:'warning',message:'Page border weight '+(p.publication.border.weight*embed).toFixed(2)+'pt effective is below the 0.25pt print floor.'});
   if(['a4','letter'].includes(p.publication.size)&&!p.publication.minimum_text_declared)
    diags.push({code:'DDN-PS03',severity:'info',message:'Declared size '+p.publication.size+' is a physical paper size but no minimum_text is declared; the 8pt default is being relied on.'});
   if(options.strictPrint&&diags.some(d=>d.severity==='warning'))
    diags.push({code:'DDN-PS04',severity:'error',message:'Strict-print gate: print-size warnings fired ('+diags.filter(d=>d.severity==='warning').map(d=>d.code).join(', ')+'); resolve them or drop --strict-print.'});
   return diags;
  }
  const api$2={palette:api$a,render: render$1,renderPublicationSet,printSizeLint,measureNode,textFit,visibleRoutePieces,esc: esc$1,hash,wrap,text: text$1,multilines,line,glyph,rect,badge,pretty,themes,pathD,endMark,cls,slug};
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
    const font=p.style.font==='mono'?'DejaVu Sans Mono, monospace':p.style.font==='serif'?'DejaVu Serif, serif':p.style.font==='handwriting'?'Comic Neue, Comic Sans MS, Segoe Print, Bradley Hand, Purisa, Nanum Pen Script, cursive':'DejaVu Sans, Arial, sans-serif';
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
      out+=look==='handDrawn'?api$8.polyline(points,{...p.style,id:r.id,stroke:colour,width:reg.width,dash:reg.pattern}):`<path d="${api$2.pathD(points)}" fill="none" stroke="${colour}" stroke-width="${reg.width}"${reg.pattern?' stroke-dasharray="'+reg.pattern+'"':''}/>`;
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
    Object.assign(host, { DDNPalette: api$a, DDNText: api$9, DDNSketch: api$8, DDNShapes: api$7, DDNLayout: api$6, DDNPlacement: api$5, DDNRender: api$2, DDNInteraction: api$1 });
    optionalNamespace('DDNEngine').registerProjectionRenderer('graph', api$1.render);
  }
  const api = host.DDNLive;
  if (typeof module === 'object' && module.exports) module.exports = api;
  const { VERSION, runtime, createWorkspace, registerWorkspace, mount, fromSnapshot, authoring, io, parse, profileCatalogue } = api;

})();
