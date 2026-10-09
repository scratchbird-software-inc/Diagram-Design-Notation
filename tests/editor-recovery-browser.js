/* SPDX-License-Identifier: GPL-2.0-or-later. Real Source drawer preview/apply. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "recovery";data m {object a "Actor" {kind:"archi.business_actor";}object b "Process" {kind:"archi.business_process";}}view v {data:[@m];projection {kind:graph;profile:"archimate.basic@1";}publication {size:content;}place @m.b {at:[400px,100px];}}';
const driver=`<script>(async()=>{
 const lines=[],errors=[];window.addEventListener('error',e=>errors.push(e.message));
 const sleep=ms=>new Promise(r=>setTimeout(r,ms)),get=id=>document.getElementById(id);
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw new Error('Timeout: '+label+' / '+get('ddn-tool-status')?.textContent+' / drag '+get('ddn-drag-mode').checked+' / '+get('ddn-source-error').textContent+' / '+JSON.stringify(errors));};
 const check=(v,label)=>{if(!v)throw new Error(label);lines.push('PASS '+label);};
 try{
  await wait(()=>get('ddn-diagram').hasAttribute('data-ddn-rendered'),'initial diagram');
  const diagram=get('ddn-diagram').firstElementChild,ws=diagram.ws;
  get('ddn-drag-mode').checked=true;
  const before=DDNTool.getSource().files,history=ws.history();
  const drag=(id,dx,dy,end='pointerup')=>{
   const node=[...diagram.shadowRoot.querySelectorAll('.ddn-node')].find(n=>n.dataset.id===id),canvas=diagram.shadowRoot.querySelector('.canvas');
   const m=node.closest('svg').querySelector('g[id$="drawing"]').getScreenCTM(),box=node.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
   const fire=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,button:0,pointerId:1,clientX:x,clientY:y}));
   fire(node,'pointerdown',x,y);fire(canvas,'pointermove',x+m.a*dx+m.c*dy,y+m.b*dx+m.d*dy);fire(canvas,end,x+m.a*dx+m.c*dy,y+m.b*dx+m.d*dy);
  };
  const a=diagram.result.scene.nodes.find(n=>n.id==='recovery::m.a'),b=diagram.result.scene.nodes.find(n=>n.id==='recovery::m.b');
  drag(a.id,80,80,'pointercancel');
  check(JSON.stringify(ws.getFiles())===JSON.stringify(before),'cancelled drag preserves source');
  drag(a.id,b.x-a.x,b.y-a.y);
  await wait(()=>get('ddn-action-error')?.open,'overlap dialog');
  check(get('ddn-action-error').textContent.includes('DDN204'),'overlap reason is descriptive');
  check(JSON.stringify(DDNTool.getSource().files)===JSON.stringify(before),'failed drag leaves source unchanged');
  check(JSON.stringify(ws.history())===JSON.stringify(history),'failed drag preserves undo and redo');
  check(!diagram.shadowRoot.querySelector('.canvas').classList.contains('stale'),'diagram remains usable');
  get('ddn-action-error').querySelector('button').click();check(!get('ddn-action-error').open,'OK dismisses modal');
  drag(a.id,700,300);await wait(()=>ws.history().canUndo&&diagram.result?.scene.nodes.find(n=>n.id===a.id)?.x>a.x+500,'valid move after failure');
  check(true,'valid move succeeds after rejected move');
  const good=ws.getFiles(),goodHistory=ws.history();
  DDNLive.authoring.pin(ws,'m.ddn','v',a.id,b.x,b.y);
  await wait(()=>get('ddn-action-error')?.open,'asynchronous overlap dialog');
  check(get('ddn-action-error').textContent.includes('DDN204'),'asynchronous overlap reports layout reason');
  await wait(()=>diagram.result&&!diagram.shadowRoot.querySelector('.canvas').classList.contains('stale'),'overlap recovery');
  check(JSON.stringify(ws.getFiles())===JSON.stringify(good),'asynchronous overlap restores previous positions');
  check(JSON.stringify(ws.history())===JSON.stringify(goodHistory),'asynchronous overlap leaves no rejected history');
  get('ddn-action-error').querySelector('button').click();
  ws.updateFiles({'m.ddn':'invalid source'});
  await wait(()=>get('ddn-action-error')?.open,'asynchronous failure dialog');
  await wait(()=>diagram.result&&!diagram.shadowRoot.querySelector('.canvas').classList.contains('stale'),'render recovery');
  check(JSON.stringify(ws.getFiles())===JSON.stringify(good),'asynchronous failure restores source');
  check(JSON.stringify(ws.history())===JSON.stringify(goodHistory),'asynchronous failure restores exact history');
  check(!diagram.shadowRoot.querySelector('[data-action="svg"]').disabled,'restored diagram can export');
  get('ddn-action-error').querySelector('button').click();
  const oldOptions=JSON.stringify(diagram.options),render=ws.render;
  let calls=0;ws.render=function(options){if(!calls++)return Promise.reject(Object.assign(new Error('Simulated renderer failure'),{code:'TEST-RENDER'}));return render.call(this,options);};
  diagram.setOptions({theme:'forest'}).catch(()=>{});
  await wait(()=>get('ddn-action-error')?.open,'presentation failure dialog');
  await wait(()=>diagram.result&&!diagram.shadowRoot.querySelector('.canvas').classList.contains('stale'),'presentation recovery');
  check(JSON.stringify(diagram.options)===oldOptions,'failed presentation setting is rolled back');
  check(JSON.stringify(ws.getFiles())===JSON.stringify(good),'presentation recovery preserves source');ws.render=render;
  get('ddn-action-error').querySelector('button').click();
  get('ddn-undo').click();await wait(()=>JSON.stringify(ws.getFiles())===JSON.stringify(before),'undo last valid move');
  check(!errors.length,'no browser errors: '+errors.join('; '));
  await fetch('/result',{method:'POST',body:JSON.stringify({pass:true,lines})});
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
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'designer recovery test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Designer recovery browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
