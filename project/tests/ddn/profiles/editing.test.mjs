import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceSet } from './fixtures.mjs';
const output = process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const load = name => import(pathToFileURL(resolve(output, `ddn/packages/${name}/src/index.js`)));
const { createRuntime, createCompleteRuntimeOptions, createNativeRuntimeOptions, createCommandService } = await load('runtime');
const { completeProfileIds, getProfile } = await load('profiles');
const { listRecords } = await load('model');
const { decodeSources } = await load('language');
const authority = { authorize: async () => ({ allowed: true, principal: 'author', grants: ['model.edit'] }) };
const apply = async (commands, intent) => { const p = await commands.prepare(intent); assert.equal(p.ok,true,JSON.stringify(p)); const result = await commands.commit(p.command.id); assert.equal(result.ok,true,JSON.stringify(result)); return result; };
for (const profile of completeProfileIds) test(`draft view can be created and edited progressively: ${profile}`, async () => {
    const runtime = createRuntime(createCompleteRuntimeOptions());
    try {
        const opened = await runtime.open(sourceSet('workarea Main\n'));
        assert.ok(opened.snapshot);
        const commands = createCommandService(runtime, authority), target = listRecords(runtime.snapshot().normalized).find(r => r.kind === 'workarea').ref;
        await apply(commands, { kind: 'profile-command', command: 'ddn.add-view', profile, target, arguments: { name: 'NewView', profile } });
        const view = listRecords(runtime.snapshot().normalized).find(r => r.kind === 'view');
        assert.equal(view.record.profile, profile);
        const role = getProfile(profile).primary_palette[0];
        if (role) await apply(commands, { kind: 'profile-command', command: 'ddn.create-element', profile, target: view.ref, arguments: { view: view.ref, role, name: 'FirstItem' } });
        assert.equal((await commands.undo()).ok,true);
        assert.equal((await commands.redo()).ok,true);
        const fresh = decodeSources(runtime.sources());
        assert.equal(fresh.syntaxValid,true,JSON.stringify(fresh.diagnostics));
    } finally { runtime.destroy(); }
});
test('dataset editing preserves physical types, identities, comments and source undo',async()=>{
    const runtime=createRuntime(createCompleteRuntimeOptions());
    try{
        const input=sourceSet('// document comment\ndata Measures\n    with\n        columns\n            item\n                id label\n                type text\n            item\n                id value\n                type number\n        rows\n            item\n                item A\n                item 2\n// next declaration\nview Chart as chart.basic@1\n    with\n        projection.options\n            records Measures\n            x label\n            y value\n            missing gap\n');
        await runtime.open(input);const commands=createCommandService(runtime,authority);
        const target=listRecords(runtime.snapshot().normalized).find(r=>r.kind==='data').ref;
        await apply(commands,{kind:'profile-command',command:'ddn.set-records',profile:'chart.basic@1',target,arguments:{columns:[{id:'label',type:'text'},{id:'value',type:'number'}],rows:[['A',2.5],['B',null],['',0]]}});
        const after=runtime.sources();assert.ok(after.files[0].text.includes('// document comment'));assert.ok(after.files[0].text.includes('// next declaration'));
        const fresh=decodeSources(after),data=listRecords(fresh.normalized).find(r=>r.kind==='data');assert.equal(data.ref.id,target.id);assert.deepEqual(data.record.rows,[['A',2.5],['B',null],['',0]]);
        assert.equal((await commands.undo()).ok,true);assert.equal(runtime.sources().files[0].text,input.files[0].text);
    }finally{runtime.destroy();}
});
test('native command installation does not grant uninstalled full-profile commands',async()=>{
    const runtime=createRuntime(createNativeRuntimeOptions());try{await runtime.open(sourceSet('workarea Main\n'));const commands=createCommandService(runtime,authority);const result=await commands.prepare({kind:'profile-command',command:'ddn.add-view',profile:'uml.structure@2',target:{file:'main.ddn',id:''},arguments:{name:'Foreign',profile:'uml.structure@2'}});assert.equal(result.ok,false);assert.equal(result.failure.code,'unsupported');}finally{runtime.destroy();}
});
