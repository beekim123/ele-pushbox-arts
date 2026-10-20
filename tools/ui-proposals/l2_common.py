"""Shared bits for round-2 lobby proposals (universal UI over swappable backgrounds)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys; sys.path.insert(0, PROP); sys.path.insert(0, PROP + '/lib')
from bg import *

TITLE, TITLE_EN, TAG = '渡界人', 'PORTITOR', '万物皆可送，诸界皆可渡'
MENU = [('继续', 0), ('选择章节', 1), ('设置', 2), ('退出', 3)]
COINS = '1,280'

N4 = [(1, 0), (-1, 0), (0, 1), (0, -1)]
N8 = N4 + [(1, 1), (1, -1), (-1, 1), (-1, -1)]

def textset(c, s, sz=12, scale=1):
    pts, w = c._mask(s, sz)
    P = set()
    for (a, b) in pts:
        for i in range(scale):
            for j in range(scale): P.add((a * scale + i, b * scale + j))
    return P, w * scale

def fancy_text(c, x, y, s, fill, top=None, bottom=None, outline='z', shadow=None, sz=12, scale=1,
               sdir=(1, 1), diag=True, align='l', outline2=None, spacing=0):
    if spacing:
        P = set(); cx = 0
        for ch in s:
            p, w = textset(c, ch, sz, scale)
            P |= {(a + cx, b) for (a, b) in p}; cx += w + spacing
        w = cx - spacing
    else:
        P, w = textset(c, s, sz, scale)
    if align == 'c': x -= w // 2
    elif align == 'r': x -= w
    P = {(a + x, b + y) for (a, b) in P}
    O = set()
    if outline:
        for (a, b) in P:
            for dx, dy in (N8 if diag else N4):
                if (a + dx, b + dy) not in P: O.add((a + dx, b + dy))
    O2 = set()
    if outline2:
        base = P | O
        for (a, b) in base:
            for dx, dy in N4:
                if (a + dx, b + dy) not in base: O2.add((a + dx, b + dy))
    base = P | O | O2
    if shadow:
        for (a, b) in base:
            q = (a + sdir[0], b + sdir[1])
            if q not in base: c.px(q[0], q[1], shadow)
    for q in O2: c.px(q[0], q[1], outline2)
    for q in O: c.px(q[0], q[1], outline)
    for (a, b) in P:
        col = fill
        if top and (a, b - 1) not in P: col = top
        elif bottom and (a, b + 1) not in P: col = bottom
        c.px(a, b, col)
    return w

# ---------------------------------------------------------------- masks
def cham_mask(x, y, w, h, k):
    M = set()
    for yy in range(h):
        ins = max(0, k - yy, k - (h - 1 - yy))
        for xx in range(x + ins, x + w - ins): M.add((xx, y + yy))
    return M

def round_mask(x, y, w, h, r):
    M = set()
    for yy in range(h):
        for xx in range(w):
            cx = min(max(xx, r), w - 1 - r); cy = min(max(yy, r), h - 1 - r)
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r + r * 0.6: M.add((x + xx, y + yy))
    return M

def rect_mask(x, y, w, h): return {(x + i, y + j) for i in range(w) for j in range(h)}

def paint(c, M, col):
    for (a, b) in M: c.px(a, b, col)

def grow(M, n=1, diag=False):
    for _ in range(n):
        M = M | {(a + dx, b + dy) for (a, b) in M for dx, dy in (N8 if diag else N4)}
    return M

def shrink(M, n=1):
    for _ in range(n):
        M = {p for p in M if all((p[0] + dx, p[1] + dy) in M for dx, dy in N4)}
    return M

def bevel(c, M, hi, lo, mid=None, width=1):
    """colour the outer ring of mask M: top/left -> hi, bottom/right -> lo"""
    inner = shrink(M, width)
    for (a, b) in M - inner:
        up = (a, b - 1) not in M; lf = (a - 1, b) not in M
        dn = (a, b + 1) not in M; rt = (a + 1, b) not in M
        if up or lf:
            col = hi if not (dn or rt) or up else (mid or hi)
            if lf and dn and not up: col = mid or lo
            if up and rt and not lf: col = mid or hi
        elif dn or rt: col = lo
        else: col = mid or hi
        c.px(a, b, col)
    return inner

def drop_shadow(c, M, dx=2, dy=3, level=10, m=DARK):
    for (a, b) in M:
        q = (a + dx, b + dy)
        if q in M: continue
        if 0 <= q[0] < c.w and 0 <= q[1] < c.h and BAYER[q[1] % 4][q[0] % 4] < level:
            c.g[q[1]][q[0]] = m.get(c.g[q[1]][q[0]], c.g[q[1]][q[0]])

def shadow_mask(c, M, dx=1, dy=1, col='z'):
    for (a, b) in M:
        if (a + dx, b + dy) not in M: c.px(a + dx, b + dy, col)

# small pixel glyphs
ARROW = {'up': rows("""
...#...
..###..
.#####.
#######"""), 'down': rows("""
#######
.#####.
..###..
...#..."""), 'up5': rows("""
..#..
.###.
#####"""), 'down5': rows("""
#####
.###.
..#..""")}
def glyph(c, g, x, y, col):
    for j, r in enumerate(g):
        for i, ch in enumerate(r):
            if ch == '#': c.px(x + i, y + j, col)

def diamond(c, cx, cy, r, col):
    for j in range(-r, r + 1):
        k = r - abs(j)
        c.hline(cx - k, cy + j, 2 * k + 1, col)

def menu_icon(c, i, x, y, recolor=None, outline=None):
    f = sprite('ui.menu_icons', i)
    if outline: c.outline_blit(f, x, y, outline, recolor=recolor)
    else: c.blit(f, x, y, recolor=recolor)

def emblem(c, theme, x, y):
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), x, y)

def cur_text(theme):
    ch, name, lv = INFO[theme]
    return ch, name, lv
