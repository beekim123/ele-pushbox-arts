"""S1 晶石琉璃 · 素版 — component kit for the fixed (non-lobby) screens.
Proposal-only drawing code; reads project sprites/fonts, never writes to the repo."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys
for p in (PROP, PROP + '/lib', PROP + '/fixed'):
    if p not in sys.path: sys.path.insert(0, p)
from l2_common import *
from s1_crystal import shard, hshard, gem, panel, plate
from refload import load_ref, find

ARROW['left5'] = rows("""
..#
.##
###
.##
..#""")
ARROW['right5'] = rows("""
#..
##.
###
##.
#..""")
ARROW['left7'] = rows("""
...#
..##
.###
####
.###
..##
...#""")
ARROW['right7'] = [r[::-1] for r in ARROW['left7']]

# ------------------------------------------------------------------ basics
def dim(c, n=1, box=None):
    x0, y0, x1, y1 = box or (0, 0, c.w, c.h)
    for y in range(max(0, y0), min(c.h, y1)):
        row = c.g[y]
        for x in range(max(0, x0), min(c.w, x1)):
            v = row[x]
            for _ in range(n): v = DARK.get(v, v)
            row[x] = v

def copy_from(c, src, sx, sy, w, h, dx, dy):
    for j in range(h):
        for i in range(w):
            if 0 <= sx + i < src.w and 0 <= sy + j < src.h:
                c.px(dx + i, dy + j, src.g[sy + j][sx + i])

def tw(c, s, sz=12): return c.tw(s, sz)

NO_START = set('，。、；：！？）」』》…—·,.;:!?)%')
NO_END = set('（「『《(')
def _units(s):
    out, i = [], 0
    while i < len(s):
        ch = s[i]
        if s.startswith('……', i): out.append('……'); i += 2; continue
        if ch.isascii() and (ch.isalnum() or ch in '.:/%'):
            j = i
            while j < len(s) and s[j].isascii() and (s[j].isalnum() or s[j] in '.:/%'): j += 1
            out.append(s[i:j]); i = j
        else: out.append(ch); i += 1
    return out

def wrap(c, s, sz, maxw):
    lines, cur = [], ''
    for u in _units(s):
        if not cur or c.tw(cur + u, sz) <= maxw: cur += u; continue
        if u[0] in NO_START or cur[-1] in NO_END:
            last = cur[-1]; lines.append(cur[:-1]); cur = last + u
        else:
            lines.append(cur.rstrip()); cur = u.lstrip()
    if cur: lines.append(cur)
    return lines

