/* SPDX-License-Identifier: GPL-2.0-or-later. B1-009 D3: permanent parse gate for documentation snippets.
 *
 * Extraction and skip rules (fixed here, per the B1-009 item):
 *  - Sources scanned: root README.md and every standard/specification/*.md file.
 *  - A block counts only when its fence is tagged exactly ```ddn; fences with any
 *    other (or no) language tag are ignored — except ```ddn-0.8 fences in the
 *    0.8 chapters whose core-language features the runtime now implements
 *    (51/52/53/54/55/57), which are parse-checked with a ddn "0.6" wrapper.
 *  - SKIP rule: a block whose first non-empty line contains the ellipsis mark `…`
 *    is an intentionally elided fragment and is skipped (reported as skipped).
 *  - A block whose first non-empty line starts with `ddn "` is a full source and is
 *    parse-checked verbatim with the runtime parser (DDN.parse).
 *  - Any other block is a declaration fragment: it is parse-checked inside a
 *    synthetic wrapper. Fragments opening with a top-level `data`/`format`/`view`
 *    declaration are wrapped in just the synthetic header
 *    (`ddn "0.5"; module "tests.doc-snippet";`); all remaining fragments are
 *    group-body content and are additionally enclosed in `data __snippet { … }`.
 *    The DDN grammar admits any declaration inside a group body, so the wrapper
 *    checks the snippet's own grammar without inventing semantics.
 *  - Every failure prints file:line (the line of the block's opening fence + 1,
 *    i.e. the first content line) plus the parser's coded error.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const DDN=require('../runtime/ddn-core.js').default;
const root=path.resolve(__dirname,'..','..');
const results=[];function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false});console.error('FAIL',name,e.stack);}}

const sources=['README.md',...fs.readdirSync(path.join(root,'standard/specification')).filter(f=>f.endsWith('.md')).sort().map(f=>'standard/specification/'+f)];
/* 0.8 chapters whose core-language constructs the runtime implements (chapters
 * 51–55, plus chapter 57 whose single fence is ordinary 0.6 core syntax):
 * their ```ddn-0.8 fences parse under a ddn "0.6" wrapper. Chapters 56 and 58
 * carry no ```ddn-0.8 fences. */
const V08_SOURCES=new Set(['standard/specification/51-version-and-compatibility.md','standard/specification/52-view-profiles.md','standard/specification/53-publication-chrome.md','standard/specification/54-text-fit.md','standard/specification/55-markings-and-metadata.md','standard/specification/57-viewer-and-designer-contract.md']);

function extract(file){
  const lines=fs.readFileSync(path.join(root,file),'utf8').split('\n');
  const blocks=[];
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^```(ddn|ddn-0\.8)\s*$/);
    if(!m||(m[1]==='ddn-0.8'&&!V08_SOURCES.has(file)))continue;
    const fence=i;let j=i+1;
    while(j<lines.length&&!/^```\s*$/.test(lines[j]))j++;
    if(j>=lines.length)throw new Error(file+':'+(fence+1)+' unterminated ```ddn fence');
    blocks.push({file,line:fence+2,text:lines.slice(fence+1,j).join('\n'),v08:m[1]==='ddn-0.8'});
    i=j;
  }
  return blocks;
}

const HEADER='ddn "0.5"; module "tests.doc-snippet";\n';
const HEADER08='ddn "0.6"; module "tests.doc-snippet";\n';
function sourceFor(block){
  const header=block.v08?HEADER08:HEADER;
  const first=(block.text.split('\n').find(l=>l.trim().length)||'').trim();
  if(/^ddn\s+"/.test(first)){if(!/^module\s+"/m.test(block.text))return block.text+'\nmodule "tests.doc-snippet";\n';return block.text;}
  if(/^(data|format|view)\s/.test(first))return header+block.text+'\n';
  return header+'data __snippet {\n'+block.text+'\n}\n';
}

let full=0,frag=0,skipped=0;
const blocks=[];
for(const f of sources)for(const b of extract(f)){
  const first=(b.text.split('\n').find(l=>l.trim().length)||'').trim();
  if(first.includes('…')){skipped++;continue;}
  blocks.push(b);
  if(/^ddn\s+"/.test(first))full++;else frag++;
}

test('snippet corpus found (README.md + standard/specification/*.md)',()=>{
  if(blocks.length<20)throw new Error('only '+blocks.length+' checkable blocks found; extractor or corpus regressed');
});

for(const b of blocks){
  test(`snippet parses ${b.file}:${b.line}`,()=>{
    try{DDN.parse(sourceFor(b),b.file+':'+b.line);}
    catch(e){throw new Error(`${b.file}:${b.line}: ${e.code||'DDN-?'} ${e.message}`);}
  });
}

test('full-source snippets keep a supported language version',()=>{
  for(const b of blocks){
    const first=(b.text.split('\n').find(l=>l.trim().length)||'').trim();
    if(!/^ddn\s+"/.test(first))continue;
    const v=DDN.parse(sourceFor(b),b.file+':'+b.line).version;
    if(!DDN.SOURCE_VERSIONS.includes(v))throw new Error(b.file+':'+b.line+' unsupported version '+v);
  }
});

const passed=results.filter(r=>r.pass).length;
console.log(`Doc snippets ${passed}/${results.length} (full sources: ${full}, fragments: ${frag}, skipped elided: ${skipped})`);
if(passed!==results.length)process.exitCode=1;
