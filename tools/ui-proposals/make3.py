"""Round-3 lobby skins for the two chapters round 2 left out, plus the full chapter -> skin map:
  S5 藤木萤光 for 第 4 章 迷雾古森 (forest), S6 星港舱板 for 第 6 章 深空星站 (cosmos).
Writes only to out2/: S5_forest.png, S6_cosmos.png (x2) with their .native.png (320x180), and mapping.png."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys, importlib; sys.path.insert(0, PROP)
from l2_common import *
from make2 import label, theme_name
from PIL import Image

# cosmos is chapter 6 (art/source/theme/theme.cosmos.json: params.chapter = 6). bg.py keeps its old
# '扩展章' label so that make2.py still reproduces the round-2 images byte for byte.
INFO['cosmos'] = ('第 6 章',) + tuple(INFO['cosmos'][1:])

NEW = [('S5', 's5_vine', 'forest'), ('S6', 's6_hull', 'cosmos')]
MAPPING = [  # chapter order
 ('dungeon', 'S2', 's2_rune', '漂浮符文'),
 ('ruins', 'S3', 's3_jade', '祥云玉简'),
 ('cave', 'S1', 's1_crystal', '晶石琉璃'),
 ('forest', 'S5', 's5_vine', '藤木萤光'),
 ('sky', 'S4', 's4_bubble', '梦泡糖霜'),
 ('cosmos', 'S6', 's6_hull', '星港舱板'),
]

def render(modname, theme):
    c = Canvas(); draw_bg(c, theme); importlib.import_module(modname).draw(c, theme); return c

if __name__ == '__main__':
    os.makedirs(PROP + '/out2', exist_ok=True)
    for code, modname, theme in NEW:
        print(render(modname, theme).save(f'{PROP}/out2/{code}_{theme}.png', scale=2))
    rows_ = (len(MAPPING) + 1) // 2
    im = Image.new('RGB', (1344, 12 + rows_ * 400 + 4), RGB['z'])
    for i, (theme, code, modname, sname) in enumerate(MAPPING):
        x = 24 + (i % 2) * 656; y = 12 + (i // 2) * 400
        im.paste(label(320, 16, [(theme_name(theme), 't', 12), ('→', 'w', 12), (f'{code} {sname}', 'k', 12)]), (x, y))
        im.paste(render(modname, theme).image().resize((640, 360), Image.NEAREST), (x, y + 36))
    im.save(PROP + '/out2/mapping.png'); print(PROP + '/out2/mapping.png')
