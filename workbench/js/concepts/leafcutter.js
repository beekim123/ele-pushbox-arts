/* ART-04r 地图概念场景 · 切叶蚁菌园（leafcutter）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：左上漏光的入口竖井、奶白海绵状的菌园、右边巨树板根（蚁道里的扛叶蚁队作环境动画）。
 * 机关外观（只示意，不实现规则）：会自己消失又长回来的菌塞（lifetime）、小工蚁托着走的叶毯（conveyor）、可挖的松土（dig）。
 * 环境（4 fps）：扛叶蚁排长队，叶片像小帆一起晃着往菌园走；菌丝从菌园伸出去又缩回；入口漏下的绿光斑驳晃动。
 * 动物（8 fps）：军蚁（怪物，一队从左边侧洞涌来堵路）、蓝闪蝶（提示动物，停在树根平台上，翅膀开合闪蓝光）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const FLOOR = OY + 9 * 16;                      // 148: top of the packed-earth floor
  const ROOT_Y = OY + 6 * 16;                     // 100: top of the root platform
  const RX0 = 120, RX1 = 199;                     // root platform spans x 120–199
  const CONV0 = 80, CONV1 = 127;                  // leaf-mat conveyor
  const PIT = 136;                                // fungus plug in a floor pit, x 136–151
  const DIG = 160;                                // loose soil, x 160–191
  const CHX = 252, CHR = 50, CHTOP = 62;          // fungus chamber: arch centre x, half width, crown y
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

  const mod = (a, n) => ((a % n) + n) % n;
  function tri(t, period, amp) {                  // integer triangle wave in [-amp, amp]
    const p = mod(t, period), half = period >> 1;
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
  const codeAt = (r, x, y) => {
    const i = (y * W + x) * 4, d = r.data;
    return d[i + 3] ? REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : null;
  };
  function remapPx(r, x, y, map) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = codeAt(r, x, y), m = c && map[c];
    if (m && m !== c) r.set(x, y, m);
  }

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                // protagonist-sized figure, facing right
    "................",
    ".....zzzzz......",
    "....zllkkkz.....",
    "...zlkkkkkkz....",
    ".zzkkkkkkkkkzz..",
    "zbkkkkkkkkkkkbz.",
    ".zzzEEEEEEEEzz..",
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
  const ARMY = [                                  // army ant soldier facing right: walk A / walk B / jaws open (8 fps)
    ["...........z.z..", "..........z..z..", ".zzzz.....zzzz..", "zaaahz.zz.zaahz.", "zahhhzzahzzhhhzc",
      "zhhhgzzhgzzhzhcc", ".zhgz.zzzz.zzcc.", "...z..z.z.z.....", "..z..z..z..z....", ".z..z....z..z..."],
    ["...........z.z..", "..........z..z..", ".zzzz.....zzzz..", "zaaahz.zz.zaahz.", "zahhhzzahzzhhhzc",
      "zhhhgzzhgzzhzhcc", ".zhgz.zzzz.zzcc.", "....z.z..z.z....", "...z...z..z.z...", "...z...z...z.z.."],
    ["...........z..z.", "..........z..z..", ".zzzz.....zzzz.c", "zaaahz.zz.zaahzc", "zahhhzzahzzhhhz.",
      "zhhhgzzhgzzhzhz.", ".zhgz.zzzz.zzzcc", "...z..z.z.z.....", "..z..z..z..z....", ".z..z....z..z..."],
  ];
  const MORPHO = [                                // blue morpho resting: closed (brown underside) / half / open (blue)
    ["....zzzz.....", "...zFeeFz....", "...zekzez....", "...zeeeFz....", "....zeFz.....", ".....zz......",
      "....z.zz.....", "...z..z.z...."],
    ["..zz...zz....", ".zqrz.zrqz...", ".zrrrzrrrz...", "..zqrzrqz....", "...zqzqz.....", "....zzz......",
      "....z.zz.....", "...z..z.z...."],
    ["zzz.....zzz..", "zrrz...zrrz..", "zrsrz.zrsrz..", "zrrrrzrrrrz..", ".zqrrzrrqz...", "..zqrzrqz....",
      "..zrqzqrz....", "...zz.zz....."],
  ];
  const LEAVES = [                                // leaf pieces carried like little sails (stem at the bottom right)
    ["..ooo...", ".onnno..", "onnnnno.", "onnnnnno", ".onnnnno", "..onnnno", "....oono", "......o."],
    ["...oo...", "..onno..", ".onnnno.", ".onnnnno", "..onnnno", "..onnnno", "...oonno", "......o."],
    ["........", ".oooo...", "onnnnoo.", "onnnnnno", ".onnnnno", "..oonnno", "....ooo.", "......o."],
  ];

  // ---- geometry ----
  const tunnelC = (x) => (x <= 110 ? 50 : 50 + (((x - 110) * 13) >> 6));   // tunnel centre line: level, then sloping down
  const archTop = (x) => {                        // crown of the fungus chamber
    const d = (x - CHX) / CHR;
    return Math.abs(d) >= 1 ? 999 : Math.round(FLOOR - Math.sqrt(1 - d * d) * (FLOOR - CHTOP));
  };
  function inTunnel(x, y) {
    if (x < 26 || x > CHX - 30) return false;
    const c = tunnelC(x), n = (hash(x >> 2, 9, 41) % 3) - 1;
    return y >= c - 10 + n && y <= c + 9;
  }
  function inShaft(x, y) {                        // entrance shaft from the surface down to the tunnel
    if (y > 46) return false;
    const n = (hash(y >> 2, 7, 42) % 3) - 1;
    return x >= 16 + ((y * 3) >> 4) + n && x <= 46 + (y >> 3) - n;
  }
  const inSideHole = (x, y) => x < 24 && y > 120 && y < FLOOR && (x - 2) * (x - 2) / 576 + (y - FLOOR) * (y - FLOOR) / 784 <= 1;
  const inChamber = (x, y) => y >= archTop(x) && y < FLOOR;
  const ROAD = [[20, -12], [44, 59], [110, 59], [222, 81], [240, 118]];       // where the leaf column walks
  const ROAD_STEPS = ROAD.slice(1).map((p, k) => Math.max(Math.abs(p[0] - ROAD[k][0]), Math.abs(p[1] - ROAD[k][1])));
  const ROAD_LEN = ROAD_STEPS.reduce((s, n) => s + n, 0);
  function roadAt(t) {
    for (let k = 0; k < ROAD_STEPS.length; k++) {
      if (t <= ROAD_STEPS[k]) {
        const [x0, y0] = ROAD[k], [x1, y1] = ROAD[k + 1];
        return [x0 + Math.round(((x1 - x0) * t) / ROAD_STEPS[k]), y0 + Math.round(((y1 - y0) * t) / ROAD_STEPS[k])];
      }
      t -= ROAD_STEPS[k];
    }
    return ROAD[ROAD.length - 1];
  }
  const SPONGE = [[222, 133, 11], [236, 121, 12], [250, 111, 12], [264, 115, 12], [278, 123, 11], [289, 135, 9], [232, 141, 9],
    [248, 134, 12], [266, 137, 12], [282, 142, 8], [242, 104, 8], [258, 101, 8], [272, 107, 8]];
  function spongeBlob(x, y) {                     // nearest lump that covers the pixel (or null)
    if (y >= FLOOR) return null;
    let best = null, bd = 1e9;
    for (const b of SPONGE) {
      const dx = x - b[0], dy = y - b[1], d = dx * dx + dy * dy;
      const rr = b[2] + ((hash(Math.round(Math.atan2(dy, dx) * 4), b[0], 18) % 3) - 1);
      if (d <= rr * rr && d - rr * rr < bd) { bd = d - rr * rr; best = b; }
    }
    return best;
  }

  // ---- static layers ----
  function buildBack() {                          // soil, far tunnels, entrance shaft, ant road, chamber
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 3), band = (y + ((hash(x >> 3, 1, 4) % 3) | 0)) % 23 === 0;
      r.set(x, y, band && h % 3 ? "f" : h % 31 === 0 ? "f" : h % 211 === 0 ? "e" : "g");
    }
    for (const [x0, y0, x1, y1, w] of [[0, 104, 112, 96, 3], [150, 30, 260, 18, 2], [60, 128, 130, 116, 2], [262, 36, 319, 54, 2]]) {
      for (let x = x0; x <= x1; x++) {            // thin far tunnels, darker brown
        const y = Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) + tri(x, 40, 2));
        for (let k = 0; k < w; k++) r.set(x, y + k, "z");
      }
    }
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) {
      if (inShaft(x, y) || inTunnel(x, y) || inSideHole(x, y) || inChamber(x, y)) {
        const top = !(inShaft(x, y - 2) || inTunnel(x, y - 2) || inSideHole(x, y - 2) || inChamber(x, y - 2));
        r.set(x, y, top ? "f" : hash(x, y, 5) % 37 === 0 ? "g" : "z");
      }
    }
    for (let x = 26; x <= CHX - 30; x++) {        // packed floor of the ant road
      const y = tunnelC(x) + 9;
      r.set(x, y, "e"); r.set(x, y + 1, "f");
    }
    for (let k = 0; k <= 37; k++) {               // worn track down the chamber wall to the garden
      const x = 222 + Math.round((18 * k) / 37), y = 82 + k;
      if (inChamber(x, y)) { r.set(x, y, "g"); r.set(x - 1, y, "g"); }
    }
    for (let x = 14; x < 52; x++) for (let y = 0; y < 5; y++) {               // daylight leaf litter in the opening
      if (!inShaft(x, y)) continue;
      const h = hash(x, y, 6) % 7;
      r.set(x, y, y === 4 ? (h < 3 ? "o" : "p") : h === 0 ? "m" : h < 4 ? "n" : "o");
    }
    for (const [rx, len] of [[24, 18], [33, 11], [41, 22], [70, 8], [96, 12], [190, 9]]) {   // rootlets
      const y0 = rx < 50 ? 4 : tunnelC(rx) - 11;
      for (let j = 0; j < len; j++) r.set(rx + (j > len / 2 ? (j & 4 ? 1 : 0) : 0), y0 + j, j === len - 1 ? "g" : "f");
    }
    for (let x = CHX - CHR; x <= CHX + CHR; x++) for (let y = archTop(x); y < archTop(x) + 4 && y < FLOOR; y++) {
      if (y >= 0 && y > archTop(x) && bay(x, y) < 6) r.set(x, y, "y");          // a cooler shade just under the crown
    }
    return r;
  }
  function buildFront() {                         // floor, pit, conveyor trench, root platform, buttress root, sponge
    const r = layer();
    for (let x = 0; x < W; x++) for (let y = FLOOR; y < H; y++) {
      const strata = (y - FLOOR + ((hash(x >> 4, 2, 7) % 2) | 0)) % 7 === 3, h = hash(x, y, 8);
      let c = y === FLOOR ? "F" : y < 164 ? (strata ? "f" : h % 31 === 0 ? "F" : "e") : y === 164 ? "f" : h % 17 === 0 ? "e" : h % 5 === 0 ? "g" : "f";
      if (y > FLOOR && y < 164 && h % 97 === 0) c = "w";                         // pebbles
      if (y === H - 1) c = "g";
      r.set(x, y, c);
    }
    for (let x = PIT; x < PIT + 16; x++) for (let y = FLOOR; y < FLOOR + 16; y++) {
      r.set(x, y, x === PIT || x === PIT + 15 ? "g" : y > FLOOR + 12 ? "y" : "z");
    }
    for (let x = CONV0 - 1; x <= CONV1 + 1; x++) for (let y = FLOOR - 1; y < FLOOR + 6; y++) {
      r.set(x, y, x === CONV0 - 1 || x === CONV1 + 1 ? "g" : y === FLOOR + 5 ? "g" : "z");
    }
    for (let x = RX0 - 10; x <= RX1 + 10; x++) {  // horizontal root: lit top, bark lines, ends sink into the soil
      const end = x < RX0 ? RX0 - x : x > RX1 ? x - RX1 : 0, sag = end ? (end * end) >> 3 : 0;
      for (let j = 0; j < 9 - (end >> 1); j++) {
        const y = ROOT_Y + j - (x < RX0 ? sag : 0) + (x > RX1 ? sag : 0);
        let c = j === 0 ? "F" : j === 8 - (end >> 1) ? "g" : (j + ((x >> 3) & 1)) % 3 === 0 ? "f" : "e";
        if (end > 4) c = j === 0 ? "e" : "f";
        r.set(x, y, c);
      }
    }
    for (const [hx, len] of [[132, 6], [151, 9], [173, 5], [188, 7]]) for (let j = 0; j < len; j++) r.set(hx + (j > 3 ? 1 : 0), ROOT_Y + 9 + j, "f");
    for (let y = 0; y < FLOOR; y++) {             // buttress root on the right edge, flaring into the floor
      const flare = y > 104 ? ((y - 104) * (y - 104)) >> 7 : 0, x0 = 300 - flare;
      for (let x = x0; x < W; x++) {
        const i = x - x0, ridge = (x + ((y >> 4) & 1)) % 6;
        r.set(x, y, i === 0 ? "z" : i === 1 ? "F" : ridge === 0 ? "g" : ridge === 1 ? "f" : hash(x, y, 9) % 23 === 0 ? "F" : "e");
      }
    }
    for (let y = 60; y < FLOOR; y++) for (let x = 206; x < 300; x++) {        // the fungus garden: creamy sponge lumps
      const b = spongeBlob(x, y);
      if (!b) continue;
      const dx = x - b[0], dy = y - b[1], d2 = dx * dx + dy * dy, s = (dx + dy * 1.3) / b[2], q = b[2] * 0.4;
      const hiCap = (dx + q) * (dx + q) + (dy + q) * (dy + q) < (b[2] * 0.4) * (b[2] * 0.4);
      const shade = (dx + q * 0.6) * (dx + q * 0.6) + (dy + q * 0.6) * (dy + q * 0.6) > (b[2] * 0.86) * (b[2] * 0.86);
      const crease = spongeBlob(x - 1, y) !== b || spongeBlob(x, y - 1) !== b;
      const rim = d2 > (b[2] - 1) * (b[2] - 1);
      let c = rim ? (s < -0.2 ? "E" : "F") : hiCap ? "c" : shade ? "F" : "E";
      if (crease && !rim) c = s < 0 ? "E" : "F";
      const pore = hash(x >> 1, y >> 1, 10) % 6 === 0 && d2 < (b[2] - 2) * (b[2] - 2);
      if (pore) c = (x & 1) === 0 && (y & 1) === 0 ? (s < -0.5 ? "F" : "e") : c;
      r.set(x, y, c);
    }
    return r;
  }
  function buildProps() {                         // scale figure, crate, loose soil mound (dig)
    const r = layer();
    spr(r, PORTER, 48, FLOOR - 16);
    spr(r, CRATE, 64, FLOOR - 16);
    for (let x = DIG; x < DIG + 32; x++) {        // two tiles of crumbly loose soil, lighter than the packed floor
      const top = FLOOR - 16 + ((hash(x, 1, 11) % 3) | 0) - (x > DIG + 4 && x < DIG + 27 ? 1 : 0);
      for (let y = top; y < FLOOR; y++) {
        const h = hash(x, y, 12);
        let c = y === top ? "d" : h % 5 === 0 ? "e" : h % 7 === 0 ? "f" : h % 13 === 0 ? "d" : "F";
        if ((x === DIG || x === DIG + 31) && y > top) c = "e";
        r.set(x, y, c);
      }
    }
    for (const [cx, cy] of [[DIG + 9, FLOOR - 9], [DIG + 21, FLOOR - 6]]) {    // dug-out pockets
      for (const [i, j, c] of [[0, 0, "f"], [1, 0, "g"], [2, 0, "f"], [0, 1, "g"], [1, 1, "z"], [2, 1, "g"], [1, 2, "f"]]) r.set(cx + i, cy + j, c);
    }
    for (const [x, y] of [[DIG - 3, FLOOR - 1], [DIG - 2, FLOOR - 2], [DIG + 33, FLOOR - 1], [DIG + 34, FLOOR - 1], [DIG + 32, FLOOR - 2]]) r.set(x, y, "F");
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    L = { back: buildBack(), front: buildFront(), props: buildProps() };
    // green-tinted light from the entrance: each colour one palette step brighter, hue pulled to leaf green
    L.TOP = [];                                  // top surface of the garden, for the gardener ants
    for (let x = 0; x < W; x++) { let y = 60; while (y < FLOOR && !spongeBlob(x, y)) y++; L.TOP.push(y); }
    L.FOOT = [L.TOP.findIndex((y) => y < FLOOR) - 1, W - [...L.TOP].reverse().findIndex((y) => y < FLOOR)];
    L.GL = { z: "p", y: "p", g: "o", f: "n", e: "F", o: "n", n: "m", p: "o", h: "a", a: "b" };
    L.LIT = new Uint8Array(W * FLOOR);
    L.SPOTS = [];
    for (let i = 0; i < 26; i++) {
      const y = 8 + (hash(i, 1, 13) % 136), xl = 16 + ((y * 3) >> 4), xr = 46 + ((y * 9) >> 4);
      L.SPOTS.push([xl + (hash(i, 2, 13) % Math.max(1, xr - xl)), y, 3 + (hash(i, 3, 13) % 4), hash(i, 4, 13) % 24]);
    }
  }

  // ---- ambient (4 fps) ----
  function drawAntRoad(r, a) {                    // leaf-cutter column: every leaf sways at once, like a fleet of little sails
    const sway = [0, 1, 0, -1][(a >> 1) & 3], n = Math.floor(ROAD_LEN / 18);
    for (let i = 0; i < n; i++) {
      const [px, fy] = roadAt(mod(a + i * 18, n * 18) * ROAD_LEN / (n * 18) | 0), x = px - 4, step = (a + i) & 1;
      for (const [dx, dy, c] of [[0, -2, "h"], [1, -2, "h"], [2, -2, "h"], [0, -1, "g"], [1, -1, "h"], [2, -1, "h"], [3, -1, "g"],
        [4, -2, "h"], [5, -2, "h"], [4, -1, "h"], [6, -3, "h"], [7, -3, "h"], [6, -2, "h"], [7, -2, "a"], [6, -1, "h"], [8, -2, "g"]]) r.set(x + dx, fy + dy, c);
      for (const lx of [2, 4, 6]) r.set(x + lx + (step ? 1 : 0), fy, "g");      // legs
      const leaf = LEAVES[i % 3], top = fy - 3 - leaf.length;
      for (let j = 0; j < leaf.length; j++) {
        const off = j < 3 ? sway : 0;
        for (let k = 0; k < 8; k++) if (leaf[j][k] !== ".") r.set(x + 1 + k + off, top + j, leaf[j][k]);
      }
    }
  }
  function drawGreenLight(r, a) {                 // dappled light falling from the entrance (background only)
    const lit = L.LIT; lit.fill(0);
    for (let y = 0; y < FLOOR; y++) {             // a thin even wash inside the cone …
      const xl = 16 + ((y * 3) >> 4), xr = Math.min(W - 1, 46 + ((y * 9) >> 4)), th = y < 44 ? 2 : 1;
      for (let x = xl; x <= xr; x++) if (bay(x, y) < th) lit[y * W + x] = 1;
    }
    for (const [x0, y0, rad, ph] of L.SPOTS) {    // … and swaying flecks where the leaves above let more through
      const sx = x0 + tri(a + ph, 24, 3), sy = y0 + tri(a + 2 * ph, 36, 1), rr = rad * rad;
      for (let y = Math.max(0, sy - rad); y <= Math.min(FLOOR - 1, sy + rad); y++) for (let x = Math.max(0, sx - rad); x <= Math.min(W - 1, sx + rad); x++) {
        const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
        if (d <= rr && bay(x, y) < (d * 2 < rr ? 10 - 2 * ((y / 48) | 0) : 4)) lit[y * W + x] = 1;
      }
    }
    for (let k = 0; k < lit.length; k++) if (lit[k]) remapPx(r, k % W, (k / W) | 0, L.GL);
  }
  const HYPHAE = [                                // [x0, angle, curl, max length]; start on the garden's top (floor ones at its foot)
    [-1, 3.14, 0, 18], [214, -2.5, 0.03, 14], [229, -2.1, 0.04, 16], [246, -1.75, -0.03, 18],
    [262, -1.3, 0.03, 20], [284, -0.6, -0.05, 12], [1, 0, 0, 5]];
  function strand(r, x, y, ang, curl, len, c, tip) {
    for (let k = 0; k < len; k++) {
      ang += curl; x += Math.cos(ang); y += Math.sin(ang);
      const px = Math.round(x), py = Math.min(FLOOR - 1, Math.round(y));
      r.set(px, py, k === len - 1 && tip ? tip : c);
    }
    return [x, y, ang];
  }
  function drawHyphae(r, a) {                     // mycelium creeps out from the garden, branching, then draws back in
    HYPHAE.forEach(([x0, ang, curl, max], i) => {
      const len = Math.min(max, Math.max(0, tri(a + i * 11, 64, max) + (max >> 1)));
      let x = x0 === -1 ? L.FOOT[0] : x0 === 1 ? L.FOOT[1] : x0, y = x0 === -1 || x0 === 1 ? FLOOR - 1 : L.TOP[x0];
      for (let k = 0; k < len; k += 4) {
        const seg = Math.min(4, len - k);
        [x, y, ang] = strand(r, x, y, ang, curl, seg, "E", k + seg >= len ? "c" : null);
        const side = Math.min(3, (len - k - seg) >> 1);
        if (side > 0) strand(r, x, y, ang + ((k >> 2) & 1 ? 0.9 : -0.9), 0, side, "F", null);
      }
    });
  }
  function drawGardeners(r, a) {                  // a few small workers potter over the top of the garden
    for (const [x0, w, ph] of [[230, 14, 0], [252, 18, 7], [272, 12, 13]]) {
      const x = x0 + tri(a + ph, w * 4, w >> 1), y = L.TOP[x] - 1, fl = mod(a + ph, w * 4) >= w * 2;
      spr(r, [".hh.h", "hhhhh", "g.g.g"].map((row) => (a & 1 ? row : row.replace("g.g.g", ".g.g."))), x - 2, y - 2, fl);
    }
  }
  const LENS = [0, 1, 1, 2, 2, 2, 2, 1, 1, 0];     // half-height profile of one leaf piece (points to the right)
  function drawConveyor(r, a) {                   // leaf mat carried along by tiny workers, drifting to the right
    for (let x = CONV0; x <= CONV1; x++) {
      const u = mod(x - a, 10), hw = LENS[u];
      for (let y = FLOOR - 2; y <= FLOOR + 2; y++) {
        const v = y - FLOOR, d = Math.abs(v);
        let c = d > hw ? "o" : d === hw ? (v < 0 ? "n" : "o") : v < 0 ? "m" : v === 0 ? "n" : "n";
        if (v === 0 && hw > 0 && u > 1) c = u === 2 ? "o" : "n";                 // midrib
        r.set(x, y, c);
      }
      const leg = mod(x + a, 4);
      r.set(x, FLOOR + 3, leg === 0 ? "h" : leg === 2 ? "g" : "z");             // the carriers' legs underneath
    }
    for (const [x, c] of [[CONV1 + 1, "h"], [CONV1 + 2, "h"]]) { r.set(x, FLOOR + 1, c); r.set(x, FLOOR + 2, "h"); }   // lead ant's head
    r.set(CONV1 + 3, FLOOR + 1, "z");
  }
  function drawPlug(r, a) {                       // fungus plug: fresh → ageing → crumbles away → empty pit → regrows
    const f = mod(a, 44);
    let fill = 16, age = 0, crumble = 0;
    if (f >= 14 && f < 22) age = f - 13;          // brown spots spread
    else if (f >= 22 && f < 28) { age = 9; crumble = f - 21; }
    else if (f >= 28 && f < 34) fill = 0;
    else if (f >= 34) fill = ((f - 33) * 16) / 10 | 0;   // regrows from the bottom of the pit
    if (fill === 0 || crumble > 5) return;
    for (let x = PIT + 1; x < PIT + 15; x++) {
      const dome = x > PIT + 2 && x < PIT + 13 ? (x > PIT + 4 && x < PIT + 11 ? 3 : 2) : 1;
      const yTop = fill === 16 ? FLOOR - dome : FLOOR + 16 - fill;
      for (let y = yTop; y < FLOOR + 16; y++) {
        const h = hash(x, y, 15);
        if (crumble && bay(x, y) < crumble * 3 - (y > FLOOR + 6 ? 2 : 0)) continue;
        let c = y === yTop ? "c" : x === PIT + 1 ? "E" : x === PIT + 14 ? "F" : y === yTop + 1 && x < PIT + 8 ? "c" : h % 9 === 0 ? "F" : "E";
        if (!crumble && ((x * 5 + y * 3) % 11 === 0) && y > yTop + 1 && x > PIT + 2 && x < PIT + 13) c = "F";   // spongy pores
        if (age && h % 11 < age) c = h & 1 ? "F" : "e";
        r.set(x, y, c);
      }
    }
    if (crumble) for (let k = 0; k < 4; k++) r.set(PIT + 3 + k * 3, FLOOR + 2 + crumble * 2 + (k & 1) * 2, "F");   // falling crumbs
  }

  // ---- animals (8 fps) ----
  function drawArmy(r, tick) {                    // three soldiers pour out of the side hole, block the road, fall back
    const p = mod(tick, 64);
    let head, flip = false, jaws = false;
    if (p < 24) head = -18 + p * 2;
    else if (p < 40) { head = 28 + (hash(p, 1, 16) % 3) - 1; jaws = true; }
    else { head = 28 - (p - 40) * 2; flip = true; }
    for (let i = 0; i < 3; i++) {
      const x = head - i * 14 - (i === 2 ? 1 : 0), bob = (tick + i) & 1;
      const fr = jaws ? ((tick >> 1) + i) & 1 ? 2 : 0 : (tick + i) & 1;
      spr(r, ARMY[fr], x, FLOOR - 10 - (jaws ? 0 : bob ? 1 : 0), flip);
    }
  }
  function drawMorpho(r, tick) {                  // rests on the root platform: wings open and close, a blue flash
    const p = mod(tick, 16), fr = p < 6 || p > 11 ? 0 : p === 6 || p === 11 ? 1 : 2;
    const x = 170, y = ROOT_Y - 8;
    spr(r, MORPHO[fr], x, y, false, fr === 2 && p !== 7 ? { s: "r" } : null);
  }

  window.PB_CONCEPT_SCENES["leafcutter"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawAntRoad(r, a);
      drawGreenLight(r, a);
      r.blit(L.front, 0, 0);
      drawHyphae(r, a);
      drawGardeners(r, a);
      drawConveyor(r, a);
      drawPlug(r, a);
      r.blit(L.props, 0, 0);
      drawArmy(r, tick);
      drawMorpho(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
