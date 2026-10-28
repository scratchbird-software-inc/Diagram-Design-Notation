import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const reference=readFileSync(join(root,'website/guide/ddn-ai-reference.txt'),'utf8');
const built=join(root,'.work/builds/ddn/ddn/packages');
const {decodeSources}=await import(pathToFileURL(join(built,'language/src/index.js')));
const {createVerifier}=await import(pathToFileURL(join(built,'verifier/src/index.js')));
const {createCompleteRuntimeOptions}=await import(pathToFileURL(join(built,'runtime/src/index.js')));
const {completeProfileIds,profileDescriptor}=await import(pathToFileURL(join(built,'profiles/src/index.js')));
const runtimeOptions=createCompleteRuntimeOptions();

test('single AI authoring reference is reproducible and contains closed profile/type inventories',()=>{
    execFileSync('python3',['tooling/website/build-ai-reference.py','--check'],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
    assert.doesNotMatch(reference,/#\/\$defs\//,'normalized schema references must resolve within the document');
    const types=reference.split('\nTYPE DEFINITIONS\n')[1].split('\nEND DDN AUTHORING')[0];
    const labels=[...types.matchAll(/^([^=\s]+)=/gm)].map(m=>m[1]);
    assert.equal(labels.length,new Set(labels).size,'type labels are unique');
    for(const match of reference.matchAll(/"\$type":"([^"]+)"/g))assert.ok(labels.includes(match[1]),match[1]);
    const sets=new Map([...reference.matchAll(/^([ELS]\d+)=(.+)$/gm)].map(m=>[m[1],m[2]]));
    function expand(value,stack=[]){
        if(value==='(none)')return new Set();
        if(sets.has(value)){
            assert.ok(!stack.includes(value),'acyclic role sets');
            return expand(sets.get(value),[...stack,value]);
        }
        const terms=value.split(/ ([+-]) /),result=sets.has(terms[0])?expand(terms[0],stack):new Set(terms[0].split(','));
        for(let i=1;i<terms.length;i+=2)for(const item of terms[i+1].split(','))terms[i]==='+'?result.add(item):result.delete(item);
        return result;
    }
    const rows=[...reference.matchAll(/^([a-z0-9_.]+@\d+) \S+ (E\d+) (L\d+) /gm)];
    assert.deepEqual(rows.map(m=>m[1]).sort(),[...completeProfileIds].sort());
    for(const row of rows){
        const profile=profileDescriptor(row[1]);
        assert.deepEqual([...expand(row[2])].sort(),[...new Set(profile.roles)].sort(),row[1]+' elements');
        assert.deepEqual([...expand(row[3])].sort(),[...new Set(profile.relations)].sort(),row[1]+' relations');
    }
    assert.match(reference,/core::Port additionally permits metadata:/);
    assert.match(reference,/uaf\.strategic@1 excludes flow\.offpage/);
    assert.match(reference,/ANY is arbitrary JSON/);
});

test('the AI reference teaches executable source examples and preserves unfinished draft status',async()=>{
    function section(before,after){
        const start=reference.indexOf(before);assert.ok(start>=0,before);
        const text=reference.slice(start+before.length),end=text.indexOf(after);assert.ok(end>=0,after);
        return text.slice(0,end).trimEnd()+'\n';
    }
    const template=section('Resource images/fonts must exist; asset declarations do not create files. SVG/image symbol and label options are defined in the property types.\n','No interpolation');
    const document=section('No template cycles.\n','Documents are output views;');
    const publication=section('A declaration does not implement or send output.\n','\nGENERATION CHECK');
    const cases={
        minimal:section('Minimal source:\n','\nAn explicit foreign-method'),
        flow:section('An explicit foreign-method view uses its own roles:\n','\nERD recipe uses'),
        fields:section('"primary key" is not a valid key token.\n','\nHeader entry:'),
        named_data:section('If the table cannot fit, the viewer shows a shaded square.\n','The preceding examples'),
        typed_chart:section('To supply numeric/boolean/date records, use typed columns and typed row lists:\n','Use actual column IDs'),
        short_chart:section('For one series the short recipe is enough:\n','\nMINDMAP'),
        mindmap:section('\nMINDMAP\n','The recipe creates'),
        draft:section('\nNOTES, DRAFTS, STATUS\n','Raw blocks end'),
        host:section('\nDATA SOURCES, ASSETS, TEMPLATES, OUTPUT\n','The host must'),
        template,
        document:template+document,
        publication:template+publication,
        scalar_body:'erd Tables\n    Customer\n        fields\n            name\n        with\n            body columns\n',
        csv:'data Totals\n    label.value\n    North.120\ndocument Export as csv\n    use Totals\n',
    };
    const verifier=createVerifier(runtimeOptions);
    try{
        for(const [name,text] of Object.entries(cases)){
            const input={entry:'main.ddn',files:[{id:'main.ddn',text,revision:'1',encoding:'utf-8',writable:true}]};
            const decoded=decodeSources(input);
            assert.equal(decoded.syntaxValid,true,name);
            assert.deepEqual(decoded.diagnostics,[],name);
            const semantic=await verifier.verifySources(input,{scope:{kind:'workarea'},purpose:'design',level:'semantic'});
            assert.equal(semantic.outcome,'valid',name+': '+JSON.stringify(semantic.diagnostics));
            const review=await verifier.verifySources(input,{scope:{kind:'workarea'},purpose:'design',level:'review'});
            assert.equal(review.outcome,name==='draft'?'incomplete':'valid',name+': '+JSON.stringify(review.diagnostics));
        }
    }finally{verifier.destroy();}
});
