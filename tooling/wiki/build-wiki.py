#!/usr/bin/env python3
"""Generate current GitHub wiki pages from DDN's maintained static documentation."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from argparse import ArgumentParser
import json, re, shutil
from collections import Counter
ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'website'
PUBLIC = 'https://scratchbird-software-inc.github.io/Diagram-Design-Notation/'


def name(path):
    return 'DDN-' + ('-'.join(part for part in path.with_suffix('').parts if part != 'index') or 'Overview')


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def descendants(node, tag):
    if isinstance(node, str): return []
    return ([node] if node.tag == tag else []) + [found for child in node.children for found in descendants(child, tag)]


def plain(node):
    return node if isinstance(node,str) else ''.join(plain(child) for child in node.children)


class Markdown:
    def __init__(self, source, pages):
        self.source, self.pages = source, pages
        self.tree = Tree()

    def feed(self, text):
        self.tree.feed(text)

    def link(self, value):
        url = urlsplit(value)
        if url.scheme: return value
        if value.startswith('#'): return PUBLIC + self.source.as_posix() + value
        if url.fragment:
            relative = (SITE / self.source.parent / unquote(url.path)).resolve().relative_to(SITE)
            return PUBLIC + relative.as_posix() + '#' + url.fragment
        target = (SITE / self.source.parent / unquote(url.path)).resolve()
        try: relative = target.relative_to(SITE)
        except ValueError: return PUBLIC
        if relative in self.pages:
            return self.pages[relative] + ('#' + url.fragment if url.fragment else '')
        return PUBLIC + relative.as_posix() + ('?' + url.query if url.query else '') + ('#' + url.fragment if url.fragment else '')

    def render(self, node):
        if isinstance(node,str): return re.sub(r'\s+', ' ', node)
        tag = node.tag
        if tag in {'script','style','nav','input','button','select','textarea'}: return ''
        if tag == 'pre':
            text = plain(node).strip('\n')
            fence = '````' if '```' in text else '```'
            return '\n\n' + fence + '\n' + text + '\n' + fence + '\n\n'
        if tag == 'table':
            rows = []
            for row in descendants(node,'tr'):
                cells = [' '.join(self.render(child).split()).replace('|','\\|') for child in row.children if not isinstance(child,str) and child.tag in {'td','th'}]
                if cells: rows.append(cells)
            if not rows: return ''
            width = max(map(len,rows))
            lines = ['| ' + ' | '.join(row + ['']*(width-len(row))) + ' |' for row in rows]
            lines.insert(1,'| ' + ' | '.join(['---']*width) + ' |')
            return '\n\n' + '\n'.join(lines) + '\n\n'
        if tag == 'a':
            target = self.link(node.attrs.get('href',''))
            heading = next((child for child in node.children if not isinstance(child,str) and re.fullmatch('h[1-6]',child.tag)),None)
            if heading:
                rest = ''.join(self.render(child) for child in node.children if child is not heading)
                return '\n\n' + '#' * int(heading.tag[1]) + ' [' + plain(heading).strip() + '](' + target + ')\n\n' + rest + '\n\n'
            content = ''.join(self.render(child) for child in node.children).strip()
            content = ' '.join(content.split())
            return '[' + content + '](' + target + ') ' if content else ''
        content = ''.join(self.render(child) for child in node.children)
        if re.fullmatch('h[1-6]',tag): return '\n\n' + '#' * int(tag[1]) + ' ' + content.strip() + '\n\n'
        if tag == 'li': return '\n- ' + content.strip() + '\n'
        if tag == 'code': return '`' + content + '`'
        if tag in {'strong','b'}: return '**' + content + '**'
        if tag in {'em','i'}: return '*' + content + '*'
        if tag == 'br': return '\n'
        if tag == 'img': return '![' + node.attrs.get('alt','DDN example') + '](' + self.link(node.attrs.get('src','')) + ')'
        if tag in {'p','div','section','article','ul','ol','details','summary'}: return '\n\n' + content.strip() + '\n\n' if content.strip() else ''
        if tag in {'span','small','dt','dd'}: return content + ' '
        return content

    def result(self):
        main = descendants(self.tree.root,'main')
        if len(main) != 1: raise RuntimeError('Expected one main element: ' + str(self.source))
        result = self.render(main[0])
        return '\n'.join(line.rstrip() for line in re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', result).strip().splitlines()) + '\n'

def build(destination):
    destination.mkdir(parents=True, exist_ok=True)
    # Only generated pages are replaced. Deployment performs the separate mirror step.
    pages = {p.relative_to(SITE): name(p.relative_to(SITE)) for p in sorted(SITE.rglob('*.html'))
             if '<main' in p.read_text() and 'class="site-footer"' in p.read_text()}
    # A literal role called index is distinct from the role-list landing page.
    counts = Counter(pages.values())
    pages = {path: page if counts[page] == 1 else 'DDN-' + '-'.join(path.with_suffix('').parts)
             for path, page in pages.items()}
    if len(set(pages.values())) != len(pages):
        raise RuntimeError('Wiki page names collide; refusing to overwrite a reference page')
    for path, page in pages.items():
        renderer = Markdown(path, pages)
        renderer.feed((SITE / path).read_text())
        text = renderer.result()
        if not text.strip(): raise RuntimeError('Empty documentation page: ' + str(path))
        text += '\nSource: [DDN website](' + PUBLIC + path.as_posix() + '). Current contract: `ddn-next-1`, utility API 1.0.\n'
        (destination / (page + '.md')).write_text(text)
    aliases = json.loads((ROOT / 'tooling/wiki/legacy-pages.json').read_text())
    for alias, path in aliases.items():
        current = pages[Path(path)]
        (destination / (alias + '.md')).write_text('# ' + alias.replace('-', ' ') + '\n\nThis page has moved to the current **ddn-next-1** documentation: [' + current + '](' + current + ').\n\nThe retired 0.8 language and APIs are available in repository history. [Start with the current guide](DDN-guide-quick-start), [browse all 151 profiles](DDN-gallery) or [read the API documentation](DDN-docs).\n')
    (destination/'Home.md').write_text('''# DDN — Diagram Design Notation

The current language is **ddn-next-1**, utility API **1.0**, with **151 bounded profiles**. DDN provides a standalone read-only viewer, a visual designer for local editing, and a verifier shared by both. It works offline without an account, server or commercial subscription.

- [Your first diagram](DDN-guide-quick-start) and [language guide](DDN-guide-language).
- [Field guide](DDN-guide), [gallery](DDN-gallery) and [complete reference](DDN-reference).
- [Viewer/designer/verifier and embedding](DDN-docs).
- [Downloads](DDN-download), [standard](DDN-standard), [licence](DDN-license).
- [All wiki pages](Documentation-index).

For AI generation, attach the [single authoring reference](''' + PUBLIC + '''guide/ddn-ai-reference.txt) to your request. All examples and APIs in this wiki use the new implementation. Old wiki addresses redirect to current pages; the retired grammar is not supported.

DDN is GPL-2.0-or-later, sponsored by [ScratchBird Software Inc.](https://scratchbird.ca). Fonts and artwork retain their own notices. Multi-user collaboration and coordinated services belong to the separate commercial Weaver platform.

[Website]('''+PUBLIC+''') · [Designer]('''+PUBLIC+'''tools/index.html?mode=design) · [Source](https://github.com/scratchbird-software-inc/Diagram-Design-Notation)
''')
    (destination/'Documentation-index.md').write_text('# Current DDN documentation\n\n'+'\n'.join('- [' + str(path).removesuffix('/index.html').removesuffix('.html') + '](' + page + ')' for path,page in pages.items())+'\n')
    (destination/'_Sidebar.md').write_text('''**DDN — ddn-next-1**

[Home](Home) · [All pages](Documentation-index)

- [Quick start](DDN-guide-quick-start)
- [Language](DDN-guide-language)
- [Field guide](DDN-guide)
- [151 profiles](DDN-gallery)
- [Reference](DDN-reference)
- [Embedding/API](DDN-docs)
- [Downloads](DDN-download)
- [Licence](DDN-license)
''')
    (destination/'_Footer.md').write_text('DDN `ddn-next-1` · GPL-2.0-or-later · Sponsored by [ScratchBird Software Inc.](https://scratchbird.ca).\n')
    (destination/'README.md').write_text('# Generated DDN wiki\n\nRebuild with `python3 tooling/wiki/build-wiki.py` from the public DDN repository. Maintained content is derived from the same contracts and pages as the website.\n')
    # Every local wiki link must resolve to a generated page.
    for file in destination.glob('*.md'):
        for target in re.findall(r'\]\(([^)]+)\)',file.read_text()):
            if urlsplit(target).scheme or target.startswith('#'):continue
            if not (destination/(target.split('#')[0]+'.md')).is_file():raise RuntimeError(f'Broken wiki link {file.name}: {target}')
    print(f'Generated {len(pages)} current pages and {len(aliases)} old-address redirects in {destination}')

if __name__ == '__main__':
    args = ArgumentParser(description=__doc__)
    args.add_argument('--out',type=Path,default=ROOT/'.work/builds/wiki')
    options = args.parse_args()
    build(options.out.resolve())
