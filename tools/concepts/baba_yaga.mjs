// ART-04a 概念图：雅加婆婆的森林（baba_yaga）
// 运行：node tools/concepts/baba_yaga.mjs → 生成 art/concepts/baba_yaga/a.png、b.png
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

const ID = "baba_yaga";

// ---------- 森林的部件 ----------
function thick(x0, y0, x1, y1, r, k) { // 粗线：沿线画圆
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) ellipse(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, r, k);
}
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
// 尖头木栅栏 + 两道横杆
function fence(x0, x1, base, h) {
  rect(x0, base - h + 5, x1 - x0, 2, "f"); rect(x0, base - 7, x1 - x0, 2, "f");
  for (let x = x0; x < x1; x += 6) {
    const hh = h - Math.floor(hash(x, 0, 3) * 4);
    rect(x, base - hh + 1, 4, hh - 1, "e"); rect(x + 1, base - hh, 2, 1, "e");
    rect(x + 3, base - hh + 1, 1, hh - 1, "f"); rect(x, base - hh + 1, 1, hh - 2, "b");
  }
}
// 鸡腿：粗的羽毛大腿、向后弯的关节、带鳞的小腿、三趾朝前一趾朝后；lifted = 抬起的脚，脚趾收拢
const DAY_LEG = { thigh: "F", hi: "E", shank: "d", scale: "b" }, NIGHT_LEG = { thigh: "e", hi: "F", shank: "F", scale: "e" };
function chickenLeg(hx, hy, kx, ky, fx, fy, lifted = false, c = DAY_LEG) {
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
// 雕花木屋：x = 屋身左边，y = 屋身顶边（56×36）；front = 正面朝人（门开着），否则是背面
function hut(x, y, base, front, walk = false, glowIn = "j") {
  const legY = y + 38, low = base - 3;
  if (walk) { chickenLeg(x + 16, legY, x + 4, legY + 26, x + 14, low); chickenLeg(x + 42, legY, x + 34, legY + 16, x + 54, low - 18, true); }
  else { chickenLeg(x + 16, legY, x + 3, legY + 24, x + 13, low, false, NIGHT_LEG); chickenLeg(x + 42, legY, x + 29, legY + 24, x + 39, low, false, NIGHT_LEG); }
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
  if (front) {
    rect(x + 22, y + 6, 13, 30, "h"); rect(x + 24, y + 8, 9, 28, "z");
    glow(x + 28, y + 30, 10, glowIn, 0.7, ["z"]); rect(x + 24, y + 26, 9, 10, glowIn); dith(x + 24, y + 20, 9, 6, glowIn, 0.5);
    rect(x + 33, y + 9, 4, 27, "e"); rect(x + 36, y + 9, 1, 27, "f"); px(x + 34, y + 22, "z");
    for (let i = 0; i < 7; i++) { px(x + 23, y + 8 + i * 4, "c"); px(x + 34, y + 8 + i * 4, "c"); }
    for (const wx of [x + 5, x + 41]) { rect(wx - 2, y + 7, 14, 14, "h"); rect(wx, y + 9, 10, 10, "y"); rect(wx + 1, y + 10, 8, 8, "B"); rect(wx + 4, y + 9, 2, 10, "h"); px(wx + 4, y + 5, "h"); px(wx + 5, y + 4, "h"); px(wx + 6, y + 5, "h"); rect(wx - 2, y + 21, 14, 1, "c"); }
  } else {
    ellipse(x + 28, y + 14, 5, 5, "h"); ellipse(x + 28, y + 14, 3.5, 3.5, "y"); rect(x + 26, y + 12, 2, 2, "B");
    for (const [hx, n] of [[x + 10, 5], [x + 44, 4]]) for (let i = 0; i < n; i++) { line(hx + i * 2, y + 6, hx + i * 2 + (i % 2), y + 12 + (i % 3), "n"); px(hx + i * 2, y + 6, "f"); }
  }
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
// 火鸟：金红身体、羽冠、拖长的尾羽（尾端有眼斑）；朝左停着
function firebird(x, y) {
  for (let i = 0; i < 4; i++) {
    const ex = x + 12 + i * 5, ey = y + 12 + i * 3;
    for (let t = 0; t <= 1; t += 0.03) px(x + 3 + (ex - x - 3) * t, y + 1 + (ey - y - 1) * t * t, t < 0.4 ? "k" : t < 0.75 ? "j" : "i");
    ellipse(ex, ey, 1.5, 1.5, "i"); px(ex, ey, "l");
  }
  ellipse(x, y, 5, 3, "j"); ellipse(x - 1, y - 1, 3.5, 2, "k");
  ellipse(x - 5, y - 3, 2, 2, "k"); px(x - 6, y - 3, "z"); px(x - 8, y - 3, "j");
  line(x - 5, y - 5, x - 7, y - 8, "j"); line(x - 4, y - 5, x - 4, y - 9, "k"); px(x - 7, y - 9, "l"); px(x - 4, y - 10, "l");
  line(x - 1, y + 3, x - 1, y + 5, "g"); line(x + 2, y + 3, x + 2, y + 5, "g");
}
const CAT = [
  "z...z.....",
  "zz.zz.....",
  "zzzzz....z",
  "zmzmz....z",
  "zzzzzz..z.",
  ".zzzzzzzz.",
  ".zzzzzzzz.",
  ".z.z..z.z.",
];
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
function sparks(x0, y0, w, h, n, s) { // 火鸟落下的金红光点
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + hash(i, 1, s) * w), y = Math.round(y0 + hash(i, 2, s) * h), r = hash(i, 3, s);
    if (r > 0.45) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(x + dx, y + dy, r > 0.8 ? "j" : "i"); px(x, y, r > 0.8 ? "l" : "k"); }
    else { px(x, y, "k"); px(x + 1, y, "j"); }
  }
}

