/* ART-04f 概念场景 · 海盗湾（pirate_cove）
 * 只用来看这张地图的大致效果：不是正式美术资产，不进游戏，不走美术确认。
 * 接口（WB-05 的页面）：PB_CONCEPT_SCENES["pirate_cove"].draw(ctx, tick)；ctx 是 320×180 画布的 2D 上下文，tick 每秒 +8。
 * 只用 ENDESGA 32 调色板，逐像素写进 ImageData（整数像素、不抗锯齿）；环境 4 fps（tick >> 1），动物 8 fps（tick）。
 * 画面：热带下午，白沙、青绿海水；左边崖下是透出金光的藏宝洞口，中间是半埋在沙里的沉船，右边小岛上两棵棕榈树挂着吊床。
 * 潮水一涨一退（水面整体上下，潮汐机关的样子）：退潮时露出通往小岛的沙洲；浪花拍岸、棕榈叶摆、海鸥飞过。
 * 螃蟹海盗横着走、举钳子；鹦鹉在桅杆上扑翅膀。主角人影和两个木箱只当比例尺。不画收件人、货物、界面和文字。 */
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
  const SKY = 0, CLOUD = 1, SEA = 2, MID = 3, DECO = 4, WATER = 5, TER = 6, FX = 7, ACT = 8;
  const HORIZON = 86, WX0 = 178, WX1 = 272;                  // 海平线；潮水涨落的范围
  function sandTop(x) {
    if (x < WX0) return 144 - Math.round(6 * gauss(x, 152, 13));   // 沙滩，沉船前堆起一道沙丘
    if (x < 196) return 144 + Math.round(((x - WX0) / 18) * 12);   // 斜坡入水
    if (x < 254) return 156 + Math.round(3 * Math.sin((Math.PI * (x - 196)) / 58));   // 沙洲：退潮时露出、通往小岛的路，中间略低
    if (x < 270) return 156 - (x - 254);                           // 小岛的坡
    return 140;
  }
  function tideY(a) {                                            // 16 秒一轮：涨满停 4 秒（淹没沙洲）→ 退 4 秒 → 退干停 4 秒（露出路）→ 涨 4 秒
    const p = ((a % 64) + 64) % 64;
    return p < 16 ? 149 : p < 32 ? 149 + Math.round(((p - 16) * 13) / 16) : p < 48 ? 162 : 162 - Math.round(((p - 48) * 13) / 16);
  }

  // ---------- 静态层 ----------
  function paintSky(S) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (y < HORIZON) { const v = Math.max(0, Math.min(16, (y - 22) >> 1)); put(S, x, y, bay(x, y) < v ? "s" : "r", SKY); continue; }
      const d = y - HORIZON;
      let c = d === 0 ? "u" : d < 6 ? "q" : d < 14 ? (bay(x, y) < (d - 5) * 2 ? "r" : "q") : "r";
      if (d > 2 && hash(x >> 2, y, 81) % 23 === 0) c = d < 8 ? "r" : "s";   // 远处的波光
      put(S, x, y, c, SEA);
    }
    for (const [cx, cy, n] of [[124, 72, 5], [236, 62, 4], [300, 78, 2]]) {   // 平底的积云
      for (let k = 0; k < n; k++) {
        const bx = cx + (k - (n >> 1)) * 9 + (hash(k, cx, 3) % 5), by = cy - (k % 2) * 3, r = 5 + (hash(k, cy, 4) % 4);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
          if ((dx * dx) / 1.6 + dy * dy > r * r || by + dy > cy + 5) continue;
          put(S, bx + dx, by + dy, by + dy > cy + 1 ? "u" : "t", CLOUD);
        }
      }
    }
  }
  function cliffTop(x) { return 38 + Math.round(4 * Math.sin(x / 7) + 2 * Math.sin(x / 3.1)) + (x > 54 ? (x - 54) * 3 : 0); }
  function paintCliff(S) {
    const L = MID;
    for (let x = 0; x < 84; x++) {
      const top = cliffTop(x);
      for (let y = Math.max(0, top); y < 146; y++) {
        const d = y - top, h = hash(x >> 1, y >> 1, 83) % 100;
        let c = d === 0 ? "c" : d < 2 ? "F" : h < 12 ? "f" : h < 34 ? "F" : "e";
        if (x > 72 - d / 5) c = h < 50 ? "f" : "e";               // 崖的右侧背光
        put(S, x, y, c, L);
      }
      if (x < 58 && hash(x, 1, 84) % 3) { const t = cliffTop(x); put(S, x, t - 1, "n", L); if (hash(x, 2, 84) % 2) put(S, x, t - 2, "m", L); put(S, x, t, "o", L); }
    }
    for (let y = 100; y < 146; y++) for (let x = 12; x <= 58; x++) {   // 藏宝洞口：里面透出金光
      const ex = (x - 35) / 23, ey = (y - 146) / 46;
      if (ex * ex + ey * ey > 1) continue;
      const g = Math.hypot((x - 35) / 1.4, y - 141) + (bay(x, y) - 7.5) / 3;
      put(S, x, y, g < 7 ? "k" : g < 11 ? "j" : g < 16 ? "a" : g < 21 ? "f" : g < 27 ? "g" : "z", L);
    }
    for (let x = 22; x <= 48; x++) {                              // 金币堆
      const top = 146 - Math.round(9 * gauss(x, 35, 7));
      for (let y = top; y < 146; y++) put(S, x, y, y === top || hash(x, y, 86) % 4 === 0 ? "l" : (x + y) % 3 === 0 ? "j" : "k", L);
    }
    rect(S, 40, 133, 9, 6, "f", L); rect(S, 40, 133, 9, 1, "k", L); rect(S, 44, 135, 1, 2, "l", L); rect(S, 40, 136, 9, 1, "j", L);   // 宝箱
  }
  function paintWreck(S) {                                       // 半埋在沙里的沉船，船头翘向左上，右半截只剩肋骨
    const L = MID;
    for (let x = 98; x < 178; x++) {
      const deck = Math.round(108 + (x - 98) * 0.14 - (x < 112 ? (112 - x) * 0.9 : 0));
      const bottom = x < 116 ? 146 - Math.round((116 - x) * 1.6) : 146;
      for (let y = deck; y < bottom; y++) {
        const d = y - deck;
        if (x >= 158 && (x - 158) % 5 !== 0 && d > 2) continue;
        let c = d === 0 ? "e" : d === 1 ? "f" : d % 5 === 0 ? "g" : d % 5 === 1 ? "e" : "f";
        if (hash(x, y, 87) % 31 === 0) c = "v";                  // 藤壶
        put(S, x, y, c, L);
      }
    }
    line(S, 132, 112, 150, 64, "f", L); line(S, 133, 112, 151, 64, "e", L); put(S, 151, 63, "f", L); put(S, 150, 62, "f", L);   // 断桅杆
    line(S, 136, 82, 160, 74, "f", L);                           // 帆桁
    for (let x = 139; x <= 158; x++) for (let y = 0; y < 22; y++) {   // 破帆
      const yy = Math.round(82 - (x - 136) / 3) + 1 + y, h = hash(x, y, 89) % 100;
      if (y > 14 + ((x * 7) % 9) || h < 9) continue;
      put(S, x, yy, (x - 139) % 6 === 5 ? "v" : y < 2 ? "v" : "u", L);
    }
  }
  const PALMS = [[282, 140, 276, 80], [310, 140, 301, 90]];        // 树根 x,y → 树冠 x,y
  function paintPalms(S) {
    for (const [bx, by, cx, cy] of PALMS) {
      const n = by - cy;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = Math.round(bx + (cx - bx) * t * t), y = by - k, ring = k % 4 === 0;
        put(S, x - 1, y, ring ? "f" : "F", MID); put(S, x, y, ring ? "e" : "F", MID); put(S, x + 1, y, ring ? "f" : "e", MID); put(S, x + 2, y, "f", MID);
      }
      for (const [dx, dy] of [[-1, 2], [2, 3], [0, 4]]) { put(S, cx + dx, cy + dy, "f", MID); put(S, cx + dx + 1, cy + dy, "g", MID); }
    }
    for (let x = 283; x <= 306; x++) {                             // 吊床
      const y = 116 + Math.round(6 * Math.sin((Math.PI * (x - 283)) / 23));
      put(S, x, y, (x >> 1) & 1 ? "D" : "c", DECO); put(S, x, y + 1, (x >> 1) & 1 ? "C" : "d", DECO);
    }
  }
  function paintSand(S) {
    for (let x = 0; x < W; x++) {
      const top = sandTop(x);
      for (let y = top; y < H; y++) {
        const d = y - top, h = hash(x >> 1, y >> 1, 88) % 100;
        let c = d === 0 ? "t" : d < 3 ? "c" : h < 12 ? "d" : h > 96 ? "t" : "c";
        if (y > 168) c = h < 40 ? "d" : "c";
        if (x >= WX0 - 4 && x <= WX1 && y >= 150) c = d === 0 ? "c" : h < 30 ? "F" : "d";   // 潮间带的湿沙
        if (x >= 8 && x <= 62 && d < 6) {                          // 洞口的金光洒在沙上
          const g = Math.abs(x - 35) / 26 + d / 6 + (bay(x, y) - 7.5) / 20;
          if (g < 0.5) c = "k"; else if (g < 0.8) c = "d";
        }
        put(S, x, y, c, TER);
      }
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
  function paintStatic(S) {
    paintSky(S); paintCliff(S); paintWreck(S); paintPalms(S); paintSand(S);
    spr(S, CHAR, 64, 128, ACT); spr(S, BOX, 84, 128, ACT); spr(S, BOX, 100, 128, ACT);
  }

  // ---------- 动态层 ----------
  const GULL = [["t.....t", ".tv.vt.", "...v..."], ["...u...", ".ttvtt.", "t.....t"]];
  function gulls(S, a) {                                        // 海鸥飞过
    for (const [ph, y0] of [[0, 28], [190, 44]]) {
      const x = ((a * 2 + ph) % (W + 60)) - 30, y = y0 + tri(a + ph, 40, 3);
      spr(S, GULL[a & 1], x, y, CLOUD);
    }
  }
  function glints(S, a) {                                       // 金币一闪一闪
    [[30, 139], [36, 137], [41, 140], [33, 142], [45, 133]].forEach(([x, y], k) => {
      const p = (a + k * 5) % 12;
      if (p === 0) { put(S, x, y, "t", MID); put(S, x - 1, y, "l", MID); put(S, x + 1, y, "l", MID); put(S, x, y - 1, "l", MID); }
      else if (p === 1) put(S, x, y, "l", MID);
    });
  }
  function fronds(S, a) {                                       // 棕榈叶在海风里摆
    PALMS.forEach(([, , cx, cy], p) => {
      [-2.9, -2.4, -1.9, -1.2, -0.7, -0.2, 0.3].forEach((ang, n) => {
        const len = 16 + ((n * 5 + p * 3) % 6), sway = tri(a + n * 3 + p * 7, 12, 1), dirx = Math.cos(ang) > 0 ? -1 : 1;
        for (let k = 1; k <= len; k++) {
          const t = k / len, x = Math.round(cx + Math.cos(ang) * k), y = Math.round(cy + Math.sin(ang) * k + t * t * 9 + sway * t);
          put(S, x, y, k < 3 ? "o" : "n", DECO);
          if (k > 3 && k % 2 === 0) { put(S, x, y + 1, "o", DECO); if (k < len - 2) put(S, x + dirx, y + 2, "o", DECO); }
          if (k > 4 && k % 3 === 0) put(S, x, y - 1, "m", DECO);
        }
      });
    });
  }
  function tide(S, a) {                                         // 潮水：水面整体上下，浪花拍岸
    const yw = tideY(a);
    for (let x = WX0 - 2; x <= WX1; x++) {
      const top = sandTop(x), ys = yw + (tri(x * 2 + a * 3, 16, 1) > 0 ? 0 : 1);
      for (let y = ys; y < Math.min(top, H); y++) {
        const d = y - ys;
        put(S, x, y, d === 0 ? ((x + (a >> 1)) % 7 === 0 ? "t" : "s") : d < 3 ? "s" : d < 9 ? (bay(x, y) < (d - 2) * 2 ? "r" : "s") : y > 166 ? "q" : "r", WATER);
      }
    }
    for (let x = WX0 - 2; x < WX1; x++) {
      const dry0 = sandTop(x) <= yw, dry1 = sandTop(x + 1) <= yw;
      if (dry0 === dry1) continue;
      const wet = dry0 ? 1 : -1, cx = dry0 ? x + 1 : x, p = (a + cx) % 8;
      put(S, cx, yw, "t", FX); put(S, cx + wet, yw, "t", FX); put(S, cx + 2 * wet, yw, p < 4 ? "t" : "u", FX);
      if (p < 3) { put(S, cx - wet * p, yw - 1 - p, "t", FX); put(S, cx - wet * (p - 1), yw - p, "u", FX); }
    }
    if (yw >= 160) for (const [x0, w] of [[203, 5], [223, 7], [242, 4]]) for (let x = x0; x < x0 + w; x++) {   // 退干后沙洲上留下的小水洼
      put(S, x, sandTop(x), (x + a) % 5 === 0 ? "t" : "s", FX);
    }
  }
  function crab(S, tick) {                                      // 螃蟹海盗：横着走，停下来举钳子
    const p = tick % 64;
    let off, f;
    if (p < 24) { off = p; f = p & 1; } else if (p < 32) { off = 24; f = 2 + (p & 1); }
    else if (p < 56) { off = 56 - p; f = p & 1; } else { off = 0; f = 2 + (p & 1); }
    const cx = 128 + off, by = sandTop(cx) - 1;
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {     // 腿
      const lx = cx + s * (3 + k * 2), up = f < 2 && ((k + f) & 1) ? 1 : 0;
      put(S, lx, by - 1 - up, "f", ACT); put(S, lx + s, by - up, "f", ACT);
    }
    const rows = [[by - 5, 3], [by - 4, 5], [by - 3, 5], [by - 2, 4]];
    for (const [y, hw] of rows) for (let x = cx - hw - 1; x <= cx + hw + 1; x++) put(S, x, y, "z", ACT);
    rect(S, cx - 2, by - 6, 5, 1, "z", ACT); rect(S, cx - 3, by - 1, 7, 1, "z", ACT);
    for (const [y, hw] of rows) for (let x = cx - hw; x <= cx + hw; x++) put(S, x, y, y === by - 5 ? "b" : y === by - 2 ? "f" : "a", ACT);
    rect(S, cx - 3, by - 7, 7, 1, "z", ACT); rect(S, cx - 2, by - 8, 5, 1, "g", ACT); put(S, cx, by - 8, "t", ACT); rect(S, cx - 1, by - 9, 3, 1, "z", ACT);   // 三角海盗帽
    for (const s of [-1, 1]) { put(S, cx + s * 4, by - 6, "f", ACT); put(S, cx + s * 4, by - 7, "t", ACT); put(S, cx + s * 4, by - 8, "z", ACT); }   // 眼睛
    for (const s of [-1, 1]) {                                   // 钳子
      if (f < 2) { const x = cx + s * 7; rect(S, x - 1, by - 5, 3, 3, "z", ACT); put(S, x, by - 4, "a", ACT); put(S, x + s, by - 4, "b", ACT); }
      else {
        const x = cx + s * 8, open = f === 2;
        put(S, cx + s * 6, by - 4, "a", ACT); put(S, cx + s * 7, by - 6, "a", ACT); put(S, cx + s * 7, by - 5, "a", ACT);
        rect(S, x - 1, by - 11, 3, 4, "z", ACT); put(S, x, by - 9, "a", ACT); put(S, x, by - 8, "b", ACT);
        put(S, x, by - 10, open ? "z" : "a", ACT); if (open) { put(S, x - 1, by - 12, "a", ACT); put(S, x + 1, by - 12, "a", ACT); }
      }
    }
  }
  const PARROT = [
    ["...zz....", "..zmmz...", ".zvzmmz..", "zvvmmnz..", ".zzmnnz..", "..zmnrz..", "..zmrrz..", "...zqz...", "....z...."],
    ["...zz.zrz", "..zmmzzrz", ".zvzmmzrz", "zvvmmnzz.", ".zzmnnz..", "..zmnnz..", "..zmnnz..", "...zqz...", "....z...."],
    ["...zz....", "..zmmz...", ".zvzmmz..", "zvvmmnzzz", ".zzmnnrrz", "..zmnnzz.", "..zmnnz..", "...zqz...", "....z...."],
  ];
  function parrot(S, tick) {                                    // 鹦鹉站在断桅杆上扑翅膀
    const p = tick % 40, f = p >= 28 && p < 36 ? 1 + (p & 1) : 0;
    spr(S, PARROT[f], 146, 54 - (f ? 1 : 0), ACT);
  }
  function paintFrame(S, tick) {
    const a = tick >> 1;
    gulls(S, a); glints(S, a); fronds(S, a); tide(S, a);
    crab(S, tick); parrot(S, tick);
  }

  let base = null, img = null, frame = null;
  window.PB_CONCEPT_SCENES["pirate_cove"] = {
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