import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output=process.env.DDN_BUILD_ROOT ?? resolve('.work/builds/ddn');
const execution=await import(pathToFileURL(resolve(output,'ddn/packages/execution/src/index.js')));
const registry=await import(pathToFileURL(resolve(output,'ddn/packages/runtime/src/registry.js')));
const versions={api:'1.0',language:'ddn-next-1',defaults:'ddn-next-1',packs:{}};
test('portable SHA-256 matches independently implemented UTF-8 vectors',()=>{
  for(const value of ['', 'abc', '𐐷 café\n'.repeat(100),'a'.repeat(100000),'\ud800']) assert.equal(execution.sha256(value),createHash('sha256').update(value).digest('hex'));
  assert.equal(execution.fingerprint({b:2,a:1}),execution.fingerprint({a:1,b:2}));
});
test('accounting distinguishes cancellation, resource exhaustion and completion',async()=>{
  const cancelled=execution.createContext(versions,{cancel:{aborted:true,onAbort(){return ()=>{};}}});
  await assert.rejects(cancelled.checkpoint(1),error=>error.outcome==='cancelled');
  const bounded=execution.createContext(versions,{budget:{elapsedMs:10000,workUnits:2,memoryBytes:50}});
  await bounded.checkpoint(2);
  await assert.rejects(bounded.checkpoint(1),error=>error.outcome==='budget-exceeded');
  const memory=execution.createContext(versions,{budget:{elapsedMs:10000,workUnits:10,memoryBytes:50}});
  assert.throws(()=>memory.accountMemory(51),error=>error.outcome==='budget-exceeded');
});
test('trusted pack registration is atomic, versioned and isolated between runtimes',()=>{
  const a=registry.createRegistry(versions),b=registry.createRegistry(versions);
  const pack={manifest:{id:'native',version:'1',api:'1.0',hash:'sha256-test',languages:['ddn-next-1'],defaults:['ddn-next-1'],profiles:[],dependencies:[],capabilities:['verify']},registrations:{}};
  a.install(pack);a.install(pack);assert.equal(a.describe().length,1);assert.equal(b.supports('verify'),false);
  assert.throws(()=>a.install({...pack,manifest:{...pack.manifest,hash:'changed'}}),/duplicate/);
  assert.throws(()=>a.install({...pack,manifest:{...pack.manifest,id:'bad',dependencies:['missing']}}),/dependency/);
  assert.equal(a.describe().length,1);
  pack.manifest.capabilities.push('execute');assert.equal(a.supports('execute'),false);
  assert.throws(()=>a.describe()[0].capabilities.push('execute'),TypeError);
});
