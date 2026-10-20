/* ART-04d concept scene: 恐龙谷 (content/concepts/maps.json "dino").
 * Look-only sketch for the workbench "地图概念" page: not a game asset, never approved.
 * Interface: PB_CONCEPT_SCENES.dino.draw(ctx, tick) paints one 320x180 frame; tick += 8 per second.
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
  // A fern-like frond: stem from (x0, y0) along (dx, dy), drooping by `bend`, leaflets on both sides.
  function frond(x0, y0, len, dx, dy, bend, c, leaf) {
    let lx = x0, ly = y0;
    for (let i = 1; i <= len; i++) {
      const s = i / len;
      const x = Math.round(x0 + dx * len * s), y = Math.round(y0 + dy * len * s + bend * len * s * s);
      line(lx, ly, x, y, c);
      if (leaf && i % 2 === 0 && i < len) {
        const tx = Math.sign(x - lx), ty = Math.sign(y - ly), n = Math.max(1, Math.round((1 - s) * 4));
        for (let k = 1; k <= n; k++) {
          px(x - ty * k, y + tx * k + (k > 1 ? 1 : 0), leaf);
          px(x + ty * k, y - tx * k + (k > 1 ? 1 : 0), leaf);
        }
      }
      lx = x; ly = y;
    }
  }

  // ---------- 恐龙谷: prehistoric valley at dusk ----------
  const GROUND = 144, LEDGE = 112, LEDGE_X = 240;
  const TAR = [64, 112], TAR_Y = 149, LAVA = [176, 224], LAVA_Y = 157;
  const VX = 234, VTOP = 46, VHALF = 13;
  const WARM = { y: "g", x: "f", w: "e", z: "g", p: "g", o: "f", n: "e" };

  function inPit(x) { return (x >= TAR[0] && x < TAR[1]) || (x >= LAVA[0] && x < LAVA[1]); }
  function groundTop(x) { return x >= LEDGE_X ? LEDGE : GROUND; }
  function volcanoTop(x) {
    const a = Math.abs(x - VX), d = a - VHALF;
    if (d <= 0) return a > VHALF - 4 ? VTOP : VTOP + 2;
    return Math.floor(VTOP + d * 0.62 + d * d * 0.0035);
  }

  function sky() { bands([[0, "g"], [22, "B"], [48, "h"], [74, "a"], [98, "b"]], 7); }

  function ridge() {
    for (let x = 0; x < W; x++) {
      const top = 96 + tri(x * 2 + 40, 150, 9) + tri(x * 5 + 7, 44, 3);
      for (let y = top; y < 132; y++) px(x, y, y === top ? "h" : bay(x, y) < 3 ? "g" : "B");
    }
  }

  const STREAKS = [
    [[226, 48], [221, 58], [214, 70], [208, 84], [202, 100]],
    [[243, 48], [248, 60], [254, 74], [259, 90]],
  ].map((pts) => { const out = []; for (let i = 1; i < pts.length; i++) out.push(...linePts(...pts[i - 1], ...pts[i]).slice(i > 1 ? 1 : 0)); return out; });

  function volcano(e) {
    for (let x = 140; x < W; x++) {
      const top = volcanoTop(x);
      for (let y = top; y < 132; y++) {
        const left = x < VX;
        let c = left ? (bay(x, y) < 2 ? "g" : "f") : (bay(x, y) < 2 ? "z" : "g");
        const ang = Math.floor(Math.atan2(y - VTOP + 6, x - VX) * 40);
        if (y > top + 2 && hash(ang, 0, 5) % 5 === 0) c = left ? "g" : "z";
        if (y === top && left) c = "h";
        px(x, y, c);
      }
    }
    for (const pts of STREAKS) {
      for (const [x, y] of pts) px(x, y, "a");
      for (let k = 0; k < 3; k++) {
        const i = (e + k * 17) % pts.length;
        px(pts[i][0], pts[i][1], "k");
        if (i > 0) px(pts[i - 1][0], pts[i - 1][1], "j");
        if (i > 1) px(pts[i - 2][0], pts[i - 2][1], "j");
      }
    }
    for (let x = VX - 9; x <= VX + 9; x++) {
      px(x, VTOP + 2, hash(x, e, 5) % 4 === 0 ? "k" : "j");
      px(x, VTOP + 3, "a");
    }
  }

  // Smoke rises from the crater all the time and drifts with the wind.
  function smoke(e) {
    const L = 48, N = 16, ps = [];
    for (let i = 0; i < N; i++) {
      const v = e + i * 3, age = v % L, h = hash(i, Math.floor(v / L), 23);
      ps.push({ age, h });
    }
    ps.sort((a, b) => b.age - a.age);
    for (const { age, h } of ps) {
      const x = VX + Math.floor(age * 1.1 + (age * age) / 45) + (h % 7) - 3 + tri(age * 2 + h, 30, 1);
      const y = VTOP - 2 - Math.floor(age * 1.15) + ((h >> 3) % 5) - 2;
      const r = 2 + Math.floor(age / 4) + ((h >> 6) % 3), lvl = age > L - 16 ? Math.max(1, 16 - (age - (L - 16))) : 16;
      disc(x + 1, y + 2, r, "y", lvl);
      disc(x, y, r, age < 4 ? "f" : "x", lvl);
      disc(x - Math.ceil(r / 3), y - Math.ceil(r / 3), Math.max(1, r - 3), age < 4 ? "a" : "w", Math.min(12, lvl));
    }
  }

  // Now and then the crater throws sparks that arc up and fall back.
  function sparks(e) {
    const P = 44, a = e % P;
    if (a >= 16) return;
    const burst = Math.floor(e / P);
    for (let k = 0; k < 8; k++) {
      const h = hash(burst, k, 31), vx = ((h % 13) - 6) / 4, vy = -2.4 - ((h >> 4) % 8) / 6;
      const x = Math.round(VX + vx * a), y = Math.round(VTOP + vy * a + 0.22 * a * a);
      px(x, y, a < 6 ? "l" : a < 11 ? "k" : "j");
      px(x - Math.sign(vx), y + 1, a < 11 ? "j" : "a");
    }
  }

  // Hot air: rows of the distant view shift by one pixel in a slow travelling wave.
  const ROW = new Uint8ClampedArray(W * 4);
  function haze(e, y0, y1) {
    for (let y = y0; y < y1; y++) {
      const s = tri(y * 3 + e * 2, 26, 1);
      if (!s) continue;
      const base = y * W * 4;
      ROW.set(D.subarray(base, base + W * 4));
      for (let x = 0; x < W; x++) {
        const sx = Math.min(W - 1, Math.max(0, x - s)) * 4, dx = base + x * 4;
        D[dx] = ROW[sx]; D[dx + 1] = ROW[sx + 1]; D[dx + 2] = ROW[sx + 2];
      }
    }
  }

  function jungle() {
    for (let x = 0; x < W; x++) {
      const top = 110 + tri(x * 3 + 11, 58, 5) + tri(x * 7, 26, 2) + (hash(x >> 2, 0, 9) % 3);
      for (let y = top; y < 170; y++) px(x, y, y === top || (y < top + 6 && bay(x, y) < 2) ? "o" : "p");
    }
    for (const [x, hgt] of [[88, 30], [118, 22], [196, 26], [292, 20]]) {
      rect(x, 120 - hgt, 2, hgt, "p");
      for (const [dx, dy] of [[-1, -0.3], [-0.7, -0.9], [0, -1], [0.7, -0.9], [1, -0.3]]) frond(x + 1, 120 - hgt, 11, dx, dy, 0.9, "p", "p");
    }
  }

  function giantTree() {
    for (let y = 0; y < GROUND; y++) {
      const f = y > 116 ? Math.floor(((y - 116) * (y - 116)) / 36) : 0;
      const x1 = 17 + f;
      for (let x = 0; x <= x1; x++) px(x, y, x1 - x < 3 ? "g" : x < 3 ? "e" : "f");
    }
    for (const gx of [5, 10, 14]) for (let y = 0; y < GROUND; y++) px(gx + tri(y + gx * 5, 34, 1), y, "g");
    for (let k = 0; k < 6; k++) frond(4 + k * 9, 0, 22 + (k % 3) * 4, 0.55 + k * 0.08, 0.25, 0.75, "p", "o");
  }

  function cycad(x, base, hgt) {
    for (let y = base - hgt; y < base; y++) for (let i = 0; i < 8; i++) {
      const d = ((i + (y >> 1)) & 3) === 0 || ((i - (y >> 1)) & 3) === 0;
      px(x + i, y, d ? "g" : i < 3 ? "e" : "f");
    }
    const cx = x + 4, cy = base - hgt;
    for (const [dx, dy] of [[-1, -0.15], [-0.9, -0.6], [-0.45, -1], [0.05, -1], [0.5, -1], [0.9, -0.6], [1, -0.15]])
      frond(cx, cy, 17, dx, dy, 0.4, "o", "n");
  }

  function fern(x, y, size, c, leaf) {
    for (const [dx, dy] of [[-1, -0.6], [-0.55, -1.2], [0, -1.3], [0.55, -1.2], [1, -0.6]]) frond(x, y, size, dx, dy, 0.8, c, leaf);
  }

  function ground() {
    for (let x = 0; x < W; x++) {
      if (inPit(x)) continue;
      const top = groundTop(x);
      for (let y = top; y < H; y++) {
        const d = y - top, row = Math.floor(d / 9), joint = (hash(row, top, 7) % 16 + (x >> 4) * 16) % W;
        let c = "y";
        if (d % 9 === 8 || x === joint || (x === LEDGE_X && y > LEDGE)) c = "z";
        else if (hash(x, y, 3) % 19 === 0) c = "x";
        if (d === 0) c = "w"; else if (d === 1) c = "x";
        if (x === LEDGE_X && y > LEDGE + 1) c = "x";
        px(x, y, c);
      }
      if (hash(x, 0, 13) % 9 === 0) px(x, top - 1, "o");
      if (hash(x, 1, 13) % 23 === 0) { px(x, top - 1, "n"); px(x, top - 2, "n"); }
    }
  }

  function lava(e) {
    const [x0, x1] = LAVA;
    for (let y = GROUND; y < LAVA_Y + 2; y++) for (let x = x0; x < x1; x++) px(x, y, bay(x, y) < 7 ? "f" : "g");
    for (let x = x0; x < x1; x++) {
      const top = LAVA_Y + (tri(x * 2 + e, 18, 1) > 0 ? 1 : 0);
      for (let y = top; y < H; y++) {
        const d = y - top, u = x - (e >> 1);
        const h = hash(Math.floor(u / 5), Math.floor((y + tri(u, 18, 1)) / 3), 61) % 16;
        let c = d === 0 ? "k" : "j";
        if (d > 0 && h < 3) c = "k";
        if (d > 0 && h === 0 && ((x + y + (e >> 1)) & 3) === 0) c = "l";
        if (d > 2 && h > 12) c = "a";
        if (d === 0 && hash(u >> 2, 0, 63) % 5 === 0) c = "l";
        px(x, y, c);
      }
    }
    remap(x0 - 8, GROUND - 3, 8, H, WARM, (x, y) => bay(x, y) < (x - (x0 - 8)) * 2);
    remap(x1, GROUND - 3, 8, H, WARM, (x, y) => bay(x, y) < (x1 + 8 - x) * 2);
  }

  function tar(e) {
    const [x0, x1] = TAR;
    for (let y = GROUND; y < TAR_Y; y++) for (let x = x0; x < x1; x++) px(x, y, hash(x, y, 21) % 9 === 0 ? "x" : "y");
    for (let y = TAR_Y; y < H; y++) for (let x = x0; x < x1; x++) {
      const d = y - TAR_Y, u = (x + (e >> 1) + y * 3) >> 2;
      let c = "z";
      if (d === 0) c = hash(x >> 1, e >> 2, 25) % 4 === 0 ? "w" : "x";
      else if (d < 7 && hash(u, y, 19) % 9 === 0) c = d < 3 ? "B" : "g";
      else if (hash(u, y, 27) % 17 === 0) c = "y";
      px(x, y, c);
    }
    for (const [vx, ph] of [[72, 0], [87, 7], [101, 12]]) {
      const p = (e + ph) % 18;
      if (p < 9) {
        const r = 1 + (p >> 1);
        for (let j = 0; j <= r; j++) for (let i = -r; i <= r; i++) {
          const q = i * i + j * j;
          if (q <= r * r + r) px(vx + i, TAR_Y - j, q > (r - 1) * (r - 1) + (r - 1) ? (i < 0 ? "w" : "x") : j > r - 3 && i < 0 ? "y" : "z");
        }
        px(vx - Math.ceil(r / 2), TAR_Y - r + 1, "v");
      } else if (p < 12) {
        const a = p - 9;
        px(vx - 2 - a, TAR_Y - 3 - a + a * a, "w");
        px(vx + 2 + a, TAR_Y - 2 - a + a * a, "x");
        px(vx, TAR_Y - 4 - a, "w");
        px(vx - 3 - a, TAR_Y, "w"); px(vx + 3 + a, TAR_Y, "v");
      }
    }
  }

  function nest() {
    const y = LEDGE;
    for (const [ex, ey] of [[261, y - 10], [268, y - 12], [275, y - 10]]) {
      for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) {
        const dx = i - 2.5, dy = j - 4;
        if ((dx * dx) / 9 + (dy * dy) / 16 > 1) continue;
        let c = i < 2 && j < 4 ? "c" : "E";
        if (hash(ex + i, ey + j, 17) % 6 === 0) c = "F";
        px(ex + i, ey + j, c);
      }
    }
    for (let r = 0; r < 6; r++) for (let x = 254 + r; x < 288 - r; x++) px(x, y - 6 + r, (x + r * 2) % 4 < 2 ? "e" : "f");
    line(254, y - 6, 250, y - 9, "e"); line(287, y - 6, 291, y - 8, "e"); line(258, y - 6, 255, y - 10, "f");
  }

  // Monster: a raptor patrolling between the tar pit and the lava, head held low.
  const RAPTOR = {};
  function raptorLeg(s, hx, hy, foot, c) {
    const kx = hx + 3 + ((foot - hx) >> 2), ky = hy + 4;
    s.l(hx, hy, kx, ky, c).l(hx + 1, hy, kx + 1, ky, c).l(hx - 1, hy + 1, kx, ky + 1, c);
    s.l(kx, ky + 1, foot, 18, c).l(kx + 1, ky + 1, foot + 1, 18, c);
    s.r(foot, 19, 4, 1, c).p(foot - 1, 18, "u");
  }
  function raptorSpr(f) {
    if (RAPTOR[f]) return RAPTOR[f];
    const s = new Spr(32, 21), bob = f & 1;
    s.l(1, 6, 9, 8, "n").l(2, 7, 9, 9, "n").l(4, 8, 10, 10, "n");
    raptorLeg(s, 11, 11, [16, 12, 9, 12][f], "o");
    s.e(14, 9, 6, 3, "n");
    s.l(19, 8, 23, 11 + bob, "n").l(19, 9, 23, 12 + bob, "n").l(19, 10, 22, 12 + bob, "n");
    s.e(25, 12 + bob, 3, 2, "n").r(27, 12 + bob, 3, 2, "n");
    raptorLeg(s, 13, 11, [9, 12, 16, 12][f], "n");
    s.l(21, 13, 22, 15, "n").p(23, 15, "u");
    for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if (s.get(x, y) === "n" && !s.get(x, y - 1)) s.p(x, y, "m");
    for (const [x, y] of [[8, 7], [11, 7], [13, 7], [15, 7], [17, 7]]) s.p(x, y, "o").p(x, y + 1, "o");
    for (let x = 10; x <= 19; x++) { let y = 13; while (y > 7 && s.get(x, y) !== "n") y--; if (s.get(x, y) === "n") s.p(x, y, "d"); }
    s.p(25, 11 + bob, "l").p(26, 14 + bob, "u").p(28, 14 + bob, "u");
    s.outline("z");
    return (RAPTOR[f] = s);
  }
  function raptor(t) {
    const left = 114, span = 30, pause = 12, cycle = 2 * (span + pause), p = t % cycle;
    let x, flip = false, moving = true;
    if (p < span) x = left + p;
    else if (p < span + pause) { x = left + span; moving = false; }
    else if (p < 2 * span + pause) { x = left + span - (p - span - pause); flip = true; }
    else { x = left; flip = true; moving = false; }
    stamp(raptorSpr(moving ? t & 3 : 1), x, GROUND - 20, flip);
  }

  // Hint animal: a baby pterosaur flapping beside the egg nest.
  const PTERO = {};
  function pteroSpr(f) {
    if (PTERO[f]) return PTERO[f];
    const s = new Spr(21, 15), [tx, ty] = [[2, 1], [0, 6], [3, 11], [0, 6]][f];
    s.t(8, 6, tx, ty, 8, 10, "D").t(12, 6, 20 - tx, ty, 12, 10, "D");
    s.l(8, 6, tx, ty, "C").l(12, 6, 20 - tx, ty, "C");
    s.e(10, 9, 2, 3, "C").r(10, 8, 1, 4, "E");
    s.e(10, 4, 2, 2, "C").l(9, 3, 6, 1, "C").l(12, 5, 16, 6, "d").l(12, 4, 15, 4, "d");
    s.p(11, 3, "z").p(9, 13, "d").p(11, 13, "d");
    s.outline("z");
    return (PTERO[f] = s);
  }

  function render(t, e) {
    sky();
    ridge();
    volcano(e);
    smoke(e);
    haze(e, 58, 128);
    sparks(e);
    jungle();
    cycad(150, GROUND, 30);
    fern(100, GROUND - 1, 22, "o", "n");
    giantTree();
    ground();
    tar(e);
    lava(e);
    nest();
    fern(132, GROUND, 9, "n", "o");
    fern(234, GROUND, 8, "n", "o");
    fern(312, LEDGE, 9, "n", "o");
    stamp(pteroSpr(t % 32 < 24 ? t & 3 : 1), 288, LEDGE - 15, false);
    raptor(t);
    crate(46, GROUND - 16);
    rows(HERO, 26, GROUND - 16, false);
  }

  window.PB_CONCEPT_SCENES.dino = {
    draw(ctx, tick) {
      if (!D) { PB = window.PB; RGB = PB.RGB; D = new Uint8ClampedArray(W * H * 4); IMG = new ImageData(D, W, H); }
      const t = Math.max(0, Math.floor(tick) || 0);
      D.fill(0);
      render(t, t >> 1);
      ctx.putImageData(IMG, 0, 0);
    },
  };
})();