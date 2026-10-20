/* Concept scene · 东海龙宫 (undersea), ART-04c. Look only: not a game asset, no rules.
 * The whole map lies on the sea floor: blue-green water that darkens with depth, light slanting down
 * from the surface, warm corals as the only accents (content/concepts/maps.json `look`).
 * Landmarks: the glowing roofs of the Dragon Palace far off, a coral reef with kelp, sunken stone
 * pillars, strings of rising bubbles. Mechanism looks: underwater (everything; the courier breathes out
 * bubbles), tide (the surface slowly rises and falls), bubble_lift (a vent's bubble column holds a crate up).
 * Ambient: caustic light wobbling over the floor, kelp swaying with the current, bubbles rising, a school
 * of fish crossing far away. Fauna: a crab walking sideways (monster), a little sea turtle paddling (hint).
 * 320×180 in ENDESGA 32 codes: integer pixels, no anti-aliasing; drawn into a palette-index buffer and
 * copied to the canvas once per frame.
 * draw(ctx, tick): tick +8 per second; ambient effects step at 4 fps (tick >> 1), creatures at 8 fps. */
(function () {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const GY = 148;                 // sea floor: feet on row 147
  const VENT = 168;               // centre of the bubble-lift vent
  const PX = 246;                 // centre of the Dragon Palace, clear of the bubble column
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

  // Same integer triangle wave as PB.ambient.tri: -amp..amp over `period` steps.
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  // 0 -> len -> 0, resting `rest` steps at each end.
  function shuttle(t, len, rest) {
    const c = 2 * (len + rest), p = ((t % c) + c) % c;
    if (p < rest) return 0;
    if (p < rest + len) return p - rest;
    if (p < 2 * rest + len) return len;
    return len - (p - 2 * rest - len);
  }

  // ---- palette-index buffer (0 = transparent, 1..32 = PB.CODES) ----
  let K = null;
  function tables(PB) {
    const codes = PB.CODES, n = codes.length + 1, idx = Object.create(null), rgb = new Uint8Array(n * 3);
    codes.forEach((c, i) => { idx[c] = i + 1; rgb.set(PB.RGB[c], (i + 1) * 3); });
    const map = (m) => { const t = new Uint8Array(n); for (let i = 1; i < n; i++) t[i] = idx[m[codes[i - 1]]] || i; return t; };
    return { idx, rgb, map, DIM: map(PB.DIM), LIGHT: map(PB.LIGHT), SHAFT: map({ q: "r", p: "o" }) }; // SHAFT lights only open water
  }
  class Buf {
    constructor(w, h) { this.w = w; this.h = h; this.c = new Uint8Array(w * h); }
    set(x, y, ch) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || ch === "." || ch == null) return;
      const v = K.idx[ch]; if (!v) throw new Error("bad colour code " + ch);
      this.c[y * this.w + x] = v;
    }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.c[y * this.w + x]; }
    tone(x, y, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) { const i = y * this.w + x; this.c[i] = t[this.c[i]]; } }
    rect(x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch); }
    rows(rows, x, y, flip) {
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j], n = row.length;
        for (let i = 0; i < n; i++) this.set(x + i, y + j, row[flip ? n - 1 - i : i]);
      }
    }
    blit(src) { const s = src.c, d = this.c; for (let i = 0; i < s.length; i++) if (s[i]) d[i] = s[i]; }
  }

  const HERO = [
    "......zzzz......",
    ".....zlkkkz.....",
    "....zlkkkkkz....",
    "...zkkkkkkkbz...",
    "..zkkkkkkkkkbz..",
    ".zzbbbbbbbbbbzz.",
    "...zzzzzzzzzz...",
    "....zEEEEEEz....",
    "....zEEEzEzz....",
    "....zFEEEEEz....",
    "...zhiiiiiihz...",
    "..zEhiiiiiihEz..",
    "..zzhiiiiiihzz..",
    "...zyyyyyyyyz...",
    "...zyyz..zyyz...",
    "...zzzzz.zzzz...",
  ];
  function crate(b, x, y) { // wooden crate with the diagonal brace (AD-1 §3)
    const [o, l, m, d, k] = ["z", "d", "b", "e", "f"];
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      let p = m;
      if (i === 0 || j === 0 || i === 15 || j === 15) p = o;
      else if (j === 1 || i === 1) p = l;
      else if (j === 14 || i === 14) p = k;
      else if (j === 2 || i === 2 || j === 13 || i === 13) p = d;
      else if (i + j === 15) p = l;
      else if (i + j === 16) p = d;
      b.set(x + i, y + j, p);
    }
  }

  // ---- static layers, built once ----
  function waterAt(x, y) { // bands with short dithered seams: lit under the surface, deep blue, dark teal lower down
    if (y < 30) return bayer(x, y) < (30 - y) >> 1 ? "r" : "q";
    if (y < 54) return "q";
    if (y < 90) return bayer(x, y) < ((y - 54) * 4) / 9 ? "p" : "q";
    return "p";
  }
  // Tileable Voronoi edges (64×32): the net of light a rippling surface throws on the floor.
  function causticTile(h32) {
    const T = new Uint8Array(64 * 32), pts = [];
    for (let k = 0; k < 9; k++) pts.push([h32(k, 1, 91) % 64, h32(k, 2, 91) % 32]);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) for (let oy = -32; oy <= 32; oy += 32) for (let ox = -64; ox <= 64; ox += 64) {
        const dx = x - px - ox, dy = (y - py - oy) * 2, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      T[y * 64 + x] = Math.sqrt(d2) - Math.sqrt(d1) < 2.2 ? 1 : 0;
    }
    return T;
  }
  function staghorn(b, h32, x, y, len, lean, depth, salt) {
    let cx = x;
    for (let k = 0; k < len; k++) {
      if (k % 3 === 2) cx += lean;
      b.set(cx, y - k, "D"); b.set(cx + 1, y - k, "C");
      if (depth > 0 && (k === (len >> 1) || k === len - 3)) {
        const sl = h32(cx, k, salt) & 1 ? 1 : -1;
        staghorn(b, h32, cx + sl, y - k, Math.max(3, (len * 3) >> 3), sl, depth - 1, salt + 1);
      }
    }
    b.set(cx, y - len, "E"); b.set(cx + 1, y - len, "D");
  }
  function pillar(b, x0, top, w, h32, broken) { // fluted stone shaft, lit from the top left
    for (let y = top; y < GY; y++) for (let i = 0; i < w; i++) {
      let c = i === 0 ? "v" : i === w - 1 ? "y" : i % 4 === 1 ? "w" : i % 4 === 3 ? "y" : "x";
      if (i < 3 && c === "x") c = "w";
      if (((y - top) % 26) === 8 || ((y - top) % 26) === 9) c = (y - top) % 26 === 8 ? "w" : "y"; // carved bands
      b.set(x0 + i, y, c);
    }
    for (let i = -2; i < w + 2; i++) { // capital / broken top
      const jag = broken ? h32(x0 + i, 1, 92) % 4 : 0;
      for (let y = top - 5 + jag; y < top; y++) b.set(x0 + i, y, y === top - 5 + jag ? "v" : i < 0 ? "w" : i >= w ? "y" : "x");
    }
    for (let k = 0; k < (w * (GY - top)) / 22; k++) { // weed and barnacles
      const i = h32(k, x0, 93) % w, y = top + (h32(k, x0, 94) % (GY - top));
      b.set(x0 + i, y, (k & 3) === 0 ? "u" : "o"); if (k & 1) b.set(x0 + i, y + 1, "o");
    }
  }
  function roof(b, cx, y, half, rise, eave) { // curved roof of green glazed tile, eaves curling up, the ridge catching the light
    for (let i = -half; i <= half; i++) {
      const a = Math.abs(i), edge = half - a;
      const curl = edge < 4 ? 3 - edge : 0;
      const top = y - rise + Math.floor((a * a * rise) / (half * half)) - curl, bot = y + eave - (edge < 2 ? 1 : 0);
      for (let yy = top; yy <= bot; yy++) b.set(cx + i, yy, yy === top ? "n" : yy === bot ? "z" : i % 3 === 0 && yy > top + 1 ? "p" : "o");
    }
  }

  function build(PB) {
    const h32 = PB.h32, L = {};
    const bg = (L.bg = new Buf(W, H));
    for (let y = 0; y < GY; y++) for (let x = 0; x < W; x++) bg.set(x, y, waterAt(x, y));

    // the Dragon Palace far off: two halls under tiered roofs of glazed tile and two towers, their walls
    // fading into the haze near the sea bed; the pearl sits on the top ridge
    const pa = (L.palace = new Buf(W, H));
    const wall = (x, y, post) => pa.set(x, y, y > 112 && bayer(x, y) < (y - 112) * 2 ? "p" : post ? "z" : "y");
    for (let x = PX - 30; x <= PX + 30; x++) for (let y = 104; y < 128; y++) wall(x, y, (x - PX + 30) % 6 === 0);
    roof(pa, PX, 103, 38, 6, 2);
    for (let x = PX - 16; x <= PX + 16; x++) for (let y = 90; y < 98; y++) wall(x, y, (x - PX + 16) % 8 === 0);
    roof(pa, PX, 89, 23, 5, 2);
    pa.rect(PX - 7, 81, 15, 4, "y"); roof(pa, PX, 80, 12, 4, 2);
    for (let y = 72; y < 76; y++) pa.set(PX, y, "o");
    for (const s of [-1, 1]) {
      const tx = PX + s * 44;
      for (let x = tx - 5; x <= tx + 5; x++) for (let y = 104; y < 128; y++) wall(x, y, x === tx);
      roof(pa, tx, 103, 8, 4, 2); pa.rect(tx - 3, 96, 7, 6, "y"); roof(pa, tx, 95, 6, 3, 1);
    }
    L.windows = [];
    for (let x = PX - 28; x <= PX + 26; x += 6) L.windows.push([x, 107, 3, 6]);
    for (let x = PX - 13; x <= PX + 11; x += 8) L.windows.push([x, 92, 3, 4]);
    for (const s of [-1, 1]) L.windows.push([PX + s * 44 - 3, 107, 2, 5], [PX + s * 44 + 2, 107, 2, 5]);
    L.pearl = [PX, 69];

    // far reef silhouettes in front of the palace
    const fr = (L.far = new Buf(W, H));
    for (let x = 0; x < W; x++) {
      const hgt = 9 + Math.round(5 * Math.sin(x / 15) + 3 * Math.sin(x / 5.7 + 1)) + (h32(x >> 2, 3, 95) & 1);
      for (let y = GY - hgt; y < GY; y++) fr.set(x, y, y === GY - hgt ? "o" : "y");
    }

    // sunken stone: a tall pillar on the left, a broken stump and a fallen drum on the right
    const st = (L.stone = new Buf(W, H));
    pillar(st, 16, 66, 18, h32, true);
    pillar(st, 240, 122, 18, h32, true);
    for (let x = 262; x < 316; x++) for (let y = 134; y < GY; y++) { // fallen shaft lying on the floor
      const j = y - 134;
      st.set(x, y, j === 0 ? "v" : j === 13 ? "y" : (x - 262) % 13 === 0 ? "y" : j < 4 ? "w" : j > 10 ? "y" : "x");
    }
    for (let j = 0; j < 14; j++) for (let i = 0; i < 6; i++) { // its broken end showing the drum's face
      const dx = i - 2, dy = j - 7, r = dx * dx * 3 + dy * dy;
      if (r < 52) st.set(314 + i, 134 + j, r < 12 ? "w" : r < 30 ? "x" : "v");
    }

    // coral reef (the warm accents)
    const co = (L.coral = new Buf(W, H));
    staghorn(co, h32, 52, GY - 1, 18, 0, 2, 7);
    staghorn(co, h32, 60, GY - 1, 13, 1, 1, 9);
    staghorn(co, h32, 300, GY - 14, 11, -1, 1, 11);
    for (let j = 0; j < 10; j++) for (let i = -10; i <= 10; i++) { // brain coral
      const q = (i * i) / 100 + ((j - 10) * (j - 10)) / 100;
      if (q > 1) continue;
      const groove = (Math.round(i * 0.9 + Math.sin(j * 1.3) * 2) & 3) === 0;
      co.set(80 + i, GY - 10 + j, q > 0.8 ? "f" : groove ? "f" : j < 4 && i < 0 ? "b" : "a");
    }
    for (const [tx, th] of [[94, 9], [97, 12], [100, 7]]) for (let j = 0; j < th; j++) { // tube sponges
      co.set(tx, GY - 1 - j, j === th - 1 ? "f" : "e"); co.set(tx + 1, GY - 1 - j, j === th - 1 ? "f" : "a");
    }
    for (let k = 0; k < 7; k++) { // sea fan behind the fallen shaft
      const a = -0.9 + k * 0.3;
      for (let r = 0; r < 24; r++) {
        const x = 296 + Math.round(Math.sin(a) * r), y = 134 - Math.round(Math.cos(a) * r);
        if ((r + k) % 5 !== 4) co.set(x, y, r > 18 ? "D" : "C");
      }
    }
    L.lit = new Uint8Array(W * H); // stone faces the caustics may touch (not where coral covers them)
    for (let i = 0; i < W * H; i++) L.lit[i] = st.c[i] && !co.c[i] ? 1 : 0;

    // the sea floor: pale top edge, sand with half-buried pebbles, darkening with depth
    const fl = (L.floor = new Buf(W, H));
    for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) {
      const d = y - GY;
      let c = d === 0 ? "w" : d === 1 && h32(x, 1, 96) % 5 === 0 ? "w" : "x";
      if (d === 8 + tri(x, 70, 1) && h32(x >> 3, 4, 96) % 3) c = "y"; // a faint layer line
      if (d > 14 && bayer(x, y) < d - 14) c = "y";
      if (d > 24 && bayer(x, y) < (d - 24) * 2) c = "z";
      fl.set(x, y, c);
    }
    for (let k = 0; k < 40; k++) { // pebbles and bits of shell
      const x = h32(k, 1, 97) % W, y = GY + 3 + (h32(k, 2, 97) % 12), big = h32(k, 3, 97) % 3 === 0;
      fl.set(x, y, "w"); fl.set(x + 1, y, big ? "v" : "w"); fl.set(x, y + 1, "y"); fl.set(x + 1, y + 1, "y");
      if (big) { fl.set(x + 2, y, "w"); fl.set(x + 2, y + 1, "y"); fl.set(x - 1, y + 1, "w"); }
    }

    // the bubble-lift vent, the courier and two crates (one held up in the bubble column)
    const fg = (L.fg = new Buf(W, H));
    fg.rows([
      "zzzzzzzzzzzzzzzzzzzz",
      "zvwzwvzwvzwvzwvzwvwz",
      "zwxzxwzxwzxwzxwzxwxz",
      "zxxxxxxxxxxxxxxxxxxz",
      "zzzzzzzzzzzzzzzzzzzz",
    ], VENT - 10, GY - 5);
    fg.rows(HERO, 112, GY - 16);
    crate(fg, 130, GY - 16);
    crate(fg, VENT - 8, 98);

    L.caustic = causticTile(h32);
    // kelp: [x, height, phase, behind?]
    L.kelp = [[7, 74, 0, 1], [40, 56, 5, 1], [45, 44, 9, 0], [104, 34, 3, 0], [230, 44, 7, 0], [263, 30, 2, 1], [312, 62, 11, 0], [150, 26, 4, 1]];
    return L;
  }

  // ---- per-frame pieces ----
  function surface(f, e) { // tide: the underside of the surface slowly rises and falls
    const S = 8 + tri(e, 160, 6);
    for (let x = 0; x < W; x++) {
      const sy = S + tri(x * 2 + e * 3, 28, 1) + tri(x + e * 2, 46, 1);
      for (let y = 0; y < sy; y++) f.set(x, y, (x * 3 + y * 5 - e * 2) % 19 === 0 ? "s" : "r");
      f.set(x, sy, "s"); f.set(x, sy + 1, (x + e) % 3 ? "r" : "s");
      for (let y = sy + 2; y < sy + 8; y++) if (bayer(x, y) < 8 - (y - sy)) f.set(x, y, "r");
    }
    return S;
  }
  function shafts(f, e) { // light slanting down from the upper left, flickering with the surface
    const SH = [[18, 9, 0], [74, 13, 7], [146, 6, 3], [206, 11, 11], [268, 7, 5]];
    for (const [x0, w0, ph] of SH) {
      const w = w0 + tri(e + ph * 5, 22, 2), sway = tri(e + ph, 40, 1);
      for (let y = 12; y < 132; y++) {
        const xs = x0 + Math.floor((y * 9) / 20) + sway, dens = y < 96 ? 3 : y < 118 ? 2 : 1;
        for (let i = 0; i < w; i++) if (bayer(xs + i, y) < (i === 0 || i === w - 1 ? dens >> 1 : dens)) f.tone(xs + i, y, K.SHAFT);
      }
    }
  }
  function palace(f, L, e) { // glowing windows, now and then one dims; the pearl pulses
    f.blit(L.palace);
    const slow = e >> 3;
    L.windows.forEach(([x, y, w, h], k) => {
      const on = (k * 7 + slow) % 11 !== 0;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f.set(x + i, y + j, j === 0 ? "z" : on && j > 1 && i > 0 && i < w - 1 ? "r" : "q");
    });
    const [px, py] = L.pearl, pulse = tri(e, 24, 2) + 2;
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
      const r = i * i + j * j;
      if (r <= 2) f.set(px + i, py + j, r === 0 ? "t" : r === 1 ? "s" : "r");
      else if (r <= 10 + pulse * 6 && bayer(px + i, py + j) < (r < 9 ? 8 : 4)) f.tone(px + i, py + j, K.SHAFT);
    }
  }
  function fish(f, h32, e) { // a school drifting across, far off
    const cx = ((e * 2 + 200) % 560) - 120, cy = 50 + tri(e, 90, 6);
    for (let k = 0; k < 26; k++) {
      const ox = (h32(k, 1, 98) % 56) - 28 + tri(e + k * 5, 26, 2), oy = (h32(k, 2, 98) % 24) - 12 + tri(e + k * 3, 34, 1);
      const x = cx + ox, y = cy + oy, glint = ((e + k * 7) % 23) === 0;
      f.set(x, y, "y"); f.set(x + 1, y, glint ? "s" : "y"); f.set(x + 2, y, "y"); f.set(x - 1, y - 1 + ((e + k) & 1), "y");
    }
  }
  function kelp(f, L, e, behind) {
    for (const [x0, h, ph, b] of L.kelp) {
      if (b !== behind) continue;
      for (let k = 0; k < h; k++) {
        const y = GY - 1 - k, sway = Math.round(Math.sin(e * 0.3 + ph + k * 0.09) * ((k * k * 5) / (h * h)));
        const x = x0 + sway;
        f.set(x, y, "m"); f.set(x + 1, y, "n"); f.set(x + 2, y, k > h - 4 ? "." : "o");
        if (k > 4 && k % 7 === 3) { // blades
          const s = (k / 7) & 1 ? 1 : -1, bx = s > 0 ? x + 3 : x - 1;
          f.set(bx, y, "n"); f.set(bx + s, y - 1, "n"); f.set(bx + 2 * s, y - 2, "m");
        }
      }
    }
  }
  function caustics(f, L, e) { // net of light sliding over the top of the floor and the sunken stone
    const T = L.caustic, c = f.c, LT = K.LIGHT, lit = L.lit;
    const ox1 = e, oy1 = e >> 1, ox2 = -e * 2, oy2 = e;
    const at = (x, sy) => T[(((sy + oy1) & 31) << 6) | ((x + ox1) & 63)] + T[(((sy + oy2 + 7) & 31) << 6) | ((x + ox2 + 21) & 63)];
    for (let y = 60; y < GY; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (lit[i] && at(x, y) === 2) c[i] = LT[c[i]];
    }
    for (let d = 0; d < 11; d++) for (let x = 0; x < W; x++) { // the floor's top, seen at a slant: brightest near the edge
      const i = (GY + d) * W + x, n = at(x, d * 3);
      if (n === 2) c[i] = d < 3 ? LT[LT[c[i]]] : LT[c[i]];
      else if (n === 1 && (d < 4 || (d < 8 && bayer(x, GY + d) < 8 - d))) c[i] = LT[c[i]];
    }
  }
  function bubble(f, x, y, size) {
    if (size === 0) { f.set(x, y, "s"); return; }
    if (size === 1) { f.set(x, y, "t"); f.set(x + 1, y, "s"); f.set(x, y + 1, "s"); f.set(x + 1, y + 1, "r"); return; }
    f.rows([".ts.", "t..s", "s..s", ".ss."], x - 1, y - 1);
  }
  function bubbleStrings(f, e, S) {
    for (const [vx, vy, n, salt] of [[72, GY - 10, 9, 0], [289, GY - 16, 7, 3], [27, 62, 5, 6]]) {
      for (let k = 0; k < n; k++) {
        const age = (e + k * 7 + salt) % (n * 7), y = vy - age * 2;
        if (y < S + 2) continue;
        bubble(f, vx + tri(age + k * 3, 12, 1), y, age < 8 ? 0 : age < 26 ? 1 : 2);
      }
    }
  }
  function lift(f, e, S, front) { // the vent's column: bubbles racing up, churning under the crate, streaming past it
    if (!front) for (let y = S + 2; y < GY - 5; y++) for (let x = VENT - 8; x < VENT + 8; x++) if (bayer(x, y + e) < 2) f.tone(x, y, K.SHAFT);
    for (let k = 0; k < 36; k++) {
      const age = (e + k * 5) % 48, y = GY - 6 - age * 3, inFront = (k % 3) === 0;
      if (inFront !== front || y < S + 2) continue;
      const side = k & 1 ? -1 : 1, past = y < 116 && y > 96; // squeezed out to the crate's sides on the way up
      const x = past ? VENT + side * (9 + (k % 3)) - (side < 0 ? 1 : 0) : VENT - 7 + ((k * 5) % 15) + tri(age + k, 8, 1);
      bubble(f, x, y, age < 3 ? 0 : age < 14 || (k & 1) ? 1 : 2);
    }
    if (front) for (let k = 0; k < 6; k++) { // froth pressing on the crate's underside
      const x = VENT - 7 + ((k * 5 + e * 3) % 14), y = 114 + ((k + e) % 3);
      bubble(f, x, y, (k + e) % 3 === 0 ? 0 : 1);
    }
  }
  function breath(f, e, S) { // the courier breathes out a few bubbles now and then
    for (let k = 0; k < 3; k++) {
      const age = (e + k * 3) % 24, y = GY - 18 - age * 2;
      if (age > 18 || y < S + 2) continue;
      bubble(f, 122 + tri(age + k, 6, 1), y, age < 6 ? 0 : 1);
    }
  }
  const TURTLE = [ // facing right: domed shell with plates, head with an eye
    "........zzzzzzz...........",
    "......zzmmmnnnnzz.........",
    ".....zmmnnonnnonnz........",
    "....zmnnnonnnnonnnz...zzz.",
    "...zmnnnoonnnoonnnnz.zmmmz",
    "...znnnnonnnnonnnnnzzmmzmz",
    "..zooooooooooooooooznmmmmz",
    "...zzzzzzzzzzzzzzzzzzzzzz.",
  ];
  const STROKE = [ // front flipper (reaching forward, pulling down, pushed back, folded) and the rear flipper; from row 6
    ["..............zz", "..............zmmz", "..zmz..........zmmmz", "...zz...........zmmz", ".................zz"],
    ["", "............zmmmz", "..zmz.......zmmmz", "...zz.......zmmmz", ".............zmz", "..............z"],
    ["", "..........zmmmz", ".zmz...zzzmmmmz", "..zz..zmmmmzz", "......zzzz"],
    ["", "............zmmz", ".zmz........zmmz", "..zz.........zz"],
  ];
  function turtle(f, tick) { // little sea turtle paddling slowly back and forth above the reef
    const len = 110, rest = 20, c = 2 * (len + rest), t = tick, ph = ((t % c) + c) % c;
    const right = ph < len + rest, x = 36 + shuttle(t, len, rest), y = 60 + tri(tick, 32, 2), fr = (tick >> 1) & 3;
    f.rows(TURTLE, x, y, !right);
    f.rows(STROKE[fr].map((r) => r.padEnd(26, ".")), x, y + 6, !right);
  }
  const CLAW = [".zzz.", "zbbaz", "zbaaz", "zaafz", ".zzz."], CLAW_OPEN = ["z...z", "zb.az", "zbzaz", "zaafz", ".zzz."];
  const CRAB_BODY = [
    "..zzzzzzzzzzzzz..",
    ".zbbbaaaaaaaaaaz.",
    "zbbaaaaaaaaaaaaaz",
    "zaaaaaazzzaaaaaaz",
    ".zfffffzffzffffz.",
    "..zzzzzzzzzzzzz..",
  ];
  function crab(f, tick) { // walks sideways, stops to snap its claws; glaring eyes on stalks
    const len = 30, rest = 12, p = shuttle(tick, len, rest), c = 2 * (len + rest), ph = ((tick % c) + c) % c;
    const walking = (ph >= rest && ph < len + rest) || ph >= 2 * rest + len;
    const ox = 186 + p, oy = GY - 13, step = walking ? tick & 1 : 0, open = !walking && (tick & 2);
    const put = (x, y, ch) => f.set(ox + x, oy + y, ch);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { // legs
      const lx = 12 + s * (4 + k * 2), up = (k + step) & 1;
      put(lx, 10, "f"); put(lx + s, 10, "z"); put(lx + s, 11 - up, "a"); put(lx + s * 2, 12 - up, "z");
    }
    f.rows(CRAB_BODY, ox + 4, oy + 5);
    put(1, 5, "z"); put(2, 5, "a"); put(3, 5, "z"); put(2, 6, "z"); put(3, 6, "a"); put(4, 6, "a");       // arms
    put(21, 5, "z"); put(22, 5, "a"); put(23, 5, "z"); put(22, 6, "z"); put(21, 6, "a"); put(20, 6, "a");
    f.rows(open ? CLAW_OPEN : CLAW, ox, oy); f.rows(open ? CLAW_OPEN : CLAW, ox + 20, oy);
    for (const [x, y, ch] of [[9, 4, "a"], [15, 4, "a"], [8, 4, "z"], [10, 4, "z"], [14, 4, "z"], [16, 4, "z"], // stalks
      [7, 2, "z"], [7, 3, "z"], [8, 2, "t"], [9, 2, "z"], [8, 3, "t"], [9, 3, "t"], [10, 3, "z"],                 // eyes
      [17, 2, "z"], [17, 3, "z"], [16, 2, "t"], [15, 2, "z"], [16, 3, "t"], [15, 3, "t"], [14, 3, "z"],
      [7, 1, "z"], [8, 1, "z"], [9, 1, "z"], [10, 2, "z"], [17, 1, "z"], [16, 1, "z"], [15, 1, "z"], [14, 2, "z"]]) put(x, y, ch); // brows
  }
  function snow(f, h32, e) { // drifting specks in the open water
    for (let k = 0; k < 34; k++) {
      const x = (h32(k, 1, 99) + (e >> 1) + tri(e + k * 4, 30, 2)) % W, y = (h32(k, 2, 99) + (e >> 2)) % GY;
      if (y > 14) f.tone(x, y, K.SHAFT);
    }
  }

  let L = null, frame = null, img = null;
  window.PB_CONCEPT_SCENES.undersea = {
    draw(ctx, tick) {
      const PB = window.PB, h32 = PB.h32, e = tick >> 1;
      if (!K) K = tables(PB);
      if (!L) L = build(PB);
      if (!frame) frame = new Buf(W, H);
      const f = frame;
      f.c.set(L.bg.c);
      const S = surface(f, e);
      shafts(f, e);
      fish(f, h32, e);
      palace(f, L, e);
      f.blit(L.far);
      turtle(f, tick);
      kelp(f, L, e, 1);
      lift(f, e, S, false);
      f.blit(L.stone);
      f.blit(L.coral);
      f.blit(L.floor);
      f.blit(L.fg);
      caustics(f, L, e);
      kelp(f, L, e, 0);
      bubbleStrings(f, e, S);
      lift(f, e, S, true);
      breath(f, e, S);
      crab(f, tick);
      snow(f, h32, e);
      if (!img) img = ctx.createImageData(W, H);
      const d = img.data, c = f.c, rgb = K.rgb;
      for (let i = 0, j = 0; i < c.length; i++, j += 4) { const k = c[i] * 3; d[j] = rgb[k]; d[j + 1] = rgb[k + 1]; d[j + 2] = rgb[k + 2]; d[j + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    },
  };
})();