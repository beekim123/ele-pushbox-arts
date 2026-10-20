/* 地图概念场景 · 爱琴迷宫（ART-04g）。只看大致效果：不是正式美术资产，也不是能玩的关卡。
 * 画面：正午强光，雪白的房子和钴蓝圆顶，深蓝的海；街面下面切开，是暖褐色石头砌的地下迷宫。
 * 地标：白墙蓝顶小教堂、橄榄树和上教堂的石阶、迷宫入口的米诺斯红柱（门楣上一对牛角）、美杜莎石像。
 * 环境（4 fps）：海面闪光；云影慢慢滑过白墙；橄榄叶摆动、翻出银白的叶背；迷宫入口一阵阵往外刮风。
 * 机关只画外观：美杜莎的目光（gaze，眼睛一阵阵发亮）；天井照下来的光被铜镜折向石像（laser_mirror）。
 * 动物（8 fps）：牛头怪（怪物）在楼梯底下低头刨地、喷鼻气，准备冲撞；小猫头鹰（提示动物）蹲在门洞上转头、眨眼。
 * 比例尺：主角 1 个 + 木箱 2 个（街上一个、迷宫里一个），不动。不画收件人、货物、界面和文字。
 * 接口见 docs/packages/ART-04g.md：PB_CONCEPT_SCENES.aegean.draw(ctx, tick)，ctx 是 320×180 画布，tick 每秒 +8。
 * 所有像素经 PB.Raster 写入（只收 ENDESGA 32 的调色板代码），整数像素、不抗锯齿。 */
