/* 地图概念场景：季风阶梯井（stepwell）· ART-04b。只看大致效果：不是关卡、不是正式资产，不走美术确认。
 * 接口（WB-05）：PB_CONCEPT_SCENES.stepwell = { draw(ctx, tick) }，在 320×180 画布上画一帧，tick 每秒加 8。
 * 只用 ENDESGA 32（只读调用 core/raster.js 的 PB.RGB、PB.LIGHT、PB.h32），整数像素、不抗锯齿；
 * 环境效果 4 fps（tick >> 1），动物 8 fps。
 * 地标：倒金字塔形的阶梯井（远处井壁是一层层 Λ 形楼梯）、井边亭子和油灯、地上的彩色地画（rangoli）。
 * 机关外观：水位刻度和漂在水上的浮箱（monsoon）、彩粉罐和被彩粉照出轮廓的隐形块（color_powder）、
 *   和井水连着的竖井、水位一样高（communicating）。
 * 环境：乌云压过来、风吹起彩粉、油灯火苗跳动、井水一层层泛光。怪物：猴子在栏杆上跳；提示动物：孔雀开屏又收起。
 * 比例尺：主角大小的人影和木箱（人影和井边的木箱不动）。不画收件人、货物、界面和文字。 */
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

  // ---------- 房间：16px 一格；# 砂岩，~ 井水，. 空 ----------
  const GRID = [
    "....................",
    "....................",
    "....................",
    "....................",
    "#####.............##", // 井口地面（顶 y=64）：左边亭子和地画，右边孔雀
    "######...........###", // 左：彩粉罐；右：连通竖井 x=276–283
    "########.......#####", // 左：人影和木箱；右：栏杆和猴子
    "#########.....######",
    "##########...#######", // 水下的一级台阶（顶 y=128）
    "##########~~~#######",
    "##########~~~#######",
    "####################",
  ];
  const cell = (tx, ty) => (tx < 0 || tx > 19 || ty > 11 ? "#" : ty < 0 ? "." : GRID[ty][tx]);
  const solid = (x, y) => cell(x >> 4, y >> 4) === "#";
  const WATER_Y = 120, SHAFT_X0 = 276, SHAFT_X1 = 284, SHAFT_TOP = 80, CH_Y0 = 160, CH_Y1 = 168, FAR_TOP = 58;
  const inShaft = (x, y) => x >= SHAFT_X0 && x < SHAFT_X1 && y >= SHAFT_TOP && y < CH_Y1;
  const inChannel = (x, y) => x >= 208 && x < SHAFT_X1 && y >= CH_Y0 && y < CH_Y1;
  const isWater = (x, y) => y >= WATER_Y && y < 176 && (!solid(x, y) || inShaft(x, y) || inChannel(x, y));
  // 油灯：火苗底部 x、y 和光晕半径（亭子里挂的一盏，台阶边上几盏小陶灯）
  const LAMPS = [[20, 47, 9], [40, 61, 5], [136, 109, 5], [231, 109, 5]];

  // ---------- 背景（静态，缓存）：黄昏的天、远处的拱廊和神庙、对面井壁的 Λ 形楼梯 ----------
  function paintSky() {
    for (let y = 0; y < FAR_TOP; y++) for (let x = 0; x < W; x++) {
      let c = "x";
      if (y >= 16) c = dith(x, y, Math.min(16, y - 16)) ? "B" : "x";
      if (y >= 36) c = dith(x, y, Math.min(16, (y - 36) * 2)) ? "C" : "B";
      if (y >= 48) c = dith(x, y, Math.min(6, (y - 48) >> 1)) ? "D" : "C";
      set(x, y, c);
    }
  }
  function farWall() {
    const T = 12;
    for (let y = FAR_TOP; y < H; y++) for (let x = 0; x < W; x++) {
      const ty = Math.floor((y - FAR_TOP) / T), ly = (y - FAR_TOP) % T, px = (x + (ty & 1) * T) % (2 * T);
      const surf = T - ((T - Math.abs(px - T)) & ~1); // Λ 楼梯面在这一层的第几行（2px 一级）
      let c;
      if (ly === 0) c = "w";
      else if (ly === T - 1) c = "y";
      else if (ly === surf) c = "w";
      else if (ly > surf) c = hash(x, y, 33) % 13 === 0 ? "y" : "x";
      else c = hash(x, y, 33) % 9 === 0 ? "x" : "y";
      if (y > 100 && dith(x, y, Math.min(10, (y - 100) >> 2))) c = c === "w" ? "x" : "y";
      set(x, y, c);
    }
  }
  function paintFar() {
    farWall();
    for (let x = 0; x < W; x++) { set(x, FAR_TOP - 2, "x"); set(x, FAR_TOP - 1, "y"); }
    // 对面井口：一排拱廊，屋顶上几个小圆顶
    for (let y = 45; y < FAR_TOP - 2; y++) for (let x = 84; x < 236; x++) {
      const ax = (x - 84) % 12, arch = y >= 48 && ax >= 3 && ax <= 8 && !(y === 48 && (ax === 3 || ax === 8));
      set(x, y, y === 45 ? "x" : arch ? "z" : "y");
    }
    for (const cx of [102, 138, 174, 210]) for (let dy = 0; dy < 5; dy++) for (let dx = -4; dx <= 4; dx++)
      if (dx * dx + dy * dy * 3 <= 18) set(cx + dx, 44 - dy, dx < -1 && dy > 0 ? "x" : "y");
    // 神庙的塔（shikhara）
    const tx = 256;
    for (let y = 22; y < FAR_TOP - 2; y++) {
      const hw = 2 + Math.floor(Math.sqrt((y - 22) * 3.4));
      for (let x = tx - hw; x <= tx + hw; x++) set(x, y, x === tx - hw ? "x" : (y - 22) % 6 === 5 ? "z" : "y");
    }
    rect(tx - 2, 19, 5, 3, "y"); set(tx, 18, "y"); set(tx, 17, "y");
  }

  // ---------- 前景（静态，缓存）：砂岩台阶、亭子、地画、彩粉罐、栏杆、竖井 ----------
  function sand(x, y, depth) {
    // 砂岩砌块：16×8 一块，竖缝每层错开 8px；越往里越暗
    const jx = (x + ((y >> 3) & 1) * 8) & 15, h = hash(x, y, 31);
    let c = (y & 7) === 7 ? "F" : jx === 15 ? "F" : h % 23 === 0 ? "F" : h % 41 === 0 ? "c" : "d";
    if ((y & 7) === 7 && jx === 15) c = "e";
    if (depth > 24 && dith(x, y, Math.min(13, (depth - 24) >> 2))) c = c === "c" ? "d" : c === "d" ? "F" : "e";
    return c;
  }
  function niche(x0, y0) {
    // 井壁上凿出来的小龛：左边内壁背光，右边内壁和底下的台子受光
    for (let j = 0; j < 14; j++) for (let i = 0; i < 10; i++) {
      if (j < 4 && Math.abs(2 * i - 9) > 2 * j + 3) continue;
      const edge = j < 4 && Math.abs(2 * i - 9) > 2 * j + 1;
      set(x0 + i, y0 + j, j === 13 ? "c" : i === 0 || (edge && i < 5) ? "e" : i === 9 || (edge && i >= 5) ? "F" : j < 7 ? "g" : "f");
    }
    rect(x0 - 1, y0 + 14, 12, 1, "e");
  }
  function terrain() {
    for (let ty = 0; ty < 12; ty++) for (let tx = 0; tx < 20; tx++) {
      if (cell(tx, ty) !== "#") continue;
      const top = cell(tx, ty - 1) !== "#", lf = cell(tx - 1, ty) === "#", rt = cell(tx + 1, ty) === "#";
      let above = 0;
      while (above < 4 && ty - 1 - above >= 0 && cell(tx, ty - 1 - above) === "#") above++;
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
        const x = tx * 16 + i, y = ty * 16 + j;
        let c = sand(x, y, above * 16 + j);
        if (top && j === 0) c = "c";
        else if (top && j === 1) c = "d";
        else if (!lf && i === 0) c = "c";
        else if (!rt && i === 15) c = "e";
        set(x, y, c);
      }
    }
    // 水位刻度：水面上方的台阶被泡湿，颜色深一点（季风涨水留下的）
    const WET = { c: "d", d: "F", F: "e", e: "f" };
    for (let y = WATER_Y - 7; y < WATER_Y; y++) for (let x = 128; x < 240; x++)
      if (solid(x, y) && dith(x, y, 16 - (WATER_Y - y) * 2)) set(x, y, WET[get(x, y)] || get(x, y));
  }
  function chhatri(x0, ground) {
    rect(x0, ground - 4, 32, 4, "d"); rect(x0, ground - 4, 32, 1, "c"); rect(x0 + 31, ground - 3, 1, 3, "e"); rect(x0, ground - 1, 32, 1, "e");
    for (const px of [x0 + 2, x0 + 26]) {
      rect(px, ground - 22, 4, 18, "d"); rect(px, ground - 22, 1, 18, "c"); rect(px + 3, ground - 22, 1, 18, "e");
      rect(px - 1, ground - 24, 6, 2, "d"); rect(px - 1, ground - 24, 6, 1, "c");
      rect(px - 1, ground - 6, 6, 2, "d"); rect(px - 1, ground - 6, 6, 1, "c");
    }
    rect(x0 - 2, ground - 28, 36, 4, "d"); rect(x0 - 2, ground - 28, 36, 1, "c"); rect(x0 - 1, ground - 25, 34, 1, "e"); rect(x0 + 33, ground - 27, 1, 2, "e");
    const cx = x0 + 16, by = ground - 29, rx = 12, ry = 11;
    for (let dy = 0; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      if (dx * dx * ry * ry + dy * dy * rx * rx > rx * rx * ry * ry) continue;
      set(cx + dx, by - dy, dy === 0 ? "e" : dx < -5 + (dy >> 1) && dy > 1 ? "c" : dx > 5 ? "e" : (dx + dy) % 5 === 0 ? "F" : "d");
    }
    rect(cx - 1, by - ry - 3, 3, 3, "d"); set(cx - 1, by - ry - 3, "c"); set(cx, by - ry - 4, "d"); set(cx, by - ry - 5, "c");
    // 挂着的油灯：链子 + 灯碗（火苗是动的）
    for (let y = ground - 24; y < ground - 18; y++) set(cx, y, (y & 1) ? "f" : "e");
    set(cx - 2, ground - 17, "e"); set(cx + 2, ground - 17, "e"); set(cx - 1, ground - 18, "e"); set(cx + 1, ground - 18, "e");
    rect(cx - 2, ground - 16, 5, 1, "F"); set(cx - 2, ground - 16, "d"); rect(cx - 1, ground - 15, 3, 1, "e");
  }
  function rangoli(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -16; dx <= 16; dx++) {
      const ex = dx, ey = dy * 6, rr = Math.sqrt(ex * ex + ey * ey), petal = (Math.floor(((Math.atan2(ey, ex) + Math.PI) * 6) / Math.PI) & 1) === 0;
      let c = null;
      if (rr < 2.5) c = "l";
      else if (rr < 5.5) c = "C";
      else if (rr < 8.5) c = petal ? "k" : "D";
      else if (rr < 11) c = petal ? "m" : "n";
      else if (rr < 12.5) c = "c";
      else if (rr < 15 && petal) c = "C";
      if (c) set(cx + dx, cy + dy, c);
    }
  }
  function pot(x0, ground, powder) {
    const rows = ["..PP..", ".PPPP.", "dcddde", ".dFFe.", "dFFFef", "dFFFef", ".eFef."];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < 6; i++) {
      const c = rows[j][i];
      if (c !== ".") set(x0 + i, ground - rows.length + j, c === "P" ? powder : c);
    }
  }
  function diya(x, ground) { rect(x - 2, ground - 2, 5, 1, "F"); set(x - 2, ground - 2, "d"); set(x + 2, ground - 2, "e"); rect(x - 1, ground - 1, 3, 1, "e"); }
  function railing(x0, x1, ground) {
    for (let x = x0; x < x1; x++) { set(x, ground - 12, "c"); set(x, ground - 11, "d"); set(x, ground - 10, "e"); }
    for (let x = x0 + 4; x < x1 - 4; x += 4) for (let y = ground - 9; y < ground; y++) { set(x, y, "c"); set(x + 1, y, (y & 3) === 1 ? "d" : "e"); }
    for (const px of [x0, x1 - 3]) { rect(px, ground - 14, 3, 14, "d"); rect(px, ground - 14, 1, 14, "c"); rect(px + 2, ground - 14, 1, 14, "e"); rect(px - 1, ground - 15, 5, 1, "c"); }
  }
  function shaft() {
    // 连通器：右边台阶里挖了一口竖井，底下有暗渠通到井水，两边水面一样高
    for (let y = SHAFT_TOP; y < CH_Y1; y++) for (let x = SHAFT_X0; x < SHAFT_X1; x++) set(x, y, y < SHAFT_TOP + 6 && dith(x, y, 12 - (y - SHAFT_TOP) * 2) ? "f" : "g");
    for (let y = SHAFT_TOP; y < CH_Y1; y++) { set(SHAFT_X0 - 1, y, "e"); set(SHAFT_X1, y, "F"); }
    for (let y = SHAFT_TOP + 8; y < CH_Y0; y += 8) rect(SHAFT_X1 - 3, y, 3, 1, "f"); // 水位刻度
    rect(208, CH_Y0 - 1, SHAFT_X0 - 208, 1, "f"); rect(208, CH_Y1, SHAFT_X1 - 208, 1, "e");
  }
  function ghostBlock(x0, y0) {
    // 隐形块：只有沾上彩粉的地方显出轮廓
    const P = "DlCk";
    for (let i = 0; i < 16; i++) {
      if ((i & 1) === 0) set(x0 + i, y0, P[(i >> 1) & 3]);
      if (i % 3 === 0) set(x0 + i, y0 + 15, "C");
      if ((i & 1) === 0) set(x0, y0 + i, P[((i >> 1) + 1) & 3]);
      if (i % 3 === 0) set(x0 + 15, y0 + i, "C");
    }
    for (let k = 0; k < 6; k++) set(x0 + 2 + (hash(k, 0, 74) % 12), y0 + 1 + (hash(k, 1, 74) % 3), P[k & 3]);
  }
  function paintForeground() {
    terrain();
    niche(18, 92); niche(50, 124); niche(298, 100); niche(244, 136);
    shaft();
    chhatri(4, 64);
    rangoli(60, 66);
    pot(80, 80, "C"); pot(88, 80, "l"); set(87, 79, "C"); set(94, 79, "l"); set(95, 79, "s");
    for (const [x, g] of LAMPS.slice(1)) diya(x, g + 3);
    railing(240, 272, 96);
    ghostBlock(192, 64);
  }

  // ---------- 每帧会动的部分 ----------
  // 乌云：几团椭圆拼起来，底边被晚霞照亮一点，慢慢往左压过来
  const CLOUDS = [
    [0, 0, 1, [[12, 0, 26, 12], [42, 1, 22, 11], [68, 0, 24, 14], [96, 2, 18, 9]]],
    [130, 0, 1, [[16, 0, 30, 10], [46, 2, 24, 12], [74, 0, 28, 9], [104, 3, 20, 10], [128, 1, 18, 7]]],
    [300, 0, 1, [[14, 0, 24, 11], [40, 2, 20, 13], [64, 0, 22, 8]]],
    [70, 20, 2, [[0, 4, 14, 4], [14, 2, 12, 5], [28, 4, 12, 4]]],
    [230, 26, 2, [[0, 3, 10, 3], [12, 2, 12, 4], [26, 3, 9, 3]]],
  ];
  const CLOUD_MASKS = CLOUDS.map(([, , , lobes]) => {
    let x1 = 0, y1 = 0;
    for (const [cx, cy, rx, ry] of lobes) { x1 = Math.max(x1, cx + rx + 1); y1 = Math.max(y1, cy + ry + 1); }
    const x0 = -lobes[0][2], w = x1 - x0, h = y1, inside = (i, j) => i >= 0 && j >= 0 && i < w && j < h && lobes.some(([cx, cy, rx, ry]) => {
      const dx = i + x0 - cx, dy = j - cy; return dx * dx * ry * ry + dy * dy * rx * rx <= rx * rx * ry * ry;
    });
    const rows = [];
    for (let j = 0; j < h; j++) { let r = ""; for (let i = 0; i < w; i++) r += !inside(i, j) ? "." : !inside(i, j + 1) ? "B" : !inside(i, j + 2) && (i + j) & 1 ? "B" : !inside(i, j - 1) && !inside(i - 2, j) ? "w" : hash(i, j, 75) % 13 === 0 ? "z" : "y"; rows.push(r); }
    return { x0, w, rows };
  });
  function clouds(env) {
    CLOUDS.forEach(([cx, cy, sp], k) => {
      const m = CLOUD_MASKS[k], span = W + m.w, left = cx + m.x0 - Math.floor((env * sp) / 2);
      blit(m.rows, ((((left + m.w) % span) + span) % span) - m.w, cy, false);
    });
  }
  function halos(env) {
    LAMPS.forEach(([fx, fy, r0], i) => {
      const r = r0 + (hash(env, i, 62) % 3) - 1, cy = fy - 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r && dith(fx + dx, cy + dy, 15 - Math.floor((d2 * 15) / (r * r)))) lighten(fx + dx, cy + dy);
      }
    });
    // 对面拱廊里的灯也一闪一闪
    for (let k = 0; k < 12; k++) if (hash(k, 0, 64) % 3 === 0) { const x = 84 + k * 12 + 5; set(x, 54, hash(env >> 1, k, 65) % 4 ? "j" : "b"); set(x + 1, 54, hash(env >> 1, k, 66) % 4 ? "b" : "j"); }
  }
  function flames(env) {
    LAMPS.forEach(([fx, fy], i) => {
      const h = hash(env, i, 63) % 4, n = h === 0 ? 2 : h === 3 ? 4 : 3;
      for (let k = 0; k < n; k++) set(fx + (k === n - 1 && h === 1 ? 1 : k === n - 1 && h === 2 ? -1 : 0), fy - k, k === 0 ? "j" : k === n - 1 ? "l" : "k");
      if (h === 3) set(fx, fy - 1, "t");
    });
  }
  function water(env) {
    const band = (env >> 1) % 8;
    for (let y = WATER_Y; y < 176; y++) for (let x = 144; x < SHAFT_X1; x++) {
      if (!isWater(x, y)) continue;
      const d = y - WATER_Y, k = (d - 4) >> 3;
      let c = d === 0 ? "s" : d < 3 ? "r" : d < 10 ? (dith(x, y, 16 - (d - 3) * 2) ? "r" : "q") : d > 46 && dith(x, y, 4) ? "p" : "q";
      // 一层层泛光：亮的那一层从水面往下一层层走
      if (d >= 4 && ((d - 4) & 7) === 0) { if (k === band) c = dith(x, y, 10) ? "s" : "r"; else if (k === band - 1) c = dith(x, y, 8) ? "r" : c; }
      set(x, y, c);
    }
    for (let x = 144; x < SHAFT_X1; x++) if (isWater(x, WATER_Y) && hash(x >> 1, env >> 1, 42) % 9 === 0) set(x, WATER_Y, "t");
    for (let x = 208; x < SHAFT_X0; x++) if ((x + (env >> 1)) % 11 === 0) set(x, CH_Y0 + 3, "r");
  }
  const DUST = [];
  for (let i = 0; i < 18; i++) DUST.push([hash(i, 0, 70) % 240, 1 + (hash(i, 1, 70) % 2), "DlCsk"[hash(i, 2, 70) % 5], hash(i, 3, 70) % 24, hash(i, 4, 70) % 7]);
  function powder(env) {
    // 风从左边吹来，把罐子里的彩粉吹起来，飘过井口
    for (const [off, sp, c, ph, dy] of DUST) {
      const dist = (env * sp + off) % 240, x = 90 + dist, y = 74 - dy - Math.min(12, dist >> 3) + tri(env + ph, 24, 2);
      if (dist > 190 && !dith(x, y, (240 - dist) >> 2)) continue;
      set(x, y, c);
      if (sp > 1) set(x - 1, y, c);
    }
  }

  // ---------- 动物 ----------
  function ell(p, cx, cy, rx, ry, c) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx * ry * ry + dy * dy * rx * rx <= rx * rx * ry * ry) p(x, y, c);
    }
  }
  // 猴子（怪物）：朝右；蹲着一帧、跳起来一帧，龇牙、皱眉
  function monkey(leap) {
    return outline(sprite(18, 16, (p) => {
      if (!leap) {
        for (const [x, y] of [[4, 11], [3, 10], [2, 9], [2, 8], [2, 7], [3, 6], [4, 6]]) p(x, y, "e");
        ell(p, 8, 10, 4, 3, "e");
        p(9, 10, "F"); p(9, 11, "F"); p(10, 11, "F");
        p(6, 13, "e"); p(7, 13, "e"); p(6, 14, "f"); p(7, 14, "f"); p(8, 14, "f");
        p(11, 11, "e"); p(12, 12, "e"); p(12, 13, "e"); p(12, 14, "f"); p(13, 14, "f");
        ell(p, 12, 6, 3, 3, "e");
        for (const [x, y] of [[12, 6], [13, 6], [14, 6], [13, 5], [14, 5], [12, 7], [13, 7], [14, 7]]) p(x, y, "E");
        p(13, 5, "z"); p(12, 4, "f"); p(13, 4, "f"); p(14, 7, "t"); p(13, 8, "h"); p(14, 8, "h"); p(10, 5, "F");
      } else {
        for (const [x, y] of [[3, 7], [2, 6], [1, 5], [1, 4], [2, 3]]) p(x, y, "e");
        ell(p, 8, 8, 5, 2, "e");
        p(8, 9, "F"); p(9, 9, "F"); p(10, 9, "F");
        p(4, 10, "e"); p(3, 11, "e"); p(2, 11, "f"); p(1, 11, "f");
        p(12, 9, "e"); p(13, 10, "e"); p(14, 11, "e"); p(15, 11, "f");
        ell(p, 13, 5, 3, 3, "e");
        for (const [x, y] of [[13, 5], [14, 5], [15, 5], [14, 4], [15, 4], [13, 6], [14, 6], [15, 6]]) p(x, y, "E");
        p(14, 4, "z"); p(13, 3, "f"); p(14, 3, "f"); p(15, 6, "t"); p(14, 7, "h"); p(15, 7, "h"); p(11, 4, "F");
      }
    }), "z");
  }
  // 孔雀（提示动物）：朝左；0 尾巴拖在地上，1 半开，2 开屏
  function peacock(state) {
    return outline(sprite(40, 32, (q) => {
      const p = (x, y, c) => q(x + 1, y + 1, c), fcx = 17, fcy = 19;
      if (state > 0) {
        const R = state === 2 ? 15 : 13, eyes = [];
        for (let a = 0; a <= 180; a += 20) eyes.push([fcx + Math.round((R - 3) * Math.cos((a * Math.PI) / 180)), fcy - Math.round((R - 3) * Math.sin((a * Math.PI) / 180))]);
        if (state === 2) for (let a = 26; a <= 154; a += 32) eyes.push([fcx + Math.round(8 * Math.cos((a * Math.PI) / 180)), fcy - Math.round(8 * Math.sin((a * Math.PI) / 180))]);
        for (let y = fcy - R; y <= fcy + 2; y++) for (let x = fcx - R; x <= fcx + R; x++) {
          const dx = x - fcx, dy = y - fcy, d2 = dx * dx + dy * dy;
          const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
          if (d2 > R * R || d2 < 9 || (state === 1 && (deg < 30 || deg > 80))) continue; // 半开：尾屏斜着竖起一半
          let m = 9;
          for (const [ex, ey] of eyes) m = Math.min(m, Math.abs(x - ex) + Math.abs(y - ey));
          const rib = Math.abs(deg % 10) < 1.2;
          p(x, y, m === 0 ? "q" : m === 1 ? "r" : m === 2 && d2 > 30 ? "k" : d2 >= (R - 1) * (R - 1) || rib ? "o" : "n");
        }
      }
      if (state < 2) {
        const len = state === 0 ? 20 : 12;
        for (let i = 0; i < len; i++) {
          const x = 16 + i, top = 20 + Math.floor((i * 8) / 20), th = Math.max(2, 4 - (i >> 3));
          for (let k = 0; k < th; k++) p(x, Math.min(28, top + k), k === th - 1 ? "o" : "n");
          if (i % 5 === 3) { p(x, Math.min(28, top + 1), "q"); p(x, Math.min(28, top), "r"); }
        }
      }
      for (let y = 17; y <= 24; y++) for (let x = 7; x <= 18; x++) { const dx = 2 * x - 25, dy = 2 * y - 41; if (dx * dx * 4 + dy * dy * 9 <= 576) p(x, y, x < 11 ? "r" : "q"); }
      for (let x = 12; x <= 17; x++) for (let y = 18; y <= 21; y++) p(x, y, (x + y) & 1 ? "d" : "f");
      p(17, 21, "b"); p(18, 21, "b"); p(17, 22, "b");
      for (let y = 9; y <= 18; y++) { const xc = 6 + ((y - 9) >> 2); p(xc, y, "r"); p(xc + 1, y, "r"); p(xc + 2, y, "q"); }
      for (let y = 6; y <= 9; y++) for (let x = 5; x <= 8; x++) if (!((y === 6 || y === 9) && (x === 5 || x === 8))) p(x, y, "r");
      p(5, 7, "t"); p(6, 7, "z"); p(3, 8, "v"); p(4, 8, "u");
      p(6, 4, "s"); p(7, 3, "s"); p(8, 4, "s"); p(6, 5, "q"); p(7, 4, "q"); p(7, 5, "q");
      for (let y = 25; y <= 28; y++) { p(10, y, "v"); p(14, y, "v"); }
      p(9, 28, "v"); p(13, 28, "v");
    }), "z");
  }
  const MONKEY = [monkey(false), monkey(true)], PEACOCK = [0, 1, 2].map(peacock);
  let FAR = null;

  function draw(ctx, tick) {
    tick = Math.max(0, tick | 0);
    const env = tick >> 1;
    if (!BG) { BG = layer(paintSky, "x"); FAR = layer(paintFar); FG = layer(paintForeground); }
    buf.set(BG);
    clouds(env);
    paste(FAR);
    halos(env);
    paste(FG);
    water(env);
    // 浮箱：漂在水面上一上一下；水下那截只露出一圈暗边
    const bx = 172, by = WATER_Y - 12 + ((env >> 2) & 1);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const y = by + j, c = BOX[j][i];
      if (y < WATER_Y) set(bx + i, y, c);
      else if (y > WATER_Y && c === "z" && y < 176) set(bx + i, y, "q");
    }
    flames(env);
    powder(env);
    // 孔雀：站在右边井口，隔一会儿开屏，再收起来
    const pc = tick % 64;
    blit(PEACOCK[pc < 24 ? 0 : pc < 28 ? 1 : pc < 52 ? 2 : pc < 56 ? 1 : 0], 282, 33, false);
    // 猴子：在栏杆上跳过去、再跳回来，歇一下
    const mt = tick % 40, hop = mt >> 3, ht = mt & 7;
    if (hop < 4) {
      const dir = hop < 2 ? 1 : -1, x0 = [240, 247, 254, 247][hop], air = ht >= 2 && ht <= 5;
      const dx = [0, 0, 2, 4, 5, 7, 7, 7][ht] * dir, dy = [0, 0, 3, 5, 5, 3, 0, 0][ht];
      blit(MONKEY[air ? 1 : 0], x0 + dx, 68 - dy, dir < 0);
    } else blit(MONKEY[0], 240, 68, (ht >> 2) === 0);
    blit(HERO, 96, 80); blit(BOX, 112, 80);
    flush(ctx);
  }

  root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  root.PB_CONCEPT_SCENES.stepwell = { draw };
})(typeof window !== "undefined" ? window : globalThis);
