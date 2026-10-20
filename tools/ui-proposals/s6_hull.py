"""S6 星港舱板 — riveted hull plates with hazard-striped trim, LED station board, porthole emblem
(lobby skin for 第 6 章 深空星站 / cosmos)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import math
from l2_common import *

# ---------------------------------------------------------------- parts
def hazard_px(a, b): return 'k' if ((a + b) // 3) % 2 == 0 else 'z'   # same phase as the floor trim

def rivet(c, x, y):
    c.px(x, y, 'u'); c.px(x + 1, y + 1, 'x')

def hull(c, x, y, w, h, k=3, body='y', stripe=0, rivets=True, shadow=True, thick=False):
    """metal plate: black outline, gunmetal rim lit top-left (2 px when thick), dark inset;
    stripe = height of a hazard band laid over the top rim"""
    M = cham_mask(x, y, w, h, k)
    if shadow: drop_shadow(c, M, 2, 3, 9)
    paint(c, M, 'z')
    B = bevel(c, cham_mask(x + 1, y + 1, w - 2, h - 2, k - 1), 'v', 'x', mid='w')
    if thick:
        B = bevel(c, B, 'w', 'x', mid='w')
        I = shrink(B, 1); paint(c, B - I, 'z'); B = I
    paint(c, B, body)
    if stripe:
        for (a, b) in M:
            if y + 1 <= b < y + 1 + stripe and (a, b) not in B and (a - 1, b) in M and (a + 1, b) in M:
                c.px(a, b, hazard_px(a, b))
        if thick: c.hline(x + k, y + 1 + stripe, w - 2 * k, 'z')
    if rivets:
        o = 3 if thick else 2
        for (rx, ry) in ((x + o + k - 1, y + h - o - 1), (x + w - o - k, y + h - o - 1)):
            rivet(c, rx, ry)
    return B

def led_title(c, x, y, s, spacing=1, on=('l', 'k', 'j'), off='y', padx=2, pady=1):
    """station departure-board lettering: every font pixel becomes one lit 2x2 LED cell,
    unlit cells show as dim dots. Returns (w, h) of the LED field."""
    P = set(); cx = 0
    for ch in s:
        p, w = textset(c, ch, 12, 1)
        P |= {(a + cx, b) for (a, b) in p}; cx += w + spacing
    W = cx - spacing
    b0 = min(b for _, b in P); b1 = max(b for _, b in P)
    cols, rws = W + 2 * padx, (b1 - b0 + 1) + 2 * pady
    for i in range(cols):
        for j in range(rws):
            a, b = i - padx, j - pady + b0
            X, Y = x + 2 * i, y + 2 * j
            if (a, b) in P:
                c.px(X, Y, on[0]); c.px(X + 1, Y, on[1]); c.px(X, Y + 1, on[1]); c.px(X + 1, Y + 1, on[2])
            else:
                c.px(X, Y, off)
    return 2 * cols, 2 * rws

ROCKET = rows("""
...zzz.......
..zhiizzzzz..
zzzuuuuuuttz.
jkzuuqsquutiz
zzzvvvvvvuuz.
..zhiizzzzz..
...zzz.......""")

def porthole(c, cx, cy, r=9):
    c.disc(cx, cy, r + 1, 'z'); c.disc(cx, cy, r, 'w')
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if c.get(x, y) == 'w' and (x - cx) + (y - cy) < -r * 0.7: c.px(x, y, 'v')
    c.disc(cx, cy, r - 3, 'z'); c.disc(cx, cy, r - 4, 'y')
    for k in range(8):
        a = math.pi / 4 * k + math.pi / 8
        c.px(cx + int(round((r - 1.5) * math.cos(a))), cy + int(round((r - 1.5) * math.sin(a))), 'u')

def mini_planet(c, cx, cy, r=5):
    ca, sa = math.cos(math.radians(-18)), math.sin(math.radians(-18))
    def ring(front):
        for y in range(cy - 6, cy + 7):
            for x in range(cx - 12, cx + 13):
                u = (x - cx) * ca + (y - cy) * sa; v = -(x - cx) * sa + (y - cy) * ca
                e = (u / 10.5) ** 2 + (v / 3.0) ** 2
                if 0.55 < e <= 1.0 and ((v > 0) == front): c.px(x, y, 'k' if e > 0.78 else 'j')
    ring(False)
    c.disc(cx, cy, r + 1, 'z'); c.disc(cx, cy, r, 'C')
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if c.get(x, y) != 'C': continue
            q = (x - cx) + (y - cy)
            if q > 3: c.px(x, y, 'B')
            elif q < -5: c.px(x, y, 'D')
            elif (y - cy + 1) % 4 == 0: c.px(x, y, 'B')
    c.px(cx - 2, cy - 3, 't')
    ring(True)

def beacon(c, x, y):
    """red warning beacon sitting on a plate's top edge at (x, y)"""
    c.rect(x - 1, y - 2, 8, 3, 'z'); c.hline(x, y - 1, 6, 'w'); c.px(x, y - 1, 'v')
    c.rect(x + 1, y - 5, 4, 4, 'z'); c.rect(x + 2, y - 4, 2, 2, 'A'); c.px(x + 2, y - 4, 'D')
    for (dx, dy) in ((-1, -4), (6, -4), (2, -7), (3, -7)): c.px(x + dx, y + dy, 'h')

