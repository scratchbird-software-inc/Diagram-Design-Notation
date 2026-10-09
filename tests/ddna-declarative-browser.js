/* SPDX-License-Identifier: GPL-2.0-or-later. DDNA generation and verified replay in Chromium. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "initial";data m {object a {kind:object;}}view v {data:[@m];publication {size:content;}}';
const files=Object.fromEntries(['declarative-order.ddn','declarative-order.ddna'].map(f=>[f,fs.readFileSync(path.join(root,'standard/examples',f),'utf8')]));
const tableFiles=Object.fromEntries(['decision-discount.ddn','decision-discount.ddna'].map(f=>[f,fs.readFileSync(path.join(root,'standard/examples',f),'utf8')]));
const driver=`<script>(async()=>{
 const lines=[],errors=[],get=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 window.addEventListener('error',e=>errors.push(e.message));
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw new Error('Timeout: '+label);};
 const check=(v,label)=>{if(!v)throw new Error(label);lines.push('PASS '+label);};
 const stage=()=>{const host=get('ddn-diagram');return (host?.shadowRoot||host?.firstElementChild?.shadowRoot)?.querySelector('.stage');};
 const source=${JSON.stringify(files)},opts={entry:'declarative-order.ddn',view:'main'};
 try{
  await wait(()=>window.DDNTool&&get('ddn-diagram').hasAttribute('data-ddn-rendered'),'initial diagram');
  await DDNTool.setSource(source,opts);DDNTool.setDrawer('animation','open');
  await wait(()=>!get('ddn-exec-run').disabled,'enabled declarative engine');
  get('ddn-exec-run').scrollIntoView({block:'center'});check(get('ddn-exec-run').getBoundingClientRect().height>0,'run control is visible');
  const before=JSON.stringify(DDNTool.getSource().files);
  get('ddn-exec-inputs').value='{"price":7,"quantity":4}';get('ddn-exec-run').click();
  await wait(()=>get('ddn-exec-status').textContent.includes('generated 2 events'),'generated trace');
  check(get('ddn-replay-note').textContent.includes('recomputation matches'),'verified replay uses recorded inputs');
  let saved;const original=DDNLive.io.download;DDNLive.io.download=(name,text)=>{saved={name,doc:JSON.parse(text)};};
  get('ddn-exec-download').click();DDNLive.io.download=original;
  check(saved.name==='declarative-order.ddnatrace.json','download sidecar name');
  check(saved.doc.execution.inputs.price===7&&saved.doc.events[1].keel.result===25.2,'download retains exact inputs and computed result');
  get('ddn-replay-step').click();get('ddn-replay-step').click();
  check(stage().querySelector('[data-id="declarative.order::totals.net"] .ddna-value')?.textContent.includes('25.2'),'replay displays computed value');
  check(JSON.stringify(DDNTool.getSource().files)===before,'generation and replay leave notation source unchanged');
  const carrier=' data recorded { object trace {kind:object; x_trace:{file:"saved.ddnatrace.json";};} }';
  const loaded={...source,'declarative-order.ddna':source['declarative-order.ddna']+carrier};
  DDNTool.addTraceFile('saved.ddnatrace.json',JSON.stringify(saved.doc));await DDNTool.setSource(loaded,opts);
  const picker=get('ddn-replay-source');await wait(()=>[...picker.options].some(o=>o.textContent.includes('saved.ddnatrace.json')),'loaded sidecar');
  picker.value=[...picker.options].find(o=>o.textContent.includes('saved.ddnatrace.json')).value;picker.dispatchEvent(new Event('change'));
  check(get('ddn-replay-note').textContent.includes('recomputation matches'),'downloaded trace reload verifies');
  check(![...picker.options].some(o=>o.value.startsWith('generated:')),'replacing workspace clears generated traces');
  saved.doc.events[0].keel.result=999;DDNTool.addTraceFile('saved.ddnatrace.json',JSON.stringify(saved.doc));picker.dispatchEvent(new Event('change'));
  check(get('ddn-replay-note').textContent.includes('DDN-A007'),'tampered computed result is rejected');
  const qualified={...source,'other.ddn':'ddn "0.7"; module "other"; data totals {object net "Other net" {kind:object;}}',
   'declarative-order.ddn':source['declarative-order.ddn'].replace('architecture project', 'import "other.ddn" as other; architecture project').replace('["declarative-order.ddna"]','["declarative-order.ddna","other.ddn"]').replace('data: [@totals];','data: [@totals, @other.totals];'),
   'declarative-order.ddna':source['declarative-order.ddna'].replace('target: "totals.net"','target: "declarative.order::totals.net"')};
  await DDNTool.setSource(qualified,opts);
  await wait(()=>stage()?.querySelectorAll('.ddn-node').length===3,'two modules with overlapping local IDs');
  get('ddn-exec-inputs').value='{"price":7,"quantity":4}';get('ddn-exec-run').click();get('ddn-replay-step').click();get('ddn-replay-step').click();
  check(stage().querySelector('[data-id="declarative.order::totals.net"] .ddna-value')?.textContent.includes('25.2')&&!stage().querySelector('[data-id="other::totals.net"] .ddna-value'),'qualified replay target does not affect another module');
  await DDNTool.setSource({...source,'declarative-order.ddna':source['declarative-order.ddna'].replaceAll('keel-l0@1','feel')},opts);
  get('ddn-exec-inputs').value='{"price":7,"quantity":4}';get('ddn-exec-run').click();
  check(get('ddn-exec-status').textContent.includes('DDN-A005'),'unsupported language is reported without filtering away its reference');
  await DDNTool.setSource({...source,'declarative-order.ddna':source['declarative-order.ddna'].replace('ddna.em2.dag-l0@1','em5')},opts);
  check(get('ddn-exec-run').disabled&&get('ddn-exec-engine').textContent.includes('DDN-A006'),'unimplemented solver stays explicitly unavailable');
  const tables=${JSON.stringify(tableFiles)},tableOpts={entry:'decision-discount.ddn',view:'main'};
  await DDNTool.setSource(tables,tableOpts);
  get('ddn-exec-inputs').value='{"price":50,"quantity":3}';get('ddn-exec-run').click();
  check(get('ddn-replay-note').textContent.includes('recomputation matches'),'decision table verified replay matches');
  DDNLive.io.download=(name,text)=>{saved={name,doc:JSON.parse(text)};};get('ddn-exec-download').click();DDNLive.io.download=original;
  check(saved.doc.events[1].keel.result===135&&saved.doc.events[1].keel.table.selected[0]==='discounted','table selects discount and records row evidence');
  get('ddn-replay-step').click();get('ddn-replay-step').click();
  check(stage().querySelector('[data-id="declarative.order::totals.net"] .ddna-value')?.textContent.includes('135'),'table result displays on target');
  const tableLoaded={...tables,'decision-discount.ddna':tables['decision-discount.ddna']+carrier};
  DDNTool.addTraceFile('saved.ddnatrace.json',JSON.stringify(saved.doc));await DDNTool.setSource(tableLoaded,tableOpts);
  picker.value=[...picker.options].find(o=>o.textContent.includes('saved.ddnatrace.json')).value;picker.dispatchEvent(new Event('change'));
  check(get('ddn-replay-note').textContent.includes('recomputation matches'),'downloaded table sidecar reload verifies');
  saved.doc.events[1].keel.table.selected=[];DDNTool.addTraceFile('saved.ddnatrace.json',JSON.stringify(saved.doc));picker.dispatchEvent(new Event('change'));
  check(get('ddn-replay-note').textContent.includes('DDN-A007'),'altered selected-row evidence fails verification');
  await DDNTool.setSource({...tables,'decision-discount.ddna':tables['decision-discount.ddna'].replace('hit_policy: first','hit_policy: unique')},tableOpts);
  get('ddn-exec-inputs').value='{"price":50,"quantity":3}';get('ddn-exec-run').click();
  check(get('ddn-exec-status').textContent.includes('DDN-A009'),'overlapping unique table produces visible diagnostic');
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
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'DDNA declarative test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('DDNA declarative browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
