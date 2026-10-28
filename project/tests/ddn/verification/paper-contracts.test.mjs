import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/ddn');
const mod=async name=>import(pathToFileURL(path.join(build,'ddn/packages',name,'src/index.js')));
const {decodeSources,encodeDefinition,patchProperty,applySourcePatches}=await mod('language');
const {indexRecords}=await mod('profiles');
const {resolve,resolveProperties,validateProperty,parseStylesheet}=await mod('defaults');
const {createRuntime,createCompleteRuntimeOptions}=await mod('runtime');
const sources=text=>({entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]});
const named=(decoded,name)=>indexRecords(decoded.normalized).find(r=>r.record.name===name);
const decode=text=>{const result=decodeSources(sources(text));assert.equal(result.syntaxValid,true,JSON.stringify(result.diagnostics));assert.deepEqual(result.diagnostics,[]);return result;};

test('paper and shadow words preserve quoted notation and ordered typed attachments through source roundtrip',()=>{
 const text=`element Idea as note
    with
        paper "pad"
        background.color "#fff2ab"
        shadow 'corners'
        shadow.color "#243448"
        decorations
            item
                kind push-pin
                color "#d04b86"
                position rt
                rotation -12
            item
                kind paper-clip
                size 48
                offset
                    x -4
                    y 6
view Workshop as ddn@1
    use Idea
`;
 const value=named(decode(text),'Idea').record;
 assert.equal(value.style.paper,'pad');assert.equal(value.background.color,'#fff2ab');assert.deepEqual(value.shadow,{kind:'corners',color:'#243448'});
 assert.deepEqual(value.decorations,[{kind:'push-pin',color:'#d04b86',position:'rt',rotation:-12},{kind:'paper-clip',size:48,offset:{x:-4,y:6}}]);
 assert.deepEqual(named(decode(encodeDefinition(value)),'Idea').record,value);
});

test('existing structured and null shadows remain canonical and edits can enable a null shadow',()=>{
 const before=sources('element Idea as note\n    with\n        shadow null\n');
 const decoded=decodeSources(before),idea=named(decoded,'Idea');assert.equal(idea.record.shadow,null);
 const edited=applySourcePatches(before,patchProperty(decoded,idea.ref,'shadow.kind','centre'));
 const enabled=decodeSources(edited);assert.deepEqual(enabled.diagnostics,[]);assert.deepEqual(named(enabled,'Idea').record.shadow,{kind:'centre'});
 const old=decode('element Idea as note\n    with\n        shadow\n            x 3\n            y 4\n            blur 7\n            spread 1\n            color "#123456"\n');
 assert.deepEqual(named(old,'Idea').record.shadow,{x:3,y:4,blur:7,spread:1,color:'#123456'});
 const aliasSource=sources('element Idea as note\n    with\n        shadow centre\n');
 const alias=decodeSources(aliasSource),ref=named(alias,'Idea').ref;
 const changed=decodeSources(applySourcePatches(aliasSource,patchProperty(alias,ref,'shadow.kind','corner')));
 assert.deepEqual(changed.diagnostics,[]);assert.equal(named(changed,'Idea').record.shadow.kind,'corner');
});

test('paper and attachments reject invalid bounds and unknown shapes for every supported owner',()=>{
 for(const owner of ['definition','appearance','view_definition','view_placement','document']){
  for(const [key,value]of [['style.paper','pad'],['background.color','#fff2ab'],['shadow',{kind:'centre'}],['decorations',[{kind:'binder-clip',position:'lb',size:128,rotation:-180,opacity:0,offset:{x:-256,y:256}}]]])assert.deepEqual(validateProperty(owner,key,value),[],owner+' '+key);
  for(const [key,value]of [['style.paper','cardboard'],['shadow',{kind:'unknown'}],['shadow',{blur:129}],['shadow',{lift:65}],['shadow',{opacity:1.1}],['decorations',[{kind:'glue'}]],['decorations',[{kind:'tape',size:7}]],['decorations',[{kind:'push-pin',rotation:181}]],['decorations',[{kind:'round-pin',color:'url(file.svg)'}]],['decorations',[{kind:'paper-clip',offset:{x:257}}]],['decorations',Array.from({length:33},()=>({kind:'tape'}))]])assert.ok(validateProperty(owner,key,value).length,owner+' '+key+' '+JSON.stringify(value));
 }
 assert.ok(validateProperty('workarea','style.paper','pad').length);
 assert.ok(validateProperty('publication','decorations',[]).length);
});

test('standard, scoped CSS, file defaults and explicit occurrence presentation retain priority',()=>{
 const css=parseStylesheet('.method-ddn.subtype-discussion.role-note { --ddn-style-paper: note; --ddn-shadow: {"kind":"centre","color":"#112233"}; --ddn-decorations: [{"kind":"push-pin","color":"#ff2222"}]; }');
 assert.deepEqual(css.diagnostics,[]);
 const context={method:'ddn',subtype:['discussion'],role:'note',styles:css.rules};
 const standard=resolve({},'definition');assert.equal(standard.values.style.paper,'plain');assert.equal(standard.values.shadow,null);assert.deepEqual(standard.values.decorations,[]);
 const styled=resolve({},'definition',context);assert.deepEqual(styled.diagnostics,[]);assert.equal(styled.values.style.paper,'note');assert.deepEqual(styled.values.shadow,{kind:'centre',color:'#112233'});
 const local={...context,fileDefaults:[{selector:{owner:'definition',role:'note'},declarations:{'style.paper':'pad','shadow.kind':'corners',decorations:[{kind:'paper-clip',color:'#445566'}]}}]};
 const file=resolve({},'definition',local);assert.deepEqual(file.diagnostics,[]);assert.equal(file.values.style.paper,'pad');assert.deepEqual(file.values.shadow,{kind:'corners',color:'#112233'});assert.deepEqual(file.values.decorations,[{kind:'paper-clip',color:'#445566'}]);
 const occurrence=resolve({style:{paper:'plain'},shadow:{color:'#abcdef'},decorations:[]},'appearance',{...local,definition:{role:'note',style:{paper:'pad'},shadow:{kind:'corner'}}});
 assert.deepEqual(occurrence.diagnostics,[]);assert.equal(occurrence.values.style.paper,'plain');assert.deepEqual(occurrence.values.shadow,{kind:'corner',color:'#abcdef'});assert.deepEqual(occurrence.values.decorations,[]);
 const wrong=resolve({},'definition',{...context,method:'chen'});assert.equal(wrong.values.style.paper,'plain');assert.equal(wrong.values.shadow,null);
});

