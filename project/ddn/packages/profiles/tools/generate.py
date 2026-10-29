"""Compile the adopted codex to deduplicated validation instructions and runtime data."""
from pathlib import Path
import json,hashlib,sys
CHECK='--check' in sys.argv
OUTPUTS={}
def emit(path,text):
 OUTPUTS[path]=text
 if not CHECK:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
ROOT=Path(__file__).resolve().parents[5]
SOURCE=ROOT/'standard/codex'
TARGET=ROOT/'project/ddn/packages/profiles/src/generated.ts'
def read(name):return json.loads((SOURCE/name).read_text())
schema=read('ddn.schema.json')
native=['ddn@1','mindmap.basic@1','concept.map@1','table.records@1']
# The shared schema retains every adopted profile branch. Pack installation
# controls semantic capability; schema availability never implies installed rules.
nodes=[];intern={}
scalar={'type','enum','const','required','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','pattern','format','minItems','maxItems','uniqueItems','minProperties','maxProperties'}
children={'allOf','anyOf','oneOf'}
single={'items','additionalProperties','not','if','then','else'}
def compile(node):
 if isinstance(node,bool): result=node
 else:
  result={}
  for k,v in node.items():
   if k in scalar:result[k]=v
   elif k=='$ref':
    assert v.startswith('#/$defs/'),v
    result['ref']=v[8:]
   elif k=='properties':result['properties']={a:compile(b) for a,b in v.items()}
   elif k in children:result[k]=[compile(x) for x in v]
   elif k in single:result[k]=v if isinstance(v,bool) else compile(v)
 key=json.dumps(result,sort_keys=True,separators=(',',':'))
 if key in intern:return intern[key]
 n=len(nodes);nodes.append(result);intern[key]=n;return n
roots={k:compile(v) for k,v in schema['$defs'].items()}
props=[]
property_entries=read('property-codex.json')['properties']
for p in property_entries:
 if p['owner'].startswith(('role:','retained:')):continue
 props.append({'owner':p['owner'],'path':p['path'],'schema':compile(p['schema']), 'default':p['default'],'css':p['css'],'settable':p.get('settable',True),'defaultable':p.get('defaultable',False),**({'cssName':p['css_name']} if p.get('css_name') else {})})
roles={}
for name,entry in read('role-contracts.json').items():
 contract=entry.get('contract',{})
 roles[name]={k:entry[k] for k in ['role','category','core','schema'] if k in entry}
 roles[name]['render']=entry.get('render_defaults',contract)
roles={k:{**v,'render':{p['path'][7:]:p['default']['value'] for p in property_entries if p['owner']=='role:'+k and p['path'].startswith('render.') and p['default'].get('kind')=='literal'}} for k,v in roles.items()}
native=['ddn@1','mindmap.basic@1','concept.map@1','table.records@1']
profiles={}
known_profiles={}
for name,entry in read('profile-contracts.json').items():
 known_profiles[name]={'id':name,'method':entry['method'],'projection':entry['projection']}
 profiles[name]={k:entry[k] for k in ['id','method','projection','primary_palette','context_roles','relation_roles','relation_endpoint_contracts','defaults','standard_overrides','inherits','projection_schema','bounded_analysis','metadata_editor_fields','designer_commands']}
 profiles[name].update({k:entry[k] for k in ['external_context_profile','external_relation_profile'] if k in entry})
 profiles[name]['relation_endpoint_contracts']=[{k:e[k] for k in ['role','source_roles','target_roles','member_endpoints','self_allowed','canonical_pattern','canonical_direction']} for e in entry['relation_endpoint_contracts']]
 profiles[name]['scope']=entry['scope']
 profiles[name]['exclusions']=entry.get('baseline_declared_exclusions',[])
 profiles[name]['rules']=entry['profile_rules']
core={k:{'payload':v['payload_schema'],'complete':v['completion_schema'],'render':v['render_defaults']} for k,v in read('core-contracts.json').items()}
core_types={'core::'+v['name']:{'category':'element','schema':v['payload_schema'],'core':k} for k,v in read('core-contracts.json').items()}
for key,value in read('relation-contracts.json').items():
 core_types['core::'+value['name']]={'category':'relation','schema':value.get('payload_schema','qualifiers_'+key),'core':key}
