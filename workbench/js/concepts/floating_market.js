/* 水上市场 · floating_market —— ART-04i 概念场景：只看大致效果，不是游戏资产，没有规则。
 * WB-05 的「地图概念」页每 125 ms 调用一次 draw(ctx, tick)，tick 每秒 +8，ctx 是 320×180 画布。
 * 只用 ENDESGA 32、整数像素、不抗锯齿；环境循环 4 fps（tick >> 1），动物 8 fps（tick）。
 * 画了：高脚屋和木栈道、载满水果的小木船（斗笠）、挂着灯笼的小桥、远处的梯田；漂流的小船（moving_platform / drift）、河水流向（water_flow）；
 * 环境：河水一直往右流、小船顺流漂、斗笠在船上晃、芭蕉叶摆、隔一阵来一场热带阵雨；鳄鱼（怪物，水里露眼睛）、翠鸟（提示动物，船头点头）。 */
(function (root) {
  "use strict";
  /* ---------- 小工具（每个概念脚本各带一份，互不依赖） ---------- */
  const W = 320, H = 180, NONE = 255, CODES = "abcdefghijklmnopqrstuvwxyzABCDEF";
  const P = {};
  for (let i = 0; i < 32; i++) P[CODES[i]] = i;
  const HEX = ("be4a2f d77643 ead4aa e4a672 b86f50 733e39 3e2731 a22633 e43b44 f77622 feae34 fee761 " +
    "63c74d 3e8948 265c42 193c3e 124e89 0099db 2ce8f5 ffffff c0cbdc 8b9bb4 5a6988 3a4466 262b44 181425 " +
    "ff0044 68386c b55088 f6757a e8b796 c28569").split(" ");
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  let buf = new Uint8Array(W * H), rgb = null, img = null, off = null;
  function px(x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H && c !== NONE) buf[y * W + x] = c; }
  function get(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? buf[y * W + x] : NONE; }
  function rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c); }
  function disc(cx, cy, r, c) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) px(cx + i, cy + j, c); }
  function dith(x, y, level) { return level > BAYER[((y & 3) << 2) | (x & 3)]; } // level 0..16
  function hash(x, y, s) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s | 0, 2147483647)) >>> 0;
    n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
  }
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  function line(x0, y0, x1, y1, c, w0, w1) { // 粗细从 w0 渐变到 w1 的整数线段
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      const w = Math.max(1, Math.round(w0 + (((w1 == null ? w0 : w1) - w0) * i) / n));
      rect(x - (w >> 1), y - (w >> 1), w, w, c);
    }
  }
  function sprite(rows) {
    const h = rows.length, w = rows[0].length, d = new Uint8Array(w * h).fill(NONE);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (ch !== "." && ch !== " ") d[y * w + x] = P[ch]; }
    return { w, h, d };
  }
  function blank(w, h) { return { w, h, d: new Uint8Array(w * h).fill(NONE) }; }
  function outlined(s, c) { // 四周加 1px 描边
    const w = s.w + 2, h = s.h + 2, d = new Uint8Array(w * h).fill(NONE);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.d[y * s.w + x] !== NONE)
      for (const o of [1, 2 * w + 1, w, w + 2]) d[y * w + x + o] = c;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const v = s.d[y * s.w + x]; if (v !== NONE) d[(y + 1) * w + x + 1] = v; }
    return { w, h, d };
  }
  function blit(s, x, y, flip) {
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const v = s.d[j * s.w + (flip ? s.w - 1 - i : i)];
      if (v !== NONE) px(x + i, y + j, v);
    }
  }
  function pen(s) { // 在小画布 s 上作画的画笔
    const sp = (x, y, c) => { if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.d[y * s.w + x] = c; };
    return {
      sp,
      box(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) sp(i, j, c); },
      ell(cx, cy, rx, ry, c) {
        for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++)
          if (i * i * ry * ry + j * j * rx * rx <= rx * rx * ry * ry + rx * ry) sp(cx + i, cy + j, c);
      },
      at(x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h ? s.d[y * s.w + x] : NONE; },
    };
  }
  const DIM = new Uint8Array(32); // 沿调色板压暗一级（与 raster.js 的 DIM 相同），用来画半透明的烟和雨幕
  "af be cv dF ef fg gz hg ih ja kb lk mn no op pz qy rq sr tu uv vw wx xy yz zz Ah Bg CB DC EF Fe".split(" ").forEach((m) => { DIM[P[m[0]]] = P[m[1]]; });
  const stamp = new Uint32Array(W * H);
  let frameNo = 1;
  function haze(x, y) { // 同一帧里每个像素最多压暗一次
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (stamp[i] === frameNo || buf[i] === NONE) return;
    stamp[i] = frameNo; buf[i] = DIM[buf[i]];
  }
  function puff(x, y, r, dens) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r && dith(x + i, y + j, dens)) haze(x + i, y + j); }
  function layer(fn) { const keep = buf; buf = new Uint8Array(W * H).fill(NONE); fn(); const out = buf; buf = keep; return out; }
  function over(src) { for (let i = 0; i < W * H; i++) if (src[i] !== NONE) buf[i] = src[i]; }
  function present(ctx) {
    if (!rgb) {
      rgb = new Uint8Array(96);
      const pal = root.PB && root.PB.PALETTE;
      for (let i = 0; i < 32; i++) {
        const v = parseInt(pal && pal[CODES[i]] ? pal[CODES[i]].slice(1) : HEX[i], 16);
        rgb[i * 3] = (v >> 16) & 255; rgb[i * 3 + 1] = (v >> 8) & 255; rgb[i * 3 + 2] = v & 255;
      }
    }
    if (!img) img = ctx.createImageData(W, H);
    const d = img.data;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const v = (buf[i] === NONE ? P.z : buf[i]) * 3;
      d[j] = rgb[v]; d[j + 1] = rgb[v + 1]; d[j + 2] = rgb[v + 2]; d[j + 3] = 255;
    }
    const cv = ctx.canvas;
    if (!cv || (cv.width === W && cv.height === H)) { ctx.putImageData(img, 0, 0); return; }
    if (!off) { off = root.document.createElement("canvas"); off.width = W; off.height = H; }
    off.getContext("2d").putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, cv.width, cv.height); ctx.restore();
  }

  /* ---------- 比例尺：主角大小的人影、木箱 ---------- */
  const FIGURE = sprite([
    "................",
    "......zzzz......",
    ".....zllkkz.....",
    "....zlkkkkkz....",
    "..zzzkkkkkkzzz..",
    ".zlkkkkkkkkkkbz.",
    "..zzzzzzzzzzzz..",
    "....zEEEEEEz....",
    "....zEzEEzEz....",
    "....zFEEEEFz....",
    "...zhiiiiiihz...",
    "..zEhiiiiiihEz..",
    "..zzhiiiiiihzz..",
    "...zhhhhhhhhz...",
    "....zgzzzzgz....",
    "....zzz..zzz....",
  ]);
  function crate(x, y) { // 木箱：描边 z，斜撑，左上受光
    rect(x, y, 16, 16, P.z);
    rect(x + 1, y + 1, 14, 14, P.b);
    rect(x + 3, y + 3, 10, 10, P.e);
    for (let i = 0; i < 10; i++) { px(x + 3 + i, y + 3 + i, P.b); px(x + 4 + i, y + 3 + i, P.b); if (i > 0) px(x + 2 + i, y + 3 + i, P.f); }
    rect(x + 1, y + 1, 14, 1, P.d); rect(x + 1, y + 1, 1, 14, P.d);
    rect(x + 1, y + 14, 14, 1, P.f); rect(x + 14, y + 1, 1, 14, P.f);
    rect(x + 3, y + 3, 10, 1, P.f);
  }

  /* ---------- 水上市场：布局 ---------- */
  const BANK_Y = 109, WALK_Y = 112, WALK_W = 148, WATER_Y = 144, LANE_Y = 128;      // 远岸线、栈道顶、近处水面、远航道吃水线
  const BRIDGE_X = 196, BRIDGE_W = 120, BRIDGE_C = BRIDGE_X + 60, BRIDGE_TOP = 92;
  const POST_X = 145, BOAT_X = 154, BOAT_Y = 120;                                       // 系船桩、果船精灵的左上角
  const RAIN_CYCLE = 192, RAIN_ON = 24, RAIN_OFF = 96, RAIN_RAMP = 10;                 // 环境帧：48 秒一轮，第 6–24 秒来一阵雨
  let BRIDGE = null, FAR = null, MID = null, NEAR = null, TOP = null, BOAT = null, FARBOATS = null, CROC = null, BIRD = null, HYACINTH = null;
  const LUM = HEX.map((h) => { const v = parseInt(h, 16); return 0.3 * (v >> 16) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255); });
  const LIGHTER = new Uint8Array(32);                                                    // 浑水里的流纹：比底色亮一级
  for (let i = 0; i < 32; i++) LIGHTER[i] = i;
  "Fd eF fe gf".split(" ").forEach((m) => { LIGHTER[P[m[0]]] = P[m[1]]; });
  function wave(t, period, phase) { return Math.round(Math.sin(((t + (phase || 0)) * Math.PI * 2) / period)); }
  const LANTERNS = [], POLES = [BRIDGE_X + 8, BRIDGE_C, BRIDGE_X + BRIDGE_W - 9];
  const FLOW_FAR = [], FLOW_NEAR = [];
  for (let k = 0; k < 24; k++) FLOW_FAR.push([hash(k, 1, 41) % 360, BANK_Y + 4 + (hash(k, 2, 41) % (WATER_Y - BANK_Y - 5)), 3 + (hash(k, 3, 41) % 6)]);
  for (let k = 0; k < 30; k++) FLOW_NEAR.push([hash(k, 1, 42) % 360, WATER_Y + 2 + (hash(k, 2, 42) % (H - WATER_Y - 3)), 4 + (hash(k, 3, 42) % 9)]);

  /* ---------- 远景：天空、远山、梯田、远岸、石拱桥、远处河面 ---------- */
  function drawSky() { // 潮湿的早晨：蓝 → 灰白 → 奶白，左上一轮白太阳
    const bands = [[P.r, 0], [P.u, 30], [P.c, 56]];
    for (let y = 0; y < WATER_Y; y++) for (let x = 0; x < W; x++) {
      let c = bands[0][0];
      for (let b = 1; b < bands.length; b++) { const s = bands[b][1]; if (y >= s || (y >= s - 8 && dith(x, y, (y - s + 8) * 2))) c = bands[b][0]; }
      px(x, y, c);
    }
    const sx = 40, sy = 19;
    for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
      const d = Math.sqrt(i * i + j * j);
      if (d > 6.5 && d <= 14 && dith(sx + i, sy + j, Math.round((16 * (14 - d)) / 7.5))) px(sx + i, sy + j, P.u);
    }
    disc(sx, sy, 6, P.t);
    cloud(100, 30, [[0, 0, 6], [8, -3, 8], [17, 0, 6], [25, 2, 4], [-7, 2, 4]]);
    cloud(252, 22, [[0, 0, 5], [7, -2, 7], [15, 0, 5], [-6, 1, 3]]);
    cloud(172, 46, [[0, 0, 3], [5, -1, 4], [10, 0, 3]]);
  }
  function cloud(cx, cy, parts) { // 积云：白，底边压一道灰
    const m = new Set();
    for (const [dx, dy, r] of parts) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
      if (i * i + j * j <= r * r + r && dy + j <= 3) m.add((cy + dy + j) * W + cx + dx + i);
    for (const k of m) px(k % W, (k / W) | 0, m.has(k + 2 * W) ? P.t : m.has(k + W) ? P.u : P.v);
  }
  function drawFarHills() { // 远山：灰蓝的山脊，朝左的坡受光
    const top = (x) => Math.round(54 + 9 * Math.sin(x * 0.021 + 1.3) + 6 * Math.sin(x * 0.053 + 0.2) + 3 * Math.sin(x * 0.13 + 2));
    for (let x = 0; x < W; x++) {
      const y0 = top(x), lit = top(x + 4) < y0 - 1;
      for (let y = y0; y < BANK_Y; y++) px(x, y, lit && y < y0 + 3 ? P.u : P.v);
    }
  }
  function terraceHill(cx, top, half, base, seed) { // 一座梯田山：一层层台面（有的灌了水映着天）、田坎暗，右边背光
    const n = (base - top) >> 2;
    let l = cx, r = cx;
    for (let k = 0; k < n; k++) {
      const hw = Math.max(3, Math.round(half * Math.pow((k + 1) / n, 1 / 2.2)));
      l = Math.min(l, cx - hw + (hash(k, 1, seed) % 5) - 2); r = Math.max(r, cx + hw + (hash(k, 2, seed) % 5) - 2);
      const wet = hash(k, 0, seed) % 3 === 0;
      for (let j = 0; j < 4; j++) for (let x = l; x <= r; x++) {
        const y = top + k * 4 + j, shade = x > cx + (r - cx) * 0.55;
        let c = j === 0 ? (wet && dith(x, y, 10) ? P.u : shade ? P.n : P.m) : j === 3 ? (shade ? P.p : P.o) : P.n;
        px(x, y, c);
      }
    }
  }
  function drawTerraces() { // 中景梯田，脚下一层薄雾
    terraceHill(286, 66, 64, 104, 7); terraceHill(150, 62, 78, 104, 3); terraceHill(32, 72, 52, 104, 5);
    for (let y = 88; y < 104; y++) { const lv = 9 - Math.abs(y - 96); for (let x = 0; x < W; x++) if (dith(x + (y >> 2) * 5, y, lv)) px(x, y, P.u); }
  }
  function palm(x, base, h, lean) { // 椰子树：细细弯弯的树干，顶上一簇往下垂的叶子
    const tx = x + lean, ty = base - h;
    for (let i = 0; i <= h; i++) { const f = i / h; px(Math.round(x + lean * f * f), base - i, P.o); }
    for (const [dx, dy] of [[-10, 4], [-7, -2], [-2, -5], [3, -5], [8, -2], [10, 4], [-5, 5], [5, 5]]) {
      const mx = tx + Math.round(dx * 0.55), my = ty + Math.min(dy, 0) - 1;
      line(tx, ty, mx, my, P.o, 1); line(mx, my, tx + dx, ty + dy + 2, P.o, 1);
    }
    px(tx - 1, ty + 1, P.p); px(tx + 1, ty + 1, P.p);
  }
  function drawTreeLine() { // 远岸：一排矮树丛，几棵椰子树
    for (let x = 0; x < W; x++) {
      const top = 101 + (hash(x >> 2, 0, 9) % 3) - (Math.sin(x * 0.11) > 0.5 ? 2 : 0);
      for (let y = top; y < BANK_Y; y++) px(x, y, y === top && hash(x, y, 2) % 3 === 0 ? P.n : P.o);
    }
    [[122, 24, 3], [133, 19, -2], [176, 27, 4], [188, 21, -3], [310, 23, -3]].forEach(([x, h, lean]) => palm(x, BANK_Y - 3, h, lean));
    for (let x = 0; x < W; x++) { px(x, BANK_Y, P.f); px(x, BANK_Y + 1, hash(x, 1, 4) % 3 ? P.F : P.e); }
  }
  function deckY(x) { const u = (x - BRIDGE_C) / (BRIDGE_W / 2); return BRIDGE_TOP + Math.round(12 * u * u); }
  function archY(x) { const u = (x - BRIDGE_C) / (BRIDGE_W / 2 - 13); return Math.abs(u) >= 1 ? 999 : 100 + Math.round(10 * u * u); }
  function stringY(x) { // 灯笼绳：在三根灯杆之间往下垂
    for (let k = 0; k < POLES.length - 1; k++) {
      const a = POLES[k], b = POLES[k + 1];
      if (x >= a && x <= b) { const ya = deckY(a) - 14, yb = deckY(b) - 14, u = (x - a) / (b - a); return Math.round(ya + (yb - ya) * u + 20 * u * (1 - u)); }
    }
    return -1;
  }
  function drawBridge() { // 远岸河汊上的小石拱桥：奶白石头、红栏杆、三根挂灯笼的杆子
    for (let x = BRIDGE_X; x < BRIDGE_X + BRIDGE_W; x++) {
      const top = deckY(x), au = archY(x);
      for (let y = top; y <= BANK_Y + 1; y++) {
        if (y >= au) { px(x, y, y < 104 ? P.p : y < 106 ? P.o : y === 106 ? P.F : P.e); continue; }
        let c = P.c;
        if (y <= top + 1) c = y === top ? P.t : P.d;
        else if (au < 999 && y >= au - 2) c = y === au - 1 ? P.F : P.d;
        else if ((y - top) % 4 === 1 || (x + (((y - top) >> 2) & 1) * 4) % 8 === 0) c = P.d;
        px(x, y, c);
      }
    }
    for (let x = BRIDGE_X + 2; x < BRIDGE_X + BRIDGE_W - 2; x++) { // 栏杆
      const y = deckY(x);
      px(x, y - 5, P.a); px(x, y - 2, P.h);
      if ((x - BRIDGE_X - 2) % 8 === 0) for (let k = 1; k <= 5; k++) px(x, y - k, P.a);
    }
    for (const x of POLES) { const y = deckY(x); rect(x, y - 15, 1, 15, P.f); px(x, y - 16, P.a); }
    for (let x = POLES[0]; x <= POLES[POLES.length - 1]; x++) {
      const y = stringY(x); px(x, y, P.f);
      if ((x - POLES[0]) % 9 === 4 && Math.abs(x - POLES[1]) > 2) LANTERNS.push([x, y + 1]);
    }
  }
  function drawFarRiver() { // 远处的河面：浑黄的水，靠岸压一层树影
    for (let y = BANK_Y + 2; y < WATER_Y; y++) for (let x = 0; x < W; x++) {
      let c = P.d;
      if (y >= 126 || (y >= 117 && dith(x, y, ((y - 117) * 16) / 9))) c = P.F;
      if (y < BANK_Y + 5 && dith(x + 1, y, 7)) c = P.F;
      px(x, y, c);
    }
  }
  function drawBank() { // 栈道后面一小块泥岸，芭蕉就长在这儿
    for (let x = 58; x < 130; x++) {
      const top = 105 + (hash(x >> 1, 0, 31) % 3) + (x < 63 || x > 124 ? 3 : 0);
      for (let y = top; y < 122; y++) px(x, y, y === top ? P.n : y < top + 2 ? P.o : y > 119 ? P.F : y > 116 ? P.e : P.f);
    }
  }

  /* ---------- 近景：高脚屋、木栈道、近处的水 ---------- */
  function drawHouse() { // 高脚屋：茅草顶、竖木板墙、支起来的窗板、开着的门
    const T = 80;
    for (let y = T; y < WALK_Y; y++) for (let x = 0; x < 60; x++) {
      const k = (x + 2) % 5;
      let c = k === 4 ? P.f : k === 0 ? P.F : P.e;
      if (y < T + 3) c = y < T + 1 ? P.g : P.f;
      if (y >= WALK_Y - 1) c = P.f;
      px(x, y, c);
    }
    rect(8, 90, 16, 10, P.f); rect(9, 91, 14, 8, P.g);                   // 窗洞和窗棂
    for (let x = 12; x < 22; x += 4) rect(x, 91, 1, 8, P.f);
    rect(6, 85, 20, 1, P.b); rect(6, 86, 20, 2, P.e); rect(6, 88, 20, 1, P.f);   // 支起来的窗板
    px(7, 89, P.f); px(24, 89, P.f);
    rect(36, 90, 15, 22, P.f); rect(37, 91, 13, 21, P.g);                  // 门洞
    rect(46, 91, 4, 21, P.d); for (let y = 92; y < 112; y += 2) rect(46, y, 4, 1, P.F);  // 卷起一半的草帘
    rect(37, 91, 9, 1, P.f);
    for (let y = 50; y <= T + 1; y++) {                                     // 茅草顶
      const f = (y - 50) / (T + 1 - 50), l = Math.round(8 - f * 16), r = Math.round(46 + f * 24);
      for (let x = l; x <= r; x++) {
        let c = P.d;
        if ((y - 50) % 6 === 5) c = (x + y) % 3 ? P.F : P.b;
        else if (hash(x, y >> 1, 21) % 6 === 0) c = P.F;
        else if (hash(x, y, 22) % 13 === 0) c = P.c;
        if (x >= r - 1 || x === l) c = P.F;
        px(x, y, c);
      }
    }
    for (let x = -8; x <= 70; x++) if (hash(x, 3, 23) % 3) px(x, T + 2, P.F);
    rect(7, 48, 40, 2, P.e); rect(7, 47, 40, 1, P.b);
  }
  function post(x, y0, y1) { // 木桩：左亮右暗，水下暗一截，越深越看不见
    for (let y = y0; y < y1; y++) for (let i = 0; i < 3; i++) {
      if (y > 160 && !dith(x + i, y, (y1 - y) * 2)) continue;
      px(x + i, y, y > WATER_Y ? (i === 0 ? P.f : P.g) : i === 0 ? P.e : i === 2 ? P.g : P.f);
    }
  }
  function drawWalk() { // 木栈道：木板面、横梁，下面一排木桩插进水里
    const posts = [2, 18, 34, 50, 74, 98, 122];
    for (let k = 0; k < posts.length - 1; k++) {
      const a = posts[k] + 2, b = posts[k + 1];
      line(a, WALK_Y + 6, b, WALK_Y + 24, P.f, 1);
      if (k < 3) line(b, WALK_Y + 6, a, WALK_Y + 24, P.f, 1);
    }
    for (const x of posts) post(x, WALK_Y + 5, 168);
    for (let x = 0; x < WALK_W; x++) {
      px(x, WALK_Y, P.d); px(x, WALK_Y + 1, x % 12 === 11 ? P.f : P.b);
      px(x, WALK_Y + 2, P.e); px(x, WALK_Y + 3, x % 12 === 11 ? P.f : P.e); px(x, WALK_Y + 4, P.f);
    }
    post(POST_X, 104, 168); rect(POST_X, 103, 3, 1, P.b); rect(POST_X - 1, 108, 5, 2, P.d); px(POST_X + 3, 109, P.F);
  }
  function drawNearWater() { // 近处的浑水：越深越暗；栈道在水里投下一片影子
    for (let y = WATER_Y; y < H; y++) for (let x = 0; x < W; x++) {
      let c = y < WATER_Y + 3 && dith(x, y, 10 - (y - WATER_Y) * 4) ? P.F : P.e;
      if (y >= 170 || (y >= 160 && dith(x, y, ((y - 160) * 16) / 10))) c = P.f;
      if (x < WALK_W && dith(x, y, 9 - (y - WATER_Y) * 0.6)) c = DIM[c];
      px(x, y, c);
    }
  }

  /* ---------- 会动的东西 ---------- */
  const BANANAS = [ // 芭蕉：根、顶、叶子（角度、长、宽、下垂）
    { bx: 74, by: 111, tx: 76, ty: 80, bunch: true,
      leaves: [[-2.8, 26, 4, 0.55], [-2.25, 22, 4, 0.35], [-1.85, 17, 3, 0.2], [-1.3, 20, 4, 0.3], [-0.6, 25, 4, 0.5], [0.05, 17, 3, 0.65]] },
    { bx: 112, by: 111, tx: 113, ty: 89, bunch: false,
      leaves: [[-3.0, 17, 3, 0.6], [-2.5, 19, 3, 0.45], [-1.65, 15, 3, 0.25], [-0.75, 19, 3, 0.45]] },
  ];
  function leaf(sx, sy, a, len, wid, droop) { // 一片芭蕉叶：叶柄细、叶面宽，边上有几道撕口
    const dx = Math.cos(a), dy = Math.sin(a), steps = len * 3;
    for (let i = 0; i <= steps; i++) {
      const s = i / steps, cx = sx + dx * len * s, cy = sy + dy * len * s + droop * len * s * s;
      const tx = dx, ty = dy + 2 * droop * s, tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl;
      const w = s < 0.18 ? 0 : wid * Math.pow(Math.sin((Math.PI * (s - 0.18)) / 0.82), 0.6);
      for (let o = -w; o <= w + 0.01; o += 0.5) {
        const up = Math.abs(ny) > 0.3 ? ny * o < 0 : nx * o < 0;
        if (Math.abs(o) > 1 && hash(Math.round(s * len), up ? 1 : 2, Math.round(a * 100)) % 5 === 0) continue;
        const edge = Math.abs(o) > w - 0.6 && !up;
        px(Math.round(cx + nx * o), Math.round(cy + ny * o), Math.abs(o) < 0.5 ? P.n : edge ? P.o : up ? P.m : P.n);
      }
    }
  }
  function bananas(t) { // 芭蕉叶慢慢摆
    BANANAS.forEach((b, n) => {
      for (let y = b.ty; y <= b.by; y++) {
        const x = Math.round(b.bx + ((b.tx - b.bx) * (b.by - y)) / (b.by - b.ty));
        px(x - 1, y, P.m); px(x, y, P.n); px(x + 1, y, P.o);
        if (y > b.by - 7 && hash(x, y, 33) % 3 === 0) px(x - 1 + (y & 1), y, P.F);
      }
      b.leaves.forEach(([a, len, wid, droop], i) => leaf(b.tx, b.ty, a + 0.07 * Math.sin(((t + n * 5 + i * 3) * Math.PI * 2) / 18), len, wid, droop));
      if (b.bunch) { // 一串青芭蕉和紫色的花苞
        line(b.tx + 1, b.ty + 1, b.tx + 6, b.ty + 4, P.n, 1);
        for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) { px(b.tx + 4 + k + r, b.ty + 4 + r * 2, P.l); px(b.tx + 4 + k + r, b.ty + 5 + r * 2, P.k); }
        line(b.tx + 9, b.ty + 9, b.tx + 9, b.ty + 11, P.n, 1);
        rect(b.tx + 8, b.ty + 12, 3, 3, P.B); px(b.tx + 8, b.ty + 12, P.C); px(b.tx + 9, b.ty + 15, P.B);
      }
    });
  }
  function lanterns(t) { // 绳上的小灯笼：一摇一摇
    LANTERNS.forEach(([x, y], i) => {
      const s = wave(t, 10, i * 3), body = i % 2 ? P.a : P.j, hi = i % 2 ? P.j : P.k;
      rect(x - 1, y, 3, 1, P.h);
      rect(x - 1 + s, y + 1, 3, 2, body); px(x + s, y + 1, hi);
      px(x + s, y + 3, P.h);
    });
  }
  function reflection(t) { // 石桥在远处河面上的倒影，随水波一行行错开
    for (let y = BANK_Y + 2; y < BANK_Y + 13; y++) {
      const wob = ((y + t) >> 1) & 1, my = 2 * (BANK_Y + 1) - y, fade = 8 - (y - BANK_Y - 2) * 0.7;
      for (let x = BRIDGE_X; x < BRIDGE_X + BRIDGE_W; x++) {
        const v = BRIDGE[my * W + x + wob];
        if (v === NONE || !dith(x, y, fade)) continue;
        px(x, y, v === P.p || v === P.o || v === P.e || v === P.F ? P.e : v === P.a || v === P.h ? P.F : v === P.f ? NONE : P.c);
      }
    }
  }
  function farFlow(t) { // 远处河面的流纹：慢慢往右
    for (const [x0, y, len] of FLOW_FAR) {
      const x = Math.floor((x0 + t * (y < 124 ? 0.5 : 1)) % 360) - 20;
      for (let i = 0; i < len; i++) px(x + i, y, y < 120 ? P.c : P.d);
    }
  }
  function nearFlow(t) { // 近处水面的亮线和流纹：往右，比远处快
    for (let x = 0; x < W; x++) px(x, WATER_Y, (((x - 2 * t) % 13) + 13) % 13 < 8 ? P.c : P.d);
    for (const [x0, y, len] of FLOW_NEAR) {
      const x = ((x0 + t * (y < 160 ? 2 : 1)) % 360) - 20;
      for (let i = 0; i < len; i++) { const v = get(x + i, y); if (v !== NONE) px(x + i, y, LIGHTER[v]); }
    }
  }
  function hat(cx, by, s, small) { // 斗笠：尖顶跟着 s（-1..1）左右晃，帽檐不动
    const rows = small ? [1, 3, 7] : [1, 3, 5, 9, 13], n = rows.length;
    rows.forEach((w, r) => {
      const off = r < n - 2 ? s : 0, y = by - (n - 1 - r);
      for (let i = 0; i < w; i++) px(cx - (w >> 1) + i + off, y, r === n - 1 ? (i === 0 || i === w - 1 ? P.F : P.d) : i < w >> 1 ? P.c : P.d);
    });
    if (!small) for (let i = -5; i <= 5; i++) px(cx + i, by + 1, P.f);
  }
  function farBoatSprite(kind) { // 远航道的小船：一条带篷子，一条堆着水果（斗笠另画）
    const s = blank(30, 12), p = pen(s);
    p.box(2, 7, 26, 3, P.f); p.box(4, 10, 22, 1, P.f); p.box(7, 11, 16, 1, P.g);
    p.box(2, 7, 26, 1, P.e); p.box(3, 7, 10, 1, P.b);
    p.box(0, 5, 2, 3, P.f); p.sp(0, 5, P.e); p.box(28, 4, 2, 4, P.f); p.sp(29, 3, P.f); p.sp(28, 4, P.e);
    if (kind === 0) {
      p.box(10, 2, 13, 5, P.d); p.box(12, 1, 9, 1, P.d); p.box(14, 0, 5, 1, P.F);
      for (let x = 11; x < 23; x += 3) p.box(x, 2, 1, 5, P.F);
      p.box(9, 3, 1, 4, P.f); p.box(23, 3, 1, 4, P.f);
      p.sp(24, 6, P.k); p.sp(25, 6, P.m); p.sp(26, 6, P.C); p.sp(25, 5, P.j);
    } else {
      [[6, 5, P.n], [7, 4, P.m], [8, 5, P.o], [9, 6, P.n], [11, 5, P.k], [12, 6, P.j], [13, 4, P.l], [14, 3, P.l], [15, 4, P.k],
        [16, 5, P.l], [18, 4, P.C], [19, 5, P.D], [18, 6, P.C], [21, 5, P.e], [22, 6, P.f], [20, 6, P.b], [10, 6, P.m], [17, 6, P.k]]
        .forEach(([x, y, c]) => p.sp(x, y, c));
    }
    return s;
  }
  function farBoats(t) { // 远航道上两条小船顺着水往右漂（moving_platform / drift）
    FARBOATS.forEach((s, k) => {
      const x = ((t + [266, 66][k]) % 400) - 40, y = LANE_Y - 9 + ((t + k * 7) % 16 < 8 ? 0 : 1);
      blit(s, x, y, false);
      for (let j = 0; j < s.h; j++) if (y + j > LANE_Y) for (let i = 0; i < s.w; i++) if (s.d[j * s.w + i] !== NONE) haze(x + i, y + j);
      px(x - 2, LANE_Y + 1, P.c); px(x + s.w + 1, LANE_Y, P.c);
      if (k === 1) hat(x + 14, y + 2, wave(t, 12, 3), true);
    });
  }
  function boatSprite() { // 栈道尽头系着的果船：船头画着眼睛，满满一船水果
    const s = blank(58, 28), p = pen(s);
    for (let c = 0; c < 58; c++) {
      const u = c / 57;
      const top = Math.round(16 - 4 * Math.max(0, (0.12 - u) / 0.12) - 8 * Math.pow(Math.max(0, (u - 0.8) / 0.2), 2));
      const bot = Math.round(27 - 7 * Math.pow(Math.max(0, (0.2 - u) / 0.2), 1.5) - 13 * Math.pow(Math.max(0, (u - 0.7) / 0.3), 1.6));
      for (let r = top; r <= bot; r++) {
        let col = (r - top) % 4 === 3 ? P.g : P.f;
        if (r === top) col = P.d; else if (r === top + 1) col = P.b; else if (r === top + 2) col = P.e;
        if (r >= bot - 1) col = P.g;
        p.sp(c, r, col);
      }
    }
    p.box(49, 16, 4, 3, P.i); p.box(50, 17, 2, 1, P.t); p.sp(51, 17, P.z);   // 船头的眼睛
    for (let r = 10; r <= 16; r++) for (let x = 8 + ((r - 10) >> 2); x <= 19 - ((r - 10) >> 2); x++) // 竹篮
      p.sp(x, r, r === 10 ? P.b : (x + r) % 2 ? P.d : P.F);
    for (const [x, y] of [[10, 8], [13, 7], [16, 8]]) { p.ell(x, y, 1, 1, P.k); p.sp(x + 1, y + 1, P.j); p.sp(x - 1, y - 1, P.l); }  // 芒果
    const melon = (cx, cy, rx, ry) => { // 西瓜
      p.ell(cx, cy, rx, ry, P.n);
      for (let x = cx - rx; x <= cx + rx; x++) if ((x - cx) % 3 === 0) for (let y = cy - ry; y <= cy + ry; y++) if (p.at(x, y) === P.n) p.sp(x, y, P.o);
      p.sp(cx - rx + 2, cy - ry + 1, P.m); p.sp(cx - rx + 3, cy - ry + 1, P.m);
    };
    melon(25, 13, 5, 3); melon(32, 9, 4, 3);
    p.ell(37, 14, 2, 2, P.C); p.sp(36, 13, P.D); p.sp(35, 12, P.m); p.sp(39, 12, P.m); p.sp(37, 11, P.m);   // 火龙果
    for (let f = 0; f < 4; f++) for (let y = 0; y < 5; y++) p.sp(40 + f * 2 + (y < 2 ? 0 : 1) - (y === 4 ? 1 : 0), 9 + y, y === 4 ? P.k : P.l);  // 香蕉
    p.box(42, 7, 3, 2, P.n);
    for (const [x, y] of [[45, 14], [42, 15]]) { p.ell(x, y, 2, 2, P.e); p.sp(x - 1, y - 1, P.b); p.sp(x + 1, y + 1, P.f); }  // 椰子
    return s;
  }
  const BIRD_ROWS = [ // 翠鸟（朝右）：蓝背、橙肚、白喉、长嘴；三帧点头
    ["....rr.....", "...rsrr....", "...rjzrzzz.", "..qrttzz...", "..qrrjj....", ".qqrrjj....", "qq.rjjb....", "....i.i...."],
    ["...........", "....rr.....", "...rsrr....", "..qrjzrzzz.", "..qrttz.z..", ".qqrrjj....", "qq.rjjb....", "....i.i...."],
    ["...........", "...........", "....rrr....", "..qrsrrr...", "..qrjzrz...", ".qqrttjz...", "qq.rjjbz...", "....i.i...."],
  ];
  const CROC_ROWS = [ // 鳄鱼（朝左）：水面上只露鼻孔、眼睛和背上一排鳞峰
    "..............oo.................................",
    ".............onmo................................",
    ".............okzo................................",
    ".nn.........ooooon..m...m...m...m...m...n...n....",
    "nzzn....nnnnnoooonnnonnnonnnonnnonnnonnnonnnonn..",
    "ooooooooooooooooooooooooooooooooooooooooooooooooo",
  ];
  function croc(tick) { // 鳄鱼（怪物）：在水里慢慢来回，眨眼，一沉一浮，水下有个影子
    const t = tick >> 1, leg = 46 + 20, p = t % (2 * leg);
    const right = p < leg, moving = p < 46 || (p >= leg && p < leg + 46);
    const x = p < 46 ? 222 + p : p < leg ? 268 : p < leg + 46 ? 268 - (p - leg) : 222;
    const s = CROC[(tick % 44) >= 41 ? 1 : 0], sink = (tick >> 3) % 5 === 4 ? 1 : 0, y = WATER_Y - s.h + sink;
    const X = (i) => (right ? x + s.w - 1 - i : x + i);
    for (let i = 0; i < 48; i++) { // 水下的影子和脚
      const th = i < 4 ? 1 : i < 13 ? 2 : i < 34 ? 4 : i < 41 ? 2 : 1;
      for (let j = 1; j <= th; j++) haze(X(i), WATER_Y + j);
    }
    const kick = moving ? (tick >> 1) & 1 : 0;
    for (const lx of [15, 31]) for (let j = 0; j < 3; j++) haze(X(lx + (kick ? j : -j)), WATER_Y + 4 + j);
    for (let j = 0; j < s.h; j++) if (y + j < WATER_Y) for (let i = 0; i < s.w; i++) {
      const v = s.d[j * s.w + i]; if (v !== NONE) px(X(i), y + j, v);
    }
    for (const [i, ph] of [[14, 0], [1, 3]]) { // 眼睛和鼻子边上一圈圈水纹
      const age = (t + ph) % 8;
      if (age < 6) { const c = age < 3 ? P.t : P.c; px(X(i) - 2 - age, WATER_Y, c); px(X(i) + 2 + age, WATER_Y, c); }
    }
  }
  function boat(t, tick) { // 系着的果船：轻轻起伏，斗笠在果堆上晃，翠鸟站在船头点头
    const y = BOAT_Y + (t % 12 < 6 ? 0 : 1);
    blit(BOAT, BOAT_X, y, false);
    for (let j = 0; j < BOAT.h; j++) if (y + j > WATER_Y) for (let i = 0; i < BOAT.w; i++) if (BOAT.d[j * BOAT.w + i] !== NONE) haze(BOAT_X + i, y + j);
    const r = t % 8 < 4 ? 0 : 1;
    px(BOAT_X - 2 - r, WATER_Y, P.t); px(BOAT_X + BOAT.w + 1 + r, WATER_Y, P.t);
    const mx = POST_X + 3, my = Math.round((108 + y + 12) / 2) + 2;
    line(POST_X + 3, 109, mx, my, P.d, 1); line(mx, my, BOAT_X + 2, y + 12, P.d, 1);
    hat(BOAT_X + 30, y + 5, wave(t, 10, 2), false);
    const f = [0, 1, 2, 1, 0, 0, 0, 0][tick & 7], b = BIRD[f];
    blit(b, BOAT_X + 51, y + 8 - b.h, false);
  }
  function hyacinth(t) { // 水葫芦：一小团一小团顺着水往右漂
    for (let k = 0; k < 2; k++) blit(HYACINTH, ((t * 2 + k * 190) % 380) - 30, WATER_Y - 3 + ((t + k * 5) % 10 < 5 ? 0 : 1), k === 1);
  }
  function rainLevel(t) { // 阵雨的强度 0..16：渐渐下大，再渐渐停
    const p = t % RAIN_CYCLE;
    if (p < RAIN_ON || p >= RAIN_OFF) return 0;
    return Math.min(16, Math.round((16 * Math.min(p - RAIN_ON, RAIN_OFF - p)) / RAIN_RAMP));
  }
  const RAINY = DIM.slice();                                                            // 下雨时远景褪成灰：蓝天变灰，其余压暗一级
  "rv tu uv cu".split(" ").forEach((m) => { RAINY[P[m[0]]] = P[m[1]]; });
  function rainVeil(lv) { // 雨幕：远景随雨势渐渐变灰变暗（雨大时整片换色，不留网点）
    if (!lv) return;
    for (let y = 0; y < WATER_Y; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (stamp[i] !== frameNo && buf[i] !== NONE && dith(x, y, lv)) { stamp[i] = frameNo; buf[i] = RAINY[buf[i]]; }
    }
  }
  function sheet(x, y, t) { return (((x - (y >> 1) - t * 3) % 56) + 56) % 56 < 22; }       // 一道道斜着往右扫的雨帘
  function rain(t, lv) { // 雨丝和溅起的小水花
    if (!lv) return;
    for (let k = 0; k < lv * 12; k++) {
      const x = (hash(k, t, 61) % (W + 24)) - 12, y = (hash(k, t, 62) % (H + 8)) - 8;
      if (k % 3 && !sheet(x, y, t)) continue;
      for (let i = 0; i < 4; i++) { const v = get(x + (i >> 1), y + i); if (v !== NONE) px(x + (i >> 1), y + i, LUM[v] > 170 ? P.v : P.u); }
    }
    for (let k = 0; k < lv; k++) {
      const x = hash(k, t, 63) % W, kind = hash(k, t, 64) % 3;
      if (kind === 0) { if (get(x, WATER_Y) === P.c || get(x, WATER_Y) === P.d) { px(x, WATER_Y - 1, P.t); px(x - 1, WATER_Y - 1, P.u); px(x + 1, WATER_Y - 1, P.u); } }
      else if (kind === 1) { const y = BANK_Y + 6 + (hash(k, t, 65) % 30), v = get(x, y); if (v === P.d || v === P.F || v === P.e) { px(x - 1, y, P.c); px(x + 1, y, P.c); } }
      else if (x < WALK_W && get(x, WALK_Y) === P.d) px(x, WALK_Y - 1, P.u);
    }
  }

  function build() {
    BRIDGE = layer(drawBridge);
    FAR = layer(() => { drawSky(); drawFarHills(); drawTerraces(); drawTreeLine(); over(BRIDGE); drawFarRiver(); });
    MID = layer(drawBank);
    NEAR = layer(() => { drawNearWater(); drawHouse(); drawWalk(); });
    TOP = layer(() => { blit(FIGURE, 92, WALK_Y - 16); crate(112, WALK_Y - 16); });
    BOAT = boatSprite();
    FARBOATS = [farBoatSprite(0), farBoatSprite(1)];
    CROC = [sprite(CROC_ROWS), sprite(CROC_ROWS.map((r, j) => (j === 2 ? r.replace("okzo", "oooo") : r)))];
    BIRD = BIRD_ROWS.map(sprite);
    HYACINTH = sprite(["...D.....", "..mCm.m..", ".mmnmmnm.", "mnnonnonm", ".o.o.o.o."]);
  }

  function draw(ctx, tick) {
    tick = Math.max(0, tick | 0); frameNo++;
    if (!FAR) build();
    const t = tick >> 1, lv = rainLevel(t);        // 环境 4 fps
    buf.set(FAR);
    lanterns(t); reflection(t); farFlow(t); farBoats(t); rainVeil(lv);
    over(MID); bananas(t);
    over(NEAR);
    nearFlow(t); hyacinth(t); boat(t, tick); croc(tick);
    over(TOP);
    rain(t, lv);
    present(ctx);
  }

  root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  root.PB_CONCEPT_SCENES.floating_market = { draw };
})(typeof window !== "undefined" ? window : globalThis);
