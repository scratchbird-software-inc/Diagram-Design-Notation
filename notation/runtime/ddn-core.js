/* SPDX-License-Identifier: GPL-2.0-or-later
 * DDN reference decoder, 0.6.0-beta.1. No runtime dependencies.
 * This is an executable core demonstrator, NOT a complete conformance implementation.
 */
import {publishNamespace} from './ddn-module-registry.js';
import Contracts from './ddn-contracts.js';
import Profiles from './ddn-profiles.js';
import RegistryCatalogue from './assets/catalogue.js';
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
      const refs=[];
      if(peek().type==='['){take();if(peek().type===']')fail('DDN-E017','use: needs at least one preset or fragment reference',peek(),source);
        for(;;){if(peek().type!=='@')fail('DDN010','Expected a @preset reference in the use: list',peek(),source);refs.push(ref());if(peek().type!==',')break;take();}expect(']');}
      else refs.push(ref());
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
    // (RFC-117); the legacy position — right after the FIRST header — is also
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
  // RFC-117 D4: merge a workspace (entry + transitive imports) into one
  // self-contained multi-module file. Section bodies are the original source
  // lines minus the header lines (version/module/import) — comments and
  // formatting preserved, no re-serialization. Deterministic: same workspace
  // → identical bytes. Inter-bundled import lines are dropped; references
  // written through those aliases (@alias.path) are canonicalized to
  // module-qualified sibling references (@moduleId.path) — token-precise, so
  // strings and comments are untouched — because a dropped alias no longer
  // resolves once the sections are siblings (see RFC-117 decision record).
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
        // A file registers ALL its module sections (RFC-117 D2). Module records
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
      const noNested=x=>{for(const c of x.children){if(c.type==='$use')throw new DDNError('DDN-E017','A definition body cannot apply presets or fragments (use: is legal at application sites only)',x.source,c.start);noNested(c);}};
      noNested(n);
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
    function expandUse(n,rec){
      const kept=[],propSources=[];
      for(const c of n.children){
        if(c.type==='$use'){
          const ctx=n.group&&(n.type==='fields'||n.type==='ports')?'members'
            :!n.group&&n.type==='data'?'fragment'
            :!n.group&&['object','domain','sample','flow','assertion','relation'].includes(n.type)?'props'
            :null;
          if(!ctx)throw new DDNError('DDN-E017','use: is legal only inside a data block (fragments), a fields/ports group (member groups), or an element/relation/flow body (property presets)',n.source,c.start);
          for(const r of c.refs){
            const def=resolvePreset(r,rec),origin={file:def.source,start:def.start,end:def.end,type:def.type,id:def.id};
            if(ctx==='members'){if(def.type!==n.type)throw new DDNError('DDN-E017','@'+r.$ref+' is a '+def.type+' definition; a '+n.type+' group applies a '+n.type+' definition',n.source,c.start);
              for(const m of def.children)kept.push(cloneNode(m,origin));}
            else if(ctx==='fragment'){if(def.type!=='fragment')throw new DDNError('DDN-E017','@'+r.$ref+' is a '+def.type+' definition; a data block applies a fragment definition',n.source,c.start);
              for(const m of def.children)kept.push(cloneNode(m,origin));}
            else{if(def.type==='relation_props'){if(n.type!=='relation')throw new DDNError('DDN-E017','relation_props @'+r.$ref+' applies to relation declarations only',n.source,c.start);}
              else if(def.type!=='preset')throw new DDNError('DDN-E017','@'+r.$ref+' is a '+def.type+' definition; property position applies a preset or relation_props definition',n.source,c.start);
              propSources.push({def,at:c.start});}
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
      for(const {def,at} of propSources)for(const k of Object.keys(def.props)){
        if(k==='version')continue;
        if(localKeys.has(k))continue;
        const v=def.props[k],got=seen.get(k);
        if(got&&JSON.stringify(got.value)!==JSON.stringify(v))throw new DDNError('DDN-E017','Presets @'+got.id+' and @'+def.id+' conflict on property '+k+'; declare '+k+': … locally to resolve the conflict',n.source,at);
        if(!got){seen.set(k,{value:v,id:def.id});n.props[k]=v;}
      }
    }
    for(const d of modules.values())for(const n of d.declarations)if(!PRESET_DEFS.has(n.type))expandUse(n,d);
    function index(n,d,parent=''){
      n.doc=d;n.path=parent?(parent+'.'+n.id):n.id;n.uid=n.props.uid||`${d.module}::${n.path}`;
      if(PRESET_DEFS.has(n.type)&&!n.group)return; // pre-indexed template
      if(!n.group&&!['place','route'].includes(n.type)){let key=d.module+'::'+n.path;if(symbols.has(key))throw new DDNError('DDN024','Duplicate declaration '+n.path,d.source,n.start);symbols.set(key,n);}
      for(const c of n.children)index(c,d,n.group?parent:n.path);
    }
    for(const d of modules.values())for(const n of d.declarations){if(!['data','format','view',...PRESET_DEFS].includes(n.type))throw new DDNError('DDN025','Top-level declaration must be data, format, view, or a reuse definition (fields, ports, relation_props, preset, fragment)',d.source,n.start);index(n,d);}
    const uidMap=new Map();for(const n of symbols.values()){if(uidMap.has(n.uid))throw new DDNError('DDN026','Duplicate stable uid '+n.uid,n.source,n.start);uidMap.set(n.uid,n);}
    function resolve(r,context){if(!r||!r.$ref)throw new DDNError('DDN030','Expected a reference',context?.source,context?.start);const parts=r.$ref.split('.');let doc=context.doc;
      if(doc.imported.has(parts[0])){const f=doc.imported.get(parts.shift());for(const rec of f.moduleRecords){let node=symbols.get(rec.module+'::'+parts.join('.'));if(node)return node;}}
      else{
        // Sibling sections are visible via module-qualified ids; module ids
        // may themselves be dotted, so match the LONGEST module-id prefix.
        for(let k=parts.length-1;k>=1;k--){
          const sib=doc.file.moduleById.get(parts.slice(0,k).join('.'));
          if(sib){const node=symbols.get(sib.module+'::'+parts.slice(k).join('.'));if(node)return node;}
        }
        let base=context.path.split('.');base.pop();for(let k=base.length;k>=0;k--){let path=[...base.slice(0,k),...parts].join('.'),n=symbols.get(doc.module+'::'+path);if(n)return n;}}
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
    layout:{algorithm:'auto',auto_place:true,center:'content',grid_step:{$quantity:32,unit:'px'},optimize:'crossings',endpoint_ordering:'optimize',frame_overflow:'expand',direction:'right',routing:'orthogonal',curve:'bezier',curve_tension:.5,curve_radius:{$quantity:32,unit:'px'},crossings:'gap',gap:{$quantity:100,unit:'px'},row_gap:{$quantity:100,unit:'px'},columns:3,object_clearance:{$quantity:16,unit:'px'},edge_clearance:{$quantity:12,unit:'px'},port_clearance:{$quantity:28,unit:'px'},route_policy:'repair',quality:'error',root:null,group_by:'none'},
    display:{fields:'names',kind:'icon_token',maturity:'token',badges:'tokens',relations:'between_selected',samples:'show',domains:'hide',datatypes:'hide',depth:32},
    publication:{size:'figure',width:{$quantity:1280,unit:'px'},height:{$quantity:800,unit:'px'},margin:{$quantity:32,unit:'px'},fit:'contain',minimum_text:{$quantity:8,unit:'pt'},overflow:'error'},
    legend:{mode:'text',placement:'right',width:{$quantity:310,unit:'px'},keys:{}},
    validation:{mode:'logical',unknown_extensions:'warn'},
    export:{mode:'full',elements:[],fields:null,properties:[],include_samples:false,identifier_mode:'opaque',title:'Published data view',format:'json'},
  };
  const CHOICES={projection:{kind:['graph','chen','matrix','panels','table','chart','timeline','fishbone','decision','sequence','timing','geo']},style:{look:['classic','handDrawn','neo'],theme:['default','neutral','dark','night','forest','base'],font:['sans','serif','mono','handwriting']},layout:{algorithm:['auto','grid','manual','layered','tree','mindmap','grouped','fit_grid','circular','radial','spanning_tree','organic'],center:['pins','content'],optimize:['crossings','none'],endpoint_ordering:['optimize','preserve'],frame_overflow:['expand','confine'],direction:['right','down','left','up'],routing:['orthogonal','straight','curved'],curve:['bezier','rounded'],crossings:['gap','bridge','square_bridge']},display:{fields:['names','none'],kind:['text','icon_token','icon','none'],maturity:['token','none'],badges:['tokens','none'],relations:['between_selected','none'],samples:['show','hide'],domains:['show','hide'],datatypes:['show','hide']},legend:{mode:['numbers','text','tokens'],placement:['right','bottom','none']},publication:{size:['figure','content','a4','letter'],fit:['contain','none','reflow'],overflow:['error','warn']},validation:{mode:['sketch','logical','strict'],unknown_extensions:['warn','error']},export:{mode:['full','redacted'],identifier_mode:['opaque','preserve'],format:['json','sql']}};
  const PROPERTIES={
    projection:['kind','profile','write_data','rows','columns','relation','value','duplicates','panels','records','mark','x','y','x_type','size','unit','aggregate','start','end','label','dependencies','width','height','filter','order','missing','inner_radius','values','effect','encoding','series','series_missing','arrangement','transform','layers','bins','normalize','outside','whiskers','quartiles','step','baseline','target','open','high','low','close','bin_count','k','others','error','trend','inputs','outputs','hit_policy','coverage','analysis_budget','traces','geography','method','graticule','iso','depth'],
    notation:['registry'],style:['look','theme','font','font_size','seed','roughness','hachure'],
    layout:['algorithm','auto_place','center','grid_step','optimize','endpoint_ordering','frame_overflow','direction','routing','curve','curve_tension','curve_radius','crossings','gap','columns','port_clearance','object_clearance','edge_clearance','junctions','shared_segments','row_gap','route_policy','quality','root','hierarchy','group_by'],
    display:['fields','kind','maturity','badges','relations','samples','datatypes','domains','depth'],
    publication:['size','width','height','margin','orientation','fit','minimum_text','overflow','title','caption','embedding_scale','metrics'],
    legend:['mode','placement','width','keys','keyset','scope'],
    validation:['mode','unknown_extensions'],
    export:['mode','elements','fields','properties','include_samples','identifier_mode','title','format'],
    bundle:['projection','notation','style','layout','display','publication','legend','validation','export','spacing'],
    view:['projection','data','format','notation','style','layout','display','publication','legend','select','exclude','description','uid','validation','export','spacing'],
    place:['at','size'],route:['via','source_side','target_side','callout','policy','source_fraction','target_fraction','routing','curve','curve_tension','curve_radius'],
    subdiagram:['view','mode','at','size','label','binding','uid'],
    frame:['scope','members','at','size','label','dimension'],
    junction:['at','relations','network'],
    keyset:['keys','scope'],
    flow:['label','steps','marker','marker_color','marker_size','speed','rate','uid'],
  };
  function validateKnown(n,allowed){for(const key of Object.keys(n.props))if(!allowed.includes(key)&&!key.startsWith('x_'))throw new DDNError('DDN033',`Unknown ${n.type} property ${key}`,n.source,n.start);}
  function build(files,entry,viewName,registry,stack=[]){
    registry=Profiles.registry(registry);
    const ws=createWorkspace(files,entry,typedKindWords(registry),relationKindWords(registry));const all=[...ws.symbols.values()];const view=all.find(n=>n.type==='view'&&((viewName&&(n.id===viewName||n.path===viewName||n.uid===viewName))||(!viewName&&n.doc===ws.main)));
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
    if(p.legend.mode==='numbers'&&p.legend.placement==='none')throw new DDNError('DDN047','Numbered relationships require a legend',view.source,view.start);
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
    const diagnostics=[...motionDiagnostics];if([...ws.docs.values()].some(d=>d.version==='0.2'))diagnostics.push({code:'DDN-W012',severity:'warning',message:'0.2 source accepted through compatibility reader. Migrate headers and review new semantic/routing diagnostics.'});
    const currentLanguage=[...ws.docs.values()].some(d=>d.version==='0.5')?'0.5':[...ws.docs.values()].some(d=>d.version==='0.4')?'0.4':'0.3';
    const ir={format:'ddn-resolved@'+currentLanguage,language:currentLanguage,registry:'ddn-core@0.3',entry,view:{id:view.uid,name:view.label||view.id,local:view.id,selected,relations:visibleRelations.map(r=>r.id),profiles:p,keys,placements,routes,subdiagrams,frames,flows,source:{file:view.source,start:view.start,end:view.end,bodyEnd:view.bodyEnd}},elements,relations,diagnostics};
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
  const api={VERSION,SOURCE_VERSIONS,DDNError,lex,parse,bundle,createWorkspace,build,children,group,values,getFields,fieldTree,getPorts,clean,quantity,kindEntry,relationEntry,semanticJSON,typedKindWords,relationKindWords,projectionProfileKinds,DEFAULTS,PROPERTIES,CHOICES,profiles:Profiles};
  publishNamespace('DDN',api);
  export default api;
