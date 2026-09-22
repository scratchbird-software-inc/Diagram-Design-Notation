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
const FONTS={sans:'DejaVu Sans, Arial, sans-serif',serif:'DejaVu Serif, Georgia, serif',mono:'DejaVu Sans Mono, monospace',handwriting:'Comic Neue, Segoe Print, Bradley Hand, Comic Sans MS, cursive'};
let cache=initial?.measurements||{},provider=null,providerName=null,context=null;const requests=new Map();const counts={estimated:0,canvas:0,cache:0,provider:0};
const key=(s,size,font,weight)=>JSON.stringify([String(s),+size,font,weight]);
const segments=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('und',{granularity:'grapheme'}):null;
const graphemes=s=>segments?[...segments.segment(String(s))].map(x=>x.segment):[...String(s)];
function setMetrics(data){cache=data?.measurements||data||{};}
function setProvider(fn,name='custom'){provider=fn;providerName=name;}
function measure(s,size=14,font='sans',weight=400){s=String(s??'');const k=key(s,size,font,weight);let result;
 if(provider){counts.provider++;result=provider(s,size,FONTS[font]||font,weight);if(!result||!Number.isFinite(result.width))throw new Error('Text measurement provider returned invalid width');return {...result,method:providerName};}
 if(typeof document!=='undefined'&&document.createElement){try{context??=document.createElement('canvas').getContext('2d');if(context){counts.canvas++;context.font=`${weight} ${size}px ${FONTS[font]||font}`;const m=context.measureText(s);return{width:m.width,ascent:m.actualBoundingBoxAscent||size*.85,descent:m.actualBoundingBoxDescent||size*.25,method:'browser-canvas'};}}catch{}}
 if(cache[k]){counts.cache++;return {...cache[k],method:'pinned-measurement-cache'};}
 counts.estimated++;
 // Bounded retention: the capture map is a debugging aid, not a leak. FIFO-evict
 // past the cap so many unique labels cannot grow the process heap without bound.
 if(!requests.has(k)){if(requests.size>=4096)requests.delete(requests.keys().next().value);requests.set(k,{text:s,size,font,weight});}
 let width=0;for(const g of graphemes(s)){if(/^\s+$/u.test(g))width+=size*.34;else if(/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u.test(g))width+=size*1.08;else if(/[MW@#%&]/.test(g))width+=size*.9;else if(/[il.,:;!'|]/.test(g))width+=size*.34;else width+=size*(font==='mono'?.64:.64);}
 return{width,ascent:size*.88,descent:size*.28,method:'estimated'};
}
function wrap(s,maxWidth,size=14,font='sans',weight=400){
 const lines=[];maxWidth=Math.max(size*2,maxWidth);
 for(const raw of String(s??'').split('\n')){const words=raw.split(/(\s+)/u);let current='';for(const token of words){if(!token)continue;const joined=current+token;if(measure(joined,size,font,weight).width<=maxWidth){current=joined;continue;}if(current.trim())lines.push(current.trimEnd());current=token.trimStart();
  if(measure(current,size,font,weight).width>maxWidth){let part='';for(const g of graphemes(current)){if(part&&measure(part+g,size,font,weight).width>maxWidth){lines.push(part);part=g;}else part+=g;}current=part;}}
  lines.push(current.trimEnd());}
 return lines.length?lines:[''];
}
if(typeof process!=='undefined'&&process.env?.DDN_METRICS_CAPTURE){process.on('exit',()=>{const fs=process.getBuiltinModule('node:fs'),p=process.env.DDN_METRICS_CAPTURE;let old={};try{old=JSON.parse(fs.readFileSync(p,'utf8'));}catch{}for(const[k,v]of requests)old[k]=v;fs.writeFileSync(p,JSON.stringify(old));});}
function pending(){return [...requests.values()];}
function clearRequests(){requests.clear();}
const api={stats:()=>({...counts}),FONTS,key,measure,wrap,graphemes,setMetrics,setProvider,pending,clearRequests};
publishNamespace('DDNText',api);
export default api;
