"""Tiny pixel-art canvas for UI proposals (320x180, ENDESGA 32 only).
Read-only use of project sprites/fonts; nothing here writes to the repo."""
import os
PROP = os.environ.get('UI_PROPOSALS_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('lib', 'fixed') else os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(PROP))
import json, os
from PIL import Image, ImageDraw, ImageFont

PALETTE = {
 'a':"#be4a2f",'b':"#d77643",'c':"#ead4aa",'d':"#e4a672",'e':"#b86f50",'f':"#733e39",'g':"#3e2731",'h':"#a22633",
 'i':"#e43b44",'j':"#f77622",'k':"#feae34",'l':"#fee761",'m':"#63c74d",'n':"#3e8948",'o':"#265c42",'p':"#193c3e",
 'q':"#124e89",'r':"#0099db",'s':"#2ce8f5",'t':"#ffffff",'u':"#c0cbdc",'v':"#8b9bb4",'w':"#5a6988",'x':"#3a4466",
 'y':"#262b44",'z':"#181425",'A':"#ff0044",'B':"#68386c",'C':"#b55088",'D':"#f6757a",'E':"#e8b796",'F':"#c28569"}
RGB = {k:(int(v[1:3],16),int(v[3:5],16),int(v[5:7],16)) for k,v in PALETTE.items()}
DARK = dict(t='u',u='v',v='w',w='x',x='y',y='z',z='z',c='d',d='F',E='F',F='e',e='f',f='g',g='z',
            l='k',k='j',j='a',a='h',b='e',i='h',h='g',A='i',m='n',n='o',o='p',p='z',s='r',r='q',q='y',
            D='C',C='B',B='g')
LIGHT = dict(z='y',y='x',x='w',w='v',v='u',u='t',t='t',g='f',f='e',e='d',d='c',c='t',F='E',E='c',
             h='i',i='D',a='j',j='k',k='l',l='t',b='d',p='o',o='n',n='m',m='l',q='r',r='s',s='t',B='C',C='D',D='E',A='D')
BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]

HERE = os.path.dirname(__file__)
FONT_PATHS = {12: os.path.join(REPO,'third_party/fonts/fusion-pixel-12px/fusion-pixel-12px-proportional-zh_hans.otf.woff2'), 10: os.path.join(REPO,'third_party/fonts/fusion-pixel-10px/fusion-pixel-10px-proportional-sc.woff2')}
TOP = {12:3, 10:4}          # PIL draws visible glyph tops this far below y
_FONTS = {}
def font(sz):
    if sz not in _FONTS: _FONTS[sz] = ImageFont.truetype(FONT_PATHS[sz], sz)
    return _FONTS[sz]

ART = os.path.join(REPO, 'art/source')
_SPR = {}
def sprite(sid, frame=0):
    if sid not in _SPR:
        cat = None
        for root, _, files in os.walk(ART):
            if sid + '.json' in files: cat = os.path.join(root, sid + '.json'); break
        _SPR[sid] = json.load(open(cat))
    return _SPR[sid]['frames'][frame]
def anim_frame(sid, anim, i=0):
    d = _SPR.get(sid) or (sprite(sid) and _SPR[sid])
    return d['frames'][d['animations'][anim]['frames'][i]]

def rows(s):
    """Multiline string -> list of rows (strip common blank lines)."""
    r = [ln for ln in s.split('\n')]
    while r and not r[0].strip(): r.pop(0)
    while r and not r[-1].strip(): r.pop()
    w = max(len(x) for x in r)
    return [x.ljust(w, '.') for x in r]

