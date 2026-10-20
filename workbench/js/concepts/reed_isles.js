/* ART-04m 地图概念场景：芦苇浮岛（reed_isles）。
 * 只在工作台「地图概念 › 芦苇浮岛」页播放，看大致效果；不是游戏资产，不走美术确认。
 * 接口：PB_CONCEPT_SCENES.reed_isles.draw(ctx, tick)，ctx 是 320×180 画布的 2D 上下文，tick 每秒 +8。
 * 只用 ENDESGA 32 调色板码（PB.Raster），整数像素；环境 4 fps（tick >> 1），动物 8 fps（tick）。
 * 地标：一层层的芦苇浮岛、芦苇瞭望塔、兽头芦苇船、远处的雪山。机关外观：下垂的芦苇吊桥、空浮块和被铁箱压到齐水的浮块。
 * 环境：脚下芦苇地一压，水从缝里渗上来又退下；湖风一阵阵吹过，芦苇一片片伏倒、湖面起皱；芦苇船轻轻碰岛边。
 * 怪物：湖蛙（从水里扑上岛）；提示动物：安第斯鸥（停在下一块浮岛的芦苇尖上）。 */
(function () {
  "use strict";
  const PB = window.PB;
  const W = 320, H = 180, G = 138, WL = 148, HZ = 90; // G：岛 A 顶面（脚底）；WL：水线；HZ：湖的远岸
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const DIM = PB.DIM;

  // ---------- 小工具（整数像素） ----------
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) * (1 - k));
  const lerp = (a, b, k) => a + (b - a) * k;
  function get(r, x, y) { return x >= 0 && y >= 0 && x < r.w && y < r.h ? r.get(x, y) : "."; }
  function paint(c, x, y) { return typeof c === "function" ? c(x, y) : c; }
  function put(r, x, y, c) { const k = paint(c, x, y); if (k) r.set(x, y, k); }
  function line(r, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(r, x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function ellipse(r, cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.5);
      for (let x = -hw; x <= hw; x++) put(r, cx + x, cy + y, c);
    }
  }
  function poly(r, pts, c) { // 扫描线填充（奇偶规则）
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(r.h - 1, Math.ceil(y1)); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(r, x, y, c);
    }
  }
  function outline(r, x0, y0, w, h, code) { // 给小精灵描 1px 边
    const add = [];
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
      if (get(r, x, y) !== ".") continue;
      if (get(r, x - 1, y) !== "." || get(r, x + 1, y) !== "." || get(r, x, y - 1) !== "." || get(r, x, y + 1) !== ".") add.push([x, y]);
    }
    for (const [x, y] of add) r.set(x, y, code);
  }
  function blitFlip(r, s, x, y, flip) {
    for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) {
      const c = s.get(xx, yy);
      if (c !== ".") r.set(x + (flip ? s.w - 1 - xx : xx), y + yy, c);
    }
  }
  function actor(r, id, anim, x, y, flip) { // 已确认的主角 / 箱子精灵，只当比例尺
    if (PB.sprites && PB.sprites.has(id)) { PB.sprites.draw(r, id, anim, 0, x, y, !!flip); return; }
    r.rect(x - 6, y - 16, 12, 16, "z"); r.rect(x - 5, y - 15, 10, 14, id === "char.portitor" ? "i" : "d");
  }
  const SUNK = { c: "w", d: "x", F: "x", e: "y", f: "y", g: "y", t: "u", n: "p", o: "p", m: "o", u: "w", v: "x", w: "x", x: "y", k: "x" }; // 水下：透过墨蓝的湖水看

  // ---------- 天空、雪山、湖（缓存在 back） ----------
  function sky(r) { // 高原的天：顶上深蓝，往下透亮
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      const b = bayer(x, y);
      r.set(x, y, y < 36 ? "q" : y < 40 ? (b < (y - 35) * 3 ? "r" : "q") : "r");
    }
  }
  const PEAKS = [[-6, 44, 0.9], [34, 30, 0.75], [78, 47, 0.95], [122, 22, 0.7], [170, 41, 0.85], [214, 28, 0.7], [262, 45, 0.9], [300, 33, 0.8], [344, 40, 0.8]];
  function mountains(r) { // 空气很透：雪线、山脊都是硬边，左面受光
    for (let x = 0; x < W; x++) {
      let top = 999, pk = null;
      for (const p of PEAKS) {
        const y = p[1] + Math.abs(x - p[0]) * p[2] + (PB.h32(x >> 1, p[0] & 7, 70) % 3);
        if (y < top) { top = y; pk = p; }
      }
      const lit = x < pk[0] || (x === pk[0] && PB.h32(x, 1, 71) & 1);
      const snow = pk[1] + 13 + (PB.h32(x >> 1, 2, 72) % 5) + Math.round(Math.abs(x - pk[0]) * 0.25);
      for (let y = Math.max(0, Math.round(top)); y < HZ; y++) {
        let c = y < snow ? (lit ? "t" : "u") : lit ? "v" : "w";
        if (y >= snow && y < snow + 9 && lit && (x + (y >> 1)) % 7 === 0) c = "u"; // 雪沟
        r.set(x, y, c);
      }
    }
    for (let x = 0; x < W; x++) { // 近一点的山脚：深色，再往下是一条枯黄的远岸
      const hy = 76 + Math.round(4 * Math.sin(x * 0.045) + 2 * Math.sin(x * 0.13 + 1));
      for (let y = hy; y < HZ; y++) r.set(x, y, y < hy + 2 && Math.sin(x * 0.045) > 0 ? "w" : "x");
      const sy = 85 + Math.round(1.5 * Math.sin(x * 0.07 + 2));
      for (let y = sy; y < HZ; y++) r.set(x, y, y === sy ? "F" : "e");
    }
  }
  function lake(r) { // 高原湖：远处反着天光，近处墨蓝
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const b = bayer(x, y);
      r.set(x, y, y < HZ + 2 ? "r" : y < HZ + 7 ? (b < (HZ + 7 - y) * 3 ? "r" : "q") : y < 150 ? "q" : b < (y - 150) >> 1 ? "y" : "q");
    }
  }
  // 芦苇岛：顶上是新铺的干芦苇，侧面一捆捆叠起来，水下部分透着湖水
  function isle(r, x0, x1, top, wl, deep) {
    for (let x = x0; x < x1; x++) {
      const end = Math.min(x - x0, x1 - 1 - x), t = top + (end < 3 ? 3 - end : 0);
      for (let y = t; y < wl + deep; y++) {
        const d = y - t, row = Math.floor((y - top) / 4), bx = (x + row * 3) % 6;
        let c = d === 0 ? "c" : d === 1 ? (PB.h32(x, y, 81) % 4 ? "d" : "c") : bx === 0 ? "e" : (y - top) % 4 === 0 ? "F" : (y - top) % 4 === 3 ? "e" : "d";
        if (end < 2 && d > 1) c = "F";
        if (y >= wl) { c = SUNK[c] || "y"; if (bayer(x, y) < (y - wl) * 2) c = "q"; }
        r.set(x, y, c);
      }
    }
    for (let i = 0; i < (x1 - x0) / 5; i++) { // 顶面散着的芦苇杆
      const h = PB.h32(x0 + i, top, 82), x = x0 + 3 + (h % (x1 - x0 - 8)), len = 3 + ((h >>> 8) % 4);
      line(r, x, top, x + len, top - ((h >>> 12) & 1), (h >>> 14) & 1 ? "c" : "F");
    }
  }
  function hut(r, cx, base) { // 中景小岛上的芦苇屋（拱顶）
    for (let y = base - 12; y < base; y++) for (let x = cx - 8; x <= cx + 8; x++) {
      const dy = base - 1 - y, hw = Math.round(8 * Math.sqrt(Math.max(0, 1 - (dy * dy) / 144)));
      if (Math.abs(x - cx) > hw) continue;
      r.set(x, y, x - cx < -hw + 2 ? "d" : x - cx > hw - 3 ? "e" : (x + y) % 3 === 0 ? "e" : "F");
    }
    r.rect(cx - 2, base - 6, 4, 6, "g"); r.rect(cx - 1, base - 7, 2, 1, "g");
  }
  const MID = [[70, 150, 112, 118], [244, 306, 108, 113]];
  function buildBack() {
    const r = new PB.Raster(W, H);
    sky(r); mountains(r); lake(r);
    for (const [x0, x1, y] of [[18, 54, 97], [176, 204, 96], [286, 318, 99]]) { r.rect(x0, y, x1 - x0, 1, "F"); r.rect(x0 + 1, y + 1, x1 - x0 - 2, 1, "e"); r.rect(x0 + 2, y + 2, x1 - x0 - 4, 1, "y"); } // 更远的岛
    const mid = new PB.Raster(W, H); // 中景小岛先画在一张透明图上，整体压暗一级再贴上去（不碰湖面）
    for (const [x0, x1, top, wl] of MID) isle(mid, x0, x1, top, wl, 4);
    hut(mid, 100, 112); hut(mid, 274, 108);
    mid.remap(0, 0, W, H, { c: "d", d: "F", F: "e", e: "f", f: "g", g: "g", x: "y", w: "x", u: "w", q: "y", y: "y" });
    r.blit(mid, 0, 0);
    return r;
  }

  // ---------- 前景：岛、塔、浮块、比例尺（缓存在 front） ----------
  function tower(r) { // 芦苇瞭望塔：两条捆扎的腿，上面一层瞭望台，顶上一个尖草顶
    const cx = TOWER_X;
    const leg = (xb, xt, shade) => {
      for (let y = 74; y < G; y++) {
        const x = Math.round(lerp(xt, xb, (y - 74) / (G - 74)));
        r.set(x - 1, y, shade ? "F" : "c"); r.set(x, y, shade ? "e" : "d"); r.set(x + 1, y, shade ? "f" : "F");
        if (y % 9 === 0) { r.set(x - 1, y, "f"); r.set(x, y, "f"); r.set(x + 1, y, "g"); }
      }
    };
    for (let y = 82; y < G - 2; y += 7) { // 梯档
      const xl = Math.round(lerp(cx - 4, cx - 12, (y - 74) / (G - 74))), xr = Math.round(lerp(cx + 4, cx + 12, (y - 74) / (G - 74)));
      line(r, xl + 1, y, xr - 1, y, "e");
    }
    line(r, cx - 9, 104, cx + 7, 124, "e"); line(r, cx + 9, 104, cx - 7, 124, "f");
    leg(cx - 12, cx - 4, false); leg(cx + 12, cx + 4, true);
    r.rect(cx - 12, 72, 25, 2, "d"); r.rect(cx - 12, 72, 25, 1, "c"); r.rect(cx - 12, 74, 25, 1, "e"); // 瞭望台
    for (const x of [cx - 12, cx + 12]) line(r, x, 64, x, 71, x < cx ? "d" : "e");
    line(r, cx - 12, 66, cx + 12, 66, "F");
    poly(r, [[cx - 15, 64], [cx + 16, 64], [cx, 46]], (x, y) => (y >= 63 ? "e" : x < cx - (y - 46) * 0.15 ? ((x + y) % 4 === 0 ? "F" : "d") : (x + y) % 4 === 0 ? "f" : "F"));
    line(r, cx, 46, cx, 43, "e");
  }
  const TOWER_X = 24, A = [-4, 124], B = [190, 258, 136], F2 = [290, 314];
  function buildFront() {
    const r = new PB.Raster(W, H);
    tower(r);
    isle(r, A[0], A[1], G, WL, 8);
    isle(r, B[0], B[1], B[2], WL, 8);
    isle(r, F2[0], F2[1], WL - 1, WL, 6); // 被铁箱压到齐水的浮块
    for (const [x, y] of [[121, G], [193, B[2]]]) { r.rect(x - 1, y - 11, 3, 12, "F"); r.rect(x - 1, y - 11, 1, 12, "d"); r.rect(x + 1, y - 11, 1, 12, "e"); r.rect(x - 1, y - 12, 3, 1, "c"); } // 吊桥两头的柱子
    for (let x = 49; x <= 63; x++) r.set(x, G, x < 51 || x > 61 ? "d" : "F"); // 主角脚下压下去一点
    for (let x = 71; x <= 89; x++) r.set(x, G, x < 73 || x > 87 ? "d" : "F");
    actor(r, "char.portitor", "idle", 56, G);
    actor(r, "obj.crate_wood", "default", 80, G);
    actor(r, "obj.crate_iron", "default", 302, WL - 1);
    return r;
  }

  // ---------- 会动的环境（4 fps） ----------
  const GUST = 44; // 一阵风：44 个环境帧从左吹到右
  function wind(x, e) { // 某处芦苇此刻被风压弯多少像素（0..4）
    const front = ((e % GUST) / GUST) * 420 - 50, d = front - x;
    return d < 0 || d > 70 ? 0 : d < 14 ? Math.round((d / 14) * 4) : Math.round(4 - ((d - 14) / 56) * 4);
  }
  let waterMask = null;
  function lakeLife(r, e) { // 湖面：硬硬的正午闪光、细波纹，风过处湖面起皱发暗
    const front = ((e % GUST) / GUST) * 420 - 50;
    for (let i = 0; i < 150; i++) {
      const h = PB.h32(i, 9, 90), y = HZ + 3 + Math.floor(Math.pow((h % 1000) / 1000, 1.6) * (H - HZ - 4)), len = 2 + Math.floor((y - HZ) / 22) + ((h >>> 12) % 3);
      const x = ((h >>> 3) % (W + 20)) - 10 + ((e * (1 + (i & 1))) >> 2) % 6;
      const gust = x < front && x > front - 70, c = gust ? "y" : (h >>> 20) % 3 ? "r" : "y";
      for (let k = 0; k < len; k++) if (waterMask[y * W + x + k]) r.set(x + k, y, c);
    }
    for (let i = 0; i < 46; i++) { // 闪光：一闪就灭
      const h = PB.h32(i, 4, 91), x = h % W, y = HZ + 4 + ((h >>> 9) % (H - HZ - 6)), on = (e + (h >>> 20)) % 7;
      if (on > 1 || !waterMask[y * W + x]) continue;
      r.set(x, y, "t");
      if (on === 0 && (h >>> 25) % 3 === 0) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) if (waterMask[(y + dy) * W + x + dx]) r.set(x + dx, y + dy, "s"); }
    }
  }
  // 兽头芦苇船：两头翘，船头是一只美洲狮头；停在中景小岛边，被浪推着轻轻碰岸
  const BOAT = (() => {
    const s = new PB.Raster(48, 20);
    for (let x = 4; x < 44; x++) { // 船身：两捆芦苇
      const k = (x - 4) / 40, lift = Math.round(5 * Math.pow(Math.abs(k - 0.5) * 2, 3)), y0 = 13 - lift;
      for (let y = y0; y < y0 + 5; y++) s.set(x, y, y === y0 ? "c" : y === y0 + 4 ? "e" : (x + (y - y0) * 2) % 5 === 0 ? "e" : y < y0 + 2 ? "d" : "F");
    }
    for (let y = 5; y < 12; y++) { s.set(43 + ((12 - y) >> 2), y, "F"); s.set(44 + ((12 - y) >> 2), y, "e"); } // 船尾翘起
    ellipse(s, 5, 6, 4, 3, (x, y) => (y <= 4 ? "d" : "F")); // 狮头
    for (const [x, y, c] of [[3, 2, "d"], [4, 2, "F"], [7, 2, "d"], [8, 2, "F"], [1, 7, "F"], [0, 7, "e"], [2, 5, "z"], [3, 5, "c"], [1, 8, "e"], [2, 8, "e"]]) s.set(x, y, c);
    line(s, 6, 9, 8, 12, "F");
    for (let x = 12; x < 36; x += 6) s.set(x, 12, "f"); // 捆绳
    return s;
  })();
  function boat(r, e) {
    const ph = e % 24, off = Math.round(1.5 - 1.5 * Math.cos((ph / 24) * 2 * Math.PI)), bob = tri(e + 5, 16, 1);
    const x = 151 + off, wl = MID[0][3];
    for (let yy = 0; yy < BOAT.h; yy++) for (let xx = 0; xx < BOAT.w; xx++) { // 吃水线以下透着水
      let c = BOAT.get(xx, yy);
      if (c === ".") continue;
      const y = wl - 15 + yy + bob;
      if (y >= wl) c = SUNK[c] || "y";
      r.set(x + xx, y, DIM[c] && y < wl ? c : c);
    }
    for (let k = 0; k < 40; k += 3) r.set(x + 4 + k, wl + 1, "y"); // 船下的影子
    if (off === 0) { r.set(x - 1, wl - 1, "t"); r.set(x - 2, wl - 2, "s"); r.set(x + 1, wl - 2, "t"); } // 碰岸溅起一点水花
  }
  function waterline(r, e) { // 岛边和浮块边的水一拍一拍
    for (let x = 0; x < W; x++) {
      if (waterMask[WL * W + x]) continue;
      if ((x + e) % 5 === 0) r.set(x, WL, "r"); else if ((x + e) % 5 === 2) r.set(x, WL, "s");
    }
    for (let x = F2[0] - 2; x <= F2[1] + 1; x++) if ((x * 3 + e) % 7 < 2) r.set(x, WL - 1, (x + e) & 1 ? "s" : "r"); // 水漫过浮块的边
  }
  function seep(r, e) { // 主角和木箱脚下：芦苇被压下去，水从缝里渗上来又退下
    const lvl = [0, 1, 2, 3, 4, 5, 5, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0][e % 20];
    for (const [x0, x1] of [[48, 64], [70, 90]]) for (let x = x0; x <= x1; x++) for (let y = G; y <= G + 1; y++) {
      const mid = Math.abs(x - (x0 + x1) / 2) / ((x1 - x0) / 2), h = PB.h32(x, y, 92) % 6;
      if (h < lvl - mid * 4 - (y - G)) r.set(x, y, h === 0 ? "s" : y === G ? "r" : "q");
    }
  }
  function bridge(r, e) { // 下垂的芦苇吊桥：两根绳、吊索，桥面一小捆一小捆；风吹时轻轻晃
    const x0 = 122, y0 = G - 11, x1 = 192, y1 = B[2] - 11, sway = wind(157, e) > 1 ? 1 : 0;
    const at = (x, sag) => lerp(y0, y1, (x - x0) / (x1 - x0)) + sag * (1 - Math.pow(((x - x0) / (x1 - x0)) * 2 - 1, 2));
    for (let x = x0; x <= x1; x++) {
      const ry = Math.round(at(x, 6 + sway)), dy = Math.round(at(x, 9 + sway)) + 9;
      r.set(x, ry, "f");
      if ((x - x0) % 6 === 3) line(r, x, ry + 1, x, dy - 1, "f");
      r.set(x, dy, (x - x0) % 3 === 0 ? "e" : "d"); r.set(x, dy + 1, (x - x0) % 3 === 0 ? "f" : "F");
      if (waterMask[(WL + 1) * W + x]) r.set(x, WL + 1, "y"); // 正午的硬影子：直直落在桥下的水面上
      if ((x - x0) % 3 === 1) r.set(x, dy - 1, "c");
    }
  }
  function floatF1(r, e) { // 空浮块：浮得高，轻轻上下
    const bob = tri(e, 12, 1), top = WL - 4 + bob, x0 = 264, x1 = 282;
    for (let x = x0; x < x1; x++) for (let y = top; y < top + 7; y++) {
      const end = Math.min(x - x0, x1 - 1 - x);
      if (end === 0 && (y === top || y === top + 6)) continue;
      let c = y === top ? "c" : (x + y) % 6 === 0 ? "e" : y === top + 1 ? "d" : "F";
      if (y >= WL) c = SUNK[c] || "y";
      r.set(x, y, c);
    }
  }
  // 芦苇（托托拉，嫩绿，顶上褐色的穗）：一丛丛长在岛边，风来一片片伏倒
  const REEDS = [];
  for (const [x0, x1, base, hmin, hmax, far] of [[0, 12, G, 14, 26, 0], [98, 116, G, 12, 24, 0], [194, 206, B[2], 10, 20, 0], [222, 254, B[2], 18, 42, 0],
    [72, 84, 112, 8, 14, 1], [136, 148, 112, 7, 12, 1], [246, 256, 108, 8, 13, 1], [296, 306, 108, 6, 11, 1]]) {
    for (let x = x0; x <= x1;) {
      const h = PB.h32(x, base, 93), hh = hmin + ((h >>> 3) % (hmax - hmin + 1));
      REEDS.push([x, base, hh, far, (h >>> 9) % 3, ((h >>> 12) % 5) - 2]);
      x += 1 + ((h >>> 16) % 3);
    }
  }
  const GULL_REED = REEDS.reduce((a, b) => (b[3] === 0 && b[2] > a[2] ? b : a), REEDS[0]);
  function reeds(r, e, far) {
    for (const rd of REEDS) {
      const [x, base, h, f, tone, tilt] = rd;
      if (f !== far) continue;
      const lean = wind(x, e) * (h > 20 ? 2 : 1) * (f ? 0.5 : 1) + (rd === GULL_REED ? 0 : tilt);
      for (let k = 0; k <= h; k++) { // 越往上弯得越多，弯狠了穗头往下沉
        const q = k / h, px = Math.round(x + lean * q * q), py = base - k + Math.round(((lean * lean) / h) * q * q * q);
        r.set(px, py, f ? (k < h - 2 ? "o" : "f") : k >= h - 2 ? (tone === 0 ? "f" : "e") : tone === 2 ? "n" : (px + k) % 9 === 0 ? "n" : "m");
      }
      rd.tip = [Math.round(x + lean), base - h + Math.round((lean * lean) / h)];
    }
  }

  // ---------- 动物（8 fps） ----------
  // 湖蛙（怪物）：皮松松的大水蛙，橄榄绿带黑斑，金眼；从桥下的水里扑上岛 A 的边
  function frogSprite(kind) {
    const s = new PB.Raster(26, 14);
    if (kind === "eyes") {
      for (const ex of [6, 12]) { ellipse(s, ex, 10, 2, 2, (x, y) => (y <= 9 ? "n" : "o")); }
      outline(s, 0, 0, 26, 14, "z");
      for (const ex of [6, 12]) { s.set(ex - 1, 9, "k"); s.set(ex, 9, "z"); }
      for (let x = 2; x < 17; x++) s.set(x, 12, x % 3 ? "r" : "t");
      return s;
    }
    if (kind === "leap") {
      line(s, 13, 7, 18, 9, "o"); line(s, 18, 9, 23, 8, "o"); line(s, 23, 7, 24, 9, "o"); // 两条蹬直的后腿，带蹼
      line(s, 13, 8, 19, 11, "o"); line(s, 19, 11, 24, 12, "o"); line(s, 24, 11, 25, 13, "o");
      ellipse(s, 10, 6, 6, 3, (x, y) => (y <= 4 ? "n" : y >= 8 ? "F" : "o"));
      ellipse(s, 4, 6, 3, 2, (x, y) => (y <= 5 ? "n" : "F"));
      ellipse(s, 5, 3, 1, 1, "n");
      line(s, 5, 8, 2, 11, "o"); line(s, 8, 9, 6, 12, "o"); // 前爪往前伸
      outline(s, 0, 0, 26, 14, "z");
      s.set(5, 3, "k"); s.set(4, 3, "z"); line(s, 1, 7, 5, 7, "z");
      for (const [x, y] of [[10, 4], [13, 5], [8, 6]]) s.set(x, y, "p");
      return s;
    }
    ellipse(s, 17, 9, 5, 3, "o"); // 后腿
    ellipse(s, 12, 8, 8, 4, (x, y) => (y <= 5 ? "n" : y >= 11 ? "F" : "o"));
    ellipse(s, 6, 8, 5, 3, (x, y) => (y <= 6 ? "n" : y >= 10 ? "F" : "o"));
    ellipse(s, 5, 4, 2, 2, "n"); ellipse(s, 10, 4, 2, 2, "n");
    line(s, 4, 11, 2, 12, "o"); line(s, 9, 12, 8, 13, "o"); line(s, 20, 12, 23, 12, "o");
    if (kind === "puff") ellipse(s, 4, 11, 3, 2, "E");
    outline(s, 0, 0, 26, 14, "z");
    for (const [x, y] of [[13, 6], [16, 7], [10, 7], [19, 9], [14, 9]]) s.set(x, y, "p");
    s.set(5, 3, "k"); s.set(4, 3, "z"); s.set(10, 3, "k"); s.set(9, 3, "z");
    line(s, 1, 9, 7, 10, "z");
    return s;
  }
  const FROG = { eyes: frogSprite("eyes"), leap: frogSprite("leap"), sit: frogSprite("sit"), puff: frogSprite("puff") };
  const FROG_P = 208; // 一轮 208 tick（26 秒）
  function splash(r, x, y, k) { // 扑通：水花往上溅再落下
    const pts = [[[0, -2], [-2, -1], [2, -1]], [[0, -4], [-3, -3], [3, -3], [-1, -2], [1, -2]], [[-4, -2], [4, -2], [-2, -3], [2, -3]], [[-5, 0], [5, 0], [-3, -1], [3, -1]]][k];
    for (const [dx, dy] of pts) r.set(x + dx, y + dy, k < 2 ? "t" : "s");
    if (k >= 1) for (let dx = -6 + k; dx <= 6 - k; dx += 2) r.set(x + dx, y + 1, "s");
  }
  function frog(r, t) {
    const T = t % FROG_P, land = [104, G], dive = [158, WL];
    if (T < 40) { if ((T >> 3) % 3 === 0) for (const dx of [-3, 0, 3]) r.set(dive[0] + dx, WL + 1, "r"); return; }
    if (T < 64) { blitFlip(r, FROG.eyes, Math.round(lerp(172, dive[0], (T - 40) / 24)) - 9, WL - 12, false); return; }
    if (T < 72) {
      const k = (T - 64) / 8, x = lerp(dive[0], land[0], k), y = lerp(WL, G, k) - Math.sin(k * Math.PI) * 18;
      blitFlip(r, FROG.leap, Math.round(x) - 12, Math.round(y) - 11, false);
      if (T < 68) splash(r, dive[0], WL, T - 64);
      return;
    }
    if (T < 140) { blitFlip(r, (T >> 2) % 4 === 3 ? FROG.puff : FROG.sit, land[0] - 12, G - 14, false); return; }
    if (T < 148) {
      const k = (T - 140) / 8, x = lerp(land[0], dive[0], k), y = lerp(G, WL, k) - Math.sin(k * Math.PI) * 14;
      blitFlip(r, FROG.leap, Math.round(x) - 12, Math.round(y) - 11, true);
      return;
    }
    if (T < 156) splash(r, dive[0], WL, (T - 148) >> 1);
  }
  // 安第斯鸥（提示动物）：白身子、深褐的头、灰翅黑翅尖、红嘴红脚；停在岛 B 最高那根芦苇尖上
  function gullSprite(kind) {
    const s = new PB.Raster(17, 13);
    line(s, 10, 7, 14, 6, "u"); line(s, 11, 8, 14, 7, "u"); // 尾
    ellipse(s, 8, 7, 4, 3, (x, y) => (y >= 9 ? "u" : "t"));
    if (kind === "wings") { poly(s, [[6, 6], [12, 6], [15, 1], [9, 3]], "v"); line(s, 13, 2, 15, 1, "z"); line(s, 7, 5, 4, 1, "v"); s.set(3, 1, "z"); }
    else { line(s, 6, 6, 13, 6, "v"); line(s, 8, 5, 12, 5, "v"); line(s, 13, 6, 15, 6, "z"); }
    const hx = kind === "look" ? 5 : 4;
    ellipse(s, hx, 4, 2, 2, "g");
    if (kind === "look") { s.set(hx + 3, 4, "h"); s.set(hx + 4, 4, "h"); } else { s.set(hx - 3, 4, "h"); s.set(hx - 4, 4, "h"); }
    s.set(7, 10, "h"); s.set(9, 10, "h"); s.set(7, 11, "h"); s.set(9, 11, "h");
    outline(s, 0, 0, 17, 13, "z");
    s.set(kind === "look" ? hx + 1 : hx - 1, 3, "t");
    return s;
  }
  const GULL = { idle: gullSprite("idle"), look: gullSprite("look"), wings: gullSprite("wings") };
  function gull(r, t, e) {
    const tip = GULL_REED.tip, T = t % 48, gusty = wind(GULL_REED[0], e) >= 2;
    const s = gusty ? GULL.wings : T >= 20 && T < 30 ? GULL.look : GULL.idle;
    blitFlip(r, s, tip[0] - 8, tip[1] - 11 + (T === 36 || T === 37 ? 1 : 0), false);
  }

  // ---------- 一帧 ----------
  let back = null, front = null, frame = null;
  function draw(ctx, tick) {
    if (!back) {
      back = buildBack(); front = buildFront(); frame = new PB.Raster(W, H);
      waterMask = new Uint8Array(W * H);
      for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) { const c = back.get(x, y), i = (y * W + x) * 4; waterMask[y * W + x] = (c === "q" || c === "r" || c === "y") && !front.data[i + 3] ? 1 : 0; }
    }
    const t = Math.max(0, Math.floor(tick) || 0), e = t >> 1;
    frame.data.set(back.data);
    lakeLife(frame, e); reeds(frame, e, 1); boat(frame, e);
    floatF1(frame, e);
    frame.blit(front, 0, 0);
    waterline(frame, e); seep(frame, e); bridge(frame, e); reeds(frame, e, 0);
    gull(frame, t, e); frog(frame, t);
    const img = ctx.createImageData(W, H);
    img.data.set(frame.data);
    ctx.putImageData(img, 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES.reed_isles = { draw };
})();
