"""Compose round-2 lobby sheets: per style = hero (x4) + two background swaps (x2)."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys, importlib; sys.path.insert(0, PROP)
from l2_common import *
from PIL import Image

STYLES = [
 ('S1', 's1_crystal', '晶石琉璃', '切面玻璃框 · 冷青光边 · 紫晶角饰', 'dungeon', ['ruins', 'sky']),
 ('S2', 's2_rune', '漂浮符文', '悬浮石板 · 琥珀符文光 · 无外框', 'cave', ['forest', 'sky']),
 ('S3', 's3_jade', '祥云玉简', '玉石面板 · 金回纹 · 漆匾标题 · 朱红流苏', 'ruins', ['forest', 'cosmos']),
 ('S4', 's4_bubble', '梦泡糖霜', '珠光泡泡 · 贴纸描边 · 泡泡里漂着万物', 'sky', ['dungeon', 'cosmos']),
]

def render(mod, theme):
    c = Canvas(); draw_bg(c, theme); mod.draw(c, theme); return c

def label(w, h, parts, bg='z'):
    """parts: list of (text, colour, size)"""
    c = Canvas(w, h, bg); x = 0
    for (t, col, sz) in parts:
        if t == '|': x += 6; continue
        c.text(x, (h - sz) // 2 + (1 if sz == 10 else 0), t, col, sz=sz); x += c.tw(t, sz) + 4
    return c.image().resize((w * 2, h * 2), Image.NEAREST)

def theme_name(t):
    ch, name, _ = INFO[t]; return f'{ch} · {name}'

def sheet(code, modname, name, desc, hero, swaps):
    mod = importlib.import_module(modname)
    W, H_ = 1336, 1196
    im = Image.new('RGB', (W, H_), RGB['z'])
    im.paste(label(640, 20, [(code, 'k', 12), (name, 't', 12), ('|', 0, 0), (desc, 'v', 10)]), (28, 2))
    c = render(mod, hero); c.save(f'{PROP}/out2/{code}_{hero}.png')
    im.paste(c.image().resize((1280, 720), Image.NEAREST), (28, 44))
    im.paste(label(640, 16, [('同一套大厅 UI，只换背景 →', 'v', 10), (theme_name(swaps[0]), 'u', 10), ('/', 'w', 10), (theme_name(swaps[1]), 'u', 10)]), (24, 772))
    for i, t in enumerate(swaps):
        c = render(mod, t); c.save(f'{PROP}/out2/{code}_{t}.png')
        im.paste(c.image().resize((640, 360), Image.NEAREST), (24 + i * 648, 812))
    path = f'{PROP}/out2/{code}_{name}.png'
    im.save(path); return path, c

if __name__ == '__main__':
    heroes = []
    for st in STYLES:
        p, _ = sheet(*st); print(p)
        heroes.append((st, Image.open(f'{PROP}/out2/{st[0]}_{st[4]}.native.png')))
    # overview 2x2 of heroes at x2
    W, H_ = 1344, 2 * (36 + 360) + 40
    ov = Image.new('RGB', (W, H_), RGB['z'])
    for i, (st, nat) in enumerate(heroes):
        x = 24 + (i % 2) * 656; y = 12 + (i // 2) * 400
        ov.paste(label(320, 16, [(st[0], 'k', 12), (st[2], 't', 12)]), (x, y))
        ov.paste(nat.resize((640, 360), Image.NEAREST), (x, y + 36))
    ov.save(PROP + '/out2/overview.png'); print('overview')
