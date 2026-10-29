import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.DDN_BUILD_ROOT||path.resolve('.work/builds/ddn');
const mod=async name=>import(pathToFileURL(path.join(build,'ddn/packages',name,'src/index.js')));
const profiles=await mod('profiles');
const {createCompletePack,createNativePack,completeProfileIds,getProfile,indexRecords,validateSchema,nativeProfileDiagnostics,completeProfileDiagnostics,analyzeDecision,evaluateDecision,evaluateFlatTrace,calculateCriticalPath}=profiles;
const {resolve}=await mod('defaults');
const contracts=JSON.parse(readFileSync('standard/codex/profile-contracts.json','utf8'));
const ref=id=>({file:'main.ddn',id});
const node=(id,role,metadata={},rest={})=>({id,name:id,category:'element',role,metadata,...rest});
const edge=(id,role,from,to,metadata={},rest={})=>({id,name:id,category:'relation',role,endpoints:[{definition:ref(from)},{definition:ref(to)}],metadata,...rest});
function fixture(profile,definitions=[],options={},viewExtra={},data=[]){
 const view={id:'diagram',name:'Diagram',profile,...viewExtra,...(Object.keys(options).length?{projection:{options}}:{})};
 const normalized={version:'ddn-next-1',entry:'main.ddn',files:[{location:'main.ddn',document:{version:'ddn-next-1',workarea:{id:'work',method:'ddn',allow_foreign_views:true},views:[view],definitions,appearances:definitions.map((n,i)=>({id:'a'+i,parent:ref('diagram'),target:ref(n.id)})),...(data.length?{data}:{})}}]};
 const records=indexRecords(normalized);const selected=records.find(r=>r.owner==='view_definition');
 return {normalized,view:selected,records,check:(review=true)=>[...nativeProfileDiagnostics(normalized,selected,records,review),...completeProfileDiagnostics(selected,records,review)]};
}
const codes=report=>report.map(d=>d.code);
const errors=report=>report.filter(d=>d.severity==='error');
const ID='chebotko.conceptual@1',card=(a,b,c,d)=>({from:{min:a,max:b},to:{min:c,max:d}});
const entities=()=>[node('student','entity'),node('course','entity')];

test('Chebotko conceptual is a separate Chen-style method profile',()=>{
 const c=contracts[ID];
 assert.equal(c.inherits,'chen.binary@2');assert.equal(c.method,'MT22');assert.equal(c.projection,'chen');
 assert.deepEqual(c.primary_palette,['entity']);assert.deepEqual(c.relation_roles,['assoc','ref']);
 assert.ok(completeProfileIds.includes(ID));assert.equal(getProfile(ID).id,ID);
});
test('Chebotko conceptual requires explicit cardinality at both ends when reviewed',()=>{
 const complete=fixture(ID,[...entities(),edge('enrols','assoc','student','course',{x_chen:card(0,'many',0,'many')})]);
 assert.deepEqual(errors(complete.check()),[]);
 const missing=fixture(ID,[...entities(),edge('enrols','assoc','student','course',{x_chen:{from:{min:0,max:1}}})]);
 assert.ok(missing.check().some(d=>/min\/max/.test(d.message||'')),JSON.stringify(missing.check()));
});
test('Chebotko conceptual rejects n-ary relationships and member endpoints',()=>{
 const nary=fixture(ID,[...entities(),node('room','entity'),edge('meets','assoc','student','course',{x_chen:card(0,1,0,1),x_nary:{ends:[{element:ref('room')}]}})]);
 assert.ok(codes(nary.check()).includes('DDN-CHEN-NARY'),JSON.stringify(nary.check()));
});
test('Chebotko conceptual rejects roles outside its palette',()=>{
 const f=fixture(ID,[node('t','table')]);
 assert.ok(codes(nativeProfileDiagnostics(f.normalized,f.view,f.records)).includes('DDN-PROFILE-ROLE'));
});
