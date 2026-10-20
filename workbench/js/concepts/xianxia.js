/* ART-04h 概念场景：仙山云海（xianxia）。只看大致效果：不是正式资产，不是关卡，没有规则。
 * 一屏 320×180；只用 ENDESGA 32（像素都经 PB.Raster 写入，色码不对会直接报错）；整数像素，不抗锯齿。
 * 环境 4 fps：f = tick >> 1；动物 8 fps：直接用 tick。静态层第一次调用时画好缓存，之后每帧只叠动画层。
 * 后→前：天空、太阳、远山 → 后层云海 → 鹤群 → 青绿中景峰 → 中层云海
 *        → 近景（浮岛、迎客松、朱红亭、主角、箱子）→ 瀑布 → 祥云平台 → 山魈、仙鹤 → 前层云海。 */
window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
(function () {
  "use strict";
  const W = 320, H = 180;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const hash = (x, y, s) => window.PB.h32(x, y, s);
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  const raster = () => new window.PB.Raster(W, H);
  function vgrad(r, x0, x1, stops) {
    for (let i = 0; i + 1 < stops.length; i++) {
      const [ya, ca] = stops[i], [yb, cb] = stops[i + 1];
      for (let y = ya; y < yb; y++) {
        const t = Math.floor(((y - ya) * 17) / (yb - ya));
        for (let x = x0; x < x1; x++) r.set(x, y, bay(x, y) < t ? cb : ca);
      }
    }
  }
  function remap(r, x, y, map) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = r.get(x, y);
    if (map[c]) r.set(x, y, map[c]);
  }
  // 小精灵：先画进格子，再加 1px 描边，得到 blitRows 能用的字符串行
  function grid(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(".")); return g; }
  function gset(g, x, y, c) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
  function outlined(g, c) {
    const h = g.length, w = g[0].length, o = g.map((row) => row.slice());
    const full = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== ".";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (g[y][x] === "." && (full(x - 1, y) || full(x + 1, y) || full(x, y - 1) || full(x, y + 1))) o[y][x] = c;
    return o.map((row) => row.join(""));
  }

  // ---------- 天空、太阳、远山（不动） ----------
  // 山峰轮廓：顶部圆，往下按 fl / fr（每 16 行加宽几像素）变宽；返回 [y, 左, 右]
  function peakRows(cx, top, bottom, hw, cap, fl, fr, seed) {
    const out = [];
    for (let y = top; y < bottom; y++) {
      const dy = y - top, round = Math.round(hw * Math.sqrt(Math.min(dy + 1, cap) / cap)), below = Math.max(0, dy - cap);
      const jl = hash(cx, y >> 2, seed) % 3 === 0 ? 1 : 0, jr = hash(cx, y >> 2, seed + 1) % 3 === 0 ? 1 : 0;
      out.push([y, cx - round - ((below * fl) >> 4) - jl, cx + round + ((below * fr) >> 4) + jr]);
    }
    return out;
  }
  const FAR = [[22, 74, 10, 9], [64, 64, 9, 8], [110, 78, 12, 11], [158, 70, 8, 10], [206, 60, 10, 8], [252, 72, 12, 10], [298, 62, 9, 9]];
  function buildSky() {
    const r = raster();
    vgrad(r, 0, W, [[0, "v"], [40, "u"], [104, "c"], [H, "c"]]);
    const GOLD = { v: "u", u: "c", c: "t" };
    const SX = 44, SY = 28;
    // 金色晨光：从左上的太阳斜照下来的几道光带，只把天空提亮一级，离太阳越远越稀
    const RAYS = [[13, 18], [26, 29], [39, 45], [57, 60]];
    for (let y = SY; y < 132; y++) for (let x = SX; x < W; x++) {
      const dx = x - SX, dy = y - SY, a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (!RAYS.some(([lo, hi]) => a >= lo && a <= hi)) continue;
      const t = Math.floor(6 - Math.sqrt(dx * dx + dy * dy) / 30);
      if (t > 0 && bay(x, y) < t) remap(r, x, y, GOLD);
    }
    for (let y = SY - 26; y <= SY + 26; y++) for (let x = SX - 26; x <= SX + 26; x++) {
      const dx = x - SX, dy = y - SY, d2 = dx * dx + dy * dy;
      if (d2 <= 26) r.set(x, y, "t");
      else if (d2 <= 44) r.set(x, y, "l");
      else {
        const t = Math.floor(16 - ((Math.sqrt(d2) - 6.6) * 16) / 20);
        if (t > 0 && bay(x, y) < t) remap(r, x, y, GOLD);
      }
    }
    // 远山：淡淡的灰蓝剪影，左边一像素受光
    FAR.forEach(([cx, top, hw, fl], i) => {
      for (const [y, xl, xr] of peakRows(cx, top, 134, hw, 9, fl, fl + 1, 11 + i))
        for (let x = xl; x <= xr; x++) r.set(x, y, x === xl ? "u" : "v");
    });
    return r;
  }

  // ---------- 青绿中景峰（不动，透明层） ----------
  // 顶上石青、中段石绿、山脚赭石；左边受光、右边背光，加竖向短皴；山脚化进云雾
  const MIDC = [["r", "q", "x"], ["m", "n", "o"], ["c", "d", "F"]];
  const MID = [[172, 30, 10, 9, 3, 4], [198, 50, 9, 8, 4, 3], [150, 62, 7, 6, 4, 4], [8, 52, 10, 9, 3, 3]];
  function buildMid() {
    const r = raster();
    MID.forEach(([cx, top, hw, cap, fl, fr], i) => {
      const seed = 31 + i;
      for (const [y, xl, xr] of peakRows(cx, top, 142, hw, cap, fl, fr, seed)) {
        const dy = y - top, w = xr - xl + 1;
        for (let x = xl; x <= xr; x++) {
          const b = bay(x, y);
          const zone = dy < 9 ? 0 : dy < 15 ? (b < ((dy - 9) * 16) / 6 ? 1 : 0) : 1;
          const C = MIDC[zone], rel = ((x - xl) * 16) / w;
          let c = C[1];
          if (x === xl || (rel < 3 && dy > 3 && (hash(x, y >> 1, seed) & 3) === 0)) c = C[0];
          else if (rel > 10 + (hash(y >> 2, 0, seed) % 3)) c = C[2];
          else if (hash(x, y >> 2, seed + 7) % 19 === 0) c = C[2];
          r.set(x, y, c);
        }
      }
    });
    for (let y = 92; y < H; y++) for (let x = 0; x < W; x++)
      if (r.get(x, y) !== "." && bay(x, y) < ((y - 92) * 16) / 30) r.set(x, y, y > 108 && bay(x, y) < 4 ? "t" : "u");
    return r;
  }

  // ---------- 近景（不动，透明层）：两座浮岛、迎客松、朱红亭、瀑布出水口、主角和箱子 ----------
  // 浮岛岩石（青绿山水的画法）：顶面草（1px 受光边）；山体分成一道道斜褶，褶线是暗线，
  // 褶的左边受光、右边背光，面上有竖向短皴。上半截褶脊（受光面）石青、其余石绿；往下褶脊石绿、其余赭石；
  // 最下全是赭石。底面 1px 阴影在 buildNear 里另加
  const RZ = [["m", "n", "o"], ["q", "q", "x"], ["F", "e", "f"]];
  function rockPx(r, x, y, top, seed) {
    const d = y - top;
    if (d === 0) return r.set(x, y, "m");
    if (d <= 2) return r.set(x, y, hash(x, y, seed) % 5 === 0 ? "m" : "n");
    if (d === 3) return r.set(x, y, "o");
    const b = bay(x, y), FW = 21, fx = x + (d >> 2) + (hash(d >> 3, 0, seed) % 3), u = ((fx % FW) + FW) % FW;
    const low = d < 26 ? 0 : d < 36 ? (b < ((d - 26) * 16) / 10 ? 1 : 0) : d < 48 ? 1 : d < 56 ? (b < ((d - 48) * 16) / 8 ? 2 : 1) : 2;
    const C = RZ[low === 0 ? (u <= 5 ? 1 : 0) : low === 1 ? (u <= 6 ? 0 : 2) : 2];
    const stroke = hash(x, (y + (hash(x, 1, seed) & 7)) >> 2, seed) % 6 === 0;
    if (u === 0) return r.set(x, y, C[2]);
    if (u <= 5) return r.set(x, y, stroke ? C[1] : C[0]);
    if (u >= 15) return r.set(x, y, stroke ? C[1] : C[2]);
    r.set(x, y, stroke ? (u < 10 ? C[0] : C[2]) : C[1]);
  }
  const LT = 112, RT = 80; // 左岛、右峰的顶面
  function leftXR(y) { return y === LT ? 114 : y === LT + 1 ? 115 : y < 124 ? 116 : 116 - Math.floor(((y - 124) * 60) / 56) - (hash(y >> 2, 1, 5) % 3); }
  function rightXL(y) { return y === RT ? 230 : y === RT + 1 ? 229 : y < 126 ? 228 - (y > 100 && y < 118 ? 2 : 0) : 228 + Math.floor(((y - 126) * 96) / 48) + (hash(y >> 2, 2, 5) % 3); }
  function line(r, pts, w0, w1, cols) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / n), y = Math.round(ay + ((by - ay) * k) / n);
        const w = Math.round(w0 + ((w1 - w0) * (i * n + k)) / ((pts.length - 1) * n));
        for (let j = 0; j < w; j++) r.set(x - (w >> 1) + j, y, j === 0 ? cols[0] : j === w - 1 ? cols[2] : cols[1]);
      }
    }
  }
  function pad(r, cx, cy, rx, ry, seed) {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
      const rr = rx + ((hash(x >> 1, y, seed) % 3) - 1), dx = (x - cx) / rr, dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy > 1) continue;
      r.set(x, y, y <= cy - ry + 1 ? (hash(x, y, seed) % 3 ? "n" : "m") : y >= cy + ry ? "p" : hash(x, y, seed) % 4 === 0 ? "n" : "o");
    }
  }
  function pine(r) {
    line(r, [[100, 112], [99, 104], [101, 96], [104, 88], [103, 80], [100, 72], [98, 62]], 5, 2, ["e", "f", "g"]);
    line(r, [[103, 87], [114, 83], [124, 81], [136, 79], [150, 77]], 2, 2, ["e", "f", "g"]);
    line(r, [[101, 76], [92, 73], [84, 72]], 2, 1, ["e", "f", "g"]);
    pad(r, 98, 58, 13, 4, 1); pad(r, 84, 70, 9, 3, 2); pad(r, 112, 68, 8, 3, 3);
    pad(r, 126, 77, 6, 2, 4); pad(r, 148, 73, 12, 3, 5);
  }
  function pavilion(r) {
    const base = RT, cx = 282;
    for (let y = base - 5; y < base; y++) for (let x = 254; x <= 310; x++) r.set(x, y, y === base - 5 ? "u" : y === base - 1 ? "w" : "v");
    for (const px of [259, 281, 303]) for (let y = base - 24; y < base - 5; y++) { r.set(px, y, "a"); r.set(px + 1, y, "h"); }
    for (let x = 257; x <= 307; x++) {
      r.set(x, base - 12, "a"); r.set(x, base - 8, "h");
      if (x % 3 === 0) for (let y = base - 11; y < base - 8; y++) r.set(x, y, "h");
    }
    for (let y = base - 28; y < base - 24; y++) for (let x = 254; x <= 310; x++)
      r.set(x, y, y === base - 28 ? "a" : (x + y) % 6 === 0 ? "k" : y === base - 25 ? "q" : "r");
    const halfW = 36, apex = base - 46, eave = base - 29;
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      const dx = Math.abs(x - cx), t = 1 - dx / halfW;
      let y0 = Math.round(eave - (eave - apex) * t * t), y1 = eave;
      if (dx > halfW - 6) { y0 -= dx - (halfW - 6); y1 = Math.min(eave, y0 + 2); }
      for (let y = y0; y <= y1; y++) r.set(x, y, y === y0 ? "w" : y === eave ? "y" : x % 3 === 0 ? "y" : "x");
    }
    r.set(cx, apex - 1, "k"); r.set(cx - 1, apex - 1, "k"); r.set(cx + 1, apex - 1, "k"); r.set(cx, apex - 2, "k"); r.set(cx, apex - 3, "l");
  }
  function buildNear() {
    const r = raster();
    for (let y = LT; y < H; y++) for (let x = 0; x <= leftXR(y); x++) rockPx(r, x, y, LT, 71);
    for (let y = RT; y < H; y++) for (let x = rightXL(y); x < W; x++) rockPx(r, x, y, RT, 73);
    for (let y = H - 2; y > LT; y--) for (let x = 0; x < W; x++) if (r.get(x, y) !== "." && r.get(x, y + 1) === ".") r.set(x, y, "g");
    // 草顶上的几簇草
    for (let x = 2; x < W; x += 3) {
      const top = x <= 114 ? LT : x >= 230 ? RT : 0, h = hash(x, 0, 77);
      if (top && h % 3 === 0) { r.set(x, top - 1, "n"); if (h % 7 === 0) r.set(x, top - 2, "m"); }
    }
    pine(r);
    pavilion(r);
    const S = window.PB.sprites;
    S.draw(r, "char.portitor", "idle", 0, 40, LT, false);
    S.draw(r, "obj.crate_wood", "default", 0, 64, LT, false);
    S.draw(r, "obj.crate_wood", "default", 0, 80, LT, false);
    return r;
  }

  // ---------- 小精灵 ----------
  // 祥云平台（moving_platform 的样子）：平顶、下面几团云、两头卷云纹，灰蓝描边好和云海分开
  function buildPlatform(w) {
    const g = grid(w + 2, 14), circ = [[5, 5, 5], [w >> 1, 6, 6], [w - 6, 5, 5], [(w >> 2) + 2, 7, 4], [w - (w >> 2) - 2, 7, 4]];
    for (let y = 0; y < 12; y++) for (let x = 0; x < w; x++) {
      const inTop = y <= 3 && x >= 2 && x <= w - 3;
      const inC = circ.some(([cx, cy, rr]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr * rr);
      if (inTop || inC) gset(g, x + 1, y + 1, y === 0 ? "c" : y <= 4 ? "t" : "u");
    }
    for (let x = 1; x <= w; x++) for (let y = 12; y > 1; y--) if (g[y][x] !== ".") { g[y][x] = "v"; break; }
    for (const [x, y] of [[4, 6], [5, 5], [6, 6], [6, 7], [5, 8], [4, 8], [3, 7]]) { gset(g, x + 1, y, "v"); gset(g, w - x, y, "v"); }
    return outlined(g, "w");
  }
  // 山魈（怪物）：一只手抓松枝倒挂，红鼻梁、蓝脸颊、黄胡子；荡秋千用逐行错位
  function buildMandrill() {
    const g = grid(14, 23), P = (x, y, c) => gset(g, x + 1, y + 1, c);
    const ROWS = [
      "..gg..........",
      "..fe..........",
      "..fe..........",
      "..fe..........",
      "..fe.fffff....",
      "..feffffffff..",
      "..fefleifleff.",
      "..fefrqiqrff..",
      "..fefrqDqrff..",
      "..feffkkkfff..",
      "..ff.fkkkf....",
      "..ffffffffff..",
      "..fffeeeefff..",
      "..ffeeeeeeff..",
      "..ffeeeeeefff.",
      "..ffeeeeeef.f.",
      ".f.ffeeeeff.g.",
      "f..ffffffff...",
      "....ff..ff....",
      "....ff..ff....",
      "....gg..gg....",
    ];
    ROWS.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") P(x, y, row[x]); });
    return outlined(g, "z");
  }
  // 仙鹤（提示动物）：单脚站立；三个姿势：缩颈 → 伸颈 → 仰头
  const CRANE_NECK = [
    { neck: [[5, 13], [4, 12], [4, 11], [5, 10], [5, 9], [4, 8]], head: [3, 6], beak: [[0, 7], [1, 7], [2, 7]] },
    { neck: [[5, 13], [5, 12], [5, 11], [5, 10], [5, 9], [5, 8], [5, 7], [5, 6]], head: [4, 4], beak: [[1, 5], [2, 5], [3, 5]] },
    { neck: [[5, 13], [5, 12], [5, 11], [5, 10], [5, 9], [5, 8], [5, 7], [5, 6], [5, 5]], head: [4, 3], beak: [[3, 2], [3, 1], [2, 0]] },
  ];
  function buildCrane(pose) {
    const g = grid(18, 26), P = (x, y, c) => gset(g, x + 1, y + 1, c), N = CRANE_NECK[pose];
    for (let y = 13; y <= 18; y++) for (let x = 4; x <= 14; x++) {
      const dx = (x - 9) / 5.5, dy = (y - 15.5) / 3;
      if (dx * dx + dy * dy <= 1.05) P(x, y, y >= 18 ? "u" : "t");
    }
    for (const [x, y] of [[12, 14], [13, 14], [13, 15], [14, 15], [15, 15], [12, 16], [13, 16], [14, 16], [15, 16], [14, 17], [15, 17], [16, 17]]) P(x, y, "z");
    for (const [x, y] of N.neck) { P(x, y, "z"); P(x + 1, y, "t"); }
    const [hx, hy] = N.head;
    P(hx, hy, "i"); P(hx + 1, hy, "i"); P(hx, hy + 1, "z"); P(hx + 1, hy + 1, "t"); P(hx + 2, hy + 1, "t");
    for (const [x, y] of N.beak) P(x, y, "c");
    // 细腿不描边：一条腿站着，另一条缩在肚子下
    const rows = outlined(g, "z").map((row) => row.split(""));
    for (let y = 20; y <= 24; y++) rows[y][9] = "x";
    rows[24][8] = "x"; rows[24][10] = "x"; rows[20][11] = "x"; rows[21][12] = "x"; rows[22][11] = "x";
    return rows.map((row) => row.join(""));
  }
  const CURL = [".vvv.", "v...v", "v.v.v", "v..v.", ".vv.."];
  const FLY_UP = ["......zz....", ".......tt...", "........t...", "izzzttttttww"];
  const FLY_DN = ["izzzttttttww", "........t...", ".......tt...", "......zz...."];

  // ---------- 动画层 ----------
  // 一排云团：每团上半是圆、往下竖直铺满；顶边受光，侧边和下半背光；整排随 off 横向漂
  // P = [受光, 本色, 背光]；大小、间距、高低都按团的编号哈希，所以不会一模一样
  function puffs(r, base, gap, rmin, rmax, off, seed, P, curls) {
    const k0 = Math.floor((off - 2 * rmax) / gap) - 1, k1 = Math.floor((off + W + 2 * rmax) / gap) + 1;
    for (let y = base; y < H; y++) for (let x = 0; x < W; x++)
      r.set(x, y, y > base + (rmin >> 2) && bay(x, y) < Math.min(16, (y - base - (rmin >> 2)) * 2) ? P[2] : P[1]);
    for (let k = k0; k <= k1; k++) {
      const h = hash(k, 0, seed), rr = rmin + (h % (rmax - rmin + 1));
      const cx = k * gap + ((h >>> 8) % ((gap >> 1) + 1)) - off, cy = base - ((h >>> 16) % 4);
      if (cx + rr < 0 || cx - rr >= W) continue;
      for (let y = Math.max(0, cy - rr); y < H; y++) {
        const dy = y - cy;
        for (let x = Math.max(0, cx - rr); x <= Math.min(W - 1, cx + rr); x++) {
          const dx = x - cx, d2 = dx * dx + (dy < 0 ? dy * dy : 0);
          if (d2 > rr * rr) continue;
          let c = P[1];
          if (dy < 0 && d2 > (rr - 1) * (rr - 1) && dx < rr >> 1) c = P[0];
          else if (dy < 0 && d2 > (rr - 1) * (rr - 1) && dy > -(rr >> 1)) c = P[2];
          else if (dy > (rr >> 2) && bay(x, y) < Math.min(16, (dy - (rr >> 2)) * 2)) c = P[2];
          r.set(x, y, c);
        }
      }
      if (curls && (h >>> 20) % 2 === 0) r.blitRows(CURL, cx - 2 - (rr >> 2), cy - (rr >> 1), (h >>> 21) % 2 === 1);
    }
  }
  function flock(r, f) {
    const span = W + 140, x0 = W + 20 - ((f * 2 + 150) % span), y0 = 20 + tri(f, 40, 2);
    [[0, 0], [15, 5], [30, 9], [16, -5], [32, -9]].forEach(([dx, dy], k) => {
      r.blitRows(((f + k) >> 1) & 1 ? FLY_UP : FLY_DN, x0 + dx, y0 + dy, false);
    });
  }
  // 瀑布：从右峰顶的左沿翻下来，悬空落进云海；竖向条纹往下走，底部翻起水雾
  function waterfall(r, f) {
    for (const [x, y, c] of [[230, 79, "u"], [231, 79, "t"], [232, 79, "t"], [233, 79, "u"], [229, 80, "t"], [228, 80, "t"], [227, 81, "u"], [228, 81, "t"], [229, 81, "t"], [230, 80, "u"]])
      r.set(x, y, c);
    for (let y = 82; y < 152; y++) {
      const spread = y > 124 ? (y - 124) >> 3 : 0;
      for (let x = 222 - spread; x <= 228 + spread; x++) {
        const s = hash(x, Math.floor((y - f * 6) / 4), 41) % 6, edge = x === 222 - spread || x === 228 + spread;
        r.set(x, y, edge ? (s < 3 ? "w" : "v") : s === 0 ? "v" : s < 3 ? "u" : "t");
      }
    }
    const m = f % 3;
    for (const [dx, dy, rr] of [[-3, 0, 2 + (m === 0)], [3, -1, 2 + (m === 1)], [0, -2, 1 + (m === 2)]])
      for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr) r.set(225 + dx + x, 148 + dy + y, y < 0 ? "t" : "u");
  }

  let C = null, IMG = null, IMGCTX = null;
  function draw(ctx, tick) {
    if (!C) {
      C = { sky: buildSky(), mid: buildMid(), near: buildNear(), r: raster(), plA: buildPlatform(48), plB: buildPlatform(40),
        mandrill: buildMandrill(), crane: [0, 1, 2].map(buildCrane) };
    }
    const r = C.r, f = tick >> 1;
    r.data.set(C.sky.data);
    puffs(r, 128, 18, 6, 10, -(f >> 3), 201, ["c", "u", "v"], false);
    flock(r, f);
    r.blit(C.mid, 0, 0);
    puffs(r, 140, 24, 8, 13, -(f >> 2), 202, ["t", "t", "u"], false);
    r.blit(C.near, 0, 0);
    waterfall(r, f);
    const bob = tri(f, 16, 3);
    r.blitRows(C.plA, 137, 113 + bob, false);
    r.blitRows(C.plB, 183, 89 - bob, false);
    // 山魈：手抓在 (134,81)，四个错位帧来回荡
    const lean = [-3, -1, 1, 3, 1, -1][tick % 6], m = C.mandrill;
    for (let y = 0; y < m.length; y++) {
      const row = m[y], sh = Math.round((y * lean) / 8);
      for (let x = 0; x < row.length; x++) if (row[x] !== ".") r.set(129 + x + sh, 80 + y, row[x]);
    }
    // 仙鹤：长时间单脚站着，偶尔伸颈仰头
    const ph = tick % 40, pose = ph < 18 ? 0 : ph < 21 ? 1 : ph < 37 ? 2 : 1;
    r.blitRows(C.crane[pose], 230, RT - 25, false);
    puffs(r, 160, 30, 10, 15, -(f >> 1), 203, ["t", "t", "u"], false);
    puffs(r, 176, 38, 12, 18, -((f * 3) >> 2), 204, ["t", "t", "u"], true);
    if (IMGCTX !== ctx) { IMG = ctx.createImageData(W, H); IMGCTX = ctx; }
    IMG.data.set(r.data);
    ctx.putImageData(IMG, 0, 0);
  }
  window.PB_CONCEPT_SCENES.xianxia = { draw };
})();