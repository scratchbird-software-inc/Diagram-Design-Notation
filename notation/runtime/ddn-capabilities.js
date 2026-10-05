/* SPDX-License-Identifier: GPL-2.0-or-later.
 * Designer capability metadata (2026-10 redesign, phase 2): derives the
 * per-kind/per-relation `allowed_in` capability lists the designer palette
 * filters on, and the endpoint-pair verb legality query shared by the CLI
 * (`verbs --from --to`) and the live tool's Connect popup.
 *
 * A capability tag is either a projection kind ('graph', 'chart', 'matrix',
 * 'sequence', 'timing', 'table', 'timeline', 'fishbone', 'decision', 'panels',
 * 'chen', 'geo') or an installed profile id ('uml.structure@2', …). The active
 * view's capability set is {projection.kind, projection.profile}, except that
 * a profiled graph view carries only its profile id — the bare 'graph' tag
 * means "unprofiled graph view", so a profiled view is offered only its own
 * vocabulary (plus validator-backed cross-profile participants).
 *
 * Membership is derived, never hand-maintained:
 *  · a profile kind/relation family `x.*` is owned by the profiles whose id
 *    family matches (`uml.*` kinds → `uml.*` profiles), with the explicit
 *    alias/extra tables below for renamed families (epk→epc, archi→archimate,
 *    …) and cross-profile participation enforced by the runtime validators
 *    (ddn-profiles.js DDN-PF007 family checks) or exercised by the shipped
 *    fixtures (BPMN views draw flow.* symbols, fault/event trees draw tree.*,
 *    fishbone draws quality.*, state machines draw state.*);
 *  · generic (unprofiled, no-dot) kinds get ['graph'] plus the specific
 *    structured projections they legitimately participate in per the runtime
 *    validators (org.tree@1, wbs.tree@1, mindmap.basic@1, concept.map@1,
 *    chen) — data-bound projections bind any record as data, so they are not
 *    listed per kind; the designer never offers element creation there.
 * Data-only module; no runtime dependencies. */
import {publishNamespace} from './ddn-module-registry.js';
import palette from './assets/kind-palette.js';
'use strict';
const VERSION='0.8.0';

/* Kind/relation families whose owning profiles are not simply the profiles of
 * the same id family (renamed families, multi-profile ownership). Derived from
 * the runtime validators (ddn-profiles.js) and the shipped fixtures. */
const FAMILY_OWNERS=Object.freeze({
 epk:['epc.basic@1','epc.complete@1'],
 archi:['archimate.basic@1'],
 req:['requirements.basic@1','sysml.requirements@1'],
 ui:['wireframe.ui@1'],
 rule:['decision.rules@1'],
 quality:['fishbone.basic@1'],
 tree:['fault.tree@1','event.tree@1'],
 msc:['msc.basic@1'],
 chen:['chen.basic@1','chen.binary@2'],
 state:['state.flat@1','state.composite@1','uml.statemachine@1','sysml.statemachine@1'],
});
/* Per-keyword owners where a family splits across profiles (DDN-PF007 sets:
 * org.tree@1 admits analysis.role, wbs.tree@1 admits analysis.task; story-map
 * cells reference analysis.task — DDN-PJ093). */
const KEYWORD_OWNERS=Object.freeze({
 'analysis.role':['org.tree@1'],
 'analysis.task':['wbs.tree@1','matrix.storymap@1'],
});
/* Cross-family participation, keyed by family prefix ('flow.') for kinds or by
 * exact keyword for verbs. Sources: ddn-profiles.js validate() (flow.*
 * participants and uml.flow links in the activity profiles; assoc/ref in
 * mindmap/concept.map/erd.crowfoot; reports_to in org.tree@1;
 * analysis.decomposes in wbs.tree@1) and the shipped BPMN fixtures (flow.*
 * symbols with x_event/x_gateway/x_activity under bpmn.* profiles). */
const EXTRA_FAMILY_PROFILES=Object.freeze({
 'flow.':['uml.activity@1','uml.activity@2','sysml.activity@1','bpmn.basic@1','bpmn.process@1','bpmn.choreography@1','bpmn.conversation@1'],
});
const EXTRA_KEYWORD_PROFILES=Object.freeze({
 'uml.flow':['uml.activity@1','uml.activity@2','sysml.activity@1','bpmn.basic@1','bpmn.process@1','bpmn.choreography@1','bpmn.conversation@1'],
 'assoc':['mindmap.basic@1','concept.map@1','erd.crowfoot@1'],
 'ref':['concept.map@1','erd.crowfoot@1'],
 'reports_to':['org.tree@1'],
 'analysis.decomposes':['wbs.tree@1'],
 'analysis.assignment':['matrix.raci@1','matrix.crud@1'],
 'analysis.access':['matrix.crud@1'],
 'analysis.precedes':['org.tree@1','wbs.tree@1'],
});
/* Generic kinds with structured-projection participation beyond graph
 * (runtime validators: ddn-profiles.js DDN-PF007 sets; chen projection). */
