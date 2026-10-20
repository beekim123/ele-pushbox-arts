/* 地图概念场景：雨林天然井（cenote）· ART-04b。只看大致效果：不是关卡、不是正式资产，不走美术确认。
 * 接口（WB-05）：PB_CONCEPT_SCENES.cenote = { draw(ctx, tick) }，在 320×180 画布上画一帧，tick 每秒加 8。
 * 只用 ENDESGA 32（只读调用 core/raster.js 的 PB.RGB、PB.LIGHT、PB.h32），整数像素、不抗锯齿；
 * 环境效果 4 fps（tick >> 1），动物 8 fps。
 * 地标：阶梯金字塔（台阶旁有春分光影羽蛇）、井口垂下的藤蔓和光柱、历法石碑。
 * 机关外观：碎石堆（gravel）、地面小溪流进井里（water_flow）、日月石盘（day_night）。
 * 环境：光柱慢慢晃、井水泛波光、藤蔓轻轻摆。怪物：美洲豹在高岩上踱步；提示动物：巨嘴鸟在石碑顶上歪头。
 * 比例尺：主角大小的人影和两个木箱（不动）。不画收件人、货物、界面和文字。 */
(function (root) {
  "use strict";
  const W = 320, H = 180, CODES = "abcdefghijklmnopqrstuvwxyzABCDEF", NONE = 255;
  const IDX = {};
  for (let i = 0; i < CODES.length; i++) IDX[CODES[i]] = i;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const buf = new Uint8Array(W * H);
  let target = buf, BG = null, FG = null;

  // ---------- 画图工具：一个像素存一个调色板字母 ----------
  const PB = () => root.PB;
  function set(x, y, c) { if (c === "." || x < 0 || y < 0 || x >= W || y >= H) return; target[y * W + x] = IDX[c]; }
  function get(x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return "."; const v = target[y * W + x]; return v === NONE ? "." : CODES[v]; }
  function rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); }
  function line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let k = 0; k <= n; k++) set(x0 + Math.round(((x1 - x0) * k) / n), y0 + Math.round(((y1 - y0) * k) / n), c); }
  function blit(g, x, y, flip) { for (let j = 0; j < g.length; j++) { const r = g[j], n = r.length; for (let i = 0; i < n; i++) set(x + i, y + j, r[flip ? n - 1 - i : i]); } }
  function dith(x, y, level) { return BAYER[(y & 3) * 4 + (x & 3)] < level; }
  function tri(t, period, amp) { const p = ((t % period) + period) % period, half = period >> 1, v = p < half ? p : period - p; return Math.floor((v * 4 * amp) / period) - amp; }
  function hash(x, y, s) { return PB().h32(x, y, s); }
  function lighten(x, y) { const c = get(x, y), n = PB().LIGHT[c]; if (n && n !== "t" && n !== "l" && n !== "k") set(x, y, n); }
  function layer(paint, fill) { const L = new Uint8Array(W * H).fill(fill ? IDX[fill] : NONE), prev = target; target = L; paint(); target = prev; return L; }
  function paste(L) { for (let i = 0; i < W * H; i++) if (L[i] !== NONE) buf[i] = L[i]; }
  function flush(ctx) {
    const RGB = PB().RGB, img = ctx.createImageData(W, H), d = img.data;
    for (let i = 0, o = 0; i < W * H; i++, o += 4) { const c = RGB[CODES[buf[i]]]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }
  // 小精灵：先在临时格子里画，再加 1px 深色描边。
  function sprite(w, h, paint) { const g = []; for (let j = 0; j < h; j++) g.push(new Array(w).fill(".")); paint((x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; }); return g; }
  function outline(g, c) {
    const h = g.length, w = g[0].length, o = g.map((r) => r.slice()), at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== ".";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === "." && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) o[y][x] = c;
    return o;
  }

  // ---------- 比例尺：主角大小的人影、木箱 ----------
  const HERO = [
    "................",
    "................",
    "................",
    "......zzzz......",
    ".....zkllkz.....",
    "....zkkkkkkz....",
    "..zzkkkkkkkkzz..",
    ".zkkkkkkkkkkkbz.",
    "..zzzzzzzzzzzz..",
    "....zEEEEEz.....",
    "....zEEEzEz.....",
    "...zhiiiiihz....",
    "...ziiiiiiiz....",
    "...zhiiiiihz....",
    "....zfz.zfz.....",
    "....zzz.zzz.....",
  ];
  const BOX = sprite(16, 16, (p) => {
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const dg = i + j - 15;
      p(i, j, i === 0 || j === 0 || i === 15 || j === 15 ? "z" : i === 1 || j === 1 ? "d" : i === 14 || j === 14 ? "f"
        : i === 2 || j === 2 || i === 13 || j === 13 ? "b" : dg === -1 ? "d" : dg === 0 || dg === 1 ? "b" : "e");
    }
  });

  // ---------- 房间：16px 一格；# 石灰岩，~ 井水，. 空 ----------
  const GRID = [
    "....................",
    "....................",
    "....................",
    "...............###..", // 美洲豹的高岩（顶 y=48）
    "#######......#######", // 雨林地面（顶 y=64），中间塌开
    "######........######",
    "##..............####",
    "#................###",
    "#####..........#####", // 井边石台（顶 y=128）
    "#####~~~~~~~~~~#####", // 井水 x=80–239
    "#####~~~~~~~~~~#####",
    "####################",
  ];
  const cell = (tx, ty) => (tx < 0 || tx > 19 || ty > 11 ? "#" : ty < 0 ? "." : GRID[ty][tx]);
  const WATER_Y = 148, POOL_X0 = 80, POOL_X1 = 240;
  const SHAFTS = [[121, 8, 0], [149, 12, 9], [181, 6, 17]]; // y=64 处的左边 x、宽、晃动相位
  const shaftX = (s, y, env) => s[0] + tri(env + s[2], 40, 3) + Math.floor(((y - 64) * 2) / 5);

  // ---------- 背景（静态，缓存） ----------
  function pyramid() {
    const cx = 160;
    rect(cx - 6, 7, 12, 3, "w"); rect(cx - 6, 7, 12, 1, "v");
    rect(cx - 10, 10, 20, 1, "v");
    rect(cx - 9, 11, 18, 11, "w"); rect(cx + 7, 11, 2, 11, "x"); rect(cx - 2, 15, 4, 7, "y");
    for (let i = 0; i < 5; i++) {
      const y0 = 22 + i * 8, hw = 14 + i * 9;
      for (let y = y0; y < y0 + 8; y++) for (let x = cx - hw; x < cx + hw; x++)
        set(x, y, y === y0 ? "v" : x >= cx + hw - 2 || y === y0 + 1 || (x - cx + 64) % 6 === 0 ? "x" : "w");
    }
    for (let y = 22; y < 64; y++) for (let x = cx - 5; x < cx + 5; x++) set(x, y, x === cx - 5 || x === cx + 4 || (y & 1) ? "x" : "w");
    // 春分时台阶旁的光影羽蛇：一串亮三角
    for (let y = 24; y < 60; y++) { const k = (y - 24) % 8, n = k < 4 ? k : 7 - k; for (let i = 0; i < n; i++) set(cx - 6 - i, y, "v"); }
  }
  const GAPS = [[92, 112], [122, 144], [154, 166]];
  function canopy() {
    for (let x = 0; x < W; x++) {
      let bottom = 11 + tri(x, 18, 2) + tri(x + 5, 34, 3) + (hash(x >> 1, 5, 21) % 3);
      for (const [a, b] of GAPS) if (x >= a && x < b) bottom = Math.min(bottom, Math.max(0, 7 - 2 * Math.min(x - a, b - 1 - x)));
      for (let y = 0; y < bottom; y++) set(x, y, y >= bottom - 2 ? "p" : hash(x >> 1, y >> 1, 22) % 5 === 0 ? "n" : "o");
      if (bottom > 3 && hash(x, 7, 22) % 6 === 0) for (let y = bottom; y < bottom + 2 + (hash(x, 8, 22) % 4); y++) set(x, y, "o");
    }
  }
  function trunks() {
    for (const [x0, w] of [[4, 10], [298, 12]]) for (let y = 0; y < 64; y++) {
      const flare = y > 54 ? (y - 54) >> 1 : 0;
      for (let i = -flare; i < w + flare; i++) set(x0 + i, y, i <= 1 - flare ? "f" : hash(i, y >> 2, 24) % 5 === 0 ? "f" : "g");
      if (hash(x0, y >> 3, 25) % 3 === 0) set(x0 + 3 + (y & 3), y, "o");
    }
  }
  function fern(x0, y0, s) {
    for (let k = -2; k <= 2; k++) {
      const ex = x0 + k * s, ey = y0 - 2 * s - 3 + Math.abs(k) * s;
      line(x0, y0 - 1, ex, ey, "o");
      line(x0 + (k < 0 ? -1 : k > 0 ? 1 : 0), y0 - 2, ex, ey - 1, k <= 0 ? "n" : "o");
      set(ex + (k < 0 ? -1 : 1), ey, k <= 0 ? "m" : "n");
    }
  }
  function paintBackground() {
    for (let y = 0; y < 64; y++) for (let x = 0; x < W; x++) set(x, y, "v");
    pyramid();
    for (let x = 0; x < W; x++) {
      const top = 47 + tri(x, 26, 3) + tri(x + 11, 46, 3) + (hash(x >> 2, 0, 15) & 1);
      for (let y = top; y < 64; y++) set(x, y, y < top + 2 || (hash(x >> 1, y >> 1, 16) & 3) === 0 ? "o" : "p");
    }
    // 井的后壁：偏冷、偏暗的石灰岩，越往下越暗
    for (let y = 60; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 17), n = noise(x, y, 18);
      let c = n < 5 ? (h % 5 ? "y" : "x") : n > 11 ? (h % 4 ? "w" : "x") : h % 13 === 0 ? "y" : "x";
      if ((y + (hash(x >> 4, 2, 18) % 5)) % 14 === 0 && h % 3) c = "y";
      if (y > 118 && dith(x, y, Math.min(12, (y - 118) >> 2))) c = c === "w" ? "x" : "y";
      set(x, y, c);
    }
    for (let x = 0; x < W; x++) { const g = 61 + (hash(x, 0, 19) % 3); for (let y = 59 + (hash(x, 1, 19) & 1); y < g; y++) set(x, y, "o"); set(x, g, "p"); }
    for (let k = 0; k < 9; k++) { const x = 14 + k * 35 + (hash(k, 3, 20) % 12), len = 16 + (hash(k, 4, 20) % 44); for (let j = 0; j < len; j++) set(x + ((j >> 3) & 1), 62 + j, "p"); }
    trunks(); canopy();
  }

  // ---------- 前景（静态，缓存）：石灰岩、小溪的河床、石碑、日月石盘、碎石堆 ----------
  // 平滑噪声 0–15（8px 一格双线性插值），用来画成片的亮石灰岩和暗斑。
  function noise(x, y, s) {
    const gx = x >> 3, gy = y >> 3, fx = x & 7, fy = y & 7;
    const a = hash(gx, gy, s) & 15, b = hash(gx + 1, gy, s) & 15, c = hash(gx, gy + 1, s) & 15, d = hash(gx + 1, gy + 1, s) & 15;
    return ((a * (8 - fx) + b * fx) * (8 - fy) + (c * (8 - fx) + d * fx) * fy) >> 6;
  }
  function stone(x, y, depth) {
    const h = hash(x, y, 11), n = noise(x, y, 13) - (depth >> 3);
    if ((y + (hash(x >> 3, 1, 12) % 3)) % 11 === 0 && (h & 3) !== 0) return "F";
    if (h % 29 === 0) return "e";
    if (n > 10) return h % 7 === 0 ? "F" : "c";
    if (n < 7) return h % 11 === 0 ? "e" : "F";
    return dith(x, y, (n - 6) * 4) ? "c" : "F";
  }
  function terrain() {
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 20; tx++) {
      if (cell(tx, ty) !== "#") continue;
      const up = cell(tx, ty - 1), dn = cell(tx, ty + 1) === "#", lf = cell(tx - 1, ty) === "#", rt = cell(tx + 1, ty) === "#", top = up !== "#";
      let above = 0;
      while (above < 3 && ty - 1 - above >= 0 && cell(tx, ty - 1 - above) === "#") above++;
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
        if ((top && !lf && i + j < 2) || (top && !rt && 15 - i + j < 2) || (!dn && !lf && i + 15 - j < 2) || (!dn && !rt && 30 - i - j < 2)) continue;
        const x = tx * 16 + i, y = ty * 16 + j;
        let c = stone(x, y, above * 16 + j);
        if (top && j === 0) c = up === "." ? "n" : "c";
        else if (top && j === 1) c = up === "." && hash(x, y, 14) % 3 === 0 ? "o" : "c";
        else if (!dn && j === 15) c = "e";
        else if (!lf && i === 0) c = "c";
        else if (!rt && i === 15) c = "e";
        set(x, y, c);
      }
      if (up === ".") for (let i = 0; i < 16; i++) {
        const x = tx * 16 + i, y = ty * 16, h = hash(x, y, 26);
        if (h % 4 === 0) set(x, y - 1, "n");
        if (h % 9 === 0) set(x, y - 2, "m");
        if (h % 7 === 0) set(x, y, "m");
      }
      if (!dn && cell(tx, ty + 1) === ".") for (let i = 1; i < 15; i++) {
        const x = tx * 16 + i, y = ty * 16 + 16, h = hash(x, y, 27);
        if (h % 6 === 0) for (let k = 0; k < 1 + ((h >> 4) % 4); k++) set(x, y + k, k ? "f" : "e");
      }
    }
  }
  function stela(x0, y0) {
    for (let j = 0; j < 29; j++) for (let i = 1; i < 15; i++) {
      if ((j === 0 && (i < 4 || i > 11)) || (j === 1 && (i < 2 || i > 13))) continue;
      set(x0 + i, y0 + j, i <= 2 || j <= 1 ? "c" : i >= 13 ? "e" : "F");
    }
    for (let j = 3; j < 26; j++) { set(x0 + 3, y0 + j, "e"); set(x0 + 12, y0 + j, "e"); }
    for (let i = 3; i < 13; i++) { set(x0 + i, y0 + 3, "e"); set(x0 + i, y0 + 25, "e"); }
    for (let r = 0; r < 5; r++) for (let k = 0; k < 2; k++) {
      // 历法符号：点和横道的数字、圆圈字符（只是花纹，不是文字）
      const gx = x0 + 4 + k * 4, gy = y0 + 5 + r * 4, h = hash(r, k, 23) % 3;
      if (h === 0) { set(gx, gy, "f"); set(gx + 2, gy, "f"); rect(gx, gy + 2, 3, 1, "f"); }
      else if (h === 1) { rect(gx, gy, 3, 3, "e"); set(gx + 1, gy + 1, "c"); }
      else { set(gx + 1, gy, "f"); rect(gx, gy + 2, 3, 1, "f"); }
    }
    rect(x0, y0 + 29, 16, 3, "e"); rect(x0, y0 + 29, 16, 1, "F"); rect(x0, y0 + 29, 1, 3, "F");
    for (let i = 0; i < 16; i += 3) set(x0 + i + (hash(i, 0, 28) & 1), y0 + 31, "n");
  }
  function dial(cx, ground) {
    rect(cx - 4, ground - 2, 9, 2, "w"); rect(cx - 4, ground - 2, 9, 1, "v");
    rect(cx - 2, ground - 13, 5, 11, "v"); rect(cx - 2, ground - 13, 1, 11, "u"); rect(cx + 2, ground - 13, 1, 11, "w");
    const cy = ground - 19;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const r2 = dx * dx + dy * dy;
      if (r2 > 38) continue;
      let c;
      if (r2 > 26) c = "z";
      else if (dx === 0) c = "w";
      else if (dx < 0) c = (dx + 3) * (dx + 3) + dy * dy <= 3 ? "l" : "j";
      else c = (dx - 3) * (dx - 3) + dy * dy <= 6 && (dx - 4) * (dx - 4) + (dy + 1) * (dy + 1) > 3 ? "u" : "y";
      set(cx + dx, cy + dy, c);
    }
  }
  function gravel(x0, ground) {
    for (let i = 0; i < 32; i++) {
      const hgt = Math.max(0, 11 - Math.floor((Math.abs(i - 15) * 3) / 4) - (hash(i, 0, 50) % 3 === 0 ? 1 : 0));
      for (let j = 0; j < hgt; j++) {
        const x = x0 + i, y = ground - 1 - j, ry = y >> 1, sx = x + (ry & 1) * 2, ix = sx % 3, iy = y & 1, h = hash(Math.floor(sx / 3), ry, 51) % 4;
        let c = h === 0 ? "w" : "v";
        if (ix === 0 && iy === 0) c = h === 0 ? "v" : "u";
        if (ix === 2 && iy === 1) c = "x";
        set(x, y, c);
      }
    }
  }
  function paintForeground() {
    terrain();
    // 泉眼在高岩左脚，溪水沿地面流到井口（水是动的，见 stream()）
    rect(240, 57, 3, 7, "y"); rect(208, 67, 36, 1, "e");
    fern(20, 64, 3); fern(68, 64, 2); fern(104, 64, 3); fern(292, 64, 3); fern(313, 64, 2); fern(226, 128, 2);
    stela(36, 32); dial(90, 64); gravel(240, 128);
  }

  // ---------- 每帧会动的部分 ----------
  function shafts(env) {
    for (const s of SHAFTS) for (let y = 6; y < WATER_Y; y++) {
      const x0 = shaftX(s, y, env), w = s[1];
      for (let i = -1; i <= w; i++) {
        const x = x0 + i;
        if ((i <= 0 || i >= w - 1) && !dith(x, y, 8)) continue;
        if (y < 14 && !dith(x, y, (y - 6) * 2)) continue;
        lighten(x, y);
      }
    }
  }
  function pool(env) {
    for (let y = WATER_Y; y < 176; y++) for (let x = POOL_X0; x < POOL_X1; x++) {
      const d = y - WATER_Y;
      set(x, y, d === 0 ? "s" : d < 4 ? "r" : d < 12 ? (dith(x, y, 16 - (d - 4) * 2) ? "r" : "q") : d > 22 && dith(x, y, 4) ? "p" : "q");
    }
    // 波光：水面亮点时隐时现，水下的亮纹慢慢移动
    for (let x = POOL_X0; x < POOL_X1; x++) if (hash(x >> 1, (env >> 1) + (x >> 4), 41) % 11 === 0) set(x, WATER_Y, "t");
    for (const [yy, dir] of [[WATER_Y + 3, 1], [WATER_Y + 6, -1], [WATER_Y + 10, 1]])
      for (let x = POOL_X0; x < POOL_X1; x++) if ((((x + env * dir + yy * 7) % 29) + 29) % 29 < 2 + (yy & 1)) set(x, yy, yy - WATER_Y < 5 ? "s" : "r");
  }
  function stream(env) {
    for (let x = 208; x < 243; x++) { set(x, 64, (x + env) % 7 === 0 ? "t" : "s"); set(x, 65, "r"); set(x, 66, (x - env) % 5 === 0 ? "s" : "q"); }
    set(242, 63, "s"); set(241, 62, "r");
    for (let y = 64; y < WATER_Y; y++) {
      const bend = y < 70 ? (70 - y) >> 1 : 0;
      for (let i = 0; i < 5; i++) {
        const ph = (y - env * 3 + i * 5) & 7;
        set(203 + i + bend, y, i === 4 ? "q" : i === 0 || ph < 2 ? "s" : "r");
      }
    }
    for (let k = -5; k <= 9; k++) if ((k + env) % 3 === 0) set(204 + k, WATER_Y - 1 - ((k + 5 + env) & 1), "t");
    const rr = 3 + (env % 5) * 3;
    set(205 - rr, WATER_Y + 1, "s"); set(205 + rr, WATER_Y + 1, "s");
  }
  const VINES = [[99, 80, 44, 0], [105, 80, 60, 7], [110, 80, 30, 3], [88, 96, 24, 11], [214, 80, 50, 5], [220, 80, 34, 13], [231, 96, 28, 2]];
  function vines(env) {
    for (const [ax, ay, len, ph] of VINES) {
      const sw = tri(env + ph, 36, len > 40 ? 3 : 2);
      for (let j = 0; j < len; j++) {
        const x = ax + Math.trunc((sw * j) / len), y = ay + j, side = (j >> 2) & 1 ? 1 : -1;
        set(x, y, "o");
        if ((j & 3) === 2) { set(x + side, y, "n"); set(x + side * 2, y + 1, "n"); set(x + side, y + 1, "m"); }
      }
    }
  }

  // ---------- 动物 ----------
  function jaguar(f) {
    return outline(sprite(26, 14, (p) => {
      const near = [0, 1, 0, -1][f], far = -near, tip = [[2, 2], [1, 3], [2, 4], [3, 3]][f];
      p(6, 5, "b"); p(5, 5, "b"); p(4, 4, "b"); p(3, 3, "b"); p(tip[0], tip[1], "f");
      for (let k = 0; k < 3; k++) { p(10 + far, 10 + k, "e"); p(11 + far, 10 + k, "e"); p(17 + far, 10 + k, "e"); p(18 + far, 10 + k, "e"); }
      for (let y = 4; y <= 9; y++) for (let x = 7; x <= 18; x++) {
        if ((y === 4 || y === 9) && (x === 7 || x === 18)) continue;
        p(x, y, y === 4 ? "d" : y === 9 && x > 8 && x < 17 ? "c" : "b");
      }
      for (const [x, y] of [[9, 6], [12, 5], [15, 6], [10, 8], [13, 7], [16, 8], [8, 7]]) p(x, y, "f");
      for (let y = 2; y <= 8; y++) for (let x = 18; x <= 23; x++) {
        if ((y === 2 && (x === 18 || x === 23)) || (y === 8 && x > 21)) continue;
        p(x, y, y <= 3 ? "d" : "b");
      }
      p(19, 1, "b"); p(22, 1, "b"); p(21, 4, "z"); p(23, 5, "f"); p(22, 6, "c"); p(23, 6, "c"); p(22, 7, "c"); p(20, 6, "f");
      for (let k = 0; k < 3; k++) { p(8 + near, 10 + k, "b"); p(9 + near, 10 + k, "b"); p(15 + near, 10 + k, "b"); p(16 + near, 10 + k, "b"); }
      p(8 + near, 12, "d"); p(15 + near, 12, "d");
    }), "z");
  }
  function toucan(tilt) {
    return outline(sprite(16, 16, (p) => {
      p(3, 12, "y"); p(2, 13, "y"); p(3, 13, "y"); p(1, 14, "y"); p(2, 14, "y");
      for (let y = 7; y <= 13; y++) for (let x = 4; x <= 9; x++) if (!((y === 7 || y === 13) && (x === 4 || x === 9))) p(x, y, "y");
      p(5, 8, "x"); p(5, 9, "x"); p(6, 8, "x");
      for (let y = 7; y <= 9; y++) { p(8, y, "c"); p(9, y, "c"); }
      p(6, 13, "i"); p(7, 13, "i"); p(6, 14, "w"); p(8, 14, "w");
      for (let y = 3; y <= 7; y++) for (let x = 6; x <= 9; x++) if (!(y === 3 && (x === 6 || x === 9))) p(x, y, y === 7 && x >= 8 ? "c" : "y");
      if (!tilt) { p(9, 5, "m"); for (let x = 10; x <= 13; x++) p(x, 5, "k"); for (let x = 10; x <= 14; x++) p(x, 6, "j"); for (let x = 10; x <= 12; x++) p(x, 7, "a"); }
      else { p(9, 6, "m"); for (let x = 10; x <= 12; x++) p(x, 6, "k"); for (let x = 10; x <= 13; x++) p(x, 7, "j"); for (let x = 11; x <= 14; x++) p(x, 8, "j"); p(12, 9, "a"); p(13, 9, "a"); }
    }), "z");
  }
  const JAGUAR = [0, 1, 2, 3].map(jaguar), TOUCAN = [toucan(false), toucan(true)];

  function draw(ctx, tick) {
    tick = Math.max(0, tick | 0);
    const env = tick >> 1;
    if (!BG) { BG = layer(paintBackground, "z"); FG = layer(paintForeground); }
    buf.set(BG);
    shafts(env);
    paste(FG);
    pool(env); stream(env); vines(env);
    // 美洲豹：在高岩上来回踱步，走到头停一下
    const span = 20, pause = 10, p = tick % (2 * (span + pause));
    let dx, left = false, moving = true;
    if (p < span) dx = p;
    else if (p < span + pause) { dx = span; moving = false; }
    else if (p < 2 * span + pause) { dx = 2 * span + pause - p; left = true; }
    else { dx = 0; left = true; moving = false; }
    blit(JAGUAR[moving ? tick & 3 : 0], 241 + dx, 48 - 14, left);
    // 巨嘴鸟：站在石碑顶上，隔一会儿歪一下头
    const tp = tick % 24;
    blit(TOUCAN[tp >= 12 && tp < 20 ? 1 : 0], 37, 32 - 16, false);
    blit(HERO, 20, 112); blit(BOX, 44, 112); blit(BOX, 60, 112);
    flush(ctx);
  }

  root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  root.PB_CONCEPT_SCENES.cenote = { draw };
})(typeof window !== "undefined" ? window : globalThis);