lexical_roots={'port_metadata','port_properties','column','default_rule','declaration_map','inclusion','notes_list','text','number','integer','boolean','bool','date','timestamp','json_value','base_font_size','font_size'}
# Native and complete editions select their executable registrations separately.
native=['ddn@1','mindmap.basic@1','concept.map@1','table.records@1']
data={'nodes':nodes,'roots':roots,'properties':props,'roles':roles,'profiles':profiles,'knownProfiles':known_profiles,'core':core,'coreTypes':core_types,'nativeProfiles':native,'cssMap':read('css-map.json'),'version':'ddn-next-1','sourceHashes':{n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in ['ddn.schema.json','property-codex.json','role-contracts.json','profile-contracts.json','core-contracts.json','relation-contracts.json','css-map.json']}}
# Retain externally addressable owner/core/role schemas; prune orphan instructions.
keep={'bundle','file','reference','instant','acceptance_entry','data_record','source_record','asset_record','template_record'}
keep|={p['owner'] for p in props};keep|={r['schema'] for r in roles.values()}
keep|={v[k] for v in core.values() for k in ['payload','complete']}
keep|={v['projection_schema'] for v in profiles.values()}
keep|=lexical_roots|{v['schema'] for v in core_types.values()}|{k for k in roots if k.startswith('meta_')}
selected_roots={k:v for k,v in roots.items() if k in keep}
reachable=set()
def visit(i):
 if i in reachable:return
 reachable.add(i);n=nodes[i]
 if not isinstance(n,dict):return
 if 'ref' in n:visit(roots[n['ref']])
 for j in n.get('properties',{}).values():visit(j)
 for key in children:
  for j in n.get(key,[]):visit(j)
 for key in single:
  if type(n.get(key)) is int:visit(n[key])
for i in selected_roots.values():visit(i)
for p in props:visit(p['schema'])
remap={old:new for new,old in enumerate(sorted(reachable))}
compact=[]
for old in sorted(reachable):
 n=nodes[old]
 if isinstance(n,dict):
  n=dict(n)
  if 'ref' in n:n['ref']=remap[roots[n['ref']]]
  if 'properties' in n:n['properties']={k:remap[j] for k,j in n['properties'].items()}
  for key in children:
   if key in n:n[key]=[remap[j] for j in n[key]]
  for key in single:
   if type(n.get(key)) is int:n[key]=remap[n[key]]
 compact.append(n)
for p in props:p['schema']=remap[p['schema']]
data['nodes']=compact;data['roots']={k:remap[v] for k,v in selected_roots.items()}
# Inline schema children while retaining numeric references. This preserves every
# condition but removes high-entropy child offsets from the shipped data.
top=set(data['roots'].values())|{p['schema'] for p in props}|{n['ref'] for n in compact if isinstance(n,dict) and 'ref' in n}
order=sorted(top);top_ids={old:i for i,old in enumerate(order)}
def inline(i):
 n=compact[i]
 if not isinstance(n,dict):return n
 n=dict(n)
 if 'ref' in n:n['ref']=top_ids[n['ref']]
 if 'properties' in n:n['properties']={k:inline(v) for k,v in n['properties'].items()}
 for key in children:
  if key in n:n[key]=[inline(v) for v in n[key]]
 for key in single:
  if type(n.get(key)) is int:n[key]=inline(n[key])
 return n
data['nodes']=[inline(i) for i in order];data['roots']={k:top_ids[v] for k,v in data['roots'].items()}
for p in props:p['schema']=top_ids[p['schema']];p['default'].pop('rule',None)
for r in roles.values():r['schema']=data['roots'][r['schema']]
for c in core.values():
 for key in ['payload','complete']:c[key]=data['roots'][c[key]]
for value in core_types.values():value['schema']=data['roots'][value['schema']]
for p in profiles.values():
 # Keep rule prose and bounded-scope evidence for inspection and editor help.
 # Derived default rules remain available to descriptor-driven consumers.
 pass
