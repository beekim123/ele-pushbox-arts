/* ART-04d concept scene: 亡灵节小镇 (content/concepts/maps.json "muertos").
 * Look-only sketch for the workbench "地图概念" page: not a game asset, never approved.
 * Interface: PB_CONCEPT_SCENES.muertos.draw(ctx, tick) paints one 320x180 frame; tick += 8 per second.
 * ENDESGA 32 only (PB.RGB), integer pixels, no anti-aliasing.
 * Ambience steps at 4 fps (e = tick >> 1); animals at 8 fps (tick). */
(function () {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  let PB = null, RGB = null, D = null, IMG = null;

  // ---------- drawing kit (each concept scene carries its own copy) ----------
  function px(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H || !c || c === ".") return;
    const k = RGB[c], i = (y * W + x) << 2;
    D[i] = k[0]; D[i + 1] = k[1]; D[i + 2] = k[2]; D[i + 3] = 255;
  }
  function at(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const i = (y * W + x) << 2;
    return PB.codeOf(D[i], D[i + 1], D[i + 2]);
  }
  function rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c); }
  function bay(x, y) { return BAYER[((y & 3) << 2) | (x & 3)]; }
  function hash(x, y, s) { return PB.h32(x, y, s); }
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  // Colour bands from the top down, each dithered over `blend` px into the next one.
  function bands(stops, blend) {
    for (let y = 0; y < H; y++) {
      let k = 0;
      while (k + 1 < stops.length && y >= stops[k + 1][0]) k++;
      const c = stops[k][1];
      let c2 = c, lvl = 0;
      if (k + 1 < stops.length && y >= stops[k + 1][0] - blend) {
        c2 = stops[k + 1][1];
        lvl = Math.floor(((y - stops[k + 1][0] + blend + 1) * 16) / (blend + 1));
      }
      for (let x = 0; x < W; x++) px(x, y, bay(x, y) < lvl ? c2 : c);
    }
  }
  // Filled disc; with `lvl` (0..16) only the Bayer share of its pixels is painted (thin smoke).
  function disc(cx, cy, r, c, lvl) {
    const rr = r * r + r;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
      if (x * x + y * y <= rr && (lvl == null || bay(cx + x, cy + y) < lvl)) px(cx + x, cy + y, c);
  }
  function linePts(x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const out = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) return out;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function line(x0, y0, x1, y1, c) { for (const [x, y] of linePts(x0, y0, x1, y1)) px(x, y, c); }
  function remap(x, y, w, h, map, keep) {
    for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) {
      if (keep && !keep(i, j)) continue;
      const c = at(i, j);
      if (c && map[c]) px(i, j, map[c]);
    }
  }
  // Small sprite buffer: draw with primitives, add a 1px outline, stamp (optionally mirrored).
  function Spr(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  Spr.prototype.p = function (x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = c; return this; };
  Spr.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; };
  Spr.prototype.r = function (x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.p(i, j, c); return this; };
  Spr.prototype.e = function (cx, cy, rx, ry, c) {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++)
      if ((i * i) / (rx * rx + 0.6) + (j * j) / (ry * ry + 0.6) <= 1) this.p(cx + i, cy + j, c);
    return this;
  };
  Spr.prototype.l = function (x0, y0, x1, y1, c) { for (const [x, y] of linePts(x0, y0, x1, y1)) this.p(x, y, c); return this; };
  Spr.prototype.t = function (x0, y0, x1, y1, x2, y2, c) {
    const ed = (ax, ay, bx, by, x, y) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const area = ed(x0, y0, x1, y1, x2, y2);
    for (let y = Math.min(y0, y1, y2); y <= Math.max(y0, y1, y2); y++) for (let x = Math.min(x0, x1, x2); x <= Math.max(x0, x1, x2); x++) {
      const a = ed(x1, y1, x2, y2, x, y), b = ed(x2, y2, x0, y0, x, y), d = ed(x0, y0, x1, y1, x, y);
      if (area >= 0 ? a >= 0 && b >= 0 && d >= 0 : a <= 0 && b <= 0 && d <= 0) this.p(x, y, c);
    }
    return this;
  };
  Spr.prototype.outline = function (c) {
    const o = this.c.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      if (!this.get(x, y) && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) o[y * this.w + x] = c;
    this.c = o;
    return this;
  };
  function stamp(s, x, y, flip) {
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const c = s.c[j * s.w + i];
      if (c) px(flip ? x + s.w - 1 - i : x + i, y + j, c);
    }
  }
  function rows(list, x, y, flip) {
    for (let j = 0; j < list.length; j++) for (let i = 0; i < list[j].length; i++) {
      const c = list[j][i];
      if (c !== ".") px(flip ? x + list[j].length - 1 - i : x + i, y + j, c);
    }
  }
  // Scale references: a hero-sized (16x16) figure in the hero colours and a wooden crate.
  const HERO = [
    "................",
    "......zzzz......",
    ".....zlkkkz.....",
    "....zkkkkkkz....",
    "..zzkkkkkkkkzz..",
    "..zbbbbbbbbbbz..",
    "...zzEEEEEEzz...",
    "....zEEEzEEz....",
    "....zFEEEEEz....",
    "....zzhiiizz....",
    "...zhiiiiiiiz...",
    "..zEhiiiiiihEz..",
    "..zzhhiiiihhzz..",
    "....zhhhhhhz....",
    "....zxxzzxxz....",
    "....zzz..zzz....",
  ];
  function crate(x, y) {
    rect(x, y, 16, 16, "z");
    rect(x + 1, y + 1, 14, 14, "b");
    rect(x + 1, y + 1, 14, 1, "d"); rect(x + 1, y + 1, 1, 14, "d");
    rect(x + 1, y + 14, 14, 1, "e"); rect(x + 14, y + 1, 1, 14, "e");
    rect(x + 3, y + 3, 10, 10, "e");
    rect(x + 3, y + 3, 10, 1, "f"); rect(x + 3, y + 3, 1, 10, "f");
    for (let i = 0; i < 10; i++) {
      px(x + 3 + i, y + 12 - i, "b");
      if (i < 9) px(x + 3 + i, y + 11 - i, "d");
      if (i > 0) px(x + 3 + i, y + 13 - i, "f");
    }
  }
  // ---------- 亡灵节小镇: a warm, festive Day-of-the-Dead night ----------
  const STREET = 144, DARK_X = 262, ALTAR = [192, 248];
  const HOUSES = [
    { x: 0, w: 56, top: 80, wall: "C", shade: "B", trim: "D" },
    { x: 56, w: 56, top: 90, wall: "q", shade: "y", trim: "r" },
    { x: 112, w: 64, top: 72, wall: "e", shade: "f", trim: "d" },
    { x: 176, w: 82, top: 84, wall: "B", shade: "g", trim: "C" },
    { x: 258, w: 62, top: 76, wall: "n", shade: "o", trim: "m" },
  ];
  const FLAGS = ["D", "r", "k", "m", "C", "j"];

  function sky(e) {
    bands([[0, "z"], [30, "y"], [70, "B"]], 16);
    for (let i = 0; i < 26; i++) {
      const h = hash(i, 0, 81), x = h % W, y = 4 + ((h >> 9) % 62);
      if (hash(i, e >> 1, 83) % 6 === 0) continue;
      px(x, y, i % 7 === 0 ? "t" : i % 3 === 0 ? "u" : "v");
    }
  }

  // Now and then a small firework pops far away above the roofs.
  function firework(e) {
    const P = 38, a = e % P, n = Math.floor(e / P), h = hash(n, 0, 87);
    const x = 70 + (h % 180), y = 22 + ((h >> 8) % 24), c = FLAGS[(h >> 4) % FLAGS.length];
    if (a < 6) {
      const ry = 92 - Math.floor(((92 - y) * a) / 6);
      px(x, ry, "u"); px(x, ry + 1, "v");
    } else if (a < 18) {
      const b = a - 6, r = Math.min(9, 2 + b), drop = b > 6 ? (b - 6) >> 1 : 0;
      if (b === 0) disc(x, y, 1, "t");
      for (let k = 0; k < 12; k++) {
        const ang = (k * Math.PI * 2) / 12, fx = Math.round(x + Math.cos(ang) * r), fy = Math.round(y + Math.sin(ang) * r) + drop;
        if (b > 8 && bay(fx, fy) < (b - 8) * 4) continue;
        px(fx, fy, b > 7 ? "C" : c);
        if (b < 6) px(Math.round(x + Math.cos(ang) * (r - 2)), Math.round(y + Math.sin(ang) * (r - 2)), "u");
      }
    }
  }

  function farRoofs() {
    for (let x = 0; x < W; x++) {
      const b = Math.floor((x + 9) / 26), top = 86 + (hash(b, 0, 89) % 12);
      for (let y = top; y < 120; y++) px(x, y, (x + 9) % 26 < 2 ? "z" : "y");
      if ((x + 9) % 26 === 9 && hash(b, 1, 89) % 2 === 0) { px(x, top + 5, "b"); px(x + 1, top + 5, "b"); px(x, top + 6, "e"); px(x + 1, top + 6, "e"); }
    }
  }

  function archWindow(x, y, w, h, lit) {
    rect(x - 1, y, w + 2, h + 1, "f");
    rect(x, y + 1, w, h - 1, lit ? "d" : "z");
    if (lit) { rect(x, y + h - 4, w, 4, "b"); px(x + 1, y + 2, "c"); }
    px(x - 1, y, null); px(x + w, y, null);
    rect(x + (w >> 1), y + 1, 1, h - 1, "f");
  }
  function houses() {
    HOUSES.forEach((hs, i) => {
      const { x, w, top, wall, shade, trim } = hs;
      for (let y = top; y < STREET; y++) for (let xx = x; xx < x + w; xx++) {
        let c = wall;
        if (xx >= x + w - 3) c = shade;
        if (hash(xx >> 2, y >> 2, 91 + i) % 31 === 0 && bay(xx, y) < 8) c = shade;
        px(xx, y, c);
      }
      for (let xx = x; xx < x + w; xx++) {
        const step = (xx - x) % 12 < 6 ? 0 : 2;
        rect(xx, top - 3 + step, 1, 3 - step, trim);
        px(xx, top, trim);
      }
      rect(x, top + 2, w, 1, shade);
      const door = x + (w >> 1) - 5;
      rect(door, STREET - 22, 10, 22, "g"); rect(door + 1, STREET - 21, 8, 21, "f"); rect(door + 5, STREET - 21, 1, 21, "g");
      px(door, STREET - 22, wall); px(door + 9, STREET - 22, wall);
      archWindow(x + 6, top + 10, 7, 12, (i + 1) % 3 !== 0);
      archWindow(x + w - 15, top + 10, 7, 12, i % 2 === 0);
      if (top < 84) archWindow(x + (w >> 1) - 4, top + 34 - (top < 76 ? 6 : 0), 7, 10, true);
      rect(x + 4, top + 23, 11, 2, "f");
      for (let k = 0; k < 3; k++) { px(x + 6 + k * 3, top + 22, "j"); px(x + 7 + k * 3, top + 21, "k"); px(x + 6 + k * 3, top + 21, "j"); }
    });
  }

  // Papel picado: cut-paper flags on strings, flapping in the evening breeze.
  function banners(e) {
    for (const [x0, y0, x1, y1, sag, ph] of [[0, 58, 186, 54, 9, 0], [120, 46, 320, 52, 11, 5]]) {
      const n = Math.floor((x1 - x0) / 11), bob = tri(e + ph, 24, 1);
      for (let x = x0; x <= x1; x++) {
        const s = (x - x0) / (x1 - x0), y = Math.round(y0 + (y1 - y0) * s + sag * 4 * s * (1 - s)) + bob;
        px(x, y, "v");
      }
      for (let i = 0; i < n; i++) {
        const fx = x0 + 4 + i * 11, s = (fx + 4 - x0) / (x1 - x0);
        const fy = Math.round(y0 + (y1 - y0) * s + sag * 4 * s * (1 - s)) + bob + 1;
        const c = FLAGS[(i + ph) % FLAGS.length], sw = tri(e * 2 + i * 3 + ph, 10, 1);
        for (let j = 0; j < 9; j++) for (let k = 0; k < 7; k++) {
          const xx = fx + k + (j > 4 ? sw : 0);
          if (j === 8 && (k & 1)) continue;
          if ((j === 2 || j === 5) && (k === 2 || k === 4)) continue;
          if (j === 4 && k === 3) continue;
          px(xx, fy + j, j === 0 ? "u" : c);
        }
      }
    }
  }

  function street() {
    for (let x = 0; x < W; x++) for (let y = STREET; y < H; y++) {
      const d = y - STREET, row = Math.floor(d / 5), cx = Math.floor((x + (row & 1) * 4) / 8);
      const lx = (x + (row & 1) * 4) % 8, ly = d % 5;
      let c = "f";
      if (d === 0) c = "F";
      else if (ly === 4 || lx === 7) c = "g";
      else if (ly === 0 || lx === 0) c = hash(cx, row, 93) % 3 ? "e" : "f";
      px(x, y, c);
    }
  }

  // Marigold petals laid along the street up to the altar (look of the petal trail).
  function petalPath() {
    for (let x = 58; x < ALTAR[0] + 2; x++) {
      for (let y = STREET - 1; y < STREET + 3; y++) {
        const h = hash(x, y, 95) % 10;
        if (y === STREET - 1 && h > 3) continue;
        if (h < 6) px(x, y, h < 2 ? "k" : h < 5 ? "j" : "b");
      }
    }
  }
  function blownPetals(e) {
    for (let i = 0; i < 6; i++) {
      const L = 28, a = (e + i * 5) % L, g = Math.floor((e + i * 5) / L), h = hash(i, g, 97);
      if (a > 20) continue;
      const x0 = 70 + (h % 110), lift = a < 9 ? a * 2 : 18 - Math.floor((a - 9) * 1.5);
      const x = x0 + Math.floor(a * 1.4) + tri(a * 3 + i, 8, 1), y = STREET - 2 - Math.max(0, lift);
      px(x, y, i & 1 ? "j" : "k");
      if ((a + i) & 1) px(x + 1, y, "b"); else px(x, y + 1, "b");
    }
  }

  function candle(x, y, e, k) {
    rect(x, y - 3, 1, 3, "c");
    px(x, y - 1, "u");
    const f = hash(k, e, 99) % 4;
    px(x + (f === 3 ? 1 : 0), y - 4, "k");
    if (f !== 2) px(x, y - 5, f === 0 ? "l" : "k");
    if (f === 1) px(x, y - 6, "l");
  }
  function altarGlow(e) {
    const cx = 220, cy = 114, r = 34 + tri(e, 6, 1);
    for (let y = cy - r; y < STREET; y++) for (let x = cx - r - 8; x < cx + r + 8; x++) {
      const dx = (x - cx) * 0.85, dy = y - cy, q = Math.sqrt(dx * dx + dy * dy);
      if (q > r) continue;
      const lvl = Math.min(16, Math.floor(((r - q) * 16) / (r * 0.5)));
      if (bay(x, y) < lvl) { const c = at(x, y); if (c && PB.LIGHT[c]) px(x, y, PB.LIGHT[c]); }
    }
  }
  function altar(e) {
    const [x0, x1] = ALTAR;
    for (let k = 0; k < 15; k++) {
      const ang = Math.PI + (k * Math.PI) / 14, ax = Math.round(220 + Math.cos(ang) * 26), ay = Math.round(128 + Math.sin(ang) * 40);
      rect(ax - 1, ay - 1, 3, 3, "j"); px(ax, ay, "k"); px(ax - 1, ay - 1, "b");
      if (k % 3 === 1) px(ax + 2, ay, "o");
    }
    const tier = (tx0, tx1, ty0, ty1, cloth, fold, edge) => {
      rect(tx0, ty0, tx1 - tx0, ty1 - ty0, cloth);
      for (let x = tx0 + 3; x < tx1; x += 6) rect(x, ty0 + 2, 1, ty1 - ty0 - 2, fold);
      for (let x = tx0; x < tx1; x++) px(x, ty0, (x & 1) ? edge : cloth);
      rect(tx0, ty0 + 1, tx1 - tx0, 1, edge);
    };
    tier(x0, x1, 128, STREET, "C", "B", "D");
    tier(x0 + 8, x1 - 8, 117, 128, "c", "F", "u");
    tier(x0 + 16, x1 - 16, 107, 117, "D", "C", "c");
    for (const [fx, fy] of [[212, 101], [225, 102], [205, 111], [233, 111]]) {
      rect(fx, fy, 6, 6, "f"); rect(fx + 1, fy + 1, 4, 4, "w"); rect(fx + 2, fy + 2, 2, 3, "x"); px(fx + 2, fy + 1, "v"); px(fx + 3, fy + 1, "v");
    }
    for (const sx of [198, 238]) {
      rect(sx, 123, 5, 4, "u"); px(sx + 1, 124, "z"); px(sx + 3, 124, "z"); px(sx + 2, 126, "D"); px(sx, 123, "s"); px(sx + 4, 123, "D");
    }
    [[195, 128], [203, 128], [210, 117], [229, 117], [216, 107], [223, 107], [237, 128], [245, 128], [204, 144], [241, 144]].forEach(([x, y], k) => candle(x, y, e, k));
    for (const bx of [186, 252]) for (let k = 0; k < 4; k++) { rect(bx - 2 + (k & 1) * 3, 138 - (k >> 1) * 3, 3, 3, "j"); px(bx - 1 + (k & 1) * 3, 139 - (k >> 1) * 3, "k"); px(bx - 2 + (k & 1) * 3, 141, "o"); }
  }

  const GLOW = { p: "g", o: "f", n: "e", m: "F", y: "f", x: "e", z: "g", g: "f", f: "e", w: "F" };
  // Darkness (look only): the alley on the right is unlit except a window candle.
  function darkness(e) {
    const lx = 296, ly = 114, lr = 8 + tri(e, 6, 1);
    for (let y = 62; y < H; y++) for (let x = DARK_X; x < W; x++) {
      const edge = Math.min((x - DARK_X) * 1.6, (y - 62) * 1.6);
      let n = edge < 16 ? (bay(x, y) < edge ? 1 : 0) + (bay(x + 2, y + 1) < edge - 8 ? 1 : 0) : 2;
      const q = Math.sqrt((x - lx) * (x - lx) + (y - ly) * (y - ly));
      const lit = q < lr && (q < lr - 5 || bay(x, y) < ((lr - q) * 16) / 5);
      const c = at(x, y);
      if (!c) continue;
      let d = c;
      for (let k = 0; k < (lit ? 1 : n); k++) d = PB.DIM[d] || d;
      if (lit) d = GLOW[d] || d;
      if (d !== c) px(x, y, d);
    }
    rect(292, 118, 9, 2, "f");
    candle(296, 118, e, 21);
  }

  // Monster: a mischievous, see-through spirit drifting in the dark alley.
  const GHOST = {};
  function ghostSpr(f) {
    if (GHOST[f]) return GHOST[f];
    const s = new Spr(18, 20);
    s.e(9, 7, 6, 6, "#").r(3, 7, 13, 7, "#");
    for (let x = 3; x < 16; x++) { const b = ((x + f * 2) % 6) < 3; s.p(x, 14, "#"); if (b) s.p(x, 15, "#").p(x, 16, b && (x + f * 2) % 6 === 1 ? "#" : null); }
    s.outline("+");
    s.p(6, 6, "z").p(6, 7, "z").p(11, 6, "z").p(11, 7, "z").p(5, 5, "z").p(12, 4, "z");
    s.l(6, 10, 10, 10, "z").p(11, 9, "z").p(9, 11, "D").p(4, 9, "D").p(13, 9, "D");
    s.p(7, 1, "j").p(9, 0, "k").p(11, 1, "j").p(8, 1, "k").p(10, 1, "k");
    return (GHOST[f] = s);
  }
  function ghost(t) {
    const s = ghostSpr((t >> 2) & 1), x = 276 + tri(t, 96, 10), y = 94 + tri(t, 28, 3);
    const flip = tri(t + 24, 96, 1) < 0;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const c = s.c[j * s.w + i];
      if (!c) continue;
      const X = flip ? x + s.w - 1 - i : x + i, Y = y + j;
      if (c === "#") { const b = at(X, Y); if (bay(X, Y) < 5) px(X, Y, "u"); else if (b) px(X, Y, PB.LIGHT[PB.LIGHT[b]] || b); }
      else if (c === "+") { if (bay(X, Y) < 9) px(X, Y, "u"); }
      else px(X, Y, c);
    }
  }

  // Hint animal: a hairless dog (xoloitzcuintli) on the petal path, wagging its tail.
  const DOG = {};
  function dogSpr(f) {
    if (DOG[f]) return DOG[f];
    const s = new Spr(24, 16);
    s.t(3, 1, 2, 4, 4, 4, "e").t(7, 0, 5, 4, 9, 4, "F").p(7, 2, "D").p(7, 3, "D");
    s.e(6, 6, 3, 2, "F").r(1, 6, 5, 2, "F");
    s.l(7, 7, 9, 9, "F").l(8, 7, 10, 9, "F");
    s.e(14, 9, 6, 2, "F");
    s.r(9, 10, 2, 4, "F").r(17, 10, 2, 4, "F").r(12, 11, 1, 3, "e").r(19, 11, 1, 3, "e");
    for (let x = 9; x <= 19; x++) s.p(x, 11, "e");
    s.p(13, 8, "e").p(15, 8, "e");
    s.p(1, 6, "z").p(5, 5, "z").p(8, 8, "j").p(9, 9, "j").p(7, 8, "k");
    const [tx, ty] = [[23, 4], [23, 7], [22, 9], [23, 7]][f];
    s.l(20, 9, 21, 8, "F").l(21, 8, tx, ty, "F");
    s.outline("z");
    return (DOG[f] = s);
  }

  function render(t, e) {
    sky(e);
    firework(e);
    farRoofs();
    houses();
    altarGlow(e);
    banners(e);
    street();
    petalPath();
    altar(e);
    darkness(e);
    ghost(t);
    stamp(dogSpr(t & 3), 84, STREET - 15, false);
    blownPetals(e);
    crate(42, STREET - 16);
    rows(HERO, 22, STREET - 16, false);
  }

  window.PB_CONCEPT_SCENES.muertos = {
    draw(ctx, tick) {
      if (!D) { PB = window.PB; RGB = PB.RGB; D = new Uint8ClampedArray(W * H * 4); IMG = new ImageData(D, W, H); }
      const t = Math.max(0, Math.floor(tick) || 0);
      D.fill(0);
      render(t, t >> 1);
      ctx.putImageData(IMG, 0, 0);
    },
  };
})();
