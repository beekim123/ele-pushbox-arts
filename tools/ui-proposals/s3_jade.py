"""S3 祥云玉简 — jade panels, gold fret trim, lacquer title plaque, red tassel (Eastern fantasy)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from l2_common import *

HUI = rows("""
#####
#...#
#.#.#
#...#
#####""")

XY = [r for r in rows("""
.....oooo.........
...oollllo..oooo..
..olkkkkkloollllo.
.olkjjjjkkllkkkklo
.okjkkkkjkkkjjjjko
.okjkjjkjkkjkkkjko
.okjkkjjkkkjkjjjko
..okjkkkkjkkkkkoo.
...oooooooooooo...
""")]

def cloud_motif(c, x, y, flip=False, recolor=None):
    rc = {'o': 'z'}
    if recolor: rc.update(recolor)
    c.blit(XY, x, y, flip=flip, recolor=rc)

def jade_panel(c, x, y, w, h, body='o', hui=True):
    M = round_mask(x, y, w, h, 3)
    drop_shadow(c, M, 2, 3, 9)
    paint(c, M, 'z')
    G = round_mask(x + 1, y + 1, w - 2, h - 2, 2)
    bevel(c, G, 'l', 'j', mid='k')
    paint(c, round_mask(x + 2, y + 2, w - 4, h - 4, 1), 'f')
    B = rect_mask(x + 3, y + 3, w - 6, h - 6)
    paint(c, B, body)
    c.hline(x + 3, y + 3, w - 6, 'n')
    c.hline(x + 3, y + h - 4, w - 6, 'p')
    # polish glints
    for k in range(5): c.px(x + 8 + k, y + 8 - k, 'n') if k < 5 else None
    for k in range(3): c.px(x + 12 + k, y + 8 - k, 'n')
    if hui:
        ix, iy, iw, ih = x + 5, y + 5, w - 10, h - 10
        for xx in range(ix + 6, ix + iw - 6):
            if xx % 2 == 0: c.px(xx, iy, 'k'); c.px(xx, iy + ih - 1, 'j')
        for yy in range(iy + 6, iy + ih - 6):
            if yy % 2 == 0: c.px(ix, yy, 'k'); c.px(ix + iw - 1, yy, 'j')
        for (cx, cy) in ((ix, iy), (ix + iw - 5, iy), (ix, iy + ih - 5), (ix + iw - 5, iy + ih - 5)):
            glyph(c, HUI, cx, cy, 'k')
    return (x + 3, y + 3, w - 6, h - 6)

def jade_chip(c, x, y, w, h=14):
    M = round_mask(x, y, w, h, 3)
    drop_shadow(c, M, 1, 2, 8)
    paint(c, M, 'z')
    bevel(c, round_mask(x + 1, y + 1, w - 2, h - 2, 2), 'l', 'j', mid='k')
    paint(c, round_mask(x + 2, y + 2, w - 4, h - 4, 1), 'o')
    c.hline(x + 3, y + 2, w - 6, 'n')

def tassel(c, x, y, L=12):
    """red knot + tassel hanging from (x, y)"""
    c.vline(x, y, 4, 'h'); c.vline(x + 1, y, 4, 'g')
    diamond(c, x, y + 7, 4, 'z'); diamond(c, x, y + 7, 3, 'h'); diamond(c, x, y + 7, 2, 'i')
    c.px(x - 1, y + 6, 'D'); c.px(x, y + 7, 'h'); c.px(x, y + 5, 'D')
    c.rect(x - 2, y + 12, 5, 2, 'k'); c.hline(x - 2, y + 12, 5, 'l'); c.frame(x - 3, y + 11, 7, 4, 'z')
    for i in range(-2, 3):
        ln = L - abs(i) * 2 + (i % 2)
        c.vline(x + i, y + 15, ln, 'i' if i % 2 == 0 else 'h')
        c.px(x + i, y + 15 + ln, 'z')
    c.vline(x - 3, y + 15, L - 4, 'z'); c.vline(x + 3, y + 15, L - 4, 'z')

def plaque(c, x, y, w, h):
    M = rect_mask(x, y, w, h)
    for p in ((x, y), (x + w - 1, y), (x, y + h - 1), (x + w - 1, y + h - 1)): M.discard(p)
    drop_shadow(c, M, 2, 3, 9)
    paint(c, M, 'z')
    R = rect_mask(x + 1, y + 1, w - 2, h - 2)
    paint(c, R, 'h'); c.hline(x + 1, y + 1, w - 2, 'i'); c.vline(x + 1, y + 1, h - 2, 'i'); c.hline(x + 2, y + h - 2, w - 3, 'g')
    c.rect(x + 3, y + 3, w - 6, h - 6, 'z')
    c.rect(x + 4, y + 4, w - 8, h - 8, 'g')
    c.hline(x + 4, y + 4, w - 8, 'B')
    for (sx, sy) in ((x + 2, y + 2), (x + w - 3, y + 2), (x + 2, y + h - 3), (x + w - 3, y + h - 3)):
        c.px(sx, sy, 'l')

