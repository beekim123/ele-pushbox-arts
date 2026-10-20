import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from px import *

def H(x, y, s=0):
    """deterministic hash 0..999"""
    v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) % 1000

def spr(c, sid, x, y, frame=0, outline=None, flip=False, recolor=None, diag=False):
    f = sprite(sid, frame)
    if outline: c.outline_blit(f, x, y, outline, flip, recolor, diag)
    else: c.blit(f, x, y, flip, recolor)
    return len(f[0]), len(f)

def anim(sid, name, i=0):
    sprite(sid)
    from px import _SPR
    d = _SPR[sid]
    return d['animations'][name]['frames'][i]

def scale_rows(rws, k):
    out = []
    for r in rws:
        rr = ''.join(ch * k for ch in r)
        for _ in range(k): out.append(rr)
    return out

def coin_icon(c, x, y, big=False):
    """7x7 coin (or 9x9)"""
    if big:
        R = rows("""
..zzzzz..
.zkkkkkz.
zklllkkjz
zklkkkkjz
zkkkkkkjz
zkkkkkkjz
zkkkkkjjz
.zjjjjjz.
..zzzzz..""")
    else:
        R = rows("""
.zzzzz.
zkllkjz
zlkkkjz
zkkkkjz
zkkkkjz
zjkkjjz
.zzzzz.""")
    c.blit(R, x, y)

def stamp_icon(c, x, y, inner='i', paper='t', edge='z'):
    """9x9 tiny perforated stamp"""
    R = rows("""
z.z.z.z.z
.ttttttt.
zt.....tz
.t.....t.
zt.....tz
.t.....t.
zt.....tz
.ttttttt.
z.z.z.z.z""")
    c.blit(R, x, y, recolor={'t': paper, 'z': edge})
    c.rect(x+2, y+2, 5, 5, inner)
    c.px(x+3, y+3, LIGHT.get(inner, inner))

def keycap(c, x, y, label, body='u', top='t', side='v', ink='y', edge='z', w=None, sz=10):
    """generic keycap; label drawn in font"""
    tw_ = c.tw(label, sz)
    w = w or max(13, tw_ + 6)
    c.rrect(x, y, w, 13, edge)
    c.rrect(x+1, y+1, w-2, 11, side)
    c.rrect(x+1, y+1, w-2, 9, body)
    c.hline(x+2, y+1, w-4, top)
    c.text(x + w//2, y + (2 if sz == 10 else 1), label, ink, sz=sz, align='c')
    return w

def arrow_cap(c, x, y, d='up', **kw):
    f = sprite('ui.keycap', {'left':0,'right':1,'up':2,'down':3}[d])
    if kw.get('recolor'): c.blit(f, x, y, recolor=kw['recolor'])
    else: c.blit(f, x, y)
    return 13

def sparkle(c, x, y, col='t', size=1, core=None):
    c.px(x, y, core or col)
    for i in range(1, size+1):
        for dx, dy in ((i,0),(-i,0),(0,i),(0,-i)): c.px(x+dx, y+dy, col)

def stamp_ink(c, x, y, w, h, ink, paper_cols, density=70, seed=1):
    """knock out some ink pixels to look rubber-stamped"""
    for yy in range(y, y+h):
        for xx in range(x, x+w):
            if c.get(xx, yy) == ink and H(xx, yy, seed) < density:
                # show paper underneath (approx: neighbour non-ink)
                c.px(xx, yy, paper_cols)
