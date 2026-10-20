"""Compose the three review sheets for the fixed (non-lobby) screens, S1 晶石琉璃 · 素版."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys; sys.path.insert(0, PROP); sys.path.insert(0, PROP + '/fixed')
from l2_common import *
from PIL import Image

OUT = PROP + '/fixed/out'

def label(w, h, parts, bg='z'):
    c = Canvas(w, h, bg); x = 0
    for (t, col, sz) in parts:
        if t == '|': x += 6; continue
        c.text(x, (h - sz) // 2 + (1 if sz == 10 else 0), t, col, sz=sz); x += c.tw(t, sz) + 4
    return c.image().resize((w * 2, h * 2), Image.NEAREST)

SHEETS = {
 'A': ('大厅二级', '从大厅打开的界面，背景是压暗的大厅墙', [
   ('a_chapters', '选择章节', '左右翻章节卡；未解锁的变暗并挂锁'),
   ('a_levels', '选关', '右侧用真实关卡截图 + 一句话发现'),
   ('a_settings', '设置', '新增「界面风格」：4 种可选，默认晶石琉璃'),
 ]),
 'B': ('关卡内', '盖在关卡画面上；顶栏是新的分块 HUD', [
   ('b_pause', '暂停', '常用项旁标快捷键 Esc / H / R'),
   ('b_hint', '提示', '主角气泡说提示；底栏：层数 + 演示 / 回到正确位置'),
   ('b_rulecard', '规则卡', '左边看图，右边一句规则；Esc 知道了'),
   ('b_dialogue', '对话', 'NPC 说话泡 / 主角心里话 / 系统提示条'),
   ('b_complete', '过关', '门开、箱子入坑、主角举旗'),
 ]),
 'C': ('渡口 · 配送', '配送玩法相关的界面', [
   ('c_reels', '今天送什么？', '两个滚轮：货物 / 收件人，喜欢时 ♥×1.5'),
   ('c_shop', '商店', '买不起的价格标红，卖完的整行变暗'),
   ('c_dhud', '配送 HUD', '顶栏按组分块，右上小地图'),
   ('c_dpause', '配送暂停', '和关卡暂停同一套，多一项放弃这一单'),
   ('c_settlement', '结算', '右上评级徽章，账单式明细，合计放大'),
   ('c_settlement_fail', '失败', '粉色标题区分失败；金币带回一半'),
   ('c_confirm', '确认框（建议新增）', '放弃前再确认一次；文案待定'),
 ]),
}

def sheet(code):
    title, desc, items = SHEETS[code]
    rows = (len(items) + 1) // 2
    W = 24 + 640 + 16 + 640 + 24
    CH = 30 + 360 + 18
    H = 52 + rows * CH + 6
    im = Image.new('RGB', (W, H), RGB['z'])
    im.paste(label(640, 22, [(code, 'k', 12), (title, 't', 12), ('|', 0, 0),
                             ('晶石琉璃 · 素版', 'u', 10), ('|', 0, 0), (desc, 'v', 10)]), (24, 4))
    for i, (fn, name, note) in enumerate(items):
        x = 24 + (i % 2) * 656; y = 52 + (i // 2) * CH
        im.paste(label(320, 14, [(f'{code}{i + 1}', 'k', 10), (name, 't', 12), ('|', 0, 0), (note, 'v', 10)]), (x, y))
        fr = Image.new('RGB', (644, 364), RGB['x']); im.paste(fr, (x - 2, y + 28))
        im.paste(Image.open(f'{OUT}/{fn}.png').convert('RGB'), (x, y + 30))
    path = f'{OUT}/sheet_{code}.png'; im.save(path); print(path, im.size)

if __name__ == '__main__':
    for k in SHEETS: sheet(k)
