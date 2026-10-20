/* 地图概念场景：奇幻仙境（wonderland）· ART-04b。只看大致效果：不是关卡、不是正式资产，不走美术确认。
 * 接口（WB-05）：PB_CONCEPT_SCENES.wonderland = { draw(ctx, tick) }，在 320×180 画布上画一帧，tick 每秒加 8。
 * 只用 ENDESGA 32（只读调用 core/raster.js 的 PB.RGB、PB.LIGHT、PB.h32），整数像素、不抗锯齿；
 * 环境效果 4 fps（tick >> 1），动物 8 fps。
 * 地标：巨型蘑菇和毛毛虫、下午茶长桌（茶壶、茶杯、点心架）、兔子洞；背景是红心皇后玫瑰园的修剪树篱。
 * 机关外观：会弹的蘑菇伞盖（bounce）、桌上的药水瓶和蘑菇脚下的小门（size_change）、兔子洞里的旋涡（portal）。
 * 环境：蘑菇伞盖一鼓一鼓地弹，花瓣和扑克牌在空中慢慢飘落。怪物：扑克牌士兵来回巡逻；
 *   提示动物：柴郡猫趴在树枝上，身子隐去只剩笑脸，笑脸也时隐时现。
 * 比例尺：主角大小的人影和一个木箱（不动）。不画收件人（白兔、疯帽子）、货物、界面和文字（药水瓶的标签是空白的）。 */
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

  // ---------- 房间：16px 一格；# 草地和紫色的土，. 空 ----------
  const GRID = [
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "###############..###", // 草地（顶 y=144），兔子洞 x=240–271
    "###############..###",
    "####################",
  ];
  const cell = (tx, ty) => (tx < 0 || tx > 19 || ty > 11 ? "#" : ty < 0 ? "." : GRID[ty][tx]);
  const solid = (x, y) => cell(x >> 4, y >> 4) === "#";
  const GROUND = 144, HOLE_X0 = 240, HOLE_X1 = 272, TABLE_Y = 130, BRANCH_Y = 62;
  // 巨型蘑菇：伞盖中心 x、伞盖底 y、半宽、高、弹的相位
  const MUSH = [[40, 94, 28, 16, 0], [86, 118, 20, 11, 3]];
  const SPOTS = [[[-0.55, 0.35, 2], [-0.1, 0.62, 3], [0.45, 0.42, 2], [0.2, 0.22, 1]], [[-0.45, 0.45, 2], [0.3, 0.58, 2], [0.62, 0.22, 1]]];
  const BOUNCE = [0, 0, 1, 2, 2, 1, 0, 0]; // 一鼓一鼓：每 1/4 秒压扁 0–2px

  // ---------- 背景（静态，缓存）：天、云、柴郡猫的树、红心皇后玫瑰园的树篱 ----------
  function blob(cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const lit = (dx + 3) * (dx + 3) + (dy + 3) * (dy + 3) < (r * r) / 3, h = hash(cx + dx, cy + dy, 83);
      set(cx + dx, cy + dy, lit ? (h % 5 ? "n" : "o") : dx + dy > (r * 2) / 3 ? "p" : h % 9 === 0 ? "p" : "o");
    }
  }
  function cone(cx, apex, base) {
    for (let y = apex; y < base; y++) {
      const hw = Math.floor(((y - apex) * 9) / (base - apex)) + 1;
      for (let x = cx - hw; x <= cx + hw; x++) set(x, y, x < cx - hw / 3 ? "n" : x > cx + hw / 2 ? "p" : (y + x) % 7 === 0 ? "p" : "o");
    }
  }
  function paintBackground() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, y < 6 ? "w" : dith(x, y, Math.min(16, (y - 6) >> 1)) ? "v" : "w");
    // 远处一道道紫色的山坡（比树篱暗、对比低）
    for (let x = 0; x < W; x++) {
      const top = (x < 96 ? 96 - ((x * 3) >> 5) : 82) + tri(x + 22, 120, 7) + tri(x, 52, 2);
      for (let y = top; y < 106; y++) set(x, y, y === top ? (dith(x, y, 8) ? "C" : "B") : (hash(x >> 1, y >> 1, 89) % 11 === 0 ? "C" : "B"));
    }
    for (const [cx, cy, s] of [[64, 22, 1], [190, 12, 2]]) for (let k = 0; k < 4; k++) {
      const bx = cx + (k - 1) * 9, r = 5 + (hash(k, s, 80) % 4), by = cy + (k === 0 || k === 3 ? 2 : 0);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && by + dy <= cy + 5) set(bx + dx, by + dy, "v");
    }
    // 柴郡猫趴的树：树干、往左伸的树枝、上面一团树冠
    for (let y = 30; y < 106; y++) for (let x = 300; x < 309; x++) set(x, y, x === 300 ? "e" : x > 306 ? "g" : (hash(x, y >> 2, 86) & 3) === 0 ? "g" : "f");
    for (let x = 258; x < 302; x++) { const y = BRANCH_Y + (x < 266 ? -((266 - x) >> 2) : 0); set(x, y, "e"); set(x, y + 1, "f"); set(x, y + 2, "g"); }
    set(257, BRANCH_Y - 3, "f"); set(256, BRANCH_Y - 4, "f"); set(256, BRANCH_Y - 5, "e");
    for (const [cx, cy, r] of [[284, 26, 11], [298, 18, 15], [314, 26, 12], [306, 36, 9], [290, 36, 8]]) blob(cx, cy, r);
    // 树篱：修得平平的，上面露出圆球、圆锥、叠起来的造型树
    cone(118, 72, 105);
    blob(186, 96, 8); blob(186, 84, 6); blob(186, 75, 4);
    blob(232, 95, 8); rect(231, 103, 3, 2, "f");
    for (let x = 0; x < W; x++) {
      const top = 104 + (((x >> 3) + 1) % 5 === 0 ? 1 : 0);
      for (let y = top; y < GROUND; y++) {
        const h = hash(x >> 1, y >> 1, 82);
        set(x, y, y === top ? "n" : y > 136 && dith(x, y, (y - 136) * 2) ? "p" : h % 7 === 0 ? "p" : h % 13 === 0 ? "n" : "o");
      }
    }
    // 玫瑰：红的、白的，还有刷了一半红漆的
    for (let k = 0; k < 19; k++) {
      const x = 6 + k * 17 + (hash(k, 0, 87) % 9), y = 109 + (hash(k, 1, 87) % 24), t = hash(k, 2, 87) % 4;
      const a = t === 1 ? "u" : "i", b = t === 1 ? "v" : t === 2 ? "u" : "h";
      set(x, y, a); set(x + 1, y, t === 2 ? "u" : a); set(x, y + 1, a); set(x + 1, y + 1, b); set(x - 1, y + 1, "n");
    }
  }

  // ---------- 前景（静态，缓存）：草地、蘑菇柄和小门、下午茶长桌 ----------
  function terrain() {
    for (let y = GROUND; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(x, y)) continue;
      const d = y - GROUND, h = hash(x, y, 84);
      let c = d === 0 ? "m" : d < 3 ? (d === 1 || h % 3 ? "n" : "m") : d === 3 ? (h % 2 ? "o" : "n") : h % 29 === 0 ? "C" : h % 31 === 0 ? "g" : "B";
      if (d > 12 && dith(x, y, Math.min(12, (d - 12) >> 1))) c = c === "C" ? "B" : "g";
      if (x === HOLE_X0 - 1 && d > 3) c = "g";
      if (x === HOLE_X1 && d > 3) c = "C";
      set(x, y, c);
    }
    for (let x = 0; x < W; x++) {
      if (!solid(x, GROUND)) continue;
      const h = hash(x, 0, 85);
      if (h % 3 === 0) set(x, GROUND - 1, "m");
      if (h % 7 === 0) set(x, GROUND - 2, "n");
      if (h % 23 === 0 && (x < 140 || x > 232)) { set(x, GROUND - 2, "n"); set(x, GROUND - 3, "D l u".split(" ")[h % 3]); }
    }
    // 兔子洞口：草皮往里垂
    for (const [x, n] of [[HOLE_X0, 3], [HOLE_X0 + 1, 2], [HOLE_X0 + 2, 1], [HOLE_X1 - 1, 3], [HOLE_X1 - 2, 2], [HOLE_X1 - 3, 1]]) for (let k = 0; k < n; k++) set(x, GROUND + k, k ? "n" : "m");
  }
  function stem(cx, top, half) {
    for (let y = top; y < GROUND; y++) {
      const flare = y > GROUND - 7 ? (y - (GROUND - 7)) >> 1 : 0, x0 = cx - half - flare, n = 2 * (half + flare);
      for (let i = 0; i <= n; i++) set(x0 + i, y, i <= 1 ? "c" : i >= n - 1 ? "F" : i >= n - 3 ? "E" : (hash(i, y >> 2, 88) & 7) === 0 ? "E" : "c");
    }
    for (let x = cx - half - 2; x <= cx + half + 2; x++) { set(x, top + 5, "c"); set(x, top + 6, x > cx + half - 1 ? "F" : "E"); }
  }
  function tinyDoor(x0, ground) {
    // 蘑菇脚下的小门：比人影还矮，提示“变大变小”
    const rows = ["..fff..", ".fhhhf.", "fhihhhf", "fhihhhf", "fhihhkf", "fhihhhf", "fhihhhf", "fhihhhf", "fffffff"];
    rows.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] !== ".") set(x0 + i, ground - rows.length + j, r[i]); });
  }
  function teapot(cx, by) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) {
      if (dx * dx * 16 + dy * dy * 36 > 576) continue;
      set(cx + dx, by - 4 + dy, dx < -1 && dy < 0 ? "C" : dx > 3 || dy > 2 ? "g" : "B");
    }
    set(cx - 3, by - 6, "D"); set(cx - 4, by - 5, "D");
    rect(cx - 3, by - 9, 7, 1, "C"); rect(cx - 2, by - 10, 5, 1, "B"); set(cx, by - 11, "k");
    for (const [x, y] of [[6, -3], [7, -4], [7, -5], [8, -6], [9, -7]]) set(cx + x, by + y, "B");
    set(cx + 9, by - 8, "C");
    for (let y = -6; y <= -2; y++) set(cx - 7, by + y, "B");
    set(cx - 8, by - 5, "B"); set(cx - 8, by - 4, "B"); set(cx - 8, by - 3, "B");
  }
  function cup(cx, by) {
    rect(cx - 3, by, 7, 1, "v"); rect(cx - 2, by - 4, 5, 4, "u"); rect(cx - 2, by - 3, 5, 1, "C"); rect(cx + 2, by - 4, 1, 4, "v");
    set(cx + 3, by - 3, "u"); set(cx + 3, by - 2, "u");
  }
  function cakeStand(cx, by) {
    rect(cx - 5, by, 11, 1, "u"); rect(cx, by - 11, 1, 11, "k"); rect(cx - 4, by - 6, 9, 1, "u");
    rect(cx - 4, by - 2, 3, 2, "D"); rect(cx + 2, by - 2, 3, 2, "E"); set(cx - 3, by - 3, "i"); set(cx + 3, by - 3, "i");
    rect(cx - 3, by - 8, 3, 2, "E"); rect(cx + 1, by - 8, 3, 2, "D"); set(cx - 2, by - 9, "i"); set(cx + 2, by - 9, "i");
  }
  function potion(cx, by) {
    // 药水瓶：标签是空白的（不写字）
    rect(cx - 2, by - 5, 5, 5, "r"); rect(cx - 2, by - 5, 1, 4, "s"); rect(cx - 2, by - 1, 5, 1, "q");
    rect(cx - 1, by - 6, 3, 1, "u"); set(cx, by - 7, "u"); set(cx, by - 8, "u"); set(cx, by - 9, "e");
    set(cx + 1, by - 7, "f"); rect(cx + 2, by - 7, 3, 2, "c");
  }
  function table() {
    const x0 = 144, x1 = 216, ty = TABLE_Y;
    for (const lx of [148, 211]) rect(lx, ty + 9, 2, GROUND - ty - 9, "f");
    for (let x = x0; x < x1; x++) {
      set(x, ty, "u");
      for (let y = ty + 1; y < ty + 8; y++) set(x, y, (x - x0) % 9 === 4 && y > ty + 2 ? "v" : "u");
      for (let y = ty + 8; y < ty + 10; y++) set(x, y, (((x - x0) >> 1) + ((y - ty) >> 1)) & 1 ? "i" : "u");
      if (((x - x0) >> 1) & 1) set(x, ty + 10, "u");
    }
    rect(x1 - 1, ty + 1, 1, 9, "v");
    potion(153, ty - 1); teapot(168, ty - 1); cup(183, ty - 1); cup(194, ty - 1); cakeStand(205, ty - 1);
    // 两把不一样的椅子：左边旧金框红绒，右边紫色（颜色压暗一点，不和人影抢眼）
    rect(133, 136, 2, 8, "f"); rect(141, 136, 2, 8, "f"); rect(132, 134, 12, 2, "h"); rect(132, 134, 12, 1, "i");
    rect(131, 110, 5, 24, "h"); rect(131, 110, 1, 24, "d"); rect(135, 110, 1, 24, "e"); rect(131, 109, 5, 1, "d"); set(133, 108, "e"); set(133, 107, "d");
    for (let y = 114; y < 132; y += 5) set(133, y, "i");
    rect(217, 136, 2, 8, "f"); rect(225, 136, 2, 8, "f"); rect(216, 134, 12, 2, "B"); rect(216, 134, 12, 1, "C");
    rect(224, 112, 5, 22, "B"); rect(224, 112, 1, 22, "C"); rect(228, 112, 1, 22, "g");
    for (let i = 0; i < 5; i++) set(224 + i, 111 - (i === 0 || i === 4 ? 0 : 1), "C");
  }
  function paintForeground() {
    terrain();
    stem(40, 94, 6); stem(86, 118, 4);
    tinyDoor(37, GROUND);
    table();
  }

  // ---------- 每帧会动的部分 ----------
  function caterpillar(x0, top) {
    // 毛毛虫趴在大蘑菇顶上，跟着伞盖一起起伏
    const segs = [[0, 0], [5, 0], [10, 0], [14, -2], [17, -6]];
    segs.forEach(([sx, sy], i) => {
      const cx = x0 + sx, cy = top - 3 + sy;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 10) continue;
        set(cx + dx, cy + dy, dx + dy < -2 ? "s" : dx + dy > 2 ? "q" : "r");
      }
      if (i < 3) { set(cx - 1, top, "q"); set(cx + 1, top, "q"); }
    });
    const hx = x0 + 17, hy = top - 9;
    set(hx + 1, hy, "z"); set(hx + 3, hy + 1, "E"); set(hx + 2, hy + 2, "E");
    set(hx - 1, hy - 3, "q"); set(hx - 2, hy - 4, "q"); set(hx + 1, hy - 3, "q"); set(hx + 2, hy - 4, "q");
  }
  function caps(env) {
    MUSH.forEach(([cx, by, hw, hh, ph], k) => {
      const b = BOUNCE[(env + ph) & 7], w = hw + b, h = hh - b;
      for (let x = cx - w + 4; x <= cx + w - 4; x++) { set(x, by, x & 1 ? "E" : "F"); set(x, by + 1, x % 3 === 0 ? "F" : "E"); }
      for (let dy = 0; dy < h; dy++) for (let dx = -w; dx <= w; dx++) {
        const r = dx * dx * h * h + dy * dy * w * w, R = w * w * h * h;
        if (r > R) continue;
        const edge = dx * dx * h * h + (dy + 1) * (dy + 1) * w * w > R;
        set(cx + dx, by - 1 - dy, dy === 0 ? "B" : edge && dx < w / 3 ? "D" : dx > w * 0.45 || dy < h * 0.3 ? "B" : "C");
      }
      for (const [fx, fy, r] of SPOTS[k]) {
        const sx = cx + Math.round(fx * w), sy = by - 1 - Math.round(fy * h);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 1) set(sx + dx, sy + dy, dx + dy >= r ? "E" : "c");
      }
      if (k === 0) caterpillar(cx - 8, by - 1 - h);
    });
  }
  function portal(env) {
    // 兔子洞里慢慢转的旋涡（传送门）
    const cx = 256, cy = 162;
    for (let y = GROUND; y < 176; y++) for (let x = HOLE_X0; x < HOLE_X1; x++) {
      if (get(x, y) === "m" || get(x, y) === "n") continue;
      const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy);
      const v = ((((Math.atan2(dy, dx) / (2 * Math.PI)) * 3 + r / 7 - env / 10) % 1) + 1) % 1;
      set(x, y, r > 15 ? "z" : r < 2.5 ? "D" : v < 0.16 ? "C" : v < 0.3 ? "B" : "y");
    }
    for (const [x, n] of [[242, 6], [244, 4], [268, 7], [266, 3]]) for (let k = 0; k < n; k++) set(x + (k > 3 ? 1 : 0), GROUND + 2 + k, k & 1 ? "e" : "f");
  }
  const FALL = [];
  for (let i = 0; i < 16; i++) FALL.push([hash(i, 0, 90) % W, 1 + (hash(i, 1, 90) % 3), hash(i, 2, 90) % 64, i % 3 === 0 ? 1 : 0, hash(i, 3, 90) % 160]);
  function falling(env) {
    // 花瓣和扑克牌慢慢飘下来，牌一边落一边翻
    for (const [x0, sp, ph, card, y0] of FALL) {
      const y = ((y0 + Math.floor((env * sp) / 3)) % 160) - 10, x = x0 + tri(env + ph, 48, 8);
      if (y > GROUND - 6) continue; // 落到草地就不画了
      if (card) {
        const f = ((env + ph) >> 2) & 3;
        if (f & 1) rect(x + 1, y, 1, 5, "v");
        else if (f === 0) { rect(x, y, 3, 5, "u"); set(x + 1, y + 2, ph & 1 ? "i" : "z"); set(x, y, "t"); }
        else { rect(x, y, 3, 5, "h"); set(x + 1, y + 1, "i"); set(x + 1, y + 3, "i"); }
      } else {
        const c = ph & 1 ? "i" : "D";
        set(x, y, c);
        if ((env + ph) & 2) set(x + 1, y, c); else set(x, y + 1, c);
      }
    }
  }

  // ---------- 动物 ----------
  // 扑克牌士兵（怪物）：朝右，4 帧走路，拿着长矛
  function soldier(f) {
    return outline(sprite(18, 30, (p) => {
      p(15, 1, "u"); p(14, 2, "v"); p(15, 2, "u"); p(16, 2, "v"); p(15, 3, "v");
      for (let y = 4; y <= 24; y++) p(15, y, "f");
      for (let y = 2; y <= 7; y++) for (let x = 5; x <= 10; x++) if (!(y === 2 && (x === 5 || x === 10))) p(x, y, y <= 3 ? "z" : "E");
      p(5, 4, "z"); p(9, 5, "z"); p(10, 6, "E"); p(8, 7, "F");
      for (let y = 8; y <= 21; y++) for (let x = 2; x <= 13; x++) p(x, y, x === 13 || y === 21 ? "v" : "u");
      p(3, 9, "t"); p(4, 9, "t"); p(3, 10, "i"); p(12, 19, "i");
      [".ii.ii.", "iiiiiii", ".iiiii.", "..iii..", "...i..."].forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === "i") p(4 + i, 12 + j, "i"); });
      p(1, 11, "z"); p(1, 12, "z"); p(1, 13, "z"); p(1, 14, "E");
      p(14, 11, "z"); p(14, 12, "E");
      // 腿：红色（红心花色），一步 4 帧
      const legs = [[[5, 5], [10, 10]], [[5, 3], [10, 12]], [[5, 5], [10, 10]], [[5, 7], [10, 8]]][f];
      for (const [a, b] of legs) { for (let k = 0; k < 4; k++) p(a + Math.round(((b - a) * k) / 3), 22 + k, "i"); p(b, 26, "z"); p(b + 1, 26, "z"); }
    }), "z");
  }
  // 柴郡猫（提示动物）：趴在树枝上；身子和笑脸分开画，好让身子先隐去、只剩笑脸
  function cheshire(part) {
    return outline(sprite(28, 16, (q) => {
      const p = (x, y, c, grin) => { if (!!grin === (part === "grin")) q(x + 1, y + 1, c); };
      for (let y = 6; y <= 12; y++) for (let x = 9; x <= 23; x++) { const dx = 2 * x - 32, dy = 2 * y - 19; if (dx * dx * 9 + dy * dy * 49 <= 1764) p(x, y, x % 3 === 0 ? "B" : "C"); }
      for (const [x, y] of [[24, 9], [25, 10], [25, 11], [24, 12], [24, 13], [25, 14]]) p(x, y, (x + y) & 1 ? "B" : "C");
      for (let y = 2; y <= 10; y++) for (let x = 0; x <= 10; x++) if (!((y === 2 || y === 10) && (x === 0 || x === 10))) p(x, y, y <= 3 && (x & 1) ? "B" : "C");
      p(1, 0, "C"); p(1, 1, "C"); p(2, 1, "C"); p(9, 0, "C"); p(9, 1, "C"); p(8, 1, "C");
      p(2, 5, "l"); p(3, 5, "z"); p(7, 5, "l"); p(8, 5, "z"); p(5, 6, "D");
      for (let x = 0; x <= 11; x++) p(x, 8, x === 0 || x === 11 ? "z" : x & 1 ? "t" : "u", true);
      for (let x = 1; x <= 10; x++) p(x, 9, x === 1 || x === 10 ? "z" : x & 1 ? "u" : "t", true);
      for (let x = 3; x <= 8; x++) p(x, 10, "z", true);
      p(10, 11, "C"); p(11, 11, "C");
    }), "z");
  }
  function blitFade(g, x, y, level) {
    for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] !== "." && dith(x + i, y + j, level)) set(x + i, y + j, g[j][i]);
  }
  const SOLDIER = [0, 1, 2, 3].map(soldier), CAT_BODY = cheshire("body"), CAT_GRIN = cheshire("grin");

  function draw(ctx, tick) {
    tick = Math.max(0, tick | 0);
    const env = tick >> 1;
    if (!BG) { BG = layer(paintBackground, "w"); FG = layer(paintForeground); }
    buf.set(BG);
    paste(FG);
    portal(env);
    caps(env);
    // 柴郡猫：身子隐去 → 只剩笑脸 → 笑脸也没了 → 笑脸先回来 → 身子再回来（8 秒一圈）
    const ct = tick % 64;
    const body = ct < 16 ? 16 : ct < 24 ? 16 - (ct - 16) * 2 : ct < 60 ? 0 : (ct - 60) * 4;
    const grin = ct < 40 ? 16 : ct < 48 ? 16 - (ct - 40) * 2 : ct < 52 ? 0 : ct < 60 ? (ct - 52) * 2 : 16;
    blitFade(CAT_BODY, 258, BRANCH_Y - 15, body); blitFade(CAT_GRIN, 258, BRANCH_Y - 15, grin);
    // 扑克牌士兵：在兔子洞右边来回巡逻，走到头停一下再转身
    const span = 28, pause = 6, st = tick % (2 * (span + pause));
    let sx, left = false, walk = true;
    if (st < span) sx = st;
    else if (st < span + pause) { sx = span; walk = false; }
    else if (st < 2 * span + pause) { sx = 2 * span + pause - st; left = true; }
    else { sx = 0; left = true; walk = false; }
    blit(SOLDIER[walk ? tick & 3 : 0], 274 + sx, GROUND - 28, left);
    falling(env);
    blit(HERO, 98, 128); blit(BOX, 114, 128);
    flush(ctx);
  }

  root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  root.PB_CONCEPT_SCENES.wonderland = { draw };
})(typeof window !== "undefined" ? window : globalThis);
