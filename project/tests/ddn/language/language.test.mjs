import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/language');
const language=await import(pathToFileURL(path.join(build,'ddn/packages/language/src/index.js')));
const model=await import(pathToFileURL(path.join(build,'ddn/packages/model/src/index.js')));
const {decodeSources,applySourcePatches,patchProperty,renameDeclaration,replaceDataBody,replaceDraftBody,encodeDefinition,parseTableHeader,parseTableRow}=language;
const source=(text,id='main.ddn',writable=true)=>({id,text,revision:'r1',encoding:'utf-8',writable});
const set=(text,files=[])=>({entry:'main.ddn',files:[source(text),...files]});
const record=(result,name)=>model.listRecords(result.normalized).find(r=>r.record.name===name);
function valid(result,allowed=[]){assert.equal(result.syntaxValid,true,JSON.stringify(result.diagnostics));assert.deepEqual(result.diagnostics.filter(d=>d.severity==='error'||!allowed.includes(d.code)),[]);return result;}
function edited(input,result,patches){const next=applySourcePatches(input,patches);return [next,valid(decodeSources(next,{previous:result}))];}

test('quoted JSON scalar strings preserve type and leading zeros through source roundtrip',()=>{
 const values={country:'076',decimal:'23.5',scientific:'1e3',enabled:'true',disabled:'false',absent:'null',empty:'',integer:76,number:23.5,boolean:true,nothing:null};
 const text='element Measurement as record\n    with\n'+language.serializeProperties({metadata:{x_record:values}},'        ');
 const result=valid(decodeSources(set(text)));
 assert.deepEqual(record(result,'Measurement').record.metadata.x_record,values);
 const encoded=language.encodeDefinition(record(result,'Measurement').record);
 const repeated=valid(decodeSources(set(encoded)));
 assert.deepEqual(record(repeated,'Measurement').record.metadata.x_record,values);
});
test('declared numeric properties accept quoted numerals without changing their numeric type',()=>{
 const result=valid(decodeSources(set('element Measurement as record\n    with\n        style.font_size "12"\n        metadata.x_record.country "036"\n')));
 assert.equal(record(result,'Measurement').record.style.font_size,12);
 assert.equal(record(result,'Measurement').record.metadata.x_record.country,'036');
});
test('explicit empty collection words preserve nested JSON arrays and records',()=>{
 const values={list:[],record:{},nested:[[],{},[[],{}]],structured:{item:[],'label words':{}},literalList:'empty list',literalRecord:'empty record'};
 const text='element Payload as record\n    with\n'+language.serializeProperties({metadata:{x_record:values}},'        ');
 assert.match(text,/list empty list/); assert.match(text,/record empty record/);
 assert.match(text,/literalList "empty list"/);
 const result=valid(decodeSources(set(text)));
 assert.deepEqual(record(result,'Payload').record.metadata.x_record,values);
 const next=valid(decodeSources(set(encodeDefinition(record(result,'Payload').record))));
 assert.deepEqual(record(next,'Payload').record.metadata.x_record,values);
 const stringOnly=valid(decodeSources(set('element Label as record\n    with\n        title empty list\n')));
 assert.equal(record(stringOnly,'Label').record.title,'empty list');
});
test('named publication contracts resolve view targets and remain source-editable',()=>{
 const input=set('erd Sales\n    Customer\npublication Review\n    with\n        targets\n            item\n                target Sales\n                kind view\n        format svg\n        page\n            size a4\n            orientation landscape\n');
 const result=valid(decodeSources(input)),publication=record(result,'Review'),view=record(result,'Sales');
 assert.equal(publication.kind,'publication');
 assert.deepEqual(publication.record.targets,[{target:{...view.ref,name:'Sales'},kind:'view'}]);
 assert.equal(publication.record.format,'svg');
 const [,next]=edited(input,result,patchProperty(result,publication.ref,'page.orientation','portrait'));
 assert.equal(record(next,'Review').record.page.orientation,'portrait');
 const duplicate=decodeSources(set('publication Same\npublication Same\n'));
 assert.ok(duplicate.diagnostics.some(d=>d.code==='name.duplicate'));
});

