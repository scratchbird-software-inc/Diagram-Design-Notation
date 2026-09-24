/* SPDX-License-Identifier: GPL-2.0-or-later. Bounded, typed projection plans. No expressions, external loaders or implicit joins. */
import {publishNamespace} from './ddn-module-registry.js';
import Quality from './ddn-quality-data.js';
'use strict';
const common=['kind','profile','width','height'];
const supported={graph:['kind','profile','inputs','analysis_budget','traces','iso','depth'],fishbone:[...common,'effect','relation'],decision:[...common,'records','inputs','outputs','hit_policy','coverage','analysis_budget','filter','order'],chen:common,matrix:[...common,'write_data','rows','columns','relation','value','duplicates','encoding'],table:[...common,'records','columns','filter','order','missing'],panels:[...common,'columns','panels','value'],chart:[...common,'records','mark','x','y','x_type','size','unit','aggregate','filter','order','missing','inner_radius','series','series_missing','arrangement','transform','layers','bins','normalize','outside','whiskers','quartiles','step','baseline','target','open','high','low','close','bin_count','k','others','error','trend','iso','depth'],timeline:[...common,'records','start','end','label','dependencies','filter','order'],sequence:[...common],timing:[...common],geo:[...common,'records','mark','x','y','value','size','unit','filter','order','missing','geography','method','graticule']};
const ref=x=>typeof x==='string'?x:x?.$ref;
function get(record,path){
 if(typeof path!=='string'||!/^([A-Za-z_][A-Za-z0-9_]*)(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(path)||path.split('.').some(k=>['__proto__','prototype','constructor'].includes(k)))throw Object.assign(new Error('Unsafe property binding '+path),{code:'DDN-PJ004'});
 if(['id','name','kind'].includes(path))return record[path];
 let v=record.properties;for(const part of path.split('.')){if(v===null||typeof v!=='object'||!Object.hasOwn(v,part))return undefined;v=v[part];}return v;
}
function date(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:NaN;}
function plan(ir,ErrorClass=Error){
 const p=ir.view.profiles.projection||{kind:'graph',profile:'ddn@1'},kind=p.kind,byId=new Map(ir.elements.map(n=>[n.id,n])),byRel=new Map(ir.relations.map(r=>[r.id,r])),shown=new Set(ir.view.selected);
 const fail=(code,msg,n)=>{const e=new ErrorClass(code,msg,n?.source?.file||ir.view.source?.file,n?.source?.start||ir.view.source?.start);if(ErrorClass===Error){e.message=msg;e.code=code;}throw e;};
 if(!supported[kind])fail('DDN-PJ001','Unsupported projection '+kind);
 /* B1-034 (D3/D8): iso/depth are validated before the per-kind key check so
  * every kind reports the same coded contract; rendering lives in the
  * optional ddn-iso bundle (missing module → placeholder or flat + DDN-E010). */
 if(p.iso!==undefined&&typeof p.iso!=='boolean')fail('DDN-ISO150','iso must be a boolean (iso: true|false)');
 if(p.depth!==undefined){const v=p.depth,ok=typeof v==='number'||typeof v==='string'||(v&&v.$quantity!==undefined)||(v&&v.$ref!==undefined&&typeof v.$field==='string');if(!ok)fail('DDN-ISO151','depth is a px quantity, a number, an "x_record.field" per-record binding or @data.record.field');if(typeof v==='number'&&(!Number.isFinite(v)||v<0||v>2000))fail('DDN-ISO151','depth must be a finite number 0..2000 (px)');if(typeof v==='string'&&!/^([A-Za-z_][A-Za-z0-9_]*)(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(v))fail('DDN-ISO151','depth per-record binding must be a property path like "x_record.load"');}
 if((p.iso!==undefined||p.depth!==undefined)&&!['graph','chart'].includes(kind))fail('DDN-ISO150','iso/depth apply to graph and chart projections');
 for(const k of Object.keys(p))if(!supported[kind].includes(k))fail('DDN-PJ005',kind+' projection does not use '+k+'; no silent ignored settings');
 for(const k of ['width','height'])if(p[k]!==undefined){const v=typeof p[k]==='number'?p[k]:p[k]?.unit==='px'?p[k].$quantity:NaN;if(!Number.isFinite(v)||v<240||v>12000)fail('DDN-PJ006','Projection '+k+' must be 240..12000 px');}
 const resolve=(x,type='element')=>{const n=(type==='relation'?byRel:byId).get(ref(x));if(!n)fail('DDN-PJ007','Projection reference is outside its data scope: '+ref(x));if(type==='element'&&!shown.has(n.id))fail('DDN-PJ008','Projection binds an excluded/not-selected element: '+n.id);return n;};
 const list=(a,name)=>{if(!Array.isArray(a)||!a.length||a.length>500)fail('DDN-PJ009',name+' needs 1..500 explicit references');const ns=a.map(x=>resolve(x));if(new Set(ns.map(n=>n.id)).size!==ns.length)fail('DDN-PJ009','Duplicate '+name+' identity');return ns;};
 const textValue=(n,key,defaultValue)=>{const v=get(n,key);if(v===undefined&&defaultValue!==undefined)return defaultValue;if(typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')fail('DDN-PJ010',key+' must supply a scalar value',n);return v;};
 const filtered=()=>{const declaredEmpty=Array.isArray(p.records)&&p.records.length===0&&(kind==='chart'||kind==='table');let ns=declaredEmpty?[]:list(p.records,'records');if(p.filter){if(declaredEmpty)fail('DDN-PJ011','A filter cannot apply to an intentionally empty records declaration');const{key,op,value}=p.filter;if(Object.keys(p.filter).some(k=>!['key','op','value'].includes(k))||!['eq','in'].includes(op)||op==='in'&&!Array.isArray(value))fail('DDN-PJ011','Filter supports explicit eq or in only');ns=ns.filter(n=>{const v=get(n,key);return op==='eq'?v===value:value.includes(v);});}if(p.order){if(declaredEmpty)fail('DDN-PJ011','An order cannot apply to an intentionally empty records declaration');if(!['asc','desc'].includes(p.order.direction)||Object.keys(p.order).some(k=>!['key','direction'].includes(k)))fail('DDN-PJ011','Order needs key and asc/desc');ns=ns.map((n,i)=>({n,i,v:textValue(n,p.order.key)})).sort((a,b)=>(p.order.direction==='desc'?-1:1)*(a.v<b.v?-1:a.v>b.v?1:0)||a.i-b.i).map(o=>o.n);}if(!ns.length&&!declaredEmpty)fail('DDN-PJ012','Projection selection is empty after filtering');return ns;};
 if(kind==='fishbone')return Quality.fishbone(ir,ErrorClass,get);
 if(kind==='decision')return Quality.decision(ir,ErrorClass,get);
 if(kind==='chart'&&Quality.chartRequested(p)&&!['radar','funnel','candlestick','treemap','histogram','density','qq','quantiledot','dotplot','boxplot','violin','beeswarm','topk','tidytree','radialtree','circlepack','sunburst','packedbubble','heatmap','densityheatmap','calendar','parallelcoords','wordcloud','arc','force','edgebundle'].includes(p.mark))return Quality.chart(ir,ErrorClass,get);
 if(kind==='graph'&&p.profile==='state.flat@1')return{kind,profile:p.profile,lifecycle:Quality.lifecycle(ir,ErrorClass,get)};
 if(kind==='graph'&&['inputs','analysis_budget','traces'].some(k=>p[k]!==undefined))fail('DDN-Q005','Lifecycle properties require state.flat@1');
 if(kind==='graph'&&p.profile==='pert.cpm@1')return{kind,profile:p.profile,cpm:Quality.cpm(ir,ErrorClass)};
 if(kind==='graph'||kind==='chen')return{kind,profile:p.profile};
 if(kind==='geo')return{kind,profile:p.profile}; // detailed geo planning/validation lives in the optional ddn-geo bundle
 if(kind==='matrix'){
  const rows=list(p.rows,'rows'),columns=list(p.columns,'columns');if(rows.length*columns.length>5000||columns.length>40)fail('DDN-PJ013','Matrix limit: 5,000 cells and 40 columns');
  const QUADRANTS={'matrix.bcg@1':{rows:['growth',['high','low']],columns:['share',['high','low']]},'matrix.ansoff@1':{rows:['market',['existing','new']],columns:['product',['existing','new']]},'matrix.tows@1':{rows:['internal',['strength','weakness']],columns:['external',['opportunity','threat']]}};
  const quad=QUADRANTS[p.profile];
  if(quad)for(const side of ['rows','columns']){const [axis,levels]=quad[side],els=side==='rows'?rows:columns;
   if(els.length!==levels.length)fail('DDN-PJ082',p.profile+' '+side+' must be exactly the '+axis+' categories ['+levels.join(', ')+']');
   const seen=new Set();
   for(const el of els){const xc=el.properties.x_category;
    if(!xc||xc.axis!==axis||!levels.includes(xc.level)||seen.has(xc.level))fail('DDN-PJ082',p.profile+' '+side+' must declare x_category {axis:"'+axis+'",level} covering ['+levels.join(', ')+']; check '+el.name,el);
    seen.add(xc.level);}}
  if(typeof p.relation!=='string'||typeof p.value!=='string')fail('DDN-PJ014','Matrix needs a relation kind and a value binding');
  if(p.duplicates!==undefined&&!['error','join'].includes(p.duplicates))fail('DDN-PJ014','Unknown duplicate-cell policy');
  if(!['matrix.relations@1','matrix.bcg@1','matrix.ansoff@1','matrix.tows@1','matrix.storymap@1'].includes(p.profile)&&p.duplicates==='join')fail('DDN-PJ014','RACI/CRUD require one declared assignment per cell');
  const storymap=p.profile==='matrix.storymap@1';if(storymap&&(p.relation!=='assoc'||p.value!=='x_story.task'))fail('DDN-PJ014','matrix.storymap@1 uses assoc cell relations carrying x_story.task');
  const ri=new Map(rows.map((n,i)=>[n.id,i])),ci=new Map(columns.map((n,i)=>[n.id,i])),cells=rows.map(()=>columns.map(()=>[]));
  for(const r of ir.relations.filter(r=>r.kind===p.relation&&ri.has(r.from.element)&&ci.has(r.to.element))){
   const story=storymap?resolve(r.properties.x_story&&r.properties.x_story.task,'element'):null;
   if(storymap&&story.kind!=='analysis.task')fail('DDN-PJ093','Story map cells must reference analysis.task objects: '+r.id,r);
   const value=storymap?story.name:textValue(r,p.value);
   const c=cells[ri.get(r.from.element)][ci.get(r.to.element)];if(c.length&&p.duplicates!=='join')fail('DDN-PJ015','More than one assignment for the same row and column',r);c.push(storymap?{id:story.id,value:String(value),raw:value,relationId:r.id}:{id:r.id,value:String(value),raw:value});}
  if(storymap){const seen=new Map();
   for(let i=0;i<rows.length;i++)for(let j=0;j<columns.length;j++)for(const c of cells[i][j]){
    const at=seen.get(c.id);
    if(at&&at!==rows[i].id)fail('DDN-PJ086','Story placed in two releases: '+c.value+' is in '+rows.find(n=>n.id===at).name+' and '+rows[i].name,byRel.get(c.relationId));
    if(at)fail('DDN-PJ086','Story placed twice: '+c.value+' appears in multiple cells of '+rows[i].name,byRel.get(c.relationId));
    seen.set(c.id,rows[i].id);}}
  if(p.profile==='matrix.raci@1')for(let i=0;i<rows.length;i++){const vs=cells[i].flat().map(x=>x.value);if(vs.some(v=>!['R','A','C','I'].includes(v))||vs.filter(v=>v==='A').length!==1||!vs.includes('R'))fail('DDN-PJ016','RACI row requires exactly one A, at least one R, and only R/A/C/I codes: '+rows[i].name,rows[i]);}
  if(p.profile==='matrix.crud@1')for(const row of cells)for(const cell of row)for(const v of cell)if(!/^[CRUD]+$/.test(v.value)||new Set(v.value).size!==v.value.length)fail('DDN-PJ017','CRUD value must contain distinct C/R/U/D letters');
  return Quality.matrixEncoding({kind,profile:p.profile,rows,columns,cells,sourceIds:[...rows,...columns].map(n=>n.id).concat(cells.flat(2).map(c=>c.id))},p,ErrorClass);
 }
 if(kind==='table'){
  const records=filtered();if(!Array.isArray(p.columns)||!p.columns.length||p.columns.length>30)fail('DDN-PJ018','Table needs 1..30 column bindings');
  const seen=new Set();for(const c of p.columns){if(typeof c.key!=='string'||typeof c.label!=='string'||!c.label||seen.has(c.key)||Object.keys(c).some(k=>!['key','label'].includes(k)))fail('DDN-PJ018','Invalid/duplicate table column');seen.add(c.key);}
  if(p.missing!==undefined&&!['error','blank'].includes(p.missing))fail('DDN-PJ019','Table missing policy is error or blank');
  const rows=records.map(n=>p.columns.map(c=>{const v=get(n,c.key);if(v===undefined&&p.missing==='blank')return'';if(v===null)return'null';if(v===undefined)fail('DDN-PJ019','Missing table value '+c.key,n);if(typeof v==='object')fail('DDN-PJ019','Table values must be scalar',n);return String(v);}));return{kind,profile:p.profile,records,columns:p.columns,rows,sourceIds:records.map(n=>n.id)};
 }
 if(kind==='panels'){
  if(!Number.isInteger(p.columns)||p.columns<1||p.columns>12||!Array.isArray(p.panels)||!p.panels.length||p.panels.length>80)fail('DDN-PJ020','Panels need 1..12 columns and 1..80 panels');
  const used=new Set(),ids=new Set();const panels=p.panels.map((v,i)=>{const{row,column}=v,rs=v.rowspan??1,cs=v.colspan??1;
   if(Object.keys(v).some(k=>!['id','title','row','column','rowspan','colspan','items','view'].includes(k))||!v.id||ids.has(v.id)||typeof v.title!=='string'||![row,column,rs,cs].every(Number.isInteger)||row<0||row>100||column<0||rs<1||cs<1||row+rs>101||column+cs>p.columns)fail('DDN-PJ020','Invalid panel grid span/ID');ids.add(v.id);
   for(let y=row;y<row+rs;y++)for(let x=column;x<column+cs;x++){const key=y+':'+x;if(used.has(key))fail('DDN-PJ021','Overlapping panel spans');used.add(key);}
   if(v.view){if(v.items||p.profile!=='panels.composed@1')fail('DDN-QP001','A child-view panel requires panels.composed@1 and cannot also contain items');const child=ir.view.children?.find(c=>c.slot===v.id);if(!child)fail('DDN-QP001','Child view was not compiled');return{...v,rowspan:rs,colspan:cs,items:[],child:child.ir};}
   const items=p.profile==='panels.pyramid@1'&&(!v.items||!v.items.length)?[]:list(v.items,'panel items');return{...v,rowspan:rs,colspan:cs,items:items.map(n=>({node:n,text:p.value?String(textValue(n,p.value,'')):n.properties.description||n.properties.x_record?.description||''}))};});
  const CANVAS={'canvas.bmc@1':{code:'DDN-PJ080',panels:[['kp','KEY PARTNERS'],['ka','KEY ACTIVITIES'],['kr','KEY RESOURCES'],['vp','VALUE PROPOSITIONS'],['cr','CUSTOMER RELATIONSHIPS'],['ch','CHANNELS'],['cs','CUSTOMER SEGMENTS'],['cost','COST STRUCTURE'],['rev','REVENUE STREAMS']]},'canvas.lean@1':{code:'DDN-PJ080',panels:[['problem','PROBLEM'],['solution','SOLUTION'],['keymetrics','KEY METRICS'],['uvp','UNIQUE VALUE PROPOSITION'],['unfair','UNFAIR ADVANTAGE'],['channels','CHANNELS'],['segments','CUSTOMER SEGMENTS'],['cost','COST STRUCTURE'],['revenue','REVENUE STREAMS']]},'canvas.pest@1':{code:'DDN-PJ081',panels:[['political','POLITICAL'],['economic','ECONOMIC'],['social','SOCIAL'],['technological','TECHNOLOGICAL']]},'canvas.pestle@1':{code:'DDN-PJ081',panels:[['political','POLITICAL'],['economic','ECONOMIC'],['social','SOCIAL'],['technological','TECHNOLOGICAL'],['legal','LEGAL'],['environmental','ENVIRONMENTAL']]},'canvas.porter5@1':{code:'DDN-PJ081',panels:[['entrants','THREAT OF NEW ENTRANTS'],['supplier','SUPPLIER POWER'],['rivalry','COMPETITIVE RIVALRY'],['buyer','BUYER POWER'],['substitutes','THREAT OF SUBSTITUTES']]},'canvas.empathy@1':{code:'DDN-PJ083',panels:[['says','SAYS'],['thinks','THINKS'],['persona','PERSONA'],['does','DOES'],['feels','FEELS']]},'canvas.scorecard@1':{code:'DDN-PJ083',panels:[['financial','FINANCIAL'],['customer','CUSTOMER'],['internal','INTERNAL PROCESS'],['learning','LEARNING & GROWTH']]}};
  const need=CANVAS[p.profile];if(need)for(const [id,title]of need.panels)if(!p.panels.some(v=>v.id===id))fail(need.code,p.profile+' requires panel "'+id+'" ('+title+'); declare all required blocks');
  let journeyPhases;
  if(p.profile==='panels.journey@1'){
   if(p.columns<2||p.columns>8)fail('DDN-PJ085','panels.journey@1 needs 2..8 phase columns; got '+p.columns);
   const slug=/^[a-z][a-z0-9-]*$/,byId=new Map(panels.map(v=>[v.id,v])),lanes=['actions','touchpoints','opportunities'];
   const phases=[];
   for(let c=0;c<p.columns;c++){
    const v=panels.find(v=>v.row===0&&v.column===c),ok=v&&v.rowspan===1&&v.colspan===1&&/^phase-/.test(v.id)&&slug.test(v.id.slice(6));
    if(!ok)fail('DDN-PJ085','panels.journey@1 row 0 must declare the phase panels (phase-<slug>) in column order; missing phase slug at column '+c);
    const s=v.id.slice(6);if(phases.includes(s))fail('DDN-PJ085','panels.journey@1 phase slugs must be unique; duplicate "'+s+'"');
    phases.push(s);
   }
   if(panels.filter(v=>v.row===0).length!==p.columns)fail('DDN-PJ085','panels.journey@1 row 0 must declare exactly the '+p.columns+' phase panels (phase-<slug>) in column order');
   for(let l=0;l<3;l++)for(let c=0;c<p.columns;c++){
    const id=lanes[l]+'-'+phases[c],v=byId.get(id);
    if(!v||v.row!==l+1||v.column!==c||v.rowspan!==1||v.colspan!==1)fail('DDN-PJ085','panels.journey@1 lane "'+lanes[l]+'" must declare panel "'+id+'" at row '+(l+1)+', column '+c+'; one panel per phase per lane');
   }
   const em=byId.get('emotions');
   if(!em||em.row!==4||em.column!==0||em.rowspan!==1||em.colspan!==p.columns)fail('DDN-PJ085','panels.journey@1 row 4 must be the single full-width panel "emotions" (row:4, column:0, colspan:'+p.columns+')');
   const expected=new Set([...phases.map(s=>'phase-'+s),...lanes.flatMap(l=>phases.map(s=>l+'-'+s)),'emotions']);
   for(const v of panels)if(!expected.has(v.id))fail('DDN-PJ085','panels.journey@1 has unexpected panel "'+v.id+'"; the grid is phase headers, actions/touchpoints/opportunities lanes, and one emotions band');
   let last=-1;const points=[];
   for(const it of em.items){const n=it.node,xr=n.properties.x_record||{};
    if(typeof xr.phase!=='string'||!phases.includes(xr.phase))fail('DDN-PJ085','emotion item '+n.name+' references unknown phase "'+xr.phase+'"',n);
    if(typeof xr.value!=='number'||!Number.isFinite(xr.value)||xr.value<1||xr.value>5)fail('DDN-PJ084','emotion item '+n.name+' needs x_record.value in 1..5; got '+xr.value,n);
    const col=phases.indexOf(xr.phase);if(col<last)fail('DDN-PJ085','emotion items must follow the declared phase order; '+n.name+' (phase '+xr.phase+') follows a later phase',n);
    last=col;points.push({col,value:xr.value,nodeId:n.id});}
   em.emotionPoints=points;journeyPhases=phases;
  }
  if(p.profile==='panels.pyramid@1'){
   const n=p.panels.length;
   if(n<3||n>5)fail('DDN-PJ089','panels.pyramid@1 needs 3..5 bands; '+n+' declared');
   if(p.columns!==1||panels.some(b=>b.column!==0||b.colspan!==1||b.rowspan!==1))fail('DDN-PJ089','pyramid bands stack in one column (columns:1, column:0, rowspan:1, colspan:1)');
   const rows=panels.map(b=>b.row).sort((a,b)=>a-b);
   if(rows.some((r,i)=>r!==i))fail('DDN-PJ089','pyramid band rows must be contiguous 0..'+(n-1)+' from top to bottom');
  }
  let venn;
  if(p.profile==='panels.venn@1'){
   const sets=panels.map(v=>v.id);
   if(sets.length<2||sets.length>3)fail('DDN-PJ090','panels.venn@1 draws exactly 2 or 3 sets; '+sets.length+' declared');
   const membership=new Map();
   for(const v of panels)for(const i of v.items){
    const n=i.node,xs=get(n,'x_sets');
    if(!Array.isArray(xs)||xs.length<1||xs.length>3||new Set(xs).size!==xs.length||xs.some(x=>typeof x!=='string'||!x.length||!sets.includes(x)))fail('DDN-PJ091','venn membership of '+n.name+' disagrees with its x_sets declaration (x_sets must be an array of 1..3 unique declared set ids)',n);
    if(!membership.has(n.id))membership.set(n.id,{node:n,xs,listed:new Set()});
    membership.get(n.id).listed.add(v.id);
   }
   for(const {node,xs,listed} of membership.values())if(listed.size!==xs.length||!xs.every(x=>listed.has(x)))fail('DDN-PJ091','venn membership of '+node.name+' disagrees with its x_sets declaration',node);
   const keys=[];const combs=(k,start,cur)=>{if(cur.length===k){keys.push([...cur].sort().join('+'));return;}for(let j=start;j<sets.length;j++)combs(k,j+1,[...cur,sets[j]]);};
   for(let k=1;k<=sets.length;k++)combs(k,0,[]);
   const regions={};for(const key of keys)regions[key]={count:0,ids:[]};
   for(const [id,{xs}] of membership){const key=[...xs].sort().join('+');regions[key].count++;regions[key].ids.push(id);}
   venn={sets:panels.map(v=>({id:v.id,title:v.title})),regions};
  }
  return{kind,profile:p.profile,columns:p.columns,panels,...(journeyPhases?{phases:journeyPhases}:{}),...(venn?{venn}:{}),sourceIds:panels.flatMap(p=>p.child?[...p.child.elements,...p.child.relations].map(n=>n.id):p.items.map(i=>i.node.id))};
 }
 if(kind==='chart'){
  const DIST1D=['histogram','density','qq','quantiledot'],DIST2D=['dotplot','boxplot','violin','beeswarm'],TREEMARKS=['tidytree','radialtree','circlepack','sunburst','packedbubble'],GRIDMARKS=['heatmap','densityheatmap','calendar','parallelcoords','wordcloud'],NETMARKS=['arc','force','edgebundle'];
  if(!['bar','line','area','point','pie','donut','radar','funnel','gauge','candlestick','treemap','sankey',...DIST1D,...DIST2D,'topk',...TREEMARKS,...GRIDMARKS,...NETMARKS].includes(p.mark))fail('DDN-PJ030','Supported marks: bar, line, area, point, pie, donut, radar, funnel, gauge, candlestick, treemap, sankey, histogram, density, qq, quantiledot, dotplot, boxplot, violin, beeswarm, topk, tidytree, radialtree, circlepack, sunburst, packedbubble, heatmap, densityheatmap, calendar, parallelcoords, wordcloud, arc, force, edgebundle');
  if(p.mark==='radar'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Radar spokes require categorical x (x_type must be category)');
  if(p.mark==='funnel'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Funnel stages require categorical x (x_type must be category)');
  if(p.mark==='funnel'&&p.series!==undefined)fail('DDN-PJ030','Funnel shows one stage per record; do not set series');
  if(p.mark==='gauge'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Gauge caption requires categorical x (x_type must be category)');
  if(p.mark==='gauge'&&p.series!==undefined)fail('DDN-PJ030','Gauge shows one value; do not set series');
  if(p.mark==='candlestick'&&(p.x_type||'category')==='number')fail('DDN-PJ030','Candlestick requires categorical or date x (x_type must not be number)');
  if(p.mark==='candlestick'&&p.series!==undefined)fail('DDN-PJ030','Candlestick shows one candle per record; do not set series');
  if(p.mark==='treemap'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Treemap paths require categorical x (x_type must be category)');
  if(p.mark==='treemap'&&p.series!==undefined)fail('DDN-PJ030','Treemap tiles encode one value per record; do not set series');
  if(p.mark==='treemap'&&p.aggregate!==undefined&&p.aggregate!=='none')fail('DDN-PJ031','Treemap tiles encode supplied values; aggregation is not available');
  if(TREEMARKS.includes(p.mark)){
   if((p.x_type||'category')!=='category')fail('DDN-PJ030',p.mark+' paths require categorical x (x_type must be category)');
   if(p.series!==undefined)fail('DDN-PJ030',p.mark+' encodes one value per record; do not set series');
   if(p.aggregate!==undefined&&p.aggregate!=='none')fail('DDN-PJ031',p.mark+' leaves encode supplied values; aggregation is not available');
  }
  if(p.mark==='sankey'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Sankey sources require categorical x (x_type must be category)');
  if(p.mark==='sankey'&&p.series!==undefined)fail('DDN-PJ030','Sankey encodes flows between endpoints; do not set series');
  if(p.mark==='sankey'&&p.aggregate!==undefined&&p.aggregate!=='none')fail('DDN-PJ031','Sankey flows encode supplied values; aggregation is not available');
  if(p.mark==='sankey'&&typeof p.target!=='string')fail('DDN-PJ030','Sankey target is a property binding, not a numeric reference');
  if(DIST1D.includes(p.mark)){
   if((p.x_type||'category')!=='number')fail('DDN-PJ030',p.mark+' measures one numeric sample; set x_type:number with x as the measurement binding');
   if(p.y!==undefined)fail('DDN-PJ134',p.mark+' binds only the numeric measurement x; do not set y');
   if(p.series!==undefined)fail('DDN-PJ134',p.mark+' pools one sample; do not set series');
   if(p.bin_count!==undefined&&p.mark!=='histogram')fail('DDN-PJ131','bin_count is a histogram setting');
  }
  if(DIST2D.includes(p.mark)||p.mark==='topk'){
   if((p.x_type||'category')!=='category')fail('DDN-PJ030',p.mark+' groups require categorical x (x_type must be category)');
   if(p.series!==undefined)fail('DDN-PJ134',p.mark+' draws one distribution per category; do not set series');
  }
  if(p.mark==='histogram'&&p.bin_count!==undefined&&(!Number.isInteger(p.bin_count)||p.bin_count<2||p.bin_count>100))fail('DDN-PJ131','Histogram bin_count is an integer 2..100');
  if(p.mark==='topk'){
   if(p.k!==undefined&&(!Number.isInteger(p.k)||p.k<1||p.k>100))fail('DDN-PJ133','Top-K k is an integer 1..100');
   if(p.others!==undefined&&typeof p.others!=='boolean')fail('DDN-PJ133','Top-K others is true or false');
  }
  if(p.mark==='heatmap'){
   if((p.x_type||'category')!=='category')fail('DDN-PJ030','Heatmap columns require categorical x');
   if(typeof p.series!=='string')fail('DDN-PJ137','Heatmap rows require a series binding (category text)');
  }
  if(p.mark==='densityheatmap'){
   if((p.x_type||'category')!=='number')fail('DDN-PJ030','Density heatmap bins two numeric fields; set x_type:number');
   if(p.series!==undefined)fail('DDN-PJ030','Density heatmap pools one scatter; do not set series');
   if(p.bin_count!==undefined&&(!Number.isInteger(p.bin_count)||p.bin_count<2||p.bin_count>60))fail('DDN-PJ131','Density heatmap bin_count is an integer 2..60');
  }
  if(p.mark==='calendar'){
   if((p.x_type||'category')!=='date')fail('DDN-PJ030','Calendar cells require date x (x_type must be date)');
   if(p.series!==undefined)fail('DDN-PJ030','Calendar shows one value per day; do not set series');
  }
  if(p.mark==='parallelcoords'){
   if((p.x_type||'category')!=='category')fail('DDN-PJ030','Parallel-coordinates axes are categorical x values');
   if(typeof p.series!=='string')fail('DDN-PJ137','Parallel coordinates require a series binding identifying each polyline');
  }
  if(p.mark==='wordcloud'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Word cloud words are categorical x values');
  if(p.mark==='wordcloud'&&p.series!==undefined)fail('DDN-PJ030','Word cloud sizes one word per record; do not set series');
  if(NETMARKS.includes(p.mark)){
   if((p.x_type||'category')!=='category')fail('DDN-PJ030',p.mark+' endpoints require categorical x');
   if(p.series!==undefined)fail('DDN-PJ030',p.mark+' encodes links between endpoints; do not set series');
   if(typeof p.target!=='string')fail('DDN-PJ030',p.mark+' target is a property binding, not a numeric reference');
   if(p.aggregate!==undefined&&p.aggregate!=='none')fail('DDN-PJ031',p.mark+' links encode supplied values; aggregation is not available');
  }
  if(p.error!==undefined){
   if(!['bar','point'].includes(p.mark))fail('DDN-PJ141','Error bars overlay bar/point marks only');
   if(typeof p.error!=='string')fail('DDN-PJ141','error is a property binding');
   if(p.aggregate!==undefined&&p.aggregate!=='none')fail('DDN-PJ141','Error bars attach to raw records; aggregation is not available');
  }
  if(p.trend!==undefined){
   if(!['point','line'].includes(p.mark)||(p.x_type||'category')!=='number')fail('DDN-PJ142','Trend overlays need a point/line mark with x_type:number');
   if(!['linear','loess'].includes(p.trend))fail('DDN-PJ142','trend is linear or loess');
  }
  if(!['category','number','date'].includes(p.x_type||'category'))fail('DDN-PJ030','x_type is category, number or date');
  if(typeof p.x!=='string'||(p.mark==='candlestick'?[p.open,p.high,p.low,p.close].some(v=>typeof v!=='string'):DIST1D.includes(p.mark)?false:typeof p.y!=='string'))fail('DDN-PJ030','Chart needs explicit x and y bindings');
  if(p.aggregate!==undefined&&!['none','sum','count','min','max','mean'].includes(p.aggregate))fail('DDN-PJ031','Unknown aggregate');
  if(p.aggregate==='count'&&p.unit)fail('DDN-PJ034','Count is dimensionless; do not label it as currency or another input unit');
  if(p.aggregate&&p.aggregate!=='none'&&!['bar','pie','donut','topk'].includes(p.mark))fail('DDN-PJ031','Aggregation is available on category bars/arcs only');
  if(DIST1D.includes(p.mark)&&p.aggregate!==undefined&&p.aggregate!=='none')fail('DDN-PJ031','Distribution marks measure raw records; aggregation is not available');
  if(p.missing!==undefined&&!['error','skip'].includes(p.missing))fail('DDN-PJ019','Chart missing policy is error or skip');
  if(p.inner_radius!==undefined&&(!Number.isFinite(p.inner_radius)||p.inner_radius<0||p.inner_radius>=.9))fail('DDN-PJ030','inner_radius is a radius fraction 0..0.9 exclusive');
  const chartRecords=filtered();
  if(!chartRecords.length){
   // D5 empty state: an intentionally empty records declaration renders an empty plot
   // with axes (UNKNOWN-not-zero; no marks are fabricated) for cartesian marks only.
   if(!['bar','line','area','point'].includes(p.mark))fail('DDN-PJ009','An intentionally empty records declaration is supported for bar/line/area/point charts and tables only; '+p.mark+' needs 1..500 explicit references');
   if(p.mark==='point'&&(p.x_type||'category')!=='number')fail('DDN-PJ030','Scatter/bubble requires x_type:number');
   return{kind,profile:p.profile,mark:p.mark,points:[],skipped:[],empty:true,sourceIds:[],xType:p.x_type||'category',unit:p.unit||'',quantitative:true};
  }
  let points=[],skipped=[];for(const n of chartRecords){
   let x=get(n,p.x),y=DIST1D.includes(p.mark)?1:(p.mark==='candlestick'?undefined:get(n,p.y)),ohlc=null;
   if(p.mark==='candlestick'){const o=get(n,p.open),h=get(n,p.high),l=get(n,p.low),c=get(n,p.close);ohlc={o,h,l,c};y=c;}
   if((x===undefined||x===null||y===undefined||y===null)&&p.missing==='skip'){skipped.push(n.id);continue;}
   if(p.mark==='candlestick'){
    if(![ohlc.o,ohlc.h,ohlc.l,ohlc.c].every(v=>typeof v==='number'&&Number.isFinite(v)))fail('DDN-PJ076','Candlestick requires finite numeric open/high/low/close on every record',n);
    if(ohlc.h<ohlc.l||ohlc.o<ohlc.l||ohlc.o>ohlc.h||ohlc.c<ohlc.l||ohlc.c>ohlc.h)fail('DDN-PJ077','Candlestick requires high >= low and open/close within [low, high]',n);
   }else if(typeof y!=='number'||!Number.isFinite(y))fail('DDN-PJ032','Chart y must be finite numeric data; numeric strings are not coerced',n);
   const type=p.x_type||'category',rawX=x;if(type==='number'){if(typeof x!=='number'||!Number.isFinite(x))fail('DDN-PJ032','Numeric x required',n);}else if(type==='date'){x=date(x);if(!Number.isFinite(x))fail('DDN-PJ033','Date x must be a real ISO YYYY-MM-DD date',n);}else if(typeof x!=='string'&&typeof x!=='number')fail('DDN-PJ032','Category x must be text or number',n);
   if(p.unit&&n.properties.x_record?.unit!==p.unit)fail('DDN-PJ034','Every record must declare matching x_record.unit: '+p.unit,n);
   const size=p.size?get(n,p.size):1;if(typeof size!=='number'||!Number.isFinite(size)||size<0)fail('DDN-PJ035','Point size must be a finite nonnegative value',n);
   const err=p.error?get(n,p.error):undefined;if(p.error&&(typeof err!=='number'||!Number.isFinite(err)||err<0))fail('DDN-PJ141','Error bar values must be finite nonnegative numbers (UNKNOWN is refused, never drawn as zero)',n);
   if(p.mark==='sankey'||NETMARKS.includes(p.mark)){
    const tv=get(n,p.target);
    if(typeof x!=='string'||!x.trim()||typeof tv!=='string'||!tv.trim()||x===tv)fail('DDN-PJ032',(p.mark==='sankey'?'Sankey':'Network')+' endpoints are distinct nonempty category text',n);
    if(y<=0)fail('DDN-PJ108','Network link values must be positive finite numbers');
    points.push({x,y,rawX,target:tv,size:1,sourceIds:[n.id]});continue;
   }
   if(p.mark==='radar'){const ser=p.series===undefined?'Value':get(n,p.series);if(typeof ser!=='string'||!ser.trim()||ser.length>80)fail('DDN-PJ030','Radar series must be a nonempty text key of at most 80 characters',n);points.push({x,y,rawX,size,series:ser,sourceIds:[n.id]});}else if(p.mark==='candlestick')points.push({x,rawX,y,open:ohlc.o,high:ohlc.h,low:ohlc.l,close:ohlc.c,size:1,sourceIds:[n.id]});else if(p.mark==='heatmap'||p.mark==='parallelcoords'){const ser=get(n,p.series);if(typeof ser!=='string'||!ser.trim()||ser.length>80)fail('DDN-PJ137',(p.mark==='heatmap'?'Heatmap row':'Polyline')+' series must be a nonempty text key of at most 80 characters',n);points.push({x,y,rawX,size,series:ser,sourceIds:[n.id]});}else points.push({x,y,rawX,size,...(p.error?{error:err}:{}),sourceIds:[n.id]});
  }
  if(!points.length)fail('DDN-PJ012','No chart points remain');
  if(p.mark==='treemap'&&points.some(pt=>pt.y<0))fail('DDN-PJ078','Treemap tile values must be nonnegative numbers; filter out or explicitly skip negative records');
  if(TREEMARKS.includes(p.mark)&&points.some(pt=>pt.y<0))fail('DDN-PJ136',p.mark+' hierarchy values must be nonnegative numbers; filter out or explicitly skip negative records');
  if(p.mark==='gauge'&&points.length!==1)fail('DDN-PJ074','Gauge requires exactly one record after filtering (the KPI); supply one record or filter to one');
  if(p.mark==='gauge'){if(points[0].y<0||points[0].y>100)fail('DDN-PJ075','Gauge value must be a finite number in 0..100');if(p.target!==undefined&&(typeof p.target!=='number'||!Number.isFinite(p.target)||p.target<0||p.target>100))fail('DDN-PJ075','Gauge target must be a finite number in 0..100');}
  let funnelCategories;
  if(p.mark==='funnel'){
   if(points.length<2)fail('DDN-PJ073','Funnel needs at least 2 distinct stages (categories); supply more records or use another mark');
   if(points.some(pt=>pt.y<0))fail('DDN-PJ107','Funnel stage values must be nonnegative numbers; filter out or explicitly skip negative records');
   funnelCategories=[];for(const pt of points)if(!funnelCategories.some(v=>JSON.stringify(v)===JSON.stringify(pt.rawX)))funnelCategories.push(pt.rawX);
  }
  if(p.mark==='point'&&(p.x_type||'category')!=='number')fail('DDN-PJ030','Scatter/bubble requires x_type:number');
  if(['pie','donut','bar','radar','funnel'].includes(p.mark)&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Bars, arcs, radar spokes and funnel stages currently require categorical x');
  const groups=new Map();if(!['point','radar','sankey',...DIST1D,...DIST2D,...GRIDMARKS,...NETMARKS].includes(p.mark))for(const point of points){const key=JSON.stringify(point.x);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(point);}
  if([...groups.values()].some(a=>a.length>1)){
   if(!p.aggregate||p.aggregate==='none')fail('DDN-PJ036','Duplicate x/category: supply an explicit aggregate or distinct coordinates');
   points=[...groups.values()].map(v=>({x:v[0].x,rawX:v[0].rawX,size:1,y:p.aggregate==='count'?v.length:p.aggregate==='sum'?v.reduce((s,p)=>s+p.y,0):p.aggregate==='mean'?v.reduce((s,p)=>s+p.y,0)/v.length:p.aggregate==='min'?Math.min(...v.map(p=>p.y)):Math.max(...v.map(p=>p.y)),sourceIds:v.flatMap(p=>p.sourceIds)}));
  }else if(p.aggregate==='count')points=points.map(p=>({...p,y:1}));
  if(points.some(p=>!Number.isFinite(p.y)))fail('DDN-PJ032','Aggregate overflow');
  let treemapTiles,hierTree;
  if(p.mark==='treemap'||TREEMARKS.includes(p.mark)){
   const roots=hierarchy(points,fail,p.mark);treemapTiles=p.mark==='treemap'?roots:undefined;if(TREEMARKS.includes(p.mark))hierTree={roots,maxDepth:Math.max(...roots.map(n=>depth(n)))};
  }
  let sankeyFlow;
  if(p.mark==='sankey'){
   const names=[],ix=new Map(),links=[];
   for(const pt of points){
    for(const nm of [String(pt.rawX),pt.target])if(!ix.has(nm)){ix.set(nm,names.length);names.push(nm);}
    links.push({source:ix.get(String(pt.rawX)),target:ix.get(pt.target),value:pt.y,sourceIds:pt.sourceIds});
   }
   const depth=new Array(names.length).fill(-1);
   for(let i=0;i<names.length;i++)if(!links.some(l=>l.target===i))depth[i]=0;
   let moved=true;
   for(let pass=0;moved&&pass<=names.length;pass++){moved=false;for(const l of links)if(depth[l.source]>=0&&depth[l.target]<depth[l.source]+1){depth[l.target]=depth[l.source]+1;moved=true;}}
   if(moved||depth.some(d=>d<0))fail('DDN-PJ079','Sankey flow graph contains a cycle');
   sankeyFlow={nodes:names.map((name,i)=>({name,depth:depth[i],sourceIds:[...new Set(links.filter(l=>l.source===i||l.target===i).flatMap(l=>l.sourceIds))]})),links};
  }
  let dist=null,topkInfo=null;
  if(DIST1D.includes(p.mark)){
   const vals=points.map(pt=>pt.x).sort((a,b)=>a-b),n=vals.length,min=vals[0],max=vals[n-1];
   if(n<2)fail('DDN-PJ135',p.mark+' needs at least 2 finite observations; got '+n);
   const mean=vals.reduce((a,b)=>a+b,0)/n,sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/n);
   if(p.mark==='histogram'){
    const m=p.bin_count??Math.min(40,Math.max(5,Math.ceil(Math.sqrt(n)))),span=max-min||1;
    const bins=Array.from({length:m},(_,i)=>({x0:min+span*i/m,x1:min+span*(i+1)/m,count:0,sourceIds:[]}));
    for(const pt of points){const i=Math.min(m-1,Math.max(0,Math.floor((pt.x-min)/span*m)));bins[i].count++;bins[i].sourceIds.push(...pt.sourceIds);}
    dist={kind:'histogram',bins,count:n,min,max};
   }else if(p.mark==='density'){
    if(sd===0)fail('DDN-PJ132','Density of a zero-variance sample is UNKNOWN; the kernel bandwidth is undefined');
    const h=1.06*sd*Math.pow(n,-0.2),pad=3*h,g=80,c=1/(n*h*Math.sqrt(2*Math.PI));
    const curve=Array.from({length:g+1},(_,i)=>{const x=min-pad+(max-min+2*pad)*i/g;return[x,points.reduce((s,pt)=>s+Math.exp(-0.5*((x-pt.x)/h)**2),0)*c];});
    dist={kind:'density',curve,bandwidth:h,count:n,min,max};
   }else if(p.mark==='qq'){
    if(sd===0)fail('DDN-PJ132','Q-Q spread of a zero-variance sample is UNKNOWN; the normal reference is undefined');
    const sorted=points.slice().sort((a,b)=>a.x-b.x),obs=sorted.map((pt,i)=>({t:normPPF((i+0.5)/n),v:pt.x,sourceIds:pt.sourceIds}));
    dist={kind:'qq',observations:obs,line:{t1:normPPF(.25),v1:quantile(vals,.25),t3:normPPF(.75),v3:quantile(vals,.75)},count:n};
   }else{
    const Q=Math.min(n,20),dots=[];
    for(let i=0;i<Q;i++){const v=quantile(vals,(i+0.5)/Q);dots.push({value:v,sourceIds:points.filter(pt=>pt.x===v).flatMap(pt=>pt.sourceIds)});}
    dist={kind:'quantiledot',dots,quantiles:Q,count:n,min:vals[0],max:vals[n-1]};
   }
  }
  if(p.mark==='boxplot'||p.mark==='violin'){
   const cats=[],byCat=new Map();
   for(const pt of points){const k=JSON.stringify(pt.rawX);if(!byCat.has(k)){byCat.set(k,[]);cats.push(pt.rawX);}byCat.get(k).push(pt);}
   if(cats.length>40)fail('DDN-PJ135',p.mark+' draws at most 40 categories; got '+cats.length);
   const groupsOut=cats.map(cat=>{
    const a=byCat.get(JSON.stringify(cat)),vals=a.map(pt=>pt.y).sort((x,y)=>x-y),n=vals.length;
    if(p.mark==='boxplot'){
     const q1=quantile(vals,.25),median=quantile(vals,.5),q3=quantile(vals,.75),iqr=q3-q1,lower=q1-1.5*iqr,upper=q3+1.5*iqr;
     const inside=vals.filter(v=>v>=lower&&v<=upper),outliers=a.filter(pt=>pt.y<lower||pt.y>upper);
     return{cat,q1,median,q3,low:inside[0],high:inside[inside.length-1],outliers:outliers.map(pt=>({y:pt.y,sourceIds:pt.sourceIds})),count:n,sourceIds:a.flatMap(pt=>pt.sourceIds)};
    }
    const mean=vals.reduce((x,y)=>x+y,0)/n,sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/n);
    if(n<2||sd===0)fail('DDN-PJ132','Violin density of '+JSON.stringify(cat)+' is UNKNOWN: a kernel needs at least 2 non-identical observations per category');
    const h=1.06*sd*Math.pow(n,-0.2),pad=3*h,g=60,c=1/(n*h*Math.sqrt(2*Math.PI)),min=vals[0],max=vals[n-1];
    const curve=Array.from({length:g+1},(_,i)=>{const x=min-pad+(max-min+2*pad)*i/g;return[x,a.reduce((s,pt)=>s+Math.exp(-0.5*((x-pt.y)/h)**2),0)*c];});
    return{cat,curve,bandwidth:h,q1:quantile(vals,.25),median:quantile(vals,.5),q3:quantile(vals,.75),count:n,sourceIds:a.flatMap(pt=>pt.sourceIds)};
   });
   dist={kind:p.mark,groups:groupsOut};
  }
  if(p.mark==='topk'){
   const k=p.k??10,ranked=points.map((pt,i)=>({pt,i})).sort((a,b)=>(b.pt.y-a.pt.y)||(String(a.pt.rawX)<String(b.pt.rawX)?-1:String(a.pt.rawX)>String(b.pt.rawX)?1:a.i-b.i)).map(o=>o.pt);
   const top=ranked.slice(0,k),rest=ranked.slice(k),withOthers=p.others??true;
   let othersPoint=null;
   if(rest.length&&withOthers)othersPoint={x:'Others',rawX:'Others',y:rest.reduce((s,pt)=>s+pt.y,0),size:1,sourceIds:rest.flatMap(pt=>pt.sourceIds),others:true};
   topkInfo={kept:top.length,total:ranked.length,merged:withOthers?rest.length:0,dropped:withOthers?0:rest.length,droppedIds:withOthers?[]:rest.flatMap(pt=>pt.sourceIds)};
   points=othersPoint?[...top,othersPoint]:top;
  }
  let grid=null;
  if(p.mark==='heatmap'){
   const xs=[],rows=[];
   for(const pt of points){const k=JSON.stringify(pt.rawX);if(!xs.some(v=>JSON.stringify(v)===k))xs.push(pt.rawX);if(!rows.includes(pt.series))rows.push(pt.series);}
   if(xs.length>60||rows.length>60)fail('DDN-PJ135','Heatmap draws at most 60 columns and 60 rows');
   const seen=new Set(),cells=[];
   for(const pt of points){const key=JSON.stringify(pt.rawX)+' '+pt.series;
    if(seen.has(key))fail('DDN-PJ137','Heatmap has more than one value for column '+JSON.stringify(pt.rawX)+', row "'+pt.series+'"; aggregate upstream or filter');seen.add(key);
    cells.push({col:xs.findIndex(v=>JSON.stringify(v)===JSON.stringify(pt.rawX)),row:rows.indexOf(pt.series),value:pt.y,sourceIds:pt.sourceIds});}
   grid={kind:'heatmap',xs,rows,cells,min:Math.min(...points.map(pt=>pt.y)),max:Math.max(...points.map(pt=>pt.y))};
  }
  if(p.mark==='densityheatmap'){
   const b=p.bin_count??20,xs=points.map(pt=>pt.x),ys=points.map(pt=>pt.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
   if(x0===x1||y0===y1)fail('DDN-PJ132','Density heatmap of a zero-range field is UNKNOWN; both axes need spread');
   const cells=Array.from({length:b*b},()=>({count:0,sourceIds:[]}));
   for(const pt of points){const i=Math.min(b-1,Math.floor((pt.x-x0)/(x1-x0)*b)),j=Math.min(b-1,Math.floor((pt.y-y0)/(y1-y0)*b)),c=cells[j*b+i];c.count++;c.sourceIds.push(...pt.sourceIds);}
   grid={kind:'densityheatmap',b,x0,x1,y0,y1,cells,max:Math.max(...cells.map(c=>c.count))};
  }
  if(p.mark==='calendar'){
   const seen=new Set(),days=[],dow=a=>(new Date(a).getUTCDay()+6)%7;
   for(const pt of points){const d=new Date(pt.x).toISOString().slice(0,10);
    if(seen.has(d))fail('DDN-PJ137','Calendar has more than one value for day '+d+'; aggregate upstream or filter');seen.add(d);
    days.push({date:d,at:pt.x,value:pt.y,sourceIds:pt.sourceIds});}
   days.sort((a,b)=>a.at-b.at);
   const monday0=days[0].at-dow(days[0].at)*86400000;
   for(const d of days){d.week=Math.floor((d.at-monday0)/604800000);d.weekday=dow(d.at);}
   grid={kind:'calendar',days,weeks:Math.max(...days.map(d=>d.week))+1,min:Math.min(...days.map(d=>d.value)),max:Math.max(...days.map(d=>d.value))};
  }
  if(p.mark==='parallelcoords'){
   const axes=[],series=[];
   for(const pt of points){const k=JSON.stringify(pt.rawX);if(!axes.some(v=>JSON.stringify(v)===k))axes.push(pt.rawX);if(!series.includes(pt.series))series.push(pt.series);}
   if(axes.length<2)fail('DDN-PJ135','Parallel coordinates need at least 2 axes (distinct x categories); got '+axes.length);
   if(axes.length>24)fail('DDN-PJ135','Parallel coordinates draw at most 24 axes');
   const seen=new Set();
   for(const pt of points){const key=pt.series+' '+JSON.stringify(pt.rawX);if(seen.has(key))fail('DDN-PJ137','Parallel coordinates has more than one value for series "'+pt.series+'" on axis '+JSON.stringify(pt.rawX));seen.add(key);}
   const stats=axes.map(a=>{const vs=points.filter(pt=>JSON.stringify(pt.rawX)===JSON.stringify(a)).map(pt=>pt.y);return{min:Math.min(...vs),max:Math.max(...vs)};});
   const constantAxes=axes.filter((a,i)=>stats[i].min===stats[i].max);
   const lines=series.map(sr=>({series:sr,points:axes.map((a,i)=>{const pt=points.find(q=>q.series===sr&&JSON.stringify(q.rawX)===JSON.stringify(a));
    if(!pt)return{axis:a,norm:null,sourceIds:[]};const st=stats[i];
    return{axis:a,value:pt.y,norm:st.max===st.min?null:(pt.y-st.min)/(st.max-st.min),sourceIds:pt.sourceIds};}),sourceIds:[...new Set(points.filter(q=>q.series===sr).flatMap(q=>q.sourceIds))]}));
   grid={kind:'parallelcoords',axes,lines,stats,constantAxes,missing:lines.some(l=>l.points.some(pt=>pt.norm===null&&!constantAxes.includes(pt.axis)))};
  }
  if(p.mark==='wordcloud'){
   const seen=new Set(),words=[];
   for(const pt of points){const w=String(pt.rawX);
    if(seen.has(w))fail('DDN-PJ137','Word cloud has a duplicate word '+JSON.stringify(w)+'; supply distinct words');seen.add(w);
    if(pt.y<=0)fail('DDN-PJ138','Word cloud weights must be positive finite numbers');
    words.push({text:w,weight:pt.y,sourceIds:pt.sourceIds});}
   if(words.length>120)fail('DDN-PJ135','Word cloud places at most 120 words');
   grid={kind:'wordcloud',words,max:Math.max(...words.map(w=>w.weight))};
  }
  let net=null;
  if(p.mark==='arc'||p.mark==='force'){
   const names=[],ix=new Map(),links=[];
   for(const pt of points){
    for(const nm of [String(pt.rawX),pt.target])if(!ix.has(nm)){ix.set(nm,names.length);names.push(nm);}
    links.push({source:ix.get(String(pt.rawX)),target:ix.get(pt.target),value:pt.y,sourceIds:pt.sourceIds});
   }
   if(names.length>200)fail('DDN-PJ135',p.mark+' draws at most 200 nodes; got '+names.length);
   if(links.length>1000)fail('DDN-PJ135',p.mark+' draws at most 1000 links; got '+links.length);
   const weight=names.map((_,i)=>links.filter(l=>l.source===i||l.target===i).reduce((s,l)=>s+l.value,0));
   net={kind:p.mark,nodes:names.map((name,i)=>({name,weight:weight[i],sourceIds:[...new Set(links.filter(l=>l.source===i||l.target===i).flatMap(l=>l.sourceIds))]})),links,positions:p.mark==='force'?forceLayout(names.length,links,0xB1024):null};
  }
  if(p.mark==='edgebundle'){
   if(points.length>500)fail('DDN-PJ135','Edge bundling draws at most 500 links; got '+points.length);
   const paths=[...new Set(points.flatMap(pt=>[String(pt.rawX),pt.target]))];
   if(paths.length>200)fail('DDN-PJ135','Edge bundling draws at most 200 endpoint paths; got '+paths.length);
   const roots=hierarchy(paths.map(p=>({rawX:p,y:0,sourceIds:[]})),fail,p.mark);
   net={kind:'edgebundle',roots,maxDepth:Math.max(...roots.map(n=>depth(n))),links:points.map(pt=>({sourcePath:String(pt.rawX),targetPath:pt.target,value:pt.y,sourceIds:pt.sourceIds}))};
  }
  let trendLine=null;
  if(p.trend){
   const xs=points.map(pt=>pt.x),ys=points.map(pt=>pt.y),n=xs.length;
   if(n<3)fail('DDN-PJ135','Trend overlays need at least 3 points; got '+n);
   if(Math.min(...xs)===Math.max(...xs))fail('DDN-PJ132','Trend of a constant-x sample is UNKNOWN; the slope is undefined');
   if(p.trend==='linear'){
    const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n,sxx=xs.reduce((s,v)=>s+(v-mx)**2,0),sxy=xs.reduce((s,v,i)=>s+(v-mx)*(ys[i]-my),0),slope=sxy/sxx;
    trendLine={kind:'linear',slope,intercept:my-slope*mx};
   }else trendLine={kind:'loess',points:loess(xs,ys,.3,50),span:.3};
  }
  if(['pie','donut'].includes(p.mark)&&(points.some(p=>p.y<0)||!Number.isFinite(points.reduce((s,p)=>s+p.y,0))||points.reduce((s,p)=>s+p.y,0)<=0))fail('DDN-PJ037','Arcs require nonnegative values and a positive total');
  if(!Number.isFinite(Math.max(0,...points.map(n=>n.y))-Math.min(0,...points.map(n=>n.y))))fail('DDN-PJ032','Quantitative axis range overflow');
  if((p.x_type==='number')&&!Number.isFinite(Math.max(...points.map(n=>n.x))-Math.min(...points.map(n=>n.x))))fail('DDN-PJ032','Quantitative x range overflow');
  if(['line','area'].includes(p.mark)&&(p.x_type||'category')!=='category')points.sort((a,b)=>a.x-b.x);
  if(p.mark==='radar'){
   const categories=[],series=[];
   for(const pt of points){if(!Number.isFinite(pt.y)||pt.y<0)fail('DDN-PJ072','Radar requires finite numeric y >= 0 per point; filter out or explicitly skip unusable records');if(!categories.some(v=>JSON.stringify(v)===JSON.stringify(pt.x)))categories.push(pt.x);if(!series.includes(pt.series))series.push(pt.series);}
   if(categories.length<3)fail('DDN-PJ071','Radar needs at least 3 distinct x categories (got '+categories.length+'); supply more records or use another mark');
   return{kind,profile:p.profile,mark:p.mark,points,skipped,categories,series,sourceIds:points.flatMap(p=>p.sourceIds),xType:p.x_type||'category',unit:p.unit||'',quantitative:true};
  }
  return{kind,profile:p.profile,mark:p.mark,points,skipped,...(dist?{dist}:{}),...(topkInfo?{topk:topkInfo}:{}),...(funnelCategories?{categories:funnelCategories}:{}),...(treemapTiles?{categories:treemapTiles.map(n=>n.path),tiles:treemapTiles}:{}),...(hierTree?{tree:hierTree}:{}),...(grid?{grid}:{}),...(net?{net}:{}),...(trendLine?{trendLine}:{}),...(sankeyFlow?{flow:sankeyFlow}:{}),...(p.mark==='gauge'?{target:p.target}:{}),sourceIds:points.flatMap(p=>p.sourceIds),xType:p.x_type||'category',unit:p.aggregate==='count'?'count':p.unit||'',quantitative:true};
 }
 if(kind==='timeline'){
  const records=filtered(),items=records.map(n=>{const start=get(n,p.start),end=get(n,p.end),a=date(start),b=date(end);if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)fail('DDN-PJ040','Timeline needs real ISO date-only start/end with end >= start',n);return{id:n.id,node:n,label:String(p.label?textValue(n,p.label):n.name),start,end,a,b};});
  const by=new Map(items.map(n=>[n.id,n])),dependencies=[];
  for(const id of p.dependencies||[]){const r=resolve(id,'relation'),a=by.get(r.from.element),b=by.get(r.to.element);if(!a||!b||!['precede','analysis.precedes'].includes(r.kind))fail('DDN-PJ041','Timeline dependencies must be selected predecessor-to-successor links',r);if(a.b>b.a)fail('DDN-PJ042','Finish-to-start dependency contradicts supplied dates',r);dependencies.push(r);}
  const seen=new Set(),active=new Set();function visit(id){if(active.has(id))fail('DDN-PJ043','Timeline dependency cycle');if(seen.has(id))return;active.add(id);dependencies.filter(r=>r.from.element===id).forEach(r=>visit(r.to.element));active.delete(id);seen.add(id);}items.forEach(x=>visit(x.id));
  return{kind,profile:p.profile,items,dependencies,sourceIds:items.map(i=>i.id).concat(dependencies.map(d=>d.id)),quantitative:true};
 }
 if(kind==='sequence'){
  const participants=orderedParticipants(ir,shown),byParticipant=new Map(participants.map(n=>[n.id,n]));
  const messages=ir.relations.filter(r=>ir.view.relations.includes(r.id)&&r.kind==='uml.message');
  for(const r of messages)for(const [label,ep]of [['source',r.from],['target',r.to]]){
   const n=byId.get(ep.element);
   if(!n||n.type!=='object'||!byParticipant.has(n.id))fail('DDN-PJ110','Sequence message '+(r.name||r.id)+' has a '+label+' endpoint that is not a selected object declaration: '+ep.element,r);
  }
  return{kind,profile:p.profile,participants,messages,sourceIds:participants.map(n=>n.id).concat(messages.map(r=>r.id))};
 }
 if(kind==='timing'){
  const participants=orderedParticipants(ir,shown).map(n=>{
   const xs=n.properties.x_states;
   if(!Array.isArray(xs)||!xs.length)fail('DDN-PJ118','Timing participant '+n.name+' must carry x_states with at least one {at,state} entry',n);
   const states=xs.map((e,i)=>{
    if(!e||typeof e!=='object'||!Number.isFinite(e.at)||typeof e.state!=='string'||!e.state.length)fail('DDN-PJ118','Timing participant '+n.name+' has a malformed x_states entry at index '+i+': at must be a finite number and state a nonempty string',n);
    if(i&&!(e.at>xs[i-1].at))fail('DDN-PJ118','Timing participant '+n.name+' x_states entry at index '+i+' (at='+e.at+') is not strictly after the previous entry (at='+xs[i-1].at+')',n);
    return{at:e.at,state:e.state};
   });
   return{node:n,states};
  });
  return{kind,profile:p.profile,participants,sourceIds:participants.map(x=>x.node.id)};
 }
}
function orderedParticipants(ir,shown){return ir.elements.filter(n=>shown.has(n.id)&&n.type==='object');}
/* Dotted-path hierarchy (shared by treemap and the B1-024 tree marks). At most 3 levels; internal values are child sums; provenance unions upward. */
function hierarchy(points,fail,mark){
 const roots=[];
 for(const pt of points){
  const segs=String(pt.rawX).split('.');if(segs.length>3||segs.some(sg=>!sg.trim()))fail('DDN-PJ030',(mark==='treemap'?'Treemap':'Hierarchy')+' paths have at most 3 levels');
  let siblings=roots,path='',parent=null;
  for(let d=0;d<segs.length-1;d++){path=path?path+'.'+segs[d]:segs[d];let g=siblings.find(n=>!n.leaf&&n.path===path);if(!g){g={name:segs[d],path,value:0,children:[],leaf:false,sourceIds:[]};siblings.push(g);}parent=g;siblings=g.children;}
  const leaf={name:segs[segs.length-1],path:path?path+'.'+segs[segs.length-1]:segs[0],value:pt.y,children:[],leaf:true,sourceIds:pt.sourceIds};
  (parent?parent.children:roots).push(leaf);
 }
 const sum=n=>{if(!n.leaf){n.value=n.children.reduce((s,c)=>s+sum(c),0);n.sourceIds=n.children.flatMap(c=>c.sourceIds);}return n.value;};
 roots.forEach(sum);return roots;
}
function depth(n){return n.leaf?1:1+Math.max(...n.children.map(depth));}
/* Fixed-seed PRNG (mulberry32) — same deterministic-seed pattern as the sketch/organic kernels. */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/* Deterministic Fruchterman–Reingold for the force mark: fixed seed, fixed 300-iteration
 * cooling schedule, O(n^2) repulsion (node cap 200). Mirrors the placement:organic kernel shape. */
function forceLayout(n,links,seed){
 const rnd=mulberry32(seed),pos=Array.from({length:n},()=>({x:rnd()*2-1,y:rnd()*2-1})),k=Math.sqrt(4/Math.max(1,n)),IT=300;
 for(let it=0;it<IT;it++){
  const t=1-it/IT,disp=pos.map(()=>({x:0,y:0}));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   let dx=pos[i].x-pos[j].x,dy=pos[i].y-pos[j].y,d=Math.hypot(dx,dy)||1e-6,force=k*k/d;
   dx/=d;dy/=d;disp[i].x+=dx*force;disp[i].y+=dy*force;disp[j].x-=dx*force;disp[j].y-=dy*force;
  }
  for(const l of links){
   let dx=pos[l.source].x-pos[l.target].x,dy=pos[l.source].y-pos[l.target].y,d=Math.hypot(dx,dy)||1e-6,force=d*d/k;
   dx/=d;dy/=d;disp[l.source].x-=dx*force;disp[l.source].y-=dy*force;disp[l.target].x+=dx*force;disp[l.target].y+=dy*force;
  }
  pos.forEach((p,i)=>{const d=Math.hypot(disp[i].x,disp[i].y)||1e-6;p.x+=disp[i].x/d*Math.min(d,.1*t);p.y+=disp[i].y/d*Math.min(d,.1*t);});
 }
 return pos;
}
/* LOESS (local weighted linear fit, tricube weights, fixed 51-point grid). Deterministic. */
function loess(xs,ys,span=0.3,grid=50){
 const n=xs.length,m=Math.max(2,Math.ceil(span*n)),x0=Math.min(...xs),x1=Math.max(...xs),out=[];
 for(let g=0;g<=grid;g++){
  const x=x0+(x1-x0)*g/grid,dists=xs.map((v,i)=>({d:Math.abs(v-x),i})).sort((a,b)=>a.d-b.d||a.i-b.i),dmax=dists[m-1].d||1;
  let sw=0,swx=0,swy=0,swxx=0,swxy=0;
  for(let j=0;j<m;j++){const{d,i}=dists[j],u=Math.min(1,d/dmax),w=(1-u**3)**3;
   sw+=w;swx+=w*xs[i];swy+=w*ys[i];swxx+=w*xs[i]*xs[i];swxy+=w*xs[i]*ys[i];}
  const det=sw*swxx-swx*swx,y=Math.abs(det)<1e-12?swy/sw:((sw*swxy-swx*swy)/det)*x+(swy*swxx-swx*swxy)/det;
  out.push([x,y]);
 }
 return out;
}
/* Sample quantile, linear interpolation (R type 7). Input must be sorted ascending. */function quantile(sorted,q){const n=sorted.length;if(!n)return NaN;const h=(n-1)*q,i=Math.floor(h),j=Math.min(n-1,i+1);return sorted[i]+(h-i)*(sorted[j]-sorted[i]);}
/* Standard normal quantile function (Acklam's rational approximation, max |err| 1.15e-9). Deterministic. */
function normPPF(p){
 const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
 const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
 const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
 const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00],pl=0.02425;
 if(p<pl){const q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
 if(p>1-pl){const q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
 const q=p-0.5,r=q*q;
 return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
const api={VERSION:'0.6.0-beta.1',get,date,plan,supported,participants:orderedParticipants,quantile,normPPF,quality:Quality};
publishNamespace('DDNProjectionData',api);
export default api;
