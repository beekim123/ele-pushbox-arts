/* ART-04l 地图概念场景：天文钟楼（clock_tower）。只看大致效果，不是正式资产，不进游戏。
 * 一屏 320×180 的侧视房间：大钟肚子里的一层。深胡桃木墙、慢慢转的黄铜齿轮、从背面看的群青星象钟盘，
 * 晨光从钟盘的缝里一条条照进来、光里浮着灰；巨大的摆锤左右扫，影子从墙这头扫到那头；
 * 每过一会儿“整点”：整座楼一震，梁上簌簌落灰，排队的木偶一个个转出来又转回去。
 * 机关只画样子：竖井里的绳索、配重和升降台（lift）、墙上的拉杆（lever）、跷跷板（seesaw）。
 * 怪物：发条乌鸦（走过来啄箱子就走）；提示动物：钟楼猫头鹰（脑袋跟着摆锤转）。
 * 环境 4 fps（tick>>1），动物 8 fps（tick 每秒加 8）。只用 ENDESGA 32 调色板，整数像素，不抗锯齿。
 * 只读调用 workbench/js/core/raster.js 里的 PB.Raster / PB.h32 / PB.DIM。 */
(function (root) {
  "use strict";
  const W = 320, H = 180;
  const FLOOR_Y = 148, BEAM_Y = 16, GAL_Y = 96, GAL_X = 234;
  const DIAL_X = 172, DIAL_Y = 66, DIAL_R = 44;
  const PEND_L = 68, BOB_R = 8;
  const STRIKE = 112;                                  // “整点”的间隔（tick）
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  // 晨光：沿调色板提亮成灰白（只作用在背景上）
  const MORNING = { z: "y", g: "x", y: "x", f: "w", B: "w", x: "w", e: "v", q: "w", w: "v", F: "u", h: "B", r: "v", b: "F" };
  let PB, h32, DIM;

  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  function spr(r, rows, x, y, flip) { r.blitRows(rows, x, y, !!flip); }
  function disc(r, cx, cy, rad, fn) {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d2 = x * x + y * y;
      if (d2 <= rad * rad + rad) { const c = fn(x, y, d2); if (c) r.set(cx + x, cy + y, c); }
    }
  }
  function line(r, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) r.set(x0 + Math.round(((x1 - x0) * k) / n), y0 + Math.round(((y1 - y0) * k) / n), c);
  }

  // ---------- 背景：胡桃木墙、钟盘背面 ----------
  function paintWall(r) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const bx = x % 13, hh = h32(x, y, 51);
      let c = bx === 0 ? "z" : bx === 1 ? "f" : hh % 37 === 0 || (h32(x, y >> 2, 52) % 9 === 0 && bx > 3) ? "f" : "g";
      if (y < 30 && bayer(x, y) < (30 - y) >> 1) c = c === "f" ? "g" : "z";       // 顶上更暗
      r.set(x, y, c);
    }
  }
  const GAPS = [[0.15, 0.32], [0.62, 0.74], [1.42, 1.52], [2.22, 2.42], [3.55, 3.66], [4.05, 4.18], [5.2, 5.38]];
  function inGap(a) { for (const [a0, a1] of GAPS) if (a >= a0 && a <= a1) return true; return false; }
  function paintDial(r) {
    disc(r, DIAL_X, DIAL_Y, DIAL_R, (x, y, d2) => {
      const d = Math.sqrt(d2), a = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
      if (d > DIAL_R - 3) return (Math.round(a * 16 / Math.PI) & 1) === 0 && d < DIAL_R - 1 && d > DIAL_R - 2.5 ? "e" : "x";   // 铁框和铆钉
      if (d > DIAL_R - 4.5) return inGap(a) ? "u" : "y";                                                        // 缝里透进的晨光
      if (d > 30) {                                                                                         // 黄道带：12 格
        const seg = (a * 6) / Math.PI, f = seg - Math.floor(seg);
        if (f < 0.06) return Math.floor(seg) % 2 ? "u" : "y";
        return d > 38 && d < 39.5 ? "x" : "q";
      }
      if (d > 28) return "x";
      return h32(x + 64, y + 64, 53) % 71 === 0 ? "r" : "q";
    });
    // 背面看的星图：反着的星座（暗金点，少数是透光的针孔）
    const STARS = [[-18, -12], [-12, -16], [-6, -11], [-1, -15], [8, -18], [14, -10], [19, -4], [-20, 2], [-14, 8], [-7, 14],
      [3, 18], [12, 13], [18, 7], [-3, -4], [6, 3], [-10, -2], [10, -4]];
    for (let i = 0; i < STARS.length; i++) {
      const [sx, sy] = STARS[i];
      if (i && i % 4 && i < 13) { const [px, py] = STARS[i - 1]; line(r, DIAL_X + px, DIAL_Y + py, DIAL_X + sx, DIAL_Y + sy, "x"); }
    }
    for (let i = 0; i < STARS.length; i++) r.set(DIAL_X + STARS[i][0], DIAL_Y + STARS[i][1], i % 5 === 2 ? "u" : "e");
  }
  // ---------- 地形和不动的机关 ----------
  function plank(r, x0, x1, y0, rows, seam) {      // 横木：顶 1px 受光、底 1px 阴影
    for (let y = y0; y < y0 + rows; y++) for (let x = x0; x <= x1; x++) {
      const k = y - y0, hh = h32(x, y, 61);
      let c = k === 0 ? "F" : k === rows - 1 ? "g" : k === rows - 2 ? "f" : h32(x >> 2, y, 61) % 6 === 0 || hh % 41 === 0 ? "f" : "e";
      if (seam && k > 0 && k < rows - 2 && (x + (k > (rows >> 1) ? seam >> 1 : 0)) % seam === 0) c = "f";
      r.set(x, y, c);
    }
  }
  function post(r, x0, w, y0, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x < x0 + w; x++) r.set(x, y, x === x0 ? "F" : x === x0 + w - 1 ? "f" : h32(x, y, 62) % 7 ? "e" : "f");
  }
  function pulley(r, cx, cy) {
    disc(r, cx, cy, 5, (x, y, d2) => (d2 > 20 ? "f" : d2 < 3 ? "d" : x === 0 || y === 0 ? "e" : x + y < 0 ? "b" : "e"));
  }
  function weight(r, x, y) {                        // 铁配重
    for (let j = 0; j < 14; j++) for (let i = 0; i < 6; i++)
      r.set(x + i, y + j, j === 0 || j === 13 || j === 6 ? "e" : i === 0 ? "w" : i === 5 ? "y" : "x");
    r.set(x + 2, y - 1, "v"); r.set(x + 3, y - 1, "v");
  }
  function paintStatic(r) {
    plank(r, 0, W - 1, BEAM_Y, 8, 0);                                   // 顶梁
    for (let x = 18; x < W; x += 46) { r.set(x, BEAM_Y + 3, "d"); r.set(x, BEAM_Y + 5, "d"); }
    plank(r, 0, W - 1, FLOOR_Y, 14, 26);                                // 地板
    for (let y = FLOOR_Y + 14; y < H; y++) for (let x = 0; x < W; x++)
      r.set(x, y, (x + 7) % 40 < 3 ? "f" : y === FLOOR_Y + 14 ? "f" : h32(x >> 3, y, 63) % 5 ? "g" : "z");
    plank(r, GAL_X, W - 1, GAL_Y, 6, 18);                               // 右上走廊
    for (let k = 0; k < 3; k++) line(r, 286 + k, GAL_Y + 6, 314 + k, GAL_Y + 34, k === 0 ? "F" : k === 1 ? "e" : "f");
    // 竖井：两根立柱、滑轮、绳索、配重、升降台（lift）
    post(r, 0, 4, BEAM_Y + 8, FLOOR_Y - 1); post(r, 47, 4, BEAM_Y + 8, FLOOR_Y - 1);
    for (let y = BEAM_Y + 8; y < 30; y++) { r.set(12, y, "f"); r.set(36, y, "f"); }
    line(r, 17, 30, 17, 103, "c"); line(r, 31, 30, 31, 103, "c");      // 吊升降台的绳
    line(r, 7, 30, 7, 57, "F"); line(r, 41, 30, 41, 117, "F");          // 吊配重的绳
    line(r, 23, BEAM_Y + 8, 22, 76, "e"); line(r, 25, BEAM_Y + 8, 26, 70, "f");   // 垂下来的散绳
    line(r, 22, 76, 26, 70, "e");
    pulley(r, 12, 30); pulley(r, 36, 30);
    weight(r, 4, 58); weight(r, 38, 118);
    plank(r, 9, 39, 104, 4, 0);
    r.set(9, 104, "d"); r.set(39, 104, "d"); r.set(17, 104, "d"); r.set(31, 104, "d");
    // 墙上的拉杆（lever）
    for (let y = 122; y < 138; y++) for (let x = 110; x < 118; x++) r.set(x, y, x === 110 || y === 122 ? "e" : x === 117 || y === 137 ? "g" : "f");
    for (let y = 125; y < 135; y++) { r.set(113, y, "z"); r.set(114, y, "z"); }
    line(r, 113, 133, 106, 124, "v"); line(r, 114, 133, 107, 124, "w");
    disc(r, 106, 123, 1, (x, y) => (x + y < 0 ? "c" : "d"));
    // 跷跷板（seesaw）：黄铜三角支点 + 斜着的木板
    for (let j = 0; j < 8; j++) for (let i = -j; i <= j; i++) r.set(264 + i, FLOOR_Y - 8 + j, i === -j ? "d" : i === j ? "e" : "b");
    for (let x = 228; x <= 300; x++) {
      const y = seesawY(x);
      r.set(x, y, "F"); r.set(x, y + 1, "e"); r.set(x, y + 2, "f");
    }
    for (const x of [228, 300]) { const y = seesawY(x); r.set(x, y, "d"); r.set(x, y + 1, "b"); r.set(x, y + 2, "e"); }
    r.set(264, FLOOR_Y - 9, "f");
  }
  const seesawY = (x) => FLOOR_Y - 5 - Math.round(((x - 228) * 10) / 72);

  // ---------- 光：从钟盘缝里斜着照下来的晨光 ----------
  const BEAMS = [[0.23, 6], [0.68, 5], [1.47, 7], [2.32, 8]];
  let LIT = null, INBEAM = null;                     // LIT：抖动后真正提亮的像素；INBEAM：光束范围（浮尘只在这里看得见）
  const MOTES = [];
  function buildBeams() {
    LIT = new Uint8Array(W * H); INBEAM = new Uint8Array(W * H);
    const ux = 0.42, uy = 0.91;
    for (const [a, w] of BEAMS) {
      const ox = DIAL_X + Math.cos(a) * (DIAL_R - 3), oy = DIAL_Y + Math.sin(a) * (DIAL_R - 3);
      const len = (FLOOR_Y - oy) / uy;
      for (let y = Math.floor(oy); y < FLOOR_Y; y++) for (let x = 0; x < W; x++) {
        const dx = x - ox, dy = y - oy, t = dx * ux + dy * uy;
        if (t < 0 || t > len) continue;
        const d = Math.abs(dx * uy - dy * ux), half = w / 2 + t * 0.06;
        if (d > half) continue;
        INBEAM[y * W + x] = 1;
        const dens = (d > half - 1.5 ? 6 : 11) - Math.floor((t / len) * 5);
        if (bayer(x, y) < dens) LIT[y * W + x] = 1;
      }
      for (let i = 0; i < 9; i++) {
        const hh = h32(Math.round(a * 100), i, 64);
        MOTES.push({ ox, oy, len, off: ((hh % 100) / 100 - 0.5) * w, t0: hh % 1000, sp: 1 + ((hh >>> 10) % 2) });
      }
    }
  }

  // ---------- 比例尺：主角大小的人影（16×16，唯一的暖色高饱和）和箱子 ----------
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

  // ---------- 背景里慢慢转的黄铜齿轮 ----------
  const TAU = Math.PI * 2;
  // w：每个环境帧转过几个齿（相啮合的两个齿轮 w 相反）
  const GEARS = [
    { x: 84, y: 70, R: 20, n: 12, sp: 5, w: 1 / 6, ph: 0 },
    { x: 66, y: 99, R: 11, n: 7, sp: 4, w: -1 / 6, ph: 0.5 },
    { x: 290, y: 48, R: 15, n: 10, sp: 4, w: 1 / 8, ph: 0 },
    { x: DIAL_X, y: DIAL_Y, R: 7, n: 8, sp: 3, w: -1 / 4, ph: 0 },
  ];
  function gear(r, cx, cy, R, n, ang, spokes) {
    const R2 = R + 3;
    for (let y = -R2; y <= R2; y++) for (let x = -R2; x <= R2; x++) {
      const d2 = x * x + y * y; if (d2 > R2 * R2 + R2) continue;
      const px = cx + x, py = cy + y; if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const d = Math.sqrt(d2), a = Math.atan2(y, x) - ang, lit = x + y < 0;
      let c = null;
      if (d > R) {                                   // 齿：根部宽、齿尖窄
        let f = ((a * n) / TAU) % 1; if (f < 0) f += 1;
        if (d > R + 1.5 ? f > 0.12 && f < 0.42 : f < 0.54) c = lit ? "e" : "f";
      } else if (d > R - 2) c = lit ? "e" : "f";      // 轮缘
      else if (d < 1.2) c = "d";
      else if (d <= 2.5) c = "F";                     // 轮毂
      else if (d <= 4) c = "f";
      else {
        let s = ((a * spokes) / TAU) % 1; if (s < 0) s += 1;
        if (Math.min(s, 1 - s) * (TAU / spokes) * d < 1.3) c = "f";   // 辐条
        else { const k = r.get(px, py); c = DIM[k] || k; }              // 镂空处：背后的墙更暗
      }
      if (c) r.set(px, py, c);
    }
  }

  // ---------- 光里的浮尘 ----------
  function drawMotes(r, e) {
    for (const m of MOTES) {
      const tt = (m.t0 + ((e * m.sp) >> 1)) % Math.floor(m.len);
      const off = m.off + tri(e + m.t0, 36, 1);
      const x = Math.round(m.ox + 0.42 * tt + 0.91 * off), y = Math.round(m.oy + 0.91 * tt - 0.42 * off);
      if (x < 0 || y < 0 || x >= W || y >= FLOOR_Y) continue;
      if (INBEAM[y * W + x]) r.set(x, y, m.sp > 1 ? "u" : "v");
    }
  }

  // ---------- 摆锤和它投在墙上的大影子 ----------
  const SH_M = 4.4, SH_Y = DIAL_Y + PEND_L, SH_R = 14;   // 以摆锤静止高度为中心放大 4.4 倍
  let SHM = null;
  function drawShadow(r, dx, rise) {
    if (!SHM) SHM = new Uint8Array(W * H); else SHM.fill(0);
    const px = DIAL_X, py = SH_Y - SH_M * PEND_L;            // 枢轴的影子在画面上方外面
    const bx = DIAL_X + SH_M * dx, by = SH_Y - SH_M * rise;
    for (let y = 0; y < FLOOR_Y && y <= by; y++) {
      const xc = px + ((y - py) * (bx - px)) / (by - py);
      for (let x = Math.round(xc) - 3; x <= Math.round(xc) + 3; x++) {
        const dd = Math.abs(x - xc);
        if (x >= 0 && x < W && (dd < 2 || (dd < 3 && bayer(x, y) < 8))) SHM[y * W + x] = 1;
      }
    }
    for (let y = Math.floor(by - SH_R - 1); y <= by + SH_R + 1 && y < FLOOR_Y; y++)
      for (let x = Math.floor(bx - SH_R - 1); x <= bx + SH_R + 1; x++) {
        if (x < 0 || y < 0 || x >= W) continue;
        const d = Math.hypot(x - bx, y - by);
        if (d < SH_R - 1 || (d < SH_R + 1 && bayer(x, y) < 8)) SHM[y * W + x] = 1;
      }
    for (let i = 0; i < W * FLOOR_Y; i++) if (SHM[i]) {
      const x = i % W, y = (i / W) | 0, k = r.get(x, y);
      if (DIM[k]) r.set(x, y, DIM[k]);
    }
  }
  function drawPendulum(r, dx, rise) {
    const bx = DIAL_X + dx, by = DIAL_Y + PEND_L - rise;
    line(r, DIAL_X, DIAL_Y, bx, by, "e"); line(r, DIAL_X + 1, DIAL_Y, bx + 1, by, "f");
    disc(r, bx, by, BOB_R, (x, y, d2) => {             // 黄铜摆锤：左上受光
      if (d2 > (BOB_R - 1) * (BOB_R - 1) + BOB_R) return "f";
      const l = x * 2 + y * 3;
      return l < -14 ? "d" : l < 4 ? "F" : l < 16 ? "e" : "f";
    });
    r.set(bx - 3, by - 4, "c"); r.set(bx - 4, by - 3, "c");
    disc(r, DIAL_X, DIAL_Y, 3, (x, y, d2) => (d2 > 9 ? "f" : x + y < 0 ? "d" : "e"));
  }

  // ---------- 走廊上排队的木偶（整点后一个个转过来又转回去） ----------
  // 1 帽 2 帽暗面 3 木头脸 4 脸暗面 5 袍 6 袍暗面 7 眼 8 饰边
  const PUP_HATS = {
    cone: ["....1....", "...112...", "...112...", "..11122.."],
    crown: [".........", "..1.1.1..", "..11111..", "..12121.."],
    cap: [".........", "...111...", "..11112..", ".1111122."],
    bells: [".1.....1.", "..1...1..", "..11112..", "..11112.."],
  };
  const PUP_VIEWS = [
    ["...333...", "..33334..", ".373334..", "..33334..", "...334...", "....4....", "...555...", "..55565..",
      "..55565..", "..35565..", "..55565..", "..55565..", "..555665.", "..666666."],                  // 侧面（朝左排队）
    ["...333...", "..33334..", "..73734..", "..33334..", "...334...", "....4....", "..55555..", ".5558556.",
      ".5558556.", ".3558556.", ".5558556.", "..558556.", ".55585566", ".66666666"],                  // 四分之三
    ["...333...", "..33333..", "..37373..", "..33333..", "...343...", "....4....", "..55555..", ".5555555.",
      "5.55855.5", "5.55855.5", "3.55855.3", "..55855..", ".5558555.", ".6666666."],                  // 正面
  ];
  const PUPPETS = [
    { x: 246, hat: "cone", c: { 1: "w", 2: "x", 5: "q", 6: "y", 8: "v" } },
    { x: 264, hat: "crown", c: { 1: "d", 2: "e", 5: "B", 6: "g", 8: "d" } },
    { x: 282, hat: "cap", c: { 1: "e", 2: "f", 5: "n", 6: "o", 8: "F" } },
    { x: 300, hat: "bells", c: { 1: "C", 2: "B", 5: "v", 6: "w", 8: "u" } },
  ];
  const PUP_CACHE = {};
  function pupRows(i, v) {
    const key = i * 3 + v;
    if (!PUP_CACHE[key]) {
      const P = PUPPETS[i], map = Object.assign({ 3: "F", 4: "e", 7: "z" }, P.c);
      PUP_CACHE[key] = PUP_HATS[P.hat].concat(PUP_VIEWS[v]).map((row) => row.replace(/[1-8]/g, (d) => map[d]));
    }
    return PUP_CACHE[key];
  }
  function pupView(i, t) {                           // 环境帧：整点后第 4、9、14、19 帧依次转过来，停 3 秒再转回去
    const p = ((t % STRIKE) >> 1) - (4 + i * 5);
    if (p < 0 || p >= 15) return 0;
    return p < 1 || p >= 14 ? 1 : 2;
  }
  function drawPuppets(r, t) {
    for (let i = 0; i < PUPPETS.length; i++) {
      const x = PUPPETS[i].x;
      spr(r, pupRows(i, pupView(i, t)), x - 4, GAL_Y - 20);
      for (let k = -4; k <= 4; k++) r.set(x + k, GAL_Y - 2, Math.abs(k) === 4 ? "e" : "d");   // 小转台
      for (let k = -5; k <= 5; k++) r.set(x + k, GAL_Y - 1, Math.abs(k) === 5 ? "f" : "e");
    }
  }

  // ---------- 提示动物：钟楼猫头鹰（站在顶梁上，脑袋跟着摆锤转） ----------
  const OWL_BODY = [".eFcccEFe.", ".eFcEcEFe.", ".efEcEcfe.", ".eFcEcEFe.", "..eFcEFe..", "...eFFe...", "...d..d..."];
  const OWL_FRONT = ["..e....e..", "..FFFFFF..", ".FccccccF.", ".FczcczcF.", ".FcceeccF.", "..FccccF..", "...FFFF..."];
  const OWL_SIDE = ["...e....e.", "...FFFFF..", "..FFccccF.", "..FczcczF.", "..FFceecF.", "...FccccF.", "....FFFF.."];
  const blink = (rows) => rows.map((s) => s.replace(/z/g, "F"));
  const OWL_HEADS = [OWL_FRONT, OWL_SIDE, blink(OWL_FRONT), blink(OWL_SIDE)];
  const OWL_X = 167;
  function drawOwl(r, t, dx) {
    const dir = dx > 8 ? 1 : dx < -8 ? -1 : 0, shut = t % 46 < 2 ? 2 : 0;
    spr(r, OWL_BODY, OWL_X, BEAM_Y - 7);
    spr(r, OWL_HEADS[(dir ? 1 : 0) + shut], OWL_X, BEAM_Y - 14, dir < 0);
  }

  // ---------- 怪物：发条乌鸦（走过来啄一阵箱子就走，背上的发条钥匙一直转） ----------
  const CROW_BODY = [
    ".......yyyy.....", "......yxxxxyy...", ".....yxwwxxxxyy.", "...yyxwwwwxxxyyy", "...yxxxwwwwxxy.y",
    "....yxxxxxxyy...", ".....yyyyyy.....",
  ];
  const CROW_LEGS = [[".......v.v......", "......vv.vv....."], ["......v...v.....", ".....vv...vv...."]];
  const CROW_HEAD = ["...yyy..", "..yxxxy.", ".yxvixxy", "vvyxxxxy", ".vyyxxy."];
  const CROW_KEY = [["d.d", "ddd", ".e."], [".d.", ".d.", ".e."]];
  function drawCrow(r, t) {
    const p = t % 104;
    let x, left = true, peck = false, walk = false;
    if (p < 28) { x = 150 - 2 * p; walk = true; }
    else if (p < 52) { x = 94; peck = (p - 28) % 6 < 2; }
    else if (p < 56) { x = 94; left = false; }
    else if (p < 84) { x = 94 + 2 * (p - 56); left = false; walk = true; }
    else { x = 150; left = false; }
    const y = FLOOR_Y - 13, flip = !left, legs = walk ? (p >> 1) & 1 : 0;
    spr(r, CROW_BODY, x, y + 4, flip);
    spr(r, CROW_LEGS[legs], x, y + 11, flip);
    spr(r, CROW_KEY[(t >> 1) & 1], flip ? x + 5 : x + 8, y + 1);
    spr(r, CROW_HEAD, flip ? x + 8 : x - (peck ? 2 : 0), y + 2 + (peck ? 1 : 0), flip);
  }

  // ---------- 整点：梁上和走廊底下簌簌落灰 ----------
  const DUST = [];
  function dustAt(i) { const hh = h32(i, 7, 65); return { x: i < 18 ? 56 + (hh % 230) : GAL_X + 4 + (hh % 80), y0: i < 18 ? BEAM_Y + 8 : GAL_Y + 6, d: (hh >>> 8) % 6, sp: 2 + ((hh >>> 12) % 2) }; }
  function drawDust(r, t) {
    const p = t % STRIKE; if (p >= 44) return;
    if (!DUST.length) for (let i = 0; i < 26; i++) DUST.push(dustAt(i));
    const fe = p >> 1;
    for (const q of DUST) for (let j = 0; j < 3; j++) {   // 每处落下一小串
      const k = fe - q.d - j * 3; if (k < 0 || k > 15) continue;
      const x = q.x + tri(k + q.d * 3, 8, 1), y = q.y0 + k * q.sp;
      if (y >= FLOOR_Y) continue;
      r.set(x, y, j ? "w" : INBEAM[y * W + x] ? "u" : "v");
    }
  }

  // ---------- 一帧 ----------
  let BG = null, ST = null, frame = null;
  function build() {
    PB = root.PB; h32 = PB.h32; DIM = PB.DIM;
    BG = new PB.Raster(W, H); paintWall(BG); paintDial(BG);
    buildBeams();
    for (let i = 0; i < W * FLOOR_Y; i++) if (LIT[i]) {        // 晨光直接烘进背景（光只落在背景上）
      const x = i % W, y = (i / W) | 0, k = BG.get(x, y);
      if (MORNING[k]) BG.set(x, y, MORNING[k]);
    }
    ST = new PB.Raster(W, H); paintStatic(ST);
  }
  function draw(ctx, tick) {
    if (!BG) build();
    const t = tick | 0, e = t >> 1;
    if (!frame) frame = new PB.Raster(W, H);
    const r = frame;
    r.data.set(BG.data);
    const dx = Math.round(27 * Math.sin((TAU * e) / 32)), rise = Math.round((dx * dx) / (2 * PEND_L));   // 8 秒一个来回
    for (const g of GEARS) gear(r, g.x, g.y, g.R, g.n, ((e * g.w + g.ph) * TAU) / g.n, g.sp);
    drawShadow(r, dx, rise);
    drawMotes(r, e);
    drawPendulum(r, dx, rise);
    r.blit(ST, 0, 0);
    drawPuppets(r, t);
    drawOwl(r, t, dx);
    drawCrow(r, t);
    drawDust(r, t);
    crate(r, 232, seesawY(240) - 16);                  // 跷跷板低的那头放着一个箱子
    crate(r, 76, FLOOR_Y - 16);
    spr(r, PERSON, 56, FLOOR_Y - 16);
    const sp = t % STRIKE;                             // 整点：整座楼一震（先往下 1 像素，再往上 1 像素）
    if (sp < 2) r.data.copyWithin(W * 4, 0, (H - 1) * W * 4);
    else if (sp < 4) r.data.copyWithin(0, W * 4, H * W * 4);
    ctx.putImageData(new ImageData(r.data, W, H), 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES["clock_tower"] = { draw };
})(typeof window !== "undefined" ? window : globalThis);
