/* SPDX-License-Identifier: GPL-2.0-or-later. One recursive, source-preserving dispatcher on a renderer registry. */
import {publishNamespace,optionalNamespace} from './ddn-module-registry.js';
import D from './ddn-core.js';
import Data from './ddn-projection-data.js';
'use strict';
const renderers=new Map(),BUNDLES={graph:'ddn-graph.js',chart:'ddn-projections.js',matrix:'ddn-projections.js',panels:'ddn-projections.js',timeline:'ddn-projections.js',table:'ddn-projections.js',sequence:'ddn-projections.js',timing:'ddn-projections.js',chen:'ddn-projections.js',fishbone:'ddn-quality.js',decision:'ddn-quality.js',geo:'ddn-geo.js',iso:'ddn-iso.js'},OPTIONAL=new Set(['geo','iso']);
function registerProjectionRenderer(name,fn,opts={}){if(typeof name!=='string'||!name||typeof fn!=='function')throw new D.DDNError('DDN-E010','Renderer registration needs a projection kind name and a render function.');renderers.set(name,fn);if(opts.optional)OPTIONAL.add(name);}
function rendererFor(kind){const fn=renderers.get(kind);if(fn)return fn;const bundle=BUNDLES[kind];throw new D.DDNError('DDN-E010','No renderer registered for projection kind "'+kind+'". '+(bundle?'It is provided by '+bundle+'; load it after ddn-core.js'+(bundle==='ddn-graph.js'?'.':' and ddn-graph.js.'):'No runtime bundle provides it.'));}
/* B1-025 (D3): optional kinds degrade visibly, never silently. A geo view rendered
 * without ddn-geo.js gets an inline placeholder box inside an otherwise normal page
 * plus the coded DDN-E010 diagnostic on the diagnostics channel; other kinds keep
 * the hard DDN-E010 throw above. The placeholder needs only ddn-core. */
