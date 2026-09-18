/* SPDX-License-Identifier: GPL-2.0-or-later. One recursive, source-preserving dispatcher. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-interaction'),require('./ddn-projections'));else root.DDNEngine=factory(root.DDNInteraction,root.DDNProjections);})(typeof globalThis!=='undefined'?globalThis:this,function(Interaction,Projections){
'use strict';
function render(ir,registry,glyphs,options={}){if(ir.view.profiles.projection.profile==='state.flat@1'){
 const next={...ir,relations:ir.relations.map(r=>{const x=r.properties.x_transition;if(!x?.event)return r;const guard=x.guard?Object.entries(x.guard).map(([k,v])=>k+' '+(v.op==='eq'?'= '+JSON.stringify(v.value):v.op==='interval'?'['+v.min+','+v.max+']':v.op)).join(' and '):'';return{...r,name:x.event+(guard?' ['+guard+']':'')};})};ir=next;}
 const opts={...options,renderChild:render};return ir.view.profiles.projection?.kind&&ir.view.profiles.projection.kind!=='graph'?Projections.render(ir,registry,glyphs,opts):Interaction.render(ir,registry,glyphs,opts);}
return{VERSION:'0.5.0-draft.2',render};});
