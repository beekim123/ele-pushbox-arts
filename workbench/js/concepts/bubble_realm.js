/* ART-04m 地图概念场景：泡泡天国（bubble_realm）。
 * 只在工作台「地图概念 › 泡泡天国」页播放，看大致效果；不是游戏资产，不走美术确认。
 * 接口：PB_CONCEPT_SCENES.bubble_realm.draw(ctx, tick)，ctx 是 320×180 画布的 2D 上下文，tick 每秒 +8。
 * 只用 ENDESGA 32 调色板码（PB.Raster），整数像素；环境 4 fps（tick >> 1），动物 8 fps（tick）。
 * 地标：泡泡房子（纸折的尖顶）、吹泡泡的大圆环、合在一起的泡泡串、远处的小雨云。机关外观：出泡口上托人上升的泡泡、漂在泡泡串上的纸片。
 * 环境：膜上的虹彩一直在流；房子烟囱和大圆环各吐出一个泡，两泡相碰合成大的，升高后啪地破成一圈小水珠。
 * 怪物：针刺鸟（尖嘴戳破泡泡）；提示动物：泡泡鱼（游进下一个要进的泡泡）。 */
(function () {
  "use strict";
  const PB = window.PB;
  const W = 320, H = 180, G = 148, TAU = Math.PI * 2; // G：地面（脚底）所在行
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const LIGHT = PB.LIGHT, DIM = PB.DIM;

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
  const lift = (r, x, y) => { const c = LIGHT[get(r, x, y)]; if (c && c !== "l") r.set(x, y, c); };

  // ---------- 泡泡 ----------
  const RINGS = {};
  function ring(rx, ry) { // 1px 宽、去掉 L 形拐角的椭圆边；每点带角度（0 朝右，顺时针）
    const key = rx + "," + ry;
    if (RINGS[key]) return RINGS[key];
    const n = Math.max(24, Math.ceil(TAU * Math.max(rx, ry) * 4)), pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = Math.round(Math.cos(a) * rx), y = Math.round(Math.sin(a) * ry), q = pts[pts.length - 1];
      if (!q || q[0] !== x || q[1] !== y) pts.push([x, y, a]);
    }
    while (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    const out = [];
    for (let i = 0; i < pts.length; i++) { // 依次去掉 L 形拐角（跟已经留下的前一点比）
      const a = out.length ? out[out.length - 1] : pts[pts.length - 1], b = pts[i], c = pts[(i + 1) % pts.length];
      if ((a[0] === b[0] || a[1] === b[1]) && (c[0] === b[0] || c[1] === b[1]) && a[0] !== c[0] && a[1] !== c[1]) continue;
      out.push(b);
    }
    return (RINGS[key] = out);
  }
  const IRI = ["l", "D", "C", "s", "m", "D", "l", "s"]; // 膜上的虹彩，沿泡泡边一段段地流
  const iri = (k) => IRI[((k % IRI.length) + IRI.length) % IRI.length];
  function bubble(r, cx, cy, rx, ry, ph, skip, thick) { // 白边 + 里面一圈流动的彩色；thick：机关上的泡，再多一圈反光
    cx = Math.round(cx); cy = Math.round(cy);
    const rad = Math.max(rx, ry), nb = Math.max(4, Math.round(rad / 2.2)), ok = (x, y) => !(skip && skip(x, y));
    if (rad >= 5) for (const [x, y, a] of ring(rx - 1, ry - 1)) {
      if (!ok(cx + x, cy + y)) continue;
      const k = Math.floor((a / TAU) * nb + ph);
      if (k & 1 || thick) r.set(cx + x, cy + y, a > 3.4 && a < 5.0 ? "t" : iri(k >> 1)); else if (a > 0.2 && a < 1.5) lift(r, cx + x, cy + y);
    }
    if (thick && rad >= 9) for (const [x, y, a] of ring(rx - 2, ry - 2)) if (a > 0.3 && a < 1.3 && ok(cx + x, cy + y)) lift(r, cx + x, cy + y);
    for (const [x, y, a] of ring(rx, ry)) {
      if (!ok(cx + x, cy + y)) continue;
      r.set(cx + x, cy + y, rad < 5 ? (a > 3.4 && a < 4.8 ? "t" : "u") : a > 0.4 && a < 1.2 ? "u" : "t");
    }
    if (rad >= 4) for (const [x, y, a] of ring(rx - 2, ry - 2)) if (a > 3.75 && a < 4.35 && ok(cx + x, cy + y)) r.set(cx + x, cy + y, "t"); // 左上高光
    if (rad >= 8) { const hx = cx - Math.round(rx * 0.42), hy = cy - Math.round(ry * 0.5); r.set(hx, hy, "t"); r.set(hx + 1, hy, "t"); }
  }
  function film(r, cx, cy, rad, ph, n, skip) { // 膜上缓缓打转的几缕彩色（细细的，近乎透明）
    for (let i = 0; i < n; i++) {
      const rho = rad * (0.34 + 0.2 * i), start = ph * (0.5 + 0.2 * i) + i * 2.3, len = 1.3, steps = Math.ceil(len * rho * 1.4);
      for (let k = 0; k <= steps; k++) {
        const a = start + (len * k) / steps, q = rho + rad * 0.12 * Math.sin(a * 2 + ph);
        const x = Math.round(cx + Math.cos(a) * q), y = Math.round(cy + Math.sin(a) * q);
        if (skip && skip(x, y)) continue;
        if (k < 2 || k > steps - 2) lift(r, x, y); else r.set(x, y, iri(i * 3 + (k > steps / 2 ? 1 : 0) + Math.floor(ph / 3)));
      }
    }
  }
  function pair(r, a, ra, b, rb, ph) { // 两泡相碰：各自的边只画在对方外面，中间一道平的隔膜
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    bubble(r, a[0], a[1], ra, ra, ph, (x, y) => Math.hypot(x - b[0], y - b[1]) < rb - 0.3);
    bubble(r, b[0], b[1], rb, rb, ph + 2, (x, y) => Math.hypot(x - a[0], y - a[1]) < ra - 0.3);
    if (d >= ra + rb) return;
    const l = (d * d + ra * ra - rb * rb) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - l * l)), ux = dx / d, uy = dy / d;
    const mx = a[0] + ux * l, my = a[1] + uy * l;
    line(r, mx - uy * h, my + ux * h, mx + uy * h, my - ux * h, "u");
  }
  function popFx(r, cx, cy, rad, k) { // 啪：膜裂开，散成一圈小水珠往下落
    cx = Math.round(cx); cy = Math.round(cy);
    if (k === 0) { for (const [x, y, a] of ring(rad, rad)) if (Math.floor(a * 3) % 2 === 0) r.set(cx + x, cy + y, "t"); return; }
    const spread = [0, 2, 4, 6, 7][k], drop = [0, 0, 1, 3, 6][k];
    for (let i = 0; i < 12; i++) {
      if (k >= 3 && i & 1) continue;
      const a = (i / 12) * TAU + 0.26, x = Math.round(cx + Math.cos(a) * (rad + spread)), y = Math.round(cy + Math.sin(a) * (rad + spread)) + drop;
      r.set(x, y, k >= 3 ? "u" : "t");
      if (k <= 2) r.set(x, y + 1, "s");
    }
  }

  // ---------- 天空和远景（缓存在 back） ----------
  function sky(r) { // 雨后初晴：干净的蓝，右上角深一点；贴着地平线一道淡青
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = bayer(x, y), top = (x - 196) >> 3;   // 右上角那一小块深蓝
      let c = y < top - 4 ? "q" : y < top ? (b < (top - y) * 4 ? "q" : "r") : "r";
      if (y > 106) c = y < 114 ? (b < (y - 106) * 2 ? "s" : "r") : "s";
      r.set(x, y, c);
    }
  }
  function isles(r) { // 地平线上一片片很淡的泡沫浮岛，上面有更远的泡泡小屋
    const ISLE = [[-4, 132, 30, 12], [44, 128, 22, 10], [92, 134, 30, 11], [148, 127, 20, 9], [202, 131, 30, 12], [258, 126, 22, 10], [306, 131, 26, 12]];
    for (const [x, y, rx, ry] of ISLE) for (let k = 0; k < 4; k++) { // 每座岛由几团泡沫堆成
      const h = PB.h32(x, k, 52), bx = x - rx + 6 + (h % (rx * 2 - 10)), br = 5 + ((h >>> 8) % 5), by = y - ry + br + ((h >>> 13) % 3);
      ellipse(r, bx, by, br, br, (px, py) => (px - bx + (py - by) * 1.4 < -br * 0.9 ? "u" : "v"));
    }
    for (const [x, y, rx, ry] of ISLE) ellipse(r, x, y + 4, rx, ry - 2, (px, py) => (py - y > ry - 5 ? "w" : "v"));
    for (const [x, y, rad] of [[44, 116, 4], [150, 117, 3], [262, 115, 4], [92, 122, 3]]) // 远处的泡泡小屋
      for (const [dx, dy, a] of ring(rad, rad)) if (dy <= 0) r.set(x + dx, y + dy, a > 3.6 && a < 4.6 ? "t" : "u");
  }
  function rainCloud(r) { // 远处的小雨云
    for (const [x, y, rx, ry] of [[234, 18, 10, 6], [246, 13, 10, 8], [258, 18, 9, 6], [246, 20, 18, 5]])
      ellipse(r, x, y, rx, ry, (px, py) => (py >= 20 ? (bayer(px, py) < 10 ? "v" : "u") : px + py * 2 < 268 ? "t" : "u"));
  }
  function ringStand(r) { // 吹泡泡的大圆环：珍珠白的粗圈，下面插一根缠着粉条的柄
    const [cx, cy] = RING_C;
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy + RING_R; y < G + 2; y++)
      r.set(x, y, x < cx ? "t" : x > cx ? "v" : (y - cy) % 6 < 2 ? "D" : "u");
    for (let y = -RING_R - 1; y <= RING_R + 1; y++) for (let x = -RING_R - 1; x <= RING_R + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > RING_R + 0.5 || d < RING_R - 3.5) continue;
      const lit = -(x + y) / (d * 1.414), inner = d < RING_R - 2.5;
      r.set(cx + x, cy + y, inner ? (lit < -0.2 ? "u" : "w") : lit > 0.4 ? "t" : lit > -0.45 ? "u" : "v");
    }
  }
  function house(r) { // 泡泡房子：下半截是结实的泡沫墙，上面一大一小两个透明泡，纸折的尖顶和小烟囱
    const [hx, hy] = HOUSE_C, [ax, ay] = ATTIC_C, top = WALL_TOP;
    for (let y = top - 4; y < G; y++) for (let x = hx - HOUSE_R; x <= hx + HOUSE_R; x++) {
      if (Math.hypot(x - hx, y - hy) > HOUSE_R + 0.4) continue;
      const bump = y - top + Math.round(2 * Math.cos((x - hx) * 0.55)); // 墙顶是一圈鼓鼓的泡沫
      if (bump < 0) continue;
      const nx = (x - hx) / HOUSE_R;
      r.set(x, y, bump < 2 ? "t" : nx < -0.55 ? "t" : nx > 0.7 ? "v" : "u");
    }
    for (let i = 0; i < 16; i++) { // 墙上的泡沫纹
      const h = PB.h32(i, 2, 53), x = hx - 28 + (h % 56), y = top + 4 + ((h >>> 8) % 12), rad = 1 + ((h >>> 12) % 2);
      if (Math.abs(x - hx) < 9) continue;
      for (const [dx, dy, a] of ring(rad, rad)) r.set(x + dx, y + dy, a < 3.2 ? "v" : "t");
    }
    for (const [x, y, rad] of WINDOWS) { // 圆窗：奶白色的纸框
      ellipse(r, x, y, rad - 1, rad - 1, (px, py) => (px === x || py === y ? "c" : px - x + (py - y) < 0 ? "s" : "r"));
      for (const [dx, dy, a] of ring(rad, rad)) r.set(x + dx, y + dy, a > 3 && a < 5 ? "c" : "F");
    }
    const dTop = G - 15; // 拱门
    for (let y = dTop; y < G; y++) for (let x = hx - 6; x <= hx + 6; x++) {
      const dy = y - dTop - 6, d = dy < 0 ? Math.hypot(x - hx, dy) : Math.abs(x - hx);
      if (d > 6.4) continue;
      r.set(x, y, d > 5.2 ? (x <= hx ? "c" : "F") : y > G - 3 ? "w" : bayer(x, y) < 6 ? "w" : "x");
    }
    poly(r, [[ax - 16, ay - 8], [ax + 17, ay - 8], [ax + 2, ay - 30]], (x, y) => (y >= ay - 9 ? "F" : x < ax + 2 + (y - (ay - 30)) * 0.12 ? "c" : "E"));
    r.rect(ax + 9, ay - 25, 3, 7, "u"); r.rect(ax + 11, ay - 25, 1, 7, "v"); r.rect(ax + 8, ay - 26, 5, 1, "t");
  }
  const HOUSE_C = [44, G - 4], HOUSE_R = 34, ATTIC_C = [58, G - 44], ATTIC_R = 13;
  const WALL_TOP = G - 20, WINDOWS = [[22, G - 10, 4], [66, G - 10, 4]];
  const CHIMNEY = [ATTIC_C[0] + 10, ATTIC_C[1] - 27];
  const RING_C = [176, 92], RING_R = 24;
  const VENT = [234, G], LIFT_R = 14;
  const CHAIN = [[256, 107, 8], [271, 105, 9], [287, 107, 9], [302, 106, 8], [315, 108, 7]]; // 泡泡串（漂着纸片）
  function buildBack() {
    const r = new PB.Raster(W, H);
    sky(r); isles(r); rainCloud(r); ringStand(r); house(r);
    return r;
  }

  // ---------- 地面和比例尺（缓存在 front） ----------
  function foam(r) { // 地面：一大块松软的泡沫，越往下越暗
    for (let y = G; y < H; y++) for (let x = 0; x < W; x++) {
      const d = y - G, b = bayer(x, y);
      r.set(x, y, d < 11 ? "u" : d < 17 ? (b < (d - 10) * 2.3 ? "v" : "u") : d < 25 ? "v" : b < (d - 24) * 2.3 ? "w" : "v");
    }
    for (let i = 0; i < 80; i++) { // 泡沫颗粒：左上亮、右下暗
      const h = PB.h32(i, 5, 41), cx = (h % (W + 10)) - 5, d = 5 + ((h >>> 9) % 27), cy = G + d, rad = 2 + ((h >>> 14) % 3) + (d > 15 ? 1 : 0);
      const base = get(r, cx, cy);
      if (base === ".") continue;
      for (const [x, y, a] of ring(rad, rad)) r.set(cx + x, cy + y, a < 3.1 ? DIM[base] : a > 3.6 && a < 5.0 ? LIGHT[base] : base);
      r.set(cx - (rad >> 1), cy - (rad >> 1), (h >>> 20) % 6 === 0 ? ((h >>> 24) & 1 ? "s" : "D") : "t");
    }
    for (let x = -3; x < W + 3;) { // 顶面一排鼓起的小泡
      const rad = 3 + (PB.h32(x + 9, 9, 42) % 3), cx = x + rad;
      ellipse(r, cx, G + 2, rad, rad, (px, py) => (py > G + 3 ? null : px - cx + (py - G - 2) * 1.5 < -rad + 1 ? "t" : py <= G - rad + 3 ? "t" : "u"));
      x += rad * 2 - 2;
    }
  }
  function vent(r) { // 出泡口：嵌在泡沫里的一圈珍珠口
    const [x, y] = VENT;
    ellipse(r, x, y, 8, 3, (px, py) => (py < y - 1 ? "t" : "v"));
    ellipse(r, x, y, 5, 1, "w");
    r.set(x - 2, y, "x"); r.set(x + 1, y, "x");
  }
  function buildFront() {
    const r = new PB.Raster(W, H);
    foam(r); vent(r);
    actor(r, "char.portitor", "idle", 100, G);
    actor(r, "obj.crate_wood", "default", 124, G);
    return r;
  }

  // ---------- 会动的环境（4 fps） ----------
  const FAR_BUBBLES = [[18, 70, 3], [92, 96, 2], [140, 30, 3], [206, 84, 2], [300, 40, 3], [118, 118, 2], [276, 82, 2], [8, 112, 2]];
  function farBubbles(r, e) { // 远处慢慢往上飘的小泡
    for (const [x0, y0, rad] of FAR_BUBBLES) {
      const y = 4 + ((((y0 - (e >> 2)) % 120) + 120) % 120), x = x0 + tri(e + y0, 40, 1);
      for (const [dx, dy, a] of ring(rad, rad)) r.set(x + dx, y + dy, a > 3.4 && a < 4.8 ? "t" : "u");
    }
  }
  function rain(r, e) { // 小雨云下面稀稀的雨丝，往左斜
    for (let i = 0; i < 9; i++) {
      const h = PB.h32(i, 3, 61), x0 = 232 + i * 3 + (h % 3), len = 18 + ((h >>> 5) % 8), y = 25 + ((h >>> 9) + e * 3) % len;
      if (y + 2 > 25 + len) continue;
      r.set(x0 - ((y - 25) >> 2), y, "u"); r.set(x0 - ((y - 24) >> 2), y + 1, "u");
    }
  }
  const houseSkip = (x, y) => y >= WALL_TOP - 2;
  function houseFilm(r, e) {
    const ph = e * 0.3, [hx, hy] = HOUSE_C, [ax, ay] = ATTIC_C;
    film(r, hx, hy, HOUSE_R, ph, 3, (x, y) => houseSkip(x, y) || Math.hypot(x - ax, y - ay) < ATTIC_R + 1);
    film(r, ax, ay, ATTIC_R, ph + 1, 1, (x, y) => y < ay - 8);
    bubble(r, hx, hy, HOUSE_R, HOUSE_R, ph, (x, y) => y >= WALL_TOP || Math.hypot(x - ax, y - ay) < ATTIC_R - 0.3, true);
    bubble(r, ax, ay, ATTIC_R, ATTIC_R, ph + 3, (x, y) => Math.hypot(x - hx, y - hy) < HOUSE_R - 0.3 || y < ay - 8);
  }
  function ringFilm(r, e) { film(r, RING_C[0], RING_C[1], RING_R - 3, e * 0.35, 3); }
  const MP = 64; // 合泡一轮：64 个环境帧（16 秒）
  function mergeChain(r, e) {
    const p = e % MP, ph = e * 0.3, wob = (k) => tri(e + k, 12, 1);
    if (p < 28) {
      let a, ra = 8, b, rb = 7; // a：大圆环吹出来的；b：房子烟囱冒出来的
      if (p < 6) { const k = p / 6; a = [lerp(170, 160, k), lerp(90, 80, k)]; ra = 3 + p; }
      else if (p < 22) { const k = ease((p - 6) / 16); a = [lerp(160, 136, k), lerp(80, 52, k) + wob(0)]; }
      else a = [lerp(136, 133, (p - 22) / 5), 52];
      if (p < 4) { b = [CHIMNEY[0] + 1, CHIMNEY[1] - 3 - p]; rb = 3 + p; }
      else if (p < 22) { const k = ease((p - 4) / 18); b = [lerp(CHIMNEY[0] + 1, 121, k) + wob(5), lerp(CHIMNEY[1] - 7, 52, k)]; }
      else b = [lerp(121, 124, (p - 22) / 5), 52];
      a = a.map(Math.round); b = b.map(Math.round);
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < ra + rb) pair(r, a, ra, b, rb, ph);
      else { bubble(r, a[0], a[1], ra, ra, ph); bubble(r, b[0], b[1], rb, rb, ph + 2); }
      return;
    }
    const k = (p - 28) / 22, cx = Math.round(lerp(129, 134, k)) + wob(2), cy = Math.round(lerp(52, 20, ease(k)));
    if (p < 32) { const [rx, ry] = [[13, 9], [10, 12], [12, 10], [11, 11]][p - 28]; bubble(r, cx, cy, rx, ry, ph); return; }
    if (p < 50) { film(r, cx, cy, 11, ph, 2); bubble(r, cx, cy, 11, 11, ph); return; }
    if (p < 55) popFx(r, cx, cy, 11, p - 50);
  }
  function liftBubble(r, e) { // 托人上升的泡泡：停在出泡口上，轻轻上下浮，里面一串小泡往上冒
    const cx = VENT[0], cy = VENT[1] - 18 + tri(e, 16, 1), ph = e * 0.3 + 4;
    for (let i = 0; i < 4; i++) { const y = cy + 12 - ((e + i * 6) % 24); r.set(cx - 3 + ((i * 5) % 7), y, "t"); }
    film(r, cx, cy, LIFT_R, ph, 2);
    bubble(r, cx, cy, LIFT_R, LIFT_R, ph, null, true);
  }
  function chain(r, e) { // 泡泡串：几个合在一起的泡，上面漂着一张纸（纸片机关）
    const dy = tri(e, 20, 1), ph = e * 0.3 + 1;
    CHAIN.forEach(([x, y, rad], i) => {
      const nb = CHAIN.filter((_, j) => j === i - 1 || j === i + 1);
      bubble(r, x, y + dy, rad, rad, ph + i * 2, (px, py) => nb.some(([nx, ny, nr]) => Math.hypot(px - nx, py - ny - dy) < nr - 0.3), true);
    });
    for (let i = 0; i + 1 < CHAIN.length; i++) {
      const [x0, y0, r0] = CHAIN[i], [x1, y1, r1] = CHAIN[i + 1], d = Math.hypot(x1 - x0, y1 - y0);
      const l = (d * d + r0 * r0 - r1 * r1) / (2 * d), h = Math.sqrt(Math.max(0, r0 * r0 - l * l)), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
      const mx = x0 + ux * l, my = y0 + uy * l + dy;
      line(r, mx - uy * h, my + ux * h, mx + uy * h, my - ux * h, "u");
    }
    const py = 94 + dy; // 纸：平平地搭在泡顶上，左角翘起，有两道折痕
    r.rect(253, py - 1, W - 253, 1, "t"); r.rect(253, py, W - 253, 2, "c"); r.rect(253, py + 2, W - 253, 1, "F");
    for (const [x, y, c] of [[249, py - 3, "c"], [250, py - 2, "c"], [251, py - 1, "c"], [252, py, "c"], [250, py - 3, "t"], [251, py - 2, "F"], [252, py - 1, "F"], [253, py + 1, "F"]]) r.set(x, y, c);
    for (const x of [276, 300]) r.set(x, py, "E");
  }

  // ---------- 动物（8 fps） ----------
  // 针刺鸟（怪物）：深色小鸟，头上一撮刺，嘴是一根长针；悬停、扑过去戳破泡泡
  const BIRD = [0, 1, 2].map((f) => {
    const s = new PB.Raster(25, 14);
    line(s, 1, 6, 6, 8, "x"); line(s, 1, 9, 6, 9, "x"); line(s, 2, 11, 6, 10, "x");
    ellipse(s, 9, 9, 4, 3, (x, y) => (y >= 10 ? "w" : "y"));
    ellipse(s, 14, 7, 3, 3, "y");
    for (const [x, y] of [[12, 3], [13, 3], [11, 2], [14, 3], [13, 2]]) s.set(x, y, "y");
    line(s, 17, 7, 23, 7, "u"); line(s, 17, 8, 19, 8, "v");
    if (f === 0) poly(s, [[7, 8], [12, 8], [5, 1]], "x");
    else if (f === 1) poly(s, [[5, 7], [13, 7], [2, 4]], "x");
    else poly(s, [[7, 8], [12, 8], [6, 13]], "x");
    outline(s, 0, 0, 25, 14, "z");
    s.set(15, 6, "t"); s.set(16, 6, "A"); s.set(15, 5, "z"); s.set(16, 5, "z");
    return s;
  });
  const T_HOME = [284, 62], HOVER = [206, 40], BP = 176; // 鸟一轮 176 tick（22 秒）
  function birdAndTarget(r, t, e) {
    const T = t % BP, wing = [0, 1, 2, 1][t & 3];
    let tx = T_HOME[0], ty = T_HOME[1] + tri(e, 16, 1), popK = -1;
    if (T >= 104 && T < 114) popK = (T - 104) >> 1;
    else if (T >= 114 && T < 132) tx = null;
    else if (T >= 132) tx = Math.round(lerp(334, T_HOME[0], ease((T - 132) / 40)));
    if (tx !== null && popK < 0) bubble(r, tx, ty, 7, 7, e * 0.3 + 2);
    if (popK >= 0) popFx(r, T_HOME[0], ty, 7, popK);
    let bx = HOVER[0], by = HOVER[1] + tri(t, 8, 1), flip = false;
    const hit = T_HOME[0] - 7 - 22; // 嘴尖碰到泡边时鸟的左边
    if (T >= 96 && T < 104) { bx = Math.round(lerp(HOVER[0], hit, (T - 96) / 7)); by = Math.round(lerp(HOVER[1], T_HOME[1] - 8, (T - 96) / 7)); }
    else if (T >= 104 && T < 108) { bx = hit - (T - 104); by = T_HOME[1] - 8; }
    else if (T >= 108 && T < 140) { const k = ease((T - 108) / 32); bx = Math.round(lerp(hit - 4, HOVER[0], k)); by = Math.round(lerp(T_HOME[1] - 8, HOVER[1], k)); flip = T < 136; }
    blitFlip(r, BIRD[T >= 96 && T < 104 ? 1 : wing], bx, by, flip);
  }
  // 泡泡鱼（提示动物）：圆滚滚的粉鱼，青色的鳍；从房子前游进托人的泡泡，在里面打转
  const FISH = [0, 1, 2, 1].map((f) => {
    const s = new PB.Raster(15, 11), o = [-1, 0, 1, 0][f];
    poly(s, [[1, 2 + o], [6, 5], [1, 9 + o]], "s");
    ellipse(s, 8, 5, 4, 4, (x, y) => (y >= 7 ? "c" : y <= 2 ? "D" : "C"));
    s.set(7, 0, "s"); s.set(8, 0, "s"); s.set(9, 1, "s");
    outline(s, 0, 0, 15, 11, "z");
    s.set(10, 4, "t"); s.set(11, 4, "z"); s.set(10, 3, "t"); s.set(9, 6, "D");
    return s;
  });
  const FP = 192; // 鱼一轮 192 tick（24 秒）
  const FISH_HOME = [90, 108];
  function fish(r, t) {
    const T = t % FP, [lx, ly] = [VENT[0], VENT[1] - 18];
    let x, y, flip = false;
    if (T < 40) { x = FISH_HOME[0]; y = FISH_HOME[1] + tri(t, 16, 1); }
    else if (T < 104) { const k = (T - 40) / 64; x = lerp(FISH_HOME[0], lx, k); y = lerp(FISH_HOME[1], ly, k) - Math.sin(k * Math.PI) * 26 + tri(t, 12, 1); }
    else if (T < 160) { const k = ((T - 104) / 56) * TAU; x = lx + Math.sin(k) * 5; y = ly + Math.sin(k * 2) * 2; flip = Math.cos(k) < 0; }
    else { const k = (T - 160) / 32; x = lerp(lx, FISH_HOME[0], k); y = lerp(ly, FISH_HOME[1], k) - Math.sin(k * Math.PI) * 18; flip = true; }
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < 3; i++) { const k = (t + i * 3) % 9; r.set(x + (flip ? 7 + k : -7 - k) + (i & 1), y - 1 - k - i, "t"); } // 鱼尾后面冒的小泡
    blitFlip(r, FISH[t & 3], x - 7, y - 5, flip);
  }

  // ---------- 一帧 ----------
  let back = null, front = null, frame = null;
  function draw(ctx, tick) {
    if (!back) { back = buildBack(); front = buildFront(); frame = new PB.Raster(W, H); }
    const t = Math.max(0, Math.floor(tick) || 0), e = t >> 1;
    frame.data.set(back.data);
    farBubbles(frame, e); rain(frame, e); houseFilm(frame, e); ringFilm(frame, e); mergeChain(frame, e);
    birdAndTarget(frame, t, e); fish(frame, t); liftBubble(frame, e); chain(frame, e);
    frame.blit(front, 0, 0);
    const img = ctx.createImageData(W, H);
    img.data.set(frame.data);
    ctx.putImageData(img, 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES.bubble_realm = { draw };
})();
