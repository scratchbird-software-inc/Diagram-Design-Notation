/* SPDX-License-Identifier: GPL-2.0-or-later
 * Quality/lifecycle/reporting plans. Bounded pure operations; no dynamic code,
 * remote loaders, implicit policy inference, or authoritative financial math.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DDNQualityData=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='0.6.0-beta.1';
const MISSING=Object.freeze({$missing:true});
const isMissing=v=>v===undefined||v?.$missing===true;
const primitive=v=>v===null||['string','boolean','number'].includes(typeof v);
const canon=v=>JSON.stringify(v===undefined?MISSING:v);
function error(ErrorClass,code,message,n){const e=new ErrorClass(code,message,n?.source?.file,n?.source?.start);if(ErrorClass===Error){e.message=message;e.code=code;}return e;}
function helper(ir,E,get){
 const nodes=new Map(ir.elements.map(n=>[n.id,n])),shown=new Set(ir.view.selected),p=ir.view.profiles.projection;
 const fail=(c,m,n)=>{throw error(E,c,m,n||ir.view);};
 const finite=(v,label,n)=>{if(typeof v!=='number'||!Number.isFinite(v))fail('DDN-Q001',label+' must be a finite number (no numeric-string coercion)',n);return v;};
 const resolve=x=>{const id=typeof x==='string'?x:x?.$ref,n=nodes.get(id);if(!n||!shown.has(id))fail('DDN-Q002','Missing or not-selected quality reference: '+id);return n;};
 const list=(a,label)=>{if(!Array.isArray(a)||!a.length||a.length>1000)fail('DDN-Q003',label+' needs 1..1000 references');const ns=a.map(resolve);if(new Set(ns.map(n=>n.id)).size!==ns.length)fail('DDN-Q003','Duplicate '+label+' record identity');return ns;};
 const records=()=>{let ns=list(p.records,'records');if(p.filter){exactKeys(p.filter,['key','op','value'],fail,'filter');if(!['eq','in'].includes(p.filter.op)||p.filter.op==='in'&&!Array.isArray(p.filter.value))fail('DDN-Q004','Filter supports eq and in');ns=ns.filter(n=>p.filter.op==='eq'?get(n,p.filter.key)===p.filter.value:p.filter.value.includes(get(n,p.filter.key)));}
  if(p.order){exactKeys(p.order,['key','direction'],fail,'order');if(!['asc','desc'].includes(p.order.direction))fail('DDN-Q004','Order direction is asc/desc');const vals=ns.map((n,i)=>({n,i,v:get(n,p.order.key)}));if(vals.some(o=>!primitive(o.v)||o.v===null))fail('DDN-Q004','Sort keys must be supplied scalar values');vals.sort((a,b)=>(p.order.direction==='desc'?-1:1)*(a.v<b.v?-1:a.v>b.v?1:0)||a.i-b.i);ns=vals.map(o=>o.n);}
  if(!ns.length)fail('DDN-Q003','Empty record selection');return ns;};
 return{ir,p,nodes,shown,fail,finite,resolve,list,records,get};
}
function exactKeys(o,keys,fail,label){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('DDN-Q005','Unknown or malformed '+label+' properties');}
function unique(a){return [...new Set(a)];}
function total(a,h,label='total'){const n=a.reduce((s,x)=>s+x,0);return h.finite(n,label);}
function chartRequested(p){if(['gauge','sankey'].includes(p.mark))return false;return p.profile==='chart.quality@1'||['series','arrangement','transform','layers','bins','normalize','whiskers','quartiles','step','target'].some(k=>p[k]!==undefined);}
function chart(ir,E,get){
 const h=helper(ir,E,get),{p,fail,finite}=h;
 const tr=p.transform||'identity';if(!['identity','histogram','pareto','waterfall','boxplot'].includes(tr))fail('DDN-QC001','Unknown chart transform '+tr);
 const ns=h.records(),mark=p.mark||(tr==='boxplot'?'box':tr==='histogram'?'bar':'bar'),points=[],skipped=[];
 if(!['bar','line','area','point','box'].includes(mark))fail('DDN-QC001','Quality charts use bar, line, area, point or box marks; use chart.basic for arcs');
 if(p.missing!==undefined&&!['error','skip'].includes(p.missing))fail('DDN-QC001','missing must be error or skip');
 if(typeof p.y!=='string')fail('DDN-QC001','Chart requires y binding');
 const extOnly={bins:'histogram',normalize:'histogram',outside:'histogram',whiskers:'boxplot',quartiles:'boxplot',step:'waterfall',baseline:'waterfall'};
 for(const[k,t]of Object.entries(extOnly))if(p[k]!==undefined&&tr!==t)fail('DDN-QC001',k+' is only meaningful for '+t);
 if(tr!=='identity'&&(p.series||p.layers||p.arrangement))fail('DDN-QC001','This transform cannot be combined with series/layers/arrangement');
 if(tr==='identity'&&mark==='box')fail('DDN-QC001','Box marks require boxplot transform');
 if(tr==='boxplot'&&mark!=='box'||['histogram','pareto','waterfall'].includes(tr)&&mark!=='bar')fail('DDN-QC001','Transform/mark combination is invalid');
 if(tr!=='identity'&&['series_missing','target','x_type'].some(k=>p[k]!==undefined))fail('DDN-QC001','This transform does not accept series_missing, target or x_type');
 if(p.target!==undefined&&p.arrangement==='percent'&&(p.target<0||p.target>100))fail('DDN-QC021','Percent target must be within 0..100');
 if(tr!=='identity'&&p.aggregate)fail('DDN-QC001','Transforms define their own aggregation; aggregate is not accepted');
 if(['histogram','waterfall'].includes(tr)&&p.x_type&&p.x_type!=='category'&&tr==='waterfall')fail('DDN-QC001','Waterfall step labels are categorical');
 for(const n of ns){const y=get(n,p.y);if((isMissing(y)||y===null)&&p.missing==='skip'){skipped.push(n.id);continue;}finite(y,'Chart value',n);if(p.unit&&n.properties.x_record?.unit!==p.unit)fail('DDN-QC002','Every observation must declare matching x_record.unit: '+p.unit,n);
  const x=p.x?get(n,p.x):n.name;if(isMissing(x)||x===null){if(p.missing==='skip'){skipped.push(n.id);continue;}fail('DDN-QC002','Missing chart category/coordinate',n);}if(typeof x!=='string'&&typeof x!=='number')fail('DDN-QC002','Chart coordinate must be text or number',n);
  points.push({id:n.id,node:n,x,rawX:x,y,sourceIds:[n.id]});}
 if(!points.length)fail('DDN-QC002','No observations remain');
 const base={kind:'chart',profile:p.profile,quality:true,transform:tr,mark,skipped,unit:p.unit||'',sourceIds:points.map(n=>n.id),quantitative:true};
 if(tr==='histogram'){
  if(!Array.isArray(p.bins)||p.bins.length<2||p.bins.length>101||p.bins.some((v,i)=>typeof v!=='number'||!Number.isFinite(v)||i>0&&v<=p.bins[i-1]))fail('DDN-QC010','bins must contain 2..101 strictly increasing finite boundaries');
  const normalization=p.normalize||'count';if(!['count','proportion','density'].includes(normalization))fail('DDN-QC010','Histogram normalization is count, proportion or density');if(p.outside!==undefined&&!['error','exclude'].includes(p.outside))fail('DDN-QC010','outside is error or exclude');
  const b=p.bins,bins=b.slice(0,-1).map((a,i)=>({a,b:b[i+1],count:0,sourceIds:[]}));let excluded=[];
  for(const pt of points){let i=bins.findIndex((v,i)=>pt.y>=v.a&&(pt.y<v.b||i===bins.length-1&&pt.y===v.b));if(i<0){if(p.outside!=='exclude')fail('DDN-QC011','Observation outside declared histogram bounds',pt.node);excluded.push(pt.id);continue;}bins[i].count++;bins[i].sourceIds.push(pt.id);}
  const count=bins.reduce((a,v)=>a+v.count,0);if(!count)fail('DDN-QC011','No observations inside histogram bounds');
  for(const b of bins){const w=finite(b.b-b.a,'Bin width');b.y=normalization==='count'?b.count:normalization==='proportion'?b.count/count:b.count/count/w;finite(b.y,'Normalized bin height');}
  return{...base,bins,normalization,excluded,count,sourceIds:bins.flatMap(b=>b.sourceIds),unit:normalization==='count'?'count':normalization==='proportion'?'proportion':'density / '+(p.unit||'unit'),xUnit:p.unit||'',intervalPolicy:'[lower, upper), last bin includes upper'};
 }
 if(tr==='pareto'){
  if(points.some(n=>n.y<0))fail('DDN-QC012','Pareto values must be nonnegative');const groups=new Map();for(const n of points){const k=canon(n.x);if(!groups.has(k))groups.set(k,{x:n.x,y:0,sourceIds:[],index:groups.size});const g=groups.get(k);g.y=finite(g.y+n.y,'Pareto category sum');g.sourceIds.push(n.id);}
  const ps=[...groups.values()].sort((a,b)=>b.y-a.y||a.index-b.index),sum=total(ps.map(p=>p.y),h);if(sum<=0)fail('DDN-QC012','Pareto cumulative percentage requires positive total');let cumulative=0;for(const pt of ps){cumulative=finite(cumulative+pt.y,'Cumulative total');pt.cumulative=cumulative;pt.percent=cumulative/sum*100;pt.cumulativeSourceIds=ps.slice(0,ps.indexOf(pt)+1).flatMap(x=>x.sourceIds);}return{...base,points:ps,total:sum};
 }
 if(tr==='waterfall'){
  if(typeof p.step!=='string')fail('DDN-QC013','Waterfall requires a step binding (delta/subtotal/total)');let running=finite(p.baseline??0,'Waterfall baseline'),contributors=[],ps=[];
  for(const pt of points){const type=get(pt.node,p.step);if(!['delta','subtotal','total'].includes(type))fail('DDN-QC013','Waterfall step must be delta, subtotal, or total',pt.node);let start=0,end=running;
   if(type==='delta'){start=running;running=finite(running+pt.y,'Waterfall running total');end=running;contributors.push(pt.id);}else if(Math.abs(pt.y-running)>Math.max(1,Math.abs(running))*1e-10)fail('DDN-QC014','Declared total does not match cumulative changes; totals are not extra deltas',pt.node);
   ps.push({...pt,step:type,start,end,sourceIds:unique([...contributors,pt.id]),valueSourceIds:[pt.id]});}
  return{...base,points:ps,baseline:p.baseline??0,total:running};
 }
 if(tr==='boxplot'){
  const method=p.quartiles||'linear_r7',whiskers=p.whiskers||'tukey_1_5';if(method!=='linear_r7'||!['tukey_1_5','minmax'].includes(whiskers))fail('DDN-QC015','Supported quartiles: linear_r7; whiskers: tukey_1_5 or minmax');
  const gs=new Map();for(const n of points){const key=canon(n.x);if(!gs.has(key))gs.set(key,[]);gs.get(key).push(n);}const boxes=[];
  for(const raw of gs.values()){const a=raw.slice().sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id)),vals=a.map(n=>n.y),quantile=p=>{const ix=(vals.length-1)*p,i=Math.floor(ix),t=ix-i;return finite(vals[i]*(1-t)+vals[Math.min(i+1,vals.length-1)]*t,'Quartile');};
   const q1=quantile(.25),median=quantile(.5),q3=quantile(.75),iqr=finite(q3-q1,'IQR'),lower=whiskers==='minmax'?vals[0]:finite(q1-1.5*iqr,'Lower fence'),upper=whiskers==='minmax'?vals.at(-1):finite(q3+1.5*iqr,'Upper fence'),inside=a.filter(n=>n.y>=lower&&n.y<=upper),outliers=a.filter(n=>n.y<lower||n.y>upper);
   boxes.push({x:raw[0].x,n:a.length,q1,median,q3,low:inside[0].y,high:inside.at(-1).y,lowerFence:lower,upperFence:upper,outliers:outliers.map(n=>({value:n.y,id:n.id})),sourceIds:a.map(n=>n.id)});}
  return{...base,boxes,quartiles:method,whiskers};
 }
 // Multiple series and controlled layering share ONE y scale and explicit units.
 const arrangement=p.arrangement||'group',xType=p.x_type||'category';if(!['group','stack','percent','overlay'].includes(arrangement)||!['category','number','date'].includes(xType))fail('DDN-QC020','Invalid arrangement or x_type');
 if(!['none','sum','count','min','max','mean'].includes(p.aggregate||'none'))fail('DDN-QC020','Unknown aggregate');
 if(p.aggregate==='count'&&p.unit)fail('DDN-QC020','Count cannot retain an input measurement unit');
 if(p.series_missing!==undefined&&!['gap','zero','error'].includes(p.series_missing))fail('DDN-QC020','series_missing is gap, zero or error');
 const series=[],categories=[],groups=new Map();
 for(const pt of points){const ser=p.series?get(pt.node,p.series):'Value';if(typeof ser!=='string'||!ser.trim()||ser.length>80)fail('DDN-QC020','Series must have a nonempty text key of at most 80 characters',pt.node);if(!series.includes(ser))series.push(ser);
  if(xType==='number')finite(pt.x,'Numeric x');if(xType==='date'){if(typeof pt.x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(pt.x)||!Number.isFinite(Date.parse(pt.x+'T00:00:00Z'))||new Date(pt.x+'T00:00:00Z').toISOString().slice(0,10)!==pt.x)fail('DDN-QC020','Date x must be a real ISO date');}
  if(!categories.some(v=>canon(v)===canon(pt.x)))categories.push(pt.x);const key=canon([ser,pt.x]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pt);}
 if(series.length>20||categories.length>200)fail('DDN-QC021','Quality chart limits: 20 series and 200 coordinates');if(xType!=='category')categories.sort((a,b)=>xType==='date'?Date.parse(a)-Date.parse(b):a-b);
 const layers=p.layers||series.map(key=>({series:key,mark}));if(!Array.isArray(layers)||layers.length!==series.length||new Set(layers.map(l=>l.series)).size!==series.length)fail('DDN-QC021','Declare exactly one layer per series');
 for(const layer of layers){exactKeys(layer,['series','mark'],fail,'layer');if(!series.includes(layer.series)||!['bar','line','area','point'].includes(layer.mark))fail('DDN-QC021','Unknown series or unsupported layer mark');if(layer.mark==='bar'&&xType!=='category')fail('DDN-QC021','Bar series require categorical x');}
 if(['stack','percent'].includes(arrangement)&&(layers.some(l=>!['bar','area'].includes(l.mark))||new Set(layers.map(l=>l.mark)).size!==1))fail('DDN-QC021','Stacked/percent layers must be all bars or all areas');
 if(p.target!==undefined&&typeof p.target!=='number')fail('DDN-QC021','target is a numeric reference on the shared y scale');if(p.target!==undefined)finite(p.target,'Target');
 const ps=[];for(const x of categories)for(const ser of series){const a=groups.get(canon([ser,x]));if(!a){if(p.series_missing==='error')fail('DDN-QC022','Missing series/category observation');ps.push({x,series:ser,y:p.series_missing==='zero'?0:null,sourceIds:[],synthetic:p.series_missing==='zero'});continue;}
  if(a.length>1&&(!p.aggregate||p.aggregate==='none'))fail('DDN-QC022','Duplicate series/category requires explicit aggregate');let y=a[0].y;if(p.aggregate==='count')y=a.length;else if(p.aggregate==='sum'||p.aggregate==='mean')y=total(a.map(n=>n.y),h)/(p.aggregate==='mean'?a.length:1);else if(p.aggregate==='min')y=Math.min(...a.map(n=>n.y));else if(p.aggregate==='max')y=Math.max(...a.map(n=>n.y));finite(y,'Series aggregate');ps.push({x,series:ser,y,sourceIds:a.map(n=>n.id)});}
 for(const x of categories){const row=ps.filter(n=>canon(n.x)===canon(x));if(['stack','percent'].includes(arrangement)&&row.some(n=>n.y===null))fail('DDN-QC022','Stacks need complete data or explicit zero fill');if(arrangement==='percent'&&row.some(n=>n.y<0))fail('DDN-QC022','Percent stack requires nonnegative values');const sum=arrangement==='percent'?total(row.map(n=>n.y),h):0;if(arrangement==='percent'&&sum<=0)fail('DDN-QC022','Zero-total percent category has no defined percentages');let positive=0,negative=0;for(const n of row){if(n.y===null)continue;n.rawY=n.y;if(arrangement==='percent')n.y=n.y/sum*100;n.start=0;n.end=n.y;if(['stack','percent'].includes(arrangement)){if(n.y>=0){n.start=positive;positive=finite(positive+n.y,'Stack total');n.end=positive;}else{n.start=negative;negative=finite(negative+n.y,'Stack total');n.end=negative;}}}}
 const values=ps.filter(n=>n.y!==null).flatMap(n=>[n.start,n.end]);if(p.target!==undefined)values.push(p.target);finite(Math.max(0,...values)-Math.min(0,...values),'Chart axis span');
 return{...base,points:ps,categories,series,layers,arrangement,xType,target:p.target,unit:arrangement==='percent'?'%':p.aggregate==='count'?'count':p.unit||'',sourceIds:unique(ps.flatMap(n=>n.sourceIds))};
}
function fishbone(ir,E,get){
 const h=helper(ir,E,get),{p,fail}=h,effect=h.resolve(p.effect);if(typeof p.relation!=='string')fail('DDN-QF001','Fishbone requires a named cause-to-parent relation');
 const es=ir.relations.filter(r=>r.kind===p.relation&&h.shown.has(r.from.element)&&h.shown.has(r.to.element));if(es.some(r=>r.from.member||r.to.member))fail('DDN-QF001','Cause endpoints must be objects');
 const incoming=id=>es.filter(r=>r.to.element===id);let count=0;const represented=new Set([effect.id]);
 function branch(id,path=[],depth=0){if(path.includes(id))fail('DDN-QF002','Cause cycle');if(depth>4||++count>250)fail('DDN-QF003','Fishbone limits: 4 cause levels and 250 occurrences');represented.add(id);return{node:h.nodes.get(id),occurrence:[...path,id].join('/'),children:incoming(id).map(r=>({...branch(r.from.element,[...path,id],depth+1),relationId:r.id}))};}
 if(effect.kind!=='quality.effect')fail('DDN-QF001','Fishbone effect must use quality.effect');const root=branch(effect.id);if(root.children.some(c=>c.node.kind!=='quality.category'))fail('DDN-QF001','First-level ribs must be quality.category');if(root.children.length<1||root.children.length>12)fail('DDN-QF003','Fishbone needs 1..12 root categories');if(es.some(r=>!represented.has(r.from.element)||!represented.has(r.to.element)))fail('DDN-QF004','Selected cause relationships contain disconnected components');
 return{kind:'fishbone',profile:p.profile,effect,categories:root.children,sourceIds:unique([...represented,...es.map(r=>r.id)]),occurrences:count,quantitative:false};
}
function matrixEncoding(plan,p,E){
 const fail=(c,m)=>{throw error(E,c,m);};const e=p.encoding;if(!e)return plan;exactKeys(e,['mode','domain','values','labels','boundaries','palette'],fail,'cell encoding');
 if(!['numeric','category','bands'].includes(e.mode))fail('DDN-QM001','Encoding mode is numeric, category or bands');if(e.palette!==undefined&&!['blue','diverging'].includes(e.palette))fail('DDN-QM001','Unknown registered cell palette');
 if(e.mode==='numeric'&&(!Array.isArray(e.domain)||e.domain.length!==2||e.domain.some(x=>typeof x!=='number'||!Number.isFinite(x))||e.domain[1]<=e.domain[0]||!Number.isFinite(e.domain[1]-e.domain[0])))fail('DDN-QM001','Numeric encoding needs an explicit finite increasing domain');
 if(e.mode==='category'&&(!Array.isArray(e.values)||!e.values.length||e.values.length>12||e.values.some(x=>!primitive(x))||new Set(e.values.map(canon)).size!==e.values.length))fail('DDN-QM001','Category encoding requires 1..12 distinct scalar values');
 if(e.mode==='bands'&&(!Array.isArray(e.boundaries)||e.boundaries.length<2||e.boundaries.length>13||e.boundaries.some((x,i)=>typeof x!=='number'||!Number.isFinite(x)||i>0&&x<=e.boundaries[i-1])))fail('DDN-QM001','Bands require strictly increasing finite boundaries');
 const n=e.mode==='category'?e.values.length:e.mode==='bands'?e.boundaries.length-1:0;if(n&&(!Array.isArray(e.labels)||e.labels.length!==n||e.labels.some(x=>typeof x!=='string'||!x.trim())))fail('DDN-QM001','Each category/band needs its readable legend label');
 if(e.mode==='numeric'&&(e.values||e.labels||e.boundaries)||e.mode==='category'&&(e.domain||e.boundaries)||e.mode==='bands'&&(e.domain||e.values))fail('DDN-QM001','Conflicting encoding modes');
 for(const row of plan.cells)for(const c of row){if(c.length>1)fail('DDN-QM002','Encoded cells require unique source assignment');for(const x of c){let v=x.raw;if(e.mode==='category'){x.band=e.values.findIndex(z=>canon(z)===canon(v));if(x.band<0)fail('DDN-QM002','Unmapped categorical cell');x.label=e.labels[x.band];x.intensity=n===1?.5:x.band/(n-1);}else{if(typeof v!=='number'||!Number.isFinite(v))fail('DDN-QM002','Encoded numeric cells must be numbers, not numeric strings');if(e.mode==='numeric'){if(v<e.domain[0]||v>e.domain[1])fail('DDN-QM002','Cell is outside the declared domain');x.intensity=(v-e.domain[0])/(e.domain[1]-e.domain[0]);x.label=String(v);}else{x.band=e.boundaries.slice(0,-1).findIndex((a,i)=>v>=a&&(v<e.boundaries[i+1]||i===n-1&&v===e.boundaries[i+1]));if(x.band<0)fail('DDN-QM002','Cell is outside band boundaries');x.label=e.labels[x.band]+' · '+v;x.intensity=n===1?.5:x.band/(n-1);}}}}
 return{...plan,encoding:e};
}
// Decision predicates use explicit finite domains. Numeric partitions include
// singleton boundaries and an interior witness: comparisons are constant in
// each resulting atom. Bounded Cartesian enumeration proves only this DSL.
function inputs(spec,fail){
 if(!Array.isArray(spec)||spec.length<1||spec.length>8)fail('DDN-QD001','Declare 1..8 input domains');const seen=new Set();
 return spec.map(d=>{exactKeys(d,['key','type','values','min','max','nullable','optional'],fail,'input domain');if(typeof d.key!=='string'||!/^[_A-Za-z][_A-Za-z0-9]*$/.test(d.key)||['__proto__','constructor','prototype'].includes(d.key)||seen.has(d.key))fail('DDN-QD001','Invalid or duplicate input key');seen.add(d.key);if(!['enum','boolean','number'].includes(d.type))fail('DDN-QD001','Input type is enum, boolean or number');if(d.nullable!==undefined&&typeof d.nullable!=='boolean'||d.optional!==undefined&&typeof d.optional!=='boolean')fail('DDN-QD001','nullable/optional must be boolean');
  if(d.type==='enum'){if(!Array.isArray(d.values)||!d.values.length||d.values.length>30||d.values.some(x=>!primitive(x)||x===null||typeof x==='number'&&!Number.isFinite(x))||new Set(d.values.map(canon)).size!==d.values.length)fail('DDN-QD001','Enum values must be distinct non-null finite scalars');if(d.min!==undefined||d.max!==undefined)fail('DDN-QD001','Enum cannot declare numeric bounds');}
  if(d.type==='number'){if(typeof d.min!=='number'||typeof d.max!=='number'||!Number.isFinite(d.min)||!Number.isFinite(d.max)||d.min>d.max||!Number.isFinite(d.max-d.min))fail('DDN-QD001','Numeric input requires finite closed min/max');if(d.values!==undefined)fail('DDN-QD001','Numeric domain cannot declare enum values');}
  if(d.type==='boolean'&&(d.values!==undefined||d.min!==undefined||d.max!==undefined))fail('DDN-QD001','Boolean domain is false/true');return d;});
}
function inDomain(v,d){if(isMissing(v))return !!d.optional;if(v===null)return !!d.nullable;if(d.type==='number')return typeof v==='number'&&Number.isFinite(v)&&v>=d.min&&v<=d.max;if(d.type==='boolean')return typeof v==='boolean';return d.values.some(x=>canon(x)===canon(v));}
function predicates(when,ds,fail){if(!when||typeof when!=='object'||Array.isArray(when))fail('DDN-QD002','when must be a conjunction record');for(const[k,c]of Object.entries(when)){const d=ds.find(d=>d.key===k);if(!d)fail('DDN-QD002','Predicate references unknown input '+k);exactKeys(c,['op','value','values','min','max','lower_closed','upper_closed'],fail,'predicate');if(!['eq','in','interval','null','missing'].includes(c.op))fail('DDN-QD002','Unsupported predicate operator');const by={eq:['op','value'],in:['op','values'],interval:['op','min','max','lower_closed','upper_closed'],null:['op'],missing:['op']};if(Object.keys(c).some(x=>!by[c.op].includes(x)))fail('DDN-QD002','Extra predicate parameters');if(c.op==='eq'&&(!Object.hasOwn(c,'value')||!inDomain(c.value,d)))fail('DDN-QD002','Equality value outside input domain');if(c.op==='in'&&(!Array.isArray(c.values)||!c.values.length||c.values.some(v=>!inDomain(v,d))||new Set(c.values.map(canon)).size!==c.values.length))fail('DDN-QD002','Membership values outside input domain or duplicate');if(c.op==='null'&&!d.nullable||c.op==='missing'&&!d.optional)fail('DDN-QD002','Predicate uses an unavailable null/missing state');if(c.op==='interval'){if(d.type!=='number'||typeof c.min!=='number'||typeof c.max!=='number'||!Number.isFinite(c.min)||!Number.isFinite(c.max)||c.min>c.max||c.min<d.min||c.max>d.max||c.min===c.max&&(c.lower_closed===false||c.upper_closed===false))fail('DDN-QD002','Invalid numeric predicate interval');for(const k of ['lower_closed','upper_closed'])if(c[k]!==undefined&&typeof c[k]!=='boolean')fail('DDN-QD002','Interval closure must be boolean');}}
 return when;}
function match(when,input){return Object.entries(when).every(([k,c])=>{const v=Object.hasOwn(input,k)?input[k]:MISSING;if(c.op==='missing')return isMissing(v);if(c.op==='null')return v===null;if(c.op==='eq')return canon(v)===canon(c.value);if(c.op==='in')return c.values.some(x=>canon(x)===canon(v));if(c.op==='interval')return typeof v==='number'&&(c.lower_closed===false?v>c.min:v>=c.min)&&(c.upper_closed===false?v<c.max:v<=c.max);return false;});}
function atoms(ds,whens){return ds.map(d=>{let vals;if(d.type==='enum')vals=d.values.slice();else if(d.type==='boolean')vals=[false,true];else{let cuts=[d.min,d.max];for(const when of whens){const c=when[d.key];if(!c)continue;if(c.op==='interval')cuts.push(c.min,c.max);if(c.op==='eq'&&typeof c.value==='number')cuts.push(c.value);if(c.op==='in')cuts.push(...c.values.filter(x=>typeof x==='number'));}cuts=unique(cuts).sort((a,b)=>a-b);vals=[];for(let i=0;i<cuts.length;i++){vals.push(cuts[i]);if(i+1<cuts.length){const middle=cuts[i]/2+cuts[i+1]/2;if(middle>cuts[i]&&middle<cuts[i+1])vals.push(middle);}}}if(d.nullable)vals.push(null);if(d.optional)vals.push(MISSING);return vals;});}
function analyze(ds,rules,policy,coverage,budget,fail){
 const a=atoms(ds,rules.map(r=>r.when)),combinations=a.reduce((n,v)=>n*v.length,1);if(!Number.isSafeInteger(budget)||budget<1||budget>50000)fail('DDN-QD003','analysis_budget is 1..50000');
 if(combinations>budget){if(policy==='unique'||coverage==='complete')fail('DDN-QD008','Rule proof budget exceeded ('+combinations+' atoms); disjointness/coverage NOT established');return{status:'budget_exceeded',combinations,budget,uncovered:[],overlaps:[],shadowed:[]};}
 let checks=0,uncovered=[],overlaps=[],matched=new Set(),selected=new Set();function walk(i,obj){if(i<a.length){for(const v of a[i]){const next={...obj};if(!isMissing(v))next[ds[i].key]=v;walk(i+1,next);}return;}checks++;const ms=rules.filter(r=>match(r.when,obj));ms.forEach(r=>matched.add(r.id));(policy==='first'?ms.slice(0,1):ms).forEach(r=>selected.add(r.id));if(!ms.length){if(coverage==='complete')fail('DDN-QD005','Uncovered input witness '+JSON.stringify(obj));if(uncovered.length<20)uncovered.push(obj);}if(ms.length>1){if(policy==='unique')fail('DDN-QD004','Overlapping rules '+ms.map(r=>r.id).join(', ')+' for witness '+JSON.stringify(obj));if(overlaps.length<20)overlaps.push({input:obj,rules:ms.map(r=>r.id)});}}
 walk(0,{});return{status:'proved-over-declared-domains',combinations,checks,budget,uncovered,overlaps,shadowed:policy==='first'?rules.filter(r=>matched.has(r.id)&&!selected.has(r.id)).map(r=>r.id):[],unreachable:rules.filter(r=>!matched.has(r.id)).map(r=>r.id)};
}
function decision(ir,E,get){
 const h=helper(ir,E,get),{p,fail}=h,ds=inputs(p.inputs,fail);if(!['unique','first','collect'].includes(p.hit_policy))fail('DDN-QD003','hit_policy must be unique, first or collect');const coverage=p.coverage||'report';if(!['complete','report','none'].includes(coverage))fail('DDN-QD003','coverage is complete, report or none');
 const outputs=p.outputs;if(!Array.isArray(outputs)||!outputs.length||outputs.length>20||outputs.some(x=>typeof x!=='string'||!/^[_A-Za-z][_A-Za-z0-9]*$/.test(x)||['__proto__','constructor','prototype'].includes(x))||new Set(outputs).size!==outputs.length)fail('DDN-QD003','outputs must name 1..20 distinct keys');
 const rules=h.records().map(n=>{const rule=n.properties.x_rule;exactKeys(rule,['when','then'],fail,'rule');predicates(rule.when,ds,fail);exactKeys(rule.then,outputs,fail,'rule output');if(outputs.some(k=>!Object.hasOwn(rule.then,k)||!primitive(rule.then[k])||typeof rule.then[k]==='number'&&!Number.isFinite(rule.then[k])))fail('DDN-QD003','Every rule must provide every scalar output');return{id:n.id,node:n,when:rule.when,then:rule.then};});
 const analysis=analyze(ds,rules,p.hit_policy,coverage,p.analysis_budget??4096,fail);
 return{kind:'decision',profile:p.profile,inputs:ds,outputs,rules,policy:p.hit_policy,coverage,analysis,sourceIds:rules.map(r=>r.id)};
}
function evaluateDecision(plan,input){const fail=(c,m)=>{throw error(Error,c,m);};if(plan.kind!=='decision')fail('DDN-QD006','Not a rule-based decision projection');if(!input||typeof input!=='object'||Array.isArray(input))fail('DDN-QD006','Input must be a record');for(const k of Object.keys(input))if(!plan.inputs.some(d=>d.key===k))fail('DDN-QD006','Unknown input '+k);for(const d of plan.inputs)if(!inDomain(Object.hasOwn(input,d.key)?input[d.key]:MISSING,d))fail('DDN-QD006','Input outside declared domain: '+d.key);const matched=plan.rules.filter(r=>match(r.when,input)),chosen=plan.policy==='first'?matched.slice(0,1):matched;if(plan.policy==='unique'&&chosen.length>1)fail('DDN-QD004','More than one matching rule');return{policy:plan.policy,matched:matched.map(r=>r.id),selected:chosen.map(r=>r.id),outputs:chosen.map(r=>r.then),status:chosen.length?'matched':'no_match'};}
function lifecycle(ir,E,get){
 const h=helper(ir,E,get),{p,fail}=h,states=ir.elements.filter(n=>h.shown.has(n.id)),es=ir.relations.filter(r=>h.shown.has(r.from.element)&&h.shown.has(r.to.element));if(states.some(n=>!['state.initial','state.state','state.final'].includes(n.kind))||es.some(r=>r.kind!=='state.transition'||r.from.member||r.to.member))fail('DDN-QL001','Flat lifecycle accepts only declared states and transitions');
 const initials=states.filter(n=>n.kind==='state.initial'),finals=states.filter(n=>n.kind==='state.final'||n.properties.x_state?.terminal===true);if(initials.length!==1||!finals.length)fail('DDN-QL001','Lifecycle needs exactly one initial marker and at least one terminal state');if(states.some(n=>n.fields.length))fail('DDN-QL001','Flat states do not contain nested fields/regions');
 const ds=p.inputs?inputs(p.inputs,fail):[],out=id=>es.filter(r=>r.from.element===id),inc=id=>es.filter(r=>r.to.element===id);if(inc(initials[0].id).length||out(initials[0].id).length!==1)fail('DDN-QL002','Initial marker has no incoming and exactly one outgoing transition');if(finals.some(n=>out(n.id).length))fail('DDN-QL002','Terminal state has an outgoing transition');
 for(const r of es){const x=r.properties.x_transition||{};exactKeys(x,['event','guard','actions'],fail,'transition');if(r.from.element===initials[0].id){if(x.event||x.guard||x.actions?.length)fail('DDN-QL002','Initial transition is unconditional and action-free');}else if(typeof x.event!=='string'||!x.event.trim())fail('DDN-QL002','Noninitial transition requires an event',r);if(x.guard)predicates(x.guard,ds,fail);if(x.actions!==undefined&&(!Array.isArray(x.actions)||x.actions.some(a=>!h.nodes.has(a?.$ref))))fail('DDN-QL002','Actions must reference scoped definitions; they are not executed');}
 const reach=(roots,reverse)=>{const seen=new Set(roots),queue=[...roots];while(queue.length){const id=queue.shift();for(const r of es)if((reverse?r.to.element:r.from.element)===id){const to=reverse?r.from.element:r.to.element;if(!seen.has(to)){seen.add(to);queue.push(to);}}}return seen;};const a=reach([initials[0].id],false),b=reach(finals.map(n=>n.id),true);if(states.some(n=>!a.has(n.id)))fail('DDN-QL003','Unreachable lifecycle state');if(states.some(n=>!b.has(n.id)))fail('DDN-QL003','State cannot reach a terminal outcome');
 for(const n of states){const events=unique(out(n.id).map(r=>r.properties.x_transition?.event).filter(Boolean));for(const ev of events){const rs=out(n.id).filter(r=>r.properties.x_transition?.event===ev).map(r=>({id:r.id,when:r.properties.x_transition.guard||{}}));if(!ds.length){if(rs.length>1)fail('DDN-QL004','Ambiguous event without declared guard domains');}else analyze(ds,rs,'unique','none',p.analysis_budget??4096,fail);}}
 const plan={kind:'lifecycle',profile:p.profile,states,transitions:es,inputs:ds,initial:out(initials[0].id)[0].to.element,initialMarker:initials[0].id,finals:finals.map(n=>n.id),sourceIds:states.map(n=>n.id).concat(es.map(r=>r.id))};if(p.traces!==undefined&&(!Array.isArray(p.traces)||p.traces.length>100))fail('DDN-QL005','traces must be an array of at most 100 traces');for(const trace of p.traces||[]){exactKeys(trace,['events','expected','name'],fail,'trace');simulate(plan,trace.events,trace.expected);}return plan;
}
function simulate(plan,events,expected){const fail=(c,m)=>{throw error(Error,c,m);};if(!Array.isArray(events)||events.length>1000)fail('DDN-QL005','Trace must contain up to 1000 events');let state=plan.initial,steps=[];for(const ev of events){if(!ev||typeof ev.event!=='string')fail('DDN-QL005','Trace event name required');if(Object.keys(ev).some(k=>!['event','data'].includes(k)))fail('DDN-QL005','Trace event supports event and data only');const data=ev.data===undefined?{}:ev.data;if(data===null||typeof data!=='object'||Array.isArray(data))fail('DDN-QL005','Event data must be a record');for(const k of Object.keys(data))if(!plan.inputs.some(d=>d.key===k))fail('DDN-QL005','Unknown trace input '+k);for(const d of plan.inputs)if(!inDomain(data[d.key],d))fail('DDN-QL005','Trace input outside domain '+d.key);const rs=plan.transitions.filter(r=>r.from.element===state&&r.properties.x_transition?.event===ev.event&&match(r.properties.x_transition?.guard||{},data));if(rs.length!==1)fail('DDN-QL006','No unique permitted transition for '+ev.event+' at '+state);const r=rs[0];steps.push({from:state,to:r.to.element,transition:r.id,event:ev.event,actions:(r.properties.x_transition?.actions||[]).map(a=>a.$ref)});state=r.to.element;}const want=typeof expected==='string'?expected:expected?.$ref;if(want&&want!==state)fail('DDN-QL007','Trace final state differs from expected');return{state,terminal:plan.finals.includes(state),steps,actionsExecuted:false};}
function formatPredicate(c){if(!c)return'Any';if(c.op==='eq')return'= '+canon(c.value);if(c.op==='in')return'∈ {'+c.values.map(canon).join(', ')+'}';if(c.op==='interval')return(c.lower_closed===false?'(':'[')+c.min+', '+c.max+(c.upper_closed===false?')':']');return c.op;}
function cpm(ir,E){
 const fail=(c,m,n)=>{throw error(E,c,m,n||ir.view);};
 const shown=new Set(ir.view.selected),tasks=ir.elements.filter(n=>shown.has(n.id)&&n.kind==='analysis.task'),byId=new Map(tasks.map(n=>[n.id,n]));
 const es=ir.relations.filter(r=>r.kind==='analysis.precedes'&&byId.has(r.from.element)&&byId.has(r.to.element));
 for(const n of tasks){const v=n.properties.x_estimate;if(typeof v!=='number'||!Number.isFinite(v)||v<0)fail('DDN-PJ125','Task '+n.id+' needs a finite nonnegative x_estimate duration in days',n);}
 const kids=new Map(tasks.map(n=>[n.id,[]])),preds=new Map(tasks.map(n=>[n.id,[]]));
 for(const r of es){kids.get(r.from.element).push(r);preds.get(r.to.element).push(r);}
 const active=new Set(),seen=new Set(),order=[];
 function visit(id){if(active.has(id))fail('DDN-PJ124','Dependency cycle reaches task '+id,byId.get(id));if(seen.has(id))return;active.add(id);for(const r of kids.get(id))visit(r.to.element);active.delete(id);seen.add(id);order.push(id);}
 for(const n of tasks)visit(n.id);
 order.reverse();
 const sched={};
 for(const id of order){const est=byId.get(id).properties.x_estimate,s=preds.get(id).reduce((m,r)=>Math.max(m,sched[r.from.element].ef),0);sched[id]={es:s,ef:s+est,estimate:est};}
 const duration=order.reduce((m,id)=>Math.max(m,sched[id].ef),0);
 for(const id of [...order].reverse()){const t=sched[id],est=byId.get(id).properties.x_estimate,lf=kids.get(id).reduce((m,r)=>Math.min(m,sched[r.to.element].ls),duration);t.lf=lf;t.ls=lf-est;t.slack=t.ls-t.es;}
 const criticalTasks=order.filter(id=>sched[id].slack===0);
 const criticalRelations=es.filter(r=>sched[r.from.element].slack===0&&sched[r.to.element].slack===0&&sched[r.from.element].ef===sched[r.to.element].es).map(r=>r.id);
 return{tasks:sched,criticalTasks,criticalRelations,duration};
}
return{VERSION,chartRequested,chart,fishbone,matrixEncoding,decision,evaluateDecision,lifecycle,simulate,cpm,formatPredicate,inputs,predicates,match,analyze,inDomain};
});
