/* ART-04m 地图概念场景：露珠草丛（dewdrop）。
 * 只在工作台「地图概念 › 露珠草丛」页播放，看大致效果；不是游戏资产，不走美术确认。
 * 接口：PB_CONCEPT_SCENES.dewdrop.draw(ctx, tick)，ctx 是 320×180 画布的 2D 上下文，tick 每秒 +8。
 * 只用 ENDESGA 32 调色板码（PB.Raster），整数像素；环境 4 fps（tick >> 1），动物 8 fps（tick）。
 * 地标：像大树的草叶和蒲公英茎、挂满露珠的蛛网、半埋的大橡果。机关外观：露珠球（滚雪球、变大小）、弹跳蘑菇。
 * 环境：叶尖露珠鼓起滴落，蒲公英种子飘起发亮，草叶一弯上面的露珠一齐滚。怪物：象鼻虫；提示动物：瓢虫。 */
(function () {
  "use strict";
  const PB = window.PB;
  const W = 320, H = 180, G = 148; // G：地面（脚底）所在行
  const SUN = [214, 134];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // ---------- 小工具（整数像素） ----------
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
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
  function path(r, pts, c) { for (let i = 1; i < pts.length; i++) line(r, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c); }
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
  function bez(p, n) { // 三次贝塞尔取点
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      out.push([a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]);
    }
    return out;
  }
  function ribbon(cl, w0, w1) { // 沿中线两侧各偏 w 的草叶轮廓
    const L = [], R = [];
    for (let i = 0; i < cl.length; i++) {
      const a = cl[Math.max(0, i - 1)], b = cl[Math.min(cl.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1, w = w0 + ((w1 - w0) * i) / (cl.length - 1);
      dx /= len; dy /= len;
      L.push([cl[i][0] + dy * w, cl[i][1] - dx * w]); R.push([cl[i][0] - dy * w, cl[i][1] + dx * w]);
    }
    return { L, R, poly: L.concat(R.slice().reverse()) };
  }
  const remapper = (r, map) => (x, y) => map[get(r, x, y)] || null;
  function sprite(r, rows, x, y, flip) { r.blitRows(rows, x, y, flip); }
  function outline(r, x0, y0, w, h, code) { // 给小精灵描 1px 边
    const add = [];
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
      if (get(r, x, y) !== ".") continue;
      if (get(r, x - 1, y) !== "." || get(r, x + 1, y) !== "." || get(r, x, y - 1) !== "." || get(r, x, y + 1) !== ".") add.push([x, y]);
    }
    for (const [x, y] of add) r.set(x, y, code);
  }
  function actor(r, id, anim, x, y, flip) { // 已确认的主角 / 箱子精灵，只当比例尺
    if (PB.sprites && PB.sprites.has(id)) { PB.sprites.draw(r, id, anim, 0, x, y, !!flip); return; }
    r.rect(x - 6, y - 16, 12, 16, "z"); r.rect(x - 5, y - 15, 10, 14, id === "char.portitor" ? "i" : "d");
  }
  // ---------- 远景和中景草叶（缓存在 back） ----------
  const RAMP = ["p", "o", "n", "m", "c", "t"];       // 由暗到亮：太阳低低地藏在草叶后面
  const DIM1 = { t: "c", c: "m", m: "n", n: "o", o: "p", p: "p" };
  const LIT1 = { p: "o", o: "n", n: "m", m: "c", c: "t", t: "t" };
  const BOKEH_MAP = { p: "o", o: "n", n: "m" };
  function backdrop(r) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - SUN[0]) / 84, dy = (y - SUN[1]) / 20, v = 0.3 + (1.5 * y) / H + 2.8 * Math.exp(-(dx * dx + dy * dy)) + 0.6 * Math.exp(-(dx * dx * 9 + dy * dy * 4));
      const i = Math.floor(v), f = Math.max(0, Math.min(16, Math.round(((v - i - 0.3) * 16) / 0.4)));
      r.set(x, y, RAMP[Math.min(RAMP.length - 1, i + (bayer(x, y) < f ? 1 : 0))]);
    }
  }
  function farBlades(r) { // 虚焦的远处草叶：把底色压暗一级
    const FAR = [[6, 14, -8, 9], [62, -10, -8, 6], [104, 26, 34, 7], [170, -16, -8, 9], [232, 18, 22, 6], [286, -12, -8, 8], [318, -24, 46, 6]];
    for (const [bx, lean, tipY, w] of FAR) {
      const p = tipY > 0 ? [[bx, 184], [bx, 70], [bx + lean * 0.5, tipY - 60], [bx + lean, tipY]] : [[bx, 184], [bx + lean * 0.2, 120], [bx + lean * 0.7, 50], [bx + lean, tipY]];
      poly(r, ribbon(bez(p, 40), w, tipY > 0 ? 1 : w * 0.6).poly, remapper(r, DIM1));
    }
    for (const [deg, wdt] of [[-158, 5], [-128, 4], [-64, 5], [-34, 6]]) { // 低低的日光从草叶缝里斜斜透出来
      const a0 = (deg * Math.PI) / 180;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x - SUN[0], dy = y - SUN[1], d = Math.hypot(dx, dy);
        if (d < 30 || d > 230) continue;
        let da = Math.atan2(dy, dx) - a0; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) * (180 / Math.PI);
        if (da < wdt * (1 - d / 300) && bayer(x, y) < (d < 120 ? 6 : 3)) { const c = BOKEH_MAP[r.get(x, y)]; if (c) r.set(x, y, c); }
      }
    }
    const BOKEH = [[150, 118, 5], [178, 96, 3], [192, 124, 6], [240, 108, 4], [264, 130, 6], [288, 100, 3], [124, 132, 4], [230, 80, 3],
      [304, 122, 5], [86, 112, 3], [50, 128, 4], [204, 142, 3], [160, 70, 2], [272, 64, 2], [16, 96, 3]];
    for (const [x, y, rad] of BOKEH) ellipse(r, x, y, rad, rad, remapper(r, BOKEH_MAP));
  }
  function blade(r, cl, w0, w1, dark, base, rim) { // 中景草叶：外侧暗、内侧透光
    const rb = ribbon(cl, w0, w1);
    poly(r, rb.poly, base);
    poly(r, rb.L.concat(cl.slice().reverse()), dark);
    path(r, cl, base);
    path(r, rb.R, (x, y) => (Math.hypot(x - SUN[0], (y - SUN[1]) * 1.6) < 70 ? "l" : rim)); // 靠近太阳的叶边镶一道金边
    return rb;
  }
  const BLADE_A = bez([[40, 152], [38, 100], [46, 52], [56, -12]], 48);
  const BLADE_B = bez([[150, 152], [146, 40], [182, -14], [190, 60]], 64);
  const TIP_B = BLADE_B[BLADE_B.length - 1];
  const HEAD = [252, 34];
  function dandelion(r) {
    const stem = bez([[262, 152], [268, 112], [246, 74], [252, 48]], 40);
    path(r, stem.map(([x, y]) => [x + 1, y]), "n"); path(r, stem, "m");
    const sun = [SUN[0] - HEAD[0], SUN[1] - HEAD[1]], sl = Math.hypot(sun[0], sun[1]);
    for (let a = 0; a < 360; a += 9) {
      const ca = Math.cos((a * Math.PI) / 180), sa = Math.sin((a * Math.PI) / 180);
      if (a > 150 && a < 260 && PB.h32(a, 3, 11) % 3 === 0) continue; // 左上缺了几颗：已经飞走
      const lit = (ca * sun[0] + sa * sun[1]) / sl;
      line(r, HEAD[0] + ca * 3, HEAD[1] + sa * 3, HEAD[0] + ca * 15, HEAD[1] + sa * 15, lit > 0.2 ? "u" : "v");
      const tx = Math.round(HEAD[0] + ca * 17), ty = Math.round(HEAD[1] + sa * 17), tc = lit > 0.3 ? "t" : lit > -0.4 ? "u" : "v";
      r.set(tx, ty, tc); r.set(tx + (sa > 0 ? 1 : -1), ty, lit > 0.3 ? "c" : "v"); r.set(tx, ty + (ca > 0 ? -1 : 1), lit > 0.3 ? "c" : "v");
    }
    ellipse(r, HEAD[0], HEAD[1], 3, 3, "F"); r.set(HEAD[0] + 1, HEAD[1] + 1, "e"); r.set(HEAD[0] + 2, HEAD[1], "e");
  }
  const WEB_BEADS = [];
  function web(r, ra, rbb) { // 圆网：辐射丝 + 一圈圈螺旋丝，挂满露珠；几根框丝拉到两片草叶和上面
    const hub = [94, 46], N = 14, RINGS = [5, 9, 13, 17, 21, 25, 29];
    const at = (edge, y, n) => { let best = edge[0]; for (let i = 0; i < n; i++) if (Math.abs(edge[i][1] - y) < Math.abs(best[1] - y)) best = edge[i]; return [Math.round(best[0]), Math.round(best[1])]; };
    const dirs = [];
    for (let i = 0; i < N; i++) { const a = ((i * 360) / N + (PB.h32(i, 2, 31) % 9) - 4) * (Math.PI / 180); dirs.push([Math.cos(a), Math.sin(a)]); }
    const P = (i, rad) => [hub[0] + dirs[i % N][0] * rad, hub[1] + dirs[i % N][1] * rad];
    const nB = Math.floor(rbb.L.length * 0.55);
    for (const [i, a] of [[0, at(rbb.L, 40, nB)], [2, at(rbb.L, 78, nB)], [4, at(ra.R, 100, ra.R.length)], [7, at(ra.R, 44, ra.R.length)], [9, at(ra.R, 8, ra.R.length)], [10, [78, -1]], [12, [116, -1]]]) {
      const o = P(i, 31); line(r, o[0], o[1], a[0], a[1], "w");
    }
    for (let i = 0; i < N; i++) { const o = P(i, 31); line(r, hub[0], hub[1], o[0], o[1], "w"); }
    RINGS.forEach((rad, k) => {
      for (let i = 0; i < N; i++) {
        const a = P(i, rad), b = P(i + 1, rad), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1];
        path(r, [a, m, b], "w");
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 2 + ((i + k) % 3); s < len - 1; s += 4) {
          const t = s / len, u = 1 - t, x = Math.round(u * u * a[0] + 2 * u * t * m[0] + t * t * b[0]), y = Math.round(u * u * a[1] + 2 * u * t * m[1] + t * t * b[1]) + 1;
          const big = PB.h32(x, y, 5) % 3 === 0;
          r.set(x, y, big ? "u" : "v"); if (big) r.set(x, y + 1, "v");
          WEB_BEADS.push([x, y, PB.h32(x, y, 9)]);
        }
      }
    });
    ellipse(r, hub[0], hub[1], 1, 1, "v");
  }
  function buildBack() {
    const r = new PB.Raster(W, H);
    backdrop(r); farBlades(r);
    const ra = blade(r, BLADE_A, 12, 8, "o", "n", "m");
    dandelion(r);
    const rbb = blade(r, BLADE_B, 10, 1, "o", "n", "m");
    web(r, ra, rbb);
    return r;
  }

  // ---------- 地面、橡果、机关和比例尺（缓存在 front，透明处露出后面） ----------
  const DROPS = [[100, 140, 8, 8], [226, 133, 16, 15]]; // 露珠球：中 16px、大 32px（滚雪球、变大小）
  function acorn(r) {
    const cx = 26;
    ellipse(r, cx, 152, 21, 28, (x, y) => { // 果实：只露出上半截
      const nx = (x - cx) / 21, ny = (y - 152) / 28;
      if (nx > 0.93) return "d";                                  // 背后来的日光勾出右边
      if (nx > 0.55 || y >= G - 2) return "f";
      if (nx > -0.76 && nx < -0.52 && ny < -0.25) return nx > -0.68 && nx < -0.6 && ny < -0.62 ? "d" : "F";
      return (x - cx + 40) % 7 === 0 && (y & 1) ? "f" : "e";
    });
    ellipse(r, cx, 128, 25, 17, (x, y) => { // 壳斗：交叉的鳞片
      if (y > 130) return null;
      const nx = (x - cx) / 25, ny = (y - 128) / 17, u = (x + y + 600) % 6, v = (x - y + 600) % 6;
      if (u === 0 || v === 0) return "g";
      if (u === 3 && v === 3) return nx < 0.2 && ny < -0.2 ? "d" : "e";
      return nx > 0.6 ? "g" : "f";
    });
    for (let x = cx - 24; x <= cx + 24; x++) { r.set(x, 130, "g"); if ((x & 3) === 1) r.set(x, 131, "g"); }
    r.rect(cx - 1, 106, 3, 5, "f"); r.set(cx + 1, 107, "g"); r.set(cx + 1, 108, "g"); r.set(cx - 1, 106, "e");
  }
  function soil(r) {
    r.rect(0, G, W, H - G, "g");
    for (let i = 0; i < 30; i++) {
      const h = PB.h32(i, 1, 21), x = h % W, y = G + 6 + ((h >>> 9) % 26), rx = 1 + ((h >>> 15) % 3), ry = 1 + ((h >>> 19) % 2);
      ellipse(r, x, y, rx, ry, "f");
    }
    for (let i = 0; i < 60; i++) { const h = PB.h32(i, 4, 22); r.set(h % W, G + 3 + ((h >>> 10) % 30), "z"); }
    for (const [x, y, rx, ry] of [[70, 167, 5, 3], [212, 172, 6, 3], [268, 159, 4, 2], [20, 171, 4, 3]]) {
      ellipse(r, x, y, rx, ry, "x"); line(r, x - rx + 2, y - ry, x + 1, y - ry, "w");
    }
    r.rect(0, G, W, 1, "F"); r.rect(0, G + 1, W, 1, "f");
    for (let x = SUN[0] - 70; x <= SUN[0] + 70; x++) if (Math.abs(x - SUN[0]) < 40 || bayer(x, G) < 8) r.set(x, G, "d");
    for (let x = 0; x < W; x++) if (PB.h32(x, 2, 23) % 5 === 0) r.set(x, G - 1, "f"); // 土面上的碎粒
  }
  const SPROUT_TOP = [".lm.....ml.", "lmmm...mmml", ".mmmn.nmmm.", "..nnnmnnn.."];
  function sprout(r, x, h) { // 嫩芽：一对黄绿的子叶，叶尖透光
    sprite(r, SPROUT_TOP, x - 5, G - h - 4);
    for (let y = G - h; y < G; y++) { r.set(x, y, "m"); if (y > G - h + 1) r.set(x + 1, y, "n"); }
  }
  function mushroom(r) { // 弹跳机关的样子：软软的紫色菌盖
    const cx = 286;
    r.rect(cx - 3, G - 12, 7, 12, "c"); line(r, cx + 2, G - 12, cx + 2, G - 1, "F"); line(r, cx + 3, G - 12, cx + 3, G - 1, "F"); line(r, cx - 3, G - 11, cx - 3, G - 1, "t");
    ellipse(r, cx, G - 12, 13, 8, (x, y) => (y > G - 11 ? null : y === G - 11 ? "g" : (x - cx) * 2 + (y - (G - 20)) * 3 < -6 ? "C" : "B"));
    for (const [dx, dy] of [[-6, -16], [1, -18], [6, -14], [-1, -14]]) { r.set(cx + dx, G + dy, "c"); r.set(cx + dx + 1, G + dy, "c"); }
    outline(r, cx - 14, G - 21, 29, 21, "z");
  }
  function dewBall(r, back, cx, cy, rx, ry) { // 透明的球：里面是倒过来的远景，边缘暗，左上高光，底部聚光
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1.02) continue;
      let c = get(back, cx - Math.round(x * 1.8), cy - 8 - Math.round(y * 1.8));
      c = LIT1[c] || c;
      if (d > 0.62) c = DIM1[c] || c;
      if (d > 0.8) c = DIM1[c] || c;
      if (d < 0.62 && d > 0.3 && y > ry * 0.4) c = "c";
      r.set(cx + x, cy + y, c);
    }
    const hx = cx - Math.round(rx * 0.45), hy = cy - Math.round(ry * 0.5);
    r.set(hx, hy, "t"); r.set(hx + 1, hy, "t"); r.set(hx, hy + 1, "t");
    if (rx > 10) { r.set(hx + 1, hy + 1, "t"); r.set(hx - 1, hy + 2, "t"); r.set(hx + 3, hy - 1, "u"); }
    for (let x = cx - rx + 3; x <= cx + rx - 3; x++) r.set(x, G, "f");
  }
  function buildFront(back) {
    const r = new PB.Raster(W, H);
    mushroom(r); acorn(r); soil(r);
    sprout(r, 58, 12); sprout(r, 196, 9); sprout(r, 254, 14); sprout(r, 314, 10);
    for (const [cx, cy, rx, ry] of DROPS) dewBall(r, back, cx, cy, rx, ry);
    actor(r, "char.portitor", "idle", 76, G);
    actor(r, "obj.crate_wood", "default", 128, G);
    return r;
  }

  // ---------- 会动的部分 ----------
  const BEAD = [".uu.", "utuu", "uuur", ".rr."], BEAD_S = [".u.", "utu", ".r."];
  const BEND = [1, 2, 3, 3, 3, 3, 2, 2, 1, 1];          // 草叶 C 一弯（环境第 36–45 帧）
  const BEAD_X = [222, 236, 270, 284], LADY_X = 252;
  function bladeC(r, bend) {
    const cl = bez([[304, 152], [300, 96], [272, 86 + (bend >> 1)], [210, 100 + bend]], 128);
    const rb = blade(r, cl, 7, 1, "o", "n", "m"), top = new Map();
    for (const e of [rb.L, rb.R]) for (const [x, y] of e) { const k = Math.round(x), v = Math.round(y); if (!top.has(k) || v < top.get(k)) top.set(k, v); }
    const at = (x) => { for (let d = 0; d < 4; d++) { if (top.has(x - d)) return top.get(x - d); if (top.has(x + d)) return top.get(x + d); } return 100; };
    return { at, tip: cl[cl.length - 1] };
  }
  function beads(r, c, p) { // 草叶一弯，上面的露珠一齐往叶尖滚，掉到大露珠上
    const tipX = Math.round(c.tip[0]), tipY = Math.round(c.tip[1]);
    for (const bx of BEAD_X) {
      if (p >= 46) continue;
      if (p < 36) {
        if (p < 3) { r.set(bx + 1, c.at(bx + 1) - 1, "u"); continue; }
        if (p < 8) { sprite(r, BEAD_S, bx, c.at(bx + 1) - 3); continue; }
        sprite(r, BEAD, bx, c.at(bx + 1) - 4); continue;
      }
      const s = p > 36 ? (p - 36) * (p - 35) : 0, x = bx - s, over = tipX + 2 - x;
      if (over <= 0) { sprite(r, BEAD, x, c.at(x + 1) - 4); continue; }
      const y = tipY + Math.round(over * 1.2);
      if (y < 124) sprite(r, BEAD_S, tipX - 1, y);
    }
  }
  function drip(r, q) { // 叶尖的露珠慢慢鼓起，滴下去，溅开
    const tx = Math.round(TIP_B[0]), ty = Math.round(TIP_B[1]);
    if (q < 28) {
      const n = 1 + Math.floor(q / 7);
      if (n === 1) r.set(tx, ty + 1, "u");
      else if (n === 2) { r.set(tx, ty + 1, "u"); r.set(tx, ty + 2, "t"); }
      else if (n === 3) sprite(r, BEAD_S, tx - 1, ty + 1);
      else { r.set(tx, ty + 1, "u"); sprite(r, BEAD, tx - 1, ty + 2); }
      return;
    }
    const k = q - 28, y = ty + 3 + k * (k + 1);
    if (y < G - 3) { sprite(r, BEAD_S, tx - 1, y); return; }
    if (k === 9) { for (const [dx, dy, c] of [[-2, -2, "u"], [2, -2, "u"], [0, -1, "t"], [-1, -1, "u"], [1, -1, "u"]]) r.set(tx + dx, G + dy, c); }
    else if (k === 10) { for (const [dx, dy] of [[-4, -3], [4, -3], [-3, -1], [3, -1]]) r.set(tx + dx, G + dy, "u"); }
  }
  function seeds(r, e) { // 蒲公英种子一颗颗飘起来，被光照得发亮
    for (let j = Math.floor(e / 10) - 8; j <= Math.floor(e / 10); j++) {
      const k = e - j * 10;
      if (j < 0 || k < 0 || k >= 80) continue;
      const h = PB.h32(j, 7, 13), a = ((150 + (h % 100)) * Math.PI) / 180;
      const x = Math.round(HEAD[0] + Math.cos(a) * 17 - k * 0.8 + tri(k + (h & 31), 28, 3)), y = Math.round(HEAD[1] + Math.sin(a) * 17 - k * 0.3 + tri(k + ((h >>> 5) & 31), 20, 1));
      r.set(x - 1, y - 1, "t"); r.set(x + 1, y - 1, "t"); r.set(x, y, "t"); r.set(x, y + 1, "c");
    }
  }
  function glints(r, e) { // 蛛网上的露珠偶尔闪一下彩色
    for (const [x, y, h] of WEB_BEADS) {
      if ((e + (h % 40)) % 40 !== 0) continue;
      const c = ["D", "l", "s", "m"][(h >>> 8) & 3];
      r.set(x, y, "t"); r.set(x - 1, y, c); r.set(x + 1, y, c); r.set(x, y - 1, c); r.set(x, y + 1, c);
    }
  }
  function rainbows(r, e) { // 露珠里折出的小彩虹，随光慢慢转
    for (const [cx, cy, rx, ry] of DROPS) {
      const bands = rx > 10 ? ["i", "k", "m", "r"] : ["i", "m", "r"], a0 = 18 + tri(e, 24, 10);
      bands.forEach((c, i) => {
        const rr = 0.72 - i * 0.09;
        for (let a = a0; a <= a0 + 50; a += 4) {
          const t = (a * Math.PI) / 180;
          r.set(cx + Math.round(Math.cos(t) * rx * rr), cy + Math.round(Math.sin(t) * ry * rr), c);
        }
      });
    }
  }

  // ---------- 动物（8 fps） ----------
  function blitFlip(r, s, x, y, flip) {
    for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) {
      const c = s.get(xx, yy);
      if (c !== ".") r.set(x + (flip ? s.w - 1 - xx : xx), y + yy, c);
    }
  }
  // 象鼻虫（怪物）：长嘴、肘状触角、驼背的鞘翅；四帧爬行，慢慢爬过来顶箱子
  const WEEVIL = [0, 1, 2, 3].map((f) => {
    const s = new PB.Raster(23, 13);
    ellipse(s, 15, 6, 7, 4, (x, y) => (y <= 3 && x < 17 ? "e" : y >= 9 ? "g" : (x === 12 || x === 16 || x === 19) && (y & 1) ? "g" : "f"));
    ellipse(s, 8, 7, 2, 3, (x, y) => (y <= 5 ? "e" : "f"));
    ellipse(s, 5, 7, 2, 2, "f");
    for (const [x, y] of [[3, 8], [2, 9], [1, 10], [3, 9], [2, 10]]) s.set(x, y, "f");
    for (const [x, y] of [[13, 4], [17, 5], [19, 7], [11, 6], [15, 8]]) s.set(x, y, "v");
    outline(s, 0, 0, 23, 13, "z");
    s.set(5, 6, "u");
    for (const [x, y] of [[3, 7], [3, 6], [2, 5], [1, 4]]) s.set(x, y, "g");
    [10, 14, 18].forEach((bx, i) => { const o = [-1, 0, 1, 0][(f + i * 2) & 3]; s.set(bx, 11, "z"); s.set(bx + o, 12, "z"); });
    return s;
  });
  function weevil(r, t) {
    const T = t % 212;
    let x, flip = false, moving = true;
    if (T < 92) x = 182 - (T >> 1);
    else if (T < 108) { x = ((T - 92) & 7) < 2 ? 135 : 136; moving = false; }
    else if (T < 200) { x = 136 + ((T - 108) >> 1); flip = true; }
    else { x = 182; flip = true; moving = false; }
    blitFlip(r, WEEVIL[moving ? t & 3 : 0], x, G - 13, flip);
  }
  // 瓢虫（提示动物）：停在下一步要去的草叶 C 上，翅鞘一开一合
  const LADY_C = [
    ".....zzzzz...",
    "...zzDiiiizz.",
    "..zDiiiizziiz",
    ".zziiiiizziiz",
    "ztzziiiiiiihz",
    "zttzhiziiihhz",
    ".zzzzzzzzzzz.",
    "..z...z...z..",
  ];
  const LADY_H = [
    "....zzzzz....",
    "..zzDiiiizz..",
    ".zDiiiizziiz.",
    ".ziiiiizziihz",
    "ztzziiiiihzuz",
    "zttzhiziizuuz",
    ".zzzzzzzzzzz.",
    "..z...z...z..",
  ];
  const LADY_O = [
    "...zzzzz.......",
    "..zDiiiizz.....",
    ".zDiizziiiz....",
    ".ziiizziiihz...",
    "ztzzzzzzzzzuuu.",
    "zttzvuuuuvuuuuz",
    ".zzzzzzzzzzzz..",
    "..z...z...z....",
  ];
  function ladybug(r, c, t) {
    const T = t % 40, rows = T < 28 || T >= 34 ? LADY_C : T === 28 || T === 33 ? LADY_H : LADY_O;
    sprite(r, rows, LADY_X - 6, c.at(LADY_X) - 8);
  }

  // ---------- 一帧 ----------
  let back = null, front = null, frame = null;
  function draw(ctx, tick) {
    if (!back) { back = buildBack(); front = buildFront(back); frame = new PB.Raster(W, H); }
    const t = Math.max(0, Math.floor(tick) || 0), e = t >> 1, p = e % 48;
    frame.data.set(back.data);
    const c = bladeC(frame, p >= 36 && p < 46 ? BEND[p - 36] : 0);
    frame.blit(front, 0, 0);
    glints(frame, e); rainbows(frame, e); beads(frame, c, p); drip(frame, e % 40); seeds(frame, e);
    weevil(frame, t); ladybug(frame, c, t);
    const img = ctx.createImageData(W, H);
    img.data.set(frame.data);
    ctx.putImageData(img, 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES.dewdrop = { draw };
})();
