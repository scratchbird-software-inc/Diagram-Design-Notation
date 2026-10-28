import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const output=process.env.DDN_BUILD_ROOT??resolve(root,'.work/builds/typescript');
const {columnPercentages,layoutTable,wrapCell,inlineMarkdown,markdownBlocks,safeURL,projectSnapshot,recordTableData,records}=await import(pathToFileURL(join(output,'ddn/packages/presentation/src/index.js')));

test('column overflow water-fills ties and crosses successive largest groups',()=>{
 assert.deepEqual(columnPercentages([{id:'a',percentage:70},{id:'b',percentage:70},{id:'c',percentage:10}]),[45,45,10]);
 assert.deepEqual(columnPercentages([{id:'a',percentage:300},{id:'b',percentage:80},{id:'c',percentage:40}]),[100/3,100/3,100/3]);
 assert.deepEqual(columnPercentages([{id:'a',percentage:20},{id:'b',percentage:20}]),[20,80]);
 assert.deepEqual(columnPercentages([{id:'a',percentage:25},{id:'b'},{id:'c'}]),[25,37.5,37.5]);
 assert.deepEqual(columnPercentages([{id:'a'},{id:'b'}]),[50,50]);
 assert.throws(()=>columnPercentages([{id:'x',percentage:-1}]),/Invalid/);
});
test('wrapped values retain full data and show an ellipsis at the line cap',()=>{
 const full='abcdefghijklmnopqrstuvwxyz';const cell=wrapCell(full,5,s=>s.length,2);
 assert.equal(cell.value,full);assert.deepEqual(cell.lines,['abcde','fghi…']);assert.equal(cell.truncated,true);
 const table=layoutTable([{id:'name',min_chars:10}],[['long value']],20,s=>s.length*8);
 assert.equal(table.fits,false);assert.equal(table.height,32);
});
test('table character limits use the default font zero advance',()=>{
 const measure=text=>[...text].reduce((width,char)=>width+(char==='M'?20:5),0);
 // 26 pixels admits one 5-pixel character plus the 16-pixel cell padding.
 const minimum=layoutTable([{id:'field',min_chars:1}],[['a']],26,measure,{header:false});
 assert.equal(minimum.fits,true);assert.deepEqual(minimum.rows[0].cells[0].lines,['a']);
 const maximum=layoutTable([{id:'field',max_chars:2}],[['abcde']],100,measure,{header:false});
 assert.deepEqual(maximum.rows[0].cells[0].lines,['ab','cd','e']);
 assert.equal(maximum.rows[0].cells[0].value,'abcde');
});
test('alignment and percentages preserve sparse empty values',()=>{
 const table=layoutTable([{id:'field',percentage:40},{id:'domain'}],[['Name',null]],300,s=>s.length*8);
 assert.deepEqual(table.widths,[120,180]);assert.equal(table.rows[1].cells[1].value,'');assert.equal(table.fits,true);
});
test('Markdown remains bounded text, with safe links and paragraphs',()=>{
 assert.equal(safeURL('javascript:alert(1)'),undefined);assert.equal(safeURL('data:text/html,test'),undefined);
 assert.deepEqual(inlineMarkdown('a **bold** ++under++ `code`').map(x=>[x.text,!!x.bold,!!x.underline,!!x.code]),[['a ',false,false,false],['bold',true,false,false],[' ',false,false,false],['under',false,true,false],[' ',false,false,false],['code',false,false,true]]);
 assert.equal(inlineMarkdown('<script>alert(1)</script>')[0].text,'<script>alert(1)</script>');
 assert.equal(markdownBlocks('one\ntwo\n\n# Heading')[0].runs[0].text,'one two');
 assert.equal(markdownBlocks('# Heading')[0].heading,1);
});
function snapshot(profile='ddn@1'){
 return {contract:'ddn-next-1',rootFile:'main.ddn',revision:{model:'1',sources:{'main.ddn':'1'},data:{}},versions:{api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{}},semanticFingerprint:'test',coverage:{scope:{kind:'workarea'},complete:true,checked:[],unavailable:[]},normalized:{version:'ddn-next-1',entry:'main.ddn',files:[{location:'main.ddn',document:{definitions:[{id:'entity',role:'entity',name:'Customer'}],views:[{id:'view',name:'Sales',profile,selection:{include:[{id:'entity'}]}}],appearances:[{id:'one',target:{id:'entity'},parent:{id:'view'},position:{x:20,y:60}},{id:'two',target:{id:'entity'},parent:{id:'view'},position:{x:400,y:60}}]}}]}};
}
const resolver=input=>(target,{appearance}={})=>{
 const records=input.normalized.files[0].document;const record=[...records.definitions,...records.views,...records.appearances].find(r=>r.id===(appearance?.id??target.id))??{};
 return {values:record,properties:[],diagnostics:[]};
};
test('repeated appearances have distinct identities while sharing their definition',()=>{
 const source=snapshot();const projection=projectSnapshot(source,{resolve:resolver(source)});const occurrences=projection.entries.filter(e=>e.definition.ref.id==='entity');
 assert.equal(occurrences.length,2);assert.notEqual(occurrences[0].item.occurrence,occurrences[1].item.occurrence);assert.deepEqual(occurrences[0].item.target,occurrences[1].item.target);
 assert.equal(occurrences[0].item.bounds.x,20);assert.equal(occurrences[1].item.bounds.x,400);
});
test('profiles excluded by the installed capability set stay explicit unsupported frames',()=>{
 const source=snapshot('chen.basic@1');const projection=projectSnapshot(source,{resolve:resolver(source),supports:profile=>profile==='ddn@1'});
 assert.equal(projection.coverage.complete,false);assert.ok(projection.coverage.unavailable.includes('profile:chen.basic@1'));assert.equal(projection.items.length,1);assert.equal(projection.items[0].evidence,'invalid');
});
test('canonical endpoint definitions connect native elements',()=>{
 const source=snapshot();const document=source.normalized.files[0].document;
 document.definitions.push({id:'order',role:'entity',name:'Order'},{id:'edge',category:'relation',role:'assoc',endpoints:[{definition:{id:'entity'}},{definition:{id:'order'}}]});
 document.appearances.push({id:'order-appearance',target:{id:'order'},parent:{id:'view'},position:{x:100,y:300}});
 const projection=projectSnapshot(source,{resolve:resolver(source)});
 assert.equal(projection.entries.filter(e=>e.definition.record.category==='relation').length,1);
});
test('connection routes select the named occurrence rather than another copy of its definition',()=>{
 const source=snapshot(),document=source.normalized.files[0].document;
 // The requested second occurrence precedes the first in storage, so an arbitrary
 // last-definition lookup would choose the wrong physical copy.
 document.appearances.reverse();
 document.definitions.push({id:'order',role:'entity',name:'Order'},{id:'edge',category:'relation',role:'assoc',endpoints:[{definition:{id:'entity'}},{definition:{id:'order'}}]});
 document.appearances.push({id:'order-instance',target:{id:'order'},parent:{id:'view'},position:{x:760,y:60}},{id:'edge-instance',target:{id:'edge'},parent:{id:'view'},route:{from:{file:'main.ddn',id:'two'},to:{file:'main.ddn',id:'order-instance'}}});
 const projection=projectSnapshot(source,{resolve:resolver(source)});
 const from=projection.items.find(item=>item.occurrence==='two');
 const edge=projection.items.find(item=>item.occurrence==='edge-instance');
 const path=edge.primitives.find(primitive=>primitive.kind==='path');
 const start=path.d.match(/^M(-?[\d.]+),(-?[\d.]+)/),m=edge.transform;
 assert.ok(start,'connection has an explicit start point');
 const x=Number(start[1]),y=Number(start[2]);
 assert.equal(m[0]*x+m[2]*y+m[4],from.bounds.x+from.bounds.width);
 assert.equal(m[1]*x+m[3]*y+m[5],from.bounds.y+from.bounds.height/2);
 assert.equal(projection.diagnostics.some(diagnostic=>diagnostic.code==='relation-occurrence-unavailable'),false);
});
test('chosen field details extend inherited column ordering',()=>{
 const source=snapshot();const document=source.normalized.files[0].document;
 document.definitions[0].data={columns:[{id:'field'},{id:'domain'},{id:'key'}],rows:[['identifier','Identity','primary']]};
 Object.assign(document.appearances[0],{body:'columns',columns:[{id:'field'}],column_visibility:{field:'shown',domain:'shown',key:'hidden'}});
 const projection=projectSnapshot(source,{resolve:resolver(source)});
 const first=projection.entries.find(e=>e.item.occurrence==='one');
 const text=first.item.primitives.filter(p=>p.kind==='text').flatMap(p=>p.runs).map(r=>r.text);
 assert.ok(text.includes('domain'));assert.ok(text.includes('Identity'));assert.ok(!text.includes('primary'));
});
test('native record tables render declared dataset fields, filters and ordering',()=>{
 const source=snapshot('table.records@1'),document=source.normalized.files[0].document;
 document.data=[{id:'dataset',name:'Rows',columns:[{id:'id'},{id:'name'}],rows:[[2,'Beta'],[1,'Alpha'],[3,'Gamma']]}];
 document.views[0].projection={options:{records:{id:'dataset'},columns:[{id:'id',label:'Identifier'},{id:'name',label:'Description'}],filter:[{key:'id',op:'in',value:[1,2]}],order:[{key:'id',direction:'asc'}]}};
 const view=records(source).find(record=>record.owner==='view');
 assert.deepEqual(recordTableData(source,view).rows,[[1,'Alpha'],[2,'Beta']]);
 const projection=projectSnapshot(source,{resolve:resolver(source)});const table=projection.items.find(item=>item.occurrence.startsWith('records:'));
 assert.ok(table);const text=table.primitives.filter(p=>p.kind==='text').flatMap(p=>p.runs).map(run=>run.text);
 assert.ok(text.includes('Identifier'));assert.ok(text.includes('Alpha'));assert.ok(!text.includes('Gamma'));
 assert.ok(!projection.entries.some(entry=>entry.definition.ref.id==='entity'));
});
test('record tables support header-only output and explicit missing-value policies',()=>{
 const source=snapshot('table.records@1'),document=source.normalized.files[0].document;
 document.views[0].projection={options:{records:[],columns:[{id:'missing',label:'Heading'}]}};
 const view=records(source).find(record=>record.owner==='view');assert.deepEqual(recordTableData(source,view).rows,[]);
 const projection=projectSnapshot(source,{resolve:resolver(source)});assert.ok(projection.items.flatMap(item=>item.primitives).some(p=>p.kind==='text'&&p.runs.some(run=>run.text==='Heading')));
 document.views[0].projection.options.records=[{id:'entity'}];
 assert.equal(recordTableData(source,view).diagnostics.length,1);
 document.views[0].projection.options.missing='skip';assert.deepEqual(recordTableData(source,view).rows,[]);
 document.views[0].projection.options.missing='gap';assert.deepEqual(recordTableData(source,view).rows,[[null]]);assert.deepEqual(recordTableData(source,view).diagnostics,[]);
});
test('mind-map descendants retain branch side and increase depth',()=>{
 const source=snapshot('mindmap.basic@1'),document=source.normalized.files[0].document;
 document.definitions=[{id:'root',role:'object',title:'Root'},{id:'left',role:'object',name:'Left'},{id:'leaf',role:'object',name:'Leaf'},{id:'right',role:'object',name:'Right'},...[["root","left"],["left","leaf"],["root","right"]].map(([a,b],i)=>({id:'edge'+i,category:'relation',role:'assoc',endpoints:[{definition:{id:a}},{definition:{id:b}}]}))];
 document.appearances=['root','left','leaf','right'].map(id=>({id:'appearance-'+id,target:{id},parent:{id:'view'}}));
 const projection=projectSnapshot(source,{resolve:resolver(source)});const position=id=>projection.entries.find(entry=>entry.definition.ref.id===id).item.bounds;
 // The first declared branch grows right; its descendants retain that side.
 assert.ok(position('leaf').x>position('left').x);assert.ok(position('left').x>position('root').x);assert.ok(position('right').x<position('root').x);
 assert.equal(projection.entries.filter(entry=>entry.definition.record.category==='relation').length,3);
});
test('opacity affects native shape and text primitives without authoring source values',()=>{
 const source=snapshot();const before=JSON.stringify(source);
 const base=projectSnapshot(source,{resolve:resolver(source)}).items.flatMap(item=>item.primitives);
 const projection=projectSnapshot(source,{resolve:resolver(source),preview:{opacity:.25}});
 for(const [index,primitive] of projection.items.flatMap(item=>item.primitives).entries()){
  if(primitive.kind==='text')assert.ok(primitive.runs.every(run=>run.style.opacity===.25));
  else if('paint'in primitive)assert.equal(primitive.paint.opacity,(base[index].paint.opacity??1)*.25);
 }
 assert.equal(JSON.stringify(source),before);
});
test('unsupported image opacity is explicit partial coverage',()=>{
 const source=snapshot(),document=source.normalized.files[0].document;
 document.assets=[{id:'image',media_type:'image/png',path:'local.png'}];document.appearances[0].background={image:{id:'image'}};
 const projection=projectSnapshot(source,{resolve:resolver(source),preview:{opacity:.5}});
 assert.equal(projection.coverage.complete,false);assert.ok(projection.diagnostics.some(item=>item.code==='image-opacity-unavailable'));
});
