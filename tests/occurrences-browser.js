/* SPDX-License-Identifier: GPL-2.0-or-later. Real designer gestures and worker
 * parity for shared model definitions with independently addressed copies. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.6"; module "copies"; data m {object a "Alpha" {kind:table;fields {id;}} object b "Beta" {kind:table;} relation r @a -> @b;} view v {data:[@m];publication {size:content;}}';
const driver=`<script>(async()=>{
 const lines=[],errors=[];window.addEventListener('error',e=>errors.push(e.message));window.confirm=()=>true;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw new Error('Timeout: '+label+'; '+document.getElementById('ddn-tool-status')?.textContent);};
 const stage=()=>{const host=document.getElementById('ddn-diagram');return (host?.shadowRoot||host?.firstElementChild?.shadowRoot)?.querySelector('.stage');};
 const check=(v,label)=>{if(!v)throw new Error(label);lines.push('PASS '+label);};
 const clickNode=id=>{const n=[...stage().querySelectorAll('.ddn-node')].find(n=>n.dataset.id===id);check(!!n,'selectable node '+id);n.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));};
 const button=(scope,label)=>{const b=[...document.querySelectorAll(scope+' button')].find(b=>b.textContent===label);if(!b)throw new Error('Missing button '+label);b.click();};
 const pane='#ddn-inspector-tab-view',a='copies::m.a',a2='occ:'+JSON.stringify(['copies::v',a,2]);
 try{
  await wait(()=>window.DDNTool&&stage(),'boot');DDNTool.loadFiles({'m.ddn':${JSON.stringify(fixture)}},'m.ddn','v');await wait(()=>stage()?.querySelectorAll('.ddn-node').length===2,'fixture');
  clickNode(a);button(pane,'Add another appearance');await wait(()=>stage().querySelectorAll('.ddn-node').length===3,'add appearance');
  check((DDNTool.getSource({single:true}).match(/object a /g)||[]).length===1,'one shared definition after UI copy');
  clickNode(a2);const px=document.querySelector(pane+' [aria-label="Pin x (px)"]'),py=document.querySelector(pane+' [aria-label="Pin y (px)"]');px.value=600;py.value=320;button(pane,'Pin');
  await wait(()=>DDNTool.getSource({single:true}).includes('place @m.a#2'),'pin source');check(!DDNTool.getSource({single:true}).includes('place @m.a {'),'pin only the selected appearance');
  const snap=DDNTool.getSource(),w=DDNLive.createWorkspace(snap.files),r=w.renderSync({entry:snap.entry,view:snap.view});check(r.scene.nodes.find(n=>n.id===a2).x===600,'copy uses its own authored position');check(r.sourceMap[a2].sourceId===a,'copy source map addresses shared definition');w.destroy();
  clickNode(a2);const label=document.querySelector('#ddn-inspector-tab-meaning input');label.value='Shared rename';label.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>[...stage().querySelectorAll('.ddn-node')].filter(n=>n.getAttribute('aria-label')==='Shared rename').length===2,'shared rename');check(true,'meaning edit updates both appearances');
  const rel=[...stage().querySelectorAll('.ddn-rel')].find(n=>n.dataset.id==='copies::m.r');rel.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
  const from=document.querySelector(pane+' [aria-label="Connector copy from appearance"]');from.value=a2;button(pane,'Add connector appearance');await wait(()=>stage().querySelectorAll('.ddn-rel').length===2,'connector copy');check(true,'UI connector copy keeps one semantic relation');
  clickNode(a2);button(pane,'Hide');await wait(()=>stage().querySelectorAll('.ddn-node').length===2&&stage().querySelectorAll('.ddn-rel').length===1,'hide copy');check(DDNTool.getSource({single:true}).includes('object a "Shared rename"'),'hide keeps definition and other appearance');
  document.getElementById('ddn-undo').click();await wait(()=>stage().querySelectorAll('.ddn-node').length===3&&stage().querySelectorAll('.ddn-rel').length===2,'undo hide');check(true,'single undo restores appearance and connector');
  check(!errors.length,'no browser errors: '+errors.join('; '));await fetch('/result',{method:'POST',body:JSON.stringify({pass:true,lines})});
 }catch(e){lines.push('FAIL '+e.message);await fetch('/result',{method:'POST',body:JSON.stringify({pass:false,lines})});}
})();</script>`;
let resolveResult;const hanging=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
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
  const chrome=cp.spawn(bin,['--headless','--no-sandbox','--disable-gpu','--window-size=1500,950','--dump-dom',`http://127.0.0.1:${server.address().port}/notation/tool/ddn-tool.html?mode=design&worker=${worker}`],{stdio:'ignore'});
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'designer occurrence test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Designer occurrence browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