// ---------- 方向 A：傍晚的白桦林，鸡腿小屋背对着你（木栅栏、倒下的桦木当平台、套娃箱、火鸟光点） ----------
function sceneA() {
  begin("x");
  sky([[0, "x"], [30, "B"], [72, "C"], [110, "D"]], 10);
  spruceRow(120, 24, 48, 13, "B", 1);
  spruceRow(134, 28, 58, 17, "p", 2);
  for (const [bx, bw] of [[44, 3], [140, 3], [196, 4], [290, 3]]) birch(bx, bw, -10, 144, { bark: "w", shade: "x", mark: "y" }, bx);
  for (const [bx, bw] of [[6, 6], [96, 7], [178, 5], [300, 7]]) birch(bx, bw, -10, 144, { bark: "v", shade: "w", mark: "y" }, bx + 1);
  fence(0, 98, 144, 22);
  hut(212, 58, 144, false, true);
  thaw(144, { top: "c", body: "u", speck: "v", light: "t", dark: "w", rate: 0.02 }, ["v", "w"], [[100, 22], [270, 26]], [[186, 26, "x", "C"]], ["n", "m"], 5);
  for (const sx of [26, 70]) { rect(sx, 124, 8, 20, "u"); rect(sx + 6, 124, 2, 20, "v"); rect(sx, 124, 8, 1, "t"); for (let j = 127; j < 144; j += 4) rect(sx + 1 + (j % 3), j, 3, 1, "y"); }
  rect(16, 116, 72, 8, "u"); rect(16, 116, 72, 1, "t"); rect(16, 123, 72, 1, "v");
  for (let i = 20; i < 86; i += 5 + (i % 3)) rect(i, 118 + (i % 2) * 2, 3, 1, "y");
  ellipse(17, 119.5, 2, 3.5, "e"); px(17, 119, "d"); px(17, 120, "f");
  sparks(150, 20, 170, 100, 16, 3);
  nestBox(148, 128, 16); nestBox(167, 132, 12);
  hero(126, 128);
  save(ID, "a");
}

// ---------- 方向 B：夜里火鸟照亮院子（雕花木井、转过身开着门的小屋、黑猫、炸开后掉出小一号的套娃箱） ----------
function sceneB() {
  begin("z");
  sky([[0, "z"], [36, "y"], [100, "x"]], 12);
  for (let n = 0; n < 30; n++) px(hash(n, 1, 41) * W, hash(n, 2, 41) * 70, n % 4 ? "x" : "w");
  spruceRow(120, 28, 54, 14, "y", 3);
  spruceRow(136, 30, 62, 18, "p", 4);
  for (const [bx, bw] of [[30, 4], [184, 3], [300, 6]]) birch(bx, bw, -10, 144, { bark: "w", shade: "x", mark: "y" }, bx);
  hut(220, 70, 144, true, false, "j");
  well(116, 144);
  thaw(144, { top: "u", body: "v", speck: "w", light: "u", dark: "x", rate: 0.02 }, ["w", "x"], [[40, 24], [196, 18]], [[160, 24, "y", "w"]], ["o", "n"], 6);
  thick(-2, 72, 40, 60, 2.5, "f"); thick(36, 61, 76, 54, 1.5, "f"); line(-2, 70, 40, 58, "e"); line(22, 66, 30, 52, "f"); line(56, 57, 62, 46, "f"); line(62, 46, 68, 42, "f"); line(46, 59, 52, 68, "f");
  light(64, 50, 46, { z: "g", y: "g", x: "f", p: "o", w: "F", g: "f" }, 0.22);
  light(64, 50, 22, { g: "f", f: "a", x: "a", w: "F", o: "n" }, 0.4);
  firebird(64, 50);
  sparks(20, 30, 120, 80, 18, 7);
  shard(178, 124, 5, 3); shard(194, 120, 4, 4); shard(172, 136, 4, 3); shard(198, 134, 5, 3);
  for (const [dx, dy] of [[-3, -2], [3, -3], [-4, 2], [4, 2]]) line(188 + dx, 136 + dy, 188 + dx * 2, 136 + dy * 2, "u");
  nestBox(182, 132, 12);
  hero(92, 128);
  spr(243, 98, CAT);
  save(ID, "b");
}

sceneA();
sceneB();
