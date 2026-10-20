"""A · 大厅二级：选择章节 / 选关 / 设置"""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
from scenes import *
import s2_rune, s3_jade, s4_bubble

def backdrop():
    """dimmed lobby wall only: warm leftovers (flag, candle) folded into the wall tone"""
    c = lobby('dungeon', False); dim(c, 2)
    for row in c.g:
        last = 'z'
        for i, v in enumerate(row):
            if v is not None and v not in 'tuvwxyz': row[i] = last
            elif v is not None: last = v
    return c

_BG = {}
def bgr(theme):
    if theme not in _BG: _BG[theme] = lobby(theme)
    return _BG[theme]

CH = [  # theme, label, done, total, locked_need
    ('dungeon', '第 1 章', 4, 7, None), ('ruins', '第 2 章', 0, 7, None), ('cave', '第 3 章', None, 7, 5),
    ('forest', '第 4 章', None, 7, 4), ('sky', '第 5 章', None, 7, 5), ('cosmos', '扩展章', None, 7, 'later')]

def emblem_badge(c, cx, cy, theme, r=11):
    diamond(c, cx, cy, r + 1, 'z'); diamond(c, cx, cy, r, 'q')
    for j in range(-r, r + 1):
        k = r - abs(j)
        c.px(cx - k, cy + j, 's' if j <= 0 else 'r'); c.px(cx + k, cy + j, 'r' if j <= 0 else 'q')
    diamond(c, cx, cy, r - 2, 'y')
    c.blit(sprite('ui.theme_emblem', EMBLEM[theme]), cx - 8, cy - 8)

def lock_badge(c, cx, cy):
    diamond(c, cx, cy, 10, 'z'); diamond(c, cx, cy, 9, 'x'); diamond(c, cx, cy, 8, 'y')
    c.blit(sprite('ui.icons', 5), cx - 6, cy - 6)

