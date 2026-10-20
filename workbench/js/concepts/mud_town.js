/* ART-04f 概念场景 · 泥城鼓市（mud_town）
 * 只用来看这张地图的大致效果：不是正式美术资产，不进游戏，不走美术确认。
 * 接口（WB-05 的页面）：PB_CONCEPT_SCENES["mud_town"].draw(ctx, tick)；ctx 是 320×180 画布的 2D 上下文，tick 每秒 +8。
 * 只用 ENDESGA 32 调色板，逐像素写进 ImageData（整数像素、不抗锯齿）；环境 4 fps（tick >> 1），动物 8 fps（tick）。
 * 画面：干季午后的强光，天空发白；右边是插满木椽的泥砖大清真寺式墙，左边猴面包树上挂着织布鸟的窝，
 * 树和木杆之间的绳上晾着靛蓝染布；中间是鼓摊（鼓点机关的样子），右边是泥砖垒的台子（泥砖机关的样子）。
 * 热风扬起红土、靛蓝布在风里摆、鼓点让地上的小石子一跳一跳、远处热浪抖动。白蚁群在台子上啃木箱。
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
  const SKY = 0, HAZE = 1, MID = 2, DECO = 3, TER = 4, FX = 5, ACT = 6;
  const GROUND = 144, PX0 = 240, PTOP = 116;              // 地面；右边泥砖台子
  function groundTop(x) { return x >= PX0 ? PTOP : GROUND; }
  function ropeY(x) { return 70 + Math.round(6 * Math.sin((Math.PI * (x - 44)) / 102)); }

  // ---------- 静态层 ----------
  function paintSky(S) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.max(0, Math.min(16, (y - 12) >> 1));   // 上面淡赭，往下发白
      put(S, x, y, bay(x, y) < v ? "c" : "E", SKY);
    }
    for (let y = 118; y < GROUND + 2; y++) for (let x = 0; x < W; x++) {   // 远处的平地
      put(S, x, y, y === 118 ? "F" : bay(x, y) < 3 ? "F" : "d", HAZE);
    }
  }
  function toron(S, x, y, L) {                              // 墙上插的木椽，影子短而硬
    put(S, x - 1, y, "F", L); put(S, x, y, "F", L); put(S, x + 1, y, "F", L); put(S, x + 2, y, "f", L);
    put(S, x - 1, y + 1, "f", L); put(S, x, y + 1, "f", L); put(S, x + 1, y + 1, "f", L); put(S, x + 2, y + 1, "g", L);
    put(S, x, y + 2, "a", L); put(S, x + 1, y + 2, "a", L); put(S, x + 2, y + 2, "a", L);
  }
  function paintMosque(S) {
    const L = MID;
    for (let x = 150; x < W; x++) {                          // 墙身，墙头一排圆头小尖柱
      const m = (x - 150) % 12, top = m < 5 ? (m === 0 || m === 4 ? 57 : 55) : 62;
      for (let y = top; y < GROUND + 2; y++) {
        const streak = hash(x, y >> 3, 41) % 9 === 0;
        put(S, x, y, y === top ? "d" : m < 5 && m === 4 ? "a" : streak ? "a" : y < top + 3 ? "b" : "e", L);
      }
    }
    for (const [cx, ty] of [[172, 30], [232, 22], [292, 30]]) {   // 三座扶壁塔
      for (let y = ty; y < GROUND + 2; y++) {
        const k = (y - ty) / (GROUND - ty), round = y - ty < 3 ? 3 - (y - ty) : 0;
        const hw = 7 + Math.round(4 * k) - round;
        for (let x = cx - hw; x <= cx + hw; x++) {
          const rel = (x - cx + hw) / (2 * hw);
          put(S, x, y, y === ty ? "d" : rel < 0.34 ? "b" : rel < 0.8 ? "e" : rel < 0.92 ? "a" : "f", L);
        }
      }
      rect(S, cx - 1, ty - 4, 2, 4, "c", L); put(S, cx - 1, ty - 4, "t", L); put(S, cx, ty - 1, "E", L);   // 塔尖上的白顶
      for (let y = ty + 8; y < GROUND - 8; y += 9) { toron(S, cx - 5, y, L); toron(S, cx + 2, y, L); }
    }
    for (let row = 0; row < 4; row++) for (let x = 154 + (row & 1) * 5; x < W - 2; x += 10) {
      const y = 74 + row * 17;
      if ([172, 232, 292].some((c) => Math.abs(x + 1 - c) < 12)) continue;
      toron(S, x, y, L);
    }
    for (let y = 124; y < GROUND + 2; y++) for (let x = 166; x <= 178; x++) {   // 塔下的门洞
      const dx = Math.abs(x - 172), arch = y - 124 < 3 && dx > 4 - (y - 124);
      if (dx > 6 || arch) continue;
      put(S, x, y, dx === 6 || (y === 124 && dx > 2) ? "f" : "g", L);
    }
  }
  function paintBaobab(S) {
    const L = DECO, cx = 28;
    for (let y = 64; y < GROUND + 2; y++) {                  // 又粗又矮的瓶子形树干
      const k = (y - 64) / (GROUND - 64);
      const hw = Math.round(11 + 9 * Math.pow(k, 0.6) - 2 * k * k + Math.max(0, y - (GROUND - 6)));
      for (let x = cx - hw; x <= cx + hw; x++) {
        const rel = (x - cx + hw) / (2 * hw);
        let c = rel < 0.28 ? "F" : rel < 0.74 ? "e" : "f";
        if (hash(x >> 1, y >> 2, 51) % 7 === 0) c = c === "F" ? "e" : "f";
        put(S, x, y, c, L);
      }
    }
    const limbs = [[-9, -22, 50], [-4, -9, 44], [3, 9, 43], [8, 24, 50]];   // 像树根一样朝天伸的粗枝
    for (const [dx0, dx1, y1] of limbs) {
      for (let w = -1; w <= 1; w++) line(S, cx + dx0 + w, 66, cx + dx1 + w, y1, w < 0 ? "F" : w > 0 ? "f" : "e", L);
      for (const tw of [-5, 4]) line(S, cx + dx1, y1, cx + dx1 + tw, y1 - 6, "f", L);
    }
    for (const [x, y] of [[1, 43], [11, 37], [22, 37], [33, 36], [41, 36], [47, 43]]) {   // 干季：枝头只有几簇小叶
      for (let dy = -2; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) if (hash(x + dx, y + dy, 52) % 3 !== 0 && dx * dx + 2 * dy * dy < 10) put(S, x + dx, y + dy, dy < 0 ? "n" : "o", L);
    }
    for (const [x, y] of [[3, 46], [50, 46]]) { line(S, x + 2, y - 3, x + 2, y, "f", L); spr(S, NEST, x, y, L); }
  }
  const NEST = ["..f...", ".fdf..", "fdFdf.", "dFdFdf", "FdFgFd", "dFggdf", ".dFdf.", "..ff.."];
  function paintLine(S) {                                  // 晾布的绳子和木杆，鼓摊的棚子
    for (let x = 44; x <= 146; x++) put(S, x, ropeY(x), "f", DECO);
    rect(S, 145, 64, 2, GROUND - 64, "f", DECO); rect(S, 145, 64, 1, GROUND - 64, "e", DECO); rect(S, 144, 63, 4, 2, "e", DECO);
    for (const x of [184, 226]) { rect(S, x, 106, 2, GROUND - 106, "f", DECO); put(S, x, 106, "e", DECO); }
    for (let x = 180; x <= 230; x++) for (let y = 0; y < 6; y++) {
      const yy = 104 + y + Math.round((x - 180) / 25);
      put(S, x, yy, y === 5 ? ((x >> 1) & 1 ? "x" : "q") : (x >> 2) & 1 ? "q" : y < 2 ? "w" : "x", DECO);
    }
  }
  function paintGround(S) {
    for (let x = 0; x < W; x++) {
      const top = groundTop(x);
      for (let y = top; y < H; y++) {
        const d = y - top;
        let c;
        if (x >= PX0 && y < GROUND) {                          // 泥砖：砖缝 f，顶上受光
          const row = Math.floor(d / 6), bx = (x - PX0 + (row & 1) * 6) % 12, by = d % 6;
          c = d === 0 ? "d" : by === 5 || bx === 11 ? "f" : by === 0 ? "b" : hash(x, y, 61) % 9 === 0 ? "a" : "e";
          if (x === PX0) c = d === 0 ? "d" : "b";
        } else if (d === 0) c = "d";
        else if (d <= 2) c = "b";
        else {
          const h = hash(x >> 1, y >> 1, 62) % 100;
          c = h < 9 ? "a" : h < 15 ? "F" : h > 95 ? "f" : y > 166 && h < 45 ? "a" : "e";
        }
        put(S, x, y, c, TER);
      }
    }
    for (const [x0, w, y] of [[106, 12, GROUND], [128, 16, GROUND], [264, 16, PTOP]]) {   // 正午的短影子
      rect(S, x0 + 2, y, w, 1, "a", TER); rect(S, x0 + 3, y + 1, w - 2, 1, "e", TER);
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
  const DRUM = [
    ".zzzzzzzzzzzz.",
    "zccccccccccccz",
    "zEccccccccccEz",
    ".zffffffffffz.",
    ".zbdbdbdbdbfz.",
    ".zdbdbdbdbdfz.",
    "..zbdbdbdbfz..",
    "..zdbdbdbdfz..",
    "...zbdbdbfz...",
    "....zbeefz....",
    "....zbeefz....",
    "....zbeefz....",
    "...zbbeeffz...",
    "..zbbbeefffz..",
    ".zbbbbeeeeffz.",
    ".zzzzzzzzzzzz.",
  ];
  const SMALL = [".zzzzzzzz.", "zccccccccz", ".zffffffz.", ".zbdbdbfz.", "..zdbdfz..", "...zbfz...", "...zbfz...", "..zbbeffz.", ".zbbbeeffz", ".zzzzzzzz."];
  function paintActors(S) {
    rect(S, 186, GROUND - 1, 38, 1, "F", ACT); for (let x = 186; x < 224; x += 3) put(S, x, GROUND - 1, "d", ACT);   // 草席
    spr(S, DRUM, 190, GROUND - 17, ACT); spr(S, SMALL, 208, GROUND - 11, ACT);
    spr(S, CHAR, 104, GROUND - 16, ACT);
    spr(S, BOX, 128, GROUND - 16, ACT);
    spr(S, BOX, 264, PTOP - 16, ACT);
    for (const [x, y, c] of [[278, 112, "g"], [279, 112, "g"], [279, 111, "f"], [277, 113, "f"], [278, 113, "g"], [279, 113, "g"], [276, 114, "g"], [279, 106, "g"], [279, 107, "f"], [270, 113, "g"], [271, 113, "f"]]) put(S, x, y, c, ACT);   // 被白蚁啃出的洞
  }
  function paintStatic(S) { paintSky(S); paintMosque(S); paintBaobab(S); paintLine(S); paintGround(S); paintActors(S); }

  // ---------- 动态层 ----------
  const TOWN = [[48, 20, 18], [68, 14, 27], [82, 24, 14], [106, 12, 30], [118, 30, 16], [0, 8, 12]];
  function town(S, a) {                                     // 远处的泥屋：热浪让它一行一行轻轻抖
    for (const [x0, w, h] of TOWN) for (let y = 118 - h; y < 118; y++) {
      const off = (y * 5 + a) % 7 < 2 ? 1 : 0;
      for (let x = x0; x < x0 + w; x++) {
        const win = (y - (118 - h)) % 7 === 3 && (x - x0) % 6 === 2;
        put(S, x + off, y, x >= x0 + w - 3 || win ? "F" : y === 118 - h ? "E" : "d", HAZE);
      }
    }
  }
  const CLOTH = [[54, 16, 26, 0], [74, 14, 31, 1], [93, 17, 24, 2], [116, 15, 29, 0]];
  function cloths(S, a) {                                   // 靛蓝染布：热风往右吹，下摆抖
    CLOTH.forEach(([x0, w, h, pat], n) => {
      const top = ropeY(x0 + (w >> 1)) + 1, sway = 1 + tri(a + n * 5, 14, 2);
      for (let r = 0; r < h; r++) {
        const off = Math.round((sway * r) / h) + (r > h - 4 ? tri(2 * a + n * 3 + r, 6, 1) : 0);
        for (let k = 0; k < w; k++) {
          let c = k % 5 === 4 || k === 0 ? "x" : "q";
          if (pat === 0 && r % 6 === 2 && k % 4 === 2) c = "w";
          if (pat === 1 && (r + k) % 7 === 0) c = "w";
          if (pat === 2 && r % 8 < 2 && k % 2 === 0) c = "r";
          if (r === h - 1 && (k + n) % 3 === 0) continue;
          put(S, x0 + k + off, top + r, c, DECO);
        }
      }
      put(S, x0 + 2, top - 1, "e", DECO); put(S, x0 + w - 3, top - 1, "e", DECO);
    });
  }
  const DUST = [];
  for (let i = 0; i < 16; i++) { const h = hash(i, 9, 71); DUST.push([h % W, 52 + ((h >>> 9) % 90), 1 + ((h >>> 17) % 3), (h >>> 20) % 64, "bFea"[(h >>> 26) % 4]]); }
  function dust(S, a) {                                     // 热风扬起的红土
    for (const [x0, y0, sp, ph, c] of DUST) {
      const x = ((x0 + a * sp) % (W + 20)) - 10, y = y0 + tri(a + ph, 20, 2);
      put(S, x, y, c, FX);
      if (sp > 1) put(S, x - 1, y, c === "b" ? "F" : c, FX);
    }
    const p = a % 48;
    if (p < 12) for (let k = 0; k < 6; k++) put(S, 58 + p * 3 + ((k * 7 + p) % 7), GROUND - 1 - (p >> 2) - ((k * 3) % 4), k & 1 ? "b" : "F", FX);
  }
  const BEATS = [1, 0, 0, 1, 1, 0, 0, 0];                   // 两秒一小节：咚 · · 哒咚 · · ·
  const PEBBLES = [[150, "f"], [156, "F"], [163, "g"], [171, "f"], [178, "F"], [230, "f"], [236, "g"], [243, "F"]];
  function drumBeat(S, a) {
    const hit = BEATS[a % 8], after = BEATS[(a + 7) % 8];
    if (hit) {                                              // 鼓皮一沉，扬起一点灰
      rect(S, 193, GROUND - 16, 8, 1, "E", ACT); put(S, 196, GROUND - 19, "F", FX); put(S, 199, GROUND - 20, "F", FX); put(S, 193, GROUND - 19, "d", FX);
    }
    for (const [x, c] of PEBBLES) {
      const x2 = x >= PX0 ? x : x, base = (x >= PX0 ? PTOP : GROUND) - 1, up = hit ? 2 : after ? 1 : 0;
      put(S, x2, base - up, c, ACT); if (up === 0 && c !== "g") put(S, x2 + 1, base, "f", ACT);
    }
  }
  const BIRD = [
    ["...zz...", "..zlkz..", ".fzzkkz.", "..zkkooz", "..zkkooz", "...zkkz.", "....z.z."],
    ["........", "...zz...", "..zlkz..", "ffzzkkz.", "..zkkooz", "...zkkoz", "....z.z."],
    ["....z.zz", "...zzozz", "..zlkoz.", ".fzzkkz.", "..zkkkz.", "...zkkz.", "....z.z."],
    ["...zz...", "..zlkz..", ".fzzkkz.", "..zkkkz.", "..zkooz.", "..zoozz.", "...z.z.."],
  ];
  function weaver(S, tick) {                                // 织布鸟在猴面包树上编窝
    const p = tick % 32;
    const f = p < 8 || p >= 24 ? 0 : p < 16 ? (p & 1 ? 1 : 0) : p & 1 ? 3 : 2;
    spr(S, BIRD[f], 55, 42, ACT, false);
    if (f === 1) put(S, 54, 47, "d", ACT);                   // 叼着的草丝
  }
  function termites(S, tick) {                              // 白蚁群绕着木箱爬，三只趴在角上啃
    const path = [];
    for (let x = 258; x <= 282; x++) path.push([x, PTOP - 1, 0]);
    for (let y = PTOP - 2; y >= 100; y--) path.push([281, y, 1]);
    for (let x = 280; x >= 262; x--) path.push([x, 99, 0]);
    for (let y = 100; y <= PTOP - 2; y++) path.push([262, y, 1]);
    for (let n = 0; n < 7; n++) {
      const [x, y, vert] = path[(tick + n * 13) % path.length];
      const leg = (tick + n) & 1;
      if (vert) { put(S, x, y, "f", ACT); put(S, x, y + 1, "E", ACT); put(S, x, y + 2, "c", ACT); put(S, x + (leg ? 1 : -1), y + 1, "g", ACT); }
      else { put(S, x, y, "f", ACT); put(S, x + 1, y, "E", ACT); put(S, x + 2, y, "c", ACT); if (y < PTOP - 1) put(S, x + 1 + (leg ? 1 : -1), y + 1, "g", ACT); }
    }
    for (const [x, y, ph] of [[274, 113, 0], [276, 110, 1], [272, 112, 2], [276, 106, 3], [268, 113, 1]]) {
      const chew = (tick + ph) & 1;
      put(S, x + chew, y, "f", ACT); put(S, x + 1 + chew, y, "E", ACT); put(S, x + 2 + chew, y, "c", ACT);
    }
    const chip = tick % 16;
    if (chip < 6) put(S, 279 + (chip >> 2), 112 + chip, "d", FX);   // 掉下来的木屑
  }
  function paintFrame(S, tick) {
    const a = tick >> 1;
    town(S, a); cloths(S, a); dust(S, a); drumBeat(S, a);
    weaver(S, tick); termites(S, tick);
  }

  let base = null, img = null, frame = null;
  window.PB_CONCEPT_SCENES["mud_town"] = {
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