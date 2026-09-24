"""Build schemas and machine property catalogues from the pinned registry. SPDX-License-Identifier: GPL-2.0-or-later."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
reg=json.loads((root/'standard/registry/catalogue.json').read_text())
profiles=json.loads((root/'standard/registry/profiles/catalogue.json').read_text())
reg['kinds'] += profiles['kinds']
reg['relationships'] += profiles['relationships']
write=lambda name,obj:(root/'standard/schemas'/name.split('/',1)[1]).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
S='https://json-schema.org/draft/2020-12/schema'
# B1-002 (D6): type-check optional per-kind `defaults` against the property
# contracts (standard/registry/data-properties.json). Invalid entries fail the
# schema build. Legality: core properties whose targets cover elements (the
# designer declares every element as `object`), or x_ extensions with an
# element/object target schema. Values must match the declared value shape.
prop_contracts=json.loads((root/'standard/registry/data-properties.json').read_text())['properties']
element_props={p['path']:p['value_shape'] for p in prop_contracts if 'element' in p['targets']}
def shape_ok(value,shape):
    s=shape.lower()
    if 'boolean' in s:return isinstance(value,bool)
    if 'integer' in s:return isinstance(value,int) and not isinstance(value,bool)
    if 'number' in s:return isinstance(value,(int,float)) and not isinstance(value,bool)
    if 'array' in s or s.endswith('[]'):return isinstance(value,list)
    if '/' in s and ' ' not in s:return isinstance(value,str) and value in {x.strip() for x in s.split('/')}
    if 'record' in s or 'object' in s:return isinstance(value,dict)
    return isinstance(value,str)
def check_defaults():
    keywords={k['keyword'] for k in reg['kinds']}
    ext=reg.get('extension_contracts',{})
    problems=[]
    for k in reg['kinds']:
        d=k.get('defaults')
        if d is None:problems.append(k['keyword']+': missing defaults object');continue
        if not isinstance(d,dict):problems.append(k['keyword']+': defaults must be an object');continue
        for key,value in d.items():
            if key.startswith('x_'):
                contract=ext.get(key)
                if not contract or not any(t in contract.get('targets',{}) for t in ('object','element')):
                    problems.append('%s: extension %s has no element target'% (k['keyword'],key))
                continue
            shape=element_props.get(key)
            if shape is None:problems.append('%s: %s is not an element property in the contracts'%(k['keyword'],key));continue
            if key=='kind':
                if value not in keywords:problems.append('%s: kind default is not a registered keyword'%(k['keyword']))
                continue
            if not shape_ok(value,shape):problems.append('%s: default %s=%r does not match shape %r'%(k['keyword'],key,value,shape))
    if problems:raise SystemExit('catalogue defaults invalid:\n'+'\n'.join(problems))
check_defaults()
value={'oneOf':[{'type':['null','boolean','string','number']},{'type':'array','items':{'$ref':'#/$defs/value'}},{'type':'object','required':['$ref'],'properties':{'$ref':{'type':'string','minLength':1}},'additionalProperties':False},{'type':'object','required':['$state'],'properties':{'$state':{'enum':['undecided','not_applicable','conflicting']}},'additionalProperties':False},{'type':'object','required':['$missing'],'properties':{'$missing':{'const':True}},'additionalProperties':False},{'type':'object','required':['$quantity','unit'],'properties':{'$quantity':{'type':'number'},'unit':{'enum':['px','pt','mm','cm','in','ms','s','min','h','d','%']}},'additionalProperties':False},{'type':'object','propertyNames':{'pattern':'^[^$]'},'additionalProperties':{'$ref':'#/$defs/value'}}]}
source={'type':'object','required':['file','start','end'],'properties':{'file':{'type':'string'},'start':{'type':'integer','minimum':0},'end':{'type':'integer','minimum':0},'bodyEnd':{'type':'integer','minimum':0}},'additionalProperties':False}
member={'type':'object','required':['id','name','local','properties'],'properties':{'id':{'type':'string'},'name':{'type':'string'},'local':{'type':'string'},'path':{'type':'string'},'depth':{'type':'integer','minimum':0},'parent':{'type':['string','null']},'properties':{'type':'object','additionalProperties':{'$ref':'#/$defs/value'}},'source':{'$ref':'#/$defs/source'}},'additionalProperties':False}
element={'type':'object','required':['id','ref','local','name','type','kind','kindCode','properties','fields','ports'],'properties':{'id':{'type':'string'},'ref':{'type':'string'},'local':{'type':'string'},'name':{'type':'string'},'type':{'enum':['object','domain','sample','flow','assertion']},'kind':{'enum':[k['keyword'] for k in reg['kinds']]},'kindCode':{'enum':[k['code'] for k in reg['kinds']]},'properties':{'type':'object','additionalProperties':{'$ref':'#/$defs/value'}},'fields':{'type':'array','items':{'$ref':'#/$defs/member'}},'ports':{'type':'array','items':{'$ref':'#/$defs/member'}},'source':{'$ref':'#/$defs/source'}},'additionalProperties':False}
endpoint={'type':'object','required':['element'],'properties':{'element':{'type':'string'},'member':{'type':'string'},'role':{'enum':['field','port']}},'additionalProperties':False}
relation={'type':'object','required':['id','ref','name','kind','kindCode','from','to','properties'],'properties':{'id':{'type':'string'},'ref':{'type':'string'},'name':{'type':'string'},'kind':{'enum':[r['keyword'] for r in reg['relationships']]},'kindCode':{'enum':[r['code'] for r in reg['relationships']]},'from':{'$ref':'#/$defs/endpoint'},'to':{'$ref':'#/$defs/endpoint'},'properties':{'type':'object','additionalProperties':{'$ref':'#/$defs/value'}},'source':{'$ref':'#/$defs/source'}},'additionalProperties':False}
diag={'type':'object','required':['code','severity','message'],'properties':{'code':{'type':'string'},'severity':{'enum':['error','warning','information','info']},'message':{'type':'string'},'source':{'type':'string'},'offset':{'type':'integer'},'line':{'type':'integer'},'column':{'type':'integer'}},'additionalProperties':True}
view={'type':'object','required':['id','name','local','selected','relations','profiles','keys','placements','routes','subdiagrams','frames'],'properties':{'id':{'type':'string'},'name':{'type':'string'},'local':{'type':'string'},'selected':{'type':'array','items':{'type':'string'},'uniqueItems':True},'relations':{'type':'array','items':{'type':'string'},'uniqueItems':True},'profiles':{'type':'object','required':['notation','style','layout','display','publication','legend']},'keys':{'type':'object','additionalProperties':{'type':'integer','minimum':1}},'placements':{'type':'object'},'routes':{'type':'object'},'subdiagrams':{'type':'array'},'frames':{'type':'array'},'flows':{'type':'array','items':{'$ref':'#/$defs/flow'}},'source':{'$ref':'#/$defs/source'}},'additionalProperties':False}
flow={'type':'object','required':['id','local','name','steps','hops'],'properties':{'id':{'type':'string'},'local':{'type':'string'},'name':{'type':'string'},'steps':{'type':'array','minItems':2,'items':{'type':'string'}},'hops':{'type':'array','minItems':1,'items':{'type':'string'}},'properties':{'type':'object','additionalProperties':{'$ref':'#/$defs/value'}},'source':{'$ref':'#/$defs/source'}},'additionalProperties':False}
resolved={'$schema':S,'$id':'urn:ddn:schema:resolved:0.3','title':'DDN reference resolved view interchange 0.3','description':'Structural schema of the distributed reference IR. Cross-record semantics and production profile obligations require additional validation.','type':'object','required':['format','language','registry','entry','view','elements','relations','diagnostics'],'properties':{'format':{'enum':['ddn-resolved@0.3','ddn-resolved@0.4','ddn-resolved@0.5']},'language':{'enum':['0.3','0.4','0.5']},'registry':{'const':'ddn-core@0.3'},'entry':{'type':'string'},'view':{'$ref':'#/$defs/view'},'elements':{'type':'array','items':{'$ref':'#/$defs/element'}},'relations':{'type':'array','items':{'$ref':'#/$defs/relation'}},'diagnostics':{'type':'array','items':{'$ref':'#/$defs/diagnostic'}},'publication':{'type':'object'}},'additionalProperties':False,'$defs':{'value':value,'source':source,'member':member,'element':element,'endpoint':endpoint,'relation':relation,'diagnostic':diag,'view':view,'flow':flow}}
view['properties']['children']={'type':'array','maxItems':12,'items':{'type':'object','required':['slot','ir'],'properties':{'slot':{'type':'string'},'ir':{'$ref':'#'}},'additionalProperties':False}}
write('schema/resolved.schema.json',resolved)
write('schema/value.schema.json',{'$schema':S,'$id':'urn:ddn:schema:value:0.3','$ref':'#/$defs/value','$defs':{'value':value}})
point={'type':'array','prefixItems':[{'type':'number'},{'type':'number'}],'items':False,'minItems':2,'maxItems':2}
scene={'$schema':S,'$id':'urn:ddn:schema:reference-scene:0.3','title':'DDN reference scene geometry','type':'object','required':['width','height','scale','origin','nodes','routes','crossings','frames','subdiagrams'],'properties':{'width':{'type':'number','exclusiveMinimum':0},'height':{'type':'number','exclusiveMinimum':0},'scale':{'type':'number','exclusiveMinimum':0},'origin':point,'nodes':{'type':'array','items':{'type':'object','required':['id','x','y','w','h'],'properties':{'id':{'type':'string'},'x':{'type':'number'},'y':{'type':'number'},'w':{'type':'number','exclusiveMinimum':0},'h':{'type':'number','exclusiveMinimum':0}}}},'routes':{'type':'array','items':{'type':'object','required':['id','points'],'properties':{'id':{'type':'string'},'points':{'type':'array','minItems':2,'items':point},'label':{'type':'object'},'source_side':{'type':'string'},'target_side':{'type':'string'}},'additionalProperties':False}},'crossings':{'type':'array','items':{'type':'object','required':['point','under','over','overHorizontal'],'properties':{'point':point,'under':{'type':'string'},'over':{'type':'string'},'overHorizontal':{'type':'boolean'}},'additionalProperties':False}},'frames':{'type':'array'},'subdiagrams':{'type':'array'},'smallestText':{'type':'number'},'quality':{'type':'object'},'layout':{'type':'object'},'textMeasurement':{'type':'object'},'motion':{'type':'array','items':{'type':'object','required':['relation','kind','duration','rate'],'properties':{'relation':{'type':'string'},'kind':{'enum':['flow','pulse']},'duration':{'type':'number','exclusiveMinimum':0},'rate':{'type':'integer','minimum':1,'maximum':32}},'additionalProperties':False}},'flows':{'type':'array','items':{'type':'object','required':['id','name','duration','hops'],'properties':{'id':{'type':'string'},'name':{'type':'string'},'duration':{'type':'number','exclusiveMinimum':0},'hops':{'type':'array','minItems':1,'items':{'type':'object','required':['relation','start','end'],'properties':{'relation':{'type':'string'},'start':{'type':'number','minimum':0},'end':{'type':'number','exclusiveMinimum':0}},'additionalProperties':False}}},'additionalProperties':False}}},'additionalProperties':False}

segment_schema={'oneOf':[
 {'type':'object','required':['kind','from','to'],'properties':{'kind':{'const':'line'},'from':point,'to':point},'additionalProperties':False},
 {'type':'object','required':['kind','from','c1','c2','to'],'properties':{'kind':{'const':'cubic'},'from':point,'c1':point,'c2':point,'to':point},'additionalProperties':False}
]}
scene['properties']['routes']['items']['properties'].update({'commands':{'type':'array','items':segment_schema},'routing':{'enum':['curved','orthogonal','straight']},'strategy':{'enum':['direct-bezier','corridor-spline','aligned-curve']},'flattenTolerance':{'type':'number','exclusiveMinimum':0},'curveFamily':{'enum':['bezier','rounded']},'curveRadius':{'type':'number','exclusiveMinimum':0},'appliedTension':{'type':'number','exclusiveMinimum':0,'maximum':1}})
scene['properties']['crossings']['items']['properties'].update({'overAngle':{'type':'number'},'underDistance':{'type':'number','minimum':0},'overDistance':{'type':'number','minimum':0},'sine':{'type':'number','minimum':0,'maximum':1.00001}})

box={'type':'object','required':['x','y','w','h'],'properties':{'x':{'type':'number'},'y':{'type':'number'},'w':{'type':'number','minimum':0},'h':{'type':'number','minimum':0}},'additionalProperties':False}
layout_state={'type':'object','required':['format','view','positions'],'properties':{'format':{'const':'ddn-layout-state@1'},'view':{'type':'string','minLength':1},'positions':{'type':'object','maxProperties':500,'additionalProperties':point}},'additionalProperties':False}
scene['properties'].update({'drawingBounds':box,'drawingArea':box,'focus':{'type':'object','required':['world','page'],'properties':{'world':point,'page':point},'additionalProperties':False},'layoutState':layout_state})
write('schema/layout-state.schema.json',{'$schema':S,'$id':'urn:ddn:layout-state:1',**layout_state})
scene['properties']['marks']={'type':'array','items':{'type':'object','required':['id','sourceIds'],'properties':{'id':{'type':'string'},'sourceIds':{'type':'array','items':{'type':'string'}},'property':{'type':'string'}},'additionalProperties':True}}
scene['properties']['projection']={'type':'object','required':['kind','profile'],'properties':{'kind':{'enum':['chen','matrix','table','panels','chart','timeline','fishbone','decision']},'profile':{'type':'string'},'sourceIds':{'type':'array','items':{'type':'string'}},'quantitative':{'type':'boolean'},'mapping':{'type':'array','items':{'type':'object','required':['occurrence','source'],'properties':{'occurrence':{'type':'string'},'source':{'type':'string'}},'additionalProperties':False}}},'additionalProperties':False}
write('schema/scene.schema.json',scene)
extension={'$schema':S,'$id':'urn:ddn:schema:extension:0.3','title':'DDN extension contract','type':'object','required':['id','version','class','definition','parameters','fallback'],'properties':{'id':{'type':'string','pattern':'^[a-z][a-z0-9.-]+:[A-Za-z0-9._-]+$'},'version':{'type':'string'},'class':{'enum':['kind','facet','relation','property','view','profile']},'definition':{'type':'string','minLength':1},'targets':{'type':'array','items':{'type':'string'}},'endpoints':{'type':'object'},'parameters':{'type':'object'},'slot':{'type':'string'},'glyph':{'type':'string'},'label':{'type':'string'},'fallback':{'type':'object','required':['label'],'properties':{'label':{'type':'string'},'shape':{'enum':['card','activity','frame','note','sample','port']}},'additionalProperties':False},'dependencies':{'type':'array','items':{'type':'string'}},'colourModes':{'type':'object'},'security':{'type':'object'}},'additionalProperties':False}
write('schema/extension.schema.json',extension)
manifest={'$schema':S,'$id':'urn:ddn:schema:publication-manifest:0.3','title':'Production publication manifest contract','type':'object','required':['version','language','registry','renderer','entry','view','dependencies','outputs','diagnostics'],'properties':{'version':{'const':'0.3'},'language':{'type':'string'},'registry':{'type':'string'},'renderer':{'type':'string'},'entry':{'type':'string'},'view':{'type':'string'},'semanticHash':{'type':'string'},'renderHash':{'type':'string'},'dependencies':{'type':'array','items':{'type':'object','required':['uri','sha256'],'properties':{'uri':{'type':'string'},'sha256':{'type':'string','pattern':'^[0-9a-f]{64}$'}}}},'resources':{'type':'object'},'outputs':{'type':'array','items':{'type':'object','required':['path','mediaType'],'properties':{'path':{'type':'string'},'mediaType':{'type':'string'},'sha256':{'type':'string'}}}},'diagnostics':{'type':'array','items':diag}},'additionalProperties':False}
write('schema/publication-manifest.schema.json',manifest)

# capabilities.json is maintained directly in standard/registry (B1-034 drive-by:
# the historical tail call to tools/build-capabilities.js named a file that never
# existed; the schema files above are complete before this point).
print('schemas written; capabilities.json lives in standard/registry/capabilities.json')
