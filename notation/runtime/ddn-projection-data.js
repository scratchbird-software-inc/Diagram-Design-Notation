/* SPDX-License-Identifier: GPL-2.0-or-later. Bounded, typed projection plans. No expressions, external loaders or implicit joins. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ddn-quality-data'));else root.DDNProjectionData=factory(root.DDNQualityData);})(typeof globalThis!=='undefined'?globalThis:this,function(Quality){
'use strict';
const common=['kind','profile','width','height'];
const supported={graph:['kind','profile','inputs','analysis_budget','traces'],fishbone:[...common,'effect','relation'],decision:[...common,'records','inputs','outputs','hit_policy','coverage','analysis_budget','filter','order'],chen:common,matrix:[...common,'write_data','rows','columns','relation','value','duplicates','encoding'],table:[...common,'records','columns','filter','order','missing'],panels:[...common,'columns','panels','value'],chart:[...common,'records','mark','x','y','x_type','size','unit','aggregate','filter','order','missing','inner_radius','series','series_missing','arrangement','transform','layers','bins','normalize','outside','whiskers','quartiles','step','baseline','target'],timeline:[...common,'records','start','end','label','dependencies','filter','order']};
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
 for(const k of Object.keys(p))if(!supported[kind].includes(k))fail('DDN-PJ005',kind+' projection does not use '+k+'; no silent ignored settings');
 for(const k of ['width','height'])if(p[k]!==undefined){const v=typeof p[k]==='number'?p[k]:p[k]?.unit==='px'?p[k].$quantity:NaN;if(!Number.isFinite(v)||v<240||v>12000)fail('DDN-PJ006','Projection '+k+' must be 240..12000 px');}
 const resolve=(x,type='element')=>{const n=(type==='relation'?byRel:byId).get(ref(x));if(!n)fail('DDN-PJ007','Projection reference is outside its data scope: '+ref(x));if(type==='element'&&!shown.has(n.id))fail('DDN-PJ008','Projection binds an excluded/not-selected element: '+n.id);return n;};
 const list=(a,name)=>{if(!Array.isArray(a)||!a.length||a.length>500)fail('DDN-PJ009',name+' needs 1..500 explicit references');const ns=a.map(x=>resolve(x));if(new Set(ns.map(n=>n.id)).size!==ns.length)fail('DDN-PJ009','Duplicate '+name+' identity');return ns;};
 const textValue=(n,key,defaultValue)=>{const v=get(n,key);if(v===undefined&&defaultValue!==undefined)return defaultValue;if(typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')fail('DDN-PJ010',key+' must supply a scalar value',n);return v;};
 const filtered=()=>{let ns=list(p.records,'records');if(p.filter){const{key,op,value}=p.filter;if(Object.keys(p.filter).some(k=>!['key','op','value'].includes(k))||!['eq','in'].includes(op)||op==='in'&&!Array.isArray(value))fail('DDN-PJ011','Filter supports explicit eq or in only');ns=ns.filter(n=>{const v=get(n,key);return op==='eq'?v===value:value.includes(v);});}if(p.order){if(!['asc','desc'].includes(p.order.direction)||Object.keys(p.order).some(k=>!['key','direction'].includes(k)))fail('DDN-PJ011','Order needs key and asc/desc');ns=ns.map((n,i)=>({n,i,v:textValue(n,p.order.key)})).sort((a,b)=>(p.order.direction==='desc'?-1:1)*(a.v<b.v?-1:a.v>b.v?1:0)||a.i-b.i).map(o=>o.n);}if(!ns.length)fail('DDN-PJ012','Projection selection is empty after filtering');return ns;};
 if(kind==='fishbone')return Quality.fishbone(ir,ErrorClass,get);
 if(kind==='decision')return Quality.decision(ir,ErrorClass,get);
 if(kind==='chart'&&Quality.chartRequested(p)&&!['radar','funnel'].includes(p.mark))return Quality.chart(ir,ErrorClass,get);
 if(kind==='graph'&&p.profile==='state.flat@1')return{kind,profile:p.profile,lifecycle:Quality.lifecycle(ir,ErrorClass,get)};
 if(kind==='graph'&&['inputs','analysis_budget','traces'].some(k=>p[k]!==undefined))fail('DDN-Q005','Lifecycle properties require state.flat@1');
 if(kind==='graph'||kind==='chen')return{kind,profile:p.profile};
 if(kind==='matrix'){
  const rows=list(p.rows,'rows'),columns=list(p.columns,'columns');if(rows.length*columns.length>5000||columns.length>40)fail('DDN-PJ013','Matrix limit: 5,000 cells and 40 columns');
  if(typeof p.relation!=='string'||typeof p.value!=='string')fail('DDN-PJ014','Matrix needs a relation kind and a value binding');
  if(p.duplicates!==undefined&&!['error','join'].includes(p.duplicates))fail('DDN-PJ014','Unknown duplicate-cell policy');
  if(p.profile!=='matrix.relations@1'&&p.duplicates==='join')fail('DDN-PJ014','RACI/CRUD require one declared assignment per cell');
  const ri=new Map(rows.map((n,i)=>[n.id,i])),ci=new Map(columns.map((n,i)=>[n.id,i])),cells=rows.map(()=>columns.map(()=>[]));
  for(const r of ir.relations.filter(r=>r.kind===p.relation&&ri.has(r.from.element)&&ci.has(r.to.element))){const value=textValue(r,p.value);const c=cells[ri.get(r.from.element)][ci.get(r.to.element)];if(c.length&&p.duplicates!=='join')fail('DDN-PJ015','More than one assignment for the same row and column',r);c.push({id:r.id,value:String(value),raw:value});}
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
   const items=list(v.items,'panel items');return{...v,rowspan:rs,colspan:cs,items:items.map(n=>({node:n,text:p.value?String(textValue(n,p.value,'')):n.properties.description||n.properties.x_record?.description||''}))};});
  return{kind,profile:p.profile,columns:p.columns,panels,sourceIds:panels.flatMap(p=>p.child?[...p.child.elements,...p.child.relations].map(n=>n.id):p.items.map(i=>i.node.id))};
 }
 if(kind==='chart'){
  if(!['bar','line','area','point','pie','donut','radar','funnel'].includes(p.mark))fail('DDN-PJ030','Supported marks: bar, line, area, point, pie, donut, radar, funnel');
  if(p.mark==='radar'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Radar spokes require categorical x (x_type must be category)');
  if(p.mark==='funnel'&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Funnel stages require categorical x (x_type must be category)');
  if(p.mark==='funnel'&&p.series!==undefined)fail('DDN-PJ030','Funnel shows one stage per record; do not set series');
  if(!['category','number','date'].includes(p.x_type||'category'))fail('DDN-PJ030','x_type is category, number or date');
  if(typeof p.x!=='string'||typeof p.y!=='string')fail('DDN-PJ030','Chart needs explicit x and y bindings');
  if(p.aggregate!==undefined&&!['none','sum','count','min','max','mean'].includes(p.aggregate))fail('DDN-PJ031','Unknown aggregate');
  if(p.aggregate==='count'&&p.unit)fail('DDN-PJ034','Count is dimensionless; do not label it as currency or another input unit');
  if(p.aggregate&&p.aggregate!=='none'&&!['bar','pie','donut'].includes(p.mark))fail('DDN-PJ031','Aggregation is available on category bars/arcs only');
  if(p.missing!==undefined&&!['error','skip'].includes(p.missing))fail('DDN-PJ019','Chart missing policy is error or skip');
  if(p.inner_radius!==undefined&&(!Number.isFinite(p.inner_radius)||p.inner_radius<0||p.inner_radius>=.9))fail('DDN-PJ030','inner_radius is a radius fraction 0..0.9 exclusive');
  let points=[],skipped=[];for(const n of filtered()){
   let x=get(n,p.x),y=get(n,p.y);if((x===undefined||x===null||y===undefined||y===null)&&p.missing==='skip'){skipped.push(n.id);continue;}
   if(typeof y!=='number'||!Number.isFinite(y))fail('DDN-PJ032','Chart y must be finite numeric data; numeric strings are not coerced',n);
   const type=p.x_type||'category',rawX=x;if(type==='number'){if(typeof x!=='number'||!Number.isFinite(x))fail('DDN-PJ032','Numeric x required',n);}else if(type==='date'){x=date(x);if(!Number.isFinite(x))fail('DDN-PJ033','Date x must be a real ISO YYYY-MM-DD date',n);}else if(typeof x!=='string'&&typeof x!=='number')fail('DDN-PJ032','Category x must be text or number',n);
   if(p.unit&&n.properties.x_record?.unit!==p.unit)fail('DDN-PJ034','Every record must declare matching x_record.unit: '+p.unit,n);
   const size=p.size?get(n,p.size):1;if(typeof size!=='number'||!Number.isFinite(size)||size<0)fail('DDN-PJ035','Point size must be a finite nonnegative value',n);
   if(p.mark==='radar'){const ser=p.series===undefined?'Value':get(n,p.series);if(typeof ser!=='string'||!ser.trim()||ser.length>80)fail('DDN-PJ030','Radar series must be a nonempty text key of at most 80 characters',n);points.push({x,y,rawX,size,series:ser,sourceIds:[n.id]});}else points.push({x,y,rawX,size,sourceIds:[n.id]});
  }
  if(!points.length)fail('DDN-PJ012','No chart points remain');
  let funnelCategories;
  if(p.mark==='funnel'){
   if(points.length<2)fail('DDN-PJ073','Funnel needs at least 2 distinct stages (categories); supply more records or use another mark');
   if(points.some(pt=>pt.y<0))fail('DDN-PJ107','Funnel stage values must be nonnegative numbers; filter out or explicitly skip negative records');
   funnelCategories=[];for(const pt of points)if(!funnelCategories.some(v=>JSON.stringify(v)===JSON.stringify(pt.rawX)))funnelCategories.push(pt.rawX);
  }
  if(p.mark==='point'&&(p.x_type||'category')!=='number')fail('DDN-PJ030','Scatter/bubble requires x_type:number');
  if(['pie','donut','bar','radar','funnel'].includes(p.mark)&&(p.x_type||'category')!=='category')fail('DDN-PJ030','Bars, arcs, radar spokes and funnel stages currently require categorical x');
  const groups=new Map();if(!['point','radar'].includes(p.mark))for(const point of points){const key=JSON.stringify(point.x);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(point);}
  if([...groups.values()].some(a=>a.length>1)){
   if(!p.aggregate||p.aggregate==='none')fail('DDN-PJ036','Duplicate x/category: supply an explicit aggregate or distinct coordinates');
   points=[...groups.values()].map(v=>({x:v[0].x,rawX:v[0].rawX,size:1,y:p.aggregate==='count'?v.length:p.aggregate==='sum'?v.reduce((s,p)=>s+p.y,0):p.aggregate==='mean'?v.reduce((s,p)=>s+p.y,0)/v.length:p.aggregate==='min'?Math.min(...v.map(p=>p.y)):Math.max(...v.map(p=>p.y)),sourceIds:v.flatMap(p=>p.sourceIds)}));
  }else if(p.aggregate==='count')points=points.map(p=>({...p,y:1}));
  if(points.some(p=>!Number.isFinite(p.y)))fail('DDN-PJ032','Aggregate overflow');
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
  return{kind,profile:p.profile,mark:p.mark,points,skipped,...(funnelCategories?{categories:funnelCategories}:{}),sourceIds:points.flatMap(p=>p.sourceIds),xType:p.x_type||'category',unit:p.aggregate==='count'?'count':p.unit||'',quantitative:true};
 }
 if(kind==='timeline'){
  const records=filtered(),items=records.map(n=>{const start=get(n,p.start),end=get(n,p.end),a=date(start),b=date(end);if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)fail('DDN-PJ040','Timeline needs real ISO date-only start/end with end >= start',n);return{id:n.id,node:n,label:String(p.label?textValue(n,p.label):n.name),start,end,a,b};});
  const by=new Map(items.map(n=>[n.id,n])),dependencies=[];
  for(const id of p.dependencies||[]){const r=resolve(id,'relation'),a=by.get(r.from.element),b=by.get(r.to.element);if(!a||!b||!['precede','analysis.precedes'].includes(r.kind))fail('DDN-PJ041','Timeline dependencies must be selected predecessor-to-successor links',r);if(a.b>b.a)fail('DDN-PJ042','Finish-to-start dependency contradicts supplied dates',r);dependencies.push(r);}
  const seen=new Set(),active=new Set();function visit(id){if(active.has(id))fail('DDN-PJ043','Timeline dependency cycle');if(seen.has(id))return;active.add(id);dependencies.filter(r=>r.from.element===id).forEach(r=>visit(r.to.element));active.delete(id);seen.add(id);}items.forEach(x=>visit(x.id));
  return{kind,profile:p.profile,items,dependencies,sourceIds:items.map(i=>i.id).concat(dependencies.map(d=>d.id)),quantitative:true};
 }
}
return{VERSION:'0.5.0-draft.2',get,date,plan,supported,quality:Quality};
});
