/* SPDX-License-Identifier: GPL-2.0-or-later. Host callback DDNN resolution. */
'use strict';
const assert=require('node:assert/strict'),A=require('../dist/ddn.global.js'),L=require('../tool/src/document-loader.js');
const src=path=>'ddn "0.7";module "m";data d {object a {kind:object;document {file:"'+path+'";id:"body";}}} view v {data:[@d];publication {size:content;}}';
const note=JSON.stringify({format:'ddnn@1',documents:{body:{format:'plain',text:'Full stored text'}}});
const load=(files,callback,signal)=>L.resolveDocuments(files,{parse:A.parse,read:A.documentFormats.read,load:callback,signal});
(async()=>{let count=0;
const test=async(n,f)=>{await f();count++;console.log('PASS',n);};
await test('missing local path requests host once and preserves supplied sources',async()=>{const files={'m.ddn':src('notes.ddnn')};let calls=0;const out=await load(files,r=>{calls++;assert.equal(r.path,'notes.ddnn');assert.equal(r.references[0].id,'body');return note;});assert.equal(calls,1);assert.equal(out['notes.ddnn'],note);assert.equal(files['notes.ddnn'],undefined);});
await test('supplied DDNN never invokes callback',async()=>{await load({'m.ddn':src('notes.ddnn'),'notes.ddnn':note},()=>{throw Error('called');});});
await test('relative paths resolve inside workspace',async()=>{const out=await load({'models/m.ddn':src('../notes.ddnn')},r=>{assert.equal(r.path,'notes.ddnn');return note;});assert.ok(out['notes.ddnn']);});
await test('remote URLs and escaping paths never reach callback',async()=>{for(const path of ['https://example.com/n.ddnn','../n.ddnn','/n.ddnn'])await assert.rejects(load({'m.ddn':src(path)},()=>{throw Error('called');}),e=>e.code==='DDN-NT01');});
await test('invalid or missing callback data fails',async()=>{await assert.rejects(load({'m.ddn':src('n.ddnn')},()=>null),e=>e.code==='DDN-NT04');await assert.rejects(load({'m.ddn':src('n.ddnn')},()=>'{bad'));});
await test('abort completes even if host ignores its signal',async()=>{const c=new AbortController(),p=load({'m.ddn':src('n.ddnn')},()=>new Promise(()=>{}),c.signal);c.abort();await assert.rejects(p,e=>e.code==='DDN-T109');});
await test('already-aborted load does not invoke host',async()=>{const c=new AbortController();c.abort();await assert.rejects(load({'m.ddn':src('n.ddnn')},()=>{throw Error('called');},c.signal),e=>e.code==='DDN-T109');});
console.log('Document loader: '+count+'/'+count+' passed');})().catch(e=>{console.error(e);process.exitCode=1;});