keep={'bundle','file','reference','instant','acceptance_entry','data_record','source_record','asset_record','template_record'}|{p['owner'] for p in props}|{p['projection_schema'] for p in profiles.values()}
keep|=lexical_roots|{k for k in roots if k.startswith('meta_')}
data['roots']={k:v for k,v in data['roots'].items() if k in keep}
# Lossless wire tables: keep the exact public property order, but store repeated
# owner-independent descriptors once. Render bases retain every glyph/default.
from copy import deepcopy
original_data=deepcopy(data)
owners=list(dict.fromkeys(p['owner'] for p in props));property_rows=[];property_ids={};property_order=[]
for p in props:
 key=json.dumps({k:v for k,v in p.items() if k!='owner'},separators=(',',':'))
 if key not in property_ids:
  property_ids[key]=len(property_rows)
  property_rows.append([p['path'],p['schema'],p['default'],int(p['css'])+2*int(p['settable'])+4*int(p['defaultable']),p.get('cssName')])
 property_order.append([owners.index(p['owner']),property_ids[key]])
data['properties']=[owners,property_rows,property_order]
from collections import Counter
bases={}
for category in ['element','relation']:
 values=[r['render'] for r in roles.values() if r['category']==category]
 keys=set.intersection(*[set(v) for v in values]);base={}
 for key in sorted(keys):
  counts=Counter(json.dumps(v[key],separators=(',',':')) for v in values);value,count=counts.most_common(1)[0]
  if count>=5:base[key]=json.loads(value)
 bases[category]=base
data['roles']=[bases,[[key,r['core'],r['schema'],{k:v for k,v in r['render'].items() if k not in bases[r['category']] or bases[r['category']][k]!=v}] for key,r in roles.items()]]
# Common role/profile discriminators use a compact wire form, expanded before
# the unchanged schema interpreter sees them. Their order remains unchanged.
case_shapes=[(['role','category'],['role'],'element'),(['role','category'],['role','category'],'relation'),(['role'],['role'],None),(['profile'],['profile'],None),(['format'],[],None)]
for node in data['nodes']:
 if not isinstance(node,dict):continue
 for index,branch in enumerate(node.get('allOf',[])):
  if not isinstance(branch,dict) or set(branch)!={'if','then'}:continue
  condition=branch['if'];fields=condition.get('properties',{})
  if set(condition)-{'properties','required'} or not all(isinstance(v,dict) and set(v)=={'const'} for v in fields.values()):continue
  for tag,(keys,required,category) in enumerate(case_shapes):
   if list(fields)==keys and condition.get('required',[])==required and (category is None or fields['category']['const']==category):
    node['allOf'][index]={'$case':[tag,fields[keys[0]]['const'],branch['then']]};break
# Check the wire representation against the original compile result at build time.
restored=deepcopy(data)
restored['properties']=[{'owner':owners[owner],'path':property_rows[row][0],'schema':property_rows[row][1],'default':property_rows[row][2],'css':bool(property_rows[row][3]&1),'settable':bool(property_rows[row][3]&2),'defaultable':bool(property_rows[row][3]&4),**({'cssName':property_rows[row][4]} if property_rows[row][4] else {})} for owner,row in property_order]
restored['roles']={key:{'role':key[10:] if key.startswith('relation::') else key,'category':'relation' if key.startswith('relation::') else 'element','core':core,'schema':schema,'render':dict(bases['relation' if key.startswith('relation::') else 'element'],**diff)} for key,core,schema,diff in restored['roles'][1]}
for node in restored['nodes']:
 if not isinstance(node,dict):continue
 for index,branch in enumerate(node.get('allOf',[])):
  if not isinstance(branch,dict) or '$case' not in branch:continue
  tag,value,then=branch['$case'];keys,required,category=case_shapes[tag]
  condition={'properties':{keys[0]:{'const':value}}}
  if category:condition['properties']['category']={'const':category}
  if required:condition['required']=required
  node['allOf'][index]={'if':condition,'then':then}
assert restored==original_data,'Native wire compression changed contract data'
# Independent wire tables let the native utility retain exact shared schemas
# without downloading descriptors and default tables for every optional family.
def wire(value):
 counts=Counter()
 def count(v):
  if isinstance(v,(list,dict)):
   counts[json.dumps(v,separators=(',',':'))]+=1
   for c in (v.values() if isinstance(v,dict) else v):count(c)
 count(value);pool=[];ids={}
 def pack(v):
  if isinstance(v,(list,dict)):
   key=json.dumps(v,separators=(',',':'))
   if len(key)>=80 and counts[key]>1:
    if key in ids:return {'$':ids[key]}
    i=len(pool);ids[key]=i;pool.append(None)
    pool[i]={k:pack(c) for k,c in v.items()} if isinstance(v,dict) else [pack(c) for c in v]
    return {'$':i}
   return {k:pack(c) for k,c in v.items()} if isinstance(v,dict) else [pack(c) for c in v]
  return v
 return [pack(value),pool]
