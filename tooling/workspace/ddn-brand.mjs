import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './context.mjs';
const logo=readFileSync(join(root,'project/ddn/assets/brand/ddn.svg'),'utf8');
const invert=svg=>svg.replace(/#ffffff|#0c75bd|#000000/g,color=>color==='#0c75bd'?'#ffffff':'#0c75bd');
if(invert(logo)!==readFileSync(join(root,'project/ddn/assets/brand/ddn-dark.svg'),'utf8'))throw Error('Brand palettes diverged; review the shared SVG encoding before regenerating.');
const text='// Generated from the maintained DDN brand SVGs by tooling/workspace/ddn-brand.mjs.\n'+
 'const logo='+JSON.stringify(logo)+';\n'+
 'const dataURL=(svg:string):string=>"data:image/svg+xml;base64,"+btoa(Array.from(new TextEncoder().encode(svg),byte=>String.fromCharCode(byte)).join(""));\n'+
 'export const ddnLogoDataURL=dataURL(logo);\n'+
 'export const ddnLogoDarkDataURL=dataURL(logo.replace(/#ffffff|#0c75bd|#000000/g,color=>color==="#0c75bd"?"#ffffff":"#0c75bd"));\n';
const destination=join(root,'project/ddn/packages/standalone/src/brand.ts');
if(process.argv.includes('--write'))writeFileSync(destination,text);
else if(readFileSync(destination,'utf8')!==text)throw Error('DDN brand module is stale; run ddn-brand.mjs --write.');
