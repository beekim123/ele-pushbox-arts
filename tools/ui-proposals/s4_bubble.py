"""S4 梦泡糖霜 — pearly soap-bubble panels, sticker outlines, floating bubbles carrying things."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from l2_common import *

def bubble_panel(c, x, y, w, h, r=6, body='t', shade='u', sheen=True):
    M = round_mask(x, y, w, h, r)
    drop_shadow(c, grow(M, 1), 2, 3, 9)
    paint(c, grow(M, 1), 'z')
    paint(c, M, 'B')
    I = round_mask(x + 1, y + 1, w - 2, h - 2, r - 1)
    paint(c, I, body)
    # soft bottom shade band
    for (a, b) in I:
        if (a, b + 3) not in I and BAYER[b % 4][a % 4] < 10: c.px(a, b, shade)
        if (a, b + 2) not in I: c.px(a, b, shade)
    if sheen:
        # iridescent sheen arcs near top-left (cyan + pink) and gloss dots
        for k in range(min(w // 3, 26)):
            c.px(x + r + 2 + k, y + 2, 's' if k < 12 else 'D')
        for k in range(min(h // 3, 10)):
            c.px(x + 2, y + r + 2 + k, 's')
        c.px(x + 3, y + 3, 't'); c.rect(x + r - 1, y + 3, 2, 1, 't')
    return I

def pill(c, x, y, w, h, body, hi, lo, edge='B', outer='z'):
    M = round_mask(x, y, w, h, h // 2)
    if outer: paint(c, grow(M, 1), outer)
    paint(c, M, edge)
    I = round_mask(x + 1, y + 1, w - 2, h - 2, (h - 2) // 2)
    paint(c, I, body)
    for (a, b) in I:
        if (a, b - 1) not in I: c.px(a, b, hi)
        elif (a, b + 1) not in I: c.px(a, b, lo)
    return I

def bubble(c, cx, cy, r, sheen='s', inner=None):
    c.circle(cx, cy, r, 'u')
    if r >= 4:
        for (a, b) in [(cx - r + 1, cy - 1), (cx - r + 1, cy), (cx - 1, cy - r + 1), (cx, cy - r + 1)]: c.px(a, b, sheen)
    c.px(cx - r // 2, cy - r // 2, 't')
    if r >= 5: c.px(cx - r // 2 + 1, cy - r // 2, 't')
    c.px(cx + r // 2, cy + r // 2 + (1 if r > 4 else 0), 'D')

def star(c, x, y, col='l', edge='z'):
    R = rows("""
..#..
..#..
#####
.###.
.#.#.""")
    P = {(x + i, y + j) for j, r in enumerate(R) for i, ch in enumerate(r) if ch == '#'}
    for (a, b) in P:
        for dx, dy in N8:
            if (a + dx, b + dy) not in P: c.px(a + dx, b + dy, edge)
    for (a, b) in P: c.px(a, b, col)

def keycap(c, x, y, label=None, arrow=None):
    w = 11 if arrow else c.tw(label, 10) + 8
    pill(c, x, y, w, 11, 'D', 'E', 'C', edge='B', outer=None)
    if arrow: glyph(c, ARROW[arrow + '5'], x + 3, y + 4, 't')
    else: c.text(x + w // 2, y + 1, label, 't', sz=10, align='c')
    return w

def draw(c, theme):
    ch, name, lv = cur_text(theme)
    # ---- floating bubbles carrying things
    bubble(c, 128, 16, 9); c.blit(sprite('obj.crate_wood'), 120, 8) if False else None
    # tiny crate inside bubble (scaled 1/2 look-alike)
    c.rect(124, 13, 8, 7, 'e'); c.frame(124, 13, 8, 7, 'f'); c.line(125, 18, 130, 14, 'd'); c.hline(125, 14, 6, 'd')
    bubble(c, 128, 16, 9)
    bubble(c, 140, 36, 5); c.blit(rows("""
.##.##.
#######
#######
.#####.
..###..
...#..."""), 137, 33, recolor={'#': 'i'})
    bubble(c, 140, 36, 5)
    bubble(c, 6, 46, 3)
    star(c, 116, 34, 'l')
    # ---- title (sticker letters)
    fancy_text(c, 12, 8, TITLE, 't', outline='B', outline2='z', shadow='C', sz=12, scale=2, sdir=(0, 2), diag=True, spacing=2)
    pill(c, 14, 36, c.tw(TITLE_EN, 10) + 14 + 7, 11, 'C', 'D', 'B')
    fancy_text(c, 21, 36, TITLE_EN, 't', outline=None, sz=10, spacing=1)
    fancy_text(c, 13, 51, TAG, 't', outline='B', outline2='z', sz=10)
    # ---- current chapter bubble chip
    cw = 26 + c.tw('当前', 10) + 4 + c.tw(ch + ' · ' + name, 12) + 10
    pill(c, 12, 66, cw, 15, 't', 't', 'u')
    c.disc(21, 73, 9, 'z'); c.disc(21, 73, 8, 'B'); c.disc(21, 73, 7, 'E')
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), 13, 65)
    c.text(34, 69, '当前', 'C', sz=10)
    c.text(34 + c.tw('当前', 10) + 4, 68, ch + ' · ' + name, 'B', sz=12)
    # ---- menu bubble panel
    mx, my, mw, mh = 12, 88, 132, 68
    bubble_panel(c, mx, my, mw, mh, r=7)
    for i, (label, ic) in enumerate(MENU):
        ry = my + 6 + i * 15
        if i == 0:
            pill(c, mx + 6, ry - 1, mw - 12, 15, 'C', 'D', 'B', edge='B', outer=None)
            c.px(mx + 12, ry + 1, 't'); c.px(mx + 13, ry + 1, 't')
            menu_icon(c, ic, mx + 14, ry + 1)
            fancy_text(c, mx + 30, ry + 1, label, 't', outline=None, sz=12)
            fancy_text(c, mx + mw - 14, ry + 2, lv, 'l', outline=None, sz=10, align='r')
            star(c, mx - 4, ry + 3, 'l')
        else:
            menu_icon(c, ic, mx + 14, ry + 1)
            c.text(mx + 30, ry + 1, label, 'B', sz=12)
    # ---- coin pill
    cw2 = 16 + c.tw(COINS, 10) + 10
    pill(c, 314 - cw2, 6, cw2, 13, 't', 't', 'u')
    coin_icon(c, 314 - cw2 + 4, 8, big=True)
    c.text(314 - 7, 7, COINS, 'B', sz=10, align='r')
    # ---- key hints
    x, y = 12, 165
    hw = 11 + 1 + 11 + 3 + c.tw('选择', 10) + 8 + c.tw('Enter', 10) + 8 + 3 + c.tw('确认', 10) + 12
    pill(c, 9, y - 2, hw, 15, 't', 't', 'u')
    x = 14
    x += keycap(c, x, y, arrow='up') + 1
    x += keycap(c, x, y, arrow='down') + 3
    c.text(x, y + 1, '选择', 'B', sz=10); x += c.tw('选择', 10) + 8
    x += keycap(c, x, y, 'Enter') + 3
    c.text(x, y + 1, '确认', 'B', sz=10)

if __name__ == '__main__':
    for t in ('cosmos', 'sky'):
        c = Canvas(); draw_bg(c, t); draw(c, t); c.save(f'{PROP}/out2/_s4_{t}.png')
