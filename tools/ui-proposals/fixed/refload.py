"""Load reference renders as palette canvases + locate sprites (read-only)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys; sys.path.insert(0, PROP); sys.path.insert(0, PROP + '/lib')
from px import *
from PIL import Image
REF = os.path.join(REPO, 'art/export/reference/')
INV = {v: k for k, v in RGB.items()}

def load_ref(name):
    im = Image.open(REF + name + '.png').convert('RGB')
    c = Canvas(im.width, im.height)
    p = im.load()
    for y in range(im.height):
        for x in range(im.width):
            rgb = p[x, y]
            if rgb in INV: c.g[y][x] = INV[rgb]
            else:
                c.g[y][x] = min(RGB, key=lambda k: sum((a - b) ** 2 for a, b in zip(RGB[k], rgb)))
    return c

def find(c, f, flip=False, region=None, maxbad=0):
    rows_ = [r[::-1] if flip else r for r in f]
    pts = [(i, j, ch) for j, r in enumerate(rows_) for i, ch in enumerate(r) if ch not in '. ']
    x0, y0, x1, y1 = region or (0, 0, c.w, c.h)
    hits = []
    for y in range(y0, y1 - len(f) + 1):
        for x in range(x0, x1 - len(f[0]) + 1):
            bad = 0
            for (i, j, ch) in pts:
                if c.g[y + j][x + i] != ch:
                    bad += 1
                    if bad > maxbad: break
            if bad <= maxbad: hits.append((x, y, bad))
    return hits
