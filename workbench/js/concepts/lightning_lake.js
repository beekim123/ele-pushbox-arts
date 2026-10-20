/* ART-04o 地图概念场景 · 无声闪电湖（lightning_lake）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：远处湖上的一排高脚屋、连着屋子的木栈道和电线、远方云层里不停的闪电。
 * 机关外观：power（电源箱 → 电线 → 铁门，闪电后脉冲沿线跑过去，门灯亮、门开一下）、
 * darkness（右边近处的高脚屋在黑暗里，只有门边挂灯照到的一圈看得见）、moving_platform（来回摆渡的小渡船）。
 * 环境（4 fps）：云里每隔几秒无声地闪一次，天和湖一亮一暗、湖面倒映闪电，电线跟着亮；湖面波纹、挂灯微闪、渡船往返。
 * 闪电只改背景（天、云、湖面），人物、箱子、栈道、房屋剪影和机关都不随闪电改色（美术规范第 9 节）。
 * 动物（8 fps）：电鳗（怪物，在栈道下游，身边偶尔冒电花）、鹭（提示动物，站在渡口那根高木桩上）。
 * 比例尺：主角人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const HZ = 92;                                   // horizon of the lake
  const DECK = 116;                                // top of the boardwalk (16 px grid rows start at y = 4)
  const WATER = 124;                               // near water surface under the boardwalk
  const LEFT_X1 = 144, RIGHT_X0 = 208;             // boardwalk x 0–143 and x 208–319; the ferry crosses between
  const HERO_X = 48, CRATE_X = 72;
  const STAKE_X = 208;                             // tall mooring stake where the heron stands
  const HOUSE_X0 = 232, HOUSE_X1 = 304, DOOR_X = 248, LAMP_X = 266;
  const DARK_X = 224;                              // darkness from here to the right edge, except the lantern's circle
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

  function tri(t, period, amp) {                  // integer triangle wave in [-amp, amp]
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
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
  function codeAt(r, x, y) {
    const i = (y * W + x) * 4, d = r.data;
    return d[i + 3] ? REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : null;
  }
  function remap(r, x0, y0, x1, y1, map, test) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, x1 | 0); y1 = Math.min(H, y1 | 0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (test && !test(x, y)) continue;
      const c = codeAt(r, x, y), m = c && map[c];
      if (m && m !== c) r.set(x, y, m);
    }
  }
  function line(r, x0, y0, x1, y1, c) {           // integer Bresenham line
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      r.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // Light levels: 2 lit, 1 plain, 0 dim, -1 dark. The lantern throws stepped rings (dithered edges) into the darkness.
  const LIT_X = 264, LIT_Y = 100;
  function lampLevel(x, y) {
    const d = (x - LIT_X) * (x - LIT_X) + (y - LIT_Y) * (y - LIT_Y), b = bay(x, y);
    const within = (r0, r1) => d < r0 || (d < r1 && b < ((((r1 - d) * 16) / (r1 - r0)) | 0));
    return within(170, 260) ? 2 : within(470, 580) ? 1 : within(760, 900) ? 0 : -1;
  }
  function lightLevel(x, y) {
    const b = bay(x, y), amb = x < DARK_X - 8 ? 1 : x < DARK_X - 4 ? (b < (x - DARK_X + 8) * 4 ? 0 : 1) : x < DARK_X ? (b < (x - DARK_X + 4) * 4 ? -1 : 0) : -1;
    return Math.max(amb, lampLevel(x, y));
  }
  function shade(r, x0, y0) {                      // terrain in the dark: two steps down; lantern rings lift it back
    for (let y = y0; y < H; y++) for (let x = x0; x < W; x++) {
      const lv = lightLevel(x, y), c = lv === 1 ? null : codeAt(r, x, y);
      if (!c) continue;
      const d1 = PB.DIM[c] || c;
      r.set(x, y, lv === 2 ? PB.LIGHT[c] || c : lv === 0 ? d1 : PB.DIM[d1] || d1);
    }
  }

  // Lightning only lifts background colours (sky and clouds, lake), two strengths; the dark water under the
  // near house only just greys, so the stilts show as silhouettes for a moment.
  const SKY_F = [{ z: "y", y: "x", x: "w", g: "B" }, { z: "B", y: "v", x: "u", g: "B" }];   // peak: purple sky, white-lit clouds
  const LAKE_F = [{ z: "y", p: "x", o: "w" }, { z: "g", p: "B", o: "v" }];
  const DARK_F = [{ p: "y" }, { z: "g", p: "g" }];
  const BOLTS = [                                  // distant bolts as polylines (cloud base → horizon), with a branch
    { pts: [[70, 34], [66, 46], [72, 55], [67, 68], [71, 80], [68, HZ - 1]], br: [[72, 55], [80, 63], [84, 72]] },
    { pts: [[176, 30], [181, 42], [175, 50], [179, 62], [174, 73], [177, HZ - 1]], br: [[175, 50], [166, 58], [163, 66]] },
    { pts: [[132, 36], [128, 47], [134, 57], [130, 70], [133, HZ - 1]], br: [[130, 70], [139, 78]] },
  ];

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                 // the protagonist, idle frame 0 (char.portitor), facing right
    "..f.............",
    ".zzz............",
    ".ili....zz......",
    ".ili...zkdz.....",
    ".zkz..zkkddz....",
    ".zfzzzkkdddFz...",
    ".zeezddddddddFz.",
    ".zfffzzyyylylz..",
    ".zekeiiiiiiih...",
    ".zffhzzCBBBBz...",
    ".zekezzCBBBBz...",
    ".zfffzzCBBBBz...",
    ".zzzzzzgggggg...",
    ".......yy.yy....",
    ".......yy.yy....",
    "......zzz.zzz...",
  ];
  const CRATE = [                                  // wooden crate (obj.crate_wood)
    "zzzzzzzzzzzzzzzz",
    "zddddddddddddddz",
    "zdeeeeeeeeeeeefz",
    "zdebbbbbbbbbddfz",
    "zdebbbbbbbbddbfz",
    "zdebbbbbbbddbbfz",
    "zdeeeeeeeddeeefz",
    "zdebbbbbddbbbbfz",
    "zdebbbbddbbbbbfz",
    "zdebbbddbbbbbbfz",
    "zdeeeddeeeeeeefz",
    "zdebddbbbbbbbbfz",
    "zdeddbbbbbbbbbfz",
    "zdeeeeeeeeeeeefz",
    "zffffffffffffffz",
    "zzzzzzzzzzzzzzzz",
  ];
  const HERON = [                                  // grey heron on the stake, facing left: rest, look, stretch
    [
      "......zzz.....",
      ".....zuuuz....",
      "..zzzuzuzzz...",
      "kkkkkuuuz.....",
      "....zzttz.....",
      ".....ztz......",
      ".....ztuz.....",
      "......ztuz....",
      ".....zuuuuzz..",
      "....zuvvvvvvz.",
      "....zuvvwvvvvz",
      ".....zvwwvvwvz",
      "......zwwwwvzz",
      ".......zzzzz..",
      "........zz....",
      "........zz....",
      "........zz....",
      ".......zzzz...",
    ],
    [
      ".....zzz......",
      "....zuuuz.....",
      "...zuzuzzz....",
      ".kkkuuuz......",
      "kkzzzttz......",
      ".....ztz......",
      ".....ztuz.....",
      "......ztuz....",
      ".....zuuuuzz..",
      "....zuvvvvvvz.",
      "....zuvvwvvvvz",
      ".....zvwwvvwvz",
      "......zwwwwvzz",
      ".......zzzzz..",
      "........zz....",
      "........zz....",
      "........zz....",
      ".......zzzz...",
    ],
    [
      "....zzz.......",
      "...zuuuz......",
      "..zuzuzzz.....",
      "kkkuuuz.......",
      "...zttz.......",
      "....zttz......",
      ".....ztuz.....",
      "......ztuz....",
      ".....zuuuuzz..",
      "....zuvvvvvvz.",
      "....zuvvwvvvvz",
      ".....zvwwvvwvz",
      "......zwwwwvzz",
      ".......zzzzz..",
      "........zz....",
      "........zz....",
      "........zz....",
      ".......zzzz...",
    ],
  ];
  // ---- static layers ----
  let CLOUDS = [];                                 // puffs [cx, cy, rx, ry, lowest y]: storm deck with hanging lobes, a flat-based bank
  function makeClouds() {
    const n = (i, s, m) => hash(i, s, 11) % m, out = [];
    for (let i = 0; i < 16; i++) out.push([i * 22 - 8 + n(i, 1, 9), 1 + n(i, 2, 8), 15 + n(i, 3, 9), 9 + n(i, 4, 5), H]);
    for (let i = 0; i < 9; i++) out.push([i * 38 + 6 + n(i, 5, 13), 12 + n(i, 6, 6), 9 + n(i, 7, 8), 6 + n(i, 8, 3), H]);
    for (let i = 0; i < 8; i++) out.push([i * 41 + 10 + n(i, 13, 15), 63 + n(i, 14, 6), 8 + n(i, 15, 6), 6 + n(i, 16, 3), 82]);
    for (let i = 0; i < 12; i++) out.push([i * 29 + n(i, 9, 11), 73 + n(i, 10, 6), 13 + n(i, 11, 9), 8 + n(i, 12, 5), 82]);
    out.push([270, 54, 38, 17, 82]);               // a tall head behind the near house, so its roof reads as a silhouette
    return out;
  }
  const inE = (e, x, y) => y <= e[4] && ((x - e[0]) * (x - e[0])) / (e[2] * e[2]) + ((y - e[1]) * (y - e[1])) / (e[3] * e[3]) <= 1;
  const cloudAt = (x, y) => CLOUDS.some((e) => inE(e, x, y));
  function cloudPix(x, y) {                        // the lowest puff containing the pixel is in front; rims on every puff
    let f = null;
    for (const e of CLOUDS) if (inE(e, x, y) && (!f || e[1] > f[1])) f = e;
    if (!f) return null;
    const b = bay(x, y);
    if (y < 45) return !cloudAt(x, y + 1) || (!cloudAt(x, y + 2) && b < 8) ? "x" : "y";  // deck: lobes catch the light below
    if (!cloudAt(x, y + 1) || (!cloudAt(x, y + 2) && b < 8)) return "g";                // bank: dark flat underside
    if (!inE(f, x, y - 1)) return "x";
    if (!inE(f, x, y - 2)) return cloudAt(x, y - 2) && b >= 8 ? "y" : "x";
    if (!inE(f, x, y - 4) && b < 4) return "x";
    return "y";
  }
  function buildSky() {
    const r = layer();
    CLOUDS = makeClouds(); r.stars = [];
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      const c = cloudPix(x, y) || "z";
      if (c === "z" && hash(x, y, 5) % 97 === 0 && y < 50) r.stars.push([x, y]);   // a few stars between the clouds
      r.set(x, y, c);
    }
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {           // ink-green lake, darker near the viewer
      let c = y < WATER ? "p" : (y < 150 || bay(x, y) >= (y - 150) / 2) ? "p" : "z";
      if (y < WATER && (y - HZ) % 5 === 3 && hash(x >> 3, y, 9) % 3 === 0) c = "o";
      r.set(x, y, c);
    }
    for (let x = 0; x < W; x++) if ((x >> 2) % 3) r.set(x, WATER, "o");
    const dark = new Uint8Array(W * H);            // near water left in the dark (dimmed one step)
    for (let y = WATER; y < H; y++) for (let x = DARK_X - 8; x < W; x++) if (lightLevel(x, y) < 0) dark[y * W + x] = 1;
    remap(r, DARK_X - 8, WATER, W, H, PB.DIM, (x, y) => dark[y * W + x]);
    r.dark = dark;
    return r;
  }
  function stiltHouse(r, x, w, h, win) {           // a far stilt house silhouette with one warm window
    const base = HZ - 6;
    for (let k = 1; k < w; k += 5) r.vline(x + k, base, 6, "z");
    r.rect(x, base - h, w, h, "z");
    for (let j = 0; j < (w >> 1) + 2; j++) r.hline(x - 2 + j, base - h - j, w + 4 - 2 * j, "z");
    if (win) { r.rect(x + win, base - h + 3, 2, 2, "e"); r.set(x + win, base - h + 3, "b"); r.vline(x + win, HZ + 2, 1, "f"); r.vline(x + win + 1, HZ + 5, 1, "f"); }
  }
  function buildFar() {
    const r = layer();
    for (let x = 0; x < W; x++) {                  // far shore: a low dark line of reeds and hills, and its edge on the water
      const h = 2 + (hash(x >> 3, 1, 7) % 3) + (x > 90 && x < 150 ? 2 : 0);
      r.vline(x, HZ - h, h + 1, "z");
      if (bay(x, HZ + 1) < 8) r.set(x, HZ + 1, "z");
    }
    stiltHouse(r, 14, 18, 10, 5); stiltHouse(r, 62, 14, 8, 0); stiltHouse(r, 104, 20, 11, 12); stiltHouse(r, 160, 16, 9, 4); stiltHouse(r, 198, 12, 7, 0);
    r.hline(10, HZ - 4, 200, "z");                 // the far walkway joining them
    for (const [x0, x1] of [[23, 69], [69, 114], [114, 168], [168, 204]]) for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0); r.set(x, HZ - 24 + ((4 * t * (1 - t) * 4) | 0) + (x0 === 69 ? 3 : 0), "y");
    }
    return r;
  }
  function deck(r, x0, x1, posts) {                // boardwalk planks and posts into the water (terrain)
    r.hline(x0, DECK, x1 - x0, "F"); r.rect(x0, DECK + 1, x1 - x0, 3, "e"); r.hline(x0, DECK + 4, x1 - x0, "f"); r.hline(x0, DECK + 5, x1 - x0, "g");
    for (let x = x0; x < x1; x++) if ((x - x0) % 12 === 11) r.vline(x, DECK + 1, 3, "f");
    for (const px of posts) {
      r.vline(px, DECK + 6, H - DECK - 6, "e"); r.vline(px + 1, DECK + 6, H - DECK - 6, "f"); r.vline(px + 2, DECK + 6, H - DECK - 6, "g");
      for (let y = WATER + 1; y < H; y++) { r.set(px, y, "f"); r.set(px + 1, y, "g"); r.set(px + 2, y, y % 3 ? "g" : "z"); }
    }
    for (let k = 0; k + 1 < posts.length; k++) line(r, posts[k] + 3, DECK + 6, posts[k + 1] - 1, WATER - 1, "g");
  }
  function buildFront() {
    const r = layer();
    deck(r, 0, LEFT_X1, [6, 30, 54, 78, 102, 126]);
    deck(r, RIGHT_X0, W, [214, 238, 262, 286, 310]);
    r.rect(STAKE_X, 96, 4, H - 96, "f"); r.vline(STAKE_X, 96, H - 96, "e"); r.vline(STAKE_X + 3, 96, H - 96, "g"); r.hline(STAKE_X, 96, 4, "F");
    for (let y = 104; y < H; y += 9) r.hline(STAKE_X, y, 4, "g");
    // Power source: an iron box under a lightning rod; a second pole carries the wire along the boardwalk.
    r.rect(12, 38, 2, DECK - 38, "x"); r.vline(12, 38, DECK - 38, "w"); r.vline(12, 32, 6, "v"); r.set(12, 31, "u");
    r.rect(4, DECK - 16, 16, 16, "x"); r.hline(4, DECK - 16, 16, "w"); r.vline(4, DECK - 15, 15, "w"); r.vline(19, DECK - 15, 15, "y"); r.hline(5, DECK - 1, 15, "y");
    for (const [vx, vy] of [[6, DECK - 14], [17, DECK - 14], [6, DECK - 3], [17, DECK - 3]]) r.set(vx, vy, "v");
    r.rect(8, DECK - 11, 8, 2, "y"); r.rect(8, DECK - 7, 8, 2, "y");
    r.rect(14, 74, 3, 2, "u"); r.set(16, 75, "v");                                      // insulator where the wire starts
    r.rect(120, 76, 2, DECK - 76, "f"); r.vline(120, 76, DECK - 76, "e"); r.hline(117, 78, 8, "f"); r.set(118, 77, "u"); r.set(123, 77, "u");
    shade(r, DARK_X - 8, 0);
    return r;
  }
  function buildHouse() {                          // the near stilt house (in the dark, lit only around its lantern)
    const r = layer();
    for (const px of [236, 268, 300]) r.rect(px, DECK + 6, 3, H - DECK - 6, "g");
    for (let y = 64; y < DECK; y++) for (let x = HOUSE_X0; x < HOUSE_X1; x++) r.set(x, y, (x - HOUSE_X0) % 6 === 5 ? "g" : x === HOUSE_X0 ? "e" : "f");
    for (let j = 0; j < 22; j++) {
      const x0 = HOUSE_X0 - 6 + j * 2, x1 = HOUSE_X1 + 6 - j * 2;
      if (x0 >= x1) break;
      for (let x = x0; x < x1; x++) r.set(x, 64 - j, j === 0 ? "f" : (x + j) % 4 === 0 ? "f" : "g");
    }
    r.rect(284, 74, 12, 12, "x"); r.rect(285, 75, 10, 10, "y"); r.vline(289, 75, 10, "x"); r.hline(285, 79, 10, "x");
    r.rect(DOOR_X - 2, 90, 20, DECK - 90, "g");
    r.rect(240, 80, 3, 2, "u");                                                            // insulator on the wall
    r.hline(LAMP_X - 2, 84, 5, "x"); r.vline(LAMP_X + 2, 82, 2, "x");                    // lantern bracket
    shade(r, HOUSE_X0 - 8, 0);
    return r;
  }
  function wirePath() {                            // source insulator → pole → across the ferry gap → house → door lamp
    const pts = [];
    const span = (x0, y0, x1, y1, sag) => {
      for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0); pts.push([x, Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t))]); }
    };
    span(17, 75, 118, 77, 9);
    span(123, 77, 240, 81, 13);
    for (let y = 82; y <= 87; y++) pts.push([242, y]);
    for (let x = 243; x <= DOOR_X + 6; x++) pts.push([x, 87]);
    return pts;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const props = layer();
    spr(props, PORTER, HERO_X, DECK - 16);
    spr(props, CRATE, CRATE_X, DECK - 16);
    L = { sky: buildSky(), far: buildFar(), house: buildHouse(), front: buildFront(), props, wire: wirePath() };
  }

  // ---- ambient (4 fps) ----
  const CYCLES = [20, 26, 22];                     // seconds between flashes vary a little (in 4 fps frames)
  const LEVELS = [[1, 2, 1], [1, 2, 1, 2, 1], [2, 1, 1]];
  function flashState(a) {
    let s = a % 68, k = 0;
    while (s >= CYCLES[k]) { s -= CYCLES[k]; k++; }
    const lvl = LEVELS[k][s] || 0, bolt = lvl === 2 || (lvl > 0 && s > 0 && LEVELS[k][s - 1] === 2);
    return { k, t: s, lvl, bolt };
  }
  function drawRipples(r, a) {
    const rows = [96, 100, 105, 111, 118];
    rows.forEach((y, j) => {
      for (let k = 0; k < 6; k++) {
        const len = 3 + j, x = ((k * 59 + j * 23 + a * (j & 1 ? 1 : -1)) % 360 + 360) % 360 - 20;
        for (let i = 0; i < len; i++) if (r.get(x + i < 0 ? 0 : x + i, y) === "p") r.set(x + i, y, "o");
      }
    });
  }
  function drawBolt(r, b, lvl) {
    const c = lvl === 2 ? "t" : "u", seg = (pts, col) => { for (let i = 0; i + 1 < pts.length; i++) line(r, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col); };
    seg(b.pts, c); seg(b.br, lvl === 2 ? "u" : "v");
    for (let i = 0; i + 1 < b.pts.length; i++) {   // broken reflection on the lake, squashed
      const [x0, y0] = b.pts[i], [x1, y1] = b.pts[i + 1];
      for (let y = y0; y <= y1; y++) {
        const x = Math.round(x0 + (x1 - x0) * (y - y0) / Math.max(1, y1 - y0)), ry = HZ + 1 + ((HZ - y) >> 1);
        if (ry < WATER && (ry & 1)) r.hline(x - 1 + ((ry >> 1) & 1), ry, 2, lvl === 2 ? "u" : "v");
      }
    }
  }
  function drawWire(r, fs) {                       // the wire hums: a pulse runs from the source to the door
    const head = fs.t >= 1 ? (fs.t - 1) * 40 : -1, pts = L.wire;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i], since = head >= i ? (head - i) / 40 : -1;
      let c = x >= DARK_X ? "y" : "x";
      if (since >= 0 && fs.t < 14) c = since < 1 ? "t" : since < 3 ? "u" : since < 4 ? "v" : since < 5 ? "w" : c;
      r.set(x, y, c);
    }
    if (head >= 0 && head < pts.length) { const [x, y] = pts[head]; r.set(x, y - 1, "t"); r.set(x + 1, y + 1, "u"); r.set(x - 1, y + 1, "u"); }
  }
  function drawDoor(r, fs, a) {                    // iron door: lamp lights when the pulse arrives, the door opens once
    const t = fs.t, lit = t >= 7 && t < 17, open = t < 8 || t >= 16 ? 0 : t < 10 ? (t - 7) * 6 : t < 14 ? 12 : (16 - t) * 6;
    const x = DOOR_X, y = 92, h = DECK - y;
    r.rect(x, y, 16, h, "z");
    for (let j = 0; j < h - open; j++) for (let i = 0; i < 16; i++) {
      const m = i % 4, edge = i === 0 || i === 15 || j === h - open - 1 || j === 0;
      r.set(x + i, y + j, edge ? "x" : m === 1 ? "u" : m === 2 ? "v" : m === 3 ? "w" : "x");
    }
    for (let i = 1; i < 15; i += 4) { r.set(x + i, y + 2, "t"); if (h - open > 6) r.set(x + i, y + h - open - 3, "u"); }
    const lx = x + 6;
    r.rect(lx, 86, 4, 3, "z");
    if (lit) { r.rect(lx + 1, 87, 2, 1, "l"); r.set(lx + 1, 87, "t"); if (a & 1) { r.set(lx, 87, "k"); r.set(lx + 3, 87, "k"); } }
    else r.rect(lx + 1, 87, 2, 1, "w");
  }
  function drawLantern(r, a) {
    spr(r, ["..x..", ".xxx.", "xklkx", "xlllx", "xkllx", ".xxx."], LAMP_X - 2, 85, false, (a % 7) === 3 ? { l: "k" } : null);
  }
  function drawFerry(r, a) {                       // small ferry shuttling across the gap (moving platform)
    const t = a % 40, x = t < 10 ? 146 : t < 20 ? 146 + (t - 10) * 3 : t < 30 ? 176 : 176 - (t - 30) * 3;
    const y = DECK + 1 + (tri(a, 8, 1) > 0 ? 1 : 0);
    line(r, x + 24, y - 13, x + 27, y - 1, "e");
    r.hline(x, y, 30, "F"); r.hline(x, y + 1, 30, "e");
    for (let j = 2; j < 8; j++) { const ins = (j - 2) >> 1; r.hline(x + ins, y + j, 30 - 2 * ins, j < 4 ? "f" : "g"); }
    for (let k = 0; k < 30; k += 6) r.set(x + k + 2, y + 1, "f");
    const moving = (t >= 10 && t < 20) || t >= 30;
    for (let i = 0; i < 4; i++) { r.set(x - 3 - i - (moving ? a & 1 : 0), WATER, "o"); r.set(x + 32 + i + (moving ? a & 1 : 0), WATER, "o"); }
  }

  // ---- animals (8 fps) ----
  function drawEel(r, tick) {                      // swims to and fro under the left boardwalk, crackles now and then
    const T = 176, t = tick % T, right = t < T / 2, hx = right ? 30 + t : 30 + (T - t), y0 = 140 + tri(tick, 40, 2);
    const ph = (tick >> 1) % 4, dir = right ? 1 : -1, xs = [];
    for (let i = 0; i < 24; i++) {
      const x = hx - dir * i, dy = i < 3 ? 0 : Math.round(1.6 * Math.sin(i * 0.52 - ph * 1.57));
      xs.push([x, y0 + dy]);
      const thick = i < 18 ? 3 : 2;
      r.set(x, y0 + dy - 1, "x"); r.set(x, y0 + dy, "w"); if (thick === 3) r.set(x, y0 + dy + 1, i < 11 ? "b" : "w");
      if (i >= 20) r.set(x, y0 + dy - 2, "x");
    }
    r.set(hx, y0 - 1, "t"); r.set(hx + dir, y0, "x"); r.set(hx + dir, y0 + 1, "z");
    if (tick % 64 < 6) {                            // a short crackle of sparks
      for (let k = 0; k < 3; k++) {
        const [sx, sy] = xs[4 + k * 7], up = (k + tick) & 1 ? -1 : 1;
        r.set(sx, sy + up * 3, "s"); r.set(sx + 1, sy + up * 4, "t"); r.set(sx, sy + up * 5, "s"); r.set(sx + 1, sy + up * 6, "s");
      }
    }
  }
  function drawHeron(r, tick) {
    const t = tick % 48, f = t < 30 ? 0 : t < 38 ? 1 : t < 46 ? 2 : 0;
    spr(r, HERON[f], STAKE_X - 7, 96 - 18);
  }

  window.PB_CONCEPT_SCENES.lightning_lake = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer(), fs = flashState(a);
      r.data.set(L.sky.data);
      drawRipples(r, a);
      if (fs.lvl) {
        const k = fs.lvl - 1, dark = L.sky.dark;
        remap(r, 0, 0, W, HZ, SKY_F[k]);
        remap(r, 0, HZ, W, H, LAKE_F[k], (x, y) => !dark[y * W + x]);
        remap(r, DARK_X - 8, WATER, W, H, DARK_F[k], (x, y) => dark[y * W + x]);
      }
      else for (const [x, y] of L.sky.stars) r.set(x, y, "x");             // stars only show while the sky is dark
      if (fs.bolt) drawBolt(r, BOLTS[fs.k], fs.lvl);
      r.blit(L.far, 0, 0);
      r.blit(L.house, 0, 0);
      drawEel(r, tick);
      r.blit(L.front, 0, 0);
      drawWire(r, fs);
      drawDoor(r, fs, a);
      drawLantern(r, a);
      drawFerry(r, a);
      drawHeron(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
