/** Use only shipped, integrity-checked fonts when regenerating gallery geometry. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {root,environment,outputPath} from '../workspace/context.mjs';

export function galleryFontEnvironment() {
 const env=environment(),assets=join(root,'project/ddn/assets/fonts');
 const manifest=JSON.parse(readFileSync(join(assets,'manifest.json'),'utf8'));
 const hashes={};
 for(const family of manifest.families)for(const face of family.files){
  const hash=createHash('sha256').update(readFileSync(join(assets,face.path))).digest('hex');
  if(hash!==face.sha256)throw Error('Gallery font integrity mismatch: '+face.path);
  hashes[face.path]=hash;
 }
 const fallback=join(root,'project/tests/ddn/fixtures/fonts');
 const fallbackHash=createHash('sha256').update(readFileSync(join(fallback,'DejaVuSans.ttf'))).digest('hex');
 if(fallbackHash!=='ae7b7855e115a5966d8b1b3f80f254ccc117ec86f9965e202ee2940453837280')throw Error('Gallery fallback font integrity mismatch');
 const config=outputPath(join(env.DDN_BUILD_WORKAREA,'config/gallery-fonts.conf'));
 const cache=outputPath(join(env.DDN_BUILD_WORKAREA,'cache/gallery-fontconfig'));
 mkdirSync(dirname(config),{recursive:true});mkdirSync(cache,{recursive:true});
 const xml=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const aliases={
  'DejaVu Sans':['system-ui'],
  'Inter Variable':['sans-serif','sans','Arial','Helvetica','Inter'],
  'Source Serif 4 Variable':['serif','Times','Times New Roman','Georgia','Source Serif 4'],
  'JetBrains Mono':['monospace','Courier','Courier New'],
  Caveat:['cursive'],
 };
 // No system include: host-installed fonts must never change generated widths.
 writeFileSync(config,'<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n'+
  [assets,fallback].map(path=>'<dir>'+xml(path)+'</dir>').join('\n')+'\n<cachedir>'+xml(cache)+'</cachedir>\n'+
  Object.entries(aliases).flatMap(([family,names])=>names.map(name=>'<alias binding="strong"><family>'+xml(name)+'</family><prefer><family>'+xml(family)+'</family></prefer></alias>')).join('\n')+
  '\n<match target="pattern"><edit name="family" mode="append_last" binding="weak"><string>DejaVu Sans</string></edit></match>\n</fontconfig>\n');
 const result={...env,FONTCONFIG_FILE:config,FONTCONFIG_PATH:dirname(config)};
 const resolved={};
 for(const [family,file] of [['system-ui',join(fallback,'DejaVuSans.ttf')],['sans-serif',join(assets,'inter/Inter-Variable.woff2')],['serif',join(assets,'source-serif/SourceSerif4-Variable.woff2')],['monospace',join(assets,'jetbrains-mono/JetBrainsMono-Variable.woff2')]]){
  const found=execFileSync('fc-match',['-f','%{file}',family],{env:result,encoding:'utf8'}).trim();
  if(found!==file)throw Error('Uncontrolled gallery font resolution: '+family+' -> '+found);
  resolved[family]=relative(root,file);
 }
 const report=outputPath(join(env.DDN_BUILD_WORKAREA,'reports/ddn-website/gallery-fonts.json'));
 mkdirSync(dirname(report),{recursive:true});
 writeFileSync(report,JSON.stringify({fontManifest:relative(root,join(assets,'manifest.json')),hashes,fallback:{file:relative(root,join(fallback,'DejaVuSans.ttf')),sha256:fallbackHash},resolved},null,2)+'\n');
 return result;
}