def json_text(value):return json.dumps(value,separators=(',',':'),ensure_ascii=False)
def compact_wire(value):
 # Preserve the original wire tree, including reference identities and ordering.
 # Repeated string values and object key sequences get independent dictionaries.
 counts=Counter()
 def count(v):
  if isinstance(v,str):counts[v]+=1
  elif isinstance(v,(list,dict)):
   for c in (v.values() if isinstance(v,dict) else v):count(c)
 count(value)
 strings=sorted((s for s,n in counts.items() if n>1),key=lambda s:(-counts[s],s))
 string_ids={s:-i-1 for i,s in enumerate(strings)};shapes=[];shape_ids={}
 def pack(v):
  if isinstance(v,str):return string_ids.get(v,v)
  if type(v) in (int,float) and v<0:return [None,v]
  if isinstance(v,list):return [0,*map(pack,v)]
  if isinstance(v,dict):
   key=tuple(v)
   if key not in shape_ids:shape_ids[key]=len(shapes)+1;shapes.append(list(key))
   return [shape_ids[key],*map(pack,v.values())]
  return v
 packed=pack(value)
 def restore(v):
  if type(v) in (int,float) and v<0:return strings[-v-1]
  if isinstance(v,list):
   if v[0] is None:return v[1]
   if v[0]==0:return list(map(restore,v[1:]))
   return {key:restore(child) for key,child in zip(shapes[v[0]-1],v[1:])}
  return v
 assert json_text(restore(packed))==json_text(value),'Compact wire changed catalogue values or order'
 return [shapes,strings,packed,'compact-1']
def encoded(value,compact=False):
 packed=wire(value)
 if compact:packed=compact_wire(packed)
 return 'JSON.parse('+json.dumps(json_text(packed),ensure_ascii=False)+')'
def family_for(profile):
 if profile['id'] in native:return 'native'
 projection=profile['projection']
 if projection=='chart':return 'charts'
 if projection=='geo':return 'geography'
 if projection in ['graph','chen','sequence','timing','fishbone']:return 'graphs'
 assert projection in ['matrix','panels','table','timeline','decision'],projection
 return 'surfaces'
families={name:{} for name in ['native','graphs','charts','geography','surfaces']}
for name,profile in profiles.items():families[family_for(profile)][name]=profile
assert len({key for family in families.values() for key in family})==153
assert {key:value for family in families.values() for key,value in family.items()}==profiles
manifests={name:{'id':name,'version':'1.0.0','contract':data['version'],'codexHash':data['sourceHashes']['ddn.schema.json'],'hash':hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest(),'profiles':list(value)} for name,value in families.items()}
header='// Generated from the adopted codex; run profiles/tools/generate.py.\n'
manifest_text=header+"import type { CatalogueFamilyManifest } from './catalogue-store.js';\n"+'export const catalogueFamilies: Readonly<Record<string,CatalogueFamilyManifest>> = '+json_text(manifests)+';\n'
manifest_text+="for(const family of Object.values(catalogueFamilies)){Object.freeze(family.profiles);Object.freeze(family);}Object.freeze(catalogueFamilies);\n"
manifest_text+="const familyByProfile = new Map(Object.values(catalogueFamilies).flatMap(family => family.profiles.map(profile => [profile,family.id] as const)));\nexport function profileCatalogueFamily(profile: string): string | undefined { return familyByProfile.get(profile); }\n"
emit(TARGET.with_name('generated-families.ts'),manifest_text)
# Fine capability packs retain the original descriptor data exactly.
def shard_for(profile):
 parent=family_for(profile);name=profile['id'].split('@')[0]
 if parent=='graphs':
  if name.startswith(('uml.','requirements.')):part='uml'
  elif name.startswith(('sysml.','soaml.','uaf.')):part='systems'
  elif name.startswith(('chen.','chebotko.','erd.','orm.')):part='erd'
  elif name.startswith(('flow.','dfd.','epc.','epk.','petri.','idef0.','sdl.','cmmn.','bpmn.')):part='process'
  elif name.startswith(('c4.','archimate.','architecture.','network.','iso.','icons.')):part='architecture'
  else:part='specialist'
 elif parent=='charts':
  if name in ['chart.histogram','chart.density','chart.qq','chart.quantiledot','chart.dotplot','chart.boxplot','chart.violin','chart.beeswarm','chart.topk']:part='statistics'
  elif name in ['chart.treemap','chart.tidytree','chart.radialtree','chart.circlepack','chart.sunburst','chart.packedbubble']:part='hierarchy'
  elif name in ['chart.sankey','chart.parallelcoords','chart.arc','chart.force','chart.edgebundle']:part='relationships'
  elif name in ['chart.heatmap','chart.densityheatmap','chart.calendar','chart.wordcloud']:part='density-calendar'
  else:part='standard'
 elif parent=='surfaces':part='matrices' if name.startswith('matrix.') else 'panels' if name.startswith('panels.') else 'canvases' if name.startswith('canvas.') else 'timeline' if name.startswith('timeline.') else 'decisions'
 elif parent=='geography':part=name.split('.')[-1]
 else:return 'native'
 return parent+'-'+part
