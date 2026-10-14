#!/usr/bin/env python3
"""Build transparent, multi-resolution Windows ICO files from family SVGs.

Inkscape rasterizes each resolution independently. PNG-backed ICO frames keep
the alpha channel and avoid a Python imaging-library build dependency.
"""
import argparse
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SIZES = (16, 24, 32, 48, 64, 128, 256)
NAMES = ('ddn', 'scratchweaver', 'scratchbird', 'scratchrobin', 'opensource')
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)


def square_svg(source):
    root = ET.parse(source).getroot()
    x, y, width, height = map(float, root.attrib['viewBox'].split())
    side = max(width, height) * 1.06
    root.set('viewBox', f'{x + (width - side) / 2:.6f} '
                        f'{y + (height - side) / 2:.6f} '
                        f'{side:.6f} {side:.6f}')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def build_icon(source, dest):
    with tempfile.TemporaryDirectory(prefix='ddn-ico-') as directory:
        work = Path(directory)
        square = work / 'square.svg'
        square.write_bytes(square_svg(source))
        frames = []
        for size in SIZES:
            png = work / f'{size}.png'
            subprocess.run(['inkscape', str(square), f'--export-width={size}',
                            f'--export-height={size}',
                            f'--export-filename={png}'],
                           check=True, capture_output=True)
            data = png.read_bytes()
            if data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack_from('>II', data, 16) != (size, size):
                raise ValueError(f'Inkscape did not render a {size}px square: {source}')
            frames.append(data)
    header = struct.pack('<HHH', 0, 1, len(frames))
    offset = len(header) + len(frames) * 16
    entries = []
    for size, data in zip(SIZES, frames):
        entries.append(struct.pack('<BBBBHHII', size % 256, size % 256,
                                   0, 0, 1, 32, len(data), offset))
        offset += len(data)
    dest.write_bytes(header + b''.join(entries) + b''.join(frames))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / 'assets/brand')
    parser.add_argument('--out-dir', type=Path)
    parser.add_argument('--favicon', choices=NAMES, default='ddn')
    args = parser.parse_args()
    source_dir = args.source_dir.resolve()
    out_dir = (args.out_dir or source_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        for suffix in ('', '-dark'):
            build_icon(source_dir / f'{name}{suffix}.svg',
                       out_dir / f'{name}{suffix}.ico')
    shutil.copyfile(out_dir / f'{args.favicon}.ico', out_dir / 'favicon.ico')
    print(f'build-ico: 11 files, {len(SIZES)} resolutions each -> {out_dir}')


if __name__ == '__main__':
    main()
