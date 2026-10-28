import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './context.mjs';
const exports=[['ddnLogoDataURL','ddn.svg'],['ddnLogoDarkDataURL','ddn-dark.svg']];
const text='// Generated from the maintained DDN brand SVGs by tooling/workspace/ddn-brand.mjs.\n'+exports.map(([name,file])=>`export const ${name} = ${JSON.stringify('data:image/svg+xml;base64,'+readFileSync(join(root,'project/ddn/assets/brand',file)).toString('base64'))};`).join('\n')+'\n';
const destination=join(root,'project/ddn/packages/standalone/src/brand.ts');
if(process.argv.includes('--write'))writeFileSync(destination,text);
else if(readFileSync(destination,'utf8')!==text)throw Error('DDN brand module is stale; run ddn-brand.mjs --write.');