function placeholder(ir,kind){
 const p=ir.view.profiles||{},pub=p.publication||{},q=(v,d)=>D.quantity?D.quantity(v,d):d,esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 let pageW=q(pub.width,1280),pageH=q(pub.height,800);if(['a4','letter'].includes(pub.size)){pageW=pub.size==='a4'?210*96/25.4:816;pageH=pub.size==='a4'?297*96/25.4:1056;if(pub.orientation==='landscape')[pageW,pageH]=[pageH,pageW];}
 const margin=q(pub.margin,32),f=n=>Number(n.toFixed(3));
 const bw=Math.min(660,pageW-2*margin-64),bh=132,bx=(pageW-bw)/2,by=(pageH-bh)/2,bundle=BUNDLES[kind]||'ddn-'+kind+'.js';
 const message=(kind==='iso'?'Isometric view requires ':kind==='geo'?'Map view requires ':'Projection requires ')+bundle,sub='Optional module not loaded — load '+bundle+' after ddn-core.js and ddn-graph.js.';
 const diag={code:'DDN-E010',severity:'error',message:'No renderer registered for projection kind "'+kind+'". It is provided by '+bundle+'; load it after ddn-core.js and ddn-graph.js. Inline placeholder rendered instead (optional module).'};
 const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg class="ddn-svg ddn-view-${esc(kind)} ddn-missing-module" xmlns="http://www.w3.org/2000/svg" width="${f(pageW)}" height="${f(pageH)}" viewBox="0 0 ${f(pageW)} ${f(pageH)}" role="img" aria-labelledby="projection-title projection-description"><title id="projection-title">${esc(ir.view.name)}</title><desc id="projection-description">${esc(message)}</desc><rect width="100%" height="100%" fill="#F2F4F7"/><text x="${f(margin)}" y="${f(margin+26)}" font-size="24" font-weight="650" fill="#1F2933" font-family="system-ui,sans-serif">${esc(ir.view.name)}</text><g class="ddn-placeholder" data-missing-module="${esc(bundle)}"><rect x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" rx="8" fill="#FFFFFF" stroke="#B7791F" stroke-width="1.6" stroke-dasharray="6 4"/><text x="${f(pageW/2)}" y="${f(by+52)}" font-size="19" font-weight="650" fill="#8A5A00" text-anchor="middle" font-family="system-ui,sans-serif">${esc(message)}</text><text x="${f(pageW/2)}" y="${f(by+86)}" font-size="13" fill="#4B5563" text-anchor="middle" font-family="system-ui,sans-serif">${esc(sub)}</text></g><text x="${f(margin)}" y="${f(pageH-margin)}" font-size="11" fill="#4B5563" font-family="system-ui,sans-serif">One model · source-bound occurrences · placeholder (optional module missing)</text></svg>`;
 const scene={width:pageW,height:pageH,smallestText:11,scale:1,origin:[0,0],nodes:[],routes:[],crossings:[],frames:[],subdiagrams:[],marks:[],projection:{kind,profile:p.projection?.profile||'',sourceIds:[],quantitative:false},drawingBounds:{x:bx,y:by,w:bw,h:bh},drawingArea:{x:margin,y:margin,w:pageW-2*margin,h:pageH-2*margin},textMeasurement:{mode:'estimated',requestedFont:p.style?.font||'sans'},placeholder:bundle};
 return{svg,scene,diagnostics:[...(ir.diagnostics||[]),diag],_ir:ir};
}
function render(ir,registry,glyphs,options={}){if(['state.flat@1','state.composite@1'].includes(ir.view.profiles.projection.profile)){
 const next={...ir,relations:ir.relations.map(r=>{const x=r.properties.x_transition;if(!x?.event)return r;const guard=x.guard?Object.entries(x.guard).map(([k,v])=>k+' '+(v.op==='eq'?'= '+JSON.stringify(v.value):v.op==='interval'?'['+v.min+','+v.max+']':v.op)).join(' and '):'';return{...r,name:x.event+(guard?' ['+guard+']':'')};})};ir=next;}
 if(ir.view.profiles.projection.profile==='uml.communication@1'){
 const next={...ir,relations:ir.relations.map(r=>{const seq=r.properties.x_message?.seq;if(r.kind!=='uml.message'||!seq||!ir.view.relations.includes(r.id))return r;return{...r,name:seq+' · '+r.name};})};ir=next;}
 if(ir.view.profiles.projection.profile==='bpmn.basic@1'){
 const mark={exclusive:'X',parallel:'+',inclusive:'O'},shown=new Set(ir.view.selected);
 const next={...ir,elements:ir.elements.map(n=>{const m=mark[n.properties.x_gateway?.type];if(n.kind!=='flow.gateway'||!m||!shown.has(n.id))return n;return{...n,name:m+' '+n.name};})};ir=next;}
 if(ir.view.profiles.projection.profile==='pert.cpm@1'){
 const cpm=Data.plan(ir).cpm,critical=new Set(cpm.criticalRelations);
 const next={...ir,relations:ir.relations.map(r=>critical.has(r.id)?{...r,properties:{...r.properties,x_critical:true}}:r),elements:ir.elements.map(n=>{const t=cpm.tasks[n.id];return t?{...n,name:n.name+' ('+t.estimate+'d, slack '+t.slack+'d)'}:n;})};ir=next;}
 if(ir.view.profiles.projection.profile==='family.tree@1'){
 const shown=new Set(ir.view.selected);
 const next={...ir,elements:ir.elements.map(n=>{if(n.kind!=='family.person'||!shown.has(n.id))return n;const b=n.properties.x_birth,d=n.properties.x_death;if(b===undefined&&d===undefined)return n;const years=b!==undefined&&d!==undefined?b+'-'+d:b!==undefined?'b. '+b:'d. '+d;return{...n,name:n.name+' ('+years+')'};})};ir=next;}
 const kind=ir.view.profiles.projection?.kind||'graph',fn=renderers.get(kind),opts={...options,renderChild:render};
 if(!fn&&OPTIONAL.has(kind)&&kind!=='iso')return placeholder(ir,kind);
 /* B1-034 (D1): an iso:true view needs the optional ddn-iso module. Missing
  * module → the same visible placeholder + coded DDN-E010 diagnostic path as
  * geo (B1-025). Graph views delegate to the iso renderer; chart views fall
  * through to their normal renderer, which consults DDNIso per mark. */
 const pr2=ir.view.profiles.projection||{},ISO=optionalNamespace('DDNIso');
 if(pr2.iso===true){
  if(!ISO)return placeholder(ir,'iso');
  if(kind==='graph')return ISO.renderGraph(ir,registry,glyphs,opts);
 }
 /* A depth property without the module degrades to the flat render plus a
  * coded diagnostic — never a crash (D1). */
 const depthRequested=pr2.depth!==undefined||ir.elements.some(n=>ir.view.selected.includes(n.id)&&n.properties&&n.properties.depth!==undefined);
 const out=(fn||rendererFor(kind))(ir,registry,glyphs,opts);
 if(depthRequested&&!ISO)out.diagnostics.push({code:'DDN-E010',severity:'warning',message:'depth is rendered by the optional ddn-iso.js module; it is not loaded, so the view rendered flat. Load ddn-iso.js after ddn-core.js and ddn-graph.js.'});
 if(depthRequested&&ISO&&kind==='graph'&&pr2.iso!==true)out.diagnostics.push({code:'DDN-ISOW01',severity:'warning',message:'depth on a graph view applies with iso: true; without it the view renders flat.'});
 return out;}
function plan(ir,ErrorClass=D.DDNError){rendererFor(ir.view.profiles.projection?.kind||'graph');return Data.plan(ir,ErrorClass);}
const api={VERSION:'0.6.0-beta.1',render,plan,registerProjectionRenderer,hasRenderer:k=>renderers.get(k)!==undefined,registeredKinds:()=>[...renderers.keys()]};
publishNamespace('DDNEngine',api);
export default api;
