/* SPDX-License-Identifier: GPL-2.0-or-later. Real Source drawer preview/apply. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "draft";data m {object s {kind:"flow.start";}object e {kind:"flow.end";}relation r @s -> @e {kind:"flow.next";}}view v {data:[@m];projection {kind:graph;profile:"flow.basic@1";}publication {size:content;}}';
const incomplete='ddn "0.7";module "draft";data m {object s {kind:"flow.start";}}view v {data:[@m];projection {kind:graph;profile:"flow.basic@1";}publication {size:content;}}';
const driver=`<script>(async()=>{
 const lines=[],errors=[];window.addEventListener('error',e=>errors.push(e.message));
 const sleep=ms=>new Promise(r=>setTimeout(r,ms)),get=id=>document.getElementById(id);
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw new Error('Timeout: '+label);};
 const check=(v,label)=>{if(!v)throw new Error(label);lines.push('PASS '+label);};
 const input=text=>{get('ddn-source').value=text;get('ddn-source').dispatchEvent(new Event('input'));};
 try{
  await wait(()=>get('ddn-diagram').hasAttribute('data-ddn-rendered'),'initial graph');
  if(get('ddn-drawer-source').dataset.state!=='open')get('ddn-icon-source').click();await wait(()=>get('ddn-drawer-source').dataset.state==='open','source drawer');
  await sleep(400);let changes=0;DDNTool.onSourceChange(()=>changes++);
  get('ddn-live-apply').checked=false;input(${JSON.stringify(incomplete)});get('ddn-preview-edit').click();
  await wait(()=>!get('ddn-edit-preview').hidden,'preview panel');
  check(get('ddn-edit-summary').textContent.includes('Incomplete diagram'),'incomplete requirement is explicit');
  check(get('ddn-edit-picture').srcdoc.includes('DRAFT PREVIEW'),'draft picture is visibly marked');
  check(get('ddn-edit-picture').hasAttribute('sandbox'),'preview frame is sandboxed');
  get('ddn-apply-preview').scrollIntoView({block:'center'});const box=get('ddn-apply-preview').getBoundingClientRect();check(box.height>0&&box.top>=0&&box.bottom<=innerHeight,'apply preview is reachable in the open drawer');
  await sleep(300);check(changes===0,'preview does not emit a source change');
  get('ddn-cancel-preview').click();check(get('ddn-edit-preview').hidden,'cancel closes preview');
  await sleep(250);check(changes===0,'cancel leaves source untouched');
  get('ddn-preview-edit').click();get('ddn-apply-preview').click();
  await wait(()=>get('ddn-action-error')?.open,'error dialog');
  check(get('ddn-action-error').textContent.includes('DDN-PF008'),'dialog describes incomplete source failure');
  await wait(()=>get('ddn-diagram').hasAttribute('data-ddn-rendered'),'automatic recovery');
  check(DDNTool.getSource().files['m.ddn']===${JSON.stringify(fixture)},'failed apply restores full previous source automatically');
  check(get('ddn-redo').disabled,'failed action cannot be redone');
  get('ddn-action-error').querySelector('button').click();check(!get('ddn-action-error').open,'OK closes error dialog');
  input(${JSON.stringify(incomplete)});get('ddn-preview-edit').click();input(${JSON.stringify(fixture)});
  check(get('ddn-edit-preview').hidden,'typing invalidates the preview');
  check(errors.length===0,'no browser errors: '+errors.join('; '));
  await fetch('/result',{method:'POST',body:JSON.stringify({pass:true,lines})});
 }catch(e){lines.push('FAIL '+e.message);await fetch('/result',{method:'POST',body:JSON.stringify({pass:false,lines})});}
})();</script>`;
let resolveResult;const hanging=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/fixtures/m.ddn'){res.end(fixture);return;}
 if(url.pathname==='/hang'){hanging.push(res);return;}
 if(url.pathname==='/result'){let text='';req.on('data',x=>text+=x);req.on('end',()=>{res.end();for(const h of hanging.splice(0))h.end();resolveResult(JSON.parse(text));});return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end();return;}
 let bytes=fs.readFileSync(file);if(file.endsWith('notation/tool/ddn-tool.html'))bytes=Buffer.from(bytes.toString().replace('</body>',()=>driver+'<img src="/hang" hidden>\n</body>'));
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(bytes);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const worker of ['off','on']){
  let timer;const result=new Promise((resolve,reject)=>{resolveResult=resolve;timer=setTimeout(()=>reject(new Error('Browser report timeout')),90000);});
  const chrome=cp.spawn(bin,['--headless','--no-sandbox','--disable-gpu','--window-size=1500,950','--dump-dom',`http://127.0.0.1:${server.address().port}/notation/tool/ddn-tool.html?mode=design&worker=${worker}&src=../../fixtures/m.ddn`],{stdio:'ignore'});
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'designer preview test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Designer preview browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