shards={}
for name,profile in profiles.items():
 key=shard_for(profile)
 if key!='native':shards.setdefault(key,{})[name]=profile
assert sum(map(len,shards.values()))==149
assert {key:value for group in shards.values() for key,value in group.items()}=={key:value for key,value in profiles.items() if key not in native}
shard_manifests={name:{'id':name,'parent':family_for(next(iter(value.values()))),'version':'1.0.0','contract':data['version'],'codexHash':data['sourceHashes']['ddn.schema.json'],'hash':hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest(),'profiles':list(value)} for name,value in shards.items()}
shard_text=header+"import type { CatalogueFamilyManifest } from './catalogue-store.js';\n"+'export const catalogueShards:Readonly<Record<string,CatalogueFamilyManifest & {readonly parent:string}>>='+json_text(shard_manifests)+';\n'
shard_text+="for(const value of Object.values(catalogueShards)){Object.freeze(value.profiles);Object.freeze(value);}Object.freeze(catalogueShards);\nconst owner=new Map(Object.values(catalogueShards).flatMap(group=>group.profiles.map(profile=>[profile,group.id] as const)));\nexport function profileCatalogueShard(profile:string):string|undefined{return owner.get(profile); }\n"
emit(TARGET.with_name('generated-shards.ts'),shard_text)
emit(TARGET.with_name('generated-shards.json'),json.dumps(shard_manifests,indent=2,ensure_ascii=False)+'\n')
for parent in ['graphs','charts','geography','surfaces']:
 names=[name for name,meta in shard_manifests.items() if meta['parent']==parent]
 imports=''.join("import './"+name+".js';\n" for name in names)
 emit(TARGET.parent/'shards'/('all-'+parent+'.ts'),header+imports)
 emit(ROOT/'project/ddn/packages/standalone/src/shards'/('all-'+parent+'.ts'),header+imports)
native_data={**data,'profiles':families['native']}
native_expression='decodeCatalogue('+encoded(native_data,compact=True)+')'
native_hash=hashlib.sha256(native_expression.encode()).hexdigest()
emit(TARGET.with_name('generated-native-data.ts'),header+"import {decodeCatalogue} from './generated-codec.js';\nexport const nativeSchemaHash="+json_text(native_hash)+';\nexport const nativeCatalogue='+native_expression+';\n')
index={key:deepcopy(original_data[key]) for key in ['version','nativeProfiles','knownProfiles','sourceHashes','coreTypes']}
index['roles']={key:{field:value[field] for field in ['role','category','core','schema']} for key,value in original_data['roles'].items()}
index['profiles']={}
for name in native:
 profile=profiles[name];fields=['id','method','inherits','projection','primary_palette','context_roles','relation_roles','projection_schema','scope','exclusions']
 row={key:deepcopy(profile[key]) for key in fields if key in profile}
 context=profiles.get(profile.get('external_context_profile'),{})
 relations=profiles.get(profile.get('external_relation_profile'),{})
 row['context_roles']=list(dict.fromkeys(row['context_roles']+context.get('primary_palette',[])+context.get('context_roles',[])))
 row['context_roles']=[role for role in row['context_roles'] if role not in row['primary_palette']]
 row['relation_roles']=list(dict.fromkeys(row['relation_roles']+relations.get('relation_roles',[])))
 index['profiles'][name]=row
