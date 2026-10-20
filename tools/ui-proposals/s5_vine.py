"""S5 藤木萤光 — mossy wooden boards, hanging vines and leaves, firefly glow, soil-and-grass title
(lobby skin for 第 4 章 迷雾古森 / forest)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import math
from l2_common import *

# ---------------------------------------------------------------- parts
def moss(c, x, y, w, seed=0):
    """moss cap laid over a board's top outline row y: grass blades above, short drips below
    (same read as the chapter's soil tiles: bright grass line over brown earth)"""
    for xx in range(x, x + w):
        c.px(xx, y, 'm' if H(xx, y, seed) < 620 else 'n')
        c.px(xx, y + 1, 'n')
        if H(xx, y, seed + 1) < 480: c.px(xx, y + 2, 'o' if H(xx, y, seed + 5) < 550 else 'n')
        if H(xx, y, seed + 2) < 110 and xx not in (x, x + w - 1): c.px(xx, y + 3, 'o')
        if H(xx, y, seed + 3) < 300: c.px(xx, y - 1, 'm')
        elif H(xx, y, seed + 4) < 110: c.px(xx, y - 1, 'n')
        if H(xx, y, seed + 6) < 60: c.px(xx, y - 2, 'm'); c.px(xx, y - 1, 'm')

def board(c, x, y, w, h, seed=0, body='f', mossy=True, shadow=True, grain=True, nails=True):
    """wooden board: dark outline, 1-px rim (lit top-left), sparse grain, iron nails, moss on top"""
    M = round_mask(x, y, w, h, 2)
    if shadow: drop_shadow(c, M, 2, 3, 9)
    paint(c, M, 'z')
    B = bevel(c, round_mask(x + 1, y + 1, w - 2, h - 2, 1), 'e', 'g', mid='f')
    paint(c, B, body)
    if grain:
        for (a, b) in B:
            if H(a // 5 + b * 7, b, seed) < 60 and (a, b - 1) in B and (a, b + 1) in B: c.px(a, b, 'g')
    if nails:
        for nx in (x + 3, x + w - 4):
            c.px(nx, y + h // 2, 'v'); c.px(nx, y + h // 2 + 1, 'g')
    if mossy: moss(c, x + 2, y, w - 4, seed)
    return B

def leaf(c, x, y, L=8, h=2, flip=False, hi='m', lo='n', vein='o', edge='z'):
    """leaf lying along x: stem end at (x, y), tip L-1 px away (to the left if flip)"""
    M = {}
    for i in range(L):
        t = i / max(1, L - 1)
        hw = h * (math.sin(math.pi / 2 * t / 0.35) if t < 0.35 else 1 - (t - 0.35) / 0.65)   # round base, pointed tip
        hw = int(round(hw))
        xx = x - i if flip else x + i
        for j in range(-hw, hw + 1):
            M[(xx, y + j)] = vein if (j == 0 and 1 <= i <= L - 3) else (hi if j < 0 else lo)
    for (p, q) in list(M):
        for dx, dy in N8:
            if (p + dx, q + dy) not in M: c.px(p + dx, q + dy, edge)
    for (p, q), col in M.items(): c.px(p, q, col)

def leaf_cursor(c, x, y, L=11, h=3, rise=2):
    """menu cursor: a leaf on a short stem, tip tilted up toward the selected row; base at (x, y)"""
    M = {}
    for i in range(L):
        t = i / (L - 1)
        hw = int(round(h * (math.sin(math.pi / 2 * t / 0.35) if t < 0.35 else 1 - (t - 0.35) / 0.65)))
        yc = y - int(round(rise * t * t))
        for j in range(-hw, hw + 1):
            M[(x + i, yc + j)] = 'o' if (j == 0 and 1 <= i <= L - 3) else ('m' if j < 0 else 'n')
    for p in ((x - 1, y + 1), (x - 2, y + 2), (x - 3, y + 2)): M[p] = 'n'
    for (p, q) in list(M):
        for dx, dy in N8:
            if (p + dx, q + dy) not in M: c.px(p + dx, q + dy, 'z')
    for (p, q), col in M.items(): c.px(p, q, col)

def vine(c, x, y0, y1, amp=1.6, ph=0.0, leaves=(), seed=0):
    """vine hanging from y0 to y1, swaying around x; leaves = [(y, side)]"""
    pts = []
    for y in range(y0, y1):
        xx = x + int(round(amp * math.sin((y - y0) * 0.33 + ph)))
        pts.append((xx, y))
    S = set(pts) | {(a + 1, b) for (a, b) in pts}
    for (a, b) in S:
        for dx, dy in N4:
            if (a + dx, b + dy) not in S: c.px(a + dx, b + dy, 'z')
    for (a, b) in pts: c.px(a, b, 'n'); c.px(a + 1, b, 'o')
    for (a, b) in pts[::5]: c.px(a, b, 'm')
    for (ly, side) in leaves:
        a, b = pts[ly - y0]
        if side > 0: leaf(c, a + 2, b + 1, 6, 2)
        else: leaf(c, a - 1, b + 1, 6, 2, flip=True)
    a, b = pts[-1]; c.px(a, b + 1, 'm')

def firefly(c, x, y, big=False):
    """soft glow: yellow core, green halo (reads as a firefly in the mist)"""
    c.px(x, y, 'l')
    for dx, dy in N4: c.px(x + dx, y + dy, 'k' if big else 'm')
    if big:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)): c.px(x + dx, y + dy, 'm')

MUSH = rows("""
...zzzz...
.zzitiizz.
zitiiiitiz
ziiiitiiiz
zhhhhhhhhz
.zzzcczzz.
...zcdz...
...zcdz...""")
MUSH_S = rows("""
..zzz..
.zitiz.
ziiiiiz
zhhhhhz
.zzczz.
..zcz..""")

def mushrooms(c, x, y):
    """two red caps standing on (x, y) = ground line of the bigger one"""
    c.blit(MUSH, x, y - len(MUSH))
    c.blit(MUSH_S, x + 9, y - len(MUSH_S) + 1)
    c.px(x + 1, y - 9, 'l')

def grass_title(c, x, y, s, spacing=2, seed=4):
    """earth-block letters like the chapter's terrain: light soil, a grass line along each letter's
    top silhouette with a few blades, darker soil at the bottom edge, brown outline + black rim.
    Returns (width, {column: top y of the letters})."""
    P = set(); cx = 0
    for ch in s:
        p, w = textset(c, ch, 12, 2)
        P |= {(a + cx, b) for (a, b) in p}; cx += w + spacing
    P = {(a + x, b + y) for (a, b) in P}
    O = {(a + dx, b + dy) for (a, b) in P for dx, dy in N8} - P
    O2 = {(a + dx, b + dy) for (a, b) in P | O for dx, dy in N4} - P - O
    for (a, b) in P | O | O2:
        q = (a + 1, b + 2)
        if q not in P and q not in O and q not in O2: c.px(q[0], q[1], 'p')
    paint(c, O2, 'z'); paint(c, O, 'g')
    top = {}
    for (a, b) in P: top[a] = min(top.get(a, 999), b)
    for (a, b) in P:
        col = 'c'
        if top[a] == b: col = 'm'
        elif (a, b + 1) not in P: col = 'd'
        c.px(a, b, col)
    for a, b in top.items():
        if H(a, b, seed) < 300 and (a, b - 1) in O: c.px(a, b - 1, 'm')
    return cx - spacing, top

def keycap(c, x, y, label=None, arrow=None):
    """light-wood button"""
    w = 11 if arrow else c.tw(label, 10) + 7
    paint(c, round_mask(x, y, w, 11, 2), 'z')
    paint(c, round_mask(x + 1, y + 1, w - 2, 9, 1), 'F')
    c.hline(x + 2, y + 1, w - 4, 'd'); c.hline(x + 2, y + 9, w - 4, 'e')
    if arrow: glyph(c, ARROW[arrow + '5'], x + 3, y + 4, 'g')
    else: c.text(x + w // 2, y + 1, label, 'g', sz=10, align='c')
    return w

def log_slice(c, cx, cy, r=9):
    """tree-ring disc behind the chapter emblem"""
    c.disc(cx, cy, r, 'z'); c.disc(cx, cy, r - 1, 'f'); c.disc(cx, cy, r - 2, 'F')
    c.circle(cx, cy, r - 4, 'd'); c.circle(cx, cy, r - 6, 'e')

# ---------------------------------------------------------------- lobby
def draw(c, theme):
    ch, name, lv = cur_text(theme)
    # ---- vines hanging from the canopy beside the title
    vine(c, 104, 0, 40, 1.6, 0.0, leaves=((9, 1), (19, -1), (30, 1)))
    vine(c, 118, 0, 22, 1.2, 1.7, leaves=((8, -1), (16, 1)))
    # ---- title
    grass_title(c, 13, 9, TITLE)
    # PORTITOR between two leaves
    tx = 32
    w_en = sum(c.tw(chh, 10) + 1 for chh in TITLE_EN) - 1
    leaf(c, tx - 3, 38, 6, 2, flip=True)
    fancy_text(c, tx, 34, TITLE_EN, 'm', outline='z', sz=10, spacing=1)
    leaf(c, tx + w_en + 3, 38, 6, 2)
    fancy_text(c, 13, 46, TAG, 'c', outline='z', sz=10)
    # ---- current chapter board (emblem on a log slice)
    cw = 24 + c.tw('当前', 10) + 4 + c.tw(ch + ' · ' + name, 12) + 8
    board(c, 14, 64, cw, 15, seed=8, nails=False)
    log_slice(c, 20, 71, 10)
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), 12, 63)
    c.text(34, 68, '当前', 'm', sz=10)
    c.text(34 + c.tw('当前', 10) + 4, 67, ch + ' · ' + name, 't', sz=12)
    # ---- menu: four planks in one frame
    mx, my, mw, mh = 12, 86, 134, 70
    board(c, mx, my, mw, mh, seed=12, grain=False, nails=False)
    for i in range(4):
        py = my + 4 + i * 15
        if i: c.hline(mx + 2, py - 1, mw - 4, 'g')            # seam between planks
        for (a, b) in [(xx, yy) for yy in (py + 1, py + 12) for xx in range(mx + 3, mx + mw - 3)]:
            if H(a // 6, b, 30 + i) < 160: c.px(a, b, 'g')
        for nx in (mx + 4, mx + mw - 5): c.px(nx, py + 6, 'v'); c.px(nx, py + 7, 'g')
    for i, (label, ic) in enumerate(MENU):
        ry = my + 5 + i * 15
        if i == 0:
            S = round_mask(mx + 8, ry - 1, mw - 16, 14, 3)
            paint(c, grow(S, 1), 'z'); paint(c, S, 'n')
            for (a, b) in S:
                if (a, b - 1) not in S: c.px(a, b, 'm')
                elif (a, b + 1) not in S: c.px(a, b, 'o')
            menu_icon(c, ic, mx + 13, ry)
            fancy_text(c, mx + 28, ry, label, 't', outline=None, sz=12)
            fancy_text(c, mx + mw - 12, ry + 1, lv, 'l', outline=None, sz=10, align='r')
            # leaf cursor + firefly
            leaf_cursor(c, mx - 7, ry + 6)
            firefly(c, mx - 3, ry - 4, big=True)
        else:
            menu_icon(c, ic, mx + 13, ry)
            c.text(mx + 28, ry, label, 'c', sz=12)
    mushrooms(c, mx + mw - 14, my + mh + 2)
    # ---- coin board
    cw2 = 16 + c.tw(COINS, 10) + 8
    board(c, 314 - cw2, 6, cw2, 14, seed=40, grain=False, nails=False)
    coin_icon(c, 314 - cw2 + 4, 9, big=True)
    c.text(314 - 6, 9, COINS, 't', sz=10, align='r')
    leaf(c, 314 - cw2 - 1, 12, 6, 2, flip=True)
    # ---- key hints board
    x, y = 12, 165
    hw = 11 + 1 + 11 + 3 + c.tw('选择', 10) + 8 + c.tw('Enter', 10) + 7 + 3 + c.tw('确认', 10) + 10
    board(c, 9, y - 2, hw, 15, seed=50, nails=False)
    x = 13
    x += keycap(c, x, y, arrow='up') + 1
    x += keycap(c, x, y, arrow='down') + 3
    c.text(x, y + 1, '选择', 'c', sz=10); x += c.tw('选择', 10) + 8
    x += keycap(c, x, y, 'Enter') + 3
    c.text(x, y + 1, '确认', 'c', sz=10)
    # ---- fireflies drifting in the mist
    for (fx, fy, big) in ((128, 52, True), (96, 64, False), (150, 112, False), (6, 116, False), (140, 30, False)):
        firefly(c, fx, fy, big)

if __name__ == '__main__':
    for t in ('forest', 'cave'):
        c = Canvas(); draw_bg(c, t); draw(c, t); c.save(f'{PROP}/out2/_s5_{t}.png', scale=2)