def keycap(c, x, y, label=None, arrow=None):
    w = 11 if arrow else c.tw(label, 10) + 7
    M = round_mask(x, y, w, 11, 2)
    paint(c, M, 'z')
    paint(c, round_mask(x + 1, y + 1, w - 2, 9, 1), 'n')
    c.hline(x + 2, y + 1, w - 4, 'm'); c.hline(x + 2, y + 9, w - 4, 'o')
    if arrow: glyph(c, ARROW[arrow + '5'], x + 3, y + 4, 'l')
    else: c.text(x + w // 2, y + 1, label, 'l', sz=10, align='c')
    return w

def draw(c, theme):
    ch, name, lv = cur_text(theme)
    # ---- title plaque (匾)
    px_, py_, pw, ph = 12, 6, 104, 34
    plaque(c, px_, py_, pw, ph)
    fancy_text(c, px_ + pw // 2, py_ + 7, TITLE, 'k', top='l', bottom='j', outline='z', sz=12, scale=2, align='c', diag=False, spacing=3)
    cloud_motif(c, px_ + pw - 12, py_ - 5)
    cloud_motif(c, px_ - 7, py_ + ph - 6, flip=True)
    fancy_text(c, px_ + pw // 2, py_ + ph + 2, '· ' + TITLE_EN + ' ·', 'l', outline='z', sz=10, align='c', spacing=1)
    fancy_text(c, 13, 51, TAG, 'c', outline='z', sz=10)
    # ---- current chapter chip
    cw = 24 + c.tw('当前', 10) + 4 + c.tw(ch + ' · ' + name, 12) + 8
    jade_chip(c, 12, 65, cw, 15)
    c.disc(19, 72, 9, 'z'); c.disc(19, 72, 8, 'k'); c.disc(19, 72, 7, 'f')
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), 11, 64)
    c.text(32, 68, '当前', 'm', sz=10)
    c.text(32 + c.tw('当前', 10) + 4, 67, ch + ' · ' + name, 't', sz=12)
    # ---- menu panel
    mx, my, mw, mh = 12, 86, 132, 70
    jade_panel(c, mx, my, mw, mh)
    for i, (label, ic) in enumerate(MENU):
        ry = my + 7 + i * 14
        if i == 0:
            # jade slip highlight with gold end caps
            c.rect(mx + 8, ry, mw - 16, 13, 'z')
            c.rect(mx + 9, ry + 1, mw - 18, 11, 'n'); c.hline(mx + 9, ry + 1, mw - 18, 'm'); c.hline(mx + 9, ry + 11, mw - 18, 'o')
            for ex in (mx + 9, mx + mw - 12):
                c.rect(ex, ry + 1, 3, 11, 'k'); c.vline(ex, ry + 1, 11, 'l'); c.vline(ex + 2, ry + 1, 11, 'j')
            menu_icon(c, ic, mx + 15, ry + 1)
            fancy_text(c, mx + 30, ry + 1, label, 't', outline=None, sz=12)
            fancy_text(c, mx + mw - 15, ry + 2, lv, 'l', outline=None, sz=10, align='r')
            # gold pointer
            for k in range(5): c.vline(mx + 1 + k, ry + 2 + k, 9 - 2 * k, 'k' if k else 'l')
            for k in range(5): c.px(mx + k, ry + 1 + k, 'z'); c.px(mx + k, ry + 11 - k, 'z')
            c.vline(mx, ry + 1, 11, 'z'); c.px(mx + 6, ry + 6, 'z'); c.px(mx + 5, ry + 6, 'j')
        else:
            menu_icon(c, ic, mx + 15, ry + 1)
            c.text(mx + 30, ry + 1, label, 'c', sz=12)
    tassel(c, mx + mw - 7, my + mh - 1, 9)
    # ---- coin chip
    cw2 = 16 + c.tw(COINS, 10) + 8
    jade_chip(c, 314 - cw2, 6, cw2, 14)
    coin_icon(c, 314 - cw2 + 4, 8, big=True)
    c.text(314 - 6, 8, COINS, 't', sz=10, align='r')
    cloud_motif(c, 314 - cw2 - 13, 13, flip=True)
    # ---- key hints strip
    x, y = 12, 165
    hw = 11 + 1 + 11 + 3 + c.tw('选择', 10) + 8 + c.tw('Enter', 10) + 7 + 3 + c.tw('确认', 10) + 10
    jade_chip(c, 9, y - 2, hw, 15)
    x = 13
    x += keycap(c, x, y, arrow='up') + 1
    x += keycap(c, x, y, arrow='down') + 3
    c.text(x, y + 1, '选择', 'c', sz=10); x += c.tw('选择', 10) + 8
    x += keycap(c, x, y, 'Enter') + 3
    c.text(x, y + 1, '确认', 'c', sz=10)

if __name__ == '__main__':
    for t in ('forest', 'sky'):
        c = Canvas(); draw_bg(c, t); draw(c, t); c.save(f'{PROP}/out2/_s3_{t}.png')