def keycap(c, x, y, label=None, arrow=None):
    """dark metal key with a cyan backlit legend"""
    w = 11 if arrow else c.tw(label, 10) + 7
    paint(c, cham_mask(x, y, w, 11, 2), 'z')
    paint(c, cham_mask(x + 1, y + 1, w - 2, 9, 1), 'x')
    c.hline(x + 2, y + 1, w - 4, 'w'); c.hline(x + 2, y + 9, w - 4, 'y')
    if arrow: glyph(c, ARROW[arrow + '5'], x + 3, y + 4, 's')
    else: c.text(x + w // 2, y + 1, label, 's', sz=10, align='c')
    return w

def sel_bar(c, x, y, w, h=14):
    S = cham_mask(x, y, w, h, 3)
    paint(c, grow(S, 1), 'z')
    body, top, bot = 'B', 'C', 'g'          # violet, echoing the nebula and the ringed planet
    paint(c, S, body)
    for (a, b) in S:
        if (a, b - 1) not in S: c.px(a, b, top)
        elif (a, b + 1) not in S: c.px(a, b, bot)
    # hazard caps at both ends
    for (a, b) in S:
        if a < x + 4 or a >= x + w - 4: c.px(a, b, hazard_px(a, b))
    return S

# ---------------------------------------------------------------- lobby
def draw(c, theme):
    ch, name, lv = cur_text(theme)
    # ---- LED station board
    bx, by = 10, 5
    fw, fh = 2 * (40 + 4), 2 * (11 + 2)
    hull(c, bx, by, fw + 6, fh + 6, k=3, body='z', rivets=False)
    led_title(c, bx + 3, by + 3, TITLE, spacing=2)
    mini_planet(c, bx + fw + 22, by + 14)
    for (sx, sy) in ((bx + fw + 10, by + 2), (bx + fw + 34, by + 26), (136, 44)): sparkle(c, sx, sy, 'u', 1, 't')
    # PORTITOR + tagline
    fancy_text(c, 14, 39, TITLE_EN, 's', outline='z', sz=10, spacing=1)
    w_en = sum(c.tw(chh, 10) + 1 for chh in TITLE_EN) - 1
    for k in range(3): c.rect(14 + w_en + 4 + k * 4, 43, 2, 2, 'r' if k < 2 else 'x')
    fancy_text(c, 13, 50, TAG, 'u', outline='z', sz=10)
    # ---- current chapter plate with porthole
    cw = 24 + c.tw('当前', 10) + 4 + c.tw(ch + ' · ' + name, 12) + 8
    hull(c, 14, 64, cw, 15, k=3, rivets=False)
    porthole(c, 20, 71, 10)
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), 12, 63)
    c.text(34, 68, '当前', 's', sz=10)
    c.text(34 + c.tw('当前', 10) + 4, 67, ch + ' · ' + name, 't', sz=12)
    # ---- menu panel
    mx, my, mw, mh = 12, 87, 134, 68
    hull(c, mx, my, mw, mh, k=5, body='y', stripe=3, thick=True)
    beacon(c, mx + mw - 20, my)
    for i, (label, ic) in enumerate(MENU):
        ry = my + 9 + i * 14
        if i == 0:
            sel_bar(c, mx + 6, ry - 1, mw - 12, 14)
            menu_icon(c, ic, mx + 12, ry, outline=None)
            fancy_text(c, mx + 27, ry, label, 't', outline=None, sz=12)
            fancy_text(c, mx + mw - 12, ry + 1, lv, 'l', outline=None, sz=10, align='r')
            c.blit(ROCKET, mx - 9, ry)
        else:
            menu_icon(c, ic, mx + 12, ry)
            c.text(mx + 27, ry, label, 'u', sz=12)
        if 0 < i < 3:
            for xx in range(mx + 12, mx + mw - 12, 4): c.px(xx, ry + 13, 'x')
    # ---- coin plate
    cw2 = 16 + c.tw(COINS, 10) + 8
    hull(c, 314 - cw2, 6, cw2, 14, k=3, rivets=False)
    coin_icon(c, 314 - cw2 + 4, 8, big=True)
    c.text(314 - 6, 8, COINS, 't', sz=10, align='r')
    # ---- key hints plate
    x, y = 12, 165
    hw = 11 + 1 + 11 + 3 + c.tw('选择', 10) + 8 + c.tw('Enter', 10) + 7 + 3 + c.tw('确认', 10) + 10
    hull(c, 9, y - 2, hw + 8, 15, k=3, rivets=False)
    for b in range(y, y + 11):
        for a in range(9 + hw - 2, 9 + hw + 5):
            c.px(a, b, hazard_px(a, b))
    x = 13
    x += keycap(c, x, y, arrow='up') + 1
    x += keycap(c, x, y, arrow='down') + 3
    c.text(x, y + 1, '选择', 'u', sz=10); x += c.tw('选择', 10) + 8
    x += keycap(c, x, y, 'Enter') + 3
    c.text(x, y + 1, '确认', 'u', sz=10)

if __name__ == '__main__':
    for t in ('cosmos', 'dungeon'):
        c = Canvas(); draw_bg(c, t); draw(c, t); c.save(f'{PROP}/out2/_s6_{t}.png', scale=2)
