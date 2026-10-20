"""S1 晶石琉璃 — faceted crystal-glass frames (cool cyan glass + violet gems)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from l2_common import *

def shard(c, x, y, h, w, hi='t', a='s', b='r', d='q', edge='z', top_frac=0.38):
    M = {}
    half_w = w // 2; cx = x + half_w; tj = max(1, int(h * top_frac))
    for j in range(h):
        hw = round(j / tj * half_w) if j < tj else round((h - 1 - j) / (h - tj) * half_w)
        for i in range(-hw, hw + 1):
            col = a if i < 0 else (b if i > 0 else hi)
            if j >= tj: col = {a: b, hi: a, b: d}[col]
            M[(cx + i, y + j)] = col
    for (p, q) in list(M):
        for dx, dy in N4:
            if (p + dx, q + dy) not in M: c.px(p + dx, q + dy, edge)
    for (p, q), col in M.items(): c.px(p, q, col)

def hshard(c, x, y, w, h, hi='t', a='s', b='r', d='q', edge='z'):
    """horizontal shard pointing right (cursor)"""
    M = {}; cy = y + h // 2; half = h // 2; tl = max(1, int(w * 0.55))
    for i in range(w):
        hh = round(i / tl * half) if i < tl else round((w - 1 - i) / (w - tl) * half)
        for j in range(-hh, hh + 1):
            col = a if j < 0 else (b if j > 0 else hi)
            if i >= tl: col = {a: hi, hi: a, b: d}[col]
            M[(x + i, cy + j)] = col
    for (p, q) in list(M):
        for dx, dy in N8:
            if (p + dx, q + dy) not in M: c.px(p + dx, q + dy, edge)
    for (p, q), col in M.items(): c.px(p, q, col)

def gem(c, cx, cy, kind='v'):
    hi, a, b, d = ('t', 'D', 'C', 'B') if kind == 'v' else ('t', 's', 'r', 'q')
    diamond(c, cx, cy, 3, 'z')
    diamond(c, cx, cy, 2, b)
    c.px(cx - 1, cy - 1, hi); c.px(cx, cy - 2, a); c.px(cx - 2, cy, a); c.px(cx - 1, cy, a); c.px(cx, cy - 1, a)
    c.px(cx + 1, cy + 1, d); c.px(cx, cy + 2, d); c.px(cx + 2, cy, d)

def panel(c, x, y, w, h, k=5, body='y', gems=True, facets=True):
    M = cham_mask(x, y, w, h, k)
    drop_shadow(c, M, 2, 3, 9)
    paint(c, M, 'z')
    R = cham_mask(x + 1, y + 1, w - 2, h - 2, k - 1)
    inner = bevel(c, R, 's', 'q', mid='r')
    B = cham_mask(x + 2, y + 2, w - 4, h - 4, max(0, k - 2))
    paint(c, B, body)
    # inner hairline + glass facets
    for (a, b) in B:
        if (a, b - 1) not in B and (a, b) in B: c.px(a, b, 'x')
    if facets:
        for off, L in ((0, 7), (4, 4)):
            for t in range(L):
                p = (x + w - 18 + off + t, y + 9 - t)
                if p in B: c.px(p[0], p[1], 'x')
    if gems:
        for (gx, gy) in ((x + k // 2 + 1, y + k // 2 + 1), (x + w - 2 - k // 2, y + k // 2 + 1),
                         (x + k // 2 + 1, y + h - 2 - k // 2), (x + w - 2 - k // 2, y + h - 2 - k // 2)):
            gem(c, gx, gy, 'v')
    return B

def plate(c, x, y, w, h, k=3, body='y'):
    M = cham_mask(x, y, w, h, k)
    drop_shadow(c, M, 1, 2, 8)
    paint(c, M, 'z')
    R = cham_mask(x + 1, y + 1, w - 2, h - 2, k - 1)
    bevel(c, R, 's', 'q', mid='r')
    paint(c, cham_mask(x + 2, y + 2, w - 4, h - 4, max(0, k - 2)), body)

def keycap(c, x, y, label=None, arrow=None):
    w = 11 if arrow else c.tw(label, 10) + 7
    M = cham_mask(x, y, w, 11, 2)
    paint(c, M, 'z')
    R = cham_mask(x + 1, y + 1, w - 2, 9, 1)
    paint(c, R, 'r'); c.hline(x + 2, y + 1, w - 4, 's'); c.hline(x + 2, y + 9, w - 4, 'q')
    paint(c, cham_mask(x + 2, y + 2, w - 4, 7, 0), 'q')
    c.hline(x + 2, y + 2, w - 4, 'r')
    if arrow: glyph(c, ARROW[arrow + '5'], x + 3, y + 4, 't')
    else: c.text(x + w // 2, y + 1, label, 't', sz=10, align='c')
    return w

def coin(c, x, y):
    coin_icon(c, x, y)

def draw(c, theme):
    ch, name, lv = cur_text(theme)
    # ---- floating shards around the title
    shard(c, 96, 6, 15, 7)
    shard(c, 106, 15, 9, 5, 't', 'D', 'C', 'B')
    shard(c, 6, 40, 7, 3, 't', 's', 'r', 'q')
    sparkle(c, 112, 9, 't', 1)
    # ---- title
    fancy_text(c, 13, 9, TITLE, 't', outline='s', outline2='z', shadow='q', sz=12, scale=2, sdir=(1, 2), diag=False, spacing=2)
    # PORTITOR line with gem dots
    c.hline(13, 37, 6, 'r'); diamond(c, 21, 37, 1, 's')
    fancy_text(c, 26, 34, TITLE_EN, 's', outline='z', sz=10, spacing=1)
    tw_ = 26 + sum(c.tw(chh, 10) + 1 for chh in TITLE_EN)
    diamond(c, tw_ + 2, 37, 1, 's'); c.hline(tw_ + 5, 37, 6, 'r')
    fancy_text(c, 13, 44, TAG, 'u', outline='z', sz=10)
    # ---- current chapter plate
    cw = 20 + c.tw('当前', 10) + c.tw(ch + ' · ' + name, 12) + 10
    plate(c, 20, 60, cw, 16, 3)
    gx, gy = 22, 68
    diamond(c, gx, gy, 12, 'z'); diamond(c, gx, gy, 11, 'q')
    for j in range(-11, 12):
        k = 11 - abs(j)
        c.px(gx - k, gy + j, 's' if j <= 0 else 'r'); c.px(gx + k, gy + j, 'r' if j <= 0 else 'q')
    diamond(c, gx, gy, 9, 'y')
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), gx - 8, gy - 8)
    c.px(gx, gy - 11, 't')
    c.text(40, 64, '当前', 'v', sz=10)
    c.text(40 + c.tw('当前', 10) + 4, 63, ch + ' · ' + name, 't', sz=12)
    # ---- menu panel
    px_, py_, pw, ph = 12, 82, 136, 72
    B = panel(c, px_, py_, pw, ph, 6)
    for i, (label, ic) in enumerate(MENU):
        ry = py_ + 6 + i * 15
        if i == 0:
            S = cham_mask(px_ + 6, ry, pw - 12, 14, 3)
            paint(c, S, 'r')
            S2 = cham_mask(px_ + 7, ry + 1, pw - 14, 12, 2)
            paint(c, S2, 'q')
            c.hline(px_ + 9, ry + 1, pw - 18, 's')
            c.hline(px_ + 9, ry + 12, pw - 18, 'y')
            for t in range(6): c.px(px_ + pw - 26 + t, ry + 11 - t * 2 // 1 if ry + 11 - t * 2 > ry + 1 else ry + 2, 'r')
            menu_icon(c, ic, px_ + 14, ry + 1, outline=None)
            c.text(px_ + 30, ry + 1, label, 't', sz=12)
            c.text(px_ + pw - 12, ry + 2, lv, 'l', sz=10, align='r')
            hshard(c, px_ - 6, ry + 1, 12, 11)
            sparkle(c, px_ - 7, ry - 1, 't', 1)
        else:
            menu_icon(c, ic, px_ + 14, ry + 1)
            c.text(px_ + 30, ry + 1, label, 'u', sz=12)
            if i < 3: pass
        if 0 < i < 3:
            for xx in range(px_ + 14, px_ + pw - 14, 3): c.px(xx, ry + 14, 'x')
    # crystal cluster growing from the panel's lower-right corner
    shard(c, 141, 131, 16, 7)
    shard(c, 149, 139, 11, 5, 't', 'D', 'C', 'B')
    shard(c, 134, 143, 9, 5)
    # ---- coin chip
    cw2 = 16 + c.tw(COINS, 10) + 8
    plate(c, 314 - cw2, 6, cw2, 14, 3)
    coin_icon(c, 314 - cw2 + 4, 8, big=True)
    c.text(314 - 5, 8, COINS, 't', sz=10, align='r')
    # ---- key hints
    x = 12; y = 163
    hw = 11 + 1 + 11 + 3 + c.tw('选择', 10) + 8 + c.tw('Enter', 10) + 7 + 3 + c.tw('确认', 10) + 10
    plate(c, 10, y - 2, hw, 15, 3)
    x = 15
    x += keycap(c, x, y, arrow='up') + 1
    x += keycap(c, x, y, arrow='down') + 3
    c.text(x, y + 1, '选择', 'u', sz=10); x += c.tw('选择', 10) + 8
    x += keycap(c, x, y, 'Enter') + 3
    c.text(x, y + 1, '确认', 'u', sz=10)

if __name__ == '__main__':
    for t in ('dungeon', 'sky'):
        c = Canvas(); draw_bg(c, t); draw(c, t); c.save(f'{PROP}/out2/_s1_{t}.png')
