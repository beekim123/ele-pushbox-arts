/* Drawing kit for the 2026-10-16 interface style (docs/design/ui-style.md).
 * A line-by-line port of the approved proposal code in tools/ui-proposals/
 * (lib/px.py, lib/common.py, l2_common.py, the S1 parts of s1_crystal.py and
 * fixed/kit.py), so the workbench draws the same pixels as the approved
 * proposal images. Python semantics are kept on purpose: floor division,
 * banker's rounding, the big-integer hash, the proposals' own DARK / LIGHT
 * ramps and the PIL text offsets (the baked Fusion Pixel glyphs sit 1 px
 * (12 px font) / 2 px (10 px font) lower than PIL's mask; measured, exact).
 * New file next to ui.js; nothing here changes how older assets draw. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites;

  // ---------- Python arithmetic ----------
  const fd = (a, b) => Math.floor(a / b);
  const pm = (a, b) => ((a % b) + b) % b;
  function pyRound(v) {
    const f = Math.floor(v), d = v - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return pm(f, 2) === 0 ? f : f + 1;
  }
  // common.H: deterministic hash 0..999 with Python's unbounded integers.
  function Hh(x, y, s) {
    let v = (BigInt(x) * 73856093n) ^ (BigInt(y) * 19349663n) ^ (BigInt(s || 0) * 83492791n);
    v = (v ^ (v >> 13n)) * 1274126177n;
    v = (v ^ (v >> 16n)) % 1000n;
    return Number(v < 0n ? v + 1000n : v);
  }

  // ---------- palette ramps of the proposals (lib/px.py) ----------
  const DARK = { t: "u", u: "v", v: "w", w: "x", x: "y", y: "z", z: "z", c: "d", d: "F", E: "F", F: "e", e: "f", f: "g", g: "z",
    l: "k", k: "j", j: "a", a: "h", b: "e", i: "h", h: "g", A: "i", m: "n", n: "o", o: "p", p: "z", s: "r", r: "q", q: "y",
    D: "C", C: "B", B: "g" };
  const LIGHT = { z: "y", y: "x", x: "w", w: "v", v: "u", u: "t", t: "t", g: "f", f: "e", e: "d", d: "c", c: "t", F: "E", E: "c",
    h: "i", i: "D", a: "j", j: "k", k: "l", l: "t", b: "d", p: "o", o: "n", n: "m", m: "l", q: "r", r: "s", s: "t", B: "C", C: "D", D: "E", A: "D" };
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dk = (c) => (c in DARK ? DARK[c] : c);

  function rows(s) {
    const r = s.split("\n");
    while (r.length && !r[0].trim()) r.shift();
    while (r.length && !r[r.length - 1].trim()) r.pop();
    const w = Math.max(...r.map((x) => x.length));
    return r.map((x) => x + ".".repeat(w - x.length));
  }

  // ---------- coordinate sets (Python sets of (x, y)) ----------
  const OFF = 2048, SPAN = 8192;
  const K = (x, y) => (y + OFF) * SPAN + (x + OFF);
  const KX = (k) => (k % SPAN) - OFF, KY = (k) => Math.floor(k / SPAN) - OFF;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const N8 = N4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  function minus(A, B) { const o = new Set(); for (const k of A) if (!B.has(k)) o.add(k); return o; }
  function union(...L) { const o = new Set(); for (const A of L) for (const k of A) o.add(k); return o; }

  // ---------- text (Fusion Pixel 12 / 10 px baked glyphs) ----------
  const FONTS = { 12: () => PB.FONT, 10: () => PB.FONT_SMALL };
  const DY = { 12: -1, 10: -2 };
  function glyph(ch, sz) {
    const F = FONTS[sz]();
    return (F && (F.glyphs[ch] || F.glyphs["?"])) || [6];
  }
  function mask(s, sz) {
    const pts = []; let cx = 0;
    for (const ch of s) {
      const g = glyph(ch, sz), adv = g[0];
      for (let row = 1; row < g.length; row++) {
        const bits = g[row]; if (!bits) continue;
        for (let col = 0; col < adv; col++) if (bits & (1 << col)) pts.push([cx + col, row - 1 + DY[sz]]);
      }
      cx += adv;
    }
    return { pts, w: cx };
  }

  // ---------- canvas (lib/px.py Canvas over a PB.Raster) ----------
  class C {
    constructor(r) { this.r = r; this.w = r.w; this.h = r.h; this.clip = null; }
    static make(w, h, bg) { const c = new C(new PB.Raster(w, h)); if (bg && bg !== ".") c.r.rect(0, 0, w, h, bg); return c; }
    inb(x, y) {
      if (this.clip) { const [x0, y0, x1, y1] = this.clip; if (x < x0 || y < y0 || x >= x1 || y >= y1) return false; }
      return x >= 0 && x < this.w && y >= 0 && y < this.h;
    }
    px(x, y, c) {
      if (c == null || c === ".") return;
      x = Math.trunc(x); y = Math.trunc(y);
      if (this.inb(x, y)) this.r.set(x, y, c);
    }
    get(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.r.get(x, y) : null; }
    raw(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < this.h && c !== ".") this.r.set(x, y, c); }
    rect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); }
    hline(x, y, w, c) { this.rect(x, y, w, 1, c); }
    vline(x, y, h, c) { this.rect(x, y, 1, h, c); }
    frame(x, y, w, h, c) { this.hline(x, y, w, c); this.hline(x, y + h - 1, w, c); this.vline(x, y, h, c); this.vline(x + w - 1, y, h, c); }
    rrect(x, y, w, h, c, r) {
      const cut = { 1: [1], 2: [2, 1], 3: [3, 1, 1], 4: [4, 2, 1, 1] }[r || 1];
      for (let yy = 0; yy < h; yy++) {
        let k = 0;
        if (yy < cut.length) k = cut[yy]; else if (h - 1 - yy < cut.length) k = cut[h - 1 - yy];
        this.hline(x + k, y + yy, w - 2 * k, c);
      }
    }
    line(x0, y0, x1, y1, c, dash) {
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, i = 0;
      for (;;) {
        if (!dash || i % (dash[0] + dash[1]) < dash[0]) this.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
        i++;
      }
    }
    circle(cx, cy, r, c, dash) {
      const seen = new Set(), pts = [];
      let x = r, y = 0, d = 1 - r;
      while (x >= y) {
        for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
          const k = K(cx + a, cy + b); if (!seen.has(k)) { seen.add(k); pts.push([cx + a, cy + b]); }
        }
        y += 1;
        if (d < 0) d += 2 * y + 1; else { x -= 1; d += 2 * (y - x) + 1; }
      }
      pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
      pts.forEach((p, i) => { if (!dash || i % (dash[0] + dash[1]) < dash[0]) this.px(p[0], p[1], c); });
    }
    disc(cx, cy, r, c) {
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + r * 0.8) this.px(cx + xx, cy + yy, c);
    }
    dither(x, y, w, h, c, level, off) {
      const o = off || [0, 0];
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (BAYER[pm(yy + o[1], 4)][pm(xx + o[0], 4)] < level) this.px(xx, yy, c);
    }
    remap(x, y, w, h, mp) {
      for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        const c = this.get(xx, yy); if (c in mp) this.px(xx, yy, mp[c]);
      }
    }
    blit(rws, x, y, flip, recolor, skip) {
      rws.forEach((row, j) => {
        const n = row.length;
        for (let i = 0; i < n; i++) {
          let ch = row[flip ? n - 1 - i : i];
          if (ch === "." || ch === " " || ch == null) continue;
          if (skip && skip.includes(ch)) continue;
          if (recolor && ch in recolor) ch = recolor[ch];
          this.px(x + i, y + j, ch);
        }
      });
    }
    outline_blit(rws, x, y, oc, flip, recolor, diag) {
      const filled = new Set();
      rws.forEach((row, j) => { const n = row.length; for (let i = 0; i < n; i++) { const ch = row[flip ? n - 1 - i : i]; if (ch !== "." && ch !== " ") filled.add(K(i, j)); } });
      const nb = diag ? N8 : N4;
      for (const k of filled) { const i = KX(k), j = KY(k); for (const [dx, dy] of nb) if (!filled.has(K(i + dx, j + dy))) this.px(x + i + dx, y + j + dy, oc || "z"); }
      this.blit(rws, x, y, flip, recolor);
    }
    tw(s, sz, scale) { return mask(s, sz || 12).w * (scale || 1); }
    // px.py Canvas.text: outline, then shadow, then fill.
    text(x, y, s, c, o) {
      o = o || {};
      const sz = o.sz || 12, scale = o.scale || 1, sdir = o.sdir || [1, 1], align = o.align || "l", diag = o.diag !== false, spacing = o.spacing || 0;
      if (spacing) {
        let cx = x;
        if (align !== "l") {
          let tot = spacing * ([...s].length - 1);
          for (const ch of s) tot += this.tw(ch, sz, scale);
          cx = x - (align === "r" ? tot : fd(tot, 2));
        }
        for (const ch of s) { this.text(cx, y, ch, c, Object.assign({}, o, { align: "l", spacing: 0 })); cx += this.tw(ch, sz, scale) + spacing; }
        return cx - x;
      }
      const m = mask(s, sz), wdt = m.w * scale;
      if (align === "c") x -= fd(wdt, 2); else if (align === "r") x -= wdt;
      const P = new Set();
      for (const [a0, b0] of m.pts) for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) P.add(K(x + a0 * scale + a, y + b0 * scale + b));
      if (o.outline) for (const k of P) { const a = KX(k), b = KY(k); for (const [dx, dy] of diag ? N8 : N4) if (!P.has(K(a + dx, b + dy))) this.px(a + dx, b + dy, o.outline); }
      if (o.shadow) for (const k of P) { const a = KX(k), b = KY(k); if (!P.has(K(a + sdir[0], b + sdir[1]))) this.px(a + sdir[0], b + sdir[1], o.shadow); }
      for (const k of P) this.px(KX(k), KY(k), c);
      return wdt;
    }
  }

  // ---------- l2_common.py ----------
  function textset(s, sz, scale) {
    sz = sz || 12; scale = scale || 1;
    const m = mask(s, sz), P = new Set();
    for (const [a, b] of m.pts) for (let i = 0; i < scale; i++) for (let j = 0; j < scale; j++) P.add(K(a * scale + i, b * scale + j));
    return { P, w: m.w * scale };
  }
  function shiftSet(P, dx, dy) { const o = new Set(); for (const k of P) o.add(K(KX(k) + dx, KY(k) + dy)); return o; }
  // fancy_text(c, x, y, s, fill, {top, bottom, outline='z', shadow, sz, scale, sdir, diag, align, outline2, spacing})
  function fancy(c, x, y, s, fill, o) {
    o = Object.assign({ outline: "z", sz: 12, scale: 1, sdir: [1, 1], diag: true, align: "l", spacing: 0 }, o || {});
    let P, w;
    if (o.spacing) {
      P = new Set(); let cx = 0;
      for (const ch of s) { const t = textset(ch, o.sz, o.scale); for (const k of t.P) P.add(K(KX(k) + cx, KY(k))); cx += t.w + o.spacing; }
      w = cx - o.spacing;
    } else { const t = textset(s, o.sz, o.scale); P = t.P; w = t.w; }
    if (o.align === "c") x -= fd(w, 2); else if (o.align === "r") x -= w;
    P = shiftSet(P, x, y);
    const O = new Set();
    if (o.outline) for (const k of P) { const a = KX(k), b = KY(k); for (const [dx, dy] of o.diag ? N8 : N4) if (!P.has(K(a + dx, b + dy))) O.add(K(a + dx, b + dy)); }
    const O2 = new Set();
    if (o.outline2) {
      const base = union(P, O);
      for (const k of base) { const a = KX(k), b = KY(k); for (const [dx, dy] of N4) if (!base.has(K(a + dx, b + dy))) O2.add(K(a + dx, b + dy)); }
    }
    const base = union(P, O, O2);
    if (o.shadow) for (const k of base) { const q = K(KX(k) + o.sdir[0], KY(k) + o.sdir[1]); if (!base.has(q)) c.px(KX(q), KY(q), o.shadow); }
    for (const k of O2) c.px(KX(k), KY(k), o.outline2);
    for (const k of O) c.px(KX(k), KY(k), o.outline);
    for (const k of P) {
      const a = KX(k), b = KY(k);
      let col = fill;
      if (o.top && !P.has(K(a, b - 1))) col = o.top;
      else if (o.bottom && !P.has(K(a, b + 1))) col = o.bottom;
      c.px(a, b, col);
    }
    return w;
  }
  function cham(x, y, w, h, k) {
    const M = new Set();
    for (let yy = 0; yy < h; yy++) {
      const ins = Math.max(0, k - yy, k - (h - 1 - yy));
      for (let xx = x + ins; xx < x + w - ins; xx++) M.add(K(xx, y + yy));
    }
    return M;
  }
  function roundM(x, y, w, h, r) {
    const M = new Set();
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const cx = Math.min(Math.max(xx, r), w - 1 - r), cy = Math.min(Math.max(yy, r), h - 1 - r);
      if ((xx - cx) ** 2 + (yy - cy) ** 2 <= r * r + r * 0.6) M.add(K(x + xx, y + yy));
    }
    return M;
  }
  function rectM(x, y, w, h) { const M = new Set(); for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) M.add(K(x + i, y + j)); return M; }
  function paint(c, M, col) { for (const k of M) c.px(KX(k), KY(k), col); }
  function grow(M, n, diag) {
    for (let t = 0; t < (n || 1); t++) { const o = new Set(M); for (const k of M) for (const [dx, dy] of diag ? N8 : N4) o.add(K(KX(k) + dx, KY(k) + dy)); M = o; }
    return M;
  }
  function shrink(M, n) {
    for (let t = 0; t < (n || 1); t++) { const o = new Set(); for (const k of M) if (N4.every(([dx, dy]) => M.has(K(KX(k) + dx, KY(k) + dy)))) o.add(k); M = o; }
    return M;
  }
  // Outer ring of M: top / left -> hi, bottom / right -> lo.
  function bevel(c, M, hi, lo, mid, width) {
    const inner = shrink(M, width || 1);
    for (const k of M) {
      if (inner.has(k)) continue;
      const a = KX(k), b = KY(k);
      const up = !M.has(K(a, b - 1)), lf = !M.has(K(a - 1, b)), dn = !M.has(K(a, b + 1)), rt = !M.has(K(a + 1, b));
      let col;
      if (up || lf) {
        col = !(dn || rt) || up ? hi : (mid || hi);
        if (lf && dn && !up) col = mid || lo;
        if (up && rt && !lf) col = mid || hi;
      } else if (dn || rt) col = lo;
      else col = mid || hi;
      c.px(a, b, col);
    }
    return inner;
  }
  function dropShadow(c, M, dx, dy, level, m) {
    dx = dx == null ? 2 : dx; dy = dy == null ? 3 : dy; level = level == null ? 10 : level; m = m || DARK;
    for (const k of M) {
      const qx = KX(k) + dx, qy = KY(k) + dy;
      if (M.has(K(qx, qy))) continue;
      if (qx >= 0 && qx < c.w && qy >= 0 && qy < c.h && BAYER[qy % 4][qx % 4] < level) { const v = c.get(qx, qy); c.raw(qx, qy, v in m ? m[v] : v); }
    }
  }
  const ARROW = {
    up: rows("\n...#...\n..###..\n.#####.\n#######"), down: rows("\n#######\n.#####.\n..###..\n...#..."),
    up5: rows("\n..#..\n.###.\n#####"), down5: rows("\n#####\n.###.\n..#.."),
    left5: rows("\n..#\n.##\n###\n.##\n..#"), right5: rows("\n#..\n##.\n###\n##.\n#.."),
    left7: rows("\n...#\n..##\n.###\n####\n.###\n..##\n...#"),
  };
  ARROW.right7 = ARROW.left7.map((r) => [...r].reverse().join(""));
  function glyphRows(c, g, x, y, col) { g.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") c.px(x + i, y + j, col); }); }
  function diamond(c, cx, cy, r, col) { for (let j = -r; j <= r; j++) { const k = r - Math.abs(j); c.hline(cx - k, cy + j, 2 * k + 1, col); } }
  const frame = (sid, i) => S().get(sid).frames[i || 0];
  function anim(sid, name, i) { return S().get(sid).animations[name].frames[i || 0]; }
  function menuIcon(c, i, x, y, recolor, outline) { const f = frame("ui.menu_icons", i); if (outline) c.outline_blit(f, x, y, outline, false, recolor); else c.blit(f, x, y, false, recolor); }
  const EMBLEM = { dungeon: 0, ruins: 1, cave: 2, forest: 3, sky: 4, cosmos: 5 };
  function emblem(c, theme, x, y) { c.blit(frame("ui.theme_emblem", EMBLEM[theme]), x, y); }

  // ---------- common.py ----------
  const COIN_BIG = rows(`
..zzzzz..
.zkkkkkz.
zklllkkjz
zklkkkkjz
zkkkkkkjz
zkkkkkkjz
zkkkkkjjz
.zjjjjjz.
..zzzzz..`);
  const COIN_SMALL = rows(`
.zzzzz.
zkllkjz
zlkkkjz
zkkkkjz
zkkkkjz
zjkkjjz
.zzzzz.`);
  function coinIcon(c, x, y, big) { c.blit(big ? COIN_BIG : COIN_SMALL, x, y); }
  function sparkle(c, x, y, col, size, core) {
    col = col || "t"; size = size || 1;
    c.px(x, y, core || col);
    for (let i = 1; i <= size; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) c.px(x + dx, y + dy, col);
  }

  // ---------- s1_crystal.py parts used everywhere ----------
  function shard(c, x, y, h, w, hi, a, b, d, edge, topFrac) {
    hi = hi || "t"; a = a || "s"; b = b || "r"; d = d || "q"; edge = edge || "z"; topFrac = topFrac == null ? 0.38 : topFrac;
    const M = new Map(), halfW = fd(w, 2), cx = x + halfW, tj = Math.max(1, Math.trunc(h * topFrac));
    for (let j = 0; j < h; j++) {
      const hw = j < tj ? pyRound(j / tj * halfW) : pyRound((h - 1 - j) / (h - tj) * halfW);
      for (let i = -hw; i <= hw; i++) {
        let col = i < 0 ? a : i > 0 ? b : hi;
        if (j >= tj) col = { [a]: b, [hi]: a, [b]: d }[col];
        M.set(K(cx + i, y + j), col);
      }
    }
    for (const k of M.keys()) { const p = KX(k), q = KY(k); for (const [dx, dy] of N4) if (!M.has(K(p + dx, q + dy))) c.px(p + dx, q + dy, edge); }
    for (const [k, col] of M) c.px(KX(k), KY(k), col);
  }
  function hshard(c, x, y, w, h, hi, a, b, d, edge) {
    hi = hi || "t"; a = a || "s"; b = b || "r"; d = d || "q"; edge = edge || "z";
    const M = new Map(), cy = y + fd(h, 2), half = fd(h, 2), tl = Math.max(1, Math.trunc(w * 0.55));
    for (let i = 0; i < w; i++) {
      const hh = i < tl ? pyRound(i / tl * half) : pyRound((w - 1 - i) / (w - tl) * half);
      for (let j = -hh; j <= hh; j++) {
        let col = j < 0 ? a : j > 0 ? b : hi;
        if (i >= tl) col = { [a]: hi, [hi]: a, [b]: d }[col];
        M.set(K(x + i, cy + j), col);
      }
    }
    for (const k of M.keys()) { const p = KX(k), q = KY(k); for (const [dx, dy] of N8) if (!M.has(K(p + dx, q + dy))) c.px(p + dx, q + dy, edge); }
    for (const [k, col] of M) c.px(KX(k), KY(k), col);
  }
  function gem(c, cx, cy, kind) {
    const [hi, a, b, d] = kind === "v" || kind == null ? ["t", "D", "C", "B"] : ["t", "s", "r", "q"];
    diamond(c, cx, cy, 3, "z"); diamond(c, cx, cy, 2, b);
    c.px(cx - 1, cy - 1, hi); c.px(cx, cy - 2, a); c.px(cx - 2, cy, a); c.px(cx - 1, cy, a); c.px(cx, cy - 1, a);
    c.px(cx + 1, cy + 1, d); c.px(cx, cy + 2, d); c.px(cx + 2, cy, d);
  }
  function panel(c, x, y, w, h, k, o) {
    k = k == null ? 5 : k; o = Object.assign({ body: "y", gems: true, facets: true }, o || {});
    const M = cham(x, y, w, h, k);
    dropShadow(c, M, 2, 3, 9);
    paint(c, M, "z");
    bevel(c, cham(x + 1, y + 1, w - 2, h - 2, k - 1), "s", "q", "r");
    const B = cham(x + 2, y + 2, w - 4, h - 4, Math.max(0, k - 2));
    paint(c, B, o.body);
    for (const kk of B) { const a = KX(kk), b = KY(kk); if (!B.has(K(a, b - 1))) c.px(a, b, "x"); }
    if (o.facets) for (const [off, L] of [[0, 7], [4, 4]]) for (let t = 0; t < L; t++) { const px = x + w - 18 + off + t, py = y + 9 - t; if (B.has(K(px, py))) c.px(px, py, "x"); }
    if (o.gems) {
      const hk = fd(k, 2);
      for (const [gx, gy] of [[x + hk + 1, y + hk + 1], [x + w - 2 - hk, y + hk + 1], [x + hk + 1, y + h - 2 - hk], [x + w - 2 - hk, y + h - 2 - hk]]) gem(c, gx, gy, "v");
    }
    return B;
  }
  function plate(c, x, y, w, h, k, body) {
    k = k == null ? 3 : k; body = body || "y";
    const M = cham(x, y, w, h, k);
    dropShadow(c, M, 1, 2, 8);
    paint(c, M, "z");
    bevel(c, cham(x + 1, y + 1, w - 2, h - 2, k - 1), "s", "q", "r");
    paint(c, cham(x + 2, y + 2, w - 4, h - 4, Math.max(0, k - 2)), body);
  }

  // ---------- fixed/kit.py ----------
  function dim(c, n, box) {
    const [x0, y0, x1, y1] = box || [0, 0, c.w, c.h];
    for (let y = Math.max(0, y0); y < Math.min(c.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(c.w, x1); x++) {
      let v = c.get(x, y); for (let i = 0; i < (n || 1); i++) v = dk(v); c.raw(x, y, v);
    }
  }
  function copyFrom(c, src, sx, sy, w, h, dx, dy) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (sx + i >= 0 && sx + i < src.w && sy + j >= 0 && sy + j < src.h) c.px(dx + i, dy + j, src.get(sx + i, sy + j));
  }
  // fixed/kit.py wrap: CJK per character, ASCII words kept whole, no line starting with closing punctuation.
  const NO_START = new Set([..."，。、；：！？）」』》…—·,.;:!?)%"]), NO_END = new Set([..."（「『《("]);
  const asciiWord = (ch) => /^[A-Za-z0-9.:\/%]$/.test(ch);
  function units(s) {
    const out = [], a = [...s];
    for (let i = 0; i < a.length;) {
      if (a[i] === "…" && a[i + 1] === "…") { out.push("……"); i += 2; continue; }
      if (asciiWord(a[i])) { let j = i; while (j < a.length && asciiWord(a[j])) j++; out.push(a.slice(i, j).join("")); i = j; }
      else { out.push(a[i]); i++; }
    }
    return out;
  }
  // Works on units, so a word carried over to the next line (before closing punctuation) moves whole.
  function wrap(c, s, sz, maxw) {
    const lines = []; let cur = [];
    const str = (a) => a.join("");
    for (const u of units(s)) {
      if (!cur.length || c.tw(str(cur) + u, sz) <= maxw) { cur.push(u); continue; }
      const last = cur[cur.length - 1];
      if ((NO_START.has([...u][0]) || NO_END.has([...last].pop())) && cur.length > 1) { lines.push(str(cur.slice(0, -1)).trimEnd()); cur = [last, u]; }
      else { lines.push(str(cur).trimEnd()); cur = u.trim() ? [u.trimStart()] : []; }
    }
    if (cur.length) lines.push(str(cur));
    return lines;
  }
  // Fit a string into maxw with a trailing ellipsis (for overflow in long translations).
  function clip(c, s, sz, maxw) {
    if (c.tw(s, sz) <= maxw) return s;
    const a = [...s];
    while (a.length && c.tw(a.join("") + "…", sz) > maxw) a.pop();
    return a.join("").trimEnd() + "…";
  }
  function para(c, x, y, s, col, sz, maxw, lh, align, lines, maxLines) {
    sz = sz || 10; lh = lh || sz + 2; align = align || "l";
    let L = lines || wrap(c, s, sz, maxw);
    if (maxLines && L.length > maxLines) L = L.slice(0, maxLines - 1).concat([clip(c, L.slice(maxLines - 1).join(" "), sz, maxw)]);
    L.forEach((ln, i) => { const xx = align === "l" ? x : align === "c" ? x + fd(maxw, 2) : x + maxw; c.text(xx, y + i * lh, ln, col, { sz, align }); });
    return L.length * lh;
  }
  function rich(c, x, y, parts, sz, align) {
    sz = sz || 10;
    const W = parts.reduce((s, [t]) => s + c.tw(t, sz), 0);
    if (align === "c") x -= fd(W, 2); else if (align === "r") x -= W;
    for (const [t, col] of parts) { c.text(x, y, t, col, { sz }); x += c.tw(t, sz); }
    return W;
  }
  function card(c, x, y, w, h, k, ring, body, shadow) {
    k = k == null ? 4 : k; ring = ring || ["s", "q", "r"]; body = body || "y";
    const M = cham(x, y, w, h, k);
    if (shadow !== false) dropShadow(c, M, 2, 3, 9);
    paint(c, M, "z");
    bevel(c, cham(x + 1, y + 1, w - 2, h - 2, k - 1), ring[0], ring[1], ring[2]);
    const B = cham(x + 2, y + 2, w - 4, h - 4, Math.max(0, k - 2));
    paint(c, B, body);
    return B;
  }
  function hairline(c, x, y, w, col, step) { for (let xx = x; xx < x + w; xx += step || 3) c.px(xx, y, col || "x"); }
  function divider(c, x, y, w, col, mid) {
    col = col || "q"; mid = mid === undefined ? "s" : mid;
    c.hline(x + 3, y, w - 6, col);
    diamond(c, x + 1, y, 1, col); diamond(c, x + w - 2, y, 1, col);
    if (mid) { diamond(c, x + fd(w, 2), y, 2, "z"); diamond(c, x + fd(w, 2), y, 1, mid); }
  }
  function panelTitle(c, x, y, w, text, sz, icon) {
    sz = sz || 12;
    const t = c.tw(text, sz) + (icon ? 11 : 0), cx = x + fd(w, 2);
    let tx = cx - fd(t, 2);
    if (icon) { icon(tx, y + fd(sz - 7, 2) + (sz === 12 ? 1 : 0)); tx += 11; }
    c.text(tx, y, text, "t", { sz });
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? cx - fd(t, 2) - 6 : cx + fd(t, 2) + 5, yy = y + fd(sz, 2);
      diamond(c, x0, yy, 1, "s");
      for (let k = 0; k < 10; k++) c.px(x0 + side * (3 + k), yy, k < 6 ? "q" : k % 2 === 0 ? "q" : null);
    }
    return y + sz + 3;
  }
  function selRow(c, x, y, w, h, cursor, cx, glint) {
    h = h || 14;
    paint(c, cham(x, y, w, h, 3), "r");
    paint(c, cham(x + 1, y + 1, w - 2, h - 2, 2), "q");
    c.hline(x + 3, y + 1, w - 6, "s"); c.hline(x + 3, y + h - 2, w - 6, "y");
    if (glint !== false) for (let t = 0; t < 4; t++) { c.px(x + w - 20 + t, y + h - 3 - t * 2, "r"); c.px(x + w - 20 + t, y + h - 4 - t * 2, "r"); }
    if (cursor !== false) hshard(c, cx != null ? cx : x - 6, y + fd(h - 11, 2), 12, 11);
  }
  const ARROWS = ["up", "down", "left", "right"];
  function keycap(c, x, y, label, arrow) {
    const w = arrow ? 11 : c.tw(label, 10) + 7;
    paint(c, cham(x, y, w, 11, 2), "z");
    paint(c, cham(x + 1, y + 1, w - 2, 9, 1), "r"); c.hline(x + 2, y + 1, w - 4, "s"); c.hline(x + 2, y + 9, w - 4, "q");
    paint(c, cham(x + 2, y + 2, w - 4, 7, 0), "q"); c.hline(x + 2, y + 2, w - 4, "r");
    if (arrow === "up" || arrow === "down") glyphRows(c, ARROW[arrow + "5"], x + 3, y + 4, "t");
    else if (arrow === "left" || arrow === "right") glyphRows(c, ARROW[arrow + "5"], x + 4, y + 3, "t");
    else c.text(x + fd(w, 2), y + 1, label, "t", { sz: 10, align: "c" });
    return w;
  }
  function keysWidth(c, items) {
    let W = 0;
    items.forEach(([ks, lab], n) => {
      ks.forEach((k, i) => { W += ARROWS.includes(k) ? 11 : c.tw(k, 10) + 7; if (i < ks.length - 1) W += 1; });
      W += 3 + c.tw(lab, 10);
      if (n < items.length - 1) W += 9;
    });
    return W;
  }
  function keybar(c, items, x, y, align, framed) {
    x = x == null ? 10 : x; y = y == null ? 163 : y;
    const W = keysWidth(c, items);
    if (align === "r") x -= W + 10; else if (align === "c") x -= fd(W + 10, 2);
    if (framed !== false) plate(c, x, y - 2, W + 10, 15, 3);
    let xx = x + 5;
    for (const [ks, lab] of items) {
      ks.forEach((k, i) => { xx += ARROWS.includes(k) ? keycap(c, xx, y, null, k) : keycap(c, xx, y, k); if (i < ks.length - 1) xx += 1; });
      xx += 3; c.text(xx, y + 1, lab, "u", { sz: 10 }); xx += c.tw(lab, 10) + 9;
    }
    return [x, W + 10];
  }
  function button(c, x, y, w, label, o) {
    o = Object.assign({ sel: false, h: 15, key: null, icon: null, cursor: true, dis: false }, o || {});
    const h = o.h, M = cham(x, y, w, h, 3);
    dropShadow(c, M, 1, 2, 8); paint(c, M, "z");
    const R = cham(x + 1, y + 1, w - 2, h - 2, 2);
    if (o.sel) {
      bevel(c, R, "s", "q", "r");
      paint(c, cham(x + 2, y + 2, w - 4, h - 4, 1), "q");
      c.hline(x + 4, y + 2, w - 8, "r");
      for (let t = 0; t < 3; t++) { c.px(x + w - 12 + t, y + h - 4 - t * 2, "r"); c.px(x + w - 12 + t, y + h - 5 - t * 2, "r"); }
    } else {
      bevel(c, R, "w", "y", "x");
      paint(c, cham(x + 2, y + 2, w - 4, h - 4, 1), "y");
    }
    const col = o.sel ? "t" : o.dis ? "w" : "u";
    const cont = c.tw(label, 12) + (o.key ? c.tw(o.key, 10) + 7 + 3 : 0) + (o.icon ? 14 : 0);
    let xx = x + fd(w - cont, 2);
    if (o.key) xx += keycap(c, xx, y + 2, o.key) + 3;
    if (o.icon) { o.icon(xx, y + fd(h - 12, 2)); xx += 14; }
    c.text(xx, y + fd(h - 11, 2), label, col, { sz: 12 });
    if (o.sel && o.cursor) hshard(c, x - 7, y + fd(h - 11, 2), 12, 11);
  }
  function tag(c, x, y, text, body, hi, ink) {
    body = body || "B"; hi = hi || "C"; ink = ink || "t";
    const w = c.tw(text, 10) + 6;
    paint(c, cham(x, y, w, 11, 2), "z");
    paint(c, cham(x + 1, y + 1, w - 2, 9, 1), body);
    c.hline(x + 2, y + 1, w - 4, hi);
    c.text(x + 3, y + 1, text, ink, { sz: 10 });
    return w;
  }
  function coinChip(c, xr, y, value, h) {
    h = h || 14;
    const w = 16 + c.tw(value, 10) + 8;
    plate(c, xr - w, y, w, h, 3);
    coinIcon(c, xr - w + 4, y + fd(h - 9, 2), true);
    c.text(xr - 5, y + fd(h - 9, 2), value, "t", { sz: 10, align: "r" });
    return w;
  }
  function pips(c, x, y, n, total, r, gap, on, off, hi) {
    r = r || 2; gap = gap == null ? 2 : gap; on = on || "s"; off = off || "x"; hi = hi || "t";
    for (let i = 0; i < total; i++) {
      const cx = x + r + i * (2 * r + 1 + gap);
      diamond(c, cx, y + r, r + 1, "z");
      if (i < n) {
        diamond(c, cx, y + r, r, on);
        if (r > 1) c.px(cx, y + r - r + 1, hi);
        if (r > 1) c.px(cx - 1, y + r, r > 2 ? hi : on);
      } else {
        diamond(c, cx, y + r, r, off);
        if (r > 1) diamond(c, cx, y + r, r - 1, "y");
      }
    }
    return total * (2 * r + 1 + gap) - gap;
  }
  function slider(c, x, y, v, n, sel) {
    n = n || 10;
    for (let i = 0; i < n; i++) {
      const xx = x + i * 5;
      c.rect(xx - 1, y - 1, 5, 9, "z");
      if (i < v) { c.rect(xx, y, 3, 7, "r"); c.hline(xx, y, 3, sel ? "t" : "s"); c.hline(xx, y + 6, 3, "q"); }
      else { c.rect(xx, y, 3, 7, "x"); c.hline(xx, y, 3, "w"); }
    }
    return n * 5 - 1;
  }
  function toggle(c, x, y, on, sel) {
    const w = 17, h = 9;
    paint(c, cham(x, y, w, h, 2), "z");
    paint(c, cham(x + 1, y + 1, w - 2, h - 2, 1), on ? "q" : "y");
    const kx = on ? x + w - 8 : x + 2;
    paint(c, cham(kx, y + 2, 6, 5, 1), on ? "s" : sel ? "v" : "w");
    c.hline(kx + 1, y + 2, 4, on ? "t" : sel ? "u" : "v");
    return w;
  }
  function valueSel(c, xr, y, text, sel, sz, col) {
    sz = sz || 12;
    const w = c.tw(text, sz), dy = (sz === 12 ? 2 : 1) + 1;
    if (sel) {
      glyphRows(c, ARROW.right5, xr - 3, y + dy, "s");
      c.text(xr - 6, y, text, col || "l", { sz, align: "r" });
      glyphRows(c, ARROW.left5, xr - 6 - w - 6, y + dy, "s");
      return w + 12;
    }
    c.text(xr, y, text, col || "v", { sz, align: "r" });
    return w;
  }
  function slot(c, x, y, s, sel) {
    s = s || 18;
    paint(c, cham(x, y, s, s, 2), "z");
    bevel(c, cham(x + 1, y + 1, s - 2, s - 2, 1), sel ? "s" : "y", sel ? "q" : "w", "x");
    paint(c, cham(x + 2, y + 2, s - 4, s - 4, 0), sel ? "x" : "y");
    c.hline(x + 2, y + 2, s - 4, sel ? "y" : "z");
  }
  // Framed scene crop; (x, y) = top-left of the visible crop; src is a canvas.
  function windowCrop(c, x, y, src, sx, sy, w, h, k, ring) {
    k = k == null ? 2 : k; ring = ring || ["s", "q", "r"];
    const M = cham(x - 2, y - 2, w + 4, h + 4, k + 1);
    dropShadow(c, M, 2, 3, 9); paint(c, M, "z");
    bevel(c, cham(x - 1, y - 1, w + 2, h + 2, k), ring[0], ring[1], ring[2]);
    for (const kk of cham(x, y, w, h, Math.max(0, k - 1))) {
      const a = KX(kk), b = KY(kk), sa = sx + a - x, sb = sy + b - y;
      if (sa >= 0 && sa < src.w && sb >= 0 && sb < src.h) c.px(a, b, src.get(sa, sb));
    }
  }
  function portrait(c, x, y, sid, fr, s, flip) {
    s = s || 28;
    card(c, x, y, s, s, 3);
    c.rect(x + 2, y + s - 9, s - 4, 6, "x"); c.hline(x + 2, y + s - 10, s - 4, "w");
    const f = frame(sid, fr || 0), fw = f[0].length, fh = f.length;
    c.blit(f, x + fd(s - fw, 2), y + s - 2 - fh, flip);
  }
  function sayBubble(c, x, y, w, h, tail, ring, body, k, tailSide) {
    ring = ring || "r"; body = body || "y"; k = k == null ? 3 : k; tailSide = tailSide || "b";
    const M = cham(x, y, w, h, k), T = new Set();
    if (tail) {
      const [tx, ty] = tail;
      if (tailSide === "b") {
        for (let j = 0; j < ty - (y + h - 1); j++) { const m = Math.max(0, 3 - j); for (let i = -m; i <= m; i++) T.add(K(tx + i, y + h - 1 + j)); }
      } else {
        for (let j = 0; j < y - ty; j++) { const m = Math.max(0, 3 - j); for (let i = -m; i <= m; i++) T.add(K(tx + i, y - j)); }
      }
    }
    const A = union(M, T);
    dropShadow(c, A, 1, 2, 8);
    paint(c, minus(grow(A, 1), A), "z");
    paint(c, A, ring);
    const sM = shrink(M, 1), I = new Set(sM);
    for (const kk of T) { const a = KX(kk), b = KY(kk); if (A.has(K(a - 1, b)) && A.has(K(a + 1, b))) I.add(kk); }
    paint(c, I, body);
    for (const kk of sM) { const a = KX(kk), b = KY(kk); if (!sM.has(K(a, b - 1))) c.px(a, b, "x"); }
    return I;
  }
  function discSet(dx, dy, r) {
    const D = new Set();
    for (let a = dx - r; a <= dx + r; a++) for (let b = dy - r; b <= dy + r; b++) if ((a - dx) ** 2 + (b - dy) ** 2 <= r * r + r * 0.6) D.add(K(a, b));
    return D;
  }
  function thinkBubble(c, x, y, w, h, dots, body, ring) {
    body = body || "x"; ring = ring || "v";
    const M = roundM(x, y, w, h, 5), D = new Set();
    for (const [dx, dy, r] of dots || []) for (const k of discSet(dx, dy, r)) D.add(k);
    const A = union(M, D);
    dropShadow(c, A, 1, 2, 8);
    paint(c, minus(grow(A, 1), A), "z"); paint(c, A, ring);
    paint(c, shrink(M, 1), body);
    for (const [dx, dy, r] of dots || []) if (r >= 2) paint(c, shrink(discSet(dx, dy, r), 1), body);
    return M;
  }
  function nameChip(c, x, y, text, body, hi, ink, icon) {
    body = body || "B"; hi = hi || "C"; ink = ink || "t";
    const w = c.tw(text, 10) + 8 + (icon ? 10 : 0);
    paint(c, cham(x, y, w, 12, 2), "z");
    paint(c, cham(x + 1, y + 1, w - 2, 10, 1), body);
    c.hline(x + 2, y + 1, w - 4, hi);
    let xx = x + 4;
    if (icon) { icon(xx, y + 2); xx += 10; }
    c.text(xx, y + 2, text, ink, { sz: 10 });
    return w;
  }
  function toast(c, x, y, w, parts, icon, h) {
    h = h || 16;
    const M = cham(x, y, w, h, 3); dropShadow(c, M, 1, 2, 8); paint(c, M, "z");
    bevel(c, cham(x + 1, y + 1, w - 2, h - 2, 2), "D", "B", "C");
    paint(c, cham(x + 2, y + 2, w - 4, h - 4, 1), "y");
    let xx = x + 5;
    if (icon) { icon(xx, y + fd(h - 12, 2)); xx += 12; }
    rich(c, xx, y + fd(h - 9, 2), parts, 10);
  }
  function bigTitle(c, x, y, text, o) {
    o = Object.assign({ fill: "t", outline: "s", shadow: "q", align: "l", scale: 2, sz: 12, spacing: 2, outline2: "z", maxW: 300 }, o || {});
    if (o.scale === 2 && c.tw(text, o.sz) * 2 + o.spacing * ([...text].length - 1) > o.maxW) { o.scale = 1; o.spacing = 0; y += 6; }
    return fancy(c, x, y, text, o.fill, { outline: o.outline, outline2: o.outline2, shadow: o.shadow, sz: o.sz, scale: o.scale, sdir: [1, 2], diag: false, spacing: o.spacing, align: o.align });
  }
  function header(c, x, y, text, sz, icon, line) {
    sz = sz || 12;
    let xx = x;
    if (icon) { icon(xx, y - 2); xx += 20; } else { gem(c, xx + 3, y + 5, "c"); xx += 10; }
    c.text(xx + 1, y + 1, text, "z", { sz });
    c.text(xx, y, text, "t", { sz });
    const w = c.tw(text, sz);
    if (line !== false) {
      const L = 36;
      for (let k = 0; k < L; k++) if (k < 20 || k % 2 === 0) c.px(xx + w + 4 + k, y + 6, k > 6 ? "q" : "r");
      diamond(c, xx + w + 4 + L + 2, y + 6, 1, "q");
    }
    return xx + w;
  }
  function ratingBadge(c, cx, cy, letter, R) {
    R = R || 12;
    const M = cham(cx - R, cy - R, 2 * R, 2 * R, fd(R, 2) + 1);
    dropShadow(c, M, 2, 3, 9); paint(c, M, "z");
    bevel(c, cham(cx - R + 1, cy - R + 1, 2 * R - 2, 2 * R - 2, fd(R, 2)), "D", "B", "C");
    const B = cham(cx - R + 2, cy - R + 2, 2 * R - 4, 2 * R - 4, fd(R, 2) - 1);
    paint(c, B, "B");
    for (const k of B) { const a = KX(k), b = KY(k); if (a - (cx - R) + b - (cy - R) < R) c.px(a, b, "C"); }
    c.line(cx - R + 3, cy - 2, cx - 2, cy - R + 3, "D");
    fancy(c, cx, cy - 9, letter || "A", "l", { outline: "z", shadow: null, sz: 12, scale: 2, diag: false, align: "c", bottom: "k" });
  }
  // Level HUD (new segmented top bar): id + name (+ rule icon), lamps and the four action buttons.
  function levelHud(c, lid, name, o) {
    o = Object.assign({ lamps: [false], rule: null, sand: null }, o || {});
    c.rect(0, 0, 320, 20, "z");
    const w = 7 + c.tw(lid, 10) + 5 + c.tw(name, 12) + 7 + (o.rule ? 12 : 0);
    plate(c, 2, 1, w, 18, 3);
    c.text(8, 6, lid, "l", { sz: 10 });
    let xx = 8 + c.tw(lid, 10) + 5;
    c.text(xx, 4, name, "t", { sz: 12 }); xx += c.tw(name, 12) + 4;
    if (o.rule != null) { c.rect(xx, 6, 9, 9, "z"); c.blit(frame("ui.class_icon", o.rule), xx + 1, 7); }
    const icons = [0, 1, 2, 4];
    let gw = 6 + o.lamps.length * 11 + 6 + icons.length * 15 + 2;
    if (o.sand != null) gw += 30;
    const x0 = 318 - gw;
    plate(c, x0, 1, gw, 18, 3);
    xx = x0 + 5;
    if (o.sand != null) {
      let bag = frame("item.sandbag", 0);
      if (!o.sand) bag = bag.map((r) => [...r].map((v) => dk(v)));
      c.blit(bag, xx - 2, 2);
      c.text(xx + 13, 6, "×" + o.sand, o.sand ? "u" : "w", { sz: 10 }); xx += 30;
    }
    for (const on of o.lamps) { c.blit(frame("ui.goal_lamp", on ? 1 : 0), xx, 6); if (on) c.px(xx - 1, 5, "t"); xx += 11; }
    c.vline(xx + 1, 5, 11, "x"); xx += 6;
    for (const i of icons) { c.blit(frame("ui.icons", i), xx, 4); xx += 15; }
    return x0;
  }
  function minimap(c, x, y, mm) {
    plate(c, x, y, 32, 18, 3);
    if (!mm) return;
    for (const r of mm.rooms) {
      const cx = x + 4 + r.x * 6, cy = y + 3 + r.y * 4, cur = r.index === mm.cur;
      if (!r.seen) { c.rect(cx, cy, 5, 3, "x"); c.px(cx + 2, cy + 1, "D"); continue; }
      c.rect(cx, cy, 5, 3, { room: "w", gate: "k", station: "m", home: "D" }[r.role] || "w");
      if (cur) { c.rect(cx, cy, 5, 3, "s"); c.px(cx + 2, cy + 1, "t"); }
    }
  }

  PB.uk = {
    fd, pm, pyRound, H: Hh, DARK, LIGHT, BAYER, dk, rows, K, KX, KY, N4, N8, minus, union, mask, C,
    textset, shiftSet, fancy, cham, roundM, rectM, paint, grow, shrink, bevel, dropShadow, ARROW, glyph: glyphRows, diamond,
    frame, anim, menuIcon, EMBLEM, emblem, coinIcon, sparkle, shard, hshard, gem, panel, plate,
    dim, copyFrom, wrap, clip, para, rich, card, hairline, divider, panelTitle, selRow, keycap, keysWidth, keybar, button, tag,
    coinChip, pips, slider, toggle, valueSel, slot, window: windowCrop, portrait, sayBubble, thinkBubble, nameChip, toast,
    bigTitle, header, ratingBadge, levelHud, minimap,
  };
})(typeof window !== "undefined" ? window : globalThis);
