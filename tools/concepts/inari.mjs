// ART-04a 概念图：稻荷狐町（inari）
// 运行：node tools/concepts/inari.mjs → 生成 art/concepts/inari/a.png、b.png
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

const ID = "inari";

// ---------- 狐町的部件 ----------
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
// 石狐（朝右坐着，红围兜），站在 16×8 的石台上；base = 台座底边
const FOX = [
  "..........v..v..",
  "..........vv.vv.",
  ".........vvvvvv.",
  ".ww......vvzvvvv",
  "wvvw.....vvvvvx.",
  "wvvw......vvvv..",
  ".wvw.....hhhhh..",
  ".wvw....vhihhhv.",
  "..wvw..vvvhhhvv.",
  "..wvvvvvvvvvvvv.",
  "...wvvvvvvvvvvv.",
  "...wvvvvvvvvwvv.",
  "...wvvvvvvvvwvv.",
  "....wvvvvvvwwvv.",
  "....wwvvvvwwvvv.",
  "...wwwwwwwwwwwww",
];
function foxStatue(x, base, flip = false) {
  rect(x, base - 8, 16, 8, "w"); rect(x, base - 8, 16, 1, "u"); rect(x + 1, base - 7, 14, 1, "v"); rect(x, base - 1, 16, 1, "x");
  spr(x, base - 24, FOX, flip);
}
// 石灯笼 14×28；lit = 火袋里点着灯
function toro(x, base, lit = false) {
  if (lit) { glow(x + 7, base - 19, 15, "f", 0.4, ["x", "y", "p", "g", "B"]); glow(x + 7, base - 19, 9, "a", 0.35, ["f", "w", "o"]); }
  rect(x + 1, base - 4, 12, 4, "w"); rect(x + 1, base - 4, 12, 1, "u");
  rect(x + 5, base - 14, 4, 10, "v"); rect(x + 8, base - 14, 1, 10, "w");
  rect(x + 2, base - 16, 10, 2, "w"); rect(x + 2, base - 16, 10, 1, "u");
  rect(x + 3, base - 22, 8, 6, "v"); rect(x + 10, base - 22, 1, 6, "w");
  rect(x + 5, base - 21, 4, 4, lit ? "j" : "x"); if (lit) rect(x + 6, base - 20, 2, 2, "k");
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
function steam(x, y, w, n, s) { // 温泉白雾：越往上越淡、越散
  for (let i = 0; i < n; i++) {
    const cx = x + hash(i, 1, s) * w, up = hash(i, 2, s), cy = y - up * 46, r = 4 + up * 7;
    puff(cx, cy, r, up > 0.55 ? "v" : "u", 0.75 - up * 0.45);
  }
}
function rain(n, s, k = "u") { // 细雨：短斜线
  for (let i = 0; i < n; i++) { const x = hash(i, 1, s) * (W + 20), y = hash(i, 2, s) * H; line(x, y, x - 1, y + 3, k); }
}
// 温泉池：凹进地面，石头围边，热水，表面亮线
function onsen(x, y, w, d) {
  rect(x, y, w, d, "q"); rect(x, y, w, 2, "r"); rect(x + 2, y, w - 4, 1, "s");
  for (let i = x + 6; i < x + w - 6; i += 9) rect(i, y + 4 + (i % 3), 4, 1, "r");
  for (let i = x - 6; i <= x + w; i += 10) { const r = 4 + hash(i, 0, 5) * 2; ellipse(i + 3, y - 1, r, r * 0.65, "w"); ellipse(i + 2, y - 2, r - 1.5, (r - 1.5) * 0.6, "v"); px(i, y - 4, "u"); px(i + 1, y - 4, "u"); }
}
// 机关屋：深色木框、木格窗、瓦顶、檐下挂提灯；x,y = 墙左上，w 宽，base = 地面
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
function chochin(x, y) { // 提灯：纸面亮、上下红箍，带暖光
  glow(x + 3, y + 5, 12, "f", 0.4, ["x", "y", "g"]); glow(x + 3, y + 5, 8, "e", 0.35, ["f", "w"]);
  rect(x + 2, y - 3, 1, 3, "z");
  rect(x, y, 7, 2, "h"); rect(x, y + 8, 7, 2, "h");
  ellipse(x + 3, y + 5, 3.5, 3, "c"); rect(x + 1, y + 4, 5, 1, "d"); rect(x + 1, y + 6, 5, 1, "d");
}
// 翻转墙：一块木格墙板（16×40）绕中间竖轴转半圈，上下画转动弧线
function rotatingWall(x, base) {
  const y = base - 40, cx = x + 8;
  rect(x, y, 16, 40, "z"); rect(x + 1, y + 1, 14, 38, "f");
  for (let i = x + 3; i < x + 14; i += 3) rect(i, y + 2, 1, 36, "e");
  for (const j of [y + 10, y + 20, y + 30]) rect(x + 1, j, 14, 1, "e");
  rect(x + 1, y + 1, 14, 1, "b"); rect(x + 1, y + 1, 1, 38, "b");
  rect(cx - 1, y - 4, 2, 4, "x"); rect(cx - 1, base, 2, 1, "x");
  for (const ay of [y - 2, y + 20]) for (let a = 0; a < 360; a += 12) {
    const t = (a * Math.PI) / 180, ex = cx + Math.cos(t) * 13, ey = ay + Math.sin(t) * 3;
    if (Math.sin(t) > -0.2 || ay > y) px(ex, ey, a % 24 ? "u" : "t");
  }
  for (const [dx, dy] of [[13, 0], [12, -1], [12, 1]]) { px(cx + dx, y - 2 + dy, "t"); px(cx - dx, y + 20 - dy, "t"); }
}
const KIT = [ // 小狐狸（提示动物）10×8，朝左坐着
  ".b.b......",
  ".bbb......",
  "zbbb.....c",
  "bbcb....bc",
  ".bcbb..bb.",
  "..bbbbbb..",
  "..bcbbbb..",
  "..b.b.b...",
];

// ---------- 方向 A：太阳雨里的石阶山道（一排朱红鸟居、石狐和石灯笼、山脚小温泉、冰块） ----------
function sceneA() {
  begin("r");
  sky([[0, "w"], [10, "v"], [30, "r"]], 8);
  for (let x = -10; x < W + 10; x += 13) { const r = 5 + hash(x, 0, 3) * 5; ellipse(x, 24 + hash(x, 1, 3) * 5, r * 1.3, r * 0.8, "v"); }
  for (const [cx, cy, r] of [[150, 52, 7], [164, 50, 9], [178, 54, 6], [258, 62, 6], [270, 60, 8]]) ellipse(cx, cy, r * 1.3, r * 0.7, "v");
  for (let y = 20; y < 72; y++) for (let x = 0; x < W; x++) if (get(x, y) === "v" && get(x, y + 1) === "r") { px(x, y, "w"); if (bayer(x, y - 1) < 0.5) px(x, y - 1, "w"); }
  hills(118, 46, 70, "w", 2); for (let j = 92; j < 130; j++) dith(0, j, W, 1, "v", (j - 92) / 60);
  hills(132, 40, 50, "o", 3);
  for (let i = 0; i < 26; i++) { const tx = Math.round(hash(i, 1, 9) * W); spruceLike(tx, 118 + Math.round(hash(i, 2, 9) * 16), 16 + Math.round(hash(i, 3, 9) * 12)); }
  for (let j = 124; j < 144; j++) dith(0, j, W, 1, "v", ((j - 124) / 20) * 0.35);
  for (let i = 0; i < 6; i++) torii(98 + i * 32, 144 - 8 * (i + 1) - 50, 28, 50);
  torii(4, 74, 50, 70);
  ground(0, 144, 96, 36, STONE, 3);
  for (let i = 0; i < 6; i++) ground(96 + i * 32, 136 - 8 * i, 32, 44 + 8 * i, STONE, 10 + i);
  ground(288, 88, 32, 92, STONE, 20);
  for (let i = 0; i < 7; i++) { const sx = 96 + i * 32, sy = 136 - 8 * i; for (let k = 0; k < 9; k++) { const mx = sx + Math.floor(hash(k, i, 4) * 30); px(mx, sy, "m"); px(mx + 1, sy, "n"); px(mx, sy + 1, "n"); } }
  deepen(150, "v", "w", 0.55);
  onsen(10, 145, 46, 10);
  steam(10, 140, 46, 7, 2);
  toro(60, 144);
  foxStatue(78, 144);
  foxStatue(298, 88, true);
  iceBlock(100, 120);
  hero(136, 112);
  rain(110, 7);
  save(ID, "a");
}
function spruceLike(cx, base, h) { // 杉树剪影
  for (let y = base - h; y < base; y++) { const d = y - (base - h), hw = Math.round(d * 0.28 * (0.6 + 0.4 * ((d % 5) / 5))); rect(cx - hw, y, hw * 2 + 1, 1, "p"); }
}

// ---------- 方向 B：傍晚的温泉街（白雾温泉、正在化的冰块、转到一半的翻转墙、机关屋和提灯） ----------
function sceneB() {
  begin("y");
  sky([[0, "y"], [30, "x"], [70, "B"], [104, "C"]], 10);
  hills(116, 40, 60, "x", 5); for (let j = 96; j < 128; j++) dith(0, j, W, 1, "w", ((j - 96) / 32) * 0.5);
  hills(134, 34, 44, "p", 6);
  torii(26, 54, 84, 90);
  ninjaHouse(184, 92, 136, 144);
  for (const lx of [196, 244, 292]) chochin(lx, 98);
  ground(0, 144, W, 36, STONE, 8);
  deepen(150, "v", "w", 0.6);
  onsen(22, 145, 88, 14);
  iceBlock(52, 139, 14, true);
  tint(52, 147, 14, 8, { s: "r", t: "s", u: "r", r: "q", z: "q" });
  for (const [rx, rw] of [[46, 4], [68, 5], [50, 3]]) rect(rx, 150 + (rx % 3), rw, 1, "s");
  steam(22, 140, 88, 12, 4);
  toro(114, 144, true);
  toro(4, 144, true);
  rotatingWall(156, 144);
  crate(176, 128);
  hero(138, 128);
  spr(300, 128, KIT);
  save(ID, "b");
}

sceneA();
sceneB();