(function () {
  "use strict";
  const scenes = (window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {});
  const W = 320, H = 180;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const mod = (a, n) => ((a % n) + n) % n;
  function tri(t, period, amp) {
    const p = mod(t, period), half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }

  // ---- 几何 ----
  const HZ = 48, ST = 112, FL = 168;          // 海平线 y 48；街面顶 y 112；迷宫地面顶 y 168
  const WELL = 124, BEAM_Y = 143;             // 天井光束 x 124；铜镜把它折成 y 143 的横光束
  const isHole = (x) => (x >= 26 && x <= 50) || (x >= 120 && x <= 128); // 入口下去的楼梯井、天井
  const hillTop = (x) => (x < 178 ? ST : Math.max(64, Math.round(ST - (x - 178) * 1.4)));

  let back = null, front = null, buf = null, img = null, MASK = null;
  const SPARKS = [];

  function sprite(r, id, x, y, flip) {        // 已确认的主角 / 木箱精灵（锚点底边中心），只当比例尺
    const S = window.PB.sprites;
    if (S && S.has(id)) { S.draw(r, id, id === "char.portitor" ? "idle" : "default", 0, x, y, !!flip); return; }
    if (id === "char.portitor") { r.rect(x - 4, y - 14, 8, 14, "z"); r.rect(x - 3, y - 13, 6, 4, "k"); r.rect(x - 3, y - 9, 6, 8, "i"); }
    else { r.rect(x - 8, y - 16, 16, 16, "z"); r.rect(x - 7, y - 15, 14, 14, "b"); }
  }
  const rows = (r, art, x, y, flip) => r.blitRows(art, x, y, flip);

  // ---- 背景：天空、海、小岛、山坡上的白房子、迷宫的墙 ----
  function drawSkySea(r) {
    for (let y = 0; y < ST; y++) for (let x = 0; x < W; x++) {
      let c = "q";
      if (y < HZ) c = y < 6 || (y < 18 && bay(x, y) >= ((y - 6) * 4) / 3) ? "q" : "r";
      else if (y < HZ + 2) c = bay(x, y) < 6 ? "r" : "q";
      r.set(x, y, c);
    }
    const h32 = window.PB.h32;
    for (let i = 0; i < 30; i++) {            // 海面的细浪：越近越长
      const h = h32(i, 5, 77), y = HZ + 3 + (h % (ST - HZ - 4)), len = 2 + ((h >>> 8) & 3) + ((y - HZ) >> 4);
      r.hline((h >>> 12) % W, y, len, "r");
    }
  }
  function drawIsland(r) {                    // 远处的小岛，山顶几点白房子
    for (let x = 78; x < 156; x++) {
      const top = HZ - 1 - Math.round(7 * Math.sin((Math.PI * (x - 78)) / 78) + 1.5 * Math.sin((x - 78) / 6));
      for (let y = top; y < HZ; y++) r.set(x, y, y === top ? "v" : "w");
      if (x > 108 && x < 122 && x % 3 === 0) r.set(x, top + 1, "u");
    }
  }
  function dome(r, cx, by, R) {               // 钴蓝圆顶，左上亮一块
    for (let dy = 1; dy <= R; dy++) {
      const half = Math.floor(Math.sqrt(R * R - (dy - 0.5) * (dy - 0.5)) + 0.5);
      for (let x = cx - half; x <= cx + half; x++) r.set(x, by - dy, (x - cx) * 3 < -half && dy > R / 3 && dy < R ? "r" : "q");
    }
  }
  function house(r, x0, y0, w, ht, h) {       // 一间白方盒子房：顶边亮、右侧背光，蓝门小窗
    for (let y = y0; y < y0 + ht; y++) for (let x = x0; x < x0 + w; x++) r.set(x, y, y === y0 ? "t" : x >= x0 + w - 3 ? "v" : "u");
    if ((h >>> 12) & 1) r.rect(x0 + 2 + ((h >>> 13) % Math.max(1, w - 8)), y0 + ht - 6, 3, 6, "q");
    r.rect(x0 + 2 + ((h >>> 16) % Math.max(1, w - 7)), y0 + 3, 2, 2, (h >>> 18) & 1 ? "q" : "x");
    if (((h >>> 20) & 7) === 0) dome(r, x0 + (w >> 1), y0, 4);
  }
  function drawTown(r) {                      // 后面山坡上层层叠叠的白房子（背景）
    const h32 = window.PB.h32;
    for (let x = 178; x < W; x++) { const t = hillTop(x); for (let y = t; y < ST; y++) r.set(x, y, y === t ? "v" : "w"); }
    for (let tier = 3; tier >= 0; tier--) {
      const base = ST - 6 - tier * 12;
      let x = 178 + Math.ceil((ST - base) / 1.4), n = 0;
      while (x < W) {
        const h = h32(tier, n++, 23), w = 12 + (h % 10), ht = 9 + ((h >>> 5) % 6);
        house(r, x, base - ht, w, ht, h);
        x += w + ((h >>> 9) % 3 === 0 ? 3 : 0);
      }
    }
  }
  const KEY = ["#####.", "....#.", "###.#.", "#...#.", "#####."];
  function arch(r, x0, top) {                 // 墙上的拱门洞：里面黑，右半边露出一截墙，像路往深处拐
    for (let y = top; y < FL; y++) {
      const ins = y === top ? 4 : y === top + 1 ? 2 : y === top + 2 ? 1 : 0;
      for (let x = x0 + ins; x < x0 + 16 - ins; x++) r.set(x, y, x === x0 + ins || y === top ? "g" : x > x0 + 9 && y > top + 6 ? "g" : "z");
    }
  }
  function drawLabyrinth(r) {                 // 迷宫的墙：暖褐色石块（背景：暗、对比低），上沿一道回纹
    for (let y = ST; y < FL; y++) for (let x = 0; x < W; x++) {
      const by = y - ST, bx = x + (((by / 8) | 0) & 1) * 8;
      let c = by % 8 === 0 || bx % 16 === 0 ? "g" : "f";
      if (c === "f" && by % 8 === 1 && bay(x, y) < 5) c = "e";
      r.set(x, y, c);
    }
    for (let x = 68; x < W; x++) {
      r.set(x, 124, "e"); r.set(x, 130, "e");
      for (let k = 0; k < 5; k++) r.set(x, 125 + k, KEY[k][x % 6] === "#" ? "e" : "g");
    }
    arch(r, 180, 142); arch(r, 236, 142);
  }

  // ---- 前景（地形和不动的东西） ----
  function drawTerrace(r) {                   // 教堂坐在白色石台上；石阶从街面一级级上去
    for (let y = 84; y < ST; y++) for (let x = 230; x < W; x++) {
      let c = y === 84 ? "t" : y === ST - 1 ? "v" : "u";
      if (c === "u" && ((y - 84) % 7 === 0 || mod(x + (((y - 84) / 7) | 0) * 6, 12) === 0) && bay(x, y) < 8) c = "v";
      r.set(x, y, c);
    }
    for (let k = 1; k <= 7; k++) {
      const x0 = 181 + 7 * (k - 1), top = ST - 4 * k;
      for (let x = x0; x < x0 + 7; x++) for (let y = top; y < ST; y++) r.set(x, y, y === top || (x === x0 && y < top + 4) ? "t" : y === ST - 1 ? "v" : "u");
    }
  }
  function drawChapel(r) {                    // 白墙蓝顶小教堂：左边钟塔山墙挂一口钟，正面钴蓝拱门和小窗
    const L = 242, R = 302, TOP = 56, BOT = 84;
    for (let y = TOP; y < BOT; y++) for (let x = L; x < R; x++) r.set(x, y, y === BOT - 1 ? "v" : x >= R - 5 ? "u" : "t");
    r.hline(L - 1, TOP, R - L + 2, "t"); r.hline(L - 1, TOP + 1, R - L + 2, "u");
    for (let y = 50; y < TOP; y++) for (let x = 262; x < 283; x++) r.set(x, y, x >= 279 ? "u" : "t");
    dome(r, 272, 50, 12);
    r.vline(272, 31, 7, "t"); r.hline(270, 33, 5, "t");
    for (let y = 40; y < TOP; y++) {           // 钟塔山墙
      const ins = y === 40 ? 4 : y === 41 ? 2 : 0;
      for (let x = 244 + ins; x < 258 - ins; x++) r.set(x, y, x >= 256 - ins ? "u" : "t");
    }
    r.vline(250, 35, 5, "t"); r.hline(249, 36, 3, "t");
    for (let y = 45; y < 52; y++) for (let x = 248; x < 254; x++) if (y > 45 || (x > 248 && x < 253)) r.set(x, y, "x");
    r.hline(250, 47, 2, "F"); r.hline(249, 48, 4, "k"); r.hline(249, 49, 4, "k"); r.set(249, 49, "l"); r.hline(248, 50, 6, "k"); r.set(250, 51, "F");
    for (let y = 68; y < BOT - 1; y++) {       // 拱门
      const ins = y === 68 ? 2 : y === 69 ? 1 : 0;
      for (let x = 266 + ins; x < 278 - ins; x++) r.set(x, y, x === 266 + ins ? "r" : x === 272 ? "y" : "q");
    }
    for (const wx of [250, 291]) { r.rect(wx, 63, 4, 5, "q"); r.hline(wx + 1, 62, 2, "q"); r.vline(wx, 63, 5, "r"); }
  }
  function drawGround(r) {                    // 街面：白灰勾缝的石板；下面切开是暖褐色的岩层、楼梯和迷宫地面
    const h32 = window.PB.h32;
    for (let x = 0; x < W; x++) {
      if (isHole(x)) continue;
      r.set(x, ST, "t"); r.set(x, ST + 1, mod(x, 11) === 0 ? "t" : "v"); r.set(x, ST + 2, mod(x, 11) === 0 ? "t" : "w");
      for (let y = ST + 3; y < ST + 10; y++) {
        const hh = h32(x >> 2, y >> 1, 9) & 15;
        r.set(x, y, y === ST + 9 ? "g" : hh < 3 ? "e" : hh < 5 ? "f" : "F");
      }
    }
    for (const x of [25, 51, 119, 129]) for (let y = ST + 1; y < ST + 9; y++) r.set(x, y, "f");
    for (let y = ST + 10; y < H; y++) for (let x = 0; x < 26; x++) {       // 楼梯井外面是整块岩石
      const hh = h32(x >> 2, y >> 1, 9) & 15;
      r.set(x, y, x === 25 ? "e" : hh < 3 ? "e" : hh < 5 ? "f" : "F");
    }
    for (let k = 0; k < 6; k++) {              // 门洞下去的石阶
      const x0 = 26 + 6 * k, top = 120 + 8 * k;
      for (let x = x0; x < x0 + 6; x++) for (let y = top; y < FL; y++) r.set(x, y, y === top ? "E" : x === x0 + 5 && y < top + 8 ? "e" : "F");
    }
    for (let y = FL; y < H; y++) for (let x = 26; x < W; x++)
      r.set(x, y, y === FL ? "E" : y < FL + 4 ? (mod(x + (y & 1) * 9, 18) === 0 ? "e" : "F") : y < H - 3 ? "e" : "f");
    r.rect(116, ST - 2, 3, 2, "u"); r.hline(116, ST - 2, 3, "t"); r.rect(130, ST - 2, 3, 2, "u"); r.hline(130, ST - 2, 3, "t"); // 天井的矮护栏
  }
  function drawOutcrop(r) {                   // 入口所在的那块褐色岩石，顶上几丛灌木
    const h32 = window.PB.h32;
    const topAt = (x) => 66 + Math.round(3 * Math.sin(x * 0.35) + 2 * Math.sin(x * 0.13)) + Math.max(0, Math.round((x - 56) * 2.4));
    for (let x = 0; x < 78; x++) {
      const top = topAt(x);
      for (let y = top; y < ST; y++) {
        const hh = h32(x >> 1, y >> 1, 4) & 15;
        r.set(x, y, y === top ? "E" : y === top + 1 ? "d" : hh < 2 ? "f" : hh < 6 ? "e" : "F");
      }
    }
    for (const x of [4, 9, 38, 43]) { const t = topAt(x); r.hline(x, t - 1, 3, "n"); r.set(x + 1, t - 2, "n"); r.set(x + 2, t - 1, "o"); }
  }
  const HORNS = ["c..............c", "cE............Ec", ".cE..........Ec.", ".cE..........Ec.", "..cEE......EEc..", "...cEEEEEEEEc...", ".dddddddddddddd."];
  function column(r, x0) {                    // 米诺斯红柱：上粗下细，黑色柱头
    r.hline(x0 - 1, 84, 10, "g"); r.hline(x0 - 1, 85, 10, "f"); r.hline(x0 - 1, 86, 10, "g"); r.hline(x0, 87, 8, "g");
    for (let y = 88; y < 110; y++) {
      const l = x0 + (y >= 100 ? 1 : 0), rr = x0 + 7 - (y >= 104 ? 1 : 0);
      for (let x = l; x <= rr; x++) r.set(x, y, x === l ? "a" : x === rr ? "f" : "h");
    }
    r.hline(x0 - 1, 110, 10, "g"); r.hline(x0 - 1, 111, 10, "f");
  }
  function drawPortal(r) {                    // 迷宫入口：两根红柱、门楣、一对牛角，门洞里黑
    for (let y = 84; y < ST; y++) for (let x = 25; x <= 51; x++) r.set(x, y, y < 86 || x < 28 ? "g" : "z");
    column(r, 17); column(r, 52);
    for (let x = 14; x < 63; x++) { r.set(x, 78, "d"); r.set(x, 79, "F"); r.set(x, 80, "a"); r.set(x, 81, "F"); r.set(x, 82, "F"); r.set(x, 83, "f"); }
    rows(r, HORNS, 30, 71);
  }
  function drawOliveTrunk(r) {                // 橄榄树干：扭着长，几根枝伸进树冠
    for (let y = 84; y < ST; y++) {
      const t = (ST - y) / 28, cx = 164 + Math.round(3 * Math.sin(t * 5)), half = Math.round(4 - 2 * t);
      for (let x = cx - half; x <= cx + half; x++) r.set(x, y, x === cx - half ? "E" : x === cx + half ? "e" : (x + y) % 5 === 0 ? "f" : "F");
    }
    r.hline(157, ST - 1, 15, "e"); r.hline(158, ST - 2, 13, "F");
    const branch = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); r.set(x, y, "F"); r.set(x, y + 1, "e"); } };
    branch(163, 86, 150, 77); branch(165, 86, 177, 74); branch(164, 85, 162, 66); branch(166, 88, 186, 84);
  }
  const MEDUSA = [                            // 22 宽；0–3 行是蛇发（会动），这里从第 4 行起
    "...nnnvvvvvvvvnnn.....", "..n.nvuuuuuuuuvn.n....", "...nvuuuuuuuuuuvn.....", "...nvuzzuuuuzzuvn.....",
    "....vuuuuuvuuuuv......", "....vuuuuuvuuuuv......", ".....vuuuwwwuuv.......", "......vuuuuuuv........",
    ".......vvvvvv.........", "........wvvw..........", "....vuuuuuuuuuuuv.....", "...vuuuvuuuuuvuuuv....",
    "...vuuvuuuuuuuvuuv....", "...wvvvvvvvvvvvvvw....",
  ];
  const SNAKES = [
    [".....m....m.....m.....", "...m..n..n..n..n..m...", "....n..n.n..n.n..n....", "..m..nnnnnnnnnnnn..m.."],
    ["......m....m....m.....", "....m.n...n..n.n..m...", "...n..n..n..n..n..n...", "...m.nnnnnnnnnnnn.m..."],
  ];
  function drawStatue(r) {                    // 美杜莎石像（冷灰的石头，和暖褐的墙分开）和石座
    rows(r, MEDUSA, 278, 138);
    r.hline(279, 152, 20, "u"); r.hline(279, 153, 20, "v");
    for (let y = 154; y < 165; y++) for (let x = 281; x < 297; x++) r.set(x, y, x === 281 ? "u" : x === 296 ? "w" : y > 156 && y < 162 && x > 283 && x < 294 ? (y === 157 ? "w" : "v") : "v");
    r.hline(279, 165, 20, "v"); r.hline(279, 166, 20, "w"); r.hline(279, 167, 20, "x");
  }
  function drawMirror(r) {                    // 铜镜：斜着（“\”）架在支架上，亮面朝右上
    r.hline(119, 165, 11, "F"); r.hline(119, 166, 11, "e"); r.hline(119, 167, 11, "f");
    for (let y = 145; y < 165; y++) { r.set(123, y, "F"); r.set(124, y, "e"); }
    for (let i = 0; i <= 12; i++) { r.set(118 + i, 138 + i, "e"); r.set(118 + i, 137 + i, "k"); r.set(119 + i, 137 + i, i > 2 && i < 6 ? "l" : "d"); }
  }

  function build() {
    const PB = window.PB, h32 = PB.h32;
    back = new PB.Raster(W, H); front = new PB.Raster(W, H); buf = new PB.Raster(W, H);
    img = new ImageData(buf.data, W, H);
    MASK = new Uint8Array(W * H);             // 云影只落在白房子、石台、石阶和街面上
    const mark = (r, y1) => { for (let i = 0; i < W * y1; i++) if (r.data[i * 4 + 3]) MASK[i] = 1; };
    const town = new PB.Raster(W, H);
    drawSkySea(back); drawTown(town); mark(town, ST); back.blit(town, 0, 0); drawIsland(back); drawLabyrinth(back);
    drawTerrace(front); drawChapel(front); drawGround(front); mark(front, ST + 3);
    drawOutcrop(front); drawPortal(front); drawOliveTrunk(front); drawStatue(front); drawMirror(front);
    r3(front);
    sprite(front, "char.portitor", 84, ST, false);
    sprite(front, "obj.crate_wood", 104, ST);
    sprite(front, "obj.crate_wood", 150, FL);
    for (let i = 0; i < 110; i++) {            // 海面闪光点：多数落在主角背后那片开阔的海上
      const h = h32(i, 11, 8), x = i < 50 ? h % W : 70 + (h % 110), y = HZ + 2 + ((h >>> 9) % (ST - HZ - 3));
      if (town.data[(y * W + x) * 4 + 3]) continue;
      SPARKS.push({ x, y, ph: (h >>> 17) % 11, per: 9 + ((h >>> 21) % 5), big: ((h >>> 25) & 3) === 0 });
    }
  }
  function r3(r) {                            // 猫头鹰蹲的门洞檐
    r.hline(238, 139, 12, "E"); r.hline(238, 140, 12, "F"); r.hline(239, 141, 10, "e");
  }

  // ---- 会动的部分 ----
  const CLOUDS = [
    { w: 48, y: 12, blobs: [[8, 7, 6], [19, 5, 8], [31, 6, 7], [41, 8, 5]], speed: 1, off: 250 },
    { w: 28, y: 28, blobs: [[6, 5, 4], [14, 3, 6], [22, 5, 4]], speed: 0.6, off: 120 },
  ];
  const cloudX = (c, a4) => mod(Math.floor(a4 * c.speed) + c.off, W + 120) - 60;
  function drawCloud(r, c, x0) {              // 白云慢慢往右飘（只在天空里）
    const bottom = c.y + 9;
    for (let y = Math.max(0, c.y - 4); y <= bottom && y < HZ; y++) for (let i = 0; i < c.w; i++) {
      let inside = false;
      for (const [bx, by, br] of c.blobs) { const dx = i - bx, dy = y - c.y - by; if (dx * dx + dy * dy <= br * br) { inside = true; break; } }
      if (inside) r.set(x0 + i, y, y === bottom ? "v" : y > bottom - 3 ? "u" : y < c.y + 4 || i < 6 ? "t" : "u");
    }
  }
  const SHADE = { t: "u", u: "v", v: "w", w: "x", x: "y", q: "y", r: "q", k: "F", l: "k" };
  function drawCloudShadow(r, cx, rx) {       // 云影：一大块软边的暗斑滑过白墙
    const cy = 82, ry = 34;
    for (let y = cy - ry; y < Math.min(ST + 3, cy + ry); y++) for (let x = Math.max(0, cx - rx); x < Math.min(W, cx + rx); x++) {
      if (!MASK[y * W + x]) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry, q = dx * dx + dy * dy;
      if (q >= 1 || (q > 0.7 && bay(x, y) < ((q - 0.7) / 0.3) * 16)) continue;
      const s = SHADE[r.get(x, y)];
      if (s) r.set(x, y, s);
    }
  }
  function drawSparks(r, a4) {                // 海面闪光
    for (const s of SPARKS) {
      const p = mod(a4 + s.ph, s.per);
      if (p === 0) { r.set(s.x, s.y, "t"); if (s.big) { r.set(s.x - 1, s.y, "s"); r.set(s.x + 1, s.y, "s"); r.set(s.x, s.y - 1, "s"); r.set(s.x, s.y + 1, "s"); } }
      else if (p === 1) r.set(s.x, s.y, "s");
    }
  }
  function drawBeam(r, a4) {                  // 天井照下来的阳光，铜镜把它折向美杜莎；光里飘着灰
    for (let y = ST; y < BEAM_Y; y++) {
      r.set(WELL, y, "l");
      for (const dx of [-1, 1]) if (bay(WELL + dx, y + a4) < 10) r.set(WELL + dx, y, "k");
      for (const dx of [-2, 2]) if (bay(WELL + dx, y + a4) < 3) r.set(WELL + dx, y, "d");
    }
    for (let x = WELL; x < 287; x++) {
      r.set(x, BEAM_Y, "l");
      for (const dy of [-1, 1]) if (bay(x - a4, BEAM_Y + dy) < 10) r.set(x, BEAM_Y + dy, "k");
      for (const dy of [-2, 2]) if (bay(x - a4, BEAM_Y + dy) < 3) r.set(x, BEAM_Y + dy, "d");
    }
    for (let i = 0; i < 5; i++) {
      r.set(WELL + (i % 3) - 1, ST + 2 + mod(a4 + i * 7, 29), "t");
      r.set(WELL + 6 + mod(a4 * 2 + i * 31, 150), BEAM_Y + (i % 3) - 1, "t");
    }
  }
  const LEAVES = [[150, 79, 12, 7, 0], [177, 75, 13, 8, 3], [163, 65, 13, 8, 5], [188, 85, 8, 5, 2], [141, 88, 8, 5, 6], [168, 84, 10, 6, 1]];
  function drawCanopy(r, a4, gust) {          // 橄榄树冠：灰绿，一簇簇轻轻摆，风一吹翻出银白的叶背
    const h32 = window.PB.h32;
    for (const [cx0, cy, rx, ry, ph] of LEAVES) {
      const cx = cx0 + tri(a4 + ph * 3, 16, 1) + gust;
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
        const q = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (q > 1) continue;
        const hh = h32(dx + 40, dy + 40, ph);
        if (q > 0.72 && (hh & 3) === 0) continue;
        const s = (dx / rx) * 0.5 + (dy / ry) * 0.85;
        let c = s < -0.45 ? "v" : s < 0.25 ? "n" : "o";
        if ((hh >>> 4) % 7 === 0) c = c === "v" ? "n" : "o";
        else if (c === "n" && h32(cx + dx, cy + dy, (a4 >> 1) + gust * 7) % (gust ? 9 : 19) === 0) c = "v";
        r.set(cx + dx, cy + dy, c);
      }
    }
  }
  function drawGust(r, G) {                   // 迷宫入口一阵风：尘土线和两片叶子从门洞里刮出来
    if (G >= 12) return;
    for (let i = 0; i < 7; i++) {
      const d = i % 3, x0 = 50 + (G - d) * 12 + ((i * 5) % 9), y = 92 + ((i * 7) % 17), len = 5 + ((i * 3) % 5);
      if (G < d || x0 > 184) continue;
      for (let k = 0; k < len; k++) if (k >= len - 2) r.set(x0 + k, y, "u"); else if (!(k & 1)) r.set(x0 + k, y, "v");
    }
    for (let i = 0; i < 2; i++) {
      const g = G - 1 - i * 3, x = 46 + g * 10, y = 98 + i * 6 + ((G >> 1) & 1 ? 1 : -1);
      if (g >= 0 && x < 190) { r.set(x, y, "n"); r.set(x + 1, y + (G & 1 ? -1 : 1), "o"); }
    }
  }
  function drawMedusa(r, a4) {                // 蛇发慢慢扭；眼睛一阵阵发亮（目光）；铜镜折过来的光打在脸上
    rows(r, SNAKES[(a4 >> 1) & 1], 278, 134);
    const E = mod(a4, 20);
    if (E < 4) { const c = E === 1 || E === 2 ? "s" : "m"; for (const x of [284, 285, 290, 291]) r.set(x, 141, c); }
    r.set(282, 142, "c"); r.set(282, 143, "t"); r.set(283, 143, "c"); r.set(283, 144, "c");
  }
  function drawMirrorGlint(r, a4) { const i = mod(a4, 18); if (i <= 12) r.set(119 + i, 137 + i, "t"); }

  // 牛头怪：朝左，28×25（左边留 4 列给鼻气）。M 主色、S 暗、L 亮、T 顶光，最后换成调色板代码
  const MINO_A = [
    "..c.......c.............", "..cE.....cE.............", "...cE...cE..............", "...ETLLLTM..............",
    "..LMMMMMMMS.....LLTT....", ".LMMiMMMMMSS..LMMMMMTS..", "LMMMMMMMMMSSSLMMMMMMMSS.", "FFMMMMMMMMSSMMMMMMMMMSSS",
    "FzFMMMMMMSSMMMMMMMMMMSSS", "FFFMMMMMSSMMMMMMMMMMMSSS", ".k.SSSSSSMMMMMMMMMMMSSSS", "......LMMMMMMMMMMMMMSSSS",
    ".....LMMSMMMMMMMMMMSSSS.", ".....MMSSMMMMMMMMMSSSSS.", ".....MMS.SMMMMMMMMSSSS..", ".....MMS..SMMMMMMSSSS...",
    ".....MMS..SMMMMMMSSS....", ".....MSS..kkkkkkkkkk....", ".....zzS..hhahhhahhh....", "......z...hahhhahhhh....",
    "..........hh.hhh..hh....", "...........MS....MS.....", "...........MS....MS.....", "...........MS....MS.....",
    "..........zzz...zzz.....",
  ];
  const MINO_B = [
    "........................", "........................", "........................", "........................",
    "................LLTT....", "..............LMMMMMTS..", ".............LMMMMMMMSS.", "..cc........LMMMMMMMMSSS",
    "....cE....LMMMMMMMMMMSSS", "..cc.cETTLMMMMMMMMMMMSSS", "....cELMMMMMMMMMMMMMSSSS", "...LMMMMMSMMMMMMMMMMSSSS",
    "..LMMiMMSSMMMMMMMMMSSSS.", ".LMMMMMSSMMMMMMMMMSSSSS.", "FFMMMMSS.SMMMMMMMMSSSS..", "FzFMMSS...SMMMMMMSSSS...",
    "FFFSS.MS..SMMMMMMSSS....", ".k...MSS..kkkkkkkkkk....", ".....zzS..hhahhhahhh....", "......z...hahhhahhhh....",
    "..........hh.hhh..hh....", "...........MS....MS.....", "...........MS....MS.....", "...........MS....MS.....",
    "..........zzz...zzz.....",
  ];
  const minoRows = (a) => a.map((s) => ("...." + s).replace(/M/g, "w").replace(/S/g, "x").replace(/L/g, "v").replace(/T/g, "u"));
  const MA = minoRows(MINO_A), MB = minoRows(MINO_B);
  const MC = MB.slice(0, 21).concat(minoRows(["...........MS....MS.....", "............MS...MS.....", "........E....zz..MS.....", "......E.E.d.....zzz....."]));
  const MD = MB.slice();
  MD[13] = "...v" + MD[13].slice(4); MD[14] = "..u." + MD[14].slice(4); MD[15] = ".uv." + MD[15].slice(4); MD[16] = "v.u." + MD[16].slice(4);
  const MINO = { A: MA, B: MB, C: MC, D: MD };
  const MSEQ = "AAAAAAAABBCBCBCBDDBBCBCBDDBBBBBB";
  function drawMinotaur(r, tick) { rows(r, MINO[MSEQ[tick & 31]], 66, FL - 25); }

  const OWL_F = ["..EEEEE..", ".EFFFFFE.", "EttFFFttE", "ElzlFlzlE", "EFFFvFFFE", ".FcFFFcF.", ".FFcFcFF.", ".eFFcFFe.", "..eFFFe..", "..k...k.."];
  const OWL = {
    F: OWL_F,
    B: OWL_F.map((s, i) => (i === 3 ? "EeeeFeeeE" : s)),
    K: OWL_F.map((s, i) => (i === 2 ? "EFFFFFFFE" : i === 3 ? "EFcFFFcFE" : i === 4 ? "EFFFFFFFE" : s)),
  };
  const OSEQ = "FFFFFFFFFFFFFFBBFFFFFFFFKKKKKKKKKKKKFFFFFFBFBFFF";
  function drawOwl(r, tick) { rows(r, OWL[OSEQ[mod(tick, 48)]], 239, 129); }

  scenes.aegean = {
    draw(ctx, tick) {
      if (!back) build();
      const t = tick | 0, a4 = t >> 1, G = mod(a4, 40);
      buf.data.set(back.data);
      for (const c of CLOUDS) drawCloud(buf, c, cloudX(c, a4));
      drawSparks(buf, a4);
      drawBeam(buf, a4);
      buf.blit(front, 0, 0);
      for (const c of CLOUDS) drawCloudShadow(buf, cloudX(c, a4) + (c.w >> 1), ((c.w * 4) / 5) | 0);
      drawCanopy(buf, a4, G >= 5 && G < 12 ? 1 : 0);
      drawGust(buf, G);
      drawMedusa(buf, a4);
      drawMirrorGlint(buf, a4);
      drawMinotaur(buf, t);
      drawOwl(buf, t);
      ctx.putImageData(img, 0, 0);
    },
  };
})();
