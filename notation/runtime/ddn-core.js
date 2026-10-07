/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN reference decoder, 0.8.0. No runtime dependencies.
 * This is an executable core demonstrator, NOT a complete conformance implementation.
 */
import {publishNamespace} from './ddn-module-registry.js';
import Contracts from './ddn-contracts.js';
import Profiles from './ddn-profiles.js';
import ViewProfiles from './ddn-view-profiles.js';
import RegistryCatalogue from './assets/catalogue.js';
import ICONLIBS from './assets/icon-libraries.js';
import {registerIconPack as regPack,unregisterIconPack,hostIconPacks,validateIconPack,registerArtPack,unregisterArtPack,hostArtPacks,validateArtPack} from './ddn-icon-sanitize.js';
import {namespace as ddnNamespace} from './ddn-module-registry.js';
  'use strict';
  const VERSION = '0.8.0';
  const SOURCE_VERSIONS=Object.freeze(['0.2','0.3','0.4','0.5','0.6']);
  const V06=SOURCE_VERSIONS.indexOf('0.6');
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
      if('{}[]:;,.@()'.includes(c)){out.push({type:c,value:c,start,end:++i});continue;}
      fail('DDN006',`Unexpected character ${JSON.stringify(c)}`,{start},source);
    }
    out.push({type:'eof',value:'',start:i,end:i});return out;
  }
  /* B1-037 compact authoring, phase 1 (D1–D5). Compact forms desugar in the
   * parser to the IDENTICAL canonical AST as the verbose form; no IR, runtime
   * or renderer changes.
   * D2/D3: a registry object-kind keyword (or a declared alias) in declaration
   * position inside a data block introduces an object of that kind:
   *   table customer "Customer" { … }  ≡  object customer "Customer" { kind: table; … }
   * D4: kind words are contextual — recognized only at data-child declaration
   * start followed by an identifier. Structural declaration keywords
   * (object, domain, sample, flow, assertion, relation) keep their meaning, so
   * `object table "…"` and `object fields "…"` still parse, and a `view`/`field`
   * kind word is a typed declaration ONLY inside a data block.
   * D5: inside fields {}/ports {} groups a bare `id ["label"] (block|";")` is a
   * field/port member; the explicit field/port keywords stay valid (mixed
   * blocks allowed), and a nested group keyword (`fields {…}`) still wins. */
  const STRUCTURAL_DATA_DECLS=new Set(['object','domain','sample','flow','assertion','relation','fields','ports']);
  /* B1-041 compact authoring, phase 5 (D1–D8). Author-controlled reuse:
   * named field/port groups, relation property sets, generic property
   * presets (motion presets are presets carrying B1-033 keys) and
   * unparameterized include-by-reference fragments. Definitions are
   * top-level declarations; applications are `use: @name;` (or a list
   * `use: [@a, @b];`) inside a data block (fragments), a fields/ports
   * group (member groups) or an element/relation/flow body (property
   * presets). The parser records a $use marker child; createWorkspace
   * expands markers to the IDENTICAL canonical AST as the handwritten
   * inline form before indexing, so identities are exactly as declared
   * inline (no synthetic prefixes). Local properties override presets;
   * two presets conflicting on a property are a coded error (DDN-E017)
   * unless the declaration resolves it locally; preset-applied
   * properties are ASSERTED, never omitted, and a preset never smuggles
   * in properties the author did not select. `version: N` in a
   * definition is documentary only (integer, ignored semantically). */
  const PRESET_DEFS=new Set(['fields','ports','relation_props','preset','fragment']);
  let defaultTypedKinds=null;
  function typedKindWords(reg){
    const kinds=Profiles.registry(reg||RegistryCatalogue).kinds,map=new Map();
    for(const k of kinds)for(const w of [k.keyword,...(k.aliases||[])]){
      if(!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(w)||STRUCTURAL_DATA_DECLS.has(w))continue;
      if(!map.has(w))map.set(w,k.keyword);
    }
    return map;
  }
  /* B1-038 compact authoring, phase 2 (D1–D6). Verb-keyword relations and
   * named relation batches desugar in the parser to the IDENTICAL canonical
   * relation AST; no IR, runtime or renderer changes.
   * D1: a registry relationship keyword (or declared alias) in declaration
   * position inside a data block introduces a relation of that kind:
   *   ref places "places" @customer [one] -> @purchase [zeromany] { enforcement: database; }
   *   ≡ relation places "places" @customer -> @purchase
   *     { kind: ref; source_mark: one; target_mark: zeromany; enforcement: database; }
   * Brackets are optional per side; an OMITTED bracket omits the mark property
   * (never defaulted). Enforcement is never implied (D2).
   * D3: verb words are contextual like kind words — declaration position only,
   * and words that are both a kind and a verb (note, report, test, …) read as
   * a relation ONLY when endpoints follow the id/label; `object ref "…"`
   * still parses.
   * D4: `relations <kind> { shared props; id "label" @x -> @y { overrides }; … }`
   * expands to one canonical relation per entry; per-entry properties win over
   * batch-shared ones; identity is never positional. */
  let defaultRelationKinds=null;
  function relationKindWords(reg){
    const kinds=Profiles.registry(reg||RegistryCatalogue).relationships,map=new Map();
    for(const k of kinds)for(const w of [k.keyword,...(k.aliases||[])]){
      if(!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(w)||STRUCTURAL_DATA_DECLS.has(w))continue;
      if(!map.has(w))map.set(w,k.keyword);
    }
    return map;
  }
  /* B1-039 compact authoring, phase 3 (D1–D5). One-line view headers desugar
   * in the parser to the IDENTICAL canonical view AST; no IR, runtime or
   * renderer changes.
   * D1: `view <id> ["label"] ":" <datasource> ("as" <profile>)? (";"|"{…}")`
   *   view erd: @sales as "erd.crowfoot@1";
   *   ≡ view erd { data: [@sales]; projection { kind: graph; profile: "erd.crowfoot@1"; } }
   * The datasource is `@name` or an explicit list `[@a, @b]`; the label keeps
   * its existing position after the id. The header supplies data (+projection
   * when `as` is given) only; an optional body merges exactly like canonical
   * properties/groups.
   * D2: the versioned profile string uniquely identifies the projection kind
   * (verified against standard/registry/profiles/catalogue.json: 98 profiles,
   * no duplicate ids, every id maps to exactly one projection). An unknown or
   * ambiguous profile string in a header is a coded parse error (DDN-E015) —
   * never a guess, because the canonical form derives kind from the registry.
   * D3: omitting `as` mirrors a view without a projection block exactly — the
   * default profile applies at build (DEFAULTS.projection), unchanged.
   * D4: a body `projection` block or `projection:` property after a header
   * `as` conflicts with the header — coded parse error DDN-E015; a body
   * `data:` property stays a plain duplicate (DDN011).
   * D5: normalize tool unchanged (canonical-verbose output; compact input
   * preserved). */
  let defaultProfileKinds=null;
  function projectionProfileKinds(){
    if(defaultProfileKinds)return defaultProfileKinds;
    const map=new Map();
    for(const p of Profiles.catalogue.profiles){
      if(map.has(p.id)){if(map.get(p.id)!==p.projection)map.set(p.id,null);}
      else map.set(p.id,p.projection);
    }
    return defaultProfileKinds=map;
  }
  function parse(text, source='input.ddn', kindWords=null, relWords=null) {
    const tokens=lex(text,source);let pos=0,depth=0;
    const typedKinds=kindWords||(defaultTypedKinds||(defaultTypedKinds=typedKindWords(null)));
    const relationKinds=relWords||(defaultRelationKinds||(defaultRelationKinds=relationKindWords(null)));
    const peek=(n=0)=>tokens[pos+n], take=()=>tokens[pos++];
    function expect(type,value){let t=take();if(t.type!==type||(value!==undefined&&t.value!==value))fail('DDN010',`Expected ${value||type}; found ${t.value||t.type}`,t,source);return t;}
    function ref(){const t=expect('@');let parts=[expect('id').value];while(peek().type==='.'){take();parts.push(expect('id').value);}return {$ref:parts.join('.'),$offset:t.start};}
    function value(){let t=peek();if(t.type==='@')return ref();if(['string','number','quantity'].includes(t.type))return take().value;
      if(t.type==='id'){take();if(t.value==='true')return true;if(t.value==='false')return false;if(t.value==='null')return null;if(['undecided','not_applicable','conflicting'].includes(t.value))return {$state:t.value};if(t.value==='missing')return {$missing:true};return t.value;}
      if(t.type==='['){take();const a=[];if(++depth>80)fail('DDN007','Maximum nesting exceeded',t,source);while(peek().type!==']'){a.push(value());if(peek().type!==',')break;take();}expect(']');depth--;return a;}
      if(t.type==='{'){take();const o=Object.create(null);if(++depth>80)fail('DDN007','Maximum nesting exceeded',t,source);while(peek().type!=='}'){let k=take();if(!['string','id'].includes(k.type))fail('DDN010','Expected record key',k,source);if(['__proto__','prototype','constructor'].includes(k.value))fail('DDN008','Reserved key',k,source);if(Object.hasOwn(o,k.value))fail('DDN011',`Duplicate property ${k.value}`,k,source);expect(':');o[k.value]=value();if(![',',';'].includes(peek().type))break;take();}expect('}');depth--;return o;}
      fail('DDN010','Expected a value',t,source);
    }
    function useMarker(node,t){take();
      /* 0.8 amendment (parameterized reuse): a use: reference may carry an
       * argument list @name(a1, a2) — bound to the definition's parameters
       * at expansion; args on a parameterless definition are DDN-FG01. */
      const argList=r=>{if(peek().type!=='(')return;take();const args=[];
        for(;;){args.push(value());if(peek().type!==',')break;take();}
        expect(')');r.$args=args;};
      const refs=[];
      if(peek().type==='['){take();if(peek().type===']')fail('DDN-E017','use: needs at least one preset or fragment reference',peek(),source);
        for(;;){if(peek().type!=='@')fail('DDN010','Expected a @preset reference in the use: list',peek(),source);const r=ref();argList(r);refs.push(r);if(peek().type!==',')break;take();}expect(']');}
      else{const r=ref();argList(r);refs.push(r);}
      expect(';');
      node.children.push({type:'$use',refs,start:t.start,end:tokens[pos-1].end,source});
    }
    function body(node){expect('{');node.bodyStart=tokens[pos-1].end;if(++depth>80)fail('DDN007','Maximum nesting exceeded',peek(),source);
      while(peek().type!=='}'){
        if(peek().type==='eof')fail('DDN010','Missing closing brace',peek(),source);
        const t=expect('id');
        if(t.value==='use'&&peek().type===':'){useMarker(node,t);continue;}
        if(peek().type===':'){take();if(t.value==='projection'&&node.headerProjection)fail('DDN-E015','Body projection property conflicts with the `as` profile in the view header; write either the header form or the canonical projection, not both',t,source);if(Object.hasOwn(node.props,t.value))fail('DDN011',`Duplicate property ${t.value}`,t,source);if(['__proto__','prototype','constructor'].includes(t.value))fail('DDN008','Reserved key',t,source);node.props[t.value]=value();
          // B1-033: a flow block's steps chain reads `@a -> @b -> @c` as one ordered step list.
          if(t.value==='steps'){while(peek().type==='->'){take();node.props.steps=[...(Array.isArray(node.props.steps)?node.props.steps:[node.props.steps]),value()];}}
          expect(';');}
        else if((node.type==='fields'||node.type==='ports')&&peek().type!=='id'&&!(peek().type==='{'&&t.value===node.type))
          node.children.push(contextualMember(node.type,t));
        else if(!node.group&&(node.type==='data'||node.type==='fragment')&&t.value==='relations'&&peek().type==='id'&&relationKinds.has(peek().value))
          relationBatch(node);
        else if(!node.group&&(node.type==='data'||node.type==='fragment')&&peek().type==='id'&&(typedKinds.has(t.value)||relationKinds.has(t.value)))
          node.children.push(compactDataDeclaration(t));
        else if(node.headerProjection&&peek().type==='{'&&t.value==='projection')
          fail('DDN-E015','Body projection block conflicts with the `as` profile in the view header; write either the header form or the canonical projection, not both',t,source);
        else node.children.push(declaration(t));
      }
      node.bodyEnd=peek().start;node.end=take().end;depth--;if(peek().type===';')node.end=take().end;return node;
    }
    function typedDeclaration(t,keyword){let n={type:'object',id:null,label:null,props:Object.create(null),children:[],start:t.start,source};
      n.props.kind=keyword;n.id=expect('id').value;
      if(peek().type==='string')n.label=take().value;
      if(peek().type==='@'){n.from=ref();expect('->');n.to=ref();}
      if(peek().type===';'){n.end=take().end;return n;}
      return body(n);
    }
    // B1-038 D3: a word that is both an object-kind word and a relationship
    // word (note, report, test, …) is a relation only when endpoints follow
    // the id/label; otherwise it stays a typed object declaration.
    function compactDataDeclaration(t){
      let j=pos+1;if(tokens[j]?.type==='string')j++;
      if(relationKinds.has(t.value)&&(tokens[j]?.type==='@'||!typedKinds.has(t.value)))
        return compactRelation(t,relationKinds.get(t.value));
      return typedDeclaration(t,typedKinds.get(t.value));
    }
    function markBracket(n,key){if(peek().type==='['){take();n.props[key]=expect('id').value;expect(']');}}
    function compactRelation(t,keyword){let n={type:'relation',id:null,label:null,props:Object.create(null),children:[],start:t.start,source};
      n.props.kind=keyword;n.id=expect('id').value;
      if(peek().type==='string')n.label=take().value;
      if(peek().type==='@'){n.from=ref();markBracket(n,'source_mark');expect('->');n.to=ref();markBracket(n,'target_mark');}
      if(peek().type===';'){n.end=take().end;return n;}
      return body(n);
    }
    /* B1-038 D4: named batch. Shared properties use canonical property names;
     * each entry carries its own id/label/endpoints (identity never
     * positional) and optional bracket marks; per-entry properties win over
     * batch-shared ones. The batch header fixes the kind, so `kind:` in a
     * shared or entry position is a duplicate property (DDN011). */
    function relationBatch(node){
      const kw=take(),keyword=relationKinds.get(kw.value),shared=Object.create(null);
      expect('{');if(++depth>80)fail('DDN007','Maximum nesting exceeded',kw,source);
      while(peek().type!=='}'){
        if(peek().type==='eof')fail('DDN010','Missing closing brace',peek(),source);
        const t=expect('id');
        if(peek().type===':'){take();
          if(t.value==='use')fail('DDN-E017','use: is not legal in a relations batch header; apply property presets inside each entry body',t,source);
          if(t.value==='kind')fail('DDN011','Duplicate property kind (set by the batch header)',t,source);
          if(Object.hasOwn(shared,t.value))fail('DDN011',`Duplicate property ${t.value}`,t,source);
          if(['__proto__','prototype','constructor'].includes(t.value))fail('DDN008','Reserved key',t,source);
          shared[t.value]=value();expect(';');continue;}
        let n={type:'relation',id:t.value,label:null,props:Object.create(null),children:[],start:t.start,source};
        if(peek().type==='string')n.label=take().value;
        n.from=ref();markBracket(n,'source_mark');expect('->');n.to=ref();markBracket(n,'target_mark');
        if(peek().type==='{')body(n);
        else if(peek().type===';')n.end=take().end;
        else fail('DDN010',`Expected ; or block after relation ${n.id}`,peek(),source);
        if(Object.hasOwn(n.props,'kind'))fail('DDN011','Duplicate property kind (set by the batch header)',{start:n.start},source);
        const merged=Object.create(null);merged.kind=keyword;
        for(const k of Object.keys(shared))merged[k]=shared[k];
        for(const k of Object.keys(n.props))merged[k]=n.props[k];
        n.props=merged;node.children.push(n);
      }
      take();depth--;if(peek().type===';')take();
    }
    function contextualMember(groupType,t){let n={type:groupType==='fields'?'field':'port',id:t.value,label:null,props:Object.create(null),children:[],start:t.start,source};
      if(peek().type==='string')n.label=take().value;
      if(peek().type===';'){n.end=take().end;return n;}
      if(peek().type==='{')return body(n);
      fail('DDN010',`Expected ; or block after ${n.type} ${n.id}`,peek(),source);
    }
    function declaration(t){let n={type:t.value,id:null,label:null,props:Object.create(null),children:[],start:t.start,source};
      if(['place','route'].includes(n.type)){n.target=ref();n.id=n.target.$ref;return body(n);}
      if(peek().type==='{'){n.group=true;n.id=n.type;return body(n);}
      n.id=expect('id').value;
      /* 0.8 amendment (parameterized reuse): fragment name(p1, p2) declares
       * 1-8 unique substitution parameters. */
      if(n.type==='fragment'&&peek().type==='('){take();n.params=[];
        if(peek().type===')')fail('DDN-FG06','A parameterized fragment declares at least one parameter',peek(),source);
        for(;;){const p=expect('id');if(n.params.includes(p.value))fail('DDN-FG06','Duplicate parameter '+p.value+' in fragment '+n.id,p,source);n.params.push(p.value);if(n.params.length>8)fail('DDN-FG06','A fragment declares at most 8 parameters',p,source);if(peek().type!==',')break;take();}
        expect(')');}
      if(peek().type==='string')n.label=take().value;
      if(n.type==='view'&&peek().type===':')return viewHeader(n);
      if(peek().type==='@'){n.from=ref();expect('->');n.to=ref();}
      if(peek().type===';'){n.end=take().end;return n;}
      return body(n);
    }
    // B1-039 D1/D2: compact view header. Sets props.data (a single reference
    // or an explicit list) and, when `as` is present, a projection group child
    // identical to the canonical `projection { kind: …; profile: …; }` block.
    function viewHeader(n){
      take();
      if(peek().type==='['){const t=peek();const a=[];if(++depth>80)fail('DDN007','Maximum nesting exceeded',t,source);
        take();while(peek().type!==']'){a.push(headerRef());if(peek().type!==',')break;take();}expect(']');depth--;n.props.data=a;}
      else n.props.data=[headerRef()];
      if(peek().type==='id'&&peek().value==='as'){
        take();const t2=expect('string'),profile=t2.value,kind=projectionProfileKinds().get(profile);
        if(kind===undefined)fail('DDN-E015',`Unknown diagram profile ${JSON.stringify(profile)} in view header; the header form derives projection.kind from the registry, so the profile must be registered (or write the canonical projection block)`,t2,source);
        if(kind===null)fail('DDN-E015',`Ambiguous diagram profile ${JSON.stringify(profile)} in view header; the registry maps it to more than one projection kind — write the canonical projection block instead`,t2,source);
        const g={type:'projection',group:true,id:'projection',label:null,props:Object.create(null),children:[],start:t2.start,source};
        g.props.kind=kind;g.props.profile=profile;n.children.push(g);n.headerProjection=true;
      }
      if(peek().type===';'){n.end=take().end;return n;}
      if(peek().type==='{')return body(n);
      fail('DDN010',`Expected ; or block after view header`,peek(),source);
    }
    function headerRef(){if(peek().type!=='@')fail('DDN010','Expected a @data reference in the view header',peek(),source);return ref();}
    /* B1-040 D1: keyed tabular records. A `records` block is a data block
     * whose column order is declared once and each `row <id>:` desugars to
     * the identical canonical
     * `object <id> "<label>" { kind: record; x_record: {…} }` declaration —
     * per-row identity, column order, scalar types and the
     * missing/null/undecided distinction preserved, so projections, refresh
     * (row ids ARE the B1-029 keys) and validation are unchanged. Canonical
     * data members (objects, relations, typed/batch forms) mix in freely. */
    function recordsDeclaration(t){
      let n={type:'data',id:null,label:null,props:Object.create(null),children:[],start:t.start,source,compactRecords:true};
      n.id=expect('id').value;
      if(peek().type==='string')n.label=take().value;
      expect('{');n.bodyStart=tokens[pos-1].end;if(++depth>80)fail('DDN007','Maximum nesting exceeded',peek(),source);
      let columns=null,labelColumn=null,sawRow=false;
      while(peek().type!=='}'){
        if(peek().type==='eof')fail('DDN010','Missing closing brace',peek(),source);
        const t2=expect('id');
        if(t2.value==='use'&&peek().type===':'){useMarker(n,t2);continue;}
        if(t2.value==='columns'&&peek().type===':'){take();
          if(sawRow)fail('DDN-E016','The columns declaration must precede every row of a records block',t2,source);
          if(columns)fail('DDN011','Duplicate property columns',t2,source);
          columns=[];
          for(;;){const ct=expect('id');
            if(['__proto__','prototype','constructor'].includes(ct.value))fail('DDN008','Reserved key',ct,source);
            if(columns.includes(ct.value))fail('DDN011',`Duplicate column ${ct.value}`,ct,source);
            columns.push(ct.value);
            if(peek().type!==',')break;take();}
          expect(';');continue;}
        if(t2.value==='label_column'&&peek().type===':'){take();
          if(sawRow)fail('DDN-E016','The label_column declaration must precede every row of a records block',t2,source);
          if(labelColumn)fail('DDN011','Duplicate property label_column',t2,source);
          labelColumn=expect('id').value;expect(';');continue;}
        if(t2.value==='row'){if(!columns)fail('DDN-E016','A records block must declare columns before its first row',t2,source);
          sawRow=true;n.children.push(recordRow(t2,columns,labelColumn));continue;}
        if(t2.value==='relations'&&peek().type==='id'&&relationKinds.has(peek().value)){relationBatch(n);continue;}
        if(peek().type==='id'&&(typedKinds.has(t2.value)||relationKinds.has(t2.value))){n.children.push(compactDataDeclaration(t2));continue;}
        n.children.push(declaration(t2));
      }
      if(!columns)fail('DDN-E016','A records block requires a columns declaration',{start:n.start},source);
      if(labelColumn&&!columns.includes(labelColumn))fail('DDN-E016',`label_column ${labelColumn} is not one of the declared columns (${columns.join(', ')})`,{start:n.start},source);
      n.bodyEnd=peek().start;n.end=take().end;depth--;if(peek().type===';')n.end=take().end;
      return n;
    }
    function recordRow(kw,columns,labelColumn){
      let n={type:'object',id:null,label:null,props:Object.create(null),children:[],start:kw.start,source};
      n.id=expect('id').value;expect(':');
      const vals=[recordScalar()];
      while(peek().type===','){take();vals.push(recordScalar());}
      if(vals.length!==columns.length)fail('DDN-E016',`Row ${n.id} declares ${vals.length} value(s) but the records block declares ${columns.length} column(s) (${columns.join(', ')})`,kw,source);
      if(labelColumn&&!columns.includes(labelColumn))fail('DDN-E016',`label_column ${labelColumn} is not one of the declared columns (${columns.join(', ')})`,kw,source);
      n.props.kind='record';
      const xr=Object.create(null);columns.forEach((c,i)=>{xr[c]=vals[i];});
      n.props.x_record=xr;
      n.compactRow={columns:[...columns],labelColumn};
      // The label column supplies the display label when it holds a string or
      // finite number; any other scalar (missing/null/state/boolean) falls
      // back to the row id, mirroring the canonical `label||id` display rule.
      const lv=labelColumn?xr[labelColumn]:undefined;
      n.label=typeof lv==='string'?lv:(typeof lv==='number'&&Number.isFinite(lv)?String(lv):n.id);
      if(peek().type===';'){n.end=take().end;return n;}
      if(peek().type==='{'){body(n);
        if(n.children.length)fail('DDN-E016',`Row ${n.id}: a row body carries extra properties only; nested declarations are not supported`,{start:n.start},source);
        return n;}
      fail('DDN010',`Expected ; or block after row ${n.id}`,peek(),source);
    }
    function recordScalar(){
      const t=peek();
      if(['string','number','quantity'].includes(t.type))return take().value;
      if(t.type==='id'){take();
        if(t.value==='true')return true;if(t.value==='false')return false;if(t.value==='null')return null;
        if(['undecided','not_applicable','conflicting'].includes(t.value))return {$state:t.value};
        if(t.value==='missing')return {$missing:true};
        return t.value;}
      fail('DDN-E016','Row values must be scalar literals (string, number, quantity, boolean, null, missing, undecided, not_applicable, conflicting, or a bare word)',t,source);
    }
    expect('id','ddn');let version=expect('string').value;expect(';');
    if(!SOURCE_VERSIONS.includes(version))fail('DDN012',`Unsupported language version ${version}; expected ${SOURCE_VERSIONS.join(', ')}`,tokens[1],source);
    const imports=[],sections=[],declarations=[];
    function importLine(){take();let path=expect('string').value;expect('id','as');let alias=expect('id').value;expect(';');if(imports.some(x=>x.alias===alias))fail('DDN014','Duplicate import alias',tokens[pos-2],source);imports.push({path,alias});}
    // File-level imports: canonical position before the first module header
    // ; the legacy position — right after the FIRST header — is also
    // accepted so existing single-module files are unchanged.
    while(peek().type==='id'&&peek().value==='import')importLine();
    do{
      expect('id','module');let module=expect('string').value;expect(';');
      if(!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(module))fail('DDN013','Invalid module identity',tokens[pos-2],source);
      if(!sections.length)while(peek().type==='id'&&peek().value==='import')importLine();
      const decls=[];
      while(peek().type!=='eof'&&!(peek().type==='id'&&peek().value==='module')){
        if(peek().type==='id'&&peek().value==='import')fail('DDN015','Import must precede the first module header (or follow it in the legacy position before any declaration)',peek(),source);
        const dt=expect('id');
        decls.push(dt.value==='records'&&peek().type==='id'?recordsDeclaration(dt):declaration(dt));
      }
      sections.push({module,declarations:decls});declarations.push(...decls);
    }while(peek().type==='id'&&peek().value==='module');
    return {version,module:sections[0].module,imports,sections,declarations,source,text};
  }
  function normalizePath(base,relative){
    if(/^(?:[a-z]+:|\/|\\)/i.test(relative)||relative.includes('\\'))throw new DDNError('DDN020','Imports must be workspace-relative POSIX paths: '+JSON.stringify(relative),base);
    const p=base.split('/').slice(0,-1);for(const bit of relative.split('/')){if(!bit||bit==='.')continue;if(bit==='..'){if(!p.length)throw new DDNError('DDN020','Import escapes workspace: '+JSON.stringify(relative),base);p.pop();}else p.push(bit);}return p.join('/');
  }
  // D4: merge a workspace (entry + transitive imports) into one
  // self-contained multi-module file. Section bodies are the original source
  // lines minus the header lines (version/module/import) — comments and
  // formatting preserved, no re-serialization. Deterministic: same workspace
  // → identical bytes. Inter-bundled import lines are dropped; references
  // written through those aliases (@alias.path) are canonicalized to
  // module-qualified sibling references (@moduleId.path) — token-precise, so
  // strings and comments are untouched — because a dropped alias no longer
  // resolves once the sections are siblings (see decision record).
  function bundle(files,entry){
    if(!Object.hasOwn(files,entry))throw new DDNError('DDN022','Missing workspace file '+entry,entry);
    const set=new Set(),order=[];
    // Explicit stack: deep import chains must not exhaust the call stack.
    const pending=[entry];
    while(pending.length){const path=pending.pop();if(set.has(path)||!Object.hasOwn(files,path))continue;set.add(path);order.push(path);const d=parse(files[path],path);for(const imp of d.imports)pending.push(normalizePath(path,imp.path));}
    // Symbol index: which module of each bundled file holds each declaration
    // path — needed when a dropped alias points at a multi-module file.
    const owner=new Map();
    try{
      const ws=createWorkspace(files,entry);
      for(const rec of ws.modules.values())for(const [key]of [...ws.symbols].filter(([,n])=>n.doc===rec)){
        const path=key.slice(rec.module.length+2);
        if(!owner.has(rec.source))owner.set(rec.source,new Map());
        const m=owner.get(rec.source);if(!m.has(path))m.set(path,rec.module);
      }
    }catch{ /* invalid workspaces still bundle textually; check reports errors */ }
    const diagnostics=[],sections=[],external=new Map(),externalOrder=[];let maxVersion=0;
    for(const path of [...order].sort((a,b)=>a===entry?-1:b===entry?1:a.localeCompare(b,'en'))){
      let text=files[path];
      const tokens=lex(text,path),starts=[0],lines=text.split('\n');
      for(let i=0;i<text.length;i++)if(text[i]==='\n')starts.push(i+1);
      const lineOf=o=>{let lo=0,hi=starts.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(starts[mid]<=o)lo=mid;else hi=mid-1;}return lo;};
      const removed=new Set(),headers=[],dropped=new Map();let depth=0;
      const mark=(a,b)=>{for(let l=lineOf(a);l<=lineOf(b);l++)removed.add(l);};
      for(let i=0;i<tokens.length;i++){
        const t=tokens[i];
        if(t.type==='{'||t.type==='[')depth++;
        else if(t.type==='}'||t.type===']')depth--;
        else if(depth===0&&t.type==='id'&&(t.value==='ddn'||t.value==='import'||t.value==='module')){
          let j=i;while(tokens[j].type!==';'&&tokens[j].type!=='eof')j++;
          if(tokens[j].type==='eof')break;
          mark(t.start,tokens[j].end);
          if(t.value==='module')headers.push({module:tokens[i+1].value,line:lineOf(t.start)});
          else if(t.value==='import'){
            const alias=tokens[j-1].value,target=normalizePath(path,tokens[i+1].value);
            if(set.has(target))dropped.set(alias,target);
            else{
              // Keyed by alias alone: two distinct external targets under one
              // alias would re-emit a duplicate alias and fail DDN014 on re-parse.
              const prev=external.get(alias),line=lines[lineOf(t.start)];
              if(!prev){external.set(alias,{alias,target,line});externalOrder.push(alias);}
              else if(prev.target!==target)diagnostics.push({code:'DDN-W014',severity:'warning',message:'Conflicting external import alias '+alias+' ('+prev.target+' vs '+target+'); first occurrence kept.',source:path});
              else if(prev.line!==line)diagnostics.push({code:'DDN-W014',severity:'warning',message:'Conflicting external import alias '+alias+'; first occurrence kept.',source:path});
            }
          }
          i=j;
        }
      }
      if(dropped.size){
        const edits=[],targetDocs=new Map();
        const docOf=p=>{if(!targetDocs.has(p))targetDocs.set(p,parse(files[p],p));return targetDocs.get(p);};
        for(let i=0;i<tokens.length-2;i++){
          const at=tokens[i];
          if(at.type!=='@'||tokens[i+1].type!=='id'||!dropped.has(tokens[i+1].value)||tokens[i+2].type!=='.')continue;
          const target=dropped.get(tokens[i+1].value);
          let rest=[],k=i+2;
          while(tokens[k].type==='.'&&tokens[k+1].type==='id'){rest.push(tokens[k+1].value);k+=2;}
          const targetDoc=docOf(target);
          let module=null;
          if(targetDoc.sections.length===1)module=targetDoc.sections[0].module;
          else module=owner.get(target)?.get(rest.join('.'))||null;
          // A module id that the lexer cannot express as a reference component
          // (/, :, leading digit) must not be substituted: it would produce
          // text the internal re-parse cannot tokenize.
          if(module&&module!==tokens[i+1].value){
            if(/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(module))edits.push({start:tokens[i+1].start,end:tokens[i+1].end,text:module});
            else diagnostics.push({code:'DDN-W014',severity:'warning',message:'Cannot canonicalize @'+tokens[i+1].value+'.'+rest.join('.')+' in '+path+': module identity '+JSON.stringify(module)+' is not expressible as a reference; reference left as-is.',source:path});
          }
          else if(!module)diagnostics.push({code:'DDN-W014',severity:'warning',message:'Cannot canonicalize @'+tokens[i+1].value+'.'+rest.join('.')+' in '+path+'; reference left as-is.',source:path});
        }
        edits.sort((a,b)=>b.start-a.start);
        for(const e of edits)text=text.slice(0,e.start)+e.text+text.slice(e.end);
      }
      const d=parse(text,path),bodyLines=text.split('\n');
      maxVersion=Math.max(maxVersion,SOURCE_VERSIONS.indexOf(d.version));
      for(let k=0;k<headers.length;k++){
        const from=headers[k].line+1,to=k+1<headers.length?headers[k+1].line:bodyLines.length;
        let body=bodyLines.slice(from,to).filter((_,i)=>!removed.has(from+i));
        while(body.length&&!body[0].trim())body.shift();
        while(body.length&&!body.at(-1).trim())body.pop();
        sections.push({file:path,module:d.sections[k].module,body:body.join('\n')});
      }
    }
    const kept=externalOrder.map(k=>external.get(k));
    if(kept.length)diagnostics.unshift({code:'DDN-W013',severity:'warning',message:'Bundle keeps imports of files outside the bundle set: '+[...new Set(kept.map(x=>x.target))].join(', '),source:entry});
    const first=sections.filter(s=>s.file===entry),rest=sections.filter(s=>s.file!==entry).sort((a,b)=>a.module.localeCompare(b.module,'en'));
    const out=[`ddn "${SOURCE_VERSIONS[maxVersion]}";`,...kept.map(x=>x.line)];
    for(const s of[...first,...rest])out.push('',`module "${s.module}";`,s.body);
    return {text:out.join('\n')+'\n',diagnostics};
  }

  function createWorkspace(files,entry,kindWords=null,relWords=null){
    const docs=new Map(),modules=new Map(),symbols=new Map(),active=new Set();
    // Iterative load: deep import chains must not exhaust the call stack.
    // Frames preserve the original pre-order (a file's module sections are
    // registered before its imports are descended into).
    function load(path){
      if(active.has(path))throw new DDNError('DDN021','Import cycle: '+[...active,path].join(' → '),path);
      if(docs.has(path))return docs.get(path);
      const stack=[];
      const open=p=>{
        if(!Object.hasOwn(files,p))throw new DDNError('DDN022','Missing workspace file '+p,p);
        active.add(p);const d=parse(files[p],p,kindWords,relWords);docs.set(p,d);d.imported=new Map();
        // A file registers ALL its module sections (D2). Module records
        // are what nodes carry as n.doc: identity, own declarations and the
        // file-level import map.
        d.moduleRecords=d.sections.map(s=>{
          if(modules.has(s.module))throw new DDNError('DDN023','Duplicate module identity '+s.module,p);
          const rec={file:d,module:s.module,declarations:s.declarations,source:p,imported:d.imported};modules.set(s.module,rec);return rec;});
        d.moduleById=new Map(d.moduleRecords.map(r=>[r.module,r]));
        stack.push({path:p,d,queue:[...d.imports]});
      };
      open(path);
      while(stack.length){
        const top=stack.at(-1);
        if(!top.queue.length){active.delete(top.path);stack.pop();continue;}
        const imp=top.queue[0],child=normalizePath(top.path,imp.path);
        if(active.has(child))throw new DDNError('DDN021','Import cycle: '+[...active,child].join(' → '),child);
        if(docs.has(child)){top.d.imported.set(imp.alias,docs.get(child));top.queue.shift();continue;}
        open(child);
      }
      return docs.get(path);
    }
    const main=load(entry).moduleRecords[0];
    /* B1-090: architecture containers and x_link cross-file references declare
     * additional files (bases) that join the shared symbol machinery. The
     * no-identity-collision-across-bases rule keeps module-qualified
     * references unambiguous; collisions surface as DDN-PJ216. */
    const archPaths=new Set(),archContainers=[];
    {
     const queue=[];
     const scan=d=>{for(const n of d.declarations){
      if(n.type==='architecture'){
       const list=Array.isArray(n.props.files)?n.props.files:[];
       const bases=list.map(f=>{if(typeof f!=='string')throw new DDNError('DDN-PJ216','architecture files: entries must be workspace-relative path strings',d.source,n.start);return normalizePath(d.source,f);});
       archContainers.push({decl:n,bases});
       for(const b of bases)queue.push([b,n,'Architecture '+n.id+' base file']);
      }
      const walk=x=>{if(x.props?.x_link){const xl=x.props.x_link;if(typeof xl.file!=='string'||typeof xl.target!=='string')throw new DDNError('DDN-PJ216','x_link needs file and target strings',x.source,x.start);queue.push([normalizePath(d.source,xl.file),x,'x_link target file']);}for(const c of x.children||[])walk(c);};
      walk(n);
     }};
     for(const d of modules.values())scan(d);
     for(const [b,n,what]of queue){
      if(!Object.hasOwn(files,b)){
       if(what.startsWith('x_link')){n.props._xlink='unresolved';continue;} // graceful: badge, not error (DDN-PJW07 at build)
       throw new DDNError('DDN-PJ216',what+' is not in the workspace: '+b,n.source,n.start);
      }
      if(docs.has(b)){archPaths.add(b);continue;}
      const before=new Set(modules.keys());
      try{load(b);}catch(e){throw new DDNError('DDN-PJ216',what+' failed to load: '+b+' ('+e.message+')',n.source,n.start);}
      archPaths.add(b);
      for(const [k,rec]of modules)if(!before.has(k)){rec.archBase=true;}
     }
    }
    /* B1-041: preset/fragment definitions are module-scope templates. They
     * are pre-indexed (so `use:` references resolve, including across
     * imports), then every application expands to the identical canonical
     * AST as the handwritten inline form BEFORE the main indexing pass, so
     * expanded identities are exactly as declared inline. Definition
     * members are templates, never declarations: they are not indexed and
     * cannot themselves apply presets (no nesting, no cycles). */
    for(const d of modules.values())for(const n of d.declarations)if(PRESET_DEFS.has(n.type)){
      n.doc=d;n.path=n.id;n.uid=n.props.uid||`${d.module}::${n.id}`;
      const key=d.module+'::'+n.id;
      if(symbols.has(key))throw new DDNError('DDN024','Duplicate declaration '+n.id,d.source,n.start);
      symbols.set(key,n);
      if(n.props.version!==undefined&&!Number.isSafeInteger(n.props.version))throw new DDNError('DDN-E017','Definition version must be an integer (documentary only; expansion ignores it)',d.source,n.start);
      /* 0.8 amendment (parameterized reuse): fragment parameters and nested
       * use: are 0.8 (0.6-dialect) constructs. Below ddn "0.6" definitions
       * stay closed templates exactly as before (nested use: is DDN-E017). */
      const v06=SOURCE_VERSIONS.indexOf(d.file.version)>=V06;
      if(n.params?.length&&!v06)throw new DDNError('DDN-V04','fragment parameters are a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+d.file.source+' declares ddn "'+d.file.version+'"',n.source,n.start);
      if(!v06){const noNested=x=>{for(const c of x.children){if(c.type==='$use')throw new DDNError('DDN-E017','A definition body cannot apply presets or fragments (use: is legal at application sites only)',x.source,c.start);noNested(c);}};
        noNested(n);}
    }
    function resolvePreset(r,rec){
      const parts=r.$ref.split('.'),found=n=>n&&PRESET_DEFS.has(n.type)?n:null;
      if(rec.imported.has(parts[0])){const f=rec.imported.get(parts.shift());
        for(const m of f.moduleRecords){const n=found(symbols.get(m.module+'::'+parts.join('.')));if(n)return n;}}
      else{
        for(let k=parts.length-1;k>=1;k--){const sib=rec.file.moduleById.get(parts.slice(0,k).join('.'));
          if(sib){const n=found(symbols.get(sib.module+'::'+parts.slice(k).join('.')));if(n)return n;}}
        const n=found(symbols.get(rec.module+'::'+parts.join('.')));if(n)return n;}
      throw new DDNError('DDN-E017','Unknown preset or fragment @'+r.$ref,rec.source,r.$offset||0);
    }
    function cloneValue(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(cloneValue);const o=Object.create(null);for(const k of Object.keys(v))o[k]=cloneValue(v[k]);return o;}
    function cloneNode(n,origin){const c={...n,props:cloneValue(n.props),children:n.children.map(x=>cloneNode(x,origin))};c.presetOrigin=origin;return c;}
    /* 0.8 amendment (parameterized reuse, chapter 01): token-level
     * substitution. A parameter binds by TOKEN VALUE in exactly these
     * positions: (1) a declaration id, (2) a whole @reference target,
     * (3) a whole property value, (4) ${name} interpolation inside any
     * string (labels, string values). $${ escapes to a literal ${. Args are
     * bound positionally (DDN-FG01 arity); an arg that cannot serve the
     * position it lands in is DDN-FG03; an unknown ${name} is DDN-FG02. */
    const IDENT_RE=/^[A-Za-z_][A-Za-z0-9_-]*$/,REFPATH_RE=/^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
    function bindArgs(def,r,node,at,enclosing){
      if(!def.params?.length){if(r.$args)throw new DDNError('DDN-FG01','@'+r.$ref+' declares no parameters; remove the argument list',node.source,at);return null;}
      if(!r.$args||r.$args.length!==def.params.length)throw new DDNError('DDN-FG01','@'+r.$ref+' takes '+def.params.length+' argument(s) ('+def.params.join(', ')+'); found '+(r.$args?r.$args.length:0),node.source,at);
      /* Pass-through: an argument token that is itself a parameter of the
       * ENCLOSING definition stays a parameter ({$pt:token}) so the outer
       * application re-binds it — ids/refs/values keep the bare token,
       * ${…} interpolation re-emits ${token} instead of baking the text. */
      return new Map(def.params.map((p,i)=>{const a=r.$args[i];return [p,typeof a==='string'&&enclosing?.includes(a)?{$pt:a}:a];}));
    }
    function substString(s,mapping,node){
      return s.replace(/\$\$\{|\$\{([A-Za-z_][A-Za-z0-9_-]*)\}/g,(m,name)=>{
        if(name===undefined)return '${';
        if(!mapping.has(name))throw new DDNError('DDN-FG02','Unknown parameter ${'+name+'} in a fragment string; declared parameters: '+[...mapping.keys()].map(p=>'${'+p+'}').join(', '),node.source,node.start);
        const v=mapping.get(name);
        if(v&&typeof v==='object'&&v.$pt)return '${'+v.$pt+'}';
        return typeof v==='string'?v:v&&v.$quantity!==undefined?String(v.$quantity)+v.unit:v&&v.$ref?'@'+v.$ref:String(v);
      });
    }
    function substValue(v,mapping,node){
      if(typeof v==='string'&&mapping.has(v)){const a=mapping.get(v);return a&&typeof a==='object'&&a.$pt?a.$pt:a;}
      if(typeof v==='string')return substString(v,mapping,node);
      if(Array.isArray(v))return v.map(x=>substValue(x,mapping,node));
      if(v&&typeof v==='object'){
        if(v.$ref!==undefined){if(!mapping.has(v.$ref))return v;const a=mapping.get(v.$ref),t=a&&typeof a==='object'&&a.$pt?a.$pt:a;
          if(typeof t==='string'&&REFPATH_RE.test(t))return {...v,$ref:t};
          if(t&&typeof t==='object'&&t.$ref)return {...v,$ref:t.$ref};
          throw new DDNError('DDN-FG03','Parameter '+v.$ref+' substitutes into a reference; the argument must be an identifier path or a @reference; found '+JSON.stringify(a),node.source,node.start);}
        if(v.$quantity!==undefined)return v;
        const o=Object.create(null);for(const[k,x]of Object.entries(v))o[k]=substValue(x,mapping,node);return o;
      }
      return v;
    }
    function substNode(n,mapping){
      if(!mapping)return n;
      if(n.id&&mapping.has(n.id)){const a=mapping.get(n.id),t=a&&typeof a==='object'&&a.$pt?a.$pt:a;
        if(typeof t!=='string'||!IDENT_RE.test(t))throw new DDNError('DDN-FG03','Parameter '+n.id+' substitutes into a declaration id, which needs an identifier ([A-Za-z_][A-Za-z0-9_-]*); found '+JSON.stringify(a),n.source,n.start);
        n.id=t;}
      if(typeof n.label==='string')n.label=substString(n.label,mapping,n);
      n.props=substValue(n.props,mapping,n);
      for(const key of ['from','to'])if(n[key]?.$ref)n[key]=substValue(n[key],mapping,n);
      n.children=n.children.map(c=>substNode(c,mapping));
      return n;
    }
    /* Nested use: definitions apply other definitions, expanded lazily
     * bottom-up with a cycle guard (DDN-FG04) and a depth cap of 8
     * (DDN-FG05), consistent with the existing nesting guards (DDN007). */
    const defState={done:new Set(),stack:[]};
    function ensureExpanded(def){
      if(defState.done.has(def.uid))return;
      if(defState.stack.includes(def.uid))throw new DDNError('DDN-FG04','use: cycle through definitions: '+[...defState.stack,def.uid].map(u=>u.split('::').pop()).join(' → '),def.source,def.start);
      if(defState.stack.length>=8)throw new DDNError('DDN-FG05','Definition nesting exceeds the cap of 8 levels',def.source,def.start);
      defState.stack.push(def.uid);
      expandUse(def,def.doc);
      defState.stack.pop();defState.done.add(def.uid);
    }
    function expandUse(n,rec){
      const kept=[],propSources=[];
      for(const c of n.children){
        if(c.type==='$use'){
          const ctx=n.group&&(n.type==='fields'||n.type==='ports')?'members'
            :!n.group&&(n.type==='data'||n.type==='fragment')?'fragment'
            :!n.group&&['object','domain','sample','flow','assertion','relation'].includes(n.type)?'props'
            :null;
          if(!ctx)throw new DDNError('DDN-E017','use: is legal only inside a data block (fragments), a fields/ports group (member groups), or an element/relation/flow body (property presets)',n.source,c.start);
          for(const r of c.refs){
            if(r.$args&&SOURCE_VERSIONS.indexOf(n.doc?.file?.version??'0.6')<V06)throw new DDNError('DDN-V04','use: arguments are a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+n.doc.file.source+' declares ddn "'+n.doc.file.version+'"',n.source,c.start);
            const def=resolvePreset(r,rec);
            ensureExpanded(def);
            const mapping=bindArgs(def,r,n,c.start,n.params);
            const origin={file:def.source,start:def.start,end:def.end,type:def.type,id:def.id};
            if(ctx==='members'){if(def.type!==n.type)throw new DDNError('DDN-E017','@'+r.$ref+' is a '+def.type+' definition; a '+n.type+' group applies a '+n.type+' definition',n.source,c.start);
              for(const m of def.children)kept.push(substNode(cloneNode(m,origin),mapping));}
            else if(ctx==='fragment'){if(def.type!=='fragment')throw new DDNError('DDN-E017','@'+r.$ref+' is a '+def.type+' definition; a data block applies a fragment definition',n.source,c.start);
              for(const m of def.children)kept.push(substNode(cloneNode(m,origin),mapping));}
            else{if(def.type==='relation_props'){if(n.type!=='relation')throw new DDNError('DDN-E017','relation_props @'+r.$ref+' applies to relation declarations only',n.source,c.start);}
              else if(def.type!=='preset')throw new DDNError('DDN-E017','@'+r.$ref+' is a '+def.type+' definition; property position applies a preset or relation_props definition',n.source,c.start);
              propSources.push({def,at:c.start,mapping});}
          }
          continue;
        }
        expandUse(c,rec);kept.push(c);
      }
      n.children=kept;
      /* D2 precedence: local (in-declaration) values override applied
       * presets; two presets conflicting on a property are a coded error
       * unless the declaration resolves the property locally. D3: applied
       * properties are ASSERTED (present on the expanded declaration), and
       * only the named presets' own properties apply. */
      const seen=new Map(),localKeys=new Set(Object.keys(n.props));
      for(const {def,at,mapping} of propSources)for(const k of Object.keys(def.props)){
        if(k==='version')continue;
        if(localKeys.has(k))continue;
        const v=mapping?substValue(def.props[k],mapping,n):def.props[k],got=seen.get(k);
        if(got&&JSON.stringify(got.value)!==JSON.stringify(v))throw new DDNError('DDN-E017','Presets @'+got.id+' and @'+def.id+' conflict on property '+k+'; declare '+k+': … locally to resolve the conflict',n.source,at);
        if(!got){seen.set(k,{value:v,id:def.id});n.props[k]=v;}
      }
    }
    for(const d of modules.values())for(const n of d.declarations)if(PRESET_DEFS.has(n.type))ensureExpanded(n);
    for(const d of modules.values())for(const n of d.declarations)if(!PRESET_DEFS.has(n.type))expandUse(n,d);
    function index(n,d,parent=''){
      n.doc=d;n.path=parent?(parent+'.'+n.id):n.id;n.uid=n.props.uid||`${d.module}::${n.path}`;
      if(PRESET_DEFS.has(n.type)&&!n.group)return; // pre-indexed template
      if(!n.group&&!['place','route'].includes(n.type)){let key=d.module+'::'+n.path;if(symbols.has(key))throw new DDNError(d.archBase?'DDN-PJ216':'DDN024',(d.archBase?'Identity collision across architecture bases: ':'Duplicate declaration ')+n.path,d.source,n.start);symbols.set(key,n);}
      for(const c of n.children)index(c,d,n.group?parent:n.path);
    }
    for(const d of modules.values())for(const n of d.declarations){if(!['data','format','view','architecture','publication_set',...PRESET_DEFS].includes(n.type))throw new DDNError('DDN025','Top-level declaration must be data, format, view, an architecture container, a publication_set, or a reuse definition (fields, ports, relation_props, preset, fragment)',d.source,n.start);index(n,d);}
    const uidMap=new Map();for(const n of symbols.values()){if(uidMap.has(n.uid))throw new DDNError(n.doc?.archBase?'DDN-PJ216':'DDN026',(n.doc?.archBase?'Identity collision across architecture bases (uid ':'Duplicate stable uid ')+n.uid+')',n.source,n.start);uidMap.set(n.uid,n);}
    function resolve(r,context){if(!r||!r.$ref)throw new DDNError('DDN030','Expected a reference',context?.source,context?.start);const parts=r.$ref.split('.');let doc=context.doc;
      if(doc.imported.has(parts[0])){const f=doc.imported.get(parts.shift());for(const rec of f.moduleRecords){let node=symbols.get(rec.module+'::'+parts.join('.'));if(node)return node;}}
      else{
        // Sibling sections are visible via module-qualified ids; module ids
        // may themselves be dotted, so match the LONGEST module-id prefix.
        for(let k=parts.length-1;k>=1;k--){
          const sib=doc.file.moduleById.get(parts.slice(0,k).join('.'));
          if(sib){const node=symbols.get(sib.module+'::'+parts.slice(k).join('.'));if(node)return node;}
        }
        let base=context.path.split('.');base.pop();for(let k=base.length;k>=0;k--){let path=[...base.slice(0,k),...parts].join('.'),n=symbols.get(doc.module+'::'+path);if(n)return n;}
        /* B1-090: module-qualified references into architecture bases. Module
         * ids are globally unique (DDN023), so a longest-prefix match is
         * unambiguous; bare ids never leave their own file. */
        if(parts.length>1){for(let k=parts.length-1;k>=1;k--){const mid=parts.slice(0,k).join('.'),rec=modules.get(mid);
         if(rec?.archBase){const node=symbols.get(rec.module+'::'+parts.slice(k).join('.'));if(node)return node;}}}}
      throw new DDNError('DDN031','Unresolved reference @'+r.$ref,context.source,r.$offset||context.start);
    }
    return {main,docs,modules,symbols,uidMap,resolve,files,archPaths,archContainers};
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
  /* 0.8 (chapter 04 §6B): portable stroke/line properties. Two model-level
   * application contexts sharing one vocabulary: line { color, weight, dash }
   * on relations and stroke { color, weight, dash, corners } + flat fill on
   * elements. No view-wide layer — colours are semantic (§5), so declaration
   * is per target. dash is a closed deterministic keyword set (custom arrays
   * reserved); corners accepts only round (square reserved). */
  const LINE_DASH_PATTERNS={solid:null,dashed:'10 6',dotted:'2 5'};
  function normalizeLineColor(v,fail){
    if(typeof v!=='string'||!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v))fail('DDN-LN02','line/stroke/fill color must be #rgb or #rrggbb; found '+JSON.stringify(v));
    return v.toLowerCase();
  }
  function normalizeStrokeProps(raw,fail,{allowCorners=false,group='stroke'}={}){
    if(raw===undefined)return undefined;
    const keys=['color','weight','dash',...(allowCorners?['corners']:[])];
    if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('DDN-LN01',group+' must be a record of line properties ('+keys.join(', ')+')');
    for(const k of Object.keys(raw))if(!keys.includes(k))fail('DDN-LN01','Unknown '+group+' property '+k+'; '+group+' accepts '+keys.join(', '));
    const out={};
    if(raw.color!==undefined)out.color=normalizeLineColor(raw.color,fail);
    if(raw.weight!==undefined){const w=quantity(raw.weight,NaN);if(!Number.isFinite(w)||w<0.25||w>16)fail('DDN-LN03',group+' weight must be a length from 0.25px to 16px; found '+JSON.stringify(raw.weight));out.weight=Math.round(w*1000)/1000;}
    if(raw.dash!==undefined){if(!['solid','dashed','dotted'].includes(raw.dash))fail('DDN-LN04',group+' dash must be solid, dashed or dotted (custom dash arrays are reserved for a future revision); found '+JSON.stringify(raw.dash));out.dash=raw.dash;}
    if(allowCorners&&raw.corners!==undefined){if(raw.corners!=='round')fail('DDN-LN05','stroke corners must be round (square corner treatment is reserved for a future revision); found '+JSON.stringify(raw.corners));}
    return out;
  }
  /* 0.8 (chapter 04 §6A): the portable text-property vocabulary, validated
   * once for all three application contexts (style/element text { } groups,
   * flat run keys); returns only set, non-default keys. */
  const TEXT_KEYS=['weight','italic','decoration','variant','color'];
  function normalizeTextProps(raw,fail){
    if(raw===undefined)return undefined;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('DDN-TX01','text must be a record of text properties (weight, italic, decoration, variant, color)');
    for(const k of Object.keys(raw))if(!TEXT_KEYS.includes(k))fail('DDN-TX01','Unknown text property '+k+'; text accepts '+TEXT_KEYS.join(', '));
    const out={};
    if(raw.weight!==undefined){if(raw.weight==='bold')out.weight=700;else if(Number.isSafeInteger(raw.weight)&&raw.weight>=100&&raw.weight<=900)out.weight=raw.weight;else fail('DDN-TX02','text weight must be the keyword bold or an integer from 100 to 900; found '+JSON.stringify(raw.weight));}
    if(raw.italic!==undefined){if(typeof raw.italic!=='boolean')fail('DDN-TX03','text italic must be boolean; found '+JSON.stringify(raw.italic));if(raw.italic)out.italic=true;}
    if(raw.decoration!==undefined){if(!['strike','none'].includes(raw.decoration))fail('DDN-TX04','text decoration must be strike or none (underline is reserved for a future revision); found '+JSON.stringify(raw.decoration));if(raw.decoration==='strike')out.decoration='strike';}
    if(raw.variant!==undefined){if(!['small-caps','normal'].includes(raw.variant))fail('DDN-TX05','text variant must be small-caps or normal; found '+JSON.stringify(raw.variant));if(raw.variant==='small-caps')out.variant='small-caps';}
    if(raw.color!==undefined){if(typeof raw.color!=='string'||!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw.color))fail('DDN-TX06','text color must be #rgb or #rrggbb; found '+JSON.stringify(raw.color));out.color=raw.color.toLowerCase();}
    return out;
  }
  function kindEntry(reg,value){return Profiles.registry(reg).kinds.find(k=>k.keyword===value||k.code.toLowerCase()===value||k.aliases?.includes(value));}
  function relationEntry(reg,value){return Profiles.registry(reg).relationships.find(k=>k.keyword===value||k.code.toLowerCase()===value||k.aliases?.includes(value));}
  const DEFAULTS={
    projection:{kind:'graph',profile:'ddn@1'},
    notation:{registry:'ddn-core@0.3'},
    style:{look:'classic',theme:'default',font:'sans',font_size:{$quantity:16,unit:'px'},seed:42},
    layout:{algorithm:'auto',auto_place:true,center:'content',grid_step:{$quantity:32,unit:'px'},optimize:'crossings',endpoint_ordering:'optimize',frame_overflow:'expand',direction:'right',routing:'orthogonal',curve:'bezier',curve_tension:.5,curve_radius:{$quantity:32,unit:'px'},crossings:'gap',gap:{$quantity:64,unit:'px'},row_gap:{$quantity:64,unit:'px'},columns:3,object_clearance:{$quantity:16,unit:'px'},edge_clearance:{$quantity:12,unit:'px'},port_clearance:{$quantity:28,unit:'px'},route_policy:'repair',quality:'error',root:null,group_by:'none'},
    display:{fields:'names',kind:'icon_token',maturity:'token',badges:'tokens',relations:'between_selected',samples:'show',domains:'hide',datatypes:'hide',depth:32},
    publication:{size:'figure',width:{$quantity:1280,unit:'px'},height:{$quantity:800,unit:'px'},margin:{$quantity:32,unit:'px'},fit:'contain',minimum_text:{$quantity:8,unit:'pt'},overflow:'error'},
    legend:{mode:'text',placement:'right',width:{$quantity:310,unit:'px'},keys:{}},
    chrome:{legend:'auto',title:'on',footer:'on',banner:'on'},
    validation:{mode:'logical',unknown_extensions:'warn'},
    export:{mode:'full',elements:[],fields:null,properties:[],include_samples:false,identifier_mode:'opaque',title:'Published data view',format:'json'},
  };
  const CHOICES={projection:{kind:['graph','chen','matrix','panels','table','chart','timeline','fishbone','decision','sequence','timing','geo']},style:{look:['classic','handDrawn','neo'],theme:['default','neutral','dark','night','forest','base'],font:['sans','serif','mono','handwriting']},layout:{algorithm:['auto','grid','manual','layered','tree','mindmap','grouped','fit_grid','circular','radial','spanning_tree','organic','ladder'],center:['pins','content'],optimize:['crossings','none'],endpoint_ordering:['optimize','preserve'],frame_overflow:['expand','confine'],direction:['right','down','left','up'],routing:['orthogonal','straight','curved','string'],curve:['bezier','rounded'],crossings:['gap','bridge','square_bridge']},display:{fields:['names','none'],kind:['text','icon_token','icon','none'],maturity:['token','none'],badges:['tokens','none'],relations:['between_selected','none'],samples:['show','hide'],domains:['show','hide'],datatypes:['show','hide']},legend:{mode:['numbers','text','tokens','none'],placement:['right','bottom','none']},chrome:{legend:['auto','on','off'],title:['on','off'],footer:['on','off']},publication:{size:['figure','content','a4','letter'],fit:['contain','none','reflow'],overflow:['error','warn']},validation:{mode:['sketch','logical','strict'],unknown_extensions:['warn','error']},export:{mode:['full','redacted'],identifier_mode:['opaque','preserve'],format:['json','sql']}};
  const PROPERTIES={
    projection:['kind','profile','write_data','rows','columns','relation','value','duplicates','panels','records','mark','x','y','x_type','size','unit','aggregate','start','end','label','dependencies','width','height','filter','order','missing','inner_radius','values','effect','encoding','series','series_missing','arrangement','transform','layers','bins','normalize','outside','whiskers','quartiles','step','baseline','target','open','high','low','close','bin_count','k','others','error','trend','inputs','outputs','hit_policy','coverage','analysis_budget','x_completeness','traces','geography','method','graticule','iso','depth'],
    notation:['registry'],style:['look','theme','font','font_size','seed','roughness','hachure','font_pin','text_fit','max_width','max_height','min_font'],
    layout:['algorithm','auto_place','center','grid_step','optimize','endpoint_ordering','frame_overflow','direction','routing','curve','curve_tension','curve_radius','crossings','gap','columns','port_clearance','object_clearance','edge_clearance','junctions','shared_segments','row_gap','route_policy','quality','root','hierarchy','group_by'],
    display:['fields','kind','maturity','badges','relations','samples','datatypes','domains','depth'],
    publication:['size','width','height','margin','orientation','fit','minimum_text','overflow','title','caption','embedding_scale','content_scale','metrics'],
    legend:['mode','placement','width','keys','keyset','scope'],
    chrome:['legend','title','footer','banner'],
    validation:['mode','unknown_extensions'],
    export:['mode','elements','fields','properties','include_samples','identifier_mode','title','format'],
    bundle:['projection','notation','style','layout','display','publication','legend','chrome','title','footer','banner','validation','export','spacing','kind','strictness'],
    view:['projection','data','format','notation','style','layout','display','publication','legend','chrome','title','footer','banner','select','exclude','description','uid','validation','export','spacing','kind','strictness','theme','source','generator','assertions','diff'],
    place:['at','size'],route:['via','source_side','target_side','callout','policy','source_fraction','target_fraction','routing','curve','curve_tension','curve_radius'],
    subdiagram:['view','mode','at','size','label','binding','uid'],
    frame:['scope','members','at','size','label','dimension'],
    junction:['at','relations','network'],
    keyset:['keys','scope'],
    flow:['label','steps','marker','marker_color','marker_size','speed','rate','uid'],
    architecture:['files','views','description','uid'],
  };
  function validateKnown(n,allowed){for(const key of Object.keys(n.props))if(!allowed.includes(key)&&!key.startsWith('x_'))throw new DDNError('DDN033',`Unknown ${n.type} property ${key}`,n.source,n.start);}
  /* 0.8 (chapter 53): publication chrome — header/footer runs, page border and
   * page background, extracted from the child groups of a publication profile
   * or a view-local publication override group. Page furniture only: chrome
   * never changes model semantics, layout, routing or the modelFingerprint,
   * and a publication with no 0.8 chrome renders byte-identically to 0.7.
   * Sizes resolve to pt (header/footer/border), lengths to px (inset). */
  const CHROME_CONCERNS=['header','footer','border','background'];
  const CHROME_VARS=['title','page','date','view_id','figure'];
  function chromeGate(node,what){
    if(SOURCE_VERSIONS.indexOf(node.doc?.file?.version??'0.6')<V06)
      throw new DDNError('DDN-V04',what+' in publication is a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+node.doc.file.source+' declares ddn "'+node.doc.file.version+'"',node.source,node.start);
  }
  function scanChromeVars(str,node){
    for(const m of String(str).matchAll(/\$\$|\$([A-Za-z_][A-Za-z0-9_]*)/g)){
      if(m[0]==='$$')continue;
      if(!CHROME_VARS.includes(m[1]))throw new DDNError('DDN-PB02','Unknown $variable $'+m[1]+' in a chrome text string; registered variables: '+CHROME_VARS.map(v=>'$'+v).join(', ')+' (a literal dollar sign is written $$)',node.source,node.start);
    }
  }
  function chromePt(v,def){
    if(v===undefined)return def;
    if(typeof v==='number')return v;
    if(v&&v.$quantity!==undefined){if(v.unit==='pt')return v.$quantity;if(v.unit==='px')return v.$quantity*72/96;}
    return NaN;
  }
  function chromeRun(slot,node){
    /* 0.8 (chapter 04 §6A): runs additionally accept the portable text
     * vocabulary as flat keys — the run record is itself a text target, so no
     * nested group. View/element text { } never restyles page furniture. */
    for(const k of Object.keys(node.props))if(!['text','align','font','size','lines','weight','italic','decoration','variant','color'].includes(k))throw new DDNError('DDN-PB01','Unknown '+slot+' run property '+k+'; runs accept text, align, font, size, lines and the text properties weight, italic, decoration, variant, color',node.source,node.start);
    const p=node.props;
    if(typeof p.text!=='string'||!p.text.length)throw new DDNError('DDN-PB01',slot+' run requires a nonempty text string',node.source,node.start);
    scanChromeVars(p.text,node);
    const align=p.align??slot;
    if(!['left','center','right'].includes(align))throw new DDNError('DDN-PB01',slot+' run align must be left, center or right; found '+JSON.stringify(p.align),node.source,node.start);
    if(p.font!==undefined&&!CHOICES.style.font.includes(p.font))throw new DDNError('DDN-PB01',slot+' run font must be one of '+CHOICES.style.font.join(', ')+'; found '+JSON.stringify(p.font),node.source,node.start);
    const size=chromePt(p.size,9);
    if(!Number.isFinite(size)||size<4||size>24)throw new DDNError('DDN-PB01',slot+' run size must be 4-24pt; found '+JSON.stringify(p.size),node.source,node.start);
    const lines=p.lines??1;
    if(!Number.isSafeInteger(lines)||lines<1||lines>4)throw new DDNError('DDN-PB01',slot+' run lines must be an integer 1-4; found '+JSON.stringify(p.lines),node.source,node.start);
    const textStyle=normalizeTextProps(Object.fromEntries(TEXT_KEYS.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])),(code,msg)=>{throw new DDNError(code,slot+' run: '+msg,node.source,node.start);});
    return {text:p.text,align,...(p.font!==undefined?{font:p.font}:{}),size,lines,...(textStyle&&Object.keys(textStyle).length?{textStyle}:{})};
  }
  function chromeBand(kind,node){
    const out={};
    for(const c of node.children){
      if(!c.group||!['left','center','right'].includes(c.type))throw new DDNError('DDN-PB01',kind+' may contain only left, center and right run groups; found '+(c.group?c.type:'property '+(c.type||'?')),c.source,c.start);
      if(out[c.type])throw new DDNError('DDN-PB01','Duplicate '+c.type+' run in '+kind,c.source,c.start);
      if(c.children.length)throw new DDNError('DDN-PB01',kind+' '+c.type+' run does not accept nested declarations',c.source,c.start);
      out[c.type]=chromeRun(c.type,c);
    }
    return out;
  }
  function chromeBorder(node){
    for(const k of Object.keys(node.props))if(!['style','weight','inset','corner_marks'].includes(k))throw new DDNError('DDN-PB03','Unknown border property '+k+'; border accepts style, weight, inset and corner_marks',node.source,node.start);
    const p=node.props;
    if(!['single','double','dashed'].includes(p.style))throw new DDNError('DDN-PB03','border requires style single, double or dashed; found '+JSON.stringify(p.style),node.source,node.start);
    const weight=chromePt(p.weight,1);
    if(!Number.isFinite(weight)||weight<0.25||weight>8)throw new DDNError('DDN-PB03','border weight must be 0.25-8pt; found '+JSON.stringify(p.weight),node.source,node.start);
    const inset=p.inset===undefined?0:quantity(p.inset,NaN);
    if(!Number.isFinite(inset)||inset<0||inset>2000)throw new DDNError('DDN-PB03','border inset must be a length from 0 to 2000px; found '+JSON.stringify(p.inset),node.source,node.start);
    const corner=p.corner_marks??false;
    if(typeof corner!=='boolean')throw new DDNError('DDN-PB03','corner_marks must be boolean',node.source,node.start);
    return {style:p.style,weight,inset,corner_marks:corner};
  }
  /* Pattern sanitization (chapter 53 §53.3 rule 5): the icon/art-pack rules of
   * chapters 49/50 with the one documented relaxation — internal url(#…) and
   * href="#…" fragment references are allowed; everything external is not. */
  function sanitizePattern(svg){
    if(typeof svg!=='string'||!svg.trimStart().startsWith('<svg'))return 'not an SVG document';
    if(svg.length>20480)return 'exceeds the 20 KiB asset budget';
    const bad=svg.match(/<script|foreignObject|<iframe|<embed|<object|<image|\bon[a-z]+\s*=|javascript:|<!doctype|<!entity/i);
    if(bad)return 'forbidden construct '+JSON.stringify(bad[0])+' (script, foreignObject, event handler or external reference)';
    for(const m of svg.matchAll(/\b(?:xlink:)?href\s*=\s*"([^"]*)"/gi))if(!m[1].startsWith('#'))return 'external reference '+JSON.stringify(m[1]);
    for(const m of svg.matchAll(/url\s*\(\s*['"]?([^)'"]*)['"]?\s*\)/gi))if(!m[1].startsWith('#'))return 'external reference '+JSON.stringify(m[1]);
    return null;
  }
  function chromeBackground(node,files,overflow,diags){
    for(const k of Object.keys(node.props))if(!['color','image','pattern','opacity'].includes(k))throw new DDNError('DDN-PB04','Unknown background property '+k+'; background accepts exactly one of color, image or pattern, plus opacity',node.source,node.start);
    const p=node.props,kinds=['color','image','pattern'].filter(k=>p[k]!==undefined);
    if(kinds.length!==1)throw new DDNError('DDN-PB04','background declares '+kinds.length+' of color/image/pattern; exactly one is required',node.source,node.start);
    const opacity=p.opacity??1;
    if(typeof opacity!=='number'||!(opacity>=0&&opacity<=1))throw new DDNError('DDN-PB04','background opacity must be a number from 0 to 1; found '+JSON.stringify(p.opacity),node.source,node.start);
    if(kinds[0]==='color'){
      if(typeof p.color!=='string')throw new DDNError('DDN-PB04','background color must be a colour string',node.source,node.start);
      return {kind:'color',color:p.color,opacity};
    }
    const raw=p[kinds[0]];
    if(typeof raw!=='string'||!raw.length||raw.length>512)throw new DDNError('DDN-PB05','background '+kinds[0]+' must name a workspace-relative file (1-512 characters)',node.source,node.start);
    if(/^(?:[a-z]+:|\/|\\)/i.test(raw)||raw.includes('\\'))throw new DDNError('DDN-PB05','background '+kinds[0]+' '+JSON.stringify(raw)+' is an absolute path or URL; only workspace-relative paths are allowed',node.source,node.start);
    let path;
    try{path=normalizePath(node.doc.file.source,raw);}catch(e){throw new DDNError('DDN-PB05','background '+kinds[0]+' '+JSON.stringify(raw)+' escapes the workspace root',node.source,node.start);}
    const ext=path.split('.').pop().toLowerCase();
    const missing=(why)=>{
      const d={code:'DDN-PB07',severity:overflow==='error'?'error':'warning',message:'background '+kinds[0]+' '+path+' '+why+'; painting a plain background instead',source:node.source,offset:node.start};
      if(overflow==='error')throw new DDNError('DDN-PB07','background '+kinds[0]+' '+path+' '+why,node.source,node.start);
      diags.push(d);return null;};
    if(kinds[0]==='image'){
      if(!['png','webp'].includes(ext))throw new DDNError('DDN-PB06','background image must be PNG or WebP; found '+path,node.source,node.start);
      const data=files[path];
      if(typeof data!=='string')return missing('is not in the workspace');
      const compact=data.replace(/\s+/g,'');
      if(!compact.length||compact.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(compact))return missing('is not decodable base64 image data');
      return {kind:'image',path,mime:'image/'+ext,data:compact,opacity};
    }
    if(ext!=='svg')throw new DDNError('DDN-PB06','background pattern must be SVG; found '+path,node.source,node.start);
    const svg=files[path];
    if(typeof svg!=='string')return missing('is not in the workspace');
    const rejected=sanitizePattern(svg);
    if(rejected)throw new DDNError('DDN-PB08','background pattern '+path+' failed sanitization: '+rejected,node.source,node.start);
    return {kind:'pattern',path,svg,opacity};
  }
  /* Concern-layered extraction: later layers replace whole concerns (header,
   * footer, border, background) — the view-local group wins over the
   * referenced publication profile. Nodes without chrome children contribute
   * nothing, so a 0.7-era publication resolves exactly nothing here. */
  function extractPublicationChrome(nodes,files,overflow){
    const diags=[],out={};
    for(const node of nodes){
      if(!node)continue;
      for(const c of node.children||[]){
        if(!c.group||!CHROME_CONCERNS.includes(c.type))continue;
        chromeGate(c,c.type);
        out[c.type]=c.type==='border'?chromeBorder(c):c.type==='background'?chromeBackground(c,files,overflow,diags):chromeBand(c.type,c);
      }
    }
    return {chrome:out,diagnostics:diags};
  }
  function build(files,entry,viewName,registry,stack=[]){
    registry=Profiles.registry(registry);
    const ws=createWorkspace(files,entry,typedKindWords(registry),relationKindWords(registry));const all=[...ws.symbols.values()];const view=all.find(n=>n.type==='view'&&((viewName&&(n.id===viewName||n.path===viewName||n.uid===viewName))||(!viewName&&n.doc===ws.main)));
    if(!view)throw new DDNError('DDN040','View not found: '+(viewName||'(default)'),entry);
    if(stack.includes(view.uid)||stack.length>6)throw new DDNError('DDN065','Recursive or excessive inline subdiagram expansion',view.source,view.start);
    validateKnown(view,PROPERTIES.view);
    for(const child of view.children)if(child.group&&!Object.hasOwn(DEFAULTS,child.type))throw new DDNError('DDN900','Unsupported view override group '+child.type,child.source,child.start);
    for(const n of all)if(PROPERTIES[n.type])validateKnown(n,PROPERTIES[n.type]);
    /* 0.8 (chapter 51 §51.3): every 0.8 construct is gated on source version
     * 0.6 per FILE — an 0.8 keyword or property in a file declaring <=0.5 is
     * DDN-V04 naming the construct and the minimum version. `diff` views are
     * deferred to 0.9 (chapter 55 §S6): rejected as unknown even in 0.6. */
    for(const n of ws.symbols.values()){
      const v06=SOURCE_VERSIONS.indexOf(n.doc.file.version)>=V06;
      const gate=k=>{throw new DDNError('DDN-V04',k+' on '+n.type+' '+n.id+' is a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+n.doc.file.source+' declares ddn "'+n.doc.file.version+'"',n.source,n.start);};
      if(n.type==='view'){
        if(Object.hasOwn(n.props,'diff')&&!v06)throw new DDNError('DDN-V04','diff views are a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+n.doc.file.source+' declares ddn "'+n.doc.file.version+'"',n.source,n.start);
        if(!v06)for(const k of ['kind','strictness','theme','source','generator','assertions'])if(Object.hasOwn(n.props,k))gate(k);
      }
      else if(n.type==='publication_set'){if(!v06)gate('publication_set');}
      else if(n.type==='bundle'){if(!v06)for(const k of ['kind','strictness'])if(Object.hasOwn(n.props,k))gate(k);}
      else if(!['data','format','architecture',...PRESET_DEFS].includes(n.type)&&!v06)for(const k of ['marks','assertion','numeral','text_fit','max_width','max_height','min_font','font_pin'])if(Object.hasOwn(n.props,k))gate(k);
    }
    /* 0.8 amendment (chapter 55 §55.6): diff views. A view may declare
     * diff: [@viewA, @viewB] instead of data — it renders the union of both
     * views' models with per-uid added/removed/changed/unchanged states.
     * diff and data are mutually exclusive; self-diffs and diff-of-diff are
     * rejected (an ordinary-view-only contract keeps expansion depth at 1). */
    let diff08=null;
    if(view.props.diff!==undefined){
      const d=view.props.diff;
      if(!Array.isArray(d)||d.length!==2)throw new DDNError('DDN-DF01','diff must name exactly two views: diff: [@viewA, @viewB]',view.source,view.start);
      if(view.props.data!==undefined)throw new DDNError('DDN-DF01','diff and data are mutually exclusive; a diff view selects nothing of its own',view.source,view.start);
      const resolveDiffView=(r)=>{let t=null;try{t=ws.resolve(r,view);}catch(e){if(e.code!=='DDN031'&&e.code!=='DDN030')throw e;}
        if(!t||t.type!=='view')throw new DDNError('DDN-DF02','diff reference '+JSON.stringify(r.$ref??r)+' does not resolve to a view in this workspace',view.source,r.$offset||view.start);
        return t;};
      const ra=resolveDiffView(d[0]),rb=resolveDiffView(d[1]);
      if(ra.uid===rb.uid)throw new DDNError('DDN-DF03','diff of a view against itself is meaningless; name two different views',view.source,view.start);
      if(ra.uid===view.uid||rb.uid===view.uid)throw new DDNError('DDN-DF03','a diff view cannot name itself',view.source,view.start);
      if(ra.props.diff!==undefined||rb.props.diff!==undefined)throw new DDNError('DDN-DF03','diff-of-diff is not supported; diff references must name ordinary views',view.source,view.start);
      diff08={a:ra,b:rb};
    }
    const usedData=diff08?[]:(Array.isArray(view.props.data)?view.props.data:[view.props.data]).filter(Boolean).map(r=>ws.resolve(r,view));
    if(!diff08&&(!usedData.length||usedData.some(n=>n.type!=='data')))throw new DDNError('DDN041','View data must reference one or more data blocks',view.source,view.start);
    const raw=usedData.flatMap(n=>n.children.filter(c=>!c.group));
    const elemTypes=['object','domain','sample','flow','assertion'];
    for(const n of raw){if(!elemTypes.includes(n.type)&&n.type!=='relation')throw new DDNError('DDN042','Unsupported data declaration '+n.type,n.source,n.start);}
    for(const n of raw){if(n.from&&n.type!=='relation')throw new DDNError('DDN055','Only relations accept header endpoints',n.source,n.start);for(const g of n.children)if(g.group&&!(['fields','ports'].includes(g.type)||(g.type==='text'&&n.type!=='relation')||(g.type==='stroke'&&n.type!=='relation')||(g.type==='line'&&n.type==='relation')))throw new DDNError('DDN900','Reference model does not implement group '+g.type,n.source,g.start);for(const f of getFields(n))for(const g of f.children)if(!g.group||g.type!=='fields')throw new DDNError('DDN042','Nested fields accept only a fields block',f.source,f.start);}
    const rawNodes=raw.filter(n=>elemTypes.includes(n.type));
    const rawRelations=raw.filter(n=>n.type==='relation');
    const p={};for(const k of Object.keys(DEFAULTS))p[k]=JSON.parse(JSON.stringify(DEFAULTS[k]));
    let bundle=null;
    if(view.props.format){bundle=ws.resolve(view.props.format,view);if(bundle.type!=='bundle')throw new DDNError('DDN043','format must reference a bundle',view.source,view.start);}
    let pubDefNode=null,pubOverrideNode=null,styleDefNode=null,styleOverrideNode=null;
    for(const type of Object.keys(p)){
      const r=view.props[type]||(bundle&&bundle.props[type]);let def=null;
      // B1-045 (D2/D3): a string `legend: auto|on|off` is the chrome shorthand,
      // not a legend profile reference; it is applied to p.chrome below.
      if(r&&!(type==='legend'&&typeof r==='string')){def=ws.resolve(r,view.props[type]?view:bundle);if(def.type!==type)throw new DDNError('DDN044',`Expected ${type} profile, found ${def.type}`,view.source,view.start);p[type]={...p[type],...resolveValue(def.props,def)};}
      const overrides=group(view,type);if(overrides){validateKnown(overrides,PROPERTIES[type]);p[type]={...p[type],...resolveValue(overrides.props,overrides)};}
      if(type==='publication'){pubDefNode=def;pubOverrideNode=overrides;}
      if(type==='style'){styleDefNode=def;styleOverrideNode=overrides;}
      if(type==='legend'&&def&&def.props.keyset){let keyset=ws.resolve(def.props.keyset,def);if(keyset.type!=='keyset')throw new DDNError('DDN044','Expected keyset',def.source,def.start);p.legend.keys={...keyset.props.keys,...p.legend.keys};}
    }
    /* 0.8 (chapter 53): publication chrome rides the resolved publication
     * profile bag as plain JSON records (header/footer/border/background) so
     * exports and the redaction copy carry it untouched. */
    let chrome08Diags=[];
    {
      const {chrome:chrome08,diagnostics:chromeDiags}=extractPublicationChrome([pubDefNode,pubOverrideNode],files,p.publication.overflow);
      for(const k of Object.keys(chrome08))if(chrome08[k])p.publication[k]=chrome08[k];
      chrome08Diags=chromeDiags;
    }
    /* chapter 53 §53.5: print-size lint needs to know whether minimum_text was
     * author-declared at any layer (PS03 fires only on the default). */
    p.publication.minimum_text_declared=Object.hasOwn(pubOverrideNode?.props||{},'minimum_text')
      ||[view.props.publication,bundle?.props.publication].some(r=>{if(!r)return false;try{return Object.hasOwn(ws.resolve(r,view.props.publication?view:bundle).props,'minimum_text');}catch{return false;}});
    /* B1-045 (D2/D3): view chrome visibility. Flat keywords legend:/title:/footer:
     * on the view (or its format bundle) mirror into the chrome profile bag; the
     * view beats the bundle. A {$ref} legend value still names a legend profile.
     * Invalid values are the coded error DDN-E018. */
    for(const src of [bundle,view]){
      if(!src)continue;
      for(const k of ['legend','title','footer']){
        const raw=src.props[k];
        if(typeof raw!=='string')continue;
        const allowed=CHOICES.chrome[k];
        if(!allowed.includes(raw))throw new DDNError('DDN-E018','Unknown '+k+' chrome value '+JSON.stringify(raw)+'; expected '+allowed.join(', '),src.source,src.start);
        p.chrome[k]=raw;
      }
      /* 0.8 (chapter 44 amendment): flat banner: on|off|<replacement text> mirrors
       * into the chrome bag like the other visibility keywords. */
      if(typeof src.props.banner==='string')p.chrome.banner=src.props.banner;
    }
    /* 0.8 (chapter 44 amendment): the banner line is the engine-version title
     * line above the view name; 'on' shows it, 'off' suppresses it, any other
     * string (1..200 chars) replaces the text. */
    if(p.chrome.banner!=='on'&&p.chrome.banner!=='off'&&(typeof p.chrome.banner!=='string'||p.chrome.banner.trim()===''||p.chrome.banner.length>200))throw new DDNError('DDN-E018','Unknown banner chrome value '+JSON.stringify(p.chrome.banner)+'; expected on, off, or replacement text of 1..200 characters',view.source,view.start);
    if(quantity(p.style.font_size,16)<8||quantity(p.style.font_size,16)>64)throw new DDNError('DDN046','font_size must be between 8px and 64px',view.source,view.start);
    /* 0.8 (chapter 54 §54.1/§54.6): text-fit declarations, checked at build so
     * `check` catches them before any render. Defaults live on the style
     * profile bag; element declarations win over them at render time. */
    const TF_MODES=['wrap','grow','shrink'];
    const baseFont08=quantity(p.style.font_size,16);
    function tfCheck(props,src,off){
      if(!props)return;
      if(props.text_fit!==undefined&&!TF_MODES.includes(props.text_fit))throw new DDNError('DDN-TF01','Unknown text_fit mode '+JSON.stringify(props.text_fit)+'; expected wrap, grow or shrink',src,off);
      for(const k of ['max_width','max_height'])if(props[k]!==undefined){const v=quantity(props[k],NaN);if(!Number.isFinite(v)||v<40||v>4000)throw new DDNError('DDN-TF02',k+' must be a length from 40px to 4000px and within the 50000px drawing extent budget; found '+JSON.stringify(props[k]),src,off);}
      if(props.min_font!==undefined){const v=quantity(props.min_font,NaN);if(!Number.isFinite(v)||v<6||v>64)throw new DDNError('DDN-TF03','min_font must be a length from 6px to 64px; found '+JSON.stringify(props.min_font),src,off);if(v>baseFont08)throw new DDNError('DDN-TF03','min_font '+v+'px is above the effective base font '+baseFont08+'px',src,off);}
    }
    tfCheck(p.style,view.source,view.start);
    /* 0.8 (chapter 04 §6A): portable text properties — one decoration
     * vocabulary (weight/italic/decoration/variant/color), packaged as a
     * text { } group on style declarations/groups and element declarations,
     * and as flat keys on header/footer run records (chapter 53 §53.1).
     * Family and size stay role-based; text carries decoration only. */
    const txCheck=(raw,src,off)=>normalizeTextProps(raw,(code,msg)=>{throw new DDNError(code,msg,src,off);});
    function textGate(node,what){if(SOURCE_VERSIONS.indexOf(node.doc?.file?.version??'0.6')<V06)throw new DDNError('DDN-V04',what+' is a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+node.doc.file.source+' declares ddn "'+node.doc.file.version+'"',node.source,node.start);}
    /* View-wide layer: a text { } group nested in the resolved style profile
     * and/or the view's style { } override group; the override group wins
     * per key (chapter 04 §6A precedence rule 1). */
    {
      const styleText={};
      for(const holder of [styleDefNode,styleOverrideNode]){
        const tg=holder?group(holder,'text'):null;
        if(!tg)continue;
        textGate(holder,'A text { } group in style');
        Object.assign(styleText,txCheck(tg.props,tg.source,tg.start));
      }
      if(Object.keys(styleText).length)p.style.text=styleText;
    }
    /* 0.8 (chapter 54 §54.4): font_pin names a metrics file resolved by the
     * background path rules (chapter 53 §53.3): relative to the declaring
     * .ddn, inside the workspace, no absolute paths or URLs (DDN-PB05 family).
     * The pin rides the IR; the render phase pins the measurement cache,
     * checks the recorded engine (DDN-TF05) and polices unknown runs
     * (DDN-TF04). */
    let fontPin08=null;
    if(p.style.font_pin!==undefined){
      const styleGroup=group(view,'style');
      const pinOwner=styleGroup&&Object.hasOwn(styleGroup.props,'font_pin')?view:(view.props.style?ws.resolve(view.props.style,view):(bundle?.props.style?ws.resolve(bundle.props.style,bundle):view));
      const pinName=p.style.font_pin;
      if(typeof pinName!=='string'||!pinName.length||pinName.length>512)throw new DDNError('DDN-PB05','font_pin must name a workspace-relative metrics file (1-512 characters)',pinOwner.source,pinOwner.start);
      let pinPath;try{pinPath=normalizePath(pinOwner.source,pinName);}catch(e){throw new DDNError('DDN-PB05','font_pin '+JSON.stringify(pinName)+' violates the workspace path rules: '+e.message,pinOwner.source,pinOwner.start);}
      const rawPin=files[pinPath];
      if(typeof rawPin!=='string')throw new DDNError('DDN-PB05','font_pin file is not in the workspace: '+pinPath,pinOwner.source,pinOwner.start);
      let pinData;try{pinData=JSON.parse(rawPin);}catch{throw new DDNError('DDN-PB05','font_pin file '+pinPath+' is not valid JSON',pinOwner.source,pinOwner.start);}
      if(!pinData||typeof pinData!=='object'||Array.isArray(pinData)||typeof pinData.engine!=='string'||!pinData.measurements||typeof pinData.measurements!=='object'||Array.isArray(pinData.measurements))throw new DDNError('DDN-PB05','font_pin file '+pinPath+' must record the measurement engine and a per-run measurements table',pinOwner.source,pinOwner.start);
      fontPin08={path:pinPath,engine:pinData.engine,...(typeof pinData.version==='string'?{version:pinData.version}:{}),measurements:pinData.measurements};
    }
    // Spacing hint: view declaration wins over the referenced format (bundle);
    // absent means normal. Additive optional enum, so a bad value is an unknown
    // property value and fails with DDN033 rather than a version gate.
    const spacing=view.props.spacing??bundle?.props.spacing;
    if(spacing!==undefined&&!['tight','normal','loose','expanded'].includes(spacing))throw new DDNError('DDN033','Unknown spacing value '+spacing+'; expected tight, normal, loose or expanded',view.source,view.start);
    p.layout.spacing=spacing||'normal';
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
    if(p.legend.mode==='numbers'&&(p.legend.placement==='none'||p.chrome.legend==='off'))throw new DDNError('DDN047','Numbered relationships require a legend',view.source,view.start);
    function resolveValue(v,n){if(Array.isArray(v))return v.map(x=>resolveValue(x,n));if(v&&typeof v==='object'){if(v.$ref)return {$ref:ws.resolve(v,n).uid};const o={};for(const[k,x]of Object.entries(v))if(k!=='$offset')o[k]=k==='depth'?resolveDepthValue(x,n):resolveValue(x,n);return o;}return v;}
    /* B1-034 (D3): depth: @data.record.field — the dotted reference names a
     * record element plus a field path. Whole-reference resolution wins; on a
     * miss the longest resolvable prefix is the record and the remainder is
     * the field (kept as {$ref,$field} for the optional ddn-iso module). */
    function resolveDepthValue(x,n){
     if(!x||typeof x!=='object'||!x.$ref)return resolveValue(x,n);
     try{return {$ref:ws.resolve(x,n).uid};}
     catch(e){
      if(e.code!=='DDN031')throw e;
      const parts=x.$ref.split('.');
      for(let i=parts.length-1;i>=1;i--){
       try{const t=ws.resolve({$ref:parts.slice(0,i).join('.'),$offset:x.$offset},n);return {$ref:t.uid,$field:parts.slice(i).join('.')};}
       catch(e2){if(e2.code!=='DDN031')throw e2;}
      }
      throw e;
     }
    }
    for(const prop of ['object_clearance','edge_clearance','port_clearance','gap','row_gap'])if(quantity(p.layout[prop],0)<0)throw new DDNError('DDN046','Layout lengths cannot be negative: '+prop,view.source,view.start);
    if(p.layout.junctions!==undefined&&p.layout.junctions!=='explicit')throw new DDNError('DDN046','Only explicit junction semantics are allowed',view.source,view.start);
    if(p.layout.shared_segments!==undefined&&p.layout.shared_segments!=='forbidden')throw new DDNError('DDN046','Shared network trunks require an adopted network profile; independent sharing is forbidden',view.source,view.start);
    if(p.publication.metrics!==undefined&&!['required','allow_estimated'].includes(p.publication.metrics))throw new DDNError('DDN046','metrics must be required or allow_estimated',view.source,view.start);
    if(quantity(p.publication.margin,32)<0||!Number.isFinite(quantity(p.publication.margin,32))||quantity(p.publication.margin,32)>10000)throw new DDNError('DDN046','Page margin must be a finite length from 0 to 10000px',view.source,view.start);
    for(const prop of ['width','height']){const v=quantity(p.publication[prop],prop==='width'?1280:800);if(!Number.isFinite(v)||v<64||v>100000)throw new DDNError('DDN046','publication.'+prop+' must be a finite length from 64 to 100000px',view.source,view.start);}
    if(p.publication.orientation!==undefined&&!['portrait','landscape'].includes(p.publication.orientation))throw new DDNError('DDN046','Unknown page orientation',view.source,view.start);
    /* 0.8 amendment (chapter 06): content_scale is a plain ratio (not a
     * length), applied to the laid-out drawing before fit/contain. */
    if(p.publication.content_scale!==undefined&&(typeof p.publication.content_scale!=='number'||!Number.isFinite(p.publication.content_scale)||p.publication.content_scale<0.25||p.publication.content_scale>4))throw new DDNError('DDN046','publication.content_scale must be a finite ratio from 0.25 to 4',view.source,view.start);
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
      /* 0.8 (chapter 04 §6A): per-element label text properties ride the
       * property bag as a normalized record; they decorate the element's
       * label only (fields/details/notes stay role-baked this revision). */
      const textGroup=group(n,'text');
      if(textGroup){textGate(n,'A text { } group on an element');properties.text=txCheck(textGroup.props,textGroup.source,textGroup.start);}
      /* 0.8 (chapter 04 §6B): portable element outline (stroke { }) and fill
       * (flat colour). Paint-only: layout, routing and the model fingerprint
       * never change. */
      const strokeGroup=group(n,'stroke');
      if(strokeGroup){textGate(n,'A stroke { } group on an element');properties.stroke=normalizeStrokeProps(strokeGroup.props,(code,msg)=>{throw new DDNError(code,msg,strokeGroup.source,strokeGroup.start);},{allowCorners:true});}
      if(properties.fill!==undefined){textGate(n,'fill on an element');properties.fill=normalizeLineColor(properties.fill,(code,msg)=>{throw new DDNError(code,msg,n.source,n.start);});}
      /* 0.8 (chapter 04 §6C): per-element content opacity — a plain 0..1
       * ratio painted as one SVG group opacity over the whole node (fill,
       * stroke and text together). Paint-only: hit-testing, measurement,
       * layout, diagnostics and the model fingerprint are unaffected. */
      if(properties.opacity!==undefined){textGate(n,'opacity on an element');
        if(typeof properties.opacity!=='number'||!Number.isFinite(properties.opacity)||properties.opacity<0||properties.opacity>1)throw new DDNError('DDN-SZ01','opacity on an element must be a number from 0 to 1; found '+JSON.stringify(properties.opacity),n.source,n.start);}
      if(n.type==='sample'){
        if(!Array.isArray(properties.columns)||!Array.isArray(properties.rows))throw new DDNError('DDN051','Sample requires columns and rows',n.source,n.start);
        for(const c of n.props.columns){const f=ws.resolve(c,n);if(f.type!=='field')throw new DDNError('DDN052','Sample columns must bind to fields',n.source,n.start);}
        for(const row of properties.rows)if(!Array.isArray(row)||row.length!==properties.columns.length)throw new DDNError('DDN053','Sample row width does not match columns',n.source,n.start);
      }
      return {id:n.uid,ref:n.path,local:n.id,name:n.label||n.id,type:n.type,kind:k.keyword,kindCode:k.code,properties,fields,ports,source:{file:n.source,start:n.start,end:n.end}};
    });
    const elementIds=new Set(elements.map(n=>n.id));
    for(const n of elements)tfCheck(n.properties,n.source.file,n.source.start);
    function endpoint(r,n){let t=ws.resolve(r,n);if(['field','port'].includes(t.type)){const path=t.path.split('.');path.pop();let owner=ws.symbols.get(t.doc.module+'::'+path.join('.'));while(owner?.type==='field'){path.pop();owner=ws.symbols.get(t.doc.module+'::'+path.join('.'));}if(!owner||!elementIds.has(owner.uid)&&!ws.archPaths.has(owner.doc?.source))throw new DDNError('DDN054','Endpoint owner is outside the selected data modules',n.source,n.start);return {element:owner.uid,member:t.uid,role:t.type};}if(!elementIds.has(t.uid)&&!ws.archPaths.has(t.doc?.source))throw new DDNError('DDN054','Relation endpoint is not a data element in scope',n.source,n.start);return {element:t.uid};}
    const relations=rawRelations.map(n=>{if(!n.from||!n.to)throw new DDNError('DDN055','Relation requires two endpoints',n.source,n.start);let r=relationEntry(registry,n.props.kind||'assoc');if(!r)throw new DDNError('DDN056','Unknown relationship kind '+n.props.kind,n.source,n.start);const properties=resolveValue(n.props,n);
      /* 0.8 (chapter 04 §6B): portable relation line { } — decorates the
       * painted route and its endpoint heads; routed geometry is untouched. */
      const lineGroup=group(n,'line');
      if(lineGroup){textGate(n,'A line { } group on a relation');properties.line=normalizeStrokeProps(lineGroup.props,(code,msg)=>{throw new DDNError(code,msg,lineGroup.source,lineGroup.start);},{group:'line'});}
      return{id:n.uid,ref:n.path,name:n.label||r.name,kind:r.keyword,kindCode:r.code,from:endpoint(n.from,n),to:endpoint(n.to,n),properties,source:{file:n.source,start:n.start,end:n.end}};});
    /* 0.8 amendment (chapter 55 §55.6): diff union. Both operand views build
     * through the ordinary pipeline. Matching is by LOCAL SOURCE ID within
     * the data block (before.keep correlates with after.keep — uids are
     * workspace-unique by construction (DDN026) and cannot correlate two
     * revisions; the shared local id is the author's identity claim).
     * Comparison covers name, kind, properties (and fields for elements);
     * geometry is ignored. An operand with two elements sharing one local id
     * is an authoring ambiguity (DDN-DF04). The diff view then flows through
     * selection/visibility/layout exactly like a data-backed view. */
    if(diff08){
      const irA=build(files,diff08.a.source,diff08.a.uid,registry,[...stack,view.uid]).ir;
      const irB=build(files,diff08.b.source,diff08.b.uid,registry,[...stack,view.uid]).ir;
      /* The operand is the view's VISIBLE model: selected elements and the
       * relations visible between them (ir.view.relations), not the whole
       * underlying data blocks. */
      const visEls=ir=>(new Set(ir.view.selected||ir.elements.map(e=>e.id)));
      const visRels=ir=>new Set(ir.view.relations||[]);
      const selA=visEls(irA),selB=visEls(irB),visA=visRels(irA),visB=visRels(irB);
      const elsA=irA.elements.filter(e=>selA.has(e.id)),elsB=irB.elements.filter(e=>selB.has(e.id));
      const relsA=irA.relations.filter(r=>visA.has(r.id)),relsB=irB.relations.filter(r=>visB.has(r.id));
      const localOf=(ref,local)=>local??String(ref).split('.').pop();
      const keyOf=(list,side)=>{const m=new Map();
        for(const e of list){const k=localOf(e.ref,e.local);
          if(m.has(k))throw new DDNError('DDN-DF04','diff operand '+side+' contains two elements with the identity '+JSON.stringify(k)+' (from '+m.get(k).ref+' and '+e.ref+'); narrow the operand with select/exclude',view.source,view.start);
          m.set(k,e);}
        return m;};
      const cmpEl=el=>JSON.stringify({name:el.name,kind:el.kind,properties:el.properties,fields:(el.fields||[]).map(f=>[f.name,f.properties])});
      const byIdA=keyOf(elsA,diff08.a.uid),byIdB=keyOf(elsB,diff08.b.uid);
      const counts={added:0,removed:0,changed:0,unchanged:0};
      const cmpRel=r=>JSON.stringify({name:r.name,kind:r.kind,
       from:{element:String(r.from.element).split('.').pop(),member:r.from.member},
       to:{element:String(r.to.element).split('.').pop(),member:r.to.member},properties:r.properties});
      const relA=keyOf(relsA,diff08.a.uid),relB=keyOf(relsB,diff08.b.uid);
      /* Union identities are re-keyed to the diff view: operand uids are
       * workspace-unique by construction (DDN026), so the union members get
       * synthetic per-state ids and relation endpoints re-point at the union
       * copy of their element (matched by the same local-id key). */
      const elemKeyOf=e=>localOf(e.ref,e.local),unionId=(e,state)=>view.uid+'::'+state+'::'+elemKeyOf(e);
      const byOrig=new Map(),newElems=[];
      for(const [k,e] of byIdA){const other=byIdB.get(k),state=!other?'removed':cmpEl(e)!==cmpEl(other)?'changed':'unchanged';counts[state]++;const id=unionId(e,state);byOrig.set(e.id,id);if(other)byOrig.set(other.id,id);newElems.push({...e,id,diffState:state});}
      for(const [k,e] of byIdB)if(!byIdA.has(k)){counts.added++;const id=unionId(e,'added');byOrig.set(e.id,id);newElems.push({...e,id,diffState:'added'});}
      const newRels=[];
      for(const [k,r] of relA){const other=relB.get(k),state=!other?'removed':cmpRel(r)!==cmpRel(other)?'changed':'unchanged';newRels.push({...r,diffState:state});}
      for(const [k,r] of relB)if(!relA.has(k))newRels.push({...r,diffState:'added'});
      for(const r of newRels){r.id=view.uid+'::'+r.diffState+'::'+localOf(r.ref,r.local);r.from={...r.from,element:byOrig.get(r.from.element)||r.from.element};r.to={...r.to,element:byOrig.get(r.to.element)||r.to.element};}
      elements.push(...newElems);relations.push(...newRels);
      elementIds.clear();for(const n of elements)elementIds.add(n.id);
      diff08.aName=irA.view.name;diff08.bName=irB.view.name;diff08.counts=counts;
    }
    // B1-033: declarative motion vocabulary (D2). Values are validated here;
    // emission is the renderer's job. rate beyond the DOM-honest cap is a
    // warning (DDN-W016) and clamps at render time.
    const motionDiagnostics=[];
    const MOTION_RATE_MAX=32;
    function validateMotionProps(props,source,offset){
      if(props.motion!==undefined&&!['flow','pulse','none'].includes(props.motion))throw new DDNError('DDN-E014','Unknown motion value '+JSON.stringify(props.motion)+'; expected flow, pulse or none',source,offset);
      if(props.marker!==undefined&&!['circle','square','rect'].includes(props.marker))throw new DDNError('DDN-E014','Unknown marker shape '+JSON.stringify(props.marker)+'; expected circle, square or rect',source,offset);
      if(props.marker_size!==undefined&&!(quantity(props.marker_size,NaN)>0&&quantity(props.marker_size,NaN)<=128))throw new DDNError('DDN-E014','marker_size must be a length from >0 to 128px',source,offset);
      if(props.speed!==undefined&&!(quantity(props.speed,NaN)>0&&quantity(props.speed,NaN)<=10000))throw new DDNError('DDN-E014','speed must be a positive length (px/s) up to 10000',source,offset);
      if(props.rate!==undefined&&(!Number.isSafeInteger(props.rate)||props.rate<1))throw new DDNError('DDN-E014','rate must be a positive integer (markers in flight)',source,offset);
      if(props.rate>MOTION_RATE_MAX)motionDiagnostics.push({code:'DDN-W016',severity:'warning',message:'rate '+props.rate+' exceeds the '+MOTION_RATE_MAX+'-marker DOM-honest cap and is clamped to '+MOTION_RATE_MAX+' at render time.',source});
      for(const key of ['marker_color','pulse_color'])if(props[key]!==undefined&&typeof props[key]!=='string')throw new DDNError('DDN-E014',key+' must be a colour string',source,offset);
    }
    const MOTION_KEYS=['motion','marker','rate','speed','marker_size','marker_color','pulse_color'];
    for(const r of relations)if(MOTION_KEYS.some(k=>r.properties[k]!==undefined))validateMotionProps(r.properties,r.source.file,r.source.start);
    let selected=view.props.select==='all'||view.props.select===undefined?elements.map(n=>n.id):view.props.select.map(r=>ws.resolve(r,view).uid);
    if(!Array.isArray(selected)||selected.some(id=>!elementIds.has(id)))throw new DDNError('DDN057','View selection contains a non-element or out-of-scope element',view.source,view.start);
    const excluded=(view.props.exclude||[]).map(r=>ws.resolve(r,view).uid);selected=[...new Set(selected)].filter(id=>!excluded.includes(id));
    if(p.display.samples==='hide')selected=selected.filter(id=>elements.find(n=>n.id===id).type!=='sample');
    const shown=new Set(selected),visibleRelations=p.display.relations==='none'?[]:relations.filter(r=>shown.has(r.from.element)&&shown.has(r.to.element));
    /* B1-090: cross-file traceability. Relations spanning architecture bases
     * require a covering container (DDN-PJ217); an outside endpoint renders as
     * an off-page badge naming its module-qualified identity. x_link metadata
     * resolves against the loaded bases (unknown identity: DDN-PJ216; absent
     * file: DDN-PJW07 note, never an error). */
    const xrefDiags=[];
    const archOf=id=>ws.uidMap.get(id)?.doc?.source;
    for(const r of relations){
     const fa=archOf(r.from.element),fb=archOf(r.to.element);
     if(fa&&fb&&fa!==fb&&(ws.archPaths.has(fa)||ws.archPaths.has(fb))){
      /* The host workspace file is implicitly covered; every base named by an
       * endpoint must be covered by a declared container. */
      const cover=p=>!ws.archPaths.has(p)||ws.archContainers.some(c=>c.bases.includes(p));
      if(!cover(fa)||!cover(fb))
       throw new DDNError('DDN-PJ217','Cross-file relation '+r.id+' links '+fa+' and '+fb+'; an architecture container covering the base(s) is required',r.source,r.start);
     }
     const xl=r.properties.x_link;
     if(xl&&r.properties._xlink!=='unresolved'){
      try{ws.resolve({$ref:xl.target,$offset:r.start},ws.symbols.get(r.from.element)||view);}
      catch(e){throw new DDNError('DDN-PJ216','x_link on '+r.id+' targets unknown identity '+JSON.stringify(xl.target)+' in '+xl.file,r.source,r.start);}
     }
     if(xl&&r.properties._xlink==='unresolved')xrefDiags.push({code:'DDN-PJW07',severity:'warning',message:'x_link on '+r.id+': target file '+xl.file+' is not in the workspace; rendered as an unresolved external note.',source:r.source.file,start:r.source.start});
    }
    for(const r of relations.slice()){
     const inF=shown.has(r.from.element),inT=shown.has(r.to.element);
     if(inF===inT)continue;
     const outEp=inF?r.to:r.from,outNode=ws.uidMap.get(outEp.element);
     if(!outNode||outEp.member||!ws.archPaths.has(outNode.doc?.source))continue;
     const badgeId=r.id+'::__external',offpage=kindEntry(registry,'flow.offpage');
     elements.push({id:badgeId,ref:badgeId,local:'__external',name:outNode.doc.module+'::'+outNode.path,type:'object',kind:'flow.offpage',kindCode:offpage.code,properties:{x_external:{file:outNode.doc.source,target:outNode.uid}},fields:[],ports:[],source:r.source});
     selected.push(badgeId);shown.add(badgeId);
     if(inF)r.to={element:badgeId};else r.from={element:badgeId};
     r.properties={...r.properties,x_external:{file:outNode.doc.source,target:outNode.uid}};
     visibleRelations.push(r);
    }
    const keys=Object.create(null),seen=new Map();
    for(const [ref,num] of Object.entries(p.legend.keys||{})){
      let matches=relations.filter(r=>r.id===ref||r.ref===ref||r.ref.split('.').at(-1)===ref);if(matches.length>1)throw new DDNError('DDN058','Ambiguous legend key '+ref,view.source,view.start);let target=matches[0];
      if(!target)throw new DDNError('DDN058','Legend key refers to unknown relation '+ref,view.source,view.start);
      if(!Number.isSafeInteger(num)||num<1)throw new DDNError('DDN059','Callout numbers must be positive integers',view.source,view.start);
      if(seen.has(num)&&seen.get(num)!==target.id)throw new DDNError('DDN060','Duplicate callout number '+num,view.source,view.start);seen.set(num,target.id);keys[target.id]=num;
    }
    if(p.legend.mode==='numbers')for(const r of visibleRelations)if(!keys[r.id])throw new DDNError('DDN061','Missing explicit callout number for '+r.ref,view.source,view.start);
    const placements=Object.create(null),routes=Object.create(null),subdiagrams=[],frames=[],flows=[];
    for(const n of view.children.filter(n=>!n.group)){
      if(n.type==='place'){const target=ws.resolve(n.target,view);if(!shown.has(target.uid))throw new DDNError('DDN062','Placement target is not selected',n.source,n.start);placements[target.uid]=clean(n.props);}
      else if(n.type==='route'){validateCurvePolicy(n.props,n.source,n.start);const target=ws.resolve(n.target,view);if(!visibleRelations.some(r=>r.id===target.uid))throw new DDNError('DDN063','Route target is not visible',n.source,n.start);routes[target.uid]=clean(n.props);}
      else if(n.type==='subdiagram'){const target=ws.resolve(n.props.view,n);if(target.type!=='view')throw new DDNError('DDN064','Subdiagram target must be a view',n.source,n.start);if(!['reference','inline'].includes(n.props.mode))throw new DDNError('DDN900','Reference renderer supports reference and inline modes; balanced collapsed interfaces are specified separately',n.source,n.start);const child=n.props.mode==='inline'?build(files,target.source,target.uid,registry,[...stack,view.uid]).ir:null;subdiagrams.push({id:n.uid,target:target.uid,targetName:target.label||target.id,targetLocal:target.id,name:n.props.label||n.label||target.label||target.id,...clean(n.props),child});}
      else if(n.type==='frame'){frames.push({id:n.uid,name:n.label||n.props.label||n.id,scope:n.props.scope?ws.resolve(n.props.scope,n).uid:null,members:(n.props.members||[]).map(r=>ws.resolve(r,n).uid),...Object.fromEntries(Object.entries(clean(n.props)).filter(([k])=>!['scope','members'].includes(k)))});}
      // B1-033 (D3): a flow block is a step-traceable multi-hop sequence. Each
      // hop resolves to the existing visible relation between consecutive
      // elements (steps follow relation direction); a hop without one is DDN-E013.
      else if(n.type==='flow'){
        validateKnown(n,PROPERTIES.flow);
        if(!Array.isArray(n.props.steps)||n.props.steps.length<2)throw new DDNError('DDN-E013','Flow '+n.id+' needs at least two steps: @a -> @b -> …',n.source,n.start);
        const steps=n.props.steps.map(r=>{const t=ws.resolve(r,n);if(!elementIds.has(t.uid))throw new DDNError('DDN-E013','Flow step is not a data element in scope: @'+r.$ref,n.source,r.$offset||n.start);if(!shown.has(t.uid))throw new DDNError('DDN-E013','Flow step is not selected in this view: @'+r.$ref,n.source,r.$offset||n.start);return t.uid;});
        const hops=[];
        for(let i=0;i<steps.length-1;i++){
          const match=visibleRelations.find(r=>r.from.element===steps[i]&&r.to.element===steps[i+1]);
          if(!match)throw new DDNError('DDN-E013','Flow '+n.id+' hop '+(i+1)+' has no visible relation from '+steps[i].split('::').at(-1)+' to '+steps[i+1].split('::').at(-1)+'; steps must follow existing relations in their declared direction',n.source,n.start);
          hops.push(match.id);
        }
        const fprops=resolveValue(n.props,n);
        validateMotionProps(fprops,n.source,n.start);
        flows.push({id:n.uid,local:n.id,name:n.label||fprops.label||n.id,steps,hops,properties:fprops,source:{file:n.source,start:n.start,end:n.end}});
      }
      else throw new DDNError('DDN900','Reference renderer does not implement view declaration '+n.type,n.source,n.start);
    }
    /* 0.8 core language (chapters 52 and 55): view kinds and strictness,
     * registered themes, reference numerals, markings, inert assertions,
     * provenance and ref: anchors. Vocabulary membership governs nothing but
     * the DDN-VP03/04 lint; assertions evaluate nothing; anchors resolve to
     * text at render time (render phase). */
    const diags08=[];
    const kind08=view.props.kind??bundle?.props.kind,kind08Src=view.props.kind!==undefined?view:bundle;
    const strict08=view.props.strictness??bundle?.props.strictness,strict08Src=view.props.strictness!==undefined?view:bundle;
    if(kind08!==undefined&&(typeof kind08!=='string'||!ViewProfiles.VIEW_KINDS[kind08]))throw new DDNError('DDN-VP01','Unknown view kind '+JSON.stringify(kind08)+'; registered kinds: '+Object.keys(ViewProfiles.VIEW_KINDS).join(', '),kind08Src.source,kind08Src.start);
    if(strict08!==undefined){
      if(kind08===undefined)throw new DDNError('DDN-VP02','strictness declared without a view kind; strictness has nothing to bind to',strict08Src.source,strict08Src.start);
      if(!['strict','permissive'].includes(strict08))throw new DDNError('DDN046','strictness must be strict or permissive',strict08Src.source,strict08Src.start);
    }
    const strictness08=strict08||'permissive';
    let theme08=view.props.theme;
    if(theme08!==undefined&&(typeof theme08!=='string'||!ViewProfiles.THEMES[theme08]))throw new DDNError('DDN-VP08','Unknown theme name '+JSON.stringify(theme08)+'; registered themes: '+Object.keys(ViewProfiles.THEMES).join(', '),view.source,view.start);
    /* Kind-attached theme (chapter 52 §52.4, layer 2): applies only when the
     * author declared no theme; unregistered attachment tokens are ignored. */
    if(theme08===undefined&&kind08!==undefined){const att=ViewProfiles.VIEW_KINDS[kind08].attachment?.theme;if(att&&ViewProfiles.THEMES[att])theme08=att;}
    if(kind08!==undefined){
      const vk=ViewProfiles.VIEW_KINDS[kind08];
      /* Kind-derived default profile (chapter 52 §52.4, layer 2): applies only
       * when the view declares no projection itself (header, bundle or body). */
      if(vk.attachment.profile&&!view.props.projection&&!bundle?.props.projection&&!group(view,'projection')&&!view.headerProjection){
        const att=Profiles.get(vk.attachment.profile);
        if(att){p.projection.profile=att.id;p.projection.kind=att.projection;}
      }
      if(kind08.startsWith('chart-')&&p.projection.kind!=='chart')throw new DDNError('DDN-VP09','View kind '+kind08+' conflicts with an explicit incompatible projection kind '+p.projection.kind+' (chart kinds require a chart projection)',view.source,view.start);
      if(vk.vocabulary!=='core.full'){
        const outside=(what,word,name,src)=>{const msg=(what==='kind'?'element '+name+' (kind: '+word+')':'relation '+name+' (verb: '+word+')')+' is outside the '+kind08+' vocabulary (subset '+vk.vocabulary+')';
          if(strictness08==='strict')throw new DDNError('DDN-VP04',msg+' — change the element kind/verb or change the view kind (ddn-native admits the full core registry)',src.file,src.start);
          diags08.push({code:'DDN-VP03',severity:'info',message:msg+'.',source:src.file,offset:src.start});};
        for(const n of elements)if(shown.has(n.id)&&!n.id.includes('::__external')&&!ViewProfiles.subsetAdmits(vk.vocabulary,'kind',n.kind))outside('kind',n.kind,n.local,n.source);
        for(const r of visibleRelations)if(!ViewProfiles.subsetAdmits(vk.vocabulary,'verb',r.kind))outside('verb',r.kind,r.name||r.ref,r.source);
      }
      /* patent.legal@1 (chapter 52 §52.5): every decision branch labelled. */
      if(kind08==='patent-figure'){
        /* Document chrome defaults (chapter 52 §52.5): title block with
         * $title/$date, FIG./Page footer, single page border — layer-2
         * defaults; any authored concern (already merged into p.publication)
         * wins. */
        const pl=ViewProfiles.PATENT_LEGAL.chromeDefaults;
        if(!p.publication.header)p.publication.header=JSON.parse(JSON.stringify(pl.header));
        if(!p.publication.footer)p.publication.footer=JSON.parse(JSON.stringify(pl.footer));
        if(!p.publication.border)p.publication.border={...pl.border};
        const byId=new Map(elements.map(n=>[n.id,n]));
        for(const r of visibleRelations){
          if(byId.get(r.from.element)?.kind!=='flow.decision')continue;
          const raw=ws.uidMap.get(r.id),branch=r.properties.x_diagram?.branch??r.properties.label??raw?.label;
          if(typeof branch!=='string'||!branch.trim())diags08.push({code:'DDN-VP07',severity:'warning',message:'Decision branch '+(r.ref||r.id)+' has no label under patent.legal@1; examiners require every branch to be labelled.',source:r.source.file,offset:r.source.start});
        }
      }
    }
    /* Reference numerals (chapter 52 §52.5): any element may declare one;
     * shape and per-view uniqueness are validated regardless of profile. */
    const numerals08=new Map();
    for(const n of elements){
      const num=n.properties.numeral;if(num===undefined)continue;
      if(!Number.isSafeInteger(num)||num<1||num>99999)throw new DDNError('DDN-VP05','numeral on '+n.local+' must be an integer in 1-99999; found '+JSON.stringify(num),n.source.file,n.source.start);
      const prev=numerals08.get(num);
      if(prev)throw new DDNError('DDN-VP06','Duplicate numeral '+num+' within one view: elements '+prev.local+' and '+n.local,n.source.file,n.source.start);
      numerals08.set(num,n);
    }
    /* Markings (chapter 55 §55.1): registered names, no duplicates per site. */
    for(const n of raw){const m=n.props.marks;if(m===undefined)continue;
      if(!Array.isArray(m))throw new DDNError('DDN-MK01','marks on '+n.id+' must be an array of registered marking names ('+Object.keys(ViewProfiles.MARKINGS).join(', ')+')',n.source,n.start);
      const seen=new Set();
      for(const entry of m){
        if(typeof entry!=='string'||!ViewProfiles.MARKINGS[entry])throw new DDNError('DDN-MK01','Unknown marking '+JSON.stringify(entry)+' on '+n.id+'; registered markings: '+Object.keys(ViewProfiles.MARKINGS).join(', '),n.source,n.start);
        if(seen.has(entry))throw new DDNError('DDN-MK02','Duplicate marking '+entry+' in one marks array on '+n.id,n.source,n.start);
        seen.add(entry);
      }
    }
    /* Assertions (chapter 55 §55.2): inert claim text, shape-validated only. */
    for(const n of rawRelations){const a=n.props.assertion;if(a===undefined)continue;
      if(typeof a!=='string'||a.length<1||a.length>500)throw new DDNError('DDN-MK04','assertion on relation '+n.id+' must be plain text of 1-500 characters',n.source,n.start);}
    let assertions08;
    if(view.props.assertions!==undefined){
      const list=view.props.assertions;
      if(!Array.isArray(list)||list.length<1||list.length>32)throw new DDNError('DDN-MK03','assertions on view '+view.id+' must be an array of 1-32 strings; found '+(Array.isArray(list)?list.length:'non-array'),view.source,view.start);
      for(const a of list)if(typeof a!=='string'||a.length<1||a.length>500)throw new DDNError('DDN-MK04','assertion text on view '+view.id+' must be 1-500 characters',view.source,view.start);
      assertions08=[...list];
    }
    /* Provenance (chapter 55 §55.3): metadata claims, never required. */
    const provenance08={};
    if(view.props.source!==undefined){if(typeof view.props.source!=='string'||view.props.source.length<1||view.props.source.length>300)throw new DDNError('DDN046','source provenance must be text of 1-300 characters',view.source,view.start);provenance08.source=view.props.source;}
    if(view.props.generator!==undefined){if(typeof view.props.generator!=='string'||!view.props.generator.length)throw new DDNError('DDN046','generator provenance must be nonempty text',view.source,view.start);provenance08.generator=view.props.generator;}
    /* ref: anchors (chapter 55 §S4): parsed and validated here; the anchor
     * resolves to the target's numeral or label at render time (render phase). */
    const refAnchors08=[],REF_RE=/\bref:([A-Za-z_][A-Za-z0-9_-]*)/g;
    const scanRefs=(text,siteUid,siteNode)=>{
      if(typeof text!=='string'||!text.includes('ref:'))return;
      for(const m of text.matchAll(REF_RE)){
        const anchor=m[1];let target=null;
        try{target=ws.resolve({$ref:anchor,$offset:siteNode.start},siteNode);}catch(e){if(e.code!=='DDN031')throw e;}
        if(!target||!elementIds.has(target.uid))throw new DDNError('DDN-MK05','ref:'+anchor+' names a missing element (anchor site '+siteUid+')',siteNode.source,siteNode.start);
        if(target.uid===siteUid)throw new DDNError('DDN-MK06','ref:'+anchor+' is a self-reference within its own element\'s text',siteNode.source,siteNode.start);
        refAnchors08.push({site:siteUid,target:target.uid,anchor});
      }
    };
    for(const n of rawNodes){scanRefs(n.label,n.uid,n);scanRefs(n.props.text,n.uid,n);scanRefs(n.props.label,n.uid,n);}
    for(const n of rawRelations){scanRefs(n.label,n.uid,n);scanRefs(n.props.text,n.uid,n);scanRefs(n.props.label,n.uid,n);}
    scanRefs(view.label,view.uid,view);scanRefs(view.props.title,view.uid,view);scanRefs(view.props.footer,view.uid,view);
    scanRefs(p.publication.title,view.uid,view);scanRefs(p.publication.caption,view.uid,view);
    /* DDN-V06: informational when a file declares older than the workspace's
     * newest source version; never a failure. */
    const maxDocVersion=Math.max(...[...ws.docs.values()].map(d=>SOURCE_VERSIONS.indexOf(d.version)));
    for(const d of ws.docs.values())if(SOURCE_VERSIONS.indexOf(d.version)<maxDocVersion)diags08.push({code:'DDN-V06',severity:'info',message:'File '+d.source+' declares ddn "'+d.version+'", older than the workspace\'s newest source version '+SOURCE_VERSIONS[maxDocVersion]+' (informational only).',source:d.source});
    const diagnostics=[...motionDiagnostics,...xrefDiags,...chrome08Diags,...diags08];if([...ws.docs.values()].some(d=>d.version==='0.2'))diagnostics.push({code:'DDN-W012',severity:'warning',message:'0.2 source accepted through compatibility reader. Migrate headers and review new semantic/routing diagnostics.'});
    const currentLanguage=[...ws.docs.values()].some(d=>d.version==='0.6')?'0.6':[...ws.docs.values()].some(d=>d.version==='0.5')?'0.5':[...ws.docs.values()].some(d=>d.version==='0.4')?'0.4':'0.3';
    const ir={format:'ddn-resolved@'+currentLanguage,language:currentLanguage,registry:'ddn-core@0.3',entry,view:{id:view.uid,name:view.label||view.id,local:view.id,selected,relations:visibleRelations.map(r=>r.id),profiles:p,keys,placements,routes,subdiagrams,frames,flows,source:{file:view.source,start:view.start,end:view.end,bodyEnd:view.bodyEnd}},elements,relations,diagnostics};
    if(kind08!==undefined){ir.view.kind=kind08;ir.view.strictness=strictness08;}
    if(diff08)ir.view.diff={a:diff08.a.uid,b:diff08.b.uid,aName:diff08.aName,bName:diff08.bName,counts:diff08.counts};
    if(theme08!==undefined)ir.view.theme=theme08;
    if(assertions08)ir.view.assertions=assertions08;
    if(fontPin08)ir.view.fontPin=fontPin08;
    if(Object.keys(provenance08).length)ir.view.provenance=provenance08;
    if(refAnchors08.length)ir.view.refAnchors=refAnchors08;
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
    if(p.projection.profile==='soaml.services@1'){
      /* B1-072 : service-contract choreography binding — the target
       * view must be a uml.sequence@2 or uml.statemachine@1 choreography. */
      for(const n of ir.elements){const target=n.properties&&n.properties.x_contract&&n.properties.x_contract.choreography&&n.properties.x_contract.choreography.$ref;
        if(typeof target!=='string')continue;
        const tv=ws.uidMap.get(target)||[...ws.symbols.values()].find(x=>x.type==='view'&&(x.id===target||x.uid===target));
        if(!tv)throw new DDNError('DDN-PJ197','Service contract '+(n.name||n.id)+' references unknown choreography view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
        if(tv.uid===view.uid||stack.includes(tv.uid))throw new DDNError('DDN-PJ197','Service contract '+(n.name||n.id)+' choreography binding must reference a different view (self-reference is not a choreography)',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
        const child=build(files,tv.source,tv.uid,registry,[...stack,view.uid]).ir;
        const cp=child.view.profiles.projection?.profile;
        if(!['uml.sequence@2','uml.statemachine@1'].includes(cp))throw new DDNError('DDN-PJ197','Service contract '+(n.name||n.id)+' binds view '+target+' ('+cp+'); a choreography binds a uml.sequence@2 or uml.statemachine@1 view',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
      }
    }
    if(p.projection.profile==='idef0.basic@1'){
      /* B1-078: decomposition numbering — a child view's activities number
       * under the decomposed node's number (A1 -> A11, A12, ...). */
      for(const n of ir.elements){const target=n.properties&&n.properties.x_subdiagram&&n.properties.x_subdiagram.view;
       if(n.kind!=='idef0.activity'||typeof target!=='string')continue;
       const tv=ws.uidMap.get(target)||[...ws.symbols.values()].find(x=>x.type==='view'&&(x.id===target||x.uid===target));
       if(!tv)throw new DDNError('DDN-PJ119','IDEF0 node '+(n.name||n.id)+' references unknown decomposition view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       const parent=n.properties.x_idef0?.node||'';
       const child=build(files,tv.source,tv.uid,registry,[...stack,view.uid]).ir;
       if(child.view.profiles.projection?.profile!=='idef0.basic@1')throw new DDNError('DDN-PJ201','IDEF0 decomposition of '+(n.name||n.id)+' must target an idef0.basic@1 view',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       for(const c of child.elements.filter(x=>x.kind==='idef0.activity')){
        const num=c.properties.x_idef0?.node||'';
        if(parent&&!num.startsWith(parent))throw new DDNError('DDN-PJ201','IDEF0 child activity '+(c.name||c.id)+' numbers '+JSON.stringify(num||'unset')+'; decomposition of '+parent+' must number under it ('+parent+'1, '+parent+'2, ...)',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       }
      }
    }
    if(p.projection.profile==='msc.basic@1'){
      /* B1-077: HMSC references must bind an existing view (PJ119). */
      const viewIds2=new Set();for(const x of ws.symbols.values())if(x.type==='view'){viewIds2.add(x.id);viewIds2.add(x.uid);}
      for(const n of ir.elements){const target=n.properties&&n.properties.x_subdiagram&&n.properties.x_subdiagram.view;
        if(n.kind==='msc.hmscref'&&typeof target==='string'&&!viewIds2.has(target))
         throw new DDNError('DDN-PJ119','HMSC reference '+(n.name||n.id)+' references unknown view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);}
    }
    if(p.projection.profile==='dmn.drd@1'){
      /* B1-066 : DMN decision nodes bind decision-table views. */
      for(const n of ir.elements){const target=n.properties&&n.properties.x_subdiagram&&n.properties.x_subdiagram.view;
        if(typeof target!=='string')continue;
        if(!n.kind.startsWith('dmn.'))throw new DDNError('DDN-PJ192','x_subdiagram on '+n.kind+' under dmn.drd@1; only dmn.* nodes bind views',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
        const tv=ws.uidMap.get(target)||[...ws.symbols.values()].find(x=>x.type==='view'&&(x.id===target||x.uid===target));
        if(!tv)throw new DDNError('DDN-PJ192','DMN node '+(n.name||n.id)+' references unknown view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
        const child=build(files,tv.source,tv.uid,registry,[...stack,view.uid]).ir;
        if(child.view.profiles.projection?.kind!=='decision')throw new DDNError('DDN-PJ192','DMN node '+(n.name||n.id)+' binds view '+target+' which is a '+child.view.profiles.projection?.kind+' projection; a dmn.decision binds a decision-projection (decision table) view',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
      }
    }
    if(p.projection.profile==='uml.interaction_overview@1'||p.projection.profile==='uml.interaction_overview@2'){
      const viewIds=new Set();for(const n of ws.symbols.values())if(n.type==='view'){viewIds.add(n.id);viewIds.add(n.uid);}
      /* B1-061 : @2 expands referenced interactions inline — one
       * recursion level via build(), child IRs on ir.view.ioChildren (view-level
       * metadata; semanticJSON reads elements/relations only). */
      const ioChildren={};
      for(const n of ir.elements){const target=n.properties&&n.properties.x_subdiagram&&n.properties.x_subdiagram.view;
        if(typeof target==='string'&&!viewIds.has(target))throw new DDNError('DDN-PJ119','Interaction overview node '+(n.name||n.id)+' references unknown view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
        if(typeof target==='string'&&p.projection.profile==='uml.interaction_overview@2'){
         const tv=ws.uidMap.get(target)||[...ws.symbols.values()].find(x=>x.type==='view'&&x.id===target);
         const child=build(files,tv.source,tv.uid,registry,[...stack,view.uid]).ir;
         if(child.view.profiles.projection.profile==='uml.interaction_overview@2'&&child.elements.some(m=>m.properties.x_subdiagram))throw new DDNError('DDN-PJ174','Interaction overview inline expansion supports one level; nested expansions are not rendered',view.source,view.start);
         if(child.view.selected.length>128||child.view.relations.length>384)throw new DDNError('DDN-PJ174','Interaction overview child exceeds visible graph limits',view.source,view.start);
         ioChildren[n.id]=child;
        }}
      if(Object.keys(ioChildren).length)ir.view.ioChildren=ioChildren;
    }
    /* B1-074 : drill-down display modes on any node with
     * x_subdiagram.display. interaction_overview@2 keeps its legacy
     * display-absent inline behavior above; elsewhere display:'inline' builds
     * a live child, display:'thumbnail' builds a shapes-detail child (rendered
     * downstream), and frozen nodes embed their stored snapshot and are never
     * re-rendered by the viewer. One nesting level, like PJ174. */
    {
     const drChildren={};
     for(const n of ir.elements){
      const x=n.properties&&n.properties.x_subdiagram;if(!x)continue;
      const display=x.frozen===true?'thumbnail':(x.display||(p.projection.profile==='uml.interaction_overview@2'?'inline':'badge'));
      if(x.frozen===true){
       if(display!=='thumbnail')throw new DDNError('DDN-PJ198','frozen snapshots apply to display thumbnail; '+(n.name||n.id)+' declares display '+display,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       if(typeof x.snapshot!=='string'||!x.snapshot)throw new DDNError('DDN-PJ198','Frozen drill-down '+(n.name||n.id)+' requires a snapshot SVG payload',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       if(!/<svg[\s>]/.test(x.snapshot)||x.snapshot.length>524288)throw new DDNError('DDN-PJ198','Frozen snapshot on '+(n.name||n.id)+' must be an SVG document (max 512 KiB)',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       if(x.snapshot_at!==undefined&&typeof x.snapshot_at!=='string')throw new DDNError('DDN-PJ198','snapshot_at must be a string timestamp',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
       continue; // viewer never re-renders frozen children
      }
      if(display==='badge')continue;
      const target=x.view;if(typeof target!=='string')continue;
      const tv=ws.uidMap.get(target)||[...ws.symbols.values()].find(x2=>x2.type==='view'&&(x2.id===target||x2.uid===target));
      if(!tv)throw new DDNError('DDN-PJ119','Drill-down node '+(n.name||n.id)+' references unknown view '+target,n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
      if(tv.uid===view.uid||stack.includes(tv.uid))throw new DDNError('DDN-PJ198','Drill-down node '+(n.name||n.id)+' cannot render its own view as a child',n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
      const child=build(files,tv.source,tv.uid,registry,[...stack,view.uid]).ir;
      if(child.elements.some(m=>{const mx=m.properties.x_subdiagram;return mx&&(mx.display==='inline'||mx.display==='thumbnail');}))throw new DDNError('DDN-PJ198','Drill-down children support one nesting level; '+(n.name||n.id)+"'s child declares its own inline/thumbnail node",n.source&&n.source.file||view.source,n.source&&n.source.start||view.start);
      if(child.view.selected.length>128||child.view.relations.length>384)throw new DDNError('DDN-PJ174','Drill-down child exceeds visible graph limits',view.source,view.start);
      drChildren[n.id]=child;
     }
     if(Object.keys(drChildren).length)ir.view.ioChildren={...(ir.view.ioChildren||{}),...drChildren};
    }
    if(!Contracts)throw new DDNError('DDN099','Load ddn-contracts.js before ddn-core.js');ir.diagnostics.push(...Contracts.validate(ir,registry,DDNError));
    ir.diagnostics.push(...Profiles.validate(ir,registry,DDNError));
    return {ir,workspace:ws,viewNode:view};
  }
  /* 0.8 (chapter 53 §53.4): multi-view publication sets. One ordered figure
   * set with shared chrome; order is authorial and stable. Figure references
   * must resolve to views declared in the same workspace (DDN-PB09). Returns
   * the validated sets in declaration order; rendering is the render phase's
   * job (one SVG per figure plus a manifest). */
  function publicationSets(files,entry,registry){
    registry=Profiles.registry(registry);
    const ws=createWorkspace(files,entry,typedKindWords(registry),relationKindWords(registry));
    const sets=[];
    for(const n of ws.symbols.values()){
      if(n.type!=='publication_set')continue;
      if(n.path!==n.id)throw new DDNError('DDN-PB09','publication_set '+n.id+' must be a top-level declaration',n.source,n.start);
      if(SOURCE_VERSIONS.indexOf(n.doc.file.version)<V06)throw new DDNError('DDN-V04','publication_set on '+n.id+' is a 0.8 (0.6-dialect) construct; the minimum source version is ddn "0.6" but '+n.doc.file.source+' declares ddn "'+n.doc.file.version+'"',n.source,n.start);
      for(const k of Object.keys(n.props))if(!['publication','figures'].includes(k))throw new DDNError('DDN-PB09','Unknown publication_set property '+k+'; expected publication and figures',n.source,n.start);
      let pubNode=null;
      if(n.props.publication!==undefined){
        pubNode=ws.resolve(n.props.publication,n);
        if(pubNode.type!=='publication')throw new DDNError('DDN-PB09','publication_set '+n.id+' publication must reference a publication profile; found '+pubNode.type,n.source,n.start);
      }
      const figs=n.props.figures;
      if(!Array.isArray(figs)||!figs.length||figs.length>64)throw new DDNError('DDN-PB09','publication_set '+n.id+' figures must be an array of 1-64 view references; found '+(Array.isArray(figs)?figs.length:'non-array'),n.source,n.start);
      const figures=figs.map(r=>{
        let t;
        try{t=ws.resolve(r,n);}catch(e){if(e.code==='DDN031')throw new DDNError('DDN-PB09','publication_set '+n.id+' figure @'+r.$ref+' does not resolve in this workspace',n.source,r.$offset||n.start);throw e;}
        if(t.type!=='view')throw new DDNError('DDN-PB09','publication_set '+n.id+' figure @'+r.$ref+' is not a view (found '+t.type+')',n.source,r.$offset||n.start);
        return {uid:t.uid,local:t.id,name:t.label||t.id,file:t.doc.file.source};
      });
      sets.push({uid:n.uid,local:n.id,name:n.label||n.id,publication:pubNode?{uid:pubNode.uid,node:pubNode}:null,figures});
    }
    return sets;
  }
  function semanticJSON(ir){function canon(v){if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(canon);const o={};for(const k of Object.keys(v).sort())if(!['source','ref','local'].includes(k))o[k]=canon(v[k]);return o;}const es=new Map(),rs=new Map();function visit(x){x.elements.forEach(n=>es.set(n.id,n));x.relations.forEach(n=>rs.set(n.id,n));for(const c of x.view?.children||[])visit(c.ir);}visit(ir);return {format:ir.format,elements:[...es.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(canon),relations:[...rs.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(canon)};}
  /* B1-088: host-supplied icon packs — validated and sanitized exactly like
   * shipped packs before they can render. */
  /* Host pack registries are shared across bundles through the DDNPacks
   * namespace (first publish wins); never touch the module-local copy. */
  const Packs=ddnNamespace('DDNPacks');
  const registerIconPack=pack=>Packs.registerIconPack(pack,ICONLIBS.libraries);
  const api={VERSION,SOURCE_VERSIONS,DDNError,lex,parse,bundle,createWorkspace,build,children,group,values,getFields,fieldTree,getPorts,clean,quantity,kindEntry,relationEntry,semanticJSON,typedKindWords,relationKindWords,projectionProfileKinds,DEFAULTS,PROPERTIES,CHOICES,normalizeTextProps,LINE_DASH_PATTERNS,profiles:Profiles,viewProfiles:ViewProfiles,extractPublicationChrome,publicationSets,registerIconPack,unregisterIconPack:Packs.unregisterIconPack,hostIconPacks:Packs.hostIconPacks,validateIconPack,iconLibraries:()=>ICONLIBS.libraries.map(l=>({...l,icons:(l.icons||[]).map(i=>({...i}))})),registerArtPack:Packs.registerArtPack,unregisterArtPack:Packs.unregisterArtPack,hostArtPacks:Packs.hostArtPacks,validateArtPack};
  publishNamespace('DDN',api);
  export default api;
