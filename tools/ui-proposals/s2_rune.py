"""S2 漂浮符文 — floating carved-stone slabs with glowing runes."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from l2_common import *

RUNES = [rows(r) for r in ("""
..#..
.#.#.
#.#.#
..#..
..#..""", """
#...#
.#.#.
..#..
.#.#.
#...#""", """
##...
#.#..
##...
#.#..
#..#.""", """
#.#..
##...
#.#..
#..#.
#...#""", """
.###.
#...#
..#..
#...#
.###.""", """
#####
..#..
.#.#.
#...#
#...#""")]

STONE = dict(t='v', top='w', face='x', lit='w', shade='y', under='y', drip='z')

def slab(c, x, y, w, face, top=2, jag=4, seed=0, shadow=True, moss=False, glow=None, tails=None, P=STONE):
    """chunky floating slate: lighter top surface, carved front face, rough ends, rocky drips.
    returns (face_y0, mask)"""
    M = {}
    hgt = top + face
    for j in range(hgt):
        lo = (H(x, y + j, seed) % 3 == 0) * 1
        ro = (H(x + w, y + j, seed) % 3 == 0) * 1
        tap = max(0, j - (hgt - 3))
        if j == 0: lo = ro = 1
        for i in range(lo + tap, w - ro - tap):
            if j < top:
                col = P['t'] if (j == 0 and (i % 11) in (2, 3, 4, 5, 6)) else P['top']
            elif j == top: col = P['shade']
            else:
                col = P['face']
                if i == lo + tap: col = P['lit']
                elif i >= w - ro - tap - 2: col = P['shade']
            M[(x + i, y + j)] = col
    tails = tails if tails is not None else [(0.3, jag), (0.7, max(1, jag - 1))]
    for (t, d) in tails:
        cx = x + int(t * w) + (H(x, y, seed + int(t * 10)) % 5) - 2
        for j in range(d):
            hw = max(0, (d - j) * 3 // d)
            for i in range(cx - hw - 1, cx + hw + 2):
                M[(i, y + hgt + j)] = P['under'] if j < d - 1 else P['drip']
    K = set(M)
    if shadow: drop_shadow(c, grow(K, 1), 3, 6, 8)
    O = grow(K, 1, diag=False) - K
    if glow:
        G = grow(K | O, 1, diag=False) - K - O
        paint(c, G, glow)
    paint(c, O, 'z')
    for p, col in M.items(): c.px(p[0], p[1], col)
    if moss:
        mx = x + 4 + H(y, x, seed) % max(1, w // 3)
        for k in range(6 + seed % 4):
            c.px(mx + k, y, 'n' if k % 2 else 'm')
            if k % 3 == 1: c.px(mx + k, y - 1, 'm')
    return y + top + 1, K

def rune(c, i, x, y, col, glow=None):
    g = RUNES[i % len(RUNES)]
    if glow:
        P = {(x + a, y + b) for b, r in enumerate(g) for a, ch in enumerate(r) if ch == '#'}
        for (a, b) in P:
            for dx, dy in N4:
                if (a + dx, b + dy) not in P: c.px(a + dx, b + dy, glow)
    glyph(c, g, x, y, col)

def carved(c, x, y, s, sz=12, ink='y', lip='u', align='l'):
    P, w = textset(c, s, sz)
    if align == 'c': x -= w // 2
    elif align == 'r': x -= w
    P = {(a + x, b + y) for (a, b) in P}
    if lip:
        for (a, b) in P:
            if (a, b + 1) not in P: c.px(a, b + 1, lip)
    for p in P: c.px(p[0], p[1], ink)
    return w

def keycap(c, x, y, label=None, arrow=None):
    w = 11 if arrow else c.tw(label, 10) + 7
    fy, _ = slab(c, x, y, w, 8, top=2, jag=0, seed=x, shadow=False, tails=[])
    if arrow: glyph(c, ARROW[arrow + '5'], x + 3, fy + 2, 'u')
    else: c.text(x + w // 2 - 1, fy - 1, label, 'u', sz=10, align='c')
    return w

GLOW = ('l', 'k', 'j')     # rune light: core, body, halo

def draw(c, theme):
    ch, name, lv = cur_text(theme)
    core, body, halo = GLOW
    # ---- title monolith
    tx, ty, tw_ = 10, 4, 114
    fy, T = slab(c, tx, ty, tw_, 34, top=3, jag=6, seed=3, moss=True, tails=[(0.22, 5), (0.5, 7), (0.8, 4)])
    for i, rx in enumerate((tx + 5, tx + tw_ - 11)):
        rune(c, i + 2, rx, fy + 3, body, glow='f')
        rune(c, i + 4, rx, fy + 25, 'w')
    fancy_text(c, tx + tw_ // 2 - 1, fy + 3, TITLE, body, top=core, outline='f', sz=12, scale=2, align='c', diag=False, spacing=2)
    fancy_text(c, tx + tw_ // 2 - 1, fy + 26, TITLE_EN, 'v', outline=None, sz=10, align='c', spacing=1)
    # floating pebbles + motes
    slab(c, 130, 12, 8, 3, top=1, jag=2, seed=5, shadow=False, tails=[(0.5, 2)])
    slab(c, 136, 31, 5, 2, top=1, jag=1, seed=6, shadow=False, tails=[(0.5, 1)])
    for (x, y) in ((128, 6), (142, 24), (6, 44), (122, 44)): c.px(x, y, core)
    fancy_text(c, 13, 53, TAG, 'u', outline='z', sz=10)
    # ---- current chapter slab
    cw = 22 + c.tw('当前', 10) + 4 + c.tw(ch + ' · ' + name, 12) + 8
    fy, _ = slab(c, 10, 67, cw, 11, top=2, jag=3, seed=8)
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), 13, fy - 3)
    c.text(32, fy + 2, '当前', 'v', sz=10)
    c.text(32 + c.tw('当前', 10) + 4, fy + 1, ch + ' · ' + name, 't', sz=12)
    # ---- menu slabs
    for i, (label, ic) in enumerate(MENU):
        sel = i == 0
        y = 88 + i * 19 - (2 if sel else 0)
        x = 20 if sel else 12
        w = 120 if sel else 110
        fy, K = slab(c, x, y, w, 11, top=2, jag=4 if sel else 3, seed=20 + i, moss=(i == 2), glow=halo if sel else None)
        if sel:
            menu_icon(c, ic, x + 4, fy)
            fancy_text(c, x + 19, fy, label, core, outline=None, sz=12)
            rune(c, 0, x + w - 10, fy + 3, body, glow='f')
            c.text(x + w - 14, fy + 1, lv, 'k', sz=10, align='r')
            # rune pointer + rising motes
            c.circle(x - 9, fy + 5, 7, 'j', dash=(2, 1))
            diamond(c, x - 9, fy + 5, 4, 'z'); diamond(c, x - 9, fy + 5, 3, 'j'); diamond(c, x - 9, fy + 5, 2, 'k'); c.px(x - 10, fy + 4, 'l')
            for (mx, my) in ((x + 26, y - 5), (x + 52, y - 7), (x + 84, y - 4), (x + 104, y - 8), (x + 10, y - 9)): c.px(mx, my, core)
            c.px(x + 53, y - 8, 't')
        else:
            menu_icon(c, ic, x + 4, fy)
            c.text(x + 19, fy, label, 'u', sz=12)
            rune(c, i + 1, x + w - 10, fy + 3, 'w')
    # ---- coin stone
    cw2 = 16 + c.tw(COINS, 10) + 8
    fy, _ = slab(c, 312 - cw2, 5, cw2, 10, top=2, jag=3, seed=40)
    coin_icon(c, 312 - cw2 + 4, fy, big=True)
    c.text(312 - 6, fy, COINS, 't', sz=10, align='r')
    # ---- key hints
    x, y = 12, 165
    x += keycap(c, x, y, arrow='up') + 2
    x += keycap(c, x, y, arrow='down') + 3
    fancy_text(c, x, y + 2, '选择', 't', outline='z', sz=10); x += c.tw('选择', 10) + 9
    x += keycap(c, x, y, 'Enter') + 3
    fancy_text(c, x, y + 2, '确认', 't', outline='z', sz=10)

if __name__ == '__main__':
    for t in ('dungeon', 'sky'):
        c = Canvas(); draw_bg(c, t); draw(c, t); c.save(f'{PROP}/out2/_s2_{t}.png')
