import{readFileSync,writeFileSync}from'node:fs';
import{join,dirname,resolve,relative}from'node:path';
import{root}from'../workspace/context.mjs';
const site=join(root,'website'),catalogue=JSON.parse(readFileSync(join(site,'gallery/catalogue.json'))),geo=readFileSync(join(site,'assets/geo/world-110m.json'),'utf8');
for(const entry of catalogue.corpus){const text=readFileSync(join(site,entry.entry),'utf8'),initial={sources:{entry:entry.entry,files:[{id:entry.entry,text,revision:'1',encoding:'utf-8',writable:true}]},assets:Object.fromEntries([...text.matchAll(/^asset .* from (.+)$/gm)].map(m=>{const full=resolve(site,dirname(entry.entry),JSON.parse(m[1]));if(!full.startsWith(site+'/'))throw Error('Asset escapes website');const path=relative(site,full);return[path,{text:readFileSync(full,'utf8'),mime:path.endsWith('.svg')?'image/svg+xml':'application/geo+json'}];}))};writeFileSync(join(site,entry.entry+'.js'),'window.DDN_SITE_INITIAL='+JSON.stringify(initial).replace(/</g,'\\u003c')+';\n');}
writeFileSync(join(site,'assets/catalogue.js'),'window.DDN_WEBSITE_CATALOGUE='+JSON.stringify(catalogue).replace(/</g,'\\u003c')+';\n');
console.log('Refreshed '+catalogue.corpus.length+' offline source payloads.');
