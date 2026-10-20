/* ART-04n 地图概念场景 · 热气球谷（balloon_valley）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180 侧视，只用 ENDESGA 32，整数像素，不抗锯齿、不混色。
 * 日出前后：杏粉色的凝灰岩、淡粉蓝的天、条纹热气球的饱和色；太阳刚在左边的台地后冒头，
 * 岩石尖上一圈粉金（D / k 提亮一级，只照背景层），谷底还在淡蓝阴影里（w / v）。
 * 调色板没有淡粉蓝：天空用 v 加 D 的分档 Bayer 抖动，越近地平线越粉；太阳周围提亮一级到 E。
 * 地标：一根根戴“帽子”的烟囱岩、凿在岩里的门窗和鸽子房、几十个条纹热气球、吊篮下的木头起降台。
 * 机关外观（不实现规则）：热气球吊篮当升降台，在起降台和上方木平台之间升降、到站停靠（lift）；
 * 阵风线只画在 3×2 个机关格里，按节奏一阵一阵（gust）；压板和凿在岩里的门（plate_door）。
 * 环境（4 fps，tick >> 1）：远近几十个热气球缓缓升降，喷火时球体一亮一亮；谷底的晨雾慢慢退去、又慢慢漫回。
 * 动物（8 fps）：岩鸽群（怪物，从鸽子房的小洞一窝蜂冲出来，兜一圈再回去）、
 * 安纳托利亚牧羊犬（提示动物，奶油色黑脸，坐在岩顶摇尾巴）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。
 * 只读使用 workbench/js/core/raster.js 的 PB.Raster / PB.h32。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: valley floor
  const PILLAR_X = 2 * 16, PILLAR_Y = OY + 6 * 16; // rock pillar on the left (x < 32, top y = 100); the dog sits on it
  const PAD_X = 4 * 16, PAD_W = 4 * 16, PAD_Y = OY + 8 * 16;   // wooden launch pad x 64–127, deck top y = 132
  const BASKET_X = 88, BASKET_W = 32;             // the lift basket spans two cells (x 88–119)
  const TOP_Y = OY + 4 * 16;                      // upper station: deck top y = 68
  const LAND_X = 120, LAND_W = 40;                // upper wooden landing x 120–159, braced into the chimney
  const CHIM_X = 10 * 16, CHIM_W = 3 * 16;        // big fairy chimney (terrain) x 160–207
  const DOOR_X = 11 * 16, PLATE_X = 9 * 16;       // door carved at its foot (x 176), plate on the floor (x 144)
  const SHELF_X = 16 * 16, SHELF_Y = OY + 7 * 16; // rock shelf on the right: x ≥ 256, top y = 116
  const GUST = { x: 13 * 16, y: OY + 2 * 16, w: 3 * 16, h: 2 * 16 };   // gust cells x 208–255, y 36–67
  const HORIZON = 106;                            // top of the far plateau
  const SUN = { x: 42, y: HORIZON + 1 };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null;

  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip, map) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        let c = row[flip ? w - 1 - i : i];
        if (c === ".") continue;
        if (map && map[c]) c = map[c];
        r.set(x + i, y + j, c);
      }
    }
  }
  function line(r, x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      r.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // ---- palette roles ----
  // Background lighting goes one palette step at a time (Bayer-dithered edges, no blending):
  // ROSE lifts rock and sky towards the pink-gold of the first sun; SHADE drops the tuff into the pale blue
  // shadow of the valley floor; MIST lifts whatever is behind the morning mist one step towards grey-blue.
  const ROSE = { F: "D", E: "D", e: "F", f: "e", x: "C", w: "C", v: "E", g: "f" };
  const SHADE = { E: "v", F: "w", e: "x", f: "x", D: "v", d: "v", c: "v", g: "y" };
  const MIST = { x: "w", w: "v", y: "x", e: "F", f: "e", F: "E", g: "f" };
  const FLARE = { h: "a", a: "b", b: "d", q: "r", n: "m", o: "n", B: "C", C: "D", f: "e", x: "w", w: "v" };

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                // protagonist-sized figure, facing right
    "................",
    "......zzzz......",
    ".....zllkkz.....",
    "....zlkkkkkz....",
    "..zzkkkkkkkkzz..",
    ".zbkkkkkkkkkkbz.",
    "..zzEEEEEEEEzz..",
    "...zEEEEEzEEz...",
    "...zFEEEEEEFz...",
    "....zhiiiiiz....",
    "...zhiiiiiiiz...",
    "..zEhiiiiiiiEz..",
    "..zzhhiiiiihzz..",
    "....zxxzzxxz....",
    "....zxxzzxxz....",
    "...zffzzzzffz...",
  ];
  const CRATE = (() => {                          // wooden box: lit top/left, shaded bottom/right, diagonal brace
    const rows = [];
    for (let j = 0; j < 16; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        const k = i + j;
        if (i === 0 || j === 0 || i === 15 || j === 15) s += "z";
        else if (i === 14 || j === 14) s += "f";
        else if (i === 1 || j === 1) s += "d";
        else if (i === 2 || j === 2 || i === 13 || j === 13) s += "e";
        else if (k === 15) s += "d";
        else if (k === 16) s += "e";
        else s += j === 8 ? "e" : "b";
      }
      rows.push(s);
    }
    return rows;
  })();
  const DOOR = (() => {                           // iron door 16×32: vertical bars, two riveted straps
    const rows = [];
    for (let j = 0; j < 32; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        if (i === 0 || j === 0 || i === 15 || j === 31) s += "z";
        else if (j === 1) s += "v";
        else if (i === 14 || j === 30) s += "x";
        else if (j === 8 || j === 23) s += (i % 3 === 2) ? "u" : "v";
        else if (j === 9 || j === 24) s += "x";
        else if (i === 1) s += "v";
        else s += (i - 2) % 3 === 0 ? "v" : (i - 2) % 3 === 1 ? "w" : "x";
      }
      rows.push(s);
    }
    return rows;
  })();
  const PLATE = [                                 // pressure plate with the pink triangle of its door
    ".zzzzzzzzzzzzzz.",
    "zvvvvvvvvvvvvvvz",
    "zwwwwwwDwwwwwwxz",
    "zwwwwwDDDwwwwwxz",
    "zzzzzzzzzzzzzzzz",
  ];
  const PLAQUE = ["zzzzzzz", "zxxDxxz", "zxDDDxz", "zDDDDDz", "zzzzzzz"];
  // Anatolian shepherd sitting, facing right: cream coat, black mask and ears; the tail is drawn per frame.
  const DOG = [
    "..........zzz...",
    ".........zcccz..",
    "........zyccczz.",
    "........zyczcyyz",
    "........zyyccyyz",
    ".........zcccz..",
    "........zcccccz.",
    ".......zccccccz.",
    "......zcccccEcz.",
    ".....zcccccEcEz.",
    "....zcccccczEcz.",
    "....zEcccccEzEz.",
    "....zEEccEEzzEz.",
    ".....zzzzzzz.zz.",
  ];
  const DOG_TAIL = [                              // tail pixels (the outline is added around them): up, out, down
    [[3, 10], [2, 9], [1, 8], [1, 7], [2, 6], [3, 6]],
    [[3, 11], [2, 11], [1, 10], [0, 10], [-1, 9]],
    [[3, 12], [2, 12], [1, 13], [0, 13], [-1, 13]],
  ];
  const PIGEON = [                                // rock pigeon in flight, facing left: wings up / level / down
    [".......z..", "......zvz.", ".....zvwz.", ".zz.zvwz..", "zxxzwwwwzz", ".zzwwwwwxz", "...zzzzzz.", ".........."],
    ["..........", "..........", ".zz.......", "zxxzzzzz..", ".zwvvvvwzz", "..zwwwwwxz", "...zzzzzz.", ".........."],
    ["..........", "..........", ".zz.......", "zxxzzzzzz.", ".zwwwwwwzz", "..zzvwwzxz", "...zvwz.z.", "....zz...."],
  ];

  // ---- static layers ----
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const sunDist = (x, y) => Math.hypot((x - SUN.x) / 1.6, y - SUN.y);   // the glow spreads wider than high
  // Sky: grey-blue v under a darker w band at the very top, turning pink towards the horizon (v dithered with D);
  // around the rising sun it lifts one step (ROSE) behind a Bayer edge. Nothing in the sky is lighter than E.
  const SKY_PINK = [[58, 2], [68, 4], [80, 6], [93, 8]];  // [from y, Bayer threshold of D in v] towards the horizon
  function skyCode(x, y) {
    let c = "v";
    if (y < 7) c = "w";
    else if (y < 11) c = (x + y) & 1 ? "w" : "v";
    else if (y < 15) c = bay(x, y) < 4 ? "w" : "v";
    else for (const [y0, th] of SKY_PINK) if (y >= y0) c = bay(x, y) < th ? "D" : "v";
    const d = sunDist(x, y);
    if (d < 27 && bay(x + 2, y + 1) < (27 - d) * 1.4) c = ROSE[c] || c;
    return c;
  }
  function plateauTop(x) {                        // the far plateau: a long low mesa, a little higher behind the chimney
    const rise = 3 * clamp01((x - 128) / 12) * clamp01((222 - x) / 12) + 2 * clamp01((x - 266) / 10);
    return HORIZON + Math.round(Math.sin(x / 13) + 0.6 * Math.sin(x / 4.7 + 1) - rise);
  }
  // Far plateau in the shade of the dawn: w with thin x strata, deeper x towards the valley; its rim catches the
  // sun only near it (k right beside the sun, then D, then a dithered C).
  function plateauCode(x, y, t) {
    if (y === t) {
      const dx = Math.abs(x - SUN.x);
      if (dx < 9) return "k";
      if (dx < 20) return "D";
      if (dx < 64 && bay(x, 1) < (64 - dx) * 0.4) return "C";
      return "w";
    }
    if (y > 124 || (y > 119 && (x + y) & 1)) return "x";                       // the valley below lies in deeper shade
    return (y - t + Math.round(Math.sin(x / 11 + 2))) % 7 === 4 ? "x" : "w";
  }
  // Far chimneys: small cones in the plateau's colour with a dark cap, the sunward ones rimmed with C / D.
  const FAR = [[52, 5, 9], [132, 5, 11], [145, 4, 6], [215, 5, 9], [249, 6, 12], [262, 4, 6], [300, 5, 8], [315, 4, 10]];
  function farChimney(r, cx, hw, h) {             // [x, half width at the foot, height above the plateau line]
    const t = plateauTop(cx), top = t - h, base = t + 6;
    for (let y = top; y < base; y++) {
      const w = Math.round(1 + (hw - 1) * Math.pow((y - top) / (base - top), 1.5));
      for (let x = cx - w; x <= cx + w; x++) r.set(x, y, x === cx + w && w > 1 ? "x" : "w");
    }
    const lit = Math.abs(cx - SUN.x) < 40 ? "D" : "C";
    for (let x = cx - 3; x <= cx + 3; x++) r.set(x, top - 1, x === cx + 3 ? "y" : "x");
    for (let x = cx - 2; x <= cx + 2; x++) r.set(x, top - 2, x < cx ? lit : "x");
    r.set(cx - 3, top - 1, lit);
  }
  function buildBack() {
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r.set(x, y, skyCode(x, y));
    for (let y = SUN.y - 6; y <= SUN.y; y++) for (let x = SUN.x - 6; x <= SUN.x + 6; x++) {   // the sun's half disc
      const d = (x - SUN.x) ** 2 + (y - SUN.y) ** 2;
      if (d <= 42) r.set(x, y, d > 26 ? "j" : "k");
    }
    for (let x = 0; x < W; x++) {
      const t = plateauTop(x);
      for (let y = t; y < H; y++) r.set(x, y, plateauCode(x, y, t));
    }
    for (const [cx, hw, h] of FAR) farChimney(r, cx, hw, h);
    return r;
  }

  // Background fairy chimneys: tuff cones (F, lit E on the left, e on the right, rain runnels) under dark basalt caps
  // whose upper-left rim takes the first sun (D, a little k); below the shade line each cone sinks into the pale blue
  // shadow of the valley (SHADE, Bayer edge). One is a dovecote: a whitewashed band with a row of small holes.
  const MIDS = [
    { cx: 60, top: 92, hw0: 2.5, hw1: 9, cap: 3, seed: 1 },
    { cx: 228, top: 78, hw0: 5, hw1: 15, cap: 5, seed: 2, window: [226, 94], door: [225, 128] },
    { cx: 292, top: 58, hw0: 9, hw1: 22, cap: 7, seed: 3, dovecote: 75 },
  ];
  const HOLES = [281, 287, 293, 299, 305];
  const shadeLine = (x) => 118 + Math.round(2 * Math.sin(x / 7) + Math.sin(x / 3.1));
  function midChimney(r, m) {
    const { cx, top, hw0, hw1, cap, seed } = m;
    for (let y = top; y < FLOOR; y++) {
      const hw = hw0 + (hw1 - hw0) * Math.pow((y - top) / (FLOOR - top), 1.7);
      const xl = Math.round(cx - hw), xr = Math.round(cx + hw);
      for (let x = xl; x <= xr; x++) {
        let c = x - xl < 2 ? "E" : xr - x < 3 ? "e" : "F";
        const run = hash(x, seed, 64);
        if (c === "F" && run % 6 === 0 && y - top < 8 + ((run >>> 9) % 34)) c = "e";
        if (y - top < 5 && x - xl < 3) c = "D";
        const sh = y - shadeLine(x);
        if (sh > 0 && bay(x, y) < sh * 2) c = SHADE[c] || c;
        r.set(x, y, c);
      }
    }
    const cw = Math.round(hw0) + 3, y0 = top - cap;
    for (let j = 0; j < cap; j++) {
      const inset = j === 0 ? 2 : j === 1 || j === cap - 1 ? 1 : 0;
      for (let x = cx - cw + inset; x <= cx + cw - inset; x++) {
        let c = j === cap - 1 ? "g" : hash(x, j, seed + 70) % 5 ? "f" : "g";
        if (j === 0 && x < cx + cw * 0.3) c = x < cx - cw + 5 ? "k" : "D";   // pink-gold rim of the first sun
        else if (x === cx - cw + inset && j < cap - 1) c = "D";
        r.set(x, y0 + j, c);
      }
    }
    if (m.window) {                               // an arched window, a doorway half lost in the shadow
      const [wx, wy] = m.window;
      spr(r, [".g.", "ggg", "ggg", "ggg"], wx, wy);
      const [dx, dy] = m.door;
      spr(r, [".yyy.", "yyyyy", "yyyyy", "yyyyy", "yyyyy", "yyyyy", "yyyyy"], dx, dy);
    }
    if (m.dovecote) {                             // whitewashed band, a row of holes for the pigeons
      const y = m.dovecote;
      for (let x = HOLES[0] - 3; x <= HOLES[HOLES.length - 1] + 4; x++) for (let j = 0; j < 6; j++) {
        if ((j === 0 || j === 5) && hash(x, j, 71) % 4 === 0) continue;
        r.set(x, y + j, j === 5 ? "F" : "E");
      }
      for (const hx of HOLES) spr(r, [".z.", "zzz", "zzz"], hx - 1, y + 1);
    }
  }
  function buildMid() {
    const r = layer();
    for (const m of MIDS) midChimney(r, m);
    return r;
  }

  // Tuff of the play plane: apricot E, softer orange layers d running level through every rock, vertical rain
  // runnels F, a 1 px lit top c, a few e grains deeper down. The terrain takes no dawn light or valley shadow.
  const DENSE = [0, 8, 6, 9, 13], RUN = [0, 30, 48, 18, 8];      // runnel density and length per rock (seed 1–4)
  function tuff(x, y, top, s) {
    const k = y - top;
    if (k === 0) return "c";
    const run = hash(x, s, 61);
    if (run % DENSE[s] === 0 && k > 1 && k < 3 + ((run >>> 8) % RUN[s])) return "F";
    const b = (y + Math.round(1.3 * Math.sin(x / 10) + 0.6 * Math.sin(x / 3.3))) % 12;
    if (k > 2 && (b === 6 || (b === 7 && Math.sin(x / 7 + y) > 0.4))) return "d";
    if (k > 20 && hash(x, y, 63) % 17 === 0) return "e";
    return "E";
  }
  const CAP_HW = [14, 19, 22, 24, 26, 27, 27, 27, 27, 27, 27, 26, 25, 24, 23, 21];
  function chimneySpan(y) {                       // the big chimney narrows a little under its cap
    const inset = y < 72 ? Math.round((3 * (72 - y)) / 20) : 0;
    return [CHIM_X + inset, CHIM_X + CHIM_W - 1 - inset];
  }
  function basalt(r, x, y, first, last, s) {      // dark basalt cap: lit top e, shaded underside g
    r.set(x, y, first ? "e" : last ? "g" : hash(x, y, s) % 13 === 0 ? "g" : hash(x, y, s + 1) % 37 === 0 ? "e" : "f");
  }
  function plank(r, x0, w, y) {                   // a deck beam: lit top d, b with a few e grains, f underside
    for (let x = x0; x < x0 + w; x++) {
      const seam = (x - x0) % 16 === 15;
      r.set(x, y, "d");
      r.set(x, y + 1, seam ? "f" : "b");
      r.set(x, y + 2, seam ? "f" : hash(x, y, 66) % 5 ? "b" : "e");
      r.set(x, y + 3, "f");
    }
  }
  function brace(r, x0, y0, x1, y1) { line(r, x0, y0, x1, y1 - 1, "e"); line(r, x0, y0 + 1, x1, y1, "f"); }
  function buildGround() {
    const r = layer();
    for (let x = 0; x < W; x++) {
      const inChim = x >= CHIM_X && x < CHIM_X + CHIM_W;
      const s = x < PILLAR_X ? 1 : inChim ? 2 : x >= SHELF_X ? 3 : 4;
      const top = s === 1 ? PILLAR_Y + 5 : s === 2 ? 51 : s === 3 ? SHELF_Y : FLOOR;
      for (let y = Math.max(top, s === 2 ? 52 : top); y < H; y++) {
        if (s === 1 && x > 29 && y < PILLAR_Y + 12) continue;               // neck under the pillar's cap
        if (inChim) { const [xl, xr] = chimneySpan(y); if (x < xl || x > xr) continue; }
        let c = tuff(x, y, top, s);
        if (s === 1 && y === top) c = "F";                                    // just under the cap
        if ((s === 1 && x === (y < PILLAR_Y + 12 ? 29 : PILLAR_X - 1) && y < FLOOR) || (inChim && x === chimneySpan(y)[1] && y < FLOOR)) c = c === "c" ? c : "F";
        r.set(x, y, c);
      }
    }
    for (let y = PILLAR_Y; y < PILLAR_Y + 5; y++) for (let x = 0; x < PILLAR_X + 2; x++) {   // the pillar's cap
      if (y === PILLAR_Y && x > PILLAR_X - 1) continue;
      if (y === PILLAR_Y + 4 && x > PILLAR_X) continue;
      basalt(r, x, y, y === PILLAR_Y || (x === PILLAR_X + 1 && y === PILLAR_Y + 1), y === PILLAR_Y + 4 || (x === PILLAR_X + 1 && y === PILLAR_Y + 3), 67);
    }
    for (let j = 0; j < CAP_HW.length; j++) {     // the big chimney's basalt hat
      const hw = CAP_HW[j], y = OY + 2 * 16 + j;
      for (let x = 184 - hw; x <= 183 + hw; x++) {
        const above = j === 0 || Math.abs(x - 183.5) > CAP_HW[j - 1];
        const below = j === CAP_HW.length - 1 || Math.abs(x - 183.5) > CAP_HW[j + 1];
        basalt(r, x, y, above, below, 68);
      }
    }
    for (let y = 110; y < FLOOR; y++) for (let x = DOOR_X - 2; x < DOOR_X + 18; x++) {   // the doorway cut into it
      const arch = y >= 116 || (x - (DOOR_X + 7.5)) ** 2 + ((y - 116) * 1.6) ** 2 <= 100;
      if (!arch) continue;
      const edge = y < 116 && (x - (DOOR_X + 7.5)) ** 2 + ((y - 115) * 1.6) ** 2 > 100;
      r.set(x, y, edge ? "f" : x < DOOR_X + 8 ? "e" : "F");
    }
    // wooden launch pad on three posts with diagonal braces, and the upper landing braced into the chimney
    plank(r, PAD_X, PAD_W, PAD_Y);
    for (const px of [PAD_X + 1, PAD_X + 30, PAD_X + 60]) for (let y = PAD_Y + 4; y < FLOOR; y++) {
      r.set(px, y, "b"); r.set(px + 1, y, "e"); r.set(px + 2, y, "f");
    }
    brace(r, PAD_X + 4, PAD_Y + 4, PAD_X + 29, FLOOR - 2);
    brace(r, PAD_X + 33, PAD_Y + 4, PAD_X + 59, FLOOR - 2);
    plank(r, LAND_X, LAND_W, TOP_Y);
    brace(r, LAND_X + 3, TOP_Y + 4, CHIM_X - 1, TOP_Y + 30);
    brace(r, LAND_X + 21, TOP_Y + 4, CHIM_X - 1, TOP_Y + 16);
    return r;
  }
  function build() {
    PB = window.PB;
    const props = layer();
    spr(props, PORTER, PAD_X, PAD_Y - 16);
    spr(props, CRATE, PLATE_X - 16, FLOOR - 16);
    spr(props, PLATE, PLATE_X, FLOOR - 5);
    spr(props, DOOR, DOOR_X, FLOOR - 32);
    spr(props, PLAQUE, DOOR_X + 4, 100);
    L = { back: buildBack(), mid: buildMid(), ground: buildGround(), props };
  }

  // ---- balloons ----
  // Striped hot-air balloons of the background in mid-dark saturated colours, kept off the porter's bright yellow and
  // red (k / l / i) and all darker than the tuff of the play plane; the right side of each envelope steps down one palette step (BSHADE).
  // When a burner fires the envelope lifts one step (FLARE) for two frames and a flame shows under the mouth.
  const BSHADE = { h: "g", a: "h", b: "a", q: "y", r: "q", B: "g", C: "B", D: "C", n: "o", o: "p", m: "n", f: "g", e: "f", x: "y", w: "x", F: "e", i: "h", j: "a" };
  function envelopeHW(j, w, h) {                  // half width of envelope row j (0 = crown)
    const R = w / 2, eq = Math.round(h * 0.45);
    if (j < eq) { const d = R - ((j + 0.5) * R) / eq; return Math.sqrt(Math.max(0, R * R - d * d)); }
    const mouth = Math.max(0.6, w * 0.12);
    return R - (R - mouth) * Math.pow((j - eq + 1) / (h - eq), 1.25);
  }
  function drawEnvelope(r, x0, y0, w, h, cols, shade, flare, outline, flareFrom) {
    const c0 = x0 + w / 2, N = cols.length;
    const spans = [];
    for (let j = 0; j < h; j++) {
      const hw = envelopeHW(j, w, h);
      spans.push([Math.round(c0 - hw), Math.round(c0 + hw) - 1, hw]);
    }
    for (let j = 0; j < h; j++) {
      const [xl, xr, hw] = spans[j];
      for (let x = xl; x <= xr; x++) {
        const u = Math.max(-1, Math.min(1, (x + 0.5 - c0) / Math.max(hw, 0.5)));
        let c = cols[Math.min(N - 1, Math.floor((Math.asin(u) / Math.PI + 0.5) * N))];
        if (u > 0.5) c = shade[c] || c;
        if (flare && j >= flareFrom) c = flare[c] || c;
        if (outline) {
          const up = j === 0 || x < spans[j - 1][0] || x > spans[j - 1][1];
          const dn = j === h - 1 || x < spans[j + 1][0] || x > spans[j + 1][1];
          if (x === xl || x === xr || up || dn) c = "z";
        }
        r.set(x, y0 + j, c);
      }
    }
    return spans[h - 1];
  }
  // Tiny far balloons: hand-drawn teardrops, "0" the first stripe colour, "1" the second, "g" the basket.
  const TINY = {
    3: [".0.", "001", "011", ".1.", "...", ".g."],
    4: [".01.", "0011", "0011", ".01.", "....", ".gg."],
    5: [".001.", "00111", "00111", ".011.", "..1..", ".....", "..g.."],
  };
  const FAR_B = [
    [6, 14, 3, "xw"], [24, 40, 4, "Bx"], [48, 6, 4, "fx"], [70, 24, 3, "hf"], [72, 46, 3, "qx"], [130, 4, 3, "ox"],
    [128, 38, 4, "CB"], [156, 28, 3, "xw"], [166, 4, 3, "af"], [198, 4, 4, "Bx"], [204, 24, 3, "qx"], [216, 22, 4, "hf"],
    [244, 6, 3, "ox"], [252, 26, 3, "CB"], [302, 8, 3, "xw"], [314, 40, 3, "fx"], [36, 84, 3, "Bx"], [134, 96, 3, "xw"],
  ].map(([x, y, s, c], i) => ({ x, y, s, c, P: 40 + ((i * 23) % 41), A: 1 + (i % 3), ph: (i * 17) % 40 }));
  const MID_B = [
    { x: 32, y: 30, w: 11, c: ["h", "a"] }, { x: 56, y: 60, w: 9, c: ["q", "w"] }, { x: 136, y: 16, w: 11, c: ["B", "C"] },
    { x: 178, y: 10, w: 9, c: ["n", "o"] }, { x: 228, y: 14, w: 9, c: ["a", "b"] }, { x: 10, y: 56, w: 9, c: ["B", "D"] },
    { x: 306, y: 26, w: 7, c: ["q", "r"] },
  ].map((b, i) => Object.assign(b, { P: 48 + ((i * 19) % 33), A: 3 + (i % 4), ph: (i * 29) % 48, fp: 7 + (i % 3) * 2 }));
  const NEAR_B = { x: 266, y: -3, w: 22, c: ["q", "r", "q", "x"], P: 72, A: 4, ph: 20, fp: 9 };
  const bob = (b, a) => Math.round(b.A * Math.sin((2 * Math.PI * (a + b.ph)) / b.P));
  const firing = (b, a, i) => Math.cos((2 * Math.PI * (a + b.ph)) / b.P) < 0 && (a + i * 5) % b.fp < 2;   // only when rising
  function drawFarBalloons(r, a) {
    FAR_B.forEach((b) => spr(r, TINY[b.s], b.x, b.y + bob(b, a), false, { 0: b.c[0], 1: b.c[1] }));
  }
  function drawBalloon(r, b, a, i) {
    const y = b.y + bob(b, a), h = Math.round(b.w * 1.1), fire = firing(b, a, i);
    const [ml, mr] = drawEnvelope(r, b.x, y, b.w, h, b.c, BSHADE, fire ? FLARE : null, false, 0);
    const by = y + h + 2, bw = b.w >= 9 ? 3 : 2, bx = b.x + Math.round((b.w - bw) / 2);
    r.set(ml, y + h, "f"); r.set(mr, y + h, "f");                    // ropes down to the basket
    if (b.w >= 9) { r.set(ml, y + h + 1, "f"); r.set(mr, y + h + 1, "f"); }
    for (let i2 = 0; i2 < bw; i2++) { r.set(bx + i2, by, "f"); if (b.w >= 9) r.set(bx + i2, by + 1, "g"); }
    if (fire) r.set(b.x + (b.w >> 1), y + h, "j");
  }

  // ---- lift (machine look only): a balloon basket rising between the launch pad and the upper landing ----
  // Bottom station 16 frames → up 2 px a frame (burner flaring on and off) → top station 16 frames → down again.
  const BASKET = (() => {
    const rows = [];
    for (let j = 0; j < 12; j++) {
      let s = "";
      for (let i = 0; i < BASKET_W; i++) {
        if (i === 0 || i === BASKET_W - 1 || j === 0 || j === 11 || j === 3) s += "z";
        else if (j === 1) s += "d";
        else if (j === 2) s += i === BASKET_W - 2 ? "f" : "b";
        else if (j === 10) s += "f";
        else if (i === 1) s += "d";
        else if (i === BASKET_W - 2) s += "f";
        else if (i % 4 === 2) s += j & 1 ? "f" : "e";
        else s += j & 1 ? "e" : "b";
      }
      rows.push(s);
    }
    return rows;
  })();
  const LIFT_COLS = ["D", "C", "B", "C", "D", "C", "B", "C"];
  const LIFT_SHADE = { D: "C", C: "B", B: "g" };
  const LIFT_FLARE = { g: "B", B: "C", C: "D", D: "E" };
  function liftState(a) {
    const p = a % 96;
    if (p < 16) return { y: PAD_Y, fire: p >= 12 };
    if (p < 48) return { y: PAD_Y - 2 * (p - 16), fire: (p & 3) < 2 };
    if (p < 64) return { y: TOP_Y, fire: false };
    return { y: TOP_Y + 2 * (p - 64), fire: false };
  }
  function drawLift(r, a) {
    const { y: by, fire } = liftState(a), top = by - 12, cx = BASKET_X + BASKET_W / 2;
    drawEnvelope(r, cx - 18, by - 61, 36, 38, LIFT_COLS, LIFT_SHADE, fire ? LIFT_FLARE : null, true, 14);
    for (const [x0, x1] of [[BASKET_X + 1, cx - 4], [BASKET_X + 9, cx - 2], [BASKET_X + BASKET_W - 10, cx + 1], [BASKET_X + BASKET_W - 2, cx + 3]]) {
      line(r, x0, top - 1, x1, by - 18, "f");     // ropes from the basket rim to the burner frame
    }
    spr(r, ["zzzzzzzz", "zwvvvwxz", "zzzzzzzz"], cx - 4, by - 21);   // burner
    r.set(cx - 3, by - 22, "x"); r.set(cx + 2, by - 22, "x"); r.set(cx - 3, by - 23, "x"); r.set(cx + 2, by - 23, "x");
    if (fire) { r.set(cx - 1, by - 22, "k"); r.set(cx, by - 22, "j"); r.set(cx - 1, by - 23, "j"); if (a & 1) r.set(cx, by - 23, "k"); }
    spr(r, BASKET, BASKET_X, top);
  }

  // ---- gust (machine look only): every 16 frames a gust blows for 6; broken wind lines kept inside the 3 × 2 cells ----
  const STREAKS = [[4, 0, 22, 1], [10, 3, 14, 0], [16, 1, 26, 1], [22, 4, 16, 0], [28, 2, 12, 1]];   // [y, delay, length, curl]
  function drawGust(r, a) {
    const p = a % 16;
    if (p >= 6) return;
    const inCells = (x) => x >= GUST.x + 1 && x <= GUST.x + GUST.w - 2;
    for (const [dy, lag, len, curl] of STREAKS) {
      const head = GUST.x + 8 + (p * 13) - lag * 4, y0 = GUST.y + dy;
      const wy = (x) => y0 + Math.round(Math.sin((x + dy * 3) / 6));
      for (let i = 0; i < len; i++) {
        const x = head - i;
        if (!inCells(x) || (i > 5 && (x + dy) % 11 === 0)) continue;
        r.set(x, wy(x), i < 5 ? "u" : "v");
      }
      if (curl && inCells(head + 2)) {            // the head of the gust curls over
        const y = wy(head);
        r.set(head + 1, y - 1, "u"); r.set(head + 2, y - 2, "u"); r.set(head + 1, y - 3, "u"); r.set(head, y - 3, "v");
      }
    }
  }

  // ---- morning mist: a sparse Bayer band over the valley's background whose top drifts between y 112 and 132 ----
  function drawMist(r, a) {
    const lvl = 122 - 10 * Math.cos((2 * Math.PI * a) / 160), drift = a >> 3;
    for (let x = 0; x < W; x++) {
      const top = Math.round(lvl + 3 * Math.sin((x - drift) / 17) + 1.5 * Math.sin((x + drift) / 6.5));
      for (let y = top; y < FLOOR; y++) {
        if (bay(x - drift, y) >= Math.min(7, 1 + ((y - top) >> 1))) continue;
        const m = MIST[r.get(x, y)];
        if (m) r.set(x, y, m);
      }
    }
  }

  // ---- animals (8 fps) ----
  // Rock pigeons: every 12 seconds the flock bursts out of the dovecote, swoops low to the left, climbs and loops
  // back into the holes, one after another.
  function drawPigeons(r, tick) {
    const p = tick % 96;
    for (let i = 0; i < 6; i++) {
      const t = p - i * 3;
      if (t < 1 || t > 59) continue;
      const th = (2 * Math.PI * t) / 60, hx = HOLES[(i * 3) % 5], hy = MIDS[2].dovecote + 2;
      const rx = 46 + (i % 3) * 6, down = 18 + ((i * 7) % 4) * 2, up = 8 + (i % 2) * 3, s = Math.sin(th);
      const x = Math.round(hx - rx * (1 - Math.cos(th))), y = Math.round(hy + (s > 0 ? down : up) * s);
      spr(r, PIGEON[[0, 1, 2, 1][(tick + i) & 3]], x - 5, y - 4, th > Math.PI);
    }
  }
  // Anatolian shepherd on top of the pillar: wags in bursts and blinks now and then.
  function drawDog(r, tick) {
    const x = 6, y = PILLAR_Y - DOG.length;
    spr(r, DOG, x, y);
    const p = tick % 48, tail = DOG_TAIL[p < 28 ? [0, 1, 2, 1][p & 3] : 2];
    const has = (i, j) => tail.some(([ti, tj]) => ti === i && tj === j) || (DOG[j] && DOG[j][i] && DOG[j][i] !== ".");
    for (const [i, j] of tail) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!has(i + di, j + dj) && j + dj < DOG.length) r.set(x + i + di, y + j + dj, "z");
    }
    for (const [i, j] of tail) r.set(x + i, y + j, "c");
    if (tick % 40 === 37 || tick % 40 === 38) r.set(x + 11, y + 3, "E");           // blinks
  }

  window.PB_CONCEPT_SCENES["balloon_valley"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawFarBalloons(r, a);
      r.blit(L.mid, 0, 0);
      MID_B.forEach((b, i) => drawBalloon(r, b, a, i));
      drawBalloon(r, NEAR_B, a, 7);
      drawMist(r, a);
      r.blit(L.ground, 0, 0);
      r.blit(L.props, 0, 0);
      drawLift(r, a);
      drawGust(r, a);
      drawPigeons(r, tick);
      drawDog(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
