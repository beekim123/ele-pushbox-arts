/* ART-04e 会动的概念场景：西部小镇（frontier）
 * 照用户选定的 art/concepts/frontier/a.png 画：画法和坐标照搬 tools/concepts/frontier.mjs 的方向 A（午后烈日下的木栈道主街）。
 * 动起来的部分：远景热浪微抖、阵风一阵阵刮过并扬起沙粒、风车转、风滚草被风吹到火盆边烧起来、火盆冒烟；
 * 补上 1 只怪物（响尾蛇，盘着摇尾巴）和 1 只提示动物（走鹃，跑两步停一下）。人影和木箱只当比例尺，不动。
 * 只看大致效果，不是游戏资产，不进美术确认。320×180，只用 ENDESGA 32（读 raster.js 的 PB.RGB），整数像素，不抗锯齿。
 * 接口：PB_CONCEPT_SCENES.frontier.draw(ctx, tick)；tick 每秒加 8（页面每 125 毫秒调一次）：环境 4 fps（tick >> 1），动物 8 fps（tick）。 */
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

  // ---------- 西部小镇的部件（照搬 tools/concepts/frontier.mjs） ----------
  // 平顶山：上段陡崖、下段碎石坡，右侧背光，横向岩层
  function mesa(x, y, w, base, k, sh, s) {
    const cliff = Math.round((base - y) * 0.45), sl = Math.round((base - y) * 0.5);
    poly([[x - 2, y + cliff], [x, y], [x + w, y], [x + w + 2, y + cliff], [x + w + sl, base], [x - sl, base]], k);
    poly([[x + w - 4, y], [x + w, y], [x + w + 2, y + cliff], [x + w + sl, base], [x + w + sl - 12, base], [x + w - 6, y + cliff]], sh);
    for (let j = y + 4; j < base; j += 5)
      for (let i = x - sl; i < x + w + sl; i++) if (get(i, j) === k && hash(i >> 2, j, s) < 0.5) px(i, j, sh);
  }
  // 树形仙人掌：k 身体、lo 背光、hi 受光
  function cactus(x, base, h, k, lo, hi) {
    const arm = (ax, ay, len, left) => {
      rect(left ? ax - 5 : ax, ay, 5, 4, k);
      const ux = left ? ax - 5 : ax + 1;
      rect(ux, ay - len, 4, len, k); rect(ux + 1, ay - len - 1, 2, 1, k);
      rect(ux + 3, ay - len, 1, len + 4, lo); rect(ux, ay - len + 1, 1, len - 1, hi);
    };
    arm(x, base - Math.round(h * 0.5), Math.round(h * 0.3), true);
    arm(x + 6, base - Math.round(h * 0.65), Math.round(h * 0.22), false);
    rect(x, base - h + 1, 6, h - 1, k); rect(x + 1, base - h, 4, 1, k);
    rect(x + 4, base - h + 1, 2, h - 1, lo); rect(x + 1, base - h + 1, 1, h - 2, hi);
  }
  // 风滚草：一团乱枝；rot = 滚动时转过的角度
  function tumbleweed(cx, cy, r, s, ks = ["e", "F", "f"], rot = 0) {
    for (let n = 0; n < 40; n++) { const a = (n / 40) * 6.283 + rot; if (hash(n, 5, s) < 0.7) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, ks[n % 2 ? 2 : 0]); }
    for (let n = 0; n < 30; n++) {
      const a0 = hash(n, 1, s) * 6.283 + rot, a1 = a0 + 1.2 + hash(n, 2, s) * 2.8;
      const r0 = r * (0.6 + 0.4 * hash(n, 3, s)), r1 = r * (0.6 + 0.4 * hash(n, 4, s));
      line(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1, ks[n % 3]);
    }
  }
  // 一道阵风：断续的细线，末端打个卷
  function gust(x, y, len, k) {
    for (let i = 0; i < len; i++) if ((i & 7) !== 5) px(x + i, y, k);
    for (const [dx, dy] of [[0, -1], [1, -2], [0, -3], [-1, -3], [-2, -2]]) px(x + len + dx, y + dy, k);
  }
  const FIRES = [[ // 火苗 3 帧（第 1 帧就是静态图里的那团火）
    "....i...",
    "...ii...",
    "...iji..",
    "..ijji.i",
    ".iijkji.",
    ".ijkkji.",
    "ijkkkkji",
    "ijkkkkji",
    ".ijjjji.",
  ], [
    "........",
    ".....i..",
    "....ii..",
    "...ijii.",
    "..ijjji.",
    ".ijkkjii",
    "ijkkkkji",
    "ijkkkkji",
    ".ijjjji.",
  ], [
    "...i....",
    "..ii...i",
    "..iji...",
    ".iijii..",
    ".ijjkji.",
    ".ijkkkji",
    "ijkkkkji",
    "ijkkkkji",
    ".ijjjji.",
  ]];
  // 铁桶火盆 12×12（火苗另画，会跳动）
  function brazier(x, base) {
    rect(x, base - 12, 12, 12, "z");
    rect(x + 1, base - 11, 10, 10, "w");
    rect(x + 1, base - 11, 2, 10, "v"); rect(x + 9, base - 11, 2, 10, "x");
    rect(x + 1, base - 8, 10, 1, "x"); rect(x + 1, base - 4, 10, 1, "x");
  }
  function blob(cx, cy, rx, ry, k, d) { // 抖动的一团（d = 密度，1 = 实心）
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x - cx) / (rx + 0.5), v = (y - cy) / (ry + 0.5);
        if (u * u + v * v <= 1 && bayer(x, y) < d) px(x, y, k);
      }
  }
  function pane(x, y, w, h, shade = false) { // 窗：框、玻璃、反光、窗棂
    rect(x, y, w, h, shade ? "g" : "f");
    rect(x + 2, y + 2, w - 4, h - 4, "y");
    line(x + 3, y + h - 4, x + Math.min(w, h) - 4, y + 3, "x");
    rect(x + (w >> 1) - 1, y + 2, 2, h - 4, shade ? "g" : "f");
    if (!shade) rect(x + 2, y + 2, 3, h - 6, "h");
  }
  function horseshoe(cx, cy) { // 招牌上的马蹄铁（不写字）
    for (let a = 150; a <= 390; a += 5) {
      const t = (a * Math.PI) / 180;
      px(cx + Math.cos(t) * 5, cy - Math.sin(t) * 5, "x");
      px(cx + Math.cos(t) * 4, cy - Math.sin(t) * 4, "w");
    }
  }
  // 酒馆：假立面 + 门廊；x = 立面左边，宽 136；门廊下是阴影
  function saloon(x) {
    const r = x + 136;
    rect(x, 50, 136, 56, "b"); rect(x + 28, 40, 80, 10, "b"); rect(x + 52, 33, 32, 7, "b");
    for (let j = 42; j < 104; j += 4) for (let i = x; i < r; i++) if (get(i, j) === "b") px(i, j, "e");
    rect(r - 5, 50, 5, 56, "e"); rect(x + 103, 40, 5, 10, "e"); rect(x + 80, 33, 4, 7, "e");
    for (const [cx, cy, cw] of [[x - 2, 48, 140], [x + 26, 38, 84], [x + 50, 31, 36]]) { rect(cx, cy, cw, 3, "f"); rect(cx, cy, cw, 1, "d"); }
    rect(x + 30, 55, 76, 18, "g"); rect(x + 32, 57, 72, 14, "e"); rect(x + 32, 57, 72, 1, "b");
    horseshoe(x + 68, 63);
    for (const sx of [x + 44, x + 92]) { px(sx, 64, "f"); px(sx - 1, 64, "f"); px(sx + 1, 64, "f"); px(sx, 63, "f"); px(sx, 65, "f"); }
    for (const wx of [x + 14, x + 106]) pane(wx, 78, 16, 18);
    rect(x - 6, 104, 148, 6, "e"); rect(x - 6, 104, 148, 1, "d"); rect(x - 6, 105, 148, 1, "b"); rect(x - 6, 109, 148, 1, "g");
    rect(x, 110, 136, 34, "f");
    for (let j = 113; j < 144; j += 4) rect(x, j, 136, 1, "g");
    for (const wx of [x + 8, x + 104]) pane(wx, 116, 24, 18, true);
    rect(x + 56, 114, 24, 30, "z");
    for (const dx of [0, 13]) { rect(x + 57 + dx, 121, 10, 13, "e"); rect(x + 57 + dx, 121, 10, 1, "b"); rect(x + 59 + dx, 125, 6, 1, "f"); rect(x + 59 + dx, 129, 6, 1, "f"); }
    for (const p of [x - 4, x + 44, x + 88, r]) { rect(p, 110, 4, 34, "e"); rect(p + 3, 110, 1, 34, "f"); rect(p, 110, 4, 1, "g"); }
    rect(x + 50, 110, 1, 4, "z"); rect(x + 48, 114, 5, 6, "z"); rect(x + 49, 115, 3, 4, "j"); px(x + 50, 116, "k"); // 门边油灯
  }
  // 木栈道：顶面 y，16px 高；每 16px 一块板，每 32px 一根桩
  function boardwalk(x, w, y) {
    rect(x, y, w, 16, "e");
    rect(x, y, w, 1, "d"); rect(x, y + 1, w, 2, "b"); rect(x, y + 3, w, 1, "f");
    for (let i = x; i < x + w; i += 16) rect(i, y + 4, 1, 11, "f");
    for (let i = x + 8; i < x + w; i += 32) { rect(i, y + 4, 4, 12, "f"); rect(i, y + 4, 1, 12, "e"); }
    rect(x, y + 15, w, 1, "g");
  }
  // 木水塔：水箱 48×28（左上 x,y），两条腿落到 base
  function waterTower(x, y, base) {
    for (const lx of [x + 6, x + 39]) rect(lx, y + 30, 3, base - y - 30, "f");
    const mid = Math.round((y + 30 + base) / 2);
    for (const [a, b] of [[y + 31, mid], [mid, base]]) { line(x + 8, a, x + 39, b, "f"); line(x + 39, a, x + 8, b, "f"); rect(x + 6, a, 36, 1, "f"); }
    rect(x - 2, y + 28, 52, 3, "f"); rect(x - 2, y + 28, 52, 1, "e");
    rect(x, y, 48, 28, "e");
    for (let i = x + 3; i < x + 48; i += 5) rect(i, y, 1, 28, "f");
    rect(x, y, 3, 28, "b"); rect(x + 40, y, 8, 28, "f");
    for (const hy of [y + 5, y + 14, y + 23]) rect(x, hy, 48, 1, "x");
    poly([[x - 3, y + 1], [x + 51, y + 1], [x + 24, y - 13]], "f");
    poly([[x + 24, y - 13], [x + 51, y + 1], [x + 24, y + 1]], "g");
    line(x - 2, y, x + 23, y - 12, "e");
    rect(x + 30, y + 31, 3, 10, "x");
  }
  // 抽水风车：铁架塔 + 尾翼（中心 cx，轮心 hy）；风轮另画，会转
  function windpumpTower(cx, hy, base) {
    const half = (y) => 2 + ((y - hy) * 8) / (base - hy);
    line(cx - 2, hy + 4, cx - 10, base, "x"); line(cx + 2, hy + 4, cx + 10, base, "x");
    for (let y = hy + 12; y + 12 <= base; y += 12) {
      line(cx - half(y), y, cx + half(y + 12), y + 12, "x"); line(cx + half(y), y, cx - half(y + 12), y + 12, "x");
      rect(Math.round(cx - half(y)), y, Math.round(half(y) * 2) + 1, 1, "x");
    }
    rect(cx, hy - 1, 15, 2, "x"); poly([[cx + 13, hy - 6], [cx + 21, hy - 5], [cx + 21, hy + 5], [cx + 13, hy + 2]], "w");
  }
  function windpumpWheel(cx, hy, rot) { // 多叶风轮：16 片叶，rot = 转过的角度
    for (let n = 0; n < 16; n++) { const a = (n / 16) * 6.283 + rot; line(cx + Math.cos(a) * 3, hy + Math.sin(a) * 3, cx + Math.cos(a) * 11, hy + Math.sin(a) * 11, n % 2 ? "w" : "v"); }
    for (let n = 0; n < 64; n++) { const a = (n / 64) * 6.283; px(cx + Math.cos(a) * 11, hy + Math.sin(a) * 11, "x"); }
    rect(cx - 1, hy - 1, 3, 3, "y");
  }

  // ---------- 新补的：响尾蛇（怪物）和走鹃（提示动物） ----------
  // 响尾蛇：盘成三圈（圈和圈之间有深色缝）、头朝左抬起；尾尖的响环一阵阵地抖（8 fps），偶尔吐信子。x = 左边，base = 地面
  function snake(x, base, tick) {
    const shake = wrap(tick, 32) < 14, dx = shake ? (tick & 1 ? 1 : -1) : 0;
    const tongue = wrap(tick, 48) >= 36 && (tick & 2), b = base;
    critter(x - 2, b - 20, 26, 20, () => {
      line(x + 18, b - 4, x + 21, b - 8, "d"); line(x + 19, b - 4, x + 22, b - 8, "F"); // 尾巴斜着翘起来
      for (let j = 0; j < 3; j++) rect(x + 21 + dx + (j >> 1), b - 10 - j * 2, 2, 2, j % 2 ? "F" : "c"); // 响环
      const rings = [[11, 2.5, 9.5, 2], [11, 6, 7, 1.5], [10.5, 9, 4.5, 1.2]];
      rings.forEach(([cx, cy, rx, ry], n) => {
        ellipse(x + cx, b - cy, rx, ry, "d");
        for (let i = Math.round(x + cx - rx); i <= x + cx + rx; i++) {
          let j = Math.round(b - cy + ry) + 1;
          while (j > b - cy - ry - 1 && get(i, j) !== "d") j--;
          if (get(i, j) === "d") { px(i, j, n ? "f" : "F"); if (get(i, j - 1) === "d") px(i, j - 1, "F"); }
        }
        for (let i = Math.round(x + cx - rx + 2 + n); i < x + cx + rx - 1; i += 4) { px(i, b - cy - 1, "f"); px(i + 1, b - cy - 1, "f"); px(i, b - cy, "f"); }
        rect(Math.round(x + cx - rx + 2), Math.round(b - cy - ry), Math.round(rx), 1, "c");
      });
      line(x + 7, b - 10, x + 5, b - 12, "d"); line(x + 5, b - 12, x + 5, b - 14, "d"); line(x + 6, b - 11, x + 6, b - 12, "F"); // S 形脖子
      rect(x + 1, b - 17, 5, 2, "d"); rect(x, b - 16, 1, 1, "d"); rect(x + 1, b - 15, 4, 1, "F"); px(x + 2, b - 18, "d"); px(x + 3, b - 18, "d");
      px(x + 2, b - 17, "z"); px(x + 4, b - 17, "c");
    });
    if (tongue) { px(x - 2, b - 16, "A"); px(x - 3, b - 17, "A"); px(x - 3, b - 15, "A"); }
  }
  // 走鹃：灰蓝身子、长尾巴翘着、头上有冠、长嘴；跑两步停一下（8 fps）。right = 朝右
  function roadrunner(x, base, right, run, idle) {
    const X = (d) => (right ? x + d : x + 17 - d), bob = run === 1 || run === 3 ? -1 : 0;
    const b = base + bob, tail = !run && run !== 0 && idle ? -1 : 0;
    critter(x - 1, base - 16, 20, 17, () => {
      line(X(6), b - 7, X(0), b - 13 + tail, "w"); line(X(6), b - 6, X(1), b - 12 + tail, "x"); line(X(5), b - 7, X(0), b - 12 + tail, "v");
      ellipse(X(8.5), b - 6, 3.5, 2, "w");
      rect(Math.min(X(6), X(10)), b - 5, 5, 1, "v"); px(X(7), b - 7, "u"); px(X(9), b - 7, "u"); px(X(11), b - 6, "u");
      const hd = idle === 2 ? 1 : 0; // 停下来时偶尔低一下头
      line(X(11), b - 7, X(12), b - 9 + hd, "w");
      ellipse(X(13), b - 10 + hd, 1.5, 1.5, "w");
      px(X(12), b - 12 + hd, "x"); px(X(11), b - 13 + hd, "x"); px(X(13), b - 12 + hd, "w");
      px(X(14), b - 10 + hd, "t"); px(X(13), b - 10 + hd, "r");
      line(X(15), b - 10 + hd, X(17), b - 9 + hd, "x");
      const legs = run < 0 ? [[7, 8], [10, 10]] : [[[5, 7], [11, 10]], [[8, 8], [9, 9]], [[11, 10], [5, 7]], [[9, 9], [8, 8]]][run];
      line(X(8), b - 4, X(legs[0][0]), base - 1, "x"); line(X(9), b - 4, X(legs[1][0]), base - 1, "x");
      px(X(legs[0][0] + 1), base - 1, "x"); px(X(legs[1][0] + 1), base - 1, "x");
    });
  }

  // ---------- 静态层（只画一次） ----------
  let FAR = null, STAT = null;
  function build() {
    FAR = begin("r"); // 远景：天空、平顶山、远处的荒地
    sky([[0, "q"], [26, "r"], [112, "v"]], 8);
    mesa(178, 84, 36, 122, "F", "e", 1);
    mesa(262, 78, 52, 122, "F", "e", 2);
    mesa(-36, 92, 64, 122, "F", "e", 3);
    rect(0, 120, W, 40, "F");
    for (let j = 120; j < 160; j++) dith(0, j, W, 1, "e", (j - 118) / 70);
    for (let n = 0; n < 24; n++) { const sx = Math.round(hash(n, 7, 3) * W), sy = Math.round(124 + hash(n, 8, 3) * 30); rect(sx, sy, 3, 1, "f"); px(sx + 1, sy - 1, "f"); }
    STAT = FAR.slice(); MASK = new Array(W * H).fill("."); use(STAT);
    both(() => { // 近景：和静态图同样的顺序
      windpumpTower(196, 44, 159);
      waterTower(244, 66, 159);
      cactus(302, 160, 44, "o", "p", "n");
      saloon(12);
      boardwalk(0, 160, 144);
      tint(6, 144, 148, 3, { d: "e", b: "e" });
      rect(160, 152, 16, 8, "e"); rect(160, 152, 16, 1, "d"); rect(160, 155, 16, 1, "f"); rect(160, 159, 16, 1, "g");
      ground(0, 160, W, 20, { top: "c", body: "d", speck: "b", light: "c", dark: "e" }, 4);
      brazier(262, 160);
      hero(102, 128);
      crate(124, 128);
    });
  }

  // ---------- 每一帧 ----------
  function shimmer(e) { // 午后热浪：远景的平顶山一行行左右抖 1px，波纹慢慢往上走（只动背景）
    for (let y = 76; y < 120; y++) {
      const v = wrap(y + e, 12), dx = v < 2 ? 1 : v >= 6 && v < 8 ? -1 : 0;
      if (!dx) continue;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (MASK[i] === ".") P[i] = FAR[y * W + Math.min(W - 1, Math.max(0, x - dx))];
      }
    }
  }
  const GUSTS = [[146, 34, 0], [152, 30, 6], [157, 26, 3], [98, 22, 10]]; // [y, 长度, 晚几帧出发]
  function gusts(e) { // 阵风：每 6 秒一阵，几道断续的风线从左往右刮过去；风里带着沙粒
    const t = wrap(e, 24);
    for (const [y, len, lag] of GUSTS) {
      const x = -60 + (t - lag) * 22;
      if (t >= lag && x < W) gust(x, y, len, "u");
    }
    if (t < 18) for (let i = 0; i < 10; i++) {
      const x = wrap(Math.round(hash(i, 1, 21) * W) + t * 14, W + 20) - 10, y = 149 + Math.round(hash(i, 2, 21) * 9) - wrap(t + i, 3);
      px(x, y, i % 3 ? "c" : "d"); if (i % 2) px(x - 1, y, "c");
    }
  }
  function smoke(e) { // 火盆的烟：一团团往上冒，顺着风往右飘，越高越散
    for (let i = 0; i < 4; i++) {
      const a = wrap(e + i * 5, 20) / 20, cx = 268 + a * 20 + a * a * 12, cy = 134 - a * 36, r = 2 + a * 4;
      const d = a < 0.5 ? 0.8 : 0.8 * (1 - (a - 0.5) / 0.5);
      blob(cx, cy, r, r * 0.8, "w", d); blob(cx - 1, cy - 1, r - 1, (r - 1) * 0.8, "v", d);
    }
  }
  const WEED = ["f", "g", "d"]; // 风滚草的颜色：比静态图多一点浅色，滚过深色门廊时也看得见
  function weed(e) { // 风滚草：被风吹着从左边滚到火盆边，碰到火就烧起来，烧完剩一点灰
    const t = wrap(e, 48);
    if (t < 30) {
      const x = Math.min(252, -12 + t * 9), hop = x < 252 ? [0, -2, -3, -2, 0, 0][t % 6] : 0;
      const cy = x < 164 ? 135 : x < 180 ? 143 : 151; // 先在栈道上滚，跳下台阶，再在沙地上滚
      tumbleweed(x, cy + hop, 8, 6, WEED, -x / 8);
    } else if (t < 41) {
      const k = t - 30, r = Math.max(3, 8 - (k >> 1)), cy = 159 - r;
      tumbleweed(252, cy, r, 6, k < 3 ? WEED : ["g", "f", "g"], 0);
      if (k < 9) {
        spr(248, cy - r - 4 + (k < 2 ? 4 : 0), FIRES[(e + 1) % 3].slice(k < 2 ? 4 : 0));
        for (let n = 0; n < 8; n++) if (hash(n, e, 31) < 0.6) px(252 - r + hash(n, 1, e) * r * 2, cy - r + hash(n, 2, e) * r * 2, n % 3 ? "j" : "k");
      }
    } else if (t < 47) {
      const k = t - 41;
      rect(248, 158, 9, 2, "w"); rect(250, 157, 5, 1, "x"); if (k < 3) px(252, 156, "i");
      blob(253 + k * 2, 150 - k * 5, 2 + k, 2 + k * 0.6, "v", 1 - k / 6);
    }
  }
  function frame(tick) {
    const e = tick >> 1; // 环境帧（4 fps）
    use(STAT.slice());
    shimmer(e);
    windpumpWheel(196, 44, e * 0.157);
    smoke(e);
    spr(264, 139, FIRES[e % 3]);
    if (wrap(e, 5) < 2) px(62, 116, "l"); // 门边油灯一闪
    gusts(e);
    weed(e);
    snake(277, 160, tick);
    const u = Math.floor(tick / 16), f = wrap(tick, 16), run = f < 6 ? f % 4 : -1;
    const q = wrap(u * 18 + Math.min(f, 6) * 3, 108), right = q < 54; // 在栈道左段来回跑，不挨着人影
    roadrunner(14 + (right ? q : 108 - q), 144, right, run, run < 0 ? wrap(u, 3) : 0);
    hero(102, 128);
    crate(124, 128);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES["frontier"] = {
    draw(ctx, tick) {
      if (!STAT) build();
      frame(Math.floor(tick) || 0);
      present(ctx);
    },
  };
})();
