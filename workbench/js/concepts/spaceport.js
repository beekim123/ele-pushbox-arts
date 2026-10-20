/* 星际港 · spaceport —— ART-04i 概念场景：只看大致效果，不是游戏资产，没有规则。
 * WB-05 的「地图概念」页每 125 ms 调用一次 draw(ctx, tick)，tick 每秒 +8，ctx 是 320×180 画布。
 * 只用 ENDESGA 32、整数像素、不抗锯齿；环境循环 4 fps（tick >> 1），动物 8 fps（tick）。
 * 画了：双月、气闸门和警示条（顶上旋转警示灯）、停机坪上的小飞船；低重力场（low_gravity）、酸液池（acid）；
 * 环境：外星植物一明一暗地呼吸发光、酸液冒泡、警示灯旋转、远处飞船起降的光点；外星史莱姆（怪物）、小机器狗（提示动物）。 */
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
  function ironBox(x, y) { // 铁箱：描边 z，铆钉，左上受光
    rect(x, y, 16, 16, P.z);
    rect(x + 1, y + 1, 14, 14, P.v);
    rect(x + 3, y + 3, 10, 10, P.w);
    rect(x + 1, y + 1, 14, 1, P.u); rect(x + 1, y + 1, 1, 14, P.u);
    rect(x + 1, y + 14, 14, 1, P.x); rect(x + 14, y + 1, 1, 14, P.x);
    rect(x + 3, y + 3, 10, 1, P.x); rect(x + 3, y + 3, 1, 10, P.x);
    for (const [i, j] of [[2, 2], [12, 2], [2, 12], [12, 12]]) { px(x + i, y + j, P.u); px(x + i + 1, y + j + 1, P.x); }
  }

  /* ---------- 星际港：布局 ---------- */
  const FLOOR_Y = 144, PAD_X = 208, PAD_Y = 112, PIT_X = 176, PIT_W = 32, ACID_Y = 148;
  const WALL_X = 96, WALL_TOP = 40, DOOR_X = 16, DOOR_Y = 96, DOOR_W = 32, GRAV_X = 98, GRAV_W = 30;
  const SHIP_X = 236, SHIP_Y = PAD_Y - 31;
  let FAR = null, GROUND = null, TOP = null, SLIME = null, DOG = null;
  const LIGHT = new Uint8Array(32); // 沿调色板提亮一级（与 raster.js 的 LIGHT 相同）
  for (let i = 0; i < 32; i++) LIGHT[i] = i;
  "zy yx xw wv vu ut gf fe eF Fd dc ct ab bd hi iD DE Ec jk kl lt po on nm ml qr rs st BC CD AD".split(" ").forEach((m) => { LIGHT[P[m[0]]] = P[m[1]]; });
  const lit = new Uint32Array(W * H);
  function glow(cx, cy, r, level) { // 光只落在背景上：提亮一级，边缘用 Bayer 抖动过渡
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const x = cx + i, y = cy + j, d2 = i * i + j * j;
      if (x < 0 || y < 0 || x >= W || y >= H || d2 > r * r) continue;
      if (!dith(x, y, Math.round(level * (1 - Math.sqrt(d2) / (r + 1))))) continue;
      const k = y * W + x;
      if (lit[k] === frameNo) continue;
      lit[k] = frameNo; buf[k] = LIGHT[buf[k]];
    }
  }
  const BULBS = [[211, 18, -2], [216, 12, 1], [220, 23, 3], [225, 9, 0]];   // 停机坪角上的青绿发光球茎：x、高、弯
  const PODS = [[66, 22], [70, 34], [77, 16], [81, 28], [86, 40], [89, 20]];  // 舱壁顶上垂下的品红藤：x、长
  const FARGLOW = [];                                                          // 远处外星植物的光点
  const STARS = [];

  function drawSky() {
    const bands = [[P.z, 0], [P.y, 62], [P.B, 106]];
    for (let y = 0; y < FLOOR_Y; y++) for (let x = 0; x < W; x++) {
      let c = bands[0][0];
      for (let b = 1; b < bands.length; b++) {
        const s = bands[b][1];
        if (y >= s || (y >= s - 8 && dith(x, y, (y - s + 8) * 2))) c = bands[b][0];
      }
      px(x, y, c);
    }
    for (let y = 0; y < 70; y++) for (let x = 0; x < W; x++) { // 一道很淡的星云
      const d = Math.abs(y - (44 - ((x * 5) >> 4)) + tri(x, 60, 3));
      if (d < 9 && dith(x, y, 4 - (d >> 1)) && get(x, y) === P.z) px(x, y, P.y);
    }
    for (let i = 0; i < 90; i++) {
      const x = hash(i, 1, 91) % W, y = hash(i, 2, 91) % 100, c = i % 7 === 0 ? P.v : i % 3 === 0 || y > 56 ? P.w : P.x;
      px(x, y, c);
      if (i % 9 === 0) STARS.push([x, y]);
    }
    moon(230, 34, 16, P.u, P.w, P.v); moon(281, 15, 6, P.D, P.C, P.C);
  }
  function moon(cx, cy, r, litC, shade, mare) { // 左上受光，右边一弯暗面
    const sh = r >> 1;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (i * i + j * j > r * r + r) continue;
      px(cx + i, cy + j, (i + sh) * (i + sh) + j * j <= r * r + r ? litC : shade);
    }
    for (const [i, j, k] of [[-6, -4, 3], [2, 3, 2], [-3, 6, 2], [-9, 3, 1], [4, -7, 1]]) {
      const rr = Math.max(1, Math.round((k * r) / 16));
      if (r > 8 || k > 2) disc(cx + Math.round((i * r) / 16), cy + Math.round((j * r) / 16), rr - 1, mare);
    }
  }
  function drawDistant() {
    const spires = [[118, 34, 7], [131, 20, 5], [176, 46, 8], [189, 26, 5], [262, 30, 6], [300, 40, 7], [313, 22, 4]];
    for (let x = WALL_X; x < W; x++) { // 远处的尖岩剪影
      let top = 110 + tri(x, 64, 4);
      for (const [sx, hgt, w] of spires) { const d = Math.abs(x - sx); if (d < w) top = Math.min(top, 110 - Math.round(hgt * (1 - d / w))); }
      for (let y = top; y < FLOOR_Y; y++) px(x, y, P.g);
      if (hash(x, 3, 92) % 13 === 0) { const y = top + 4 + (hash(x, 4, 92) % 20); if (y < 124) px(x, y, x & 1 ? P.D : P.s); } // 远处的灯窗
    }
    for (let x = WALL_X; x < W; x++) { // 近一点的台地，长着外星植物
      const top = 126 + tri(x + 20, 90, 3) + (hash(x >> 2, 5, 92) % 2);
      for (let y = top; y < FLOOR_Y; y++) px(x, y, P.z);
    }
    for (const [x, hgt] of [[108, 14], [139, 9], [158, 17], [196, 11], [244, 13], [271, 8]]) { // 远处的发光植物剪影
      const base = 127 + tri(x + 20, 90, 3);
      for (let k = 0; k < hgt; k++) px(x + (k > hgt - 4 ? (x & 1 ? 1 : -1) : 0), base - k, P.z);
      const tx = x + (x & 1 ? 1 : -1), ty = base - hgt;
      disc(tx, ty - 1, 2, P.z); px(tx - 3, ty + 1, P.z); px(tx + 3, ty + 1, P.z);
      FARGLOW.push([tx - 1, ty - 1], [tx + 1, ty - 2], [tx - 3, ty + 1], [tx + 3, ty + 1]);
    }
    rect(150, 66, 2, 46, P.x); for (let y = 68; y < 112; y += 5) { px(149, y, P.x); px(152, y, P.x); } // 发射塔
    rect(150, 58, 1, 8, P.x);
  }
  function drawBulkhead() { // 冷金属舱壁（背景）
    rect(0, WALL_TOP, WALL_X, FLOOR_Y - WALL_TOP, P.x);
    for (let py = WALL_TOP + 6; py < FLOOR_Y; py += 26) for (let qx = 0; qx < WALL_X; qx += 32) {
      rect(qx, py, 32, 1, P.w); rect(qx, py, 1, 26, P.w);
      rect(qx, py + 25, 32, 1, P.y); rect(qx + 31, py, 1, 26, P.y);
      for (const [i, j] of [[3, 3], [28, 3], [3, 22], [28, 22]]) px(qx + i, py + j, P.w);
      if (hash(qx, py, 95) % 3 === 0) for (let k = 0; k < 4; k++) rect(qx + 9, py + 8 + k * 3, 14, 1, P.y);
    }
    rect(0, 58, WALL_X - 4, 3, P.w); rect(0, 58, WALL_X - 4, 1, P.v); rect(0, 60, WALL_X - 4, 1, P.y); // 管道
    for (let x = 10; x < WALL_X - 4; x += 24) rect(x, 57, 3, 5, P.v);
    rect(0, WALL_TOP - 5, WALL_X + 6, 5, P.w); rect(0, WALL_TOP - 5, WALL_X + 6, 1, P.v); rect(0, WALL_TOP - 1, WALL_X + 6, 1, P.y); // 顶梁
    rect(WALL_X - 4, WALL_TOP, 6, FLOOR_Y - WALL_TOP, P.w); rect(WALL_X - 4, WALL_TOP, 1, FLOOR_Y - WALL_TOP, P.v); rect(WALL_X + 1, WALL_TOP, 1, FLOOR_Y - WALL_TOP, P.y);
    for (const [x, len] of PODS) for (let y = WALL_TOP; y < WALL_TOP + len; y++) px(x + (tri(y, 16, 1) > 0 ? 1 : 0), y, P.B); // 品红藤的藤
  }
  function drawAirlock() { // 气闸门：顶上黄黑警示条，两扇门，圆窗
    const x = DOOR_X, y = DOOR_Y, w = DOOR_W, h = FLOOR_Y - DOOR_Y;
    rect(x - 3, y - 9, w + 6, h + 9, P.y);
    rect(x - 3, y - 9, w + 6, 6, P.z);
    for (let j = y - 8; j < y - 4; j++) for (let i = x - 2; i < x + w + 2; i++) if (((i + j) >> 2) & 1) px(i, j, P.k);
    rect(x - 3, y - 3, 3, h + 3, P.w); rect(x + w, y - 3, 3, h + 3, P.w); rect(x - 3, y - 3, 1, h + 3, P.v); rect(x - 3, y - 3, w + 6, 1, P.v);
    rect(x, y, w, h, P.v); rect(x + (w >> 1), y, w >> 1, h, P.w); rect(x + (w >> 1) - 1, y, 2, h, P.y);
    for (const k of [20, 32]) { rect(x, y + k, w, 2, P.x); rect(x, y + k, w, 1, P.w); }
    disc(x + (w >> 1), y + 10, 5, P.y); disc(x + (w >> 1), y + 10, 4, P.q); px(x + (w >> 1) - 2, y + 8, P.r); px(x + (w >> 1) - 1, y + 7, P.r);
    rect(x + (w >> 1) - 4, y - 11, 8, 2, P.w);                                                 // 警示灯底座
  }
  function deck(x0, y0, w, h) { // 甲板：顶面 1px 受光，钢板，下面是桁架
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const d = y - y0, u = (x - x0) % 24, v = (d - 8) % 24;
      let c;
      if (d === 0) c = P.v;
      else if (d < 7) c = (x - x0) % 32 === 31 ? P.x : d === 3 && (x - x0) % 8 === 4 ? P.v : P.w;
      else if (d === 7) c = P.x;
      else c = u < 2 || u === v || u === 23 - v ? P.x : P.y;
      px(x, y, c);
    }
  }
  function drawShip(x0, y0) { // 停机坪上的小飞船（朝左）
    const s = blank(64, 31), p = pen(s);
    for (const [ax, bx] of [[16, 12], [44, 48]]) for (let y = 21; y < 29; y++) p.box(ax + Math.round(((bx - ax) * (y - 21)) / 8), y, 2, 1, P.x);
    p.box(8, 29, 9, 2, P.w); p.box(44, 29, 9, 2, P.w); p.box(8, 29, 9, 1, P.v); p.box(44, 29, 9, 1, P.v);
    for (let j = 0; j < 7; j++) p.box(56 - j * 2, 1 + j, 3 + j * 2, 1, j === 0 ? P.v : P.w);
    p.ell(30, 15, 28, 8, P.v);
    p.box(54, 9, 8, 12, P.w); p.box(61, 11, 3, 8, P.x);
    for (let y = 7; y < 24; y++) for (let x = 0; x < 62; x++) {
      const c = p.at(x, y); if (c !== P.v) continue;
      p.sp(x, y, y < 11 ? P.u : y > 20 ? P.x : y > 17 ? P.w : P.v);
    }
    p.box(6, 16, 50, 1, P.C); p.box(8, 17, 46, 1, P.B);
    for (let y = 6; y <= 11; y++) for (let x = 7; x <= 21; x++) { const dx = x - 14, dy = 11 - y; if (dx * dx * 25 + dy * dy * 49 <= 1225) p.sp(x, y, dx * dx * 25 + dy * dy * 49 > 900 ? P.w : P.q); }
    p.sp(11, 8, P.s); p.sp(12, 7, P.s); p.sp(13, 7, P.r);
    for (const x of [27, 33, 39]) { p.box(x, 12, 2, 2, P.y); p.sp(x, 12, P.r); }
    blit(s, x0, y0);
  }
  function drawPit() { // 酸液池的坑（酸液本身每帧画）
    rect(PIT_X, FLOOR_Y, PIT_W, 18, P.y);
    rect(PIT_X, FLOOR_Y, 2, 18, P.x); rect(PIT_X + PIT_W - 2, FLOOR_Y, 2, 18, P.x); rect(PIT_X, FLOOR_Y + 16, PIT_W, 2, P.x);
    for (const x0 of [PIT_X - 8, PIT_X + PIT_W]) for (let i = 0; i < 8; i++) px(x0 + i, FLOOR_Y + 1, ((x0 + i) >> 1) & 1 ? P.k : P.z);
  }
  function drawEmitter() { // 低重力发生板
    rect(GRAV_X, FLOOR_Y, GRAV_W, 7, P.x); rect(GRAV_X, FLOOR_Y, GRAV_W, 1, P.v);
    for (let i = 0; i < 7; i++) rect(GRAV_X + 2 + i * 4, FLOOR_Y + 2, 2, 3, P.B);
  }
  function drawStalks() {
    for (const [x, hgt, bend] of BULBS) {
      for (let k = 0; k < hgt; k++) px(x + Math.round((bend * k * k) / (hgt * hgt)), PAD_Y - 1 - k, k < 3 ? P.p : P.o);
      px(x - 1, PAD_Y - 1, P.o); px(x + 1, PAD_Y - 2, P.o);
    }
  }

  /* ---------- 星际港：会动的 ---------- */
  const SL = [10, 11, 13, 15, 16, 15, 13, 11], SH = [9, 8, 7, 6, 5, 6, 7, 8], SB = [0, 0, 0, 0, 0, 1, 3, 5];
  function slimeFrame(f) { // 外星史莱姆：一伸一缩地爬（朝右）；前端先伸出去，后端再跟上
    const L = SL[f], h = SH[f], s = blank(L, h), p = pen(s), cx = (L - 1) / 2, rx = L / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < L; x++) {
      const dx = (x - cx) / rx, dy = (h - 0.5 - y) / h;
      if (dx * dx + dy * dy <= 1) p.sp(x, y, y === h - 1 ? P.B : P.C);
    }
    for (let x = 1; x < cx; x++) for (let y = 0; y < h; y++) if (p.at(x, y) === P.C) { p.sp(x, y, P.D); break; }
    const ex = L - 5, ey = h > 6 ? 2 : 1;
    p.sp(ex, ey, P.t); p.sp(ex + 1, ey, P.z); p.sp(ex + 2, ey, P.t); p.sp(ex + 3, ey, P.z);
    return outlined(s, P.z);
  }
  const DOG_BODY = [
    "..........uuuv.",
    "..........usvvv",
    "....uuuuuuuvvx.",
    "..uuvvvvvvvvvx.",
    "..vvwwwwwwwwwx.",
    "...w.w....w.w..",
    "...x.x....x.x..",
  ];
  function dogFrame(f) { // 小机器狗：摇天线、摇尾巴（朝右）
    const s = blank(15, 9), p = pen(s), body = sprite(DOG_BODY);
    for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) { const v = body.d[y * body.w + x]; if (v !== NONE) p.sp(x, y + 2, v); }
    p.sp(11, 1, P.x); p.sp([11, 12, 11, 10][f], 0, f === 1 || f === 3 ? P.s : P.l);
    if (f % 2) { p.sp(1, 5, P.x); p.sp(0, 5, P.x); } else { p.sp(1, 4, P.x); p.sp(0, 3, P.x); }
    return outlined(s, P.z);
  }
  function build() {
    FAR = layer(() => { drawSky(); drawDistant(); drawBulkhead(); drawAirlock(); });
    GROUND = layer(() => {
      deck(0, FLOOR_Y, W, H - FLOOR_Y); deck(PAD_X, PAD_Y, W - PAD_X, FLOOR_Y - PAD_Y); rect(PAD_X, PAD_Y, 1, FLOOR_Y - PAD_Y, P.v);
      drawPit(); drawEmitter(); drawStalks(); drawShip(SHIP_X, SHIP_Y);
    });
    TOP = layer(() => { ironBox(72, FLOOR_Y - 16); crate(302, PAD_Y - 16); blit(FIGURE, 54, FLOOR_Y - 16); });
    SLIME = SL.map((_, f) => slimeFrame(f));
    DOG = [0, 1, 2, 3].map(dogFrame);
  }

  function level(t, phase) { return Math.max(0, Math.min(3, tri(t + phase, 24, 2) + 2)); } // 呼吸：0 暗 … 3 亮
  function stars(t) { STARS.forEach(([x, y], i) => { if ((t + i * 5) % 23 < 2) px(x, y, P.u); }); }
  function shipLights(t) { // 远处飞船起降的光点
    const up = t % 120;
    if (up < 96) { const y = 106 - up, x = 226 + (up >> 4); px(x, y, t & 2 ? P.s : P.r); if (up > 3) px(x, y + 2, P.q); }
    const dn = (t + 60) % 140;
    if (dn < 92) { const y = 8 + dn, x = 140 - (dn >> 5); px(x, y, t & 2 ? P.D : P.C); if (dn > 3) px(x, y - 2, P.B); }
    if ((t >> 2) & 1) px(150, 57, P.A);
  }
  function farGlow(t) { FARGLOW.forEach(([x, y], i) => { const L = level(t, i * 11); px(x, y, [P.p, P.o, P.n, P.m][L]); }); }
  function beacon(t) { // 气闸门顶上的旋转警示灯：灯罩亮的一面转过去，光斑扫过舱壁
    const a = t % 8, bx = DOOR_X + (DOOR_W >> 1), by = DOOR_Y - 12;
    if (a < 5) glow(bx + (a - 2) * 24, by - 14, 14, 15);
    rect(bx - 3, by - 3, 6, 3, a < 5 ? P.A : P.h);
    if (a < 5) { px(bx - 3 + Math.min(5, a + (a > 2 ? 1 : 0)), by - 3, P.D); px(bx - 3 + Math.min(5, a + (a > 2 ? 1 : 0)), by - 2, P.D); }
  }
  function vines(t) { // 品红藤上的荚果一明一暗
    PODS.forEach(([x, len], i) => {
      const L = level(t, 12 + i * 5), y = WALL_TOP + len, xx = x + (tri(y, 16, 1) > 0 ? 1 : 0);
      if (L >= 2) glow(xx, y + 1, 2 + L * 2, L * 4);
      rect(xx - 1, y, 3, 3, [P.g, P.B, P.C, P.C][L]); px(xx, y + 1, [P.B, P.C, P.D, P.E][L]);
    });
  }
  function bulbGlow(t) { BULBS.forEach(([x, hgt, bend], i) => { const L = level(t, i * 7); if (L >= 2) glow(x + bend, PAD_Y - 2 - hgt, 3 + L * 2, L * 4); }); }
  function bulbs(t) { // 青绿发光球茎
    BULBS.forEach(([x, hgt, bend], i) => {
      const L = level(t, i * 7), cx = x + bend, cy = PAD_Y - 2 - hgt;
      disc(cx, cy, i % 2 ? 1 : 2, [P.p, P.q, P.r, P.s][L]);
      px(cx, cy, [P.q, P.r, P.s, P.t][L]); if (i % 2 === 0) { px(cx - 1, cy, [P.q, P.r, P.s, P.s][L]); px(cx, cy - 1, [P.q, P.r, P.s, P.s][L]); }
    });
  }
  function acid(t) { // 酸液：黄绿，表面一道亮线，气泡冒上来破掉
    for (let y = ACID_Y; y < FLOOR_Y + 16; y++) for (let x = PIT_X + 2; x < PIT_X + PIT_W - 2; x++) {
      let c = P.m;
      if (y === ACID_Y) c = (x + t) % 7 < 5 ? P.l : P.m;
      else if (y > ACID_Y + 6 && dith(x, y, (y - ACID_Y - 6) * 2)) c = P.n;
      px(x, y, c);
    }
    for (let k = 0; k < 4; k++) {
      const period = 11 + k * 3, n = ((t + k * 5) / period) | 0, p = (t + k * 5) % period, bx = PIT_X + 5 + k * 6 + (n % 3);
      if (p < 9) { const y = FLOOR_Y + 14 - p; px(bx, y, P.t); px(bx + 1, y, P.l); px(bx, y + 1, P.l); }
      else if (p === 9) { px(bx, ACID_Y - 1, P.t); px(bx - 1, ACID_Y - 2, P.l); px(bx + 2, ACID_Y - 2, P.l); }
      else if (p === 10) px(bx, ACID_Y - 2, P.m);
    }
  }
  function lowGravity(t) { // 低重力场：两侧虚线往上流，光环和微尘慢慢往上飘
    for (let y = 70; y < FLOOR_Y; y++) if (((y + t) & 3) === 0) { px(GRAV_X, y, P.B); px(GRAV_X + GRAV_W - 1, y, P.B); }
    const cx = GRAV_X + (GRAV_W >> 1);
    for (let k = 0; k < 4; k++) {
      const age = (t + k * 18) % 72, y = FLOOR_Y - 3 - age, rx = 12 - (age >> 4), front = age < 24 ? P.D : age < 48 ? P.C : P.B;
      for (let i = -rx; i <= rx; i++) {
        const dy = Math.round(2 * Math.sqrt(1 - (i * i) / (rx * rx)));
        if (age >= 48 && !dith(cx + i, y, 8)) continue;
        px(cx + i, y + dy, front); px(cx + i, y - dy, DIM[front]);
      }
    }
    for (let k = 0; k < 7; k++) {
      const a = (t + k * 13) % 64, n = ((t + k * 13) / 64) | 0;
      px(GRAV_X + 3 + (hash(k, n, 97) % (GRAV_W - 6)) + tri(t + k * 9, 16, 1), FLOOR_Y - 3 - a, a < 32 ? P.D : P.C);
    }
    for (let i = 0; i < 7; i++) rect(GRAV_X + 2 + i * 4, FLOOR_Y + 2, 2, 3, (t + i) % 6 < 3 ? P.C : P.B);
  }
  function padLights(t) { for (let k = 0; k < 5; k++) rect(PAD_X + 6 + k * 24, PAD_Y + 3, 2, 1, (t >> 1) % 5 === k ? P.s : P.q); }
  function shipNav(t) {
    if (t % 6 < 2) px(SHIP_X + 57, SHIP_Y, P.A);
    for (let y = 12; y < 19; y++) px(SHIP_X + 63, SHIP_Y + y, y === 12 || y === 18 ? P.B : tri(t, 8, 1) >= 0 ? P.D : P.C);
  }
  function slime(tick) {
    const p = tick % 96, fwd = p < 48, k = Math.min(fwd ? p : p - 48, 40), c = k >> 3, f = k >= 40 ? 0 : k & 7;
    const back = c * 6 + SB[f], s = SLIME[f], x0 = 130, left = fwd ? x0 + back : x0 + 40 - back - SL[f];
    blit(s, left - 1, FLOOR_Y - s.h, !fwd);
  }
  function dog(tick) { const s = DOG[(tick >> 1) & 3]; blit(s, 26, FLOOR_Y - s.h, false); }

  function draw(ctx, tick) {
    tick = Math.max(0, tick | 0); frameNo++;
    if (!FAR) build();
    const t = tick >> 1;                          // 环境 4 fps
    buf.set(FAR);
    stars(t); shipLights(t); farGlow(t); beacon(t); vines(t); bulbGlow(t);
    over(GROUND);
    acid(t); lowGravity(t); padLights(t); shipNav(t); bulbs(t);
    slime(tick); dog(tick);
    over(TOP);
    present(ctx);
  }

  root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  root.PB_CONCEPT_SCENES.spaceport = { draw };
})(typeof window !== "undefined" ? window : globalThis);
