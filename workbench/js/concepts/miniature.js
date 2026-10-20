/* ART-04p 地图概念场景 · 细密画中（miniature）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿，不用半透明。
 * 走进一页波斯细密画：没有远近，越往上越远；颜色平涂，没有影子和光照，线是细细的墨。
 * 地标：左边一层层往上叠的平面山；卷云纹缠着的金天；右边花园里的亭子和水池；页面四边的花纹边框。
 * 机关外观：套娃箱（nested_box：画中画，一层画框里还套着一层）、浮空石板（float_block：青金石釉砖，托着木箱慢慢浮沉）、
 *   梯子（ladder：通到亭子所在的台子）。
 * 环境（4 fps）：金天上三条卷云纹像丝带一样翻卷（波沿着带子走、带子翻面、两头的卷涡打转）；山边一道墨线一笔一笔
 *   描出新的台阶，描完一级平涂一级；花园里的花先只有墨线，再一朵朵点上颜色；池里的银波纹慢慢走。
 * 动物（8 fps）：画中狮（怪物，平面的小狮子，只在地上横着来回走）、夜莺（提示动物，停在亭子尖顶上唱）。
 * 比例尺：主角大小的人影 + 木箱 + 套娃箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const FLOOR = OY + 9 * 16;                      // 148: top of the garden pavement
  const M = 6;                                    // page border; the picture itself is x 6–313, y 6–173
  const PLAT_X = 16 * 16, PLAT_Y = OY + 6 * 16;   // pavilion terrace: x ≥ 256, top y = 100
  const LAD_X = 15 * 16;                          // ladder x 240–255, from the pavement up to the terrace
  const FB_X = 5 * 16, FB_Y = OY + 6 * 16, FB_W = 48;   // float block x 80–127, y 100–115, carries a crate
  const NEST_X = 8 * 16;                          // nested box on the pavement, x 128–143
  const PLOT = { x0: 146, x1: 238, y0: 104 };     // flat green garden panel, down to the pavement
  const POOL = { x0: 166, x1: 222, y0: 117, y1: 129 };
  const PAV = 284;                                // pavilion centre line (dome, finial, nightingale)
  const STAIR_X = 204, STAIR_Y = PLOT.y0;         // the ink staircase climbs up-left from the garden's top edge
  const LION_X0 = 150, LION_X1 = 208, LION_Y = FLOOR - 15;
  let PB = null, L = null;

  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip, map) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        let c = row[flip ? w - 1 - i : i];
        if (c === ".") continue;
        if (map && map[c]) c = map[c];
        r.set(x + i, y + j, c);
      }
    }
  }

  // ---- sprites (palette codes; "." = transparent) ----
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
  const CRATE = (() => {                          // wooden box: lit top/left, darker bottom/right, diagonal brace
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
  // nested box = a picture in a picture: lapis frame, gold rule, pomegranate frame, and a smaller box inside
  const NEST = [
    "zzzzzzzzzzzzzzzz", "zqqqqqqqqqqqqqqz", "zqddddddddddddqz", "zqdzzzzzzzzzzdqz",
    "zqdzhhhhhhhhzdqz", "zqdzhzzzzzzhzdqz", "zqdzhzqqqqzhzdqz", "zqdzhzqddqzhzdqz",
    "zqdzhzqddqzhzdqz", "zqdzhzqqqqzhzdqz", "zqdzhzzzzzzhzdqz", "zqdzhhhhhhhhzdqz",
    "zqdzzzzzzzzzzdqz", "zqddddddddddddqz", "zqqqqqqqqqqqqqqz", "zzzzzzzzzzzzzzzz",
  ];
  const BIRD = [                                  // nightingale facing left: perched, singing (beak open), tail flick
    ["...zzz......", "..zfffz.....", ".zfzfffz....", "zzffffffzz..", "..zcffffffzz", "..zccfffaaaz", "...zcccfzzz.", "....zzzz....", ".....z.z...."],
    ["..zzz.......", "zzfffz......", ".zzfffz.....", "zzcfffffzz..", "..zcffffffzz", "..zccfffaaaz", "...zcccfzzz.", "....zzzz....", ".....z.z...."],
    ["...zzz......", "..zfffz.....", ".zfzfffz..zz", "zzffffffzzaz", "..zcffffffaz", "..zccfffffz.", "...zcccfzz..", "....zzzz....", ".....z.z...."],
  ];
  // the painted lion: flat, in profile, facing right; four walking frames (near / far legs swing in turn)
  function lionFrame(f) {
    const g = Array.from({ length: 15 }, () => Array(28).fill("."));
    const put = (x, y, c) => { if (y >= 0 && y < 15 && x >= 0 && x < 28) g[y][x] = c; };
    const seg = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) put(x, y, c); };
    const blob = (rows, fill) => {                // rows: [y, x0, x1]; ink on the rim, flat fill inside
      for (const [y, a, b] of rows) {
        const up = rows.find((m) => m[0] === y - 1), dn = rows.find((m) => m[0] === y + 1);
        for (let x = a; x <= b; x++) {
          const rim = x === a || x === b || !up || !dn || x < up[1] || x > up[2] || x < dn[1] || x > dn[2];
          put(x, y, rim ? "z" : fill);
        }
      }
    };
    seg(4, 6, 14, "z"); seg(5, 4, 5, "z"); seg(5, 6, 14, "d");
    for (const y of [6, 7, 8]) { put(3, y, "z"); seg(y, 4, 14, "d"); }
    put(4, 9, "z"); seg(9, 5, 15, "d"); seg(10, 5, 15, "z");
    put(2, 6, "z"); put(1, 5, "z"); put(1, 4, "z");                       // tail
    seg(0, 2, 3, "z"); put(1, 1, "z"); seg(1, 2, 3, "b"); put(4, 1, "z");  // tuft
    put(1, 2, "z"); seg(2, 2, 3, "b"); put(4, 2, "z"); seg(3, 2, 3, "z");
    const near = [1, 0, -1, 0][f], far = -near;
    for (const [lx, c, o] of [[5, "e", far], [8, "d", near], [14, "e", far], [17, "d", near]]) {
      for (let y = 10; y <= 13; y++) { const s = y >= 12 ? o : 0; put(lx + s, y, "z"); put(lx + 1 + s, y, c); put(lx + 2 + s, y, "z"); }
      seg(14, lx + o, lx + 3 + o, "z");
    }
    blob([[0, 18, 22], [1, 16, 24], [2, 15, 25], [3, 14, 26], [4, 14, 26], [5, 14, 26], [6, 14, 26], [7, 14, 26],
      [8, 14, 26], [9, 15, 25], [10, 16, 24], [11, 18, 22]], "b");
    for (const [x, y] of [[17, 2], [20, 1], [16, 5], [18, 4], [16, 8], [18, 7], [19, 10], [21, 9], [22, 2]]) if (g[y][x] === "b") g[y][x] = "e";
    blob([[3, 21, 24], [4, 20, 25], [5, 20, 26], [6, 20, 27], [7, 20, 27], [8, 21, 25], [9, 22, 24]], "d");
    put(23, 5, "z"); seg(7, 24, 26, "z"); put(27, 7, "."); put(26, 8, "."); put(27, 6, "z");
    return g.map((r) => r.join(""));
  }

  // ---- static layers ----
  function buildSky() {                           // flat gold leaf with a faint punched-dot pattern
    const r = layer();
    r.rect(0, 0, W, H, "F");
    for (let y = M; y < FLOOR; y++) for (let x = M; x < W - M; x++) {
      if ((x % 12 === 0 && y % 12 === 0) || (x % 12 === 6 && y % 12 === 6)) r.set(x, y, "e");
    }
    return r;
  }

  // Flat mountains, far (top) to near (bottom): each layer is a row of round bumps filled straight down,
  // ink on the top edge and a broken contour inside. Nearer layers cover the feet of the farther ones.
  const MOUNTAINS = [
    { c: "w", k: "x", b: [[18, 54, 8], [33, 46, 12], [52, 37, 10], [66, 43, 8], [80, 48, 10], [94, 55, 6]] },
    { c: "C", k: "B", b: [[10, 68, 7], [24, 61, 11], [44, 66, 8], [60, 57, 12], [80, 64, 9], [98, 60, 10], [116, 66, 7], [126, 70, 5]] },
    { c: "B", k: "g", b: [[12, 84, 9], [30, 78, 11], [50, 85, 8], [68, 77, 12], [90, 84, 9], [110, 79, 11], [132, 85, 8], [150, 82, 9], [164, 90, 6]] },
    { c: "x", k: "y", b: [[10, 101, 7], [28, 96, 11], [50, 102, 8], [70, 97, 10], [92, 103, 7], [110, 98, 11], [134, 102, 8], [154, 97, 10], [176, 101, 9], [194, 105, 6]] },
  ];
  function drawMountains(r) {
    for (const m of MOUNTAINS) {
      const x1 = Math.max(...m.b.map((b) => b[0] + b[2])), top = [];
      for (let x = M; x <= x1; x++) {             // union of round bumps; between bumps the valleys slope down, never gap
        let t = FLOOR;
        for (const [cx, cy, rad] of m.b) {
          const dx = Math.abs(x - cx);
          t = Math.min(t, Math.round(dx <= rad ? cy - Math.sqrt(rad * rad - dx * dx) : cy + (dx - rad) * 3));
        }
        top[x] = t;
      }
      for (let x = M; x <= x1; x++) {
        const t = top[x], l = x > M ? top[x - 1] : t, rr = x < x1 ? top[x + 1] : FLOOR;
        r.rect(x, t, 1, FLOOR - t, m.c);
        for (let y = t; y < Math.min(FLOOR, Math.max(l, rr, t + 1)); y++) r.set(x, y, m.k);   // ink rim, closed where it steps
      }
      for (const [cx, cy, rad] of m.b) if (hash(cx, cy, 5) % 3 === 0) {                        // a few flat shrubs on the ridges
        const y = top[cx];
        r.rect(cx - 1, y - 2, 3, 2, "o"); r.set(cx, y - 3, "o"); r.set(cx, y, "p");
      }
    }
  }
  function drawCypress(r, cx, y0, y1) {           // flame-shaped cypress, flat green with chevrons and an ink rim
    const n = y1 - y0;
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / n, hw = Math.round(4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.62 + 0.04)), 0.7));
      for (let x = cx - hw; x <= cx + hw; x++) {
        const rim = x === cx - hw || x === cx + hw || y === y0;
        r.set(x, y, rim ? "p" : ((y - Math.abs(x - cx)) % 5 === 0 ? "n" : "o"));
      }
    }
    r.rect(cx, y1 + 1, 1, PLOT.y0 + 4 - y1, "f");
  }
  function drawGarden(r) {
    const { x0, x1, y0 } = PLOT;
    r.rect(x0, y0, x1 - x0 + 1, FLOOR - y0, "o");
    r.hline(x0, y0, x1 - x0 + 1, "p"); r.vline(x0, y0, FLOOR - y0, "p"); r.vline(x1, y0, FLOOR - y0, "p");
    for (let i = 0; i < 14; i++) {                // sparse grass tufts
      const x = x0 + 4 + (hash(i, 1, 9) % (x1 - x0 - 8)), y = POOL.y1 + 4 + (hash(i, 2, 9) % (FLOOR - POOL.y1 - 6));
      r.set(x - 1, y, "n"); r.set(x + 1, y, "n"); r.set(x, y + 1, "n");
    }
    const P = POOL;                                // the pool, drawn flat as if seen from above
    r.rect(P.x0 - 2, P.y0 - 2, P.x1 - P.x0 + 5, P.y1 - P.y0 + 5, "e");
    r.rect(P.x0 - 1, P.y0 - 1, P.x1 - P.x0 + 3, P.y1 - P.y0 + 3, "F");
    r.rect(P.x0, P.y0, P.x1 - P.x0 + 1, P.y1 - P.y0 + 1, "q");
    for (const [x, y] of [[P.x0 - 1, P.y0 - 1], [P.x1 + 1, P.y0 - 1], [P.x0 - 1, P.y1 + 1], [P.x1 + 1, P.y1 + 1]]) r.set(x, y, "e");
  }
  function drawPavilion(r) {
    const c = PAV;
    r.rect(c - 21, 95, 43, 5, "F"); r.hline(c - 21, 95, 43, "d"); r.hline(c - 21, 99, 43, "e");   // plinth
    for (let x = c - 18; x <= c + 18; x += 6) r.rect(x, 97, 2, 1, "q");
    r.rect(c - 21, 66, 43, 29, "F");                                                              // facade
    for (const ax of [c - 9, c + 9]) {                                                            // two pointed arches
      const rise = [0, 1, 2, 3, 4, 5, 7, 9];
      for (let dx = -7; dx <= 7; dx++) {
        const t = 70 + rise[Math.abs(dx)];
        r.rect(ax + dx, t, 1, 95 - t, "y");
        r.set(ax + dx, t - 1, "e");
      }
    }
    for (const x of [c - 19, c - 1, c + 17]) {                                                    // pomegranate-red columns
      r.rect(x, 70, 3, 25, "h"); r.rect(x - 1, 68, 5, 2, "d"); r.rect(x - 1, 93, 5, 2, "d");
    }
    r.rect(c - 22, 60, 45, 6, "q"); r.hline(c - 22, 60, 45, "d"); r.hline(c - 22, 65, 45, "e");   // tiled frieze
    for (let x = c - 20; x <= c + 20; x += 4) { r.set(x, 62, "d"); r.set(x + 1, 63, "d"); r.set(x, 63, "r"); }
    r.rect(c - 24, 58, 49, 2, "e"); r.hline(c - 24, 58, 49, "d");                                 // eave
    r.rect(c - 12, 55, 25, 3, "F"); r.hline(c - 12, 57, 25, "e");                                 // drum
    const HW = [1, 1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 15, 15, 15, 14, 13];               // onion dome, y 36–54
    for (let i = 0; i < HW.length; i++) {
      const y = 36 + i, hw = HW[i];
      for (let x = c - hw; x <= c + hw; x++) {
        const rim = x === c - hw || x === c + hw || i === 0 || Math.abs(x - c) > HW[i - 1] || (i + 1 < HW.length && Math.abs(x - c) > HW[i + 1]);
        const lat = ((x - c + y) % 6 === 0) || ((x - c - y) % 6 === 0);
        r.set(x, y, rim ? "y" : lat ? "r" : "q");
      }
    }
    r.vline(c, 28, 8, "d"); r.rect(c - 1, 31, 3, 3, "d"); r.set(c, 32, "e");                      // gold finial
  }
  function drawTerrace(r) {                       // raised garden terrace under the pavilion (terrain: lit top, no ink rim)
    const x0 = PLAT_X, w = W - M - x0;
    r.rect(x0, PLAT_Y, w, FLOOR - PLAT_Y, "d");
    r.hline(x0, PLAT_Y, w, "c");
    r.rect(x0, PLAT_Y + 4, w, 8, "q");                                                            // lapis tile frieze
    r.hline(x0, PLAT_Y + 4, w, "F"); r.hline(x0, PLAT_Y + 11, w, "F");
    for (let x = x0 + 4; x < x0 + w - 2; x += 8) {
      for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]]) r.set(x + dx, PLAT_Y + 8 + dy, "d");
      r.set(x, PLAT_Y + 8, "h");
    }
    for (let y = PLAT_Y + 12; y < FLOOR; y++) for (let x = x0; x < x0 + w; x++) {                 // dressed stone courses
      const row = (y - PLAT_Y - 12) >> 3, yy = (y - PLAT_Y - 12) & 7;
      if (yy === 7 || (x - x0 + (row & 1) * 8) % 16 === 0) r.set(x, y, "F");
    }
    r.vline(x0, PLAT_Y + 1, FLOOR - PLAT_Y - 1, "F");
  }
  function drawPavement(r) {                      // the garden pavement (terrain): lit top edge, lozenge tiles, darker bottom
    r.rect(M, FLOOR, W - 2 * M, H - M - FLOOR, "d");
    for (let y = FLOOR + 1; y < H - M - 1; y++) for (let x = M; x < W - M; x++) {
      const v = y - FLOOR - 1;
      if ((x + 2 * v) % 16 === 0 || ((x - 2 * v) % 16 + 16) % 16 === 0) r.set(x, y, "F");
    }
    r.hline(M, FLOOR, W - 2 * M, "c");
    r.hline(M, H - M - 1, W - 2 * M, "e");
  }
  function drawLadder(r) {
    const x = LAD_X, top = PLAT_Y - 4;
    for (const rx of [x + 1, x + 12]) { r.rect(rx, top, 3, FLOOR - top, "e"); r.vline(rx, top, FLOOR - top, "z"); r.vline(rx + 2, top, FLOOR - top, "z"); r.hline(rx, top, 3, "z"); }
    for (let y = top + 6; y < FLOOR - 2; y += 7) { r.rect(x + 4, y, 8, 2, "d"); r.hline(x + 4, y + 2, 8, "z"); r.hline(x + 4, y - 1, 8, "z"); }
  }
  function buildBorder() {                        // ornamental page border: ink, lapis band with little rosettes, gold rule, ink rule
    const r = layer();
    const band = (x, y, along, across) => {       // across = 0…5 from the outside in
      const c = across === 0 ? "z" : across <= 3 ? "q" : across === 4 ? "d" : "z";
      r.set(x, y, c);
      if (across >= 1 && across <= 3) {
        const p = ((along % 10) + 10) % 10;
        if (p === 5 && across === 2) r.set(x, y, "d");
        else if ((p === 4 || p === 6) && across === 2) r.set(x, y, "h");
        else if (p === 5) r.set(x, y, "h");
        else if (p === 0 && across === 2) r.set(x, y, "F");
      }
    };
    for (let x = 0; x < W; x++) for (let a = 0; a < M; a++) { band(x, a, x, a); band(x, H - 1 - a, x, a); }
    for (let y = M; y < H - M; y++) for (let a = 0; a < M; a++) { band(a, y, y, a); band(W - 1 - a, y, y, a); }
    for (const [cx, cy] of [[0, 0], [W - M, 0], [0, H - M], [W - M, H - M]]) {                   // corner rosettes
      r.rect(cx, cy, M, M, "z"); r.rect(cx + 1, cy + 1, M - 2, M - 2, "h"); r.rect(cx + 2, cy + 2, 2, 2, "d");
    }
    return r;
  }

  // ---- the ribbon clouds: a travelling wave along the band, the band turning over, curls spinning at the ends ----
  const RIBBONS = [
    { x0: 26, x1: 136, y: 41, a: 2.2, wl: 38, tl: 27, sp: 0.26 },     // tangled around the top of the mountains
    { x0: 120, x1: 232, y: 18, a: 2.6, wl: 34, tl: 24, sp: -0.22 },   // high in the gold sky
    { x0: 206, x1: 300, y: 47, a: 2.0, wl: 30, tl: 22, sp: 0.25 },     // wrapped behind the pavilion dome
  ];
  let RB = null;
  function drawRibbon(r, R, f) {
    const ph = f * R.sp, touched = [], ink = [];
    const mark = (x, y, v) => {
      if (x < M || y < M || x >= W - M || y >= FLOOR) return;
      const i = y * W + x;
      if (!RB[i]) touched.push(i);
      if (RB[i] !== 3) RB[i] = v;
    };
    const yAt = (x) => R.y + R.a * Math.sin(((x - R.x0) / R.wl) * 2 * Math.PI - ph);
    for (let x = R.x0; x <= R.x1; x++) {
      const s = Math.sin(((x - R.x0) / R.tl) * 2 * Math.PI - ph * 0.8), ht = 0.5 + 1.7 * Math.abs(s), yc = yAt(x);
      for (let y = Math.round(yc - ht); y <= Math.round(yc + ht); y++) mark(x, y, s >= 0 ? 1 : 2);
    }
    for (const end of [0, 1]) {                   // the ends roll up into curls (one up, one down), spinning slowly
      const x = end ? R.x1 : R.x0, sg = end ? 1 : -1, cx = x + 3 * sg, cy = Math.round(yAt(x)) - 4 * sg, rot = f * 0.3 * sg;
      for (let y = cy - 5; y <= cy + 5; y++) for (let xx = cx - 5; xx <= cx + 5; xx++) {
        if ((xx - cx) * (xx - cx) + (y - cy) * (y - cy) <= 21) mark(xx, y, 3);
      }
      for (let t = 0; t <= 1; t += 0.03) {
        const th = rot + t * 2.3 * Math.PI, rr = 0.6 + 3.1 * t;
        ink.push([Math.round(cx + rr * Math.cos(th)), Math.round(cy + rr * Math.sin(th))]);
      }
    }
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && RB[y * W + x] > 0;
    for (const i of touched) {
      const x = i % W, y = (i / W) | 0, v = RB[i];
      const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      r.set(x, y, rim ? "f" : v === 2 ? "w" : "v");
    }
    for (const [x, y] of ink) if (inside(x, y)) r.set(x, y, "f");
    for (const i of touched) RB[i] = 0;
  }

  // ---- the ink staircase: one stroke after another, each finished step painted flat ----
  const STAIR = (() => {
    const path = [], fills = [];
    for (let i = 0; i < 5; i++) {
      const xr = STAIR_X - i * 10 - 1, ty = STAIR_Y - (i + 1) * 8, xl = STAIR_X - (i + 1) * 10;
      for (let y = STAIR_Y - i * 8 - 1; y >= ty; y--) path.push([xr, y]);          // riser
      for (let x = xr - 1; x >= xl; x--) path.push([x, ty]);                        // tread
      fills.push({ at: path.length, x: xl, y: ty + 1, w: xr - xl + 1, h: STAIR_Y - ty - 1 });
    }
    for (let y = STAIR_Y - 40; y < STAIR_Y; y++) path.push([STAIR_X - 51, y]);     // last stroke: the left side
    return { path, fills };
  })();
  function drawStair(r, a) {
    const t = a % 64, n = Math.min(STAIR.path.length, t * 4);
    if (t >= 56) return;                          // the page rests blank for a moment, then the brush starts again
    for (const s of STAIR.fills) if (n >= s.at + 2) r.rect(s.x, s.y, s.w, s.h, "e");
    for (let i = 0; i < n; i++) r.set(STAIR.path[i][0], STAIR.path[i][1], "z");
    if (n > 0 && n < STAIR.path.length) { const [x, y] = STAIR.path[n - 1]; r.rect(x - 1, y - 1, 2, 2, "z"); }   // the brush tip
  }

  // ---- flowers: ink outlines first, then coloured in one after another ----
  const FLOWERS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: 152 + i * 10, y: 109, c: "hDCrhjDhC"[i] }));
  function drawFlowers(r, a) {
    const t = a % 72;
    FLOWERS.forEach((fl, i) => {
      const on = t >= 6 + i * 5 && t < 66, { x, y } = fl;
      r.vline(x, y + 3, 4, "n"); r.set(x - 1, y + 4, "n"); r.set(x + 1, y + 5, "n");
      for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]]) r.set(x + dx, y + dy, "z");
      if (on) { r.set(x, y - 1, fl.c); r.set(x - 1, y, fl.c); r.set(x + 1, y, fl.c); r.set(x, y + 1, fl.c); r.set(x, y, "d"); }
    });
  }
  function drawPoolWaves(r, a) {                  // silver-blue wave lines drifting across the flat pool
    const P = POOL;
    for (let row = 0; row < 3; row++) {
      const y = P.y0 + 2 + row * 4;
      for (let x = P.x0 + 1; x < P.x1; x++) {
        const p = (x + a * (row & 1 ? -1 : 1) + row * 3 + 600) % 6;
        if (p < 4) r.set(x, y + (p === 1 || p === 2 ? 0 : 1), "r");
      }
    }
  }

  function drawFloatBlock(r, a) {                 // glazed lapis slab hovering, a crate riding on it
    const bob = [0, 0, 1, 1][(a >> 2) & 3], x0 = FB_X, y0 = FB_Y + bob;
    r.rect(x0, y0, FB_W, 16, "q");
    r.hline(x0, y0, FB_W, "z"); r.hline(x0, y0 + 15, FB_W, "z"); r.vline(x0, y0, 16, "z"); r.vline(x0 + FB_W - 1, y0, 16, "z");
    r.hline(x0 + 1, y0 + 1, FB_W - 2, "r"); r.hline(x0 + 1, y0 + 14, FB_W - 2, "y");
    for (let k = 0; k < 3; k++) {
      const cx = x0 + 8 + k * 16, cy = y0 + 8;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d === 4) r.set(cx + dx, cy + dy, "d"); else if (d <= 1) r.set(cx + dx, cy + dy, "h");
      }
    }
    spr(r, CRATE, x0 + 16, y0 - 16);
  }
  function drawLion(r, tick) {
    const span = LION_X1 - LION_X0, p = tick % (2 * span), right = p < span;
    const x = right ? LION_X0 + p : LION_X1 - (p - span);
    spr(r, L.lion[tick & 3], x, LION_Y, !right);
  }
  function drawBird(r, tick) {
    const t = tick % 16, f = t >= 4 && t < 10 ? (t & 1 ? 1 : 0) : t === 12 || t === 13 ? 2 : 0;
    spr(r, BIRD[f], PAV - 6, 19);
  }

  function build() {
    PB = window.PB;
    RB = new Uint8Array(W * H);
    const sky = buildSky();
    const mid = layer();
    drawMountains(mid);
    drawCypress(mid, 140, 74, 108);
    drawGarden(mid);
    drawPavilion(mid);
    drawTerrace(mid);
    drawPavement(mid);
    const props = layer();
    drawLadder(props);
    spr(props, NEST, NEST_X, FLOOR - 16);
    spr(props, PORTER, 2 * 16 + 8, FLOOR - 16);
    L = { sky, mid, props, border: buildBorder(), lion: [0, 1, 2, 3].map(lionFrame) };
  }

  window.PB_CONCEPT_SCENES["miniature"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.sky.data);
      for (const R of RIBBONS) drawRibbon(r, R, a);
      r.blit(L.mid, 0, 0);
      drawStair(r, a);
      drawFlowers(r, a);
      drawPoolWaves(r, a);
      r.blit(L.props, 0, 0);
      drawFloatBlock(r, a);
      drawLion(r, tick);
      drawBird(r, tick);
      r.blit(L.border, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
