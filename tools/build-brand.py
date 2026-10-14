#!/usr/bin/env python3
"""Extract family marks from the owner SVG, with exact blue/white dark variants.

The Inkscape page contains transformed groups. Its query bounds and the layer
transform must both be retained; a viewBox over raw path coordinates is blank.
"""
import copy
import os
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('DDN_BRAND_OUT', ROOT / 'assets/brand'))
SOURCE = Path(os.environ.get('DDN_BRAND_SOURCE',
                             '/home/dcalford/Sandbox/ScratchBirdLogos.svg'))
WEAVER_PNG = Path(os.environ.get('DDN_WEAVER_PNG',
                                 '/home/dcalford/Sandbox/ScratchWeaver.png'))
SVG = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'
SODI = 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd'
ET.register_namespace('', SVG)

MARKS = {
    'ddn': 'The Diagram Designer Project',
    'scratchweaver': 'ScratchWeaverLogo',
    'scratchbird': 'ScratchBirdLogo',
    'scratchrobin': 'ScratchRobinLogo',
    'opensource': 'ScratchBirdOpenSource Logo',
}
BLUE = '#0c75bd'
SWAP = {'#0c75bd': '#ffffff', '#0d75b3': '#ffffff',
        '#ffffff': BLUE, '#000000': BLUE}


def main():
    if not SOURCE.is_file() or not WEAVER_PNG.is_file():
        raise FileNotFoundError('Owner brand source is missing')
    doc = ET.parse(SOURCE).getroot()
    layer = next(e for e in doc if e.get(f'{{{INK}}}label') == 'Image')
    groups = {e.get(f'{{{INK}}}label'): e for e in layer
              if e.tag == f'{{{SVG}}}g' and e.get(f'{{{INK}}}label')}
    query = subprocess.run(['inkscape', str(SOURCE), '--query-all'],
                           check=True, capture_output=True, text=True).stdout
    bounds = {}
    for line in query.splitlines():
        parts = line.split(',')
        if len(parts) == 5:
            bounds[parts[0]] = tuple(float(v) for v in parts[1:])
    OUT.mkdir(parents=True, exist_ok=True)

    def clean(element, inverse):
        for e in element.iter():
            for key in list(e.attrib):
                if key.startswith((f'{{{INK}}}', f'{{{SODI}}}')):
                    del e.attrib[key]
                elif inverse:
                    e.attrib[key] = re.sub(
                        r'#[0-9a-fA-F]{6}',
                        lambda m: SWAP.get(m.group(0).lower(), m.group(0)),
                        e.attrib[key])
        return element

    def render(label, inverse):
        group = groups[label]
        x, y, width, height = bounds[group.get('id')]
        pad = 2
        view_box = ' '.join(f'{v:.3f}' for v in
                            (x - pad, y - pad, width + 2 * pad, height + 2 * pad))
        svg = ET.Element(f'{{{SVG}}}svg', {'viewBox': view_box})
        defs = doc.find(f'{{{SVG}}}defs')
        if defs is not None:
            svg.append(clean(copy.deepcopy(defs), inverse))
        wrapper = ET.SubElement(svg, f'{{{SVG}}}g',
                                {'transform': layer.get('transform', '')})
        wrapper.append(clean(copy.deepcopy(group), inverse))
        ET.indent(svg)
        return ET.tostring(svg, encoding='utf-8', xml_declaration=True) + b'\n'

    for name, label in MARKS.items():
        (OUT / f'{name}.svg').write_bytes(render(label, False))
        (OUT / f'{name}-dark.svg').write_bytes(render(label, True))
    (OUT / 'favicon.svg').write_bytes((OUT / 'ddn.svg').read_bytes())
    shutil.copyfile(WEAVER_PNG, OUT / 'scratchweaver.png')
    for name, size in (('ddn.png', 512), ('favicon-32.png', 32),
                       ('favicon-64.png', 64)):
        subprocess.run(['inkscape', str(OUT / 'ddn.svg'),
                        f'--export-width={size}', f'--export-height={size}',
                        f'--export-filename={OUT / name}'], check=True,
                       capture_output=True)
    print(f'build-brand: {len(MARKS) * 2 + 5} family assets → {OUT}')


if __name__ == '__main__':
    main()
