/* ART-04f 概念场景 · 月宫（moon）
 * 只用来看这张地图的大致效果：不是正式美术资产，不进游戏，不走美术确认。
 * 接口（WB-05 的页面）：PB_CONCEPT_SCENES["moon"].draw(ctx, tick)；ctx 是 320×180 画布的 2D 上下文，tick 每秒 +8。
 * 只用 ENDESGA 32 调色板，逐像素写进 ImageData（整数像素、不抗锯齿）；环境 4 fps（tick >> 1），动物 8 fps（tick）。
 * 画面：左边台地上是月宫（朱红墙、金顶、宫灯一明一暗）和捣药的玉兔；中间是桂花树，树干上插着吴刚的斧头；
 * 右边环形山口天狗探头；右上挂着地球，云在慢慢转；漂浮的石台和飘得很慢的桂花表示低重力。
 * 主角人影和两个木箱只当比例尺。不画收件人、货物、界面和文字。 */
(function () {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  // ---------- 小光栅：RGBA 像素 + 每像素深度（深度小的盖不住深度大的） ----------
  const W = 320, H = 180;
  const HEX = {
    a: "#be4a2f", b: "#d77643", c: "#ead4aa", d: "#e4a672", e: "#b86f50", f: "#733e39", g: "#3e2731", h: "#a22633",
    i: "#e43b44", j: "#f77622", k: "#feae34", l: "#fee761", m: "#63c74d", n: "#3e8948", o: "#265c42", p: "#193c3e",
    q: "#124e89", r: "#0099db", s: "#2ce8f5", t: "#ffffff", u: "#c0cbdc", v: "#8b9bb4", w: "#5a6988", x: "#3a4466",
    y: "#262b44", z: "#181425", A: "#ff0044", B: "#68386c", C: "#b55088", D: "#f6757a", E: "#e8b796", F: "#c28569",
  };
  const RGB = {};
  for (const k in HEX) { const v = parseInt(HEX[k].slice(1), 16); RGB[k] = [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function surface(px) { return { px: px || new Uint8ClampedArray(W * H * 4), dep: new Uint8Array(W * H) }; }
  function put(S, x, y, c, L) {
    if (!c || c === "." || c === " ") return;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (S.dep[i] > L) return;
    const p = RGB[c], j = i * 4;
    S.dep[i] = L; S.px[j] = p[0]; S.px[j + 1] = p[1]; S.px[j + 2] = p[2]; S.px[j + 3] = 255;
  }
  function rect(S, x, y, w, h, c, L) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(S, xx, yy, c, L); }
  function spr(S, rows, x, y, L, flip) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], n = row.length;
      for (let k = 0; k < n; k++) put(S, x + k, y + r, row[flip ? n - 1 - k : k], L);
    }
  }
  function line(S, x0, y0, x1, y1, c, L) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(S, x0, y0, c, L);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return (h ^ (h >>> 16)) >>> 0;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bay(x, y) { return BAYER[((y & 3) << 2) | (x & 3)]; }
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  const gauss = (t, c, w) => Math.exp(-((t - c) / w) * ((t - c) / w));

  // ---------- 深度和布局 ----------
  const SKY = 0, STAR = 1, EARTH = 2, FAR = 3, HILL = 4, MID = 5, BACK = 6, MON = 7, TER = 8, FX = 9, ACT = 10;
  const EX = 262, EY = 40, ER = 25;                       // 地球
  function craterTop(x) {                                   // 环形山近处的外沿：两个峰，中间凹
    const t = (x - 204) / 100;
    return 144 - Math.round(12 * gauss(t, 0.24, 0.11) + 12 * gauss(t, 0.76, 0.11) + 5 * gauss(t, 0.5, 0.18));
  }
  function groundTop(x) { return x < 96 ? 128 : x >= 204 && x < 304 ? craterTop(x) : 144; }
  function farRim(x) { return 132 + Math.round(2 * Math.sin((Math.PI * (x - 222)) / 64)); }

  // ---------- 静态层 ----------
  function paintSky(S) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.max(0, Math.min(16, (y - 30) >> 1));   // 近乎黑的深蓝：z 往下过渡到 y
      put(S, x, y, bay(x, y) < v ? "y" : "z", SKY);
    }
  }
  function paintHills(S) {
    for (let x = 0; x < W; x++) {                            // 远处的月面山脊
      const top = 100 + Math.round(3 * Math.sin(x / 19 + 1) + 2 * Math.sin(x / 7 + 0.5) + 4 * Math.sin(x / 53));
      for (let y = top; y < H; y++) put(S, x, y, y === top ? "w" : hash(x, y, 3) % 11 === 0 ? "y" : "x", FAR);
    }
    for (let x = 0; x < W; x++) {                            // 近一点的缓坡
      const top = 116 + Math.round(2 * Math.sin(x / 31 + 2) + 3 * Math.sin(x / 13));
      for (let y = top; y < H; y++) put(S, x, y, y === top ? "v" : hash(x >> 1, y >> 1, 4) % 9 === 0 ? "x" : "w", HILL);
    }
    for (const [cx, cy, rx] of [[126, 123, 8], [194, 122, 6], [308, 122, 7]]) {   // 坡上的小陨坑
      for (let dy = -2; dy <= 2; dy++) for (let dx = -rx; dx <= rx; dx++) {
        const q = (dx * dx) / (rx * rx) + (dy * dy) / 4;
        if (q > 1) continue;
        put(S, cx + dx, cy + dy, q > 0.55 && dy > 0 ? "v" : dy < 0 && q > 0.5 ? "y" : "x", HILL);
      }
    }
  }
  function paintPalace(S) {
    const L = MID, cx = 58;
    // 台基和汉白玉栏杆
    rect(S, 16, 120, 85, 8, "w", L); rect(S, 16, 120, 85, 1, "v", L); rect(S, 16, 124, 85, 1, "x", L);
    rect(S, 14, 116, 89, 1, "v", L);
    for (let x = 14; x <= 102; x += 6) { put(S, x, 115, "u", L); put(S, x, 116, "u", L); put(S, x, 117, "v", L); put(S, x, 118, "v", L); put(S, x, 119, "w", L); }
    // 下层殿身：朱红柱子 + 格扇门，中间两扇透出暖光
    rect(S, 24, 96, 69, 20, "h", L);
    const cols = [24, 35, 46, 57, 68, 79, 90];
    for (let n = 0; n < cols.length - 1; n++) {
      const x0 = cols[n] + 3, x1 = cols[n + 1], lit = n === 2 || n === 3;
      for (let x = x0; x < x1; x++) for (let y = 100; y < 116; y++) {
        const grid = (x - x0) % 2 === 1 || (y - 100) % 3 === 2;
        put(S, x, y, lit ? (grid ? "b" : y < 104 ? "k" : "j") : grid ? "g" : "f", L);
      }
    }
    for (const x of cols) { rect(S, x, 96, 1, 20, "a", L); rect(S, x + 1, 96, 1, 20, "h", L); rect(S, x + 2, 96, 1, 20, "f", L); }
    rect(S, 24, 96, 69, 2, "q", L);                              // 彩画额枋
    for (let x = 25; x < 93; x += 4) put(S, x, 96, "n", L);
    rect(S, 24, 98, 69, 1, "g", L);
    for (let x = 22; x < 95; x++) put(S, x, 93 + ((x >> 1) & 1), (x >> 1) & 1 ? "f" : "b", L);   // 斗拱
    rect(S, 22, 95, 73, 1, "f", L);
    // 屋顶：凹曲的坡面，金色檐口和正脊，两端翘角
    function roof(y0, y1, hw0, hw1, ridgeY, wing) {
      for (let y = y0; y <= y1; y++) {
        const k = (y - y0) / (y1 - y0), hw = hw0 + Math.round((hw1 - hw0) * Math.pow(k, 1.7));
        for (let x = cx - hw; x <= cx + hw; x++) {
          let c = (x - cx) % 3 === 0 ? "f" : y - y0 < 2 ? "b" : "e";
          if (y === y1 - 2) c = "k";
          else if (y === y1 - 1) c = "b";
          else if (y === y1) c = "g";
          put(S, x, y, c, L);
        }
        if (y >= y1 - 4 && y <= y1 - 1) {                       // 翘角
          const up = y1 - 1 - y;
          for (const sgn of [-1, 1]) { put(S, cx + sgn * (hw1 + 1 + up), y - 1, "k", L); put(S, cx + sgn * (hw1 + up), y - 1, "b", L); }
        }
      }
      rect(S, cx - hw0 - 2, ridgeY, 2 * hw0 + 5, 2, "b", L); rect(S, cx - hw0 - 2, ridgeY, 2 * hw0 + 5, 1, "k", L);
      for (const sgn of [-1, 1]) {                                // 鸱吻
        const ex = cx + sgn * (hw0 + 2);
        put(S, ex, ridgeY - 1, "b", L); put(S, ex, ridgeY - 2, "b", L); put(S, ex - sgn, ridgeY - 3, "k", L); put(S, ex - 2 * sgn, ridgeY - 3, "b", L);
      }
      return wing;
    }
    roof(80, 92, 26, 44, 78);
    rect(S, 38, 66, 41, 12, "h", L);                             // 上层殿身
    for (let x = 41; x < 77; x += 7) { rect(S, x, 69, 4, 8, "f", L); rect(S, x + 1, 70, 2, 6, (x - 41) % 14 === 7 ? "j" : "g", L); }
    for (const x of [38, 47, 56, 65, 75]) { rect(S, x, 66, 1, 12, "a", L); rect(S, x + 1, 66, 1, 12, "f", L); }
    rect(S, 38, 66, 41, 1, "q", L);
    roof(52, 64, 14, 30, 50);
    rect(S, cx - 1, 45, 3, 5, "b", L); put(S, cx, 44, "k", L); put(S, cx - 1, 46, "k", L);   // 宝顶
  }
  const CANOPY = [[150, 80, 14], [170, 68, 18], [192, 77, 14], [160, 91, 11], [184, 92, 11], [138, 90, 8], [203, 90, 7]];
  function paintTree(S) {
    const L = MID;
    for (let y = 96; y < 146; y++) {                             // 树干，底部有根
      const sway = Math.round(2 * Math.sin(y / 9)), root = y > 137 ? (y - 137) >> 1 : 0;
      const x0 = 166 + sway - root, x1 = 173 + sway + root;
      for (let x = x0; x <= x1; x++) {
        const c = x - x0 < 2 ? "e" : x1 - x < 2 ? "g" : hash(x, y >> 1, 12) % 5 === 0 ? "g" : "f";
        put(S, x, y, c, L);
      }
    }
    for (const [x0, y0, x1, y1] of [[168, 100, 151, 84], [171, 99, 190, 86], [169, 98, 172, 74], [167, 104, 140, 92], [172, 103, 202, 92]]) {
      line(S, x0, y0, x1, y1, "f", L); line(S, x0 + 1, y0, x1 + 1, y1, "g", L); line(S, x0, y0 - 1, x1, y1 - 1, "e", L);
    }
    for (let y = 46; y < 104; y++) for (let x = 120; x < 216; x++) {   // 树冠：左上亮，点点淡黄的桂花
      let best = null;
      for (const b of CANOPY) { const d = Math.hypot(x - b[0], y - b[1]); if (d <= b[2] && (!best || d - b[2] < best.q)) best = { b, q: d - b[2] }; }
      if (!best) continue;
      const [bx, by, br] = best.b, hsh = hash(x, y, 31);
      if (best.q > -1.6 && hsh % 3 === 0) continue;                 // 叶缘参差
      const lit = (-(x - bx) - (y - by)) / br + (bay(x, y) - 7.5) / 12;
      let c = lit > 0.55 ? "n" : lit > -0.45 ? "o" : "p";
      const fl = hsh % 100;
      if (fl < 4) c = c === "p" ? "d" : "c"; else if (fl < 5) c = "l";
      put(S, x, y, c, L);
    }
    // 吴刚的斧头：斧刃砍进树干，斧柄朝左下
    line(S, 151, 126, 165, 119, "e", L); line(S, 151, 125, 165, 118, "d", L);
    rect(S, 164, 116, 3, 6, "v", L); rect(S, 164, 116, 1, 6, "u", L); put(S, 167, 117, "z", L); put(S, 167, 118, "z", L); put(S, 167, 119, "z", L); put(S, 167, 120, "z", L);
    put(S, 163, 116, "w", L); put(S, 163, 121, "w", L);
  }
  function paintGround(S) {
    for (let x = 0; x < W; x++) {
      const top = groundTop(x);
      for (let y = top; y < H; y++) {
        const d = y - top, h = hash(x >> 1, y >> 1, 21) % 100, deep = Math.max(0, Math.min(60, (y - 150) * 3));
        let c;
        if (d === 0) c = "u";
        else if (d <= 2) c = h < 12 ? "u" : "v";
        else c = h < deep ? (h < deep / 4 ? "x" : "w") : h > 96 ? "u" : "v";
        put(S, x, y, c, TER);
      }
    }
    for (let k = 0; k < 16; k++) {                               // 埋在月壤里的石块
      const hh = hash(k, 5, 77), x = hh % W, y = 150 + ((hh >>> 10) % 24), r = 2 + ((hh >>> 20) % 2);
      if (y - r < groundTop(x) + 4) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
        if (dx * dx * 0.6 + dy * dy > r * r) continue;
        put(S, x + dx, y + dy, dx + dy < -r ? "u" : dx + dy >= r ? "x" : "w", TER);
      }
    }
    for (let x = 222; x < 287; x++) {                            // 环形山里面的后壁
      const top = farRim(x), bottom = craterTop(x);
      for (let y = top; y <= bottom; y++) put(S, x, y, y === top ? "v" : y - top < 2 ? "w" : "x", BACK);
    }
  }
  const CHAR = [
    "................",
    "......zzzz......",
    "....zzkllkzz....",
    "..zzkkkkkkkkzz..",
    ".zkkkkkkkkkkkkz.",
    "..zzzzzzzzzzzz..",
    ".....zEEEEFz....",
    ".....zEzEzFz....",
    ".....zEEEEFz....",
    "....zhiiiiihz...",
    "...zhiiiiiiihz..",
    "...zEziiiiizEz..",
    "....zziiiiizz...",
    ".....zihzhiz....",
    ".....zhz.zhz....",
    ".....zzz.zzz....",
  ];
  const BOX = [
    "zzzzzzzzzzzzzzzz",
    "zdddddddddddddez",
    "zdbbbbbbbbbbddez",
    "zdbbbbbbbbbddfez",
    "zdbbbbbbbbddfbez",
    "zdeeeeeeeddfeeez",
    "zdbbbbbbddfbbbez",
    "zdbbbbbddfbbbbez",
    "zdbbbbddfbbbbbez",
    "zdbbbddfbbbbbbez",
    "zdeeddfeeeeeeeez",
    "zdbddfbbbbbbbbez",
    "zdddfbbbbbbbbbez",
    "zddfbbbbbbbbbbez",
    "zeeeeeeeeeeeeeez",
    "zzzzzzzzzzzzzzzz",
  ];
  function paintActors(S) {
    spr(S, CHAR, 104, 128, ACT);
    spr(S, BOX, 124, 128, ACT);
    spr(S, BOX, 140, 128, ACT);
    spr(S, MORTAR, 82, 123, ACT);
  }
  const MORTAR = [
    "zvvvvvz",
    "zuwwwvz",
    ".zuvvz.",
    ".zvwwz.",
    "zzzzzzz",
  ];
  function paintStatic(S) { paintSky(S); paintHills(S); paintPalace(S); paintTree(S); paintGround(S); paintActors(S); }

  // ---------- 动态层 ----------
  const STARS = [];
  for (let i = 0; i < 48; i++) { const h = hash(i, 1, 9); STARS.push([h % W, (h >>> 9) % 100, (h >>> 17) % 40, (h >>> 25) % 6 === 0]); }
  function stars(S, a) {
    for (const [x, y, p, big] of STARS) {
      const ph = (a + p) % 40;
      put(S, x, y, ph === 0 ? (big ? "t" : "u") : ph < 3 ? "v" : p & 1 ? "w" : "x", STAR);
      if (big && ph < 2) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(S, x + ox, y + oy, "w", STAR);
    }
  }
  const TW = 96, TH = ER * 2 + 1, LAND = new Uint8Array(TW * TH), CLOUD = new Uint8Array(TW * TH);
  function lattice(i, j, s) { return (hash(i, j, s) & 1023) / 1023; }
  function vnoise(u, v, cu, cv, s) {                           // 经度方向可循环的值噪声
    const n = TW / cu, i = Math.floor(u / cu), j = Math.floor(v / cv), fu = (u - i * cu) / cu, fv = (v - j * cv) / cv;
    const sm = (q) => q * q * (3 - 2 * q), i0 = i % n, i1 = (i + 1) % n;
    const top = lattice(i0, j, s) + (lattice(i1, j, s) - lattice(i0, j, s)) * sm(fu);
    const bot = lattice(i0, j + 1, s) + (lattice(i1, j + 1, s) - lattice(i0, j + 1, s)) * sm(fu);
    return top + (bot - top) * sm(fv);
  }
  for (let v = 0; v < TH; v++) for (let u = 0; u < TW; u++) {
    LAND[v * TW + u] = vnoise(u, v, 12, 10, 5) * 0.7 + vnoise(u, v, 6, 5, 6) * 0.3 > 0.55 ? 1 : 0;
    CLOUD[v * TW + u] = v < 3 || v > TH - 4 || vnoise(u, v, 16, 4, 7) * 0.6 + vnoise(u, v, 4, 3, 8) * 0.4 > 0.63 ? 1 : 0;
  }
  function earth(S, a) {
    const rl = (a >> 3) % TW, rc = (a >> 2) % TW;               // 陆地 2 秒转一格，云 1 秒一格
    for (let dy = -ER; dy <= ER; dy++) {
      const half = Math.sqrt(ER * ER - dy * dy), hw = Math.floor(half + 0.4);
      for (let dx = -hw; dx <= hw; dx++) {
        const nx = dx / ER, ny = dy / ER, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lit = -0.6 * nx - 0.45 * ny + 0.66 * nz + (bay(dx + 64, dy + 64) - 7.5) / 36;
        const lon = Math.asin(Math.max(-1, Math.min(1, dx / Math.max(half, 0.6))));
        const u = Math.min(TW / 2 - 1, Math.floor((lon / Math.PI + 0.5) * (TW / 2))), v = dy + ER;
        const k = lit > 0.62 ? 0 : lit > 0.25 ? 1 : lit > -0.05 ? 2 : 3;
        const pal = CLOUD[v * TW + ((u + rc) % TW)] ? "uvwx" : LAND[v * TW + ((u + rl) % TW)] ? "nopy" : "rqxy";
        put(S, EX + dx, EY + dy, pal[k], EARTH);
      }
    }
  }
  const LAN_ON = ["..g..", ".fbf.", "hiiih", "iklki", "ikkki", "hiiih", ".fbf.", "..i..", "..h.."];
  const LAN_OFF = ["..g..", ".fef.", "fhhhf", "hjkjh", "hjjjh", "fhhhf", ".fef.", "..h..", "..f.."];
  function lanterns(S, a) {
    [30, 44, 72, 86].forEach((x, n) => {
      const on = (((a >> 3) + n) & 1) === 0;                    // 两两交替，一明一暗
      put(S, x, 93, "g", MID); put(S, x, 94, "g", MID);
      spr(S, on ? LAN_ON : LAN_OFF, x - 2, 95, MID);
    });
  }
  const ROCK = [
    "..uuuuuuuuuuuuuuuuuuuuuuuuuu..",
    ".uvvvvvvvuvvvvvvvvvvvvuvvvvvu.",
    "uvvvwvvvvvvvvvwvvvvvvvvvvwvvvw",
    ".wvvvvwwvvvvvvvvwwvvvvvwwvvvw.",
    "..wwvvwwwwvvvwwwwwwvvwwwwwww..",
    "...xwwwxwwwwwwxwwwwwwxwwwxx...",
    ".....xxxwwxxxxxwwxxxxxxxx.....",
    "........xxxyxxxxxyxxxx........",
    "...........yxxxxyy............",
    ".............yyy..............",
  ];
  function floaters(S, a) {                                    // 低重力：石台和小石子慢慢上下漂
    spr(S, ROCK, 206, 103 + tri(a, 24, 1), TER);
    for (const [x, y, p] of [[198, 116, 5], [240, 111, 13], [232, 121, 2]]) {
      const yy = y + tri(a + p, 20, 1);
      put(S, x, yy, "v", TER); put(S, x + 1, yy, "w", TER); put(S, x, yy + 1, "w", TER); put(S, x + 1, yy + 1, "x", TER);
    }
  }
  const PETALS = [];
  for (let i = 0; i < 10; i++) { const h = hash(i, 3, 29); PETALS.push([128 + (h % 84), 74 + ((h >>> 8) % 26), (h >>> 14) % 240, 3 + ((h >>> 20) % 5), "ccdl"[(h >>> 25) % 4]]); }
  function petals(S, a) {                                       // 桂花：每 3 帧才落 1 像素，一路往右飘得很远
    for (const [x0, y0, ph, amp, c] of PETALS) {
      const t = (a + ph) % 240;
      let x = x0 + Math.floor(t / 3) + tri(t, 44, amp), y = y0 + Math.floor(t / 3);
      const floor = groundTop(Math.max(0, Math.min(W - 1, x))) - 1;
      if (y >= floor) y = floor;                                 // 落地后躺一会儿
      put(S, x, y, c, FX);
      if (y < floor && ((t >> 2) & 1) === 0) put(S, x + 1, y, c === "l" ? "d" : c, FX);
    }
  }
  const RABBIT = {
    body: [
      "..zz.zz......",
      ".ztzztz......",
      ".zDzzDz......",
      ".zDzzDz......",
      ".ztzztz......",
      "zttttttz.....",
      "ztttttztz....",
      "zttttttDz....",
      ".zttttzz.....",
      "zttttttz.....",
      "ztuttttz.....",
      "ztuutttz.....",
      "zuuuuuttz....",
      ".zvvvvvz.....",
      "..zzzzz......",
    ],
  };
  function rabbit(S, tick) {                                    // 玉兔捣药：举杵、落杵，6 拍一轮
    const x = 70, y = 113, ph = tick % 6, lift = ph < 2 ? 0 : ph === 2 || ph === 5 ? 2 : 4;
    spr(S, RABBIT.body, x, y, ACT);
    for (let k = 0; k < 9; k++) put(S, x + 10, y + 1 + lift + k, k === 0 ? "d" : "e", ACT);   // 杵
    put(S, x + 8, y + 9, "t", ACT); put(S, x + 9, y + 9, "t", ACT); put(S, x + 9, y + 10, "u", ACT);   // 前爪
    if (lift === 4) { put(S, x + 12, y + 8, "u", FX); put(S, x + 14, y + 9, "c", FX); }        // 药末溅起
  }
  const DOG = [
    ".z..........z.",
    "zxz........zxz",
    "zxwz......zwxz",
    "zxwxzzzzzzxwxz",
    "zxxxxxxxxxxxxz",
    "zxxyxxxxxxyxxz",
    "zxEEExxxxEEExz",
    "zxxxxxxxxxxxxz",
    ".zxxxwwwwxxxz.",
    ".zxxwwzzwwxxz.",
    "..zxwtwwtwxz..",
    "..zxxxxxxxxz..",
    ".zxxxxxxxxxxz.",
    ".zxxxxxxxxxxz.",
  ];
  function tiangou(S, tick) {                                   // 天狗在环形山口探头：藏、半露、左看、右看
    const p = tick % 72;
    const f = p < 24 || p >= 64 ? 0 : p < 26 || p >= 62 ? 1 : (p < 38 || p >= 52) ? 2 : 3;
    const y = [137, 132, 128, 128][f], x = 247;
    spr(S, DOG, x, y, MON);
    if (f >= 1) {
      const ex = f === 3 ? 1 : 0;
      for (const bx of [x + 2, x + 9]) { put(S, bx + ex, y + 6, "A", MON); put(S, bx + ex + 1, y + 6, "A", MON); put(S, bx + 2 - ex * 2 + ex, y + 6, "x", MON); }
    }
  }
  function paintFrame(S, tick) {
    const a = tick >> 1;
    stars(S, a); earth(S, a); lanterns(S, a); floaters(S, a); petals(S, a);
    rabbit(S, tick); tiangou(S, tick);
  }

  let base = null, img = null, frame = null;
  window.PB_CONCEPT_SCENES["moon"] = {
    draw(ctx, tick) {
      const t = Math.max(0, Math.floor(Number(tick) || 0));
      if (!base) { base = surface(); paintStatic(base); }
      if (!img) { img = ctx.createImageData(W, H); frame = surface(img.data); }
      frame.px.set(base.px); frame.dep.set(base.dep);
      paintFrame(frame, t);
      ctx.putImageData(img, 0, 0);
    },
  };
})();