emit(TARGET.with_name('generated-native-index.ts'),header+'export const nativeSchemaHash='+json_text(native_hash)+';\nexport const nativeIndex:Record<string,unknown>='+json_text(index)+';\n')
for light in [False,True]:
 text=header+("import {nativeIndex,nativeSchemaHash} from './generated-native-index.js';\n" if light else "import {nativeCatalogue} from './generated-native-data.js';\n")
 text+="import {createCatalogue} from './catalogue-store.js';\nimport {catalogueFamilies} from './generated-families.js';\nimport {catalogueShards} from './generated-shards.js';\n"
 text+='const catalogue=createCatalogue('+('nativeIndex' if light else 'nativeCatalogue')+',{...catalogueFamilies,...catalogueShards}'+(',nativeSchemaHash' if light else '')+');\n'
 text+='export const compiledCodex:unknown=catalogue.compiledCodex;\nexport const installCatalogueFamily=catalogue.installCatalogueFamily;\nexport const installedCatalogueFamilies=catalogue.installedCatalogueFamilies;\nexport const installNativeCatalogue=catalogue.installCore;\n'
 emit(TARGET.with_name('generated-native-light.ts' if light else 'generated-native.ts'),text)
for name,value in shards.items():
 payload={**{key:value for key,value in shard_manifests[name].items() if key!='parent'},'profiles':value}
 text=header+"import {decodeWire} from '../generated-codec.js';\nimport type {CatalogueFamily} from '../catalogue-store.js';\nexport const catalogueFamily=decodeWire("+encoded(payload)+") as CatalogueFamily;\n"
 emit(TARGET.parent/'shards'/('data-'+name+'.ts'),text)
 parent=shard_manifests[name]['parent']
 emit(TARGET.parent/'shards'/(name+'.ts'),header+"import {catalogueFamily} from './data-"+name+".js';\nimport {installCatalogueFamily} from '../generated-native.js';\nimport {registerProfileFamily} from '../family-packs.js';\nimport {completeProfileDiagnostics} from '../semantic.js';\ninstallCatalogueFamily(catalogueFamily);\nregisterProfileFamily("+json_text(name)+",Object.keys(catalogueFamily.profiles),completeProfileDiagnostics);\n")
 presentation='graphs' if parent=='graphs' else parent
 emit(ROOT/'project/ddn/packages/standalone/src/shards'/(name+'.ts'),header+"import {installPresentationFamily} from '../../../presentation/src/adapters.js';\nimport {"+presentation+"Presentation as family} from '../../../presentation/src/family-"+parent+".js';\ninstallPresentationFamily({...family,id:"+json_text(name)+",profiles:"+json_text(list(value))+"});\n")
full=header+"import { installCatalogueFamily } from './generated-native.js';\n"
for name,value in families.items():
 if name=='native':continue
 payload={**manifests[name],'profiles':value}
 text=header+"import { decodeWire } from './generated-codec.js';\nimport type { CatalogueFamily } from './catalogue-store.js';\n"+'export const catalogueFamily=decodeWire('+encoded(payload)+') as CatalogueFamily;\n'
 emit(TARGET.with_name('generated-family-'+name+'.ts'),text)
 full+="import { catalogueFamily as "+name+" } from './generated-family-"+name+".js';\n"
for name in families:
 if name!='native':full+='installCatalogueFamily('+name+');\n'
full+="export { compiledCodex, installCatalogueFamily, installedCatalogueFamilies } from './generated-native.js';\n"
emit(TARGET,full)
import gzip
sizes={path.name:{'bytes':len(path.read_bytes()),'gzip_bytes':len(gzip.compress(path.read_bytes()))} for path in [TARGET.with_name('generated-native.ts'),TARGET.with_name('generated-families.ts'),*[TARGET.with_name('generated-family-'+name+'.ts') for name in families if name!='native']]}
print(json.dumps({'schema_nodes':len(compact),'schema_roots':len(selected_roots),'properties':len(props),'families':{k:len(v) for k,v in families.items()},'files':sizes}))

if CHECK:
 differences=[str(path.relative_to(ROOT)) for path,text in OUTPUTS.items() if not path.is_file() or path.read_text()!=text]
 print(json.dumps({'mode':'check','generatedFiles':len(OUTPUTS),'shards':len(shards),'differences':differences}))
 if differences:raise SystemExit(1)
