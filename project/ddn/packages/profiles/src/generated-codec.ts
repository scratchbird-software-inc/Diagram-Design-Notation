/** Expand generated declarative tables; no source code is interpreted. */
export function decodeWire(encoded: unknown[]): unknown {
 const pool=encoded[1] as unknown[];
 function unpack(value:unknown):unknown {
  if(Array.isArray(value))return value.map(unpack);
  if(value!==null&&typeof value==='object') {
   const row=value as Record<string,unknown>;
   if(typeof row.$==='number'){const index=row.$;const result=unpack(pool[index]);pool[index]=result;return result;}
   for(const key of Object.keys(row))row[key]=unpack(row[key]);
  }
  return value;
 }
 return unpack(encoded[0]);
}
export function decodeCatalogue(encoded: unknown[]): Record<string,unknown> {
const data=decodeWire(encoded) as Record<string,unknown>&{nodes:unknown[]};
const [owners,properties,order]=data.properties as [string[],[string,number,unknown,number,string|null][],[number,number][]];
data.properties=order.map(([owner,index])=>{const [path,schema,defaults,flags,cssName]=properties[index]!;return {owner:owners[owner],path,schema,default:defaults,css:!!(flags&1),settable:!!(flags&2),defaultable:!!(flags&4),...(cssName?{cssName}:{})};});
const [bases,roleRows]=data.roles as [Record<string,Record<string,unknown>>,[string,string,number,Record<string,unknown>][]];
data.roles=Object.fromEntries(roleRows.map(([key,core,schema,diff])=>{const category=key.startsWith('relation::')?'relation':'element';return [key,{role:category==='relation'?key.slice(10):key,category,core,schema,render:{...bases[category],...diff}}];}));
const indices=new Map<object,number>();
for(let i=0;i<data.nodes.length;i++){const value=data.nodes[i];if(value&&typeof value==='object')indices.set(value,i);}
const pending=data.nodes.slice();
function add(value:unknown):number {if(typeof value==='number')return value;if(value&&typeof value==='object'){const known=indices.get(value);if(known!==undefined)return known;}const index=data.nodes.length;data.nodes.push(value);pending.push(value);if(value&&typeof value==='object')indices.set(value,index);return index;}
for(let i=0;i<pending.length;i++){const value=pending[i];if(!value||typeof value!=='object')continue;const node=value as Record<string,unknown>;if(Array.isArray(node.$case)){const [tag,match,then]=node.$case as [number,string,unknown];const key=tag===3?'profile':tag===4?'format':'role';const properties:Record<string,unknown>={[key]:{const:match}};if(tag===0||tag===1)properties.category={const:tag===0?'element':'relation'};node.if={properties,...(tag===4?{}:{required:tag===1?['role','category']:[key]})};node.then=then;delete node.$case;}if(node.properties){const props=node.properties as Record<string,unknown>;for(const key of Object.keys(props))props[key]=add(props[key]);}for(const key of ['allOf','anyOf','oneOf'])if(Array.isArray(node[key]))node[key]=(node[key] as unknown[]).map(add);for(const key of ['items','not','if','then','else'])if(node[key]!==undefined)node[key]=add(node[key]);if(node.additionalProperties!==undefined&&typeof node.additionalProperties!=='boolean')node.additionalProperties=add(node.additionalProperties);}
return data;
}
