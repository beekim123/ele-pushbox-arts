/* ART-04n 地图概念场景 · 巨藻森林（kelp_forest）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180 侧视，只用 ENDESGA 32，整数像素，不抗锯齿、不混色。
 * 下午的阳光穿过藻冠：琥珀褐的巨藻、橄榄绿的藻叶、冷绿偏灰的海水；光被藻叶切成一条条斜斜的金线。
 * 调色板没有橄榄绿和灰绿：藻叶用 n / e 交错近似橄榄绿（深处 o / f），海水用灰（w / x / y）与绿（o / p）棋盘交错，越深越暗。
 * 地标：直通水面的巨藻林（藻茎上一串串气囊）、生了藤壶的码头木桩、海面上漂着的渔船浮标。
 * 机关外观（不实现规则）：木箱浮在水面、铁箱沉在礁石缝里（float_sink）；人影在水下吐气泡（underwater）；
 * 紫海胆旁边有一个礁坑，示意可以把它推进去（push_monster）。
 * 环境（4 fps，tick >> 1）：整片巨藻跟着海涌一齐往前、再往后，像风吹过的帘子；藻叶缝里的光条跟着来回扫；
 * 小海胆在礁石上慢慢爬；水面起伏，浮箱、浮标、海獭跟着上下。
 * 动物（8 fps）：紫海胆（怪物，滚着啃藻根）、海獭（提示动物，仰面抱着石头敲贝壳）。
 * 比例尺：主角大小的人影 + 木箱 + 铁箱，站着不动。不画收件人、货物、界面和文字。
 * 只读使用 workbench/js/core/raster.js 的 PB.Raster / PB.h32。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: top of the sea floor
  const LEDGE_Y = OY + 7 * 16, LEDGE_X = 4 * 16;  // reef ledge on the left: x < 64, top y = 116
  const SHELF_Y = OY + 8 * 16, SHELF_X = 17 * 16; // low reef shelf under the pier: x ≥ 272, top y = 132
  const SURF = 20;                                // mean water line
  const PIT_X = 8 * 16;                           // a one-tile pit in the reef (x 128–143, y 148–163)
  const CRACK_X = 11 * 16;                        // reef crack (x 176–191); the iron crate lies at its bottom
  const PIER_X = 232, PILES = [244, 292];         // pier deck above the water, two barnacled piles
  const SURGE = 24;                               // surge period in ambient frames (6 s)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null;

  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  const at = (r, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "." : r.get(x, y));
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
  // The surge: one shared sine for the whole forest, a small lag from left to right (a curtain in the wind).
  const surge = (a, x) => Math.sin((2 * Math.PI * a) / SURGE - x / 110);
  const swell = (a, x) => Math.round(Math.sin(x / 13 - (2 * Math.PI * a) / 12));   // surface ripple, ±1 px
  // How far a point of a stipe is carried by the surge: nothing at the holdfast, most at the canopy.
  function carry(a, x, y, base, amp) {
    const f = Math.min(1, Math.max(0, (base - y) / (base - SURF)));
    return Math.round(amp * Math.pow(f, 1.4) * surge(a, x));
  }

  // ---- palette roles ----
  // Water: a checkerboard of a grey and a green code, both stepping down with depth (Bayer-dithered steps):
  // o / w just under the surface (a cool grey-green), o / x in the middle, p / y near the floor. The sea stays
  // darker than the reef rock's mid-tone wherever the two meet.
  const BANDS = [[0, "o", "w"], [40, "o", "x"], [96, "p", "x"], [124, "p", "y"]];
  function waterCode(x, y) {
    const d = y - SURF, b = (bay(x >> 1, y) * 5) & 15;
    let band = BANDS[0];
    for (let i = 1; i < BANDS.length; i++) if (d - BANDS[i][0] + 8 > b) band = BANDS[i];
    return (x + y) & 1 ? band[1] : band[2];
  }
  // Olive blades: three rows, green on top, green and brown interleaved (olive), dark green below.
  const KELP_TONE = [
    { lit: "e", shade: "f", float: ["F", "e"], blade: [["n", "n"], ["n", "e"], ["o", "o"]] },   // sunlit, near the canopy
    { lit: "e", shade: "f", float: ["e", "f"], blade: [["n", "o"], ["o", "e"], ["o", "f"]] },
    { lit: "f", shade: "g", float: ["f", "g"], blade: [["o", "o"], ["o", "f"], ["p", "g"]] },   // dim, near the reef
  ];
  const tone = (y) => KELP_TONE[y < 64 ? 0 : y < 108 ? 1 : 2];

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
  const IRON = (() => {                           // iron box: riveted frame, two straps, lit top/left
    const rows = [];
    for (let j = 0; j < 16; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        const edge = i === 0 || j === 0 || i === 15 || j === 15;
        const rivet = (i === 3 || i === 12) && (j === 3 || j === 12);
        if (edge) s += "z";
        else if (rivet) s += "u";
        else if (i === 14 || j === 14) s += "x";
        else if (i === 1 || j === 1) s += "u";
        else if (i === 2 || j === 2 || i === 13 || j === 13) s += "v";
        else if (j === 7 || j === 8) s += j === 7 ? "v" : "x";
        else s += "w";
      }
      rows.push(s);
    }
    return rows;
  })();
  // Sea otter floating on its back: pale head on the left (eye; the outline makes the nose), dark brown body,
  // hind feet up, tail trailing. The water line runs along the bottom rows. Arm frames: stone held high,
  // coming down, striking the shell on its chest.
  const OTTER_BODY = [
    "...zzz................",
    "..zcccz.........z.z...",
    ".zcEEEcz.......zfzfz..",
    "zcEzEEEezzzzzzzzfgfz..",
    "zEEEEEEeeeeeeeeeeffz..",
    ".zEEFefffffffffffffzz.",
    "..zffgfffffffffffffffz",
    "...zzzzzzzzzzzzzzzzzz.",
  ];
  const STONE = [[0, 0, "u"], [1, 0, "v"], [2, 0, "w"], [0, 1, "v"], [1, 1, "w"], [2, 1, "x"]];
  const SHELL = [[12, 3, "E"], [13, 3, "D"], [14, 3, "E"], [13, 2, "c"]];
  const OTTER_ARMS = [                            // paws, then where the stone sits; chips fly on the strike
    { paws: [[8, 2], [8, 1], [9, 0], [10, 2]], stone: [8, -2], chips: [] },
    { paws: [[9, 2], [9, 1], [10, 1], [11, 2]], stone: [9, -1], chips: [] },
    { paws: [[10, 3], [10, 2], [11, 2]], stone: [10, 0], chips: [[14, -1], [16, 0]] },
  ];
  const BUOY = [                                  // fishing buoy: red float with a pale band, a pole and a pennant
    "...ha..",
    "...ahh.",
    "...a...",
    "...f...",
    "..aaa..",
    ".aaaah.",
    ".FFFFF.",
    ".aaahh.",
    "..ahh..",
  ];

  // ---- static layers ----
  function buildBack() {
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r.set(x, y, y < SURF ? "v" : waterCode(x, y));
    for (let x = 0; x < 120; x++) {               // a low headland far off on the horizon
      const h = Math.round(5 * Math.sin((x * Math.PI) / 120) + 1.5 * Math.sin(x / 7));
      for (let k = 0; k < h; k++) r.set(x, SURF - 1 - k, "w");
    }
    for (let x = 0; x < W; x++) {                 // far reef behind the play plane, dissolving into the deep water
      const top = 118 + Math.round(10 * Math.sin(x / 31 + 1) + 5 * Math.sin(x / 11));
      for (let y = top; y < H; y++) r.set(x, y, y === top ? "x" : (x + y) & 1 ? "y" : (y - top > 6 ? "y" : "x"));
    }
    return r;
  }

  // Reef rock: rounded boulders (jittered cells) of slate grey, lit on the upper-left edge and shaded on the
  // lower-right edge, a 1 px lit top, olive turf on the top surface, sand caught in a few hollows.
  function cellPoint(gx, gy) { const h = hash(gx, gy, 41); return [gx * 13 + (h % 10) + 1, gy * 10 + ((h >>> 8) % 8) + 1]; }
  function reefCell(x, y) {
    const gx = Math.floor(x / 13), gy = Math.floor(y / 10);
    let d1 = 1e9, d2 = 1e9, best = null;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const [px, py] = cellPoint(gx + i, gy + j), dx = x - px, dy = (y - py) * 1.25, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = [gx + i, gy + j, px, py]; } else if (d < d2) d2 = d;
    }
    return { gx: best[0], gy: best[1], px: best[2], py: best[3], edge: Math.sqrt(d2) - Math.sqrt(d1) };
  }
  function reefRock(r, x, y, top) {
    const k = y - top;
    if (k === 0) { r.set(x, y, hash(x, 0, 42) % 4 ? "v" : "n"); return; }
    const cell = reefCell(x, y), kind = hash(cell.gx, cell.gy, 43) % 7;
    const sand = kind === 0 && k > 3, dark = kind === 6 || k > 22;
    const base = sand ? "F" : dark ? "x" : "w", lite = sand ? "F" : dark ? "w" : "v", shade = sand ? "e" : dark ? "y" : "x";
    const lower = (x - cell.px) + (y - cell.py) > 0;
    let c = base;
    if (cell.edge < 1.1) c = lower ? shade : lite;
    else if (cell.edge < 2.1 && lower) c = shade;
    else if (sand && hash(x, y, 44) % 5 === 0) c = "e";                       // sand grains
    if (k === 1 && c === shade) c = base;
    r.set(x, y, c);
  }
  function turf(r, x, top) {                      // sparse olive turf algae and shell grit on a reef top
    const h = hash(x, top, 45) % 11;
    if (h < 2) { r.set(x, top - 1, "o"); if (h === 0 && hash(x, 1, 45) & 1) r.set(x, top - 2, "o"); }
    else if (h === 3) r.set(x, top - 1, "f");
  }
  function buildGround() {
    const r = layer();
    const topAt = (x) => (x < LEDGE_X ? LEDGE_Y : x >= SHELF_X ? SHELF_Y : FLOOR);
    for (let x = 0; x < W; x++) {
      const top = topAt(x);
      for (let y = top; y < H; y++) {
        const inPit = x >= PIT_X && x < PIT_X + 16 && y < FLOOR + 16;
        const inCrack = x >= CRACK_X && x < CRACK_X + 16;
        if (inPit || inCrack) continue;
        reefRock(r, x, y, inPit || inCrack ? FLOOR + 16 : top);
      }
      if (!(x >= PIT_X && x < PIT_X + 16) && !(x >= CRACK_X && x < CRACK_X + 16)) turf(r, x, top);
    }
    for (let y = LEDGE_Y + 1; y < FLOOR; y++) r.set(LEDGE_X - 1, y, "x");     // shaded faces of the ledge and shelf
    for (let y = SHELF_Y + 1; y < H; y++) r.set(SHELF_X, y, "v");
    // the pit and the crack: rock walls lit on the left inner face, a dark hollow inside
    for (const [x0, y1] of [[PIT_X, FLOOR + 16], [CRACK_X, H]]) {
      for (let y = FLOOR; y < y1; y++) for (let x = x0; x < x0 + 16; x++) {
        const wall = x === x0 || x === x0 + 15;
        r.set(x, y, wall ? (x === x0 ? "x" : "w") : y === FLOOR ? "y" : (x + y) & 1 ? "y" : y < FLOOR + 4 ? "p" : "z");
      }
      r.hline(x0 + 1, FLOOR, 14, "x");
    }
    for (let x = PIT_X; x < PIT_X + 16; x++) { r.set(x, FLOOR + 16, "x"); for (let y = FLOOR + 17; y < H; y++) reefRock(r, x, y, FLOOR + 16); }
    return r;
  }
  function buildPier() {                          // deck above the water on two wooden piles crusted with barnacles
    const r = layer();
    for (let x = PIER_X; x < W; x++) {
      r.set(x, 8, "F");
      for (let y = 9; y < 13; y++) r.set(x, y, (x - PIER_X) % 7 === 6 ? "f" : y === 12 ? "f" : "e");
      r.set(x, 13, "g");
    }
    for (const px of PILES) {
      const bottom = px >= SHELF_X ? SHELF_Y : FLOOR;
      for (let y = 14; y < bottom; y++) {
        const t = y < 64 ? 0 : y < 108 ? 1 : 2;
        const lit = ["e", "f", "g"][t], mid = ["f", "f", "g"][t], dark = ["g", "g", "z"][t];
        for (let i = 0; i < 8; i++) r.set(px + i, y, i < 2 ? lit : i === 7 ? dark : hash(px + i, y >> 2, 46) % 7 === 0 ? dark : mid);
      }
      r.hline(px - 1, 14, 10, "g");
      // barnacles: dense around the tide line, a few lower down; mussels in the splash zone
      for (let y = 18; y < bottom - 2; y += 2) for (let i = -1; i < 8; i += 3) {
        const h = hash(px + i, y, 47) % 100, dense = y < 40 ? 45 : y < 76 ? 14 : 4;
        if (h >= dense) continue;
        const bx = px + i + (h % 2), by = y;
        if (y < 24 && h % 3 === 0) { r.set(bx, by, "y"); r.set(bx + 1, by, "q"); r.set(bx, by + 1, "y"); continue; }
        r.set(bx, by, "v"); r.set(bx + 1, by, "v"); r.set(bx, by + 1, "w"); r.set(bx + 1, by + 1, "g");
      }
    }
    return r;
  }
  function build() {
    PB = window.PB;
    const props = layer();
    spr(props, IRON, CRACK_X, H - 16);
    spr(props, PORTER, 80, FLOOR - 16);
    L = { back: buildBack(), ground: buildGround(), pier: buildPier(), props };
  }

  // ---- ambient (4 fps) ----
  const surfY = (a, x) => SURF + swell(a, x);
  function drawSurface(r, a) {                    // the water line ripples by a pixel; the sky shows in the troughs
    for (let x = 0; x < W; x++) {
      const s = swell(a, x);
      for (let y = SURF - 1; y <= SURF + 2; y++) r.set(x, y, y < SURF + s ? "v" : y === SURF + s ? "w" : waterCode(x, y));
      if (hash(x >> 2, a >> 1, 51) % 23 === 0) r.set(x, SURF + s, "v");            // a glint now and then
    }
  }
  // Slanting gold lines of light through gaps in the canopy (background only): they lean down to the right,
  // thin out with depth, and sweep to and fro with the canopy above them.
  const SHAFTS = [{ x: 30, len: 64, w: 3 }, { x: 74, len: 100, w: 5 }, { x: 134, len: 84, w: 3 }, { x: 192, len: 104, w: 5 }, { x: 246, len: 70, w: 3 }];
  const LIFT = { o: "n", w: "v", x: "w", p: "o", y: "x" };
  function drawShafts(r, a) {
    for (const s of SHAFTS) {
      const sv = surge(a, s.x);
      for (let d = 0; d < s.len; d++) {
        const y = SURF + 3 + d, x0 = s.x + Math.round(d * 0.45) + Math.round(7 * sv * (1 - d / (2 * s.len)));
        const keep = 16 - Math.floor((d * 17) / s.len);                       // the band thins out with depth
        for (let i = 0; i < s.w; i++) {
          const x = x0 + i, c = at(r, x, y);
          if (c === "." || c === "v" || bay(x, y) >= keep) continue;
          const core = i === s.w >> 1 && (y & 1) && d < 60;
          if (core) r.set(x, y, d < 30 ? "F" : "e");                            // a broken gold line in the middle
          else if (LIFT[c]) r.set(x, y, LIFT[c]);                               // the lit water around it, one step up
        }
      }
    }
  }
  // The forest: each stipe rises from its holdfast to the surface and spreads a canopy along it.
  const KELP = [
    { x: 18, base: LEDGE_Y, dir: 1, len: 22, ph: 0 },
    { x: 46, base: LEDGE_Y, dir: 1, len: 14, ph: 3 },
    { x: 104, base: FLOOR, dir: 1, len: 24, ph: 1 },        // the urchin gnaws at this holdfast
    { x: 166, base: FLOOR, dir: -1, len: 20, ph: 4 },
    { x: 222, base: FLOOR, dir: 1, len: 12, ph: 2 },
    { x: 268, base: FLOOR, dir: 1, len: 16, ph: 5 },
    { x: 310, base: SHELF_Y, dir: -1, len: 14, ph: 6 },
  ];
  const FAR_KELP = [8, 62, 136, 196, 240, 286].map((x, i) => ({ x, base: 132 + (i % 3) * 4, ph: i * 2 + 1 }));
  function stipe(a, k, amp) {                     // x of the stipe for every y from the holdfast up to the canopy
    const pts = [];
    for (let y = k.base - 1; y >= SURF + 3; y--) pts.push([k.x + Math.round(1.4 * Math.sin(y / 10 + k.ph)) + carry(a, k.x, y, k.base, amp), y]);
    return pts;
  }
  function drawFarKelp(r, a) {
    const sv = surge(a, 160);
    for (const k of FAR_KELP) {
      let prev = null;
      const pts = stipe(a, k, 4);
      for (const [x, y] of pts) {
        const c = y < 80 ? "f" : "g";
        if (prev !== null) for (let xx = Math.min(prev, x) + 1; xx < Math.max(prev, x); xx++) r.set(xx, y, c);
        r.set(x, y, c); prev = x;
      }
      for (let j = 0; ; j++) {                    // dim blades streaming upwards
        const y = k.base - 6 - j * 5;
        if (y < SURF + 10) break;
        const x = pts[k.base - 1 - y][0], side = j & 1 ? 1 : -1, n = 5 + (hash(k.x, j, 50) % 4);
        for (let m = 1; m <= n; m++) r.set(x + side * Math.round(1 + m * 0.4) + Math.round(3 * sv * (m / n) * (m / n)), y - m, y < 80 ? "o" : "p");
      }
    }
  }
  function drawKelp(r, a) {
    const sv = surge(a, 160);
    for (const k of KELP) {
      for (let st = 0; st < 2; st++) {            // two stipes from each holdfast, a little apart
        const s = { x: k.x + (st ? 3 : 0), base: k.base, ph: k.ph + st * 2.3 };
        const pts = stipe(a, s, 6);
        let prev = null;
        for (const [x, y] of pts) {
          const t = tone(y);
          if (prev !== null) for (let xx = Math.min(prev, x) + 1; xx < Math.max(prev, x); xx++) r.set(xx, y, t.lit);
          r.set(x, y, t.lit); r.set(x + 1, y, t.shade); prev = x;
        }
        // blades on alternate sides, each with an amber float at its foot: strings of floats up the stipe.
        // Buoyant blades stream upwards from their floats; their tips are swept along by the surge.
        for (let j = 0; ; j++) {
          const y = k.base - 8 - st * 2 - j * 4;
          if (y < SURF + 12) break;
          const x = pts[k.base - 1 - y][0], side = (j + st) & 1 ? 1 : -1, t = tone(y);
          const fx = side > 0 ? x + 2 : x - 1;
          r.set(fx, y, t.float[0]); r.set(fx + side, y, t.float[1]); r.set(fx, y + 1, t.float[1]);
          const n = 7 + (hash(s.x, j, 48) % 6), drift = 4 * sv;
          for (let m = 1; m <= n; m++) {
            const q = m / n, bx = fx + side * Math.round(1 + m * 0.55 - q * q * 2) + Math.round(drift * q * q), by = y - m;
            const th = m === 1 || m >= n - 1 ? 1 : 2;
            for (let i = 0; i < th; i++) r.set(bx + side * i, by, t.blade[i][(bx + by + i) & 1]);
          }
        }
        if (st) continue;
        // canopy: the stipe lies along the surface in a mat of blades; a fringe hangs from it and leans with the surge
        const [tx] = pts[pts.length - 1];
        for (let i = 0; i <= k.len; i++) {
          const cx = tx + k.dir * i, cy = surfY(a, cx) + 1 + ((i >> 2) & 1);
          r.set(cx, cy, i & 1 ? "F" : "e"); r.set(cx, cy + 1, (cx & 1) ? "n" : "e"); r.set(cx, cy + 2, "o");
          const n = 2 + (hash(k.x, i, 49) % 6);
          for (let m = 1; m <= n; m++) {
            const bx = cx + Math.round((sv * m) / n), by = cy + 2 + m;
            r.set(bx, by, m === n ? "o" : (bx + by) & 1 ? "n" : m < 3 ? "e" : "o");
          }
          if (i % 5 === 2) r.set(cx, cy - 1, "F");                                    // floats breaking the surface
        }
      }
      // holdfast: a tangle of root-like grips on the rock
      for (let i = -4; i <= 7; i++) {
        const hgt = 3 - Math.min(3, Math.abs(i - 1.5) >> 1);
        for (let j = 0; j < hgt; j++) r.set(k.x + i, k.base - 1 - j, (i + j) & 1 ? "g" : "f");
      }
      r.set(k.x - 5, k.base - 1, "g"); r.set(k.x + 8, k.base - 1, "g");
    }
  }
  const SMALL_URCHIN = [["z.z.z", ".CBB.", "zBBgz"], [".z.z.", "zCBBz", ".BBg."]];
  function drawSmallUrchins(r, a) {               // two little urchins creeping over the reef, a pixel every two seconds
    const U = [{ x0: 6, span: 30, y: LEDGE_Y - 3, ph: 0 }, { x0: 280, span: 26, y: SHELF_Y - 3, ph: 37 }];
    for (const u of U) {
      const p = ((a + u.ph) >> 3) % (u.span * 2), x = u.x0 + (p < u.span ? p : u.span * 2 - p);
      spr(r, SMALL_URCHIN[((a + u.ph) >> 3) & 1], x, u.y);
    }
  }
  function drawBuoy(r, a) {                       // fishing buoy riding the swell, its rope pulled to and fro by the surge
    const off = Math.round(4 * surge(a, 204)), y = surfY(a, 204) - 7, bx = 202 + off;
    const ax = 206, ay = FLOOR - 4;
    for (let yy = y + 9; yy < ay; yy++) {
      const f = (ay - yy) / (ay - y - 9);
      r.set(ax + Math.round(off * f), yy, (yy & 1) ? "F" : "e");
    }
    r.rect(ax - 3, ay, 7, 4, "x"); r.hline(ax - 3, ay, 7, "w"); r.set(ax, ay - 1, "w");
    spr(r, BUOY, bx, y);
  }
  function drawFloatCrate(r, a) {                 // the wooden crate floats, a third of it above the water
    const y = surfY(a, 152) - 6;
    spr(r, CRATE, 144, y);
    for (const x of [142, 143, 160, 161]) r.set(x, surfY(a, x), "w");
  }
  function drawBubbles(r, a) {                    // the figure breathes out a string of bubbles every few seconds
    const mx = 92, my = FLOOR - 9;
    for (let b = 0; b < 4; b++) {
      const t = (a + b * 3) % 32;
      if (t > 22) continue;
      const y = my - t * 4 - (t >> 1), x = mx + (b & 1) + Math.round(1.2 * Math.sin(t / 2 + b)) + Math.round(2 * surge(a, mx) * (t / 22));
      if (y < SURF + 3) continue;
      if (b === 0 && t > 3) { r.set(x, y, "u"); r.set(x + 1, y, "v"); r.set(x, y + 1, "v"); r.set(x + 1, y + 1, "w"); }
      else r.set(x, y, "u");
    }
  }

  // ---- animals (8 fps) ----
  // Purple urchin: rolls up to the kelp holdfast, gnaws at it (spines bristling, shreds of kelp drifting off),
  // then rolls back to the edge of the pit.
  function drawUrchin(r, tick) {
    const p = tick % 64;
    let x;
    if (p < 14) x = 116 - (p >> 1);
    else if (p < 40) x = 109;
    else x = 109 + Math.min(7, (p - 40) >> 1);
    const gnaw = p >= 14 && p < 40, cx = x + 6 + (gnaw && (tick & 1) ? -1 : 0), cy = FLOOR - 6;
    const rot = -x * 0.32 + (gnaw ? (tick & 2 ? 0.12 : 0) : 0);
    for (let i = 0; i < 16; i++) {                // spines
      const ang = rot + (i * 2 * Math.PI) / 16, len = i & 1 ? 6 : 7;
      for (let rr = 4; rr <= len; rr++) {
        const sx = cx + Math.round(Math.cos(ang) * rr), sy = cy + Math.round(Math.sin(ang) * rr);
        if (sy < FLOOR) r.set(sx, sy, rr === len ? "C" : "B");
      }
    }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {   // body: outlined, lit upper-left
      const d = dx * dx + dy * dy;
      if (d > 18) continue;
      r.set(cx + dx, cy + dy, d > 12 ? "z" : dx + dy < -2 ? "C" : dx + dy > 2 ? "g" : "B");
    }
    r.set(cx - 2, cy - 2, "D");
    if (gnaw) {                                   // shreds of kelp drifting up from the bitten holdfast
      const q = (p - 14) % 8;
      r.set(108 - (q >> 2), FLOOR - 4 - q, "e"); if (q > 3) r.set(107 - (q >> 1), FLOOR - 2 - q, "f");
    }
  }
  // Sea otter afloat on its back: knocks the stone on the shell twice, rests, and bobs with the swell.
  function drawOtter(r, tick) {
    const x = 28, y = surfY(tick >> 1, 38) - 6;
    const seq = [0, 0, 1, 2, 2, 1, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0];
    const p = tick % 32, f = OTTER_ARMS[p < 16 ? seq[p] : 0];
    spr(r, OTTER_BODY, x, y);
    for (const [dx, dy, c] of SHELL) r.set(x + dx, y + dy, c);
    for (const [dx, dy] of f.paws) r.set(x + dx, y + dy, "g");
    for (const [dx, dy, c] of STONE) r.set(x + f.stone[0] + dx, y + f.stone[1] + dy, c);
    for (const [dx, dy] of f.chips) r.set(x + dx, y + dy, "c");
    if (p >= 16 && p < 24 && (tick & 4)) r.set(x + 3, y + 3, "E");                   // blinks while resting
  }

  window.PB_CONCEPT_SCENES["kelp_forest"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawSurface(r, a);
      drawShafts(r, a);
      drawFarKelp(r, a);
      r.blit(L.pier, 0, 0);
      drawKelp(r, a);
      r.blit(L.ground, 0, 0);
      drawSmallUrchins(r, a);
      r.blit(L.props, 0, 0);
      drawBuoy(r, a);
      drawFloatCrate(r, a);
      drawUrchin(r, tick);
      drawOtter(r, tick);
      drawBubbles(r, a);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
