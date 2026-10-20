/* ART-04l 地图概念场景：巨鲸肚里（whale_belly）。只看大致效果，不是正式资产，不进游戏。
 * 一屏 320×180 的侧视房间：鲸鱼的胃。暗肉色的胃壁上一根根拱起的肉粉色肋骨，随心跳一缩一胀、肉壁一鼓一鼓；
 * 黄绿的胃液池上漂着半截沉船（桅杆上挂着旧渔网），顶上的喷气孔每隔一会儿漏进一束白光，正好落在船上；
 * 鲸鱼一喝水，海水就从左边的食道口灌进来，水位涨起又慢慢退下去（tide）。
 * 机关只画样子：胃液（acid）、套娃箱（nested_box）、涨落的水位（tide）。
 * 怪物：鲸虱（扁扁的一群，在前景的大肋骨上爬上爬下）；提示动物：小鮣鱼（贴在套娃箱上摆尾巴）。
 * 环境 4 fps（tick>>1），动物 8 fps（tick 每秒加 8）。只用 ENDESGA 32 调色板，整数像素，不抗锯齿。
 * 只读调用 workbench/js/core/raster.js 里的 PB.Raster / PB.h32。 */
(function (root) {
  "use strict";
  const W = 320, H = 180;
  const ACID_Y = 148, SHORE_X = 240, SHORE_Y = 124, DECK_Y = 128, POOL_X1 = 246;
  const HOLE_X = 153;                                  // 喷气孔
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const BEAT = [0, 1, 2, 1, 0, 1, 0, 0];              // 心跳（环境帧）：咚—哒，停一会儿
  const GULP = 64, POUR = 12, MAXLV = 8;              // 每 16 秒喝一次水：灌 3 秒，水位涨 8 像素，再慢慢退
  const BLOW = 48;                                     // 每 12 秒喷气孔漏一次光
  const WHITE = { z: "y", y: "x", g: "B", B: "C", h: "C", C: "D", f: "F", x: "w" };     // 白光沿调色板提亮
  const SUNK = { f: "o", e: "n", g: "p", F: "n", d: "m", b: "n", z: "p", y: "p", x: "o", w: "o", v: "n", u: "m", c: "m" };   // 泡在胃液里
  let PB, h32;

  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  function spr(r, rows, x, y, flip) { r.blitRows(rows, x, y, !!flip); }
  function line(r, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) r.set(x0 + Math.round(((x1 - x0) * k) / n), y0 + Math.round(((y1 - y0) * k) / n), c);
  }

  // ---------- 背景：胃壁、血管、远处的肋骨、脊椎（按心跳画 3 版） ----------
  const RIBS = [
    { xt: 34, xb: 4, bow: -9 }, { xt: 84, xb: 60, bow: -7 }, { xt: 130, xb: 116, bow: -4 },
    { xt: 178, xb: 190, bow: 4 }, { xt: 226, xb: 248, bow: 7 }, { xt: 272, xb: 300, bow: 9 },
  ];
  function ribX(R, y, p) {
    const s = (y - 8) / 142, bow = R.bow + (R.bow < 0 ? -p : p);
    return R.xt + (R.xb - R.xt) * s + bow * Math.sin(Math.PI * s);
  }
  function paintBG(r, p) {
    for (let y = 0; y < H; y++) {
      const rx = RIBS.map((R) => ribX(R, Math.max(8, y), p));
      for (let x = 0; x < W; x++) {
        let c = h32(x, y, 71) % 41 === 0 ? "B" : "g";
        let i = 0; while (i < rx.length && rx[i] < x) i++;                            // 胃壁上的褶子：顺着肋骨弯
        const a = i ? rx[i - 1] : rx[0] - 54, b = i < rx.length ? rx[i] : rx[rx.length - 1] + 54;
        let u = ((x - a) / (b - a)) * 3 + 0.18 * Math.sin(y * 0.11 + i * 1.7); u -= Math.floor(u);
        if (u < 0.07 && h32(x >> 1, y >> 2, 70) % 5) c = "B";
        if (y < 44 && bayer(x, y) < (44 - y) >> 1) c = c === "B" ? "g" : "z";        // 顶上更暗
        r.set(x, y, c);
      }
    }
    if (p) for (let i = 0; i + 1 < RIBS.length; i++) {                              // 肋骨之间的肉壁鼓起来
      const cx = (ribX(RIBS[i], 78, 0) + ribX(RIBS[i + 1], 78, 0)) / 2, cy = 78, rx = 9 + p * 6, ry = 20 + p * 12;
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1 && bayer(x, y) < (1 - d) * (3 + p * 3)) { const k = r.get(x, y); r.set(x, y, k === "z" ? "g" : k === "g" ? "B" : k); }
      }
    }
    for (let v = 0; v < 5; v++) {                                                    // 血管：细细的，弯弯的，分个叉
      const x0 = 40 + v * 58 + (h32(v, 1, 72) % 16), y0 = 36 + (h32(v, 2, 72) % 40), n = 34 + (h32(v, 3, 72) % 24), dir = v & 1 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const x = x0 + Math.round(3 * Math.sin(k * 0.13 + v)), y = y0 + k;
        r.set(x, y, "h");
        if (k === 12) for (let j = 1; j < 12; j++) r.set(x + dir * Math.round(j * 0.7), y + j, "h");
      }
    }
    for (const R of RIBS) for (let y = 8; y < 152; y++) {                           // 远处的肋骨：朝中间那面受光
      const s = (y - 8) / 142, w = Math.round(5 + 4 * s), x0 = Math.round(ribX(R, y, p) - w / 2), left = R.bow < 0;
      for (let k = 0; k < w; k++) {
        const kk = left ? w - 1 - k : k;                                              // kk=0 是受光的一边
        r.set(x0 + k, y, kk === 0 ? "C" : kk === 1 && (y + R.xt) % 23 > 4 ? "C" : kk === w - 1 ? "z" : kk >= w - 2 ? "g" : "B");
      }
    }
    for (let x = 0; x < W; x++) {                                                    // 脊椎，中间留出喷气孔
      if (Math.abs(x - HOLE_X) < 13) continue;
      const sx = (x + 6) % 22;
      for (let y = 0; y < 10; y++) {
        if (sx >= 19) { r.set(x, y, "z"); continue; }
        if ((sx === 0 || sx === 18) && (y === 0 || y === 9)) continue;
        r.set(x, y, y >= 8 ? "g" : y === 1 || sx === 1 ? "C" : sx === 17 ? "g" : "B");
      }
    }
  }

  // ---------- 前景地形：右边的肉岸、前景的大肋骨（鲸虱在上面爬） ----------
  const fribX = (y) => { const s = y / SHORE_Y; return 300 + Math.round(8 * s + 7 * Math.sin(Math.PI * s)); };
  const fribW = (y) => 9 + Math.round((4 * y * y) / (SHORE_Y * SHORE_Y));
  function paintTerrain(r) {
    for (let x = 220; x < W; x++) {
      const top = x < SHORE_X ? SHORE_Y + Math.round(((SHORE_X - x) * (SHORE_X - x)) / 12) : SHORE_Y;
      for (let y = top; y < H; y++) {
        const k = y - top, fold = Math.sin(x * 0.11 + y * 0.6 + Math.sin(x * 0.05) * 3) > 0.8;
        r.set(x, y, k === 0 ? "D" : k < 3 ? "C" : fold ? "B" : k < 10 ? "C" : k < 13 ? (bayer(x, y) < 8 ? "C" : "B") : k < 24 ? "B" : bayer(x, y) < 6 ? "B" : "g");
      }
    }
    for (let y = 0; y < SHORE_Y + 2; y++) {
      const w = fribW(y), x0 = fribX(y) - (w >> 1);
      for (let k = 0; k < w; k++) {
        const knob = (y + 3) % 19 < 2;                                               // 一节一节的
        r.set(x0 + k, y, k === 0 || k === w - 1 ? "g" : k === 1 ? "D" : k === 2 && !knob ? "E" : k >= w - 3 ? "B" : knob ? "B" : "C");
      }
    }
  }

  // ---------- 喷气孔和漏进来的白光 ----------
  function lightDensity(e) { const p = e % BLOW; return p < 4 ? (p + 1) * 3 : p < 16 ? 13 : p < 20 ? (20 - p) * 3 : 0; }
  function drawBlowhole(r, dens) {
    for (let y = 0; y < 12; y++) for (let x = HOLE_X - 15; x <= HOLE_X + 15; x++) {
      const dx = (x - HOLE_X) / 15, dy = y / 11, d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c = d > 0.72 ? (y < 2 ? "B" : "C") : d > 0.55 ? "g" : "z";
      if (c === "z" && dens) c = bayer(x, y) < dens ? (d < 0.2 ? "t" : "u") : "v";
      r.set(x, y, c);
    }
  }
  function drawShaft(r, dens, e) {
    if (!dens) return;
    for (let y = 10; y < DECK_Y; y++) {
      const half = 6 + (y - 10) * 0.08;
      for (let x = Math.floor(HOLE_X - half - 1); x <= HOLE_X + half + 1; x++) {
        const d = Math.abs(x - HOLE_X) / half; if (d > 1.1) continue;
        const lim = dens * (d > 0.75 ? 0.45 : 1) - ((y - 10) / (DECK_Y - 10)) * 4;
        if (bayer(x, y) < lim) { const m = WHITE[r.get(x, y)]; if (m) r.set(x, y, m); }
      }
    }
    for (let i = 0; i < 12; i++) {                                                   // 喷进来的细水珠
      const hh = h32(i, 9, 75), y = 12 + (((hh % 110) + e * (2 + ((hh >>> 8) % 2))) % 112);
      const x = HOLE_X + ((hh >>> 4) % 13) - 6;
      if (bayer(x, y) < dens + 2) r.set(x, y, (hh >>> 12) % 3 ? "u" : "t");
    }
  }

  // ---------- 食道口和灌进来的海水 ----------
  function drawThroat(r, open) {
    const cx = 12, cy = 80, rx = 12, ry = 7 + open;
    for (let y = cy - ry - 3; y <= cy + ry + 3; y++) for (let x = 0; x <= cx + rx + 3; x++) {
      const d = ((x - cx) / (rx + 3)) ** 2 + ((y - cy) / (ry + 3)) ** 2, di = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (di <= 1) r.set(x, y, open > 2 && di < 0.45 ? "y" : "z");
      else if (d <= 1) r.set(x, y, y < cy ? "B" : di < 1.3 ? "D" : "C");             // 肉唇
    }
  }
  function drawStream(r, e, surf) {
    for (let y = 86; y < surf; y++) {
      const sp = Math.min(3, (y - 86) >> 4), x0 = 8 - sp, x1 = 16 + sp;
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1;
        r.set(x, y, edge ? "y" : (((y - e * 5 + x * 2) % 9) + 9) % 9 < 2 ? "u" : (((y - e * 5 - x) % 7) + 7) % 7 < 2 ? "r" : "q");
      }
    }
    for (let i = 0; i < 9; i++) { const hh = h32(i, e, 76); r.set(1 + (hh % 28), surf - 1 - ((hh >>> 5) % 4), hh % 3 ? "u" : "t"); }   // 水花
  }

  // ---------- 胃液池（acid）和涨起来的海水（tide） ----------
  function drawLiquid(r, e, surf, sea, front) {
    for (let x = 0; x < POOL_X1; x++) for (let y = surf; y < H; y++) {
      const k = y - surf;
      let c = k === 0 ? ((x + e * 3) % 29 < 3 || (x * 7 + e * 2) % 41 < 2 ? "l" : "m") : k === 1 ? ((x - e * 2) % 13 < 4 ? "m" : "n")
        : k < 9 ? (k > 5 && bayer(x, y) < (k - 5) * 4 ? "o" : "n") : k < 20 ? ((x + e + k * 5) % 37 < 6 && k < 14 ? "n" : "o") : "p";
      if (sea && x < front && k <= MAXLV + 2) {                                        // 海水浮在上面，越往右越淡
        const dd = sea - (x / front) * 6 - k * 0.8;
        if (bayer(x, y) < dd) c = k === 0 ? "u" : k < 3 ? "r" : "q";
      }
      r.set(x, y, c);
    }
  }
  function drawBubbles(r, e, surf) {
    for (let i = 0; i < 12; i++) {                                                   // 胃液里冒上来的泡
      const hh = h32(i, 3, 77), x = 4 + (hh % 236), depth = H - surf;
      const y = H - 1 - ((e + ((hh >>> 8) % 40)) % (depth + 4));
      if (y <= surf) { r.set(x, surf - 1, "l"); continue; }
      r.set(x, y, y - surf < 6 ? "l" : "m");
    }
    for (let i = 0; i < 7; i++) {                                                    // 一缕缕酸气
      const hh = h32(i, 5, 78), x = 24 + (hh % 210), k = (e + ((hh >>> 8) % 12)) % 12;
      if (k < 7) r.set(x + (k >> 2), surf - 2 - k, k < 3 ? "m" : "n");
    }
  }

  // ---------- 半截沉船、旧渔网、套娃箱 ----------
  const SHIP_X0 = 62, SHIP_X1 = 180, MAST_X = 112;
  function drawShip(r, dy, surf, e) {
    for (let x = 68; x <= 92; x++) for (let y = dy - 17; y < dy - 2; y++) {           // 船尾的小舱（下半截被船舷挡住）
      const k = y - (dy - 17);
      let c = k < 2 ? (k === 0 ? "F" : "e") : x === 68 || x === 92 ? "g" : (x - 68) % 6 === 0 ? "g" : "f";
      if (x >= 76 && x <= 81 && k >= 5 && k <= 9) c = k === 5 ? "g" : "z";            // 黑洞洞的窗
      r.set(x, y, c);
    }
    for (let y = dy - 58; y < dy; y++) for (let k = 0; k < 3; k++) {                 // 折断的桅杆
      if (y < dy - 54 && (k + y) % 3 === 0) continue;
      r.set(MAST_X + k, y, k === 0 ? "e" : k === 1 ? "f" : "g");
    }
    line(r, MAST_X - 18, dy - 40, MAST_X + 30, dy - 47, "f"); line(r, MAST_X - 18, dy - 39, MAST_X + 30, dy - 46, "g");   // 歪掉的帆桁
    for (let x = MAST_X + 3; x <= MAST_X + 28; x++) {                                // 旧渔网：从帆桁垂到甲板
      const yt = dy - 46 + Math.round(((x - MAST_X - 30) * -7) / 48) + 1;
      const yb = dy - 1 - Math.round(Math.max(0, x - MAST_X - 14) * 0.6) - (x > MAST_X + 24 ? 6 : 0);
      for (let y = yt; y <= yb; y++) {
        const sw = tri(e + (y >> 2), 16, 1);
        if ((((x + sw + y) & 3) === 0 || ((x + sw - y) & 3) === 0) && h32(x, y, 82) % 9) r.set(x + sw, y, (x + y) % 7 ? "w" : "v");
      }
    }
    for (let x = 92; x <= 158; x++) {                                                // 船舷上的栏杆，中间断了一截
      if (x > 126 && x < 138) continue;
      if ((x - 92) % 8 === 0) for (let y = dy - 5; y < dy; y++) r.set(x, y, "f");
      if (x < 150) r.set(x, dy - 6, "e");
    }
    for (const [fx, fy] of [[160, dy - 6], [168, dy + 1]]) for (let y = fy; y < dy + 8; y++) { r.set(fx, y, "f"); r.set(fx + 1, y, "g"); }   // 断口露出的船肋
    for (let x = SHIP_X0; x <= SHIP_X1; x++) {                                       // 船身：船尾翘起，船头那半截断掉了
      const st = Math.max(0, 86 - x);
      const brk = x > 160 ? (h32(x >> 1, 0, 79) % 7) + ((x - 160) >> 1) : 0;
      const top = dy - Math.round(st * 0.45) + brk;
      const bot = dy + 30 - Math.round((st * st) / 40) - (x > 166 ? (x - 166) * 2 : 0);
      for (let y = top; y <= bot; y++) {
        const k = y - top;
        let c = k === 0 ? (brk ? "e" : "F") : k === 1 ? "e" : y === bot ? "g" : (y - dy + 40) % 4 === 0 ? "g" : h32(x >> 2, y, 80) % 7 === 0 ? "e" : "f";
        if (x === SHIP_X0) c = "g";
        if (y >= surf) c = SUNK[c] || c;
        r.set(x, y, c);
      }
    }
  }
  function nestedBox(r, x, y) {                        // 箱子里套箱子
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const ring = Math.min(i, j, 15 - i, 15 - j);
      const c = ring === 0 || ring === 3 || ring === 6 ? "z" : ring === 1 ? "d" : ring === 2 ? "b" : ring === 4 ? "F" : ring === 5 ? "e" : "d";
      r.set(x + i, y + j, c);
    }
  }
  function drawRemora(r, x, y, t) {                   // 小鮣鱼：头顶吸盘贴着箱子，尾巴左右摆
    spr(r, [".wwwww..", "vzvvvvvv", "uuuuuvvv", ".wwwwww."], x, y);
    r.set(x + 1, y - 1, "v"); r.set(x + 3, y - 1, "v");
    const off = [0, -1, 0, 1][(t >> 1) & 3];
    r.set(x + 8, y + 1 + off, "v"); r.set(x + 8, y + 2 + off, "v"); r.set(x + 9, y + off, "w"); r.set(x + 9, y + 3 + off, "w");
  }

  // ---------- 怪物：鲸虱（扁扁一群，在前景大肋骨上爬） ----------
  const LOUSE = [                                    // 从上面看：扁扁的椭圆身子，两边一排钩爪
    ["g..ccc..g", ".gcFFFcg.", "g.cFeFc.g", ".gcFFFcg.", "...fff..."],
    [".g.ccc.g.", "g.cFFFc.g", ".gcFeFcg.", "g.cFFFc.g", "...fff..."],
  ];
  function drawLice(r, t) {
    const base = 52 + tri(t, 208, 34), up = ((t % 208) + 208) % 208 >= 104;           // 一起往上爬一阵，再往下爬
    for (let i = 0; i < 5; i++) {
      const y = base + i * 8 + tri(t + i * 7, 14, 1), x = fribX(y) - 4 + [0, 1, -1, 1, 0][i];
      const rows = LOUSE[((t >> 1) + i) & 1];
      spr(r, up ? rows : rows.slice().reverse(), x, y);
    }
  }

  // ---------- 比例尺：主角大小的人影（16×16，唯一的暖色高饱和）和箱子 ----------
  const PERSON = [
    "................",
    "......zzzz......",
    ".....zkllkz.....",
    ".....zkkkkz.....",
    "...zzkkkkkkzz...",
    "...zkkkkkkkkkz..",
    "....zEEEEEFz....",
    "....zEEEzEFz....",
    "....zFEEEFFz....",
    "...zhiiiiiihz...",
    "..zhiiiiiiiihz..",
    "..zhiiiiiiiihz..",
    "..zEhiiiiiihEz..",
    "...zhhhhhhhhz...",
    "....zxxzzxxz....",
    "....zffzzffz....",
  ];
  function crate(r, x, y) {
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      let c;
      if (i === 0 || j === 0 || i === 15 || j === 15) c = "z";
      else if (j === 1 || i === 1) c = "d";
      else if (j === 14 || i === 14) c = "f";
      else if (j === 2 || i === 2 || j === 13 || i === 13) c = "e";
      else if (i + j === 15 || i + j === 16) c = "d";
      else if (i + j === 17) c = "f";
      else c = j === 6 || j === 10 ? "e" : "b";
      r.set(x + i, y + j, c);
    }
  }

  // ---------- 一帧 ----------
  let BGS = null, TER = null, frame = null;
  function build() {
    PB = root.PB; h32 = PB.h32;
    BGS = [0, 1, 2].map((p) => { const r = new PB.Raster(W, H); paintBG(r, p); return r; });
    TER = new PB.Raster(W, H); paintTerrain(TER);
  }
  function draw(ctx, tick) {
    if (!BGS) build();
    const t = tick | 0, e = t >> 1;
    if (!frame) frame = new PB.Raster(W, H);
    const r = frame;
    r.data.set(BGS[BEAT[e % BEAT.length]].data);
    // 喷气孔的光
    const dens = lightDensity(e);
    drawShaft(r, dens, e);
    drawBlowhole(r, dens);
    // 鲸喝水：灌水 3 秒水位涨起，再慢慢退
    const g = e % GULP, pour = g < POUR;
    const lv = pour ? Math.round((g * MAXLV) / POUR) : Math.round(MAXLV - ((g - POUR) * MAXLV) / (GULP - POUR));
    const surf = ACID_Y - lv, sea = pour ? 16 : Math.max(0, Math.round(16 - ((g - POUR) * 16) / 30));
    drawThroat(r, pour ? 4 : g < POUR + 3 ? 2 : 0);
    if (pour) drawStream(r, e, surf);
    drawLiquid(r, e, surf, sea, pour ? 30 + g * 16 : 240);
    // 沉船跟着水位一起浮上浮下
    const dy = DECK_Y - lv + (tri(e, 24, 1) > 0 ? 1 : 0);
    drawShip(r, dy, surf, e);
    nestedBox(r, 146, dy - 16);
    drawRemora(r, 148, dy - 8, t);
    for (const x of [SHIP_X0 + 2, 120 + (e % 5) * 9, SHIP_X1 - 4]) if (x < SHIP_X1) r.set(x + (e & 1), surf - 1, "l");   // 吃水线冒泡
    drawBubbles(r, e, surf);
    r.blit(TER, 0, 0);
    drawLice(r, t);
    crate(r, 266, SHORE_Y - 16);
    spr(r, PERSON, 248, SHORE_Y - 16);
    ctx.putImageData(new ImageData(r.data, W, H), 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES["whale_belly"] = { draw };
})(typeof window !== "undefined" ? window : globalThis);
