/* SPDX-License-Identifier: GPL-2.0-or-later. Real Source drawer preview/apply. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "context";data m {object a "Alpha";object b "Beta";}view v {data:[@m];publication {size:content;}}';
const driver=`<script>(async()=>{
 const lines=[],errors=[],get=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));window.addEventListener('error',e=>errors.push(e.message));window.confirm=()=>true;
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw Error('Timeout '+label+' / '+get('ddn-action-error')?.textContent);};
 const check=(ok,label)=>{if(!ok)throw Error(label);lines.push('PASS '+label);};
 const diagram=()=>get('ddn-diagram').firstElementChild,root=()=>diagram().shadowRoot;
 const node=id=>[...root().querySelectorAll('.ddn-node')].find(n=>n.dataset.id===id);
 const context=el=>{const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,composed:true,button:2,clientX:r.x+20,clientY:r.y+20}));};
 const activate=label=>{
  const button=[...root().querySelectorAll('.ddn-ctx button')].find(b=>b.textContent===label);if(!button)throw Error('Missing context item '+label);
  button.scrollIntoView({block:'nearest'});const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  check(root().elementFromPoint(x,y)===button,'context item is reachable: '+label);
  for(const type of ['pointerdown','pointermove','pointerup'])button.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,button:0,pointerId:1,clientX:x,clientY:y}));
  button.click();check(!root().querySelector('#ddn-rubberband'),'menu does not start canvas selection');
 };
 try{
  await wait(()=>get('ddn-diagram').hasAttribute('data-ddn-rendered'),'boot');
  for(const pin of [false,true]){
   await DDNTool.setSource({'m.ddn':${JSON.stringify(fixture)}},{entry:'m.ddn',view:'v'});
   get('ddn-pointer-toggle').click();get(pin?'ddn-pin-arrow':'ddn-select-arrow').click();const mode=pin?'Pin':'Select';
   const before=DDNTool.getSource().files['m.ddn'];context(node('context::m.a'));activate('Link to…');activate('Beta (object)');
   check(DDNTool.getSource().files['m.ddn']===before,mode+' menu navigation leaves source intact');
   const verb=[...root().querySelectorAll('.ddn-ctx button')].find(b=>b.textContent.endsWith('(assoc)'));activate(verb.textContent);
   await wait(()=>diagram().result?.scene.routes.length===1,mode+' Link-to');check(true,mode+' Link-to creates a relation');
   context(root().querySelector('.ddn-rel'));activate('Reverse relation');await wait(()=>diagram().ws.resolve('m.ddn','v').relations[0].from.element==='context::m.b',mode+' reverse');await diagram().ready;check(true,mode+' relation context action works');
   context(node('context::m.a'));activate('Pin here');await wait(()=>DDNTool.getSource().files['m.ddn'].includes('place @m.a'),mode+' pin');await diagram().ready;
   context(node('context::m.a'));activate('Unpin');await wait(()=>!DDNTool.getSource().files['m.ddn'].includes('place @m.a'),mode+' unpin');await diagram().ready;check(true,mode+' pin/unpin context actions work');
   DDNTool.startPlacement('object');const beforeProperties=DDNTool.getSource().files['m.ddn'];context(node('context::m.b'));activate('Properties');check(DDNTool.getSource().files['m.ddn']===beforeProperties,mode+' menu click does not place an armed element');DDNTool.cancelDesignGesture();check(get('ddn-drawer-properties').dataset.state==='open',mode+' Properties opens');
   context(node('context::m.b'));activate('Duplicate definition');await wait(()=>diagram().result?.scene.nodes.length===3,mode+' duplicate');check(true,mode+' Duplicate works');get('ddn-undo').click();await wait(()=>diagram().result?.scene.nodes.length===2,mode+' undo duplicate');
   context(node('context::m.a'));activate('Link to…');activate(DDNLive.kinds.find(k=>k.id==='object').label+' (object)');activate([...root().querySelectorAll('.ddn-ctx button')].find(b=>b.textContent.endsWith('(assoc)')).textContent);
   await wait(()=>diagram().result?.scene.nodes.length===3&&diagram().result?.scene.routes.length===2,mode+' Link-to new element');check(true,mode+' Link-to can create a new target');get('ddn-undo').click();await wait(()=>diagram().result?.scene.nodes.length===2&&diagram().result?.scene.routes.length===1,mode+' undo new link');check(true,mode+' undo removes new target and relation together');
   const label=node('context::m.b');label.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,composed:true}));const input=root().querySelector('.ddn-inline-edit');check(!!input,mode+' inline editor opens');
   input.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,button:0,pointerId:1}));input.click();check(input.isConnected,mode+' inline input receives clicks');input.value='Beta renamed';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(()=>DDNTool.getSource().files['m.ddn'].includes('Beta renamed'),mode+' rename');await diagram().ready;
  }
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
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'context menu test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Context menu browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
