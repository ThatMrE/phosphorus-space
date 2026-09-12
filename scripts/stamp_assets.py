"""Version the asset URLs in index.html.

Every local stylesheet and script reference gets a ?v=<content hash> so a
fresh index.html can never run against a browser's stale copy of the
scripts. Run it after editing anything under assets/:

    python3 scripts/stamp_assets.py

It only rewrites index.html when a hash changed.
"""
import hashlib
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
INDEX = os.path.join(ROOT, 'index.html')

ATTR = re.compile(r'(?P<attr>\b(?:src|href)=")(?P<path>assets/[^"?]+?\.(?:js|css))(?:\?v=[0-9a-f]+)?"')


def digest(path):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def stamp(html):
    changed = []

    def sub(m):
        path = m.group('path')
        new = '%s%s?v=%s"' % (m.group('attr'), path, digest(path))
        if new != m.group(0):
            changed.append(path)
        return new

    return ATTR.sub(sub, html), changed


if __name__ == '__main__':
    with open(INDEX, encoding='utf-8') as f:
        html = f.read()
    out, changed = stamp(html)
    if changed:
        with open(INDEX, 'w', encoding='utf-8') as f:
            f.write(out)
        print('stamped ' + ', '.join(changed))
    else:
        print('index.html already current')