test('minimal ERD keeps omissions and generates resolved members and relationships',()=>{
 const result=valid(decodeSources(set('erd Sales\n    Customer\n        Key.int..primary\n        name.varchar(25)\n    Order\n    connect Customer at Key to Order\n')));
 assert.deepEqual(record(result,'Sales').record.subtype,['erd']);
 const customer=record(result,'Customer');assert.deepEqual(customer.record.data.rows,[['Key','int',null,'primary',null],['name','varchar(25)',null,null,null]]);
 assert.equal(customer.record.style,undefined);assert.equal(customer.record.design,undefined);
 const edge=model.listRecords(result.normalized).find(r=>r.record.category==='relation');
 assert.equal(edge.record.endpoints[0].definition.id,customer.ref.id);assert.ok(edge.record.endpoints[0].member.id);
});
test('table scanner protects punctuation and distinguishes absent from quoted empty',()=>{
 const columns=parseTableHeader('"field.name":ct:25:19:6.type::"12.5".domain.key.comment');
 assert.deepEqual(columns[0],{id:'field.name',alignment:'ct',percentage:25,min_chars:19,max_lines:6});
 assert.deepEqual(parseTableRow('"a.b"."text \'quote\'"..""',columns),['a.b',"text 'quote'",null,'',null]);
 assert.deepEqual(parseTableRow('"say ""yes"""',columns),['say "yes"',null,null,null,null]);
 assert.throws(()=>parseTableRow('a.b.c.d.e.f',columns),/More cells/);
});
test('raw blocks retain markdown, paragraph breaks, comment-looking text and command words',()=>{
 const result=valid(decodeSources(set('erd Design\n    Table\n        draft table\n            field.type\n            // literal\n            with false\n\n            **text**\n        notes Detail : ## Heading\n            first\n            second\n\n            // third\n')));
 const table=record(result,'Table').record;
 assert.equal(table.draft.text,'field.type\n// literal\nwith false\n\n**text**');
 assert.equal(table.notes[0].text,'first\nsecond\n\n// third');
});
test('include closure supports cycles and file-qualified duplicate names without parsing CSS',()=>{
 const input=set('include "sub/other.ddn"\nstyle "theme.css"\nerd Main\n    Customer\n    connect Customer to "sub/other.ddn"::Customer\n',[
 source('include "../main.ddn"\nelement Customer as entity\n','sub/other.ddn'),source('body { color: red; }','theme.css')]);
 const result=valid(decodeSources(input));assert.equal(result.normalized.files.length,2);assert.equal(result.references[1].target.file,'sub/other.ddn');
 assert.equal(model.normalizeLocation('../shared.ddn','https://example.com/team/main.ddn'),'https://example.com/shared.ddn');
 assert.equal(model.normalizeLocation('other.ddn','/team/main.ddn'),'/team/other.ddn');
});
test('unresolved dependencies are semantic partial coverage, malformed syntax is explicit',()=>{
 const unresolved=decodeSources(set('include "missing.ddn"\nerd Main\n    use Missing\n'));
 assert.equal(unresolved.syntaxValid,true);assert.equal(unresolved.coverage.complete,false);assert.ok(unresolved.diagnostics.some(d=>d.code==='reference.unresolved'));
 for(const text of ['erd "unterminated\n','erd Main\n\tTable\n','erd Main\n    Table\n   Other\n','erd Main\n    Table\n        data\n            a.b\n            x.y.z\n'])assert.equal(decodeSources(set(text)).syntaxValid,false,text);
});
test('implicit appearance routing and source patching preserve comments CRLF BOM and stable identity',()=>{
 let input=set('\ufeff// keep\r\nerd Main\r\n    Customer : "Title"\r\n        with\r\n            font serif\r\n            position.x 10\r\n    Order\r\n');let result=valid(decodeSources(input));
 const customer=record(result,'Customer');const appearance=model.listRecords(result.normalized).find(r=>r.kind==='appearance'&&r.record.target.id===customer.ref.id);
 assert.equal(customer.record.style.font,'serif');assert.equal(appearance.record.position.x,10);assert.equal(customer.record.position,undefined);
 [input,result]=edited(input,result,patchProperty(result,appearance.ref,'position.x',25));
 assert.match(input.files[0].text,/position.x 25/);assert.ok(input.files[0].text.startsWith('\ufeff// keep\r\n'));assert.equal(record(result,'Customer').ref.id,customer.ref.id);
 assert.throws(()=>patchProperty(result,appearance.ref,'style.font','sans'),/explicit use/);
 [input,result]=edited(input,result,patchProperty(result,customer.ref,'title',undefined));assert.equal(record(result,'Customer').record.title,undefined);
});
test('nested property edits preserve sibling values and unrelated exact source',()=>{
 let input=set('element Box as object\n    with\n        style\n            font "serif"\n            font_size 12\n// retained\n');let result=valid(decodeSources(input));const ref=record(result,'Box').ref;
 [input,result]=edited(input,result,patchProperty(result,ref,'style.font','sans'));assert.equal(record(result,'Box').record.style.font,'sans');assert.equal(record(result,'Box').record.style.font_size,12);assert.ok(input.files[0].text.endsWith('// retained\n'));
 [input,result]=edited(input,result,patchProperty(result,ref,'style.font',undefined));assert.equal(record(result,'Box').record.style.font,undefined);assert.equal(record(result,'Box').record.style.font_size,12);
});
for (const declaration of [
 '            position.x 700\r\n            position.y 300\r\n',
 '            position\r\n                x 700\r\n                y 300\r\n',
]) test(`resetting a parent appearance property removes ${declaration.includes('position.x') ? 'dotted leaves' : 'its nested block'} without touching siblings`,()=>{
 const text='\ufeff// preserve\r\nerd Main\r\n    Customer\r\n        with\r\n'+declaration+'            size.width 250\r\n            pinned false\r\n    Order\r\n';
 const input=set(text),result=valid(decodeSources(input)),customer=record(result,'Customer');
 const occurrence=model.listRecords(result.normalized).find(r=>r.kind==='appearance'&&r.record.target.id===customer.ref.id);
 const patches=patchProperty(result,occurrence.ref,'position',undefined),[next,decoded]=edited(input,result,patches);
 const after=model.listRecords(decoded.normalized).find(r=>r.ref.id===occurrence.ref.id);
 assert.equal(after.record.position,undefined);
 assert.equal(after.record.size.width,250);assert.equal(after.record.pinned,false);
 assert.equal(next.files[0].text,text.replace(declaration,''));
 assert.deepEqual(patchProperty(decoded,occurrence.ref,'position',undefined),[]);
});
test('atomic rename follows file ownership and quoted references',()=>{
 let input=set('include "shared.ddn"\nerd Main\n    use "shared.ddn"::Customer\n',[source('element Customer as entity\n','shared.ddn')]);let result=valid(decodeSources(input));const ref=record(result,'Customer').ref;
 [input,result]=edited(input,result,renameDeclaration(result,ref,'Renamed customer'));assert.match(input.files[1].text,/element "Renamed customer" as entity/);assert.match(input.files[0].text,/"shared.ddn"::"Renamed customer"/);assert.equal(record(result,'Renamed customer').ref.id,ref.id);
 assert.throws(()=>applySourcePatches(input,[{file:'absent',base:'r1',start:0,end:0,text:'x'}]),/unavailable/);
 assert.throws(()=>applySourcePatches({...input,files:input.files.map(f=>({...f,writable:false}))},renameDeclaration(result,ref,'Next')),/read-only/);
});
test('draft edits replace raw body; conversion retains draft and independent notes',()=>{
 let input=set('erd Main\n    Table\n        draft fields\n            first\n            second\n        notes : Keep\n            unchanged\nelement named as domain\n');let result=valid(decodeSources(input));const ref=record(result,'Table').ref;
 [input,result]=edited(input,result,replaceDraftBody(result,ref,'Alpha\nBeta','fields'));
 [input,result]=edited(input,result,replaceDataBody(result,ref,{columns:[{id:'field'},{id:'domain'}],rows:[['Alpha',null],['Beta','named']]}));
 const table=record(result,'Table').record;assert.equal(table.draft.text,'Alpha\nBeta');assert.deepEqual(table.data.rows,[['Alpha',null],['Beta','named']]);assert.equal(table.notes[0].text,'unchanged');
});
test('typed serializer roundtrips nested rows and column records without reference guessing',()=>{
 const text=encodeDefinition({id:'stable',name:'T',role:'entity',data:{columns:[{id:'field',label:'Field'}],rows:[['Alpha'],[null],['']]}});
 const result=valid(decodeSources(set(text)));const table=record(result,'T').record;assert.equal(table.id,'stable');assert.deepEqual(table.data.rows,[['Alpha'],[null],['']]);assert.equal(table.data.columns[0].label,'Field');
});
test('mindmap recipe supplies one unnamed root with hierarchical association edges',()=>{
 const result=valid(decodeSources(set('mindmap Plan\n    Topic\n        Child\n    Other\n')));const definitions=result.normalized.files[0].document.definitions;
 assert.equal(definitions.filter(d=>d.role==='object').length,4);assert.equal(definitions.filter(d=>d.category==='relation').length,3);assert.equal(definitions.find(d=>d.title==='Plan').name,undefined);
});
test('all adopted consolidated examples decode without unsupported syntax',async()=>{
 const dir=path.resolve('standard/language/examples/consolidated');
 const names=(await readdir(dir)).filter(n=>n.endsWith('.ddn'));const files=await Promise.all(names.map(async n=>source(await readFile(path.join(dir,n),'utf8'),n)));
 for(const entry of names)valid(decodeSources({entry,files}),['field.key']);
});
test('bar recipe normalizes a typed dataset and explicit chart mapping',()=>{
 const result=valid(decodeSources(set('bar Sales\n    Monday 10\n    "Friday night" 12.5\n')));const view=record(result,'Sales').record;
 const data=model.resolveReference(result.normalized,'main.ddn',view.projection.options.records).record;
 assert.deepEqual(data.rows,[['Monday',10],['Friday night',12.5]]);assert.equal(view.projection.options.mark,'bar');assert.equal(view.projection.options.x,'label');assert.equal(view.projection.options.y,'value');
});
test('template parameters expand with explicit instance precedence and scoped generated children',()=>{
 const result=valid(decodeSources(set('template Base as entity\n    with\n        parameters\n            typeface\n                type text\n                default serif\n        style.font parameter typeface\n    element Child as entity\nerd Main\n    element First as entity using Base\n        with\n            arguments\n                typeface sans\n    element Second as entity using Base\n        with\n            style.font mono\n')));
 assert.equal(record(result,'First').record.style.font,'sans');assert.equal(record(result,'Second').record.style.font,'mono');
 assert.ok(record(result,'First::Child'));assert.ok(record(result,'Second::Child'));assert.equal(record(result,'Child'),undefined);
 const bad=decodeSources(set('template Base as entity\n    with\n        parameters\n            typeface\n                type text\n                required true\n        style.font parameter typeface\nelement Instance as entity using Base\n'));
 assert.ok(bad.diagnostics.some(d=>d.code==='template.required'));assert.equal(record(bad,'Instance').record.style,undefined);
});
test('typed scalar reference edits participate in rename without changing semantic target',()=>{
 let input=set('data DataSet\n    field\n    Alpha\nelement Table as entity\n    with\n        data.source DataSet\n');let result=valid(decodeSources(input));const ref=record(result,'DataSet').ref;
 [input,result]=edited(input,result,renameDeclaration(result,ref,'Renamed'));assert.match(input.files[0].text,/data.source "Renamed"/);assert.equal(record(result,'Table').record.data.source.id,ref.id);
});
test('adding unnamed declarations retains pre-existing generated identities',()=>{
 const initial=set('erd Main\n    element as entity : One\n    element as entity : Two\n');const before=valid(decodeSources(initial));const refs=new Map(model.listRecords(before.normalized).filter(r=>r.kind==='definition').map(r=>[r.record.title,r.ref.id]));
 const after=valid(decodeSources(set('erd Main\n    element as entity : Added\n    element as entity : One\n    element as entity : Two\n'),{previous:before}));
 for(const r of model.listRecords(after.normalized).filter(r=>r.kind==='definition'&&r.record.title!=='Added'))assert.equal(r.ref.id,refs.get(r.record.title));
});
test('implicit appearance identity agrees across staged and direct draft transactions',()=>{
 const original=set('erd Sales\n    Customer\n');const initial=valid(decodeSources(original));const definition=record(initial,'Customer');const appearance=model.listRecords(initial.normalized).find(r=>r.kind==='appearance'&&r.record.target.id===definition.ref.id);
 let [next,staged]=edited(original,initial,replaceDraftBody(initial,definition.ref,'Alpha\nBeta','fields'));
 [next,staged]=edited(next,staged,patchProperty(staged,appearance.ref,'body','draft'));
 const direct=valid(decodeSources(next,{previous:initial}));
 for(const parsed of [staged,direct]){const found=model.listRecords(parsed.normalized).find(r=>r.kind==='appearance'&&r.record.target.id===definition.ref.id);assert.equal(found.ref.id,appearance.ref.id);assert.equal(found.record.body,'draft');}
});
test('quoted text in string-or-reference unions remains an explicit host identity',()=>{
 const result=valid(decodeSources(set('erd Main\n    with\n        acceptance\n            at 2026-10-23T15:30:00Z\n            by "tester"\n')));assert.equal(record(result,'Main').record.acceptance.by,'tester');assert.equal(result.references.length,0);
});
test('table updates preserve single-column null rows and registered column metadata',()=>{
 let input=set('erd Main\n    Table\n        data\n            field\n            Original\n        notes : Keep\n            unchanged\n');let result=valid(decodeSources(input));const ref=record(result,'Table').ref;
 [input,result]=edited(input,result,replaceDataBody(result,ref,{columns:[{id:'field',label:'Field',type:'text'}],rows:[[null],['']]}));
 assert.deepEqual(record(result,'Table').record.data.rows,[[null],['']]);assert.equal(record(result,'Table').record.data.columns[0].label,'Field');assert.equal(record(result,'Table').record.notes[0].text,'unchanged');
 [input,result]=edited(input,result,replaceDataBody(result,ref,{columns:[{id:'field'}],rows:[['Next']]}));assert.deepEqual(record(result,'Table').record.data,{columns:[{id:'field'}],rows:[['Next']]});
});
test('forward references to deterministic template children resolve after expansion',()=>{
 const result=valid(decodeSources(set('template Base as entity\n    element Child as entity\nerd Main\n    use "First::Child"\n    element First as entity using Base\n')));const child=record(result,'First::Child');assert.ok(child);assert.ok(result.references.some(site=>site.reference.name==='First::Child'&&site.target?.id===child.ref.id));
});
test('template views and occurrences expand with isolated identities, names and local references',()=>{
 const text='template Package as object\n    with\n        fragment\n            definitions\n                item\n                    id local-node\n                    name Node\n                    role object\n            views\n                item\n                    id local-view\n                    name Diagram\n                    profile ddn@1\n                    selection\n                        include\n                            item Node\n            appearances\n                item\n                    id local-appearance\n                    name Spot\n                    target Node\n                    parent Diagram\n                    position\n                        x 10\n                        y 20\nelement First as object using Package\nelement Second as object using Package\n';
 const parsed=valid(decodeSources(set(text)));
 for(const prefix of ['First','Second']){const node=record(parsed,prefix+'::Node'),view=record(parsed,prefix+'::Diagram'),spot=record(parsed,prefix+'::Spot');assert.ok(node&&view&&spot);assert.equal(spot.record.target.id,node.ref.id);assert.equal(spot.record.parent.id,view.ref.id);assert.equal(view.record.selection.include[0].id,node.ref.id);assert.deepEqual(spot.record.position,{x:10,y:20});assert.ok(model.listRecords(parsed.normalized).some(r=>r.kind==='placement'&&r.record.target.id===view.ref.id));}
 assert.notEqual(record(parsed,'First::Node').ref.id,record(parsed,'Second::Node').ref.id);assert.equal(record(parsed,'Node'),undefined);
});
test('explicit template identities preserve scoped references and nested note identities across instances',()=>{
 const text='template Package as object\n    with\n        id explicit-template\n        fragment\n            definitions\n                item\n                    name Node\n                    role object\n                    notes\n                        item\n                            name Detail\n                            text explanatory\n            views\n                item\n                    name Diagram\n                    profile ddn@1\n                    selection\n                        include\n                            item Node\nelement First as object using Package\nelement Second as object using Package\n';
 const parsed=valid(decodeSources(set(text)));const a=record(parsed,'First::Detail'),b=record(parsed,'Second::Detail');assert.ok(a&&b);assert.notEqual(a.ref.id,b.ref.id);assert.equal(record(parsed,'Package').ref.id,'explicit-template');assert.equal(record(parsed,'First::Diagram').record.selection.include[0].id,record(parsed,'First::Node').ref.id);
});
test('unnamed explicit identities are referenceable after fresh reload and stay identity references on rename',()=>{
 let input=set('element as entity\n    with\n        id stable-entity\nerd Main\n    use "stable-entity"\n    Other\n    connect "stable-entity" to Other\n');let result=valid(decodeSources(input));
 const target={file:'main.ddn',id:'stable-entity'};for(const site of result.references.filter(s=>s.target?.id===target.id)){assert.equal(site.reference.name,undefined);assert.equal(site.spelling,'id');}
 [input,result]=edited(input,result,renameDeclaration(result,target,'Named now'));
 assert.match(input.files[0].text,/use "stable-entity"/);assert.match(input.files[0].text,/connect "stable-entity" to Other/);
 const fresh=valid(decodeSources(input));assert.equal(record(fresh,'Named now').ref.id,target.id);
});
test('declared names take precedence over identity fallback and stored IDs keep syntax references aligned',()=>{
 let input=set('element as entity\n    with\n        id Identity\nelement Identity as entity\n    with\n        id named-entity\nerd Main\n    use Identity\n');let result=valid(decodeSources(input));assert.equal(result.references[0].target.id,'named-entity');
 const named=record(result,'Identity').ref;[input,result]=edited(input,result,patchProperty(result,named,'id','named-entity'));
 assert.equal(language.findNode(result,named).ref.id,'named-entity');assert.equal(valid(decodeSources(input)).references[0].target.id,'named-entity');
});
test('named local endpoint occurrences retain definition and occurrence identities across source roundtrip',()=>{
 const input=set('erd Main\n    Customer\n    Order\n    use Customer named CustomerAgain\n    connect CustomerAgain to Order\n');const parsed=valid(decodeSources(input)),fresh=valid(decodeSources(input));
 for(const result of [parsed,fresh]){const relation=model.listRecords(result.normalized).find(r=>r.record.category==='relation');assert.equal(relation.record.endpoints[0].definition.id,record(result,'Customer').ref.id);const occurrence=model.listRecords(result.normalized).find(r=>r.kind==='appearance'&&r.record.target.id===relation.ref.id);assert.equal(occurrence.record.route.from.id,record(result,'CustomerAgain').ref.id);assert.equal(relation.record.endpoints[0].appearance,undefined);}
 const foreign=decodeSources(set('include "shared.ddn"\nerd Main\n    Order\n    connect "shared.ddn"::Spot to Order\n',[source('erd Other\n    Customer\n    use Customer named Spot\n','shared.ddn')]));assert.ok(foreign.diagnostics.some(d=>d.code==='reference.appearance-scope'));
});
test('ERD field columns bind exact semantic facts while preserving all raw data',()=>{
 const text='erd Sales\n    Customer\n        data\n            field.type.domain.key.comment.constraint\n            Key.varchar(25).Identifier.primary."A **key**".Required\n            Future.text..primary key\nelement Identifier as domain\nelement Required as constraint\n';
 for(const parsed of [decodeSources(set(text)),decodeSources(set(text))]){valid(parsed,['field.key']);const customer=record(parsed,'Customer'),fields=customer.record.members.map(ref=>model.resolveReference(parsed.normalized,'main.ddn',ref).record);const key=fields[0].content;
  assert.equal(key.datatype,'varchar(25)');assert.equal(key.domain.id,record(parsed,'Identifier').ref.id);assert.equal(key.key,'primary');assert.equal(key.comment,'A **key**');assert.equal(key.constraints[0].id,record(parsed,'Required').ref.id);
  assert.equal(fields[1].content.key,undefined);assert.equal(fields[1].content.domain,undefined);assert.ok(fields[1].incomplete.some(p=>p.path==='content.key'));assert.equal(customer.record.data.rows[1][3],'primary key');
 }
});
test('raw note editing preserves named headers, sibling notes and unrelated source',()=>{
 let input=set('erd Main\n    Customer\n        notes Detail : ## First\n            original\n        notes Second : Keep\n            untouched\n');let parsed=valid(decodeSources(input));const note=record(parsed,'Detail').ref;
 [input,parsed]=edited(input,parsed,language.replaceNoteBody(parsed,note,'**changed**\n\nnew paragraph'));
 assert.match(input.files[0].text,/notes Detail : ## First/);assert.equal(record(parsed,'Detail').ref.id,note.id);assert.equal(record(parsed,'Detail').record.text,'**changed**\n\nnew paragraph');assert.equal(record(parsed,'Second').record.text,'untouched');
 assert.throws(()=>patchProperty(parsed,record(parsed,'Customer').ref,'notes',[]),/individual note/);
});
test('rename preserves file qualifier spelling relative to nested source files',()=>{
 let input={entry:'folder/main.ddn',files:[source('include "other.ddn"\nerd Main\n    use "other.ddn"::Customer\n','folder/main.ddn'),source('element Customer as entity\n','folder/other.ddn')]};let parsed=valid(decodeSources(input));
 [input,parsed]=edited(input,parsed,renameDeclaration(parsed,record(parsed,'Customer').ref,'New Customer'));assert.match(input.files[0].text,/"other.ddn"::"New Customer"/);valid(decodeSources(input));
});
test('domain rename patches only its bound compact and typed data cells',()=>{
 let input=set('erd Main\n    Compact\n        data\n            field.domain.comment\n            Key.Identifier."keep punctuation, exactly"\n    element Typed as entity\n        with\n            data\n                columns\n                    item\n                        id field\n                    item\n                        id domain\n                rows\n                    item\n                        item Other\n                        item Identifier\nelement Identifier as domain\n');let parsed=valid(decodeSources(input));
 [input,parsed]=edited(input,parsed,renameDeclaration(parsed,record(parsed,'Identifier').ref,'CustomerIdentifier'));assert.match(input.files[0].text,/Key."CustomerIdentifier"."keep punctuation, exactly"/);assert.match(input.files[0].text,/item "CustomerIdentifier"/);
 const fresh=valid(decodeSources(input));for(const name of ['Compact','Typed']){const entity=record(fresh,name).record;const member=model.resolveReference(fresh.normalized,'main.ddn',entity.members[0]).record;assert.equal(member.content.domain.id,record(fresh,'CustomerIdentifier').ref.id);}
});
test('repeated uses retain occurrences but select their resolved target only once',()=>{
 const parsed=valid(decodeSources(set('element as entity\n    with\n        id stable\nerd Main\n    use stable named First\n    use stable named Second\n')));const view=record(parsed,'Main').record;assert.equal(view.selection.include.length,1);assert.equal(view.selection.include[0].id,'stable');assert.equal(model.listRecords(parsed.normalized).filter(r=>r.kind==='appearance').length,2);
});


test('nullable references distinguish explicit reset from a quoted null asset name',()=>{
 const text='asset "null" as resource from "icon.svg"\n    with\n        media_type "image/svg+xml"\nelement Device as object\n    with\n        symbol.image null\nview Board as ddn@1\n    use Device named Here\n        with\n            symbol.image "null"\n            background.image null\n';
 const input=set(text),result=valid(decodeSources(input)),device=record(result,'Device'),appearance=record(result,'Here'),asset=record(result,'null');
 assert.equal(device.record.symbol.image,null);assert.equal(appearance.record.symbol.image.id,asset.ref.id);assert.equal(appearance.record.background.image,null);
 const [resetInput,reset]=edited(input,result,patchProperty(result,appearance.ref,'symbol.image',null));assert.equal(record(reset,'Here').record.symbol.image,null);
 const [,restored]=edited(resetInput,reset,patchProperty(reset,appearance.ref,'symbol.image',{...asset.ref}));assert.equal(record(restored,'Here').record.symbol.image.id,asset.ref.id);
});


test('decoder coverage names only addressable records while preserving anonymous embedded notes',()=>{
 const input=set('element Idea as object\n    with\n        notes\n            item\n                text "Anonymous details"\n                format "plain"\n            item\n                id "note-identified"\n                text "Named details"\n                format "plain"\n');
 const result=valid(decodeSources(input)),idea=record(result,'Idea');
 assert.deepEqual(idea.record.notes,[{text:'Anonymous details',format:'plain'},{id:'note-identified',text:'Named details',format:'plain'}]);
 assert.equal(result.coverage.complete,true);assert.ok(result.coverage.checked.length>0);
 assert.ok(result.coverage.checked.every(ref=>typeof ref.file==='string'&&ref.file&&typeof ref.id==='string'&&ref.id));
 assert.ok(result.coverage.checked.some(ref=>ref.id===idea.ref.id));assert.ok(result.coverage.checked.some(ref=>ref.id==='note-identified'));
 const again=valid(decodeSources(set(encodeDefinition(idea.record))));assert.deepEqual(record(again,'Idea').record.notes,idea.record.notes);
});
