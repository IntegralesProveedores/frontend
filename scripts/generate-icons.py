# Regenera src/styles/icons.css y la fuente reducida de Bootstrap Icons con los
# íconos (bi-*) que aparecen en src/app y src/index.html.
# Uso: npm run icons   (requiere: pip install fonttools brotli)
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BS = chr(92)
ICONS_DIR = os.path.join(ROOT, 'node_modules', 'bootstrap-icons', 'font')
FONT_OUT = os.path.join(ROOT, 'src', 'assets', 'fonts', 'bootstrap-icons-subset.woff2')
CSS_OUT = os.path.join(ROOT, 'src', 'styles', 'icons.css')

files = glob.glob(os.path.join(ROOT, 'src', 'app', '**', '*.html'), recursive=True)
files += glob.glob(os.path.join(ROOT, 'src', 'app', '**', '*.ts'), recursive=True)
files.append(os.path.join(ROOT, 'src', 'index.html'))
names = set()
for f in files:
    with open(f, encoding='utf-8', errors='ignore') as fh:
        names.update(re.findall(r'\bbi-([a-z0-9]+(?:-[a-z0-9]+)*)', fh.read()))

with open(os.path.join(ICONS_DIR, 'bootstrap-icons.css'), encoding='utf-8') as fh:
    css = fh.read()
codes, missing = {}, []
for n in sorted(names):
    m = re.search(r'\.bi-' + re.escape(n) + r'::before \{ content: "' + re.escape(BS) + r'([0-9a-f]+)"; \}', css)
    if m:
        codes[n] = m.group(1)
    else:
        missing.append(n)

unicodes = ','.join('U+' + c.upper() for c in codes.values())
subprocess.run([
    sys.executable, '-m', 'fontTools.subset', os.path.join(ICONS_DIR, 'fonts', 'bootstrap-icons.woff2'),
    '--unicodes=' + unicodes, '--layout-features=', '--flavor=woff2', '--output-file=' + FONT_OUT,
], check=True)

head = '''@font-face {
  font-display: block;
  font-family: "bootstrap-icons";
  src: url("/assets/fonts/bootstrap-icons-subset.woff2") format("woff2");
}

.bi::before,
[class^="bi-"]::before,
[class*=" bi-"]::before {
  display: inline-block;
  font-family: bootstrap-icons !important;
  font-style: normal;
  font-weight: normal !important;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  vertical-align: -.125em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

'''
rules = '\n'.join('.bi-%s::before { content: "%s%s"; }' % (n, BS, c) for n, c in codes.items())
with open(CSS_OUT, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(head + rules + '\n')

print('%d iconos, fuente %d bytes' % (len(codes), os.path.getsize(FONT_OUT)))
if missing:
    print('No existen en Bootstrap Icons:', ', '.join(missing))
