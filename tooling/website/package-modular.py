"""Package exactly the selected modular release; never include stale build chunks."""
from pathlib import Path
import json
import sys
import zipfile

source, destination = map(Path, sys.argv[1:3])
manifest = json.loads((source / 'manifest.json').read_text())
files = ['manifest.json', 'ddn-loader.js', 'viewer.html', 'designer.html', 'verifier.html',
         'LICENSE', 'NOTICE.md', 'ddn-fonts.js', 'ddn-fonts-manifest.json', 'ddn-fonts-LICENSES.txt']
files += [chunk['file'] for chunk in manifest['chunks']]
with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in sorted(set(files)):
        path = source / name
        if not path.resolve().is_relative_to(source.resolve()):
            raise ValueError('Modular resource escapes the distribution')
        entry = zipfile.ZipInfo('ddn-modular/' + name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes(), compresslevel=9)
