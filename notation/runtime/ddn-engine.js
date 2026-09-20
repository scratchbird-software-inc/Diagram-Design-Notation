/* SPDX-License-Identifier: GPL-2.0-or-later. One recursive, source-preserving dispatcher. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-interaction'),require('./ddn-projections'));else root.DDNEngine=factory(root.DDNInteraction,root.DDNProjections);})(typeof globalThis!=='undefined'?globalThis:this,function(Interaction,Projections){
'use strict';
function render(ir,registry,glyphs,options={}){if(['state.flat@1','state.composite@1'].includes(ir.view.profiles.projection.profile)){
 const next={...ir,relations:ir.relations.map(r=>{const x=r.properties.x_transition;if(!x?.event)return r;const guard=x.guard?Object.entries(x.guard).map(([k,v])=>k+' '+(v.op==='eq'?'= '+JSON.stringify(v.value):v.op==='interval'?'['+v.min+','+v.max+']':v.op)).join(' and '):'';return{...r,name:x.event+(guard?' ['+guard+']':'')};})};ir=next;}
 if(ir.view.profiles.projection.profile==='uml.communication@1'){
 const next={...ir,relations:ir.relations.map(r=>{const seq=r.properties.x_message?.seq;if(r.kind!=='uml.message'||!seq||!ir.view.relations.includes(r.id))return r;return{...r,name:seq+' · '+r.name};})};ir=next;}
 if(ir.view.profiles.projection.profile==='bpmn.basic@1'){
 const mark={exclusive:'X',parallel:'+',inclusive:'O'},shown=new Set(ir.view.selected);
 const next={...ir,elements:ir.elements.map(n=>{const m=mark[n.properties.x_gateway?.type];if(n.kind!=='flow.gateway'||!m||!shown.has(n.id))return n;return{...n,name:m+' '+n.name};})};ir=next;}
 if(ir.view.profiles.projection.profile==='pert.cpm@1'){
 const cpm=Projections.plan(ir).cpm,critical=new Set(cpm.criticalRelations);
 const next={...ir,relations:ir.relations.map(r=>critical.has(r.id)?{...r,properties:{...r.properties,x_critical:true}}:r),elements:ir.elements.map(n=>{const t=cpm.tasks[n.id];return t?{...n,name:n.name+' ('+t.estimate+'d, slack '+t.slack+'d)'}:n;})};ir=next;}
 const opts={...options,renderChild:render};return ir.view.profiles.projection?.kind&&ir.view.profiles.projection.kind!=='graph'?Projections.render(ir,registry,glyphs,opts):Interaction.render(ir,registry,glyphs,opts);}
return{VERSION:'0.5.0-draft.2',render};});
