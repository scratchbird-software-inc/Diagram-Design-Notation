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
const ID='chebotko.logical@1';
const col=(id,properties={},metadata={})=>node(id,'field',metadata,{properties});
const table=(id,cols)=>[node(id,'table',{},{members:cols.map(c=>ref(c.id))}),...cols.map((c,i)=>({...c,content:{parent:ref(id),ordinal:i}}))];
const logical=cols=>{
 const f=fixture(ID,table('by_user',cols)),ids=new Set(cols.map(c=>c.id)),doc=f.normalized.files[0].document;
 doc.appearances=doc.appearances.filter(a=>!ids.has(a.target.id));
 const records=indexRecords(f.normalized),view=records.find(r=>r.owner==='view_definition');
 return {normalized:f.normalized,view,records,check:(review=true)=>[...nativeProfileDiagnostics(f.normalized,view,records,review),...completeProfileDiagnostics(view,records,review)]};
};

test('Chebotko logical is its own table-only method profile',()=>{
 const c=contracts[ID];
 assert.equal(c.method,'MT22');assert.equal(c.inherits,null);assert.deepEqual(c.primary_palette,['table']);assert.deepEqual(c.relation_roles,['ref']);
 assert.ok(completeProfileIds.includes(ID));assert.equal(getProfile(ID).id,ID);
 const f=fixture(ID,[node('e','entity')]);
 assert.ok(codes(nativeProfileDiagnostics(f.normalized,f.view,f.records)).includes('DDN-PROFILE-ROLE'));
});
test('Chebotko logical accepts K, C with direction and S columns',()=>{
 const f=logical([col('user',{key:'partition'}),col('posted',{key:'clustering',sort:'desc'}),col('bio',{},{x_member:{static:true}}),col('tags',{shape:'set',datatype:'text'})]);
 assert.deepEqual(errors(f.check()),[],JSON.stringify(f.check()));
});
test('Chebotko logical needs a partition key when reviewed',()=>{
 const f=logical([col('posted',{key:'clustering'})]);
 assert.ok(f.check().some(d=>d.code==='DDN-PROFILE-INCOMPLETE'&&/partition/.test(d.message)),JSON.stringify(f.check()));
});
test('Chebotko logical rejects nullable, static and collection key columns',()=>{
 const nullable=logical([col('user',{key:'partition',nullable:true})]);
 assert.ok(codes(nullable.check()).includes('DDN-CHEBOTKO-KEY-NULLABLE'));
 const stat=logical([col('user',{key:'partition'},{x_member:{static:true}})]);
 assert.ok(codes(stat.check()).includes('DDN-CHEBOTKO-KEY-STATIC'));
 const coll=logical([col('user',{key:'partition',shape:'map'})]);
 assert.ok(codes(coll.check()).includes('DDN-CHEBOTKO-KEY-COLLECTION'));
});
test('Chebotko logical requires clustering for static columns and limits sort to clustering',()=>{
 const noClustering=logical([col('user',{key:'partition'}),col('bio',{},{x_member:{static:true}})]);
 assert.ok(codes(noClustering.check()).includes('DDN-CHEBOTKO-STATIC'));
 const badSort=logical([col('user',{key:'partition',sort:'asc'})]);
 assert.ok(codes(badSort.check()).includes('DDN-CHEBOTKO-SORT'));
});
