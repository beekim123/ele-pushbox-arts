/* ART-04h 概念场景：风车堤坝（polder）。只看大致效果：不是正式资产，不是关卡，没有规则。
 * 一屏 320×180；只用 ENDESGA 32（像素都经 PB.Raster 写入，色码不对会直接报错）；整数像素，不抗锯齿。
 * 环境 4 fps：f = tick >> 1；动物 8 fps：直接用 tick。不动的层第一次调用时画好缓存，之后每帧只叠会动的东西。
 * 后→前：天空 → 大白云（慢慢飘）→ 地平线、远处小风车 → 郁金香条田（近排随风摆）→ 云影掠过田野
 *        → 地面、红砖小屋和木鞋、风车塔身、水渠、水闸、堤坝、主角和箱子 → 风车叶片、戽水轮、渠水 → 白鹳、麝鼠。
 * 春天的场景，ice_slide（冬天运河结冰）这里不画。 */
window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
(function () {
  "use strict";
  const W = 320, H = 180;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const hash = (x, y, s) => window.PB.h32(x, y, s);
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  const raster = () => new window.PB.Raster(W, H);
  function vgrad(r, x0, x1, stops) {
    for (let i = 0; i + 1 < stops.length; i++) {
      const [ya, ca] = stops[i], [yb, cb] = stops[i + 1];
      for (let y = ya; y < yb; y++) {
        const t = Math.floor(((y - ya) * 17) / (yb - ya));
        for (let x = x0; x < x1; x++) r.set(x, y, bay(x, y) < t ? cb : ca);
      }
    }
  }
  function remap(r, x, y, map) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = r.get(x, y);
    if (map[c]) r.set(x, y, map[c]);
  }
  function grid(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(".")); return g; }
  function gset(g, x, y, c) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
  function outlined(g, c) {
    const h = g.length, w = g[0].length, o = g.map((row) => row.slice());
    const full = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== ".";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (g[y][x] === "." && (full(x - 1, y) || full(x + 1, y) || full(x, y - 1) || full(x, y + 1))) o[y][x] = c;
    return o.map((row) => row.join(""));
  }
  function line(r, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) r.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
  }

  const HORIZON = 100, GROUND = 144, DIKE = 96, CANAL0 = 136, CANAL1 = 204, WATER = 149;
  const dikeY = (x) => (x < 176 ? H : x < 236 ? Math.round(144 - (x - 176) * 0.8) : DIKE); // 堤坝顶面
  const MILL = { x: 120, hub: 64, R: 46 };

  // ---------- 天空和白云 ----------
  function buildSky() {
    const r = raster();
    vgrad(r, 0, W, [[0, "q"], [10, "r"], [78, "r"], [HORIZON, "u"]]);
    return r;
  }
  // 积云：一堆圆叠起来，底边平；上面受光是白，下半是淡灰蓝，底边一道更暗
  function buildCloud(circles, w, h) {
    const g = grid(w, h), base = h - 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y > base) continue;
      let inside = false, lit = false;
      for (const [cx, cy, rr] of circles) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= rr * rr) { inside = true; if ((x - cx + 2) ** 2 + (y - cy + 3) ** 2 <= rr * rr) lit = true; }
      }
      if (!inside) continue;
      g[y][x] = y === base ? "v" : y > base - 3 || !lit ? (bay(x, y) < 10 || y > base - 2 ? "u" : "t") : "t";
    }
    return g.map((row) => row.join(""));
  }
  const CLOUDS = [
    { rows: buildCloud([[14, 18, 9], [28, 12, 12], [44, 9, 13], [60, 14, 11], [74, 19, 8], [36, 20, 9]], 86, 30), x: 10, y: 14, sp: 1 },
    { rows: buildCloud([[10, 12, 7], [22, 8, 9], [34, 10, 8], [45, 14, 6]], 54, 22), x: 170, y: 40, sp: 2 },
    { rows: buildCloud([[8, 8, 5], [17, 6, 7], [27, 9, 5]], 36, 16), x: 250, y: 8, sp: 3 },
  ];
  // sp：每隔几个 4fps 帧挪 1px（近的大云快一点）
  const cloudX = (c, f) => ((((c.x + Math.floor(f / c.sp)) % (W + 100)) + W + 100) % (W + 100)) - 90;

  // ---------- 地平线和条田（不动的部分） ----------
  // 条田：一条一条的颜色带，远的窄、近的宽；中间夹着绿色的田埂和反光的排水沟
  const BANDS = [
    [101, 102, "g"], [102, 104, "R"], [104, 105, "g"], [105, 107, "Y"], [107, 108, "d"], [108, 111, "P"], [111, 112, "g"],
    [112, 115, "K"], [115, 117, "g"], [117, 121, "R"], [121, 122, "d"], [122, 123, "g"], [123, 128, "Y"], [128, 130, "g"],
    [130, 135, "P"], [135, 136, "d"], [136, 144, "N"],
  ];
  const FLOWER = { R: ["i", "h"], Y: ["l", "k"], P: ["C", "B"], K: ["D", "C"] };
  function buildFields() {
    const r = raster();
    // 远处的树行和地平线
    for (let x = 0; x < W; x++) {
      const th = 3 + (hash(x >> 2, 0, 71) % 4) + ((x >> 4) % 3 === 0 ? 2 : 0);
      for (let y = HORIZON - th; y < HORIZON + 1; y++) r.set(x, y, y === HORIZON ? "o" : bay(x, y) < 5 ? "v" : "w");
    }
    for (const [y0, y1, k] of BANDS) for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
      const t = y - y0, h = y1 - y0;
      let c;
      if (k === "g") c = bay(x, y) < 6 ? "m" : "n";
      else if (k === "d") c = (x + y) % 7 < 2 ? "u" : "r";
      else if (k === "N") c = t < 2 ? (bay(x, y) < 8 ? "n" : "o") : bay(x, y) < 4 ? "m" : "n";
      else {
        const [a, b] = FLOWER[k];
        if (h <= 2) c = t === 0 ? a : b;
        else if (t >= h - 1) c = bay(x, y) < 8 ? "n" : b;
        else { const head = (x + (t & 1) * 2) % 4; c = head === 3 ? (t === 0 ? a : "n") : head === 0 && t > 0 ? b : a; }
      }
      r.set(x, y, c);
    }
    return r;
  }
  // 远处的小风车：塔身一竖，叶片在「十」和「×」之间换
  function farMill(r, x, base, f) {
    for (let y = base - 9; y < base; y++) { r.set(x, y, "w"); if (y > base - 5) r.set(x + 1, y, "w"); }
    const c = "w", y = base - 9;
    if (f & 2) for (let k = -3; k <= 3; k++) { r.set(x + k, y, c); r.set(x, y + k, c); }
    else for (let k = -2; k <= 2; k++) { r.set(x + k, y + k, c); r.set(x + k, y - k, c); }
  }

  // ---------- 前景（不动）：地面、小屋、风车塔身、水渠、水闸、堤坝 ----------
  function groundPx(r, x, y) {
    const d = y - GROUND;
    let c = d === 0 ? (hash(x, 0, 73) % 3 ? "m" : "n") : d < 3 ? (bay(x, y) < 10 - d * 3 ? "m" : "n") : d < 5 ? (bay(x, y) < 6 ? "n" : "o") : bay(x, y) < 5 ? "g" : "f";
    if (d > 6 && hash(x >> 1, y >> 1, 75) % 31 === 0) c = "e";
    r.set(x, y, c);
  }
  // 红砖小屋：荷兰式阶梯山墙，白窗框、绿门，门口一双黄色木鞋
  function house(r) {
    const x0 = 8, x1 = 56, wallTop = 114, gTop = 86;
    for (let y = gTop; y < GROUND; y++) for (let x = x0; x < x1; x++) {
      const step = y < 94 ? 14 : y < 102 ? 8 : y < wallTop ? 3 : 0;
      if (x < x0 + step || x >= x1 - step) continue;
      const row = (y - gTop) >> 1, mort = (y & 1) === 1 || ((x + (row & 1) * 2) & 3) === 3;
      let c = mort ? (bay(x, y) < 8 ? "h" : "f") : hash(x >> 2, row, 77) % 5 === 0 ? "h" : "a";
      if (x === x0 + step || x === x1 - step - 1) c = "f";
      r.set(x, y, c);
    }
    // 山墙每级的白边压顶
    for (const [y, s] of [[gTop, 14], [94, 8], [102, 3], [wallTop, 0]]) for (let x = x0 + s - 1; x <= x1 - s; x++) { if (y === wallTop && x > x0 + 2 && x < x1 - 3) continue; r.set(x, y - 1, "c"); r.set(x, y, "E"); }
    r.rect(30, gTop - 6, 4, 6, "f"); r.rect(30, gTop - 7, 4, 1, "c"); // 烟囱
    const win = (wx, wy, w, h) => {
      r.rect(wx - 1, wy - 1, w + 2, h + 2, "t");
      r.rect(wx, wy, w, h, "q");
      for (let y = wy; y < wy + h; y++) r.set(wx + (w >> 1), y, "t");
      r.hline(wx, wy + (h >> 1), w, "t");
      r.set(wx, wy, "r");
      r.rect(wx - 3, wy - 1, 2, h + 2, "n"); r.rect(wx + w + 1, wy - 1, 2, h + 2, "n"); // 绿百叶
    };
    win(29, 96, 6, 6); win(15, 122, 6, 8);
    r.rect(36, 120, 10, 24, "t"); r.rect(37, 121, 8, 23, "o"); r.rect(37, 121, 8, 1, "n");
    for (let y = 123; y < GROUND; y += 4) r.hline(38, y, 6, "p");
    r.set(43, 133, "l");
    // 木鞋
    for (const [sx, flip] of [[46, 0], [51, 1]]) {
      const shoe = ["..kkk", ".kkkkb", "kbkkkk", ".bbbb."];
      shoe.forEach((row, y) => { for (let k = 0; k < row.length; k++) if (row[k] !== ".") r.set(sx + (flip ? 5 - k : k), GROUND - 4 + y, row[k]); });
    }
  }
  // 木风车塔身：八角形、往上收；左面受光、右面背光；下面一圈砖座，中间一扇门
  function millTower(r) {
    const top = 74, bot = GROUND;
    for (let y = top; y < bot; y++) {
      const half = Math.round(7 + ((y - top) * 8) / (bot - top)), x0 = MILL.x - half, x1 = MILL.x + half;
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / (x1 - x0);
        let c = u < 0.3 ? "F" : u < 0.72 ? "e" : "f";
        if ((x - x0) % 4 === 3 && u < 0.95) c = c === "F" ? "e" : c === "e" ? "f" : "g";
        if (x === x0 || x === x1) c = "g";
        if (y >= bot - 8) c = (y & 1) || ((x + (y >> 1)) & 3) === 0 ? "h" : "a";
        r.set(x, y, c);
      }
    }
    r.rect(MILL.x - 4, bot - 14, 8, 14, "c"); r.rect(MILL.x - 3, bot - 13, 6, 13, "g"); r.vline(MILL.x, bot - 13, 13, "f");
    r.rect(MILL.x - 2, 98, 4, 5, "c"); r.rect(MILL.x - 1, 99, 2, 3, "q");
    // 风帽
    for (let y = 58; y < top; y++) {
      const half = Math.round(9 - ((top - y) * (top - y)) / 40);
      for (let x = MILL.x - half; x <= MILL.x + half; x++) r.set(x, y, x < MILL.x - half / 2 ? "e" : y < 61 ? "f" : "g");
    }
  }
  function canalBed(r) {
    for (let x = CANAL0; x < CANAL1; x++) {
      for (let y = GROUND; y < WATER; y++) r.set(x, y, y === GROUND ? "n" : bay(x, y) < 6 ? "o" : "p"); // 对岸的土坡
      for (let y = 159; y < 162; y++) r.set(x, y, "g");
    }
  }
  // 堤坝：绿草坡，顶上一条沙土小路；堤脚一道红砖水闸，拱形涵洞里一扇木闸门
  function dike(r) {
    for (let x = 176; x < W; x++) {
      const top = dikeY(x);
      for (let y = top; y < H; y++) {
        const d = y - top;
        let c = d === 0 ? "m" : d < 3 ? (bay(x, y) < 9 ? "m" : "n") : bay(x, y) < (y > 150 ? 3 : 6) ? "o" : "n";
        if (x >= 236 && d < 2) c = d === 0 ? "E" : "F";
        if (d > 3 && hash(x, y >> 1, 79) % 19 === 0) c = "m";
        r.set(x, y, c);
      }
    }
    // 水闸的砖墙
    const sx0 = 204, sx1 = 231, stop = 116;
    for (let y = stop; y < 160; y++) for (let x = sx0; x < sx1; x++) {
      const e = ((x + 0.5 - 217.5) / 8) ** 2 + ((y + 0.5 - 159) / 15) ** 2;
      if (e < 1) continue;
      const row = (y - stop) >> 1, mort = (y & 1) === 0 || ((x + (row & 1) * 2) & 3) === 0;
      let c = e < 1.35 ? (mort ? "f" : "b") : mort ? "h" : hash(x >> 2, row, 81) % 4 === 0 ? "h" : "a";
      if (x === sx0 || x === sx1 - 1) c = "f";
      r.set(x, y, c);
    }
    r.rect(sx0 - 1, stop - 2, sx1 - sx0 + 2, 2, "u"); r.hline(sx0 - 1, stop, sx1 - sx0 + 2, "v");
    // 涵洞里面黑，木闸门提起一半
    for (let y = 144; y < 159; y++) for (let x = 210; x < 226; x++) {
      const e = ((x + 0.5 - 217.5) / 8) ** 2 + ((y + 0.5 - 159) / 15) ** 2;
      if (e >= 1) continue;
      if (y < 153) r.set(x, y, (x - 210) % 4 === 3 ? "f" : y === 152 ? "g" : y === 147 ? "x" : "e");
      else r.set(x, y, "z");
    }
    // 闸门的绞盘
    for (const px of [212, 223]) r.vline(px, stop - 9, 7, "x");
    r.hline(211, stop - 9, 14, "x");
    for (let a = 0; a < 16; a++) r.set(217 + Math.round(3 * Math.cos((a * Math.PI) / 8)), stop - 12 + Math.round(3 * Math.sin((a * Math.PI) / 8)), "y");
    r.set(217, stop - 12, "x");
    // 麝鼠的洞（洞口和刨出来的土）
    hole(r, false);
  }
  // 麝鼠的洞：深色椭圆，下沿一圈土唇和刨出来的土堆（front=true 时只重画下沿，压在探出来的头上）
  const HOLE = { x: 194, y: 137 };
  function hole(r, front) {
    for (let y = HOLE.y - 4; y < HOLE.y + 5; y++) for (let x = HOLE.x - 6; x < HOLE.x + 7; x++) {
      const e = ((x - HOLE.x) / 5.5) ** 2 + ((y - HOLE.y) / 3.6) ** 2;
      if (e >= 1) continue;
      if (!front) r.set(x, y, e < 0.5 ? "z" : "g");
      else if (y > HOLE.y + 1 && e >= 0.45) r.set(x, y, e < 0.75 ? "g" : "f");
    }
    for (const [dx, dy, c] of [[-5, 4, "f"], [-3, 4, "e"], [-1, 5, "f"], [1, 5, "e"], [3, 4, "f"], [5, 4, "e"], [0, 4, "F"], [-2, 5, "e"]]) r.set(HOLE.x + dx, HOLE.y + dy, c);
  }
  function buildFront() {
    const r = raster();
    for (let x = 0; x < 176; x++) for (let y = GROUND; y < H; y++) if (x < CANAL0 || x >= CANAL1) groundPx(r, x, y);
    for (let x = CANAL0; x < 176; x++) for (let y = 162; y < H; y++) groundPx(r, x, y + 0);
    canalBed(r);
    house(r);
    millTower(r);
    dike(r);
    const S = window.PB.sprites;
    S.draw(r, "char.portitor", "idle", 0, 256, DIKE, false);
    S.draw(r, "obj.crate_wood", "default", 0, 278, DIKE, false);
    S.draw(r, "obj.crate_wood", "default", 0, 294, DIKE, false);
    return r;
  }

  // ---------- 会动的环境 ----------
  // 风车叶片：四片木格子帆，逆时针一直转（每 4fps 帧 7.5°）
  function sails(r, f) {
    const th = (-f * Math.PI) / 24, { x: cx, hub: cy, R } = MILL;
    for (let b = 0; b < 4; b++) {
      const a = th + (b * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      for (let y = cy - R - 2; y <= cy + R + 2; y++) for (let x = cx - R - 2; x <= cx + R + 2; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, al = dx * ca + dy * sa, ac = -dx * sa + dy * ca;
        if (al < -2 || al > R) continue;
        if (ac >= -1 && ac < 1) { r.set(x, y, al > R - 2 ? "e" : "f"); continue; } // 主梁
        if (al < 8 || ac < 1 || ac >= 8) continue;
        const bar = (al % 5) < 1 || ac >= 7 || (ac >= 4 && ac < 5);
        if (bar) r.set(x, y, ac >= 7 ? "e" : "c");
      }
    }
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) r.set(cx + x, cy + y, x * x + y * y <= 1 ? "z" : "g");
  }
  // 戽水轮（wind_pump）：跟风车一起转，把水往上戽进水渠
  function scoopWheel(r, f) {
    const cx = 146, cy = 150, R = 9, th = (f * Math.PI) / 12;
    for (let k = 0; k < 8; k++) {
      const a = th + (k * Math.PI) / 4, ex = cx + Math.round(R * Math.cos(a)), ey = cy + Math.round(R * Math.sin(a));
      line(r, cx, cy, ex, ey, "f");
      r.rect(ex - 1, ey - 1, 2, 2, "e");
    }
    for (let a = 0; a < 48; a++) r.set(cx + Math.round((R - 3) * Math.cos((a * Math.PI) / 24)), cy + Math.round((R - 3) * Math.sin((a * Math.PI) / 24)), "e");
    r.rect(cx - 1, cy - 1, 3, 3, "g"); r.set(cx, cy, "x");
    // 戽上来的水从轮子顶上泼进渠里
    for (let i = 0; i < 4; i++) {
      const p = (f + i * 2) % 6, x = cx + 4 + p * 2, y = cy - 8 + ((p * p) >> 1);
      if (y < WATER) r.set(x, y, i & 1 ? "u" : "t");
    }
  }
  // 渠水（water_flow）：向右流，水纹往右走，流到闸门底下钻进涵洞
  function canalWater(r, f) {
    for (let y = WATER; y < 159; y++) for (let x = CANAL0; x < CANAL1 + 14; x++) {
      if (x >= CANAL1 && !(y >= 153 && x < 226)) continue;
      const d = y - WATER, dash = (((x - f * 3 + d * 11) % 19) + 19) % 19 < 3 + (d & 1);
      let c = d === 0 ? (dash ? "t" : "u") : d < 4 ? (dash ? "u" : "r") : dash ? "r" : "q";
      if (x >= 210) c = d > 6 ? (dash ? "x" : "y") : c;
      r.set(x, y, c);
    }
  }
  // 云影：田上一块块变暗，边缘用 Bayer 抖开
  const DIM = { i: "h", h: "f", l: "k", k: "b", C: "B", B: "g", D: "C", m: "n", n: "o", o: "p", r: "q", u: "v", v: "w", w: "x" };
  function cloudShadows(r, f) {
    for (const [off, rx, ry, sp] of [[110, 60, 18, 1], [300, 40, 14, 2]]) {
      const cx = ((((off + Math.floor(f / sp)) % (W + 140)) + W + 140) % (W + 140)) - 70, cy = 124;
      for (let y = Math.max(HORIZON + 1, cy - ry); y < Math.min(GROUND, cy + ry + 1); y++)
        for (let x = Math.max(0, cx - rx); x < Math.min(W, cx + rx + 1); x++) {
          const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (e < 0.7 || (e < 1 && bay(x, y) < (1 - e) * 50)) remap(r, x, y, DIM);
        }
    }
  }
  // 近排郁金香：一棵棵随风摆，风从左往右一波波过去
  function nearTulips(r, f) {
    for (let x = 1; x < 190; x += 5) {
      if (x > 54 && x < 104) continue; // 白鹳踱步的那段田埂
      const h = hash(x, 0, 83), sw = tri(f * 2 - (x >> 2), 16, 1) + (h & 1 ? 0 : 0), top = 137 + (h % 2);
      const red = (h >>> 3) % 7 !== 0, a = red ? "i" : "l", b = red ? "h" : "k";
      r.set(x, 143, "o"); r.set(x, 142, "n"); r.set(x + (sw > 0 ? 1 : 0) * 0, 141, "n"); r.set(x + (sw < 0 ? -1 : sw > 0 ? 1 : 0), top + 3, "n");
      r.set(x - 1, 142, "m"); r.set(x + 1, 141, "m");
      const hx = x + sw;
      r.set(hx - 1, top, a); r.set(hx + 1, top, a);
      r.set(hx - 1, top + 1, a); r.set(hx, top + 1, a); r.set(hx + 1, top + 1, b);
      r.set(hx, top + 2, b); r.set(hx - 1, top + 2, a);
    }
  }

  // ---------- 动物 ----------
  // 白鹳（提示动物）：在田埂上来回踱步。白身子、黑飞羽、红长嘴红长腿（朝右画，往左走时翻过来）
  const STORK_BODY = [
    "...........tt...",
    "..........tttt..",
    "..........tzttii",
    "...........tt.ii",
    "...........tt...",
    "...........tt...",
    "..........ttt...",
    "....zzttttttt...",
    "..zzzzzttttt....",
    ".zzzzzzttttt....",
    "zzzz.zzuttt.....",
    "......uuu.......",
  ];
  const STORK_LEGS = [
    [[7, 12], [7, 13], [6, 14], [6, 15], [5, 16], [5, 17], [4, 18], [9, 12], [9, 13], [10, 14], [10, 15], [11, 16], [11, 17], [12, 18]],
    [[8, 12], [8, 13], [8, 14], [8, 15], [8, 16], [8, 17], [8, 18], [9, 12], [10, 13], [10, 14], [9, 15], [9, 15]],
    [[8, 12], [8, 13], [9, 14], [9, 15], [10, 16], [10, 17], [11, 18], [7, 12], [7, 13], [6, 14], [6, 15], [5, 16], [5, 17], [4, 18]],
    [[8, 12], [8, 13], [8, 14], [8, 15], [8, 16], [8, 17], [8, 18], [7, 12], [6, 13], [6, 14], [7, 15], [7, 15]],
  ];
  function buildStork(frame) {
    const g = grid(16, 19);
    const bob = frame & 1 ? 1 : 0;
    STORK_BODY.forEach((row, y) => { for (let x = 0; x < 16; x++) if (row[x] !== ".") gset(g, x, y + (y < 7 ? bob : 0), row[x]); });
    const o = outlined(g, "y").map((row) => row.split(""));
    for (const [x, y] of STORK_LEGS[frame]) o[y][x] = "i";
    o[18][3] = o[18][3]; // 脚底
    return o.map((row) => row.join(""));
  }
  // 麝鼠（怪物）：在堤坝上打洞，从洞里探头左右看，缩回去时往外刨土
  function buildMuskrat(face) {
    const rows = [
      "......ff..",
      "....ffeef.",
      "..ffeeeeef",
      ".fetzeeeef",
      "feeeeeeeef",
      "zFFeeeeeff",
      ".FFFeeefff",
      "..ffffff..",
    ];
    return rows.map((row) => (face ? row.split("").reverse().join("") : row));
  }

  let C = null, IMG = null, IMGCTX = null;
  function draw(ctx, tick) {
    if (!C) {
      C = { sky: buildSky(), fields: buildFields(), front: buildFront(), r: raster(),
        stork: [0, 1, 2, 3].map(buildStork), musk: [buildMuskrat(0), buildMuskrat(1)] };
    }
    const r = C.r, f = tick >> 1;
    r.data.set(C.sky.data);
    for (const c of CLOUDS) r.blitRows(c.rows, cloudX(c, f), c.y, false);
    r.blit(C.fields, 0, 0);
    farMill(r, 168, HORIZON - 1, f); farMill(r, 190, HORIZON - 2, f + 1); farMill(r, 75, HORIZON - 1, f + 2);
    nearTulips(r, f);
    cloudShadows(r, f);
    r.blit(C.front, 0, 0);
    canalWater(r, f);
    scoopWheel(r, f);
    sails(r, f);
    // 白鹳：在小屋和风车之间的田埂上来回走（8 fps）
    const ph = tick % 160, goR = ph < 80, sx = goR ? 60 + (ph >> 2) : 80 - ((ph - 80) >> 2);
    r.blitRows(C.stork[(tick >> 1) & 3], sx, GROUND - 19, !goR);
    // 麝鼠：从洞里探头 → 往左看 → 往右看 → 缩回去，往外刨土（8 fps）
    const mp = tick % 40;
    if (mp >= 4 && mp < 30) {
      const sink = mp < 6 || mp > 27 ? 4 : 0, face = mp >= 16 && mp < 26 ? 1 : 0;
      r.blitRows(C.musk[face], HOLE.x - 5, HOLE.y - 5 + sink, false);
      hole(r, true);
    } else {
      for (let i = 0; i < 3; i++) {
        const p = (mp + 10 - i * 3 + 40) % 40;
        if (p > 12) continue;
        r.set(HOLE.x - 4 - p - i, HOLE.y - 2 - ((p * (8 - p)) >> 2), i === 1 ? "e" : "f");
      }
    }
    if (IMGCTX !== ctx) { IMG = ctx.createImageData(W, H); IMGCTX = ctx; }
    IMG.data.set(r.data);
    ctx.putImageData(IMG, 0, 0);
  }
  window.PB_CONCEPT_SCENES.polder = { draw };
})();
