/* SPDX-License-Identifier: GPL-2.0-or-later.
 * DDN 0.8 view-kind registry data (standard chapters 52 and 55). Data-only:
 * registered view kinds, named vocabulary subsets, registered markings and
 * themes, and the patent.legal@1 pack defaults. Later phases (render themes,
 * designer templates) consume these tables; the core parser/validator reads
 * them for the DDN-VP and DDN-MK diagnostic checks. No runtime dependencies. */
import {publishNamespace} from './ddn-module-registry.js';
'use strict';
const VERSION='0.7.0';
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
const api={VERSION,VOCABULARY,VIEW_KINDS,MARKINGS,THEMES,PATENT_LEGAL,MARKING_PAINT,THEME_PAINT,subsetAdmits};
publishNamespace('DDNViewProfiles',api);
export default api;
