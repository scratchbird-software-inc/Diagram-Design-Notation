/* SPDX-License-Identifier: GPL-2.0-or-later. Real Source drawer preview/apply. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const fixture='ddn "0.7";module "toolbar";data m {object a "Alpha";object b "Beta";object c "Free" {fields {field id {datatype:"int";}}text {italic:true;}}relation r @a -> @b;}view v {data:[@m];publication {size:content;}}';
const driver=`<script>(async()=>{
 const lines=[],errors=[],get=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));window.addEventListener('error',e=>errors.push(e.message));window.confirm=()=>true;
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw Error('Timeout '+label+' / '+get('ddn-action-error')?.textContent);};
 const check=(ok,label)=>{if(!ok)throw Error(label);lines.push('PASS '+label);};
 const diagram=()=>get('ddn-diagram').firstElementChild;
 const node=id=>[...diagram().shadowRoot.querySelectorAll('.ddn-node')].find(n=>n.dataset.id===id);
 const choose=pin=>{get('ddn-pointer-toggle').click();const button=get(pin?'ddn-pin-arrow':'ddn-select-arrow'),box=button.getBoundingClientRect();check(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)===button,'arrow popup is visible and clickable');button.click();};
 const click=id=>node(id).dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
 const drag=(id,dx,dy)=>{const n=node(id),canvas=diagram().shadowRoot.querySelector('.canvas'),m=n.closest('svg').querySelector('g[id$="drawing"]').getScreenCTM(),box=n.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
  const fire=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,button:0,pointerId:1,clientX:x,clientY:y}));fire(n,'pointerdown',x,y);fire(canvas,'pointermove',x+m.a*dx+m.c*dy,y+m.b*dx+m.d*dy);fire(canvas,'pointerup',x+m.a*dx+m.c*dy,y+m.b*dx+m.d*dy);};
 try{
  await wait(()=>get('ddn-diagram').hasAttribute('data-ddn-rendered'),'boot');
  await DDNTool.setSource({'m.ddn':${JSON.stringify(fixture)},'notes.ddnn':JSON.stringify({format:'ddnn@1',documents:{note:{format:'plain',text:'Keep all notes'}}})},{entry:'m.ddn',view:'v'});
  DDNTool.setDrawer('creator','open');
  for(const id of ['pointer-toggle','tidy','creator-new','creator-save','creator-saveas','cut','copy','clipboard-paste','creator-delete','bold-toggle','italic-toggle','strike-toggle','underline-toggle'])check(!!get('ddn-'+id),'toolbar provides '+id);
  choose(false);check(get('ddn-pointer-toggle').dataset.mode==='select'&&!get('ddn-drag-mode').checked,'Select arrow has distinct mode');
  const before=JSON.stringify(DDNTool.getSource().files);drag('toolbar::m.a',400,300);check(JSON.stringify(DDNTool.getSource().files)===before,'Select arrow does not move elements');
  choose(true);await sleep(250);await diagram().ready;
  const positions=diagram().result.scene.nodes.map(n=>({id:n.id,x:n.x,y:n.y})),routes=JSON.stringify(diagram().result.scene.routes);
  drag('toolbar::m.a',700,300);await wait(()=>DDNTool.getSource().files['m.ddn'].includes('place @m.a'),'pin source');await diagram().ready;
  for(const old of positions.filter(n=>n.id!=='toolbar::m.a')){const next=diagram().result.scene.nodes.find(n=>n.id===old.id);check(next.x===old.x&&next.y===old.y,'Pin arrow keeps '+old.id+' fixed');}
  check(JSON.stringify(diagram().result.scene.routes)!==routes,'Pin arrow recomputes relation paths');
  click('toolbar::m.c');for(const id of ['bold','italic','strike','underline']){get('ddn-'+id+'-toggle').click();check(get('ddn-'+id+'-toggle').getAttribute('aria-pressed')==='true',id+' toggles on');}
  check(diagram().shadowRoot.querySelector('#ddn-tool-overrides').textContent.includes('text-decoration: underline line-through'),'underline and strikethrough combine');
  let picks=0,writes=[],closed=0;window.showSaveFilePicker=async()=>{picks++;return{name:'saved-'+picks+'.zip',createWritable:async()=>({write:async bytes=>writes.push(bytes),close:async()=>closed++,abort:async()=>{}})}};
  get('ddn-creator-save').click();await wait(()=>closed===1,'first save');get('ddn-creator-save').click();await wait(()=>closed===2,'repeat save');check(picks===1,'Save reuses the chosen local file');
  get('ddn-creator-saveas').click();await wait(()=>closed===3,'Save As');check(picks===2,'Save As chooses a new destination');
  window.showSaveFilePicker=async()=>{throw new DOMException('Cancelled','AbortError');};get('ddn-creator-saveas').click();await wait(()=>!get('ddn-creator-saveas').disabled,'cancel save');check(writes.length===3&&!get('ddn-action-error')?.open,'cancelled Save As changes nothing');
  let aborted=false;window.showSaveFilePicker=async()=>({name:'failed.zip',createWritable:async()=>({write:async()=>{throw Error('Disk write failed');},close:async()=>{},abort:async()=>{aborted=true;}})});
  get('ddn-creator-saveas').click();await wait(()=>get('ddn-action-error')?.open,'save failure dialog');check(aborted&&get('ddn-action-error').textContent.includes('Disk write failed'),'failed save aborts and explains the error');get('ddn-action-error').querySelector('button').click();
  get('ddn-creator-save').click();await wait(()=>closed===4,'retry save');check(picks===2,'failed Save As keeps the previous save destination');
  const file=new File([writes.at(-1)],'saved.zip',{type:'application/zip'}),saved=await DDNLive.io.open([file]);check(saved.files['notes.ddnn'].includes('Keep all notes'),'Save includes DDNN sidecars');check(Object.values(saved.snapshot.toolPresentation.typography).some(t=>t.bold&&t.italic&&t.strike&&t.underline),'Save includes formatting');
  const dt=new DataTransfer();dt.items.add(file);get('ddn-file-input').files=dt.files;const oldDiagram=diagram();get('ddn-file-input').dispatchEvent(new Event('change'));await wait(()=>diagram()!==oldDiagram&&diagram().result,'reopen saved workspace');
  check(diagram().shadowRoot.querySelector('#ddn-tool-overrides').textContent.includes('underline line-through'),'saved typography restores on open');
  for(const old of positions.filter(n=>n.id!=='toolbar::m.a')){const next=diagram().result.scene.nodes.find(n=>n.id===old.id);check(next.x===old.x&&next.y===old.y,'saved retained positions restore for '+old.id);}
  click('toolbar::m.c');get('ddn-copy').click();get('ddn-clipboard-paste').click();await wait(()=>diagram().result?.scene.nodes.length===4,'paste');check(true,'Copy/Paste creates a new element');check((DDNTool.getSource().files['m.ddn'].match(/datatype:/g)||[]).length===2,'Copy/Paste preserves nested fields');
  get('ddn-creator-delete').click();await wait(()=>diagram().result?.scene.nodes.length===3,'delete');check(true,'Delete removes the selected copy');
  click('toolbar::m.c');get('ddn-cut').click();await wait(()=>diagram().result?.scene.nodes.length===2,'cut');check(true,'Cut removes an unreferenced selection');get('ddn-undo').click();await wait(()=>diagram().result?.scene.nodes.length===3,'undo cut');
  let downloaded='';const anchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};window.showSaveFilePicker=undefined;window.prompt=()=> 'fallback-project';get('ddn-creator-saveas').click();await wait(()=>downloaded,'download fallback');HTMLAnchorElement.prototype.click=anchorClick;check(downloaded==='fallback-project.ddn-workspace.zip','Save As falls back to a named client-side download');
  window.confirm=()=>false;get('ddn-tidy').click();await sleep(400);await diagram().ready;check(!!diagram().result&&!get('ddn-action-error')?.open,'Tidy completes');
  get('ddn-creator-new').click();check(!get('ddn-template-popup').hidden,'New opens template choices');
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
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'creator toolbar test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Creator toolbar browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
