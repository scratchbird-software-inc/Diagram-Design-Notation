/* SPDX-License-Identifier: GPL-2.0-or-later. Real Source drawer preview/apply. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "tabs";data m {object a "Existing object";}view v {data:[@m];publication {size:content;}}';
const driver=`<script>(async()=>{
 const lines=[],errors=[],get=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));window.addEventListener('error',e=>errors.push(e.message));
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw Error('Timeout '+label);};
 const check=(ok,label)=>{if(!ok)throw Error(label);lines.push('PASS '+label);};
 const tabs=()=>[...get('ddn-creator-tabs').children],selected=()=>tabs().find(b=>b.getAttribute('aria-selected')==='true'),kinds=()=>[...get('ddn-creator-icons').querySelectorAll('[data-kind]')].map(b=>b.dataset.kind);
 const key=k=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 try{
  await wait(()=>get('ddn-diagram').hasAttribute('data-ddn-rendered'),'boot');DDNTool.setDrawer('creator','open');
  const before=JSON.stringify(DDNTool.getSource().files),family=get('ddn-family-select');family.value='uml';family.dispatchEvent(new Event('change'));
  get('ddn-creator-tabs').style.width='420px';
  check(new Set(tabs().map(b=>b.offsetTop)).size>1,'UML tabs wrap into multiple rows');
  const positions=tabs().map(b=>[b.textContent,b.offsetTop,b.offsetLeft,b.offsetWidth]);
  const cases={structure:['uml.class','uml.interface','uml.enumeration','uml.package'],deployment:['uml.node','uml.device','uml.executionenv','uml.artifact','uml.component'],usecase:['uml.actor','uml.usecase','uml.subject'],profile:['uml.metaclass','uml.stereotype','uml.package']};
  for(const name of ['communication','interaction_overview','timing','usecase','structure','activity','deployment','composite','object','profile','sequence','statemachine']){
   const b=tabs().find(b=>b.textContent===name),r=b.getBoundingClientRect();check(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b,name+' tab is clickable in its row');b.click();
   check(selected().textContent===name&&document.activeElement===selected(),name+' selection and focus update');
   check(JSON.stringify(tabs().map(b=>[b.textContent,b.offsetTop,b.offsetLeft,b.offsetWidth]))===JSON.stringify(positions),name+' keeps row positions stable');
   if(cases[name])check(JSON.stringify(kinds().sort())===JSON.stringify(cases[name].sort()),name+' shows its own preset');
   if(name==='activity')check(kinds().includes('flow.decision')&&!kinds().includes('uml.class'),'Activity shows flow options');
   if(name==='interaction_overview')check(kinds().includes('flow.subprocess')&&!kinds().includes('uml.class'),'Interaction overview shows flow options');
   if(name==='statemachine')check(kinds().includes('state.initial')&&!kinds().includes('uml.class'),'State Machine shows state options');
  }
  key('Home');check(selected().textContent==='All'&&kinds().includes('uml.class')&&kinds().includes('state.state')&&kinds().includes('flow.process'),'Home selects the combined palette');
  key('ArrowRight');check(selected().textContent==='activity','Right updates selection and content');
  const top=selected().offsetTop;key('ArrowDown');check(selected().offsetTop!==top,'Down navigates to the next visual row');
  key('ArrowUp');check(selected().offsetTop===top,'Up returns to the previous visual row');
  key('End');check(selected().textContent==='Existing'&&get('ddn-creator-icons').textContent.includes('Existing object'),'End selects existing definitions');
  key('ArrowRight');check(selected().textContent==='All','Right wraps from last to first');key('ArrowLeft');check(selected().textContent==='Existing','Left wraps from first to last');
  check(tabs().filter(b=>b.tabIndex===0).length===1,'only the selected tab is in the keyboard tab order');
  tabs().find(b=>b.textContent==='usecase').click();const search=get('ddn-palette-search');search.value='class';search.dispatchEvent(new Event('input'));check(kinds().includes('uml.class'),'search spans the family');search.value='';search.dispatchEvent(new Event('input'));check(selected().textContent==='usecase'&&kinds().includes('uml.usecase'),'clearing search restores the selected preset');
  check(JSON.stringify(DDNTool.getSource().files)===before,'palette navigation does not modify source or view type');
  check(!errors.length,'no browser errors: '+errors.join('; '));await fetch('/result',{method:'POST',body:JSON.stringify({pass:true,lines})});
 }catch(e){lines.push('FAIL '+e.stack);await fetch('/result',{method:'POST',body:JSON.stringify({pass:false,lines})});}
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
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'creator tabs test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Creator tabs browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
