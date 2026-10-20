/* Concept scene · 赛博夜市 (cyber_market), ART-04c. Look only: not a game asset, no rules.
 * A night-market street in the rain: deep blue-violet dark, magenta and cyan neon, and a wet street
 * that mirrors everything (content/concepts/maps.json `look`).
 * Landmarks: stacked neon signs on both facades (pictograms only, no lettering), a steaming food stall,
 * a hovering maglev platform, the sky rail high above (a train crosses now and then).
 * Mechanism looks: laser emitter and mirror (laser_mirror); a horseshoe magnet pulling at an iron
 * crate (magnet). Ambient: rain that never stops, signs flickering (one with a bad contact), the
 * reflections shivering under the drops, steam from the stall.
 * Fauna: a security drone sweeping its scan light (monster), a hacker rat running along a power line (hint).
 * 320×180 in ENDESGA 32 codes: integer pixels, no anti-aliasing. Drawn into a palette-index buffer
 * (reflections, rain and light read back what is already there), copied to the canvas once per frame.
 * draw(ctx, tick): tick +8 per second; ambient effects step at 4 fps (tick >> 1), creatures at 8 fps. */
(function () {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const GY = 132;            // street line: feet on row 131; the wet street below mirrors the scene
  const LB = 88, RB = 232;   // inner edges of the two facades
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
    const T = { idx, rgb, map, DIM: map(PB.DIM), LIGHT: map(PB.LIGHT) };
    T.DIM2 = T.DIM.map((v) => T.DIM[v]);
    // cool scan light: shifts whatever it crosses towards teal / cyan
    T.SCAN = map({ z: "q", y: "q", g: "q", p: "q", x: "r", w: "r", v: "s", u: "t", B: "C", C: "D", q: "r", r: "s", s: "t", f: "e", h: "i" });
    // red laser glow on the air around the beam
    T.RED = map({ z: "g", y: "g", g: "h", x: "B", w: "B", B: "C", q: "B", p: "g", v: "D", u: "D" });
    return T;
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
  // Pictogram strings: "#" is drawn in the given colour.
  function glyph(b, rows, x, y, ch) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === "#") b.set(x + i, y + j, ch);
  }
  function tube(b, x, y, w, h, ch) { // neon frame with cut corners
    for (let i = 1; i < w - 1; i++) { b.set(x + i, y, ch); b.set(x + i, y + h - 1, ch); }
    for (let j = 1; j < h - 1; j++) { b.set(x, y + j, ch); b.set(x + w - 1, y + j, ch); }
  }
  // A drawn tube shape becomes a lit sign: its pixels plus a dithered glow spilling onto the wall.
  function neon(shape, g1, g2) {
    const pos = [], col = [], core = [], s = shape.c, G1 = K.idx[g1], G2 = K.idx[g2];
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let i = 0; i < s.length; i++) if (s[i]) {
      const x = i % W, y = (i / W) | 0;
      pos.push(i); col.push(s[i]); core.push(1);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || shape.get(x, y)) continue;
      let d = 3;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (shape.get(x + dx, y + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
      if (d === 1 && bayer(x, y) < 9) { pos.push(y * W + x); col.push(G1); core.push(0); }
      else if (d === 2 && bayer(x, y) < 4) { pos.push(y * W + x); col.push(G2); core.push(0); }
    }
    return { pos: Int32Array.from(pos), col: Uint8Array.from(col), core: Uint8Array.from(core) };
  }
  function lit(f, n, on) {
    const { pos, col, core } = n, c = f.c;
    if (on) for (let k = 0; k < pos.length; k++) c[pos[k]] = col[k];
    else for (let k = 0; k < pos.length; k++) if (core[k]) c[pos[k]] = K.DIM2[col[k]];
  }

  // ---- sprites ----
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
    "...zzzz..zzzz...",
  ];
  // Iron crate: riveted plate with a recessed panel (light from the top left).
  const IRON = [
    "zzzzzzzzzzzzzzzz",
    "zuuuuuuuuuuuuuuz",
    "zutvvvvvvvvvvtwz",
    "zuvvvvvvvvvvvvwz",
    "zuvvxxxxxxxxuvwz",
    "zuvvxwwwwwwwuvwz",
    "zuvvxwvwwwwwuvwz",
    "zuvvxwwwwwwwuvwz",
    "zuvvxwwwwwwwuvwz",
    "zuvvxwwwwwwwuvwz",
    "zuvvxwwwwwwwuvwz",
    "zuvvuuuuuuuuuvwz",
    "zuvvvvvvvvvvvvwz",
    "zutvvvvvvvvvvtwz",
    "zwwwwwwwwwwwwwwz",
    "zzzzzzzzzzzzzzzz",
  ];
  // Laser emitter facing left; the beam leaves the lens on row 8.
  const EMITTER = [
    "................",
    "................",
    "................",
    "....zzzzzzzzzzz.",
    "...zuuuuuuuuuuvz",
    "..zzvvvvvvvvvvwz",
    ".zyzvxvxvxvvvvwz",
    "zhyzvvvvvvvvvvwz",
    "zDyzvvvvvvvvvvwz",
    "zhyzvvvvvvvvvvwz",
    ".zyzvvvvvvvvvvwz",
    "..zzwwwwwwwwwwwz",
    "...zzzzzzzzzzzz.",
    "......zvwz......",
    ".....zvwwwz.....",
    "....zzzzzzzz....",
  ];
  function mirrorSprite() { // "\" plate: mirror face up-right, back down-left, on a post
    const g = [];
    for (let j = 0; j < 16; j++) {
      let row = "";
      for (let i = 0; i < 16; i++) {
        const d = i - j;
        let c = ".";
        if (j >= 1 && j <= 12) c = d === 3 || d === -1 ? "z" : d === 2 ? "t" : d === 1 ? "u" : d === 0 ? "w" : ".";
        if ((j === 0 && d >= -1 && d <= 2) || (j === 13 && d >= 0 && d <= 3)) c = "z";
        if (c === "." && j >= 8 && j <= 12 && i >= 5 && i <= 8) c = i === 5 || i === 8 ? "z" : i === 6 ? "v" : "w";
        if (j === 13 && i >= 3 && i <= 12) c = "z";
        if (j === 14 && i >= 2 && i <= 13) c = i === 2 || i === 13 ? "z" : i < 6 ? "v" : "w";
        if (j === 15 && i >= 2 && i <= 13) c = "z";
        row += c;
      }
      g.push(row);
    }
    return g;
  }
  function magnetSprite() { // horseshoe opening to the left, steel pole tips
    const inside = (i, j) => {
      if (j < 1 || j > 14 || i < 0 || i > 15) return false;
      if (i > 11) { const dx = i - 11, dy = j < 8 ? 5 - j : j - 10; if (dy > 0 && dx * dx + dy * dy > 17) return false; }
      return !(j >= 5 && j <= 10 && i <= 9);
    };
    const g = [];
    for (let j = 0; j < 16; j++) {
      let row = "";
      for (let i = 0; i < 16; i++) {
        let c = ".";
        if (inside(i, j)) {
          if (!inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1)) c = "z";
          else if (i <= 3) c = j === 2 || j === 11 ? "t" : j < 8 ? "u" : "v";
          else if (i === 4) c = "x";
          else c = j === 2 ? "D" : j >= 12 || (i >= 12 && j >= 8) ? "B" : "C";
        }
        row += c;
      }
      g.push(row);
    }
    return g;
  }

  const GLYPH = {
    bowl: ["#.......#.", ".#.....#..", "..#...#...", "##########", "#........#", ".#......#.", "..######..", "...####..."],
    fish: ["..###....#", ".#...#..##", "#..#..###.", ".#...#..##", "..###....#"],
    bolt: ["...##", "..##.", ".####", "..##.", ".##..", "##..."],
    heart: [".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", "...#..."],
    eye: ["...#####...", ".##.....##.", "#...###...#", "#..#####..#", "#...###...#", ".##.....##.", "...#####..."],
    cup: ["....#..", "...#...", "#######", ".#...#.", ".#.#.#.", ".#...#.", "..###.."],
    cat: ["#.....#", "##...##", "#.###.#", "#.....#", "#.#.#.#", "#.....#", ".#####."],
    waves: ["#..#..#.", ".#..#..#"],
  };

  // ---- static layers, built once ----
  function skyAt(x, y) { // deep blue night, the market's violet glow rising from the street
    if (y < 30) return "z";
    if (y < 64) return bayer(x, y) < ((y - 30) * 16) / 34 ? "y" : "z";
    if (y < 98) return "y";
    return bayer(x, y) < ((y - 98) * 8) / 33 ? "B" : "y";
  }
  function catenary(x0, y0, x1, y1, sag) {
    const ys = [];
    for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0); ys.push(Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t))); }
    return ys;
  }

  function build(PB) {
    const h32 = PB.h32, L = {};
    // sky and the city behind the market
    const bg = (L.bg = new Buf(W, H));
    for (let y = 0; y < GY; y++) for (let x = 0; x < W; x++) bg.set(x, y, skyAt(x, y));
    L.beacons = [];
    for (let x = LB - 14; x < RB + 14; ) {
      const w = 8 + (h32(x, 1, 11) % 9), top = 44 + (h32(x, 2, 11) % 40);
      bg.rect(x, top, w, GY - top, "x");
      if (h32(x, 5, 11) % 3 === 0) bg.rect(x + 2, top - 3, w - 4, 3, "x");
      for (let y = top + 4; y < GY; y += 4) for (let i = 2; i < w - 2; i += 3) if (h32(x + i, y, 12) % 9 === 0) bg.set(x + i, y, h32(x + i, y, 18) % 4 ? "w" : "B");
      if (h32(x, 3, 11) % 2) {
        const sx = x + (w >> 1);
        for (let j = 1; j <= 8; j++) bg.set(sx, top - 3 - j, "x");
        L.beacons.push([sx, top - 12, h32(x, 4, 11) & 15]);
      }
      x += w + 3 + (h32(x, 6, 11) % 9);
    }
    // street glow hanging in the air in front of the far towers
    const HAZE = K.map({ x: "B" });
    for (let y = 104; y < GY; y++) for (let x = LB - 14; x < RB + 14; x++) if (bayer(x, y) < (y - 104) >> 2) bg.tone(x, y, HAZE);
    for (let x = LB - 10; x < RB + 10; ) {
      const w = 16 + (h32(x, 1, 13) % 14), top = 84 + (h32(x, 2, 13) % 26);
      bg.rect(x, top, w, GY - top, "z");
      if (h32(x, 3, 13) & 1) bg.rect(x + 3, top - 4, 6, 4, "z");
      for (let y = top + 3; y < GY - 2; y += 4) for (let i = 2; i < w - 3; i += 4) {
        const v = h32(x + i, y, 14) % 23;
        if (v < 3) { const c = ["q", "B", "y"][v]; bg.set(x + i, y, c); bg.set(x + i + 1, y, c); }
      }
      x += w + 3 + (h32(x, 6, 13) % 8);
    }

    // the two facades of the market street
    const fa = (L.facade = new Buf(W, H));
    for (let y = 0; y < GY; y++) { for (let x = 0; x < LB; x++) fa.set(x, y, "z"); for (let x = RB; x < W; x++) fa.set(x, y, "z"); }
    for (const sx of [24, 50, 262, 290]) for (let y = 0; y < GY; y++) fa.set(sx, y, "y");
    for (const fy of [30, 58, 92]) { for (let x = 0; x < LB; x++) fa.set(x, fy, "y"); for (let x = RB; x < W; x++) fa.set(x, fy, "y"); }
    for (let y = 0; y < GY; y++) { fa.set(LB - 1, y, "y"); fa.set(RB, y, "y"); }
    const WIN = [[5, 4], [30, 4], [56, 4], [240, 4], [268, 4], [296, 4], [42, 62], [296, 34], [266, 34]];
    for (const [wx, wy] of WIN) {
      const lit1 = h32(wx, wy, 15) % 3;
      for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
        const edge = i === 0 || j === 0 || i === 11 || j === 11;
        fa.set(wx + i, wy + j, edge ? (j === 11 ? "x" : "y") : lit1 === 0 ? (j % 3 === 0 ? "y" : "q") : lit1 === 1 ? (j % 3 === 0 ? "g" : "B") : i === 6 || i + j === 9 ? "y" : "z");
      }
    }
    // air-con box with its drip line
    fa.rect(44, 78, 12, 7, "x"); fa.rect(45, 79, 10, 5, "y");
    for (let i = 0; i < 4; i++) fa.set(47 + i * 2, 81, "x");

    // neon signs (pictograms only)
    const sign = (draw, g1, g2) => { const s = new Buf(W, H); draw(s); return neon(s, g1, g2); };
    L.signs = {
      banner: sign((s) => { tube(s, 68, 34, 17, 50, "D"); glyph(s, GLYPH.fish, 71, 40, "D"); glyph(s, GLYPH.bolt, 74, 52, "D"); glyph(s, GLYPH.heart, 73, 66, "D"); }, "C", "B"),
      noodle: sign((s) => { tube(s, 4, 36, 56, 16, "s"); glyph(s, GLYPH.bowl, 10, 40, "s"); glyph(s, GLYPH.waves, 26, 41, "r"); glyph(s, GLYPH.waves, 26, 45, "r"); glyph(s, GLYPH.fish, 42, 41, "s"); }, "r", "q"),
      cat: sign((s) => { tube(s, 8, 62, 22, 18, "A"); glyph(s, GLYPH.cat, 15, 67, "D"); }, "h", "g"),
      eye: sign((s) => {
        for (let a = 0; a < 64; a++) { const t = (a * Math.PI) / 32; s.set(276 + Math.round(Math.cos(t) * 13), 48 + Math.round(Math.sin(t) * 13), "s"); }
        glyph(s, GLYPH.eye, 271, 45, "s");
      }, "r", "q"),
      chevron: sign((s) => tube(s, 238, 46, 13, 64, "C"), "B", "g"),
      boba: sign((s) => { tube(s, 258, 72, 58, 16, "D"); glyph(s, GLYPH.cup, 263, 76, "D"); for (let i = 0; i < 3; i++) s.rect(276 + i * 10, 79, 4, 2, "C"); glyph(s, GLYPH.heart, 304, 77, "D"); }, "C", "B"),
    };

    // shopfront under the right facade: half-open shutter, lit shelves
    const sh = (L.shop = new Buf(W, H));
    sh.rect(252, 94, 68, 1, "w"); sh.rect(252, 95, 68, 3, "x");
    for (let y = 98; y < 112; y++) for (let x = 256; x < 318; x++) sh.set(x, y, (y & 1) ? "y" : "x");
    sh.rect(256, 112, 62, 1, "w");
    for (let y = 113; y < GY; y++) for (let x = 256; x < 318; x++) {
      let c = bayer(x, y) < 12 - ((y - 113) >> 1) ? "q" : "y";
      if (y === 120 || y === 127) c = "y";
      if ((y === 119 || y === 126) && h32(x, y, 16) % 4 === 0) c = ["r", "C", "B", "u"][h32(x, y, 17) & 3];
      sh.set(x, y, c);
    }
    for (let y = 98; y < GY; y++) { sh.set(255, y, "x"); sh.set(318, y, "x"); }

    // sky rail: truss beam high above the street, hung from cables
    const rl = (L.rail = new Buf(W, H));
    for (let x = 0; x < W; x++) {
      rl.set(x, 21, "w"); rl.set(x, 22, "x"); rl.set(x, 27, "x"); rl.set(x, 28, "y");
      for (let y = 23; y <= 26; y++) if ((x + y) % 8 === 0 || (x - y + 64) % 8 === 0) rl.set(x, y, "y");
    }
    for (const hx of [116, 206]) for (let y = 0; y < 21; y++) rl.set(hx, y, "y");

    // power lines across the street (the rat runs on the upper one)
    L.wire = catenary(LB, 62, RB - 1, 56, 10);
    L.wire2 = catenary(LB, 70, RB - 1, 76, 7);
    const wr = (L.wires = new Buf(W, H));
    L.wire.forEach((y, i) => wr.set(LB + i, y, "x"));
    L.wire2.forEach((y, i) => wr.set(LB + i, y, "y"));

    // food stall: striped awning, warm-lit back, steel counter with a cyan strip, stockpot, stools
    const st = (L.stall = new Buf(W, H));
    for (let y = 97; y < 112; y++) for (let x = 10; x < 76; x++) {
      const d = Math.abs(x - 40) + Math.abs(y - 101) * 2;
      st.set(x, y, d < 10 ? "e" : d < 22 ? (bayer(x, y) < 22 - d ? "e" : "f") : d < 38 ? (bayer(x, y) < (38 - d) >> 1 ? "f" : "g") : "g");
    }
    for (let x = 36; x < 76; x++) { st.set(x, 106, "g"); st.set(x, 107, "z"); }
    for (const [jx, jh] of [[46, 4], [50, 3], [53, 5], [58, 3], [62, 4], [71, 3]]) for (let j = 1; j <= jh; j++) { st.set(jx, 106 - j, j === jh ? "F" : "f"); st.set(jx + 1, 106 - j, "g"); }
    for (let y = 90; y < GY; y++) { st.set(7, y, "w"); st.set(8, y, "x"); st.set(77, y, "w"); st.set(78, y, "x"); }
    for (let x = 3; x < 83; x++) {
      const k = (x - 3) % 8, c = k < 4 ? "C" : "B";
      for (let y = 86; y < 95; y++) st.set(x, y, y === 86 ? "D" : y === 87 && k < 4 ? "D" : c);
      if (k > 0 && k < 7) st.set(x, 95, c);
      if (k > 1 && k < 6) st.set(x, 96, c);
    }
    for (let x = 6; x < 80; x++) {
      st.set(x, 111, "v"); st.set(x, 112, "w");
      for (let y = 113; y < GY; y++) st.set(x, y, y === 117 ? "r" : y === 118 ? "q" : (x - 6) % 12 === 0 ? "y" : "x");
    }
    st.rows([
      ".uuuuuuuuuuuuu.",
      "vvtvvvvvvvvvvwx",
      ".vvvvvvvvvvvwx.",
      ".vvwwwwwwwwwwx.",
      ".vwwwwwwwwwwxx.",
      ".wwwwwwwwwwwxx.",
      ".wwwwwwwwwwxxx.",
      "..xxxxxxxxxxx..",
    ], 16, 103);
    st.rows(["..tuuuuu..", ".uvvvvvvw.", "..wwwwww..", ".tuuuuuuu.", "..vvvvvw..", ".tuuuuuuu.", "..vvvvvw.."], 50, 104);
    for (const sx of [22, 56]) { st.rect(sx, 121, 9, 1, "v"); st.rect(sx, 122, 9, 1, "w"); for (let y = 123; y < GY; y++) { st.set(sx + 1, y, "y"); st.set(sx + 7, y, "y"); } }

    // gameplay-looking things: mirror, emitter, courier, iron crates, magnet
    const fg = (L.fg = new Buf(W, H));
    fg.rows(mirrorSprite(), 96, 116);
    fg.rows(EMITTER, 120, 116);
    fg.rows(HERO, 142, 116);
    fg.rows(IRON, 160, 116);
    fg.rows(IRON, 184, 116);
    fg.rows(magnetSprite(), 214, 116);

    // wet street: rough asphalt everywhere, clear mirror in the puddles
    const PUD = [[44, 146, 30, 4], [138, 141, 44, 3], [214, 157, 48, 6], [294, 144, 26, 3], [92, 167, 40, 5], [266, 173, 42, 4], [170, 176, 30, 3]];
    L.puddle = new Uint8Array(W * H); L.asphalt = new Uint8Array(W * H);
    for (let y = GY; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      L.asphalt[i] = K.idx[(h32(x, y, 21) & 15) === 0 ? "y" : "z"];
      for (const [cx, cy, rx, ry] of PUD) {
        const inside = (yy) => { const dx = (x - cx) / rx, dy = (yy - cy) / ry; return dx * dx + dy * dy <= 1; };
        if (inside(y)) L.puddle[i] = inside(y - 1) || (h32(x, y, 22) & 3) === 0 ? 1 : 2; // 2 = lit far rim
      }
    }
    // long smeared reflections of the signs higher up: [x0, x1, colour, sign]
    L.streaks = [[265, 287, "q", "eye"], [240, 249, "B", "chevron"], [260, 314, "B", "boba"]]; // the stall hides the left ones
    L.platform = { x: 140, y: 92 };
    return L;
  }

  // ---- per-frame pieces ----
  function beacons(f, L, e) {
    for (const [x, y, ph] of L.beacons) if (((e + ph) & 15) < 2) { f.set(x, y, "A"); f.set(x, y - 1, "h"); }
  }
  function signs(f, L, e, h32) {
    const S = L.signs;
    // most tubes hum steadily and drop out for a beat now and then; the boba sign has a bad contact
    const blip = (k) => (h32(e >> 1, k, 51) % 23) !== 0;
    const BUZZ = "1111111111111101001111111111111111111111011100";
    const on = { banner: blip(1), noodle: blip(2), cat: blip(3), eye: true, chevron: true, boba: BUZZ[e % BUZZ.length] === "1" };
    for (const k in on) lit(f, S[k], on[k]);
    // chevrons running down the right banner
    for (let k = 0; k < 7; k++) {
      const y = 50 + ((k * 9 + e) % 56);
      for (let i = 0; i < 4; i++) { f.set(241 + i, y + i, "D"); f.set(247 - i, y + i, "D"); }
    }
    return on;
  }
  function streaks(f, L, h32, e, on) {
    const c = f.c, Z = K.idx.z, Y = K.idx.y;
    for (const [x0, x1, col, key] of L.streaks) {
      if (!on[key]) continue;
      const v = K.idx[col];
      for (let x = x0; x <= x1; x++) {
        const s = h32(x, 7, 71) & 3;
        if (!s || (x & 1)) continue;
        for (let y = GY + 1; y < H; y++) {
          const xx = x + ((h32(y, e, 72) & 7) === 0 ? 1 : 0);
          if (bayer(xx, y) >= s * 3 - ((y - GY) >> 2)) continue;
          const i = y * W + xx;
          if (c[i] === Z || c[i] === Y) c[i] = v;
        }
      }
    }
  }
  function train(f, h32, e) {
    const x0 = 320 - ((e * 3 + 170) % 600);
    for (let car = 0; car < 3; car++) for (let i = 0; i < 36; i++) {
      const x = x0 + car * 38 + i; if (x < 0 || x >= W) continue;
      const nose = car === 0 ? Math.max(0, 4 - i) : car === 2 ? Math.max(0, i - 31) : 0;
      for (let y = 13 + nose; y <= 20; y++) {
        let c = "w";
        if (y === 13 + nose) c = "v";
        else if (y === 16 || y === 17) c = i > 3 && i < 33 && i % 5 < 3 ? (h32(car, (i / 5) | 0, 52) % 3 ? "r" : "q") : "x";
        else if (y === 20) c = "x";
        f.set(x, y, c);
      }
    }
    if (x0 > 0 && x0 < W) {
      f.set(x0, 17, "t");
      for (let k = 1; k < 18; k++) for (let y = 15; y <= 19; y++) if (bayer(x0 - k, y) < 8 - (k >> 1) - Math.abs(y - 17)) f.tone(x0 - k, y, K.LIGHT);
    }
  }
  function railLights(f, e) {
    for (let k = 0; k < 7; k++) { const x = 20 + k * 48; f.set(x, 29, ((e - k * 2) & 15) < 3 ? "s" : "q"); }
  }
  // Hacker rat: radio backpack with a blinking aerial, cyan goggles; 4-frame scamper.
  const RAT = [
    ".....s..........",
    ".....x....zz....",
    "....zzz..zDDz...",
    "...zxyxzzzvvzz..",
    "..zvxyxvvvvvsszz",
    ".zuvvvvvvvvvvvvD",
    ".zwvvvvvvvvvvwz.",
    "..zwwwwwwwwwzz..",
  ];
  const RAT_LEGS = ["..z...z...z..z..", "...z.z....z.z...", "....zz.....zz...", "...z.z....z.z..."];
  function rat(f, L, tick) {
    const len = 100, p = shuttle(tick, len, 14), c = 2 * (len + 14), ph = ((tick % c) + c) % c;
    const right = ph < len + 14, moving = (ph >= 14 && ph < len + 14) || ph >= 2 * 14 + len;
    const x = LB + 24 + p, wy = L.wire[x - LB + 8];
    const fr = moving ? tick & 3 : 0, up = fr === 2 ? 1 : 0;
    const body = RAT.slice();
    body.push(RAT_LEGS[fr]);
    if ((tick & 7) >= 2) body[0] = ".....r..........";
    f.rows(body, x, wy - 8 - up, !right);
    // tail: thin pink line trailing behind, swaying
    const tx = right ? x + 1 : x + 14, dir = right ? -1 : 1;
    for (let k = 1; k <= 7; k++) f.set(tx + dir * k, wy - 3 - up + (k > 2 ? 1 : 0) + (k > 4 ? ((tick + k) >> 1) & 1 : 0), "D");
    if (!moving) { // hacking: a pocket screen flickers in front of its nose
      const sx = right ? x + 17 : x - 4;
      f.rect(sx, wy - 6, 3, 3, "y");
      f.set(sx + 1, wy - 5, tick & 1 ? "s" : "r"); f.set(sx + (tick & 1 ? 0 : 2), wy - 5, "q");
    }
  }
  function lanterns(f, e) {
    for (const [x0, ph] of [[40, 0], [68, 5]]) {
      const dx = tri(e + ph, 20, 1);
      f.set(x0, 97, "y"); f.set(x0 + dx, 98, "y");
      f.rows([".CDC.", "CDDDC", "CDtDC", "CDDDC", ".CBC."], x0 - 2 + dx, 99);
      f.set(x0 + dx, 104, "y");
    }
  }
  function steam(f, e) { // three wisps curling up from the stockpot, broken into rising puffs
    for (const [x0, ph] of [[20, 0], [25, 4], [30, 9]]) {
      for (let k = 0; k < 36; k++) {
        if ((((k - e * 2 + ph * 3) % 13) + 13) % 13 >= 8) continue;
        const y = 102 - k, x = x0 + Math.round(Math.sin((k + ph) / 4 - e * 0.4) * (1 + k / 10)) + (k >> 3);
        if (k > 20 && bayer(x, y) < k - 20) continue;
        f.set(x, y, k < 7 ? "u" : k < 18 ? "v" : "w");
        if (k < 14 && ((k + ph) & 1)) f.set(x + 1, y, k < 7 ? "v" : "w");
      }
    }
  }
  // Security drone: hovers and drifts; its lens sweeps a cone of cool light (tan × 64 = ang) across the street.
  function droneState(tick) {
    const ang = tri(tick, 48, 26);
    return { cx: 196 + tri(tick >> 1, 64, 14), cy: 42 + tri(tick, 8, 1), ang, look: Math.round(ang / 9) };
  }
  function coneAt(s, y) {
    const d = y - (s.cy + 3);
    return [s.cx + s.look + Math.round((d * s.ang) / 64), 1 + ((d * 8) >> 6)];
  }
  function scanCone(f, s) { // only on what lies behind the courier, the crates and the machines
    for (let y = s.cy + 4; y < GY; y++) {
      const [xc, hw] = coneAt(s, y);
      for (let x = xc - hw; x <= xc + hw; x++) {
        const edge = x === xc - hw || x === xc + hw;
        if (bayer(x, y) < (edge ? 9 : 3)) f.tone(x, y, K.SCAN);
      }
    }
  }
  function scanSpot(f, s) { // where it lands on the wet street
    const [xc, hw] = coneAt(s, GY);
    for (let j = 0; j < 4; j++) for (let x = xc - hw - 3 + j; x <= xc + hw + 3 - j; x++) if (bayer(x, GY + j) < 12 - j * 3) f.tone(x, GY + j, K.SCAN);
  }
  function field(f, e) { // field arcs bowing out from the magnet's poles towards the crate
    for (let k = 0; k < 3; k++) {
      const rx = 2 + ((e + k * 4) % 12);
      const c = rx < 6 ? "s" : rx < 10 ? "r" : "q";
      for (let a = 0; a <= 24; a++) {
        const t = (a * Math.PI) / 24, x = 213 - Math.round(Math.sin(t) * rx), y = 118 + Math.round((1 - Math.cos(t)) * 5.5);
        if ((a + k) & 1) f.set(x, y, c);
      }
    }
  }
  function platform(f, L, e) {
    const x0 = L.platform.x, y0 = L.platform.y + tri(e, 12, 1);
    for (const px of [5, 21, 37]) for (let j = 0; j < 10; j++) for (let i = 1; i < 5; i++) {
      if (j < 2) f.set(x0 + px + i, y0 + 6 + j, j === 0 && (i === 2 || i === 3) ? "s" : "r");
      else if (bayer(x0 + px + i, y0 + 6 + j - (e & 1)) < 10 - j) f.tone(x0 + px + i, y0 + 6 + j, K.SCAN);
    }
    for (let i = 0; i < 48; i++) {
      const cap = i === 0 || i === 47;
      f.set(x0 + i, y0, cap ? "." : "u");
      f.set(x0 + i, y0 + 1, "v");
      f.set(x0 + i, y0 + 2, i % 12 === 5 ? "x" : "w");
      f.set(x0 + i, y0 + 3, "x");
      f.set(x0 + i, y0 + 4, cap ? "." : "y");
    }
    for (const px of [5, 21, 37]) {
      f.rect(x0 + px, y0 + 5, 6, 1, "q");
      f.set(x0 + px + 2, y0 + 5, ((e >> 1) & 1) ? "s" : "r"); f.set(x0 + px + 3, y0 + 5, "s");
    }
    f.set(x0 + 2, y0 + 2, ((e & 3) === 0) ? "s" : "r"); f.set(x0 + 45, y0 + 2, ((e & 3) === 2) ? "s" : "r");
  }
  function laser(f, tick) {
    const c = f.c, A = K.idx.A, D = K.idx.D, t = K.idx.t;
    for (let y = 18; y <= 124; y++) {
      const fade = y < 70 ? ((70 - y) * 16) / 52 : 0; // scattered by the rain higher up
      if (fade && bayer(106, y + (tick >> 1)) < fade) continue;
      for (const dx of [-1, 1]) if (bayer(106 + dx, y + tick) < 7 - (fade >> 1)) f.tone(106 + dx, y, K.RED);
      if (y < 124) c[y * W + 106] = ((y + tick * 3) % 14) === 0 ? D : A;
    }
    for (let x = 107; x <= 119; x++) {
      for (const dy of [-1, 1]) if (bayer(x + tick, 124 + dy) < 7) f.tone(x, 124 + dy, K.RED);
      c[124 * W + x] = ((x - tick * 3) % 14 + 14) % 14 === 0 ? D : A;
    }
    c[124 * W + 106] = t;
    if (tick & 1) { f.set(105, 123, "D"); f.set(107, 125, "D"); } else { f.set(107, 123, "D"); f.set(105, 125, "D"); }
  }
  function reflect(f, L, h32, e) {
    const c = f.c, P = L.puddle, A = L.asphalt, D = K.DIM, D2 = K.DIM2;
    for (let y = GY; y < H; y++) {
      const sy = 2 * GY - 1 - y, depth = y - GY;
      const jit = (h32(y, e, 31) & 3) === 0 ? ((h32(y, e, 32) & 1) ? 1 : -1) : 0;
      for (let x = 0; x < W; x++) {
        const sx = Math.min(W - 1, Math.max(0, x + jit)), i = y * W + x;
        let v = c[sy * W + sx];
        if (P[i] === 2) v = K.idx.x;
        else if (P[i]) v = depth > 26 && bayer(x, y) < (depth - 26) >> 1 ? D2[v] : D[v];
        else v = (h32(x, y, 33) & 7) === 0 ? A[i] : D2[v];
        c[i] = v;
      }
    }
  }
  function puddleLife(f, L, h32, e) {
    // ripples where drops hit the puddles, little splashes on the rough asphalt
    for (let k = 0; k < 22; k++) {
      const age = (e + k) % 4, born = e - age, x = h32(born, k, 61) % W, y = GY + 2 + (h32(born, k, 62) % (H - GY - 3));
      if (L.puddle[y * W + x]) {
        const rx = 1 + age * 2, ry = 1 + (age >> 1);
        for (let a = 0; a < 24; a++) {
          const t = (a * Math.PI) / 12, px = x + Math.round(Math.cos(t) * rx), py = y + Math.round(Math.sin(t) * ry);
          f.tone(px, py, K.LIGHT); if (age === 0) f.tone(px, py, K.LIGHT);
        }
      } else if (age < 2) {
        f.tone(x, y - 1 - age, K.LIGHT); f.tone(x - 1 - age, y - age, K.LIGHT); f.tone(x + 1 + age, y - age, K.LIGHT);
      }
    }
  }
  function rain(f, h32, e) {
    const L2 = K.LIGHT;
    for (let i = 0; i < 150; i++) {
      const sx = h32(i, 1, 77) % (W + 60), sp = 9 + (h32(i, 3, 77) & 3), fall = (h32(i, 2, 77) + e * sp) % 214, y = fall - 22, x = sx - (fall >> 2);
      for (let k = 0; k < 4; k++) {
        const yy = y + k;
        if (x < 0 || x >= W || yy < 0 || yy >= H) continue;
        if (x >= 105 && x <= 107 && yy < 124 && yy > 40) { f.set(x, yy, "D"); continue; } // drops catch the laser
        f.tone(x, yy, L2);
      }
    }
  }
  function drone(f, s, tick) {
    const { cx, cy, look } = s;
    for (const sd of [-1, 1]) { // arms, rotor blur, hover jets
      for (let i = 7; i <= 14; i++) { f.set(cx + sd * i, cy - 3, "z"); f.set(cx + sd * i, cy - 2, "w"); f.set(cx + sd * i, cy - 1, "z"); }
      const hx = cx + sd * 14;
      f.set(hx, cy - 4, "z"); f.set(hx, cy - 5, "x");
      for (let i = -6; i <= 6; i++) f.set(hx + i, cy - 6, ((i + tick * 2) & 3) < 2 ? "u" : "w");
      for (let i = -3; i <= 3; i++) if ((i + tick) & 1) f.set(hx + i, cy - 7, "v");
      f.set(hx, cy, "z"); f.set(hx, cy + 1, tick & 1 ? "s" : "r");
    }
    for (let j = -5; j <= 5; j++) for (let i = -8; i <= 8; i++) { // steel shell with a dark visor
      const q = (i * i) / 72 + (j * j) / 30;
      if (q > 1) continue;
      let c = q > 0.7 ? "z" : j < 0 ? (i < -1 && j < -2 ? "v" : "w") : j <= 2 ? "y" : "x";
      if (j === -3 && (i === -4 || i === -3)) c = "u";
      f.set(cx + i, cy + j, c);
    }
    f.rect(cx + look - 2, cy, 4, 2, "A"); f.set(cx + look - 2, cy, "D"); // the red eye follows the sweep
    f.set(cx + look - 3, cy + 1, "h"); f.set(cx + look + 2, cy + 1, "h");
    const red = (tick & 4) === 0; // security lamp: red / blue
    f.set(cx - 1, cy - 6, red ? "A" : "q"); f.set(cx, cy - 6, red ? "h" : "r"); f.set(cx - 1, cy - 7, "z"); f.set(cx, cy - 7, "z");
  }

  let L = null, frame = null, img = null;
  window.PB_CONCEPT_SCENES.cyber_market = {
    draw(ctx, tick) {
      const PB = window.PB, h32 = PB.h32, e = tick >> 1;
      if (!K) K = tables(PB);
      if (!L) L = build(PB);
      if (!frame) frame = new Buf(W, H);
      const f = frame;
      f.c.set(L.bg.c);
      beacons(f, L, e);
      f.blit(L.facade);
      const on = signs(f, L, e, h32);
      f.blit(L.shop);
      laser(f, tick);
      f.blit(L.rail);
      railLights(f, e);
      train(f, h32, e);
      f.blit(L.wires);
      rat(f, L, tick);
      f.blit(L.stall);
      lanterns(f, e);
      steam(f, e);
      const ds = droneState(tick);
      scanCone(f, ds);
      field(f, e);
      platform(f, L, e);
      f.blit(L.fg);
      reflect(f, L, h32, e);
      streaks(f, L, h32, e, on);
      scanSpot(f, ds);
      puddleLife(f, L, h32, e);
      rain(f, h32, e);
      drone(f, ds, tick);
      if (!img) img = ctx.createImageData(W, H);
      const d = img.data, c = f.c, rgb = K.rgb;
      for (let i = 0, j = 0; i < c.length; i++, j += 4) { const k = c[i] * 3; d[j] = rgb[k]; d[j + 1] = rgb[k + 1]; d[j + 2] = rgb[k + 2]; d[j + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    },
  };
})();