/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN reference decoder, 0.6.0-beta.1. No runtime dependencies.
 * This is an executable core demonstrator, NOT a complete conformance implementation.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ddn-contracts.js'),require('./ddn-profiles.js'));
  else root.DDN = factory(root.DDNContracts,root.DDNProfiles);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Contracts,Profiles) {
  'use strict';
  const VERSION = '0.6.0-beta.1';
  const SOURCE_VERSIONS=Object.freeze(['0.2','0.3','0.4','0.5']);
  class DDNError extends Error {
    constructor(code, message, source, offset) {
      super(message); this.name='DDNError'; this.code=code; this.source=source||'';
      this.offset=offset||0;
    }
    diagnostic(text) {
      const before=(text||'').slice(0,this.offset), lines=before.split('\n');
      return {code:this.code,severity:'error',message:this.message,source:this.source,
        offset:this.offset,line:lines.length,column:lines.at(-1).length+1};
    }
  }
  function fail(code,msg,t,source){throw new DDNError(code,msg,source,t?.start||0);}
  function lex(text, source='input.ddn') {
    if (typeof text!=='string') throw new TypeError('Source must be a UTF-8 decoded string');
    if (text.length>2_000_000) fail('DDN001','Source exceeds demonstrator size limit',null,source);
    const out=[]; let i=0;
    if(text.charCodeAt(0)===0xFEFF)i++;
    while(i<text.length){
      let start=i,c=text[i];
      if(/\s/.test(c)){i++;continue;}
      if(text.startsWith('//',i)){while(i<text.length&&text[i]!='\n')i++;continue;}
      if(text.startsWith('/*',i)){const e=text.indexOf('*/',i+2);if(e<0)fail('DDN002','Unterminated block comment',{start},source);i=e+2;continue;}
      if(text.startsWith('->',i)){out.push({type:'->',value:'->',start,end:i+2});i+=2;continue;}
      if(c==='"'){
        i++;let escape=false;
        while(i<text.length){if(!escape&&text[i]==='"')break;if(text[i]==='\n'||text[i]==='\r')fail('DDN003','String contains a raw newline',{start},source);if(text[i]==='\\'&&!escape)escape=true;else escape=false;i++;}
        if(i>=text.length)fail('DDN003','Unterminated string',{start},source);
        let value;try{value=JSON.parse(text.slice(start,++i));}catch(e){fail('DDN003','Invalid JSON-style string escape',{start},source);}
        for(let j=0;j<value.length;j++){let u=value.charCodeAt(j);if(u>=0xD800&&u<=0xDBFF){let v=value.charCodeAt(++j);if(!(v>=0xDC00&&v<=0xDFFF))fail('DDN004','Unpaired Unicode surrogate',{start},source);}else if(u>=0xDC00&&u<=0xDFFF)fail('DDN004','Unpaired Unicode surrogate',{start},source);}
        out.push({type:'string',value,start,end:i});continue;
      }
      const num=text.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
      if(num){i+=num[0].length;let value=Number(num[0]);if(!Number.isFinite(value))fail('DDN005','Nonfinite number',{start},source);
        const unit=text.slice(i).match(/^(?:px|pt|mm|cm|in|ms|min|s|h|d|%)(?![A-Za-z0-9_])/);
        if(unit){i+=unit[0].length;out.push({type:'quantity',value:{$quantity:value,unit:unit[0]},start,end:i});}
        else out.push({type:'number',value,start,end:i});continue;}
      const id=text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_-]*/);
      if(id){let name=id[0];if(name.endsWith('-')&&text[i+name.length]==='>')name=name.slice(0,-1);i+=name.length;out.push({type:'id',value:name,start,end:i});continue;}
      if('{}[]:;,.@'.includes(c)){out.push({type:c,value:c,start,end:++i});continue;}
      fail('DDN006',`Unexpected character ${JSON.stringify(c)}`,{start},source);
    }
    out.push({type:'eof',value:'',start:i,end:i});return out;
  }
  function parse(text, source='input.ddn') {
    const tokens=lex(text,source);let pos=0,depth=0;
    const peek=(n=0)=>tokens[pos+n], take=()=>tokens[pos++];
    function expect(type,value){let t=take();if(t.type!==type||(value!==undefined&&t.value!==value))fail('DDN010',`Expected ${value||type}; found ${t.value||t.type}`,t,source);return t;}
    function ref(){const t=expect('@');let parts=[expect('id').value];while(peek().type==='.'){take();parts.push(expect('id').value);}return {$ref:parts.join('.'),$offset:t.start};}
    function value(){let t=peek();if(t.type==='@')return ref();if(['string','number','quantity'].includes(t.type))return take().value;
      if(t.type==='id'){take();if(t.value==='true')return true;if(t.value==='false')return false;if(t.value==='null')return null;if(['undecided','not_applicable','conflicting'].includes(t.value))return {$state:t.value};if(t.value==='missing')return {$missing:true};return t.value;}
      if(t.type==='['){take();const a=[];if(++depth>80)fail('DDN007','Maximum nesting exceeded',t,source);while(peek().type!==']'){a.push(value());if(peek().type!==',')break;take();}expect(']');depth--;return a;}
      if(t.type==='{'){take();const o=Object.create(null);if(++depth>80)fail('DDN007','Maximum nesting exceeded',t,source);while(peek().type!=='}'){let k=take();if(!['string','id'].includes(k.type))fail('DDN010','Expected record key',k,source);if(['__proto__','prototype','constructor'].includes(k.value))fail('DDN008','Reserved key',k,source);if(Object.hasOwn(o,k.value))fail('DDN011',`Duplicate property ${k.value}`,k,source);expect(':');o[k.value]=value();if(![',',';'].includes(peek().type))break;take();}expect('}');depth--;return o;}
      fail('DDN010','Expected a value',t,source);
    }
    function body(node){expect('{');node.bodyStart=tokens[pos-1].end;if(++depth>80)fail('DDN007','Maximum nesting exceeded',peek(),source);
      while(peek().type!=='}'){
        if(peek().type==='eof')fail('DDN010','Missing closing brace',peek(),source);
        const t=expect('id');
        if(peek().type===':'){take();if(Object.hasOwn(node.props,t.value))fail('DDN011',`Duplicate property ${t.value}`,t,source);if(['__proto__','prototype','constructor'].includes(t.value))fail('DDN008','Reserved key',t,source);node.props[t.value]=value();expect(';');}
        else node.children.push(declaration(t));
      }
      node.bodyEnd=peek().start;node.end=take().end;depth--;if(peek().type===';')node.end=take().end;return node;
    }
    function declaration(t){let n={type:t.value,id:null,label:null,props:Object.create(null),children:[],start:t.start,source};
      if(['place','route'].includes(n.type)){n.target=ref();n.id=n.target.$ref;return body(n);}
      if(peek().type==='{'){n.group=true;n.id=n.type;return body(n);}
      n.id=expect('id').value;
      if(peek().type==='string')n.label=take().value;
      if(peek().type==='@'){n.from=ref();expect('->');n.to=ref();}
      if(peek().type===';'){n.end=take().end;return n;}
      return body(n);
    }
    expect('id','ddn');let version=expect('string').value;expect(';');
    if(!SOURCE_VERSIONS.includes(version))fail('DDN012',`Unsupported language version ${version}; expected ${SOURCE_VERSIONS.join(', ')}`,tokens[1],source);
    expect('id','module');let module=expect('string').value;expect(';');
    if(!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(module))fail('DDN013','Invalid module identity',tokens[pos-2],source);
    const imports=[],declarations=[];
    while(peek().type==='id'&&peek().value==='import'){take();let path=expect('string').value;expect('id','as');let alias=expect('id').value;expect(';');if(imports.some(x=>x.alias===alias))fail('DDN014','Duplicate import alias',tokens[pos-2],source);imports.push({path,alias});}
    while(peek().type!=='eof')declarations.push(declaration(expect('id')));
    return {version,module,imports,declarations,source,text};
  }
  function normalizePath(base,relative){
    if(/^(?:[a-z]+:|\/|\\)/i.test(relative)||relative.includes('\\'))throw new DDNError('DDN020','Imports must be workspace-relative POSIX paths',base);
    const p=base.split('/').slice(0,-1);for(const bit of relative.split('/')){if(!bit||bit==='.')continue;if(bit==='..'){if(!p.length)throw new DDNError('DDN020','Import escapes workspace',base);p.pop();}else p.push(bit);}return p.join('/');
  }
  function createWorkspace(files,entry){
    const docs=new Map(),modules=new Map(),symbols=new Map(),active=new Set();
    function load(path){if(active.has(path))throw new DDNError('DDN021','Import cycle: '+[...active,path].join(' → '),path);if(docs.has(path))return docs.get(path);if(!Object.hasOwn(files,path))throw new DDNError('DDN022','Missing workspace file '+path,path);
      active.add(path);const d=parse(files[path],path);if(modules.has(d.module))throw new DDNError('DDN023','Duplicate module identity '+d.module,path);docs.set(path,d);modules.set(d.module,d);d.imported=new Map();for(const imp of d.imports)d.imported.set(imp.alias,load(normalizePath(path,imp.path)));active.delete(path);return d;}
    const main=load(entry);
    function index(n,d,parent=''){
      n.doc=d;n.path=parent?(parent+'.'+n.id):n.id;n.uid=n.props.uid||`${d.module}::${n.path}`;
      if(!n.group&&!['place','route'].includes(n.type)){let key=d.module+'::'+n.path;if(symbols.has(key))throw new DDNError('DDN024','Duplicate declaration '+n.path,d.source,n.start);symbols.set(key,n);}
      for(const c of n.children)index(c,d,n.group?parent:n.path);
    }
    for(const d of docs.values())for(const n of d.declarations){if(!['data','format','view'].includes(n.type))throw new DDNError('DDN025','Top-level declaration must be data, format or view',d.source,n.start);index(n,d);}
    const uidMap=new Map();for(const n of symbols.values()){if(uidMap.has(n.uid))throw new DDNError('DDN026','Duplicate stable uid '+n.uid,n.source,n.start);uidMap.set(n.uid,n);}
    function resolve(r,context){if(!r||!r.$ref)throw new DDNError('DDN030','Expected a reference',context?.source,context?.start);const parts=r.$ref.split('.');let doc=context.doc;
      if(doc.imported.has(parts[0])){doc=doc.imported.get(parts.shift());let node=symbols.get(doc.module+'::'+parts.join('.'));if(node)return node;}
      else{let base=context.path.split('.');base.pop();for(let k=base.length;k>=0;k--){let path=[...base.slice(0,k),...parts].join('.'),n=symbols.get(doc.module+'::'+path);if(n)return n;}}
      throw new DDNError('DDN031','Unresolved reference @'+r.$ref,context.source,r.$offset||context.start);
    }
    return {main,docs,modules,symbols,uidMap,resolve,files};
  }
  function children(n,type){return n.children.filter(c=>c.type===type);}
  function group(n,name){return n.children.find(c=>c.group&&c.type===name);}
  function values(n,name){return group(n,name)?.props||Object.create(null);}
  function getFields(n){const g=group(n,'fields');return g?g.children.filter(c=>c.type==='field').flatMap(c=>[c,...getFields(c)]):[];}
  function fieldTree(n){const g=group(n,'fields');return g?g.children.filter(c=>c.type==='field'):[];}
  function getPorts(n){const g=group(n,'ports');return g?g.children.filter(c=>c.type==='port'):[];}
  function clean(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(clean);const o={};for(const [k,x]of Object.entries(v))if(!k.startsWith('$offset'))o[k]=clean(x);return o;}
  function enumOf(v){return typeof v==='string'?v:undefined;}
  function quantity(v,def=0){if(typeof v==='number')return v;if(v&&v.$quantity!==undefined){const mult={px:1,pt:96/72,mm:96/25.4,cm:96/2.54,in:96};if(!Object.hasOwn(mult,v.unit))throw new DDNError('DDN032','Expected length, not '+v.unit);return v.$quantity*mult[v.unit];}return def;}
  function kindEntry(reg,value){return Profiles.registry(reg).kinds.find(k=>k.keyword===value||k.code.toLowerCase()===value||k.aliases?.includes(value));}
  function relationEntry(reg,value){return Profiles.registry(reg).relationships.find(k=>k.keyword===value||k.code.toLowerCase()===value||k.aliases?.includes(value));}
  const DEFAULTS={
    projection:{kind:'graph',profile:'ddn@1'},
    notation:{registry:'ddn-core@0.3'},
    style:{look:'classic',theme:'default',font:'sans',font_size:{$quantity:16,unit:'px'},seed:42},
    layout:{algorithm:'auto',auto_place:true,center:'content',grid_step:{$quantity:32,unit:'px'},optimize:'crossings',endpoint_ordering:'optimize',direction:'right',routing:'orthogonal',curve:'bezier',curve_tension:.5,curve_radius:{$quantity:32,unit:'px'},crossings:'gap',gap:{$quantity:100,unit:'px'},row_gap:{$quantity:100,unit:'px'},columns:3,object_clearance:{$quantity:16,unit:'px'},edge_clearance:{$quantity:12,unit:'px'},port_clearance:{$quantity:28,unit:'px'},route_policy:'repair',quality:'error',root:null,group_by:'none'},
    display:{fields:'names',kind:'icon_token',maturity:'token',badges:'tokens',relations:'between_selected',samples:'show',domains:'hide',datatypes:'hide',depth:32},
    publication:{size:'figure',width:{$quantity:1280,unit:'px'},height:{$quantity:800,unit:'px'},margin:{$quantity:32,unit:'px'},fit:'contain',minimum_text:{$quantity:8,unit:'pt'},overflow:'error'},
    legend:{mode:'text',placement:'right',width:{$quantity:310,unit:'px'},keys:{}},
    validation:{mode:'logical',unknown_extensions:'warn'},
    export:{mode:'full',elements:[],fields:null,properties:[],include_samples:false,identifier_mode:'opaque',title:'Published data view',format:'json'},
  };
  const CHOICES={projection:{kind:['graph','chen','matrix','panels','table','chart','timeline','fishbone','decision','sequence','timing']},style:{look:['classic','handDrawn','neo'],theme:['default','neutral','dark','night','forest','base'],font:['sans','serif','mono','handwriting']},layout:{algorithm:['auto','grid','manual','layered','tree','mindmap','grouped','fit_grid','circular','radial','spanning_tree','organic'],center:['pins','content'],optimize:['crossings','none'],endpoint_ordering:['optimize','preserve'],direction:['right','down','left','up'],routing:['orthogonal','straight','curved'],curve:['bezier','rounded'],crossings:['gap','bridge','square_bridge']},display:{fields:['names','none'],kind:['text','icon_token','icon','none'],maturity:['token','none'],badges:['tokens','none'],relations:['between_selected','none'],samples:['show','hide'],domains:['show','hide'],datatypes:['show','hide']},legend:{mode:['numbers','text','tokens'],placement:['right','bottom','none']},publication:{size:['figure','content','a4','letter'],fit:['contain','none','reflow'],overflow:['error','warn']},validation:{mode:['sketch','logical','strict'],unknown_extensions:['warn','error']},export:{mode:['full','redacted'],identifier_mode:['opaque','preserve'],format:['json','sql']}};
  const PROPERTIES={
    projection:['kind','profile','write_data','rows','columns','relation','value','duplicates','panels','records','mark','x','y','x_type','size','unit','aggregate','start','end','label','dependencies','width','height','filter','order','missing','inner_radius','values','effect','encoding','series','series_missing','arrangement','transform','layers','bins','normalize','outside','whiskers','quartiles','step','baseline','target','open','high','low','close','inputs','outputs','hit_policy','coverage','analysis_budget','traces'],
    notation:['registry'],style:['look','theme','font','font_size','seed','roughness','hachure'],
    layout:['algorithm','auto_place','center','grid_step','optimize','endpoint_ordering','direction','routing','curve','curve_tension','curve_radius','crossings','gap','columns','port_clearance','object_clearance','edge_clearance','junctions','shared_segments','row_gap','route_policy','quality','root','hierarchy','group_by'],
    display:['fields','kind','maturity','badges','relations','samples','datatypes','domains','depth'],
    publication:['size','width','height','margin','orientation','fit','minimum_text','overflow','title','caption','embedding_scale','metrics'],
    legend:['mode','placement','width','keys','keyset','scope'],
    validation:['mode','unknown_extensions'],
    export:['mode','elements','fields','properties','include_samples','identifier_mode','title','format'],
    bundle:['projection','notation','style','layout','display','publication','legend','validation','export'],
    view:['projection','data','format','notation','style','layout','display','publication','legend','select','exclude','description','uid','validation','export'],
    place:['at','size'],route:['via','source_side','target_side','callout','policy','source_fraction','target_fraction','routing','curve','curve_tension','curve_radius'],
    subdiagram:['view','mode','at','size','label','binding','uid'],
    frame:['scope','members','at','size','label','dimension'],
    junction:['at','relations','network'],
    keyset:['keys','scope'],
  };
  function validateKnown(n,allowed){for(const key of Object.keys(n.props))if(!allowed.includes(key)&&!key.startsWith('x_'))throw new DDNError('DDN033',`Unknown ${n.type} property ${key}`,n.source,n.start);}
  function build(files,entry,viewName,registry,stack=[]){
    registry=Profiles.registry(registry);
    const ws=createWorkspace(files,entry);const all=[...ws.symbols.values()];const view=all.find(n=>n.type==='view'&&((viewName&&(n.id===viewName||n.path===viewName||n.uid===viewName))||(!viewName&&n.doc===ws.main)));
    if(!view)throw new DDNError('DDN040','View not found: '+(viewName||'(default)'),entry);
    if(stack.includes(view.uid)||stack.length>6)throw new DDNError('DDN065','Recursive or excessive inline subdiagram expansion',view.source,view.start);
    validateKnown(view,PROPERTIES.view);
    for(const child of view.children)if(child.group&&!Object.hasOwn(DEFAULTS,child.type))throw new DDNError('DDN900','Unsupported view override group '+child.type,child.source,child.start);
    for(const n of all)if(PROPERTIES[n.type])validateKnown(n,PROPERTIES[n.type]);
    const usedData=(Array.isArray(view.props.data)?view.props.data:[view.props.data]).filter(Boolean).map(r=>ws.resolve(r,view));
    if(!usedData.length||usedData.some(n=>n.type!=='data'))throw new DDNError('DDN041','View data must reference one or more data blocks',view.source,view.start);
    const raw=usedData.flatMap(n=>n.children.filter(c=>!c.group));
    const elemTypes=['object','domain','sample','flow','assertion'];
    for(const n of raw){if(!elemTypes.includes(n.type)&&n.type!=='relation')throw new DDNError('DDN042','Unsupported data declaration '+n.type,n.source,n.start);}
    for(const n of raw){if(n.from&&n.type!=='relation')throw new DDNError('DDN055','Only relations accept header endpoints',n.source,n.start);for(const g of n.children)if(g.group&&!['fields','ports'].includes(g.type))throw new DDNError('DDN900','Reference model does not implement group '+g.type,n.source,g.start);for(const f of getFields(n))for(const g of f.children)if(!g.group||g.type!=='fields')throw new DDNError('DDN042','Nested fields accept only a fields block',f.source,f.start);}
    const rawNodes=raw.filter(n=>elemTypes.includes(n.type));
    const rawRelations=raw.filter(n=>n.type==='relation');
    const p={};for(const k of Object.keys(DEFAULTS))p[k]=JSON.parse(JSON.stringify(DEFAULTS[k]));
    let bundle=null;
    if(view.props.format){bundle=ws.resolve(view.props.format,view);if(bundle.type!=='bundle')throw new DDNError('DDN043','format must reference a bundle',view.source,view.start);}
    for(const type of Object.keys(p)){
      const r=view.props[type]||(bundle&&bundle.props[type]);let def=null;
      if(r){def=ws.resolve(r,view.props[type]?view:bundle);if(def.type!==type)throw new DDNError('DDN044',`Expected ${type} profile, found ${def.type}`,view.source,view.start);p[type]={...p[type],...resolveValue(def.props,def)};}
      const overrides=group(view,type);if(overrides){validateKnown(overrides,PROPERTIES[type]);p[type]={...p[type],...resolveValue(overrides.props,overrides)};}
      if(type==='legend'&&def&&def.props.keyset){let keyset=ws.resolve(def.props.keyset,def);if(keyset.type!=='keyset')throw new DDNError('DDN044','Expected keyset',def.source,def.start);p.legend.keys={...keyset.props.keys,...p.legend.keys};}
    }
    if(quantity(p.style.font_size,16)<8||quantity(p.style.font_size,16)>64)throw new DDNError('DDN046','font_size must be between 8px and 64px',view.source,view.start);
    if(!['ddn-core@0.2','ddn-core@0.3'].includes(p.notation.registry))throw new DDNError('DDN045','Unknown notation registry',view.source,view.start);p.notation.registry='ddn-core@0.3';
    const choices=CHOICES;
    for(const [cat,props] of Object.entries(choices))for(const [key,allowed] of Object.entries(props))if(!allowed.includes(p[cat][key]))throw new DDNError('DDN046',`Unsupported ${cat}.${key}: ${p[cat][key]}`,view.source,view.start);
    if(typeof p.layout.auto_place!=='boolean')throw new DDNError('DDN046','layout.auto_place must be boolean',view.source,view.start);
    if(quantity(p.layout.grid_step,32)<8||quantity(p.layout.grid_step,32)>512)throw new DDNError('DDN046','layout.grid_step must be between 8px and 512px',view.source,view.start);
    // Omitted centre follows the pinned pattern policy; explicit profile/local values win.
    const layoutDef=view.props.layout?ws.resolve(view.props.layout,view):bundle?.props.layout?ws.resolve(bundle.props.layout,bundle):null;
    const centerSpecified=(layoutDef&&Object.hasOwn(layoutDef.props,'center'))||Object.hasOwn(group(view,'layout')?.props||{},'center');
    if(!centerSpecified&&['auto','fit_grid','circular','radial','spanning_tree','organic'].includes(p.layout.algorithm))p.layout.center='pins';
    if(p.style.roughness!==undefined&&(!Number.isFinite(p.style.roughness)||p.style.roughness<0||p.style.roughness>3))throw new DDNError('DDN046','style.roughness must be a number from 0 to 3',view.source,view.start);
    if(p.style.hachure!==undefined&&typeof p.style.hachure!=='boolean')throw new DDNError('DDN046','style.hachure must be boolean',view.source,view.start);
    if(!Number.isSafeInteger(p.style.seed)||p.style.seed<0||p.style.seed>4294967295)throw new DDNError('DDN046','style.seed must be an integer from 0 to 4294967295',view.source,view.start);
    if(!Number.isSafeInteger(p.layout.columns)||p.layout.columns<1||p.layout.columns>100)throw new DDNError('DDN046','layout.columns must be 1..100',view.source,view.start);
    if(!Number.isSafeInteger(p.display.depth)||p.display.depth<0||p.display.depth>64)throw new DDNError('DDN046','display.depth must be 0..64',view.source,view.start);
    if(!['repair','strict'].includes(p.layout.route_policy)||!['error','warn'].includes(p.layout.quality))throw new DDNError('DDN046','Invalid routing policy',view.source,view.start);
    if(p.legend.mode==='numbers'&&p.legend.placement==='none')throw new DDNError('DDN047','Numbered relationships require a legend',view.source,view.start);
    function resolveValue(v,n){if(Array.isArray(v))return v.map(x=>resolveValue(x,n));if(v&&typeof v==='object'){if(v.$ref)return {$ref:ws.resolve(v,n).uid};const o={};for(const[k,x]of Object.entries(v))if(k!=='$offset')o[k]=resolveValue(x,n);return o;}return v;}
    for(const prop of ['object_clearance','edge_clearance','port_clearance','gap','row_gap'])if(quantity(p.layout[prop],0)<0)throw new DDNError('DDN046','Layout lengths cannot be negative: '+prop,view.source,view.start);
    if(p.layout.junctions!==undefined&&p.layout.junctions!=='explicit')throw new DDNError('DDN046','Only explicit junction semantics are allowed',view.source,view.start);
    if(p.layout.shared_segments!==undefined&&p.layout.shared_segments!=='forbidden')throw new DDNError('DDN046','Shared network trunks require an adopted network profile; independent sharing is forbidden',view.source,view.start);
    if(p.publication.metrics!==undefined&&!['required','allow_estimated'].includes(p.publication.metrics))throw new DDNError('DDN046','metrics must be required or allow_estimated',view.source,view.start);
    if(quantity(p.publication.margin,32)<0)throw new DDNError('DDN046','Page margin must be nonnegative',view.source,view.start);
    if(p.publication.orientation!==undefined&&!['portrait','landscape'].includes(p.publication.orientation))throw new DDNError('DDN046','Unknown page orientation',view.source,view.start);
    for(const prop of ['title','caption'])if(p.publication[prop]!==undefined&&typeof p.publication[prop]!=='string')throw new DDNError('DDN046','Publication '+prop+' must be text',view.source,view.start);
    function validateCurvePolicy(policy,source,offset){
      if(policy.routing!==undefined&&!CHOICES.layout.routing.includes(policy.routing))throw new DDNError('DDN046','Unknown connector routing '+policy.routing,source,offset);
      if(policy.curve!==undefined&&!CHOICES.layout.curve.includes(policy.curve))throw new DDNError('DDN046','Unknown curve family '+policy.curve,source,offset);
      if(policy.curve_tension!==undefined&&(!Number.isFinite(policy.curve_tension)||policy.curve_tension<=0||policy.curve_tension>1))throw new DDNError('DDN046','curve_tension must be >0 and <=1',source,offset);
      if(policy.curve_radius!==undefined&&(quantity(policy.curve_radius,0)<=0||quantity(policy.curve_radius,0)>1000))throw new DDNError('DDN046','curve_radius must be >0 and <=1000px',source,offset);
    }
    validateCurvePolicy(p.layout,view.source,view.start);
    const elements=rawNodes.map(n=>{
      const kind=n.props.kind||({domain:'domain',sample:'sample',flow:'pipeline',assertion:'observation'}[n.type]||'object');
      const k=kindEntry(registry,kind);if(!k)throw new DDNError('DDN050','Unknown object kind '+kind,n.source,n.start);
      const fields=getFields(n).map(f=>{let parentPath=f.path.split('.').slice(0,-1).join('.'),parentNode=ws.symbols.get(f.doc.module+'::'+parentPath);return {id:f.uid,name:f.label||f.id,local:f.id,path:f.path.slice(n.path.length+1),depth:f.path.split('.').length-n.path.split('.').length-1,parent:parentNode?.type==='field'?parentNode.uid:null,properties:resolveValue(f.props,f),source:{file:f.source,start:f.start,end:f.end}};});
      const ports=getPorts(n).map(f=>({id:f.uid,name:f.label||f.id,local:f.id,properties:resolveValue(f.props,f)}));
      const properties=resolveValue(n.props,n);
      if(n.type==='sample'){
        if(!Array.isArray(properties.columns)||!Array.isArray(properties.rows))throw new DDNError('DDN051','Sample requires columns and rows',n.source,n.start);
        for(const c of n.props.columns){const f=ws.resolve(c,n);if(f.type!=='field')throw new DDNError('DDN052','Sample columns must bind to fields',n.source,n.start);}
        for(const row of properties.rows)if(!Array.isArray(row)||row.length!==properties.columns.length)throw new DDNError('DDN053','Sample row width does not match columns',n.source,n.start);
      }
      return {id:n.uid,ref:n.path,local:n.id,name:n.label||n.id,type:n.type,kind:k.keyword,kindCode:k.code,properties,fields,ports,source:{file:n.source,start:n.start,end:n.end}};
    });
    const elementIds=new Set(elements.map(n=>n.id));
    function endpoint(r,n){let t=ws.resolve(r,n);if(['field','port'].includes(t.type)){const path=t.path.split('.');path.pop();let owner=ws.symbols.get(t.doc.module+'::'+path.join('.'));while(owner?.type==='field'){path.pop();owner=ws.symbols.get(t.doc.module+'::'+path.join('.'));}if(!owner||!elementIds.has(owner.uid))throw new DDNError('DDN054','Endpoint owner is outside the selected data modules',n.source,n.start);return {element:owner.uid,member:t.uid,role:t.type};}if(!elementIds.has(t.uid))throw new DDNError('DDN054','Relation endpoint is not a data element in scope',n.source,n.start);return {element:t.uid};}
    const relations=rawRelations.map(n=>{if(!n.from||!n.to)throw new DDNError('DDN055','Relation requires two endpoints',n.source,n.start);let r=relationEntry(registry,n.props.kind||'assoc');if(!r)throw new DDNError('DDN056','Unknown relationship kind '+n.props.kind,n.source,n.start);return{id:n.uid,ref:n.path,name:n.label||r.name,kind:r.keyword,kindCode:r.code,from:endpoint(n.from,n),to:endpoint(n.to,n),properties:resolveValue(n.props,n),source:{file:n.source,start:n.start,end:n.end}};});
    let selected=view.props.select==='all'||view.props.select===undefined?elements.map(n=>n.id):view.props.select.map(r=>ws.resolve(r,view).uid);
    if(!Array.isArray(selected)||selected.some(id=>!elementIds.has(id)))throw new DDNError('DDN057','View selection contains a non-element or out-of-scope element',view.source,view.start);
    const excluded=(view.props.exclude||[]).map(r=>ws.resolve(r,view).uid);selected=[...new Set(selected)].filter(id=>!excluded.includes(id));
    if(p.display.samples==='hide')selected=selected.filter(id=>elements.find(n=>n.id===id).type!=='sample');
    const shown=new Set(selected),visibleRelations=p.display.relations==='none'?[]:relations.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element));
    const keys={},seen=new Map();
    for(const [ref,num] of Object.entries(p.legend.keys||{})){
      let matches=relations.filter(r=>r.id===ref||r.ref===ref||r.ref.split('.').at(-1)===ref);if(matches.length>1)throw new DDNError('DDN058','Ambiguous legend key '+ref,view.source,view.start);let target=matches[0];
      if(!target)throw new DDNError('DDN058','Legend key refers to unknown relation '+ref,view.source,view.start);
      if(!Number.isSafeInteger(num)||num<1)throw new DDNError('DDN059','Callout numbers must be positive integers',view.source,view.start);
      if(seen.has(num)&&seen.get(num)!==target.id)throw new DDNError('DDN060','Duplicate callout number '+num,view.source,view.start);seen.set(num,target.id);keys[target.id]=num;
    }
    if(p.legend.mode==='numbers')for(const r of visibleRelations)if(!keys[r.id])throw new DDNError('DDN061','Missing explicit callout number for '+r.ref,view.source,view.start);
    const placements={},routes={},subdiagrams=[],frames=[];
    for(const n of view.children.filter(n=>!n.group)){
      if(n.type==='place'){const target=ws.resolve(n.target,view);if(!shown.has(target.uid))throw new DDNError('DDN062','Placement target is not selected',n.source,n.start);placements[target.uid]=clean(n.props);}
      else if(n.type==='route'){validateCurvePolicy(n.props,n.source,n.start);const target=ws.resolve(n.target,view);if(!visibleRelations.some(r=>r.id===target.uid))throw new DDNError('DDN063','Route target is not visible',n.source,n.start);routes[target.uid]=clean(n.props);}
      else if(n.type==='subdiagram'){const target=ws.resolve(n.props.view,n);if(target.type!=='view')throw new DDNError('DDN064','Subdiagram target must be a view',n.source,n.start);if(!['reference','inline'].includes(n.props.mode))throw new DDNError('DDN900','Reference renderer supports reference and inline modes; balanced collapsed interfaces are specified separately',n.source,n.start);const child=n.props.mode==='inline'?build(files,target.source,target.uid,registry,[...stack,view.uid]).ir:null;subdiagrams.push({id:n.uid,target:target.uid,targetName:target.label||target.id,targetLocal:target.id,name:n.props.label||n.label||target.label||target.id,...clean(n.props),child});}
      else if(n.type==='frame'){frames.push({id:n.uid,name:n.label||n.props.label||n.id,scope:n.props.scope?ws.resolve(n.props.scope,n).uid:null,members:(n.props.members||[]).map(r=>ws.resolve(r,n).uid),...Object.fromEntries(Object.entries(clean(n.props)).filter(([k])=>!['scope','members'].includes(k)))});}
      else throw new DDNError('DDN900','Reference renderer does not implement view declaration '+n.type,n.source,n.start);
    }
    const diagnostics=[];if([...ws.docs.values()].some(d=>d.version==='0.2'))diagnostics.push({code:'DDN-W012',severity:'warning',message:'0.2 source accepted through compatibility reader. Migrate headers and review new semantic/routing diagnostics.'});
    const currentLanguage=[...ws.docs.values()].some(d=>d.version==='0.5')?'0.5':[...ws.docs.values()].some(d=>d.version==='0.4')?'0.4':'0.3';
    const ir={format:'ddn-resolved@'+currentLanguage,language:currentLanguage,registry:'ddn-core@0.3',entry,view:{id:view.uid,name:view.label||view.id,local:view.id,selected,relations:visibleRelations.map(r=>r.id),profiles:p,keys,placements,routes,subdiagrams,frames,source:{file:view.source,start:view.start,end:view.end,bodyEnd:view.bodyEnd}},elements,relations,diagnostics};
    if(p.projection.kind==='panels' && Array.isArray(p.projection.panels)){
      ir.view.children=[];
      for(const panel of p.projection.panels){if(!panel.view)continue;
        const target=ws.uidMap.get(panel.view.$ref);
        if(!target||target.type!=='view')throw new DDNError('DDN-QP001','Panel view must resolve to a named view',view.source,view.start);
        const child=build(files,target.source,target.uid,registry,[...stack,view.uid]).ir;
        if(child.view.profiles.projection.kind==='panels' && child.view.children?.length)throw new DDNError('DDN-QP002','Composed panels support one child-view level; recursive dashboards are not supported',view.source,view.start);
        if(child.view.selected.length>128 || child.view.relations.length>384)throw new DDNError('DDN-QP003','Child exceeds visible graph limits',view.source,view.start);
        ir.view.children.push({slot:panel.id,ir:child});
      }
      if(ir.view.children.length>12)throw new DDNError('DDN-QP003','At most twelve embedded child views are permitted',view.source,view.start);
    }
    if(p.projection.profile==='uml.interaction_overview@1'){
      const viewIds=new Set();for(const n of ws.symbols.values())if(n.type==='view'){viewIds.add(n.id);viewIds.add(n.uid);}
      for(const n of ir.elements){const target=n.properties&&n.properties.x_subdiagram&&n.properties.x_subdiagram.view;
        if(typeof target==='string'&&!viewIds.has(target))throw new DDNError('DDN-PJ119','Interaction overview node '+(n.name||n.id)+' references unknown view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);}
    }
    if(!Contracts)throw new DDNError('DDN099','Load ddn-contracts.js before ddn-core.js');ir.diagnostics.push(...Contracts.validate(ir,registry,DDNError));
    ir.diagnostics.push(...Profiles.validate(ir,registry,DDNError));
    return {ir,workspace:ws,viewNode:view};
  }
  function semanticJSON(ir){function canon(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(canon);const o={};for(const k of Object.keys(v).sort())if(!['source','ref','local'].includes(k))o[k]=canon(v[k]);return o;}const es=new Map(),rs=new Map();function visit(x){x.elements.forEach(n=>es.set(n.id,n));x.relations.forEach(n=>rs.set(n.id,n));for(const c of x.view?.children||[])visit(c.ir);}visit(ir);return {format:ir.format,elements:[...es.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(canon),relations:[...rs.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(canon)};}
  return {VERSION,SOURCE_VERSIONS,DDNError,lex,parse,createWorkspace,build,children,group,values,getFields,fieldTree,getPorts,clean,quantity,kindEntry,relationEntry,semanticJSON,DEFAULTS,PROPERTIES,CHOICES,profiles:Profiles};
});
