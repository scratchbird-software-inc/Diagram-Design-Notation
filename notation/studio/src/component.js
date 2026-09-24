/* SPDX-License-Identifier: GPL-2.0-or-later. UI is optional and isolated from host styles. */
export function installComponents(api,host){
if(!host.document||!host.customElements)return;
const STYLE=`
:host([source-hidden]) .source{display:none}:host{display:block;color:#21334b;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--line:#dbe3ed;--accent:#245ac8;--paper:#fff}
*{box-sizing:border-box}button,input,select,textarea{font:inherit}button,select{border:1px solid #cbd5e3;background:#fff;border-radius:7px;padding:7px 10px;color:inherit}button{cursor:pointer}button:hover:not(:disabled){background:#eef4ff;border-color:#8babe8}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,textarea:focus-visible{outline:3px solid #9bbdf7;outline-offset:2px}button:disabled,select:disabled,input:disabled{opacity:.45;cursor:not-allowed}button[aria-pressed=true]{background:#245ac8;color:#fff;border-color:#245ac8}.shell{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}.top{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.title{font-size:17px;font-weight:650;letter-spacing:-.25px}.live{font-size:11px;letter-spacing:.07em;color:#237455;background:#edf9f2;border:1px solid #c8e4d6;border-radius:30px;padding:4px 9px;white-space:nowrap}.tools{padding:14px 20px;background:#f8fafc;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:end;gap:12px 20px}.group{display:flex;gap:5px;align-items:center}.field{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:600;letter-spacing:.02em}.field select,.field input{font-size:13px;font-weight:400;letter-spacing:0}.choice{display:flex;gap:4px}.viewport-tools{display:flex;flex-wrap:wrap;align-items:center;padding:9px 16px;gap:8px;border-bottom:1px solid var(--line);font-size:12px}.viewport-tools button{padding:5px 9px}.viewport-tools input{width:110px}.spacer{flex:1}.zoom-output{min-width:65px}.stage{position:relative;height:560px;overflow:auto;background:#edf1f6;padding:16px}.canvas{width:max-content;min-width:100%;min-height:100%;display:flex;justify-content:center;align-items:flex-start}.canvas>svg{display:block;max-width:none;flex:none;box-shadow:0 2px 12px #243b5920;background:white}.canvas.stale{opacity:.38}.canvas .ddn-node:focus-visible{outline:2px solid #245ac8;outline-offset:3px}.placeholder{padding:70px 20px;text-align:center;color:#586b83}.error{margin:0;padding:12px 20px;background:#fff0ec;color:#912e1e;border-bottom:1px solid #f1c6ba;white-space:pre-wrap}.error:empty{display:none}.status{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding:10px 20px;border-top:1px solid var(--line);font-size:11px;color:#5a6d85}.advanced{border-bottom:1px solid var(--line);background:#fbfcfe}.advanced>summary,.source>summary,.diagnostics>summary{cursor:pointer;padding:10px 20px;font-size:12px;font-weight:600}.advanced .tools{border:0;background:transparent;padding-top:4px}.advanced input[type=number]{width:90px;border:1px solid var(--line);border-radius:6px;padding:7px}.advanced .help{padding:0 20px 14px;font-size:12px;color:#62758d;margin:0}.source,.diagnostics{border-top:1px solid var(--line)}.diagnostics pre,.source pre{margin:0;padding:12px 20px;white-space:pre-wrap;font:12px/1.55 ui-monospace,monospace;max-height:240px;overflow:auto;background:#f8fafc}.diagnostics.warning summary{color:#885513}.source .files{display:flex;gap:8px;padding:0 20px 10px;align-items:center;flex-wrap:wrap}.files select{max-width:100%;font-size:12px}.source textarea{display:block;width:calc(100% - 40px);margin:0 20px 10px;min-height:270px;max-height:700px;resize:vertical;border:1px solid #cbd5e3;border-radius:7px;padding:14px;font:12px/1.6 ui-monospace,monospace;tab-size:4;white-space:pre;overflow:auto}.note{font-size:11px;color:#61718a;padding:0 20px 12px;margin:0}.settings{padding:0 20px 12px}.settings h4{font-size:12px;margin:8px 0}.stage:focus-visible{outline:3px solid #9bbdf7;outline-offset:-3px}
:host([data-tone=dark]),:host([data-tone=night]){color:#edf3fc;--line:#7186a2;--accent:#bfd7ff;--paper:#2d3b50}
:host([data-tone=dark]) .shell,:host([data-tone=night]) .shell{background:#2d3b50}
:host([data-tone=dark]) .tools,:host([data-tone=night]) .tools,:host([data-tone=dark]) .advanced,:host([data-tone=night]) .advanced{background:#34455c}
:host([data-tone=dark]) button,:host([data-tone=night]) button,:host([data-tone=dark]) select,:host([data-tone=night]) select,:host([data-tone=dark]) input,:host([data-tone=night]) input{color:#edf3fc;background:#394b63;border-color:#8ca2c0}
:host([data-tone=dark]) button[aria-pressed=true],:host([data-tone=night]) button[aria-pressed=true]{background:#bfd7ff;color:#1e2b3d}
:host([data-tone=dark]) .stage,:host([data-tone=night]) .stage{background:#263448}
:host([data-tone=dark]) .status,:host([data-tone=night]) .status,:host([data-tone=dark]) .note,:host([data-tone=night]) .note,:host([data-tone=dark]) .help,:host([data-tone=night]) .help,:host([data-tone=dark]) .diagnostics.warning summary,:host([data-tone=night]) .diagnostics.warning summary{color:#d2deef}
:host([data-tone=dark]) pre,:host([data-tone=night]) pre,:host([data-tone=dark]) textarea,:host([data-tone=night]) textarea{color:#edf3fc;background:#263448}
:host([data-tone=dark]) .error,:host([data-tone=night]) .error{color:#ffd9ce;background:#593c3e}
@media(max-width:650px){.top,.tools{padding:12px}.stage{height:460px;padding:8px}.title{font-size:15px}.field{font-size:10px}.viewport-tools input{width:75px}.source textarea{width:calc(100% - 24px);margin:0 12px 10px}.source .files{padding-left:12px}.top{align-items:flex-start}}@media print{.tools,.advanced,.viewport-tools,.source,.diagnostics,.live{display:none!important}.stage{height:auto;overflow:visible;padding:0}.canvas{display:block;width:100%}.canvas>svg{width:100%!important;height:auto!important;box-shadow:none}.shell{border:0}.status{font-size:9px}}`;
let seq=0;
const download=(name,text,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function safeSVG(svg,prefix){
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw new Error('Renderer returned malformed SVG');
 for(const el of [...doc.querySelectorAll('*')]){
  // B1-033: declarative SMIL (animate/animateMotion/…) is renderer-emitted,
  // carries no script and animates autonomously in exported SVG — keep it.
  if(['script','foreignObject','iframe','object','embed'].includes(el.localName)){el.remove();continue;}
  for(const at of [...el.attributes]){
   if(/^on/i.test(at.localName))el.removeAttributeNode(at);
   else if(['href','src'].includes(at.localName)&&!at.value.startsWith('#')){
    if(!(el.localName==='a'&&/^[A-Za-z_][A-Za-z0-9_-]*\.svg$/.test(at.value)))el.removeAttributeNode(at);
   }else if(/url\(\s*['"]?(?!#)/i.test(at.value)&&at.value.includes('url('))el.removeAttributeNode(at);
  }
 }
 // Scope every internal reference for coexistence with other live diagrams.
 const ids=new Map();for(const el of doc.querySelectorAll('[id]')){const id=el.id;ids.set(id,prefix+id);el.id=prefix+id;}
 for(const el of doc.querySelectorAll('*'))for(const at of [...el.attributes]){
  if(['href','src'].includes(at.localName)&&at.value[0]==='#'&&ids.has(at.value.slice(1)))at.value='#'+ids.get(at.value.slice(1));
  else if(['aria-labelledby','aria-describedby'].includes(at.name))at.value=at.value.split(/\s+/).map(x=>ids.get(x)||x).join(' ');
  else if(at.value.includes('url(#'))at.value=at.value.replace(/url\(#([^)]*)\)/g,(m,id)=>`url(#${ids.get(id)||id})`);
 }
 return document.importNode(doc.documentElement,true);
}
class DDNExample extends HTMLElement{
 constructor(){super();this.attachShadow({mode:'open'});this.uid='ddnlive-'+(++seq)+'-';this.options={};this.pending=0;this.zoom='fit';this.result=null;this.started=false;this.destroyed=false;this.ready=Promise.resolve(null);this._controller=new AbortController();}
 connectedCallback(){if(this.shadowRoot.childNodes.length)return;this.drawUI();this._resize=new ResizeObserver(()=>{if(this.zoom==='fit')this.sizeSVG();});this._resize.observe(this.$('.stage'));
  this._workspaceEvent=e=>{if(e.detail.id===this.getAttribute('workspace'))this.start();};host.addEventListener('ddn-workspace-ready',this._workspaceEvent,{signal:this._controller.signal});
  if(this.hasAttribute('eager'))this.start();else{this._observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){this._observer.disconnect();this.start();}},{rootMargin:'250px'});this._observer.observe(this);}
 }
 disconnectedCallback(){this._observer?.disconnect();this._resize?.disconnect();clearTimeout(this._timer);this._settleScheduled?.({superseded:true});this._settleScheduled=null;this.pending++;this._controller.abort();this._unsubscribe?.();this.destroyed=true;}
 $(s){return this.shadowRoot.querySelector(s);} $all(s){return[...this.shadowRoot.querySelectorAll(s)];}
 configure({workspace,files,entry,view,overrides={},layoutState=null,title}){
  this.ws=workspace||(files?api.createWorkspace(files):this.ws);this.entry=entry;this.view=view;this.options={...overrides};this._layoutState=layoutState;this._title=title||null;
  if(this.isConnected)this.start();return this;
 }
 start(){
  if(this.destroyed)return;this.ws=this.ws||api.workspaces.get(this.getAttribute('workspace'));this.entry=this.entry||this.getAttribute('entry');this.view=this.view||this.getAttribute('view');
  if(!this.ws){this.$('.placeholder').textContent='Waiting for the named DDN workspace…';return;}
  if(this._subscribedWS!==this.ws){this._unsubscribe?.();this._subscribedWS=this.ws;this._unsubscribe=this.ws.subscribe(()=>{if(this.started&&!this.destroyed){this.ready=this.redraw();this.ready.catch(()=>{});}});}
  if(!this.entry||!this.view){this.showError(new Error('Set entry and view for this live example.'));return;}
  try{const info=this.ws.inspect(this.entry,this.view);this.info=info;this.capabilities=info.capabilities;this._title=this._title||this.ws.views(this.entry).find(v=>v.id===this.view)?.name||this.view;this.$('.title').textContent=this._title;
   if(!this.options.look)this.options.look=info.profiles.style.look;
   this.syncUI();this.populateSource();this.started=true;this.ready=this.redraw();this.ready.catch(()=>{});
  }catch(e){this.showError(e);this.ready=Promise.reject(e);this.ready.catch(()=>{});}
 }
 drawUI(){
  const style=document.createElement('style');style.textContent=STYLE;this.shadowRoot.append(style);
  if(this.hasAttribute('theme')){
   // Optional `theme` attribute: a JSON object of --ddn-* custom property
   // overrides, injected as a constructed stylesheet on the shadow host so
   // the values cascade into the rendered SVG (which may map the ddn-*
   // classes to those properties via dist/ddn.css). Script-level inline
   // SVG attributes still win the cascade.
   let props={};try{props=JSON.parse(this.getAttribute('theme'))||{};}catch{props={};}
   const decl=Object.entries(props).filter(([k,v])=>/^--ddn-[a-z0-9-]+$/i.test(k)&&typeof v==='string').map(([k,v])=>k+':'+v.replace(/[;{}]/g,'')).join(';');
   if(decl){const sheet=new CSSStyleSheet();sheet.replaceSync(':host{'+decl+'}');this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,sheet];}
  }
  const shell=document.createElement('div');shell.className='shell';shell.innerHTML=`
<div class="top"><span class="title">DDN live example</span><span class="live">LIVE SOURCE → SVG</span></div>
<div class="tools"><div class="field"><span>DRAWING STYLE</span><div class="choice"><button data-look="classic" aria-pressed="false">Standard</button><button data-look="handDrawn" aria-pressed="false">Hand-drawn</button><button data-look="neo" aria-pressed="false">Neo</button></div></div>
<label class="field">PALETTE<select data-control="theme"><option value="source">As authored</option><option value="default">Day</option><option value="dark">Dark · blue-grey</option><option value="night">Night · slate-blue</option><option value="neutral">Monochrome</option><option value="forest">Forest</option></select></label>
<label class="field">PLACEMENT<select data-control="placement"><option value="source">As authored / automatic default</option><option value="auto">Adaptive · preserve pins</option><option value="grid">Legacy grid seed</option><option value="fit_grid">Fit to grid · around pins</option><option value="circular">Circular · around pins</option><option value="radial">Radial · graph-distance rings</option><option value="layered">Hierarchical · directed layers</option><option value="spanning_tree">Tree · spanning levels</option><option value="tree">Tree · declared hierarchy</option><option value="mindmap">Mind map · two-sided</option><option value="grouped">Grouped / lanes</option><option value="organic">Organic · force-based</option></select></label>
<label class="field">AUTO-PLACEMENT<input data-control="autoPlace" type="checkbox" checked title="Pause to keep current unpinned positions; explicit pins never move."></label><label class="field">CONNECTORS<select data-control="routing"><option value="source">As authored</option><option value="orthogonal">Right-angle</option><option value="curved">Curved</option><option value="rounded">Rounded corners</option><option value="straight">Straight</option></select></label>
<label class="field">DETAIL<select data-control="fields"><option value="source">As authored</option><option value="names">Field names</option><option value="none">Names only</option></select></label>
<label class="field">RELATION LABELS<select data-control="labels"><option value="source">As authored</option><option value="numbers">Numbered circles</option><option value="text">Full wording</option><option value="tokens">Short tokens</option></select></label></div>
<details class="advanced"><summary>Layout centre, page, crossings, and pen settings</summary><div class="tools"><label class="field">DOMAIN BINDINGS<select data-control="domains"><option value="source">As authored</option><option value="show">Show</option><option value="hide">Hide</option></select></label><label class="field">DATATYPES<select data-control="datatypes"><option value="source">As authored</option><option value="show">Show</option><option value="hide">Hide</option></select></label><label class="field">BASE FONT (px)<input data-control="fontSize" type="number" min="8" max="64" value="16"></label>
<label class="field">LAYOUT CENTRE<select data-control="center"><option value="source">As authored / pattern default</option><option value="pins">Pinned group</option><option value="content">Whole content</option></select></label><label class="field">GRID STEP (PX)<input data-control="gridStep" type="number" min="8" max="512" step="8" value="32"></label><label class="field">PAGE / ARTBOARD<select data-control="page"><option value="source">As authored</option><option value="content">Fit content at native size</option><option value="web">Web figure · 1600 × 1000</option><option value="a4-landscape">A4 landscape</option><option value="a4-portrait">A4 portrait</option><option value="letter-landscape">Letter landscape</option><option value="custom">Custom size</option></select></label>
<label class="field">WIDTH (PX)<input data-control="width" type="number" min="400" max="32000" step="100" value="1600"></label><label class="field">HEIGHT (PX)<input data-control="height" type="number" min="400" max="32000" step="100" value="1000"></label>
<label class="field">CROSSINGS<select data-control="crossings"><option value="source">As authored</option><option value="gap">Gap · not connected</option><option value="bridge">Rounded bridge</option><option value="square_bridge">Square bridge</option></select></label>
<label class="field">KIND INDICATOR<select data-control="kind"><option value="source">As authored</option><option value="icon_token">Icon + token</option><option value="text">Type wording</option><option value="none">Hide kind</option></select></label>
<label class="field">FONT ROLE<select data-control="font"><option value="source">As authored</option><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option><option value="handwriting">Handwriting fallback</option></select></label>
<label class="field">PEN ROUGHNESS<input data-control="roughness" type="number" min="0" max="3" step="0.2" value="1.8"></label><label class="field">HATCH SHADING<input data-control="hachure" type="checkbox" checked></label>
</div><p class="help">Patterns place only unpinned elements. Circular/grid slots survive routing optimization. Pause keeps the current positions; Auto-layout now reflows. Centre pins focuses the pinned group without moving it. Connector shape is presentation, not relationship meaning. Page changes re-render; zoom only magnifies. Paper sizes may be rejected when the legend or text cannot fit.</p></details>
<div class="viewport-tools"><button data-action="fit">Fit</button><button data-action="actual">100%</button><input aria-label="Diagram zoom" data-zoom type="range" min="10" max="300" step="5" value="100"><span class="zoom-output">Fit</span><span class="spacer"></span><button data-action="relayout">Auto-layout now</button><button data-action="focus-pins" disabled>Centre pins</button><button data-action="reset">Reset appearance</button><button data-action="svg" disabled>Export SVG</button><button data-action="snapshot" disabled>Save example</button></div>
<pre class="error" role="alert"></pre><div class="stage" tabindex="0" aria-label="Diagram viewport; scroll to inspect"><div class="canvas"><div class="placeholder">The DDN source will be rendered when this example becomes visible.</div></div></div>
<div class="status" aria-live="polite"><span class="metrics">Not rendered</span><span class="fingerprint"></span></div>
<details class="diagnostics"><summary>Diagnostics and renderer capabilities</summary><pre></pre></details>
<details class="source"><summary>DDN source and current presentation settings</summary><div class="files"><label>Source file <select data-files aria-label="Workspace source file"></select></label><button data-action="apply">Apply source edits</button><button data-action="discard">Discard un-applied edit</button></div><textarea aria-label="DDN source code" spellcheck="false"></textarea><p class="note">Edits affect this in-memory workspace. Nothing is written to your disk. These bundled workspaces are synthetic; hiding a field is not redaction.</p><div class="settings"><h4>Live presentation overlay (original DDN is unchanged)</h4><pre data-settings></pre></div></details>`;
  this.shadowRoot.append(shell);
  const markField=document.createElement('label');markField.className='field';markField.dataset.markField='';markField.append(document.createTextNode('Chart mark'));const markSelect=document.createElement('select');markSelect.dataset.control='mark';markSelect.setAttribute('aria-label','Chart mark');for(const value of api.choices.mark)markSelect.add(new Option(value==='source'?'As authored':value,value));markField.append(markSelect);shell.querySelector('.tools').append(markField);
  shell.addEventListener('click',event=>{const look=event.target.closest('[data-look]');if(look){this.setOptions({look:look.dataset.look});return;}const b=event.target.closest('[data-action]');if(!b)return;this.action(b.dataset.action);});
  shell.addEventListener('change',event=>{const t=event.target;if(t.matches('[data-control]')){let val=t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value;this.setOptions({[t.dataset.control]:val});}else if(t.matches('[data-files]'))this.showSource(t.value);});
  shell.querySelector('[data-zoom]').addEventListener('input',e=>{this.zoom=Number(e.target.value)/100;this.sizeSVG();});
  this.$('.canvas').addEventListener('click',e=>{
   const a=e.target.closest('a');if(a){e.preventDefault();const v=a.closest('[data-view]')?.dataset.view;this.dispatchEvent(new CustomEvent('ddn-navigate',{detail:{view:v,entry:this.entry},bubbles:true,composed:true}));return;}
   const el=e.target.closest('[data-member],[data-id]'),id=el?.dataset.member||el?.dataset.id,source=id&&this.result?.sourceMap[id];if(!source)return;if(!this.hasAttribute('source-hidden')){this.$('.source').open=true;this.showSource(source.file);const edit=this.$('textarea');edit.focus();edit.setSelectionRange(source.start,source.end);}this.dispatchEvent(new CustomEvent('ddn-select',{detail:{id:source.sourceId||id,occurrenceId:id,source,property:el?.dataset.property,matrix:el?.dataset.matrixRow?{row:el.dataset.matrixRow,column:el.dataset.matrixColumn}:null,childView:el?.closest('[data-child-view]')?.dataset.childView||null,sourceIds:el?.dataset.sourceIds?JSON.parse(el.dataset.sourceIds):[id]},bubbles:true,composed:true}));
  });
  this.$('textarea').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();this.action('apply');}});
 }
 syncUI(){
  for(const el of this.$all('[data-control]')){const key=el.dataset.control,val=this.options[key]??(key==='autoPlace'?(this.info?.profiles.layout.auto_place!==false):key==='gridStep'?(this.info?.profiles.layout.grid_step?.$quantity??32):key==='fontSize'?(this.info?.profiles.style.font_size?.$quantity??16):key==='roughness'?(this.info?.profiles.style.roughness??1.8):key==='hachure'?(this.info?.profiles.style.hachure??true):api.defaults[key]);if(el.type==='checkbox')el.checked=val;else el.value=val??'source';el.disabled=false;
   if(this.capabilities?.sequence&&['autoPlace','center','gridStep','placement','routing','fields','labels','page','crossings','kind','width','height','fontSize','domains','datatypes'].includes(key)){el.disabled=true;el.title='Locked: this sequence renderer preserves time rows and a numbered exchange key.';}
   if(['width','height'].includes(key))el.disabled=(this.options.page!=='custom')||!!this.capabilities?.sequence;
  }
  this.$('[data-control=placement]').disabled=!!this.capabilities?.sequence||this.capabilities?.graphControls===false||this.$('[data-control=autoPlace]').checked===false;
  this.$('[data-action=relayout]').disabled=!!this.capabilities?.sequence||this.capabilities?.graphControls===false;
  this.$('[data-control=gridStep]').disabled=!!this.capabilities?.sequence||this.capabilities?.graphControls===false||!['fit_grid','grid'].includes(this.options.placement&&this.options.placement!=='source'?this.options.placement:this.info?.profiles.layout.algorithm);
  if(this.capabilities?.graphControls===false){for(const key of ['autoPlace','center','gridStep','placement','routing','fields','labels','crossings','kind','domains','datatypes']){const control=this.$('[data-control='+key+']');if(control){control.disabled=true;control.title='Locked: coordinates and content are defined by the selected projection.';}}}
  const chart=this.capabilities?.projection==='chart';this.$('[data-mark-field]').hidden=!chart;const mark=this.$('[data-control=mark]');mark.disabled=!chart;for(const opt of mark.options)opt.disabled=!(this.capabilities?.marks||['source']).includes(opt.value);
  for(const b of this.$all('[data-look]'))b.setAttribute('aria-pressed',String(b.dataset.look===this.options.look));
  this.$('[data-settings]').textContent=JSON.stringify(this.options,null,2);
 }
 setOptions(changes){api.checkOptions(changes);this.options={...this.options,...changes};this.syncUI();clearTimeout(this._timer);this._settleScheduled?.({superseded:true});this.ready=new Promise((resolve,reject)=>{this._settleScheduled=resolve;this._timer=setTimeout(()=>{this._settleScheduled=null;this.redraw().then(resolve,reject);},100);});this.ready.catch(()=>{});return this.ready;}
 async redraw(){
  if(!this.ws)return;const token=++this.pending;this.$('.metrics').textContent='Rendering DDN…';this.$('.error').textContent='';this.$('[data-action=svg]').disabled=true;this.$('[data-action=snapshot]').disabled=true;
  await new Promise(r=>setTimeout(r,0));if(token!==this.pending||this.destroyed)return;
  try{
   const r=await this.ws.render({entry:this.entry,view:this.view,overrides:this.options,layoutState:this._layoutState?.view===this.entry+'#'+this.view?this._layoutState:null});if(token!==this.pending||this.destroyed)return;
   this.info={...this.info,profiles:r.profiles};this.capabilities=r.capabilities;this.syncUI();this.setAttribute('data-tone',r.profiles.style.theme);
   const svg=safeSVG(r.svg,this.uid),serialized=new XMLSerializer().serializeToString(svg);this._layoutState=r.layoutState;this.result={...r,displaySVG:serialized};this.$('.canvas').replaceChildren(svg);this.$('.canvas').classList.remove('stale');this.sizeSVG();this.centerPins();this.$('[data-action=focus-pins]').disabled=!r.scene.focus;
   this.$('.metrics').textContent=`${r.scene.marks?.length||r.scene.nodes?.length||0} ${r.scene.marks?'marks':'elements'} · ${r.scene.messageRows?.length||r.scene.routes?.length||0} ${r.capabilities.sequence?'exchanges':'relations'} · ${Math.round(r.milliseconds)} ms · ${Math.round(r.scene.width)} × ${Math.round(r.scene.height)} px${r.scene.layout?' · '+r.scene.layout.portChanges+' anchor changes · '+r.scene.layout.nodeMoves+' node moves · '+r.scene.layout.pinned.length+' fixed pins'+(r.scene.layout.pattern?' · '+r.scene.layout.pattern.pattern:'')+(r.scene.layout.autoPlace===false?' · placement paused':''):''}`;
   this.$('.fingerprint').textContent='Model '+r.modelFingerprint.slice(0,12)+' · presentation only';
   this.$('.diagnostics pre').textContent=[`Live component ${api.VERSION}; renderer ${api.runtime.core}.\n${r.capabilities.notes.join('\n')}`,...(r.scene.layout?['Layout stages: '+JSON.stringify(r.scene.layout.stages),'Pattern / centre: '+JSON.stringify(r.scene.layout.pattern)]:[]),...r.diagnostics.map(d=>`${d.severity.toUpperCase()} ${d.code}: ${d.message}`)].join('\n\n');
   this.$('.diagnostics').classList.toggle('warning',r.diagnostics.some(d=>d.code!=='DDN-W901'));
   this.$('[data-action=svg]').disabled=false;this.$('[data-action=snapshot]').disabled=!r.capabilities.sourceExport;
   this.dispatchEvent(new CustomEvent('ddn-render',{detail:{entry:this.entry,view:this.view,fingerprint:r.modelFingerprint,milliseconds:r.milliseconds,diagnostics:r.diagnostics},bubbles:true,composed:true}));return r;
  }catch(e){if(token!==this.pending)return;this.showError(e);throw e;}
 }
 showError(e){this.result=null;this.$('[data-action=focus-pins]').disabled=true;this.$('.error').textContent=`${e.code||'ERROR'}: ${e.message}\nThe requested settings were not rendered. A dimmed previous picture, if present, is stale and cannot be exported.`;this.$('.canvas').classList.add('stale');this.$('.metrics').textContent='Render failed — adjust settings or reset';this.$('.fingerprint').textContent='';for(const k of ['svg','snapshot'])this.$(`[data-action=${k}]`).disabled=true;this.dispatchEvent(new CustomEvent('ddn-error',{detail:{code:e.code,message:e.message},bubbles:true,composed:true}));}
 sizeSVG(){const svg=this.$('.canvas>svg');if(!svg||!this.result)return;const w=this.result.scene.width,h=this.result.scene.height;const fit=Math.min(1,Math.max(120,this.$('.stage').clientWidth-32)/w,Math.max(120,this.$('.stage').clientHeight-32)/h),z=this.zoom==='fit'?fit:this.zoom;svg.style.width=(w*z)+'px';svg.style.height=(h*z)+'px';this.$('.zoom-output').textContent=(this.zoom==='fit'?'Fit · ':'')+Math.round(z*100)+'%';this.$('[data-zoom]').value=String(Math.min(300,Math.max(10,Math.round(z*100))));}
 centerPins(){const focus=this.result?.scene.focus;if(!focus)return false;const stage=this.$('.stage'),svg=this.$('.canvas>svg');if(!svg)return false;const z=parseFloat(svg.style.width)/this.result.scene.width;stage.scrollLeft=Math.max(0,focus.page[0]*z-stage.clientWidth/2+16);stage.scrollTop=Math.max(0,focus.page[1]*z-stage.clientHeight/2+16);return true;}
 focusPins(){return this.centerPins();}
 populateSource(){const sel=this.$('[data-files]'),names=this.ws.getFiles();sel.replaceChildren(...Object.keys(names).sort().map(k=>new Option(k,k)));this.showSource(this.entry);}
 showSource(file){if(!this.ws||!Object.hasOwn(this.ws.getFiles(),file))return;this.editingFile=file;this.$('[data-files]').value=file;this.$('textarea').value=this.ws.getFiles()[file];}
 action(name){
  if(name==='fit'){this.zoom='fit';this.sizeSVG();}
  if(name==='actual'){this.zoom=1;this.sizeSVG();}
  if(name==='relayout'){this._layoutState=null;this.setOptions({autoPlace:true});}
  if(name==='focus-pins')this.centerPins();
  if(name==='reset'){this._layoutState=null;this.options={look:this.info?.profiles.style.look||'classic'};this.zoom='fit';this.syncUI();this.ready=this.redraw();this.ready.catch(()=>{});}
  if(name==='svg'&&this.result)download(this.view+'.svg','<?xml version="1.0" encoding="UTF-8"?>\n'+this.result.displaySVG,'image/svg+xml;charset=utf-8');
  if(name==='snapshot'&&this.result){const snapshot=this.ws.snapshot(this.entry,this.view,this.options,this.result?.scene.layout?.autoPlace===false?this._layoutState:null);snapshot.presentationKeys=this.result.keys;download(this.view+'.ddn-workspace.json',JSON.stringify(snapshot,null,2),'application/json');}
  if(name==='discard')this.showSource(this.editingFile);
  if(name==='apply'){this.ws.updateFiles({[this.editingFile]:this.$('textarea').value});}
 }
 exportSVG(){if(!this.result)throw new Error('No current successful render');return this.result.displaySVG;}
 getState(){return{entry:this.entry,view:this.view,overrides:{...this.options},zoom:this.zoom,modelFingerprint:this.result?.modelFingerprint||null};}
 destroy(){this.remove();}
}
if(!customElements.get('ddn-example'))customElements.define('ddn-example',DDNExample);
api.mount=(element,options)=>{if(!(element instanceof Element))throw new TypeError('mount needs a DOM element');const ex=document.createElement('ddn-example');ex.setAttribute('eager','');ex.configure(options);element.replaceChildren(ex);return ex;};
api.hydrate=(root=document)=>{for(const script of root.querySelectorAll('script[type="application/json"][data-ddn-workspace]')){api.registerWorkspace(script.dataset.ddnWorkspace,JSON.parse(script.textContent));}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>api.hydrate());else api.hydrate();
}