def chapter_card(c, x, y, w, h, i, big=False):
    theme, lab, done, total, need = CH[i]
    k = 5 if big else 4
    panel(c, x, y, w, h, k, gems=big, facets=big)
    tw_, th = w - 12, (52 if big else 34)
    src = bgr(theme)
    sx = 232 - tw_ // 2; sy = 150 - th + (2 if big else 1)
    window(c, x + 6, y + 6, src, sx, sy, tw_, th)
    if need is not None:
        dim(c, 2, (x + 6, y + 6, x + 6 + tw_, y + 6 + th))
        lock_badge(c, x + w // 2, y + 6 + th // 2)
    if big:
        emblem_badge(c, x + 8, y + 8, theme)
        by = y + 6 + th + 6
        if need is None:
            pw = pips(c, x + 10, by + 2, done, total, r=2)
            c.text(x + w - 9, by + 1, f'{done} / {total}', 'l', sz=10, align='r')
    else:
        by = y + 6 + th + 4
        if need is None:
            c.text(x + w // 2, by, f'{done} / {total}', 'u', sz=10, align='c')
        else:
            c.text(x + w // 2, by, lab, 'w', sz=10, align='c')

def chapters():
    c = backdrop()
    header(c, 8, 5, '选择章节')
    # far / side cards first (smaller, darker), then the centre card
    chapter_card(c, 300, 44, 56, 54, 3); dim(c, 2, (298, 40, 320, 104))
    chapter_card(c, 18, 36, 72, 66, 0); dim(c, 1, (14, 32, 96, 108))
    chapter_card(c, 230, 36, 72, 66, 2); dim(c, 1, (226, 32, 304, 108))
    chapter_card(c, 98, 24, 124, 86, 1, big=True)
    c.text(161, 115, '第 2 章 · 黄金神庙', 'z', sz=12, align='c')
    c.text(160, 114, '第 2 章 · 黄金神庙', 't', sz=12, align='c')
    # page indicator
    n = len(CH); gap = 10; x0 = 160 - (n - 1) * gap // 2
    for j in range(n):
        cx = x0 + j * gap
        if j == 1: diamond(c, cx, 133, 3, 'z'); diamond(c, cx, 133, 2, 's'); c.px(cx, 132, 't')
        else: diamond(c, cx, 133, 2, 'z'); diamond(c, cx, 133, 1, 'w' if CH[j][4] is None else 'x')
    glyph(c, ARROW['left5'], x0 - 14, 131, 's'); glyph(c, ARROW['right5'], x0 + (n - 1) * gap + 12, 131, 's')
    plate(c, 20, 140, 280, 16, 3)
    c.text(160, 143, '浮起木箱、沉下铁箱，再用开关、升降台、传送阵和石桥。', 'u', sz=10, align='c')
    keybar(c, [(['left', 'right'], '选择'), (['Enter'], '进入'), (['Esc'], '返回')])
    return c

LV = [('M01', '一推到位', 'ok'), ('M02', '绕到另一边', 'ok'), ('M03', '挖开一格', 'skip'), ('M04', '一袋沙做台阶', 'ok'),
      ('M05', '箱子替我站', 'next'), ('M06', '沙与箱各有用', 'ok'), ('M07', '挖掉支撑', 'open')]

def levels():
    c = backdrop()
    header(c, 8, 5, '第 1 章 · 幽暗石牢', icon=lambda x, y: emblem(c, 'dungeon', x, y), line=False)
    w = 14 + c.tw('已通关 4 / 7', 10) + 8
    plate(c, 312 - w, 4, w, 14, 3)
    c.blit(sprite('ui.icons', 6), 312 - w + 4, 5)
    c.text(312 - 5, 6, '已通关 4 / 7', 'u', sz=10, align='r')
    x, y, pw, rh = 10, 26, 152, 16
    ph = 7 * rh + 10
    panel(c, x, y, pw, ph, 6)
    for i, (lid, name, st) in enumerate(LV):
        ry = y + 5 + i * rh
        sel = (lid == 'M05')
        if sel: sel_row(c, x + 5, ry, pw - 10, rh - 1, cx=x - 6)
        c.text(x + 12, ry + 4, lid, 'l' if sel else ('v' if st == 'ok' else 'u'), sz=10)
        c.text(x + 34, ry + 2, name, 't' if sel else 'u', sz=12)
        rx = x + pw - 10
        if st == 'ok': c.blit(sprite('ui.icons', 6), rx - 12, ry + 2)
        elif st == 'skip': c.blit(sprite('ui.icons', 7), rx - 12, ry + 2, recolor={'t': 'v', 'u': 'w'})
        elif st == 'next': tag(c, rx - c.tw('推荐', 10) - 6, ry + 2, '推荐')
        if i < 6 and not sel and LV[i + 1][0] != 'M05': hairline(c, x + 12, ry + rh - 1, pw - 24)
    # detail
    dx, dw = 168, 144
    panel(c, dx, y, dw, ph, 6)
    window(c, dx + 8, y + 8, load_ref('level.M05'), 90, 84, dw - 16, 46)
    ty = y + 8 + 46 + 6
    c.text(dx + 9, ty + 2, 'M05', 'l', sz=10)
    c.text(dx + 9 + c.tw('M05', 10) + 5, ty, '箱子替我站', 't', sz=12)
    divider(c, dx + 8, ty + 15, dw - 16, mid=None)
    para(c, dx + 9, ty + 20, '', 'u', 10, dw - 18, lh=12,
         lines=['压板被压住时对应的', '门打开；人得离开去过门，', '就让箱子替你压着。'])
    keybar(c, [(['up', 'down'], '选择'), (['Enter'], '进入'), (['Esc'], '返回')])
    return c

# --------------------------------------------------------------- settings
def ic_style(c, x, y, col):
    diamond(c, x + 3, y + 3, 3, col); c.px(x + 2, y + 2, 'z' if col != 'z' else 't'); c.px(x + 3, y + 3, 'y')
def ic_globe(c, x, y, col):
    for (a, b) in ((2, 0), (3, 0), (4, 0), (1, 1), (5, 1), (0, 2), (6, 2), (0, 3), (6, 3), (0, 4), (6, 4), (1, 5), (5, 5), (2, 6), (3, 6), (4, 6)):
        c.px(x + a, y + b, col)
    c.vline(x + 3, y + 1, 5, col); c.hline(x + 1, y + 3, 5, col)
def ic_note(c, x, y, col):
    c.vline(x + 4, y, 6, col); c.hline(x + 4, y, 3, col); c.px(x + 6, y + 1, col)
    c.rect(x + 2, y + 5, 3, 2, col)
def ic_speaker(c, x, y, col):
    c.rect(x, y + 2, 2, 3, col); c.vline(x + 2, y + 1, 5, col); c.vline(x + 3, y, 7, col)
    c.px(x + 5, y + 2, col); c.px(x + 5, y + 4, col); c.vline(x + 6, y + 1, 5, col) if False else None
    c.px(x + 6, y + 1, col); c.px(x + 6, y + 5, col); c.vline(x + 6, y + 2, 3, col)
def ic_scale(c, x, y, col):
    c.frame(x, y, 7, 7, col); c.rect(x + 2, y + 2, 3, 3, col)
def ic_env(c, x, y, col):
    c.px(x + 3, y, col); c.px(x + 3, y + 6, col); c.px(x, y + 3, col); c.px(x + 6, y + 3, col)
    c.rect(x + 2, y + 2, 3, 3, col); c.px(x + 1, y + 1, col); c.px(x + 5, y + 5, col); c.px(x + 5, y + 1, col); c.px(x + 1, y + 5, col)
def ic_grid(c, x, y, col):
    for k in (0, 3, 6): c.hline(x, y + k, 7, col); c.vline(x + k, y, 7, col)
def ic_unlock(c, x, y, col):
    c.rect(x, y + 3, 7, 4, col); c.vline(x + 1, y, 3, col); c.hline(x + 1, y, 4, col); c.vline(x + 4, y, 2, col)
    c.px(x + 3, y + 4, 'z'); c.px(x + 3, y + 5, 'z')
def ic_replay(c, x, y, col):
    for (a, b) in ((2, 0), (3, 0), (4, 0), (5, 1), (6, 2), (6, 3), (6, 4), (5, 5), (4, 6), (3, 6), (2, 6), (1, 5), (0, 4), (0, 3)):
        c.px(x + a, y + b, col)
    c.px(x + 1, y + 1, col); c.px(x, y + 1, col); c.px(x + 1, y + 2, col); c.px(x + 2, y + 3, col)
    c.rect(x + 3, y + 2, 1, 3, col); c.px(x + 4, y + 3, col)

def mini_style(c, x, y, k, sel=False):
    """46x30 swatch: home-map crop + that style's panel primitive + one glyph"""
    theme = ['cave', 'dungeon', 'ruins', 'sky'][k]
    src = bgr(theme)
    window(c, x, y, src, 200, 112, 44, 28, ring=(('s', 'q', 'r') if sel else ('w', 'y', 'x')))
    c.clip = (x, y, x + 44, y + 28)
    if k == 0:
        panel(c, x + 6, y + 5, 34, 19, 4, gems=True, facets=False)
        hshard(c, x + 1, y + 9, 8, 9)
        c.text(x + 18, y + 9, '晶', 't', sz=10)
    elif k == 1:
        s2_rune.slab(c, x + 5, y + 7, 34, 9, top=2, jag=3, seed=2, glow=None)
        s2_rune.rune(c, 1, x + 9, y + 11, 'k')
        c.text(x + 19, y + 9, '符', 'u', sz=10)
    elif k == 2:
        s3_jade.jade_panel(c, x + 5, y + 4, 34, 20, hui=False)
        c.text(x + 17, y + 9, '玉', 'l', sz=10)
    else:
        s4_bubble.bubble_panel(c, x + 5, y + 4, 34, 20, r=6)
        s4_bubble.star(c, x + 6, y + 9) if hasattr(s4_bubble, 'star') else None
        c.text(x + 18, y + 9, '泡', 'B', sz=10)
    c.clip = None

def settings():
    c = backdrop()
    header(c, 8, 5, '设置')
    x, y, pw, rh = 10, 24, 190, 14
    rows_ = [('语言', 'lang'), ('界面风格', 'style'), ('音乐', 'music'), ('音效', 'sfx'), ('窗口放大', 'scale'),
             ('环境效果', 'env'), ('显示网格', 'grid'), ('开放全部关卡', 'unlock'), ('重看引导', 'tut')]
    ph = len(rows_) * rh + 10
    panel(c, x, y, pw, ph, 6)
    icons = dict(lang=ic_globe, style=ic_style, music=ic_note, sfx=ic_speaker, scale=ic_scale, env=ic_env, grid=ic_grid, unlock=ic_unlock, tut=ic_replay)
    seps = {1, 3, 6}
    for i, (lab, key) in enumerate(rows_):
        ry = y + 5 + i * rh; sel = key == 'style'
        if sel: sel_row(c, x + 5, ry, pw - 10, rh - 1, cx=x - 6)
        col = 't' if sel else 'u'
        icons[key](c, x + 11, ry + 3, 's' if sel else 'v')
        c.text(x + 24, ry + 1, lab, col, sz=12)
        xr = x + pw - 11
        if key == 'lang': value_sel(c, xr, ry + 1, '简体中文')
        elif key == 'style': value_sel(c, xr, ry + 1, '晶石琉璃', sel=True)
        elif key in ('music', 'sfx'):
            c.text(xr, ry + 3, '8', 'u', sz=10, align='r')
            slider(c, xr - 10 - 49, ry + 3, 8)
        elif key == 'scale': value_sel(c, xr, ry + 1, '自动')
        elif key == 'env': value_sel(c, xr, ry + 1, '全部')
        elif key in ('grid', 'unlock'):
            c.text(xr, ry + 1, '关', 'v', sz=12, align='r')
            toggle(c, xr - 12 - 18, ry + 2, on=False)
        elif key == 'tut':
            w = c.tw('执行', 10) + 8
            tag(c, xr - w + 2, ry + 1, '执行', body='x', hi='w', ink='u')
        if i in seps: hairline(c, x + 11, ry + rh - 1 + (0 if True else 0), pw - 22)
    # style preview
    dx, dw = 206, 108
    panel(c, dx, y, dw, ph, 6, facets=False)
    names = ['晶石琉璃', '漂浮符文', '祥云玉简', '梦泡糖霜']
    for k in range(4):
        sx = dx + 8 + (k % 2) * 48; sy = y + 8 + (k // 2) * 44
        mini_style(c, sx, sy, k, sel=(k == 0))
        c.text(sx + 22, sy + 31, names[k], 't' if k == 0 else 'v', sz=10, align='c')
        if k == 0:
            pass
    divider(c, dx + 8, y + 96, dw - 16, mid=None)
    para(c, dx + 9, y + 102, '', 'u', 10, dw - 18, lh=12, lines=['大厅随地图换风格，', '其他界面用这一套。'])
    keybar(c, [(['up', 'down'], '选择'), (['left', 'right'], '调整'), (['Esc'], '返回')])
    return c

SCREENS = [('选择章节', chapters), ('选关', levels), ('设置', settings)]

if __name__ == '__main__':
    from PIL import Image
    ims = []
    for name, fn in SCREENS:
        c = fn(); c.save(f'{PROP}/fixed/out/a_{fn.__name__}.png', 2)
        ims.append(Image.open(f'{PROP}/fixed/out/a_{fn.__name__}.png'))
    out = Image.new('RGB', (656 * 2, 368 * 2), (0, 0, 0))
    for i, im in enumerate(ims): out.paste(im, ((i % 2) * 656, (i // 2) * 368))
    out.save(PROP + '/fixed/out/_a.png'); print('ok')
