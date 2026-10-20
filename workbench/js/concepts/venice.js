/* 地图概念场景 · 威尼斯水城（ART-04g）。只看大致效果：不是正式美术资产，也不是能玩的关卡。
 * 画面：冬天黄昏，粉橙、赭黄的老房子和钟楼，白色伊斯特拉石拱桥，青灰运河里的倒影随波晃。
 * 地标：石拱桥和贡多拉、挂满面具的橱窗、钟楼、涨潮时泡水的广场。
 * 环境（4 fps）：潮水从广场排水口冒上来漫过石板再退下，运河水位跟着涨落；窗灯一盏盏亮起又熄；运河上起薄雾。
 * 机关只画外观：潮位标尺（tide）、随潮升降的木浮台（moving_platform）、漂着的贡多拉（drift）。
 * 动物（8 fps）：海鸥（怪物，抢货）在桥上空扑翅盘旋；鸽子（提示动物）在广场踱步、啄地。
 * 比例尺：主角 1 个 + 木箱 2 个（一个在浮台上），不动。不画收件人、货物、界面和文字。
 * 接口见 docs/packages/ART-04g.md：PB_CONCEPT_SCENES.venice.draw(ctx, tick)，ctx 是 320×180 画布，tick 每秒 +8。
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
  const FLOOR = 144, CAMPO_R = 110;           // 广场 x 0–109，地面顶 y 144
  const CH_L = 134, CH_R = 290, DECK = 112;   // 运河 x 134–289（整段在拱下）；桥面顶 y 112
  const archY = (x) => 120 + Math.round((34 * (x - 212) * (x - 212)) / 6084); // 拱腹：拱顶 (212,120)，拱脚 y 154
  function bridgeTop(x) {                     // 台阶和桥面的顶 y（右边台阶下到 y 144 的岸上）
    if (x < 134) return FLOOR - 8 * ((((x - 110) / 6) | 0) + 1);
    if (x < 290) return DECK;
    return Math.min(FLOOR, DECK + 8 * ((((x - 290) / 6) | 0) + 1));
  }
  const DRAINS = [26, 66];                    // 广场上的排水口：涨潮时水从这里冒上来
  const HOUSES = [                            // 对岸的房子：x0, x1, 顶 y, 墙色
    [98, 130, 54, "D"], [130, 158, 62, "F"], [158, 198, 46, "b"], [198, 232, 58, "C"],
    [232, 262, 50, "F"], [262, 286, 60, "e"], [306, 320, 52, "D"],
  ];

  let back = null, front = null, buf = null, img = null, MIST = null;
  const WINDOWS = [];

  function sprite(r, id, x, y, flip) {        // 已确认的主角 / 木箱精灵（锚点底边中心），只当比例尺
    const S = window.PB.sprites;
    if (S && S.has(id)) { S.draw(r, id, id === "char.portitor" ? "idle" : "default", 0, x, y, !!flip); return; }
    if (id === "char.portitor") { r.rect(x - 4, y - 14, 8, 14, "z"); r.rect(x - 3, y - 13, 6, 4, "k"); r.rect(x - 3, y - 9, 6, 8, "i"); }
    else { r.rect(x - 8, y - 16, 16, 16, "z"); r.rect(x - 7, y - 15, 14, 14, "b"); }
  }
  function rows(r, art, x, y, flip) { r.blitRows(art, x, y, flip); }

  // ---- 背景（不透明）：天空、圆顶、钟楼、房子、面具店 ----
  function drawSky(r) {
    const bands = [[0, "y"], [22, "B"], [46, "C"], [70, "D"]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = bands[0][1];
      for (let i = 1; i < bands.length; i++) {
        const y0 = bands[i][0];
        if (y >= y0 + 4) { c = bands[i][1]; continue; }
        if (y >= y0 - 4 && bay(x, y) < (y - y0 + 4) * 2) c = bands[i][1];
        break;
      }
      r.set(x, y, c);
    }
    for (let i = 0; i < 16; i++) { const h = window.PB.h32(i, 3, 41); r.set(h % W, (h >>> 9) % 18, i % 3 ? "w" : "v"); }
  }
  function drawDome(r) {                      // 远处教堂的圆顶，只露出房顶上面的一截
    const cx = 215, by = 62, R = 13;
    for (let y = by - R; y < by; y++) for (let x = cx - R; x <= cx + R; x++) {
      const dx = x - cx, dy = by - y;
      if (dx * dx + dy * dy <= R * R) r.set(x, y, "B");
    }
    r.rect(cx - 2, by - R - 5, 5, 5, "B"); r.rect(cx - 1, by - R - 8, 3, 3, "B"); r.set(cx, by - R - 9, "B");
  }
  function drawCampanile(r) {                 // 钟楼：砖塔身、白石钟室、铜绿尖顶、金色天使
    const x0 = 286;
    r.rect(x0 + 1, 50, 18, 110, "a"); r.vline(x0 + 1, 50, 110, "b"); r.vline(x0 + 18, 50, 110, "f");
    for (const px of [x0 + 6, x0 + 10, x0 + 14]) r.vline(px, 54, 100, "f");
    r.rect(x0, 34, 20, 15, "v"); r.hline(x0, 34, 20, "u"); r.hline(x0 - 1, 49, 22, "u"); r.hline(x0 - 1, 50, 22, "w");
    for (let i = 0; i < 4; i++) { const ax = x0 + 3 + i * 4; r.rect(ax, 38, 2, 9, "g"); r.set(ax, 37, "w"); r.set(ax + 1, 37, "w"); }
    r.rect(x0 + 1, 28, 18, 6, "F"); r.vline(x0 + 18, 28, 6, "e"); r.hline(x0 + 1, 28, 18, "d");
    for (let y = 8; y < 28; y++) { const half = ((y - 8) * 9 / 20) | 0; for (let x = 296 - half; x <= 296 + half; x++) r.set(x, y, x < 296 ? "n" : "o"); }
    r.vline(296, 4, 4, "k"); r.set(295, 5, "b"); r.set(297, 5, "b");
  }
  function addWindow(r, x, y, w, h, sill) {   // 尖拱窗：先画成没亮的，记下像素，运行时再点亮
    const px = [];
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (yy === 0 && (xx === 0 || xx === w - 1)) continue;
      if (w >= 5 && yy === 1 && (xx === 0 || xx === w - 1)) continue;
      if (w >= 5 && yy === 0 && (xx === 1 || xx === w - 2)) continue;
      r.set(x + xx, y + yy, "g"); px.push(x + xx, y + yy, yy);
    }
    if (sill) r.hline(x - 1, y + h, w + 2, sill);
    WINDOWS.push({ px, ph: window.PB.h32(x, y, 17) % 240 });
  }
  function patch(r, x0, y0, w, h, seed) {    // 灰泥剥落、露出砖的一小块（威尼斯老房子的样子）
    const h32 = window.PB.h32;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y);
      if (ex + ey < 2 + (h32(x, y, seed) & 1)) continue;
      const ry = y - y0; r.set(x, y, ry % 3 === 2 || mod(x + (((ry / 3) | 0) & 1) * 2, 5) === 4 ? "f" : "e");
    }
  }
  function drawHouses(r) {
    const PB = window.PB;
    HOUSES.forEach(([x0, x1, top, wall], n) => {
      r.rect(x0, top, x1 - x0, 156 - top, wall);
      r.vline(x0, top + 3, 153 - top, PB.LIGHT[wall]); r.vline(x1 - 1, top + 3, 153 - top, PB.DIM[wall]);
      for (let x = x0; x < x1; x++) { r.set(x, top, x & 1 ? "f" : "a"); r.set(x, top + 1, "f"); r.set(x, top + 2, "g"); }
      if (n % 2 === 0) { const cx = x0 + 6 + ((n * 5) % 12); r.rect(cx, top - 6, 2, 6, "f"); r.rect(cx - 1, top - 8, 4, 2, "f"); r.rect(cx - 2, top - 10, 6, 2, "g"); }
      const wd = x1 - x0, nw = Math.max(1, ((wd - 6) / 8) | 0), sx = x0 + ((wd - (nw * 8 - 5)) >> 1);
      for (let wy = top + 8; wy < 136; wy += 15) for (let i = 0; i < nw; i++) addWindow(r, sx + i * 8, wy, 3, 6, PB.DIM[PB.DIM[wall]]);
      if (n % 3 === 1) patch(r, x0 + 4, top + 20, 10, 6, n);
      const dx = x0 + ((wd - 7) >> 1);        // 水门
      for (let y = 143; y < 156; y++) for (let x = dx; x < dx + 7; x++) if (!(y === 143 && (x === dx || x === dx + 6))) r.set(x, y, "g");
    });
    r.hline(98, 151, W - 98, "v"); r.hline(98, 152, W - 98, "w");
    r.rect(98, 153, W - 98, H - 153, "x");
  }
  const MASKS = [
    [".tttt.", "tzttzt", "tttttt", ".tttt.", "..tt.."],          // 白色包塔面具
    ["k....k", "kkkkkk", "kzkkzk", ".kbbk.", "......"],          // 金色半脸
    ["C.CC.C", "CCCCCC", "CzCCzC", ".CCCC.", "..CC.."],          // 小丑
    [".uuu..", "uzuz..", "uuuuuu", ".uuuuu", "..u..."],          // 长鼻子医生
  ];
  function drawMaskShop(r) {                  // 左边近处的房子：楼上绿百叶窗，底层挂满面具的橱窗
    r.rect(0, 20, 98, 136, "F"); r.vline(97, 22, 134, "e");
    for (let x = 0; x < 98; x++) { r.set(x, 18, x & 1 ? "a" : "f"); r.set(x, 19, "f"); r.set(x, 20, "g"); r.set(x, 21, "e"); }
    r.rect(74, 8, 3, 10, "f"); r.rect(72, 6, 7, 2, "f"); r.rect(71, 4, 9, 2, "g");
    for (const wy of [30, 54, 76]) for (const wx of [12, 34, 56, 78]) {
      addWindow(r, wx, wy, 5, 11, "u");
      r.rect(wx - 3, wy + 1, 2, 10, "o"); r.rect(wx + 6, wy + 1, 2, 10, "o"); r.vline(wx - 2, wy + 1, 10, "p"); r.vline(wx + 7, wy + 1, 10, "p");
    }
    r.hline(30, 66, 34, "u"); for (let x = 31; x < 63; x += 2) r.vline(x, 67, 2, "v"); r.hline(30, 69, 34, "w");
    r.hline(0, 95, 98, "u"); r.hline(0, 96, 98, "w"); r.rect(0, 97, 98, 59, "e"); r.vline(97, 97, 59, "f");
    const ax = 32, top = (x) => 101 + Math.round((8 * (x - ax) * (x - ax)) / 676);
    for (let x = 6; x < 59; x++) {
      const t = top(x);
      r.set(x, t - 2, "f"); r.set(x, t - 1, "g");
      for (let y = t; y < 140; y++) {
        const g = (x - 32) * (x - 32) + (y - 116) * (y - 116) * 3;
        r.set(x, y, g < 380 || (g < 560 && bay(x, y) < 8) ? "d" : "F");
      }
      r.set(x, 140, "g"); r.set(x, 141, "u");
    }
    r.vline(5, 99, 42, "g"); r.vline(59, 99, 42, "g");
    for (let row = 0; row < 3; row++) {
      const my = 109 + row * 10; r.hline(8, my - 1, 49, "e");
      for (let i = 0; i < 6; i++) rows(r, MASKS[(i + row * 3) % 4], 9 + i * 8, my, (i + row) % 2 === 1);
    }
    for (const mx of [19, 32, 45]) r.vline(mx, top(mx), 140 - top(mx), "f");
    patch(r, 4, 40, 14, 8, 3); patch(r, 62, 86, 12, 6, 4); patch(r, 84, 104, 10, 9, 5);
  }

  // ---- 前景（透明底）：广场、石拱桥、系船桩、潮位标尺、主角和木箱 ----
  function drawCampo(r) {
    for (let x = 0; x < CAMPO_R; x++) {
      r.set(x, FLOOR, "u");
      for (let y = FLOOR + 1; y < FLOOR + 4; y++) r.set(x, y, mod(x, 12) === 11 ? "w" : "v");
      r.set(x, FLOOR + 4, "w");
      for (let y = FLOOR + 5; y < H; y++) {
        const ry = y - FLOOR - 5, off = (((ry / 6) | 0) & 1) * 7;
        r.set(x, y, ry % 6 === 5 || mod(x + off, 14) === 13 ? "x" : "w");
      }
    }
    for (const d of DRAINS) { for (let i = -2; i <= 2; i++) r.set(d + i, FLOOR, i & 1 ? "z" : "x"); r.rect(d - 1, FLOOR + 1, 3, 2, "z"); }
  }
  function drawBridge(r) {
    for (let x = CAMPO_R; x < W; x++) {
      const top = bridgeTop(x), inCh = x >= CH_L && x < CH_R, bot = inCh ? archY(x) : H;
      for (let y = top; y < bot; y++) {
        let c;
        if (y === top) c = "u";
        else if (inCh && y >= bot - 4) c = y === bot - 1 ? "w" : y === bot - 4 || mod(x, 8) === 0 ? "w" : "v";
        else if (inCh && y > DECK && y <= DECK + 3) c = y === DECK + 3 ? "w" : "v";
        else { const ry = mod(y - DECK, 6), rx = mod(x + ((((y - DECK) / 6) | 0) & 1) * 6, 12); c = ry === 5 || rx === 11 ? "w" : "v"; }
        r.set(x, y, c);
      }
      if (x < 134 && mod(x - CAMPO_R, 6) === 0) r.vline(x, top, 8, "u");      // 左边台阶的踢面朝光
      if (x >= 290 && x < 308 && mod(x - 290, 6) === 5) r.vline(x, top + 1, 7, "w"); // 右边台阶背光
      if (top >= FLOOR) continue;
      r.set(x, top - 8, "u"); r.set(x, top - 1, "v");                            // 栏杆：扶手、栏杆柱、底座
      if (mod(x, 3) === 0) r.vline(x, top - 7, 6, "v"); else if (mod(x, 3) === 1) r.vline(x, top - 6, 4, "w");
      if (mod(x - CAMPO_R, 24) === 0) { r.vline(x, top - 10, 9, "u"); r.vline(x + 1, top - 10, 9, "w"); }
    }
    r.rect(209, 113, 7, 7, "u"); r.vline(215, 113, 7, "w");                    // 拱顶石
  }
  function drawPosts(r) {
    for (let y = 126; y < H; y++) for (let x = 232; x < 234; x++) r.set(x, y, mod(y - x, 6) < 3 ? "u" : "q");
    r.rect(231, 124, 4, 2, "q");
    for (let y = 136; y < H; y++) {           // 潮位标尺：白底黑刻度，蓝线是高潮位
      r.set(166, y, mod(y, 4) === 0 ? "z" : "u"); r.set(167, y, mod(y, 16) === 0 ? "z" : "u"); r.set(168, y, "v");
    }
    r.rect(165, 134, 5, 2, "w"); r.hline(166, FLOOR, 2, "q");
  }

  function build() {
    const PB = window.PB;
    back = new PB.Raster(W, H); front = new PB.Raster(W, H); buf = new PB.Raster(W, H);
    img = new ImageData(buf.data, W, H);
    MIST = Object.assign({}, PB.LIGHT, { z: "y", y: "x", p: "x", g: "x", x: "w", f: "e", q: "w" });
    drawSky(back); drawDome(back); drawCampanile(back); drawHouses(back); drawMaskShop(back);
    drawCampo(front); drawBridge(front); drawPosts(front);
    sprite(front, "char.portitor", 80, FLOOR, false);
    sprite(front, "obj.crate_wood", 101, FLOOR);
  }

  // ---- 会动的部分 ----
  // 潮汐：160 个环境帧（40 秒）一圈。先涨 15 秒，平潮 10 秒（广场被淹再退），再落 15 秒。
  const level = (P) => (P < 60 ? 157 - (((P * 13) / 60) | 0) : P < 100 ? 144 : 144 + ((((P - 100) * 13) / 60) | 0));
  const floodR = (P) => (P < 58 ? 0 : P < 80 ? (P - 58) * 2 : P < 86 ? 44 : P < 106 ? 44 - ((((P - 86) * 44) / 20) | 0) : 0);

  function drawWindows(r, a4) {
    for (const w of WINDOWS) {
      if (mod(a4 + w.ph, 240) >= 130) continue;
      for (let i = 0; i < w.px.length; i += 3) r.set(w.px[i], w.px[i + 1], w.px[i + 2] < 2 ? "b" : w.px[i + 2] > 3 ? "k" : "j");
    }
  }
  const GULL = [                             // 20×12，朝右：翅膀上、平、下
    ["...z................", "...zv...............", "....vv..............", ".....vv.............", "......vv.......zt...", ".......vv.....ttzt..",
      "..uuttttvtttttttttkk", "...utttttttttttttti.", ".....uuuuuuuuuuu....", "....................", "....................", "...................."],
    ["....................", "....................", "....................", "....................", "...............zt...", "...vvvvvvvv...ttzt..",
      "..uzvvvvvvvvttttttkk", "...utttttttttttttti.", ".....uuuuuuuuuuu....", "....................", "....................", "...................."],
    ["....................", "....................", "....................", "....................", "...............zt...", "..............ttzt..",
      "..uuttttttttttttttkk", "...uttttvvvvtttttti.", ".....uuvvvvuuuuu....", "......vvv...........", ".....vv.............", "....zz.............."],
  ];
  function drawGull(r, tick) {                // 怪物：海鸥在桥上空来回扑翅，盯着浮台上的箱子
    const x = 196 + tri(tick, 176, 44), y = 64 + tri(tick + 22, 44, 3);
    const right = tri(tick + 1, 176, 44) >= tri(tick, 176, 44);
    rows(r, GULL[[0, 1, 2, 1][tick & 3]], x - 10, y - 12, !right);
  }
  function drawGondola(r, x, wl) {            // 漂着的贡多拉（在浮台后面）：黑船身、船头铁饰、紫红坐垫
    for (let i = 0; i < 56; i++) {
      const lift = i < 8 ? 8 - i : i > 44 ? ((i - 44) * 5) >> 2 : 0, top = wl - 3 - lift;
      r.set(x + i, top, i > 1 && i < 54 ? "w" : "z");
      for (let y = top + 1; y <= wl + 1; y++) r.set(x + i, y, "z");
    }
    const fx = x + 55, fy = wl - 16;
    for (let k = 0; k < 9; k++) r.set(fx, fy - k, "u");
    r.set(fx - 1, fy - 8, "u");
    for (let k = 1; k < 4; k++) r.set(fx + 1, fy - k * 2, "v");
    r.rect(x + 24, wl - 6, 8, 3, "f"); r.hline(x + 24, wl - 6, 8, "B");
  }
  function drawRaft(r, wl) {                  // 木浮台随潮升降，上面放一个木箱
    const top = wl - 4;
    for (let x = 196; x < 228; x++) {
      const gap = mod(x - 196, 8) === 7;
      r.set(x, top, gap ? "b" : "d"); r.set(x, top + 1, gap ? "f" : "b"); r.set(x, top + 2, "e"); r.set(x, top + 3, "f"); r.set(x, top + 4, "f");
    }
    for (let i = 0; i < 4; i++) r.set(228 + i, top + 1 - i, "F");
    sprite(r, "obj.crate_wood", 212, top);
  }
  const WOB = [0, 1, 1, 0, 0, -1, -1, 0];
  // 倒影换成青灰色：亮的变 w/v，中间调变 x，暗的变 p；窗灯的暖光留成橙色的光带
  const REF = { t: "v", u: "w", v: "w", c: "w", E: "w", s: "w", d: "w", l: "b", k: "b", j: "e", F: "x", D: "x", b: "x", e: "x", C: "x", a: "x",
    i: "x", m: "x", r: "x", w: "x", A: "x", n: "p", B: "p", x: "p", y: "p", z: "p", g: "p", f: "p", h: "p", o: "p", p: "p", q: "p" };
  const DEEP = { v: "w", w: "x", x: "p", b: "e", e: "f", f: "p" };
  function drawWater(r, wl, a4) {             // 运河：倒影随波晃，深处更暗，水面一道亮线
    for (let y = wl; y < H; y++) {
      const k = y - wl, dx = WOB[mod(a4 + k * 3 + (k >> 2), 8)] * (k > 12 ? 2 : 1), sy = wl - 1 - k;
      for (let x = CH_L; x < CH_R; x++) {
        if (y < archY(x)) continue;
        let c;
        if (k === 0) c = mod(x + a4 * 2, 19) < 6 ? "v" : "w";
        else {
          c = sy >= 0 ? REF[r.get(x + dx, sy)] || "p" : "p";
          if (k > 14) c = DEEP[c] || c;
          if ((k === 3 || k === 7 || k === 12) && mod(x - a4 + k * 11, 29) < 3) c = "w";
        }
        r.set(x, y, c);
      }
    }
  }
  const PIGEON = {                            // 12×9，朝右；深一点的灰，在亮橱窗前也看得清
    a: ["........xx..", ".......xxjv.", ".......nC...", "..vvvvvvn...", ".ywwwwwwww..", "yywyywwwww..", "y..xxwwww...", ".....xxx....", ".....D.D...."],
    b: [".........xx.", "........xxjv", "........nC..", "..vvvvvvvn..", ".ywwwwwwww..", "yywyywwwww..", "y..xxwwww...", ".....xxx....", "....D...D..."],
    peck: ["............", "............", "............", "..vvvvvvv...", ".ywwwwwwwnC.", "yywyywwwwwxx", "y..xxwwwwxjv", ".....xxx....", ".....D.D...."],
  };
  function drawPigeon(r, tick) {              // 提示动物：鸽子在广场来回踱步，走到头啄两下
    const span = 34, walk = span * 2, cyc = 2 * (walk + 16), p = mod(tick, cyc);
    let x, right = true, art;
    if (p < walk) { x = 10 + (p >> 1); art = p & 2 ? PIGEON.b : PIGEON.a; }
    else if (p < walk + 16) { x = 10 + span; art = (p >> 2) & 1 ? PIGEON.peck : PIGEON.a; }
    else if (p < 2 * walk + 16) { x = 10 + span - ((p - walk - 16) >> 1); right = false; art = p & 2 ? PIGEON.b : PIGEON.a; }
    else { x = 10; right = false; art = (p >> 2) & 1 ? PIGEON.peck : PIGEON.a; }
    rows(r, art, x, FLOOR - 9, !right);
  }
  function drawFlood(r, P, a4) {              // 涨潮：水从排水口冒上来，漫过石板再退下
    if (P >= 50 && P < 96) for (const d of DRAINS) { r.set(d + (a4 & 1 ? 1 : -1), FLOOR - 1 - (a4 % 3), "u"); r.set(d, FLOOR - 1, "v"); }
    const rad = floodR(P);
    if (!rad) return;
    for (let x = 0; x < CAMPO_R; x++) {
      const dd = Math.min(Math.abs(x - DRAINS[0]), Math.abs(x - DRAINS[1]));
      if (dd > rad) continue;
      const glint = mod(x * 7 + a4 * 3, 41) === 0 ? "u" : "v";
      if (dd <= rad - 16) { r.set(x, FLOOR - 2, glint); r.set(x, FLOOR - 1, "w"); } else r.set(x, FLOOR - 1, glint);
      r.set(x, FLOOR, "w");
    }
  }
  function drawMist(r, wl, a4) {              // 运河上的薄雾：稀疏的抖动点，慢慢往右飘
    const h32 = window.PB.h32;
    for (let y = wl - 9; y < wl + 2; y++) {
      const fall = 6 - Math.abs(y - (wl - 4));
      if (fall <= 0) continue;
      for (let x = CH_L; x < CH_R; x++) {
        if (front.data[(y * W + x) * 4 + 3] && y < wl) continue;
        const u = x - a4, i0 = Math.floor(u / 16), f = mod(u, 16);
        const d = ((h32(i0, 7, 5) & 7) * (16 - f) + (h32(i0 + 1, 7, 5) & 7) * f) >> 4;
        if (bay(u, y) >= (d * fall) >> 2) continue;
        const c = r.get(x, y); r.set(x, y, MIST[c] || c);
      }
    }
  }

  scenes.venice = {
    draw(ctx, tick) {
      if (!back) build();
      const t = tick | 0, a4 = t >> 1, P = mod(a4, 160), wl = level(P);
      buf.data.set(back.data);
      drawWindows(buf, a4);
      drawGull(buf, t);
      drawGondola(buf, 186 + tri(a4, 240, 48), wl + tri(a4, 12, 1));
      buf.blit(front, 0, 0);
      drawRaft(buf, wl);
      drawWater(buf, wl, a4);
      drawPigeon(buf, t);
      drawFlood(buf, P, a4);
      drawMist(buf, wl, a4);
      ctx.putImageData(img, 0, 0);
    },
  };
})();