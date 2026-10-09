/* SPDX-License-Identifier: GPL-2.0-or-later. Composed sections, sidecars and scrolling in the real tool. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bin=require('./browser').findBrowser();
const body=Array.from({length:250},(_,i)=>'source_line_'+i+' '+('x'.repeat(160))).join('\n');
const fixture='ddn "0.7";\nmodule "sections";\ndata m { procedure p "Procedure" { fields {input {parameter_mode:in;} output {parameter_mode:out;} } document {file:"project.ddnn";id:"body";} composition {note_height:80;note_wrap:off;} } }\nview v {data:[@m];publication {size:content;}}';
const side=JSON.stringify({format:'ddnn@1',documents:{body:{format:'code',role:'procedure_source',text:body}}});
const driver=`<script>(async()=>{
 const lines=[],errors=[];window.addEventListener('error',e=>errors.push(e.message));window.confirm=()=>true;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const wait=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await sleep(100);}throw new Error('Timeout: '+label+'; '+document.getElementById('ddn-tool-status')?.textContent);};
 const stage=()=>{const host=document.getElementById('ddn-diagram');return (host?.shadowRoot||host?.firstElementChild?.shadowRoot)?.querySelector('.stage');};
 const check=(v,label)=>{if(!v)throw new Error(label);lines.push('PASS '+label);};
 const button=(scope,label)=>{const b=[...document.querySelectorAll(scope+' button')].find(b=>b.textContent===label);if(!b)throw new Error('Missing button '+label);b.click();};
 const select=()=>stage().querySelector('.ddn-node').dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
 const inspect=()=>{const s=DDNTool.getSource(),w=DDNLive.createWorkspace(s.files);try{return w.renderSync({entry:s.entry,view:s.view});}finally{w.destroy();}};
 try{
  await wait(()=>window.DDNTool&&stage(),'boot');check(Object.keys(DDNTool.getSource().files).some(f=>f.endsWith('project.ddnn')),'URL source loading fetches DDNN dependency');DDNTool.loadFiles({'m.ddn':${JSON.stringify(fixture)},'project.ddnn':${JSON.stringify(side)}},'m.ddn','v');await wait(()=>stage()?.querySelector('.ddn-note-window'),'fixture');
  let note=stage().querySelector('.ddn-note-window');check(note.querySelectorAll('[role=scrollbar]').length===2,'both horizontal and vertical scrollbars');check(note.querySelectorAll('.ddn-note-content text').length<20,'SVG emits a bounded text window');check(!note.textContent.includes('source_line_249'),'last line initially outside viewport');
  note.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));check(note.textContent.includes('source_line_249'),'keyboard scroll reaches final line');
  note.dispatchEvent(new WheelEvent('wheel',{deltaX:120,bubbles:true,cancelable:true}));check(Number(note.querySelector('[aria-orientation=horizontal]').getAttribute('aria-valuenow'))>0,'horizontal wheel scroll moves content');
  check(JSON.parse(DDNTool.getSource().files['project.ddnn']).documents.body.text===${JSON.stringify(body)},'scrolling preserves complete source');
  select();const pane='#ddn-inspector-tab-view',order=document.querySelector(pane+' [aria-label="appearance section order"]');order.value='notes-first';button(pane,'Apply sections');await wait(()=>DDNTool.getSource().files['m.ddn'].includes('place @m.p'),'order source');await sleep(150);let r=inspect(),n=r.scene.nodes[0];check(n.noteViewport.top<n.fieldRows[0].top,'notes above parameter table');
  select();document.querySelector(pane+' [aria-label="appearance section notes"]').checked=false;document.querySelector(pane+' [aria-label="appearance section table"]').checked=false;button(pane,'Apply sections');await wait(()=>!stage().querySelector('.ddn-note-window'),'hide body sections');check(!stage().querySelector('.ddn-field'),'name/type only');check(JSON.parse(DDNTool.getSource().files['project.ddnn']).documents.body.text===${JSON.stringify(body)},'hidden note still stores complete text');
  document.getElementById('ddn-undo').click();await wait(()=>stage().querySelector('.ddn-note-window'),'undo sections');check(!!stage().querySelector('.ddn-field'),'undo restores table and notes together');
  select();const meaning='#ddn-inspector-tab-meaning';document.querySelector(meaning+' [aria-label="Document text"]').value='Changed source\\n  exact text';button(meaning,'Save document');await wait(()=>JSON.parse(DDNTool.getSource().files['project.ddnn']).documents.body.text==='Changed source\\n  exact text','document save');check(DDNTool.getSource().files['m.ddn'].includes('project.ddnn'),'text edit retains sidecar association');
  document.getElementById('ddn-undo').click();await wait(()=>JSON.parse(DDNTool.getSource().files['project.ddnn']).documents.body.text===${JSON.stringify(body)},'undo document');const trace='ddn "0.7"; module "automation"; data m { object t {x_trace:{name:"appearance replay",profile:"test@1",replay:"faithful",events:[{seq:1,clock:0,stepKind:"node-firing",instance:["sections::m.p"],state:{at:"sections::m.p"}}]};} }';
  DDNTool.loadFiles({'m.ddn':${JSON.stringify(fixture)}.replace('view v {','view v { select:[@m.p,@m.p#2];'),'project.ddnn':${JSON.stringify(side)},'project.ddna':trace},'m.ddn','v');await wait(()=>stage()?.querySelectorAll('.ddn-node').length===2,'replay appearances');await wait(()=>document.getElementById('ddn-replay-source').options.length>0,'trace picker');document.getElementById('ddn-replay-step').click();check(stage().querySelectorAll('.ddna-active').length===2,'DDNA replay activates both appearances');check(stage().querySelectorAll('.ddna-token').length===2,'DDNA token badges target both appearances');
  check(errors.length===0,'no browser errors: '+errors.join('; '));
  await fetch('/result',{method:'POST',body:JSON.stringify({pass:true,lines})});
 }catch(e){lines.push('FAIL '+e.message);await fetch('/result',{method:'POST',body:JSON.stringify({pass:false,lines})});}
})();</script>`;
let resolveResult;const hanging=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/fixtures/m.ddn'||url.pathname==='/fixtures/project.ddnn'){res.end(url.pathname.endsWith('m.ddn')?fixture:side);return;}
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
  try{const out=await result;for(const line of out.lines)console.log(worker,line);assert.ok(out.pass,'designer composition test failed ('+worker+')');}finally{clearTimeout(timer);chrome.kill();}
 }
 console.log('Designer composition browser 2/2');
 }finally{for(const h of hanging)h.end();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