class Canvas:
    def __init__(self, w=320, h=180, bg='z'):
        self.w, self.h = w, h
        self.g = [[bg]*w for _ in range(h)]
        self.clip = None
    # --- basics -------------------------------------------------------
    def inb(self, x, y):
        if self.clip:
            x0,y0,x1,y1 = self.clip
            if x < x0 or y < y0 or x >= x1 or y >= y1: return False
        return 0 <= x < self.w and 0 <= y < self.h
    def px(self, x, y, c):
        if c is None or c == '.' : return
        x, y = int(x), int(y)
        if self.inb(x, y): self.g[y][x] = c
    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h: return self.g[y][x]
        return None
    def rect(self, x, y, w, h, c):
        for yy in range(y, y+h):
            for xx in range(x, x+w): self.px(xx, yy, c)
    def hline(self, x, y, w, c): self.rect(x, y, w, 1, c)
    def vline(self, x, y, h, c): self.rect(x, y, 1, h, c)
    def frame(self, x, y, w, h, c):
        self.hline(x, y, w, c); self.hline(x, y+h-1, w, c); self.vline(x, y, h, c); self.vline(x+w-1, y, h, c)
    def rrect(self, x, y, w, h, c, r=1):
        """filled rect with stepped corners (r=1..3)"""
        cut = {1:[1],2:[2,1],3:[3,1,1],4:[4,2,1,1]}[r]
        for yy in range(h):
            k = 0
            if yy < len(cut): k = cut[yy]
            elif h-1-yy < len(cut): k = cut[h-1-yy]
            self.hline(x+k, y+yy, w-2*k, c)
    def rframe(self, x, y, w, h, c, r=1):
        cut = {1:[1],2:[2,1],3:[3,1,1],4:[4,2,1,1]}[r]
        pts = set()
        for yy in range(h):
            k = cut[yy] if yy < len(cut) else (cut[h-1-yy] if h-1-yy < len(cut) else 0)
            pts.add((x+k, y+yy)); pts.add((x+w-1-k, y+yy))
        for i,k in enumerate(cut):
            nk = cut[i+1] if i+1 < len(cut) else 0
            for xx in range(x+nk, x+k+1): pts.add((xx, y+i)); pts.add((xx, y+h-1-i)); pts.add((x+w-1-(xx-x), y+i)); pts.add((x+w-1-(xx-x), y+h-1-i))
        for xx in range(x+cut[0], x+w-cut[0]): pts.add((xx, y)); pts.add((xx, y+h-1))
        for p in pts: self.px(p[0], p[1], c)
    def line(self, x0, y0, x1, y1, c, dash=None):
        dx, dy = abs(x1-x0), -abs(y1-y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
        err = dx + dy; i = 0
        while True:
            if dash is None or (i % (dash[0]+dash[1])) < dash[0]: self.px(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2*err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy
            i += 1
    def circle(self, cx, cy, r, c, dash=None):
        pts = []
        x, y, d = r, 0, 1 - r
        while x >= y:
            for (a, b) in ((x,y),(y,x),(-y,x),(-x,y),(-x,-y),(-y,-x),(y,-x),(x,-y)): pts.append((cx+a, cy+b))
            y += 1
            if d < 0: d += 2*y + 1
            else: x -= 1; d += 2*(y-x) + 1
        import math
        pts = sorted(set(pts), key=lambda p: math.atan2(p[1]-cy, p[0]-cx))
        for i, p in enumerate(pts):
            if dash is None or (i % (dash[0]+dash[1])) < dash[0]: self.px(p[0], p[1], c)
    def disc(self, cx, cy, r, c):
        for yy in range(-r, r+1):
            for xx in range(-r, r+1):
                if xx*xx + yy*yy <= r*r + r*0.8: self.px(cx+xx, cy+yy, c)
    def ellipse(self, cx, cy, rx, ry, c, fill=True):
        for yy in range(-ry, ry+1):
            for xx in range(-rx, rx+1):
                v = (xx*xx)/(rx*rx+0.01*rx) + (yy*yy)/(ry*ry+0.01*ry)
                if fill and v <= 1.0: self.px(cx+xx, cy+yy, c)
    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys)+1):
            xs = []
            n = len(pts)
            for i in range(n):
                (x0, y0), (x1, y1) = pts[i], pts[(i+1) % n]
                if y0 == y1: continue
                if (y >= min(y0, y1)) and (y < max(y0, y1)):
                    xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs)-1, 2):
                for x in range(int(round(xs[i])), int(round(xs[i+1]))+1): self.px(x, y, c)
    # --- shading ------------------------------------------------------
    def dither(self, x, y, w, h, c, level, off=(0,0)):
        for yy in range(y, y+h):
            for xx in range(x, x+w):
                if BAYER[(yy+off[1]) % 4][(xx+off[0]) % 4] < level: self.px(xx, yy, c)
    def shade(self, x, y, w, h, m=DARK, level=16, steps=1):
        for yy in range(max(0,y), min(self.h,y+h)):
            for xx in range(max(0,x), min(self.w,x+w)):
                if BAYER[yy % 4][xx % 4] < level:
                    c = self.g[yy][xx]
                    for _ in range(steps): c = m.get(c, c)
                    self.px(xx, yy, c)
    def remap(self, x, y, w, h, mp):
        for yy in range(max(0,y), min(self.h,y+h)):
            for xx in range(max(0,x), min(self.w,x+w)):
                c = self.g[yy][xx]
                if c in mp: self.px(xx, yy, mp[c])
    # --- sprites ------------------------------------------------------
    def blit(self, rws, x, y, flip=False, recolor=None, skip=None):
        for j, row in enumerate(rws):
            for i, ch in enumerate(row[::-1] if flip else row):
                if ch == '.' or ch == ' ': continue
                if skip and ch in skip: continue
                if recolor: ch = recolor.get(ch, ch)
                self.px(x+i, y+j, ch)
    def outline_blit(self, rws, x, y, oc='z', flip=False, recolor=None, diag=False):
        h = len(rws); w = len(rws[0])
        filled = set()
        for j, row in enumerate(rws):
            for i, ch in enumerate(row[::-1] if flip else row):
                if ch not in '. ': filled.add((i, j))
        nb = [(1,0),(-1,0),(0,1),(0,-1)] + ([(1,1),(1,-1),(-1,1),(-1,-1)] if diag else [])
        for (i, j) in filled:
            for dx, dy in nb:
                if (i+dx, j+dy) not in filled: self.px(x+i+dx, y+j+dy, oc)
        self.blit(rws, x, y, flip, recolor)
    # --- text ---------------------------------------------------------
    def _mask(self, s, sz):
        f = font(sz)
        w = int(f.getlength(s)) + 4
        im = Image.new('L', (w, sz + 8), 0)
        d = ImageDraw.Draw(im); d.fontmode = '1'
        d.text((0, 0), s, font=f, fill=255)
        px = im.load()
        pts = [(xx, yy - TOP[sz]) for yy in range(im.height) for xx in range(im.width) if px[xx, yy] > 127]
        return pts, int(f.getlength(s))
    def tw(self, s, sz=12, scale=1): return self._mask(s, sz)[1] * scale
    def text(self, x, y, s, c, sz=12, scale=1, shadow=None, outline=None, sdir=(1,1), align='l', diag=True, spacing=0):
        if spacing:
            cx = x
            if align != 'l':
                tot = sum(self.tw(ch, sz, scale) for ch in s) + spacing*(len(s)-1)
                cx = x - (tot if align == 'r' else tot//2)
            for ch in s:
                self.text(cx, y, ch, c, sz, scale, shadow, outline, sdir, 'l', diag)
                cx += self.tw(ch, sz, scale) + spacing
            return cx - x
        pts, wdt = self._mask(s, sz)
        wdt *= scale
        if align == 'c': x -= wdt // 2
        elif align == 'r': x -= wdt
        P = set()
        for (px_, py_) in pts:
            for a in range(scale):
                for b in range(scale): P.add((x + px_*scale + a, y + py_*scale + b))
        if outline:
            nb = [(1,0),(-1,0),(0,1),(0,-1)] + ([(1,1),(1,-1),(-1,1),(-1,-1)] if diag else [])
            for (a, b) in P:
                for dx, dy in nb:
                    if (a+dx, b+dy) not in P: self.px(a+dx, b+dy, outline)
        if shadow:
            for (a, b) in P:
                if (a+sdir[0], b+sdir[1]) not in P: self.px(a+sdir[0], b+sdir[1], shadow)
        for (a, b) in P: self.px(a, b, c)
        return wdt
    def textpts(self, s, sz=12, scale=1):
        pts, wdt = self._mask(s, sz)
        return pts, wdt
    # --- output -------------------------------------------------------
    def image(self):
        im = Image.new('RGB', (self.w, self.h))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w): px[x, y] = RGB[self.g[y][x]]
        return im
    def save(self, path, scale=4):
        im = self.image()
        im.save(path.replace('.png', '.native.png'))
        im.resize((self.w*scale, self.h*scale), Image.NEAREST).save(path)
        return path
