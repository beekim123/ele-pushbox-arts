/* ART-04q 地图概念场景 · 月亮风筝天（kite_sky）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 季风转换期的午后，淡青色的高天，脚下很远处是海和海边的高脚木屋。
 * 地标：尾巴像新月的大月亮风筝（顶上竹骨可站）、绷紧的风筝线、海边高脚木屋（远景）、月亮风筝头上会发声的竹弓。
 * 机关外观：paper（竹篾框糊彩纸，透光能看见里面的竹骨）、gust（一小块阵风区，风线横扫）、
 *           moving_platform（被热气流一阵阵托高又慢慢落下的黄色小风筝）。只示意外观，不实现规则。
 * 环境（4 fps）：风筝线嗡嗡振动、竹弓的弦颤动、热气流把风筝一阵阵托高、阳光透过彩纸投下的彩影在远处风筝上滑过、
 *           云慢慢飘、海面闪光。光照（彩影）只落在背景层的远处风筝上。
 * 动物（8 fps）：风筝蜂（怪物，一头撞上风筝线，线被撞弯）、白腹海雕（提示动物，在风筝之间盘旋，绕着会升降的黄风筝）。
 * 比例尺：主角大小的人影 + 1 个木箱，站在月亮风筝顶上不动。不画收件人、货物（包括纸扎货）、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const SPAR = OY + 6 * 16;                       // 100: the moon kite's top spar, where the figure stands
  const HORIZON = 134;
  const SUN = { dx: 10, dy: 14 };                 // where the coloured shadows fall (sun high on the upper left)
  const VANISH = [-60, 236];                       // all kite lines run down to the flyers on the shore, off screen
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null;

  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        const c = row[flip ? w - 1 - i : i];
        if (c !== ".") r.set(x + i, y + j, c);
      }
    }
  }
  function bands(r, stops, seam) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = stops[0][1];
      for (let i = 1; i < stops.length; i++) {
        const sy = stops[i][0];
        if (y >= sy + seam) { c = stops[i][1]; continue; }
        if (y >= sy - seam && bay(x, y) < Math.floor(((y - sy + seam) * 16) / (2 * seam + 1))) c = stops[i][1];
        break;
      }
      r.set(x, y, c);
    }
  }
  const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  function inT(x, y, ax, ay, bx, by, cx, cy) {
    const s1 = (x - bx) * (ay - by) - (ax - bx) * (y - by), s2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy), s3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
    return !((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0));
  }
  function shape(w, h, paint) {
    const rows = [];
    for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += paint(x + 0.5, y + 0.5, x, y) || "."; rows.push(s); }
    return rows;
  }
  function outline(rows, c) {
    const h = rows.length, w = rows[0].length, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x]);
    return rows.map((row, y) => row.split("").map((ch, x) => (ch !== "." ? ch :
      (at(x - 1, y) !== "." || at(x + 1, y) !== "." || at(x, y - 1) !== "." || at(x, y + 1) !== ".") ? c : ".")).join(""));
  }
  // A straight, taut line; bend(s, x, y) may push a point sideways by whole pixels.
  function line(r, x0, y0, x1, y1, c, bend) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const s = k / n, y = Math.round(y0 + (y1 - y0) * s);
      const x = Math.round(x0 + (x1 - x0) * s) + (bend ? bend(s, y) : 0);
      r.set(x, y, typeof c === "function" ? c(x, y) : c);
    }
  }

  // ---- sprites ----
  const PORTER = [                                // protagonist-sized figure, facing right
    "................",
    "......zzzz......",
    ".....zllkkz.....",
    "....zlkkkkkz....",
    "..zzkkkkkkkkzz..",
    ".zbkkkkkkkkkkbz.",
    "..zzEEEEEEEEzz..",
    "...zEEEEEzEEz...",
    "...zFEEEEEEFz...",
    "....zhiiiiiz....",
    "...zhiiiiiiiz...",
    "..zEhiiiiiiiEz..",
    "..zzhhiiiiihzz..",
    "....zxxzzxxz....",
    "....zxxzzxxz....",
    "...zffzzzzffz...",
  ];
  const CRATE = (() => {
    const rows = [];
    for (let j = 0; j < 16; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        const k = i + j;
        if (i === 0 || j === 0 || i === 15 || j === 15) s += "z";
        else if (i === 14 || j === 14) s += "f";
        else if (i === 1 || j === 1) s += "d";
        else if (i === 2 || j === 2 || i === 13 || j === 13) s += "e";
        else if (k === 15) s += "d";
        else if (k === 16) s += "e";
        else s += j === 8 ? "e" : "b";
      }
      rows.push(s);
    }
    return rows;
  })();
  // paper: a flat-topped kite — bamboo spar on top (stand here), coloured paper with the bamboo cross showing through.
  function boxKite(w, h, paper, rib, art) {
    return shape(w, h, (x, y, ix, iy) => {
      if (iy <= 1) return iy === 0 ? "d" : "F";
      if (ix === 0 || ix === w - 1 || iy === h - 1) return "g";
      const a = art(x - w / 2, y - h / 2 - 1);
      if (a) return a;
      const d1 = Math.abs((ix - 1) * (h - 4) - (iy - 2) * (w - 3)) < (w - 3) * 0.6;
      const d2 = Math.abs((w - 2 - ix) * (h - 4) - (iy - 2) * (w - 3)) < (w - 3) * 0.6;
      return d1 || d2 || ix === w >> 1 ? rib : paper;
    });
  }
  function rokkaku() {                            // the green six-sided kite, 48 × 28
    const cx = 23.5, half = (y) => (y < 10 ? 18 + y * 0.45 : 22.5 - (y - 10) * 0.5);
    return outline(shape(48, 28, (x, y, ix, iy) => {
      if (iy <= 1) return Math.abs(x - cx) <= 20 ? (iy === 0 ? "d" : "F") : null;
      if (iy >= 27 || Math.abs(x - cx) > half(iy) - 0.5) return null;
      const dd = Math.abs(x - cx) + Math.abs(y - 13);
      if (dd < 2.2) return "i";
      if (dd < 7) return dd > 5.6 ? "k" : "l";
      if (iy === 10 || Math.abs(x - cx) < 0.6 || Math.abs(Math.abs(x - cx) - (iy - 2) * 0.75) < 0.5) return "n";
      return "m";
    }), "g");
  }
  function farKite() {                            // far diamond kite in faded paper: it only receives the coloured shadows
    return outline(shape(56, 80, (x, y) => {
      const dx = Math.abs(x - 28), top = y < 32, w = top ? (y / 32) * 27 : ((80 - y) / 48) * 27;
      if (dx > w) return null;
      if (dx < 0.6 || Math.abs(y - 32 + dx * 0.12) < 0.6) return "F";                      // bamboo cross through the paper
      const dd = dx + Math.abs(y - 34) * 0.8;
      if (dd < 8) return dd < 4.5 ? "c" : "E";
      return "c";
    }), "F");
  }
  // Kite bee, facing left; wing frame 0/1.
  function bee(f) {
    return outline(shape(12, 9, (x, y, ix, iy) => {
      if (ix === 2 && iy === 4) return "t";                                                 // eye
      const head = inE(x, y, 2.6, 5, 1.9, 1.8), body = inE(x, y, 7, 5.4, 3.8, 2.4);
      const wing = f ? inE(x, y, 6.4, 2.4, 3.2, 1.2) : inE(x, y, 5.8, 1.9, 1.8, 1.8) || inE(x, y, 8.2, 2.2, 1.6, 1.6);
      if (wing && !body) return iy <= 1 ? "t" : "u";
      if (head) return "g";
      if (body) return (ix === 6 || ix === 9) ? "g" : iy >= 6 ? "j" : "k";
      if (ix === 11 && iy === 5) return "g";                                                // sting
      return null;
    }), "g");
  }
  // White-bellied sea eagle soaring, head to the right: white head, body and coverts, dark flight feathers.
  // wing: 0 glide, 1 up, 2 down.
  function eagle(wing) {
    const g = Array.from({ length: 12 }, () => Array(27).fill("."));
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < 27 && y < 12) g[y][x] = c; };
    const wy = [3, 1, 6][wing], ty = [4, 0, 9][wing];
    const seg = (x0, y0, x1, y1, top, under) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
        put(x, y, top); put(x, y + 1, under);
      }
    };
    seg(11, 6, 6, wy, "t", "y"); seg(6, wy, 1, ty, "x", "y");                                // left wing
    seg(15, 6, 20, wy, "t", "y"); seg(20, wy, 25, ty, "x", "y");                             // right wing
    put(0, ty + 1, "y"); put(26, ty + 1, "y");                                                // fingered tips
    for (let x = 10; x <= 17; x++) { put(x, 6, "t"); put(x, 7, x < 12 ? "v" : "t"); }      // body
    put(8, 7, "t"); put(9, 7, "t"); put(9, 6, "t"); put(8, 8, "v"); put(9, 8, "v");         // tail
    put(16, 5, "t"); put(17, 5, "t"); put(18, 6, "t"); put(18, 5, "z"); put(19, 6, "v");     // head, eye, grey beak
    return g.map((row) => row.join(""));
  }

  // ---- layout ----
  const C = 127.5;                                // moon kite centre line
  const wingBot = (x) => SPAR + 6 + 18 * (1 - ((x - C) / 80) ** 2);
  function moonPart(x, y) {                       // 1 wings, 2 head, 3 waist, 4 crescent tail
    if (x > 48.5 && x < 206.5 && y >= SPAR + 2 && y <= wingBot(x)) return 1;
    if (inT(x, y, 117.5, SPAR, 137.5, SPAR, C, 85)) return 2;
    if (y >= 120 && y < 132 && Math.abs(x - C) < 10 - (y - 120) * 0.35) return 3;
    if (y >= 112 && inE(x, y, C, 124, 63, 32) && !inE(x, y, C, 118, 55, 28)) return 4;
    return 0;
  }
  const SHADE = { i: "h", l: "k", m: "n", k: "j" };      // bamboo seen through the paper: one step darker
  // Coloured light through the paper, painted onto the far kite only (background).
  const TINT = {
    l: { c: "k", E: "k", D: "j", F: "b" },
    m: { c: "m", E: "n", D: "n", F: "o" },
    i: { c: "D", E: "D", D: "i", F: "h" },
    g: { c: "F", E: "F", D: "C", F: "e" },
  };
  const tintOf = (c) => (c === "l" || c === "k" ? TINT.l : c === "m" || c === "n" ? TINT.m : c === "i" || c === "h" ? TINT.i : TINT.g);
  const CLOUDS = [[10, 120, 44, 1], [118, 124, 56, 2], [236, 118, 38, 3]];   // x, base, width, seed

  // ---- static layers ----
  function buildSky() {
    const r = layer();
    bands(r, [[0, "r"], [30, "s"], [58, "u"], [126, "c"]], 3);                            // pale high sky, hazy horizon
    for (const [x0, y0, w] of [[18, 16, 46], [150, 9, 60], [236, 24, 40]]) {                // thin high streaks
      for (let i = 0; i < w; i++) {
        const t = Math.abs(i - w / 2) / (w / 2);
        if (bay(x0 + i, y0) < 16 * (1 - t)) r.set(x0 + i, y0, "u");
        if (i > w * 0.25 && i < w * 0.75 && hash(i, y0, 3) % 3) r.set(x0 + i + 5, y0 + 2, "u");
      }
    }
    for (let y = HORIZON; y < H; y++) for (let x = 0; x < W; x++) {                        // the sea, far below
      let c = y < HORIZON + 2 ? "s" : y < 150 ? "r" : "q";
      if (y >= 146 && y < 154 && bay(x, y) < (y - 146) * 2) c = "q";
      if (c === "r" && hash(x >> 2, y, 5) % 23 === 0) c = "s";
      if (c === "q" && hash(x >> 2, y, 6) % 19 === 0) c = "r";
      r.set(x, y, c);
    }
    for (let x = 226; x < W; x++) {                                                         // far shore, low contrast
      const top = 168 - Math.round(6 * Math.sin(((x - 226) / 94) * 1.6));
      for (let y = top; y < H; y++) r.set(x, y, y === top ? "c" : bay(x, y) < 8 ? "d" : "F");
    }
    for (const [hx, hy] of [[236, 154], [254, 150], [274, 152], [296, 148]]) {              // stilt houses over the water
      for (let y = hy + 8; y < hy + 15; y++) { r.set(hx + 2, y, "w"); r.set(hx + 7, y, "w"); }
      r.rect(hx, hy + 3, 10, 5, "v"); r.rect(hx + 4, hy + 5, 2, 3, "w");
      r.hline(hx + 3, hy, 4, "F"); r.hline(hx + 1, hy + 1, 8, "F"); r.hline(hx - 1, hy + 2, 12, "e");
    }
    return r;
  }
  function buildMoon() {                          // the big moon kite: wings (stand on the spar), head, waist, crescent tail
    const r = layer();
    const empty = (x, y) => !moonPart(x, y);
    for (let y = 80; y < 160; y++) for (let x = 40; x < 216; x++) {
      const px = x + 0.5, py = y + 0.5, k = moonPart(px, py);
      if (!k) continue;
      const e1 = empty(px - 1, py) || empty(px + 1, py) || empty(px, py - 1) || empty(px, py + 1);
      const e2 = e1 || empty(px - 2, py) || empty(px + 2, py) || empty(px, py - 2) || empty(px, py + 2);
      let c;
      if (k === 1) {
        c = e2 ? "l" : "i";
        for (const [mx, my] of [[C - 24, 111], [C + 24, 111], [C - 52, 107], [C + 52, 107]]) {   // green leaves
          const d = Math.abs(px - mx) + Math.abs(py - my) * 1.6;
          if (d < 5) c = Math.abs(py - my) < 0.6 ? "n" : "m";
        }
        if (Math.abs(py - (SPAR + 4 + 14 * (1 - ((px - C) / 80) ** 2))) < 0.6) c = SHADE[c] || c;   // rib through paper
      } else if (k === 2) {
        c = e1 ? "k" : inE(px, py, C, 94, 2.4, 2.4) ? "i" : "l";
      } else if (k === 3) {
        c = "l";
      } else {
        c = e1 ? "l" : "m";
        const mid = inE(px, py, C, 121, 59, 30) && !inE(px, py, C, 121, 58, 29);
        if (mid) c = "n";
        for (let j = -4; j <= 4; j++) {                                                      // red seeds along the crescent
          const ang = (j / 4) * 1.15, sx = C + 59 * Math.sin(ang), sy = 121 + 30 * Math.cos(ang);
          if ((px - sx) ** 2 + (py - sy) ** 2 < 2.3) c = "i";
        }
      }
      if (Math.abs(px - C) < 0.6 && c !== "l") c = SHADE[c] || c;                            // the spine
      r.set(x, y, c);
    }
    const d = r.data;                                                                         // dark outline
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3];
    const edge = [];
    for (let y = 79; y < 161; y++) for (let x = 39; x < 217; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push([x, y]);
    }
    for (const [x, y] of edge) r.set(x, y, "g");
    for (let x = 45; x < 211; x++) { r.set(x, SPAR, x < 47 || x > 208 ? "e" : "d"); r.set(x, SPAR + 1, "F"); }   // top spar
    for (let x = 104; x <= 151; x++) {                                                        // the bamboo bow over the head
      const u = (x + 0.5 - C) / 24, y = Math.round(86 - 9 * (1 - u * u));
      r.set(x, y, "d"); r.set(x, y + 1, "e");
    }
    r.vline(127, 77, 9, "F");
    r.rect(103, 85, 2, 3, "f"); r.rect(151, 85, 2, 3, "f");
    return r;
  }
  function build() {
    PB = window.PB;
    L = {
      sky: buildSky(), moon: buildMoon(), far: farKite(),
      red: boxKite(32, 26, "i", "h", (x, y) => { const d = Math.sqrt(x * x + y * y); return d < 4.2 ? "l" : d < 5.6 ? "k" : null; }),
      yellow: boxKite(32, 26, "l", "k", (x, y) => { const d = Math.abs(x) + Math.abs(y); return d < 2 ? "h" : d < 6 ? "i" : null; }),
      green: rokkaku(),
      BEE: [bee(0), bee(1)], EAGLE: [eagle(0), eagle(1), eagle(2)],
      CLOUD: CLOUDS.map(([, , w, seed]) => shape(w, 16, (x, y) => {
        let t = false;
        for (let k = 0; k < 5; k++) {
          const cx = w * (0.15 + 0.175 * k), cy = 11 - (hash(k, seed, 7) % 6), rr = 4 + (hash(k, seed, 8) % 4);
          if ((x - cx) ** 2 + (y - cy) ** 2 < rr * rr) t = true;
        }
        if (!t || y > 14) return null;
        return y > 12 ? "u" : y > 10 && bay(x | 0, y | 0) < 8 ? "u" : "t";
      })),
    };
    const props = layer();
    spr(props, CRATE, 160, SPAR - 16);
    spr(props, PORTER, 80, SPAR - 16);
    L.props = props;
  }

  // ---- ambient (4 fps) ----
  function lift(a, off, amp) {                    // thermals: lifted quickly, then a slow sink
    const q = (a + off) % 40, e = q < 6 ? q / 6 : q < 14 ? 1 : 1 - (q - 14) / 26;
    return Math.round(amp * e);
  }
  function kites(a) {
    return {
      red: { x: 8, y: 52 - lift(a, 13, 3), rows: L.red, bx: 24, by: 26 },
      green: { x: 256, y: 36 - lift(a, 25, 3), rows: L.green, bx: 24, by: 28 },
      yellow: { x: 224, y: 116 - lift(a, 0, 20), rows: L.yellow, bx: 16, by: 26 },   // moving_platform
    };
  }
  function drawClouds(r, a) {
    CLOUDS.forEach(([x0, base, w], i) => {
      const x = ((x0 + Math.floor(a / 6) + 40) % (W + 80)) - 40;
      spr(r, L.CLOUD[i], x, base - 14);
    });
  }
  function drawGlints(r, a) {                     // sun glitter on the sea
    for (let k = 0; k < 14; k++) {
      const n = Math.floor((a + k * 3) / 6), x = hash(k, n, 9) % W, y = HORIZON + 3 + (hash(k, n, 10) % 24);
      if ((a + k * 3) % 6 < 3 && !(x > 226 && y > 160)) { r.set(x, y, "t"); if (k & 1) r.set(x + 1, y, "s"); }
    }
  }
  function drawFar(r, a, K) {                     // far kite + the coloured shadows sliding over it
    const fx = 244 + tri(a, 160, 3), fy = 58 + tri(a + 40, 100, 2), rows = L.far;
    spr(r, rows, fx, fy);
    for (let j = 0; j < 30; j++) {                // its tail
      const x = fx + 28 + Math.round(tri(a + j, 16, 2) * j / 30), y = fy + 80 + j;
      r.set(x, y, j % 5 === 2 ? "D" : "F");
      if (j % 5 === 2) { r.set(x - 1, y, "D"); r.set(x + 1, y, "D"); }
    }
    for (const k of [K.yellow, K.green]) {
      for (let j = 0; j < k.rows.length; j++) for (let i = 0; i < k.rows[j].length; i++) {
        const c = k.rows[j][i];
        if (c === ".") continue;
        const tx = k.x + i + SUN.dx, ty = k.y + j + SUN.dy, fr = rows[ty - fy], fc = fr && fr[tx - fx];
        if (!fc || fc === ".") continue;
        const m = tintOf(c)[fc];
        if (m) r.set(tx, ty, m);
      }
    }
  }
  function drawKite(r, k, a, tail) {
    spr(r, k.rows, k.x, k.y);
    if (!tail) return;
    const x0 = k.x + k.bx, y0 = k.y + k.rows.length;
    for (let j = 0; j < tail[0]; j++) {          // tail with little paper bows, swinging in the wind
      const x = x0 + Math.round((tri(a + j, 14, 2) + 1) * j / tail[0]), y = y0 + j;
      r.set(x, y, "x");
      if (j % 5 === 4) { r.set(x - 1, y, tail[1]); r.set(x + 1, y, tail[1]); r.set(x - 2, y - 1, tail[1]); r.set(x + 2, y - 1, tail[1]); }
    }
  }
  // Lines hum: the middle of each line flips one pixel to and fro. A bee strike adds a dent that dies away.
  function drawLines(r, tick, K, hit) {
    const hum = tick & 1 ? 1 : -1;
    const ink = (x, y) => (r.get(x, y) === "q" ? "v" : "x");   // lines catch the light over the dark sea
    const run = (x0, y0, c, dent) => line(r, x0, y0, VANISH[0], VANISH[1], ink, (s, y) => {
      let o = s > 0.2 && s < 0.7 ? hum : 0;
      if (dent && Math.abs(y - dent.y) < 10) o -= Math.round(dent.k * (1 - Math.abs(y - dent.y) / 10));
      return o;
    });
    run(K.red.x + K.red.bx, K.red.y + K.red.by, "x");
    run(Math.round(C), 157, "x");
    run(K.green.x + K.green.bx, K.green.y + K.green.by, "x");
    run(K.yellow.x + K.yellow.bx, K.yellow.y + K.yellow.by, "x", hit);
  }
  function drawBowString(r, tick) {               // the bow string hums, so it shivers
    const up = tick & 1;
    for (let x = 105; x <= 150; x++) r.set(x, x > 111 && x < 144 ? 86 + (up ? -1 : 1) * (x > 118 && x < 137 ? 1 : 0) + (up ? 0 : 0) : 86, "u");
  }
  function drawRibbons(r, a) {                    // streamers at the moon kite's wing tips
    for (const [x0, side] of [[47, 0], [208, 1]]) {
      for (let j = 0; j < 12; j++) {
        const x = x0 + Math.round(((tri(a + side * 5 + j, 12, 2) + 2) * j) / 12), y = SPAR + 2 + j;
        r.set(x, y, (j >> 1) & 1 ? "i" : "l");
      }
    }
  }
  function drawGust(r, a) {                       // gust: a patch of air (3 × 2 tiles) where wind lines race across
    const q = a % 28;
    if (q >= 16) return;
    for (let k = 0; k < 6; k++) {
      const y = 52 + k * 5 + (k & 1), len = 6 + (k % 3) * 3, head = 156 + ((q * 6 + k * 17) % 60);
      for (let i = 0; i < len; i++) {
        const x = head - i;
        if (x >= 156 && x < 212) r.set(x, y + (i > len - 3 && k % 2 ? 1 : 0), i < 2 ? "t" : "u");
      }
    }
  }

  // ---- animals (8 fps) ----
  function beeState(tick, K) {                    // hovers, dives into the yellow kite's line, bounces off
    const y0 = K.yellow.y + K.yellow.by, cy = 160 + tri(tick, 16, 2), s = (cy - y0) / (VANISH[1] - y0);
    const lx = Math.round(K.yellow.x + K.yellow.bx + (VANISH[0] - K.yellow.x - K.yellow.bx) * s);
    const p = tick % 40;
    let x, flip = false, k = 0;
    if (p < 24) x = lx + 16 + tri(p, 12, 3);
    else if (p < 28) x = lx + 16 - (p - 23) * 4;
    else if (p < 30) x = lx + 1;
    else { x = lx + 1 + Math.round((p - 29) * 1.5); flip = p < 36; }
    if (p >= 27 && p < 36) k = [3, 3, 3, 2, 2, 1, 1, 1, 0][p - 27];
    return { x, y: cy, flip, hit: k ? { y: cy, k } : null };
  }
  function drawBee(r, tick, b) {
    spr(r, L.BEE[(tick >> 0) & 1], b.x - 1, b.y - 5, b.flip);
  }
  function drawEagle(r, tick) {                   // circles between the kites, round the rising yellow kite
    const th = (tick * Math.PI * 2) / 96, x = Math.round(232 + 34 * Math.cos(th)), y = Math.round(80 + 8 * Math.sin(th));
    const f = tick % 32, wing = f < 8 ? [1, 1, 0, 0, 2, 2, 0, 0][f] : 0, right = Math.sin(th) < 0;
    spr(r, L.EAGLE[wing], x - 13, y - 6, !right);
  }

  window.PB_CONCEPT_SCENES["kite_sky"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer(), K = kites(a), b = beeState(tick, K);
      r.data.set(L.sky.data);
      drawClouds(r, a);
      drawGlints(r, a);
      drawFar(r, a, K);
      drawLines(r, tick, K, b.hit);
      r.blit(L.moon, 0, 0);
      drawBowString(r, tick);
      drawRibbons(r, a);
      drawKite(r, K.red, a, [22, "m"]);
      drawKite(r, K.green, a, null);
      drawKite(r, K.yellow, a, [14, "i"]);
      r.blit(L.props, 0, 0);
      drawGust(r, a);
      drawBee(r, tick, b);
      drawEagle(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
