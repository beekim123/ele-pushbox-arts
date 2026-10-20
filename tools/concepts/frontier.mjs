// ART-04a 概念图：西部小镇（frontier）
// 运行：node tools/concepts/frontier.mjs → 生成 art/concepts/frontier/a.png、b.png
// 320×180、16px 格、只用 ENDESGA 32。只是给用户挑方向的草图，不是游戏资产，不进美术确认。
// ---------- 草图工具（三张地图的脚本各带一份，互不依赖） ----------
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { encodePng } from "../lib/png.mjs";

const ROOT = new URL("../../", import.meta.url);
const W = 320, H = 180; // 逻辑画面；16×16 一格，横 20 格

// 只用 ENDESGA 32：从 workbench/js/core/raster.js 读 PALETTE（只读），画布里只存单字符色码
const core = {};
vm.runInNewContext(readFileSync(new URL("workbench/js/core/raster.js", ROOT), "utf8"), core);
const RGB = core.PB.RGB;

let P = null; // 当前画布：W*H 个色码
const begin = (k) => { P = new Array(W * H).fill(k); };
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
function px(x, y, k) {
  x = Math.round(x); y = Math.round(y);
  if (k && k !== "." && inside(x, y)) P[y * W + x] = k;
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
function hash(x, y, s = 0) { // 固定的伪随机，每次生成的像素都一样
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
function rim(x, y, w, h, set, lit) { // 给一块形状的上沿补 1px 受光边（上面一格不属于这块形状时）
  const hit = [];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
    if (set.includes(get(i, j)) && !set.includes(get(i, j - 1))) hit.push([i, j]);
  hit.forEach(([i, j]) => px(i, j, lit));
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
function save(id, name) {
  const rgba = new Uint8Array(W * H * 4);
  P.forEach((k, i) => {
    const c = RGB[k];
    if (!c) throw new Error(`不在 ENDESGA 32 里的色码：${k}`);
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255;
  });
  const dir = new URL(`art/concepts/${id}/`, ROOT);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL(`${name}.png`, dir), encodePng(W, H, rgba));
  console.log(`art/concepts/${id}/${name}.png`);
}
// ---------- 草图工具结束 ----------

const ID = "frontier";

// ---------- 西部小镇的部件 ----------
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
// 风滚草：一团乱枝
function tumbleweed(cx, cy, r, s, ks = ["e", "F", "f"]) {
  for (let n = 0; n < 40; n++) { const a = (n / 40) * 6.283; if (hash(n, 5, s) < 0.7) px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, ks[n % 2 ? 2 : 0]); }
  for (let n = 0; n < 30; n++) {
    const a0 = hash(n, 1, s) * 6.283, a1 = a0 + 1.2 + hash(n, 2, s) * 2.8;
    const r0 = r * (0.6 + 0.4 * hash(n, 3, s)), r1 = r * (0.6 + 0.4 * hash(n, 4, s));
    line(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1, ks[n % 3]);
  }
}
// 一道阵风：断续的细线，末端打个卷
function gust(x, y, len, k) {
  for (let i = 0; i < len; i++) if ((i & 7) !== 5) px(x + i, y, k);
  for (const [dx, dy] of [[0, -1], [1, -2], [0, -3], [-1, -3], [-2, -2]]) px(x + len + dx, y + dy, k);
}
const FIRE = [
  "....i...",
  "...ii...",
  "...iji..",
  "..ijji.i",
  ".iijkji.",
  ".ijkkji.",
  "ijkkkkji",
  "ijkkkkji",
  ".ijjjji.",
];
// 铁桶火盆 12×12，桶口一团火
function brazier(x, base) {
  rect(x, base - 12, 12, 12, "z");
  rect(x + 1, base - 11, 10, 10, "w");
  rect(x + 1, base - 11, 2, 10, "v"); rect(x + 9, base - 11, 2, 10, "x");
  rect(x + 1, base - 8, 10, 1, "x"); rect(x + 1, base - 4, 10, 1, "x");
  spr(x + 2, base - 21, FIRE);
}
function smoke(x, y, n) { // 往右飘的烟团（顺着风）
  for (let i = 0; i < n; i++) {
    const cx = x + i * 3 + i * i, cy = y - i * 7, r = 2 + i;
    ellipse(cx, cy, r, r * 0.8, "w");
    ellipse(cx - 1, cy - 1, r - 1, (r - 1) * 0.8, "v");
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
// 抽水风车：铁架塔 + 多叶风轮 + 尾翼（中心 cx，轮心 hy）
function windpump(cx, hy, base) {
  const half = (y) => 2 + ((y - hy) * 8) / (base - hy);
  line(cx - 2, hy + 4, cx - 10, base, "x"); line(cx + 2, hy + 4, cx + 10, base, "x");
  for (let y = hy + 12; y + 12 <= base; y += 12) {
    line(cx - half(y), y, cx + half(y + 12), y + 12, "x"); line(cx + half(y), y, cx - half(y + 12), y + 12, "x");
    rect(Math.round(cx - half(y)), y, Math.round(half(y) * 2) + 1, 1, "x");
  }
  rect(cx, hy - 1, 15, 2, "x"); poly([[cx + 13, hy - 6], [cx + 21, hy - 5], [cx + 21, hy + 5], [cx + 13, hy + 2]], "w");
  for (let n = 0; n < 16; n++) { const a = (n / 16) * 6.283; line(cx + Math.cos(a) * 3, hy + Math.sin(a) * 3, cx + Math.cos(a) * 11, hy + Math.sin(a) * 11, n % 2 ? "w" : "v"); }
  for (let n = 0; n < 64; n++) { const a = (n / 64) * 6.283; px(cx + Math.cos(a) * 11, hy + Math.sin(a) * 11, "x"); }
  rect(cx - 1, hy - 1, 3, 3, "y");
}
// 红岩拱门：外椭圆减内椭圆；上沿/左沿受光，右侧和拱底背光，横向岩层
function arch(cx, base, rx, ry, ix, iy, s, c = { lit: "a", body: "f", dark: "g" }) {
  const inA = (x, y) => {
    const n = (hash(x >> 2, y >> 2, s) - 0.5) * 0.07;
    const o = ((x - cx) / rx) ** 2 + ((y - base) / ry) ** 2, i = ((x - cx) / ix) ** 2 + ((y - base) / iy) ** 2;
    return y < base && o < 1 + n && i > 1 - n;
  };
  for (let y = base - ry - 4; y < base; y++)
    for (let x = cx - rx - 4; x <= cx + rx + 4; x++) {
      if (!inA(x, y)) continue;
      let k = c.body;
      if (!inA(x, y - 1) || !inA(x - 1, y)) k = c.lit;
      else if (!inA(x, y + 3) || !inA(x + 3, y)) k = c.dark;
      else if ((base - y) % 7 === 0 && hash(x >> 2, y, s) < 0.6) k = c.dark;
      px(x, y, k);
    }
}
// 轨道：轨面 y，枕木在下面
function rails(x0, x1, y, top = "v", low = "x") {
  for (let x = x0; x < x1; x += 8) rect(x + 1, y + 2, 6, 2, "g");
  rect(x0, y, x1 - x0, 1, top); rect(x0, y + 1, x1 - x0, 1, low);
}
// 木栈桥：每 20px 一根立柱，X 形斜撑
function trestle(x0, x1, top, base) {
  for (let x = x0 + 2; x <= x1 - 4; x += 20) rect(x, top, 3, base - top, "f");
  for (let x = x0 + 2; x + 20 <= x1; x += 20)
    for (let y = top + 3; y < base; y += 16) { line(x + 2, y, x + 20, y + 16, "f"); line(x + 20, y, x + 2, y + 16, "f"); }
  rect(x0, top, x1 - x0, 3, "e"); rect(x0, top, x1 - x0, 1, "b");
}
// 矿车 32×16：铁皮、z 描边、铆钉；车轮压在 y+16 的轨面上
function minecart(x, y) {
  poly([[x, y + 2], [x + 32, y + 2], [x + 29, y + 14], [x + 3, y + 14]], "z");
  poly([[x + 1, y + 3], [x + 31, y + 3], [x + 28, y + 13], [x + 4, y + 13]], "w");
  rect(x, y + 1, 32, 3, "z"); rect(x + 1, y + 2, 30, 1, "v");
  rect(x + 4, y + 11, 24, 2, "x");
  for (const bx of [x + 11, x + 21]) rect(bx, y + 4, 1, 7, "x");
  for (const rx of [x + 6, x + 16, x + 26]) { px(rx, y + 5, "u"); px(rx, y + 9, "u"); }
  for (const wx of [x + 8, x + 24]) { ellipse(wx, y + 14, 2, 2, "z"); px(wx, y + 14, "v"); }
}
// 木框矿洞口：x,y = 横梁左上；w×h
function minePortal(x, y, w, h) {
  rect(x + 3, y + 6, w - 6, h - 6, "z");
  dith(x + 3, y + 6, w - 6, 4, "g", 0.5);
  rect(x - 2, y, w + 4, 6, "e"); rect(x - 2, y, w + 4, 1, "d"); rect(x - 2, y + 5, w + 4, 1, "f");
  for (const p of [x, x + w - 5]) { rect(p, y + 6, 5, h - 6, "e"); rect(p + 4, y + 6, 1, h - 6, "f"); rect(p, y + 6, 1, h - 6, "b"); }
  line(x + 5, y + 13, x + 11, y + 6, "f"); line(x + w - 6, y + 13, x + w - 12, y + 6, "f");
}
function lantern(x, y) { // 挂灯 5×7，暖色光晕只染暗处
  glow(x + 2, y + 4, 20, "b", 0.4, ["a"]);
  glow(x + 2, y + 4, 18, "a", 0.55, ["f", "g"]);
  glow(x + 2, y + 4, 14, "g", 0.5, ["z", "y"]);
  rect(x + 2, y - 4, 1, 4, "z");
  rect(x, y, 5, 7, "z"); rect(x + 1, y + 1, 3, 5, "j"); rect(x + 2, y + 2, 1, 3, "k");
}

// ---------- 方向 A：午后烈日下的木栈道主街（酒馆招牌、风车水塔、风滚草被风吹向火盆） ----------
function sceneA() {
  begin("r");
  sky([[0, "q"], [26, "r"], [112, "v"]], 8);
  mesa(178, 84, 36, 122, "F", "e", 1);
  mesa(262, 78, 52, 122, "F", "e", 2);
  mesa(-36, 92, 64, 122, "F", "e", 3);
  rect(0, 120, W, 40, "F");
  for (let j = 120; j < 160; j++) dith(0, j, W, 1, "e", (j - 118) / 70);
  for (let n = 0; n < 24; n++) { const sx = Math.round(hash(n, 7, 3) * W), sy = Math.round(124 + hash(n, 8, 3) * 30); rect(sx, sy, 3, 1, "f"); px(sx + 1, sy - 1, "f"); }
  windpump(196, 44, 159);
  waterTower(244, 66, 159);
  cactus(302, 160, 44, "o", "p", "n");
  saloon(12);
  boardwalk(0, 160, 144);
  tint(6, 144, 148, 3, { d: "e", b: "e" });
  rect(160, 152, 16, 8, "e"); rect(160, 152, 16, 1, "d"); rect(160, 155, 16, 1, "f"); rect(160, 159, 16, 1, "g");
  ground(0, 160, W, 20, { top: "c", body: "d", speck: "b", light: "c", dark: "e" }, 4);
  for (const [gx, gy, gl] of [[178, 146, 34], [186, 152, 30], [174, 157, 26]]) gust(gx, gy, gl, "u");
  tumbleweed(232, 151, 8, 6, ["f", "g", "e"]);
  brazier(262, 160);
  smoke(268, 134, 4);
  hero(102, 128);
  crate(124, 128);
  save(ID, "a");
}

// ---------- 方向 B：傍晚的红岩峡谷（拱门框住晚霞，矿洞口的轨道过栈桥，矿车载货） ----------
function sceneB() {
  begin("y");
  sky([[0, "y"], [34, "x"], [66, "B"], [100, "C"]], 10);
  for (let n = 0; n < 22; n++) px(hash(n, 1, 21) * W, hash(n, 2, 21) * 40, n % 3 ? "x" : "w");
  mesa(-20, 106, 50, 140, "B", "x", 1); mesa(118, 98, 40, 140, "B", "x", 2); mesa(196, 110, 36, 140, "B", "x", 3);
  rect(0, 136, W, 8, "B");
  cactus(186, 140, 26, "x", "y", "w");
  arch(86, 144, 72, 100, 42, 62, 4);
  rect(160, 144, 56, 36, "B");
  for (let j = 144; j < 180; j++) dith(160, j, 56, 1, "y", (j - 140) / 30);
  const rock = { top: "j", body: "a", speck: "f", light: "e", dark: "f", seam: "f" };
  ground(0, 144, 160, 36, rock, 11);
  ground(216, 144, 104, 36, rock, 12);
  rect(158, 145, 2, 35, "f"); rect(216, 145, 1, 35, "e");
  poly([[218, 144], [224, 92], [238, 70], [262, 60], [294, 56], [320, 52], [320, 144]], "a");
  for (let j = 60; j < 144; j += 6) for (let i = 218; i < W; i++) if (get(i, j) === "a" && hash(i >> 3, j, 31) < 0.55) px(i, j, "f");
  for (let j = 52; j < 144; j++) for (let i = 300; i < W; i++) if (get(i, j) === "a" && bayer(i, j) < (i - 296) / 30) px(i, j, "f");
  rim(216, 48, 104, 96, "af", "j");
  minePortal(250, 98, 44, 46);
  trestle(156, 220, 144, 180);
  rails(8, 290, 140);
  tint(253, 104, 38, 40, { v: "w", x: "y", g: "y" });
  rect(6, 130, 4, 14, "f"); rect(4, 130, 8, 3, "e"); rect(4, 130, 8, 1, "b");
  lantern(296, 106);
  for (const [gx, gy, gl] of [[2, 126, 24], [8, 132, 20]]) gust(gx, gy, gl, "v");
  tumbleweed(46, 136, 7, 9, ["F", "e", "b"]);
  crate(104, 112);
  minecart(96, 124);
  hero(76, 128);
  save(ID, "b");
}

sceneA();
sceneB();
