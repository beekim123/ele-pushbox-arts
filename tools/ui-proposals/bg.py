"""Lobby backgrounds for the six chapter themes (swappable layer under a fixed UI).
Approximates the official theme refs; proposal-only, nothing written to the repo."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys, math; sys.path.insert(0, PROP + '/lib')
from common import *

GY = 150          # ground surface y
THEMES = ['dungeon', 'ruins', 'cave', 'forest', 'sky', 'cosmos']
INFO = {  # chapter label, theme title, continue level id (placeholder for ch3+)
 'dungeon': ('第 1 章', '幽暗石牢', 'M05'), 'ruins': ('第 2 章', '黄金神庙', 'W03'),
 'cave': ('第 3 章', '幽光晶窟', 'C02'), 'forest': ('第 4 章', '迷雾古森', 'F04'),
 'sky': ('第 5 章', '云端圣域', 'S01'), 'cosmos': ('扩展章', '深空星站', 'X01')}
EMBLEM = {t: i for i, t in enumerate(THEMES)}

def light_pool(c, cx, cy, r, strength=9, m=LIGHT):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if not (0 <= x < c.w and 0 <= y < c.h): continue
            d = math.hypot(x - cx, (y - cy) * 1.15) / r
            if d >= 1: continue
            lv = int(strength * (1 - d) + 0.5)
            if BAYER[y % 4][x % 4] < lv:
                c.g[y][x] = m.get(c.g[y][x], c.g[y][x])

def beam(c, x0, w, slope=2, level=3, top=0, bottom=GY):
    for y in range(top, bottom):
        xs = x0 + (y - top) // slope
        for x in range(xs, xs + w):
            if 0 <= x < c.w and BAYER[y % 4][x % 4] < level:
                c.g[y][x] = LIGHT.get(c.g[y][x], c.g[y][x])

def bricks(c, x0, y0, w, h, bw, bh, cols, seam, speck=None, hi=None, seed=1, off=None):
    off = bw // 2 if off is None else off
    for r_, y in enumerate(range(y0, y0 + h, bh)):
        sh = (r_ % 2) * off
        for x in range(x0 - bw, x0 + w, bw):
            bx = x + sh
            col = cols[0] if H(bx, y, seed) > 300 else cols[1]
            c.rect(bx, y, bw, bh, col)
            c.hline(bx, y, bw, seam); c.vline(bx, y, bh, seam)
            if hi and col == cols[1]: c.hline(bx + 1, y + 1, bw - 2, hi)
            if speck:
                for k in range(3):
                    sx, sy = bx + 2 + H(bx, y, seed + k) % (bw - 3), y + 2 + H(y, bx, seed + k) % max(1, bh - 3)
                    if H(sx, sy, seed) < 450: c.px(sx, sy, speck)
    c.clip = None

def props(c, theme, px_=214, crate='obj.crate_wood'):
    """shared lobby props: Portitor, crates, exit flag on a step"""
    spr(c, crate, 240, GY - 16); spr(c, crate, 256, GY - 16); spr(c, crate, 248, GY - 32)
    spr(c, 'char.portitor', px_, GY - 16, frame=0)

# ---------------------------------------------------------------- dungeon
def bg_dungeon(c):
    c.rect(0, 0, 320, 180, 'y')
    bricks(c, 0, 0, 320, GY, 16, 8, ['y', 'x'], 'z', speck='x', seed=3)
    # recessed arch windows with bars
    for ax in (168, 276):
        c.rect(ax, 30, 24, 40, 'z'); c.rect(ax + 2, 24, 20, 6, 'z'); c.rect(ax + 4, 22, 16, 2, 'z')
        for k in range(4): c.vline(ax + 4 + k * 5, 26, 44, 'x')
        c.hline(ax, 70, 24, 'w'); c.hline(ax - 1, 71, 26, 'x')
    # torches + light
    for tx in (204, 312 - 70):
        pass
    for tx, ty in ((214, 58), (262, 58)):
        spr(c, 'deco.dungeon_torch', tx, ty, frame=(tx // 7) % 3)
    for tx, ty in ((217, 58), (265, 58)): light_pool(c, tx, ty, 30, 8)
    c.rect(0, 0, 320, 4, 'z'); c.hline(0, 4, 320, 'y')
    spr(c, 'fauna.dungeon_bat', 296, 5, frame=0)
    # ground
    c.rect(0, GY, 320, 180 - GY, 'x')
    bricks(c, 0, GY, 320, 30, 16, 10, ['x', 'w'], 'z', speck='w', seed=7)
    c.hline(0, GY, 320, 'w'); c.hline(0, GY + 1, 320, 'v')
    c.dither(0, GY + 2, 320, 2, 'w', 6)
    for mx in (150, 196, 284): spr(c, 'deco.dungeon_moss', mx, GY - 5)
    # step + flag
    c.rect(288, GY - 16, 32, 16, 'x'); c.frame(288, GY - 16, 32, 16, 'z'); c.hline(289, GY - 15, 30, 'w'); c.vline(304, GY - 15, 14, 'z')
    spr(c, 'mech.exit_flag', 296, GY - 32, frame=0)
    spr(c, 'fauna.dungeon_rat', 176, GY - 6, frame=0)
    props(c, 'dungeon')

# ---------------------------------------------------------------- ruins
def bg_ruins(c):
    c.rect(0, 0, 320, 180, 'f')
    bricks(c, 0, 0, 320, GY, 24, 12, ['f', 'g'], 'g', speck='e', seed=11)
    # carved frieze
    c.rect(0, 14, 320, 10, 'e'); c.hline(0, 14, 320, 'd'); c.hline(0, 23, 320, 'g')
    for x in range(0, 320, 12):
        c.rect(x + 2, 16, 3, 3, 'k'); c.px(x + 3, 17, 'f'); c.rect(x + 7, 18, 3, 4, 'f'); c.px(x + 8, 18, 'k')
    c.rect(0, 0, 320, 14, 'F'); bricks(c, 0, 0, 320, 14, 20, 7, ['F', 'd'], 'e', speck='c', seed=5)
    c.hline(0, 13, 320, 'k')
    # pillars
    for px_ in (160, 196, 300):
        c.rect(px_ - 2, 24, 18, 4, 'd'); c.hline(px_ - 2, 24, 18, 'c'); c.frame(px_ - 3, 23, 20, 6, 'g')
        c.rect(px_, 28, 14, GY - 28, 'd'); c.vline(px_ + 1, 28, GY - 28, 'c'); c.rect(px_ + 10, 28, 4, GY - 28, 'F')
        c.vline(px_ - 1, 28, GY - 28, 'g'); c.vline(px_ + 14, 28, GY - 28, 'g')
        for k in range(36, GY, 12): c.hline(px_, k, 14, 'e')
        c.vline(px_ + 5, 32, GY - 36, 'F')
    beam(c, 120, 16, 2, 4, 24); beam(c, 210, 12, 2, 3, 24)
    for vx in (178, 236, 252, 286): spr(c, 'deco.ruins_vine', vx, 24, frame=vx % 2)
    # ground
    c.rect(0, GY, 320, 30, 'd')
    bricks(c, 0, GY, 320, 30, 24, 10, ['d', 'F'], 'e', speck='c', seed=9)
    c.hline(0, GY, 320, 'k'); c.hline(0, GY + 1, 320, 'c')
    for lx in (152, 282): spr(c, 'deco.ruins_lotus', lx, GY - 7)
    c.rect(288, GY - 16, 32, 16, 'd'); c.frame(288, GY - 16, 32, 16, 'e'); c.hline(289, GY - 15, 30, 'c'); c.hline(288, GY - 16, 32, 'k')
    spr(c, 'mech.exit_flag', 296, GY - 32, frame=1)
    spr(c, 'fauna.ruins_scarab', 184, GY - 6, frame=0)
    props(c, 'ruins')

# ---------------------------------------------------------------- cave
def crystal(c, bx, by, h, w, lean=0, d=-1, body='B', lit='C', hi='D', glint='t'):
    """pointed prism; (bx,by)=base centre, grows up (d=-1) or down (d=1)"""
    tipx = bx + lean
    for k in range(h + 1):                     # k = distance from tip
        y = by + d * (h - k)
        cx = tipx + (bx - tipx) * k / max(1, h)
        half = min(w, k * w / max(1, w + 1)) if k <= w + 1 else w
        x0, x1 = int(round(cx - half)), int(round(cx + half))
        for x in range(x0, x1 + 1):
            c.px(x, y, body if x < cx - 0.25 else lit)
        if 1 <= k <= h * 2 // 3: c.px(int(round(cx)), y, hi)
        if k >= 2 and w >= 2: c.px(x0, y, DARK.get(body, body))
    c.px(tipx, by + d * h, glint)

def crystal_cluster(c, bx, by, specs, d=-1, pal=('B', 'C', 'D', 't')):
    for (dx, h, w, lean) in specs:
        crystal(c, bx + dx, by, h, w, lean, d, *pal)

def bg_cave(c):
    c.rect(0, 0, 320, 180, 'z')
    # ambient teal glow pooled around the crystal beds
    for (gx, gy, rx, ry, lv) in ((214, 118, 78, 52, 8), (290, 116, 44, 38, 6), (66, 116, 56, 42, 6), (238, 20, 40, 26, 5)):
        for y in range(max(0, gy - ry), min(GY, gy + ry)):
            for x in range(max(0, gx - rx), min(320, gx + rx)):
                dd = ((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2
                if dd < 1 and BAYER[y % 4][x % 4] < int(lv * (1 - dd) ** 1.6 + 0.5):
                    c.g[y][x] = 'p'
    # far ledge silhouette
    for x in range(320):
        top = int(126 + 6 * math.sin(x * 0.045) + 4 * math.sin(x * 0.13 + 1.3))
        c.vline(x, top, GY - top, 'y')
        if H(x, 5, 6) < 620: c.px(x, top, 'x')
        if H(x, 6, 6) < 160: c.px(x, top + 1 + H(x, 7, 6) % 6, 'x')
    # hourglass rock pillars (stalactite meets stalagmite)
    for (px0, hw0, hw1, mid) in ((22, 5, 16, 70), (118, 4, 13, 64), (172, 6, 18, 74), (268, 5, 15, 66)):
        for y in range(0, GY):
            t = abs(y - mid) / max(mid, GY - mid)
            hw = hw0 + (hw1 - hw0) * t * t + (H(px0, y // 3, 9) % 3 - 1) * 0.6
            x0, x1 = int(px0 - hw), int(px0 + hw)
            c.hline(x0, y, x1 - x0 + 1, 'y')
            c.px(x0, y, 'x')
            if (y + px0) % 7 == 0: c.px(x0 + 1, y, 'x')
            if H(px0, y, 11) < 90: c.px(x0 + 2 + H(y, px0, 3) % max(1, x1 - x0 - 3), y, 'x')
    # ceiling + stalactites
    c.rect(0, 0, 320, 7, 'y')
    for x in range(0, 320, 11):
        L = 5 + H(x, 1, 2) % 16
        for k in range(L):
            wdt = max(1, (L - k) * 5 // L)
            xs = x + 5 - wdt // 2
            c.hline(xs, 7 + k, wdt, 'y'); c.px(xs, 7 + k, 'x')
    c.hline(0, 7, 320, 'x')
    # glowing crystal clusters (magenta + cyan), light first so crystals stay crisp
    for (lx, ly, r, s) in ((214, 124, 30, 7), (287, 124, 22, 6), (238, 14, 18, 5), (140, 12, 14, 4)):
        light_pool(c, lx, ly, r, s)
    crystal_cluster(c, 214, 128, ((-9, 15, 3, -4), (9, 18, 3, 4), (-15, 8, 2, -3), (15, 9, 2, 3), (0, 27, 4, 1)))
    crystal_cluster(c, 287, 131, ((-6, 10, 2, -3), (6, 11, 2, 2), (0, 18, 3, -1)), pal=('q', 'r', 's', 't'))
    crystal_cluster(c, 238, 8, ((-6, 8, 2, -2), (6, 9, 2, 2), (0, 15, 3, 1)), d=1)
    crystal_cluster(c, 140, 8, ((5, 6, 2, 2), (0, 11, 2, -1)), d=1, pal=('q', 'r', 's', 't'))
    # drifting spores
    for i in range(46):
        x, y = H(i, 1, 21) % 320, 16 + H(i, 2, 21) % (GY - 30)
        c.px(x, y, ('s', 'r', 'C', 'D')[H(i, 3, 21) % 4] if H(i, 4, 21) < 700 else 'p')
    for (sx, sy) in ((196, 92), (286, 84), (250, 128)): sparkle(c, sx, sy, 'D', 1, 't')
    # ground
    c.rect(0, GY, 320, 30, 'y')
    for y in range(GY, 180):
        for x in range(320):
            n = math.sin(x * 0.2 + y * 0.9) + math.sin(x * 0.07 - y * 0.5)
            if n > 0.8: c.g[y][x] = 'x'
            if H(x, y, 8) < 25: c.g[y][x] = 'B'
            if H(x, y, 9) < 12: c.g[y][x] = 'z'
    c.hline(0, GY, 320, 'p'); c.dither(0, GY + 1, 320, 2, 'p', 8)
    c.rect(288, GY - 16, 32, 16, 'y'); c.frame(288, GY - 16, 32, 16, 'z'); c.hline(289, GY - 16, 30, 'p'); c.dither(289, GY - 15, 30, 2, 'x', 8)
    spr(c, 'mech.exit_flag', 296, GY - 32, frame=2)
    for mx, f in ((154, 0), (200, 1), (276, 0)):
        spr(c, 'deco.cave_mushroom', mx, GY - 8, frame=f); light_pool(c, mx + 4, GY - 6, 16, 7)
    for cx in (176, 292): spr(c, 'deco.cave_crystal', cx, GY - 8 if cx < 288 else GY - 24); light_pool(c, cx + 4, GY - 4, 13, 6)
    spr(c, 'fauna.cave_moth', 232, 78, frame=0); spr(c, 'fauna.cave_moth', 190, 104, frame=1)
    props(c, 'cave')

# ---------------------------------------------------------------- forest
def bg_forest(c):
    c.rect(0, 0, 320, 180, 'p')
    # far trunks
    for x in (138, 186, 228, 262, 308):
        w = 6 + H(x, 3, 1) % 4
        c.rect(x, 0, w, GY, 'o'); c.vline(x, 0, GY, 'n')
    c.dither(0, 60, 320, 40, 'o', 5)
    # near trunks
    for x, w in ((150, 14), (276, 16)):
        c.rect(x, 0, w, GY, 'f'); c.vline(x, 0, GY, 'e'); c.rect(x + w - 4, 0, 4, GY, 'g'); c.vline(x - 1, 0, GY, 'z'); c.vline(x + w, 0, GY, 'z')
        for y in range(6, GY, 9): c.hline(x + 3 + H(x, y, 2) % 5, y, 3, 'g')
        c.rect(x - 4, GY - 4, w + 8, 4, 'f'); c.hline(x - 4, GY - 4, w + 8, 'e')
    # canopy
    for i, x in enumerate(range(-10, 330, 22)):
        r = 12 + H(x, 5, 3) % 7
        c.disc(x, 6 + H(x, 6, 3) % 8, r, 'o')
    for i, x in enumerate(range(0, 330, 26)):
        r = 9 + H(x, 7, 3) % 5
        c.disc(x, 2 + H(x, 8, 3) % 6, r, 'n'); c.dither(x - r, 0, r, r, 'm', 3)
    beam(c, 170, 10, 4, 4, 18); beam(c, 236, 8, 4, 3, 18)
    # mist
    for y in range(110, GY):
        for x in range(320):
            if BAYER[y % 4][x % 4] < (y - 110) // 10 and c.g[y][x] in 'po': c.g[y][x] = LIGHT[c.g[y][x]]
    # ground
    c.rect(0, GY, 320, 30, 'f')
    for y in range(GY + 4, 180):
        for x in range(320):
            if H(x, y, 21) < 70: c.g[y][x] = 'e'
            elif H(x, y, 22) < 30: c.g[y][x] = 'g'
    c.rect(0, GY, 320, 4, 'n'); c.hline(0, GY, 320, 'm')
    for x in range(0, 320, 3):
        if H(x, 0, 5) < 500: c.px(x, GY - 1, 'm')
        if H(x, 1, 5) < 450: c.vline(x + 1, GY + 4, 1 + H(x, 2, 5) % 3, 'n')
    c.rect(288, GY - 16, 32, 16, 'f'); c.frame(288, GY - 16, 32, 16, 'g'); c.rect(288, GY - 16, 32, 3, 'n'); c.hline(288, GY - 16, 32, 'm')
    spr(c, 'mech.exit_flag', 296, GY - 32, frame=3)
    for gx in (156, 172, 200, 268): spr(c, 'deco.forest_grass', gx, GY - 4, frame=gx % 2)
    for fx in (186, 282): spr(c, 'deco.forest_flower', fx, GY - 7, frame=0)
    spr(c, 'fauna.forest_butterfly', 196, 96, frame=0)
    props(c, 'forest')
    spr(c, 'fauna.forest_bird', 252, GY - 39, frame=0)

# ---------------------------------------------------------------- sky
def cloud(c, x, y, w, h, body='t', shade='u', under='v'):
    for k in range(0, w, 6):
        r = h // 2 + H(x + k, y, 4) % 4
        c.disc(x + k, y, r, body)
    c.rect(x - 2, y, w + 2, h // 2 + 2, body)
    for xx in range(x - 6, x + w + 6):
        for yy in range(y, y + h):
            if c.get(xx, yy) == body and c.get(xx, yy + 1) not in (body, shade): c.px(xx, yy, under)
            elif c.get(xx, yy) == body and c.get(xx, yy + 2) not in (body, shade, under) and BAYER[yy % 4][xx % 4] < 8: c.px(xx, yy, shade)

def bg_sky(c):
    c.rect(0, 0, 320, 180, 'r')
    c.dither(0, 70, 320, 40, 's', 4); c.dither(0, 110, 320, 40, 's', 9)
    # sun
    c.disc(292, 30, 17, 's'); c.disc(292, 30, 13, 'l'); c.disc(290, 28, 9, 't')
    light_pool(c, 292, 30, 34, 5)
    # far clouds (one step darker than solid clouds)
    for (x, y, w) in ((150, 46, 30), (226, 72, 40), (176, 104, 34), (280, 96, 30)):
        cloud(c, x, y, w, 10, 's', 's', 'r')
    # far islands
    for (x, y, w) in ((196, 56, 22), (300, 116, 14)):
        c.rect(x, y, w, 3, 'n'); c.hline(x, y, w, 'm')
        for k in range(6): c.hline(x + 1 + k * 2 // 2 + k, y + 3 + k, max(1, w - 2 - k * 4), 'e' if k < 3 else 'f')
    # solid cloud ground
    c.rect(0, GY + 4, 320, 30, 't')
    for x in range(-4, 330, 9):
        c.disc(x, GY + 4 + H(x, 9, 2) % 3, 6 + H(x, 8, 2) % 3, 't')
    for y in range(GY - 6, 180):
        for x in range(320):
            if c.get(x, y) == 't' and y > GY + 16 and BAYER[y % 4][x % 4] < (y - GY - 16) // 2: c.px(x, y, 'u')
    c.rect(288, GY - 16, 32, 20, 't'); c.disc(296, GY - 14, 5, 't'); c.disc(310, GY - 15, 6, 't')
    for x in range(288, 320):
        c.px(x, GY + 4, 'u')
    spr(c, 'mech.exit_flag', 296, GY - 34, frame=0)
    for fx in (160, 196, 278): spr(c, 'deco.sky_flower', fx, GY - 8, frame=fx % 2)
    spr(c, 'fauna.sky_dove', 232, 64, frame=0); spr(c, 'fauna.sky_cloudling', 166, 84, frame=0)
    # props stand on cloud top
    spr(c, 'obj.crate_wood', 240, GY - 18); spr(c, 'obj.crate_wood', 256, GY - 18); spr(c, 'obj.crate_wood', 248, GY - 34)
    spr(c, 'char.portitor', 214, GY - 18, frame=0)

# ---------------------------------------------------------------- cosmos
def bg_cosmos(c):
    c.rect(0, 0, 320, 180, 'z')
    for y in range(GY):
        for x in range(320):
            band = abs((x * 0.55 + y) - 150) / 40
            if band < 1 and BAYER[y % 4][x % 4] < int(6 * (1 - band)): c.g[y][x] = 'y'
            if band < 0.45 and BAYER[(y + 1) % 4][(x + 2) % 4] < int(5 * (0.45 - band) / 0.45) + 1 and H(x, y, 3) < 500: c.g[y][x] = 'B'
    for i in range(140):
        x, y = H(i, 1, 7) % 320, H(i, 2, 7) % GY
        c.px(x, y, 't' if H(i, 3, 7) < 300 else ('u' if H(i, 4, 7) < 500 else 'v'))
    for (x, y) in ((176, 30), (240, 92), (300, 120), (206, 128)): sparkle(c, x, y, 'u', 2, 't')
    # planet with a tilted ring (back half behind, front half over the disc)
    cx, cy, r = 282, 50, 13
    ca, sa = math.cos(math.radians(-16)), math.sin(math.radians(-16))
    def ring(front):
        for y in range(cy - 14, cy + 15):
            for x in range(cx - 30, cx + 31):
                u = (x - cx) * ca + (y - cy) * sa; v = -(x - cx) * sa + (y - cy) * ca
                e = (u / 26.5) ** 2 + (v / 6.6) ** 2
                if 0.60 < e <= 1.0 and ((v > 0) == front):
                    c.px(x, y, 'k' if e > 0.82 else ('j' if e > 0.70 else 'b'))
    ring(False)
    c.disc(cx, cy, r, 'C')
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if c.get(x, y) != 'C' or (x - cx) ** 2 + (y - cy) ** 2 > r * r + r: continue
            q = (x - cx) + (y - cy)
            if q > 6 and BAYER[y % 4][x % 4] < min(16, (q - 6) * 2): c.px(x, y, 'B')
            if q < -11: c.px(x, y, 'D')
            if (y - cy + 3) % 7 == 0 and q < 10: c.px(x, y, 'D' if q < -4 else 'B')
    c.px(cx - 6, cy - 8, 't'); c.px(cx - 7, cy - 7, 'E')
    ring(True)
    c.line(150, 10, 196, 30, 'u', dash=(3, 2)); c.px(197, 30, 't')
    # distant station truss
    for x in range(180, 320, 2):
        c.px(x, 100 + (x // 2) % 2 * 0, 'x')
    c.hline(180, 96, 140, 'x'); c.hline(180, 104, 140, 'x')
    for x in range(180, 320, 8): c.line(x, 96, x + 8, 104, 'x'); c.vline(x, 96, 9, 'y')
    # ground metal panels
    c.rect(0, GY, 320, 30, 'x')
    for x in range(0, 320, 20):
        c.vline(x, GY, 30, 'y'); c.hline(x + 1, GY + 5, 18, 'w'); c.px(x + 3, GY + 8, 'v'); c.px(x + 16, GY + 8, 'v')
    c.hline(0, GY + 17, 320, 'y'); c.hline(0, GY + 18, 320, 'w')
    for x in range(320):
        for y in range(GY, GY + 4):
            c.px(x, y, 'k' if ((x + y) // 3) % 2 == 0 else 'z')
    c.hline(0, GY + 4, 320, 'y')
    c.rect(288, GY - 16, 32, 16, 'x'); c.frame(288, GY - 16, 32, 16, 'y')
    for x in range(288, 320):
        for y in range(GY - 16, GY - 13): c.px(x, y, 'k' if ((x + y) // 3) % 2 == 0 else 'z')
    spr(c, 'mech.exit_flag', 296, GY - 32, frame=1)
    for sx in (158, 190, 278): spr(c, 'deco.cosmos_sprout', sx, GY - 8, frame=sx % 2); light_pool(c, sx + 4, GY - 5, 12, 6)
    spr(c, 'fauna.cosmos_drone', 226, 70, frame=0)
    props(c, 'cosmos', crate='obj.crate_iron')

BG = dict(dungeon=bg_dungeon, ruins=bg_ruins, cave=bg_cave, forest=bg_forest, sky=bg_sky, cosmos=bg_cosmos)

def draw_bg(c, theme): BG[theme](c)

if __name__ == '__main__':
    from PIL import Image
    ims = []
    for t in THEMES:
        c = Canvas(); draw_bg(c, t); ims.append(c.image())
    sheet = Image.new('RGB', (640 * 3, 360 * 2))
    for i, im in enumerate(ims):
        sheet.paste(im.resize((640, 360), Image.NEAREST), ((i % 3) * 640, (i // 3) * 360))
    sheet.save(PROP + '/out2/_bgs.png')
    print('ok')
