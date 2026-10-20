"""B · 关卡内：暂停 / 提示 / 规则卡 / 对话 / 过关"""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from scenes import *

def ico(c, sid, i):
    return lambda x, y: c.blit(sprite(sid, i), x, y)

def menu_panel(c, x, y, w, title, items, sel=0, seps=(), rh=15, keys=None):
    keys = keys or {}
    h = 7 + 14 + 5 + len(items) * rh + 5
    panel(c, x, y, w, h, 6)
    panel_title(c, x, y + 7, w, title)
    ry0 = y + 7 + 14 + 5
    for i, (label, ic) in enumerate(items):
        ry = ry0 + i * rh
        if i == sel: sel_row(c, x + 6, ry, w - 12, rh - 1, cx=x - 6)
        if ic: ic(x + 13, ry + 1)
        c.text(x + 29, ry + 1, label, 't' if i == sel else 'u', sz=12)
        if label in keys:
            kx = x + w - 10 - (c.tw(keys[label], 10) + 7)
            keycap(c, kx, ry + 1, keys[label])
        if i in seps: hairline(c, x + 13, ry + rh - 1, w - 26)
    return h

def pause():
    c = level('M05'); level_hud(c, 'M05', '箱子替我站'); dim(c, 1)
    items = [('继续', ico(c, 'ui.menu_icons', 0)), ('提示', ico(c, 'ui.icons', 2)), ('重开', ico(c, 'ui.icons', 1)),
             ('跳过此关', ico(c, 'ui.icons', 7)), ('选关', ico(c, 'ui.menu_icons', 1)), ('设置', ico(c, 'ui.menu_icons', 2)),
             ('返回大厅', ico(c, 'ui.menu_icons', 3))]
    menu_panel(c, 96, 24, 128, '暂停', items, 0, seps=(3,), keys={'继续': 'Esc', '提示': 'H', '重开': 'R'})
    keybar(c, [(['up', 'down'], '选择'), (['Enter'], '确认'), (['Esc'], '返回')])
    return c

def hint():
    c = level('M05'); level_hud(c, 'M05', '箱子替我站')
    lines = ['把箱子推进压板坑，', '再从箱子上走过去。']
    w = 90 + 12; x, y, h = 54, 60, 33
    say_bubble(c, x, y, w, h, tail=(104, 97))
    for i, ln in enumerate(lines): c.text(x + 6, y + 6 + i * 12, ln, 't', sz=10)
    name_chip(c, x + 5, y - 7, '提示 3/3')
    # bottom strip: layer pips + actions
    plate(c, 4, 160, 312, 18, 3)
    c.blit(sprite('ui.icons', 2), 9, 163)
    pips(c, 24, 167, 3, 3, r=2)
    bx = 316 - 8
    _, kw = keybar(c, [(['Esc'], '返回')], bx, 164, align='r', frame=False)
    bx -= kw + 2
    w2 = c.tw('回到正确位置', 12) + 18
    button(c, bx - w2, 162, w2, '回到正确位置', sel=False, h=14)
    bx -= w2 + 5
    w1 = c.tw('演示', 12) + 18
    button(c, bx - w1, 162, w1, '演示', sel=True, h=14)
    return c

def rulecard():
    c = level('M03'); level_hud(c, 'M03', '挖开一格', rule=1, sand=0); dim(c, 1)
    src = load_ref('level.M03')
    x, y, w, h = 64, 34, 192, 116
    panel(c, x, y, w, h, 6)
    ic = lambda xx, yy: (c.rect(xx - 1, yy - 1, 9, 9, 'z'), c.blit(sprite('ui.class_icon', 1), xx, yy))
    panel_title(c, x, y + 7, w, '规则 · 夯土', icon=ic)
    window(c, x + 12, y + 30, src, 106, 84, 56, 44)
    para(c, x + 80, y + 30, '', 'u', 10, 100, lh=12,
         lines=['褐色带碎石的是夯土：', '可以挖，挖出一袋沙；', '挖掉下面的土，', '上面的土不会掉。'])
    bw = c.tw('知道了', 12) + c.tw('Esc', 10) + 7 + 3 + 20
    button(c, x + (w - bw) // 2, y + h - 24, bw, '知道了', sel=True, key='Esc')
    return c

def dialogue():
    c = level('M05'); level_hud(c, 'M05', '箱子替我站')
    c.blit(sprite('char.miner', 0), 146, 100, flip=True)
    c.blit(sprite('ui.emote', 0), 150, 87)
    # NPC speech
    txt = '年轻人，帮个忙：把这箱矿石送到黄金神庙去，路上小心水。'
    L = wrap(c, txt, 10, 140)
    x, y, w = 128, 40, 152; h = 10 + len(L) * 12
    say_bubble(c, x, y, w, h, tail=(156, 84))
    for i, ln in enumerate(L): c.text(x + 6, y + 6 + i * 12, ln, 't', sz=10)
    name_chip(c, x + 5, y - 7, '老矿工')
    glyph(c, ARROW['down5'], x + w - 11, y + h - 6, 's')
    # self thought
    t2 = '这扇门和地上的压板是同一个符号……'
    L2 = wrap(c, t2, 10, 90)
    tx, ty, tw_ = 10, 52, 102; th = 10 + len(L2) * 12
    think_bubble(c, tx, ty, tw_, th, dots=((92, ty + th + 4, 2), (98, ty + th + 9, 1)))
    for i, ln in enumerate(L2): c.text(tx + 6, ty + 5 + i * 12, ln, 'u', sz=10)
    # quest note
    parts = [('新委托：', 'l'), ('把矿石送到黄金神庙', 't')]
    tw2 = sum(c.tw(p, 10) for p, _ in parts) + 5 + 12 + 6
    toast(c, 160 - tw2 // 2, 150, tw2, parts, icon=lambda xx, yy: c.blit(sprite('ui.emote', 0), xx - 2, yy))
    return c

def complete():
    c = level_done(); level_hud(c, 'M05', '箱子替我站', lamps=(True,))
    sparkle(c, 168, 112, 't', 1); sparkle(c, 178, 118, 's', 1)
    dim(c, 1, (0, 20, 320, 180))
    x, y, w, h = 96, 26, 128, 74
    panel(c, x, y, w, h, 6)
    big_title(c, 160, y + 8, '过关', align='c')
    c.text(160, y + 36, '用了 8 步', 'u', sz=12, align='c')
    bw = 52
    button(c, x + 10, y + 53, bw, '下一关', sel=True)
    button(c, x + w - 10 - bw, y + 53, bw, '选关')
    keybar(c, [(['left', 'right'], '选择'), (['Enter'], '确认')])
    return c

SCREENS = [('暂停', pause), ('提示', hint), ('规则卡', rulecard), ('对话', dialogue), ('过关', complete)]

if __name__ == '__main__':
    from PIL import Image
    ims = []
    for name, fn in SCREENS:
        c = fn(); c.save(f'{PROP}/fixed/out/b_{fn.__name__}.png', 2)
        ims.append(Image.open(f'{PROP}/fixed/out/b_{fn.__name__}.png'))
    W = 640 * 2 + 16; Hh = 368 * 3
    out = Image.new('RGB', (W, Hh), (0, 0, 0))
    for i, im in enumerate(ims): out.paste(im, ((i % 2) * 656, (i // 2) * 368))
    out.save(PROP + '/fixed/out/_b.png'); print('ok')
