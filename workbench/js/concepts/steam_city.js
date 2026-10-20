/* ART-04d concept scene: 蒸汽工坊城 (content/concepts/maps.json "steam_city").
 * Look-only sketch for the workbench "地图概念" page: not a game asset, never approved.
 * Interface: PB_CONCEPT_SCENES.steam_city.draw(ctx, tick) paints one 320x180 frame; tick += 8 per second.
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
  // ---------- 蒸汽工坊城: overcast workshop city of copper pipes and gears ----------
  const FLOOR = 144, TAU = Math.PI * 2;
  const CHIMNEYS = [[18, 44, 4], [34, 56, 3], [96, 38, 5], [128, 50, 3], [262, 42, 4], [300, 54, 3]];

  function sky(e) {
    bands([[0, "y"], [26, "x"], [64, "w"], [100, "v"]], 8);
    for (const [y, len, sp, off] of [[14, 78, 3, 0], [32, 58, 4, 150], [52, 90, 3, 240]]) {
      const x0 = ((off + (e >> sp)) % (W + len + 60)) - len - 30;
      for (let k = 0; k <= len; k += 7) {
        const r = 5 + (hash(k, y, 3) % 4), cy = y + tri(k * 5 + off, 34, 2);
        disc(x0 + k, cy + 1, r, "x", 12);
        disc(x0 + k - 1, cy - 1, r - 2, "w", 6);
      }
    }
  }

  function skyline() {
    for (let x = 0; x < W; x++) {
      const b = Math.floor(x / 22), h = hash(b, 0, 41);
      const top = 92 + (h % 18) + ((x % 22) < 11 ? (x % 11) >> 1 : 0);
      for (let y = top; y < 132; y++) {
        let c = "x";
        if (y > top + 3 && (x % 4) === 1 && (y % 6) === 2 && hash(x, y, 43) % 3 === 0) c = "e";
        px(x, y, c);
      }
    }
    for (const [x, top, w] of CHIMNEYS) {
      rect(x, top, w, 110 - top, "y");
      rect(x, top, 1, 110 - top, "x");
      rect(x - 1, top, w + 2, 2, "y");
    }
  }

  // Black smoke keeps pouring out of the far chimneys and drifts to the right.
  function chimneySmoke(e) {
    CHIMNEYS.forEach(([x, top, w], ci) => {
      const L = 30;
      for (let i = 0; i < 6; i++) {
        const age = (e + i * 5 + ci * 7) % L;
        const sx = x + (w >> 1) + Math.floor(age * 0.7) + tri(age * 2 + ci * 9, 26, 1), sy = top - 2 - age;
        const r = 2 + Math.floor(age / 5), lvl = age > L - 10 ? Math.max(1, (L - age) + 4) : 15;
        disc(sx + 1, sy + 1, r, "z", lvl);
        disc(sx, sy, r, age < 12 ? "z" : "y", lvl);
        if (age > 3) disc(sx - 1, sy - 1, r - 2, "x", lvl >> 2);
      }
    });
  }

  function gear(cx, cy, r, teeth, phase, body, light, dark, holes) {
    const tw = r > 14 ? 2 : 1;
    for (let k = 0; k < teeth; k++) {
      const a = phase + (k * TAU) / teeth, tx = Math.round(cx + Math.cos(a) * (r - 1)), ty = Math.round(cy + Math.sin(a) * (r - 1));
      rect(tx - tw, ty - tw, 2 * tw + 1, 2 * tw + 1, dark);
      px(tx - tw, ty - tw, body);
    }
    const R = r - 2, hr = Math.max(1, Math.round(r * 0.17)), hd = r * 0.55;
    const hc = [];
    for (let k = 0; k < holes; k++) hc.push([cx + Math.cos(phase + (k * TAU) / holes) * hd, cy + Math.sin(phase + (k * TAU) / holes) * hd]);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const q = x * x + y * y;
      if (q > R * R + R) continue;
      let hole = false;
      for (const [hx, hy] of hc) if ((cx + x - hx) ** 2 + (cy + y - hy) ** 2 <= hr * hr + hr) hole = true;
      if (hole) continue;
      let c = body;
      if (q > (R - 1) * (R - 1) + (R - 1)) c = x + y < 0 ? light : dark;
      else if (q < 6) c = q < 2 ? dark : light;
      px(cx + x, cy + y, c);
    }
  }

  function bricks(x0, y0, w, h, base, mortar, lit) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const row = Math.floor((y - y0) / 4), off = row & 1 ? 4 : 0;
      let c = base;
      if ((y - y0) % 4 === 3 || (x - x0 + off) % 8 === 7) c = mortar;
      else if (x - x0 < 2) c = lit;
      px(x, y, c);
    }
  }
  function window1(x, y, w, h) {
    rect(x - 1, y - 1, w + 2, h + 2, "f");
    rect(x, y, w, h, "d");
    rect(x, y + h - 2, w, 2, "b");
    rect(x + (w >> 1), y, 1, h, "f");
    rect(x, y + (h >> 1), w, 1, "f");
  }

  function workshop() {
    bricks(0, 58, 66, 86, "f", "g", "e");
    for (let i = 0; i < 70; i++) px(i - 2, 57 - (i < 35 ? i >> 2 : (70 - i) >> 2), "x");
    for (let y = 48; y < 58; y++) for (let x = 0; x < 68; x++) if (y >= 57 - (x < 35 ? x >> 2 : (70 - x) >> 2)) px(x, y, y === 57 - (x < 35 ? x >> 2 : (70 - x) >> 2) ? "w" : "x");
    window1(8, 70, 10, 14); window1(30, 70, 10, 14); window1(52, 70, 8, 14);
    window1(8, 98, 10, 12); window1(30, 98, 10, 12);
  }

  function clockTower(e) {
    const x0 = 196, x1 = 236;
    bricks(x0, 62, x1 - x0, FLOOR - 62, "f", "g", "e");
    rect(x1 - 3, 62, 3, FLOOR - 62, "g");
    rect(x0 - 2, 26, x1 - x0 + 4, 38, "e");
    rect(x0 - 2, 26, x1 - x0 + 4, 2, "b");
    rect(x0 - 2, 62, x1 - x0 + 4, 2, "b");
    rect(x0 - 2, 26, 2, 38, "b");
    rect(x1, 28, 2, 36, "f");
    for (let y = 2; y < 26; y++) {
      const half = Math.floor(((y - 2) * 23) / 24);
      for (let x = 216 - half; x <= 216 + half; x++) px(x, y, x < 216 - half + 2 ? "w" : x > 216 + half - 2 ? "y" : "x");
    }
    rect(215, 0, 2, 3, "b");
    const cx = 216, cy = 45;
    disc(cx, cy, 14, "b");
    disc(cx, cy, 12, "d");
    disc(cx - 2, cy - 2, 7, "c", 6);
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12;
      px(Math.round(cx + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 10), "f");
    }
    const minute = ((e >> 3) % 60) * (TAU / 60) - Math.PI / 2, hour = (TAU * 10) / 12 - Math.PI / 2 + ((e >> 3) % 60) * (TAU / 720);
    line(cx, cy, cx + Math.cos(minute) * 9, cy + Math.sin(minute) * 9, "z");
    line(cx, cy, cx + Math.cos(hour) * 6, cy + Math.sin(hour) * 6, "z");
    px(cx, cy, "b");
    for (const wy of [76, 104]) {
      rect(206, wy, 6, 14, "d"); rect(220, wy, 6, 14, "d");
      rect(206, wy + 10, 6, 4, "b"); rect(220, wy + 10, 6, 4, "b");
      px(206, wy, "f"); px(211, wy, "f"); px(220, wy, "f"); px(225, wy, "f");
    }
  }

  // Copper pipes cross the workshop; joints vent steam now and then.
  const JOINTS = [[54, 92, 0], [118, 92, 9], [150, 62, 17], [176, 98, 5]];
  function pipes() {
    const hp = (x0, x1, y, t) => {
      for (let x = x0; x < x1; x++) for (let j = 0; j < t; j++) px(x, y + j, j === 0 ? "d" : j === 1 ? "b" : j >= t - 2 ? "f" : "e");
    };
    const vp = (x, y0, y1, t) => {
      for (let y = y0; y < y1; y++) for (let i = 0; i < t; i++) px(x + i, y, i === 0 ? "d" : i === 1 ? "b" : i >= t - 2 ? "f" : "e");
    };
    hp(0, 182, 92, 8);
    vp(70, 100, FLOOR, 7);
    vp(147, 20, 92, 7);
    hp(147, 196, 20, 6);
    vp(172, 100, 112, 7);
    for (const [x, y] of [[54, 92], [118, 92], [176, 98]]) { rect(x - 1, y - 2, 4, 12, "b"); rect(x - 1, y - 2, 1, 12, "d"); rect(x + 2, y - 2, 1, 12, "f"); }
    rect(145, 60, 11, 4, "b"); rect(145, 60, 11, 1, "d");
    rect(68, 98, 11, 3, "b"); rect(68, 98, 11, 1, "d");
  }
  function gauge(cx, cy, r, e, k) {
    disc(cx, cy, r + 1, "f");
    disc(cx, cy, r, "b");
    disc(cx, cy, r - 1, "u");
    px(cx - r + 2, cy, "i"); px(cx + r - 2, cy - 1, "i");
    const a = -Math.PI / 2 + 0.5 + tri(e * 3 + k * 5, 6, 1) * 0.25 + tri(e + k * 3, 22, 1) * 0.35;
    line(cx, cy, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), "z");
    px(cx, cy, "x");
  }
  function steam(e) {
    for (const [x, y, ph] of JOINTS) {
      const p = (e + ph) % 26;
      if (p >= 10) continue;
      for (let k = 0; k < 3; k++) {
        const a = p - k * 2;
        if (a < 0) continue;
        const r = 1 + (a >> 1), sx = x + 1 + (k & 1 ? 2 : -1) + (a >> 2), sy = y - 3 - a - k * 2, lvl = a > 6 ? 16 - (a - 6) * 4 : 16;
        disc(sx, sy, r, "u", lvl);
        disc(sx - 1, sy - 1, Math.max(0, r - 1), "t", lvl - 4);
      }
    }
  }

  // Conveyor belt (look only): the tread runs to the right, rollers turn.
  function conveyor(e) {
    const x0 = 84, x1 = 176, y = 118;
    for (const lx of [98, 130, 162]) { rect(lx, y + 6, 3, FLOOR - y - 6, "x"); px(lx, y + 6, "w"); }
    line(98, 140, 130, 126, "y"); line(130, 140, 162, 126, "y");
    for (let x = x0; x < x1; x++) {
      const tread = ((x - e) % 6 + 6) % 6 === 0;
      px(x, y, tread ? "w" : "v");
      for (let j = 1; j < 6; j++) px(x, y + j, j === 5 ? "z" : tread && j < 3 ? "x" : "y");
      px(x, y + 6, ((x + e) % 6 + 6) % 6 === 0 ? "x" : "y");
    }
    for (const rx of [x0, x1 - 1]) {
      disc(rx, y + 3, 4, "w");
      disc(rx, y + 3, 3, "v");
      const a = (e % 8) * (TAU / 8);
      line(rx - Math.round(Math.cos(a) * 2), y + 3 - Math.round(Math.sin(a) * 2), rx + Math.round(Math.cos(a) * 2), y + 3 + Math.round(Math.sin(a) * 2), "x");
    }
  }

  // Rising gas (look only): a floor grate breathes a steady column of warm air upwards.
  function gasVent(e) {
    const x0 = 256, x1 = 288, top = 36, span = FLOOR - top;
    for (let y = top; y < FLOOR; y++) {
      const t = (FLOOR - y) / span, half = 8 + Math.floor(t * 7), cx = 272 + tri(y + e * 2, 46, 2), lvl = Math.round(5 - t * 4);
      for (let x = cx - half; x <= cx + half; x++) if (bay(x, y + e) < lvl) { const c = at(x, y); if (c && PB.LIGHT[c]) px(x, y, PB.LIGHT[c]); }
    }
    for (let k = 0; k < 11; k++) {
      const y = FLOOR - 3 - ((e * 3 + k * 37) % span), t = (FLOOR - y) / span;
      const x = 272 + Math.round((k - 5) * (1.5 + t * 1.5)) + tri(y + e * 2, 46, 2);
      if (t > 0.8 && bay(x, y) > 6) continue;
      for (let j = 0; j < (t < 0.5 ? 5 : 3); j++) px(x, y + j, j < 2 && t < 0.45 ? "u" : "v");
    }
    for (let x = x0; x < x1; x++) for (let y = FLOOR; y < FLOOR + 4; y++) px(x, y, y === FLOOR || x === x0 || x === x1 - 1 ? "w" : x % 3 === 0 ? "x" : "z");
  }

  function floor() {
    for (let x = 0; x < W; x++) for (let y = FLOOR; y < H; y++) {
      const d = y - FLOOR, cell = hash(x >> 3, y >> 2, 71) % 23;
      let c = "x";
      if (d === 0) c = "v";
      else if (d === 1) c = "w";
      else if (x % 32 === 31 || d === 17) c = "y";
      else if ((x % 32 === 3 || x % 32 === 28) && (d === 5 || d === 13)) c = "v";
      else if (cell === 0 && bay(x, y) < 6) c = "f";
      px(x, y, c);
    }
  }

  // Monster: a clockwork guard that walks one step, stops, walks one step.
  const GUARD = {};
  function guardSpr(f) {
    if (GUARD[f]) return GUARD[f];
    const s = new Spr(16, 22), step = f >= 2 ? 1 : 0, key = f & 1;
    s.r(5, 1, 7, 5, "x").r(5, 1, 7, 1, "w").p(8, 3, "b").p(8, 2, "d").r(4, 6, 9, 1, "y");
    s.r(6, 7, 5, 3, "u").p(9, 8, "z").p(10, 9, "D");
    s.r(5, 10, 7, 6, "w").r(5, 10, 1, 6, "v").p(8, 11, "b").p(8, 13, "b").r(5, 14, 7, 1, "f").p(8, 14, "d");
    if (step) s.r(11, 11, 2, 3, "w").p(12, 14, "u"); else s.r(11, 11, 2, 4, "w").p(11, 15, "u");
    if (step) { s.r(5, 16, 2, 4, "x").r(9, 16, 2, 4, "x").r(4, 20, 3, 1, "y").r(10, 20, 3, 1, "y"); }
    else { s.r(6, 16, 2, 4, "x").r(8, 16, 2, 4, "x").r(6, 20, 2, 1, "y").r(8, 20, 3, 1, "y"); }
    s.p(4, 12, "b");
    if (key) s.r(1, 11, 4, 1, "d").r(0, 10, 2, 3, "d");
    else s.r(2, 9, 1, 5, "d").r(1, 9, 3, 1, "d").r(1, 13, 3, 1, "d");
    s.outline("z");
    return (GUARD[f] = s);
  }
  function guard(t) {
    const left = 238, span = 54, stepLen = 6, stride = 8;
    const n = Math.floor(span / stepLen), cycle = 2 * n * stride, p = t % cycle;
    const out = p >= n * stride, q = out ? p - n * stride : p, k = Math.floor(q / stride), r = q % stride;
    const moved = k * stepLen + (r < 3 ? Math.round((r * stepLen) / 3) : stepLen);
    const x = out ? left + span - moved : left + moved;
    stamp(guardSpr((r < 3 ? 2 : 0) + ((t >> 1) & 1)), x, FLOOR - 21, out);
  }

  // Hint animal: a steam cat on the pipe; its ears puff little wisps of steam.
  const CAT = {};
  function catSpr(f) {
    if (CAT[f]) return CAT[f];
    const s = new Spr(16, 13);
    s.e(9, 8, 3, 3, "b").e(6, 7, 2, 3, "b").e(5, 4, 3, 2, "b");
    s.p(3, 1, "b").p(3, 2, "b").p(4, 2, "b").p(7, 1, "b").p(7, 2, "b").p(6, 2, "b");
    s.p(3, 5, "c").p(4, 5, "c").p(2, 5, "c").p(2, 4, "D").p(4, 4, "m").p(6, 4, "m");
    s.p(9, 6, "e").p(10, 7, "e").p(11, 8, "e").p(8, 5, "e");
    s.p(5, 10, "c").p(7, 10, "c").p(6, 8, "d").p(6, 9, "d");
    const tail = [[[12, 9], [13, 7], [14, 5]], [[12, 9], [14, 8], [15, 6]], [[12, 9], [14, 9], [15, 8]]][f % 3];
    for (const [x, y] of tail) s.p(x, y, "b");
    s.l(12, 9, tail[0][0], tail[0][1], "b").l(tail[0][0], tail[0][1], tail[1][0], tail[1][1], "b").l(tail[1][0], tail[1][1], tail[2][0], tail[2][1], "b");
    s.outline("z");
    return (CAT[f] = s);
  }
  function cat(t) {
    const x = 126, y = 92 - 12;
    stamp(catSpr(Math.floor(t / 3) % 3), x, y, false);
    const p = t % 20;
    if (p < 10) for (const ex of [x + 3, x + 7]) {
      const a = p >> 1;
      px(ex + (a >> 1), y - a, a < 3 ? "t" : "u");
      if (a > 1 && a < 4) px(ex + (a >> 1) + 1, y - a - 1, "u");
    }
  }

  function render(t, e) {
    sky(e);
    chimneySmoke(e);
    skyline();
    gear(172, 72, 22, 16, e * 0.035, "e", "b", "f", 5);
    gear(146, 46, 11, 9, -e * 0.07 + 0.2, "f", "e", "g", 3);
    workshop();
    clockTower(e);
    gear(250, 64, 10, 8, -e * 0.077, "b", "d", "e", 0);
    pipes();
    gauge(92, 92 + 4, 5, e, 0);
    gauge(150, 40, 5, e, 1);
    conveyor(e);
    floor();
    gasVent(e);
    steam(e);
    cat(t);
    guard(t);
    crate(42, FLOOR - 16);
    rows(HERO, 22, FLOOR - 16, false);
  }

  window.PB_CONCEPT_SCENES.steam_city = {
    draw(ctx, tick) {
      if (!D) { PB = window.PB; RGB = PB.RGB; D = new Uint8ClampedArray(W * H * 4); IMG = new ImageData(D, W, H); }
      const t = Math.max(0, Math.floor(tick) || 0);
      D.fill(0);
      render(t, t >> 1);
      ctx.putImageData(IMG, 0, 0);
    },
  };
})();
