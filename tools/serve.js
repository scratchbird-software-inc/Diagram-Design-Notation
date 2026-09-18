/* SPDX-License-Identifier: GPL-2.0-or-later. Local, read-only static publication server. */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(path.resolve(__dirname,'..'));
const port=Number(process.env.PORT||8080);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.ddn':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.ebnf':'text/plain; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Read only');}
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.includes('\0'))throw Error('Invalid path');
 let file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)&&file!==root)throw Error('Outside root');
 if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');file=fs.realpathSync(file);
 if(!file.startsWith(root+path.sep))throw Error('Outside root');
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
 if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`DDN local website: http://127.0.0.1:${port}/ (Ctrl+C to stop)`));
