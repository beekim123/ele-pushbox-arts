/* ART-04l 地图概念场景：萤火虫洞（glowworm_cave）。只看大致效果，不是正式资产，不进游戏。
 * 一屏 320×180 的侧视房间：墨黑岩洞，洞顶挂满冷青蓝的萤光垂丝（随气流摆、一片一片明暗交替），
 * 地下河乌黑的水面倒映星点、缓缓流、倒影碎开；船头一盏暖白小灯，灯照到的踏石才看得见（lantern_reveal），
 * 亚麻编织小划艇系在岸边随水流漂摆（drift）。怪物：洞穴蛐蛐（一蹦一停）；提示动物：几维鸟（在岸边泥里啄）。
 * 环境 4 fps（tick>>1），动物 8 fps（tick 每秒加 8）。只用 ENDESGA 32 调色板，整数像素，不抗锯齿。
 * 只读调用 workbench/js/core/raster.js 里的 PB.Raster / PB.h32 / PB.DIM。 */
(function (root) {
  "use strict";
  const W = 320, H = 180;
  const WY = 146;                                   // 河面
  const LEDGE_Y = 128, BANK_Y = 140, SHELF_Y = 88, RIGHT_Y = 112, COL_X = 232;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB, h32, DIM;

  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function noise1(x, seed, step, amp) {
    const k = Math.floor(x / step), f = x - k * step;
    const a = h32(k, 0, seed) % (amp + 1), b = h32(k + 1, 0, seed) % (amp + 1);
    return a + Math.floor(((b - a) * f) / step);
  }
  function noise2(x, y, seed, step) {
    const kx = Math.floor(x / step), ky = Math.floor(y / step), fx = x - kx * step, fy = y - ky * step;
    const v = (i, j) => h32(kx + i, ky + j, seed) & 255;
    const top = v(0, 0) + Math.floor(((v(1, 0) - v(0, 0)) * fx) / step);
    const bot = v(0, 1) + Math.floor(((v(1, 1) - v(0, 1)) * fx) / step);
    return top + Math.floor(((bot - top) * fy) / step);
  }
  // 小精灵：字符串行，"." 透明；flip 左右镜像；(x, y) 为左上角
  function spr(r, rows, x, y, flip) { r.blitRows(rows, x, y, !!flip); }

  // ---------- 地形形状 ----------
  const solid = new Uint8Array(W * H);              // 0 空 1 岩 2 泥
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : solid[y * W + x]);
  const ceilY = new Int16Array(W);                  // 洞顶（含钟乳石）下沿的第一个空格
  const STALACTITES = [[26, 8, 24], [70, 5, 12], [118, 9, 30], [146, 4, 10], [244, 8, 26], [282, 5, 15], [306, 7, 21]];
  const STALAGMITES = [[276, 7, 12], [292, 10, 24], [311, 6, 15]];
  function cone(cx, y0, w, l, dir) {
    for (let d = 0; d < l; d++) {
      const hw = Math.floor((w * (l - d)) / (2 * l));
      const y = y0 + dir * d;
      for (let x = cx - hw; x <= cx + hw; x++) if (x >= 0 && x < W && y >= 0 && y < H) solid[y * W + x] = 1;
    }
  }
  function shapes() {
    for (let x = 0; x < W; x++) {
      const b = 9 + noise1(x, 3, 24, 10) + noise1(x, 4, 8, 3);
      for (let y = 0; y <= b; y++) solid[y * W + x] = 1;
    }
    for (const [x, w, l] of STALACTITES) { let y0 = 0; while (solid[(y0 + 1) * W + x]) y0++; cone(x, y0, w, l, 1); }
    // 钟乳石和石笋连成的石柱：洞顶 → 中间石台
    for (let y = 0; y < SHELF_Y; y++) {
      const hw = 3 + Math.floor(Math.abs(y - 54) / 6);
      for (let x = COL_X - hw; x <= COL_X + hw; x++) solid[y * W + x] = 1;
    }
    for (let x = 166; x <= 238; x++) {                // 中间石台
      const bot = SHELF_Y + 7 + noise1(x, 7, 8, 3) - (x < 170 ? 170 - x : 0) - (x > 234 ? x - 234 : 0);
      for (let y = SHELF_Y; y <= bot; y++) solid[y * W + x] = 1;
    }
    cone(180, SHELF_Y + 9, 4, 7, 1); cone(227, SHELF_Y + 9, 3, 5, 1);
    for (let x = 0; x < 96; x++) for (let y = LEDGE_Y; y < H; y++) solid[y * W + x] = 1;          // 左岸
    for (let x = 96; x < 127; x++) {                                                              // 泥岸和斜坡
      const top = x < 120 ? BANK_Y : BANK_Y + (x - 120);
      for (let y = top; y < H; y++) solid[y * W + x] = y < top + 3 ? 2 : 1;
    }
    for (let x = 262; x < W; x++) {                                                               // 右岸
      const top = RIGHT_Y + Math.max(0, 266 - x);
      for (let y = top; y < H; y++) solid[y * W + x] = 1;
    }
    for (const [x, w, l] of STALAGMITES) cone(x, RIGHT_Y - 1, w, l, -1);
    for (let x = 0; x < W; x++) { let y = 0; while (y < H && solid[y * W + x]) y++; ceilY[x] = y; }
  }

  // ---------- 静态层：背景、地形 ----------
  let BG = null, TER = null;
  const FAR = [], THREADS = [], DOTS = [], REFL = [];
  function paintBg(r) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = noise2(x, y, 9, 22) + (noise2(x, y, 10, 7) >> 2) - 30;
      const lim = 188 + (y > 120 ? (y - 120) >> 1 : 0);
      r.set(x, y, n > lim || (n > lim - 18 && bayer(x, y) < ((n - lim + 18) * 16) / 18) ? "y" : "z");
    }
    for (const [cx, w, neck] of [[44, 3, 70], [158, 2, 60], [292, 3, 66]]) {    // 远处石柱剪影
      for (let y = 0; y < H; y++) {
        const hw = w + Math.floor(Math.abs(y - neck) / 10);
        for (let x = cx - hw; x <= cx + hw; x++) r.set(x, y, x === cx + hw || (x === cx - hw + 2 && (y & 3) === 0) ? "z" : "y");
      }
    }
  }
  function paintTerrain(r) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = solid[y * W + x]; if (!v) continue;
      const hh = h32(x, y, 77);
      let c;
      if (v === 2) c = !at(x, y - 1) ? "f" : hh % 5 === 0 ? "f" : hh % 7 === 0 ? "z" : "g";
      else if (!at(x, y - 1)) c = "w";
      else if (!at(x, y - 2)) c = "x";
      else if (!at(x, y + 1)) c = "z";
      else if (!at(x - 1, y)) c = "x";
      else if (!at(x + 1, y) || !at(x + 2, y)) c = "z";
      else if (hh % 11 === 0) c = "x";
      else if (hh % 13 === 0 || ((y + noise1(x, 12, 12, 5)) % 9 === 0 && hh % 3)) c = "z";
      else c = "y";
      if (y > WY && x >= 118) c = DIM[c];            // 水下的岸更暗
      r.set(x, y, c);
    }
    // 系船桩
    for (let y = 131; y < BANK_Y; y++) { r.set(116, y, "e"); r.set(117, y, "f"); r.set(118, y, "g"); }
    r.set(116, 130, "f"); r.set(117, 130, "e"); r.set(118, 130, "f");
  }
  function seeds() {
    for (let i = 0; i < 96; i++) {                    // 远处洞顶的星点
      const h = h32(i, 5, 301), t = (h >>> 9) % 60;
      FAR.push({ x: h % W, y: 14 + ((t * t) / 60 | 0), h });
    }
    for (let x = 1; x < W - 1; x++) {                 // 萤火虫垂下的发光丝
      const h = h32(x, 6, 302);
      if (h % 5 > 1 || Math.abs(x - COL_X) < 11) continue;
      let L = 4 + ((h >>> 8) % 40);
      if (x >= 160 && x <= 244) L = Math.min(L, SHELF_Y - ceilY[x] - 6);
      if (x >= 266) L = Math.min(L, 60 - ceilY[x]);
      if (L >= 3) THREADS.push({ x, y: ceilY[x], L, h });
    }
    for (let x = 0; x < W; x++) {                     // 洞顶上的萤光点
      const h = h32(x, 7, 303);
      if (h % 3 === 0 && ceilY[x] > 2) DOTS.push({ x, y: ceilY[x] - 1 - ((h >>> 8) % 3), h });
      if (h % 7 === 0) DOTS.push({ x, y: 1 + ((h >>> 12) % Math.max(1, ceilY[x] - 4)), h: h >>> 3 });
    }
    for (let y = SHELF_Y + 6; y < SHELF_Y + 14; y++) for (let x = 168; x < 238; x++) {   // 石台底下也有
      if (solid[y * W + x] && !at(x, y + 1) && h32(x, y, 308) % 4 === 0) DOTS.push({ x, y, h: h32(x, y, 309) });
    }
    for (let i = 0; i < 80; i++) {                    // 水里的倒影
      const h = h32(i, 9, 307), d = (h >>> 9) % 30;
      REFL.push({ i, x: 124 + (h % (W - 124)), y: WY + 3 + ((d * d) / 30 | 0), len: 1 + ((h >>> 14) % 3), h });
    }
  }
  function build() {
    PB = root.PB; h32 = PB.h32; DIM = PB.DIM;
    shapes(); seeds();
    BG = new PB.Raster(W, H); paintBg(BG);
    TER = new PB.Raster(W, H); paintTerrain(TER);
  }
  // ---------- 精灵（16×16 人影、箱子、动物） ----------
  const PERSON = [
    "................",
    "......zzzz......",
    ".....zkllkz.....",
    ".....zkkkkz.....",
    "...zzkkkkkkzz...",
    "...zkkkkkkkkkz..",
    "....zEEEEEFz....",
    "....zEEEzEFz....",
    "....zFEEEFFz....",
    "...zhiiiiiihz...",
    "..zhiiiiiiiihz..",
    "..zhiiiiiiiihz..",
    "..zEhiiiiiihEz..",
    "...zhhhhhhhhz...",
    "....zxxzzxxz....",
    "....zffzzffz....",
  ];
  function crate(r, x, y) {
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      let c;
      if (i === 0 || j === 0 || i === 15 || j === 15) c = "z";
      else if (j === 1 || i === 1) c = "d";
      else if (j === 14 || i === 14) c = "f";
      else if (j === 2 || i === 2 || j === 13 || i === 13) c = "e";
      else if (i + j === 15 || i + j === 16) c = "d";
      else if (i + j === 17) c = "f";
      else c = j === 6 || j === 10 ? "e" : "b";
      r.set(x + i, y + j, c);
    }
  }
  // 洞穴蛐蛐（怪物，面朝右，22×14，底行是脚）：坐 / 坐·触角抖 / 蹲 / 跳
  const WETA_LEGS = [
    ".f...g.....fg..f......",
    ".f...g....f.g...f.....",
    "ff..g.....f..g..ff....",
  ];
  const WETA_TOP = [
    "......fffff...........",
    "....ff.....ff.........",
    ".............f........",
    "....F.........f.....ff",
    "...fa..........f...f..",
    "...f..a.........f.f...",
    "...f..aa.aFFFFa.ff....",
    "..f....aaaaaaaaaa.....",
    "..f.F.aafafafaaaaz....",
    "..f...aafafafaaaaa....",
    "..f....ffffffffff.....",
  ];
  const WETA = [
    WETA_TOP.concat(WETA_LEGS),
    ["......................", "......fffff...........", "....ff.....ff........."].concat(WETA_TOP.slice(2), WETA_LEGS.slice(1)).slice(0, 14),
    ["......................"].concat(WETA_TOP, WETA_LEGS.slice(1)),
    [
      "......................",
      "......fffff...........",
      "....ff.....ff.........",
      "............ff.....ff.",
      "..............f..ff...",
      ".........aFFFFa.ff....",
      ".......aaaaaaaaaa.....",
      "......aafafafaaaaz....",
      ".....aaafafafaaaaa....",
      "...aaa.ffffffffff.....",
      ".aa..............ff...",
      "ff...............f....",
      "......................",
      "......................",
    ],
  ];
  // 几维鸟（提示动物，面朝右）：站 / 低头 / 喙插进泥里
  const KIWI = [[
    "................",
    ".....ffff.......",
    "...ffFFFFff.....",
    "..fFFeFFFFFf....",
    ".fFeFFeFFFFzf...",
    ".feFeeFeFFFFfd..",
    "feeeeFeeeeFFf.d.",
    ".feeFeeeeeef...d",
    "..ffeeeeeff.....",
    "....v...v.......",
  ], [
    "................",
    "................",
    "....fffff.......",
    "..ffFFFFFff.....",
    ".fFFeFFFFFFf....",
    ".feFeeFFFFFFzf..",
    "feeeFeeeFFFFffd.",
    ".feeeeFeeeeef.d.",
    "..ffeeeeeeff..d.",
    "....v...v.....d.",
  ], [
    "................",
    "................",
    "....fffff.......",
    "..ffFFFFFff.....",
    ".fFFeFFFFFFf....",
    ".feFeeFFFFFFzf..",
    "feeeFeeeFFFFffd.",
    ".feeeeFeeeeef.d.",
    "..ffeeeeeeff..dg",
    "....v...v....f.f",
  ]];

  // ---------- 会动的部分 ----------
  // 萤光亮度 0..3：洞顶分成一片一片，每片自己的相位，明暗交替
  function level(x, e, h) {
    const zone = Math.floor((x + 9) / 40);
    const v = tri(e + (h32(zone, 3, 21) % 28), 28, 4);
    return clamp(((v + 4) >> 1) + ((h >>> 5) % 3) - 1, 0, 3);
  }
  function drawFar(r, e) {
    for (const d of FAR) {
      const lvl = level(d.x, e + 5, d.h);
      if (lvl >= 2 || (lvl === 1 && d.h & 1)) r.set(d.x, d.y, lvl === 3 && d.h % 3 === 0 ? "r" : "q");
    }
  }
  function drawThreads(r, e) {
    for (const t of THREADS) {
      const A = t.L > 18 ? 2 : 1, s = tri(e + (t.x >> 4) * 2, 24, A), lvl = level(t.x, e, t.h);
      for (let k = 0; k < t.L; k++) {
        const x = t.x + Math.trunc((s * k) / t.L), y = t.y + k;
        let c = null;
        if (k === t.L - 1) c = ["q", "r", "s", "s"][lvl];
        else if ((k + (t.h & 3)) % 4 === 0) c = ["y", "q", "q", "r"][lvl];
        else if (k & 1) c = "y";
        if (c) r.set(x, y, c);
        if (k === t.L - 1 && lvl === 3 && (t.h & 7) === 0) r.set(x, y, "t");
      }
    }
  }
  function drawDots(r, e) {
    for (const d of DOTS) {
      const lvl = level(d.x, e, d.h);
      r.set(d.x, d.y, lvl === 3 && d.h % 5 === 0 ? "t" : ["q", "r", "s", "s"][lvl]);
    }
  }
  // 暖白灯光只落在背景上（画地形之前），边缘 4×4 Bayer 抖动
  function lampPool(r, lx, ly) {
    for (let y = ly - 40; y <= ly + 40; y++) for (let x = lx - 40; x <= lx + 40; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.sqrt((x - lx) * (x - lx) + (y - ly) * (y - ly));
      let lv = 0;
      if (d <= 5 || (d < 9 && bayer(x, y) < ((9 - d) * 16) / 4)) lv = 2;
      else if (d <= 12 || (d < 40 && bayer(x, y) < ((40 - d) * 11) / 28)) lv = 1;
      if (!lv) continue;
      const c = r.get(x, y);
      if (lv === 2) r.set(x, y, c === "z" || c === "y" ? "f" : c);
      else r.set(x, y, c === "z" || c === "y" ? "g" : c);
    }
  }
  const inWater = (x, y) => x >= 0 && x < W && y >= WY && y < H && !solid[y * W + x];
  function drawWater(r, e, lx) {
    for (let y = WY; y < H; y++) for (let x = 118; x < W; x++) if (!solid[y * W + x]) r.set(x, y, y === WY ? "q" : y < WY + 3 ? "y" : "z");
    for (let i = 0; i < 7; i++) {                                         // 水面上随水流走的亮点
      const x = ((h32(i, 8, 304) % 380) + e) % 380 - 30;
      for (let k = 0; k < 2; k++) if (inWater(x + k, WY)) r.set(x + k, WY, "r");
    }
    for (let y = WY + 4; y < H; y += 3) for (let j = 0; j < 3; j++) {     // 缓缓的水流
      const hh = h32(y, j, 305), x0 = ((hh % 420) + (e >> 1)) % 420 - 40, len = 3 + ((hh >>> 10) % 7);
      for (let k = 0; k < len; k++) if (inWater(x0 + k, y)) r.set(x0 + k, y, "y");
    }
    for (const f of REFL) {                                               // 萤光的倒影，跟着波纹碎开
      const lvl = level(f.x, e, f.h); if (lvl < 1) continue;
      const dx = tri(e + f.y * 3, 10, 1) * (1 + ((f.y - WY) >> 4));
      const broken = (e + f.i) % 5 === 0;
      for (let k = 0; k < f.len; k++) {
        if (broken && k === 1) continue;
        if (inWater(f.x + dx + k, f.y)) r.set(f.x + dx + k, f.y, lvl === 3 ? "r" : "q");
      }
    }
    for (let k = 0; k < 7; k++) {                                         // 船灯的倒影
      if (k > 3 && (e + k) & 1) continue;
      const y = WY + 5 + k * 2, w = k < 2 ? 3 : k < 4 ? 2 : 1, x0 = lx - (w >> 1) + tri(e + k * 3, 8, 1);
      for (let i = 0; i < w; i++) if (inWater(x0 + i, y)) r.set(x0 + i, y, k < 2 ? "c" : k < 4 ? "F" : "e");
    }
  }
  // 灯照到的地方才看得见的踏石（lantern_reveal 的样子）
  const STONES = [[194, 13], [216, 12], [238, 13]];
  function drawStones(r, lx, ly) {
    for (const [sx, sw] of STONES) for (let y = WY - 4; y <= WY + 2; y++) for (let x = sx; x < sx + sw; x++) {
      if ((x === sx || x === sx + sw - 1) && (y === WY - 4 || y === WY + 2)) continue;
      const d = Math.sqrt((x - lx) * (x - lx) + (y - ly) * (y - ly));
      if (d > 58 || (d > 38 && bayer(x, y) >= ((58 - d) * 16) / 20)) continue;
      let c = y === WY - 4 ? "w" : y === WY - 3 ? "x" : x === sx + sw - 1 ? "z" : "y";
      if (y > WY) c = DIM[c];
      r.set(x, y, c);
    }
  }
  // 亚麻编织小划艇（船头朝右），bx 左端，by 船沿
  function drawBoat(r, bx, by) {
    for (let i = 0; i < 44; i++) {
      const top = by - (i < 4 ? 4 - i : 0) - (i > 39 ? i - 39 : 0);
      const bot = by + 7 - (i < 6 ? (6 - i) >> 1 : 0) - (i > 37 ? (i - 37) >> 1 : 0);
      for (let y = top; y <= bot; y++) {
        let c;
        if (y === top) c = "f";
        else if (y === bot) c = "g";
        else if (y === top + 1) c = i > 30 ? "d" : "F";
        else c = ((i + y) & 3) === 0 || ((i - y) & 3) === 0 ? "e" : "F";
        if (y > WY) c = DIM[c];
        r.set(bx + i, y, c);
      }
    }
    for (let y = by - 8; y < by; y++) r.set(bx + 38, y, "f");             // 灯杆
    spr(r, [".g.", "ggg", "ctc", "ctc", "ggg"], bx + 37, by - 13);
  }
  function drawRope(r, x0, y0, x1, y1, sag) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = x0 + Math.round(((x1 - x0) * k) / n), y = y0 + Math.round(((y1 - y0) * k) / n) + Math.floor((sag * 4 * k * (n - k)) / (n * n));
      r.set(x, y, "e");
    }
  }

  // ---------- 一帧 ----------
  let frame = null;
  function draw(ctx, tick) {
    if (!BG) build();
    const t = tick | 0, e = t >> 1;
    if (!frame) frame = new PB.Raster(W, H);
    const r = frame;
    r.data.set(BG.data);
    const bx = 134 + tri(e, 24, 2), by = WY - 4 + (tri(e + 6, 12, 1) > 0 ? 1 : 0);
    const lx = bx + 38, ly = by - 11;
    drawFar(r, e);
    lampPool(r, lx, ly);
    drawThreads(r, e);
    r.blit(TER, 0, 0);
    drawDots(r, e);
    drawWater(r, e, lx);
    drawStones(r, lx, ly);
    // 船里的箱子、船、缆绳
    crate(r, bx + 16, WY - 15 + (by - (WY - 4)));
    drawBoat(r, bx, by);
    drawRope(r, 117, 131, bx + 2, by - 2, 2);
    // 几维鸟：站一会儿，低头啄两下
    const kp = t % 28, kf = kp < 12 ? 0 : kp < 14 ? 1 : kp < 16 ? 2 : kp < 18 ? 1 : kp < 20 ? 2 : kp < 22 ? 1 : 0;
    spr(r, KIWI[kf], 95, BANK_Y - 10);
    // 洞穴蛐蛐：一蹦一停，四跳一回头
    const hop = Math.floor(t / 20) % 8, hp = t % 20, dir = hop < 4 ? 1 : -1, n = hop < 4 ? hop : hop - 4;
    let wx = dir > 0 ? 180 + n * 8 : 212 - n * 8, wy = 0, wf = hp < 12 ? ((hp >> 2) & 1) : 2;
    if (hp >= 14 && hp < 19) { wf = 3; wx += dir * [2, 3, 5, 6, 8][hp - 14]; wy = [-3, -5, -6, -5, -3][hp - 14]; }
    if (hp === 19) { wx += dir * 8; wf = 2; }
    spr(r, WETA[wf], wx - 11, SHELF_Y - 14 + wy, dir < 0);
    // 比例尺：主角大小的人影 + 箱子
    crate(r, 62, LEDGE_Y - 16);
    spr(r, PERSON, 40, LEDGE_Y - 16);
    ctx.putImageData(new ImageData(r.data, W, H), 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES["glowworm_cave"] = { draw };
})(typeof window !== "undefined" ? window : globalThis);