const EXTRA_CORE_KIND_CAPS=Object.freeze({
 'organization':['org.tree@1'],'team':['org.tree@1'],'role':['org.tree@1'],
 'object':['mindmap.basic@1','concept.map@1'],
 'entity':['mindmap.basic@1','concept.map@1','chen'],
 'term':['mindmap.basic@1','concept.map@1'],
 'domain':['mindmap.basic@1','concept.map@1'],
});

function familyOf(keyword){const i=keyword.indexOf('.');return i<0?null:keyword.slice(0,i);}
function profileFamily(id){const i=id.indexOf('.');return i<0?id:id.slice(0,i);}

/* deriveAllowedIn(registry, profilesCatalogue) → {kinds, relations} maps
 * (keyword → sorted capability list). registry is the merged registry
 * (DDNProfiles.registry output); profilesCatalogue is the profiles catalogue
 * ({profiles:[{id,projection}]}). Deterministic; unknown owners are ignored
 * so a host-registered profile pack never breaks the base maps. */
function deriveAllowedIn(registry,profilesCatalogue){
 const profiles=profilesCatalogue.profiles||[];
 const byId=new Map(profiles.map(p=>[p.id,p]));
 const families=new Map();for(const p of profiles){const f=profileFamily(p.id);if(!families.has(f))families.set(f,[]);families.get(f).push(p);}
 /* The bare 'graph' projection tag belongs to unprofiled graph views only;
  * a graph profile id already implies graph, so profile kinds list their
  * profile ids plus any non-graph projection tags they appear under. */
 const caps=(ids)=>{const out=new Set();for(const id of ids){const p=byId.get(id);if(!p)continue;if(p.projection!=='graph')out.add(p.projection);out.add(id);}return out;};
 const ownersFor=(keyword,isKind)=>{
  const fam=familyOf(keyword);
  const owners=(KEYWORD_OWNERS[keyword]||FAMILY_OWNERS[fam]||(families.get(fam)||[]).map(p=>p.id)).slice();
  /* family-level extras are kind vocabulary (BPMN/activity draw flow.*
   * symbols); verbs participate per keyword only. */
  const extra=[...(isKind&&fam?EXTRA_FAMILY_PROFILES[fam+'.']||[]:[]),...(EXTRA_KEYWORD_PROFILES[keyword]||[])];
  return [...new Set([...owners,...extra])];
 };
 const kinds={},relations={};
 for(const k of registry.kinds){
  const kw=k.keyword;
  if(!familyOf(kw)){const set=new Set(['graph']);for(const c of (EXTRA_CORE_KIND_CAPS[kw]||[]))set.add(c);kinds[kw]=[...set].sort();}
  else {const a=[...caps(ownersFor(kw,true))].sort();kinds[kw]=a.length?a:['graph'];}
 }
 for(const r of registry.relationships){
  const kw=r.keyword;
  if(!familyOf(kw)){const set=new Set(['graph']);for(const id of (EXTRA_KEYWORD_PROFILES[kw]||[])){const p=byId.get(id);if(p){set.add(p.projection);set.add(id);}}relations[kw]=[...set].sort();}
  else {const a=[...caps(ownersFor(kw,false))].sort();relations[kw]=a.length?a:['graph'];}
 }
 return{kinds,relations};
}

/* The active view's capability tags. An unprofiled graph view carries the
 * bare 'graph' tag; a profiled or data-bound view carries its projection kind
 * and profile id — the bare 'graph' tag deliberately means "unprofiled graph"
 * so profiled views offer only their own vocabulary (plus validator-backed
 * participants). */
function viewCapabilities(projection){
 const p=projection||{kind:'graph',profile:'ddn@1'};
 const kind=p.kind||'graph',profile=p.profile;
 if(kind==='graph'&&(!profile||profile==='ddn@1'))return ['graph'];
 if(kind==='graph')return [profile];
 return profile?[kind,profile]:[kind];
}
function allowedInView(allowed,projection){
 const tags=viewCapabilities(projection);
 return (allowed&&allowed.length?allowed:['graph']).some(t=>tags.includes(t));
}

/* Endpoint-pair verb legality — exactly the endpoint_contract check the core
 * validator (ddn-core.js) enforces and the CLI `verbs` query reports. */
function legalVerbs(registry,fromKind,toKind){
 const ok=(kinds,kind)=>kinds.includes('*')||kinds.includes(kind);
 return registry.relationships.filter(r=>{const c=r.endpoint_contract;return c&&ok(c.source,fromKind)&&ok(c.target,toKind);}).map(r=>r.keyword);
}

/* Palette grouping (designer/contracts/kind-ui-map.json palette_group, shipped
 * as the kind-palette asset): group name for a kind keyword, or null. */
function paletteGroup(keyword){const g=palette.byKind[keyword];return g||null;}
const PALETTE_GROUPS=palette.groups;

const api={VERSION,deriveAllowedIn,viewCapabilities,allowedInView,legalVerbs,paletteGroup,PALETTE_GROUPS};
publishNamespace('DDNCapabilities',api);
export default api;
