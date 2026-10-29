#!/usr/bin/env python3
"""Build one self-contained AI authoring document from the adopted DDN contracts."""
import argparse
import copy
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CODEX = ROOT / 'standard/codex'
OUTPUT = ROOT / 'website/guide/ddn-ai-reference.txt'


def read(name):
    return json.loads((CODEX / (name + '.json')).read_text())


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def build():
    profiles, roles = read('profile-contracts'), read('role-contracts')
    cores, relations = read('core-contracts'), read('relation-contracts')
    original = read('ddn.schema')['$defs']
    # The enormous normalized-document dispatch is represented by the exact
    # profile/role tables below, not repeated for each conditional schema arm.
    shapes = copy.deepcopy(original)
    # Source references are lexical names; file/id objects are normalization ABI.
    shapes['reference'] = {'type': 'string', 'format': 'DDN-reference'}
    for name in ['definition', 'view_definition', 'document', 'workarea']:
        shapes[name].pop('allOf', None)
    for name, fields in {
        'definition': ['id', 'name', 'role', 'category', 'content', 'metadata', 'properties', 'qualifiers', 'endpoints', 'template', 'arguments'],
        'view_definition': ['id', 'name', 'profile', 'kind', 'catalogue', 'defaults', 'role_defaults'],
        'workarea': ['id', 'name', 'placements', 'defaults'],
        'document': ['id', 'name', 'kind', 'format', 'defaults', 'role_defaults', 'targets', 'sections'],
        'appearance': ['id', 'name', 'parent', 'target'],
        'source_record': ['id', 'name', 'mode'],
        'data_record': ['id', 'name'],
        'asset_record': ['id', 'name'],
        'template_record': ['id', 'name', 'role', 'settings', 'fragment'],
        'publication': ['id', 'name', 'defaults'],
        'endpoint': ['definition', 'member', 'appearance', 'pending_name'],
    }.items():
        for field in fields:
            shapes[name]['properties'].pop(field, None)
        shapes[name]['required'] = [f for f in shapes[name].get('required', []) if f not in fields]
    # Projection schemas in the profile table replace this untyped union.
    shapes['view_definition']['properties']['projection']['properties'].pop('options', None)
    shapes['view_definition']['properties']['projection']['properties'].pop('defaults', None)

    keep = {'$ref', 'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const',
            'anyOf', 'oneOf', 'allOf', 'not', 'if', 'then', 'else', 'minimum', 'maximum',
            'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'uniqueItems',
            'minLength', 'maxLength', 'pattern', 'format', 'default', 'minProperties', 'maxProperties'}

    def clean(s):
        if not isinstance(s, dict):
            return s
        unknown = set(s) - keep - {'title', 'description', '$schema', '$id', '$comment', 'examples'}
        unknown = {key for key in unknown if not key.startswith('x-')}
        if unknown:
            raise ValueError('Unsupported schema keyword in AI reference: ' + ','.join(sorted(unknown)))
        return {k: ({p: clean(v) for p, v in value.items()} if k == 'properties' else
                    [clean(v) for v in value] if isinstance(value, list) and k in ['anyOf', 'oneOf', 'allOf'] else
                    clean(value) if isinstance(value, dict) and k not in ['default', 'const'] else value)
                for k, value in s.items() if k in keep}

    shapes = {k: clean(v) for k, v in shapes.items()}
    # Repeated role schemas differ only by names of equivalent referenced types.
    # Iterate to a fixed point so all those aliases share a single definition.
    alias = {name: name for name in shapes}

    def rewrite(value):
        if isinstance(value, list):
            return [rewrite(v) for v in value]
        if not isinstance(value, dict):
            return value
        return {k: '#/$defs/' + alias[v.rsplit('/', 1)[-1]] if k == '$ref' else rewrite(v)
                for k, v in value.items()}

    preferred = {'definition', 'appearance', 'view_definition', 'document', 'workarea', 'publication',
                 'source_record', 'data_record', 'asset_record', 'template_record'}
    for _ in range(30):
        groups = defaultdict(list)
        for name, shape in shapes.items():
            groups[compact(rewrite(shape))].append(name)
        newer = {}
        for names in groups.values():
            first = min(names, key=lambda n: (n not in preferred, len(n), n))
            newer.update((n, first) for n in names)
        if newer == alias:
            break
        alias = newer
    shapes = {alias[n]: rewrite(v) for n, v in shapes.items()}
    needed = set()
    labels = {}

    def type_name(name):
        name = alias[name]
        if name not in labels:
            labels[name] = name.replace('metadata_partial_kind_', 'meta_').replace('metadata_partial_relation_', 'relmeta_').replace('data_properties_kind_', 'props_').replace('data_properties_relation_', 'relprops_').replace('partial_meta_', 'partial_').replace('profile_', 'opts_')
        return labels[name]

    def describe(s):
        if '$ref' in s:
            name = alias[s['$ref'].rsplit('/', 1)[-1]]
            d = shapes[name]
            if set(d) <= {'type'} or (d.get('type') == 'string' and set(d) <= {'type', 'maxLength'} and d.get('maxLength', 0) >= 1000000):
                result = describe(d)
            else:
                needed.add(name)
                result = type_name(name)
        elif 'const' in s:
            result = compact(s['const'])
        elif 'enum' in s:
            if set(s['enum']) == set(profiles):
                result = 'PROFILE-ID'
            elif set(s['enum']) == {k for k, v in roles.items() if v['category'] == 'element'}:
                result = 'ELEMENT-ROLE'
            elif set(s['enum']) == {v['role'] for v in roles.values() if v['category'] == 'relation'}:
                result = 'RELATION-ROLE'
            else:
                result = '|'.join(compact(v) for v in s['enum'])
        elif 'anyOf' in s or 'oneOf' in s:
            key = 'anyOf' if 'anyOf' in s else 'oneOf'
            result = ('oneof(' if key == 'oneOf' else '(') + '|'.join(describe(v) for v in s[key]) + ')'
        elif s.get('type') == 'array':
            result = 'list<' + describe(s.get('items', {})) + '>'
            lo, hi = s.get('minItems', 0), s.get('maxItems')
            if lo or hi is not None:
                result += '(' + str(lo) + '..' + (str(hi) if hi is not None else '*') + ')'
            if s.get('uniqueItems'):
                result += ' unique'
        elif s.get('type') == 'object' or 'properties' in s:
            req = s.get('required', [])
            fields = [k + ('!' if k in req else '') + ':' + describe(v) for k, v in s.get('properties', {}).items()]
            extra = s.get('additionalProperties', True)
            if extra is not False:
                fields.append('*:' + (describe(extra) if isinstance(extra, dict) else 'ANY'))
            result = '{' + ';'.join(fields) + '}'
        else:
            t = s.get('type', 'ANY')
            result = {'string': 'text', 'number': 'num', 'integer': 'int', 'boolean': 'bool'}.get(t, t) if isinstance(t, str) else '(' + '|'.join(t) + ')'
        for key, sign in [('minimum', '>='), ('maximum', '<='), ('exclusiveMinimum', '>'), ('exclusiveMaximum', '<')]:
            if key in s:
                result += sign + str(s[key])
        if 'pattern' in s:
            result += ' regex=' + compact(s['pattern'])
        if 'format' in s:
            result += ' format=' + s['format']
        # Common million-character text limits add no authoring decision; tighter
        # limits remain explicit. Empty strings are legal only when minLength=0.
        if s.get('minLength', 0):
            result += ' len>=' + str(s['minLength'])
        if 'maxLength' in s and s['maxLength'] < 1000000:
            result += ' len<=' + str(s['maxLength'])
        if 'default' in s:
            result += '=' + compact(s['default'])
        for key in ['allOf', 'not', 'if', 'then', 'else', 'minProperties', 'maxProperties']:
            if key in s:
                result += ' ' + key + '=' + compact(predicate(s[key]))
        return result

    def predicate(value):
        if isinstance(value, list):
            return [predicate(v) for v in value]
        if not isinstance(value, dict):
            return value
        result = {}
        for key, item in value.items():
            if key == '$ref':
                name = alias[item.rsplit('/', 1)[-1]]
                needed.add(name)
                result['$type'] = type_name(name)
            else:
                result[key] = predicate(item)
        return result

    def typeref(name):
        return describe({'$ref': '#/$defs/' + name})

    parts = [(ROOT / 'tooling/website/content/ai-authoring.txt').read_text().rstrip()]
    parts.append('PROPERTY TYPES\nReference notation, NOT DDN: {key:Type;...} is a record; list<T> uses item statements. ! marks required fields; others optional. =value is an omission default. | means alternatives; *:T permits custom keys. ANY is arbitrary JSON expressed with DDN item/record syntax; value is a different typed-state record. Unlisted keys are forbidden. BASE+{fields} inherits BASE and overrides listed types; required flags are cumulative. Conditions use JSON Schema predicates with $type naming a type below. PROFILE-ID/ELEMENT-ROLE/RELATION-ROLE mean exactly the registered names in this document. Text limit is 1,000,000 characters unless tighter. References use Name or "file.ddn"::Name, never normalized file/id records. Omit generated IDs and declaration-supplied name/role/mode/format/target/containment. Do not copy reference braces, commas or type labels into DDN.')
    owners = {'element/relation with': 'definition', 'use with': 'appearance', 'view with': 'view_definition', 'workarea with': 'workarea', 'document with': 'document', 'publication with': 'publication', 'data with': 'data_record', 'source with': 'source_record', 'asset with': 'asset_record', 'template with': 'template_record', 'endpoint with': 'endpoint'}
    parts.append('\n'.join(label + ': ' + typeref(name) for label, name in owners.items()))

    # Group repeated role schemas, while preserving exact membership.
    parts.append('ELEMENT ROLES\nUse only roles allowed by the selected profile. Each line: roles = core type; content type; metadata type; properties type. Common element properties also apply. Core/role payloads never acquire invented semantic defaults. Optional metadata remains optional; supplied data must satisfy profile rules. Review adds core content completeness and profile rules, not a requirement to fill every metadata field.')
    role_groups = defaultdict(list)
    for role, entry in roles.items():
        if entry['category'] != 'element':
            continue
        shape = original[entry['schema']]['properties']
        signature = (entry['core'], *(describe(shape[k]) for k in ['content', 'metadata', 'properties']))
        role_groups[signature].append(role)
    for signature, names in role_groups.items():
        parts.append(','.join(names) + ' = ' + ';'.join(signature))
    parts.append('ROLE LABELS\n' + '; '.join(k + '=' + v['contract']['name'] for k, v in roles.items() if v['category'] == 'element' and ('.' not in k or len(k.rsplit('.', 1)[-1]) < 5)))

    endpoint_sets = {}
    def endpoint_set(values):
        values = tuple(sorted(set(values)))
        if len(values) <= 3:
            return ','.join(values)
        if values not in endpoint_sets:
            endpoint_sets[values] = 'S' + str(len(endpoint_sets) + 1)
        return endpoint_sets[values]
    parts.append('RELATION ROLES\nEach line: exact role = meaning; permitted source>target role selectors; self/member 1=yes 0=no; qualifier, metadata and properties types. * permits any role in that profile; prefix.* matches that role namespace. S labels expand in ENDPOINT SETS. Endpoints must also satisfy the profile rules. Use "as ROLE"; these names are not commands.')
    for role, entry in roles.items():
        if entry['category'] != 'relation':
            continue
        contract = entry['contract']
        ep = contract.get('endpoint_contract', {})
        shape = original[entry['schema']]['properties']
        parts.append(entry['role'] + ' = ' + contract.get('meaning', contract.get('name', '')) + ' ' + endpoint_set(ep.get('source', ['*'])) + '>' + endpoint_set(ep.get('target', ['*'])) + ';self=' + str(int(ep.get('allow_self', False))) + ';member=' + str(int(ep.get('member_endpoints', False))) + ';' + ';'.join(describe(shape[k]) for k in ['qualifiers', 'metadata', 'properties']))
    parts.append('ENDPOINT SETS\n' + '\n'.join(label + '=' + ','.join(values) for values, label in endpoint_sets.items()))

    parts.append('CORE TYPES\nGeneric element syntax uses as core::Name, with content fields of the listed type. Structural Workarea/View/Appearance/DataSet/etc. use dedicated declarations when available. Each line: internal ID Name = purpose; payload; completion requirements. Completion requirements also apply to retained roles mapped to that core ID. Required completion fields must be explicit even when a payload schema annotates a default: semantic facts are not injected. Internal EL/RL IDs below are reference labels, never source role names.')
    for key, entry in cores.items():
        parts.append(key + ' ' + entry['name'] + ' = ' + entry['purpose'] + ';' + typeref(entry['payload_schema']) + ';' + typeref(entry['completion_schema']))
    parts.append('core::Port additionally permits metadata:' + typeref('port_metadata') + ';properties:' + typeref('port_properties'))
    parts.append('CORE RELATIONS\nconnect A to B as core::Name; with qualifiers uses the listed type. Sources/targets are core IDs from CORE TYPES; ANY means any. Profile restrictions still apply.')
    for key, entry in relations.items():
        parts.append(entry['name'] + ' = ' + ','.join(entry['source_ids']) + '>' + ','.join(entry['target_ids']) + ';' + typeref(entry['qualifier_schema']) + ';' + entry['qualifiers_and_rules'])

    # Deduplicate exact palettes and constraints across all 152 profiles.
    sets, rules = {}, {}
    def group(values, prefix):
        signature = tuple(sorted(values))
        key = (prefix, signature)
        if key not in sets:
            sets[key] = prefix + str(sum(1 for p, _ in sets if p == prefix) + 1)
        return sets[key]
    def rule(text):
        if text not in rules:
            rules[text] = 'R' + str(len(rules) + 1)
        return rules[text]
    rows = []
    for name, profile in profiles.items():
        inherited_elements = profiles.get(profile.get('external_context_profile'), {})
        inherited_relations = profiles.get(profile.get('external_relation_profile'), {})
        elements = group(set(profile['primary_palette'] + profile['context_roles'] + inherited_elements.get('primary_palette', []) + inherited_elements.get('context_roles', [])), 'E')
        connectors = group(set(profile['relation_roles'] + inherited_relations.get('relation_roles', [])), 'L')
        constraints = ','.join(rule(t) for t in profile['profile_rules'])
        defaults = {path: d['value'] for path, d in profile['defaults'].items() if d.get('kind') == 'literal'}
        rows.append(name + ' ' + profile['projection'] + ' ' + elements + ' ' + connectors + ' ' + typeref(profile['projection_schema']) + (' defaults=' + compact(defaults) if defaults else '') + ' ' + constraints)
    parts.append('PROFILES\nExactly 152 registered profiles. Each row: profile ID, projection family, allowed element set E, allowed relation set L, projection.options type, standard overrides by full owning path, rule IDs R. Defaults outside projection.options are NOT projection options. An exact view ID does not activate a short recipe. Use element/connect statements with exact roles. Do not infer that a chart has its own profile from its mark name. E/L/R are reference labels only.')
    parts.extend(rows)
    def compact_sets(entries):
        output = []
        preceding = []
        for label, values in sorted(entries, key=lambda p: (len(p[1]), p[0])):
            value_set = set(values)
            text = ','.join(values) or '(none)'
            for parent_label, parent in preceding:
                added, removed = sorted(value_set - parent), sorted(parent - value_set)
                candidate = parent_label + (' + ' + ','.join(added) if added else '') + (' - ' + ','.join(removed) if removed else '')
                if len(candidate) < len(text):
                    text = candidate
            output.append(label + '=' + text)
            preceding.append((label, value_set))
        return '\n'.join(output)
    # Replace endpoint inventories using the same set-difference notation.
    endpoint_heading = next(i for i, p in enumerate(parts) if p.startswith('ENDPOINT SETS\n'))
    parts[endpoint_heading] = 'ENDPOINT SETS\n+ adds names; - removes names. These are reference set expressions, never DDN.\n' + compact_sets([(label, values) for values, label in endpoint_sets.items()])
    parts.append('ROLE SETS\n+ adds names; - removes names; recursively expand referenced sets.\n' + compact_sets([(label, values) for (_, values), label in sets.items()]))
    parts.append('PROFILE RULES\n' + '\n'.join(label + ' ' + text for text, label in rules.items()))
    rules_file = ROOT / 'tooling/website/content/ai-projection-rules.txt'
    if rules_file.exists():
        parts.append(rules_file.read_text().rstrip())
    rendered = {}
    while needed - rendered.keys():
        for name in sorted(needed - rendered.keys()):
            rendered[name] = describe(shapes[name])
    # Structural differences are much smaller than repeated complete records.
    # Only use a strictly smaller predecessor, making expansion acyclic.
    objects = sorted((n for n in rendered if shapes[n].get('type') == 'object' and 'properties' in shapes[n] and set(shapes[n]) <= {'type', 'properties', 'required', 'additionalProperties', 'default'}), key=lambda n: (len(shapes[n]['properties']), n))
    for index, name in enumerate(objects):
        shape = shapes[name]
        for base in objects[:index]:
            parent = shapes[base]
            if parent.get('additionalProperties', True) != shape.get('additionalProperties', True) or parent.get('default') != shape.get('default'):
                continue
            if not set(parent['properties']) <= set(shape['properties']) or not set(parent.get('required', [])) <= set(shape.get('required', [])):
                continue
            added = {k: v for k, v in shape['properties'].items() if k not in parent['properties'] or v != parent['properties'][k]}
            required = set(shape.get('required', [])) - set(parent.get('required', []))
            # An added mandatory flag must be visible even if its type is unchanged.
            added.update((k, shape['properties'][k]) for k in required)
            delta = {'type': 'object', 'properties': added, 'required': list(required), 'additionalProperties': False}
            candidate = type_name(base) + '+' + describe(delta)
            if len(candidate) + 12 < len(rendered[name]):
                rendered[name] = candidate
    parts.append('TYPE DEFINITIONS\n' + '\n'.join(type_name(name) + '=' + text for name, text in sorted(rendered.items(), key=lambda p: type_name(p[0]))))
    parts.append('END DDN AUTHORING REFERENCE. Generate source from the user request using only the grammar, roles, values and constraints above. Omit unspecified settings. Do not claim verifier success unless it was actually run.')
    return '\n'.join(parts) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text = build()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != text:
            raise SystemExit('DDN AI reference is stale; run tooling/website/build-ai-reference.py')
    else:
        OUTPUT.write_text(text)
    print(f'DDN AI reference: {len(text.encode()):,} bytes, {len(text.splitlines()):,} lines; 152 profiles.')
