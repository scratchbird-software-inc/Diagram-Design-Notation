/* SPDX-License-Identifier: GPL-2.0-or-later. Bounded local-only DDN file/workspace I/O.
 * ZIP writer uses STORE; reader accepts STORE/DEFLATE and validates CRC32.
 * CRC is corruption detection, not authentication. No archive code is run.
 */
function installIO(api){
'use strict';
const MAX=16_000_000,MAX_TEXT=12_000_000,enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const table=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xEDB88320^(i>>>1):i>>>1;return i>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function cat(parts){const out=new Uint8Array(parts.reduce((n,a)=>n+a.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function header(size){const a=new Uint8Array(size);return[a,new DataView(a.buffer)];}
function zipStore(files){
 const local=[],central=[];let offset=0;
 for(const [name,text]of Object.entries(files)){
  const n=enc.encode(name),b=enc.encode(text),crc=crc32(b);let[h,d]=header(30);d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);d.setUint16(12,33,true);d.setUint32(14,crc,true);d.setUint32(18,b.length,true);d.setUint32(22,b.length,true);d.setUint16(26,n.length,true);local.push(h,n,b);
  let[c,v]=header(46);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,crc,true);v.setUint32(20,b.length,true);v.setUint32(24,b.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);central.push(c,n);offset+=h.length+n.length+b.length;
 }
 const data=cat(local),directory=cat(central);let[e,d]=header(22);d.setUint32(0,0x06054b50,true);d.setUint16(8,Object.keys(files).length,true);d.setUint16(10,Object.keys(files).length,true);d.setUint32(12,directory.length,true);d.setUint32(16,data.length,true);return cat([data,directory,e]);
}
async function inflate(bytes,expected){
 if(typeof DecompressionStream==='undefined')fail('DDN-IO09','This browser cannot read compressed ZIP entries. Extract the archive and use Open folder, or use a workspace JSON file.');
 let stream;try{stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{fail('DDN-IO09','Raw DEFLATE is unavailable. Extract the ZIP and open its DDN files.');}
 const reader=stream.getReader(),chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>expected||total>MAX_TEXT){await reader.cancel();fail('DDN-IO04','Decompression size limit exceeded.');}chunks.push(value);}}finally{reader.releaseLock();}
 if(total!==expected)fail('DDN-IO05','ZIP uncompressed size mismatch.');return cat(chunks);
}
async function unzip(bytes){
 if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);if(bytes.length>MAX)fail('DDN-IO04','Archive exceeds 16 MB.');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(d.getUint32(i,true)===0x06054b50&&i+22+d.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0)fail('DDN-IO05','Invalid ZIP end directory.');
 const count=d.getUint16(end+10,true),dirSize=d.getUint32(end+12,true),start=d.getUint32(end+16,true);
 if(d.getUint16(end+4,true)||d.getUint16(end+6,true)||count!==d.getUint16(end+8,true)||count>1501||start+dirSize>end||count===65535)fail('DDN-IO05','Split, ZIP64, excessive or invalid archives are unsupported.');
 const files=Object.create(null),ignored=[],names=new Set();let pos=start,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>start+dirSize||d.getUint32(pos,true)!==0x02014b50)fail('DDN-IO05','Invalid central directory.');
  const flags=d.getUint16(pos+8,true),method=d.getUint16(pos+10,true),crc=d.getUint32(pos+16,true),compressed=d.getUint32(pos+20,true),size=d.getUint32(pos+24,true),nl=d.getUint16(pos+28,true),extra=d.getUint16(pos+30,true),comment=d.getUint16(pos+32,true),external=d.getUint32(pos+38,true),loc=d.getUint32(pos+42,true);
  if(pos+46+nl+extra+comment>start+dirSize)fail('DDN-IO05','Truncated ZIP filename.');
  const name=dec.decode(bytes.slice(pos+46,pos+46+nl));pos+=46+nl+extra+comment;
  if(flags&1||!['0','8'].includes(String(method)))fail('DDN-IO05','Encrypted or unsupported compressed ZIP entry.');
  if(name.startsWith('/')||/[\\\x00-\x1f]/.test(name)||name.split('/').some(x=>x==='..'||x==='.')||/^[a-z]+:/i.test(name)||((external>>>16)&0xf000)===0xa000)fail('DDN-IO02','Unsafe ZIP path or symbolic link.');
  if(names.has(name))fail('DDN-IO03','Duplicate archive path: '+name);names.add(name);
  total+=size;if(total>MAX_TEXT||size>2_000_000||compressed>MAX||loc+30>start)fail('DDN-IO04','Archive entry or total size limit exceeded.');
  if(d.getUint32(loc,true)!==0x04034b50)fail('DDN-IO05','Invalid local ZIP header.');const ln=d.getUint16(loc+26,true),le=d.getUint16(loc+28,true),from=loc+30+ln+le;
  if(from+compressed>start||dec.decode(bytes.slice(loc+30,loc+30+ln))!==name||d.getUint16(loc+8,true)!==method)fail('DDN-IO05','ZIP local header mismatch.');
  if(name.endsWith('/'))continue;
  if(!name.toLowerCase().endsWith('.ddn')&&!name.endsWith('ddn-workspace.json')){ignored.push(name);continue;}
  const payload=bytes.slice(from,from+compressed),data=method===0?payload:await inflate(payload,size);
  if(data.length!==size||crc32(data)!==crc)fail('DDN-IO05','ZIP CRC or size check failed: '+name);
  files[name]=dec.decode(data);
 }
 if(pos!==start+dirSize)fail('DDN-IO05','Unexpected directory data.');return{files,ignored};
}
function snapshotChecked(s){const mounted=api.fromSnapshot(s);mounted.workspace.destroy();return s;}
function toJSON(snapshot){snapshotChecked(snapshot);return JSON.stringify(snapshot,null,2)+'\n';}
function toZIP(snapshot){snapshotChecked(snapshot);const {files,...metadata}=snapshot;return zipStore({...files,'ddn-workspace.json':JSON.stringify(metadata,null,2)+'\n'});}
async function open(input,{directory=false}={}){
 const list=Array.from(input||[]);if(!list.length)fail('DDN-IO01','Select at least one source file.');if(list.length>1501)fail('DDN-IO04','Too many selected files.');
 let files=Object.create(null),metadata=null,ignored=[];
 if(list.length===1&&list[0].name.toLowerCase().endsWith('.json')){
  if(list[0].size>MAX)fail('DDN-IO04','Workspace JSON exceeds 16 MB.');let s;try{s=JSON.parse(dec.decode(await list[0].arrayBuffer()));}catch{fail('DDN-IO05','Invalid UTF-8 workspace JSON.');}snapshotChecked(s);return{snapshot:s,files:s.files,ignored:[]};
 }
 if(list.length===1&&list[0].name.toLowerCase().endsWith('.zip')){
  if(list[0].size>MAX)fail('DDN-IO04','Archive exceeds 16 MB.');const unpacked=await unzip(new Uint8Array(await list[0].arrayBuffer()));files=unpacked.files;ignored=unpacked.ignored;
 }else{
  let total=0;for(const file of list){let name=directory?(file.webkitRelativePath||file.name):file.name;if(directory&&name.includes('/'))name=name.split('/').slice(1).join('/');if(!name.toLowerCase().endsWith('.ddn')){ignored.push(name);continue;}api.pathChecked(name);if(Object.hasOwn(files,name))fail('DDN-IO03','Two selected files have the same path: '+name);if(file.size>2_000_000||(total+=file.size)>MAX_TEXT)fail('DDN-IO04','Source size limit exceeded.');try{files[name]=dec.decode(await file.arrayBuffer());}catch{fail('DDN-IO05','Source is not valid UTF-8: '+name);}}
 }
 const manifests=Object.keys(files).filter(n=>n.endsWith('ddn-workspace.json'));
 if(manifests.length>1)fail('DDN-IO05','Multiple workspace manifests.');
 if(manifests.length){const name=manifests[0];metadata=JSON.parse(files[name]);delete files[name];const root=name.slice(0,-'ddn-workspace.json'.length);if(root){const next=Object.create(null);for(const [p,v]of Object.entries(files)){if(!p.startsWith(root))fail('DDN-IO02','Sources outside workspace manifest root.');next[p.slice(root.length)]=v;}files=next;}}
 // Archives produced externally may wrap all DDN files in one directory.
 // Without a manifest, retain their paths exactly; import resolution is relative.
 files=api.filesChecked(files);if(!Object.keys(files).length)fail('DDN-IO01','No DDN source files were found.');
 if(metadata){const snapshot={...metadata,files};snapshotChecked(snapshot);return{snapshot,files,ignored};}
 const ws=api.createWorkspace(files),first=ws.entries()[0],snapshot={format:'ddn-workspace@1',runtime:api.runtime,files,entry:first?.file||Object.keys(files)[0],view:first?.views[0]?.id||'',overrides:{}};ws.destroy();return{files,snapshot,ignored};
}
function download(name,data,type='text/plain;charset=utf-8'){
 if(typeof document==='undefined')fail('DDN-IO08','Downloads require a browser document.');
 const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
api.io={open,toJSON,toZIP,unzip,zipStore,crc32,download,bundle:(files,entry)=>api.bundle(api.filesChecked(files),api.pathChecked(entry))};
}
