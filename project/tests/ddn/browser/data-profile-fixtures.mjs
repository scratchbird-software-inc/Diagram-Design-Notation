/** Maintained redesigned-model witnesses; no legacy source or expected-render replay. */
const chartNames=['basic','radar','funnel','quality','gauge','candlestick','treemap','sankey','histogram','density','qq','quantiledot','dotplot','boxplot','violin','beeswarm','topk','tidytree','radialtree','circlepack','sunburst','packedbubble','heatmap','densityheatmap','calendar','parallelcoords','wordcloud','arc','force','edgebundle'];
export const fixtureProfiles=[...chartNames.map(n=>`chart.${n}@1`),...['raci','crud','relations','heatmap','bcg','ansoff','tows','storymap'].map(n=>`matrix.${n}@1`),...['basic','composed','journey','pyramid','venn'].map(n=>`panels.${n}@1`),...['bmc','lean','pest','pestle','porter5','empathy','scorecard'].map(n=>`canvas.${n}@1`),...['choropleth','symbols','outline'].map(n=>`geo.${n}@1`),'timeline.basic@1','decision.rules@1'];
const file='main.ddn';const ref=id=>({file,id});
const canvas={bmc:[10,[['kp',0,0,2,2],['ka',0,2,2,1],['kr',1,2,2,1],['vp',0,4,2,2],['cr',0,6,2,1],['ch',1,6,2,1],['cs',0,8,2,2],['cost',2,0,5,1],['rev',2,5,5,1]]],lean:[10,[['problem',0,0,2,2],['solution',0,2,2,1],['keymetrics',1,2,2,1],['uvp',0,4,2,2],['unfair',0,6,2,1],['channels',1,6,2,1],['segments',0,8,2,2],['cost',2,0,5,1],['revenue',2,5,5,1]]],pest:[4,['political','economic','social','technological'].map((n,i)=>[n,0,i,1,1])],pestle:[3,['political','economic','social','technological','legal','environmental'].map((n,i)=>[n,Math.floor(i/3),i%3,1,1])],porter5:[3,[['entrants',0,1,1,1],['supplier',1,0,1,1],['rivalry',1,1,1,1],['buyer',1,2,1,1],['substitutes',2,1,1,1]]],empathy:[3,[['says',0,0,1,1],['thinks',0,2,1,1],['persona',0,1,1,2],['does',1,0,1,1],['feels',1,2,1,1]]],scorecard:[1,['financial','customer','internal','learning'].map((n,i)=>[n,i,0,1,1])]};
export function dataProfileFixture(profile){
 const document={workarea:{id:'workarea',name:'Workspace'},definitions:[],views:[],data:[],assets:[]};
 const view={id:'view',name:`Example ${profile}`,profile,projection:{options:{}},selection:{include:[]}};document.views.push(view);
 const options=view.projection.options;
 const add=(id,role='record',metadata={})=>{const value={id,name:id,category:'element',role,metadata};document.definitions.push(value);return value;};
 const dataset=(columns,rows)=>{document.data.push({id:'samples',name:'Samples',columns:columns.map(id=>({id})),rows});options.records=ref('samples');};
 if(profile.startsWith('chart.')){
  const mark=profile.split('.')[1].split('@')[0];options.x='category';options.y='value';
  if(['histogram','density','qq','quantiledot'].includes(mark)){dataset(['sample'],[[1],[2],[3],[4],[7],[9],[12],[18]]);options.x='sample';delete options.y;options.x_type='number';}
  else if(['treemap','tidytree','radialtree','circlepack','sunburst','packedbubble'].includes(mark))dataset(['category','value'],[['A.one',3],['A.two',7],['B.three',4],['B.four',2]]);
  else if(['sankey','arc','force','edgebundle'].includes(mark))dataset(['category','target','value'],[['root.A','root.B',2],['root.A','root.C',3],['root.B','root.C',1]]);
  else if(mark==='candlestick'){dataset(['category','open','high','low','close'],[['Monday',4,9,2,7],['Tuesday',7,8,3,4]]);delete options.y;Object.assign(options,{open:'open',high:'high',low:'low',close:'close'});}
  else if(mark==='gauge'){dataset(['category','value'],[['Progress',64]]);options.target=0;}
  else if(mark==='densityheatmap'){dataset(['category','value'],[[1,2],[1.1,2.1],[3,5],[8,7]]);options.x_type='number';options.bin_count=5;}
  else if(mark==='calendar'){dataset(['category','value'],[['2026-10-19',2],['2026-10-20',5],['2026-10-22',4]]);options.x_type='date';}
  else if(['radar','parallelcoords','heatmap','quality'].includes(mark)){dataset(['category','series','value'],[['Price','A',2],['Price','B',4],['Speed','A',8],['Speed','B',5],['Fit','A',6],['Fit','B',9]]);options.series='series';}
  else if(['dotplot','boxplot','violin','beeswarm'].includes(mark))dataset(['category','value'],[['A',1],['A',2],['A',3],['A',4],['A',12],['B',2],['B',5],['B',8]]);
  else dataset(['category','value'],[['Alpha',2],['Beta',5],['Gamma',3]]);
 }
 else if(profile.startsWith('matrix.')){
  const type=profile.split('.')[1].split('@')[0];const rows=[add('row1',type==='raci'||type==='crud'?'analysis.task':type==='storymap'?'activity':'record'),add('row2',type==='raci'||type==='crud'?'analysis.task':type==='storymap'?'activity':'record')],columns=[add('col1',type==='raci'?'analysis.role':type==='crud'?'entity':type==='storymap'?'object':'record'),add('col2',type==='raci'?'analysis.role':type==='crud'?'entity':type==='storymap'?'object':'record')];
  if(['bcg','ansoff','tows'].includes(type)){const axes=type==='bcg'?[['growth','high','low'],['share','high','low']]:type==='ansoff'?[['market','existing','new'],['product','existing','new']]:[['internal','strength','weakness'],['external','opportunity','threat']];rows.forEach((row,i)=>row.metadata.x_category={axis:axes[0][0],level:axes[0][i+1]});columns.forEach((col,i)=>col.metadata.x_category={axis:axes[1][0],level:axes[1][i+1]});}
  Object.assign(options,{rows:rows.map(r=>ref(r.id)),columns:columns.map(r=>ref(r.id)),relation:type==='raci'?'analysis.assignment':type==='crud'?'analysis.access':'assoc',value:['raci','crud'].includes(type)?'metadata.x_assignment.code':'value'});
  rows.forEach((row,ri)=>columns.forEach((column,ci)=>{const metadata={x_record:{value:ri*2+ci+1}};if(type==='raci')metadata.x_assignment={code:ci?'R':'A'};if(type==='crud')metadata.x_assignment={code:ci?'R':'CU'};if(type==='storymap'){const story=add(`story${ri}${ci}`,'analysis.task');metadata.x_story={task:ref(story.id)};}
  document.definitions.push({id:`link${ri}${ci}`,name:`link${ri}${ci}`,category:'relation',role:options.relation,endpoints:[{definition:ref(row.id)},{definition:ref(column.id)}],metadata});}));
 }
 else if(profile.startsWith('canvas.')||profile.startsWith('panels.')){
  const type=profile.split('.')[1].split('@')[0],note=add('idea','note',{x_record:{value:3}});note.content={text:'An authored idea'};
  let columns=1,placements=[['first',0,0,1,1],['second',1,0,1,1]];
  if(profile.startsWith('canvas.'))[columns,placements]=canvas[type];
  if(type==='pyramid')placements=[['foundation',0,0,1,1],['middle',1,0,1,1],['base',2,0,1,1]];
  if(type==='journey'){columns=2;placements=[];['discover','use'].forEach((phase,col)=>['phase','actions','touchpoints','opportunities'].forEach((lane,row)=>placements.push([`${lane}-${phase}`,row,col,1,1])));placements.push(['emotions',4,0,2,1]);}
  options.columns=columns;options.panels=[];
  for(const [id,row,column,colspan,rowspan]of placements){const panel=add(id,'note',{x_record:{row,column,colspan,rowspan,items:[ref(note.id)]}});options.panels.push({target:ref(id),kind:'text'});if(type==='journey'&&id==='emotions'){panel.metadata.x_record.items=[];for(const [phase,value]of [['discover',2],['use',5]]){const emotion=add(`emotion-${phase}`,'record',{x_record:{phase,value}});panel.metadata.x_record.items.push(ref(emotion.id));}}}
  if(type==='venn'){note.metadata.x_sets=['first','second'];}
  if(type==='composed'){const child={id:'child',name:'Child chart',profile:'chart.basic@1',projection:{options:{records:ref('child-data'),x:'label',y:'value'}}};document.views.push(child);document.data.push({id:'child-data',name:'Child data',columns:[{id:'label'},{id:'value'}],rows:[['A',1],['B',2]]});options.panels=[{target:ref('child'),kind:'view'}];}
 }
 else if(profile.startsWith('geo.')){
  document.assets.push({id:'map',name:'Map',media_type:'application/geo+json',bytes:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',id:'West',properties:{},geometry:{type:'Polygon',coordinates:[[[-20,-10],[0,-10],[0,10],[-20,10],[-20,-10]]]}},{type:'Feature',id:'East',properties:{},geometry:{type:'Polygon',coordinates:[[[0,-10],[20,-10],[20,10],[0,10],[0,-10]]]}}]})});options.geography='Map';options.method='equirectangular';
  if(profile==='geo.symbols@1'){dataset(['lon','lat','weight'],[[-10,0,9],[10,4,16]]);Object.assign(options,{x:'lon',y:'lat',size:'weight'});}
  else if(profile==='geo.choropleth@1'){dataset(['region','value'],[['West',2],['East',6]]);Object.assign(options,{x:'region',y:'value'});}
 }
 else if(profile==='timeline.basic@1'){dataset(['start','end','label'],[['2026-10-01','2026-10-05','Design'],['2026-10-06','2026-10-12','Build']]);Object.assign(options,{start:'start',end:'end',label:'label',timezone:'UTC'});}
 else if(profile==='decision.rules@1'){const age=add('age','domain');age.content={allowed_values:{type:'number',min:0,max:100}};const decision=add('result','domain');decision.content={allowed_values:['yes','no']};const row=add('adult','rule.row',{x_rule:{inputs:{age:{op:'interval',min:18,max:100}},outputs:{result:'yes'}}});options.inputs=[ref('age')];options.outputs=['result'];options.records=[ref(row.id)];}
 if(profile.startsWith('matrix.'))view.selection.include=document.definitions.map(d=>ref(d.id));
 const snapshot={contract:'ddn-next-1',rootFile:file,revision:{model:'1',sources:{[file]:'1'},data:{}},versions:{api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{}},semanticFingerprint:'fixture',coverage:{scope:{kind:'workarea'},complete:true,checked:[],unavailable:[]},normalized:{version:'ddn-next-1',entry:file,files:[{location:file,document}]}};
 const located={file,ref:ref(view.id),owner:'view',record:view};return{snapshot,document,view:located,bounds:{x:32,y:58,width:1000,height:650},effective:view};
}

export function retainedQualityFixture(transform){const f=dataProfileFixture('chart.quality@1');f.document.definitions=[];f.document.data=[];f.view.record.projection.options={x:'category',y:'value',transform,mark:transform==='boxplot'?'boxplot':'bar',records:[]};const rows=transform==='waterfall'?[['Start',4,'delta'],['Expense',-1,'delta'],['Subtotal',3,'subtotal'],['Growth',2,'delta'],['Total',5,'total']]:transform==='boxplot'?[['A',1],['A',2],['A',3],['A',4],['A',100]]:[['B',2],['A',4],['B',2],['C',1]];rows.forEach((row,index)=>{const id=`measurement${index}`;f.document.definitions.push({id,name:id,category:'element',role:'metric',metadata:{x_record:{category:row[0],value:row[1],step:row[2]??'delta'}}});f.view.record.projection.options.records.push({file:'main.ddn',id});});if(transform==='histogram'){f.view.record.projection.options.bins=[0,2,5];delete f.view.record.projection.options.x;}if(transform==='waterfall')f.view.record.projection.options.step='step';if(transform==='boxplot')f.view.record.projection.options.whiskers='minmax';return f;}
