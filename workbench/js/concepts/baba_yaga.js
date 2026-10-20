/* ART-04e 会动的概念场景：雅加婆婆的森林（baba_yaga）
 * 照用户选定的 art/concepts/baba_yaga/b.png 画：画法和坐标照搬 tools/concepts/baba_yaga.mjs 的方向 B（夜里火鸟照亮院子）。
 * 动起来的部分：薄雾在白桦林间慢慢飘、火鸟的金红光点从枝头落下、火鸟的光一明一暗、星星闪、小屋门里的火光跳、
 * 套娃箱抖几下炸开掉出小一号的；补上 1 只怪物（林精，树影里一双发光的眼睛）和 1 只提示动物（门口的黑猫，尾巴甩动）。
 * 人影只当比例尺，不动。只看大致效果，不是游戏资产，不进美术确认。320×180，只用 ENDESGA 32（读 raster.js 的 PB.RGB），整数像素，不抗锯齿。
 * 接口：PB_CONCEPT_SCENES.baba_yaga.draw(ctx, tick)；tick 每秒加 8（页面每 125 毫秒调一次）：环境 4 fps（tick >> 1），动物 8 fps（tick）。 */
(function () {
  "use strict";
  // ---------- 草图工具（照搬 tools/concepts/*.mjs，三个场景各带一份，互不依赖） ----------
  const W = 320, H = 180; // 逻辑画面；16×16 一格，横 20 格
  let P = null; // 当前画布：W*H 个色码，"." = 透明
  let MASK = null, BG = false; // MASK：近景物体占的像素（"." = 背景）；BG = true 时只往背景上画
  const begin = (k) => (P = new Array(W * H).fill(k));
  const use = (buf) => (P = buf);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  function px(x, y, k) {
    x = Math.round(x); y = Math.round(y);
    if (!k || k === "." || !inside(x, y)) return;
    const i = y * W + x;
    if (BG && MASK[i] !== ".") return;
    P[i] = k;
  }
  const get = (x, y) => (inside(x, y) ? P[y * W + x] : null);
  function rect(x, y, w, h, k) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, k);
  }
  function line(x0, y0, x1, y1, k) {
    [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.round);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    for (let e = dx + dy; ;) {
      px(x0, y0, k);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function ellipse(cx, cy, rx, ry, k) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x - cx) / (rx + 0.5), v = (y - cy) / (ry + 0.5);
        if (u * u + v * v <= 1) px(x, y, k);
      }
  }
  function poly(pts, k) { // 实心多边形 [[x,y],…]
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const c = y + 0.5, xs = [];
      pts.forEach(([x0, y0], i) => {
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= c) !== (y1 <= c)) xs.push(x0 + ((c - y0) / (y1 - y0)) * (x1 - x0));
      });
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) px(x, y, k);
    }
  }
  function thick(x0, y0, x1, y1, r, k) { // 粗线：沿线画圆
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) ellipse(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, r, k);
  }
  function hash(x, y, s = 0) { // 固定的伪随机，每次画出的像素都一样
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise1(x, s) {
    const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f);
    return hash(i, 0, s) * (1 - t) + hash(i + 1, 0, s) * t;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  function dith(x, y, w, h, k, d) { // 有序抖动：按密度 d 把 k 撒进矩形
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (bayer(i, j) < d) px(i, j, k);
  }
  function sky(stops, soft = 6) { // 天空分色带 [[y, 色码],…]，相邻两带之间 soft px 抖动过渡
    for (let y = 0; y < H; y++) {
      let i = 0;
      while (i + 1 < stops.length && y >= stops[i + 1][0]) i++;
      const nb = stops[i + 1];
      for (let x = 0; x < W; x++) {
        const t = nb ? (y - (nb[0] - soft)) / soft : -1;
        px(x, y, t > bayer(x, y) ? nb[1] : stops[i][1]);
      }
    }
  }
  function hills(base, amp, scale, k, s, oct = 3) { // 起伏的远景剪影，从轮廓线一直填到底
    for (let x = 0; x < W; x++) {
      let n = 0, a = 1, sum = 0;
      for (let o = 0; o < oct; o++) { n += noise1((x / scale) * 2 ** o, s + o * 31) * a; sum += a; a /= 2; }
      const y = Math.round(base - amp * (n / sum));
      rect(x, y, 1, H - y, k);
    }
  }
  function glow(cx, cy, r, k, d = 0.6, only = null) { // 抖动光晕；only 限定只染哪些底色
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const t = 1 - Math.hypot(x - cx, y - cy) / r;
        if (t > 0 && bayer(x, y) < t * d && (!only || only.includes(get(x, y)))) px(x, y, k);
      }
  }
  function tint(x, y, w, h, map) { // 换色：map = { 原色: 新色 }
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = map[get(i, j)]; if (k) px(i, j, k); }
  }
  function spr(x, y, rows, flip = false) { // 小精灵：每行一串色码，"." 透明
    rows.forEach((r, j) => [...r].forEach((k, i) => px(flip ? x + r.length - 1 - i : x + i, y + j, k)));
  }
  // 静态地形：顶面 1px 受光边、底面 1px 阴影、不描边；纹理按 16px 一格重复，保留格子感
  function ground(x, y, w, h, t, s = 1) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const u = (i - x) & 15, v = (j - y) & 15, alt = hash((i - x) >> 4, (j - y) >> 4, s + 9) < 0.5 ? 0 : 50;
        const r = hash(u, v, s + alt);
        let k = t.body;
        if (r < (t.rate ?? 0.08)) k = t.speck;
        else if (r > 0.95 && t.light) k = t.light;
        if (t.seam && (u === 15 || v === 15) && hash(i, j, s + 3) < 0.6) k = t.seam;
        px(i, j, k);
      }
    rect(x, y, w, 1, t.top);
    rect(x, y + h - 1, w, 1, t.dark);
  }
  // 主角大小的人影：16×16，黄帽红衣、z 描边（只当比例尺，不是正式素材）
  const HERO = [
    "................",
    ".....zzzzz......",
    "....zkklkkz.....",
    "....zkkkkkz.....",
    "..zzzkkkkkzzz...",
    ".zkkkkkkkkkkkz..",
    "..zzzzzzzzzzz...",
    "....zEEEEzEz....",
    "....zEEEEEEz....",
    "....zzFFFFzz....",
    "...zhiiiiiiz....",
    "..zhiiiiiiiiz...",
    "..zhiiiiiiiEz...",
    "...zhhiiiihz....",
    "....zgzzzgz.....",
    "....zzz.zzz.....",
  ];
  const hero = (x, y, flip = false) => spr(x, y, HERO, flip);
  // 木箱 16×16：z 描边、对角斜撑、左上受光
  function crate(x, y) {
    rect(x, y, 16, 16, "z");
    rect(x + 1, y + 1, 14, 14, "b");
    rect(x + 1, y + 1, 14, 1, "d"); rect(x + 1, y + 1, 1, 13, "d");
    rect(x + 1, y + 14, 14, 1, "f"); rect(x + 14, y + 2, 1, 12, "e");
    rect(x + 3, y + 3, 10, 10, "e");
    rect(x + 3, y + 3, 10, 1, "f"); rect(x + 3, y + 3, 1, 10, "f");
    for (let i = 0; i < 10; i++) { px(x + 3 + i, y + 12 - i, "d"); px(x + 4 + i, y + 12 - i, "b"); }
  }
  // ---------- 动起来用的小工具 ----------
  function tri(t, period, amp) { // 整数三角波（同 ambient.js）：-amp…amp
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  const wrap = (t, n) => ((t % n) + n) % n;
  function behind(fn) { BG = true; try { fn(); } finally { BG = false; } } // 只画在背景上（不盖住近景物体）
  function both(fn) { const keep = P; fn(); P = MASK; fn(); P = keep; } // 近景物体：同时画进静态层和遮罩层
  // 小动物、怪物：先画进临时层，再加一圈 1px 描边，盖到当前画布上（box = 可能画到的范围）
  function critter(bx, by, bw, bh, fn, ol = "z") {
    const keep = P, keepBG = BG, T = new Array(W * H).fill(".");
    P = T; BG = false; fn(); P = keep; BG = keepBG;
    const x0 = Math.max(0, bx - 1), y0 = Math.max(0, by - 1), x1 = Math.min(W - 1, bx + bw), y1 = Math.min(H - 1, by + bh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = T[y * W + x];
      if (k !== ".") { px(x, y, k); continue; }
      if (ol && ((x > 0 && T[y * W + x - 1] !== ".") || (x < W - 1 && T[y * W + x + 1] !== ".") ||
        (y > 0 && T[(y - 1) * W + x] !== ".") || (y < H - 1 && T[(y + 1) * W + x] !== "."))) px(x, y, ol);
    }
  }
  let IMG = null;
  function present(ctx) { // 色码 → 像素；不在 ENDESGA 32 里的色码直接报错
    const RGB = window.PB && window.PB.RGB;
    if (!RGB) throw new Error("先加载 workbench/js/core/raster.js（调色板）");
    if (!IMG) IMG = ctx.createImageData(W, H);
    const d = IMG.data;
    for (let i = 0; i < W * H; i++) {
      const c = RGB[P[i]];
      if (!c) throw new Error("不在 ENDESGA 32 里的色码：" + P[i]);
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(IMG, 0, 0);
  }
  // ---------- 草图工具结束 ----------

  // ---------- 森林的部件（照搬 tools/concepts/baba_yaga.mjs） ----------
  // 云杉剪影：一层层锯齿；一排树底下连成林
  function spruce(cx, base, h, k, s) {
    const top = base - h, tier = 5 + Math.round(hash(cx, 0, s) * 3);
    for (let y = top; y < base; y++) {
      const d = y - top, hw = Math.round(d * 0.3 * (0.55 + 0.45 * ((d % tier) / tier)));
      rect(cx - hw, y, hw * 2 + 1, 1, k);
    }
  }
  function spruceRow(base, hMin, hMax, gap, k, s) {
    for (let x = -8; x < W + 8; x += gap)
      spruce(x + Math.round(hash(x, 1, s) * gap * 0.6), base + Math.round(hash(x, 2, s) * 6), hMin + Math.round(hash(x, 3, s) * (hMax - hMin)), k, s);
    rect(0, base, W, H - base, k);
  }
  // 白桦：白干、黑色横斑、右侧背光、几根细枝
  function birch(x, w, top, base, c, s) {
    rect(x, top, w, base - top, c.bark);
    rect(x + w - 1, top, 1, base - top, c.shade);
    for (let y = top + 2; y < base; y += 3 + Math.floor(hash(x, y, s) * 5)) {
      const len = 1 + Math.floor(hash(y, x, s) * (w - 1)), off = Math.floor(hash(x + 1, y, s) * (w - len + 1));
      rect(x + off, y, len, 1, c.mark);
    }
    for (let i = 0; i < 3; i++) {
      const by = Math.max(top, 0) + 8 + Math.floor(hash(x, i, s + 5) * (base - Math.max(top, 0)) * 0.45);
      const dir = (i + x) % 2 ? 1 : -1, len = 7 + Math.floor(hash(i, x, s) * 10);
      const sx = dir > 0 ? x + w : x - 1;
      line(sx, by, sx + dir * len, by - Math.round(len * 0.7), c.mark);
      line(sx + dir * Math.round(len * 0.5), by - Math.round(len * 0.35), sx + dir * Math.round(len * 0.5) + dir * 4, by - Math.round(len * 0.35) - 1, c.mark);
    }
  }
  // 鸡腿：粗的羽毛大腿、向后弯的关节、带鳞的小腿、三趾朝前一趾朝后
  const NIGHT_LEG = { thigh: "e", hi: "F", shank: "F", scale: "e" };
  function chickenLeg(hx, hy, kx, ky, fx, fy, lifted = false, c = NIGHT_LEG) {
    for (let t = 0; t <= 1; t += 0.04) ellipse(hx + (kx - hx) * t, hy + (ky - hy) * t, 6 - 3 * t, 6 - 3 * t, c.thigh);
    for (let t = 0; t <= 0.9; t += 0.04) ellipse(hx - 2 + (kx - hx) * t, hy - 1 + (ky - hy) * t, 3.5 - 2 * t, 3.5 - 2 * t, c.hi);
    for (let t = 0.2; t < 1; t += 0.2) { const x = hx + (kx - hx) * t + 4 - 2 * t, y = hy + (ky - hy) * t + 2; px(x, y, "e"); px(x + 1, y - 1, "e"); }
    thick(kx, ky, fx, fy, 2.5, c.shank);
    const n = Math.hypot(fx - kx, fy - ky);
    for (let d = 3; d < n - 2; d += 3) { const t = d / n; px(kx + (fx - kx) * t + 1, ky + (fy - ky) * t, c.scale); px(kx + (fx - kx) * t + 2, ky + (fy - ky) * t, c.scale); }
    ellipse(kx, ky, 3, 3, c.thigh); px(kx - 1, ky - 1, c.hi);
    const toes = lifted ? [[fx + 6, fy + 7], [fx + 3, fy + 8], [fx - 3, fy + 5]] : [[fx + 13, fy + 2], [fx + 9, fy + 2], [fx - 7, fy + 2]];
    for (const [tx, ty] of toes) { thick(fx, fy, tx, ty, 1, c.shank); line(fx, fy + 1, tx, ty + 1, c.scale); px(tx + (tx > fx ? 1 : -1), ty + 1, "z"); px(tx + (tx > fx ? 2 : -2), ty + 1, "z"); }
  }
  // 门里的火光（会跳）：x,y = 屋身左上
  function doorway(x, y, d) {
    rect(x + 24, y + 8, 9, 28, "z");
    glow(x + 28, y + 30, 10, "j", d, ["z"]); rect(x + 24, y + 26, 9, 10, "j"); dith(x + 24, y + 20, 9, 6, "j", d - 0.2);
  }
  // 雕花木屋（转过身、门开着）：x = 屋身左边，y = 屋身顶边（56×36）
  function hut(x, y, base) {
    const legY = y + 38, low = base - 3;
    chickenLeg(x + 16, legY, x + 3, legY + 24, x + 13, low); chickenLeg(x + 42, legY, x + 29, legY + 24, x + 39, low);
    rect(x + 2, y + 36, 52, 3, "g");
    for (let j = 0; j < 6; j++) {
      const ly = y + j * 6;
      rect(x, ly, 56, 6, "e"); rect(x, ly, 56, 1, "b"); rect(x, ly + 5, 56, 1, "f");
      for (let i = x + 4; i < x + 56; i += 11 + (j % 3)) px(i, ly + 3, "f");
      for (const ex of [x - 3, x + 56]) { ellipse(ex + 1.5, ly + 2.5, 2.5, 2.5, "f"); ellipse(ex + 1.5, ly + 2.5, 1.5, 1.5, "d"); px(ex + 1, ly + 2, "b"); }
    }
    rect(x + 50, y, 6, 36, "f"); for (let j = 0; j < 6; j++) rect(x + 50, y + j * 6, 6, 1, "e");
    poly([[x - 8, y + 3], [x + 28, y - 30], [x + 64, y + 3]], "f");
    poly([[x - 4, y + 2], [x + 28, y - 26], [x + 60, y + 2]], "g");
    for (let j = y - 22; j < y + 2; j += 4) for (let i = x - 4; i < x + 60; i++) if (get(i, j) === "g" && hash(i >> 1, j, 8) < 0.5) px(i, j, "f");
    line(x - 8, y + 3, x + 28, y - 30, "u"); line(x - 7, y + 3, x + 28, y - 29, "u"); line(x + 28, y - 30, x + 64, y + 3, "v");
    for (let i = 0; i < 9; i++) { const t = i / 9, bx = x - 6 + 34 * t, by = y + 2 - 31 * t; px(bx + 1, by + 3, "h"); px(bx + 2, by + 4, "c"); px(bx + 3, by + 3, "h"); }
    for (let i = 0; i < 9; i++) { const t = i / 9, bx = x + 62 - 34 * t, by = y + 2 - 31 * t; px(bx - 1, by + 3, "h"); px(bx - 2, by + 4, "c"); px(bx - 3, by + 3, "h"); }
    rect(x + 27, y - 26, 3, 14, "h"); rect(x + 28, y - 24, 1, 10, "c"); px(x + 28, y - 11, "h"); px(x + 27, y - 12, "h"); px(x + 29, y - 12, "h");
    rect(x + 22, y + 6, 13, 30, "h"); doorway(x, y, 0.7);
    rect(x + 33, y + 9, 4, 27, "e"); rect(x + 36, y + 9, 1, 27, "f"); px(x + 34, y + 22, "z");
    for (let i = 0; i < 7; i++) { px(x + 23, y + 8 + i * 4, "c"); px(x + 34, y + 8 + i * 4, "c"); }
    for (const wx of [x + 5, x + 41]) { rect(wx - 2, y + 7, 14, 14, "h"); rect(wx, y + 9, 10, 10, "y"); rect(wx + 1, y + 10, 8, 8, "B"); rect(wx + 4, y + 9, 2, 10, "h"); px(wx + 4, y + 5, "h"); px(wx + 5, y + 4, "h"); px(wx + 6, y + 5, "h"); rect(wx - 2, y + 21, 14, 1, "c"); }
  }
  // 套娃箱：木箱上画着套娃（s = 16 / 12），z 描边、左上受光
  function nestBox(x, y, s) {
    const m = s >= 16, c = x + s / 2 - 0.5;
    rect(x, y, s, s, "z");
    rect(x + 1, y + 1, s - 2, s - 2, "d");
    rect(x + 1, y + 1, s - 2, 1, "c"); rect(x + 1, y + 1, 1, s - 3, "c");
    rect(x + 1, y + s - 2, s - 2, 1, "e"); rect(x + s - 2, y + 2, 1, s - 3, "b");
    ellipse(c, y + s - (m ? 5 : 4), m ? 3.5 : 2.5, m ? 3 : 2, "h");
    ellipse(c, y + (m ? 5 : 4), m ? 2.5 : 1.5, m ? 2.5 : 1.5, "h");
    ellipse(c, y + (m ? 5.5 : 4.5), m ? 1.5 : 0.5, m ? 1 : 0.5, "E");
    px(c, y + s - (m ? 5 : 4), "c");
  }
  function shard(x, y, w, h) { rect(x, y, w, h, "z"); rect(x + 1, y + 1, w - 2, h - 2, "d"); }
  // 火鸟：金红身体、羽冠、拖长的尾羽（尾端有眼斑）；朝左停着。sw = 尾羽摆动的相位
  function firebird(x, y, sw) {
    for (let i = 0; i < 4; i++) {
      const ex = x + 12 + i * 5, ey = y + 12 + i * 3 + tri(sw + i * 2, 8, 1);
      for (let t = 0; t <= 1; t += 0.03) px(x + 3 + (ex - x - 3) * t, y + 1 + (ey - y - 1) * t * t, t < 0.4 ? "k" : t < 0.75 ? "j" : "i");
      ellipse(ex, ey, 1.5, 1.5, "i"); px(ex, ey, "l");
    }
    ellipse(x, y, 5, 3, "j"); ellipse(x - 1, y - 1, 3.5, 2, "k");
    ellipse(x - 5, y - 3, 2, 2, "k"); px(x - 6, y - 3, "z"); px(x - 8, y - 3, "j");
    line(x - 5, y - 5, x - 7, y - 8, "j"); line(x - 4, y - 5, x - 4, y - 9, "k"); px(x - 7, y - 9, "l"); px(x - 4, y - 10, wrap(sw, 4) < 2 ? "l" : "k");
    line(x - 1, y + 3, x - 1, y + 5, "g"); line(x + 2, y + 3, x + 2, y + 5, "g");
  }
  // 黑猫（提示动物）10×8，坐在门口；尾巴另画，会甩
  const CAT = [
    "z...z.....",
    "zz.zz.....",
    "zzzzz.....",
    "zmzmz.....",
    "zzzzzz....",
    ".zzzzzzzz.",
    ".zzzzzzzz.",
    ".z.z..z.z.",
  ];
  const TAILS = [[[8, 4], [9, 3], [9, 2]], [[8, 4], [9, 3], [10, 2]], [[8, 4], [9, 4], [10, 3]], [[8, 4], [9, 3], [9, 2], [8, 1]]];
  const TAIL_SEQ = [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 3, 3, 0, 0, 0, 0];
  function cat(x, y, tick) {
    spr(x, y, CAT);
    for (const [dx, dy] of TAILS[TAIL_SEQ[wrap(tick, 16)]]) px(x + dx, y + dy, "z");
    if (wrap(tick, 28) === 27) { px(x + 1, y + 3, "z"); px(x + 3, y + 3, "z"); } // 眨眼
  }
  // 雕花木井：圆木井圈、两根立柱、带红色花纹的小坡顶、轱辘和水桶（宽 40）
  function well(x, base) {
    rect(x + 4, base - 46, 3, 32, "f"); rect(x + 33, base - 46, 3, 32, "f");
    rect(x + 4, base - 34, 32, 3, "e"); rect(x + 4, base - 34, 32, 1, "b"); rect(x + 36, base - 36, 2, 7, "x"); rect(x + 36, base - 30, 5, 2, "x");
    rect(x + 19, base - 31, 1, 9, "F"); rect(x + 16, base - 23, 8, 7, "f"); rect(x + 17, base - 22, 6, 5, "e"); rect(x + 16, base - 21, 8, 1, "x");
    for (let j = 0; j < 3; j++) {
      const ly = base - 16 + j * 5 + (j === 2 ? 1 : 0);
      rect(x, ly, 40, 5, "e"); rect(x, ly, 40, 1, "b"); rect(x, ly + 4, 40, 1, "f");
      for (const ex of [x - 2, x + 40]) { ellipse(ex + 1, ly + 2, 2, 2, "f"); px(ex + 1, ly + 2, "d"); }
    }
    for (let i = 4; i < 38; i += 8) { px(x + i, base - 9, "h"); px(x + i + 1, base - 10, "h"); px(x + i + 2, base - 9, "h"); px(x + i + 1, base - 8, "c"); }
    poly([[x - 5, base - 44], [x + 20, base - 60], [x + 45, base - 44]], "f");
    poly([[x - 1, base - 45], [x + 20, base - 57], [x + 41, base - 45]], "g");
    line(x - 5, base - 44, x + 20, base - 60, "u"); line(x + 20, base - 60, x + 45, base - 44, "v");
    for (let i = 0; i < 46; i += 3) { px(x - 4 + i, base - 43, "h"); px(x - 3 + i, base - 42, "c"); }
  }
  function light(cx, cy, r, map, d = 0.6) { // 光源：越近越多地把暗色换成暖色
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const t = 1 - Math.hypot(x - cx, y - cy) / r, k = map[get(x, y)];
        if (t > 0 && k && bayer(x, y) < t * d) px(x, y, k);
      }
  }
  // 化雪的地面：雪 + 露出来的泥和草 + 水洼；越往下越暗
  function thaw(y, snow, deep, mud, pools, grass, s) {
    ground(0, y, W, H - y, snow, s);
    for (let j = y + 8; j < H - 1; j++) dith(0, j, W, 1, deep[0], Math.min(1, (j - y - 8) / 4));
    for (let j = y + 13; j < H - 1; j++) for (let i = 0; i < W; i++) if (hash(i & 15, (j - y) & 15, s + ((i >> 4) & 1) * 7) < 0.06) px(i, j, deep[1]);
    for (const [mx, mw] of mud) {
      for (let i = 0; i < mw; i++) {
        const d = Math.round(1 + Math.sin((i / mw) * Math.PI) * 3 + hash(i, 0, s) * 1.5);
        rect(mx + i, y, 1, d, "f"); if (hash(i, 1, s) < 0.25) px(mx + i, y + d - 1, "g");
      }
      rect(mx, y, mw, 1, "e");
      for (let i = 2; i < mw - 2; i += 3 + Math.floor(hash(i, 3, s) * 3)) { const h = 2 + Math.floor(hash(i, 4, s) * 3); rect(mx + i, y - h, 1, h, grass[0]); px(mx + i + 1, y - h + 1, grass[1]); }
    }
    for (const [x0, pw, k, hi] of pools) { ellipse(x0 + pw / 2, y + 1.5, pw / 2, 1.5, k); rect(x0 + 4, y + 1, Math.round(pw / 3), 1, hi); rect(x0 + Math.round(pw / 2) + 3, y + 2, 4, 1, hi); }
  }

  // ---------- 新补的：林精（怪物） ----------
  // 树影里的一团黑影，头上像枯枝，一双发青光的眼睛；会眨眼、左右看，过一会儿闭眼隐进树影（8 fps）
  function spirit(cx, cy, tick) {
    const t = wrap(tick, 64);
    for (let y = cy + 2; y < cy + 24; y++) { // 身子往下越来越淡，混进树影里
      const hw = 5 + ((y - cy) >> 3), d = 1 - (y - cy - 2) / 24;
      for (let x = cx - hw; x <= cx + hw; x++) if (bayer(x, y) < d && (Math.abs(x - cx) < hw || hash(x, y, 77) < 0.5)) px(x, y, "z");
    }
    ellipse(cx, cy, 5, 4, "z");
    for (const s of [-1, 1]) { line(cx + s * 3, cy - 3, cx + s * 6, cy - 9, "z"); line(cx + s * 5, cy - 7, cx + s * 8, cy - 8, "z"); line(cx + s * 4, cy - 5, cx + s * 2, cy - 9, "z"); }
    if (t >= 52) return; // 闭上眼，看不见了
    const look = t < 16 ? 0 : t < 30 ? -1 : t < 40 ? 1 : 0, blink = t === 12 || t === 13 || t === 44;
    for (const ex of [cx - 3, cx + 2]) {
      if (blink) { px(ex + look, cy, "p"); px(ex + 1 + look, cy, "p"); }
      else { px(ex + look, cy, "s"); px(ex + 1 + look, cy, "t"); px(ex + look, cy + 1, "r"); }
    }
  }

  // ---------- 静态层（只画一次） ----------
  const STARS = [];
  for (let n = 0; n < 30; n++) STARS.push([Math.round(hash(n, 1, 41) * W), Math.round(hash(n, 2, 41) * 70), n % 4 ? "x" : "w"]);
  const LIGHT_A = { z: "g", y: "g", x: "f", p: "o", w: "F", g: "f" }, LIGHT_B = { g: "f", f: "a", x: "a", w: "F", o: "n" };
  const PULSE = [0.9, 1, 1.12];
  let STAT = null;
  function build() {
    const far = begin("z"); // 远景：夜空、星星、两排云杉、白桦、火鸟落脚的枯枝
    sky([[0, "z"], [36, "y"], [100, "x"]], 12);
    for (const [x, y, k] of STARS) px(x, y, k);
    spruceRow(120, 28, 54, 14, "y", 3);
    spruceRow(136, 30, 62, 18, "p", 4);
    for (const [bx, bw] of [[30, 4], [184, 3], [300, 6]]) birch(bx, bw, -10, 144, { bark: "w", shade: "x", mark: "y" }, bx);
    thick(-2, 72, 40, 60, 2.5, "f"); thick(36, 61, 76, 54, 1.5, "f"); line(-2, 70, 40, 58, "e"); line(22, 66, 30, 52, "f"); line(56, 57, 62, 46, "f"); line(62, 46, 68, 42, "f"); line(46, 59, 52, 68, "f");
    MASK = begin("."); // 近景：小屋、井、化雪的地面、人影（和静态图同样的顺序）
    hut(220, 70, 144);
    well(116, 144);
    thaw(144, { top: "u", body: "v", speck: "w", light: "u", dark: "x", rate: 0.02 }, ["w", "x"], [[40, 24], [196, 18]], [[160, 24, "y", "w"]], ["o", "n"], 6);
    hero(92, 128);
    STAT = PULSE.map((s) => { // 火鸟的光：三档亮度，轮流用
      use(far.slice());
      light(64, 50, 46, LIGHT_A, 0.22 * s);
      light(64, 50, 22, LIGHT_B, 0.4 * s);
      for (let i = 0; i < W * H; i++) if (MASK[i] !== ".") P[i] = MASK[i];
      return P;
    });
  }

  // ---------- 每一帧 ----------
  const FOG = { z: "y", y: "x", p: "x", o: "w", x: "w", w: "v", v: "u", g: "x", f: "w", e: "v" };
  const MIST = [[112, 56, 4, 1, 0], [126, 72, 5, 1, 170], [139, 48, 3, 2, 60]]; // [y, 半宽, 半高, 每帧移几 px, 起点]
  function mist(e) { // 薄雾：几条淡淡的雾带在白桦林间慢慢往右飘（只盖背景，按调色板提亮一级，用抖动不用半透明）
    for (const [cy, rx, ry, v, o] of MIST) {
      const cx = wrap(o + e * v, W + 2 * rx) - rx;
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = Math.max(0, cx - rx); x <= Math.min(W - 1, cx + rx); x++) {
        const u = (x - cx) / rx, w = (y - cy) / ry, t = 1 - (u * u + w * w);
        const i = y * W + x, k = FOG[P[i]];
        if (t > 0 && k && MASK[i] === "." && bayer(x, y) < t * 0.42) P[i] = k;
      }
    }
  }
  function twinkle(e) { // 星星：轮流亮一下（火鸟光照到的地方不闪）
    STARS.forEach(([x, y], n) => { if (Math.hypot(x - 64, y - 50) > 46 && wrap(e + n * 7, 23) === 0) { px(x, y, "u"); px(x - 1, y, "x"); px(x + 1, y, "x"); } });
  }
  function embers(e) { // 火鸟的金红光点：从枝头一颗颗落下，边落边晃、慢慢变暗（只画在背景上）
    for (let n = 0; n < 14; n++) {
      const life = 26 + Math.round(hash(n, 3, 9) * 14), age = wrap(e + Math.round(hash(n, 4, 9) * life), life);
      const x = Math.round(36 + hash(n, 1, 9) * 64 + tri(age + n * 3, 14, 2)), y = Math.round(50 + hash(n, 2, 9) * 10 + age * 1.6);
      const k = age < life * 0.25 ? "l" : age < life * 0.5 ? "k" : age < life * 0.8 ? "j" : "i";
      px(x, y, k);
      if (age < life * 0.4 && n % 3 === 0) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(x + dx, y + dy, age < life * 0.2 ? "k" : "j");
    }
  }
  const SHARDS = [[178, 124, 5, 3], [194, 120, 4, 4], [172, 136, 4, 3], [198, 134, 5, 3]];
  function nested(e) { // 套娃箱：抖几下 → 炸开 → 碎片飞出去落地，掉出小一号的箱子；停一会儿再来一遍
    const t = wrap(e, 40);
    if (t < 24) { nestBox(180 + (t >= 19 ? (t & 1 ? 1 : -1) : 0), 128, 16); return; }
    if (t === 24) { // 炸开的一瞬间
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0]]) line(188 + dx * 4, 136 + dy * 4, 188 + dx * 9, 136 + dy * 9, "t");
      ellipse(188, 136, 3, 3, "c");
      SHARDS.forEach(([x, y, w, h]) => shard(Math.round((x + 188) / 2), Math.round((y + 136) / 2), w, h));
      return;
    }
    nestBox(182, 132, 12);
    if (t === 25) for (const [dx, dy] of [[-3, -2], [3, -3], [-4, 2], [4, 2]]) line(188 + dx, 136 + dy, 188 + dx * 2, 136 + dy * 2, "u");
    SHARDS.forEach(([x, y, w, h], i) => { const k = t - 25, fy = Math.min(144 - h, y + (k * (k + 1)) * 1.5); shard(x + (k > 0 ? (i & 1 ? 1 : -1) * Math.min(k, 3) : 0), Math.round(fy), w, h); });
  }
  function frame(tick) {
    const e = tick >> 1; // 环境帧（4 fps）
    use(STAT[[0, 0, 1, 1, 2, 2, 1, 1][wrap(e, 8)]].slice());
    behind(() => { twinkle(e); embers(e); spirit(291, 104, tick); });
    mist(e);
    firebird(64, 50, e);
    doorway(220, 70, 0.62 + 0.08 * [0, 2, 1, 2, 0, 1][wrap(e, 6)]);
    cat(243, 98, tick);
    nested(e);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES["baba_yaga"] = {
    draw(ctx, tick) {
      if (!STAT) build();
      frame(Math.floor(tick) || 0);
      present(ctx);
    },
  };
})();
