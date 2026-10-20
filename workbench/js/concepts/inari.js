/* ART-04e 会动的概念场景：稻荷狐町（inari）
 * 照用户选定的 art/concepts/inari/b.png 画：画法和坐标照搬 tools/concepts/inari.mjs 的方向 B（傍晚的温泉街）。
 * 动起来的部分：傍晚的太阳雨（斜斜的细雨，落在地上和池面溅起水花）、温泉白雾一团团往上冒、石灯笼和提灯一闪一闪、
 * 冰块在温泉里浮着慢慢化（涟漪）、翻转墙每隔几秒转半圈；补上 1 只怪物（河童，从温泉里探头）和 1 只提示动物（小狐狸，耳朵抖动）。
 * 人影和木箱只当比例尺，不动。只看大致效果，不是游戏资产，不进美术确认。320×180，只用 ENDESGA 32（读 raster.js 的 PB.RGB），整数像素，不抗锯齿。
 * 接口：PB_CONCEPT_SCENES.inari.draw(ctx, tick)；tick 每秒加 8（页面每 125 毫秒调一次）：环境 4 fps（tick >> 1），动物 8 fps（tick）。 */
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

  // ---------- 狐町的部件（照搬 tools/concepts/inari.mjs） ----------
  const STONE = { top: "u", body: "v", speck: "w", light: "u", dark: "w", seam: "w", rate: 0.03 };
  function deepen(y0, k, to, max) { // 石面越往下越暗（只换 k 色）
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) if (get(x, y) === k && bayer(x, y) < ((y - y0) / (H - y0)) * max) px(x, y, to);
  }
  // 鸟居（正面）：黑色笠木两头上翘，朱红岛木、贯、柱子，柱脚黑；x = 左柱外沿，y = 笠木顶，h = 到柱脚
  function torii(x, y, w, h, c = { body: "a", shade: "f", lit: "b", black: "y", hi: "x" }) {
    const b = y + h, pw = Math.max(3, Math.round(w / 9));
    for (const p of [x + 3, x + w - 3 - pw]) {
      rect(p, y + 6, pw, h - 6, c.body); rect(p + pw - 1, y + 6, 1, h - 6, c.shade); rect(p, y + 6, 1, h - 6, c.lit);
      rect(p - 1, b - 5, pw + 2, 5, c.black);
    }
    rect(x - 1, y + 14, w + 2, 3, c.body); rect(x - 1, y + 16, w + 2, 1, c.shade); rect(x - 1, y + 14, w + 2, 1, c.lit);
    rect(x + (w >> 1) - 1, y + 7, 3, 7, c.body);
    rect(x - 2, y + 4, w + 4, 3, c.body); rect(x - 2, y + 6, w + 4, 1, c.shade);
    rect(x - 4, y + 1, w + 8, 3, c.black); rect(x - 4, y + 1, w + 8, 1, c.hi);
    rect(x - 7, y, 4, 2, c.black); rect(x + w + 3, y, 4, 2, c.black); px(x - 8, y, c.black); px(x + w + 7, y, c.black);
  }
  // 石灯笼 14×28；s = 火光的强弱（一闪一闪）
  function toro(x, base, s) {
    glow(x + 7, base - 19, 15, "f", 0.4 * s, ["x", "y", "p", "g", "B"]); glow(x + 7, base - 19, 9, "a", 0.35 * s, ["f", "w", "o"]);
    rect(x + 1, base - 4, 12, 4, "w"); rect(x + 1, base - 4, 12, 1, "u");
    rect(x + 5, base - 14, 4, 10, "v"); rect(x + 8, base - 14, 1, 10, "w");
    rect(x + 2, base - 16, 10, 2, "w"); rect(x + 2, base - 16, 10, 1, "u");
    rect(x + 3, base - 22, 8, 6, "v"); rect(x + 10, base - 22, 1, 6, "w");
    rect(x + 5, base - 21, 4, 4, "j"); rect(x + 6, base - 20, 2, 2, s > 1.05 ? "l" : s < 0.95 ? "j" : "k");
    poly([[x - 1, base - 22], [x + 15, base - 22], [x + 10, base - 27], [x + 4, base - 27]], "w"); rect(x, base - 23, 14, 1, "u");
    rect(x + 6, base - 29, 2, 2, "v");
  }
  // 冰块：z 描边、斜向高光；melt = 正在化（缺角、滴水）
  function iceBlock(x, y, s = 16, melt = false) {
    rect(x, y, s, s, "z"); rect(x + 1, y + 1, s - 2, s - 2, "s");
    rect(x + 1, y + 1, s - 2, 1, "t"); rect(x + 1, y + 1, 1, s - 2, "t");
    rect(x + 1, y + s - 2, s - 2, 1, "r"); rect(x + s - 2, y + 2, 1, s - 3, "r");
    for (let i = 0; i < s - 6; i++) px(x + 3 + i, y + s - 4 - i, "t");
    for (let i = 0; i < s - 10; i++) px(x + 7 + i, y + s - 4 - i, "u");
    if (melt) { px(x, y, null); rect(x, y, 3, 2, get(x - 1, y) ?? "q"); for (const dx of [3, 8, 12]) { px(x + dx, y + s, "s"); px(x + dx, y + s + 2, "t"); } }
  }
  function puff(cx, cy, r, k, d) { // 抖动的一团雾
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r * 1.4); x <= cx + r * 1.4; x++) {
        const t = 1 - Math.hypot((x - cx) / 1.4, y - cy) / r;
        if (t > 0 && bayer(x, y) < (t > 0.45 ? d + 0.4 : d * t * 2)) px(x, y, k);
      }
  }
  // 温泉池：凹进地面，石头围边，热水，表面亮线
  function onsen(x, y, w, d) {
    rect(x, y, w, d, "q"); rect(x, y, w, 2, "r"); rect(x + 2, y, w - 4, 1, "s");
    for (let i = x + 6; i < x + w - 6; i += 9) rect(i, y + 4 + (i % 3), 4, 1, "r");
    for (let i = x - 6; i <= x + w; i += 10) { const r = 4 + hash(i, 0, 5) * 2; ellipse(i + 3, y - 1, r, r * 0.65, "w"); ellipse(i + 2, y - 2, r - 1.5, (r - 1.5) * 0.6, "v"); px(i, y - 4, "u"); px(i + 1, y - 4, "u"); }
  }
  // 机关屋：深色木框、木格窗、瓦顶；x,y = 墙左上，w 宽，base = 地面
  function ninjaHouse(x, y, w, base) {
    rect(x, y, w, base - y, "g");
    for (let i = x + 2; i < x + w; i += 3) rect(i, y + 18, 1, base - y - 26, "f");
    for (const j of [y + 18, y + 30, base - 9]) rect(x, j, w, 1, "e");
    rect(x, y, w, 16, "w"); for (let i = x + 4; i < x + w; i += 24) rect(i, y + 3, 16, 10, "v");
    for (let i = x; i <= x + w; i += 36) { rect(Math.min(i, x + w - 4), y, 4, base - y, "f"); rect(Math.min(i, x + w - 4), y, 1, base - y, "e"); }
    rect(x - 4, base - 8, w + 8, 3, "e"); rect(x - 4, base - 8, w + 8, 1, "b"); rect(x - 4, base - 5, w + 8, 5, "g");
    for (let i = x; i < x + w; i += 18) rect(i, base - 5, 3, 5, "f");
    poly([[x - 14, y + 2], [x + w + 14, y + 2], [x + w - 6, y - 20], [x + 6, y - 20]], "x");
    for (let j = y - 17; j < y + 2; j += 3) for (let i = x - 14; i < x + w + 14; i++) if (get(i, j) === "x") px(i, j, "y");
    rect(x - 16, y + 1, w + 32, 2, "y"); rect(x - 16, y + 1, w + 32, 1, "w"); px(x - 17, y, "w"); px(x + w + 16, y, "w");
    rect(x + 4, y - 23, w - 8, 3, "y"); rect(x + 4, y - 23, w - 8, 1, "w");
  }
  function chochin(x, y, s) { // 提灯：纸面亮、上下红箍，带暖光；s = 光的强弱
    glow(x + 3, y + 5, 12, "f", 0.4 * s, ["x", "y", "g"]); glow(x + 3, y + 5, 8, "e", 0.35 * s, ["f", "w"]);
    rect(x + 2, y - 3, 1, 3, "z");
    rect(x, y, 7, 2, "h"); rect(x, y + 8, 7, 2, "h");
    ellipse(x + 3, y + 5, 3.5, 3, "c"); rect(x + 1, y + 4, 5, 1, "d"); rect(x + 1, y + 6, 5, 1, "d");
  }
  // 翻转墙：一块木格墙板（16×40）绕中间竖轴转；a = 转过的角度（0 = 正面朝人）；上下的虚线弧和静态图一样一直在，转的时候虚线跟着走（march = 0/1）
  function rotatingWall(x, base, a, march) {
    const y = base - 40, cx = x + 8, c = Math.cos(a), w = Math.max(2, Math.round(16 * Math.abs(c))), l = Math.round(cx - w / 2);
    if (w <= 2) { rect(cx - 1, y, 2, 40, "z"); rect(cx - 1, y + 1, 1, 38, "e"); }
    else {
      rect(l, y, w, 40, "z"); rect(l + 1, y + 1, w - 2, 38, w < 12 ? "g" : "f");
      for (let i = 3; i < 14; i += 3) { const ix = l + Math.round((i * w) / 16); if (ix > l && ix < l + w - 1) rect(ix, y + 2, 1, 36, "e"); }
      for (const j of [y + 10, y + 20, y + 30]) rect(l + 1, j, w - 2, 1, "e");
      const lit = c >= 0 ? l + 1 : l + w - 2; // 转过去以后受光边换到另一侧
      rect(l + 1, y + 1, w - 2, 1, "b"); rect(lit, y + 1, 1, 38, "b");
    }
    rect(cx - 1, y - 4, 2, 4, "x"); rect(cx - 1, base, 2, 1, "x");
    for (const ay of [y - 2, y + 20]) for (let d = 0; d < 360; d += 12) {
      const t = (d * Math.PI) / 180, ex = cx + Math.cos(t) * 13, ey = ay + Math.sin(t) * 3;
      if (Math.sin(t) > -0.2 || ay > y) px(ex, ey, (d + march * 12) % 24 ? "u" : "t");
    }
    for (const [dx, dy] of [[13, 0], [12, -1], [12, 1]]) { px(cx + dx, y - 2 + dy, "t"); px(cx - dx, y + 20 - dy, "t"); }
  }
  const KIT = [ // 小狐狸（提示动物）10×8，朝左坐着；耳朵另画，会抖
    "..........",
    ".bbb......",
    "zbbb.....c",
    "bbcb....bc",
    ".bcbb..bb.",
    "..bbbbbb..",
    "..bcbbbb..",
    "..b.b.b...",
  ];
  function kit(x, y, tick) {
    spr(x, y, KIT);
    const t = wrap(tick, 20), flick = t === 6 || t === 7 || t === 15;
    px(x + 1, y, "b"); if (flick) { px(x + 4, y + 1, "b"); } else px(x + 3, y, "b"); // 右耳抖一下
    if (wrap(tick, 32) >= 24) { px(x + 9, y + 2, null); px(x + 9, y + 1, "c"); } // 尾巴尖翘一下
  }

  // ---------- 新补的：河童（怪物） ----------
  // 从温泉里探出头：头顶有盘子、一圈深绿头发、黄色的嘴；探头、左右看、眨眼、再沉下去（8 fps）。cx = 头的中心
  function kappa(cx, tick) {
    const t = wrap(tick, 64), water = 145;
    let h = 0;
    if (t >= 12 && t < 18) h = [2, 4, 6, 8, 9, 10][t - 12];
    else if (t >= 18 && t < 46) h = 10 - (wrap(t, 8) < 4 ? 0 : 1);
    else if (t >= 46 && t < 52) h = [9, 8, 6, 4, 2, 0][t - 46];
    if (!h) {
      if (t >= 6 && t < 12) { px(cx - 1 + (t & 1), water - 1 - ((t - 6) >> 1), "t"); px(cx + 2, water - 1, t & 2 ? "u" : "s"); } // 冒泡
      if (t >= 52 && t < 58) { const r = 3 + (t - 52); px(cx - r, water, "t"); px(cx + r, water, "t"); } // 沉下去后的涟漪
      return;
    }
    const top = water - h, face = t >= 30 && t < 40 ? -1 : 1, blink = t === 26 || t === 38;
    critter(cx - 7, top - 1, 15, 12, () => {
      ellipse(cx, top + 5, 5, 4.5, "m");
      for (let y = top + 3; y <= top + 9; y++) px(cx + 4 * -face, y, "n"); px(cx + 3 * -face, top + 8, "n");
      ellipse(cx, top + 1.5, 3.5, 1.2, "u"); rect(cx - 2, top + 1, 2, 1, "t"); px(cx - 4, top + 2, "o"); px(cx + 4, top + 2, "o");
      rect(cx - 4, top + 3, 9, 1, "o"); px(cx - 5, top + 4, "o"); px(cx + 5, top + 4, "o");
      for (const ex of [cx + face * 1, cx + face * 3]) px(ex, top + 5, blink ? "n" : "z");
      if (!blink) px(cx + face * 3, top + 4, "t");
      rect(face > 0 ? cx + 4 : cx - 6, top + 6, 3, 2, "k"); px(face > 0 ? cx + 6 : cx - 6, top + 7, "b");
    });
    for (let x = cx - 8; x <= cx + 8; x++) { px(x, water, "s"); px(x, water + 1, "r"); px(x, water + 2, "q"); } // 水面盖住脖子
    px(cx - 6 - (t & 1), water, "t"); px(cx + 6 + (t & 1), water, "t");
  }

  // ---------- 静态层（只画一次） ----------
  const FLICKER = [0.85, 1, 1.15];
  let STAT = null;
  function near(s) { // 近景：和静态图同样的顺序；会动的东西（冰块、白雾、翻转墙、小狐狸）另画
    torii(26, 54, 84, 90);
    ninjaHouse(184, 92, 136, 144);
    for (const lx of [196, 244, 292]) chochin(lx, 98, s);
    ground(0, 144, W, 36, STONE, 8);
    deepen(150, "v", "w", 0.6);
    onsen(22, 145, 88, 14);
    toro(114, 144, s);
    toro(4, 144, s);
    crate(176, 128);
    hero(138, 128);
  }
  function build() {
    MASK = begin("."); near(1);
    STAT = FLICKER.map((s) => {
      begin("y"); // 远景：傍晚的天、两层远山、山间的雾
      sky([[0, "y"], [30, "x"], [70, "B"], [104, "C"]], 10);
      hills(116, 40, 60, "x", 5); for (let j = 96; j < 128; j++) dith(0, j, W, 1, "w", ((j - 96) / 32) * 0.5);
      hills(134, 34, 44, "p", 6);
      near(s);
      return P;
    });
  }

  // ---------- 每一帧 ----------
  function rain(e) { // 太阳雨：亮天下斜斜的细雨，稀疏、颜色淡（只画在背景上，不挡人和箱子）
    for (let i = 0; i < 44; i++) {
      const x = wrap(Math.round(hash(i, 1, 12) * (W + 40)) - e * 2, W + 40) - 20, y = wrap(Math.round(hash(i, 2, 12) * H) + e * 6, H + 6) - 6;
      line(x, y, x - 1, y + 3, "v");
    }
  }
  function splashes(e) { // 雨点落在石地和池面上溅起的小水花
    for (let i = 0; i < 5; i++) {
      const x = Math.round(hash(i, e, 13) * W), onPool = x > 24 && x < 108;
      if (onPool) { px(x - 1, 145, "t"); px(x + 1, 145, "t"); px(x, 144, "u"); }
      else if (MASK[144 * W + x] !== "." && hash(i, e, 14) < 0.6) { px(x, 143, "u"); px(x - 1, 142, "v"); px(x + 1, 142, "v"); }
    }
  }
  function steam(e) { // 温泉白雾：一团团从池面冒出来往上飘，越高越淡、越散
    for (let i = 0; i < 12; i++) {
      const life = 14 + Math.round(hash(i, 3, 4) * 8), up = wrap(e + Math.round(hash(i, 4, 4) * life), life) / life;
      const cx = 22 + hash(i, 1, 4) * 88 + tri(e + i * 5, 16, 2) + up * 6, cy = 142 - up * 46, r = 4 + up * 7;
      puff(cx, cy, r, up > 0.55 ? "v" : "u", 0.75 - up * 0.5);
    }
  }
  function ice(e) { // 冰块浮在温泉里慢慢化：上下浮动 1px，四周有涟漪
    const y = 139 + (wrap(e, 8) < 4 ? 0 : 1), k = wrap(e, 6) >> 1;
    iceBlock(52, y, 14, true);
    tint(52, 147, 14, 8, { s: "r", t: "s", u: "r", r: "q", z: "q" });
    for (const [rx, rw] of [[46, 4], [68, 5], [50, 3]]) rect(rx + (rx < 60 ? -k : k), 150 + (rx % 3), rw, 1, "s");
  }
  function frame(tick) {
    const e = tick >> 1; // 环境帧（4 fps）
    const v = [1, 2, 1, 0, 1, 1, 2, 0, 1, 2][wrap(e, 10)];
    use(STAT[v].slice()); // 灯火一闪一闪
    behind(() => rain(e));
    ice(e);
    steam(e);
    toro(114, 144, FLICKER[v]); toro(4, 144, FLICKER[v]); // 和静态图一样：石灯笼挡在白雾前面
    kappa(84, tick);
    splashes(e);
    const t = wrap(e, 24); // 翻转墙：停 4 秒，转 2 秒（半圈）
    rotatingWall(156, 144, t < 16 ? 0 : ((t - 15) * Math.PI) / 8, t >= 16 ? t & 1 : 0);
    kit(300, 128, tick);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES["inari"] = {
    draw(ctx, tick) {
      if (!STAT) build();
      frame(Math.floor(tick) || 0);
      present(ctx);
    },
  };
})();
