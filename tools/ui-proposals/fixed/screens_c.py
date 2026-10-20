"""C · 渡口与配送：转盘 / 商店 / 配送 HUD / 配送暂停 / 结算 / 失败 / 确认框"""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from scenes import *
from screens_b import menu_panel, ico

MM = {"cols": 4, "rows": 3, "cur": 4, "rooms": [
    {"index": 0, "x": 3, "y": 0, "role": "gate", "seen": True}, {"index": 1, "x": 2, "y": 0, "role": "room", "seen": True},
    {"index": 2, "x": 2, "y": 1, "role": "station", "seen": True}, {"index": 3, "x": 2, "y": 2, "role": "room", "seen": True},
    {"index": 4, "x": 1, "y": 2, "role": "room", "seen": True}, {"index": 5, "x": 0, "y": 2, "role": "home", "seen": False}]}

def hub_bg(n=2):
    c = lobby('dungeon', False); dim(c, n); return c

def reel(c, x, y, w, h, items, sel=False, step=20):
    """vertical reel window; items = [(sid, frame)] prev, cur, next"""
    M = cham_mask(x - 2, y - 2, w + 4, h + 4, 3)
    drop_shadow(c, M, 2, 3, 9); paint(c, M, 'z')
    bevel(c, cham_mask(x - 1, y - 1, w + 2, h + 2, 2), 's' if sel else 'w', 'q' if sel else 'y', mid='r' if sel else 'x')
    I = cham_mask(x, y, w, h, 1)
    paint(c, I, 'y')
    cy = y + h // 2
    c.rect(x, cy - 13, w, 26, 'x'); c.hline(x, cy - 13, w, 'w'); c.hline(x, cy + 12, w, 'y')
    sub = Canvas(w, h, 'y')
    for k, (sid, fr) in enumerate(items):
        f = sprite(sid, fr); fw, fh = len(f[0]), len(f)
        off = (k - 1) * (fh + 8 if fh > 16 else step + 4)
        tmp = Canvas(fw, fh, '.')
        sub.blit(f, w // 2 - fw // 2, h // 2 - fh // 2 + off)
        if k != 1: dim(sub, 2, (0, max(0, h // 2 - fh // 2 + off), w, min(h, h // 2 + fh // 2 + off + 1)))
    for (a, b) in I:
        v = sub.g[b - y][a - x]
        if v != 'y': c.px(a, b, v)
    # glass glints
    c.px(x + 2, cy - 11, 't'); c.px(x + 3, cy - 11, 's')
    if sel:
        hshard(c, x - 12, cy - 5, 10, 11)
        # mirrored shard on the right
        S = Canvas(10, 13, '.'); hshard(S, 0, 1, 10, 11)
        c.blit([r[::-1] for r in [''.join(S.g[j][i] for i in range(10)) for j in range(13)]], x + w + 2, cy - 6)

def reels():
    c = hub_bg(2)
    big_title(c, 14, 7, '今天送什么？')
    # lucky cat on a crystal plinth
    plate(c, 6, 118, 50, 8, 2)
    c.blit(sprite('char.lucky_cat', 0), 14, 87)
    x, y, w, h = 64, 36, 248, 80
    panel(c, x, y, w, h, 6)
    lx, rx = x + 52, x + w - 52
    c.text(lx, y + 6, '货物', 'v', sz=10, align='c')
    c.text(rx, y + 6, '收件人', 'v', sz=10, align='c')
    reel(c, lx - 18, y + 18, 36, 44, [('cargo.vase', 0), ('cargo.letter', 0), ('cargo.ice_cream', 0)], sel=True)
    reel(c, rx - 18, y + 18, 36, 44, [('avatar.zombie', 0), ('avatar.old_miner', 0), ('avatar.goblin_smith', 0)])
    c.text(lx, y + 65, '信件', 't', sz=12, align='c')
    c.text(rx, y + 65, '老矿工', 't', sz=12, align='c')
    mx = x + w // 2
    c.blit(sprite('ui.delivery_icons', 0), mx - 8, y + 26)
    c.text(mx, y + 42, '×1.5', 'l', sz=10, align='c')
    for k in range(3): c.px(mx - 30 + k * 4, y + 40, 'w'); c.px(mx + 22 + k * 4, y + 40, 'w')
    # rules
    ix, iy, iw = 12, 121, 300
    panel(c, ix, iy, iw, 38, 4, gems=False, facets=False)
    rich(c, ix + 9, iy + 4, [('信件', 't'), (' · 很轻；石牢里没有特别的规矩', 'u')])
    rich(c, ix + 9, iy + 15, [('老矿工', 't'), (' · 在家门口等你', 'u')])
    c.blit(sprite('ui.delivery_icons', 0), ix + 6, iy + 23)
    c.text(ix + 18, iy + 26, '老矿工喜欢信件：小费 ×1.5', 'l', sz=10)
    keybar(c, [(['left', 'right'], '选滚轮'), (['R'], '重转券 ×1'), (['Enter'], '出发')])
    return c

def room_dim(n=2, hud=True):
    c = room()
    if hud: delivery_hud(c, mm=MM)
    dim(c, n); return c

def price(c, xr, y, v, col='t', coin=True):
    c.text(xr, y, v, col, sz=10, align='r')
    if coin: coin_icon(c, xr - c.tw(v, 10) - 9, y)

def shop():
    c = room_dim(2, hud=False)
    c.blit(sprite('char.turtle_keeper', 0), 22, 122)
    lines = ['来了？先歇口气，', '回你一颗心。']
    say_bubble(c, 6, 82, 92, 30, tail=(40, 118))
    for i, ln in enumerate(lines): c.text(12, 88 + i * 12, ln, 't', sz=10)
    name_chip(c, 11, 75, '龟掌柜')
    x, y, w, h = 106, 6, 208, 150
    panel(c, x, y, w, h, 6)
    c.text(x + 10, y + 7, '龟掌柜的货架', 't', sz=12)
    coin_chip(c, x + w - 8, y + 6, '45')
    divider(c, x + 8, y + 24, w - 16, mid=None)
    goods = [('sandbag', '沙袋', '剩 5', '10', 'ok'), ('first_aid', '急救包', '剩 1', '50', 'poor'), ('rope_ladder', '绳梯', '卖完了', '25', 'out')]
    for i, (iid, name, left, pr, st) in enumerate(goods):
        ry = y + 29 + i * 21
        if i == 0: sel_row(c, x + 6, ry, w - 12, 20, cx=x - 7)
        tmp = Canvas(16, 16, '.'); 
        f = sprite('item.' + iid, 0)
        if st == 'out':
            c.blit(f, x + 12, ry + 2, recolor={k: DARK.get(DARK.get(k, k), k) for k in PALETTE})
        else: c.blit(f, x + 12, ry + 2)
        c.text(x + 32, ry + 4, name, 't' if i == 0 else ('w' if st == 'out' else 'u'), sz=12)
        c.text(x + w - 56, ry + 6, left, 'w' if st == 'out' else 'v', sz=10, align='r')
        col = {'ok': 'l', 'poor': 'i', 'out': 'w'}[st]
        c.text(x + w - 12, ry + 6, pr, col, sz=10, align='r')
        if st == 'out':
            c.blit(rows("""
.zzzzz.
zxwwwxz
zwxxxyz
zwxxxyz
zwxxxyz
zxyyyyz
.zzzzz."""), x + w - 12 - c.tw(pr, 10) - 9, ry + 6)
        else: coin_icon(c, x + w - 12 - c.tw(pr, 10) - 9, ry + 6)
        if i == 1: hairline(c, x + 12, ry + 20, w - 24)
    divider(c, x + 8, y + 95, w - 16, mid=None)
    c.text(x + 11, y + 101, '直接加进沙袋，最多 9 袋。', 'u', sz=10)
    # bag
    by = y + h - 30
    c.text(x + 11, by + 5, '背包', 'v', sz=10)
    for k in range(3):
        slot(c, x + 36 + k * 19, by, 18)
    c.blit(sprite('item.first_aid', 0), x + 37, by + 1)
    c.blit(sprite('item.sandbag', 0), x + 104, by + 1)
    c.text(x + 120, by + 5, '×2', 't', sz=10)
    keybar(c, [(['up', 'down'], '选择'), (['Enter'], '买'), (['Esc'], '离开')], x=106, y=163)
    return c

def dhud():
    c = room(); delivery_hud(c, mm=MM); return c

def x_icon(c, x, y):
    for k in range(8):
        c.px(x + 2 + k, y + 2 + k, 'i'); c.px(x + 2 + k, y + 9 - k, 'i')
        c.px(x + 3 + k, y + 2 + k, 'h'); c.px(x + 3 + k, y + 9 - k, 'h')

def dpause():
    c = room_dim(1)
    items = [('继续', ico(c, 'ui.menu_icons', 0)), ('重来这个房间', ico(c, 'ui.icons', 1)),
             ('放弃这一单', lambda x, y: x_icon(c, x - 1, y)), ('设置', ico(c, 'ui.menu_icons', 2)), ('返回大厅', ico(c, 'ui.menu_icons', 3))]
    menu_panel(c, 92, 34, 136, '暂停', items, 0, seps=(2,), keys={'继续': 'Esc'})
    keybar(c, [(['up', 'down'], '选择'), (['Enter'], '确认'), (['Esc'], '返回')])
    return c

def settlement():
    c = room_dim(2, hud=False)
    big_title(c, 160, 6, '送到了！', align='c')
    c.text(262, 14, '评级', 'v', sz=10)
    rating_badge(c, 296, 18, 'A')
    # recipient
    card(c, 8, 62, 82, 74, 4)
    say_bubble(c, 4, 38, 90, 18, tail=(49, 64))
    c.text(9, 43, '哎呀，是我的信！', 't', sz=10)
    portrait(c, 35, 68, 'avatar.old_miner')
    c.text(49, 100, '老矿工', 't', sz=12, align='c')
    c.blit(sprite('cargo.letter', 0), 22, 115); c.text(40, 118, '信件', 'u', sz=10)
    # ledger
    x, y, w, h = 98, 36, 214, 120
    panel(c, x, y, w, h, 6)
    L, M_, R_ = x + 12, x + 74, x + w - 12
    rowsy = [y + 7, y + 22, y + 37]
    c.text(L, rowsy[0], '完好度', 'u', sz=12)
    for k in range(3):
        c.rect(M_ + k * 9, rowsy[0] + 2, 8, 8, 'z'); c.rect(M_ + k * 9 + 1, rowsy[0] + 3, 6, 6, 'l')
        c.hline(M_ + k * 9 + 1, rowsy[0] + 3, 6, 't'); c.hline(M_ + k * 9 + 1, rowsy[0] + 8, 6, 'k')
    c.text(M_ + 31, rowsy[0] + 2, '3/3', 'v', sz=10)
    c.text(R_, rowsy[0], '×1.00', 'l', sz=12, align='r')
    c.text(L, rowsy[1], '用时', 'u', sz=12)
    c.text(M_, rowsy[1], '41.2 / 36.0 秒', 't', sz=12)
    c.text(R_, rowsy[1], '×1.36', 'l', sz=12, align='r')
    c.text(L, rowsy[2], '喜欢', 'u', sz=12)
    c.blit(sprite('ui.delivery_icons', 0), M_ - 2, rowsy[2] - 2)
    c.text(R_, rowsy[2], '×1.5', 'l', sz=12, align='r')
    divider(c, x + 8, y + 53, w - 16, mid=None)
    c.text(L, y + 58, '小费', 'u', sz=12)
    c.text(M_, y + 60, '基础 30', 'v', sz=10)
    glyph(c, ARROW['right5'], M_ + c.tw('基础 30', 10) + 5, y + 61, 'w')
    c.text(R_, y + 58, '61', 't', sz=12, align='r')
    c.text(L, y + 73, '路上拾到', 'u', sz=12)
    c.text(R_, y + 73, '25', 't', sz=12, align='r')
    c.hline(x + 10, y + 89, w - 20, 'q'); c.hline(x + 10, y + 91, w - 20, 'q')
    c.text(L, y + 99, '合计', 't', sz=12)
    tw_ = fancy_text(c, R_, y + 95, '86', 'l', outline='z', sz=12, scale=2, align='r', bottom='k', diag=False)
    coin_icon(c, R_ - tw_ - 13, y + 99, big=True)
    bw = 72
    button(c, 160 - bw - 6, 162, bw, '再送一单', sel=True)
    button(c, 166, 162, bw, '回大厅')
    return c

def settlement_fail():
    c = room_dim(2, hud=False)
    big_title(c, 160, 14, '这一单没送成', align='c', outline='C', shadow='B')
    x, y, w, h = 40, 52, 240, 78
    panel(c, x, y, w, h, 6)
    portrait(c, x + 12, y + 14, 'avatar.zombie')
    c.blit(sprite('cargo.vase', 1), x + 44, y + 26)
    tx = x + 70
    c.text(tx, y + 14, '心掉光了。', 't', sz=12)
    hx = tx + c.tw('心掉光了。', 12) + 4
    for k in range(3): c.blit(sprite('ui.delivery_icons', 1), hx + k * 10, y + 12)
    rich(c, tx, y + 34, [('路上拾到 30 金币，', 'u'), ('带回一半：', 'u')], sz=10)
    coin_icon(c, tx, y + 50, big=True)
    fancy_text(c, tx + 12, y + 47, '15', 'l', outline='z', sz=12, bottom='k')
    bw = 72
    button(c, 160 - bw - 6, 142, bw, '再送一单', sel=True)
    button(c, 166, 142, bw, '回大厅')
    return c

def confirm():
    c = room_dim(1)
    x, y, w, h = 70, 52, 180, 76
    panel(c, x, y, w, h, 6)
    panel_title(c, x, y + 8, w, '放弃这一单？', icon=lambda xx, yy: x_icon(c, xx - 2, yy - 3))
    c.text(160, y + 30, '路上拾到的金币只带回一半。', 'u', sz=10, align='c')
    bw = 64
    button(c, 160 - bw - 6, y + h - 26, bw, '放弃')
    button(c, 166, y + h - 26, bw, '再想想', sel=True)
    keybar(c, [(['left', 'right'], '选择'), (['Enter'], '确认'), (['Esc'], '返回')])
    return c

SCREENS = [('今天送什么？', reels), ('商店', shop), ('配送 HUD', dhud), ('配送暂停', dpause),
           ('结算', settlement), ('失败', settlement_fail), ('确认框（建议新增）', confirm)]

if __name__ == '__main__':
    from PIL import Image
    ims = []
    for name, fn in SCREENS:
        c = fn(); c.save(f'{PROP}/fixed/out/c_{fn.__name__}.png', 2)
        ims.append(Image.open(f'{PROP}/fixed/out/c_{fn.__name__}.png'))
    out = Image.new('RGB', (656 * 2, 368 * 4), (0, 0, 0))
    for i, im in enumerate(ims): out.paste(im, ((i % 2) * 656, (i // 2) * 368))
    out.save(PROP + '/fixed/out/_c.png'); print('ok')