def para(c, x, y, s, col, sz=10, maxw=100, lh=None, align='l', lines=None):
    lh = lh or (sz + 2)
    L = lines or wrap(c, s, sz, maxw)
    for i, ln in enumerate(L):
        xx = x if align == 'l' else (x + maxw // 2 if align == 'c' else x + maxw)
        c.text(xx, y + i * lh, ln, col, sz=sz, align=align)
    return len(L) * lh

def rich(c, x, y, parts, sz=10, align='l'):
    """parts: [(text, col)] drawn on one line"""
    W = sum(c.tw(t, sz) for t, _ in parts)
    if align == 'c': x -= W // 2
    elif align == 'r': x -= W
    for t, col in parts:
        c.text(x, y, t, col, sz=sz); x += c.tw(t, sz)
    return W

# ------------------------------------------------------------------ frames
def card(c, x, y, w, h, k=4, ring=('s', 'q', 'r'), body='y', shadow=True):
    """plain chamfered glass frame (no gems) -> body mask"""
    M = cham_mask(x, y, w, h, k)
    if shadow: drop_shadow(c, M, 2, 3, 9)
    paint(c, M, 'z')
    bevel(c, cham_mask(x + 1, y + 1, w - 2, h - 2, k - 1), ring[0], ring[1], mid=ring[2])
    B = cham_mask(x + 2, y + 2, w - 4, h - 4, max(0, k - 2))
    paint(c, B, body)
    return B

def hairline(c, x, y, w, col='x', step=3):
    for xx in range(x, x + w, step): c.px(xx, y, col)

def divider(c, x, y, w, col='q', mid='s'):
    c.hline(x + 3, y, w - 6, col)
    diamond(c, x + 1, y, 1, col); diamond(c, x + w - 2, y, 1, col)
    if mid: diamond(c, x + w // 2, y, 2, 'z'); diamond(c, x + w // 2, y, 1, mid)

def panel_title(c, x, y, w, text, sz=12, icon=None):
    """centered panel heading with crystal flourishes; returns baseline y below"""
    t = c.tw(text, sz) + (11 if icon else 0)
    cx = x + w // 2; tx = cx - t // 2
    if icon: icon(tx, y + (sz - 7) // 2 + (1 if sz == 12 else 0)); tx += 11
    c.text(tx, y, text, 't', sz=sz)
    for side in (-1, 1):
        x0 = cx - t // 2 - 6 if side < 0 else cx + t // 2 + 5
        yy = y + sz // 2
        diamond(c, x0, yy, 1, 's')
        L = 10
        for k in range(L):
            xx = x0 + side * (3 + k)
            c.px(xx, yy, 'q' if k < 6 else ('q' if k % 2 == 0 else None))
    return y + sz + 3

def sel_row(c, x, y, w, h=14, cursor=True, cx=None, glint=True):
    S = cham_mask(x, y, w, h, 3); paint(c, S, 'r')
    S2 = cham_mask(x + 1, y + 1, w - 2, h - 2, 2); paint(c, S2, 'q')
    c.hline(x + 3, y + 1, w - 6, 's'); c.hline(x + 3, y + h - 2, w - 6, 'y')
    if glint:
        for t in range(4):
            c.px(x + w - 20 + t, y + h - 3 - t * 2, 'r'); c.px(x + w - 20 + t, y + h - 4 - t * 2, 'r')
    if cursor:
        hshard(c, (cx if cx is not None else x - 6), y + (h - 11) // 2, 12, 11)

def rowtext_y(ry, h=14, sz=12):
    return ry + (h - (11 if sz == 12 else 9)) // 2

# ------------------------------------------------------------------ keys
def keycap(c, x, y, label=None, arrow=None):
    w = 11 if arrow else c.tw(label, 10) + 7
    M = cham_mask(x, y, w, 11, 2); paint(c, M, 'z')
    R = cham_mask(x + 1, y + 1, w - 2, 9, 1)
    paint(c, R, 'r'); c.hline(x + 2, y + 1, w - 4, 's'); c.hline(x + 2, y + 9, w - 4, 'q')
    paint(c, cham_mask(x + 2, y + 2, w - 4, 7, 0), 'q'); c.hline(x + 2, y + 2, w - 4, 'r')
    if arrow in ('up', 'down'): glyph(c, ARROW[arrow + '5'], x + 3, y + 4, 't')
    elif arrow in ('left', 'right'): glyph(c, ARROW[arrow + '5'], x + 4, y + 3, 't')
    else: c.text(x + w // 2, y + 1, label, 't', sz=10, align='c')
    return w

def keys_width(c, items):
    W = 0
    for n, (ks, lab) in enumerate(items):
        for i, k in enumerate(ks):
            W += 11 if k in ('up', 'down', 'left', 'right') else c.tw(k, 10) + 7
            if i < len(ks) - 1: W += 1
        W += 3 + c.tw(lab, 10)
        if n < len(items) - 1: W += 9
    return W

def keybar(c, items, x=10, y=163, align='l', frame=True):
    W = keys_width(c, items)
    if align == 'r': x -= W + 10
    elif align == 'c': x -= (W + 10) // 2
    if frame: plate(c, x, y - 2, W + 10, 15, 3)
    xx = x + 5
    for n, (ks, lab) in enumerate(items):
        for i, k in enumerate(ks):
            if k in ('up', 'down', 'left', 'right'): xx += keycap(c, xx, y, arrow=k)
            else: xx += keycap(c, xx, y, k)
            if i < len(ks) - 1: xx += 1
        xx += 3; c.text(xx, y + 1, lab, 'u', sz=10); xx += c.tw(lab, 10) + 9
    return x, W + 10

# ------------------------------------------------------------------ widgets
def button(c, x, y, w, label, sel=False, h=15, key=None, icon=None, cursor=True, dis=False):
    M = cham_mask(x, y, w, h, 3)
    drop_shadow(c, M, 1, 2, 8); paint(c, M, 'z')
    R = cham_mask(x + 1, y + 1, w - 2, h - 2, 2)
    if sel:
        bevel(c, R, 's', 'q', mid='r')
        paint(c, cham_mask(x + 2, y + 2, w - 4, h - 4, 1), 'q')
        c.hline(x + 4, y + 2, w - 8, 'r')
        for t in range(3): c.px(x + w - 12 + t, y + h - 4 - t * 2, 'r'); c.px(x + w - 12 + t, y + h - 5 - t * 2, 'r')
    else:
        bevel(c, R, 'w', 'y', mid='x')
        paint(c, cham_mask(x + 2, y + 2, w - 4, h - 4, 1), 'y')
    col = 't' if sel else ('w' if dis else 'u')
    cont = c.tw(label, 12) + ((c.tw(key, 10) + 7 + 3) if key else 0) + (14 if icon else 0)
    xx = x + (w - cont) // 2
    if key: xx += keycap(c, xx, y + 2, key) + 3
    if icon: icon(xx, y + (h - 12) // 2); xx += 14
    c.text(xx, y + (h - 11) // 2, label, col, sz=12)
    if sel and cursor: hshard(c, x - 7, y + (h - 11) // 2, 12, 11)

def tag(c, x, y, text, body='B', hi='C', ink='t'):
    w = c.tw(text, 10) + 6
    M = cham_mask(x, y, w, 11, 2); paint(c, M, 'z')
    paint(c, cham_mask(x + 1, y + 1, w - 2, 9, 1), body)
    c.hline(x + 2, y + 1, w - 4, hi)
    c.text(x + 3, y + 1, text, ink, sz=10)
    return w

def chip(c, x, y, w, h=14): plate(c, x, y, w, h, 3)

def coin_chip(c, xr, y, value, h=14):
    w = 16 + c.tw(value, 10) + 8
    plate(c, xr - w, y, w, h, 3)
    coin_icon(c, xr - w + 4, y + (h - 9) // 2, big=True)
    c.text(xr - 5, y + (h - 9) // 2, value, 't', sz=10, align='r')
    return w

def pips(c, x, y, n, total, r=2, gap=2, on='s', off='x', hi='t'):
    for i in range(total):
        cx = x + r + i * (2 * r + 1 + gap)
        diamond(c, cx, y + r, r + 1, 'z')
        if i < n:
            diamond(c, cx, y + r, r, on); c.px(cx, y + r - r + 1, hi) if r > 1 else None
            if r > 1: c.px(cx - 1, y + r, hi if r > 2 else on)
        else:
            diamond(c, cx, y + r, r, off)
            if r > 1: diamond(c, cx, y + r, r - 1, 'y')
    return total * (2 * r + 1 + gap) - gap

def slider(c, x, y, v, n=10, sel=False):
    for i in range(n):
        xx = x + i * 5
        c.rect(xx - 1, y - 1, 5, 9, 'z')
        if i < v:
            c.rect(xx, y, 3, 7, 'r'); c.hline(xx, y, 3, 's' if not sel else 't'); c.hline(xx, y + 6, 3, 'q')
        else:
            c.rect(xx, y, 3, 7, 'x'); c.hline(xx, y, 3, 'w')
    return n * 5 - 1

def toggle(c, x, y, on=False, sel=False):
    w, h = 17, 9
    M = cham_mask(x, y, w, h, 2); paint(c, M, 'z')
    paint(c, cham_mask(x + 1, y + 1, w - 2, h - 2, 1), 'q' if on else 'y')
    kx = x + w - 8 if on else x + 2
    paint(c, cham_mask(kx, y + 2, 6, 5, 1), 's' if on else ('v' if sel else 'w'))
    c.hline(kx + 1, y + 2, 4, 't' if on else ('u' if sel else 'v'))
    return w

def value_sel(c, xr, y, text, sel=False, sz=12, col=None):
    """right-aligned value; with ◀ ▶ when selected"""
    w = c.tw(text, sz)
    if sel:
        glyph(c, ARROW['right5'], xr - 3, y + (2 if sz == 12 else 1) + 1, 's')
        c.text(xr - 6, y, text, col or 'l', sz=sz, align='r')
        glyph(c, ARROW['left5'], xr - 6 - w - 6, y + (2 if sz == 12 else 1) + 1, 's')
        return w + 12
    c.text(xr, y, text, col or 'v', sz=sz, align='r'); return w

def slot(c, x, y, s=18, sel=False):
    M = cham_mask(x, y, s, s, 2); paint(c, M, 'z')
    bevel(c, cham_mask(x + 1, y + 1, s - 2, s - 2, 1), 'y' if not sel else 's', 'w' if not sel else 'q', mid='x')
    paint(c, cham_mask(x + 2, y + 2, s - 4, s - 4, 0), 'y' if not sel else 'x')
    c.hline(x + 2, y + 2, s - 4, 'z' if not sel else 'y')

def window(c, x, y, src, sx, sy, w, h, k=2, ring=('s', 'q', 'r')):
    """framed scene crop; (x,y) = top-left of the visible crop"""
    M = cham_mask(x - 2, y - 2, w + 4, h + 4, k + 1)
    drop_shadow(c, M, 2, 3, 9); paint(c, M, 'z')
    bevel(c, cham_mask(x - 1, y - 1, w + 2, h + 2, k), ring[0], ring[1], mid=ring[2])
    I = cham_mask(x, y, w, h, max(0, k - 1))
    for (a, b) in I:
        sa, sb = sx + a - x, sy + b - y
        if 0 <= sa < src.w and 0 <= sb < src.h: c.px(a, b, src.g[sb][sa])

def portrait(c, x, y, sid, frame=0, s=28, flip=False):
    B = card(c, x, y, s, s, 3)
    c.rect(x + 2, y + s - 9, s - 4, 6, 'x'); c.hline(x + 2, y + s - 10, s - 4, 'w')
    f = sprite(sid, frame); fw, fh = len(f[0]), len(f)
    c.blit(f, x + (s - fw) // 2, y + s - 2 - fh, flip=flip)

def say_bubble(c, x, y, w, h, tail=None, ring='r', body='y', k=3, tail_side='b'):
    M = cham_mask(x, y, w, h, k)
    T = set()
    if tail:
        tx, ty = tail
        if tail_side == 'b':
            for j in range(ty - (y + h - 1)):
                for i in range(-max(0, 3 - j), max(0, 3 - j) + 1): T.add((tx + i - (j // 2 if tx < x + w // 2 else -(j // 2)) * 0, y + h - 1 + j))
        else:
            for j in range((y) - ty):
                for i in range(-max(0, 3 - j), max(0, 3 - j) + 1): T.add((tx + i, y - j))
        T = {p for p in T}
    A = M | T
    drop_shadow(c, A, 1, 2, 8)
    paint(c, grow(A, 1) - A, 'z')
    paint(c, A, ring)
    I = shrink(M, 1) | {p for p in T if (p[0] - 1, p[1]) in A and (p[0] + 1, p[1]) in A}
    paint(c, I, body)
    for (a, b) in shrink(M, 1):
        if (a, b - 1) not in shrink(M, 1): c.px(a, b, 'x')
    return I

def think_bubble(c, x, y, w, h, dots=(), body='x', ring='v'):
    M = round_mask(x, y, w, h, 5)
    D = set()
    for (dx, dy, r) in dots:
        D |= {(a, b) for a in range(dx - r, dx + r + 1) for b in range(dy - r, dy + r + 1) if (a - dx) ** 2 + (b - dy) ** 2 <= r * r + r * 0.6}
    A = M | D
    drop_shadow(c, A, 1, 2, 8)
    paint(c, grow(A, 1) - A, 'z'); paint(c, A, ring)
    paint(c, shrink(M, 1), body)
    for (dx, dy, r) in dots:
        if r >= 2: paint(c, shrink({(a, b) for a in range(dx - r, dx + r + 1) for b in range(dy - r, dy + r + 1) if (a - dx) ** 2 + (b - dy) ** 2 <= r * r + r * 0.6}, 1), body)
    return M

def name_chip(c, x, y, text, body='B', hi='C', ink='t', icon=None):
    w = c.tw(text, 10) + 8 + (10 if icon else 0)
    M = cham_mask(x, y, w, 12, 2); paint(c, M, 'z')
    paint(c, cham_mask(x + 1, y + 1, w - 2, 10, 1), body)
    c.hline(x + 2, y + 1, w - 4, hi)
    xx = x + 4
    if icon: icon(xx, y + 2); xx += 10
    c.text(xx, y + 2, text, ink, sz=10)
    return w

def toast(c, x, y, w, parts, icon=None, h=16, align='l'):
    M = cham_mask(x, y, w, h, 3); drop_shadow(c, M, 1, 2, 8); paint(c, M, 'z')
    bevel(c, cham_mask(x + 1, y + 1, w - 2, h - 2, 2), 'D', 'B', mid='C')
    paint(c, cham_mask(x + 2, y + 2, w - 4, h - 4, 1), 'y')
    xx = x + 5
    if icon: icon(xx, y + (h - 12) // 2); xx += 12
    rich(c, xx, y + (h - 9) // 2, parts, sz=10)

def big_title(c, x, y, text, fill='t', outline='s', shadow='q', align='l', scale=2, sz=12, spacing=2, outline2='z'):
    return fancy_text(c, x, y, text, fill, outline=outline, outline2=outline2, shadow=shadow, sz=sz, scale=scale,
                      sdir=(1, 2), diag=False, spacing=spacing, align=align)

def header(c, x, y, text, sz=12, icon=None, line=True):
    """screen heading at top-left: gem + text + fading cyan rule"""
    xx = x
    if icon: icon(xx, y - 2); xx += 20
    else: gem(c, xx + 3, y + 5, 'c'); xx += 10
    c.text(xx + 1, y + 1, text, 'z', sz=sz)
    c.text(xx, y, text, 't', sz=sz)
    w = c.tw(text, sz)
    if line:
        L = 36
        for k in range(L):
            if k < 20 or k % 2 == 0: c.px(xx + w + 4 + k, y + 6, 'q' if k > 6 else 'r')
        diamond(c, xx + w + 4 + L + 2, y + 6, 1, 'q')
    return xx + w

def rating_badge(c, cx, cy, letter='A', R=12):
    M = cham_mask(cx - R, cy - R, 2 * R, 2 * R, R // 2 + 1)
    drop_shadow(c, M, 2, 3, 9); paint(c, M, 'z')
    inner = bevel(c, cham_mask(cx - R + 1, cy - R + 1, 2 * R - 2, 2 * R - 2, R // 2), 'D', 'B', mid='C')
    B = cham_mask(cx - R + 2, cy - R + 2, 2 * R - 4, 2 * R - 4, R // 2 - 1)
    paint(c, B, 'B')
    for (a, b) in B:
        if a - (cx - R) + b - (cy - R) < R: c.px(a, b, 'C')
    c.line(cx - R + 3, cy - 2, cx - 2, cy - R + 3, 'D')
    fancy_text(c, cx, cy - 9, letter, 'l', outline='z', shadow=None, sz=12, scale=2, diag=False, align='c', bottom='k')

# ------------------------------------------------------------------ HUDs
def level_hud(c, lid, name, lamps=(False,), rule=None, sand=None, extra=None):
    c.rect(0, 0, 320, 20, 'z')
    w = 7 + c.tw(lid, 10) + 5 + c.tw(name, 12) + 7 + (12 if rule else 0)
    plate(c, 2, 1, w, 18, 3)
    c.text(8, 6, lid, 'l', sz=10)
    xx = 8 + c.tw(lid, 10) + 5
    c.text(xx, 4, name, 't', sz=12); xx += c.tw(name, 12) + 4
    if rule is not None:
        c.rect(xx, 6, 9, 9, 'z'); c.blit(sprite('ui.class_icon', rule), xx + 1, 7)
    # right: lamps + actions
    icons = [0, 1, 2, 4]
    gw = 6 + len(lamps) * 11 + 6 + len(icons) * 15 + 2
    if sand is not None: gw += 30
    x0 = 318 - gw
    plate(c, x0, 1, gw, 18, 3)
    xx = x0 + 5
    if sand is not None:
        bag = sprite('item.sandbag', 0)
        if not sand: bag = [[None if v is None else DARK.get(v, v) for v in r] for r in bag]
        c.blit(bag, xx - 2, 2)
        c.text(xx + 13, 6, f'×{sand}', 'u' if sand else 'w', sz=10); xx += 30
    for on in lamps:
        c.blit(sprite('ui.goal_lamp', 1 if on else 0), xx, 6)
        if on: c.px(xx - 1, 5, 't')
        xx += 11
    c.vline(xx + 1, 5, 11, 'x'); xx += 6
    for i in icons:
        c.blit(sprite('ui.icons', i), xx, 4); xx += 15
    return x0

def delivery_hud(c, hearts=2, maxh=3, cargo='vase', left=2, maxi=3, rule=3, coins='35', sand=2,
                 items=('first_aid', 'rope_ladder'), slots=3, clock='1:23', mm=None):
    c.rect(0, 0, 320, 20, 'z')
    x = 2
    # hearts
    w = 6 + maxh * 11
    plate(c, x, 1, w, 18, 3)
    for i in range(maxh): c.blit(sprite('ui.delivery_icons', 0 if i < hearts else 1), x + 1 + i * 11, 3)
    x += w + 2
    # cargo + integrity + rule
    w = 4 + 14 + 2 + maxi * 7 + 3 + 13 + 3
    plate(c, x, 1, w, 18, 3)
    c.blit(sprite('cargo.' + cargo, 0), x + 1, 3)
    px_ = x + 19
    for i in range(maxi):
        on = i < left
        c.rect(px_ + i * 7, 7, 6, 6, 'z')
        c.rect(px_ + i * 7 + 1, 8, 4, 4, 'l' if on else 'y')
        if on: c.hline(px_ + i * 7 + 1, 8, 4, 't'); c.hline(px_ + i * 7 + 1, 11, 4, 'k')
    c.blit(sprite('ui.delivery_icons', rule), x + w - 17, 2)
    x += w + 2
    # coins + sand
    w = 4 + 9 + 2 + c.tw(coins, 10) + 6 + 13 + 1 + c.tw(f'×{sand}', 10) + 4
    plate(c, x, 1, w, 18, 3)
    coin_icon(c, x + 4, 5, big=True)
    c.text(x + 15, 6, coins, 't', sz=10)
    sx = x + 15 + c.tw(coins, 10) + 4
    c.blit(sprite('item.sandbag', 0), sx - 2, 2)
    c.text(sx + 13, 6, f'×{sand}', 't', sz=10)
    x += w + 2
    # bag slots
    for i in range(slots):
        slot(c, x + i * 18, 1, 18)
        if i < len(items): c.blit(sprite('item.' + items[i], 0), x + i * 18 + 1, 2)
    x += slots * 18 + 2
    # clock
    w = 4 + 13 + 2 + c.tw(clock, 10) + 5
    xr = 318 - 34
    plate(c, xr - w - 2, 1, w, 18, 3)
    c.blit(sprite('ui.delivery_icons', 2), xr - w - 2 + 1, 2)
    c.text(xr - 7, 6, clock, 't', sz=10, align='r')
    # minimap
    minimap(c, 318 - 32, 1, mm)

def minimap(c, x, y, mm):
    plate(c, x, y, 32, 18, 3)
    cols, rows_ = mm['cols'], mm['rows']
    for r in mm['rooms']:
        cx_, cy_ = x + 4 + r['x'] * 6, y + 3 + r['y'] * 4
        role, cur = r['role'], r['index'] == mm['cur']
        if not r['seen']:
            c.rect(cx_, cy_, 5, 3, 'x'); c.px(cx_ + 2, cy_ + 1, 'D')   # home, not yet seen
            continue
        col = {'room': 'w', 'gate': 'k', 'station': 'm', 'home': 'D'}[role]
        c.rect(cx_, cy_, 5, 3, col)
        if cur: c.rect(cx_, cy_, 5, 3, 's'); c.px(cx_ + 2, cy_ + 1, 't')
