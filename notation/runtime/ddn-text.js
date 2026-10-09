/* SPDX-License-Identifier: GPL-2.0-or-later. Measured text service with explicit fallback provenance. No font files bundled. */
import {publishNamespace} from './ddn-module-registry.js';
'use strict';
/* Pinned measurement cache: loaded from the standard registry when running
 * under Node directly from the sources (import.meta.url resolves). In the
 * built dist bundles import.meta.url is rewritten to `undefined`, so the
 * browser/estimation path is taken exactly as before. */
let initial=null;
if(typeof process!=='undefined'&&process.getBuiltinModule){
 try{
  const url=process.getBuiltinModule('node:url'),path=process.getBuiltinModule('node:path'),fs=process.getBuiltinModule('node:fs');
  const here=path.dirname(url.fileURLToPath(import.meta.url));
  initial=JSON.parse(fs.readFileSync(path.join(here,'../../standard/registry/text-metrics.json'),'utf8'));
 }catch{}
}
const FONTS={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Comic Sans MS, Segoe Print, Bradley Hand, Purisa, Nanum Pen Script, cursive'};
/* 0.8 (chapter 54 §54.4): measurement-engine identity. A font_pin records the
 * producing engine; a mismatch is DDN-TF05 (pin ignored) at render time. */
const ENGINE='ddn-text@1';
let metricsRevision=0;
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
const segments=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('und',{granularity:'grapheme'}):null;
const graphemes=s=>segments?[...segments.segment(String(s))].map(x=>x.segment):[...String(s)];
function setMetrics(data){metricsRevision++;cache=data?.measurements||data||{};}
function setProvider(fn,name='custom'){metricsRevision++;provider=fn;providerName=name;}
function measure(s,size=14,font='sans',weight=400,st=null){s=String(s??'');const k=key(s,size,font,weight,st);let result;
 if(provider){counts.provider++;result=provider(s,size,FONTS[font]||font,weight);if(!result||!Number.isFinite(result.width))throw new Error('Text measurement provider returned invalid width');return {...result,method:providerName};}
 if(typeof document!=='undefined'&&document.createElement){try{context??=document.createElement('canvas').getContext('2d');if(context){counts.canvas++;context.font=`${st?.italic?'italic ':''}${st?.variant==='small-caps'?'small-caps ':''}${weight} ${size}px ${FONTS[font]||font}`;const m=context.measureText(s);return{width:m.width,ascent:m.actualBoundingBoxAscent||size*.85,descent:m.actualBoundingBoxDescent||size*.25,method:'browser-canvas'};}}catch{}}
 if(cache[k]){counts.cache++;return {...cache[k],method:'pinned-measurement-cache'};}
 counts.estimated++;
 // Bounded retention: the capture map is a debugging aid, not a leak. FIFO-evict
 // past the cap so many unique labels cannot grow the process heap without bound.
 if(!requests.has(k)){if(requests.size>=4096)requests.delete(requests.keys().next().value);requests.set(k,{text:s,size,font,weight});}
 const caps=st?.variant==='small-caps';
 let width=0;for(const g of graphemes(s)){const up=caps&&g.toUpperCase()!==g;const gs=up?size*.8:size,gc=up?g.toUpperCase():g;if(/^\s+$/u.test(gc))width+=gs*.34;else if(/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u.test(gc))width+=gs*1.08;else if(/[MW@#%&]/.test(gc))width+=gs*.9;else if(/[il.,:;!'|]/.test(gc))width+=gs*.34;else width+=gs*(font==='mono'?.64:.64);}
 return{width,ascent:size*.88,descent:size*.28,method:'estimated'};
}
function wrap(s,maxWidth,size=14,font='sans',weight=400,st=null){
 const lines=[];maxWidth=Math.max(size*2,maxWidth);
 for(const raw of String(s??'').split('\n')){const words=raw.split(/(\s+)/u);let current='';for(const token of words){if(!token)continue;const joined=current+token;if(measure(joined,size,font,weight,st).width<=maxWidth){current=joined;continue;}if(current.trim())lines.push(current.trimEnd());current=token.trimStart();
  if(measure(current,size,font,weight,st).width>maxWidth){let part='';for(const g of graphemes(current)){if(part&&measure(part+g,size,font,weight,st).width>maxWidth){lines.push(part);part=g;}else part+=g;}current=part;}}
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
function paintAttrs(spec){if(!spec)return'';let s='';if(spec.italic)s+=' font-style="italic"';if(spec.decoration==='strike')s+=' text-decoration="line-through"';if(spec.variant==='small-caps')s+=' font-variant-caps="small-caps"';return s;}
const api={revision:()=>metricsRevision,stats:()=>({...counts}),FONTS,ENGINE,engine:ENGINE,key,measure,wrap,graphemes,setMetrics,getMetrics:()=>cache,setProvider,pending,clearRequests,mergeSpec,paintAttrs};
publishNamespace('DDNText',api);
export default api;
