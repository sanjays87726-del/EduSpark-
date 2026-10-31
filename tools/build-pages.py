#!/usr/bin/env python3
"""Static pages generator: python3 tools/build-pages.py  (writes *.html in the repo root; commit the output).
Edit content in tools/pages/*.py, then re-run. Pages are plain HTML so GitHub Pages and crawlers see full text without JavaScript."""
import os, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
sys.path.insert(0, os.path.join(here, 'pages'))
import exams, legal
n = 0
for mod in (exams, legal):
    for name, html in mod.build().items():
        with open(os.path.join(root, name), 'w', encoding='utf-8') as f: f.write(html)
        n += 1; print('wrote', name, len(html.split()), 'words (incl. markup)')
print(n, 'pages')
