/* SPDX-License-Identifier: GPL-2.0-or-later. One recursive, source-preserving dispatcher on a renderer registry. */
import {publishNamespace} from './ddn-module-registry.js';
import D from './ddn-core.js';
import Data from './ddn-projection-data.js';
'use strict';
const renderers=new Map(),BUNDLES={graph:'ddn-graph.js',chart:'ddn-projections.js',matrix:'ddn-projections.js',panels:'ddn-projections.js',timeline:'ddn-projections.js',table:'ddn-projections.js',sequence:'ddn-projections.js',timing:'ddn-projections.js',chen:'ddn-projections.js',fishbone:'ddn-quality.js',decision:'ddn-quality.js'};
function registerProjectionRenderer(name,fn){if(typeof name!=='string'||!name||typeof fn!=='function')throw new D.DDNError('DDN-E010','Renderer registration needs a projection kind name and a render function.');renderers.set(name,fn);}
function rendererFor(kind){const fn=renderers.get(kind);if(fn)return fn;const bundle=BUNDLES[kind];throw new D.DDNError('DDN-E010','No renderer registered for projection kind "'+kind+'". '+(bundle?'It is provided by '+bundle+'; load it after ddn-core.js'+(bundle==='ddn-graph.js'?'.':' and ddn-graph.js.'):'No runtime bundle provides it.'));}
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
 const kind=ir.view.profiles.projection?.kind||'graph',opts={...options,renderChild:render};return rendererFor(kind)(ir,registry,glyphs,opts);}
function plan(ir,ErrorClass=D.DDNError){rendererFor(ir.view.profiles.projection?.kind||'graph');return Data.plan(ir,ErrorClass);}
const api={VERSION:'0.6.0-beta.1',render,plan,registerProjectionRenderer,hasRenderer:k=>renderers.get(k)!==undefined,registeredKinds:()=>[...renderers.keys()]};
publishNamespace('DDNEngine',api);
export default api;
