/* 草原象谷 · savanna —— ART-04i 概念场景：只看大致效果，不是游戏资产，没有规则。
 * WB-05 的「地图概念」页每 125 ms 调用一次 draw(ctx, tick)，tick 每秒 +8，ctx 是 320×180 画布。
 * 只用 ENDESGA 32、整数像素、不抗锯齿；环境循环 4 fps（tick >> 1），动物 8 fps（tick）。
 * 画了：落日、乞力马扎罗式雪山、猴面包树（织布鸟吊窝）、白蚁丘；大象背（移动平台）、干草着火（burn）；
 * 环境：草浪、远处野火推进冒烟、热浪抖动、鸟群飞过；鬣狗（怪物）、织布鸟（提示动物）；人影和箱子当比例尺。 */
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
  DIM[P.B] = P.x; // 烟压在紫色远山上时偏灰，不要压成黑
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
  /* ---------- 草原象谷：布局 ---------- */
  const HZ = 100;                                    // 远处地平线
  const LEDGE_X = 96, LEDGE_Y = 112, FLOOR_Y = 144;  // 左边高台、地面（格子对齐）
  const SUN_X = 58, SUN_Y = 92, TREE_X = 278;
  let FAR = null, MID = null, GROUND = null, TOP = null, HYENA = null, ELEPHANT = null, BIRD = null;
  const NEST = sprite([
    "...f...",
    "...f...",
    "..FFe..",
    ".FdFee.",
    "FdFFeef",
    "FFdFeef",
    "FFFeeef",
    ".FFeef.",
    "..Fef..",
    "..ff...",
    "..f....",
  ]);
  const HYENA_BODY = [
    "..........gg........",
    ".......ggggFg.......",
    "....ggFFFFFFFg......",
    "..eFFFfFFFFFFFg.ff..",
    "feFFFFFFFFfFFFFFFFF.",
    "feFfFFFFFFFFFFFzFFF.",
    "..eeFFFFFfFFFFFFFFgg",
    "...eeeeeeeeeeeeeFgg.",
  ];
  const BIRD_ROWS = ["..kkk..", ".zzkkb.", "zzikkbb", "..kkkbf", "...kbf.", "...f.f."];

  function drawSky() {
    const bands = [[P.B, 0], [P.C, 32], [P.D, 64]];
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      let c = bands[0][0];
      for (let b = 1; b < bands.length; b++) {
        const s = bands[b][1];
        if (y >= s || (y >= s - 8 && dith(x, y, (y - s + 8) * 2))) c = bands[b][0];
      }
      px(x, y, c);
    }
    // 薄云，亮面朝下
    for (const [x, y, w, c] of [[14, 18, 64, P.C], [34, 21, 34, P.C], [232, 12, 70, P.C], [150, 44, 84, P.D], [176, 47, 44, P.D], [96, 74, 58, P.j], [110, 77, 30, P.j]]) {
      rect(x, y, w, 1, c); rect(x + 6, y + 1, w - 14, 1, c);
    }
    // 落日：橙红，下半截几道天色缝
    disc(SUN_X, SUN_Y, 14, P.j);
    for (const [y, hgt] of [[87, 1], [91, 1], [94, 2]])
      for (let x = SUN_X - 15; x <= SUN_X + 15; x++) for (let j = 0; j < hgt; j++) if (get(x, y + j) === P.j) px(x, y + j, P.D);
  }
  function drawMountains() {
    for (let x = 0; x < W; x++) { // 最远一道低山，压住落日下沿
      const top = 93 + tri(x, 84, 3) + tri(x + 30, 26, 1);
      for (let y = top; y < HZ; y++) px(x, y, P.C);
    }
    // 乞力马扎罗式雪山：宽缓山坡、平顶、积雪
    const x0 = 104, x1 = 262, a = 160, b = 206, top = 58;
    for (let x = x0; x <= x1; x++) {
      let y;
      if (x < a) y = HZ - Math.round((HZ - top) * Math.pow((x - x0) / (a - x0), 1.6));
      else if (x > b) y = HZ - Math.round((HZ - top) * Math.pow((x1 - x) / (x1 - b), 1.6));
      else y = top + (hash(x >> 2, 0, 3) % 2);
      for (let j = y; j < HZ; j++) px(x, j, P.B);
      if (x < a - 2) px(x, y, P.C);
      if (x > a - 16 && x < b + 18) {
        const edge = Math.min(x - (a - 16), b + 18 - x);
        let depth = Math.max(1, Math.min(7, edge >> 1) + tri(x, 22, 2) + 1);
        if (edge > 6 && hash(x, 2, 5) % 6 === 0) depth += 3 + (hash(x, 3, 6) % 4);   // 一道道细雪沟
        const lit = x < 186;
        for (let j = 0; j < depth; j++) px(x, y + j, lit ? P.D : P.C);
        px(x, y, lit ? P.E : P.D);
      }
    }
  }
  function drawPlain() {
    for (let y = HZ; y < 112; y++) for (let x = 0; x < W; x++) {
      let c = y === HZ ? P.b : P.e;
      if (y > HZ && hash(x >> 1, y, 7) % 9 === 0) c = P.f;
      px(x, y, c);
    }
    for (const [x, y, w] of [[134, 104, 13], [181, 102, 9], [214, 106, 15], [300, 105, 12]]) { // 远处的伞形金合欢
      rect(x, y - 4, 1, 4, P.f);
      rect(x - (w >> 1), y - 6, w, 2, P.f); rect(x - (w >> 1) + 2, y - 7, w - 4, 1, P.f);
    }
  }
  function drawMidGrass() {
    for (let y = 110; y < FLOOR_Y; y++) for (let x = 0; x < W; x++) px(x, y, y < 112 ? P.b : P.e);
    for (let y = 112; y < FLOOR_Y; y += 2) { // 一簇簇草：远小近大
      const step = y < 124 ? 3 : 4, hgt = y < 124 ? 2 : y < 134 ? 3 : 4;
      for (let x = (y * 7) % step; x < W; x += step) {
        const hs = hash(x, y, 13); if (hs % 5 === 0) continue;
        const xx = x + ((hs >> 3) % 2);
        for (let k = 0; k < hgt; k++) px(xx + (k === hgt - 1 && hs & 16 ? 1 : 0), y - k, k === hgt - 1 && (hs & 96) === 0 ? P.d : P.b);
      }
    }
    for (let y = 136; y < FLOOR_Y; y++) for (let x = 0; x < W; x++) if (dith(x, y, (y - 135) * 2) && get(x, y) === P.b) px(x, y, P.e);
  }
  function drawBaobab() {
    for (let y = 76; y < FLOOR_Y; y++) { // 酒瓶形树干，左边一道受光
      const hw = 9 + Math.round(9 * Math.sqrt((y - 76) / 68));
      for (let x = TREE_X - hw; x <= TREE_X + hw; x++) px(x, y, P.g);
      px(TREE_X - hw, y, P.f); if ((y >> 1) % 3) px(TREE_X - hw + 1, y, P.f);
    }
    for (const [x, y0, len] of [[272, 92, 30], [279, 86, 40], [286, 100, 26]]) for (let y = y0; y < y0 + len; y++) if ((y + x) % 4) px(x + ((y >> 3) & 1), y, P.f);
    const br = [[270, 80, 240, 62, 5, 3], [274, 78, 262, 44, 5, 3], [282, 78, 298, 46, 5, 3], [286, 80, 318, 62, 4, 2],
      [240, 62, 212, 64, 3, 2], [262, 44, 254, 32, 3, 1], [262, 46, 274, 34, 2, 1], [298, 46, 306, 34, 3, 1], [298, 48, 316, 44, 2, 1],
      [318, 62, 324, 56, 2, 1], [240, 62, 232, 52, 2, 1], [212, 64, 206, 60, 1, 1]];
    for (const [ax, ay, bx, by, w0, w1] of br) line(ax, ay, bx, by, P.g, w0, w1);
    for (const [x, y] of [[254, 32], [274, 34], [306, 34], [232, 52], [316, 44], [206, 60]]) { line(x, y, x - 3, y - 4, P.g, 1); line(x, y, x + 2, y - 4, P.g, 1); px(x - 3, y - 5, P.f); px(x + 2, y - 5, P.f); }
    blit(NEST, 225, 64); blit(NEST, 235, 63);
  }
  function soil(x0, y0, w, h, face) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const d = y - y0, hs = hash(x >> 1, y >> 1, 31);
      let c = P.e;
      if ((d + tri(x, 46, 2) + 12) % 12 === 0) c = P.f;                         // 地层
      else if (d > 10 && dith(x, y, Math.min(8, (d - 10) >> 1))) c = P.f;        // 越深越暗（最多一半）
      if (hs % 37 === 0 && d > 2) c = d < 24 ? P.F : P.f;                         // 碎石
      if (d === 0) c = P.b;                                         // 顶面受光
      if (face && x === x0 + w - 1 && d > 0) c = P.f;              // 高台右侧面
      px(x, y, c);
    }
  }
  function mound(cx, base, top, w) { // 白蚁丘：土塔，左亮右暗，一串气孔
    for (let y = top; y < base; y++) {
      const u = (y - top) / (base - top);
      const hw = Math.round(1 + w * Math.pow(u, 0.9)) + tri(y, 14, 1) + (hash(y >> 2, cx, 41) % 2);
      for (let x = cx - hw; x <= cx + hw; x++) {
        let c = P.e;
        if (x <= cx - hw + 1) c = P.F; else if (x >= cx + hw - 1) c = P.f;
        if (hash(x, y >> 1, 43) % 11 === 0) c = P.f;
        px(x, y, c);
      }
    }
    px(cx, top, P.F);
  }

  /* ---------- 草原象谷：会动的 ---------- */
  function hyenaFrame(f) { // 鬣狗：高肩低臀，低头巡逻；4 帧走路
    const s = blank(20, 11), p = pen(s), body = sprite(HYENA_BODY);
    const LX = [[3, 7, 12, 15], [2, 8, 11, 16], [3, 7, 12, 15], [4, 6, 13, 14]][f]; // 后远、后近、前远、前近
    LX.forEach((x, k) => { p.box(x, 8, 1, 2, k % 2 ? P.F : P.e); p.box(x + 1, 8, 1, 2, P.e); p.box(x, 10, 2, 1, P.g); });
    for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) { const v = body.d[y * body.w + x]; if (v !== NONE) p.sp(x, y, v); }
    return outlined(s, P.z);
  }
  function elephantFrame(f) { // 大象：背是平的（移动平台），背上草编垫；4 帧走路，朝左
    const s = blank(50, 31), p = pen(s);
    const step = [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][f];
    const lift = [[0, 0, 0, 0], [1, 0, 0, 1], [0, 0, 0, 0], [0, 1, 1, 0]][f];
    [[15, P.x], [10, P.w], [37, P.x], [32, P.w]].forEach(([lx, c], k) => { // 前远、前近、后远、后近
      const x = lx + step[k], bottom = 30 - lift[k];
      p.box(x, 18, 6, bottom - 17, c); p.box(x, bottom, 6, 1, P.x);
      if (c === P.w) { p.sp(x + 1, bottom - 1, P.c); p.sp(x + 3, bottom - 1, P.c); p.box(x, 21, 1, 4, P.v); p.box(x + 1, 25, 3, 1, P.x); }
    });
    p.ell(28, 11, 17, 9, P.w); p.box(14, 2, 28, 7, P.w); p.box(14, 2, 28, 2, P.v);
    for (let y = 16; y < 21; y++) for (let x = 12; x < 46; x++) if (p.at(x, y) === P.w && (y > 18 || dith(x, y, (y - 15) * 4))) p.sp(x, y, P.x);
    const sway = [0, 1, 0, -1][f];
    for (let y = 6; y < 16; y++) p.sp(45 + (y > 10 ? 1 : 0) + (y > 12 ? sway : 0), y, P.x);
    p.sp(46 + sway, 16, P.z); p.sp(46 + sway, 17, P.z);
    p.box(20, 0, 22, 4, P.b); p.box(20, 0, 22, 1, P.d); p.box(20, 2, 22, 1, P.e);   // 草编垫
    p.box(39, 4, 2, 5, P.b); p.sp(39, 9, P.d); p.sp(40, 9, P.d);
    const er = f === 1 || f === 3 ? 6 : 7;                                              // 耳朵扇动
    p.ell(21, 10, er + 1, 9, P.x); p.ell(21, 10, er, 8, P.v);
    for (let y = 5; y < 16; y += 3) p.box(19, y, 4, 1, P.w);
    p.ell(11, 11, 8, 8, P.w); p.box(4, 6, 2, 8, P.v); p.box(6, 4, 4, 2, P.v);           // 头，左边受光
    for (let y = 14; y <= 28; y++) {                                                    // 鼻子随步子轻摆
      const x = 3 + Math.round(((y - 14) * sway) / 14), w = y < 22 ? 3 : 2;
      p.box(x, y, w, 1, P.w); if (y % 3 === 0) p.sp(x + w - 1, y, P.x);
    }
    p.sp(2 + sway, 27, P.w); p.sp(2 + sway, 28, P.w);
    p.sp(7, 18, P.c); p.sp(6, 19, P.c); p.sp(5, 20, P.c); p.sp(4, 20, P.u);             // 象牙
    p.sp(9, 9, P.z); p.sp(10, 8, P.x);                                                   // 眼睛
    return outlined(s, P.z);
  }
  function build() {
    FAR = layer(() => { drawSky(); drawMountains(); drawPlain(); });
    MID = layer(() => { drawMidGrass(); drawBaobab(); });
    GROUND = layer(() => {
      soil(0, LEDGE_Y, LEDGE_X, H - LEDGE_Y, true); soil(LEDGE_X, FLOOR_Y, W - LEDGE_X, H - FLOOR_Y, false);
      mound(31, LEDGE_Y, 90, 7); mound(19, LEDGE_Y, 72, 12);
    });
    TOP = layer(() => { crate(78, LEDGE_Y - 16); crate(156, FLOOR_Y - 16); blit(FIGURE, 140, FLOOR_Y - 16); });
    HYENA = [0, 1, 2, 3].map(hyenaFrame);
    ELEPHANT = [0, 1, 2, 3].map(elephantFrame);
    BIRD = { idle: sprite(BIRD_ROWS), tuck: sprite(BIRD_ROWS.slice(0, 5)) };
  }

  function crest(x, y, t) { return ((x + ((FLOOR_Y - y) >> 1) + t * 2) % 72) < 10; } // 草浪的浪头，自右向左
  function shimmer(y, t) { const p = (y * 5 + t * 2) % 16; return y & 1 ? (p < 4 ? 1 : p >= 8 && p < 12 ? -1 : 0) : 0; }
  function frontX(t) { return 380 - ((176 + (t >> 1)) % 460); }                    // 远处火线，每秒左移 2px
  function farFire(t) {
    const F0 = frontX(t);
    for (let y = HZ; y < 110; y++) for (let x = Math.max(0, F0); x < Math.min(W, F0 + 72); x++) { // 火线后面烧焦的一段
      if (!dith(x, y, 16 - (((x - F0) * 16) / 72 | 0))) continue;
      const i = y * W + x, c = buf[i];
      buf[i] = c === P.f || c === P.g ? P.g : P.f;
    }
    for (let y = HZ; y < 110; y++) { const x = F0 + ((y * 3) % 5) - 2; px(x - 1, y, P.a); px(x, y, hash(y, t, 51) & 1 ? P.k : P.j); px(x + 1, y, P.j); px(x + 2, y, P.a); }
    for (let k = -4; k <= 4; k++) {
      const x = F0 + k * 2 + (hash(k, t, 52) % 2), h = 1 + (hash(k, t, 53) % 5) - (Math.abs(k) >> 1);
      for (let j = 1; j <= h; j++) px(x, HZ - j, j === h ? P.k : P.j);
    }
    for (let p = 0; p < 2; p++) for (let age = 0; age < 64; age += 2) { // 两股烟，随风往左斜，越高越淡
      const born = t - age - p * 5;
      const x = frontX(born) + p * 10 + (hash(born, p, 81) % 5) - 2 - ((age * 3) >> 2), y = HZ - 3 - age;
      puff(x, y, 2 + Math.min(6, (age / 8) | 0) - p, 11 - ((age / 6) | 0));
    }
  }
  function birds(t) { // 夕阳下一小群鸟，自右向左
    const lx = W + 20 - ((t + 150) % (W + 80)), ly = 38 + tri(t, 96, 2);
    [[0, 0], [5, -3], [10, -5], [5, 3], [11, 5], [16, 2]].forEach(([dx, dy], i) => {
      const x = lx + dx, y = ly + dy + tri(t + i * 5, 24, 1);
      if (((t + i) >> 1) & 1) { px(x, y, P.g); px(x + 1, y + 1, P.g); px(x + 2, y, P.g); }
      else { px(x, y + 1, P.g); px(x + 1, y, P.g); px(x + 2, y + 1, P.g); }
    });
  }
  function grassWave(t) {
    for (let y = 110; y < FLOOR_Y; y++) for (let x = 0; x < W; x++) {
      if (!crest(x, y, t)) continue;
      const i = y * W + x, c = buf[i];
      if (c === P.b) buf[i] = P.d; else if (c === P.e) buf[i] = P.b;
    }
  }
  function blades(t) { // 地面和高台顶上的草，浪头经过时往左倒、发亮
    for (const [x0, x1, top] of [[0, LEDGE_X, LEDGE_Y], [LEDGE_X, W, FLOOR_Y]]) for (let x = x0; x < x1; x++) {
      const hs = hash(x, top, 21);
      if (hs % 4 === 0) continue;
      const h = 2 + ((hs >> 4) % 4), cr = crest(x, top - 2, t), lean = cr ? -1 : (hs >> 8) % 5 === 0 ? 1 : 0;
      for (let k = 0; k < h; k++) px(x + (k > 0 && k >= h - 2 ? lean : 0), top - 1 - k, k === h - 1 ? (cr ? P.c : P.d) : cr ? P.d : P.b);
    }
  }
  function dryTuft(x0, t) { // burn 机关：一丛干草（下一格要着的）
    for (let i = 0; i < 16; i++) {
      const hs = hash(x0 + i, 5, 61);
      if (hs % 5 === 0) continue;
      const h = 9 + ((hs >> 3) % 5) - (Math.abs(2 * i - 15) >> 2), lean = crest(x0 + i, FLOOR_Y - 4, t) ? -1 : 0;
      for (let k = 0; k < h; k++) px(x0 + i + (k > h - 4 ? lean : 0), FLOOR_Y - 1 - k, k >= h - 2 ? (k === h - 1 ? P.c : P.d) : k < 2 ? P.e : (i + k) % 3 ? P.d : P.b);
    }
  }
  function fire(x0, t) { // burn 机关：着火的一格
    for (let i = 0; i < 16; i++) { const hs = hash(x0 + i, 6, 62); px(x0 + i, FLOOR_Y - 1, P.g); if (hs % 3) px(x0 + i, FLOOR_Y - 2, hs & 4 ? P.f : P.g); }
    for (let i = 1; i < 15; i++) {
      const hs = hash(i, t, 71), fh = 4 + ((15 - Math.abs(2 * i - 15)) >> 1) + (hs % 4), gap = (hs >> 4) % 4 === 0 ? 2 : 0;
      for (let k = 0; k < fh - gap; k++) {
        const u = k / fh, c = u < 0.4 ? P.k : u < 0.75 ? P.j : P.i;
        px(x0 + i + (k > fh * 0.6 ? ((hs >> 6) % 3) - 1 : 0), FLOOR_Y - 2 - k, c);
      }
    }
    for (let i = 6; i < 10; i++) { px(x0 + i, FLOOR_Y - 2, P.l); px(x0 + i, FLOOR_Y - 3, P.l); }
    for (let k = 0; k < 3; k++) {
      const a = (t * 2 + k * 7) % 20, n = ((t * 2 + k * 7) / 20) | 0;
      px(x0 + 4 + (hash(k, n, 73) % 9), FLOOR_Y - 14 - a, a < 12 ? P.k : P.j);
    }
    for (let age = 0; age < 32; age += 4) puff(x0 + 8 - ((age * 3) >> 2) + tri(t - age, 12, 1), FLOOR_Y - 18 - ((age * 3) >> 1), 2 + ((age / 12) | 0), 9 - (age >> 2));
  }
  function patrol(t, x0, span, pause) { // 来回走：返回 [x, 朝右?, 在走?]
    const cyc = 2 * (span + pause), p = t % cyc;
    if (p < span) return [x0 + p, true, true];
    if (p < span + pause) return [x0 + span, true, false];
    if (p < 2 * span + pause) return [x0 + span - (p - span - pause), false, true];
    return [x0, false, false];
  }
  function hyena(tick) {
    const [x, right, moving] = patrol(tick >> 1, 40, 14, 10), s = HYENA[moving ? tick & 3 : (tick >> 3) & 1];
    blit(s, x, LEDGE_Y - s.h, !right);
  }
  function elephant(t) {
    const [x, right, moving] = patrol(t, 182, 80, 12), s = ELEPHANT[moving ? t & 3 : 1];
    blit(s, x, FLOOR_Y - s.h, right);
  }
  function weaver(tick) { // 织布鸟：在吊窝边的树枝上来回跳
    const p = tick % 32, A = 212, B = 219, Y = 56;
    let x = A, y = Y, s = BIRD.idle, flip = false;
    if (p === 8 || p === 11 || p === 24 || p === 27) { s = BIRD.tuck; y = Y + 1; x = p === 8 || p === 27 ? A : B; flip = p < 24; }
    else if (p > 8 && p < 11) { s = BIRD.tuck; y = Y - 2; x = A + (p - 8) * 2; flip = true; }
    else if (p > 24 && p < 27) { s = BIRD.tuck; y = Y - 2; x = B - (p - 24) * 2; }
    else if (p > 11 && p < 24) { x = B; flip = true; if (p === 17 || p === 18) { s = BIRD.tuck; y = Y + 1; } }
    blit(s, x, y, flip);
  }

  function draw(ctx, tick) {
    tick = Math.max(0, tick | 0); frameNo++;
    if (!FAR) build();
    const t = tick >> 1;                          // 环境 4 fps
    for (let y = 0; y < H; y++) {                 // 远景 + 地平线附近的热浪
      const row = y * W, s = y >= 84 && y < 110 ? shimmer(y, t) : 0;
      if (!s) { buf.set(FAR.subarray(row, row + W), row); continue; }
      for (let x = 0; x < W; x++) buf[row + x] = FAR[row + Math.min(W - 1, Math.max(0, x + s))];
    }
    farFire(t); birds(t);
    over(MID); grassWave(t); weaver(tick);
    over(GROUND); blades(t); fire(100, t); dryTuft(116, t);
    hyena(tick); elephant(t);
    over(TOP);
    present(ctx);
  }

  root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  root.PB_CONCEPT_SCENES.savanna = { draw };
})(typeof window !== "undefined" ? window : globalThis);