test('short shadow default rules and named document presentation verify through the runtime',async()=>{
 const text=`defaults element as note
    paper note
    shadow centre
element Idea as note
view Workshop as ddn@1
    with
        paper pad
        shadow corners
    use Idea
        with
            decorations
                item
                    kind round-pin
document Handout as pdf
    with
        paper note
        shadow offset
    use Workshop
`;
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{const opened=await runtime.open(sources(text));assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));const report=await runtime.verifier.verifyModel(opened.snapshot,{scope:{kind:'workarea'},purpose:'design',level:'semantic'});assert.equal(report.outcome,'valid',JSON.stringify(report.diagnostics));}finally{runtime.destroy();}
});

test('placed view inherits authored view presentation above CSS and preserves explicit occurrence overrides',async()=>{
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{
  const opened=await runtime.open(sources('erd Board\n    with\n        paper pad\n        shadow centre\n        background.color "#fff2ab"\n    Idea\n'));
  assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const snapshot=structuredClone(opened.snapshot),all=indexRecords(snapshot.normalized),view=all.find(r=>r.owner==='view_definition'),placement=all.find(r=>r.owner==='view_placement');
  const css=parseStylesheet('.method-ddn.subtype-erd { --ddn-style-paper: plain; --ddn-background-color: "#101010"; --ddn-shadow: {"kind":"offset","color":"#123456"}; --ddn-decorations: [{"kind":"push-pin"}]; }');assert.deepEqual(css.diagnostics,[]);
  const base=resolveProperties(snapshot,placement.ref,{styles:css.rules});assert.deepEqual(base.diagnostics,[]);assert.equal(base.values.style.paper,'pad');assert.equal(base.values.background.color,'#fff2ab');assert.deepEqual(base.values.shadow,{kind:'centre',color:'#123456'});assert.deepEqual(base.values.decorations,[{kind:'push-pin'}]);
  assert.equal(base.properties.find(p=>p.path==='style.paper').origin,'file:definition');
  assert.equal(base.properties.find(p=>p.path==='decorations').origin,'css');
  Object.assign(placement.record,{style:{paper:'note'},background:{color:'#abcdef'},shadow:{kind:'corner'},decorations:[]});
  const own=resolveProperties(snapshot,placement.ref,{styles:css.rules});assert.deepEqual(own.diagnostics,[]);assert.equal(own.values.style.paper,'note');assert.equal(own.values.background.color,'#abcdef');assert.deepEqual(own.values.shadow,{kind:'corner',color:'#123456'});assert.deepEqual(own.values.decorations,[]);
  assert.equal(own.properties.find(p=>p.path==='style.paper').origin,'file:occurrence');
  assert.equal(view.record.style.paper,'pad','placement resolution must not mutate its target view');
 }finally{runtime.destroy();}
});

test('placement resolves target view profile and scoped view defaults without inheriting unrelated semantic settings',async()=>{
 const runtime=createRuntime(createCompleteRuntimeOptions());
 try{
  const opened=await runtime.open(sources('view Board as ddn@1\nelement Idea as note\n'));
  assert.ok(opened.snapshot,JSON.stringify(opened.diagnostics));
  const snapshot=structuredClone(opened.snapshot),all=indexRecords(snapshot.normalized),view=all.find(r=>r.owner==='view_definition'),placement=all.find(r=>r.owner==='view_placement');
  view.record.defaults=[{selector:{owner:'view_placement',profile:'ddn@1'},declarations:{'style.paper':'pad','shadow.kind':'centre'}}];
  view.record.role_defaults=[{selector:{owner:'view_placement',profile:'ddn@1'},declarations:{decorations:[{kind:'paper-clip',color:'#234567'}]}}];
  view.record.design={state:'accepted'};
  const css=parseStylesheet('[profile="ddn@1"] { --ddn-style-paper: note; }');assert.deepEqual(css.diagnostics,[]);
  const inherited=resolveProperties(snapshot,placement.ref,{styles:css.rules});assert.deepEqual(inherited.diagnostics,[]);assert.equal(inherited.values.style.paper,'pad');assert.equal(inherited.values.shadow.kind,'centre');assert.deepEqual(inherited.values.decorations,[{kind:'paper-clip',color:'#234567'}]);assert.equal(inherited.values.design,undefined);
  assert.equal(inherited.properties.find(p=>p.path==='style.paper').origin,'file:view defaults');
  view.record.defaults=[];view.record.role_defaults=[];
  const fromCSS=resolveProperties(snapshot,placement.ref,{styles:css.rules});assert.deepEqual(fromCSS.diagnostics,[]);assert.equal(fromCSS.values.style.paper,'note');assert.equal(fromCSS.properties.find(p=>p.path==='style.paper').origin,'css');
 }finally{runtime.destroy();}
});
